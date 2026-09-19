# AtlasCode release process

1. Start from the pinned, reviewed source. Keep original license notices and the vendor manifest.
2. Run frozen install, types, build, regressions, identity checks and terminal acceptance. Record failures before repairing them.
3. Build the npm distribution with `node scripts/package-atlascode.mjs`.
4. Install that exact tarball in a clean prefix, run it outside the source checkout, and exercise the user journeys.
5. Package source, distribution and evidence into `AtlasCode-v0.1.0.zip`; compute SHA-256 after the archive is final.
6. Publish the source only to the dedicated AtlasCode branch, leaving unrelated branches untouched. Upload the exact ZIP to the requested destinations and verify its bytes.

This source does not authorize publishing an npm package, creating a hosted release feed, inventing a signing key, or uploading user credentials. The default update path is installation of a later reviewed AtlasCode tarball. The retained signed updater must not be pointed at an unrelated vendor distribution.
