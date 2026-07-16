# Third-party technologies and attribution record

**Status: current source inventory.** `package-lock.json` is authoritative for the complete npm graph. This document distinguishes installed dependencies, optional local executables, interoperability candidates, and design inspirations.

Telic is released under the [MIT License](../LICENSE). A dependency's license
does not grant a license to Telic source, and this inventory is not a substitute
for a release-grade transitive license report.

## Direct runtime dependencies

| Package/technology                                                                    | Pinned version or source | Relationship                                                        | Declared license observed locally |
| ------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- | --------------------------------- |
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | `1.29.0`                 | MCP server, STDIO transport, tool registration                      | MIT                               |
| [Zod](https://github.com/colinhacks/zod)                                              | `4.4.3`                  | Strict schemas, parsing, validation, inferred TypeScript types      | MIT                               |
| Node.js standard library                                                              | Node `>=24.15.0`         | filesystem/process/path/crypto utilities and built-in `node:sqlite` | Node.js license terms             |

Internal `@telic/*` workspace links are Telic source, not third-party packages. SQLite is accessed through Node's built-in module; Telic does not install a separate SQLite npm package or database daemon.

## Direct development dependencies

| Package               | Pinned version | Use                               | Declared license observed locally |
| --------------------- | -------------: | --------------------------------- | --------------------------------- |
| `@types/node`         |       `26.1.1` | Node TypeScript declarations      | MIT                               |
| `@vitest/coverage-v8` |       `4.1.10` | coverage reporting                | MIT                               |
| `esbuild`             |       `0.28.1` | standalone plugin MCP bundle      | MIT                               |
| `prettier`            |        `3.9.5` | maintained-surface formatting     | MIT                               |
| `tsx`                 |       `4.23.1` | TypeScript development execution  | MIT                               |
| `typescript`          |        `7.0.2` | workspace build and type checking | Apache-2.0                        |
| `vitest`              |       `4.1.10` | unit/integration/E2E tests        | MIT                               |

The official Codex plugin/skill validator wrapper has one separate Python
development requirement: PyYAML `6.0.3` (MIT), hash-pinned in
`requirements-validator.txt`. The first validation run builds an ignored
project-local virtual environment and downloads the source archive from PyPI; it
is not a Telic runtime dependency or global install.

Versions and license fields above were read from the installed direct package manifests on July 15, 2026. Release preparation must inventory every transitive package from a clean lockfile install and preserve required notices.

## Optional local executables

| Tool                                                         | Current use                                               | Behavior when absent                                            |
| ------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------- |
| [Git](https://git-scm.com/)                                  | Ignore-aware inventory, repository fingerprint/provenance | Fall back to ripgrep or filesystem inventory with warnings      |
| [ripgrep](https://github.com/BurntSushi/ripgrep)             | Fast candidate inventory/search                           | Fall back to filesystem inventory                               |
| Codex CLI/plugin validator scripts                           | Development plugin/skill validation                       | Validation command reports the missing development prerequisite |
| Antigravity CLI (`agy`) `1.1.1`                              | Native Antigravity adapter schema validation              | Repository and transport validation still run                   |
| Kiro CLI `2.12.1`                                            | Native Kiro custom-agent schema validation                | Repository and transport validation still run                   |
| [Graphifyy](https://github.com/safishamsi/graphify) `0.8.13` | Development-only repository graph and navigation map      | Normal build, tests, and runtime are unaffected                 |
| [Gate-MCP](https://github.com/Dukeabaddon/Gate-MCP) `0.5.5`  | Development-only graph queries and signature compression  | Normal build, tests, and runtime are unaffected                 |

Telic does not install these globally. Their versions are environment inputs,
not npm dependencies. Graphifyy and Gate-MCP were used during development from
separate local checkouts; Graphifyy's generated map is ignored, Gate-MCP output
is transient, and neither tool is bundled into the Codex plugin. Both local
package manifests declared MIT when
inspected on July 16, 2026. Their development-time token-saving estimates are not
Telic runtime measurements or product claims.

## Optional integrations and inspirations

The following projects are not bundled runtime dependencies.

### Repository/context work

| Project                                                   | Relationship                                       | Decision                                          |
| --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| [Tree-sitter](https://github.com/tree-sitter/tree-sitter) | Candidate structural parsing                       | Deferred until bounded file selection is stable   |
| [Aider](https://github.com/Aider-AI/aider)                | Inspiration for repository-map/graph-ranking ideas | No copied or linked implementation claimed        |
| [Repomix](https://github.com/yamadashy/repomix)           | Candidate snapshot/export provider                 | Optional future boundary, not live context engine |
| [Serena](https://github.com/oraios/serena)                | Candidate LSP/symbol provider                      | Optional future integration                       |
| [LLMLingua](https://github.com/microsoft/LLMLingua)       | Compression research                               | Deferred to low-risk prose experiments only       |

The implemented context strategy is deterministic selection rather than lossy compression: inventory relevant files, enforce byte/count budgets, retain exact selected text once by SHA-256, deduplicate, and pass references with selection reasons. Telic must not claim provider-token savings it cannot measure.

### Browser/runtime evidence

| Project                                                                      | Relationship                             | Current decision                   |
| ---------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------- |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Candidate evidence-rich browser provider | Not bundled or configured by Telic |
| [Vercel Labs agent-browser](https://github.com/vercel-labs/agent-browser)    | Candidate CLI browser provider           | Not bundled or configured by Telic |
| [Chrome DevTools](https://developer.chrome.com/docs/devtools)                | Evidence-semantics reference             | Not a Telic dependency             |

A future provider must use an isolated synthetic profile, minimize domain/data access, preserve host/user approvals, redact unnecessary sensitive data, and fail honestly when unavailable. Telic must not attach to a personal browser profile or install a provider without the user's knowledge.

## Foundation boundaries

- [Model Context Protocol](https://modelcontextprotocol.io/) connects hosts to Telic's tools; it does not provide prompt interception, model reuse, or universal subagent control.
- SHA-256 identifies and checks stored bytes; it is not encryption or anonymization.
- SQLite stores local run metadata; same-user access remains inside the OS trust boundary.
- Git provenance must never be used to rewrite user history or commit sensitive run state.

## Release checklist

- [x] Publish Telic's MIT License.
- [ ] Generate a complete dependency/license/SBOM inventory from `package-lock.json`.
- [ ] Run production dependency and secret audits from a clean install.
- [ ] Preserve required copyright and license notices in release artifacts.
- [ ] Record provenance for every bundled asset, fixture, and copied snippet.
- [ ] Review every optional integration's data, process, network, and credential boundary.
- [ ] Publish exact plugin/package checksums or signed provenance where supported.
- [ ] Use integration and product names descriptively without implying endorsement.
