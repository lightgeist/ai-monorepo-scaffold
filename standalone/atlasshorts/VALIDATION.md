# Validation — AtlasShorts 0.1.0-rc.1

This report is generated from the actual run, not a planned test list.

| Check | Result |
|---|---|
| distribution_integrity | passed |
| browser_storage_isolation | passed |
| upstream_core_regression | passed |
| post_test_distribution_integrity | passed |
| live_app_api_and_mcp | passed |
| stdio_mcp | passed |
| real_ffmpeg_caption_render | passed |
| cli_smoke | passed |
| desktop_mobile_browser | passed |

Python core regression: **746 passed, 15 skipped, 0 failed, 0 errors** (761 collected).

The 27 test files tied to the excluded commercial cloud layer are not collected. Existing upstream conditional skip reasons are recorded in `validation/regression-summary.json`. The regression suite uses temporary hash-verified font fixtures; those files are removed before packaging. Browser screenshots use system fallbacks.

Full details and logs are under `validation/`. A green build does not imply a tested AI-provider pipeline.

## Not tested

Live Gemini/local-LLM moment selection; ASR or face-tracking inference with downloaded model weights; paid fal.ai/ElevenLabs video generation; real publishing/scheduling; GPU operation; full Docker image execution; public or multi-user deployment; dependency-vulnerability and commercial-license clearance. The sample video is a synthetic FFmpeg fixture, not an AI-generated customer video.

Frontend and renderer build logs are included separately by the release workflow.
