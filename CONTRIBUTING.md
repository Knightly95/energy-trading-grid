# Contributing

Thanks for taking the time to look at this project. This guide explains how to set it up, what a change must pass before it's merged, and the conventions the code follows.

## Set up

You need Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173, with the in-browser backend
```

No server or environment file is needed. The in-browser backend in `src/mocks` emits the same socket events as the real server.

To work against the real Node.js servers in `api/`:

```bash
npm run install:all
npm run dev:all    # frontend + REST API (port 3000) + WebSocket server (port 4001)
```

## Workflow

1. Open an issue first for anything larger than a small fix, so the approach can be agreed before you write code.
2. Create a branch from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name` or `chore/short-name`.
3. Keep the change small and focused on one thing.
4. Open a pull request against `main` and fill in the template. Nothing is pushed straight to `main`.

## Checks

Run these before you open a pull request. CI runs all of them on every pull request.

| Check                      | Command                |
| -------------------------- | ---------------------- |
| Types                      | `npx tsc --noEmit`     |
| Lint                       | `npm run lint`         |
| Formatting                 | `npm run format:check` |
| Unit and integration tests | `npx vitest run`       |
| End-to-end tests           | `npm run test:e2e`     |
| Build                      | `npm run build`        |

A pre-commit hook (Husky and lint-staged) runs the type-check, Prettier and ESLint on the files you staged.

The end-to-end tests start the frontend and both local servers by themselves. Run `npm run install:all` and `npx playwright install chromium` once before the first run.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` or `ci:`, followed by a short summary in the imperative. Explain the reason for the change in the body when it isn't obvious.

## Code conventions

The full reference is [AGENTS.md](AGENTS.md), which people and AI coding agents both follow. The rules that matter most:

- **TypeScript:** no `any` and no `@ts-ignore`. Shared types live in `src/shared/types`.
- **State:** live offers and offerings are in Zustand stores (`src/store`). Components subscribe with a selector, so they re-render only when their slice changes.
- **Real-time data:** all socket traffic goes through `src/shared/services/socket`. Components never touch the socket client directly.
- **Forms:** offering forms are generated from the JSON configuration by `src/shared/components/dynamic-form`. Add a field type there instead of hand-writing a form.
- **Backends:** a feature must work with both the in-browser backend and the live servers. If you add a socket event, add it to both.
- **Structure:** a page keeps its own `components`, `constants`, `utils` and `__tests__` folders. Code used by more than one page moves to `src/shared`.
- **Files:** kebab-case file names, imports through the `@/` alias.

## Tests

- Unit and integration tests are `*.test.ts(x)` files in a `__tests__` folder next to the code. They use Vitest and React Testing Library, with the helpers in `src/testing`.
- End-to-end tests are in `e2e/`, one folder per area, written with page objects (`e2e/<area>/pages`). Put selectors in the page object, not in the spec.
- Add or update tests in the same pull request as the behaviour change. A bug fix comes with a test that fails without the fix.

## Decision records

Record a non-trivial choice (a new library, a pattern, a trade-off) in [architecture-decision-record.md](architecture-decision-record.md), with the alternatives you rejected and why.

## Reporting a bug

Open an issue with the bug report template. Include the steps to reproduce, what you expected and what happened, and say whether you were using the in-browser backend or the live servers.
