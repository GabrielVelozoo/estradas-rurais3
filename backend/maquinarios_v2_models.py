from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import uuid


# Catálogo fixo de equipamentos com preços
CATALOGO_EQUIPAMENTOS = {
    "Trator de Esteiras": 1222500.00,
    "Motoniveladora": 1217352.22,
    "Caminhão Caçamba 6x4": 905300.00,
    "Caminhão Prancha": 900000.00,
    "Escavadeira": 830665.00,
    "Pá Carregadeira": 778250.00,
    "Rolo compactador": 716180.91,
    "Retroescavadeira": 484111.11,
    "Bob Cat": 430000.00,
    "Trator 100–110CV": 410000.00,
}


class ItemPedidoMaquinario(BaseModel):
    """Item individual de um pedido de maquinário"""
    equipamento: str
    preco_unitario: float
    quantidade: int = Field(ge=1)  # Mínimo 1
    observacao: Optional[str] = ""
    subtotal: float
    
    @validator('equipamento')
    def validate_equipamento(cls, v):
        """Validar que o equipamento existe no catálogo"""
        if v not in CATALOGO_EQUIPAMENTOS:
            raise ValueError(f"Equipamento '{v}' não encontrado no catálogo. Opções: {list(CATALOGO_EQUIPAMENTOS.keys())}")
        return v
    
    @validator('preco_unitario')
    def validate_preco_unitario(cls, v, values):
        """Validar que o preço unitário corresponde ao catálogo"""
        equipamento = values.get('equipamento')
        if equipamento and equipamento in CATALOGO_EQUIPAMENTOS:
            preco_esperado = CATALOGO_EQUIPAMENTOS[equipamento]
            if abs(v - preco_esperado) > 0.01:  # Tolerância de 1 centavo
                raise ValueError(f"Preço unitário inválido para '{equipamento}'. Esperado: R$ {preco_esperado:.2f}, Recebido: R$ {v:.2f}")
        return v
    
    @validator('subtotal')
    def validate_subtotal(cls, v, values):
        """Validar que o subtotal está correto"""
        preco = values.get('preco_unitario')
        quantidade = values.get('quantidade')
        if preco and quantidade:
            subtotal_esperado = preco * quantidade
            if abs(v - subtotal_esperado) > 0.01:
                raise ValueError(f"Subtotal inválido. Esperado: R$ {subtotal_esperado:.2f}, Recebido: R$ {v:.2f}")
        return v


class PedidoMaquinarioV2Base(BaseModel):
    """Base model para Pedido de Maquinário V2"""
    municipio_id: str
    municipio_nome: str
    lideranca_nome: Optional[str] = ""
    itens: List[ItemPedidoMaquinario] = Field(min_items=1)  # Mínimo 1 item
    valor_total: float
    status: Optional[str] = None  # em_andamento, aguardando_atendimento, arquivado, atendido, null
    
    @validator('municipio_id', pre=True)
    def coerce_municipio_id(cls, v):
        """Converter qualquer tipo para string (tolerância)"""
        if v is None:
            raise ValueError("municipio_id é obrigatório")
        return str(v)
    
    @validator('status')
    def validate_status(cls, v):
        """Validar status permitido"""
        valid_statuses = [None, "", "em_andamento", "aguardando_atendimento", "arquivado", "atendido"]
        if v not in valid_statuses:
            raise ValueError(f"Status inválido. Valores permitidos: {valid_statuses}")
        return v if v else None
    
    @validator('valor_total')
    def validate_valor_total(cls, v, values):
        """Validar que o valor total está correto"""
        itens = values.get('itens')
        if itens:
            total_esperado = sum(item.subtotal for item in itens)
            if abs(v - total_esperado) > 0.01:
                raise ValueError(f"Valor total inválido. Esperado: R$ {total_esperado:.2f}, Recebido: R$ {v:.2f}")
        return v


class PedidoMaquinarioV2Create(PedidoMaquinarioV2Base):
    """Model para criar um novo pedido"""
    pass


class PedidoMaquinarioV2Update(BaseModel):
    """Model para atualizar um pedido existente"""
    municipio_id: Optional[str] = None
    municipio_nome: Optional[str] = None
    lideranca_nome: Optional[str] = None
    itens: Optional[List[ItemPedidoMaquinario]] = None
    valor_total: Optional[float] = None
    status: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        """Validar status permitido"""
        valid_statuses = [None, "", "em_andamento", "aguardando_atendimento", "arquivado", "atendido"]
        if v not in valid_statuses:
            raise ValueError(f"Status inválido")
        return v if v else None
    
    @validator('valor_total')
    def validate_valor_total(cls, v, values):
        """Validar que o valor total está correto"""
        itens = values.get('itens')
        if itens and v is not None:
            total_esperado = sum(item.subtotal for item in itens)
            if abs(v - total_esperado) > 0.01:
                raise ValueError(f"Valor total inválido")
        return v


class PedidoMaquinarioV2Response(PedidoMaquinarioV2Base):
    """Model para resposta da API"""
    id: str
    created_at: str
    updated_at: str
    
    class Config:
        orm_mode = True
