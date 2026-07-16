import type { ArtifactSubmission, Phase, RunRecord } from "./types.js";

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

const expectedByPhase: Record<Phase, string[]> = {
  context_grounding: ["ContextManifest", "ClarificationRequest"],
  agent_1_frame: ["ProblemFrame", "ClarificationRequest"],
  agent_2_compile: ["TaskContract", "ClarificationRequest"],
  agent_1_review: ["PromptReview", "ClarificationRequest"],
  agent_2_revise: ["TaskContract", "ClarificationRequest"],
  agent_3_plan: ["WorkPlan", "ClarificationRequest"],
  agent_4_execute: ["WorkResult", "ClarificationRequest"],
  agent_3_review: ["QualityReview", "ClarificationRequest"],
  agent_5_audit: ["ReleaseAudit"],
  agent_5_report: ["UserReport"],
};

export function requiredArtifactTypes(run: RunRecord): string[] {
  return [...expectedByPhase[run.phase]];
}

function decisionFrom(body: unknown): string {
  if (typeof body !== "object" || body === null || !("decision" in body)) {
    throw new TransitionError("Review artifact is missing its decision field");
  }
  const decision = (body as { decision: unknown }).decision;
  if (typeof decision !== "string") {
    throw new TransitionError("Review decision must be a string");
  }
  return decision;
}

function terminalStatusFrom(body: unknown): RunRecord["status"] {
  if (
    typeof body !== "object" ||
    body === null ||
    !("terminalStatus" in body)
  ) {
    throw new TransitionError("UserReport is missing terminalStatus");
  }
  const status = (body as { terminalStatus: unknown }).terminalStatus;
  if (status === "completed") return "completed";
  if (status === "partial" || status === "failed_verification")
    return "partial";
  if (status === "blocked") return "blocked";
  throw new TransitionError(`Unsupported terminal status: ${String(status)}`);
}

function move(run: RunRecord, phase: Phase): RunRecord {
  return { ...run, phase, status: "running", resumePhase: null };
}

export interface TransitionResult {
  run: RunRecord;
  summary: string;
  budgetConsumed: "prompt_revision" | "post_execution_remediation" | null;
}

