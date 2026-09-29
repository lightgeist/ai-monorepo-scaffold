# brightmath 1.0.0

A local-first browser arithmetic game. **Japanese edition**: the original 58-skill, grades 1–6 curriculum and Japanese teaching language are retained. This is an independent rebrand, not an English localization, India curriculum certification, or AI tutor.

## Open it

The release contains **brightmath.html**. Extract the ZIP, then open that file in a current desktop browser. It contains the complete application, artwork and license notices; no installation, account or network connection is needed to play. The original modular source cannot be opened using file://; use the bundled standalone file instead.

For stable saved progress, serve `site/` from a static website. Browser storage for local file URLs varies by browser and file location; moving the HTML can make previous progress unavailable. Private browsing or blocked storage can also prevent saving. The app remains playable when storage is unavailable. No synchronization or backup service is provided.

From source: `npm ci`, `npm run build`, then `npm start`. Open http://127.0.0.1:4173. Node.js 22 is used for development/testing; runtime browsers need no Node.js. `python3 -m http.server 8000 -d app` also serves the modular source locally.

## What stays

58 arithmetic skills; personalized placement/mastery, grade practice, review, skill tree, calendar, daily quests, trophies, deterministic earned rewards, extra rounds, keyboard/touch keypad, synthesized sound and motion controls. No math algorithm or scoring rule is rewritten for the rebrand.

## What changes

Original brightmath wordmark and four mathematical tiles replace the excluded upstream name/logo/mascot. Mathematical badges replace costume artwork, while stable reward IDs and progress rules stay intact. Settings and progress use `brightmath:v1`; they do not migrate, modify or erase dopa-drill or other apps' records. Font binaries are replaced by system fonts. Pinch/browser zoom is no longer disabled. A local About dialog includes all required notices. No AI API, telemetry, ads, account system, remote font, or external runtime library is added.

## Deployment

Copy the contents of `dist/site/` to a static host. The supplied `_headers` is suitable for hosts that implement that format; configure equivalent headers elsewhere. No build command is needed for the shipped site. Do not apply the modular site's `script-src 'self'` header to the inline standalone HTML without adding a matching script hash. No production URL or domain has been invented.

## Tests and evidence

`npm test` executes the inherited suite and new rebrand checks. `npm run test:browser` exercises Chromium, Firefox and WebKit engines plus phone-sized layouts. The fixture query `?inspect` enables diagnostic observation; automated user journeys read state to choose known inputs but use actual keyboard/pointer controls to answer. Ordinary launch exposes no debug state. This is not an authenticated agent-control API.

The release report records the exact counts and environments. Browser emulation is not a claim of testing a physical iPhone, Safari app, audio quality by ear, all assistive technologies, or educational effectiveness. Mathematical and practice functions are not medical treatment claims.

## Provenance

Based on grmchn/dopa-drill at fdacd5fc8322f251f92ddc07f13ae85ccb2263dd. Copyright (c) 2026 gear_machine; see LICENSE and NOTICE.md. Unofficial and independent. Original restricted artwork and font binaries are deliberately omitted, including from delivery history. A pinned upstream reference, retained-module hashes, change inventory and replay recipe replace a Git bundle that would redistribute excluded assets.
