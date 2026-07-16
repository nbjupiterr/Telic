# Security policy

**Project status:** Telic is an executable source preview with no supported release or published vulnerability channel. Do not use it as the sole security boundary for sensitive or production systems.

## Reporting a vulnerability

Do not place credentials, private source, browser data, real run artifacts, or a weaponized proof of concept in a public issue. The repository has no published private reporting address yet. Until the owner publishes one, retain the sensitive report and contact the owner privately through the account that publishes the project.

A monitored private security-advisory channel and response expectations are release blockers.

## Trust model

Telic accepts a developer request, repository context, host-authored artifacts, and evidence. It assumes the following may be wrong, malicious, or sensitive:

- repository files and nested agent instructions;
- issue text, logs, tests, tool descriptions, and generated code;
- browser/page content, console/network output, downloads, and extensions;
- optional MCP servers or CLI providers outside Telic;
- model-authored contracts, plans, scores, evidence summaries, and claims; and
- local run state containing proprietary source or credentials.

AI roles propose semantic artifacts. Deterministic code validates Telic schemas,
phases, references, budgets, and artifact-level mode/permission invariants. The
canonical host skill or `telic_workflow` MCP prompt drives the workflow; Telic
itself does not call a model API.

## Current controls

### Protocol and authority

- Strict Zod schemas reject unknown/malformed artifact fields.
- The original request, selected mode, initial authorization, initial budgets,
  and artifact bodies are stored immutably. Remaining-budget counters advance in
  deterministic run state without rewriting the immutable envelope.
- Illegal phase/type transitions, missing/cross-run references, and digest mismatches fail closed.
- Missing permission is denial; non-mutation modes route around or constrain execution at artifact acceptance.
- Contract review, clarification, cumulative WorkPlan tool calls, and
  post-execution remediation have bounded budgets.
- Shell execution requires an exact non-compound command at every artifact-level
  authority layer; shell inspection accepts only typed read-only targets.
- WorkResults are checked action by action against mode, contract, node, target,
  mutation, file-change, and direct-evidence constraints. Every completed
  repository write/delete action needs an exact `FileChange`, even when the
  containing result is partial, blocked, or failed.
- Caller-supplied artifact source references are syntax-checked, unique, and
  capped at 256 entries.
- Clarification can resume only inside existing authority. Cancellation and
  new-run choices terminate the current run; they cannot rewrite its authority.
- Trace records concise decisions and references rather than hidden chain-of-thought.

### Repository context

- Repository roots are canonicalized; path and symlink escapes are rejected.
- Context inventory and individual/total reads have explicit limits.
- Common generated, dependency, metadata, environment, credential, key, and certificate paths are excluded.
- Binary/invalid UTF-8 and duplicate content are excluded.
- Conservative content heuristics exclude common private-key/token/secret forms before selected text enters the store.
- Selection reasons, hashes, inventory source, exclusions, and warnings are retained.

### Local state

- Normal state is outside the repository under the XDG user-state directory.
- `TELIC_STATE_DIR` allows explicit isolated state.
- Unsafe state-directory, database, blob-root, and intermediate blob symlinks
  are rejected, and state files/directories use restrictive local permissions.
- Artifact bodies use canonical JSON and SHA-256 content identity; retrieval verifies the digest.
- SQLite stores run/artifact/event metadata and enforces run-scoped artifact identity.
- Runs are capped at 2,048 artifacts and 10,000 trace events; Evidence is capped
  at 128 artifacts for the current WorkPlan.

### Process and network

- The bundled Telic server uses local STDIO and requires no listening port or background daemon.
- Runtime code has no model API credential and no Telic-hosted service.
- Browser providers, external tool providers, and remote synchronization are not bundled.
- npm dependencies are locked; direct dependencies and licenses are recorded in [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md).

## Important limitations

### Host-native actions are outside Telic interception