export function advanceRun(
  run: RunRecord,
  artifact: ArtifactSubmission,
  options: { executionComplete?: boolean } = {},
): TransitionResult {
  if (run.status !== "running") {
    throw new TransitionError(`Run ${run.runId} is ${run.status}, not running`);
  }
  if (artifact.runId !== run.runId) {
    throw new TransitionError("Artifact belongs to a different run");
  }
  if (!expectedByPhase[run.phase].includes(artifact.type)) {
    throw new TransitionError(
      `Phase ${run.phase} requires ${expectedByPhase[run.phase].join(" or ")}; received ${artifact.type}`,
    );
  }

  if (artifact.type === "ClarificationRequest") {
    return {
      run: { ...run, status: "awaiting_clarification", resumePhase: run.phase },
      summary: `Paused ${run.phase} for a materially divergent user decision.`,
      budgetConsumed: null,
    };
  }

  switch (run.phase) {
    case "context_grounding":
      return {
        run: move(run, "agent_1_frame"),
        summary: "Repository context was grounded; framing is next.",
        budgetConsumed: null,
      };
    case "agent_1_frame":
      return {
        run: move(run, "agent_2_compile"),
        summary: "Problem frame accepted; task compilation is next.",
        budgetConsumed: null,
      };
    case "agent_2_compile":
    case "agent_2_revise":
      return {
        run: move(run, "agent_1_review"),
        summary: "Task contract accepted for frozen-rubric review.",
        budgetConsumed: null,
      };
    case "agent_1_review": {
      const decision = decisionFrom(artifact.body);
      if (decision === "pass") {
        return {
          run: move(run, "agent_3_plan"),
          summary: "Contract review passed; work planning is next.",
          budgetConsumed: null,
        };
      }
      if (decision === "revise") {
        if (run.budgets.promptRevisionsRemaining === 0) {
          return {
            run: {
              ...move(run, "agent_5_report"),
              outcomeHint: "blocked",
            },
            summary:
              "Prompt revision budget exhausted; a final blocked report is required.",
            budgetConsumed: null,
          };
        }
        return {
          run: {
            ...move(run, "agent_2_revise"),
            budgets: {
              ...run.budgets,
              promptRevisionsRemaining:
                run.budgets.promptRevisionsRemaining - 1,
            },
          },
          summary: "One bounded task-contract revision was authorized.",
          budgetConsumed: "prompt_revision",
        };
      }
      if (decision === "block") {
        return {
          run: {
            ...move(run, "agent_5_report"),
            outcomeHint: "blocked",
          },
          summary:
            "Contract review found an uncorrectable hard gate; a final blocked report is required.",
          budgetConsumed: null,
        };
      }
      throw new TransitionError(
        `Unsupported PromptReview decision: ${decision}`,
      );
    }
    case "agent_3_plan":
      return {
        run: move(
          run,
          run.requestedMode === "plan_only" ||
            run.requestedMode === "report_only"
            ? "agent_3_review"
            : "agent_4_execute",
        ),
        summary:
          run.requestedMode === "plan_only" ||
          run.requestedMode === "report_only"
            ? `${run.requestedMode} skips execution; plan quality review is next.`
            : "Work plan accepted; bounded execution is next.",
        budgetConsumed: null,
      };
    case "agent_4_execute":
      if (options.executionComplete === false) {
        return {
          run: move(run, "agent_4_execute"),
          summary:
            "Work result accepted; another dependency-ready work node remains.",
          budgetConsumed: null,
        };
      }
      return {
        run: move(run, "agent_3_review"),
        summary: "Work result accepted for evidence-based quality review.",
        budgetConsumed: null,
      };
    case "agent_3_review": {
      const decision = decisionFrom(artifact.body);
      if (decision === "proceed_to_fix") {
        if (run.requestedMode !== "analyze_and_fix") {
          throw new TransitionError(
            "Only analyze_and_fix may progress from diagnosis to a fix plan",
          );
        }
        return {
          run: move(run, "agent_3_plan"),
          summary:
            "Diagnosis review passed the mutation gate; a separately bounded fix plan is next.",
          budgetConsumed: null,
        };
      }
      if (
        decision === "pass" ||
        decision === "partial" ||
        decision === "block"
      ) {
        return {
          run: {
            ...move(run, "agent_5_audit"),
            outcomeHint:
              decision === "pass"
                ? run.outcomeHint
                : decision === "block"
                  ? "blocked"
                  : "partial",
          },
          summary: `Quality review recorded ${decision}; independent release audit is next.`,
          budgetConsumed: null,
        };
      }
      if (decision === "remediate") {
        if (run.budgets.postExecutionRemediationsRemaining === 0) {
          return {
            run: { ...move(run, "agent_5_audit"), outcomeHint: "blocked" },
            summary:
              "Shared remediation budget exhausted; release audit must report the defect.",
            budgetConsumed: null,
          };
        }
        return {
          run: {
            ...move(run, "agent_3_plan"),
            budgets: {
              ...run.budgets,
              postExecutionRemediationsRemaining:
                run.budgets.postExecutionRemediationsRemaining - 1,
            },
          },
          summary:
            "The shared post-execution remediation was consumed; scoped replanning is next.",
          budgetConsumed: "post_execution_remediation",
        };
      }
      throw new TransitionError(
        `Unsupported QualityReview decision: ${decision}`,
      );
    }
    case "agent_5_audit": {
      const decision = decisionFrom(artifact.body);
      if (
        decision === "release" ||
        decision === "partial" ||
        decision === "block"
      ) {
        return {
          run: {
            ...move(run, "agent_5_report"),
            outcomeHint:
              decision === "release"
                ? (run.outcomeHint ?? "completed")
                : decision === "partial"
                  ? "partial"
                  : "blocked",
          },
          summary: `Release audit recorded ${decision}; final evidence report is next.`,
          budgetConsumed: null,
        };
      }
      if (decision === "remediate") {
        if (run.budgets.postExecutionRemediationsRemaining === 0) {
          return {
            run: { ...move(run, "agent_5_report"), outcomeHint: "blocked" },
            summary:
              "Release audit found a defect after the shared remediation budget was exhausted.",
            budgetConsumed: null,
          };
        }
        return {
          run: {
            ...move(run, "agent_3_plan"),
            outcomeHint: null,
            budgets: {
              ...run.budgets,
              postExecutionRemediationsRemaining:
                run.budgets.postExecutionRemediationsRemaining - 1,
            },
          },
          summary:
            "Release audit consumed the shared remediation; control returned to Agent 3.",
          budgetConsumed: "post_execution_remediation",
        };
      }
      throw new TransitionError(
        `Unsupported ReleaseAudit decision: ${decision}`,
      );
    }
    case "agent_5_report": {
      const status = terminalStatusFrom(artifact.body);
      if (run.outcomeHint === "blocked" && status === "completed") {
        throw new TransitionError(
          "A blocked audit cannot be reported as completed",
        );
      }
      if (run.outcomeHint === "partial" && status === "completed") {
        throw new TransitionError(
          "A partial audit cannot be reported as completed",
        );
      }
      return {
        run: { ...run, status },
        summary: `Run reached terminal status ${status}.`,
        budgetConsumed: null,
      };
    }
  }
}

export function resumeAfterClarification(run: RunRecord): RunRecord {
  if (run.status !== "awaiting_clarification" || run.resumePhase === null) {
    throw new TransitionError("Run is not awaiting clarification");
  }
  return {
    ...run,
    status: "running",
    phase: run.resumePhase,
    resumePhase: null,
  };
}
