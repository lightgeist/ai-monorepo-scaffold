# How AtlasShorts works

The React/Vite dashboard calls FastAPI in `app.py`. Jobs run in the Python pipeline. Scene boundaries and timed words provide candidate clip ranges; Gemini or an OpenAI-compatible local text backend scores/selects moments. Face/speaker tracking and layout modules perform reframing. FFmpeg, subtitles and hooks produce clips.

```text
Browser ─REST──┐
CLI ─────REST─┼── FastAPI / job state ── Python + FFmpeg ── output files
Agent ───MCP──┘          │                        │
                  provider APIs          optional S3 / publishing
                         │
                 optional Node/Remotion renderer
```

Important modules: `scene_detection.py`, `transcribe_backends.py`, `llm_backend.py`, `gemini_worker.py`, `layout_picker.py`, `active_speaker.py`, reframe/layout modules, `subtitles.py`, `hooks.py`, `editor.py`. A local text LLM selects moments; it does not itself render video or replace visual Gemini analysis.

`saasshorts.py` implements AI-presenter/product workflows using separate image/video/speech services. `thumbnail.py` implements YouTube title/thumbnail tools. Upload-Post handles configured social accounts and publishing. The Remotion components provide editor previews; the optional Node service performs server rendering.

For Atlas, treat this as a **media worker**, not a replacement orchestrator: submit one bounded job, persist its id, poll or receive a signed webhook, inspect returned artifacts, then require approval before publishing. No actual Atlas Flow backend integration is included.

## Locality

Local ASR and text selection can keep that portion local. Selected Gemini, fal.ai, ElevenLabs, Upload-Post, S3, URL-download and upload-handoff operations still contact services. MCP `create_upload` may return a public temporary-host handoff: do not use it for private material without explicit authorization. Prefer dashboard local upload for private ingestion.

## Fork delta

Identity, packages, CLI/MCP naming, environment/storage namespace, marks, metadata and operator docs are Atlas-branded. Runtime defaults point to localhost. Upload-Post no longer blocks clipping setup. Hosted marketing and analytics loading are removed. CORS origins are explicit and Docker ports loopback-only. Core clipping/rendering algorithms and API semantics otherwise remain upstream-derived. Original notices remain intact.
