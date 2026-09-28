> **Actualização:** a opção principal por dispositivo associado (QR/código) está explicada em [WHATSAPP_QR_CODIGO.md](./WHATSAPP_QR_CODIGO.md). O guia Meta permanece para a alternativa oficial.

# Publicar e configurar o NexSell
Endereço de produção: **https://nexsellmz.vercel.app**

## 1. Preparar a base de dados
Use o seu projecto Supabase existente. A URL do projecto é:
`https://wcexxjbbnqjuorcoccdl.supabase.co`, sem `/rest/v1/`.

**Se nunca instalou tabelas:** abra SQL Editor, cole e execute **supabase/schema.sql**. Este ficheiro já inclui todas as migrações desta entrega. Não precisa executar as migrações separadamente.

**Se já instalou o NexSell:** faça uma cópia de segurança e aplique apenas as migrações ainda não executadas, nesta ordem:
1. `20260903_agents.sql`
2. `20260909_manual_payments.sql`
3. `20260910_landing_promotion.sql`
4. `20260911_product_integrity.sql`
5. `20260912_connections.sql`
6. `20260913_renewals.sql`
7. `20260914_whatsapp_signup.sql`

Se a versão anterior já incluía a campanha, aplique as migrações posteriores que ainda faltam. Não use o schema completo para actualizar uma base existente: definições antigas no início do ficheiro podem interferir durante a execução. As novas migrações não apagam contactos, clientes ou agentes. Os ficheiros têm transacções; se surgir um erro, não prossiga ignorando-o.

Confirme as tabelas `organizations`, `memberships`, `subscriptions`, `customer_accounts`, `billing_payments`, `ai_agents`, `knowledge_resources`, `catalog_items`, `agent_runs`, `admin_audit` e `connection_secrets`. Os buckets `payment-proofs` e `nexsell-uploads` devem estar privados.

## 2. GitHub e Vercel
1. Descompacte o ZIP. A pasta que contém `package.json` é a raiz do projecto.
2. Se já tem um repositório, actualize os ficheiros nesse repositório; preserve o histórico. Caso contrário, crie um repositório privado e envie o conteúdo.
3. Não envie `.env.local`, chaves, `node_modules` ou `.next`. A configuração de exclusões já está incluída.
4. Na Vercel, importe o repositório como projecto Next.js. Se já existe o projecto, conserve a ligação actual ao GitHub.
5. Em **Settings → Environment Variables**, adicione as variáveis abaixo. Escreva cada nome em **Key** e o valor em **Value**, sem aspas.
6. Seleccione **Production** e publique. Alterar variáveis exige um novo deployment. Use uma base separada para Preview: abrir uma preview com a base real pode iniciar a campanha real.

Para desenvolvimento local: `npm ci`, copie `.env.example` para `.env.local`, preencha e execute `npm run dev`. Para verificar: `npm test` e `npm run build`.

## 3. Variáveis essenciais
| Key | Value |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | https://wcexxjbbnqjuorcoccdl.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | A chave publicável do mesmo projecto Supabase |
| SUPABASE_SERVICE_ROLE_KEY | Uma nova chave secreta Supabase, apenas no servidor |
| NEXT_PUBLIC_SITE_URL | https://nexsellmz.vercel.app |
| NEXSELL_ADMIN_EMAILS | sidneychrisitan03@gmail.com |
| NEXT_PUBLIC_SALES_WHATSAPP | 258833837871 |
| OPENAI_API_KEY | Chave do projecto OpenAI API, para testar e executar agentes |

Os nomes ANON_KEY e SERVICE_ROLE_KEY são os nomes esperados pelo código, mesmo usando chaves modernas publicável/secreta. Obtenha-as em Settings → API Keys no Supabase. **Revogue as chaves secretas anteriormente partilhadas no chat e use novas.** Não copie segredos para nomes que começam por NEXT_PUBLIC_.

