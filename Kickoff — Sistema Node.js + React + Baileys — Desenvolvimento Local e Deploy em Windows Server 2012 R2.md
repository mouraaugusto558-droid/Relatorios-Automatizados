# Kickoff — Sistema Node.js + React + Baileys

## 1. Contexto e objetivo

Quero construir um sistema **monolítico, extremamente leve e otimizado para produção**, cujo ambiente final será uma VPS com recursos muito limitados.

### Ambiente de produção obrigatório

- **Windows Server 2012 R2 Datacenter**
- **2 vCPU**
- **2 GB RAM**
- **64 bits**
- A VPS **não pode ser substituída por Linux**.
- Não utilizar Docker.
- Não utilizar Docker Desktop.
- Não utilizar máquina virtual Linux.
- Não utilizar Kubernetes.
- Não utilizar PostgreSQL, Redis ou outros serviços externos sem necessidade.

A aplicação será executada diretamente no Windows Server.

---

# 2. IMPORTANTE — Desenvolvimento NÃO será feito na VPS

A VPS **NÃO será utilizada como ambiente de desenvolvimento**.

Todo o desenvolvimento deverá ser feito no meu computador local, que possui:

- Windows 11
- Mais recursos de CPU/RAM
- Ambiente completo de desenvolvimento
- Ferramentas de desenvolvimento disponíveis

O fluxo obrigatório será:

```text
┌───────────────────────────────┐
│        MEU COMPUTADOR         │
│          WINDOWS 11           │
│                               │
│  Desenvolvimento              │
│  Testes                       │
│  Debug                        │
│  Build                        │
│  Testes de produção local     │
└───────────────┬───────────────┘
                │
                │ BUILD / DEPLOY
                ▼
┌───────────────────────────────┐
│          VPS                  │
│    Windows Server 2012 R2     │
│                               │
│    2 vCPU / 2 GB RAM          │
│                               │
│    SOMENTE PRODUÇÃO           │
│                               │
│    Node.js                    │
│    Aplicação                  │
│    Baileys                    │
│    SQLite                     │
│    Scheduler                  │
└───────────────────────────────┘
```

### Regra fundamental

**Não instalar o ambiente completo de desenvolvimento na VPS.**

A VPS deve receber somente o que for necessário para executar a aplicação final.

Não quero:

- VS Code na VPS;
- Vite em modo development;
- TypeScript compiler rodando continuamente;
- ferramentas de desenvolvimento desnecessárias;
- dependências de desenvolvimento em produção;
- servidores de desenvolvimento;
- processos extras.

---

# 3. Estratégia de desenvolvimento

O projeto será desenvolvido integralmente no Windows 11.

Durante o desenvolvimento podemos utilizar:

- Node.js
- npm
- TypeScript
- React
- Vite
- ferramentas de teste
- ESLint
- Prettier
- Git
- ferramentas de debug
- demais ferramentas necessárias

A máquina local possui recursos suficientes para isso.

A prioridade é que o ambiente local seja confortável e rápido para desenvolvimento.

---

# 4. Estratégia de produção

Quando o sistema estiver completamente desenvolvido e testado:

```text
Código fonte
    ↓
Build
    ↓
Testes finais
    ↓
Pacote de produção
    ↓
Copiar para VPS
    ↓
Instalar apenas Node.js/runtime necessário
    ↓
Configurar produção
    ↓
Executar aplicação
```

A VPS não deve precisar compilar o projeto.

Sempre que possível:

> **compilar tudo localmente e enviar para a VPS somente os artefatos necessários para produção.**

---

# 5. Arquitetura final

A aplicação será um monólito modular.

