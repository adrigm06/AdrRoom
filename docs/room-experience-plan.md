# AdrRoom experience plan

Deliver four independently reviewable improvements: discovery, career and skills,
time-based atmosphere, and a notebook explaining how AdrRoom was created.
Projects remain in AdrOS; the room adds context rather than duplicating them.

## Status and delivery gates

The user confirmed the current CV as the research source. Iteration 1 is
accepted; iteration 2 is authorized and begins after iteration 1 is delivered.

| Iteration | Scope | Status | Planned commit |
| --- | --- | --- | --- |
| 1 | First-visit discovery and interaction hints | Accepted | `feat(room): add first-visit discovery and interaction hints` |
| 2 | Career corkboard and skill library | Accepted | `feat(room): add career board and skill library` |
| 3 | Madrid-time lighting and panorama cycle | Pending; three photos required | `feat(room): add Madrid-time lighting and panorama cycle` |
| 4 | AdrRoom making-of notebook | Pending | `feat(room): add the AdrRoom making-of notebook` |

For **each iteration**, use this sequence:

1. Implement only that iteration, including tests, documentation and assets.
2. Run automated checks and browser QA; provide a focused manual checklist.
3. **Stop for the user to test manually.**
4. Address feedback and wait for explicit acceptance.
5. Commit the accepted work unit using its Conventional Commit message, then push.
6. **Do not start the next iteration without user confirmation.**

Manual testing is part of completion, not a reason to automatically proceed to
the next feature. Avoid a combined commit for all four iterations.

## Privacy and scope boundaries

- The CV is **private research input only**. The user explicitly prohibited
  uploading it.
- Do not add, force-add, push, publish, copy into `public/`, attach to an issue,
  or send the supplied CV to an external service.
- Do not ingest the document into AdrBOT/RAG or automatically replace the
  existing downloadable CV.
- Use only curated, relevant career and skill summaries for the proposed room
  content. Have the user review the public-facing copy in iteration 2.
- Do not reproduce the full CV, contact details, photo or unrelated personal
  information in this plan or the new room features.
- Keep the original AdrOS project read-only; work in `adrroom-publication`.
- Keep Recruiter Mode disabled.
- Preserve the diagonal chair, monitor approach, robot mouth animation, shared
  chat, existing focus/return interactions and original Blender source files.
- Preserve the guarded export pipeline and its current budgets: 180,000
  triangles, 75 materials and a 10 MB GLB. Budget changes require justification
  and user approval.

## Research baseline

| Finding | Consequence |
| --- | --- |
| The confirmed local CV differs from the older published CV | Do not merge conflicting claims or infer seniority; flag inconsistencies for content review |
| `focus-targets.ts` already declares a corkboard view | Reuse the focus system rather than adding a separate camera controller |
| The 55 books are batched by material | Use a few thematic interaction zones, not 55 separate selectable meshes |
| The floor lamp can obstruct the corkboard view | Validate the approach, final camera and interaction occlusion |
| `RoomExperience.tsx` contains fixed runtime lights; the exporter excludes Blender lights | Implement the atmosphere in the web scene, not only in Blender |
| Several fixtures share a warm emissive material | Separate or clone controlled materials to avoid changing every fixture at once |
| The panorama is currently embedded in the GLB | Move runtime panorama selection to external images without duplicating the room |
| The notebook already exists on the desk | Make the existing prop interactive rather than adding a duplicate |
| `captures/` and authoring assets are ignored/local | Copy only approved, optimized images to served assets; never link directly to local captures |
| The focus hook uses fixed animation durations | Add proper reduced-motion behavior when introducing discovery |

The original panorama is **2134 x 737**. Notebook position in Three.js coordinates
is approximately `[1.2, 0.86, -1.12]`; use the exported geometry to finalize its
interaction zone and camera.

## Iteration 1: first-visit discovery

### Outcome

A visitor understands what can be explored without a compulsory tutorial,
automatic camera tour or permanent pulsing markers.

