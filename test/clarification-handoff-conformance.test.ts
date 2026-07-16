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
type PausablePhase =
  | "context_grounding"
  | "agent_1_frame"
  | "agent_2_compile"
  | "agent_1_review"
  | "agent_2_revise"
  | "agent_3_plan"
  | "agent_4_execute"
  | "agent_3_review";

interface PhaseCase {
  phase: PausablePhase;
  producer:
    | "controller"
    | "scenario_author"
    | "task_compiler"
    | "quality_controller"
    | "executor";
  protocolPhase:
    | "context_discovery"
    | "agent_1_frame"
    | "agent_2_compile"
    | "agent_1_review"
    | "agent_2_revision"
    | "agent_3_plan"
    | "agent_4_execute"
    | "agent_3_quality_review";
}

interface Harness {
  service: TelicService;
  runId: string;
  requestId: string;
  requestRef: string;
  body: (type: keyof typeof VALID_ARTIFACT_BODIES) => ArtifactBody;
  submit: (
    type: string,
    producer: string,
    body: ArtifactBody,
  ) => ReturnType<TelicService["submitArtifact"]>;
}

const REPOSITORY_REF = "repo://apps/web/src/api.ts";
const RULE_REF = "repo://AGENTS.md";
const services: TelicService[] = [];

const PAUSABLE_PHASES: readonly PhaseCase[] = [
  {
    phase: "context_grounding",
    producer: "controller",
    protocolPhase: "context_discovery",
  },
  {
    phase: "agent_1_frame",
    producer: "scenario_author",
    protocolPhase: "agent_1_frame",
  },
  {
    phase: "agent_2_compile",
    producer: "task_compiler",
    protocolPhase: "agent_2_compile",
  },
  {
    phase: "agent_1_review",
    producer: "scenario_author",
    protocolPhase: "agent_1_review",
  },
  {
    phase: "agent_2_revise",
    producer: "task_compiler",
    protocolPhase: "agent_2_revision",
  },
  {
    phase: "agent_3_plan",
    producer: "quality_controller",
    protocolPhase: "agent_3_plan",
  },
  {
    phase: "agent_4_execute",
    producer: "executor",
    protocolPhase: "agent_4_execute",
  },
  {
    phase: "agent_3_review",
    producer: "quality_controller",
    protocolPhase: "agent_3_quality_review",
  },
];

afterEach(() => {
  for (const service of services.splice(0)) service.close();
});

function readPermissions(): ArtifactBody {
  const permissions = structuredClone(NO_PERMISSIONS) as ArtifactBody;
  permissions.repository.read = ["**"];
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

async function createHarness(): Promise<Harness> {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), "telic-clarification-repo-"),
  );
  mkdirSync(join(repositoryRoot, "apps/web/src"), { recursive: true });
  mkdirSync(join(repositoryRoot, "apps/api"), { recursive: true });
  writeFileSync(
    join(repositoryRoot, "AGENTS.md"),
    "# Rules\nClarifications must preserve exact artifact lineage.\n",
  );
  writeFileSync(
    join(repositoryRoot, "apps/web/src/api.ts"),
    "export const endpoint = '/api/projects';\n",
  );
  writeFileSync(
    join(repositoryRoot, "apps/api/cors.ts"),
    "export const allowedOrigins = ['http://localhost:5173'];\n",
  );

  const service = new TelicService({
    repositoryRoot,
    stateDirectory: mkdtempSync(join(tmpdir(), "telic-clarification-state-")),
  });
  services.push(service);
  const started = service.startRun({
    originalRequest:
      "Investigate the bounded apps/web API communication issue.",
    mode: "analyze_only",
    hostName: "clarification-conformance-host",
    nativeSubagents: "unavailable",
    hostCapabilities: ["repository.read"],
    authorizationGranted: ["repository.read"],
  });
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

  return {
    service,
    runId: started.run.runId,
    requestId: request.id,
    requestRef: `artifact://${started.run.runId}/${request.id}`,
    body,
    submit,
  };
}

async function groundContext(harness: Harness): Promise<void> {
  const grounded = await harness.service.groundContext({
    runId: harness.runId,
    activePaths: ["AGENTS.md", "apps/web/src/api.ts", "apps/api/cors.ts"],
  });
  const selected = new Set(grounded.manifest.pinnedRefs);
  for (const candidate of grounded.manifest.candidates) {
    if (candidate.decision === "selected") selected.add(candidate.ref);
  }
  if (!selected.has(REPOSITORY_REF) || !selected.has(RULE_REF)) {
    throw new Error("active repository and rule references must be selected");
  }
}

