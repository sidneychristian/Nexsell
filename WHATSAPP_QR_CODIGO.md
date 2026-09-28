# WhatsApp por QR ou código — NexSell

Esta versão acrescenta um adaptador para **Evolution API v2 / WHATSAPP-BAILEYS**, executada num servidor persistente separado. Não inclui nem instala esse servidor. A aplicação Next.js continua na Vercel e os dados do produto no Supabase. A opção Meta anterior permanece no código.

## Experiência do cliente
1. Conexões → Gerir WhatsApp.
2. Escolher QR ou código. Para código, indicar o número com indicativo (258…).
3. Autorizar a associação e gerar a ligação.
4. Abrir WhatsApp → Dispositivos associados → Associar dispositivo. Ler o QR; para código, escolher a opção de associação com número, se disponível na aplicação.
5. O NexSell consulta o servidor, confirma o número e só então apresenta “Dispositivo ligado”. Configurar agente e activar o workflow de atendimento continuam a ser passos separados.

O QR/código é devolvido pelo gateway real; nunca é inventado. A validade é determinada pelo WhatsApp/gateway. A página permite gerar outro após expiração, sem anunciar um prazo artificial. Não é o código SMS de recuperação da conta. Nunca pedir ao cliente a palavra-passe ou o PIN pessoal.

## Custos e limites desta decisão
A ligação funciona como dispositivo associado, não como WhatsApp Business Platform. Neste modo não há configuração de cartão na Meta pelo cliente para esta integração. O NexSell suporta alojamento do gateway, base/cache, manutenção e consumo OpenAI; pode incorporá-los nos seus planos. Não anunciar “mensagens ilimitadas” ou “custo zero”. Os preços e franquias NexSell existentes foram preservados.

Baileys não é autorizado nem mantido pelo WhatsApp. A associação pode deixar de funcionar após mudanças do protocolo e os números podem sofrer restrições. Nenhum atraso entre mensagens garante ausência de bloqueio. O cliente é informado antes de associar. Para disponibilidade contratual e campanhas oficiais, considerar um parceiro oficial com facturação centralizada; QR numa integração oficial não elimina taxas Meta.

## Actualizar a instalação existente
1. Guardar backup do banco e actualizar o mesmo repositório GitHub com este ZIP, sem carregar .env.local.
2. Aplicar as migrações ainda pendentes pela ordem do nome. A nova é `supabase/migrations/20260915_whatsapp_device.sql`, depois da 14. Não apagar tabelas nem substituir dados existentes pelo schema completo.
3. Instalar/manter Evolution API v2 num servidor persistente com HTTPS, persistência de sessões, base/cache exigidos pela versão escolhida, backups protegidos e acesso administrativo restrito. Fixar uma versão testada; não actualizar automaticamente para `latest` ou versões candidatas.
4. Na Vercel, configurar as variáveis abaixo para Production e publicar novamente.
5. Configurar o workflow n8n e testar um número autorizado antes de disponibilizar aos clientes.

| Variável | Valor a colocar |
|---|---|
| `EVOLUTION_API_URL` | URL HTTPS do seu servidor Evolution, sem endpoint no fim |
| `EVOLUTION_API_KEY` | Chave administrativa desse servidor, apenas no servidor NexSell |
| `EVOLUTION_WEBHOOK_SECRET` | Segredo aleatório novo, com pelo menos 32 caracteres |
| `NEXT_PUBLIC_SITE_URL` | `https://nexsellmz.vercel.app` |
| `N8N_WEBHOOK_URL` | Webhook de produção do workflow que recebe eventos NexSell |
| `N8N_OUTBOUND_SECRET` | Segredo que o n8n valida no cabeçalho x-nexsell-secret |
| `N8N_INBOUND_SECRET` | Segredo usado pelo n8n para chamar as rotas internas NexSell |

As configurações Supabase/OpenAI já usadas permanecem. As variáveis Meta não são exigidas para usar o dispositivo. Não colocar as três variáveis EVOLUTION no frontend, GitHub ou num campo visível ao cliente.

