# Start here — AtlasShorts 0.1.0-rc.1

## 1. Start locally

Requirements: Docker Engine/Desktop with Compose v2, internet for dependency/model downloads, and disk space for your footage and generated clips. CPU is the default; no speed guarantee is implied.

```sh
cd AtlasShorts-v0.1.0-rc.1
cp .env.example .env
docker compose up --build -d
docker compose logs -f backend
```

Open **http://localhost:5175**. API docs: **http://localhost:8000/docs**. Both published ports bind to 127.0.0.1. The ZIP is source plus build outputs, not a bundled Docker image. See VALIDATION.md for whether container execution was tested.

Compose uses `atlasshorts_uploads`, `atlasshorts_output`, and `atlasshorts_model_cache` named volumes. `docker compose down` preserves them. **`docker compose down -v` deletes them.** Back up before upgrades.

## 2. Choose a clipping provider

Enter a Gemini key in Settings, or configure `.env`:

```ini
LLM_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL=YOUR_INSTALLED_MODEL
```

The endpoint must serve an OpenAI-compatible text API. It replaces text moment selection, not all visual analysis. Use an explicit layout when visual Gemini analysis is unavailable. On Linux, allow the model server to receive connections from Docker's bridge without exposing it publicly. Recreate the backend after changing environment configuration.

Upload-Post is only needed for publishing. AI Shorts separately requires configured provider accounts, including fal.ai and ElevenLabs for the relevant steps. No API credits or service accounts are supplied.

## 3. Test a short video

Upload footage you own or have permission to use, choose the layout/output format, and process it. Review selected moments, framing and subtitle spelling before downloading. Start with a short input.

Defaults: one concurrent job, CPU Whisper small/int8, 24-hour retention, 25 GB output cap and 15 GB upload cap. These are storage limits, not a recommended machine specification.

## Optional NVIDIA GPU

Requires the NVIDIA driver and Container Toolkit on the host:

```sh
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
```

## Optional server renderer

```sh
docker compose --profile renderer up --build -d
```

The renderer is not directly exposed. Remotion licensing applies to dashboard components too, not just this optional server. Review Ultralytics/YOLO terms before building/distributing the backend commercially.

## Native development

Python 3.11 is the upstream Docker runtime target. This release uses Node 22. Install FFmpeg and OpenCV/fontconfig system libraries separately.

```sh
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
# Optional exact typography; verifies downloaded assets.
python scripts/fetch_fonts.py
cp .env.example .env
uvicorn app:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd dashboard
npm ci
VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5175
```

The source preview uses system font fallbacks until the explicit asset-fetch step. If `dashboard/dist` is present, it is the compiled app, not a mockup. It still needs the backend and same-origin proxy; do not open index.html with file://. A local preview can use `VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run preview -- --port 5175`.

## CLI

```sh
python -m pip install ./cli
atlasshorts --version
ATLASSHORTS_API_URL=http://localhost:8000 atlasshorts quota
atlasshorts --help
```

Or install the supplied wheel. The package has not been published to a public registry. Provider keys can live in backend environment settings or be forwarded from CLI environment variables.

## MCP / Atlas agents

HTTP endpoint: **http://localhost:8000/mcp**. Use a trusted local MCP-capable host. For stdio, run `.venv/bin/python /absolute/path/mcp_stdio.py` with the project as its working directory. Stdio starts its own backend lifespan; don't run independent workers against the same data directory.

A cloud-hosted client cannot reach your computer's localhost automatically. No connector is installed into this conversation. Atlas Flow integration is a proposed use of the worker API, not implemented platform wiring.

## Stop and rollback

`docker compose down` stops the stack. Back up named volumes and `.env` before changing versions. Browser state uses the `atlasshorts:` namespace; old-product credentials are not imported automatically. Existing upstream output directories are not migrated. Roll back code and images together.
