#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(repositoryRoot, "plugins/telic");
const skillRoot = resolve(pluginRoot, "skills/telic");

function fail(message) {
  throw new Error(`Codex asset validation failed: ${message}`);
}

function text(path) {
  if (!existsSync(path)) fail(`${relative(repositoryRoot, path)} is missing`);
  return readFileSync(path, "utf8");
}

function json(path) {
  try {
    return JSON.parse(text(path));
  } catch (error) {
    fail(
      `${relative(repositoryRoot, path)} is not valid JSON: ${error.message}`,
    );
  }
}

function object(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function onlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${label}.${key} is unsupported`);
  }
}

function resolveInside(root, configuredPath, label) {
  nonEmptyString(configuredPath, label);
  if (isAbsolute(configuredPath)) fail(`${label} must be relative`);
  const resolved = resolve(root, configuredPath);
  const fromRoot = relative(root, resolved);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    fail(`${label} escapes its plugin root`);
  }
  return resolved;
}

function parseFrontmatter(source, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) fail(`${label} needs YAML frontmatter`);
  const result = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const field = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/.exec(line);
    if (!field) fail(`${label} has unsupported frontmatter syntax`);
    result[field[1]] = field[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return result;
}

const manifestPath = resolve(pluginRoot, ".codex-plugin/plugin.json");
const manifest = object(json(manifestPath), "plugin.json");
onlyKeys(
  manifest,
  new Set([
    "$schema",
    "name",
    "version",
    "description",
    "author",
    "skills",
    "interface",
    "mcpServers",
  ]),
  "plugin.json",
);
if (manifest.name !== "telic") fail("plugin.json.name must be telic");
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
  fail("plugin.json.version must be semantic");
}
nonEmptyString(manifest.description, "plugin.json.description");
nonEmptyString(
  object(manifest.author, "plugin.json.author").name,
  "plugin.json.author.name",
);

const skillsPath = resolveInside(
  pluginRoot,
  manifest.skills,
  "plugin.json.skills",
);
if (skillsPath !== resolve(pluginRoot, "skills")) {
  fail("plugin.json.skills must resolve to plugins/telic/skills");
}
const mcpPath = resolveInside(
  pluginRoot,
  manifest.mcpServers,
  "plugin.json.mcpServers",
);
if (mcpPath !== resolve(pluginRoot, ".mcp.json")) {
  fail("plugin.json.mcpServers must resolve to plugins/telic/.mcp.json");
}

const pluginInterface = object(manifest.interface, "plugin.json.interface");
for (const field of [
  "displayName",
  "shortDescription",
  "longDescription",
  "developerName",
  "category",
]) {
  nonEmptyString(pluginInterface[field], `plugin.json.interface.${field}`);
}
if (
  !Array.isArray(pluginInterface.capabilities) ||
  pluginInterface.capabilities.length === 0 ||
  pluginInterface.capabilities.some(
    (entry) => typeof entry !== "string" || entry.trim().length === 0,
  )
) {
  fail("plugin.json.interface.capabilities must contain non-empty strings");
}
if (
  !Array.isArray(pluginInterface.defaultPrompt) ||
  pluginInterface.defaultPrompt.length === 0 ||
  pluginInterface.defaultPrompt.some(
    (entry) => typeof entry !== "string" || entry.trim().length === 0,
  )
) {
  fail("plugin.json.interface.defaultPrompt must contain non-empty strings");
}

const mcp = object(json(mcpPath), ".mcp.json");
onlyKeys(mcp, new Set(["mcpServers"]), ".mcp.json");
const server = object(
  object(mcp.mcpServers, ".mcp.json.mcpServers").telic,
  ".mcp.json.mcpServers.telic",
);
if (server.command !== "node") fail("Telic MCP command must be node");
if (
  !Array.isArray(server.args) ||
  server.args.length !== 1 ||
  server.args[0] !== "${PLUGIN_ROOT}/dist/mcp/server.js"
) {
  fail("Telic MCP args must reference the bundled plugin server");
}
if (!existsSync(resolve(pluginRoot, "dist/mcp/server.js"))) {
  fail("plugins/telic/dist/mcp/server.js is missing; run npm run build");
}

const skillPath = resolve(skillRoot, "SKILL.md");
const skill = text(skillPath);
const frontmatter = parseFrontmatter(skill, "skills/telic/SKILL.md");
onlyKeys(
  frontmatter,
  new Set(["name", "description"]),
  "skills/telic/SKILL.md frontmatter",
);
if (frontmatter.name !== "telic") fail("skill name must match its directory");
const description = nonEmptyString(
  frontmatter.description,
  "skill frontmatter description",
);
if (description.length > 1024 || /[<>]/.test(description)) {
  fail(
    "skill description must be at most 1024 characters without angle brackets",
  );
}

for (const match of skill.matchAll(/\]\(([^)]+)\)/g)) {
  const reference = match[1].split("#", 1)[0];
  if (!reference || /^(?:https?:|mailto:)/.test(reference)) continue;
  const target = resolveInside(skillRoot, reference, `skill link ${reference}`);
  if (!existsSync(target)) fail(`skill link ${reference} does not exist`);
}

const interfacePath = resolve(skillRoot, "agents/openai.yaml");
const skillInterface = text(interfacePath);
for (const required of [
  /^interface:\s*$/m,
  /^\s+display_name:\s*"?Telic"?\s*$/m,
  /^\s+short_description:\s*\S.+$/m,
  /^\s+default_prompt:\s*.+\$telic:telic.+$/m,
]) {
  if (!required.test(skillInterface)) {
    fail(
      "skills/telic/agents/openai.yaml is missing required interface metadata",
    );
  }
}

for (const [label, source] of [
  ["plugin.json", JSON.stringify(manifest)],
  [".mcp.json", JSON.stringify(mcp)],
  ["SKILL.md", skill],
  ["agents/openai.yaml", skillInterface],
]) {
  if (/\[?TODO[:\]]/i.test(source))
    fail(`${label} contains unresolved TODO text`);
}

console.log(
  "Codex asset validation passed: plugin, MCP, skill, and interface.",
);
