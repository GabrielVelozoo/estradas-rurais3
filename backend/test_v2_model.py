#!/usr/bin/env python3
"""
Test script to verify V2 model behavior
"""

from liderancas_v2_models import PedidoLiderancaV2Create
import json

def test_v2_model():
    """Test V2 model creation and validation"""
    
    # Test with V2 field names
    try:
        v2_data = {
            "municipio_id": "1",
            "municipio_nome": "Curitiba",
            "lideranca_nome": "João Teste",
            "titulo": "Teste",
            "protocolo": "12.345.678-9",
            "lideranca_telefone": "41999887766",
            "descricao": "Teste",
            "status": "em_andamento"
        }
        
        model = PedidoLiderancaV2Create(**v2_data)
        print("✅ V2 model creation with V2 field names: SUCCESS")
        print(f"Model dict: {model.dict()}")
        
    except Exception as e:
        print(f"❌ V2 model creation with V2 field names: FAILED - {e}")
    
    # Test with V1 field names (should fail)
    try:
        v1_data = {
            "municipio_id": "1",
            "municipio_nome": "Curitiba",
            "pedido_titulo": "Teste",
            "nome_lideranca": "João Teste",
            "numero_lideranca": "41999887766",
            "protocolo": "12.345.678-9",
            "descricao": "Teste"
        }
        
        model = PedidoLiderancaV2Create(**v1_data)
        print("❌ V2 model creation with V1 field names: UNEXPECTED SUCCESS")
        print(f"Model dict: {model.dict()}")
        
    except Exception as e:
        print(f"✅ V2 model creation with V1 field names: EXPECTED FAILURE - {e}")

if __name__ == "__main__":
    test_v2_model()