`OPENAI_AGENT_MODEL=gpt-4.1-mini` permanece no exemplo por compatibilidade. O executor fixa explicitamente GPT-4.1 mini; alterar essa variável não muda o modelo. Não há mudança automática para Astra. A API tem consumo pago e precisa de facturação activa na sua conta. As franquias NexSell contam testes e respostas concluídas, por empresa, no mês civil de Maputo; falhas não contam. Não equivalem a um orçamento monetário da OpenAI.

## 4. Entrar, criar conta e recuperar acesso
No Supabase:
- Mantenha o fornecedor Email e a confirmação de e-mail activos.
- Em Authentication → URL Configuration, Site URL: `https://nexsellmz.vercel.app`.
- Autorize o redirect `https://nexsellmz.vercel.app/auth/callback**` para incluir o parâmetro de recuperação. Para desenvolvimento, autorize separadamente `http://localhost:3000/auth/callback**`.
- Configure **SMTP próprio** em Authentication. Preencha o servidor, porta, utilizador, palavra-passe e remetente fornecidos pelo seu serviço de e-mail; estes dados ficam no Supabase, não em variáveis do frontend.
- Confirme o domínio/remetente junto do serviço de e-mail. Use os templates Supabase compatíveis com os links de confirmação e recuperação; não substitua esses links por texto fixo.

O erro **“Email rate limit exceeded”** vem do envio de e-mail no Supabase. O SMTP de teste tem restrições e não é adequado à produção. Configure SMTP próprio e os limites de envio; enquanto o limite estiver activo, repetir tentativas não o remove. O botão **Entrar** usa e-mail e palavra-passe e não envia um novo e-mail a cada entrada. Criação de conta e recuperação dependem do SMTP.

A interface apresenta explicações em português e espera antes de repetir um pedido. A confirmação abre o callback, troca o código pela sessão e encaminha o utilizador. Na recuperação, abre o formulário para definir a nova palavra-passe. Teste o percurso completo no mesmo navegador em que iniciou o pedido.

## 5. Como entrar no admin
1. Na Vercel, confirme `NEXSELL_ADMIN_EMAILS=sidneychrisitan03@gmail.com` e faça Redeploy se alterou a variável.
2. Abra https://nexsellmz.vercel.app/login e escolha **Criar conta**, se ainda não existe.
3. Use exactamente **sidneychrisitan03@gmail.com**. A grafia está preservada conforme fornecida.
4. Confirme o e-mail recebido e entre com a palavra-passe que criou.
5. Abra **https://nexsellmz.vercel.app/admin** ou escolha Administração no menu.

Não há uma palavra-passe de admin no ZIP. O privilégio depende do e-mail confirmado na sessão e da lista definida no servidor; escrever um e-mail num formulário não concede privilégios.

No primeiro acesso, o admin recebe uma área de trabalho vazia, com capacidade Scale sem data de expiração. Esse espaço operacional não é um pagamento nem uma subscrição vendida. A inicialização é atómica, repetível e registada na auditoria.

No admin pode analisar comprovativos, criar clientes que pagaram fora do site, escolher ou alterar planos e suspender/reactivar. Para criar manualmente, indique a referência e a data de uma transferência efectivamente conferida. O cliente depois cria a própria conta com o mesmo e-mail; não é enviado convite automaticamente.

## 6. Pagamentos e renovação
Dados preservados em `app/payment-details.ts`:
| Método | Beneficiário | Dados |
|---|---|---|
| e-Mola | Helena Ricardo | 879773196 |
| BCI | Sidney Ricardo | NIB 000800005189834710128 |
| BCI | Sidney Ricardo | Conta 35189834710001 |

Fluxo: escolher plano → consultar dados → transferir → indicar referência → enviar comprovativo → aguardar análise → aprovação administrativa.

- O comprovativo aceita PDF, JPG ou PNG até 3 MB. É guardado num bucket privado.
- Enviar um ficheiro **não activa** o acesso.
- O administrador abre o comprovativo através de um link privado de curta duração, confere a entrada na conta e indica a data/hora efectiva **de Maputo**.
- Recusar exige motivo. O cliente pode enviar outro comprovativo no mesmo pedido.
- A aprovação regista administrador, momento da revisão, momento da transferência e resultado da oferta.
- A mesma referência e método não podem aprovar dois pagamentos.
- A aprovação inicial concede 30 dias. Uma renovação acrescenta 30 dias à validade existente, ou à data actual se já terminou, preservando o comportamento anterior.
- Em /billing, **Renovar ou mudar de pacote** cria o próximo pedido. O plano e a validade actuais só mudam na aprovação. Um pedido pendente existente é reutilizado para evitar cobranças duplicadas.
- Suspender bloqueia o acesso. Reactivar não prolonga a validade.

