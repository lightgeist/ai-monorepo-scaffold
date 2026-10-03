# AtlasShorts

**0.1.0-rc.1 · by Deep Intuition · self-hosted video workspace**

A deep rebrand of the OpenShorts MIT core, preserving the actual video engine and editor rather than replacing them with a mockup. The release includes the Python backend, React dashboard, optional Node renderer, CLI, MCP interface and agent instructions.

```text
Upload / video URL
       │
       ▼
FastAPI job queue → transcript + scene boundaries
       │
       ▼
Gemini or local text LLM → selected candidate moments
       │
       ▼
Face tracking / layout → captions / hook / FFmpeg
       │
       ▼
Review → download → optional authorized publishing
```

## Start

```sh
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:5175`. Enter a Gemini key in Settings or configure a local OpenAI-compatible text endpoint on the backend. Upload-Post is optional; clipping does not require a publishing account. Read **START-HERE.md** before use.

## What's preserved

The clip generator, caption editor, reframing/layouts, AI-presenter workflow, YouTube titles/thumbnails, REST API and MCP tools. Paid AI-presenter and publishing workflows require your own service accounts and credits. This release is not a local generative-video model or an automatically installed ChatGPT connector.

## Distribution boundary

Pinned upstream: `06a119c280e545bc3f55f2b7b036d4c187630d50` (1 October 2026). Root LICENSE is byte-preserved and NOTICE retains upstream authorship. The separately licensed **cloud/** layer is excluded, not relabeled. Hosted accounts, subscriptions, managed credits and cloud autopilot are not offered. No hosted AtlasShorts domain or package-registry publication is implied.

This is a trusted single-operator workspace, not an authenticated public SaaS. Compose publishes only loopback ports. Browser Settings are not encrypted secret storage. Default job retention is 24 hours with disk caps; download results promptly or configure retention deliberately.

Read **THIRD-PARTY-NOTICES.md** before commercial rollout. Ultralytics/YOLO and Remotion have their own licenses; excluding cloud does not clear these dependencies. No model weights, font binaries, node_modules, virtual environments or credentials are distributed. Optional typography assets can be retrieved through a hash-verified fetcher.

**VALIDATION.md** and **validation/** distinguish actual tests, exclusions, failures, and untested live-service paths. This RC is for local evaluation, not production qualification.
