---
name: atlasshorts
description: Process and review video clips through a trusted AtlasShorts backend; publish only with explicit authorization.
---

# AtlasShorts agent contract

Read START-HERE.md, SECURITY.md and VALIDATION.md. This is a standalone media worker, not a new Atlas orchestration framework.

Confirm footage rights. Use the operator's trusted backend, default `http://localhost:8000/mcp`; do not invent a hosted Atlas domain. Discover tools or the API schema. Typical tools include process_video, get_job_status, list_clips, add_subtitles, recut_clip and publish_clip.

Submit one bounded job; persist its id. Poll with backoff or verify the completion webhook. Preserve failure evidence and do not blindly repeat paid work. Inspect captions, framing and actual rendered output before publication.

MCP create_upload can describe an external temporary-host handoff. Never send private footage through it without explicit consent. Prefer dashboard local upload for private ingestion. Publishing, scheduling, cloned voices and real-person likeness generation require specific approval.

A local text LLM replaces moment selection, not all visual/speech provider operations. Missing optional credentials should disable their own feature, not unrelated clipping. Do not enable cloud mode, invent production readiness, or claim this package has automatically registered a connector in the current conversation.

Preserve core API/pipeline semantics, original copyright notices, source pins and release checksums. Source changes need tests; fixture success is not a paid-provider end-to-end test.