Os recebimentos registados dentro do CRM são pagamentos dos clientes da empresa. São distintos da subscrição NexSell e não activam pacotes.

## 7. Planos
| Capacidade | Starter | Growth | Scale |
|---|---:|---:|---:|
| Preço mensal MT | 2.490 | 4.990 | 8.990 |
| Agentes IA | 1 | 2 | 5 |
| Respostas/mês, incluindo testes | 500 | 1.000 | 10.000 |
| Recursos de conhecimento | 10 | 50 | 250 |
| Itens de catálogo | 20 | 100 | 1.000 |
| Contactos | 1.000 | 5.000 | 20.000 |
| Utilizadores | 2 | 5 | 15 |
| Automações activas | 3 | 25 | 100 |

Starter cria, configura e testa o agente com conhecimento e catálogo. WhatsApp, ligações n8n, propostas, pagamentos e relatórios começam no Growth. Campanhas e gestão avançada de equipa pertencem ao Scale.

Os limites são verificados no servidor e em funções/triggers PostgreSQL, incluindo reservas da franquia antes da chamada à IA. Reduzir o pacote não apaga agentes: ficam utilizáveis os mais antigos até ao novo limite, ordenados por criação e ID; os excedentes ficam bloqueados. Os recursos usados pelo agente também respeitam os limites actuais. A interface mostra o motivo e uma chamada para subir o pacote.

## 8. Campanha de 24 horas
**Regra de início preservada:** a primeira chamada a `GET /api/billing/promotion`, feita ao abrir a página pública, cria a linha global `launch-landing-v1` em `landing_campaign`. Se essa chamada ainda não aconteceu, um checkout elegível também a pode criar. Executar a migração, por si só, não inicia a contagem.

`starts_at` e `ends_at` ficam persistentes. O prazo é partilhado por todos e não reinicia com reload, dispositivo ou deployment. Se a linha já existia, o prazo original mantém-se. Não a apague para reiniciar artificialmente a oferta.

A transferência da primeira subscrição elegível Starter/Growth deve ocorrer em ou depois do início e **antes** do fim. A data verificada pelo admin determina o bónus; uma aprovação posterior não prejudica quem pagou a tempo. O resultado fica em `billing_payments.landing_page_bonus`, com unicidade por cliente. A equipa combina a criação da landing page após aprovação. Não há prazo de entrega nem valor de referência inventado.

A contagem usa a hora do servidor e é novamente sincronizada ao voltar à página. Se a campanha estiver indisponível, não se inventa um prazo. Ao chegar a zero, aparece “Campanha encerrada”.

## 9. Ligar WhatsApp e agentes
A ligação normal agora usa **Conexões → Ligar WhatsApp → Continuar com a Meta**, sem pedir tokens ao cliente. Leia **[WHATSAPP_LIGACAO_SIMPLES.md](WHATSAPP_LIGACAO_SIMPLES.md)** para activar a aplicação Meta, as variáveis, o webhook e a opção WhatsApp Business app.

Para IA, configure OPENAI_API_KEY, crie conhecimento e catálogo, configure o agente e teste antes de publicar. O fluxo automático depende do n8n descrito abaixo e no guia da ligação simples. A autorização do número, por si só, não activa um agente.

## 10. n8n: o que conectar
Configure no servidor:
| Variável | Utilização |
|---|---|
| N8N_WEBHOOK_URL | URL de produção do workflow que recebe eventos NexSell |
| N8N_OUTBOUND_SECRET | Segredo usado pelo NexSell ao chamar esse workflow |
| N8N_INBOUND_SECRET | Segredo usado pelo workflow ao chamar APIs NexSell |
| NEXSELL_ORGANIZATION_ID | Empresa da ligação global de fallback; explícita nos fluxos multiempresa |

