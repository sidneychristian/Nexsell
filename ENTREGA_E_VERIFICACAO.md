> Novo: adaptador Evolution API v2 para QR/código, com sessão privada por empresa e transporte de texto. O servidor externo e o ciclo real WhatsApp/n8n ainda precisam de configuração e validação. Consulte WHATSAPP_QR_CODIGO.md.

# NexSell — alterações e verificação

## Ligação guiada acrescentada
A actualização WhatsApp inclui botão de autorização Meta, troca de código no servidor, confirmação de conta/número, reserva do número por empresa, recepção de webhooks assinados e envio n8n sem expor tokens. O modo Business app é configurável e depende da elegibilidade/activação Meta. Os testes adicionais usam respostas simuladas; não foi realizada uma ligação real.

## O que mudou
O projecto Next.js existente foi mantido. A apresentação pública, login, área de trabalho, administração e fluxos de agentes foram revistos com uma biblioteca visual comum: azul profundo, superfícies grafite, verde para acções principais, hierarquia tipográfica e navegação móvel. Foram retirados indicadores inventados e a criação automática de contactos de demonstração do administrador.

Foram acrescentados feedback de operações, estados vazios, erros, chamadas para upgrade, pesquisa de contactos/recursos, filtros e formulários com rótulos. Os modais usam a biblioteca de diálogo existente para foco e teclado. A autenticação ganhou callback, renovação de cookies e mensagens de recuperação/rate limit em português.

No servidor, as mudanças principais são:
- Starter 1 agente, Growth 2, Scale 5; preços e franquias preservados.
- Limites PostgreSQL e reserva mensal antes de executar IA; agentes excedentes preservados e bloqueados após redução do plano.
- Associação de recursos e agentes atómica, validação de empresa nos registos dependentes e erros de escrita tratados.
- Aprovação manual transaccional, auditoria, referência de transferência única e reenvio após recusa.
- Renovação sem alterar o acesso antes da aprovação; inicialização administrativa sem dados fictícios.
- Campanha global persistente e bónus baseado na transferência verificada, com uma atribuição por cliente.
- GPT-4.1 mini, respostas estruturadas, encaminhamento humano e bloqueio da automação durante atendimento humano.
- Tokens WhatsApp cifrados por empresa; estados de ligação distinguem credenciais configuradas de ligação verificada.
- Upload directo autorizado para Storage de documentos/imagens até 10 MB, sem transportar esse corpo pela Vercel. Comprovativos continuam no fluxo privado separado, até 3 MB.

## Testes executados
`npm test` executa PostgreSQL embutido (PGlite) e testes Node/TypeScript. Os cenários incluem:

1. Campanha de 24h persistente e contagem até à expiração.
2. Capacidades Starter/Growth e tentativa de criação excedente.
3. Redução de plano sem apagar agentes e impedimento de executar os excedentes.
4. Duas criações concorrentes, com apenas uma permitida.
5. Conhecimento e catálogo utilizáveis no Starter.
6. Rejeição de ligações entre empresas.
7. Guardar agente/recursos de forma atómica e invalidar teste após edição.
8. Reserva da franquia mensal, limite atingido e exclusão de falhas.
9. Bloqueio após expiração da subscrição.
10. Comprovativo sem activação, recusa com motivo e novo envio.
11. Aprovação tardia de transferência pontual e preservação do pacote do pedido.
12. Exclusão de transferência fora do prazo e de Scale da oferta.
13. Referência de transferência duplicada rejeitada.
14. Cliente manual, auditoria, suspensão/reactivação sem prolongar validade.
15. RLS e ausência de permissões públicas nos RPCs administrativos.
16. Renovação sem alteração antecipada nem repetição de bónus.
17. Inicialização administrativa repetível, sem contactos fictícios.
18. APIs privadas recusam pedidos sem sessão; admin depende da lista do servidor.
19. Preços e franquias comerciais preservados.

PGlite testa SQL real localmente, mas não substitui um teste de carga multiutilizador numa instância Supabase remota. A suite aplica o schema e reaplica as novas migrações, verificando compatibilidade dessa sequência. Os testes de autenticação exercitam recusa de acesso e permissões; não enviam e-mails nem simulam uma confirmação bem-sucedida como se fosse real.

`npm run build` compila Next.js e verifica TypeScript. O build remove a rota temporária de revisão visual; ela não integra o produto publicado.

## Revisão visual
A página pública foi observada no navegador em computador, incluindo hierarquia, cores e ausência de transbordo horizontal nessa largura. A pré-visualização ficou indisponível antes da revisão completa das páginas internas e do telemóvel. Essas verificações **não são apresentadas como concluídas**. O CSS responsivo e os componentes foram implementados, mas ainda devem ser confirmados no navegador após publicação de teste.

Para reproduzir a revisão local sem dados reais: `npm run qa:visual`, `npm run dev`, abrir `/review`. A faixa identifica os dados fictícios. `/review?mobile=1` permite inspeccionar uma largura de 390 px num iframe; o teste num telemóvel real continua recomendado. Use `npm run qa:clean` no fim. A fixture intercepta pedidos apenas nessa página e não altera a autenticação nem as APIs de produção.

## Dependências e limites ainda relevantes
- Não foram aplicadas migrações nem feitas alterações na sua conta Supabase, GitHub ou Vercel.
- Confirmação/recuperação de e-mail exigem SMTP próprio e validação na sua conta. Nenhuma mensagem foi enviada em seu nome.
- Upload/download real em Supabase Storage, chamadas OpenAI, envio/recepção WhatsApp e workflows n8n precisam de credenciais e testes externos.
- A ligação guiada Embedded Signup foi acrescentada nesta actualização; depende da aplicação Meta configurada e autorizada. O n8n precisa ser configurado para recepção, deduplicação, processamento de documentos e execução dos fluxos. Consulte WHATSAPP_LIGACAO_SIMPLES.md para os testes adicionais e a activação.
- Listas de trabalho herdadas ainda usam o limite de linhas configurado no Supabase; o histórico de conversas carrega os 100 eventos mais recentes da empresa e a lista administrativa os 200 pagamentos mais recentes. Antes de operar bases com mais registos do que essas janelas, é necessária paginação histórica. Os relatórios calculam os registos carregados; não são uma contabilidade completa.
- Dados antigos são preservados. Registos de demonstração que uma versão anterior já tenha inserido na base não são apagados nem classificados automaticamente como reais/fictícios sem confirmação da sua origem.
- Recursos em erro após falta de processamento precisam do callback n8n para ficarem prontos. Texto colado funciona sem extractor externo.
- A landing page oferecida é uma entrega a combinar com a equipa após aprovação; não é gerada/publicada automaticamente.

O código é entregue com estas limitações explícitas, sem afirmar que os testes externos ou a revisão visual completa passaram.
