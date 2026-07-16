# Example Telic run

**Status: illustrative design fixture.** Telic now has an executable runtime, but this particular trace was not captured from it and its snake_case YAML is conceptual rather than canonical API JSON. It shows the intended experience using concise rationale summaries and evidence, not hidden chain-of-thought.

## Fake repository and seeded defect

```text
acme-console/
├── AGENTS.md
├── apps/web/
│   ├── .env.development
│   └── src/lib/api.ts
├── services/api/src/
│   ├── server.ts
│   └── routes/projects.ts
└── infra/
    ├── compose.dev.yml
    └── scripts/dev.sh
```

The React dashboard runs on port `5173`; the API runs on `8080`. The seeded defect is:

- `infra/compose.dev.yml` supplies `FRONTEND_ORIGIN=http://localhost:5173`.
- `services/api/src/server.ts` reads `WEB_ORIGIN` and otherwise falls back to `http://localhost:3000`.
- The API therefore rejects the real browser origin during CORS preflight.

## 0. User request and intake

```yaml
UserMessage:
  id: message-01
  content: >
    Can you please investigate why the project is not talking?
    Can you check DevTools and so on?
  working_directory: /workspace/acme-console
```

The verb “investigate” selects `analyze_only`. It authorizes proportional read-only repository, browser, log, and runtime inspection; it does not authorize edits or restarts.

Initial project discovery finds a React frontend, an API service, and development infrastructure. That evidence gives “not talking” a safe working boundary: frontend-to-API communication. Telic records the inference and proceeds without asking the user something the project can answer.

```yaml
RunEnvelope:
  run_id: run-001
  original_request_ref: artifact://run-001/message-01
  requested_mode: analyze_only
  host:
    name: codex
    native_subagents: available
  authorization:
    granted: [repository.read, git.read, shell.readonly, browser.inspect]
    denied: [repository.write, runtime.restart, browser.mutate_state]
  budgets:
    prompt_revisions: 1
    post_execution_remediations: 1
    maximum_parallel_workers: 3
    maximum_subagent_depth: 1
```

## 1. Context grounding

The deterministic context plane discovers candidates with Git metadata and ripgrep, pins the user message and `AGENTS.md`, and stores exact source content once.

```yaml
ContextManifest:
  id: context-001
  pinned_refs:
    - artifact://run-001/message-01
    - repo://AGENTS.md
  selected_sources:
    - ref: repo://apps/web/.env.development
      reason: Defines the client API base URL.
    - ref: repo://apps/web/src/lib/api.ts
      reason: Constructs the failing request.
    - ref: repo://services/api/src/server.ts
      reason: Configures server origin policy.
    - ref: repo://services/api/src/routes/projects.ts
      reason: Defines the requested route.
    - ref: repo://infra/compose.dev.yml
      reason: Supplies API runtime environment.
  excluded_candidates:
    - ref: repo://node_modules
      reason: Generated dependency content.
```

## 2. Agent 1 frames the problem

### Input

```yaml
NextAction:
  phase: agent_1_frame
  logical_role: scenario_author
  input_refs: [artifact://run-001/message-01]
  context_manifest_ref: artifact://run-001/context-001
  required_output_type: ProblemFrame
  effective_permissions:
    mutation: false
```

### Output

```yaml
ProblemFrame:
  id: frame-001
  intent_mode: analyze_only
  goal: Identify why the React frontend cannot retrieve project data from the API.
  known_facts:
    - claim: The repository contains a React web app and API service.
      provenance: repository
      source_refs: [repo://apps/web, repo://services/api]
  inferences:
    - claim: “Not talking” most likely describes the frontend/API boundary.
      basis: The requested DevTools inspection and discovered topology.
  unknowns:
    - The exact failing request and browser-visible error.
    - Whether the API is reachable.
    - Whether client, route, or origin configuration disagrees.
  scope:
    include:
      [
        browser console and network,
        client request path,
        API runtime,
        development configuration,
      ]
    exclude: [production, unrelated features, file changes, service restarts]
  draft_acceptance_criteria:
    - AC-1: Reproduce and identify the failed boundary.
    - AC-2: Support the root cause with browser, runtime, and repository evidence.
    - AC-3: Check at least two plausible alternatives.
    - AC-4: Recommend but do not apply a fix and verification plan.
  clarification:
    required: false
    reason: Authorized local evidence can resolve the remaining unknowns.
```

