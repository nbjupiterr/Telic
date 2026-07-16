import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TelicService } from "../packages/mcp/src/service.js";
import {
  NO_PERMISSIONS,
  VALID_ARTIFACT_BODIES,
} from "../packages/protocol/test/test-helpers.js";

type ArtifactBody = Record<string, any>;

interface Harness {
  service: TelicService;
  runId: string;
  body: (type: keyof typeof VALID_ARTIFACT_BODIES) => ArtifactBody;
  submit: (
    type: string,
    producer: string,
    body: ArtifactBody,
  ) => ReturnType<TelicService["submitArtifact"]>;
}

const REPOSITORY_REF = "repo://apps/web/src/api.ts";
const RULE_REF = "repo://AGENTS.md";
const ALLOWED_TARGET = "apps/web/src/api.ts";
const DENIED_TARGET = "infra/prod.yml";
const services: TelicService[] = [];

afterEach(() => {
  for (const service of services.splice(0)) service.close();
});

function repositoryReadPermissions(scopes: string[]): ArtifactBody {
  const permissions = structuredClone(NO_PERMISSIONS) as ArtifactBody;
  permissions.repository.read = scopes;
  return permissions;
}

function bindTemplate(
  value: unknown,
  runId: string,
  requestId: string,
): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll("run-01", runId)
      .replaceAll(
        `artifact://${runId}/user-message-01`,
        `artifact://${runId}/${requestId}`,
      )
      .replaceAll(
        `artifact://${runId}/browser-response-01`,
        `artifact://${runId}/evidence-01`,
      )
      .replaceAll(
        `artifact://${runId}/action-ledger-01`,
        `artifact://${runId}/evidence-01`,
      )
      .replaceAll("repo://apps/api/cors.ts", REPOSITORY_REF)
      .replaceAll(`trace://${runId}/event-0042`, `trace://${runId}`);
  }
  if (Array.isArray(value)) {
    return value.map((child) => bindTemplate(child, runId, requestId));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        bindTemplate(child, runId, requestId),
      ]),
    );
  }
  return value;
}

