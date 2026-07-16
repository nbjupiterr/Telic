import { describe, expect, it } from "vitest";

import { getArtifactJsonSchema } from "./index.js";

describe("artifact JSON schemas", () => {
  it("exposes strict canonical camelCase fields to a fresh host", () => {
    const schema = getArtifactJsonSchema("ProblemFrame");
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(
      expect.arrayContaining(["schemaVersion", "id", "runId", "intentMode"]),
    );
    expect(schema.additionalProperties).toBe(false);
  });

  it("returns a defensive copy", () => {
    const first = getArtifactJsonSchema("WorkPlan");
    first.type = "string";
    expect(getArtifactJsonSchema("WorkPlan").type).toBe("object");
  });
});
