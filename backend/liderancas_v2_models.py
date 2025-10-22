from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
import uuid
import re


class PedidoLiderancaV2Base(BaseModel):
    """Base model para Pedido de Liderança V2"""
    municipio_id: str
    municipio_nome: str
    lideranca_nome: str
    titulo: Optional[str] = ""
    protocolo: Optional[str] = ""
    lideranca_telefone: Optional[str] = ""
    descricao: Optional[str] = ""
    status: Optional[str] = None  # em_andamento, aguardando_atendimento, arquivado, atendido, null
    
    @validator('status')
    def validate_status(cls, v):
        """Validar status permitido"""
        valid_statuses = [None, "", "em_andamento", "aguardando_atendimento", "arquivado", "atendido"]
        if v not in valid_statuses:
            raise ValueError(f"Status inválido. Valores permitidos: {valid_statuses}")
        return v if v else None
    
    @validator('protocolo')
    def validate_protocolo(cls, v):
        """Validação suave do protocolo (opcional)"""
        if not v or v.strip() == "":
            return ""
        
        # Remove tudo que não é dígito para validar
        digits = re.sub(r'\D', '', v)
        
        # Se tiver dígitos E não for 9, aceitar mas logar warning
        # Validação suave: aceita qualquer quantidade, mas ideal é 9
        if digits and len(digits) != 9:
            # Não bloquear, apenas aceitar
            pass
        
        return v.strip()
    
    @validator('lideranca_telefone')
    def validate_telefone(cls, v):
        """Validação suave do telefone (opcional)"""
        if not v or v.strip() == "":
            return ""
        
        # Remove tudo que não é dígito
        digits = re.sub(r'\D', '', v)
        
        # Validação suave: aceita qualquer quantidade de dígitos
        # Ideal seria 10 ou 11, mas não bloqueia
        if digits and len(digits) not in [10, 11]:
            # Não bloquear, apenas aceitar
            pass
        
        return v.strip()


class PedidoLiderancaV2Create(PedidoLiderancaV2Base):
    """Model para criar um novo pedido"""
    pass


class PedidoLiderancaV2Update(BaseModel):
    """Model para atualizar um pedido existente (todos campos opcionais)"""
    municipio_id: Optional[str] = None
    municipio_nome: Optional[str] = None
    lideranca_nome: Optional[str] = None
    titulo: Optional[str] = None
    protocolo: Optional[str] = None
    lideranca_telefone: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        """Validar status permitido"""
        valid_statuses = [None, "", "em_andamento", "aguardando_atendimento", "arquivado", "atendido"]
        if v not in valid_statuses:
            raise ValueError(f"Status inválido. Valores permitidos: {valid_statuses}")
        return v if v else None
    
    @validator('protocolo')
    def validate_protocolo(cls, v):
        """Validação suave do protocolo"""
        if v is None or v.strip() == "":
            return ""
        
        digits = re.sub(r'\D', '', v)
        if digits and len(digits) != 9:
            raise ValueError(f"Protocolo deve ter 9 dígitos (formato: 00.000.000-0)")
        
        return v.strip()
    
    @validator('lideranca_telefone')
    def validate_telefone(cls, v):
        """Validação suave do telefone"""
        if v is None or v.strip() == "":
            return ""
        
        digits = re.sub(r'\D', '', v)
        if digits and len(digits) not in [10, 11]:
            raise ValueError(f"Telefone deve ter 10 ou 11 dígitos")
        
        return v.strip()


class PedidoLiderancaV2Response(PedidoLiderancaV2Base):
    """Model para resposta da API"""
    id: str
    created_at: str
    updated_at: str
    
    class Config:
        orm_mode = True