### Experience

- Show a small, dismissible welcome only after the room is ready.
- Initially explain the two working entry points: the PC and AdrBOT.
- Add discreet labels on pointer hover and keyboard focus.
- Offer visible touch-accessible controls; never rely on hover alone.
- Remember welcome dismissal with a versioned key and offer an explicit Help
  action to reopen it.
- Add the new objects to discovery only when their iterations are delivered.
- Retain direct access to the portfolio.

### Implementation boundaries

- Reuse `useRoomFocus` and the existing room focus state.
- Centralize interaction identifiers, labels, actions and target metadata without
  building a general-purpose interaction framework.
- Distinguish a deliberate activation from an orbit drag.
- Do not enable actions before model readiness or show the welcome over an error
  or loading state.
- Handle blocked/unavailable storage gracefully.
- Respect reduced motion in camera focus and return transitions.
- Preserve Escape, the Back button and outside-click return.
- Keep new copy in the existing Spanish/English language system.

### Acceptance and manual test

- [ ] A fresh visit shows the welcome after loading, not before.
- [ ] A returning visit respects dismissal; Help reopens it.
- [ ] Keyboard focus is visible and both entry points are usable.
- [ ] Touch users can discover actions without hover.
- [ ] Orbit dragging does not accidentally activate an object.
- [ ] PC and robot focus/return still work.
- [ ] Reduced motion, slow loading, storage denial and model failure are handled.

**Stop for manual acceptance, then commit and push iteration 1.**

## Iteration 2: career corkboard and skill library

### Outcome

The corkboard tells a concise personal trajectory; the library explains practical
skills. Neither becomes another project gallery or a disguised recruiter tour.

### Corkboard: "My journey"

Use four short physical notes, with accessible detail when focused:

| Note | Proposed editorial focus |
| --- | --- |
| Foundations | SMR, DAM and Spring training |
| Backend in a real environment | Rewire, Java/Spring Boot, shared services and financial security |
| Building solutions | Independent development, integrations and automation |
| Precision and quality | DHV Technology and work with aerospace components |

Use the confirmed CV for facts and dates during implementation. Do not pad the
timeline, invent outcomes or recast aerospace work as professional AI experience.
If using an estimated result, preserve the qualification instead of presenting it
as an audited metric. The user must approve the final public copy.

Replace the existing project photographs with the new notes. Keep the physical
board restrained; use HTML for detailed reading instead of tiny texture text.

### Library: five practical themes

1. **AI and agents:** LLMs, RAG, MCP and tools.
2. **Automation:** n8n, APIs, webhooks and workflows.
3. **Backend and data:** Java, Spring Boot, Python/FastAPI and databases.
4. **Mobile development:** Kotlin, Android and practical app work.
5. **Delivery and quality:** Git, Docker, CI/CD and engineering practices.

Each theme explains what the user does with the tools, the context in which they
were used, and whether the evidence is professional work, a project or exploration.
Do not use proficiency percentages or unsupported expert labels.

### Implementation boundaries

- Add typed, localized room content separate from rendering code.
- Regenerate the corkboard atlas and deterministic model where needed.
- Preserve batching and use generous, visible thematic hit zones.
- Reuse the shared camera flow and validate the corkboard against lamp occlusion.
- Provide semantic reading panels and focus restoration on close.
- Generalize panel interaction protection beyond the current monitor/hologram
  selectors so clicks inside new content do not trigger return.
- Review discrepancies with the downloadable CV, but do not upload or replace
  the supplied private CV.

### Acceptance and manual test

- [ ] The user approves dates, names, claims and the five skill summaries.
- [ ] The board complements AdrOS instead of repeating its project gallery.
- [ ] Board and library are legible on desktop and mobile.
- [ ] Keyboard, touch, focus restoration and outside-click behavior work.
- [ ] Cameras and hit zones respect real occlusion and do not cross furniture.
- [ ] Model budgets and existing monitor/robot contracts still pass.
- [ ] No private CV file or unnecessary personal information enters the changeset.

