# KM Agent desktop roadmap

This repository tracks the OpenCode `dev` branch and uses its existing agent runtime, SDK, provider support, and Electron desktop shell as the foundation for KM Agent.

## First milestone

- Keep the upstream OpenCode backend and protocol intact.
- Present a Codex-style desktop workspace with projects, recent tasks, task tabs, and a prominent first-run action.
- Make the first-use path explicit: add a project, create a task, choose a model, send a prompt, and review tool activity.
- Keep the web renderer usable for fast visual testing while preserving the Electron desktop integration.

## Implemented in the first pass

- OpenCode source imported from `anomalyco/opencode`.
- Dedicated `gui-first-pass` development branch.
- Upstream desktop, server, SDK, session, provider, and terminal features retained.
- KM Agent now has its own application name, app IDs, `km-agent://` deep links, repository-backed update channels, installer names, Linux metadata, menus, loading states, and cross-platform icon set. Existing OpenCode desktop data and `opencode://` links remain compatible, so the product identity change does not strand current workspaces.
- Home empty state upgraded into a centered launchpad.
- Launchpad connects to the real project picker when no repository is open and to the real new-session flow once a project exists.
- Embedded Excalidraw whiteboard for sketching level flow, puzzle logic, mechanics, and interaction diagrams.
- Whiteboards autosave per project, stay shared across its main worktree and sandboxes, and open from both new-task and existing-task views.
- Each project can organize up to twelve independently saved, named whiteboards for overall flow, individual levels, puzzle chains, and game systems. Existing single-board projects migrate in place as the main board; switching also preserves each board's viewport, isolates undo history, and deletion requires a deliberate second click.
- A board exports directly into the active prompt as a PNG visual attachment without overwriting an existing designer instruction.
- Board export also extracts bounded text labels, shape types, standalone notes, and bound arrow relationships into a structured AI context, reducing vision-only ambiguity while preserving the designer's request.
- Whiteboards continuously report their structured readiness—node, connection, note, unnamed, isolated, and cycle counts—and the AI handoff derives start/end candidates, branches, merges, cycles, unlabeled nodes, and disconnected nodes instead of forcing the model to infer graph topology from pixels alone.
- Designers can hand off either the whole board or only the current Excalidraw selection. Selection export crops the PNG and structured context to the same relationship-aware closure: bound labels, selected-node connections, connector endpoints, groups, and frame children stay intact while unrelated puzzle branches are excluded.
- Editable game-design templates provide ready-made level-flow, puzzle-logic, core-loop, and narrative-branch diagrams with real bound node relationships, so their arrows remain both visually editable and machine-readable; replacing a populated board requires confirmation and remains undoable.
- Home game-idea starters now install a complete prototype workbench after one confirmation: an optional creative brief becomes a structured Build task, the matching template opens on a new editable board without touching existing boards, missing fields in the six-part acceptance plan are filled without overwriting project edits, and a stable reusable playtest scenario is created or refreshed. Capacity checks prevent partial setup when the project has reached its board or scenario limit.
- Standard `.excalidraw` and JSON scene import/export keeps boards portable across projects and compatible with the upstream open-source ecosystem; imports are size-checked, confirmed, and undoable.
- Every whiteboard handoff includes its board name and lets the designer choose a safe AI intent: review the design without editing files, produce an implementation plan without editing files, or build a playable demo. Existing prompt text is preserved and the selected action is appended exactly once.
- The composer now exposes the real built-in Plan and Build workflows with localized labels, plus an inline Ask first / Auto approve permission control on both new and existing tasks. Whiteboard review and planning handoffs select the restricted Plan agent, while playable-demo handoffs select Build, so execution safety no longer relies on prompt wording alone.
- Whiteboard work is now bidirectional: designers can ask the restricted Plan agent to refine a scene into a bounded `km-whiteboard` proposal, and the latest valid assistant proposal is discovered automatically when the board reopens. Validated nodes, decisions, mechanics, rewards, failures, links, and notes generate a separate editable Excalidraw board while the original stays untouched; proposals from another task or model can also be pasted into the same safe import path.
- The whiteboard now includes a persistent in-canvas AI copilot chat. Each short designer request stays visible in the normal task history while exact scene structure travels as hidden model context; vision-capable models also receive the current board image. Responses stream back without closing the canvas, validated proposals can replace the current undoable scene or create a safe revision, and automatic revision mode only applies responses that arrived after the dialog opened. The protocol remains compatible with earlier attachment-based whiteboard turns and degrades cleanly for text-only models.
- AI co-editing now renders a safe whiteboard revision while the model is still responding instead of waiting for one complete JSON payload. A bounded JSON-lines protocol validates each finished node, connection, and note event, progressively redraws an isolated `AI draft` board, promotes it only after a final `done` event and full graph validation, and falls back to the original proposal format for older models and conversations. Leaving the live draft stops automatic canvas takeover, while the source board always remains intact.
- Live whiteboard generation can now be stopped directly from the in-canvas copilot without interrupting an unrelated task. Any validated partial graph is retained as an editable stopped draft: automatic revision mode keeps its existing safe board without duplicating it, while manual mode still offers apply-as-revision or replace-current controls.
- While its own generation is running, the whiteboard copilot now keeps the request editor, scope controls, and suggestion chips available and accepts durable steer prompts alongside Stop. Follow-up adjustments join the active model turn immediately, while an unrelated coding task still leaves the whiteboard read-only.
- AI whiteboard revisions now replace only the managed flow structure while carrying freehand sketches, reference images and their files, frames, and unbound visual connectors into safe versions and current-board replacements. Streamed draft updates keep that designer material layer stable instead of erasing it on every redraw.
- Every applied AI copilot response now keeps a bounded, persistent link to the exact whiteboard version it created or replaced. The response card shows whether that version is current and can reopen it after the designer switches boards or closes and reopens the whiteboard; deleting the board removes the stale link, preventing duplicate application and dead version shortcuts.
- Every safe AI revision now also records its source board, including chained revisions created by later repair turns. An applied response offers a guarded two-click discard action: it removes the revision scene, relinks descendants to the nearest surviving source, and returns the designer to the source when the discarded board was active. Legacy workspaces migrate without inventing links, invalid/self links are sanitized, and current-board replacements remain undo-only rather than exposing a destructive discard.
- Every complete AI whiteboard proposal now offers a direct Build Demo action. It creates or reopens that proposal's safe linked version, exports its rendered PNG and exact graph, adds detected engine, framework, package-manager, start, build, and output constraints, selects the real Build agent, and immediately starts the implementation task. Incomplete stopped drafts and proposals shown while another task is running cannot start a build.
- A whiteboard Build Demo request now stays linked to its task lifecycle instead of disappearing when the canvas closes. KM Agent tracks queued, running, and ended states; when the turn returns idle it shows a persistent action and a title-bar readiness dot that open Demo Preview, where project detection and port scanning can immediately continue the playable validation loop. Switching tasks does not falsely complete the handoff, and opening Preview clears the readiness state.
- AI whiteboard proposals now include a Codex-style pre-apply review against the current scene. Designers see added and removed nodes, links, and notes plus game-flow checks for starts, ends, branches, loops, disconnected or unreachable content, incomplete decisions, accidental dead ends, and failures without retry exits. The comparison baseline is captured before automatic or manual application, so the review remains meaningful after a safe revision is created.
- Proposal review now catches game-design decisions whose multiple exits have missing or duplicate player-facing conditions. When any flow risk is present, one action opens or creates that proposal's linked safe version, composes a bounded repair request from the exact findings, and returns it to the live whiteboard copilot so the designer can iterate without copying diagnostics or losing the proposal context.
- Whiteboard AI co-editing can now target either the complete board or the designer's current Excalidraw selection. Focused edits send a cropped selection image together with both the complete graph and relationship-aware selected subgraph, while the model is explicitly required to preserve everything outside the selection and return a complete safe revision. The selection mode stays unavailable until the canvas has an active selection.
- Any structured whiteboard can run as an interactive flow playtest before code exists. Designers click real outgoing arrows, exercise alternate starts, branches, endpoints, retries, and cycles, step backward or restart, and keep a bounded path history. One action sends the board image, exact graph, clicked transitions, remaining choices, endpoint or loop evidence, and the actual trace to the restricted Plan agent for reproducible design review.
- Home tasks expose Codex-style All, Running, Needs input, and Unread filters backed by live session state.
- A project-scoped Demo Preview opens local web games inside the workspace with URL validation, refresh, external-open, and remembered addresses.
- Demo Preview scans common local development ports, surfaces reachable games, and can launch the configured project start command in a dedicated PTY before connecting.
- The desktop preview captures the actual rendered game frame, attaches it to the current AI task, and seeds a game-design review focused on playability, level readability, feedback, guidance, and completion conditions.
- Playtest frames persist per project in a bounded local history; designers can select two iterations and send them to AI in chronological order for improvement and regression analysis.
- Each playtest frame supports designer notes and focused issue tags for guidance, puzzle logic, interaction feedback, pacing, visual hierarchy, and bugs; annotations are included in AI comparison requests without replacing existing user instructions.
- Each frame also carries six structured acceptance checks—launch, controls, goal clarity, feedback, retry, and completion—with pass/fix outcomes. Designers can save them locally or send one annotated frame directly to AI, and the results travel with iteration comparisons.
- Projects can define reusable, versioned acceptance plans across the same six areas. Custom success criteria persist across tasks and sandboxes, appear beside every frame check, and are automatically included in initial capture reviews and iteration comparisons.
- Projects can also save up to eight reusable playtest scenarios with a name, ordered test steps, and expected result. The selected scenario is snapshotted onto each new frame so historical reviews remain accurate after the project scenario changes, and AI receives the full flow during capture and comparison.
- A completed whiteboard flow playtest can be saved directly as a project-scoped Demo Preview scenario. The generated scenario preserves the actual clicked branches, retries, endpoint or remaining choices, and loop/soft-lock expectations; saving again from the same board updates its stable scenario instead of creating duplicates.
- Demo Preview now runs a selected scenario as a guided playtest over the live game. Designers mark every step as passed or problematic, assess the expected outcome, add reproduction notes, reset the run, and submit a completed desktop capture to AI; each bounded result stays attached to the historical frame and is rendered in the offline report for iteration review.
- Playtest history exports as a self-contained HTML review report with embedded screenshots, chronological iterations, acceptance coverage, scenario steps, expected results, issue tags, and designer notes. Reports open offline, print cleanly, work from both Web and Electron, and omit the local project path.
- Projects can save up to four reusable build targets with a command and project-contained output directory. Existing tasks run the selected build in a dedicated Game Build terminal, report the real PTY exit result, and let desktop users reveal successful output without leaving Demo Preview.
- Demo Preview inspects root project markers and bounded manifest content to recognize Godot, Unity, Bevy, Phaser, PixiJS, Three.js, Next.js, Vite, generic package projects, and static web demos. It derives package-manager-aware start/build commands, exposes high-confidence recommendations without overwriting custom targets, and explains engine-specific setup gaps instead of inventing unusable commands.
- Detected project profiles now drive the AI workflow instead of remaining informational: designers can add a stack-aware playable vertical-slice request from Demo Preview in one click, and whiteboard handoff combines exact scene structure with engine/framework, package-manager, start, build, and output constraints. Both paths preserve existing designer instructions and work in new or active tasks.

## Next milestones

1. Game design workbench: reusable templates for level flow, puzzle dependency graphs, combat loops, and narrative beats.
2. Codex-style task navigation: add status counts, sorting, archive management, and cross-project attention views.
3. Composer polish: mode switch, model selector, attachments, approval policy, and workspace selector in one consistent footer.
4. Activity presentation: compact tool calls, patch summaries, terminal output, approvals, and progress indicators.
5. Playable preview loop: support engine-based demos and hosted report sharing.
6. Distribution: macOS development package first, followed by Windows and Linux builds.

## Local development

The upstream workspace currently pins Bun 1.3.14.

```sh
bun install
```

Run the backend from `packages/opencode`:

```sh
bun run --conditions=browser ./src/index.ts serve --port 4096
```

Run the renderer from `packages/app`:

```sh
bun dev -- --port 4444
```

Open `http://localhost:4444`. The Electron shell can be started later with `bun run dev:desktop` from the repository root.
