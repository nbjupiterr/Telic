import { isInstructionPath } from "./security.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "check",
  "could",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "please",
  "project",
  "the",
  "this",
  "to",
  "why",
  "with",
  "you",
]);

export interface RankedCandidate {
  readonly path: string;
  readonly score: number;
  readonly pinned: boolean;
  readonly reason: string;
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requestTerms(request: string): readonly string[] {
  const matches = request.toLowerCase().match(/[a-z0-9][a-z0-9._/-]*/gu) ?? [];
  const terms = new Set<string>();
  for (const match of matches) {
    for (const term of match.split(/[./_-]+/u)) {
      if (term.length >= 2 && !STOP_WORDS.has(term)) {
        terms.add(term);
      }
    }
  }
  return [...terms].sort(lexicalCompare);
}

function requestPathHints(request: string): readonly string[] {
  const matches =
    request.match(/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+/gu) ?? [];
  return [
    ...new Set(
      matches.map((match) => match.replace(/^\.\//u, "").toLowerCase()),
    ),
  ].sort(lexicalCompare);
}

export function rankCandidates(
  paths: readonly string[],
  request: string,
  activePaths: readonly string[],
): readonly RankedCandidate[] {
  const terms = requestTerms(request);
  const pathHints = requestPathHints(request);
  const active = new Set(activePaths.map((path) => path.toLowerCase()));

  const ranked = paths.map((path): RankedCandidate => {
    const lowerPath = path.toLowerCase();
    const basename = lowerPath.split("/").at(-1) ?? lowerPath;
    const instruction = isInstructionPath(path);
    const activeExact = active.has(lowerPath);
    const activeAncestor = [...active].some(
      (activePath) =>
        activePath.startsWith(`${lowerPath}/`) ||
        lowerPath.startsWith(`${activePath}/`),
    );
    const matchingHints = pathHints.filter(
      (hint) =>
        lowerPath === hint ||
        lowerPath.endsWith(`/${hint}`) ||
        lowerPath.includes(hint),
    );
    const matchingTerms = terms.filter((term) => lowerPath.includes(term));
    const basenameTerms = matchingTerms.filter((term) =>
      basename.includes(term),
    );

    const pinned = instruction || activeExact;
    let score = pinned ? 1_000_000 : 0;
    score += activeExact ? 50_000 : activeAncestor ? 10_000 : 0;
    score += matchingHints.length * 5_000;
    score += basenameTerms.length * 250;
    score += (matchingTerms.length - basenameTerms.length) * 75;
    score +=
      /(?:^|\/)(?:readme|package|tsconfig|pyproject|cargo|go\.mod)/u.test(
        lowerPath,
      )
        ? 20
        : 0;

    let reason: string;
    if (instruction) {
      reason = "Applicable repository instruction source pinned by policy.";
    } else if (activeExact) {
      reason = "Exact active-path source pinned by the host context.";
    } else if (matchingHints.length > 0) {
      reason = `Path matches an explicit request hint: ${matchingHints.slice(0, 3).join(", ")}.`;
    } else if (matchingTerms.length > 0) {
      reason = `Path matches request terms: ${matchingTerms.slice(0, 5).join(", ")}.`;
    } else if (activeAncestor) {
      reason = "Path is adjacent to an active host path.";
    } else {
      reason =
        "Repository source selected by the deterministic budget fallback.";
    }
    return { path, score, pinned, reason };
  });

  return ranked.sort(
    (left, right) =>
      right.score - left.score || lexicalCompare(left.path, right.path),
  );
}
