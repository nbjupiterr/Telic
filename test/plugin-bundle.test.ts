import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

interface PluginMcpConfiguration {
  mcpServers: Record<string, { command: string; args: string[] }>;
}

const pluginRoot = fileURLToPath(new URL("../plugins/telic/", import.meta.url));
const mcpConfiguration = JSON.parse(
  readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
) as PluginMcpConfiguration;
const skillInstructions = readFileSync(
  join(pluginRoot, "skills/telic/SKILL.md"),
  "utf8",
);
const skillInterface = readFileSync(
  join(pluginRoot, "skills/telic/agents/openai.yaml"),
  "utf8",
);

describe("bundled Codex plugin MCP", () => {
  it("advertises the installed skill name and the critical adapter boundaries", () => {
    expect(skillInterface).toContain("$telic:telic");
    expect(skillInstructions).toContain("$telic:telic");
    expect(skillInstructions).toContain("is `analyze_only`, not `report_only`");
    expect(skillInstructions).toContain("requiredOutputSchema");
    expect(skillInstructions).toContain("does not intercept editor");
  });

  it("starts through the installed plugin configuration and completes the MCP handshake", async () => {
    const configuredServer = mcpConfiguration.mcpServers.telic;
    expect(configuredServer).toBeDefined();
    if (!configuredServer)
      throw new Error("Telic MCP configuration is missing");
    const configuredArgs = configuredServer.args.map((argument) =>
      argument.replaceAll("${PLUGIN_ROOT}", pluginRoot),
    );
    expect(configuredArgs).not.toContainEqual(expect.stringContaining("${"));
    expect(existsSync(configuredArgs[0]!)).toBe(true);

    const repository = mkdtempSync(join(tmpdir(), "telic-plugin-smoke-"));
    const stateDirectory = mkdtempSync(join(tmpdir(), "telic-plugin-state-"));
    writeFileSync(join(repository, "AGENTS.md"), "# Test workspace\n");
    const transport = new StdioClientTransport({
      command: configuredServer.command,
      args: configuredArgs,
      cwd: repository,
      stderr: "pipe",
      env: {
        ...getDefaultEnvironment(),
        TELIC_STATE_DIR: stateDirectory,
      },
    });
    const client = new Client({ name: "plugin-smoke", version: "1.0.0" });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("telic_start_run");
      const result = await client.callTool({
        name: "telic_start_run",
        arguments: {
          original_request: "Report only what I supplied.",
          mode: "report_only",
          host_capabilities: [],
        },
      });
      expect(result.isError).not.toBe(true);
    } finally {
      await client.close();
    }
  }, 15_000);
});
