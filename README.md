# Sistema Node.js + React + Baileys

Monólito modular. Desenvolvimento no Windows 11, produção no Windows Server 2012 R2 (2 vCPU / 2GB RAM).

Ver:

- [`Kickoff — ...md`](./Kickoff%20—%20Sistema%20Node.js%20+%20React%20+%20Baileys%20—%20Desenvolvimento%20Local%20e%20Deploy%20em%20Windows%20Server%202012%20R2.md) — especificação original.
- [`planejamento`](./planejamento) — decisões de stack, fases e riscos.

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
