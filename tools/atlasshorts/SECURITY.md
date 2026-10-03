# Security and privacy boundary

This release is a trusted, single-operator local workspace, **not an authenticated SaaS**. Do not change loopback port bindings or publish a tunnel without adding and validating authentication, authorization, TLS and request controls. CORS is not authentication. Multi-tenant/public hosting is untested.

Keys entered in Settings persist in namespaced browser storage; obfuscation is not encryption. Use a trusted browser profile. Never commit `.env`, private footage or secrets. Clear browser credentials on shared machines.

Chosen features may send video, transcript or prompt data to Gemini, fal.ai, ElevenLabs, Upload-Post, S3 or an external temporary upload host. Agents must obtain explicit permission before external upload handoffs, publishing, scheduling, voice cloning or likeness generation. An available tool is not authorization. A public gallery/bucket is public by design.

Default retention is 24 hours plus disk caps, not archival storage. Export results promptly or deliberately reconfigure retention. No provider calls or social posts are performed by installation.

The commercial cloud layer is absent. `BILLING_ENABLED=1` fails clearly instead of enabling or bypassing that software. This release does not claim a complete vulnerability audit, enterprise security certification or commercial-license clearance.
