> **Actualização:** a opção principal por dispositivo associado (QR/código) está explicada em [WHATSAPP_QR_CODIGO.md](./WHATSAPP_QR_CODIGO.md). O guia Meta permanece para a alternativa oficial.

# NexSell — GitHub / Vercel
CRM multiempresa, agentes configuráveis, catálogo, automações e subscrições manuais para empresas em Moçambique. Projecto Next.js existente actualizado, sem reconstruir a aplicação noutra plataforma.

## Começar
Leia **[GUIA_PUBLICACAO_E_CONEXOES.md](GUIA_PUBLICACAO_E_CONEXOES.md)** antes de publicar.
- Código: Next.js 16.2.6, React 19, TypeScript.
- Dados, autenticação e ficheiros privados: Supabase.
- IA: GPT-4.1 mini via Responses API, exclusivamente no servidor.
- Pagamentos: transferência e-Mola/BCI e aprovação administrativa. Sem gateway obrigatório.
- Entrega: código-fonte, lockfile, esquema completo, migrações incrementais, testes e documentação. Não contém credenciais nem dependências instaladas.

```bash
npm ci
cp .env.example .env.local
# Preencher as variáveis locais, sem publicar este ficheiro.
npm run dev
```

```bash
npm test
npm run build
```

O build limpa automaticamente a rota temporária de revisão visual. Os dados de teste ficam exclusivamente em `tests/`; não há população automática de contactos ou estatísticas no admin.

## Rotas
| Área | Endereço |
|---|---|
| Página pública / área de trabalho | / |
| Entrada, criação de conta, recuperação | /login |
| Pagamentos e renovação | /billing |
| Administração da plataforma | /admin |
| Retorno da autenticação | /auth/callback |

Produção configurada: https://nexsellmz.vercel.app

## Documentação
- [Ligação WhatsApp simples: Meta, código/QR e activação](WHATSAPP_LIGACAO_SIMPLES.md)
- [Publicação, variáveis, admin e integrações](GUIA_PUBLICACAO_E_CONEXOES.md)
- [Alterações, verificação e limites conhecidos](ENTREGA_E_VERIFICACAO.md)
- [Esquema para instalação nova](supabase/schema.sql)
- [Migrações para base existente](supabase/migrations)

As migrações e o código ainda precisam ser aplicados na sua conta. Esta entrega não publica nem altera a base de produção automaticamente.
