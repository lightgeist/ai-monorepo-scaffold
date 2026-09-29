# brightmath architecture

## Keep the reliable core, replace branding at its boundary

`problems.js` and `skills.js` define math problems and curriculum; `session.js` owns practice/mastery progression; `scoring.js`, `growth.js`, `quests.js` and `trophies.js` own rules and records. `store.js` is the local persistence authority. `main.js` remains the original UI/game coordinator. `bright-tile.js` is a new, independent presentation adapter, not a second game state. `brand.css` and `icon.svg` supply the original brightmath identity.

Core behavior tests are retained. Branding only changes visible Japanese trophy labels where necessary; a pinned source hash ledger records this explicitly. Stable skill/reward identifiers and arithmetic algorithms remain unchanged. The old app namespace is neither read nor reset.

## Scope of this release

This is a rebrand and qualification, not a rewrite, new pedagogical system, remote control plane or agent tutor. The application has no networking code, no external AI, no student accounts and no cloud learner store. A query-gated diagnostic fixture exists solely for local testing; it is not a secure production API.

## Future agent integration boundary

Do not allow a tutor to write mastery, scores, correct-answer flags or raw localStorage. Evolve the existing coordinator into explicit commands with input validation, session IDs and revisions: start an authorized practice plan, submit the learner's answer, pause/resume, and observe a bounded snapshot. Keyboard, touch and an approved interface should use that same command path. Only the deterministic math/session engine determines correctness and mastery. Keep provider reasoning and generated explanations outside the authoritative learner record; never claim an unverified explanation is mathematically correct.

An AI feature would need separate consent, age-appropriate privacy/data decisions, explicit network permissions, budget/cancellation rules, testable answer verification, and native undo/reset/export policies. None of those integrations is implied by this rebrand.
