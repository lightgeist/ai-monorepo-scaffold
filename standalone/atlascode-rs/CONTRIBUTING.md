# Contributing

Use a feature branch; preserve the upstream attribution and narrow rebrand scope.
See AGENTS.md and docs/src/development.md for build setup. Run:

```sh
npm ci --prefix agent-sdk
npm --prefix agent-sdk test
cargo fmt --all -- --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets
python3 tools/verify-brand.py
```

The fork release pipeline also builds native binaries, verifies package layouts,
runs installers in isolated temporary homes and executes archive runtime contracts.
Keep actual evidence distinct from intended tests. Never put private credentials,
provider session files or unredacted user logs in a pull request or release archive.

Do not publish the private npm artifacts or enable in-app updates without a
separate reviewed release-channel and namespace-ownership decision.
