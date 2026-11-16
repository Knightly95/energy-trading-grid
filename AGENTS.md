# AGENTS.md

Instructions for AI coding agents working in this repository. People follow the same rules; see [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Project

A real-time marketplace for energy offers, built with React 19, TypeScript and Vite. Offers arrive over a WebSocket (Socket.io) and a data grid updates as they are created, changed and removed. Offerings are created and edited through forms generated from a JSON configuration.

The app has two interchangeable backends:

- **In-browser backend (default):** `src/mocks/mockSocket.ts` emits the same events as the real server, and the form configuration comes from a local JSON file. This is what the live demo uses.
- **Live servers:** the small Node.js REST and WebSocket servers in `api/`, selected with `VITE_BACKEND=live`.

## Commands

| Task                             | Command                                    |
| -------------------------------- | ------------------------------------------ |
| Install                          | `npm install`                              |
| Install, including the servers   | `npm run install:all`                      |
| Run with the in-browser backend  | `npm run dev`                              |
| Run with the live servers        | `npm run dev:all`                          |
| Unit and integration tests, once | `npx vitest run`                           |
| One test file                    | `npx vitest run src/path/to/file.test.tsx` |
| Tests with coverage              | `npx vitest run --coverage`                |
| End-to-end tests                 | `npm run test:e2e`                         |
| Type-check                       | `npx tsc --noEmit`                         |
| Lint                             | `npm run lint`                             |
| Format                           | `npm run format`                           |
| Build                            | `npm run build`                            |

`npm test` starts Vitest in watch mode and never exits. Use `npx vitest run` instead.

## Before you say a task is done

1. `npx tsc --noEmit` passes.
2. `npm run lint` passes.
3. `npx vitest run` passes, including tests you added for the change.
4. If you touched a page flow, a socket event or the servers in `api/`, `npm run test:e2e` passes.

Report what you ran and the result. If something fails and you can't fix it, say so; don't hide it.

## Structure

```text
api/                Node.js REST and WebSocket servers (from the starter template)
e2e/                Playwright tests, one folder per area, with page objects
src/
  mocks/            In-browser backend: simulated socket server and its data
  pages/
    offers/         Live offers grid and the offer detail modal
    offerings/      Marketplace: list, add and edit, with the generated forms
    orders/
  shared/
    components/     data-table, dynamic-form, modal and other reusable pieces
    hooks/          useSocket
    services/       Socket service and the REST service for the form config
    types/          Shared types
    utils/
  store/            Zustand stores: offersStore, offeringsStore
  testing/          Test setup, providers, fixtures and render helpers
  config.ts         Reads the VITE_* variables and picks the backend
```

Each page keeps its own `components`, `constants`, `utils` and `__tests__`. Code used by more than one page belongs in `src/shared`.

## Rules

- **Types.** No `any`, no `@ts-ignore`, no non-null assertions to silence errors.
- **State.** Live data lives in the Zustand stores. Subscribe with a selector (`useOffersStore((s) => s.offers)`), never to the whole store. The grid depends on this to avoid re-rendering on every socket message.
- **Socket.** Use `src/shared/services/socket` and the `useSocket` hook. Don't create socket clients in components. Event names are defined once in `socketEvents.ts`.
- **Two backends.** Nothing outside `config.ts`, the socket service and the REST service may know which backend is active. A new event or endpoint must be implemented in `src/mocks` and in `api/`.
- **Forms.** Offering forms come from the JSON configuration and are rendered by `dynamic-form`. To support a new input, add a field type to `field-renderer.tsx`.
- **UI.** Material UI components and the MUI X Data Grid. Both light and dark themes must work.
- **Routing.** Use the router (`Link`, `useNavigate`). A plain `href` skips the base path and breaks the GitHub Pages deployment.
- **Performance.** Grid rendering is performance-sensitive. Don't replace store selectors or the row change detection (`useRowChangeDetection`) without measuring.
- **Style.** Prettier decides formatting. File names are kebab-case. Import through the `@/` alias.
- **Language.** Code, comments and documentation are in English.

## Tests

- Vitest and React Testing Library. Test files are `__tests__/*.test.ts(x)` next to the code.
- Render with the helpers in `src/testing/test-utils.tsx` so components get their providers.
- Unit tests run with `VITE_BACKEND=live` and mock the network, so they exercise the real service code. The in-browser backend has its own tests in `src/mocks/__tests__`.
- Playwright tests use page objects in `e2e/<area>/pages`. Keep selectors there. They run against the live local servers, which Playwright starts itself.
- Query by role and label. Test what the user sees, not implementation details.

## Guardrails

- Don't commit `api/data` or generated reports (`coverage/`, `playwright-report/`, `test-results/`).
- Don't add a dependency without a reason recorded in `architecture-decision-record.md`.
- Don't commit secrets. The app needs none.
- Don't push to `main`. Work on a branch and open a pull request.
- Don't skip the pre-commit hook (`--no-verify`).
- Keep changes small. If a request conflicts with these rules, say so and propose an alternative instead of complying silently.

## How AI is used in this project

AI coding agents are used for exploration, scaffolding tests and documentation. Every change is read, run and tested by a person before it is merged, and CI runs the lint, unit, end-to-end and build steps on every pull request.

## More detail

- [architecture-decision-record.md](architecture-decision-record.md): why Zustand, Socket.io, Material UI, JSON-driven forms and this testing setup, with the trade-offs.
- [api/README.md](api/README.md): the REST and WebSocket servers.
