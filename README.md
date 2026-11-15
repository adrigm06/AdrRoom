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

To regenerate the runtime model, place `AdrRoom_Office.blend` and `MalagaTardePanoramica.png` in `models/`, open the Blender source, and run:

```sh
blender --background models/AdrRoom_Office.blend --python scripts/export-room.py
```

The exporter reads the panorama beside the `.blend` file and writes `public/models/room.glb`. The source project is not required to build or host the website.

## License

No license has been specified yet. Add one before granting redistribution rights for the source or bundled assets.
