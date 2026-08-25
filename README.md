# Sistema Node.js + React + Baileys

Monólito modular. Backend em VPS Linux via EasyPanel (Docker), frontend na
Vercel — processo de deploy documentado em [`CLAUDE.md`](./CLAUDE.md).

Ver também:

- [`docs/como-o-sistema-funciona.md`](./docs/como-o-sistema-funciona.md) —
  visão geral de como as peças do sistema funcionam hoje.
- [`docs/_archive/`](./docs/_archive/) — specs de ideias anteriores e
  abandonadas (deploy em Windows Server, sincronização com Supabase/Google
  Sheets), mantidas só como histórico.

## Desenvolvimento

```bash
npm install
cp .env.example .env
npm run dev:backend    # terminal 1 — http://127.0.0.1:3000
npm run dev:frontend   # terminal 2 — http://127.0.0.1:5173 (proxy para /api)
```

## Build de produção

```bash
npm run build
NODE_ENV=production npm run start
```

## Requisitos

- Node.js 24.x (ver `.nvmrc` / `engines` no `package.json`).
