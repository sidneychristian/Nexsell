> **Actualização:** a opção principal por dispositivo associado (QR/código) está explicada em [WHATSAPP_QR_CODIGO.md](./WHATSAPP_QR_CODIGO.md). O guia Meta permanece para a alternativa oficial.

# WhatsApp: ligação simples para os clientes

Esta actualização acrescenta **Conexões → Ligar WhatsApp → Continuar com a Meta**. O cliente autoriza a conta e o número no processo oficial Embedded Signup. O NexSell recebe a autorização e guarda as credenciais no servidor; o cliente não copia tokens nem identificadores.

## QR code ou código?
Quando o fluxo para utilizadores do WhatsApp Business app estiver habilitado e o número for elegível, a confirmação é apresentada pela Meta e pode incluir código ou QR. É a janela oficial da Meta que determina as opções. O NexSell não gera um QR de WhatsApp Web, nem promete que todos os números poderão usar coexistência. O WhatsApp pessoal não é equivalente ao WhatsApp Business app.

O cliente que escolhe o fluxo normal de plataforma segue a verificação do número apresentada pela Meta. Os modos não são trocados automaticamente: quando a Meta não confirma como o número está registado, o servidor interrompe a conclusão em vez de arriscar registar incorrectamente um número do aplicativo.

## O que o proprietário do NexSell configura uma vez
1. No Meta for Developers, prepare a aplicação que pertence ao NexSell e o produto WhatsApp. Para integrar contas de outras empresas, conclua o processo aplicável de Tech Provider, verificação e análise das permissões. Uma aplicação em desenvolvimento não equivale a autorização para clientes públicos.
2. Configure Facebook Login for Business e crie a configuração de Embedded Signup. São usados o **App ID**, o **App Secret** e o **Configuration ID** desta aplicação.
3. Autorize o domínio `nexsellmz.vercel.app` e a página `https://nexsellmz.vercel.app/` nos campos de domínio/JavaScript SDK/OAuth exigidos pela configuração Meta. O lançamento usa o JavaScript SDK no domínio do NexSell; não é o callback Supabase de login. Garanta páginas de privacidade e instruções de eliminação de dados verdadeiras e compatíveis com a sua operação.
4. Configure acesso às permissões `whatsapp_business_management` e `whatsapp_business_messaging`. Obtenha os níveis de acesso necessários para contas de clientes externos; valide os requisitos actuais no painel Meta.
5. No webhook WhatsApp da aplicação, configure:
   - Callback: `https://nexsellmz.vercel.app/api/webhooks/meta`
   - Verify token: o valor que definiu em `META_VERIFY_TOKEN`.
   - Subscrição ao campo `messages`. Para coexistência, configure também os eventos necessários ao seu workflow, como `smb_message_echoes`.
6. Prepare o workflow n8n descrito abaixo, publique o código e faça um teste com uma conta autorizada antes de abrir a ligação aos clientes.

Não é possível concluir a aprovação da aplicação Meta com um ZIP. A activação real exige a sua conta e as permissões concedidas pela Meta. O botão informa que a ligação está a ser preparada quando faltam variáveis essenciais.

## Variáveis Vercel
Mantenha as variáveis Supabase, OpenAI e de encriptação já configuradas. Acrescente/preencha em **Settings → Environment Variables → Production**:

| Nome | Valor |
|---|---|
| META_APP_ID | App ID da aplicação NexSell |
| META_APP_SECRET | Segredo dessa aplicação, exclusivamente no servidor |
| META_WHATSAPP_CONFIG_ID | ID da configuração Facebook Login for Business / Embedded Signup |
| META_GRAPH_VERSION | Versão Graph suportada escolhida na sua aplicação, no formato `vNN.0` |
| META_VERIFY_TOKEN | Um segredo aleatório para a verificação do webhook |
| META_WHATSAPP_COEXISTENCE | `true` apenas quando o fluxo Business app estiver habilitado e validado; caso contrário `false` |
| CONNECTIONS_ENCRYPTION_KEY | A mesma chave hexadecimal de 64 caracteres da versão anterior |
| N8N_WEBHOOK_URL | URL de produção do workflow receptor |
| N8N_OUTBOUND_SECRET | Segredo que o n8n exige quando recebe eventos NexSell |
| N8N_INBOUND_SECRET | Segredo usado pelo n8n ao chamar APIs NexSell |

Escolha a versão Graph explicitamente no painel Meta; não escreva literalmente `vNN.0`. O App ID e o Configuration ID não são segredos e chegam ao SDK. O App Secret, os tokens recebidos e a chave de encriptação ficam no servidor. Os clientes não precisam de adicionar estas variáveis.