function submitFrame(harness: Harness): void {
  const frame = harness.body("ProblemFrame");
  frame.applicableRuleRefs = [RULE_REF];
  harness.submit("ProblemFrame", "scenario_author", frame);
}

function submitContract(harness: Harness): void {
  const contract = harness.body("TaskContract");
  contract.contextRefs = [REPOSITORY_REF];
  contract.ruleRefs = [RULE_REF];
  contract.permissions = readPermissions();
  contract.verificationRequirements = [
    {
      id: "VR-1",
      stage: "completion",
      description: "Capture direct bounded repository evidence.",
      required: true,
      capability: "repository.read",
      fallback: "Report the unresolved boundary honestly.",
    },
  ];
  harness.submit("TaskContract", "task_compiler", contract);
}

function submitReview(harness: Harness, decision: "pass" | "revise"): void {
  const review = harness.body("PromptReview");
  review.decision = decision;
  if (decision === "revise") {
    review.hardGates[0].passed = false;
    review.overallScore = 80;
    review.dimensionScores = {
      intentFidelity: 80,
      repositoryGrounding: 80,
      constraintsAndPermissions: 80,
      testableAcceptance: 80,
      executionFeasibility: 80,
      contextEfficiency: 80,
    };
    review.findings = [
      {
        id: "prompt-finding-01",
        severity: "blocking",
        claim: "The contract needs one bounded clarification before planning.",
        sourceRefs: [`artifact://${harness.runId}/contract-01`],
        rubricDimension: "testableAcceptance",
        requiredCorrection: "Record the user-owned local-only choice.",
        preserveFields: ["objective", "intentMode", "permissions"],
        correctionFields: ["unresolvedQuestions"],
        rationaleSummary:
          "One revision can preserve intent while resolving the choice.",
      },
    ];
  }
  harness.submit("PromptReview", "scenario_author", review);
}

function submitPlan(harness: Harness): void {
  const plan = harness.body("WorkPlan");
  plan.nodes[0].allowedTools = ["repository.read"];
  plan.nodes[0].requiredCapabilities = ["repository.read"];
  plan.nodes[0].contextRefs = [REPOSITORY_REF];
  plan.nodes[0].permissions = readPermissions();
  plan.nodes[0].budgets.maximumToolCalls = 1;
  plan.nodes[0].budgets.maximumChildren = 0;
  plan.globalBudgets.maximumToolCalls = 1;
  plan.globalBudgets.maximumParallelWorkers = 1;
  plan.globalBudgets.maximumSubagentDepth = 0;
  harness.submit("WorkPlan", "quality_controller", plan);
}

function submitEvidenceAndResult(harness: Harness): void {
  harness.submit("Evidence", "executor", {
    schemaVersion: "1.0",
    id: "evidence-01",
    runId: harness.runId,
    kind: "repository",
    capturedAt: "2026-07-15T10:05:00Z",
    summary: "Captured the bounded repository request path.",
    contentType: "application/json",
    encoding: "utf8",
    content: '{"path":"/api/projects"}',
    sourceRefs: [],
    redactions: [],
    rationaleSummary:
      "The local evidence contains no credential or personal data.",
  });
  const result = harness.body("WorkResult");
  const evidenceRef = `artifact://${harness.runId}/evidence-01`;
  result.observations[0].evidenceRefs = [evidenceRef];
  result.inferences = [];
  result.actions = [
    {
      id: "action-read-api",
      capability: "repository.read",
      target: "apps/web/src/api.ts",
      mutating: false,
      status: "completed",
      evidenceRefs: [evidenceRef],
      rationaleSummary: "The action read only the selected repository path.",
    },
  ];
  result.filesChanged = [];
  result.toolEventRefs = [];
  result.evidenceRefs = [evidenceRef];
  result.testResults = [];
  result.acceptanceCoverage[0].evidenceRefs = [evidenceRef];
  harness.submit("WorkResult", "executor", result);
}

