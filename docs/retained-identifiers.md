# Product identity and retained identifiers

AtlasCode is the application. Deep Intuition is the publisher of this rebrand. Pi and the underlying provider integrations are not renamed or represented as new Deep Intuition implementations.

The audit deliberately distinguishes product branding from interoperability and provenance:

| Category | Why it remains |
|---|---|
| License and copyright notices | Preserve accurate upstream authorship and license terms. |
| `third_party/pi-mono` and other vendored source | Kept byte-for-byte unchanged from the pinned source. |
| Actual provider and model names, such as MiniMax model IDs | The provider must receive the identifier it actually serves; renaming it would either break it or mislead users. These names can appear in model selection. |
| Public service domains, `/mavis/api` routes, registered OAuth client IDs and request headers | External contracts, not local application identity. No invented Deep Intuition service replaces them. |
| Legacy profile names, database migration payloads, agent aliases and plugin formats | Read/import compatibility. New product names, paths and primary identity are AtlasCode. |
| Original archive integrity metadata and provenance | The build authenticates an upstream helper archive before applying the separate product identity transformation. |
| Test fixtures for those contracts | Tests must retain the same external/historical values they assert. |

The runtime helper extracted from the authenticated upstream archive is branded as AtlasCode before shipping; its source digest and transformed digest are separately recorded. Third-party library symbols are not falsified merely to produce an empty grep.

The brand gate records remaining occurrences and rejects unclassified ones. Required exceptions do not authorize old application branding in startup, normal help, generated paths, identity prompts, or release installers.
