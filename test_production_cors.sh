#!/bin/bash

echo "==================================="
echo "Teste de Configuração de Produção"
echo "==================================="
echo ""

echo "1. Verificando variáveis de ambiente do Backend:"
echo "   CORS_ORIGINS:"
grep CORS_ORIGINS /app/backend/.env
echo ""

echo "2. Verificando variáveis de ambiente do Frontend:"
echo "   REACT_APP_BACKEND_URL:"
grep REACT_APP_BACKEND_URL /app/frontend/.env
echo ""

echo "3. Verificando logs do backend (CORS):"
tail -n 50 /var/log/supervisor/backend.err.log | grep -E "CORS" | tail -5
echo ""

echo "4. Testando endpoint /api/ (sem autenticação):"
curl -s -w "\n   Status: %{http_code}\n" \
  -H "Origin: https://rural-infra-hub.emergent.host" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:8001/api/ | head -10
echo ""

echo "5. Verificando configuração de cookies no código:"
grep -A 5 "set_cookie" /app/backend/auth_routes.py | grep -E "secure|samesite"
echo ""

echo "==================================="
echo "Configurações aplicadas com sucesso!"
echo "==================================="
echo ""
echo "⚠️  IMPORTANTE para Deploy 24h:"
echo "   1. Certifique-se de fazer commit das mudanças"
echo "   2. Deploy via interface Emergent"
echo "   3. Aguardar build completar"
echo "   4. Testar em https://rural-infra-hub.emergent.host"
echo ""
echo "✅ Após deploy, verifique:"
echo "   • Login funciona"
echo "   • Cookies são criados (DevTools > Application)"
echo "   • GET /api/liderancas retorna 200"
echo "   • Página Pedidos Lideranças carrega sem erros"
