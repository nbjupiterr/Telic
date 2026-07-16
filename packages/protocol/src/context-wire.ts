import { z } from "zod";

import {
  IdentifierSchema,
  MAX_COLLECTION_ITEMS,
  ReferenceUriSchema,
  RelativePathSchema,
  RepositoryUriSchema,
  RunIdSchema,
  SchemaVersionSchema,
  Sha256Schema,
  SummarySchema,
} from "./common.js";
import {
  ContextManifestSchema,
  ExcludedCandidateSummarySchema,
  type ContextManifest,
} from "./controller.js";

export const ContextManifestWireSchema = z
  .object({
    schema_version: SchemaVersionSchema,
    id: IdentifierSchema,
    run_id: RunIdSchema,
    repository_fingerprint: z
      .object({
        head_commit: z
          .string()
          .regex(/^[a-f0-9]{40,64}$/)
          .nullable(),
        dirty_worktree_hash: Sha256Schema,
      })
      .strict(),
    pinned_refs: z.array(RepositoryUriSchema).max(MAX_COLLECTION_ITEMS),
    selected_sources: z
      .array(
        z
          .object({
            ref: RepositoryUriSchema,
            path: RelativePathSchema,
            reason: SummarySchema,
            content_hash: Sha256Schema,
            size_bytes: z.number().int().min(0).max(100_000_000),
            score: z.number().int().min(0).max(10_000_000),
            pinned: z.boolean(),
          })
          .strict(),
      )
      .max(100_000),
    derived_refs: z.array(ReferenceUriSchema).max(MAX_COLLECTION_ITEMS),
    excluded_candidates: z
      .array(ExcludedCandidateSummarySchema)
      .max(MAX_COLLECTION_ITEMS),
    inventory_source: z.enum(["git", "ripgrep", "filesystem"]),
    warnings: z.array(SummarySchema).max(MAX_COLLECTION_ITEMS),
    budget: z
      .object({
        max_files: z.number().int().min(1).max(100_000),
        max_file_bytes: z.number().int().min(1).max(100_000_000),
        max_total_bytes: z.number().int().min(1).max(100_000_000),
        max_inventory_files: z.number().int().min(1).max(10_000_000),
        candidate_files: z.number().int().min(0).max(10_000_000),
        selected_files: z.number().int().min(0).max(100_000),
        selected_bytes: z.number().int().min(0).max(100_000_000),
        estimated_tokens: z.number().int().min(0).max(10_000_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((manifest, context) => {
    const selectedRefs = new Set<string>();
    for (const [index, source] of manifest.selected_sources.entries()) {
      if (selectedRefs.has(source.ref)) {
        context.addIssue({
          code: "custom",
          path: ["selected_sources", index, "ref"],
          message: "Selected source references must be unique",
        });
      }
      selectedRefs.add(source.ref);
    }
    const pinnedSelectedRefs = new Set(
      manifest.selected_sources
        .filter((source) => source.pinned)
        .map((source) => source.ref),
    );
    for (const [index, pinnedRef] of manifest.pinned_refs.entries()) {
      if (!pinnedSelectedRefs.has(pinnedRef)) {
        context.addIssue({
          code: "custom",
          path: ["pinned_refs", index],
          message: "Pinned refs must identify pinned selected sources",
        });
      }
    }
    if (manifest.selected_sources.length !== manifest.budget.selected_files) {
      context.addIssue({
        code: "custom",
        path: ["budget", "selected_files"],
        message: "Selected file count must match selected sources",
      });
    }
    const selectedBytes = manifest.selected_sources.reduce(
      (total, source) => total + source.size_bytes,
      0,
    );
    if (selectedBytes !== manifest.budget.selected_bytes) {
      context.addIssue({
        code: "custom",
        path: ["budget", "selected_bytes"],
        message: "Selected byte total must match selected sources",
      });
    }
    if (manifest.budget.selected_bytes > manifest.budget.max_total_bytes) {
      context.addIssue({
        code: "custom",
        path: ["budget", "selected_bytes"],
        message: "Selected context exceeds its byte budget",
      });
    }
  });

export type ContextManifestWire = z.infer<typeof ContextManifestWireSchema>;

/**
 * Converts the context package's documented snake_case wire artifact into the
 * canonical camelCase protocol artifact without exposing paths for excluded
 * secret-like candidates.
 */
export function normalizeContextManifestWire(input: unknown): ContextManifest {
  const wire = ContextManifestWireSchema.parse(input);

  return ContextManifestSchema.parse({
    schemaVersion: wire.schema_version,
    id: wire.id,
    runId: wire.run_id,
    repositoryFingerprint: {
      headCommit: wire.repository_fingerprint.head_commit,
      dirtyWorktreeHash: wire.repository_fingerprint.dirty_worktree_hash,
    },
    pinnedRefs: wire.pinned_refs,
    candidates: wire.selected_sources.map((source, index) => ({
      id: `candidate-${String(index + 1).padStart(4, "0")}`,
      ref: source.ref,
      locations: [source.path],
      contentHash: source.content_hash,
      byteSize: source.size_bytes,
      decision: "selected" as const,
      selectionReason: source.reason,
      path: source.path,
      score: source.score,
      pinned: source.pinned,
    })),
    derivedRefs: wire.derived_refs,
    excludedCandidateSummaries: wire.excluded_candidates,
    inventorySource: wire.inventory_source,
    warnings: wire.warnings,
    budget: {
      maximumFiles: wire.budget.max_files,
      maximumFileBytes: wire.budget.max_file_bytes,
      maximumTotalBytes: wire.budget.max_total_bytes,
      maximumInventoryFiles: wire.budget.max_inventory_files,
      candidateFiles: wire.budget.candidate_files,
      selectedFiles: wire.budget.selected_files,
      selectedBytes: wire.budget.selected_bytes,
      estimatedTokens: wire.budget.estimated_tokens,
    },
  });
}

/** @deprecated Use normalizeContextManifestWire for an explicit wire boundary. */
export const normalizeContextManifest = normalizeContextManifestWire;