```text
                    DESENVOLVIMENTO
                    WINDOWS 11
                         │
                         │
                    código-fonte
                         │
                         ▼
                    BUILD LOCAL
                         │
                         ▼
                  PACOTE DE PRODUÇÃO
                         │
                         │ deploy
                         ▼

        ┌─────────────────────────────────┐
        │       WINDOWS SERVER 2012 R2    │
        │                                 │
        │       2 vCPU │ 2 GB RAM         │
        │                                 │
        │  ┌───────────────────────────┐  │
        │  │        NODE.JS            │  │
        │  │                           │  │
        │  │  ┌─────────────────────┐  │  │
        │  │  │     API / Backend   │  │  │
        │  │  └──────────┬──────────┘  │  │
        │  │             │             │  │
        │  │  ┌──────────▼──────────┐  │  │
        │  │  │       BAILEYS       │  │  │
        │  │  │      WhatsApp       │  │  │
        │  │  └─────────────────────┘  │  │
        │  │                           │  │
        │  │  ┌─────────────────────┐  │  │
        │  │  │      SCHEDULER      │  │  │
        │  │  │     Cron / Jobs     │  │  │
        │  │  └──────────┬──────────┘  │  │
        │  │             │             │  │
        │  │  ┌──────────▼──────────┐  │  │
        │  │  │      RELATÓRIOS     │  │  │
        │  │  └─────────────────────┘  │  │
        │  │                           │  │
        │  │  ┌─────────────────────┐  │  │
        │  │  │       SQLITE        │  │  │
        │  │  └─────────────────────┘  │  │
        │  │                           │  │
        │  │  React build / dist      │  │
        │  └───────────────────────────┘  │
        │                                 │
        └─────────────────────────────────┘
```

---

# 6. Frontend

Utilizar:

- React
- TypeScript
- Vite

Durante desenvolvimento:

```text
React + Vite dev server
```

Em produção:

```text
npm run build
```

O resultado deverá ser:

```text
frontend/dist/
```

O Node deverá servir esse build.

Não executar Vite em produção.

Não executar `npm run dev` na VPS.

---

# 7. Backend

Utilizar:

- Node.js
- TypeScript
- Fastify ou Express

Escolher a opção mais leve e adequada ao projeto.

O backend será responsável por:

- API;
- WhatsApp;
- Baileys;
- scheduler;
- jobs;
- relatórios;
- banco de dados;
- configurações;
- servir o frontend compilado.

Estrutura sugerida:

```text
backend/
├── routes/
├── services/
│   ├── whatsapp/
│   ├── reports/
│   ├── automation/
│   └── settings/
├── jobs/
├── database/
├── utils/
└── server.ts
```

---

# 8. WhatsApp / Baileys

Usar Baileys para gerenciar a conexão WhatsApp.

Criar uma abstração:

```text
WhatsAppManager
```

O restante da aplicação não deve depender diretamente da implementação interna do Baileys.

Interface conceitual:

```text
connect()
disconnect()
getStatus()
getQRCode()
sendMessage()
sendDocument()
sendImage()
getChats()
getContacts()
```

Deve existir uma única instância persistente do WhatsAppManager.

Não criar uma nova conexão Baileys por request.

---

# 9. QR Code

Fluxo:

```text
React
  ↓
API
  ↓
WhatsAppManager
  ↓
Baileys
  ↓
QR Code
  ↓
WebSocket/SSE
  ↓
React
```

A interface deverá permitir:

- conectar;
- visualizar QR Code;
- acompanhar status;
- detectar conexão;
- detectar desconexão;
- reconectar;
- desconectar;
- visualizar número conectado quando disponível.

---

# 10. Persistência do WhatsApp

A sessão deve sobreviver a reinicializações.

Criar armazenamento persistente:

```text
storage/
└── whatsapp/
    └── auth/
```

O sistema deverá conseguir:

```text
Windows reinicia
      ↓
Node inicia
      ↓
Baileys inicia
      ↓
sessão é recuperada
```

Não exigir QR novamente em cada reinicialização quando a sessão ainda for válida.

---

# 11. Banco de dados

Utilizar SQLite.

Não utilizar PostgreSQL inicialmente.

Não utilizar MySQL.

Não utilizar Redis.

Motivo:

A VPS possui apenas:

```text
2 GB RAM
2 vCPU
```

SQLite é suficiente para a primeira versão.

Banco:

```text
storage/
└── database.sqlite
```

Tabelas iniciais podem incluir:

```text
settings
jobs
job_runs
reports
whatsapp_metadata
application_state
```

Projetar o acesso ao banco de maneira desacoplada para permitir migração futura para PostgreSQL se o sistema crescer.

---

# 12. Scheduler

Implementar scheduler dentro do próprio Node.

Exemplo:

```text
08:00 → gerar relatório
12:00 → executar automação
18:00 → gerar relatório
```

Os jobs devem:

- possuir identificador;
- registrar execução;
- registrar início/fim;
- registrar sucesso/erro;
- ser idempotentes quando necessário;
- evitar execução duplicada.

Exemplo:

```text
job_runs
├── job_id
├── started_at
├── finished_at
├── status
├── error
└── duration
```

