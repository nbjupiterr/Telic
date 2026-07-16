import { z } from "zod";

import {
  ArtifactUriSchema,
  BoundedTextSchema,
  FindingSchema,
  IdentifierSchema,
  IntentModeSchema,
  MAX_COLLECTION_ITEMS,
  PermissionSetSchema,
  ReferenceUriSchema,
  RunIdSchema,
  SchemaVersionSchema,
  SummarySchema,
  TaskContractFieldSchema,
  TaskContractCorrectionFieldSchema,
  VerificationCapabilitySchema,
} from "./common.js";

export const ScopeSchema = z
  .object({
    include: z.array(z.string().min(1).max(1_024)).max(MAX_COLLECTION_ITEMS),
    exclude: z.array(z.string().min(1).max(1_024)).max(MAX_COLLECTION_ITEMS),
  })
  .strict();

export const GroundedFactSchema = z
  .object({
    id: IdentifierSchema,
    claim: BoundedTextSchema,
    provenance: z.enum(["user", "repository", "runtime", "browser", "tool"]),
    sourceRef: ReferenceUriSchema,
  })
  .strict();

export const GroundedInferenceSchema = z
  .object({
    id: IdentifierSchema,
    claim: BoundedTextSchema,
    sourceRefs: z.array(ReferenceUriSchema).min(1).max(MAX_COLLECTION_ITEMS),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const UnknownSchema = z
  .object({
    id: IdentifierSchema,
    question: BoundedTextSchema,
    classification: z.enum([
      "discoverable",
      "bounded_reversible",
      "user_owned_materially_divergent",
      "permission_expanding",
      "irrelevant",
    ]),
    impact: SummarySchema,
    evidenceInspected: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
  })
  .strict();

export const DraftAcceptanceCriterionSchema = z
  .object({
    id: IdentifierSchema,
    stage: z.enum(["diagnosis", "completion"]),
    requirement: BoundedTextSchema,
    evidenceRequired: z
      .array(z.string().min(1).max(255))
      .min(1)
      .max(MAX_COLLECTION_ITEMS),
  })
  .strict();

const NoClarificationSchema = z
  .object({
    required: z.literal(false),
    reason: SummarySchema.nullable(),
  })
  .strict();

const RequiredClarificationSchema = z
  .object({
    required: z.literal(true),
    reason: SummarySchema,
    requestRef: ArtifactUriSchema,
  })
  .strict();

export const ProblemFrameSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    runId: RunIdSchema,
    originalRequestRef: ArtifactUriSchema,
    intentMode: IntentModeSchema,
    goal: BoundedTextSchema,
    knownFacts: z.array(GroundedFactSchema).max(MAX_COLLECTION_ITEMS),
    inferences: z.array(GroundedInferenceSchema).max(MAX_COLLECTION_ITEMS),
    unknowns: z.array(UnknownSchema).max(MAX_COLLECTION_ITEMS),
    scope: ScopeSchema,
    constraints: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    nonGoals: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    applicableRuleRefs: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
    draftAcceptanceCriteria: z
      .array(DraftAcceptanceCriterionSchema)
      .max(MAX_COLLECTION_ITEMS),
    clarification: z.discriminatedUnion("required", [
      NoClarificationSchema,
      RequiredClarificationSchema,
    ]),
    rationaleSummary: SummarySchema,
  })
  .strict()
  .superRefine((frame, context) => {
    const identifiers = [
      ...frame.knownFacts.map((entry) => ({
        id: entry.id,
        path: "knownFacts",
      })),
      ...frame.inferences.map((entry) => ({
        id: entry.id,
        path: "inferences",
      })),
      ...frame.unknowns.map((entry) => ({
        id: entry.id,
        path: "unknowns",
      })),
      ...frame.draftAcceptanceCriteria.map((entry) => ({
        id: entry.id,
        path: "draftAcceptanceCriteria",
      })),
    ];
    const seenIdentifiers = new Set<string>();
    for (const identifier of identifiers) {
      if (seenIdentifiers.has(identifier.id)) {
        context.addIssue({
          code: "custom",
          path: [identifier.path],
          message: `ProblemFrame identifier ${identifier.id} must be unique across the frame`,
        });
      }
      seenIdentifiers.add(identifier.id);
    }
    const divergentUnknown = frame.unknowns.some(
      (unknown) =>
        unknown.classification === "user_owned_materially_divergent" ||
        unknown.classification === "permission_expanding",
    );

    if (divergentUnknown && !frame.clarification.required) {
      context.addIssue({
        code: "custom",
        path: ["clarification", "required"],
        message:
          "Materially divergent or permission-expanding unknowns require clarification",
      });
    }
  });

