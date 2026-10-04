# Security and reporting

atlascode-rs 0.1.0 is an independent derivative, not an Anthropic product.
Its source and dependency graphs are pinned in PROVENANCE.json.

## Reporting

Do not put credentials, unredacted diagnostic logs, private code, or exploitable
vulnerability details in public issues. Use the hosting repository's private
vulnerability-reporting option when available. A dedicated confidential reporting
channel and response-time service level have not been established for this fork;
no upstream maintainer contact or response promise is inherited.

Report issues in the official Claude Agent SDK or Claude service to the provider
through its own security process. Do not send this fork's support requests to the
original claude-code-rust maintainer.

## Release controls

The initial release uses locked dependencies, a Cargo Deny policy check, an npm
dependency advisory check, a first-party identity/provenance audit, native tests,
and portable archive runtime checks. See the release verification report for
actual results, source revisions, dates, and limitations. These are point-in-time
checks, not a penetration test or a guarantee that vulnerabilities do not exist.

This fork does not claim a nightly dependency monitor, enforced branch rules,
secret scanning, push protection, registry ownership, or private reporting merely
because the upstream used them. Such repository services must be configured and
verified separately. No ongoing monitoring is implied by the release audit.

## Safe operation

Normal project trust and tool-permission checks remain enabled. Review commands
and filesystem access before approval, especially in unfamiliar repositories.
Provider configuration and sessions may be shared with the official CLI; own
application-state isolation is not a sandbox or a provider-data isolation boundary.
See MIGRATION.md for namespace behavior.

Automatic and in-app updates are disabled in 0.1.0. Use a verified fork archive
for explicit upgrades. SHA256 checksums detect changed bytes but do not replace
publisher authentication, OS signing, or notarization. This release is not
macOS-notarized or Windows Authenticode-signed.

No live-account security evaluation, authenticated model task, or independent
security review is claimed. Third-party SDK/runtime terms remain applicable.