Não depender do Windows Task Scheduler para a lógica dos jobs.

---

# 13. Relatórios

Criar módulo:

```text
services/reports/
```

Fluxo:

```text
Scheduler
    ↓
Report Service
    ↓
buscar dados
    ↓
processar
    ↓
gerar relatório
    ↓
salvar
    ↓
enviar via WhatsApp
```

Priorizar formatos leves:

- HTML;
- CSV;
- TXT.

PDF somente quando realmente necessário.

---

# 14. Armazenamento

Estrutura:

```text
storage/
├── whatsapp/
├── reports/
├── temp/
├── logs/
└── database.sqlite
```

Não armazenar arquivos temporários junto do código.

---

# 15. Configuração

Utilizar `.env`.

Exemplo:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000

DATABASE_PATH=./storage/database.sqlite

WHATSAPP_AUTH_PATH=./storage/whatsapp/auth

LOG_LEVEL=info
```

Nunca versionar `.env`.

Criar:

```text
.env.example
```

---

# 16. Acesso ao sistema

O sistema será utilizado exclusivamente através do RDP.

Fluxo:

```text
Meu MacBook
    ↓
RDP
    ↓
Windows Server
    ↓
Browser
    ↓
http://127.0.0.1:3000
```

Não criar:

- domínio;
- HTTPS público;
- reverse proxy;
- Caddy;
- Cloudflare;
- exposição pública da API.

O Node deve preferencialmente escutar em:

```text
127.0.0.1
```

e não em:

```text
0.0.0.0
```

---

# 17. Produção deve ser diferente de desenvolvimento

O projeto deve possuir uma separação clara:

```text
DESENVOLVIMENTO
Windows 11
│
├── source
├── TypeScript
├── Vite
├── dev dependencies
├── tests
└── ferramentas de desenvolvimento


PRODUÇÃO
Windows Server 2012 R2
│
├── build frontend
├── build backend
├── production dependencies
├── Node.js runtime
├── SQLite
├── Baileys
└── storage
```

A VPS não deverá receber ferramentas desnecessárias.

---

# 18. Build de produção

Criar um processo claro para gerar o pacote final.

Exemplo conceitual:

```text
npm run build
```

Resultado:

```text
release/
├── dist/
├── package.json
├── package-lock.json
├── .env.example
└── arquivos necessários de runtime
```

Se o backend for compilado para JavaScript, preferir enviar JavaScript compilado para produção.

Não enviar TypeScript desnecessariamente.

Não enviar código-fonte que não seja necessário para execução.

Não enviar:

```text
node_modules
```

do Windows 11 para a VPS se houver diferenças de ambiente.

As dependências de produção devem ser instaladas na VPS usando o lockfile e uma instalação adequada para produção, ou o pacote deve ser preparado de maneira compatível com Windows Server 2012 R2.

**Atenção especial a dependências nativas.**

Não assumir que `node_modules` compilado no Windows 11 será necessariamente compatível com o Windows Server 2012 R2.

---

# 19. Compatibilidade

A compatibilidade entre:

```text
Windows 11
        ↓
build
        ↓
Windows Server 2012 R2
```

é prioridade.

Antes de definir versões:

- verificar compatibilidade do Node;
- verificar compatibilidade do Baileys;
- verificar compatibilidade do SQLite driver;
- verificar dependências nativas;
- verificar arquitetura x64;
- verificar APIs disponíveis no Windows Server 2012 R2.

Não utilizar automaticamente as versões mais recentes.

Se uma versão moderna não for compatível:

1. identificar a última versão compatível;
2. fixar a versão;
3. documentar o motivo.

---

# 20. Dependências

Prioridade:

```text
Compatibilidade
>
Estabilidade
>
Baixo consumo
>
Simplicidade
>
Novidade
```

Evitar dependências pesadas.

Não adicionar biblioteca apenas por conveniência.

Antes de instalar uma dependência importante, avaliar:

- tamanho;
- memória;
- dependências transitivas;
- compatibilidade com Windows Server 2012 R2;
- necessidade real.

---

# 21. Desenvolvimento local

O desenvolvimento deverá ser confortável no Windows 11.

Durante desenvolvimento podemos usar:

```text
npm run dev
```

com:

```text
React/Vite
+
Node
```

O ambiente local pode utilizar mais recursos.

Não otimizar excessivamente a experiência de desenvolvimento por causa dos 2 GB da VPS.

A otimização pesada deve acontecer no **build e runtime de produção**.

---

# 22. Testes locais

Antes do deploy:

- testar API;
- testar React;
- testar SQLite;
- testar Baileys;
- testar QR;
- testar persistência da sessão;
- testar reconexão;
- testar scheduler;
- testar relatórios;
- testar envio de documentos;
- testar reinicialização do Node;
- testar recuperação de sessão;
- testar build de produção.

Também criar uma forma de executar o build localmente exatamente como será executado na VPS.

---

# 23. Teste de produção local

Antes do deploy final:

```text
npm run build
```

Depois executar o build em modo production:

```text
NODE_ENV=production
```

e verificar:

```text
React
API
SQLite
Baileys
Scheduler
Reports
```

Tudo deverá funcionar sem depender do Vite dev server.

---

# 24. Serviço do Windows

Na VPS, o Node não deverá depender de um terminal aberto.

Configurar o processo como serviço do Windows ou utilizar uma solução equivalente compatível com Windows Server 2012 R2.

Objetivo:

```text
Windows inicia
      ↓
