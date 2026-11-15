# AdrRoom

AdrRoom is an interactive 3D portfolio experience built around a modeled room. Look around the scene, then open the monitor to explore the portfolio.

## Features

- Interactive 3D room with constrained camera controls
- Parallax panorama viewed through the window
- Animated camera transition into the monitor
- AdrRoom project showcase embedded on the monitor
- English and Spanish interface
- Reduced-motion support and a static preview fallback

## Tech stack

- Astro 6
- React 19
- Three.js with React Three Fiber and Drei
- GSAP
- TypeScript

## Requirements

- Node.js `>=22.12.0` (see `.nvmrc`)
- npm

## Run locally

```sh
npm ci
npm run dev
```

Astro prints the local development URL in the terminal.

## Validation

```sh
npm run type-check
npm run lint
npm run build
```

## Room model

`public/models/room.glb` is the optimized runtime model and is intentionally tracked because the web experience loads it directly.

The editable Blender source and original panorama are authoring files, not runtime dependencies. Keep local copies in the ignored `models/` directory; do not commit `.blend` files, Blender backups, or `captures/`. To regenerate the runtime model, open the Blender source and run:

```sh
blender --background models/AdrRoom_Office.blend --python scripts/export-room.py
```

Place the source panorama next to the `.blend` file before exporting. The script writes the result to `public/models/room.glb`.

## License

Add the project's license before redistributing the source or bundled assets.
