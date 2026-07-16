import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { createTelicMcpServer } from "./server-factory.js";
import { startStdioServer } from "./server.js";
import { TelicService } from "./service.js";

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

describe("MCP transport", () => {
  it("rejects TELIC_STATE_DIR when it points inside the repository", async () => {
    const root = mkdtempSync(join(tmpdir(), "telic-mcp-state-boundary-"));
    const previousRepositoryRoot = process.env.TELIC_REPOSITORY_ROOT;
    const previousStateDirectory = process.env.TELIC_STATE_DIR;
    process.env.TELIC_REPOSITORY_ROOT = root;
    process.env.TELIC_STATE_DIR = join(root, "state");
    try {
      await expect(startStdioServer()).rejects.toThrow(
        /outside the repository/,
      );
    } finally {
      if (previousRepositoryRoot === undefined) {
        delete process.env.TELIC_REPOSITORY_ROOT;
      } else {
        process.env.TELIC_REPOSITORY_ROOT = previousRepositoryRoot;
      }
      if (previousStateDirectory === undefined) {
        delete process.env.TELIC_STATE_DIR;
      } else {
        process.env.TELIC_STATE_DIR = previousStateDirectory;
      }
    }
  });

  it("advertises the stable tool surface and executes start/ground/trace", async () => {
    const root = mkdtempSync(join(tmpdir(), "telic-mcp-transport-"));
    writeFileSync(join(root, "AGENTS.md"), "# Rules\nKeep evidence.\n");
    const service = new TelicService({
      repositoryRoot: root,
      stateDirectory: mkdtempSync(join(tmpdir(), "telic-mcp-state-")),
    });
    const server = createTelicMcpServer(service);
    const client = new Client({ name: "telic-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    cleanup.push(
      async () => client.close(),
      async () => server.close(),
      () => service.close(),
    );

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      [
        "telic_get_artifact",
        "telic_get_next_action",
        "telic_get_run",
        "telic_get_trace",
        "telic_ground_context",
        "telic_start_run",
        "telic_submit_artifact",
      ].sort(),
    );
    expect(
      listed.tools.find((tool) => tool.name === "telic_ground_context")
        ?.annotations?.readOnlyHint,
    ).toBe(false);

    const started = await client.callTool({
      name: "telic_start_run",
      arguments: {
        original_request: "Plan how to inspect this repository.",
        mode: "plan_only",
        host_capabilities: ["repository.read"],
      },
    });
    expect(started.isError).not.toBe(true);
    const startBody = started.structuredContent as {
      run: { runId: string; version: number };
      nextAction: { id: string; phase: string };
    };
    expect(startBody.nextAction.phase).toBe("context_discovery");

    const stale = await client.callTool({
      name: "telic_ground_context",
      arguments: {
        run_id: startBody.run.runId,
        action_id: startBody.nextAction.id,
        expected_run_version: startBody.run.version + 1,
      },
    });
    expect(stale.isError).toBe(true);
    expect(stale.structuredContent).toMatchObject({
      ok: false,
      error: expect.stringContaining("Stale run version"),
    });
    const foreignAction = await client.callTool({
      name: "telic_ground_context",
      arguments: {
        run_id: startBody.run.runId,
        action_id: "action:foreign:1",
        expected_run_version: startBody.run.version,
      },
    });
    expect(foreignAction.isError).toBe(true);
    expect(foreignAction.structuredContent).toMatchObject({
      ok: false,
      error: expect.stringContaining("action_id"),
    });

    const grounded = await client.callTool({
      name: "telic_ground_context",
      arguments: {
        run_id: startBody.run.runId,
        action_id: startBody.nextAction.id,
        expected_run_version: startBody.run.version,
      },
    });
    expect(grounded.isError).not.toBe(true);
    const groundedBody = grounded.structuredContent as {
      run: { version: number };
      nextAction: { id: string };
    };

    const malformed = await client.callTool({
      name: "telic_submit_artifact",
      arguments: {
        run_id: startBody.run.runId,
        action_id: groundedBody.nextAction.id,
        expected_run_version: groundedBody.run.version,
        artifact_type: "ProblemFrame",
        body: {
          schemaVersion: "1.0",
          id: "bad-frame",
          runId: startBody.run.runId,
        },
      },
    });
    expect(malformed.isError).toBe(true);
    expect(malformed.structuredContent).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String) }),
      ]),
    });

    const trace = await client.callTool({
      name: "telic_get_trace",
      arguments: { run_id: startBody.run.runId, limit: 100 },
    });
    const traceBody = trace.structuredContent as {
      events: Array<{ rationaleSummary: string }>;
    };
    expect(traceBody.events.length).toBeGreaterThanOrEqual(3);
    expect(traceBody.events[0]).toMatchObject({
      schemaVersion: "1.0",
      rationaleSummary: expect.any(String),
    });
    expect(JSON.stringify(traceBody)).not.toContain("# Rules");
  });

  it("returns structured errors instead of crashing the transport", async () => {
    const root = mkdtempSync(join(tmpdir(), "telic-mcp-transport-"));
    const service = new TelicService({
      repositoryRoot: root,
      stateDirectory: mkdtempSync(join(tmpdir(), "telic-mcp-state-")),
    });
    const server = createTelicMcpServer(service);
    const client = new Client({ name: "telic-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    cleanup.push(
      async () => client.close(),
      async () => server.close(),
      () => service.close(),
    );
    const result = await client.callTool({
      name: "telic_get_run",
      arguments: { run_id: "missing-run" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false });
  });
});
