# Guia de Reversão (Rollback) - Painel Web

Caso você decida que não quer mais o Painel Web ou o histórico de conversas sendo salvo no banco, siga os passos abaixo para reverter o seu projeto para o estado exato anterior a esta atualização:

## 1. Banco de Dados (Supabase)
Vá ao painel do Supabase, no SQL Editor, e rode o seguinte comando para apagar a tabela de histórico:
```sql
DROP TABLE IF EXISTS chat_messages;
```

## 2. Reverter os Arquivos Modificados
Apague ou desfaça as alterações nos seguintes arquivos (ou apenas execute `git reset --hard HEAD` se não tiver feito nenhum outro commit):

### `src/services/db.js`
Remova as funções:
- `salvarMensagemChat(numero, role, mensagem)`
- `obterHistoricoChat(numero)`

### `src/services/whatsapp.js`
Na função que envia mensagem (`enviarMensagem` ou similar), procure a linha que salva a mensagem enviada (ex: `await db.salvarMensagemChat(destino, 'assistant', texto)`) e **apague-a**.

### `src/handlers/conversa.js`
No início da função principal que processa a chegada da mensagem (ex: `processarMensagem`), procure e **apague** a linha que salva a mensagem do usuário (ex: `await db.salvarMensagemChat(numero, 'user', texto)`).

## 3. Deletar a Pasta do Painel
Apenas exclua a pasta `painelweb` que foi criada na raiz do seu projeto.
```bash
rm -rf painelweb
```

Com isso, seu projeto voltará a ser exclusivamente o Bot de WhatsApp sem armazenamento extra.
