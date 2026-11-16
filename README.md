# AdrRoom

AdrRoom is a room-first interactive portfolio. Explore the 3D scene, then open the desktop shown on the room's monitor to browse projects, profile information, and contact tools.

## Features

- 3D room with constrained orbit controls, animated camera focus, and window panorama parallax
- Interactive portfolio desktop embedded in the monitor, with project details, repository browsing, CV, contact, and chat tools
- English and Spanish interface
- Responsive layout, reduced-motion support, loading and WebGL fallback states
- Astro actions and Supabase Edge Function sources for contact and AI chat

## Stack

Astro 6, React 19, TypeScript, Three.js / React Three Fiber, GSAP, Tailwind CSS, MDX, Supabase, and Deno Edge Functions.

## Run locally

Requirements: Node.js 24 (see `.nvmrc`), npm, and Deno 2.9.8 for Edge Function checks.

```sh
npm ci
npm run dev
```

## Validate

```sh
npm run lint
npm run type-check:ci
npm run type-check:scripts
npm test
npm run build:ci
```

For the Supabase chat function:

```sh
cd supabase/functions
deno task check
deno task test
```

## Deploy

Import this repository into Vercel and keep the project root at the repository root. Use Node.js 24 and `npm run build` as the build command.

Set these public Supabase values in the Vercel project before building if the contact form and chat should be active. `.env.example` documents the supported names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

The anon key is intended for browser use; protect the database with the included RLS policies. Never put a Supabase service-role key or AI-provider key in Vercel's public variables or in Git. Configure `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `GROQ_API_KEY` as Supabase Edge Function secrets. Apply the migrations and deploy the `chat` function separately in Supabase; hosting this repository does not deploy the database or Edge Function.

`npm run build:ci` deliberately uses fake loopback configuration and is only for validation. Deploy with `npm run build` and the real project environment configured in the host.

## Blender source

`public/models/room.glb` is the runtime asset and is intentionally committed. Keep editable `.blend` files, Blender backups, and the original panorama in the ignored root `models/` directory. `captures/` is also ignored.

To regenerate the detailed runtime model, place `AdrRoom_Office.blend` and `MalagaTardePanoramica.png` in `models/`, then run:

```sh
blender --background models/AdrRoom_Office.blend --python scripts/author-robot-projection.py
node scripts/create-room-atlas.mjs
blender --background models/AdrRoom_Office_Projection.blend --python-exit-code 1 --python scripts/refine-room.py
blender --background models/AdrRoom_Office_Detailed.blend --python-exit-code 1 --python scripts/export-room.py
```

The authoring scripts create separate `AdrRoom_Office_Projection.blend` and `AdrRoom_Office_Detailed.blend` copies without overwriting either input. Run refinement from the projection copy, not its own output. It repairs the wall-cap clearance, retires the old monitor display layers, rebuilds the chair and plants, and details the desk and robot while preserving the runtime object names and mouth animation.

Refinement uses fixed random seeds, creates packed wood/upholstery textures under `models/textures/`, batches static details by material, and checks evaluated geometry for non-manifold edges, required nodes, wall-cap clearance and a 180,000-triangle budget. Its report is written to `captures/room-refinement-audit.json`.

The second pass runs `scripts/refine-room-environment.py` through the main generator. It rebuilds the bookcase with 55 bound books and four reserved decoration cells, validating depth, compartment fit, shelf contact and cross-object intersections **before** batching. It preserves all five window panes and 80 floor planks, repairing ten missing left-edge floor segments without changing support heights. It adds glazing profiles and seals, replaces alias-prone rug threads with texture detail, and refines the framed print, corkboard, continuous curtains and hollow lamp shade. An axial ray check rejects accidental disk caps across the shade opening.

The atlas generator uses the existing four project covers and local Málaga photograph; no external downloads or generated imagery are required. Exact-version Sharp produces `models/textures/room-prints.json` with pixel-space regions, a lossless PNG authoring atlas, and a quality-90 4:4:4 JPEG for export. The panorama likewise keeps its original PNG and uses a generated JPEG at runtime. Normal maps remain lossless, linear-data PNGs at up to 256px. Regenerate the atlas before refinement whenever its source images or layout change.

The chair sits to the left of the monitor's camera path and faces the screen diagonally. Refinement also validates its rug contact and clearance from the central monitor zoom corridor.

The exporter reads `models/textures/malaga-panorama.jpg` and validates `captures/room-candidate.glb` before replacing `public/models/room.glb`, including the `AN_Robot_Mouth_Projection` animation, environment audit, required detail groups and pane names, shared JPEG atlas, and limits of 180,000 triangles, 75 materials and 10 MB. The model contract tests check the exported binary, retired geometry, portable textures and budgets. The source project is not required to build or host the website.

The detailed asset contains 237 meshes, 46 materials and 167,126 triangles (9,013,104 bytes / 9.01 MB). The first furniture pass was 565 meshes, 61 materials, 141,858 triangles and 8.15 MB. The environment adds detail at a modest download cost; shared materials and batching lower the mesh count, while JPEG photographs reduce the initial environment build from 13.24 MB to 9.01 MB. Refresh `public/room-preview.png` from the browser without interface overlays whenever the model changes so the WebGL fallback stays current.

## License

No license has been specified yet. Add one before granting redistribution rights for the source or bundled assets.