export const ScenarioSpecSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    runId: RunIdSchema,
    problemFrameRef: ArtifactUriSchema,
    title: z.string().min(1).max(255),
    narrative: BoundedTextSchema,
    actor: z.string().min(1).max(512),
    observableSymptoms: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    desiredOutcome: BoundedTextSchema,
    sourceMap: z
      .array(
        z
          .object({
            field: z.string().min(1).max(255),
            sourceRefs: z
              .array(ReferenceUriSchema)
              .min(1)
              .max(MAX_COLLECTION_ITEMS),
          })
          .strict(),
      )
      .max(MAX_COLLECTION_ITEMS),
    promptReadinessRubricRef: ArtifactUriSchema,
    rationaleSummary: SummarySchema,
  })
  .strict();

export const AcceptanceCriterionSchema = z
  .object({
    id: IdentifierSchema,
    stage: z.enum(["diagnosis", "completion"]),
    requirement: BoundedTextSchema,
    evidenceRequired: z
      .array(z.string().min(1).max(255))
      .min(1)
      .max(MAX_COLLECTION_ITEMS),
  })
  .strict();

export const VerificationRequirementSchema = z
  .object({
    id: IdentifierSchema,
    stage: z.enum(["diagnosis", "completion"]),
    description: BoundedTextSchema,
    required: z.boolean(),
    capability: VerificationCapabilitySchema,
    fallback: BoundedTextSchema.nullable(),
  })
  .strict();

export const AssumptionSchema = z
  .object({
    id: IdentifierSchema,
    text: BoundedTextSchema,
    sourceRefs: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
    reversible: z.boolean(),
  })
  .strict();

export const TaskContractSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    runId: RunIdSchema,
    version: z.number().int().min(1).max(2),
    originalRequestRef: ArtifactUriSchema,
    problemFrameRef: ArtifactUriSchema,
    intentMode: IntentModeSchema,
    objective: BoundedTextSchema,
    scope: ScopeSchema,
    constraints: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    nonGoals: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    contextRefs: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
    ruleRefs: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
    permissions: PermissionSetSchema,
    acceptanceCriteria: z
      .array(AcceptanceCriterionSchema)
      .min(1)
      .max(MAX_COLLECTION_ITEMS),
    requiredOutputs: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    verificationRequirements: z
      .array(VerificationRequirementSchema)
      .max(MAX_COLLECTION_ITEMS),
    stopConditions: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    assumptions: z.array(AssumptionSchema).max(MAX_COLLECTION_ITEMS),
    unresolvedQuestions: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    rationaleSummary: SummarySchema,
  })
  .strict()
  .superRefine((contract, context) => {
    const criterionIds = new Set<string>();
    for (const [index, criterion] of contract.acceptanceCriteria.entries()) {
      if (criterionIds.has(criterion.id)) {
        context.addIssue({
          code: "custom",
          path: ["acceptanceCriteria", index, "id"],
          message: "Acceptance criterion identifiers must be unique",
        });
      }
      criterionIds.add(criterion.id);
    }
    const verificationIds = contract.verificationRequirements.map(
      (requirement) => requirement.id,
    );
    if (new Set(verificationIds).size !== verificationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["verificationRequirements"],
        message: "Verification requirement identifiers must be unique",
      });
    }
    const requiredVerification = contract.verificationRequirements.filter(
      (requirement) => requirement.required,
    );
    if (
      ["analyze_only", "fix_only", "analyze_and_fix"].includes(
        contract.intentMode,
      ) &&
      requiredVerification.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationRequirements"],
        message: "Execution modes require at least one required verification",
      });
    }
    if (contract.intentMode === "analyze_and_fix") {
      const stages = new Set(
        contract.acceptanceCriteria.map((criterion) => criterion.stage),
      );
      if (!stages.has("diagnosis") || !stages.has("completion")) {
        context.addIssue({
          code: "custom",
          path: ["acceptanceCriteria"],
          message:
            "analyze_and_fix requires both diagnosis and completion acceptance criteria",
        });
      }
      const verificationStages = new Set(
        requiredVerification.map((requirement) => requirement.stage),
      );
      if (
        !verificationStages.has("diagnosis") ||
        !verificationStages.has("completion")
      ) {
        context.addIssue({
          code: "custom",
          path: ["verificationRequirements"],
          message:
            "analyze_and_fix requires required diagnosis and completion verification",
        });
      }
    } else if (
      contract.verificationRequirements.some(
        (requirement) => requirement.stage === "diagnosis",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationRequirements"],
        message: "Diagnosis-stage verification is reserved for analyze_and_fix",
      });
    }

    if (
      ["report_only", "plan_only", "analyze_only"].includes(
        contract.intentMode,
      ) &&
      (contract.permissions.repository.write.length > 0 ||
        contract.permissions.repository.delete.length > 0 ||
        contract.permissions.runtime.restart.length > 0 ||
        contract.permissions.browser.mutateState ||
        contract.permissions.network.externalWrite)
    ) {
      context.addIssue({
        code: "custom",
        path: ["permissions"],
        message: `${contract.intentMode} cannot authorize mutation`,
      });
    }
  });

