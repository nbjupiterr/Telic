# Telic Quality Model

**Status:** Normative quality design with partial deterministic enforcement.

Telic now has strict review artifacts, phase transitions, bounded revision and
remediation budgets, evidence artifacts, and automated controller/protocol
tests. This document defines the broader quality contract for the full product;
not every semantic claim/evidence invariant or benchmark is complete. Current
enforcement and known limits are listed in [STATUS.md](STATUS.md), while the Zod
schemas in `packages/protocol/src/` remain authoritative for accepted fields.

## 1. Quality objective

Telic should optimize for faithful, permission-safe, evidence-backed outcomes,
not for verbose prompts, maximum agent count, or agents declaring themselves
satisfied.

Quality is evaluated at three separate boundaries:

1. **Contract readiness** — does the compiled task faithfully and safely express
   the user's request?
2. **Execution quality** — did the work satisfy the contract, repository rules,
   and task-relevant engineering expectations?
3. **Release fitness** — can the final claims be honestly reported to the user?

A score summarizes a review. A hard gate decides whether work may progress.

## 2. Frozen, versioned rubrics

Each run MUST record the identifier and version of every rubric before the target
artifact is evaluated. A reviewer MUST NOT change criteria after seeing a result
in order to justify passing or failing it.

Rubric changes create a new version. They do not retroactively alter earlier run
scores.

Task-specific criteria MAY be added while Agent 1 creates the `ProblemFrame` when
they are grounded in the user request, repository rules, existing architecture,
or a declared task-type checklist. The initial `TaskContract` must preserve that
draft criterion set exactly; Agent 2 cannot silently invent criteria during
compilation.

## 3. Contract readiness review

Agent 1 evaluates Agent 2's TaskContract using the frozen `contract-readiness-v1`
rubric.

| Dimension                   | Weight | Question                                                                   |
| --------------------------- | -----: | -------------------------------------------------------------------------- |
| Intent fidelity             |     30 | Does the contract preserve the user's actual goal and requested mode?      |
| Repository grounding        |     20 | Are project claims sourced, and are unknowns kept distinct from facts?     |
| Constraints and permissions |     15 | Are scope, non-goals, and authorization explicit and non-expansive?        |
| Testable acceptance         |     20 | Can completion be demonstrated through observable evidence?                |
| Execution feasibility       |     10 | Are required capabilities available and stop conditions defined?           |
| Context efficiency          |      5 | Does each role receive necessary references without avoidable duplication? |

The executable `contract-readiness-v1` score is the weighted aggregate above,
rounded to two decimal places. `PromptReview.overallScore` must equal that value
exactly. Current decision bands are:

- `80-100`: eligible to pass only when coverage is complete and every hard gate
  passes.
- `<80`: revise once when a concrete typed correction exists, otherwise block.

The bands do not override hard gates. A contract may score 98 and still be blocked
by an authorization violation.

A `block` decision is also evidence-bearing: it requires either a failed hard
gate or a blocking finding. A high score alone cannot force a pass, and a
reasonless block is invalid.

### 3.1 Contract hard gates

The following conditions fail contract readiness:

- The objective omits or materially changes the user's request.
- The intent mode or permissions authorize more than the user granted.
- A repository or runtime inference is represented as an observed fact.
- A required acceptance criterion has no observable evidence path.
- The plan depends on a tool or native-subagent capability the host does not have
  and defines no fallback.
- Required project rules are missing or contradicted.
- Completion depends on an unresolved, user-owned choice that would materially
  change the result.
- The contract requests external, privileged, destructive, or production action
  without explicit authorization.

### 3.2 Prompt revision limit

Agent 1 may request one Agent 2 revision. The revision request MUST identify:

- The failed rubric dimension or hard gate.
- Evidence supporting the finding.
- The smallest required correction.
- Fields that must remain unchanged.
- The typed `TaskContract` fields permitted to change.

The version-2 contract must cite its prior contract and review, change every
declared correction field, preserve every declared preservation field, and change
nothing outside the correction set. Corrected and preserved fields cannot
overlap, and the revision cannot broaden permission. After one revision, Agent 1
must pass or block; clarification remains subject to the separate one-question
budget and typed-choice rules.

## 4. Execution quality review

Agent 3 evaluates Agent 4's WorkResult against the approved contract using a core
rubric and a task-specific rubric.