Agent 1 may also render a short `ScenarioSpec` for the trace, but it cannot add facts or authority to the ProblemFrame.

## 3. Agent 2 compiles the task

### Input

```yaml
NextAction:
  phase: agent_2_compile
  logical_role: task_compiler
  input_refs:
    - artifact://run-001/message-01
    - artifact://run-001/frame-001
  required_output_type: TaskContract
```

### First output

```yaml
TaskContract:
  id: contract-001
  version: 1
  intent_mode: analyze_only
  objective: Diagnose the frontend/API communication failure.
  permissions:
    repository_read: true
    browser_inspect: true
    shell_readonly: true
    edit_files: false
    restart_services: false
  acceptance_criteria: [AC-1, AC-2, AC-4]
  verification_requirements:
    - Capture the failed browser request.
    - Trace the corresponding repository configuration.
  required_outputs:
    [diagnosis, evidence, confidence, recommended_unexecuted_fix]
```

This contract is relevant but incomplete: it drops AC-3 and does not require runtime evidence even though the frozen rubric requires a cross-boundary evidence chain.

## 4. Agent 1 reviews once; Agent 2 revises once

```yaml
PromptReview:
  id: review-001
  target_ref: artifact://run-001/contract-001
  dimension_scores:
    intent_fidelity: 30/30
    repository_grounding: 15/20
    constraints_and_permissions: 15/15
    testable_acceptance: 13/20
    execution_feasibility: 8/10
    context_efficiency: 5/5
  score: 86
  hard_gates:
    - AC-3 from the frozen frame is missing.
  decision: revise
  required_correction: Add runtime evidence and alternative-hypothesis checks without changing mode or permissions.
```

Agent 2 returns `contract-002` with AC-3, API health/log checks, explicit alternatives, and stopping conditions. Agent 1's final review passes all hard gates at `97/100`. The score explains readiness; the hard gates control progression. The prompt-revision budget is now zero.

## 5. Agent 3 plans bounded execution

```yaml
WorkPlan:
  id: plan-001
  task_contract_ref: artifact://run-001/contract-002
  execution_mode: parallel
  nodes:
    - id: browser-investigation
      objective: Capture the failed request, status, response, and console error.
      allowed_tools: [browser.navigate, browser.console, browser.network]
      output_type: WorkResult
      acceptance_criteria: [AC-1, AC-2]
    - id: runtime-investigation
      objective: Establish service reachability and relevant API rejection evidence.
      allowed_tools: [shell.readonly, container.inspect, container.logs]
      output_type: WorkResult
      acceptance_criteria: [AC-2, AC-3]
    - id: repository-investigation
      objective: Trace client URL, route, server origin policy, and environment names.
      allowed_tools: [repository.search, repository.read, git.read]
      output_type: WorkResult
      acceptance_criteria: [AC-2, AC-3]
  stop_conditions:
    - acceptance criteria are supported;
    - evidence is exhausted;
    - a permission boundary blocks further investigation.
```

The controller validates that every node is read-only and no broader than the TaskContract. Because this simulated Codex host advertises native subagents, Agent 4 may run the three independent nodes concurrently. On a host without subagents, the same nodes run serially with the same schemas and permissions.

## 6. Agent 4 executes and returns evidence

### Browser work result

```yaml
WorkResult:
  id: result-browser-001
  node_id: browser-investigation
  status: completed
  observations:
    - The dashboard shell loads at http://localhost:5173.
    - OPTIONS http://localhost:8080/api/projects returns 403.
    - The response lacks Access-Control-Allow-Origin.
    - The console reports a CORS policy error.
  evidence_refs:
    - browser://run-001/network/request-17
    - browser://run-001/network/response-17
    - browser://run-001/console/event-8
```

### Runtime work result

```yaml
WorkResult:
  id: result-runtime-001
  node_id: runtime-investigation
  status: completed
  observations:
    - The frontend listens on 5173 and API listens on 8080.
    - GET http://localhost:8080/health returns 200.
    - API logs record “CORS rejected origin http://localhost:5173”.
    - The API environment contains FRONTEND_ORIGIN but not WEB_ORIGIN.
  evidence_refs:
    - shell://run-001/listeners
    - shell://run-001/api-health
    - container://run-001/api/log-42
    - container://run-001/api/environment
```

