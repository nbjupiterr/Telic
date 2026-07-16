# Host adapters

**Status:** A source-built Codex plugin is present. No Claude Code, Cursor, Antigravity, Kiro, or browser adapter ships today.

## Boundary

Telic's schemas, controller, repository grounding, artifact storage, and MCP tools are portable TypeScript packages. A host adapter supplies the semantic turn driver: it activates the workflow, lets the current host model author the requested artifact, exposes available capabilities, and presents progress/results.

MCP is the deterministic tool and ledger boundary. It is not a universal prompt interceptor, model API, subagent API, or host sandbox. An MCP-capable host does not become a conforming Telic adapter merely by connecting to the server.

The no-extra-model-API flow is:

1. The user or host explicitly activates the Telic workflow.
2. The adapter calls `telic_start_run`, then passes its action/version tokens to `telic_ground_context`.
3. It asks `telic_get_next_action` for the one legal role and output schema.
4. The active host model performs that logical role with bounded references.
5. The adapter submits the canonical artifact through `telic_submit_artifact` with the latest action/version tokens.
6. The loop ends on clarification or a terminal report.

When native subagents are available, an adapter may map independent work to them. When they are unavailable or unknown, the same host model performs explicit logical roles serially. Telic never claims five persistent model processes.

## Portable responsibilities

The current portable packages own:

- strict artifact schemas and camelCase serialization;
- state transitions and bounded review/remediation budgets;
- run-scoped references and immutable artifact bodies;
- requested mode and effective permission projection;
- repository inventory, ranking, budgets, and source provenance;
- SQLite/content-addressed local persistence; and
- seven STDIO MCP operations plus CLI inspection.

They do not own host prompt routing, model inference, native agent creation, editor UI, or host tool approvals.

## Adapter responsibilities

| Boundary     | Adapter responsibility                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Invocation   | Provide an explicit way to activate Telic with the user's complete request and mode                     |
| Capabilities | Report the current surface's actual tools and subagent availability; unknown is valid                   |
| Turn driving | Request the next action, give the model only the referenced inputs, and submit the strict output        |
| Tool use     | Stay within the action/contract permissions and the host's sandbox/approval system                      |
| Evidence     | Capture/redact observable results, submit `Evidence`, and cite it from results and claims               |
| Presentation | Show phase, validation errors, clarification, final report, and trace without exposing chain-of-thought |
| Lifecycle    | Start the local server with the correct repository/state and stop it on disconnect                      |

Adapters must not emulate an unsupported capability and report it as native.

## Codex reference adapter

The repository currently ships:

```text
plugins/telic/
├── .codex-plugin/plugin.json
├── .mcp.json
├── dist/mcp/server.js
└── skills/
    └── telic/
        ├── SKILL.md
        ├── agents/openai.yaml
        └── references/
```

The plugin is the distribution shape; the skill is the semantic workflow; `.mcp.json` launches the local tool/ledger process. The installed qualified skill name is `telic:telic`.

The skill tells Codex how to:

- select the least-authorizing outcome mode;
- iterate through next actions and strict artifacts;
- distinguish observations from inferences;
- capture redacted supporting evidence in the executor phase;
- honor one contract revision and bounded remediation; and
- report concise rationale and evidence rather than hidden chain-of-thought.

The plugin currently has no hooks, UI assets, browser provider, or custom host-tool interceptor. Direct Codex editor/shell/browser actions do not pass through the Telic MCP server. The skill and artifact reviewers can constrain and audit those actions, while preventive enforcement remains Codex sandbox/user approval policy.

See [Installation](INSTALLATION.md) for the local marketplace flow and [API](API.md) for the seven tools.

## Capability negotiation

A run records the host name, native-subagent state (`available`, `unavailable`, or `unknown`), declared capabilities, and explicit authorization. Effective capability is an intersection, not a union.

Portable capability identifiers include repository read/write, shell inspection/execution, runtime inspection/restart, browser inspection/mutation, network read/external write, and subagent spawning. An adapter should advertise only capabilities it can actually use on the current surface. Missing optional capability causes a downgrade; a capability required for an acceptance criterion causes an honest partial/blocked result or a material clarification.

## Planned adapters

| Target      | Candidate invocation                                     | What must be proven before compatibility is claimed                                         | Status         |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------- |
| Codex       | Bundled plugin skill + local MCP                         | Clean install, representative run, lifecycle, upgrade/uninstall, claimed surfaces/platforms | Source preview |
| Claude Code | Native skill/command plus MCP when available             | Rule priority, permission mapping, model-turn driving, artifact round trip, lifecycle       | Planned        |
| Cursor      | Explicit rule/command or extension plus MCP              | Workspace rules, tool approvals, CLI/IDE differences, lifecycle                             | Planned        |
| Antigravity | Surface selected after a compatibility spike             | Invocation, permissions, context, agents, MCP/process behavior                              | Research       |
| Kiro CLI    | CLI-native workflow selected after a compatibility spike | Spec/workflow mapping, permissions, MCP/process behavior                                    | Research       |

No future adapter should promise identical behavior merely because its host supports MCP. Portability comes from the shared artifact protocol and explicit capability downgrades.

## Adapter conformance target

Before an adapter is called supported, record evidence for:

1. explicit activation and mode tie-breaking;
2. capability detection without host-name assumptions;
3. complete logical-serial workflow without native subagents;
4. strict artifact and reference round trips;
5. preservation of non-mutation modes;
6. evidence capture and redaction;
7. missing-tool/browser behavior;
8. process disconnect and restart/resume behavior;
9. install, upgrade, and clean uninstall; and
10. exact host version, surface, and OS.

Native parallel execution is an optional conformance feature. Host-enforced mediation requires an explicit hook/tool boundary and is not implied by MCP conformance.
