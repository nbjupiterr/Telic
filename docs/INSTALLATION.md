# Installation and local runtime

**Status: source preview.** The repository can be built, tested, run as a STDIO MCP server, and loaded through its local Codex marketplace. There is no public npm package, remote marketplace, signed release, or supported clean-machine distribution yet.

## Requirements

- Node.js `>=24.15.0`
- npm and the checked-in `package-lock.json`
- Codex with plugin support for the host-native preview
- Python 3 with `venv` for official Codex plugin/skill validation
- optional Git and ripgrep; context discovery falls back to the filesystem when unavailable

No separate model API key, browser package, database server, service manager, open port, or global npm install is required.

## Build and verify from source

From the repository root:

```bash
npm ci
npm run build
npm test
npm run test:coverage
npm run typecheck
npm run format:check
npm run plugin:validate
npm run skill:validate
node packages/cli/dist/bin.js doctor --json
```

`npm run build` compiles the workspaces and regenerates
`plugins/telic/dist/mcp/server.js`. `npm run check` runs the maintained aggregate
check, including the marketplace validator. Plugin/skill validation uses the
official validator scripts from `CODEX_HOME` (default `~/.codex`). On its first
run, the wrapper creates a project-local ignored virtual environment under
`.cache/` and downloads the hash-pinned PyYAML `6.0.3` source archive from PyPI;
later runs reuse it. That validator-only bootstrap is the only check above that
needs network access after `npm ci`.

The packages are private workspace packages. `npm ci` installs them for development; it does not publish or globally install Telic.

## Run the local MCP server

The standalone plugin bundle starts over STDIO:

```bash
TELIC_REPOSITORY_ROOT="$PWD" node plugins/telic/dist/mcp/server.js
```

Or use the built CLI:

```bash
TELIC_REPOSITORY_ROOT="$PWD" node packages/cli/dist/bin.js mcp
```

The server writes MCP protocol traffic to stdout and diagnostics to stderr. It exits when the client disconnects or sends a termination signal. There is no background daemon.

## Load the local Codex plugin

The source tree contains:

```text
plugins/telic/
├── .codex-plugin/plugin.json
├── .mcp.json
├── dist/mcp/server.js
└── skills/telic/
```

Build first so the bundled server matches the TypeScript source. Then add the repository's local marketplace:

```bash
codex plugin marketplace add "$PWD/.agents/plugins" --json
codex plugin list --available --json
codex plugin add telic@personal --json
codex plugin list --json
codex mcp list --json
```

The marketplace manifest currently names itself `personal`. If Codex reports a different configured name or a naming collision, use the name returned by the first command. Start a fresh Codex session after installation so skill and MCP discovery use the installed snapshot.

An initial prompt can explicitly activate the installed skill:

```text
Use $telic:telic to investigate this repository. Analyze only; do not change files.
```

This is a development installation from the current working tree, not a published judge path. It modifies the user's Codex marketplace/plugin configuration, so review the displayed paths and output before proceeding.

### Remove the preview install

Use the configured marketplace name shown by `codex plugin marketplace list`:

```bash
codex plugin remove telic@personal --json
codex plugin marketplace remove personal --json
```

These commands remove Codex's installed plugin/cache and marketplace entry. They do not remove the source checkout or Telic run state.

## Runtime lifecycle

```text
Codex activates telic:telic
        |
        v
Codex launches plugin-provided Telic STDIO process
        |
        v
Host model calls seven deterministic Telic tools
        |
        v
Artifacts and trace persist in local XDG state
        |
        v
Codex disconnects; the process exits
```

The host model performs semantic work. The MCP process does not call or inherit the host model, and it has no model credential.

## State location

By default, each real repository path maps to:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/telic/repositories/<repository-hash>/
```

The repository hash is the first 24 hexadecimal characters of a SHA-256 digest of the canonical absolute repository path. This keeps ledgers and exact selected source out of the working tree.

Override the complete directory when isolation or explicit cleanup is useful:

```bash
TELIC_STATE_DIR=/tmp/telic-demo-state \
  TELIC_REPOSITORY_ROOT="$PWD" \
  node plugins/telic/dist/mcp/server.js
```

Do not point `TELIC_STATE_DIR` inside a repository you may commit. Telic rejects unsafe state-directory symlinks, but users remain responsible for OS permissions, backups, and retention.

The CLI reports the resolved location:

```bash
node packages/cli/dist/bin.js doctor --repo "$PWD" --json
```

## Inspect an existing run

```bash
node packages/cli/dist/bin.js status RUN_ID --repo "$PWD" --json
node packages/cli/dist/bin.js trace RUN_ID --repo "$PWD" --json
node packages/cli/dist/bin.js artifact RUN_ID ARTIFACT_ID --repo "$PWD" --json
```

These commands require a ledger for the selected repository. They are read-only ledger views; there is no visual inspector yet.

## Current support matrix

| Host/platform                                          | Current claim       | Notes                                                                             |
| ------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------- |
| Codex plugin from a Linux source checkout              | Development preview | Plugin, skill, local marketplace, and bundled STDIO MCP are present               |
| Codex CLI/IDE/desktop as separately certified surfaces | Not certified       | Requires clean install, lifecycle, and interaction evidence per surface           |
| macOS or Windows/WSL                                   | Not certified       | Node code is intended to be portable; platform lifecycle tests are still required |
| Claude Code, Cursor, Antigravity, Kiro                 | No adapter shipped  | MCP support alone does not establish semantic integration                         |
| Browser/DevTools providers                             | No provider shipped | Optional provider boundary remains planned                                        |

## Troubleshooting

### Node check fails

Use a Node version satisfying `>=24.15.0`; the core uses the current built-in `node:sqlite` API.

### MCP starts for the wrong repository

Set `TELIC_REPOSITORY_ROOT` to the absolute target repository or ensure Codex launches the plugin with that repository as its working directory.

### No ledger exists

`status`, `trace`, and `artifact` do not create a run. Confirm the repository and `TELIC_STATE_DIR`, then start a run through MCP.

### Skill or MCP is missing after install

Run `npm run build`, validate the plugin, inspect `codex plugin list --json` and `codex mcp list --json`, and start a new Codex session. The installed skill's qualified name is `telic:telic`.

### `git` or `rg` is absent

Grounding falls back to the filesystem and records the selected inventory source and warnings. Install them only if desired; Telic does not install global tools.

## Release installation target

Before the preview becomes a release, the project still needs a public
repository/package decision, a pinned remote marketplace or equivalent artifact,
checksums/provenance, clean-machine install and uninstall evidence, tested
upgrade behavior, and a monitored vulnerability-reporting channel. Until then,
do not present source-preview commands as a stable end-user installation
contract.
