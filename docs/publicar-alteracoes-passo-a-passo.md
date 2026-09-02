# Como publicar alterações (passo a passo)

Documento operacional para quem vai **editar e publicar** o sistema — não é o
manual de uso do painel. Backend na Fly.io, frontend na Vercel.

> **Regra de ouro:** este arquivo é a fonte da verdade. Não peça para uma IA
> "descobrir como fazer o deploy" — os comandos certos estão aqui. Use a IA
> para *entender erros*, não para inventar comandos. Há prompts prontos no
> final.

---

## Qual rota usar

| Você precisa... | Rota | Instalar algo? |
|---|---|---|
| Trocar um texto, um horário, um número, um limite | **A — só navegador** | Não |
| Rodar os testes, ver log ao vivo, mexer no volume/secrets | **B — Codespace** | Não |
| Desenvolver todo dia, sessões longas | **C — VS Code local** | Sim |

A rota A resolve a maioria dos casos. Comece por ela.

---

## Rota A — só navegador (sem instalar nada)

1. Abra o repositório no GitHub e navegue até o arquivo.
2. Clique no ícone de **lápis** (Edit this file).
3. Faça a alteração.
4. **Commit changes** → escreva o que mudou → confirme na branch `develop`.

Pronto. O push dispara sozinho o workflow *Deploy backend (Fly.io)*: ele roda
os testes e **só publica se passarem**.

**Acompanhar:** aba **Actions** do repositório. Bolinha amarela = rodando,
✅ = publicado, ❌ = parou nos testes (nada foi publicado — a produção continua
no ar com a versão anterior).

**Publicar sem alterar nada** (ex.: repetir um deploy): aba **Actions** →
*Deploy backend (Fly.io)* → botão **Run workflow**.

> Alteração no **frontend** (pasta `frontend/`) não é publicada por aqui — o
> painel vai para a Vercel, que é um deploy separado (rota B, `npm run
> deploy:web`).

---

## Rota B — Codespace (terminal no navegador)

1. No GitHub, botão verde **Code** → aba **Codespaces** → **Create codespace
   on develop**.
2. Espere terminar a preparação (uns minutos na primeira vez; depois abre em
   segundos). Ao final você tem VS Code no navegador com Node 24, o CLI da
   Fly, o Copilot e as dependências já instaladas.

### Comandos disponíveis

```bash
npm run check        # typecheck + testes — rode SEMPRE antes de publicar
npm run dev:backend  # sobe a API local (porta 3000)
npm run dev:frontend # sobe o painel local (porta 5173)

npm run deploy       # check + publica backend (Fly) e frontend (Vercel)
npm run deploy:api   # só o backend
npm run deploy:web   # só o frontend
```

### Primeira vez no Codespace: conectar na Fly

```bash
fly auth login      # abre uma aba do navegador para autorizar
fly status --app meu-novo-projeto-api
```

Para não repetir isso a cada Codespace novo, cadastre um token como segredo:
GitHub → **Settings → Codespaces → Secrets** → `FLY_API_TOKEN` (gere com
`fly tokens create deploy -x 8760h --app meu-novo-projeto-api`, copiando a saída
inteira, **incluindo o `FlyV1 ` do começo**).

### Diagnóstico

```bash
fly logs --app meu-novo-projeto-api        # log ao vivo
fly status --app meu-novo-projeto-api      # máquina está "started"? healthcheck passa?
fly secrets list --app meu-novo-projeto-api   # mostra os NOMES (nunca os valores)
fly ssh console -C "ls -la /data" --app meu-novo-projeto-api   # o volume tem os dados?
```

Teste rápido da API, de qualquer lugar:
```bash
curl -i https://meu-novo-projeto-api.fly.dev/api/health
```

---

## Rota C — VS Code local

Só se for desenvolver de verdade. É preciso instalar, nesta ordem: **Git**,
**Node.js 24.x** (nem 22 nem 25 — o projeto fixa `>=24 <25`), **VS Code**, e o
**CLI da Fly** (`https://fly.io/install.sh`). Depois:

```bash
git clone https://github.com/mouraaugusto558-droid/Relatorios-Automatizados.git
cd Relatorios-Automatizados
npm ci
cp .env.example .env     # preencher as variáveis
npm run check
```

Os mesmos comandos da rota B valem aqui.

---

## Nunca faça isso

| Não faça | Por quê |
|---|---|
| `fly scale count 2` | O volume atende **uma** máquina. A segunda não sobe, ou dois bancos divergem |
| `fly volumes destroy` | Apaga banco, configurações e a sessão do WhatsApp de uma vez |
| Mudar `auto_stop_machines` para `true` | A máquina dorme e o relatório das 08:00 não dispara |
| Trocar a estratégia para `canary`/`bluegreen` | Não funciona com volume — o deploy trava |
| Publicar com os testes vermelhos | O portão existe justamente para isso |
| Commitar `.env`, tokens ou senhas | São segredos; vão em `fly secrets` |

---

## Usando o Copilot: prompts prontos

O Copilot é bom em **ler erro e explicar**, e ruim em **adivinhar a infra deste
projeto**. Então: peça análise, não improviso. Em todos os casos, abra o
Copilot Chat e comece anexando este arquivo com `#file:docs/publicar-alteracoes-passo-a-passo.md`.

**Quando o Actions falhar (❌):**
> Copie o log do passo que falhou e cole:
> "Este é o log de erro de um workflow do GitHub Actions. Me diga em uma frase
> qual arquivo e qual linha causaram a falha e o que precisa mudar. Não sugira
> alterar o workflow nem os comandos de deploy."

**Quando `npm run check` falhar:**
> "Rodei `npm run check` e deu este erro: <cole>. Me mostre a correção mínima
> no arquivo de origem. Não altere arquivos de teste para o teste passar."

**Quando o app ficar `unhealthy` na Fly:**
> "Saída de `fly logs`: <cole>. As duas causas mais comuns neste projeto são
> HOST diferente de 0.0.0.0 e algum secret faltando. Qual das duas é, ou é
> outra coisa?"

**Para fazer uma alteração de conteúdo:**
> "Onde no código está definido <o texto/horário/limite que quero mudar>?
> Só me diga o arquivo e a linha, não altere nada ainda."

**O que não pedir ao Copilot:** criar/alterar `fly.toml`, criar volume, rodar
`fly secrets`, mudar o workflow do deploy, ou "resolver o deploy". Essas ações
estão neste documento e um palpite errado aqui derruba a produção ou apaga
dados.