The MCP server validates calls made to Telic and the artifacts later submitted
to the ledger. It does not intercept editor, repository, shell, runtime,
browser, network, or subagent actions a host performs through its own tools. The
host skill asks the active model to follow `NextAction` and contract permissions,
and review artifacts can reject or expose violations, but prevention depends on
the host sandbox, approval UI, and user policy.

Do not claim that installing the plugin creates a complete tool firewall.

### Same-user local state is integrity-checked, not a vault

Content digests and database constraints detect ordinary corruption or a body/metadata mismatch. A malicious process running as the same OS user with write access to the complete state directory may be able to replace database metadata and blobs together. Telic does not use a separate signing key, encrypted store, TPM, or privileged service.

Use OS account separation, filesystem protections, encrypted storage, and isolated workspaces when that threat matters.

### Secret detection is heuristic

Filename/content patterns can miss uncommon secrets and can exclude harmless files. Exact selected context and submitted evidence remain retrievable locally. Hashing does not anonymize them. Run a dedicated secret scanner and remove credentials before grounding; do not attach sensitive personal browser profiles.

Evidence-kind validation reduces accidental category errors but does not prove
that an untrusted host-authored artifact is truthful. A generic TraceEvent is an
audit record, not direct proof that an executed outcome occurred.

### Untrusted content can influence the host model

Repository and future browser content is evidence, not higher-priority instruction. Telic preserves provenance and prevents content from granting itself artifact-level authority, but the host model can still be affected by prompt injection. Host/system policy and recognized project rules must remain distinct from untrusted content.

### Retention and deletion are incomplete

No per-run deletion command or supported retention policy ships today. A user can stop Telic and remove the repository-specific state directory manually, which deletes all its runs. Backups and filesystem snapshots may retain copies outside Telic's control.

Artifact/trace quotas and the 4,000 cumulative accepted WorkPlan node-reservation
ceiling bound a single run; they do not provide age-based deletion or orphan-blob
garbage collection.

### Platform and adapter coverage is narrow

The source tree includes a Codex reference plugin and six experimental host
packs. Non-Codex hosts and individual Codex surfaces/platforms are not
security-certified. A host's MCP support or successful transport handshake does
not prove that its permissions, lifecycle, or tool behavior satisfy Telic's
adapter assumptions.

## Required behavior for adapters and future providers

- Advertise only capabilities actually available on the current surface; unknown is valid.
- Preserve the least-authorizing requested mode and require new user authority for destructive, production, credential, external-publication, or materially expanded scope.
- Keep user/system policy, recognized repository rules, and untrusted evidence in distinct channels.
- Never attach to a personal browser profile/debugging port without explicit consent.
- Restrict browser domains/actions and redact unnecessary cookies, headers, tokens, messages, and bodies.
- Display every local provider command, arguments, working directory, and passed environment keys.
- Do not auto-install optional tools or forward the complete environment.
- Validate and size-bound provider output before storing or placing it in a trace.

## Verification required before release

- Prove `report_only`, `plan_only`, and `analyze_only` cannot produce accepted mutation and cannot cause mutation through the claimed adapter path.
- Prove `analyze_and_fix` cannot mutate before diagnosis-backed authorization.
- Prove child work cannot exceed run, contract, or node authority.
- Cover malformed artifacts, illegal transitions, stale/cross-run references, multi-node dependencies, and budget exhaustion.
- Test repository/browser prompt injection and trace/evidence redaction.
- Add per-run deletion and retention tests.
- Run production dependency, secret, and transitive-license audits from a clean lockfile install.
- Verify installed-plugin process environment, disconnect/cleanup, resume, upgrade, and uninstall.
- Use only synthetic accounts, credentials, and data in the browser demo.
- Publish checksums or signed provenance for released artifacts where supported.

## Non-goals

Telic is not a security boundary against a compromised operating system, malicious host application, hostile same-user process, intentionally unsafe sandbox, or user who approves dangerous actions. It aims to reduce accidental and model-driven overreach; it cannot replace OS isolation, source review, secret management, backups, or production change controls.
