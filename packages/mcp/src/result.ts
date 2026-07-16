export interface ToolPayload {
  [key: string]: unknown;
}

export function successResult(payload: ToolPayload) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
    structuredContent: payload,
  };
}

function sanitizeError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unknown Telic error";
  return message.replaceAll(/[\r\n\t]+/g, " ").slice(0, 800);
}

export function errorResult(error: unknown) {
  const payload = {
    ok: false,
    error: sanitizeError(error),
    ...(error instanceof ZodError
      ? {
          issues: error.issues.slice(0, 32).map((issue) => ({
            path: issue.path.map(String).join("."),
            code: issue.code,
            message: issue.message.replaceAll(/[\r\n\t]+/g, " ").slice(0, 400),
          })),
        }
      : {}),
  };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}
import { ZodError } from "zod/v4";
