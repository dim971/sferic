# Prompt to delegate to Codex

Codex (CLI or OpenAI IDE) automatically reads `AGENTS.md` at the root. The opening prompt is therefore shorter.

Copy-paste into your Codex session (started at the root of the unzipped kit):

---

> Read `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `DESIGN.md` (+ the image in `design/`), `ROADMAP.md`, then `tasks/phase-0-bootstrap.md`.
>
> Implement phase 0 inside a subfolder `app/`. At the end:
> - Run `pnpm tsc --noEmit` and `pnpm tauri dev`.
> - Commit `feat(phase-0): bootstrap`.
> - Stop and give me a recap.

---

## Codex-specific notes

- Codex respects bullet-list constraints better than long paragraphs.
- If you use Codex in CLI, add `--auto-approve` carefully: for bootstrap shell commands (`pnpm install`, etc.), that's fine; for system modifications, refuse.
- Codex is weaker than Claude at mid-flight architectural choices. Stay on the `ROADMAP.md` rails and don't allow deviations.

## Parallel mode (Claude + Codex)

You can have both work on different Git branches:
- Claude → `feat/phases-0-2` branch (bootstrap, audio loading, audio engine — the part where architecture matters most)
- Codex → `feat/phases-3-4` branch (3D UI, timeline — more mechanical part)

Then merge manually.

## Reverse parallel mode

Another strategy that works well: Claude does the **review** of what Codex produces. Run Codex to implement a phase, then open Claude Code and say:

> Read `tasks/phase-3-spatial-ui.md` and the current branch. Check the implementation respects the spec and architecture. List deviations, potential bugs, and concrete suggestions. Don't write code.