Node inicia automaticamente
      ↓
Aplicação inicia
      ↓
Baileys inicia
      ↓
Scheduler inicia
```

Se o Node morrer:

```text
Node crash
   ↓
Service manager
   ↓
Node restart
```

O RDP não precisa permanecer aberto.

---

# 25. Logs

Logs simples:

```text
INFO
WARN
ERROR
```

Não registrar:

- senhas;
- tokens;
- credenciais;
- secrets;
- informações sensíveis desnecessárias.

Implementar rotação ou limpeza para impedir crescimento infinito dos logs.

---

# 26. Memória

A VPS possui somente:

```text
2 GB RAM
2 vCPU
```

Portanto, o runtime deve ser extremamente conservador.

Evitar:

- múltiplas instâncias;
- caches gigantes;
- polling agressivo;
- processamento desnecessário;
- arquivos grandes inteiros em memória;
- loops permanentes;
- workers adicionais sem necessidade.

Preferir processamento em stream quando fizer sentido.

---

# 27. Backup

Criar mecanismo para backup de:

```text
storage/database.sqlite
storage/whatsapp/auth/
storage/reports/
```

O backup deve ser simples e seguro.

Nunca apagar a sessão atual durante backup.

---

# 28. Health check

Criar:

```text
GET /api/health
```

Exemplo:

```json
{
  "status": "ok",
  "uptime": 12345,
  "database": "ok",
  "whatsapp": "connected"
}
```

---

# 29. Interface

Criar inicialmente um dashboard simples.

### Dashboard

Mostrar:

- status do WhatsApp;
- número conectado;
- último job;
- próximo job;
- último relatório;
- erros recentes.

### WhatsApp

Mostrar:

- status;
- QR Code;
- conectar;
- desconectar;
- reconectar;
- número conectado;
- último evento.

### Jobs

Mostrar:

- nome;
- status;
- próxima execução;
- última execução;
- último erro.

### Relatórios

Mostrar:

- relatório;
- data;
- status;
- arquivo;
- ações.

Não criar funcionalidades que não sejam necessárias para a primeira versão.

---

# 30. Estrutura do projeto

Sugestão:

```text
project/
│
├── backend/
│   ├── routes/
│   ├── services/
│   │   ├── whatsapp/
│   │   ├── reports/
│   │   ├── automation/
│   │   └── settings/
│   ├── jobs/
│   ├── database/
│   ├── utils/
│   └── server.ts
│
├── frontend/
│   ├── src/
│   └── dist/
│
├── storage/
│   ├── whatsapp/
│   ├── reports/
│   ├── temp/
│   └── logs/
│
├── scripts/
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env.example
└── README.md
```

Pode alterar essa estrutura se existir uma alternativa melhor, mas preserve os princípios de:

- modularidade;
- baixo acoplamento;
- baixo consumo;
- simplicidade.

---

# 31. Regra importante sobre o ambiente de produção

**Não tente reproduzir o ambiente limitado da VPS durante todo o desenvolvimento.**

O desenvolvimento ocorrerá no Windows 11.

Use os recursos disponíveis localmente para desenvolver rapidamente.

Depois crie um build otimizado para produção.

O que importa é que:

```text
BUILD LOCAL
     ↓
EXECUÇÃO
     ↓
WINDOWS SERVER 2012 R2
     ↓
