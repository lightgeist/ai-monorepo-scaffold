# Upstream provenance

AtlasCode v0.1.0 by Deep Intuition is derived from the public MiniMax Code source:

- Repository: https://github.com/MiniMax-AI/minimax-code
- Pinned public commit: `e3724a13d72d61c9bdc68a1a72b5c020f065ba26`
- Source product version at that commit: `0.4.12`
- AtlasCode release version: `0.1.0`

The rebrand does not claim that Deep Intuition authored the upstream application, Pi, or other dependencies. Original copyright/license notices remain in LICENSE, NOTICE, dependency notices and vendored source.

All 886 files under the delivered upstream `third_party` tree are checked against the original SHA-256 manifest. Pi is not modified. First-party changes are constrained to identity, theme, package/distribution boundaries, legacy compatibility and regression repairs needed by the rename. No Atlas Brain, Atlas Flow, new agent loop or new agent capabilities are added.

The upstream embedded helper archive has its own pinned SHA-512 and source CLI SHA-256. The build verifies those bytes, then applies a product identity transform and records the new helper digest. External provider URLs, registered OAuth IDs and wire semantics are not relabelled as Deep Intuition services.
