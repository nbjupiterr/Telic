import { z } from "zod";

import {
  BoundedTextSchema,
  IdentifierSchema,
  MAX_ARTIFACT_BYTES,
  MAX_COLLECTION_ITEMS,
  ReferenceUriSchema,
  RunIdSchema,
  SchemaVersionSchema,
  SummarySchema,
  TimestampSchema,
} from "./common.js";

export const EvidenceArtifactSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    runId: RunIdSchema,
    kind: z.enum([
      "repository",
      "runtime",
      "browser",
      "test",
      "diff",
      "tool_output",
      "log",
      "user_confirmation",
    ]),
    capturedAt: TimestampSchema,
    summary: SummarySchema,
    contentType: z.string().min(1).max(255),
    encoding: z.enum(["utf8", "base64"]),
    content: BoundedTextSchema,
    sourceRefs: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
    redactions: z.array(BoundedTextSchema).max(MAX_COLLECTION_ITEMS),
    rationaleSummary: SummarySchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    if (Buffer.byteLength(evidence.content, "utf8") > MAX_ARTIFACT_BYTES) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: `Evidence content exceeds ${String(MAX_ARTIFACT_BYTES)} UTF-8 bytes`,
      });
    }
  });

export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;
