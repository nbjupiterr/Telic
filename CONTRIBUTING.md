# Contributing to Telic

Telic has a runnable local control-plane MVP. Contributions should make its contracts, enforcement, evidence, portability, or installation more correct without describing planned provider integrations as current.

## Before changing behavior

1. Read [project status](docs/STATUS.md), [architecture](docs/ARCHITECTURE.md), [protocol](docs/PROTOCOL.md), and [quality gates](docs/QUALITY.md).
2. Check [`docs/adr/`](docs/adr/) for the decision behind the current boundary.
3. Keep host-specific local instructions and private planning notes outside the
   public source tree.
4. Add or supersede an ADR for a material architectural reversal.

## Development workflow

Use an artifact-first loop:

1. update a strict schema and golden valid/invalid case;
2. write the focused failing test;
3. implement the smallest controller, context, or adapter change;
4. run the focused package tests;
5. run the full verification matrix; and
6. update current/planned documentation and provenance.

```bash
npm ci
npm run build
npm run check
npm run test:coverage
```

The coverage gate is 85% statements/lines, 75% branches, and 85% functions across instrumented runtime modules. Entry points are exercised by the standalone plugin subprocess smoke test and excluded from in-process instrumentation.

`npm run check` uses only repository-owned validators and is the portable CI
contract. Maintainers with Codex's official system validators installed should
run `npm run check:official` for a release candidate.

## Status language

- **Current:** verified behavior available in this repository.
- **Planned:** committed work not implemented or verified.
- **Candidate:** under evaluation.
- **Deferred:** deliberately outside the MVP.

Do not call source-checkout behavior a published installation. Do not call a host action deterministically permission-enforced unless it passes through an enforcing boundary.

## Contribution boundaries

- Keep the default path local-first and host-model-native.
- Treat native subagents and browser providers as optional capabilities.
- Keep permission, transition, and retry enforcement in deterministic code.
- Preserve raw evidence and link every summary to its source.
- Never expose or request hidden chain-of-thought.
- Keep cross-host protocol logic out of host adapters.
- Add dependencies only with a pinned version, purpose, data boundary, and license record.
- Do not change the Telic project license without owner approval.

## Pull request checklist

- [ ] Protocol and implementation agree.
- [ ] Permission, malformed-input, and failure paths are tested.
- [ ] Current/planned language is accurate.
- [ ] Dependency and bundled-license records are updated.
- [ ] No credentials, `.telic/` state, private traces, or browser data are included.
- [ ] `npm run check` passes from a clean install.
- [ ] Relevant verification output is reported without fabricated evidence.

Keep commits small and record verification evidence without including private
traces, credentials, or local planning notes.
