# Prompt to delegate to Claude Code

Copy-paste the block below into your Claude Code session (started at the root of the unzipped kit):

---

> You are tasked with building the **Sferic** application defined in this repository.
>
> Read in this order:
> 1. `README.md`
> 2. `ARCHITECTURE.md`
> 3. `DESIGN.md` + the image under `design/` (visual source of truth)
> 4. `ROADMAP.md`
> 5. `CLAUDE.md` (your operating rules)
>
> Then attack **phase 0** following `tasks/phase-0-bootstrap.md`. Create the project under a subfolder `app/`.
>
> At the end of each phase:
> - Run `pnpm tsc --noEmit` and `pnpm tauri dev` to validate.
> - Commit `feat(phase-N): <summary>`.
> - **Stop and summarise what you did, what works, and what's left to validate.** Do not chain into the next phase without my green light.
>
> If you hesitate on a choice not covered by the docs, ask rather than assume. If you want to add a dependency not listed in `ARCHITECTURE.md`, ask first.
>
> Start now: confirm you have read the 4 documents and begin phase 0.

---

## Variants

### "Run everything" mode
If you fully trust it or want to let it run:

> … Go ahead, chain the 9 phases without stopping, but commit at each phase and flag any major issue. I'll review at the end.

### "Single phase" mode
If you want it to do only one specific phase:

> Read `README.md`, `ARCHITECTURE.md`, and `tasks/phase-3-spatial-ui.md`. Implement only phase 3 inside `app/`, assuming phases 0–2 are already done. Stop at the end.

### "Review" mode
To get an audit of what exists:

> Read the entire repository and give me a critical review of the architecture, tech choices, and roadmap. Point out risks, fuzzy areas, and any potentially obsolete dependencies, without writing code yet.