export const ContractCoverageSchema = z
  .object({
    sourceRef: ReferenceUriSchema,
    contractFields: z
      .array(TaskContractFieldSchema)
      .min(1)
      .max(MAX_COLLECTION_ITEMS),
    status: z.enum(["covered", "partial", "missing"]),
  })
  .strict();

export const ContractReadinessScoresSchema = z
  .object({
    intentFidelity: z.number().min(0).max(100),
    repositoryGrounding: z.number().min(0).max(100),
    constraintsAndPermissions: z.number().min(0).max(100),
    testableAcceptance: z.number().min(0).max(100),
    executionFeasibility: z.number().min(0).max(100),
    contextEfficiency: z.number().min(0).max(100),
  })
  .strict();

export const HardGateResultSchema = z
  .object({
    id: IdentifierSchema,
    passed: z.boolean(),
    description: BoundedTextSchema,
    evidenceRefs: z.array(ReferenceUriSchema).min(1).max(MAX_COLLECTION_ITEMS),
    rationaleSummary: SummarySchema,
  })
  .strict();

export const PromptReviewSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    runId: RunIdSchema,
    targetRef: ArtifactUriSchema,
    rubricId: z.literal("contract-readiness-v1"),
    revisionNumber: z.number().int().min(0).max(1),
    coverage: z.array(ContractCoverageSchema).max(MAX_COLLECTION_ITEMS),
    dimensionScores: ContractReadinessScoresSchema,
    overallScore: z.number().min(0).max(100),
    hardGates: z.array(HardGateResultSchema).min(1).max(MAX_COLLECTION_ITEMS),
    findings: z.array(FindingSchema).max(MAX_COLLECTION_ITEMS),
    decision: z.enum(["pass", "revise", "block"]),
    rationaleSummary: SummarySchema,
  })
  .strict()
  .superRefine((review, context) => {
    const weightedScore =
      review.dimensionScores.intentFidelity * 0.3 +
      review.dimensionScores.repositoryGrounding * 0.2 +
      review.dimensionScores.constraintsAndPermissions * 0.15 +
      review.dimensionScores.testableAcceptance * 0.2 +
      review.dimensionScores.executionFeasibility * 0.1 +
      review.dimensionScores.contextEfficiency * 0.05;
    const expectedOverallScore = Math.round(weightedScore * 100) / 100;
    if (review.overallScore !== expectedOverallScore) {
      context.addIssue({
        code: "custom",
        path: ["overallScore"],
        message: `Overall score must equal the contract-readiness-v1 weighted score ${String(expectedOverallScore)}`,
      });
    }
    const failedGate = review.hardGates.some((gate) => !gate.passed);
    const blockingFinding = review.findings.some(
      (finding) => finding.severity === "blocking",
    );

    if (review.decision === "pass" && (failedGate || blockingFinding)) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message:
          "A review with a failed hard gate or blocking finding cannot pass",
      });
    }

    if (review.decision === "block" && !failedGate && !blockingFinding) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message:
          "A blocked contract review requires a failed hard gate or blocking finding",
      });
    }

    if (
      review.decision === "pass" &&
      (review.overallScore < 80 ||
        review.coverage.length === 0 ||
        review.coverage.some((entry) => entry.status !== "covered"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message:
          "A passing contract review requires complete coverage and a score of at least 80",
      });
    }

    if (review.decision === "revise") {
      if (review.revisionNumber >= 1) {
        context.addIssue({
          code: "custom",
          path: ["revisionNumber"],
          message: "The single prompt revision budget is exhausted",
        });
      }
      if (
        !review.findings.some(
          (finding) =>
            finding.severity === "blocking" &&
            finding.requiredCorrection !== null,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["findings"],
          message:
            "A revision requires a blocking finding with a required correction",
        });
      }
      const correctionFields = review.findings.flatMap(
        (finding) => finding.correctionFields,
      );
      if (
        correctionFields.length === 0 ||
        !correctionFields.every(
          (field) => TaskContractCorrectionFieldSchema.safeParse(field).success,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["findings"],
          message:
            "A revision requires at least one typed TaskContract correction field",
        });
      }
    }
  });

export type Scope = z.infer<typeof ScopeSchema>;
export type GroundedFact = z.infer<typeof GroundedFactSchema>;
export type GroundedInference = z.infer<typeof GroundedInferenceSchema>;
export type Unknown = z.infer<typeof UnknownSchema>;
export type ProblemFrame = z.infer<typeof ProblemFrameSchema>;
export type ScenarioSpec = z.infer<typeof ScenarioSpecSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type TaskContract = z.infer<typeof TaskContractSchema>;
export type PromptReview = z.infer<typeof PromptReviewSchema>;