## Contrato esperado do gateway
O adaptador usa os endpoints Evolution API v2:
- POST `/instance/create`, integration `WHATSAPP-BAILEYS`;
- POST `/webhook/set/{instance}`, campo `webhook`, incluindo `headers` personalizados;
- GET `/instance/connect/{instance}`, com `number` para código; resposta `base64` PNG ou `pairingCode`;
- GET `/instance/connectionState/{instance}`, resposta `instance.state`;
- GET `/instance/fetchInstances?instanceName=...`, array com `name` e `ownerJid` para confirmar o telefone;
- POST `/message/sendText/{instance}`, `{number,text}`, resposta `key.id`;
- DELETE `/instance/logout/{instance}` e `/instance/delete/{instance}`.

Há diferenças entre versões do gateway. A versão alojada tem de cumprir este contrato, especialmente os cabeçalhos do webhook e o ownerJid. Se não cumprir, a ligação falha de forma visível; não se deve remover validações para forçar sucesso. Não foi instalado um gateway externo nem certificado um release específico nesta entrega.

## n8n e atendimento
O NexSell configura o callback `https://nexsellmz.vercel.app/api/webhooks/whatsapp-device`, com segredo diferente para cada instância. Não alterar o cabeçalho nem expor a API global. O gateway guarda as credenciais do dispositivo; o Supabase guarda apenas o identificador privado, estado e telefone confirmado.

O receptor encaminha texto individual recebido para o n8n:
```json
{"event":"whatsapp.event","provider":"device","organizationId":"empresa","field":"messages","value":{"messages":[{"id":"id-real","from":"258…","type":"text","text":{"body":"Olá"},"timestamp":"..."}]}}
```

O workflow deve validar x-nexsell-secret, deduplicar por organizationId + messages[].id, resolver/criar contacto apenas nessa empresa, respeitar consentimento e atendimento humano, seleccionar o agente autorizado e executar a rota de IA existente. Para responder, usar `/api/webhooks/whatsapp-send` com organizationId, leadId e body, autenticado com N8N_INBOUND_SECRET. Esta rota escolhe o transporte, sem expor credenciais ao n8n.

Mensagens próprias e grupos não iniciam resposta. IDs LID sem telefone alternativo são ignorados, para nunca inventar um número. Áudio, anexos e importação de histórico não são processados por este novo adaptador. Activar retries limitados no gateway/n8n para erros 503 de recepção e monitorizar falhas. Não reenviar automaticamente uma saída de resultado incerto; primeiro confirmar o ID/execução para evitar duplicados. “Aceite” no envio não significa “entregue” ou “lido”.

## Segurança e funcionamento
- Uma instância por empresa; número confirmado único entre as ligações por dispositivo.
- Só proprietário de uma empresa com Growth/Scale activo pode gerir a ligação; servidor verifica plano também antes de enviar.
- QR/código nunca guardados no banco ou em logs NexSell; respostas sem cache.
- Nova tentativa limitada a uma por 30 segundos por empresa.
- Sessão desligada não faz fallback silencioso para um token Meta anterior.
- Ao desligar, NexSell bloqueia envios antes de revogar a sessão externa. Falha externa mantém estado bloqueado e permite repetir.
- Registo da selecção permanece depois de desligar, para evitar activar um token Meta retido. A migração de volta à Meta é assistida: confirmar revogação no telemóvel/gateway antes de remover o registo de dispositivo no banco e iniciar a ligação oficial. Não apagar dados do CRM.
- O cliente pode sempre revogar o dispositivo no próprio WhatsApp, incluindo quando a subscrição estiver suspensa.

## Verificação realizada
Testes locais com respostas simuladas: validação de QR, código, segredo por instância, origem, mensagens próprias/grupos/LID, falhas HTTP, permissões PostgreSQL, isolamento da sessão e controlo de plano. Compilação Next.js e testes anteriores executados. Não foram testados um emparelhamento, envio, entrega ou reconexão reais; dependem do servidor Evolution, telefone e workflow n8n. A interface não foi validada num telemóvel real nesta entrega.

## Próximos acréscimos úteis
Monitorização e alerta de desconexão; fila persistente com deduplicação e intervenção em envios incertos; processamento de áudio/anexos; teste guiado com um contacto autorizado; acompanhamento dos custos por empresa. Implementar após validar o ciclo real de ligação, recepção e resposta. Não prometer disponibilidade 24/7 sem essa operação.

Fontes: https://github.com/WhiskeySockets/Baileys ; https://github.com/evolution-foundation/evolution-api ; https://github.com/evolution-foundation/docs-evolution ; https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
