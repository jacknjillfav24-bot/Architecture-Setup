# Architecture-Setup

A TypeScript / Node.js project.

## Requirements

- Node.js 22 or newer (the exact version is pinned in `.nvmrc`; run `nvm use` if you use nvm)
- npm

## Getting started

```sh
npm install
npm run dev
```

`npm run dev` runs `src/index.ts` directly and restarts on file changes.

## Scripts

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Run the app in watch mode with `tsx`            |
| `npm run build`        | Compile `src/` to JavaScript in `dist/`         |
| `npm start`            | Run the compiled build from `dist/`             |
| `npm test`             | Run the test suite once with Vitest             |
| `npm run test:watch`   | Run tests in watch mode                         |
| `npm run typecheck`    | Type-check `src/` and `tests/` without emitting |
| `npm run lint`         | Lint with ESLint (`typescript-eslint` rules)    |
| `npm run format`       | Format all files with Prettier                  |
| `npm run format:check` | Check formatting without writing changes        |

## Project structure

```
.
├── .github/workflows/ci.yml   # CI: lint, format check, typecheck, test, build
├── src/
│   ├── index.ts               # Entry point
│   └── lib/                   # Application modules
├── tests/                     # Vitest tests (*.test.ts)
├── eslint.config.js
├── tsconfig.json              # Type-checking config (src + tests)
└── tsconfig.build.json        # Build config (src only, emits to dist/)
```

The project uses native ES modules (`"type": "module"`) with `NodeNext` module
resolution, so relative imports in TypeScript need a `.js` extension, e.g.
`import { greet } from "./lib/greet.js";`.

## Continuous integration

GitHub Actions runs on every push to `main` and on every pull request. It
installs dependencies with `npm ci`, then runs lint, format check, typecheck,
tests and build. Run the same checks locally before pushing:

```sh
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```
