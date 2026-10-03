# n8n

Use HTTP requests against your authenticated private backend. POST /api/process, then
poll /api/status/{job_id} or verify its signed webhook. Keep a human approval step
before publishing. Hosted-account templates are not working Atlas templates and
are omitted. Consult the running backend /docs for current request schemas.