| Core dimension                        | Weight | Evidence expected                                       |
| ------------------------------------- | -----: | ------------------------------------------------------- |
| Acceptance fulfillment                |     30 | Criterion-to-evidence mapping                           |
| Functional correctness and edge cases |     20 | Tests, reproduction, browser/runtime observations       |
| Verification quality                  |     20 | Relevant checks with actual results, not planned checks |
| Repository rules and architecture     |     15 | Rule references and consistency with existing patterns  |
| Permission and scope compliance       |     10 | Trace of actions and changed paths                      |
| Maintainability and regression risk   |      5 | Focused diff, affected-area checks, unresolved risks    |

The core rubric is adapted by intent mode:

| Mode              | Minimum release evidence                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `report_only`     | Traceable source references, clear distinction between known and unknown, no claim of new execution                   |
| `plan_only`       | Requirement-to-step traceability, capability feasibility, risks, validation plan, no claim that work was performed    |
| `analyze_only`    | Reproduction or observation, evidence-backed cause or honest uncertainty, plausible alternatives checked, no mutation |
| `fix_only`        | Known-fix preflight, scoped diff/action record, required tests, before/after verification                             |
| `analyze_and_fix` | Analysis evidence plus supported change, before/after evidence, tests, and regression checks                          |

### 4.1 Execution hard gates

The following conditions prevent an execution pass:

- A tool action or file change exceeded effective permission.
- A required acceptance criterion is failed or unverified.
- A claimed observation lacks an evidence reference.
- Evidence was invented, altered, or summarized in a way that changes its meaning.
- A required test fails, or its omission is concealed.
- The result violates an applicable project rule or required architectural
  constraint.
- The work contains a known security, privacy, data-loss, or production-safety
  defect within the task's affected boundary.
- The work expands into unrelated refactoring or behavior without approval.
- An `analyze_only`, `report_only`, or `plan_only` run mutates the workspace or
  runtime.
- A fix is declared complete without post-change verification.

An unavailable check does not automatically imply failure. The result must be
marked `partial` or `unverified`, explain the limitation, and avoid a completion
claim that depends on that check.

The controller also checks structural completeness: every executable WorkPlan
node declares at least one unique `requiredCapability`, its tool-call budget can
cover those capabilities, and a required `subagent.spawn` has a child budget.
Every completed result records a completed action for each required capability.
Every completed repository write/delete action has one exact matching
`FileChange` and diff reference in both directions, regardless of the containing
result's overall status. A passing review covers the applicable contract
criteria, every rule reference, and every verification requirement exactly once.
Passed verification must be backed by a completed action with the declared
capability and compatible direct evidence.

### 4.2 Diagnosis-to-mutation gate

An `analyze_and_fix` run must cross a separate evidence boundary before its
first mutating plan. The diagnosis QualityReview may leave post-fix acceptance
criteria unverified because the correction has not run yet, but it may select
`proceed_to_fix` only when all of the following are true:

- a typed diagnosis gate marks the root cause as supported;
- one or more direct evidence artifact references support that cause;
- the proposed correction is explicit and bounded;
- the correction remains inside the already approved scope;
- existing authorization is sufficient; and
- no hard gate, rule-compliance check, regression check, or blocking finding has
  failed.

The diagnosis gate does not consume the shared remediation budget and does not
grant authority. It records why the controller may expose a separately bounded
fix plan under authority that already exists. Unsupported or unverified causes,
missing evidence, scope expansion, or insufficient permission must stop before
mutation.

The contract labels acceptance criteria and verification requirements as
`diagnosis` or `completion`. The initial analyze-and-fix plan may cover only the
diagnosis stage. A correction work order and its plan must cover every completion
criterion, and the final review must retain the earlier diagnosis verification
exactly while binding completion verification to current actions and evidence. A
final fix pass also requires an actually completed mutating action.

## 5. Evidence model

An evidence-backed claim contains:

```yaml
claim:
  id: claim-17
  text: The API rejected the browser origin during CORS preflight.
  status: observed # observed | inferred | user_reported | unverified
  evidence_refs:
    - artifact://run-01/browser-response-17
    - artifact://run-01/api-log-42
  confidence: 0.97
```

Confidence is metadata, not proof. An inference must cite the observations from
which it was derived.

Valid outcome evidence may include:

