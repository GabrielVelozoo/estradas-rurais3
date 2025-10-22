from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
import re

class PedidoLiderancaBase(BaseModel):
    municipio_id: int = Field(..., description="ID do município")
    municipio_nome: str = Field(..., min_length=1, max_length=200, description="Nome do município")
    pedido_titulo: str = Field(..., min_length=1, max_length=200, description="Título do pedido")
    protocolo: Optional[str] = Field(None, description="Protocolo no formato 00.000.000-0 (opcional)")
    nome_lideranca: str = Field(..., min_length=1, max_length=200, description="Nome da liderança")
    numero_lideranca: str = Field(..., min_length=1, max_length=100, description="Número da liderança")
    descricao: Optional[str] = Field(None, max_length=2000, description="Descrição detalhada do pedido")
    
    @validator('protocolo')
    def validate_protocolo_format(cls, v):
        """Validar formato do protocolo apenas se fornecido"""
        if not v or v.strip() == '':
            return ''  # Retornar string vazia ao invés de None
            
        v = v.strip()
        
        # Padrão: XX.XXX.XXX-X (2 dígitos, ponto, 3 dígitos, ponto, 3 dígitos, hífen, 1 dígito)
        pattern = r'^\d{2}\.\d{3}\.\d{3}-\d{1}$'
        
        if not re.match(pattern, v):
            raise ValueError(
                'Protocolo deve estar no formato 00.000.000-0 (exemplo: 24.298.238-6)'
            )
        
        return v
    
    @validator('numero_lideranca')
    def validate_numero_lideranca(cls, v):
        """Validar que número da liderança contém apenas números"""
        v = v.strip()
        # Remover formatação para validar
        cleaned = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not cleaned.isdigit():
            raise ValueError('Número da liderança deve conter apenas números')
        if len(cleaned) < 1:
            raise ValueError('Informe o Número da Liderança')
        # Aceitar qualquer quantidade de dígitos (sem limite superior)
        return v

class PedidoLiderancaCreate(PedidoLiderancaBase):
    """Schema para criar um novo pedido"""
    pass

class PedidoLiderancaUpdate(BaseModel):
    """Schema para atualizar um pedido (todos os campos opcionais)"""
    municipio_id: Optional[int] = Field(None, description="ID do município")
    municipio_nome: Optional[str] = Field(None, min_length=1, max_length=200)
    pedido_titulo: Optional[str] = Field(None, min_length=1, max_length=200)
    protocolo: Optional[str] = Field(None, description="Protocolo no formato 00.000.000-0")
    nome_lideranca: Optional[str] = Field(None, min_length=1, max_length=200)
    numero_lideranca: Optional[str] = Field(None, min_length=1, max_length=100)
    descricao: Optional[str] = Field(None, max_length=2000)
    
    @validator('protocolo')
    def validate_protocolo_format(cls, v):
        """Validar formato do protocolo se fornecido"""
        if v is None or v.strip() == '':
            return ''  # Retornar string vazia ao invés de None
            
        v = v.strip()
        pattern = r'^\d{2}\.\d{3}\.\d{3}-\d{1}$'
        
        if not re.match(pattern, v):
            raise ValueError('Protocolo deve estar no formato 00.000.000-0 (exemplo: 24.298.238-6)')
        
        return v
    
    @validator('numero_lideranca')
    def validate_numero_lideranca(cls, v):
        """Validar que número da liderança contém apenas números se fornecido"""
        if v is None:
            return v
        v = v.strip()
        cleaned = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not cleaned.isdigit():
            raise ValueError('Número da liderança deve conter apenas números')
        if len(cleaned) < 1:
            raise ValueError('Informe o Número da Liderança')
        # Aceitar qualquer quantidade de dígitos (sem limite superior)
        return v

class PedidoLiderancaResponse(BaseModel):
    """Schema de resposta com campos adicionais - permite campos vazios para compatibilidade - UPDATED"""
    id: str
    user_id: str
    municipio_id: int = Field(..., description="ID do município")
    municipio_nome: str = Field(..., min_length=0, max_length=200, description="Nome do município")
    pedido_titulo: str = Field(..., min_length=0, max_length=200, description="Título do pedido")
    protocolo: str = Field(default="", min_length=0, description="Protocolo no formato 00.000.000-0")
    nome_lideranca: str = Field(..., min_length=0, max_length=200, description="Nome da liderança")
    numero_lideranca: str = Field(..., min_length=0, max_length=100, description="Número da liderança")
    descricao: str = Field(default="", min_length=0, max_length=2000, description="Descrição detalhada do pedido")
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True