### Repository work result

```yaml
WorkResult:
  id: result-repository-001
  node_id: repository-investigation
  status: completed
  observations:
    - The frontend uses http://localhost:8080/api/projects.
    - GET /api/projects exists.
    - The API reads WEB_ORIGIN and falls back to http://localhost:3000.
    - Compose supplies FRONTEND_ORIGIN=http://localhost:5173.
  evidence_refs:
    - repo://apps/web/src/lib/api.ts#getProjects
    - repo://services/api/src/routes/projects.ts#get-projects
    - repo://services/api/src/server.ts#WEB_ORIGIN
    - repo://infra/compose.dev.yml#FRONTEND_ORIGIN
  alternatives_checked:
    - backend_down: excluded
    - wrong_api_port: excluded
    - missing_route: excluded
```

Raw logs, files, and browser records are retained once. Agent 3 receives the structured WorkResults plus artifact references rather than three full transcripts.

## 7. Agent 3 verifies execution

```yaml
QualityReview:
  id: quality-001
  task_contract_ref: artifact://run-001/contract-002
  acceptance_results:
    - criterion_id: AC-1
      status: pass
      evidence_refs: [browser://run-001/network/response-17]
    - criterion_id: AC-2
      status: pass
      evidence_refs:
        [
          container://run-001/api/log-42,
          repo://services/api/src/server.ts#WEB_ORIGIN,
        ]
    - criterion_id: AC-3
      status: pass
      evidence_refs:
        [
          shell://run-001/api-health,
          repo://services/api/src/routes/projects.ts#get-projects,
        ]
    - criterion_id: AC-4
      status: pass
      evidence_refs: [artifact://run-001/recommendation-001]
  permission_audit:
    repository_writes: 0
    process_restarts: 0
    browser_mutations: 0
  decision: pass
```

The shared post-execution remediation budget remains unused.

## 8. Agent 5 audits and reports

Agent 5 receives the original request, approved contract, results, direct evidence, and QualityReview—not every prior conversation.

```yaml
ReleaseAudit:
  id: release-001
  user_fidelity: pass
  mode_compliance: pass
  claim_evidence_matrix: complete
  unresolved_risks:
    - The recommended fix has not been applied or verified after restart.
  decision: release
```

```yaml
UserReport:
  terminal_status: completed
  summary: >
    The frontend and API are running, but the API rejects the browser's CORS
    preflight. Compose supplies FRONTEND_ORIGIN while the API reads WEB_ORIGIN,
    so it falls back to localhost:3000 and rejects the real localhost:5173 origin.
  evidence:
    - DevTools shows OPTIONS /api/projects returning 403.
    - API health returns 200 and logs name the rejected origin.
    - Source and runtime environment prove the variable-name mismatch.
  alternatives_excluded: [backend unavailable, wrong API port, missing route]
  recommended_unexecuted_fix: Use one canonical origin variable, restart the API, and repeat the browser request.
  permissions_honored: No files changed and no services restarted.
  trace_ref: trace://run-001
```

## 9. If the user later says “apply the fix”

Telic starts a new, linked run. Because the cause and correction are now known, the new mode can be `fix_only`. The new TaskContract authorizes the exact configuration edit, relevant API restart, focused tests, and browser verification. It does not retroactively broaden `run-001` or erase its diagnosis-only permission record.

## What this run demonstrates

- Telic answered a discoverable ambiguity from project evidence instead of adding conversational friction.
- Agent 1's story role produced an authoritative grounded frame, not fiction.
- Agent 2 compiled a typed contract; named prompt-framework formatting did not determine the score.
- Agent 1 used its single revision on a concrete evidence gap.
- Agent 3 planned parallel work, while the protocol retained a serial fallback.
- Agent 4's workers returned typed evidence instead of unstructured agent conversations.
- Agent 3 verified acceptance criteria and permissions.
- Agent 5 independently checked the actual user outcome without inventing scope.
- Deduplication and artifact references reduced repeated context without lossily compressing critical evidence.