**Stop for manual acceptance, then commit and push iteration 2.**

## Iteration 3: Madrid-time atmosphere

### Required photographs

The user will provide these local authoring files:

```text
models/panoramas/malaga-day.png
models/panoramas/malaga-afternoon.png
models/panoramas/malaga-night.png
```

Use the same camera, framing, horizon and aspect ratio for all three. Prefer
**2134 x 737**, matching the original. Do not include a window frame in the
photograph; the frame already exists in the model.

Generate optimized web assets under `public/panoramas/`, retaining the local
originals. The framed wall photograph remains a static print; it should not
change merely because the window view changes.

### Automatic schedule

Use **`Europe/Madrid`**, the time zone for Malaga and mainland Spain, independent
of the visitor's browser time zone. Do not hardcode UTC+1 or UTC+2.

| Scene | Proposed local time |
| --- | --- |
| Day | 08:00 to 17:00 |
| Afternoon | 17:00 to 21:00 |
| Night | 21:00 to 08:00 |

These configurable slots are an artistic clock-based schedule, **not an
astronomical sunrise/sunset simulation**. The time zone handles seasonal clock
changes. The device clock remains the time reference; no geolocation or external
time/weather API is required.

- Evaluate on entry, periodically and on visibility/resume.
- Add a discreet Automatic / Day / Afternoon / Night selector for manual review.
- Returning to Automatic recomputes the current mainland-Spain scene.

### Lighting direction

| Scene | Exterior light | Interior lighting |
| --- | --- | --- |
| Day | Neutral daylight and readable, open interior | Subdued decorative fixtures |
| Afternoon | Warm exterior light with soft contrast | Lamp and accents become more present |
| Night | Cool, low exterior contribution | Warm lamp, shelf and desk lighting preserve readability |

Control real runtime lights and fixture emission together. A bright-looking
emissive bulb does not replace illumination of neighboring surfaces. Separate
fixture controls from the shared material cache.

Start with a small, motivated light rig. Avoid fog, costly post-processing and
multiple dynamic shadow maps until performance justifies them.

### Textures and transitions

- Keep one GLB, the existing panorama geometry, UV mapping and depth mask.
- Load scene photos externally rather than embedding three complete rooms.
- Decode the next image before switching; keep the previous image if loading fails.
- Blend on the panorama surface without coplanar overlapping planes.
- Coordinate image transition, light color/intensity and emission.
- Respect texture color spaces and reduced motion.
- Do not eagerly download all three full-resolution photographs on entry.
- Preserve monitor readability, robot hover colors and the blue hologram.

### Acceptance and manual test

- [ ] All three user-supplied photos align with the same horizon and window.
- [ ] The manual selector previews every scene and returns correctly to Automatic.
- [ ] Tests cover 08:00, 17:00, 21:00, midnight and seasonal clock changes.
- [ ] A foreign browser time zone still uses the mainland-Spain schedule.
- [ ] Resume from a hidden tab updates stale scene state.
- [ ] Missing or slow photos do not produce a black flash or reset the room.
- [ ] Board, books, PC and robot remain legible at night.
- [ ] Mobile behavior and resource usage are reviewed.

**Stop for manual acceptance, then commit and push iteration 3.**

## Iteration 4: the AdrRoom making-of notebook

### Outcome

The existing desk notebook explains the real development process with evidence,
not just a technology list.

### Editorial sequence

1. **The idea:** a personal spatial portfolio with a working AdrOS desktop.
2. **The visual reference:** distinguish the initial reference from the built model.
3. **The first room:** early layout, objects and limitations.
4. **Refinement:** furniture, plants, materials, intersection repairs and diagonal chair.
5. **From Blender to the browser:** source copies, GLB export and runtime integration.
6. **AdrOS and the robot:** camera focus, hologram and shared conversation.
7. **What needed fixing:** floor coverage, shade opening, camera clearance and texture payload.