## Actualizar uma instalação já publicada
Se já aplicou a entrega anterior até `20260913_renewals.sql`, execute apenas **supabase/migrations/20260914_whatsapp_signup.sql** no SQL Editor. Se ainda não aplicou as anteriores, execute as que faltam pela ordem do guia principal. Depois actualize o código no mesmo GitHub e faça o deployment no mesmo projecto Vercel. Para uma instalação vazia, o `schema.sql` consolidado inclui tudo.

O acesso ao WhatsApp continua reservado a Growth/Scale e ao proprietário da empresa. A configuração técnica por token foi preservada para assistência administrativa, mas deixou de ser o caminho normal apresentado ao cliente.

## O que é validado automaticamente
- Sessão NexSell autenticada, proprietário e plano com acesso a conexões.
- Sessão de ligação vinculada ao utilizador e à empresa, com 15 minutos e utilização única.
- Origem exacta dos eventos do SDK; cancelamento e término sem número não contam como sucesso.
- Token emitido para a aplicação correcta, permissões e conta empresarial autorizada.
- Número pertencente à conta autorizada, confirmado directamente pela API.
- Número reservado a uma única empresa no NexSell; não pode ser tomado por outra conta.
- Subscrição dos webhooks e registo Cloud API quando aplicável. Coexistência não chama `/register`.
- Credenciais cifradas e auditoria; só depois de a Meta confirmar os passos é guardada a ligação verificada.

O PIN de registo técnico de um número Cloud API é gerado no servidor e guardado cifrado, para reutilização em tentativas da mesma empresa. Não é pedido ao cliente num formulário NexSell. Se um número já tiver configuração de registo incompatível, a conclusão é interrompida e exige assistência na Meta. Não force a migração nem elimine a conta do aplicativo para contornar uma falha.

## n8n sem pedir tokens aos clientes
O NexSell verifica a assinatura `X-Hub-Signature-256` enviada pela Meta, identifica a empresa pelo número/WABA guardado e encaminha para `N8N_WEBHOOK_URL`:

```json
{
  "event": "whatsapp.event",
  "organizationId": "org_EMPRESA",
  "wabaId": "ID_CONTA_META",
  "phoneNumberId": "ID_NUMERO_META",
  "field": "messages",
  "value": {"messages": [], "metadata": {}}
}
```

No workflow:
1. Verifique `x-nexsell-secret` contra N8N_OUTBOUND_SECRET e separe este evento de `manual_test` e `knowledge.processing_requested`.
2. Para mensagens recebidas, deduplique pelo ID original da mensagem antes de criar contactos, chamar IA ou responder. A Meta pode reenviar eventos; em falhas parciais, alguns já podem ter sido entregues.
3. Resolva o contacto na empresa identificada pelo servidor e registe a actividade em `/api/webhooks/activity`. Não trate notificações de estado nem mensagens enviadas pelo próprio negócio como novos pedidos do cliente.
4. Escolha o agente activo dessa empresa conforme a regra comercial definida e chame `/api/webhooks/agent-message`, usando conversationId estável.
5. Se houver transferência humana, notifique a equipa e suspenda a automação dessa conversa. Quando `reply` for null, não envie uma mensagem vazia.
6. Para enviar a resposta sem obter tokens da base, chame **POST /api/webhooks/whatsapp-send**, com o segredo N8N_INBOUND_SECRET:

```json
{"organizationId":"org_EMPRESA","leadId":"lead_CONTACTO","body":"Texto da resposta"}
```

O servidor usa o token cifrado da empresa, verifica plano e consentimento, envia pela Cloud API e devolve o ID da mensagem aceite. Não é uma API de templates: textos continuam sujeitos às regras de atendimento da Meta. Se houver erro/timeout, reconcilie a execução antes de repetir para evitar envio duplicado. `historySaved:false` significa que o envio foi aceite, mas o histórico precisa de ser registado; não reenviar a mensagem por esse motivo.

O estado “WhatsApp ligado” confirma o processo de ligação, não a existência de um workflow n8n pronto nem uma resposta IA já enviada. O cliente ainda configura/testa o agente; a equipa prepara e valida o workflow. Importação de histórico/contactos do Business app não é iniciada automaticamente nesta versão.

## Validação desta entrega
Passaram os testes locais de assinatura, rejeição de origens externas, autorização, token/app/WABA/número divergentes, modo de registo desconhecido, ausência de `/register` na coexistência, unicidade do número e sessão com expiração/reutilização bloqueada. As respostas Meta nos testes são simuladas e estão identificadas em `tests/whatsapp.test.ts`; não provam uma ligação real.

Faltam a configuração/análise da aplicação Meta, testes reais do popup em computador/telemóvel e envio/recepção com o n8n de produção. Nenhum token real foi solicitado ou usado nesta alteração. As limitações anteriores de histórico/paginação continuam descritas em ENTREGA_E_VERIFICACAO.md.

Fontes oficiais consultadas:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
