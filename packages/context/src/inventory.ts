import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, realpath, stat } from "node:fs/promises";

import {
  isExcludedDirectoryPath,
  isPathContained,
  normalizeRepositoryPath,
} from "./security.js";
import {
  ContextInputError,
  type InventorySource,
  type RepositoryFingerprint,
} from "./types.js";

const COMMAND_OUTPUT_LIMIT = 16 * 1024 * 1024;

interface CommandResult {
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

class FixedCommandError extends Error {}

async function runFixedCommand(
  command: "git" | "rg",
  args: readonly string[],
  cwd: string,
): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...args], {
      cwd,
      env: {
        ...process.env,
        GIT_ATTR_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_OPTIONAL_LOCKS: "0",
        LC_ALL: "C",
        RIPGREP_CONFIG_PATH: "/dev/null",
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const rejectOnce = (error: Error): void => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        rejectPromise(error);
      }
    };

    child.on("error", (error) =>
      rejectOnce(new FixedCommandError(error.message)),
    );
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > COMMAND_OUTPUT_LIMIT) {
        rejectOnce(
          new FixedCommandError(
            "Repository inventory command exceeded its output limit.",
          ),
        );
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > COMMAND_OUTPUT_LIMIT) {
        rejectOnce(
          new FixedCommandError(
            "Repository inventory command exceeded its output limit.",
          ),
        );
        return;
      }
      stderrChunks.push(chunk);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (code !== 0) {
        rejectPromise(
          new FixedCommandError(
            `${command} exited with status ${String(code)}.`,
          ),
        );
        return;
      }
      resolvePromise({
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
      });
    });
  });
}

function decodeNullSeparated(output: Buffer): string[] {
  return output
    .toString("utf8")
    .split("\0")
    .filter((entry) => entry.length > 0);
}

async function tryGitRoot(requestedRoot: string): Promise<string | null> {
  try {
    const result = await runFixedCommand(
      "git",
      ["-C", requestedRoot, "rev-parse", "--show-toplevel"],
      requestedRoot,
    );
    const candidate = await realpath(result.stdout.toString("utf8").trim());
    return isPathContained(candidate, requestedRoot) ? candidate : null;
  } catch {
    return null;
  }
}

export async function resolveRepositoryRoot(
  requestedRoot: string,
): Promise<string> {
  if (requestedRoot.trim().length === 0) {
    throw new ContextInputError(
      "repository_root must be a non-empty directory path.",
    );
  }
  let resolved: string;
  try {
    resolved = await realpath(requestedRoot);
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      throw new ContextInputError(
        "repository_root must resolve to a directory.",
      );
    }
  } catch (error) {
    if (error instanceof ContextInputError) {
      throw error;
    }
    throw new ContextInputError("repository_root could not be resolved.");
  }
  return (await tryGitRoot(resolved)) ?? resolved;
}

async function gitInventory(root: string): Promise<string[]> {
  const result = await runFixedCommand(
    "git",
    [
      "-c",
      "core.fsmonitor=false",
      "-C",
      root,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ],
    root,
  );
  return decodeNullSeparated(result.stdout);
}

async function ripgrepInventory(root: string): Promise<string[]> {
  const fixedExcludes = [
    ".git",
    ".telic",
    "build",
    "coverage",
    "dist",
    "node_modules",
  ];
  const args = ["--files", "--hidden", "--no-ignore", "--null"];
  for (const name of fixedExcludes) {
    args.push("--glob", `!${name}/**`, "--glob", `!**/${name}/**`);
  }
  const result = await runFixedCommand("rg", args, root);
  return decodeNullSeparated(result.stdout);
}

async function filesystemInventory(
  root: string,
  maximumPaths: number,
  shouldExclude: (repositoryPath: string) => boolean,
): Promise<{ paths: string[]; excludedPathCount: number }> {
  const found: string[] = [];
  let excludedPathCount = 0;
  const visit = async (relativeDirectory: string): Promise<void> => {
    const absoluteDirectory =
      relativeDirectory.length === 0 ? root : `${root}/${relativeDirectory}`;
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (found.length >= maximumPaths) {
        return;
      }
      const relativePath =
        relativeDirectory.length === 0
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      if (shouldExclude(relativePath)) {
        excludedPathCount += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (!isExcludedDirectoryPath(relativePath)) {
          await visit(relativePath);
        }
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        found.push(relativePath);
      }
    }
  };
  await visit("");
  return { paths: found, excludedPathCount };
}

function filterExcludedPaths(
  paths: readonly string[],
  shouldExclude: (repositoryPath: string) => boolean,
): { paths: string[]; excludedPathCount: number } {
  const included: string[] = [];
  let excludedPathCount = 0;
  for (const path of paths) {
    if (shouldExclude(path)) {
      excludedPathCount += 1;
    } else {
      included.push(path);
    }
  }
  return { paths: included, excludedPathCount };
}

export interface InventoryResult {
  readonly source: InventorySource;
  readonly paths: readonly string[];
  readonly warnings: readonly string[];
  readonly excludedPathCount: number;
}

export async function discoverRepositoryFiles(
  root: string,
  maximumPaths: number,
  shouldExclude: (repositoryPath: string) => boolean = () => false,
): Promise<InventoryResult> {
  try {
    const result = filterExcludedPaths(await gitInventory(root), shouldExclude);
    return { source: "git", ...result, warnings: [] };
  } catch {
    try {
      const result = filterExcludedPaths(
        await ripgrepInventory(root),
        shouldExclude,
      );
      return {
        source: "ripgrep",
        ...result,
        warnings: [
          "Git inventory was unavailable; repository files were discovered with ripgrep.",
        ],
      };
    } catch {
      const result = await filesystemInventory(
        root,
        maximumPaths,
        shouldExclude,
      );
      return {
        source: "filesystem",
        ...result,
        warnings: [
          "Git and ripgrep inventory were unavailable; repository files were discovered with the bounded filesystem fallback.",
        ],
      };
    }
  }
}

function sha256(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export async function fingerprintRepository(
  root: string,
  inventoryPaths: readonly string[],
  contentHashes: ReadonlyMap<string, string>,
): Promise<{
  readonly fingerprint: RepositoryFingerprint;
  readonly warnings: readonly string[];
}> {
  try {
    const [headResult, statusResult] = await Promise.all([
      runFixedCommand("git", ["-C", root, "rev-parse", "HEAD"], root).catch(
        () => null,
      ),
      runFixedCommand(
        "git",
        [
          "-c",
          "core.fsmonitor=false",
          "-C",
          root,
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all",
        ],
        root,
      ),
    ]);
    const selectedProjection = [...contentHashes.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([path, hash]) => `${path}\0${hash}`)
      .join("\0");
    return {
      fingerprint: {
        head_commit: headResult?.stdout.toString("utf8").trim() || null,
        dirty_worktree_hash: sha256(
          Buffer.concat([statusResult.stdout, Buffer.from(selectedProjection)]),
        ),
      },
      warnings: [],
    };
  } catch {
    const stableProjection = inventoryPaths
      .map((rawPath) => normalizeRepositoryPath(rawPath))
      .filter((entry): entry is string => entry !== null)
      .sort()
      .map((path) => `${path}\0${contentHashes.get(path) ?? "unread"}`)
      .join("\0");
    return {
      fingerprint: {
        head_commit: null,
        dirty_worktree_hash: sha256(stableProjection),
      },
      warnings: [
        "Git metadata was unavailable; the repository fingerprint uses the discovered file projection.",
      ],
    };
  }
}
