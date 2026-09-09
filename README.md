# NexSell — versão GitHub + Vercel

Plataforma multiempresa para geração de leads, CRM, agentes de IA, automações
n8n e vendas pelo WhatsApp, preparada para o mercado moçambicano.

## Tecnologias

- Next.js 16 e TypeScript
- Vercel
- Supabase: PostgreSQL, autenticação e armazenamento
- Subscrições por transferência e-Mola/BCI, comprovativo privado e aprovação manual
- WhatsApp Business Cloud API
- n8n
- OpenAI Responses API para os agentes

## Começar

1. Leia [GUIA_PUBLICACAO_E_CONEXOES.md](./GUIA_PUBLICACAO_E_CONEXOES.md).
2. Crie o projeto no Supabase.
3. Execute [supabase/schema.sql](./supabase/schema.sql) no SQL Editor.
4. Copie `.env.example` para `.env.local` e preencha os valores.
5. Execute `npm install` e `npm run dev`.
6. Envie o projeto para o GitHub e importe-o na Vercel.

Nunca envie `SUPABASE_SERVICE_ROLE_KEY`, chaves da Pagar, tokens do WhatsApp ou
segredos do n8n para o GitHub.

## Endereços principais

- Site e CRM: `/`
- Entrada/criação de conta: `/login`
- Administração: `/admin`
- Entrada de leads do n8n: `/api/webhooks/leads`
- Entrada de mensagens para agentes: `/api/webhooks/agent-message`
- Retorno do processamento de conhecimento: `/api/webhooks/knowledge`
- Envio de comprovativos: `/api/billing/proof` (autenticado)
- Webhook da Pagar desactivado nesta versão

## Planos e permissões

O administrador escolhe ou altera o pacote de cada cliente em `/admin`. O
NexSell aplica os limites no painel e nas rotas do servidor. Quando uma função
não pertence ao plano atual, o cliente recebe uma indicação para subir o pacote
e pode contactar a equipa pelo WhatsApp definido em
`NEXT_PUBLIC_SALES_WHATSAPP`.

## Agentes por empresa

Cada empresa pode criar os próprios agentes no menu **Agentes**, ligar apenas
os seus recursos de conhecimento e itens do catálogo, testar antes de publicar
e encaminhar situações sensíveis para **Aprovações**. O Starter não inclui
agentes; o Growth permite 1 agente e 1.000 respostas/mês; o Scale permite 5
agentes e 10.000 respostas/mês. Os limites também são aplicados no servidor.

Para uma instalação Supabase já existente, execute apenas
`supabase/migrations/20260903_agents.sql`. Numa instalação nova, execute o
`supabase/schema.sql` completo.

## Actualização de 9 de setembro de 2026

Instalação nova: execute o schema completo. Base existente: aplique também `supabase/migrations/20260909_manual_payments.sql`.

O envio do comprovativo não activa o plano; a aprovação é exclusiva do admin. O registo manual de clientes mantém a escolha de pacote e os limites no servidor.
