# ADR-0002: Evidence-First Clarification and Bounded Retries

**Status:** Accepted

**Date:** 2026-07-15

**Implementation status:** The controller implements evidence-first repository
grounding, clarification pause/resume, one contract revision, and one shared
post-execution remediation budget. Full adapter-level and adversarial validation
remains a release gate; see [`../STATUS.md`](../STATUS.md).

## Context

Coding requests are frequently incomplete. An agent can respond in two harmful
ways:

- Ask the user questions that the repository, runtime, browser, or existing
  project rules could answer.
- Guess a user-owned requirement whose alternatives would lead to materially
  different work.

Multi-phase agent workflows introduce a second risk: agents can repeatedly
rewrite prompts or bounce work between implementation and review until they
consume excessive context, time, and tools without becoming more correct.

Telic also cannot assume that a host provides native subagents. The five roles may
execute serially through the same host model. The MCP/controller does not call a
model API; it can only enforce deterministic state, artifact, permission, and
budget rules around phase outputs submitted by the host.

## Decision

### 1. Inspect authorized evidence before asking

Telic will begin with the smallest relevant, authorized, read-only discovery pass.
It may inspect applicable project rules, repository structure, manifests, related
code, existing artifacts, logs, runtime state, or browser evidence when the
selected mode permits those reads.

It will not ask the user for a port, path, framework, route, configuration value,
error text, or current runtime fact when that information can be discovered
safely and proportionately from the project environment.

Discovery is not permission to mutate the workspace, restart services, contact
external systems, or access production resources.

### 2. Classify unresolved unknowns

After discovery, Telic classifies an unknown as one of:

| Class                               | Action                                                            |
| ----------------------------------- | ----------------------------------------------------------------- |
| Discoverable                        | Inspect the authorized repository, runtime, browser, or artifacts |
| Bounded and reversible              | Proceed with an explicit assumption and record it                 |
| User-owned and materially divergent | Ask one concise clarification before the divergent work           |
| Permission-expanding                | Request explicit authorization                                    |
| Irrelevant to acceptance            | Leave unresolved and do not ask                                   |

An unknown is **user-owned and materially divergent** when reasonable answers
would change the goal, product behavior, visible design, data semantics, scope,
authorization, irreversible action, external recipient, production target, or
acceptance criteria.

Examples that normally require user input:

- “The project is not talking” remains ambiguous between frontend/API
  communication, audio, and real-time messaging after available evidence is
  inspected.
- A UI redesign has no established project design system, reference screen, or
  declared preference.
- The requested fix could preserve or intentionally break backward compatibility.
- Work requires deployment, deletion, an external message, credentials, payment,
  or production mutation not already authorized.

Examples that normally do not require user input:

- Which port a local service uses.
- Which environment variable the API reads.
- Which test command the repository defines.
- Whether an applicable repository rule requires a particular architecture.
- Which files import a failing symbol.

Telic may continue safe discovery that does not depend on the missing answer, but
it must not cross the divergent decision boundary.

### 3. Preserve user-selected intent mode

Clarification must not silently broaden the run. The controller records one of:

- `report_only`
- `plan_only`
- `analyze_only`
- `fix_only`
- `analyze_and_fix`

Moving to a more permissive mode requires the user's authorization. A known,
scoped `fix_only` request includes minimal preflight and post-change verification.
An unknown-cause “fix it” request must be clarified or represented as
`analyze_and_fix` rather than pretending diagnosis is unnecessary.

### 4. Bound prompt revision

Agent 1 may review Agent 2's TaskContract and request at most one revision.

The request must identify a failed frozen criterion, cite the relevant source,
and specify the smallest correction. After one revision, the review must pass,
block, or request a user-owned clarification. Stylistic preference and prompt
framework formatting are not grounds for additional cycles.

The controller, not either agent, owns and decrements the revision counter.

### 5. Share one post-execution remediation budget

Agent 3's execution quality review and Agent 5's release audit share one
remediation by default.

If Agent 3 requests a correction, the budget is consumed. Agent 5 does not receive
another independent retry. If Agent 5 discovers the first blocking execution
defect and the budget remains, the controller returns the defect to Agent 3 for a
scoped remediation work order. Agent 5 never directly instructs Agent 4.

When the budget is exhausted, Telic returns an honest partial, blocked, or failed
verification result. It may ask the user to authorize a new run, but it must not
reset counters or continue because a reviewer is merely “not satisfied.”

The controller owns these counters even when all logical roles run serially in
one host session. Native subagents do not receive separate budgets.

### 6. Keep transport recovery separate

An implementation may retry an idempotent tool call after a demonstrably
transient transport failure. This does not permit rerunning an agent phase,
changing its prompt, resetting an artifact, or restoring a consumed quality
budget. Transport retries must be visible in the trace and independently capped.

### 7. Record decisions, not hidden reasoning

Every clarification and retry transition records:

- The unresolved question or failed criterion.
- Evidence already inspected.
- Why the unknown is user-owned or why remediation is necessary.
- The artifact references involved.
- The remaining revision and remediation budgets.
- A concise decision summary.

Telic will not request or expose hidden chain-of-thought.

## Consequences

### Positive

- Users are interrupted only for decisions they actually own.
- Repository and runtime evidence reduce avoidable clarification.
- User authorization remains explicit and inspectable.
- Prompt-polishing and implementation-review loops have predictable cost.
- Agents cannot grant themselves fresh retries.
- Serial single-session hosts and native-subagent hosts use the same protocol.
- Partial or blocked outcomes remain honest rather than being forced into a pass.

### Negative

- A discovery pass adds work before some clarifications.
- A single remediation may be insufficient for a difficult implementation.
- Serial logical roles can retain correlated model bias despite phase boundaries.
- Strict stopping may require a new user-authorized run for further correction.
- Implementations must classify tool failures carefully to distinguish transient
  transport recovery from a quality retry.

### Mitigations

- Keep initial discovery proportional and task-directed.
- Permit an explicit higher budget only when a user or host policy selects a
  deeper run before execution.
- Use immutable artifacts, fresh phase projections, frozen rubrics, deterministic
  validators, and direct evidence to reduce correlated-review risk.
- Return a precise remaining-defect report when a budget is exhausted so a later
  run can resume intentionally.

## Alternatives considered

### Ask before inspecting anything

Rejected because it transfers discoverable work to the user and creates avoidable
friction.

### Infer every missing detail

Rejected because product decisions, permissions, and materially different goals
belong to the user.

### Let reviewers iterate until satisfied

Rejected because satisfaction is subjective, termination is unpredictable, and
cost can grow without a corresponding quality gain.

### Give Agent 3 and Agent 5 separate retries

Rejected because the apparent one-retry policy would permit multiple correction
cycles and late-stage ping-pong.

### Require native subagents for independent review

Rejected because host capabilities differ. Logical role separation must work
serially; native subagents are an optimization, not a prerequisite.

## Follow-up validation

Implementation and release tests should prove:

1. A discoverable repository question does not trigger user clarification.
2. A materially divergent user preference does trigger clarification.
3. A clarification cannot expand permissions without explicit authorization.
4. Agent 1-Agent 2 revision occurs no more than once.
5. Agent 3 and Agent 5 together receive no more than one execution remediation.
6. Budget exhaustion produces an honest terminal state.
7. The same transitions work with serial logical roles and optional native
   subagents.
8. Clarification and retry events are inspectable without hidden chain-of-thought.