async function executorHarness(): Promise<Harness> {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), "telic-action-trace-repo-"),
  );
  mkdirSync(join(repositoryRoot, "apps/web/src"), { recursive: true });
  mkdirSync(join(repositoryRoot, "infra"), { recursive: true });
  writeFileSync(
    join(repositoryRoot, "AGENTS.md"),
    "# Rules\nRecord an auditable decision for every attempted action.\n",
  );
  writeFileSync(
    join(repositoryRoot, ALLOWED_TARGET),
    "export const endpoint = '/api/projects';\n",
  );
  writeFileSync(join(repositoryRoot, DENIED_TARGET), "production: true\n");

  const service = new TelicService({
    repositoryRoot,
    stateDirectory: mkdtempSync(join(tmpdir(), "telic-action-trace-state-")),
  });
  services.push(service);
  const started = service.startRun({
    originalRequest: "Inspect only the bounded apps/web API request path.",
    mode: "analyze_only",
    hostName: "action-trace-conformance-host",
    nativeSubagents: "unavailable",
    hostCapabilities: ["repository.read"],
    authorizationGranted: ["repository.read"],
  });
  const grounded = await service.groundContext({
    runId: started.run.runId,
    activePaths: ["AGENTS.md", ALLOWED_TARGET],
  });
  const selected = new Set(grounded.manifest.pinnedRefs);
  for (const candidate of grounded.manifest.candidates) {
    if (candidate.decision === "selected") selected.add(candidate.ref);
  }
  if (!selected.has(REPOSITORY_REF) || !selected.has(RULE_REF)) {
    throw new Error("active repository and rule references must be selected");
  }
  const request = service
    .getRun(started.run.runId)
    .artifacts.find((artifact) => artifact.type === "UserMessage");
  if (!request) throw new Error("immutable request artifact expected");

  const body = (type: keyof typeof VALID_ARTIFACT_BODIES) =>
    bindTemplate(
      structuredClone(VALID_ARTIFACT_BODIES[type]),
      started.run.runId,
      request.id,
    ) as ArtifactBody;
  const submit: Harness["submit"] = (type, producer, artifactBody) =>
    service.submitArtifact({
      id: artifactBody.id as string,
      runId: started.run.runId,
      type,
      schemaVersion: "1.0",
      producer,
      body: artifactBody,
    });
  const harness = { service, runId: started.run.runId, body, submit };

  const frame = body("ProblemFrame");
  frame.applicableRuleRefs = [RULE_REF];
  submit("ProblemFrame", "scenario_author", frame);

  const contract = body("TaskContract");
  contract.contextRefs = [REPOSITORY_REF];
  contract.ruleRefs = [RULE_REF];
  contract.permissions = repositoryReadPermissions(["**"]);
  contract.verificationRequirements = [
    {
      id: "VR-1",
      stage: "completion",
      description: "Capture direct evidence for the selected read.",
      required: true,
      capability: "repository.read",
      fallback: "Report an unresolved read boundary honestly.",
    },
  ];
  submit("TaskContract", "task_compiler", contract);
  submit("PromptReview", "scenario_author", body("PromptReview"));

  const plan = body("WorkPlan");
  plan.nodes[0].allowedTools = ["repository.read"];
  plan.nodes[0].requiredCapabilities = ["repository.read"];
  plan.nodes[0].contextRefs = [REPOSITORY_REF];
  plan.nodes[0].permissions = repositoryReadPermissions(["apps/web/**"]);
  plan.nodes[0].budgets.maximumToolCalls = 1;
  plan.nodes[0].budgets.maximumChildren = 0;
  plan.globalBudgets.maximumToolCalls = 1;
  plan.globalBudgets.maximumParallelWorkers = 1;
  plan.globalBudgets.maximumSubagentDepth = 0;
  submit("WorkPlan", "quality_controller", plan);
  submit("Evidence", "executor", {
    schemaVersion: "1.0",
    id: "evidence-01",
    runId: started.run.runId,
    kind: "repository",
    capturedAt: "2026-07-15T10:05:00Z",
    summary: "Captured bounded repository evidence for the work node.",
    contentType: "application/json",
    encoding: "utf8",
    content: '{"path":"apps/web/src/api.ts"}',
    sourceRefs: [],
    redactions: [],
    rationaleSummary:
      "The local evidence contains no credential or personal data.",
  });

  return harness;
}

function action(
  status: "completed" | "denied" | "skipped",
  target = ALLOWED_TARGET,
): ArtifactBody {
  return {
    id: `action-${status}`,
    capability: "repository.read",
    target,
    mutating: false,
    status,
    evidenceRefs:
      status === "completed" ? ["artifact://placeholder/evidence-01"] : [],
    rationaleSummary:
      status === "completed"
        ? "The bounded repository read completed."
        : status === "denied"
          ? "The controller denied the out-of-scope repository read."
          : "The repository read was not attempted.",
  };
}

function resultBody(
  harness: Harness,
  options: {
    status?: "completed" | "partial" | "blocked";
    actions?: ArtifactBody[];
  } = {},
): ArtifactBody {
  const result = harness.body("WorkResult");
  const evidenceRef = `artifact://${harness.runId}/evidence-01`;
  const status = options.status ?? "completed";
  result.status = status;
  result.observations[0].evidenceRefs = [evidenceRef];
  result.inferences = [];
  result.actions = (options.actions ?? []).map((entry) => ({
    ...entry,
    evidenceRefs:
      entry.status === "completed" ? [evidenceRef] : entry.evidenceRefs,
  }));
  result.filesChanged = [];
  result.toolEventRefs = [];
  result.evidenceRefs = [evidenceRef];
  result.testResults = [];
  result.acceptanceCoverage = [
    {
      criterionId: "AC-1",
      status: status === "completed" ? "pass" : "unverified",
      evidenceRefs: status === "completed" ? [evidenceRef] : [],
      rationaleSummary:
        status === "completed"
          ? "The direct evidence satisfies the assigned criterion."
          : "The denied action left the criterion unverified.",
    },
  ];
  result.unresolvedIssues =
    status === "completed" ? [] : ["The requested action was denied."];
  result.deviations = [];
  result.rationaleSummary =
    status === "completed"
      ? "The bounded node completed with direct evidence."
      : "The node stopped honestly after the permission denial.";
  return result;
}

