import { z } from "zod";

import {
  ArtifactBodySchemas,
  type ArtifactBodySchemasMap,
} from "./artifact-envelope.js";

export type ArtifactJsonSchema = Record<string, unknown>;

const schemas = new Map<keyof ArtifactBodySchemasMap, ArtifactJsonSchema>();

/** Return the exact JSON Schema for a canonical artifact body. */
export function getArtifactJsonSchema(
  artifactType: keyof ArtifactBodySchemasMap,
): ArtifactJsonSchema {
  const existing = schemas.get(artifactType);
  if (existing) return structuredClone(existing);

  const generated = z.toJSONSchema(ArtifactBodySchemas[artifactType], {
    reused: "ref",
  }) as ArtifactJsonSchema;
  schemas.set(artifactType, generated);
  return structuredClone(generated);
}