Explain user decisions, AI-assisted work and tools accurately. Do not claim a
specific creation method for the reference image unless its provenance is confirmed.

### Existing visual evidence

These are local sources, not public URLs:

| Source relative to the workspace root | Intended use |
| --- | --- |
| `captures/Room.png` | Visual reference collage, explicitly labeled as a reference |
| `captures/Captura de pantalla 2026-11-15 161536.png` | Earlier room/model view |
| `captures/Captura de pantalla 2026-11-16 173121.png` | Later refined room view |
| Selected `adrroom-publication/captures/` images | Detail and QA evidence, selected during implementation |

Copy only approved images into an optimized, served asset directory. Do not link
directly to ignored local captures. Check screenshots for private information
before publication.

### Experience and implementation

- Make the existing notebook and cover selectable.
- Use the shared camera approach and a semantic, readable editorial panel.
- Provide straightforward page/section navigation with captions.
- Use one column on mobile.
- Show before/after images side by side or as alternate views. Do not use a
  comparison slider for images captured from different camera positions.
- Lazy-load notebook images on opening; do not add all of them to initial room loading.
- Preserve Escape, outside-click return, focus restoration and reduced motion.

### Acceptance and manual test

- [ ] The user approves the narrative and reference/model labels.
- [ ] Captions match the actual images and development history.
- [ ] Text, images and navigation are usable on desktop and mobile.
- [ ] Closing restores the prior camera and keyboard focus.
- [ ] Notebook imagery is not downloaded eagerly with the room.
- [ ] No private source documents or accidental screenshot disclosures are published.

**Stop for manual acceptance, then commit and push iteration 4.**

## Verification and rollback

For every implementation iteration:

- Run focused tests for new state, content, hit targets or schedule logic.
- Run the existing room model, focus and projection regression tests.
- Run lint, type checks and the CI build before acceptance.
- Capture desktop/mobile browser evidence and record exact test results.
- Rebuild and validate the model only when authoring changes are required.
- Refresh the fallback preview when the visible room changes.
- Keep the iteration's code, tests, documentation and generated runtime assets
  together so its commit can be reverted without removing unrelated work.

Iteration 1 verification:

- Focused room regression and discovery tests: `npm test -- --run
  tests/room-discovery.test.ts tests/room-focus.test.ts
  tests/room-projection.test.ts tests/room-model.test.ts`.
- Full automated checks: `npm test`, `npm run lint`,
  `npm run type-check:ci` and `npm run build:ci`.
- Browser harness: `http://127.0.0.1:4321/`. The available browser could not
  create a WebGL scene, so it rendered the existing fallback; verified that the
  welcome and room actions stay hidden on that failure path. Scene interaction
  QA still requires a browser with WebGL and the user's manual acceptance.
- Rollback boundary: remove the iteration 1 changes in
  `src/components/room/RoomExperience.tsx`, `RoomModel.tsx`, `RoomMonitor.tsx`,
  `RoomScene.tsx`, `RoomStatus.tsx`, `room-discovery.ts`, `useRoomFocus.ts`,
  `room.css`, and `tests/room-discovery.test.ts`; revert the iteration 1 status
  and verification text in this plan.

## Technical references

- Existing implementation: `src/components/room/`, `scripts/refine-room*.py`,
  `scripts/create-room-atlas.mjs`, `scripts/export-room.py`.
- [React Three Fiber events and occlusion](https://r3f.docs.pmnd.rs/api/events)
- [Three.js color management](https://threejs.org/manual/en/color-management.html)
- [Intl.DateTimeFormat and explicit time zones](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

## Next action

Iteration 1 was accepted when the user requested continuation. Deliver it as a
separate work unit, then implement iteration 2. Stop after iteration 2's
automated checks and browser QA for manual testing and public-copy review.