2 GB RAM / 2 vCPU
```

funcione corretamente.

---

# 32. Deploy

Criar um processo documentado:

```text
1. Desenvolver localmente
2. Rodar testes
3. Gerar build
4. Gerar pacote de produção
5. Copiar pacote para VPS
6. Instalar/verificar Node.js compatível
7. Instalar somente dependências de produção necessárias
8. Configurar .env
9. Configurar storage
10. Configurar serviço do Windows
11. Iniciar aplicação
12. Verificar health check
13. Abrir browser via RDP
14. Acessar localhost:3000
15. Testar WhatsApp
16. Testar scheduler
17. Testar relatório
```

---

# 33. Rollback

O deploy deve permitir manter a versão anterior.

Estrutura sugerida:

```text
app/
├── current/
├── releases/
│   ├── 2026-01-01/
│   ├── 2026-01-02/
│   └── ...
└── storage/
```

Ou uma estratégia equivalente.

O `storage` não deve ser destruído durante deploy.

A sessão do WhatsApp e o banco devem permanecer fora do build.

---

# 34. Separação entre código e dados

Muito importante:

```text
Código
    ↓
release/

Dados persistentes
    ↓
storage/
```

Nunca colocar:

```text
database.sqlite
```

dentro do build.

Nunca colocar:

```text
whatsapp/auth/
```

dentro do build.

O deploy deve atualizar o código sem apagar os dados.

---

# 35. Primeira etapa do trabalho

**Não comece instalando coisas na VPS.**

Comece no Windows 11.

Primeiro:

1. criar estrutura do projeto;
2. escolher stack;
3. validar compatibilidade das versões;
4. criar backend;
5. criar frontend;
6. criar banco;
7. criar WhatsAppManager;
8. integrar Baileys;
9. criar scheduler;
10. criar relatórios;
11. criar dashboard;
12. testar tudo localmente;
13. gerar build de produção;
14. testar o build localmente;
15. somente depois preparar o deploy para Windows Server 2012 R2.

---

# 36. Primeira tarefa do Claude Code

Comece pelo ambiente local.

Não faça deploy na VPS ainda.

Primeiro analise o projeto e proponha:

- versão do Node;
- versão do npm;
- versão do TypeScript;
- versão do React;
- versão do Vite;
- versão do Baileys;
- biblioteca de SQLite;
- framework HTTP;
- biblioteca de scheduler;
- estratégia de WebSocket/SSE;
- estratégia de serviço Windows;
- estratégia de build;
- estratégia de deploy.

O requisito mais importante é:

> **todas as versões escolhidas precisam ser compatíveis com o ambiente final Windows Server 2012 R2 x64.**

O fato de o desenvolvimento ser feito em Windows 11 **não pode fazer com que o build dependa de recursos que não existam no Windows Server 2012 R2**.

Depois de definir a stack, implemente incrementalmente e teste cada etapa.

---

# 37. Critério final de sucesso

O projeto estará pronto quando:

```text
Windows 11
   │
   ├── desenvolvimento
   ├── testes
   ├── build
   └── pacote de produção
             │
             ▼
Windows Server 2012 R2
   │
   ├── Node.js
   ├── aplicação
   ├── Baileys
   ├── SQLite
   └── Scheduler
```

E a VPS conseguir:

- iniciar a aplicação automaticamente;
- executar com 2 GB RAM;
- executar com 2 vCPU;
- manter o WhatsApp conectado;
- recuperar a sessão após reinicialização;
- executar jobs;
- gerar relatórios;
- enviar relatórios via WhatsApp;
- servir o React;
- funcionar em `127.0.0.1:3000`;
- não precisar de Docker;
- não precisar de Linux;
- não precisar de domínio;
- não precisar de HTTPS público;
- não precisar de RDP aberto continuamente.

---

# 38. Princípio final

O projeto deve seguir esta filosofia:

> **Desenvolvimento rápido e confortável no Windows 11. Produção mínima, enxuta e compatível no Windows Server 2012 R2.**

A VPS é somente o **runtime de produção**.

Não transformar a VPS em ambiente de desenvolvimento.

Não instalar ferramentas desnecessárias nela.

Não fazer build nela.

Não compilar TypeScript nela.

Não executar Vite nela.

Não instalar Docker nela.

**Desenvolver localmente → testar localmente → gerar build → empacotar → fazer deploy → executar.**

Esse é o fluxo oficial do projeto.