- Immutable user messages or confirmations.
- Repository paths, symbols, hashes, or exact excerpts.
- Diffs and changed-file manifests.
- Test commands, exit status, and captured results.
- Runtime process, port, health, or log artifacts.
- Browser console, network, accessibility, or screenshot artifacts.
- Build, lint, type-check, static-analysis, or security tool results.
- Redacted, typed `Evidence` artifacts captured for an authorized work plan.

Permission decisions and tool-denial trace events remain important authority and
audit records, but the current controller does not accept a generic TraceEvent as
direct proof of an executed outcome. A `ContextDocument` may support a
`WorkResult` observation or inference; it cannot prove that a command, test,
browser action, or mutation ran.

Direct evidence kinds are capability-bound. Repository writes/deletes require a
`diff`; shell actions require `tool_output`, `log`, or `test`; runtime actions
require `runtime`, `log`, or `tool_output`; browser actions require `browser`;
and network, external-write, and subagent actions require `tool_output`. Test
output accepts `test`, `tool_output`, or `log`, while a test command reference
accepts `tool_output` or `log`.

Exact source artifacts SHOULD be retained while downstream roles receive compact
references or summaries. Summaries MUST link to their originals. Secrets and
sensitive data MUST be redacted without fabricating substitute evidence.

### 5.1 Evidence coverage

Every required acceptance criterion must resolve to one of:

- `pass` with evidence.
- `fail` with evidence.
- `unverified` with a reason.
- `not_applicable` with contract-grounded justification.

“Agent 4 says it is done” is never sufficient evidence.

Only `pass` satisfies a completed `WorkResult` or passing `QualityReview`.
`fail`, `unverified`, and `not_applicable` remain useful for honest partial or
blocked outcomes, but they cannot be counted as successful completion.

For execution modes, each passing `QualityReview` acceptance result must carry
the exact evidence set from matching current `WorkResult` coverage. An unchanged
criterion not assigned to a remediation plan may retain the exact evidence set
from an earlier passing review; a criterion assigned to the current plan cannot
be satisfied with stale evidence.

## 6. Task-specific completeness

Telic should apply a relevant quality checklist without converting every request
into a broad redesign.

The precedence order is:

```text
host and safety policy
-> explicit user authorization and constraints
-> applicable repository rules
-> existing project architecture and design system
-> approved acceptance criteria
-> task-type quality checklist
-> generic best practices
```

A generic best practice MUST NOT override an explicit higher-priority constraint
or justify unrelated work.

### 6.1 Input-validation example

If a task adds a numeric field, the contract should derive relevant behavior from
the domain and existing data contract rather than merely requesting “a number
input.” Depending on scope, measurable criteria may include:

- Accepted numeric domain and boundaries.
- Keyboard entry, paste, empty, and malformed input behavior.
- Client-side feedback.
- Server-side validation when the value crosses a trust boundary.
- Accessibility name, error association, and keyboard operation.
- Tests for accepted and rejected values.

These criteria should be added only when relevant to the affected boundary. Telic
must not invent business rules such as minimum and maximum values.

### 6.2 Subjective UI quality

“Looks good,” “professional,” or “does not look vibe-coded” cannot be hard gates
without an agreed reference. Translate them into observable criteria such as:

- Uses the repository's established components, tokens, typography, and spacing.
- Aligns with designated reference screens or supplied designs.
- Behaves at agreed responsive breakpoints.
- Provides applicable loading, empty, error, disabled, and success states.
- Supports keyboard navigation and visible focus.
- Meets the project's declared accessibility and contrast target.
- Produces screenshots or browser evidence at specified viewports.
- Avoids overflow, overlap, clipping, and unintended layout shifts in those
  viewports.

When the decision is genuinely aesthetic and neither the repository nor the user
provides a baseline, Telic should request a reference or report the choice as a
subjective assumption. An agent's taste is not objective evidence.

## 7. Post-execution remediation budget

Each run has one shared post-execution remediation budget by default.

- Agent 3 consumes it when QualityReview requests corrective execution.
- Agent 5 consumes the same budget if ReleaseAudit discovers a blocking defect
  after Agent 3 passes the work.
- Agent 3 and Agent 5 do not receive separate retries.
- Native Agent 4 subagents do not receive independent remediation budgets.
- A remediation must target identified failed criteria; it is not permission for
  a broad second implementation.

