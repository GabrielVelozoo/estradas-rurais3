# 📋 Google Apps Script - Rastreamento de "Última edição"

## 🎯 Objetivo

Criar uma coluna "Última edição" na planilha do Google Sheets que se atualiza automaticamente sempre que uma linha é editada manualmente.

---

## 📝 Passo 1: Adicionar Coluna na Planilha

1. Abra sua planilha do Google Sheets
2. Adicione uma nova coluna **H** com o título **"Última edição"**
3. Formate a coluna como **"Data e hora"**:
   - Selecione a coluna H
   - Menu: Formatar → Número → Data e hora

**Estrutura esperada:**
```
A        B          C          D        E           F       G            H
Município Protocolo Secretaria Estado Descrição   Valor Prioridade  Última edição
```

---

## 📝 Passo 2: Configurar Fuso Horário

1. Menu: **Arquivo → Configurações**
2. Em "Fuso horário", selecione: **GMT-03:00 America/Sao_Paulo**
3. Clique em **Salvar configurações**

---

## 📝 Passo 3: Criar Apps Script

1. Na planilha, vá em: **Extensões → Apps Script**
2. **Delete** o código padrão que aparece
3. **Cole** o código abaixo:

```javascript
/**
 * Trigger automático que registra a data/hora de edição na coluna H
 * Executa automaticamente sempre que uma célula é editada manualmente
 */
function onEdit(e) {
  try {
    // Obter a planilha ativa
    const sheet = e.source.getActiveSheet();
    const row = e.range.getRow();
    
    // Ignorar edições no cabeçalho (linha 1)
    if (row === 1) return;
    
    // IMPORTANTE: Ajuste o nome da aba se necessário
    // Descomente a linha abaixo e altere 'NOME_DA_SUA_ABA' se tiver múltiplas abas
    // if (sheet.getName() !== 'NOME_DA_SUA_ABA') return;
    
    // Coluna H = índice 8
    const COLUNA_ULTIMA_EDICAO = 8;
    
    // Registrar data/hora atual na coluna H da linha editada
    sheet.getRange(row, COLUNA_ULTIMA_EDICAO).setValue(new Date());
    
  } catch (erro) {
    // Tratamento de erro silencioso para não quebrar outras operações
    console.error('Erro ao atualizar última edição:', erro);
  }
}
```

4. Clique em **Salvar** (ícone de disquete ou Ctrl+S)
5. Dê um nome para o projeto: **"Rastreamento Última Edição"**
6. **Feche** o editor do Apps Script

---

## ✅ Passo 4: Testar o Script

### Teste Manual:

1. Volte para sua planilha
2. **Edite qualquer célula** em uma linha (exemplo: mude um valor na coluna E)
3. Pressione **Enter**
4. **Observe**: A coluna H dessa linha deve mostrar a data/hora atual automaticamente!

### Exemplo de resultado:
```
Linha 2: 24/10/2025 14:37:00
```

Se funcionou, parabéns! O script está ativo! 🎉

---

## ⚠️ Observações Importantes

### 1. **Trigger Automático**
- O script `onEdit(e)` é um **trigger especial** do Google Sheets
- Ele executa **automaticamente** sempre que você edita uma célula
- **Não é necessário** configurar nada além de colar o código

### 2. **Edições Manuais vs. API**
- ⚠️ O `onEdit` **só funciona** para edições **manuais** na interface do Google Sheets
- Se no futuro você editar via API (usando Google Sheets API), precisará:
  - Incluir a coluna H no `update` da API
  - Setar o valor como `new Date().toISOString()`

### 3. **Performance**
- O script é leve e não afeta a performance da planilha
- Executa em menos de 1 segundo
- Não há limite de uso para triggers simples como este

### 4. **Múltiplas Abas**
Se sua planilha tem várias abas e você quer que o script funcione **apenas em uma específica**:

```javascript
// Descomente e ajuste esta linha no código:
if (sheet.getName() !== 'Estradas Rurais') return;
```

### 5. **Backup**
É sempre bom fazer backup antes de adicionar scripts:
- Menu: **Arquivo → Fazer uma cópia**

---

## 🧪 Teste Completo

### Teste 1: Edição Simples
1. Edite uma célula qualquer
2. Verifique se coluna H foi preenchida

### Teste 2: Edição Múltipla
1. Edite várias linhas diferentes
2. Cada linha deve ter sua própria data/hora

### Teste 3: Recarregar Página Web
1. Após editar algumas linhas
2. Vá para o app: `/estradas-rurais`
3. Aguarde até 30 segundos (auto-refresh)
4. **Observe**: "Última edição" deve aparecer em cada estrada

---

## 🔧 Troubleshooting

### Problema: Coluna H não atualiza

**Solução 1**: Verificar permissões
```
1. Extensões → Apps Script
2. Executar → Executar função → onEdit
3. Conceder permissões quando solicitado
```

**Solução 2**: Verificar índice da coluna
```javascript
// Se sua coluna "Última edição" estiver em outra posição
// Altere o número 8 no código para o índice correto:
const COLUNA_ULTIMA_EDICAO = 8; // H = 8, I = 9, J = 10, etc.
```

**Solução 3**: Logs de erro
```
1. Extensões → Apps Script
2. Visualizar → Execuções
3. Ver se há erros listados
```

---

## 📊 Formato Esperado

### No Google Sheets:
```
24/10/2025 14:37:00
```

### No App (renderizado):
```
Última edição: 24/10/2025 14:37
```

---

## 🎉 Resultado Final

Após implementar tudo:

✅ **Na Planilha**: Coluna H atualiza automaticamente
✅ **No App**: Cada estrada mostra "Última edição: dd/MM/yyyy HH:mm"
✅ **Auto-refresh**: Página atualiza a cada 30 segundos
✅ **Indicador**: "Atualizado: HH:mm:ss" no topo com ícone pulsante

---

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs do Apps Script
2. Confirme que a coluna H está formatada como "Data e hora"
3. Teste editar uma célula manualmente
4. Verifique o console do navegador (F12) no app

**Código funcionando = coluna H sempre atualizada! 🚀**
