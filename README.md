# Disc Golf RPG

Top-down (tilted) disc golf RPG. Three.js + Svelte 5 + Vite, pnpm monorepo.

## Setup
```sh
nvm use          # Node 26
npm i -g pnpm    # Node 26 no longer ships corepack
pnpm install
```

## Commands
| Command | What it does |
|---|---|
| `pnpm dev` | Run the game at http://localhost:5173 |
| `pnpm test` | Run unit tests |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` / `pnpm format` | Check / fix with Biome |
| `pnpm build` | Production build of the game |

## Layout
See `.kiro/steering/coding-standards.md`. Design docs live in `docs/`, ideas in `ideas/`.
