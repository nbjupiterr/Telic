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
    sourceRefs?: string[],
  ) => ReturnType<TelicService["submitArtifact"]>;
}

const REPOSITORY_REF = "repo://apps/web/src/api.ts";
const RULE_REF = "repo://AGENTS.md";
const EVIDENCE_ID = "evidence-01";
const ALLOWED_TARGET = "apps/web/src/api.ts";
const DENIED_TARGET = "infra/prod.yml";
const services: TelicService[] = [];

afterEach(() => {
  for (const service of services.splice(0)) service.close();
});

function readPermissions(scopes: string[]): ArtifactBody {
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
        `artifact://${runId}/${EVIDENCE_ID}`,
      )
      .replaceAll(
        `artifact://${runId}/action-ledger-01`,
        `artifact://${runId}/${EVIDENCE_ID}`,
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

async function framedHarness(): Promise<Harness> {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), "telic-remaining-invariants-repo-"),
  );
  mkdirSync(join(repositoryRoot, "apps/web/src"), { recursive: true });
  mkdirSync(join(repositoryRoot, "infra"), { recursive: true });
  mkdirSync(join(repositoryRoot, "src"), { recursive: true });
  writeFileSync(
    join(repositoryRoot, "AGENTS.md"),
    "# Rules\nPreserve authority, acceptance, and terminal outcomes.\n",
  );
  writeFileSync(
    join(repositoryRoot, ALLOWED_TARGET),
    "export const endpoint = '/api/projects';\n",
  );
  writeFileSync(join(repositoryRoot, DENIED_TARGET), "production: true\n");

  const service = new TelicService({
    repositoryRoot,
    stateDirectory: mkdtempSync(
      join(tmpdir(), "telic-remaining-invariants-state-"),
    ),
  });
  services.push(service);
  const started = service.startRun({
    originalRequest: "Inspect only the bounded apps/web request path.",
    mode: "analyze_only",
    hostName: "remaining-invariants-host",
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
  const submit: Harness["submit"] = (
    type,
    producer,
    artifactBody,
    sourceRefs,
  ) =>
    service.submitArtifact({
      id: artifactBody.id as string,
      runId: started.run.runId,
      type,
      schemaVersion: "1.0",
      producer,
      body: artifactBody,
      ...(sourceRefs ? { sourceRefs } : {}),
    });
  const harness = { service, runId: started.run.runId, body, submit };

  const frame = body("ProblemFrame");
  frame.applicableRuleRefs = [RULE_REF];
  submit("ProblemFrame", "scenario_author", frame);
  return harness;
}

function submitContract(
  harness: Harness,
  scopes: string[] = ["**"],
): ArtifactBody {
  const contract = harness.body("TaskContract");
  contract.contextRefs = [REPOSITORY_REF];
  contract.ruleRefs = [RULE_REF];
  contract.permissions = readPermissions(scopes);
  contract.verificationRequirements = [
    {
      id: "VR-1",
      stage: "completion",
      description: "Capture direct evidence for the selected repository read.",
      required: true,
      capability: "repository.read",
      fallback: "Report the verification boundary honestly.",
    },
  ];
  harness.submit("TaskContract", "task_compiler", contract);
  return contract;
}

function submitRevisionReview(
  harness: Harness,
  preserveFields: string[],
  requiredCorrection: string,
  correctionFields: string[] = ["requiredOutputs"],
): void {
  const review = harness.body("PromptReview");
  review.decision = "revise";
  review.overallScore = 75;
  review.dimensionScores = {
    intentFidelity: 75,
    repositoryGrounding: 75,
    constraintsAndPermissions: 75,
    testableAcceptance: 75,
    executionFeasibility: 75,
    contextEfficiency: 75,
  };
  review.hardGates[0].passed = false;
  review.findings = [
    {
      id: "revision-finding-01",
      severity: "blocking",
      claim: "The contract needs one explicitly bounded correction.",
      sourceRefs: [`artifact://${harness.runId}/contract-01`],
      rubricDimension: "testableAcceptance",
      requiredCorrection,
      preserveFields,
      correctionFields,
      rationaleSummary:
        "Only the named correction is authorized during the single revision.",
    },
  ];
  harness.submit("PromptReview", "scenario_author", review);
}

function submitRevisedContract(
  harness: Harness,
  mutate: (contract: ArtifactBody) => void,
) {
  const prior = harness.service.getArtifact(harness.runId, "contract-01").body;
  if (typeof prior !== "object" || prior === null || Array.isArray(prior)) {
    throw new Error("prior TaskContract body expected");
  }
  const revised = structuredClone(prior) as ArtifactBody;
  revised.id = "contract-02";
  revised.version = 2;
  mutate(revised);
  return harness.submit("TaskContract", "task_compiler", revised, [
    `artifact://${harness.runId}/contract-01`,
    `artifact://${harness.runId}/prompt-review-01`,
  ]);
}

async function executorHarness(): Promise<Harness> {
  const harness = await framedHarness();
  submitContract(harness);
  harness.submit(
    "PromptReview",
    "scenario_author",
    harness.body("PromptReview"),
  );
  const plan = harness.body("WorkPlan");
  plan.nodes[0].allowedTools = ["repository.read"];
  plan.nodes[0].requiredCapabilities = ["repository.read"];
  plan.nodes[0].contextRefs = [REPOSITORY_REF];
  plan.nodes[0].permissions = readPermissions(["apps/web/**"]);
  plan.nodes[0].budgets.maximumToolCalls = 1;
  plan.nodes[0].budgets.maximumChildren = 0;
  plan.globalBudgets.maximumToolCalls = 1;
  plan.globalBudgets.maximumParallelWorkers = 1;
  plan.globalBudgets.maximumSubagentDepth = 0;
  harness.submit("WorkPlan", "quality_controller", plan);
  harness.submit("Evidence", "executor", {
    schemaVersion: "1.0",
    id: EVIDENCE_ID,
    runId: harness.runId,
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

function workAction(
  capability: "repository.read" | "repository.write",
  target: string,
): ArtifactBody {
  return {
    id: `action-${capability.replace(".", "-")}`,
    capability,
    target,
    mutating: capability === "repository.write",
    status: "completed",
    evidenceRefs: ["artifact://placeholder/evidence-01"],
    rationaleSummary:
      capability === "repository.write"
        ? "The attempted repository mutation is recorded."
        : "The bounded repository read completed.",
  };
}

function workResult(
  harness: Harness,
  options: {
    action?: ArtifactBody;
    acceptanceStatus?: "pass" | "not_applicable";
  } = {},
): ArtifactBody {
  const result = harness.body("WorkResult");
  const evidenceRef = `artifact://${harness.runId}/${EVIDENCE_ID}`;
  result.observations[0].evidenceRefs = [evidenceRef];
  result.inferences = [];
  result.actions = [
    {
      ...(options.action ?? workAction("repository.read", ALLOWED_TARGET)),
      evidenceRefs: [evidenceRef],
    },
  ];
  result.filesChanged = [];
  result.toolEventRefs = [];
  result.evidenceRefs = [evidenceRef];
  result.testResults = [];
  result.acceptanceCoverage = [
    {
      criterionId: "AC-1",
      status: options.acceptanceStatus ?? "pass",
      evidenceRefs:
        options.acceptanceStatus === "not_applicable" ? [] : [evidenceRef],
      rationaleSummary:
        options.acceptanceStatus === "not_applicable"
          ? "The executor marked the required criterion non-applicable."
          : "Direct evidence satisfies the required criterion.",
    },
  ];
  result.unresolvedIssues = [];
  result.deviations = [];
  result.rationaleSummary = "The executor submitted its bounded result.";
  return result;
}

function qualityReview(
  harness: Harness,
  decision: "pass" | "block" = "pass",
): ArtifactBody {
  const review = harness.body("QualityReview");
  const evidenceRef = `artifact://${harness.runId}/${EVIDENCE_ID}`;
  review.acceptanceResults[0].evidenceRefs = [evidenceRef];
  review.ruleCompliance[0].evidenceRefs = [evidenceRef];
  review.verificationResults = [
    {
      requirementId: "VR-1",
      capability: "repository.read",
      status: decision === "pass" ? "pass" : "fail",
      evidenceRefs: [evidenceRef],
      rationaleSummary:
        decision === "pass"
          ? "The completed repository read satisfies verification."
          : "The blocking review rejects the verification result.",
    },
  ];
  review.hardGates[0].evidenceRefs = [evidenceRef];
  review.decision = decision;
  if (decision === "block") {
    review.acceptanceResults[0].status = "fail";
    review.hardGates[0].passed = false;
    review.score = 20;
    review.findings = [
      {
        id: "blocking-quality-finding-01",
        severity: "blocking",
        claim: "The quality gate rejected the current result.",
        sourceRefs: [evidenceRef],
        rubricDimension: "acceptance",
        requiredCorrection: null,
        preserveFields: [],
        correctionFields: [],
        rationaleSummary: "The defect cannot be downgraded by release audit.",
      },
    ];
    review.rationaleSummary =
      "The current result is blocked by quality review.";
  }
  return review;
}

function releaseAudit(
  harness: Harness,
  decision: "release" | "partial",
): ArtifactBody {
  const audit = harness.body("ReleaseAudit");
  const evidenceRef = `artifact://${harness.runId}/${EVIDENCE_ID}`;
  audit.userFidelity[0].evidenceRefs = [evidenceRef];
  audit.decision = decision;
  audit.remainingRemediations = 1;
  audit.remediationDefect = null;
  audit.userReportRef = `artifact://${harness.runId}/user-report-01`;
  if (decision === "partial") {
    audit.claimEvidenceMatrix = [];
    audit.unresolvedRisks = ["Quality review blocked the result."];
    audit.rationaleSummary =
      "This attempted partial decision would downgrade a quality block.";
  }
  return audit;
}

function permissionChecks(harness: Harness) {
  return harness.service
    .getTrace(harness.runId)
    .filter((event) => event.eventType === "permission_checked");
}

describe("remaining controller invariants", () => {
  describe("bounded TaskContract revision", () => {
    it("rejects v2 permissions that broaden the v1 contract", async () => {
      const harness = await framedHarness();
      submitContract(harness, ["apps/web/**"]);
      submitRevisionReview(
        harness,
        ["objective", "intentMode"],
        "Clarify only the required output wording.",
      );

      expect(() =>
        submitRevisedContract(harness, (contract) => {
          contract.permissions = readPermissions(["**"]);
        }),
      ).toThrow(/permission.*broaden|exceed.*prior|revision.*permission/i);
    });

    it("rejects a v2 change outside the review's explicit correction", async () => {
      const harness = await framedHarness();
      submitContract(harness);
      submitRevisionReview(
        harness,
        ["objective", "intentMode", "permissions"],
        "Change only the requiredOutputs wording.",
      );

      expect(() =>
        submitRevisedContract(harness, (contract) => {
          contract.scope.include = [...contract.scope.include, "infra"];
        }),
      ).toThrow(/revision.*field|outside.*correction|unauthorized.*change/i);
    });
  });

  describe("terminal outcome monotonicity", () => {
    it.each(["partial", "release"] as const)(
      "rejects ReleaseAudit %s after QualityReview block",
      async (decision) => {
        const harness = await executorHarness();
        harness.submit("WorkResult", "executor", workResult(harness));
        harness.submit(
          "QualityReview",
          "quality_controller",
          qualityReview(harness, "block"),
        );

        expect(() =>
          harness.submit(
            "ReleaseAudit",
            "release_auditor",
            releaseAudit(harness, decision),
          ),
        ).toThrow(
          /passing current QualityReview|quality.*block|blocked.*(?:partial|release)|downgrade/i,
        );
      },
    );
  });

  describe("required acceptance cannot be non-applicable", () => {
    it("rejects completed WorkResult not_applicable coverage", async () => {
      const harness = await executorHarness();
      expect(() =>
        harness.submit(
          "WorkResult",
          "executor",
          workResult(harness, { acceptanceStatus: "not_applicable" }),
        ),
      ).toThrow(/required.*acceptance|not_applicable|must pass/i);
    });

    it("rejects passing QualityReview not_applicable acceptance", async () => {
      const harness = await executorHarness();
      harness.submit("WorkResult", "executor", workResult(harness));
      const review = qualityReview(harness);
      review.acceptanceResults[0].status = "not_applicable";
      review.acceptanceResults[0].evidenceRefs = [];

      expect(() =>
        harness.submit("QualityReview", "quality_controller", review),
      ).toThrow(/required.*acceptance|not_applicable|must pass/i);
    });
  });

  it("deduplicates identical rejected WorkResult DENY traces", async () => {
    const harness = await executorHarness();
    const rejected = workResult(harness, {
      action: workAction("repository.read", DENIED_TARGET),
    });

    expect(() => harness.submit("WorkResult", "executor", rejected)).toThrow(
      /outside node|scope|permission/i,
    );
    expect(() =>
      harness.submit("WorkResult", "executor", structuredClone(rejected)),
    ).toThrow(/outside node|scope|permission/i);

    const matchingDenials = permissionChecks(harness).filter(
      (event) =>
        event.permissionDecision?.decision === "deny" &&
        event.permissionDecision.capability === "repository.read" &&
        event.permissionDecision.scope === DENIED_TARGET,
    );
    expect(matchingDenials).toHaveLength(1);
  });

  it("records DENY when analyze_only receives an attempted mutation", async () => {
    const harness = await executorHarness();
    const attemptedMutation = workResult(harness, {
      action: workAction("repository.write", "src/fix.ts"),
    });

    expect(() =>
      harness.submit("WorkResult", "executor", attemptedMutation),
    ).toThrow(/cannot accept mutating|mutation|permission/i);

    const denials = permissionChecks(harness).filter(
      (event) => event.permissionDecision?.decision === "deny",
    );
    expect(denials).toHaveLength(1);
    expect(denials[0]?.permissionDecision).toMatchObject({
      decision: "deny",
      capability: "repository.write",
      scope: "src/fix.ts",
    });
  });
});
