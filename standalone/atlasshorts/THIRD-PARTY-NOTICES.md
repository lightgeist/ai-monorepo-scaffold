# Third-party notices and licensing boundary

AtlasShorts derives from the OpenShorts **MIT core** at the commit in UPSTREAM.json. The original root LICENSE is byte-preserved; NOTICE preserves original authorship and adds the fork notice. No upstream endorsement is implied.

The upstream **cloud/** directory has a separate commercial license and is excluded in full. No hosted accounts, managed provider credits, subscriptions, cloud history or cloud autopilot are included. This release is not a relicensing of that code.

## Dependency licenses are separate

The runtime uses **Ultralytics/YOLO**. The vendor describes AGPL-3.0 and Enterprise licensing options. Your intended integration, distribution and hosting model must be evaluated against those terms.

The dashboard and optional server renderer use **Remotion**, whose current license distinguishes qualifying free use from company use requiring a paid license. For-profit organizations with more than three employees should review the company-license requirement; this concern is not limited to enabling the renderer container.

FFmpeg, model weights, downloaded typography assets and service APIs retain their own licenses/terms. This release does not assert that every dependency is MIT or that your commercial deployment is cleared. No model weights, dependency trees, font binaries or credentials are embedded in the release. The optional font fetcher verifies pinned asset hashes.

Primary sources checked 4 October 2026:

- https://github.com/mutonby/openshorts/blob/06a119c280e545bc3f55f2b7b036d4c187630d50/LICENSE
- https://github.com/mutonby/openshorts/blob/06a119c280e545bc3f55f2b7b036d4c187630d50/cloud/LICENSE
- https://www.ultralytics.com/license
- https://www.remotion.dev/license