function permissionChecks(harness: Harness) {
  return harness.service
    .getTrace(harness.runId)
    .filter((event) => event.eventType === "permission_checked");
}

describe("per-action permission trace conformance", () => {
  it("records one precise ALLOW before the accepted WorkResult submission", async () => {
    const harness = await executorHarness();
    harness.submit(
      "WorkResult",
      "executor",
      resultBody(harness, { actions: [action("completed")] }),
    );

    const resultRef = `artifact://${harness.runId}/result-01`;
    const trace = harness.service.getTrace(harness.runId);
    const checks = trace.filter(
      (event) => event.eventType === "permission_checked",
    );
    const submitted = trace.find(
      (event) =>
        event.eventType === "phase_submitted" &&
        event.outputRefs.includes(resultRef),
    );
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      actor: "controller",
      phase: "agent_4_execute",
      outputRefs: [resultRef],
      permissionDecision: {
        decision: "allow",
        capability: "repository.read",
        scope: ALLOWED_TARGET,
        policyRefs: [
          `artifact://${harness.runId}/contract-01`,
          `artifact://${harness.runId}/plan-01`,
        ],
      },
    });
    expect(submitted).toBeDefined();
    expect(checks[0]!.sequence).toBeLessThan(submitted!.sequence);
  });

  it("records no permission check when WorkResult has zero actions", async () => {
    const harness = await executorHarness();
    harness.submit(
      "WorkResult",
      "executor",
      resultBody(harness, { status: "partial" }),
    );
    expect(permissionChecks(harness)).toHaveLength(0);
  });

  it("records no permission check for skipped-only actions", async () => {
    const harness = await executorHarness();
    harness.submit(
      "WorkResult",
      "executor",
      resultBody(harness, {
        status: "partial",
        actions: [action("skipped")],
      }),
    );
    expect(permissionChecks(harness)).toHaveLength(0);
  });

  it.each(["partial", "blocked"] as const)(
    "records one DENY and no false allow for a %s denied WorkResult",
    async (status) => {
      const harness = await executorHarness();
      harness.submit(
        "WorkResult",
        "executor",
        resultBody(harness, {
          status,
          actions: [action("denied", DENIED_TARGET)],
        }),
      );

      const checks = permissionChecks(harness);
      expect(checks).toHaveLength(1);
      expect(checks[0]).toMatchObject({
        actor: "controller",
        phase: "agent_4_execute",
        permissionDecision: {
          decision: "deny",
          capability: "repository.read",
          scope: DENIED_TARGET,
        },
      });
      expect(
        checks.some((event) => event.permissionDecision?.decision === "allow"),
      ).toBe(false);
    },
  );

  it("persists one DENY while rejecting an out-of-scope completed action atomically", async () => {
    const harness = await executorHarness();
    const before = harness.service.getRun(harness.runId);
    const beforeRun = structuredClone(before.run);
    const beforeArtifacts = structuredClone(before.artifacts);
    const beforeTraceLength = harness.service.getTrace(harness.runId).length;
    const attempted = resultBody(harness, {
      actions: [action("completed", DENIED_TARGET)],
    });

    expect(() => harness.submit("WorkResult", "executor", attempted)).toThrow(
      /outside node|scope|permission/i,
    );

    const after = harness.service.getRun(harness.runId);
    expect(after.run).toEqual(beforeRun);
    expect(after.run).toMatchObject({
      phase: "agent_4_execute",
      version: beforeRun.version,
    });
    expect(after.artifacts).toEqual(beforeArtifacts);
    expect(
      after.artifacts.some((artifact) => artifact.id === "result-01"),
    ).toBe(false);

    const appended = harness.service
      .getTrace(harness.runId)
      .slice(beforeTraceLength);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({
      actor: "controller",
      phase: "agent_4_execute",
      eventType: "permission_checked",
      inputRefs: [
        `artifact://${harness.runId}/contract-01`,
        `artifact://${harness.runId}/plan-01`,
      ],
      outputRefs: [],
      permissionDecision: {
        decision: "deny",
        capability: "repository.read",
        scope: DENIED_TARGET,
      },
    });
  });
});
