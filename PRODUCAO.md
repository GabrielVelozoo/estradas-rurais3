# Configuração para Produção (24h Deploy)

## ✅ Configurações Implementadas

### 1. Backend CORS
**Arquivo:** `/app/backend/.env`

```env
CORS_ORIGINS="http://localhost:3000,https://rural-connect-12.preview.emergentagent.com,https://rural-infra-hub.emergent.host,https://rural-connect-12.preview.emergentagent.com"
```

O CORS agora aceita:
- ✅ localhost (desenvolvimento)
- ✅ Preview Emergent
- ✅ **Produção 24h: https://rural-infra-hub.emergent.host**
- ✅ Wildcards para preview

### 2. Cookies de Autenticação
**Arquivo:** `/app/backend/auth_routes.py` (linha 62-73)

Os cookies agora detectam automaticamente o ambiente:

**Produção (24h):**
- `secure=True` (HTTPS obrigatório)
- `samesite="none"` (permite cross-site)

**Preview/Dev:**
- `secure=False`
- `samesite="lax"`

### 3. Frontend Backend URL
**Arquivo:** `/app/frontend/.env`

```env
REACT_APP_BACKEND_URL=https://rural-infra-hub.emergent.host
```

Todas as requisições do frontend agora apontam para:
`https://rural-infra-hub.emergent.host/api/...`

### 4. Credentials nas Requisições
**Arquivo:** `/app/frontend/src/components/PedidosLiderancas.js`

Todas as requisições fetch já incluem:
```javascript
credentials: 'include'
```

Isso garante que os cookies de autenticação sejam enviados em todas as chamadas.

## 🔧 Como Fazer Deploy

### Opção 1: Deploy Manual
1. Fazer push do código para o repositório
2. Deploy via interface Emergent (botão "Deploy 24h")
3. Aguardar build completar

### Opção 2: Verificar Variáveis de Ambiente
Certifique-se que no ambiente de produção (24h):

**Backend:**
```bash
CORS_ORIGINS="https://rural-infra-hub.emergent.host,https://rural-connect-12.preview.emergentagent.com"
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
JWT_SECRET_KEY="seu-jwt-secret-key-super-secreto-mude-em-producao-2024"
```

**Frontend:**
```bash
REACT_APP_BACKEND_URL="https://rural-infra-hub.emergent.host"
```

## ✅ Checklist de Verificação

Após o deploy, verificar:

- [ ] Login funciona em https://rural-infra-hub.emergent.host
- [ ] Cookies são criados corretamente (ver DevTools > Application > Cookies)
- [ ] GET `/api/liderancas` retorna 200 (não 401 ou 500)
- [ ] Página "Pedidos Lideranças" carrega sem erros
- [ ] Dados são exibidos corretamente
- [ ] Botões de criar/editar/deletar funcionam

## 🐛 Troubleshooting

### Erro 500 em produção mas funciona no preview?
**Causa:** Provavelmente CORS ou cookies

**Solução:**
1. Verificar no DevTools (Network) se a requisição está indo para `https://rural-infra-hub.emergent.host/api/liderancas`
2. Verificar na resposta se há erros de CORS (Access-Control-Allow-Origin)
3. Verificar se o cookie `access_token` está sendo criado após login

### Erro 401 (não autorizado)?
**Causa:** Cookies não estão sendo enviados ou criados

**Solução:**
1. Verificar que `REACT_APP_BACKEND_URL` está correto no build
2. Verificar que o cookie tem `SameSite=None` e `Secure=True` em produção
3. Fazer logout e login novamente

### Frontend chama URL errada?
**Causa:** Build não pegou a variável de ambiente correta

**Solução:**
1. Verificar que `.env` tem `REACT_APP_BACKEND_URL=https://rural-infra-hub.emergent.host`
2. Rebuild do frontend: `npm run build`
3. Redeploy

## 📝 Logs Importantes

Para debug, verificar os logs:

**Backend:**
```bash
tail -f /var/log/supervisor/backend.err.log
```

Procurar por:
- `CORS configurado com origens: [...]`
- `CORS allow_credentials: True`
- Erros 401, 403, 500

**Frontend:**
Console do browser (F12 > Console):
- `[fetchPedidos] Iniciando requisição para: ...`
- `[fetchPedidos] Status da resposta: ...`
- Erros de CORS: `Access-Control-Allow-Origin`

## 🎯 Resultado Esperado

Após todas as configurações:
1. ✅ Login em produção cria cookie com `Secure` e `SameSite=None`
2. ✅ Requisições para `/api/liderancas` retornam 200 OK
3. ✅ Página "Pedidos Lideranças" carrega sem erros
4. ✅ Dados são exibidos corretamente
5. ✅ Todas as operações (criar, editar, deletar) funcionam