O n8n é infraestrutura da plataforma. Não partilhe o segredo de entrada com clientes: permite enviar eventos para empresas diferentes. O workflow deve mapear a empresa pelo número/formulário autenticado, nunca confiar numa empresa escolhida pelo remetente da mensagem.

Todos os callbacks abaixo recebem `x-nexsell-secret: VALOR_DE_N8N_INBOUND_SECRET`. As credenciais vão no gestor de credenciais do n8n.

**Leads:** `POST /api/webhooks/leads`
```json
{"organizationId":"org_EMPRESA","name":"Nome do contacto","phone":"258840000000","source":"Formulário","interest":"Serviço","consent":true}
```
Guarde o leadId devolvido. Valide consentimento e elimine eventos repetidos no workflow.

**Resposta do agente:** `POST /api/webhooks/agent-message`
```json
{"organizationId":"org_EMPRESA","agentId":"agent_ID","leadId":"lead_ID","conversationId":"whatsapp_258840000000","message":"Qual é o preço?","channel":"whatsapp"}
```
conversationId é obrigatório e deve ser estável. O workflow consulta `handedOff`: quando verdadeiro, notifica a equipa e interrompe a automação comercial; quando há atendimento humano pendente/em curso, reply é null. Em **Atendimento humano**, assumir mantém o bloqueio; encerrar permite retomar o agente. Quando handedOff=false, o workflow envia reply pelo WhatsApp.

**Histórico da conversa:** `POST /api/webhooks/activity`
```json
{"eventId":"wamid_EVENTO","organizationId":"org_EMPRESA","leadId":"lead_ID","body":"Texto real","direction":"inbound","status":"recebido"}
```
Use o mesmo eventId para actualizar o estado dessa mensagem. Registe também mensagens efectivamente enviadas. O callback é repetível por empresa/evento; a chamada do agente deve ser deduplicada no n8n antes de executar.

**Conhecimento:** o NexSell envia `knowledge.processing_requested` com organizationId, resourceId, resourceType e sourceUrl ou storageKey. O workflow extrai texto do documento/página e chama `POST /api/webhooks/knowledge`:
```json
{"organizationId":"org_EMPRESA","resourceId":"resource_ID","status":"ready","contentText":"Informação verificada da empresa"}
```
Para falhas, use status=error e errorMessage. Ficheiros estão em nexsell-uploads; descarregue-os com credenciais de servidor no n8n. Restrinja o extractor a URLs públicas HTTPS e rejeite redes internas/redireccionamentos para serviços privados. Não execute instruções contidas nos documentos. Sem este workflow, use texto colado: documentos/páginas mostram erro de configuração, nunca sucesso fictício.

Os eventos manual_test e knowledge.processing_requested precisam de ramos próprios no workflow. Ligar a URL não cria os workflows automaticamente. A lista de automações guarda configuração comercial; associe cada automationId ao fluxo e respeite o estado activa/pausada. Google Ads não é necessário.

## 11. Verificação na sua conta
Antes de convidar clientes:
1. Criar/confirmar conta, entrar, sair e recuperar palavra-passe.
2. Criar duas empresas e confirmar que os contactos e recursos são distintos.
3. Enviar comprovativo de teste, recusar, reenviar e aprovar no admin.
4. Conferir plano, validade, auditoria e bónus com a hora efectiva.
5. Criar os agentes permitidos; testar uma criação excedente e uma redução do plano.
6. Testar mensagens com um número autorizado e uma conversa transferida.
7. Rever /, /login, /billing e as páginas internas no computador e no telemóvel.

A execução real de SMTP, Storage remoto, OpenAI, WhatsApp e n8n depende das suas credenciais. Veja ENTREGA_E_VERIFICACAO.md para a distinção entre testes executados e pendentes.

Referências oficiais:
- Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- URLs de retorno: https://supabase.com/docs/guides/auth/redirect-urls
- Variáveis Vercel: https://vercel.com/docs/environment-variables/managing-environment-variables
