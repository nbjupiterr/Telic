# `@telic/context`

Deterministic, bounded, secret-aware repository grounding for Telic. The package discovers repository sources without accepting arbitrary shell commands, ranks them against the request and active paths, and returns a content-addressed wire manifest.

```ts
import { groundRepository } from "@telic/context";

const result = await groundRepository({
  run_id: "run-01",
  repository_root: process.cwd(),
  request: "Investigate why src/web/client.ts cannot reach the API.",
  active_paths: ["src/web/client.ts"],
});
```

`result.manifest` and `result.trace_summary` contain references, hashes, reasons, budgets, and aggregate exclusion counts—never source text. Exact text is returned separately in `result.documents` for an authorized artifact/blob store.

Default safeguards:

- repository-root and realpath containment, including symlink-escape rejection;
- Git-aware inventory with ripgrep and bounded filesystem fallbacks;
- fixed subprocess argument lists with shell execution disabled;
- `.git`, `.telic`, dependency, build, distribution, and coverage exclusions;
- secret-like filename exclusion for environment files, credentials, and private keys;
- binary and invalid UTF-8 detection;
- per-file, total-byte, candidate, and selected-file limits;
- SHA-256 content deduplication and deterministic ordering; and
- pinned repository instructions such as `AGENTS.md`.

The wire manifest uses snake_case. `@telic/protocol` owns the adapter into Telic's canonical camelCase artifact schema.
