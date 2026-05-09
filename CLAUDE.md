# Instructions for Claude Code

You are tasked with implementing and maintaining the **Sferic** application described in this repository.

## Mission

Build and evolve a cross-platform desktop tool (macOS, Windows, Linux) that lets the user spatialize an audio file in time through a visual 3D interface, based on the Web Audio API (`PannerNode` HRTF).

## Documents to read in this order

1. `README.md` — product overview and tech choices
2. `ARCHITECTURE.md` — data model, audio graph, components
3. `DESIGN.md` — visual system + reference image in `design/` (source of truth for any rendering decision)
4. `ROADMAP.md` — original 9-phase plan (now mostly delivered)
5. `tasks/phase-0-bootstrap.md` — first task, kept as historical reference

## Methodology

- For new work, **prefer surgical edits** over feature-flag gates or backwards-compat shims unless the user asks otherwise.
- The original kit was designed around **phase-by-phase delivery**; phases are largely complete. New requests come as targeted bug fixes or features — handle them directly without invoking the phased workflow unless asked.
- Create the project under the `app/` subfolder at the kit root (already in place).
- Use **pnpm** as the package manager.
- Use **Tauri 2** (never Tauri 1).
- TypeScript in `strict` mode.

## Code conventions

- React: functional components only, hooks.
- No classes except for `AudioEngine` (singleton).
- Absolute imports from `@/` (configured in `tsconfig.json` and `vite.config.ts`).
- Tailwind utility-first; no CSS modules unless truly necessary.
- Tailwind v4 — use `bg-[var(--token)]` form, never `bg-[--token]` (the latter generates invalid CSS in v4).
- Naming: `PascalCase` for components, `camelCase` for functions/variables, `SCREAMING_SNAKE_CASE` for global constants.
- One file per React component.

## Mandatory checks before declaring a change "done"

1. `pnpm install` runs without critical warnings.
2. `pnpm tauri dev` boots the app with no console errors (when applicable).
3. The acceptance criterion of the requested change is met (testable manually).
4. `pnpm tsc --noEmit` returns zero errors.
5. Commit message follows Conventional Commits (e.g. `feat(scope): …`).

## When to ask for confirmation

- Before adding a dependency that isn't already listed in `ARCHITECTURE.md`, `DESIGN.md`, or one of the existing `package.json` files.
- Before changing the component decomposition.
- Before touching Tauri configuration (security, capabilities allowlist).
- Before visibly diverging from the screenshot in `design/` (colours, layout, hierarchy).
- If a task instruction conflicts with `ARCHITECTURE.md` or `DESIGN.md`.

## When NOT to ask

- Minor naming, internal folder structure, formatting choices.
- Common utility libraries (e.g. `clsx`, `nanoid`, `date-fns`).

## Expected first response when starting a new session

When you start:

1. Confirm you have read `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md` and looked at the reference image in `design/`.
2. Report the detected versions of Node, Rust, and pnpm.
3. Acknowledge the user's request and begin work — there is no longer a "phase 0" to attack first; the project is built.