async function advanceToPhase(
  harness: Harness,
  target: PausablePhase,
): Promise<void> {
  if (target === "context_grounding") return;
  await groundContext(harness);
  if (target === "agent_1_frame") return;
  submitFrame(harness);
  if (target === "agent_2_compile") return;
  submitContract(harness);
  if (target === "agent_1_review") return;
  if (target === "agent_2_revise") {
    submitReview(harness, "revise");
    return;
  }
  submitReview(harness, "pass");
  if (target === "agent_3_plan") return;
  submitPlan(harness);
  if (target === "agent_4_execute") return;
  submitEvidenceAndResult(harness);
}

function clarificationBody(
  harness: Harness,
  phase: PausablePhase,
): ArtifactBody {
  return {
    schemaVersion: "1.0",
    id: `clarification-${phase.replaceAll("_", "-")}`,
    runId: harness.runId,
    question: `Which user-owned choice should resume ${phase}?`,
    reason: "user_owned_materially_divergent",
    divergence: "Different answers materially change the bounded output.",
    evidenceInspected: [harness.requestRef],
    blockedBoundary: "user_owned_scope",
    responseConstraints: "Choose the local option or cancel the run.",
    responseChoices: [
      {
        id: "local-only",
        label: "Local only",
        consequence: "Resume without broadening authority or external scope.",
        authorityEffect: "within_current_authority",
        runEffect: "resume",
      },
      {
        id: "cancel",
        label: "Cancel",
        consequence: "Stop the current run without project mutation.",
        authorityEffect: "within_current_authority",
        runEffect: "cancel",
      },
    ],
    permissionExpansionRequired: false,
    rationaleSummary:
      "Repository evidence cannot determine this user-owned choice.",
  };
}

describe("clarification handoff conformance", () => {
  it.each(PAUSABLE_PHASES)(
    "preserves exact request/answer lineage when resuming $phase",
    async ({ phase, producer, protocolPhase }) => {
      const harness = await createHarness();
      await advanceToPhase(harness, phase);
      expect(harness.service.getRun(harness.runId).run.phase).toBe(phase);

      const requestBody = clarificationBody(harness, phase);
      const clarificationRef = `artifact://${harness.runId}/${requestBody.id}`;
      const paused = harness.submit(
        "ClarificationRequest",
        producer,
        requestBody,
      );
      expect(paused.nextAction).toMatchObject({
        kind: "clarification",
        phase: "awaiting_clarification",
        clarificationRequestRef: clarificationRef,
      });
      const storedRequest = harness.service.getArtifact(
        harness.runId,
        requestBody.id,
      );
      expect(storedRequest).toMatchObject({
        type: "ClarificationRequest",
        producer,
        body: requestBody,
      });

      const answerText = "local-only";
      const resumed = harness.service.answerClarification(
        harness.runId,
        answerText,
      );
      const answerRecord = harness.service
        .getRun(harness.runId)
        .artifacts.filter((artifact) => artifact.type === "UserMessage")
        .find((artifact) => artifact.id !== harness.requestId);
      if (!answerRecord)
        throw new Error("clarification answer artifact expected");
      const answerRef = `artifact://${harness.runId}/${answerRecord.id}`;
      const answer = harness.service.getArtifact(
        harness.runId,
        answerRecord.id,
      );

      expect.soft(answer.body).toMatchObject({ content: answerText });
      expect.soft(answer.sourceRefs).toContain(clarificationRef);
      expect.soft(resumed.run).toMatchObject({
        status: "running",
        phase,
        resumePhase: null,
      });
      expect.soft(resumed.nextAction).toMatchObject({
        kind: "phase",
        phase: protocolPhase,
      });
      if (resumed.nextAction.kind === "phase") {
        expect
          .soft(resumed.nextAction.inputRefs)
          .toEqual(expect.arrayContaining([clarificationRef, answerRef]));
      }

      const trace = harness.service.getTrace(harness.runId);
      const requested = trace.find((event) =>
        event.outputRefs.includes(clarificationRef),
      );
      const answered = trace.find((event) =>
        event.outputRefs.includes(answerRef),
      );
      expect.soft(requested).toBeDefined();
      expect.soft(requested?.eventType).toBe("clarification_requested");
      expect.soft(requested?.phase).toBe(protocolPhase);
      expect.soft(requested?.inputRefs).toContain(harness.requestRef);
      expect.soft(answered).toBeDefined();
      expect.soft(answered?.eventType).toBe("transition_allowed");
      expect.soft(answered?.phase).toBe(protocolPhase);
      expect.soft(answered?.inputRefs).toContain(clarificationRef);
    },
  );
});
