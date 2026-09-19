# Reproduce qualification

Run from a clean source checkout with supported Node.js and the pinned pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test:smoke
pnpm test:byok
pnpm test:capabilities
pnpm test:policy
pnpm test:sandbox
pnpm test:status-contract
pnpm test:artifact
node scripts/package-atlascode.mjs
```

Additional rebrand-specific gates validate source and package identity, immutable vendor hashes, help/version, profile naming, theme contrast, responsive wordmarks, and compatibility. Test counts and skipped cases belong to the result files from the exact run, not a hard-coded marketing claim.

`release/qualification/terminal-driver.cjs` launches the actual CLI using node-pty and interprets its output with @xterm/headless. It captures real text, ANSI and styled frames, including resize and keyboard actions. HTML frames are evidence renderings, not an alternate application UI.

The live assistant relay is a real loopback HTTP transport connected to actual runtime tool execution. Its responses are written only after inspecting each request. It is separate from the deterministic fixture provider. Reproducing live qualification requires an actual assistant/operator or real authorized provider. A canned transport must never be labelled as model qualification.

Clean install uses the produced npm tarball in a fresh npm prefix and separate HOME/profile. Per-platform native and hosted-service limitations must remain visible in the release gate.