When the budget is exhausted, the controller must terminate as `partial`,
`failed_verification`, or `blocked`, explain the remaining defect, and request a
new user decision if more work is warranted.

Idempotent transport recovery for a transient tool failure may be tracked
separately, but it must not reset artifacts, rerun a reasoning phase silently, or
change a quality verdict.

## 8. Independent release audit

Agent 5 performs the final release audit. It receives the original user request,
approved contract, WorkResults, direct evidence, and Agent 3's QualityReview.

It SHOULD receive a bounded evidence projection rather than Agent 3's full
conversation or unstructured rationale. This reduces anchoring and wasted
context.

Agent 5 checks:

- User-request fidelity.
- Intent-mode and permission compliance.
- Claim-to-evidence coverage.
- Honest disclosure of skipped or failed verification.
- Consistency between the final report, diff, tests, and runtime observations.
- Important contradictions or omissions missed by Agent 3.

The executable release audit covers the immutable original request exactly once,
requires every fidelity check to pass before release, and maps every contract
criterion to a supported claim. A released `UserReport` must reproduce every
supported audited claim, retain all required-verification evidence, and include
every accepted `WorkResult` diff reference exactly once. A non-completed report
must cite its controlling `QualityReview` or `ReleaseAudit`; an early contract
block cites the blocking `PromptReview`.
The report's `traceRef` is exactly the aggregate `trace://<current-run-id>` URI;
it cannot point at another run or a hand-picked event.

Agent 5 MUST NOT edit files or directly delegate to Agent 4. A blocking finding is
returned to the controller as a typed `ReleaseDefect`; the controller asks Agent 3
for the smallest remediation plan if the shared budget remains.

Logical independence does not guarantee statistical independence. When one host
model executes all roles serially, fixed rubrics, fresh phase projections,
deterministic validators, direct tool evidence, and the release audit together
provide defense in depth. Telic MUST NOT claim that this is equivalent to five
different models.

## 9. Observability without hidden reasoning

An inspectable run SHOULD expose:

- Original and follow-up user messages.
- Selected intent mode and effective permissions.
- ProblemFrame and an optional, presentation-only ScenarioSpec.
- TaskContract and its rendered role prompts.
- Context references selected or rejected for each phase, with short reasons.
- Frozen rubric versions, scores, hard-gate results, and required corrections.
- WorkPlan nodes, dependencies, budgets, and logical-to-physical role mapping.
- Tool names, redacted arguments, results, exit status, and artifact references.
- WorkResults, changes, tests, browser/runtime observations, and unresolved risks.
- Controller state transitions, clarification count, and remaining budgets.
- QualityReview, ReleaseAudit, terminal status, and stopping reason.

Telic SHOULD record short decision summaries such as:

> AC-2 remains unverified because no runtime artifact demonstrates that the
> request reached the API.

Telic MUST NOT ask for or expose private chain-of-thought. It MUST NOT present
hidden reasoning as a feature. User-facing observability is supplied by typed
inputs and outputs, provenance, evidence, tool traces, decisions, and concise
rationale summaries.

Trace views MUST redact credentials, secrets, personal data, and sensitive tool
output according to host policy. Redaction events should themselves be visible.

## 10. Validation strategy

The current repository exercises the following areas, while release claims still
require clean-install and adapter-path evidence:

1. Schema validation for every artifact type.
2. State-machine rejection of invalid transitions.
3. Permission intersection and denial of expanded role permissions.
4. Exactly one Agent 1-Agent 2 contract revision.
5. Exactly one shared post-execution remediation across Agents 3 and 5.
6. Serial logical-role operation with no native subagents.
7. Explicit rejection of parallel WorkPlans until a scheduling adapter ships.
8. Unsupported completion claims failing without evidence.
9. `report_only`, `plan_only`, and `analyze_only` preventing mutation.
10. Honest partial results when tools or verification are unavailable.
11. Trace redaction and absence of hidden chain-of-thought fields.
12. Release work: expand the current conformance fixtures into a measured golden
    set containing diagnosis, known fix, analyze-and-fix, planning, backend,
    frontend, infrastructure, and subjective-UI scenarios.

No quality or token-saving claim should be published until measured against this
golden set. Context bytes avoided and artifact reuse may be reported when Telic
can measure them; provider token or prompt-cache savings must not be inferred when
the host does not expose those measurements.
