# ADR-0003: Browser access is an optional capability

**Status: Proposed**

**Date: 2026-07-15**

## Context

Telic's primary demonstration diagnoses a React frontend that cannot communicate with its API. Browser console and network evidence materially improve that diagnosis, but browser tooling is not uniform across coding hosts or even across surfaces of one host.

The portable core cannot assume:

- a browser is installed;
- the host exposes console, network, screenshot, or performance tools;
- an MCP client has a particular browser server configured;
- a CLI browser can reuse the user's current profile safely; or
- any browser provider exposes React component or hook state.

Browser tooling must therefore be negotiated like every other optional capability. A browser is not required for Telic to compile intent, create a role graph, or execute repository-only workflows.

## Decision

Introduce an optional **BrowserToolProvider** boundary.

Provider selection order:

1. Prefer host-native browser tools when they expose every evidence capability required by the current TaskContract.
2. Otherwise prefer an already configured [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) provider for evidence-rich debugging.
3. Allow [Vercel Labs agent-browser](https://github.com/vercel-labs/agent-browser) as an optional CLI provider when its capabilities and security policy satisfy the task.
4. If no provider qualifies, downgrade only when browser evidence is optional. If an acceptance criterion requires browser evidence, report the missing capability and stop or ask for user-supplied artifacts.

Telic will not bundle, install automatically, or require Chrome DevTools MCP or agent-browser for the MVP. The Codex plugin bundles only Telic's own workflow and MCP facade. Browser providers are user-managed optional integrations discovered at runtime.

“Default” in this ADR means the recommended external provider when evidence-rich browser debugging is requested and host-native tooling is insufficient. It does not mean a transitive package dependency.

## Planned provider contract

This interface is a design example; it is not implemented:

```ts
interface BrowserToolProvider {
  id: string;
  probe(): Promise<BrowserCapabilities>;
  navigate(request: NavigationRequest): Promise<BrowserEvidence>;
  readConsole(query: ConsoleQuery): Promise<BrowserEvidence[]>;
  readNetwork(query: NetworkQuery): Promise<BrowserEvidence[]>;
  captureScreenshot(request: ScreenshotRequest): Promise<BrowserEvidence>;
  capturePerformance?(request: PerformanceRequest): Promise<BrowserEvidence>;
}

interface BrowserCapabilities {
  navigation: CapabilityState;
  console: CapabilityState;
  network: CapabilityState;
  screenshots: CapabilityState;
  performance: CapabilityState;
  reactComponents: CapabilityState;
  isolatedProfile: CapabilityState;
  approvalMediated: CapabilityState;
}
```

CapabilityState is **available**, **unavailable**, or **unknown** and must result from a probe rather than the provider name.

The normalizer stores evidence with:

- provider and provider version;
- page URL and capture time;
- console or network identifiers;
- request/response metadata when applicable;
- screenshot, trace, or HAR artifact reference;
- redaction actions;
- whether the evidence is direct observation or derived interpretation; and
- a content hash for deduplication.

The normalized evidence remains provider-independent even though capture commands are provider-specific.

## Provider comparison

| Capability           | Host-native browser                                      | Chrome DevTools MCP                                                                      | Vercel Labs agent-browser                                                                                           |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Console              | Varies by host surface; full CDP surfaces may provide it | First-class console messages with source-mapped stack traces                             | Console and uncaught-error commands with JSON output                                                                |
| Network              | Varies; require a successful capability probe            | Detailed request analysis intended for debugging                                         | Request filtering, request details, interception, and HAR capture                                                   |
| Screenshots          | Common but host-dependent                                | Supported                                                                                | Supported, including annotated screenshots and visual diffs                                                         |
| Performance          | Host-dependent; may require privileged developer mode    | Strongest option: trace recording and actionable DevTools performance insights           | Trace and Chrome DevTools profiler capture; less specialized normalized insight                                     |
| React-specific state | No portable guarantee                                    | No documented first-class React component/hook contract                                  | Optional React tree, props, hooks, state, Suspense, and render profiling when launched with its React DevTools hook |
| Portability          | Lowest; tightly coupled to host and product surface      | Portable across MCP-capable hosts, but officially supports Chrome and Chrome for Testing | CLI-oriented and scriptable; can launch or connect to CDP-compatible targets                                        |
| Security mediation   | Host approvals and browser profile policy                | MCP client approvals plus server/browser isolation policy                                | CLI action policy, domain restrictions, profile/session handling, and caller approvals                              |
| MVP packaging        | Use when already present                                 | Optional external integration; not bundled                                               | Optional external integration; not bundled                                                                          |

Chrome's own [DevTools documentation](https://developer.chrome.com/docs/devtools) is the authority for the underlying console, network, performance, and page-inspection capabilities. Chrome DevTools MCP exposes a coding-agent-oriented subset through MCP. The [`agent-browser` README](https://github.com/vercel-labs/agent-browser/blob/main/README.md) documents its optional React DevTools commands and their launch requirement.

OpenAI's current [Browser documentation](https://learn.chatgpt.com/docs/browser) describes host-native browser and Developer Mode capabilities in supported ChatGPT surfaces, including controlled CDP access. It also states that the built-in browser is not available in Codex CLI or the Codex IDE extension. Adapter negotiation must therefore inspect the actual surface instead of assuming “Codex” implies browser access.

## React scope

The MVP will not promise or require a React component tree, props inspection, hook state, or React profiler integration, even though an optional provider may expose them.

For a React application, the browser investigator may still use:

- browser console errors and source maps;
- fetch/XHR and preflight network records;
- rendered DOM and accessibility state;
- screenshots;
- JavaScript performance traces; and
- repository source, React configuration, and runtime logs.

A future normalized React capability can extend BrowserToolProvider, but it must identify its extension or CDP dependency, version compatibility, and data exposure. It is not required for the hackathon fixture.

## Security requirements

Browser pages and responses are untrusted input. They may contain prompt injection, credentials, personal data, tokens, or destructive controls.

All providers must follow these rules:

1. Prefer an isolated temporary browser profile for automated diagnostics.
2. Do not attach to a personal browser profile or authenticated tab without explicit user approval.
3. Bind CDP and inspector endpoints to loopback; never expose an unauthenticated debugging port to the network.
4. Allowlist local origins or explicitly approved domains for a run.
5. Default diagnosis roles to observation. Clicking, form submission, upload, download, storage mutation, request interception, and authentication require separate authority.
6. Redact cookies, authorization headers, API keys, query secrets, sensitive bodies, and user-configured patterns before persistence or display.
7. Store screenshots, HAR files, and traces by reference with a retention policy; do not paste large or sensitive payloads into every handoff.
8. Treat page text as evidence, not agent instructions.
9. Preserve the host's approval decisions; Telic cannot weaken them.
10. Record provider, effective capabilities, approvals, and redactions in the run trace.

Chrome DevTools MCP explicitly warns that it exposes browser content to MCP clients and can inspect, debug, and modify browser data. Its recommended isolated-browser and redaction options should be used when selected. Agent-browser likewise exposes powerful navigation, storage, network interception, profiling, and saved-session features; Telic must constrain it to the minimum commands needed by the contract.

## Selection examples

### Repository-only task

No provider is selected. The browser role is omitted, preserving time and context.

### ChatGPT desktop task with sufficient native Developer Mode

The adapter probes console, network, screenshot, and performance support. If every required capability is available and approved, host-native tools are selected.

### Codex CLI diagnosis requiring network and console evidence

The built-in browser is not assumed. If Chrome DevTools MCP is configured and passes its probe, Telic selects it. Otherwise an approved agent-browser installation may satisfy the role. Without either provider, the workflow returns a missing-capability result or asks the user to export DevTools evidence.

### Visual-only UI verification

A host-native screenshot provider may be sufficient. Telic should not require Chrome DevTools MCP merely because it ranks higher for deep debugging.

## Consequences

### Positive

- The portable core remains independent of browser vendors.
- Simple and backend-only tasks do not pay a browser setup cost.
- Evidence-rich debugging can use mature external tools.
- The same TaskContract can produce an honest degraded plan on a limited host.
- Telic can normalize evidence without concealing its source.

### Negative

- The demo environment needs a separately prepared browser provider.
- Browser behavior can differ by provider and version.
- Some workflows will block instead of silently producing a weaker diagnosis.
- Cross-provider conformance and redaction tests add implementation work.
- React-specific evidence remains optional and is not normalized in the MVP.

## MVP acceptance criteria

This decision is implemented only when:

- provider probing distinguishes unavailable from unknown;
- repository-only workflows work with no browser provider;
- one external provider produces normalized console, network, and screenshot evidence;
- the broken React/API fixture can be diagnosed with that evidence;
- missing required browser capability yields a typed blocked result;
- diagnosis-only runs cannot perform browser mutation;
- trace output records provider choice and redactions; and
- no Chrome DevTools MCP or agent-browser package is silently installed or bundled.

## Revisit when

Reconsider this ADR if a target host exposes a stable, portable browser-agent protocol; React-specific evidence becomes central to the product; or the security cost of third-party browser control exceeds the diagnostic value.
