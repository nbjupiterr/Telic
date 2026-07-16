import { describe, expect, it } from "vitest";

import { EvidenceArtifactSchema, parseArtifactBody } from "./index.js";

const validEvidence = {
  schemaVersion: "1.0",
  id: "evidence-01",
  runId: "run-01",
  kind: "test",
  capturedAt: "2026-07-15T10:00:00Z",
  summary: "Focused unit tests passed.",
  contentType: "text/plain",
  encoding: "utf8",
  content: "3 tests passed",
  sourceRefs: [],
  redactions: [],
  rationaleSummary: "Captured directly from the test runner.",
} as const;

describe("Evidence artifact", () => {
  it("is available through typed artifact dispatch", () => {
    expect(parseArtifactBody("Evidence", validEvidence)).toEqual(validEvidence);
  });

  it("rejects unknown fields and empty content", () => {
    expect(
      EvidenceArtifactSchema.safeParse({
        ...validEvidence,
        hiddenThoughts: "no",
      }).success,
    ).toBe(false);
    expect(
      EvidenceArtifactSchema.safeParse({ ...validEvidence, content: "" })
        .success,
    ).toBe(false);
  });
});
