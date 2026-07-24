# Scrapper Qnotas

Automação que faz login no sistema acadêmico ([academico.ifes.edu.br](https://academico.ifes.edu.br)) de múltiplos usuários, coleta notas/avaliações lançadas e envia notificações via Telegram sempre que houver alteração (nova disciplina, nova avaliação lançada, mudança de nota, etc).

## Como funciona

1. Um endpoint HTTP (`/run-scraper`) dispara a execução — chamado periodicamente por um agendador externo (cron-job.org ou GitHub Actions), já que o serviço roda no plano gratuito do Render, que não tem cron job/worker nativo grátis.
2. Para cada usuário cadastrado no banco, o scraper (Puppeteer + stealth) faz login no sistema acadêmico e coleta os dados atuais.
3. Os dados são comparados com o último snapshot salvo no Postgres.
4. Diferenças detectadas geram mensagens formatadas, enviadas ao usuário via bot do Telegram.
5. O novo snapshot é salvo, substituindo o anterior.

```
Agendador externo (cron-job.org / GitHub Actions)
        │  GET /run-scraper (a cada 30min, 6h-18h)
        ▼
  Web Service (Render, free) ── Puppeteer + Stealth ──► academico.ifes.edu.br
        │
        ▼
    PostgreSQL (snapshot por usuário)
        │
        ▼
    Bot do Telegram ──► usuário final
```

## Requisitos

- Node.js **22.x** ou superior (o Puppeteer 25+ exige Node ≥ 22; se estiver preso em uma versão anterior do Node, use `puppeteer-core@^24` no lugar)
- PostgreSQL (local via Docker para desenvolvimento, ou instância gerenciada em produção)
- Um bot do Telegram (criado via [@BotFather](https://t.me/BotFather))

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

| Variável | Descrição | Exemplo |
|---|---|---|
| `DB_HOST` | Host do PostgreSQL | `localhost` |
| `DB_USERNAME` | Usuário do banco | `automation` |
| `DB_PASSWORD` | Senha do banco | — |
| `DB_NAME` | Nome do banco | `automation_db` |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `TELEGRAM_BOT_TOKEN` | Token do bot, obtido via BotFather | `123456:ABC-...` |
| `PORT` | Porta HTTP do serviço (o Render define automaticamente em produção) | `3000` |

> Nunca commite o `.env` real — ele já deve estar no `.gitignore`.

## Rodando localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Subir um Postgres local (Docker)

```bash
docker run --name pg-automation \
  -e POSTGRES_USER=automation \
  -e POSTGRES_PASSWORD=uma_senha_forte \
  -e POSTGRES_DB=automation_db \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  -d postgres:16-alpine
```

### 3. Criar as tabelas

```sql
CREATE TABLE users_qnotas (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE NOT NULL,
  user_login VARCHAR(255) NOT NULL,
  user_senha VARCHAR(255) NOT NULL,
  user_chatid VARCHAR(50),
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE users_qnotas_save (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  user_periodo VARCHAR(20) NOT NULL,
  user_data TEXT NOT NULL,
  UNIQUE(user_id, user_periodo)
);
```

### 4. Rodar o servidor

```bash
npm start
```

### 5. Testar o disparo do scraper

```bash
curl http://localhost:3000/run-scraper
```

## Deploy no Render

### 1. Criar o Web Service

No dashboard do Render: **New → Web Service**, conecte o repositório e configure:

- **Runtime**: Docker (ou Node, se preferir build nativo sem Dockerfile)
- **Plan**: Free
- **Health Check Path**: `/`

### 2. Configurar as variáveis de ambiente

Nas configurações do serviço (**Environment**), adicione todas as variáveis listadas na tabela acima. `PORT` não precisa ser definida manualmente — o Render injeta automaticamente.

### 3. Configurar o Postgres

O Postgres gratuito da própria Render expira 30 dias após a criação. Para uso contínuo, recomenda-se um provedor com free tier permanente (ex: Neon, Supabase) e apontar `DB_HOST`/`DB_PORT`/etc. para lá.

### 4. Configurar o agendador externo

Como o Render free não tem cron job/worker gratuito, o disparo do `/run-scraper` precisa vir de fora. Duas opções:

**cron-job.org** — crie uma conta gratuita e configure um cronjob:
- URL: `https://seu-app.onrender.com/run-scraper`
- Frequência: a cada 30 minutos, das 6h às 18h (fuso `America/Sao_Paulo`)
- Timeout da requisição: 60-120s (o scraping com Puppeteer pode demorar)

**GitHub Actions** — alternativa versionada no próprio repositório:

```yaml
# .github/workflows/trigger-scraper.yml
name: Trigger Scraper
on:
  schedule:
    - cron: '*/30 9-21 * * *'  # 6h-18h BRT = 9h-21h UTC
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Hit scraper endpoint
        run: curl -f --max-time 120 https://seu-app.onrender.com/run-scraper
```

### Observações sobre o plano gratuito

- O serviço "dorme" após ~15 min sem tráfego — a primeira execução do dia pode ter 30-60s de cold start.
- Não há disco persistente — qualquer estado precisa ser salvo no Postgres, nunca em arquivo local do container.

## Estrutura do projeto

```
scrapper_qnotas/
├── index.js           # ponto de entrada, servidor HTTP e orquestração
├── login.js           # scraping (Puppeteer) e comparação de dados
├── telegram.js        # envio de mensagens e verificação do bot
├── formatMessage.js    # formatação de mensagens em MarkdownV2
└── .env
```
