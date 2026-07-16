import { describe, expect, it } from "vitest";

import { canonicalJson, sha256Json } from "./canonical-json.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively and produces stable hashes", () => {
    const left = { z: [{ b: 2, a: 1 }], a: true };
    const right = { a: true, z: [{ a: 1, b: 2 }] };
    expect(canonicalJson(left)).toBe('{"a":true,"z":[{"a":1,"b":2}]}');
    expect(sha256Json(left)).toBe(sha256Json(right));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, undefined, 1n])(
    "rejects unsupported value %s",
    (value) => expect(() => canonicalJson({ value })).toThrow(TypeError),
  );

  it("rejects cycles", () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(() => canonicalJson(value)).toThrow(/cyclic/);
  });
});
