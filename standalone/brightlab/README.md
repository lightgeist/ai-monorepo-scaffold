# BrightLab

**Interactive science by BrightClass.** Open models, follow invisible flows and explore how things work.

BrightLab retains 11 interactive exhibits and their scripted tours: fusion reactor, rocket engine, turbopump, production line, electric pickup, drive unit, humanoid, black hole / wormhole, jet engine, Formula 1 car and drone. The hall connects them.

## Run the source

Use Node.js 22.12 or later. The verification runner uses Node 22.16.0.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`. Jump directly to an exhibit with `?ex=motor`, `?ex=drone`, `?ex=fusion` or `?ex=hall`.

## Run the prebuilt package

No npm install or API key is needed for the prebuilt web package:

```sh
node tools/serve.mjs
```

Open `http://127.0.0.1:4173/`. The server binds only to this computer. The source package needs `npm run build` first. Do not open index.html as a file URL: ES modules require an HTTP server.

## Build and host

```sh
npm run build
# For a subdirectory deployment:
BASE=/school/brightlab/ npm run build
```

Upload the contents of `dist/` to a static host. Share links retain the deployment directory and current exhibit. There is no assigned production domain, no backend, no analytics, no accounts and no runtime network API dependency. This is not an offline-cache PWA: offline use is through a local HTTP server or an already-loaded page.

## Run the evaluation suite

```sh
npm ci
npx playwright install --with-deps chromium
npm run eval
# Additional subpath verification:
BASE=/school/brightlab/ npx vite build --outDir dist-subpath
BASE=/school/brightlab/ node tools/verify.mjs dist dist-subpath
SUBPATH_DIST=dist-subpath npm run test:browser
```

The suite executes actual production code. It covers unit invariants, routing and input validation, negative gate controls, retained model hashes, source and bundle identity, every exhibit's UI controls, camera interaction, sharing, touch and phone layouts, no-JavaScript / no-WebGL fallbacks, and all 13 fixed-step tours. Browser reports and screenshots are written under `evidence/`. A rendering signal test rejects blank frames; it is not a proof of visual or scientific correctness.

The browser suite uses Chromium with software WebGL on Linux. It does not certify Safari, Firefox, Android interactive boards, sustained hardware frame rates, curriculum accuracy or learning outcomes. Native share-sheet UI is not automated; clipboard output is observed through an isolated test stub. No separate LLM reviewer is claimed.

## Record a tour

Install ffmpeg and the Playwright browser first, then start the dev server:

```sh
npm run record -- motor films/brightlab-motor.mp4 30 http://127.0.0.1:5173/
# Optional fifth argument limits a smoke clip to two seconds:
npm run record -- motor films/brightlab-smoke.mp4 15 http://127.0.0.1:5173/ 2
```

Tour IDs: `fusion`, `main` (rocket engine), `pump`, `line`, `car`, `motor`, `robot`, `hole`, `jet`, `f1`, `drone`, `hall`, `grand`.

## Identity and architecture

Product identity is in `src/brand.ts`; visual identity is in `public/wordmark.svg`, `public/favicon.svg`, `index.html` and `src/style.css`. `site` and `shortUrl` remain empty until a real host is assigned. Runtime inspection uses `window.__brightlab`; fixed-step recording uses `window.__brightlabRecorder` with `?fixed=1` or `?rec=1`.

The simulation, rendering and geometry remain procedural TypeScript + Three.js. This release is a rebrand and targeted robustness pass, not an Atlas / LMS integration, a new curriculum engine, or a library of additional school-science objects.

## Provenance and model limitations

Derived from [AirsupHQ/airsup-lab](https://github.com/AirsupHQ/airsup-lab), pinned to `e21864bda5a614ffae8d0a835518be8e2e571dce`. Original MIT copyright and product-name notices remain in [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), and the in-app credits page. All exhibits are simplified educational illustrations, not engineering data. Retained help panels describe assumptions and estimates. Brand replacement must not erase attribution or rename the real products being illustrated.

Original font assets are not redistributed. BrightLab uses local system fonts. Three.js license text is included with the runnable build. BrightLab modifications are MIT licensed.
