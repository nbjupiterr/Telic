import type { Metadata } from "next";
import { ArrowRight, FileVideo, GitFork } from "lucide-react";

import { DemoVideo } from "@/components/demo-video";
import { SectionHeading } from "@/components/section-heading";
import { TrackedLink } from "@/components/tracked-link";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "See how Telic turns a vague recommendation-bias report into an evidence-linked analysis workflow.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return (
    <main className="page-main" id="main-content">
      <header className="page-intro shell">
        <p className="eyebrow">Product demo</p>
        <h1>A rough diagnosis, made inspectable.</h1>
        <p>
          This walkthrough uses a recommendation-ranking problem to show how
          Telic separates repository evidence from claims that still need
          runtime data.
        </p>
      </header>

      <section className="section-compact shell demo-page-frame">
        <DemoVideo />
        <div className="demo-slot-note">
          <FileVideo aria-hidden="true" />
          <div>
            <strong>Product walkthrough</strong>
            <p>
              This recording is a silent loop. Pause it whenever you want; the
              plain-language transcript remains below.
            </p>
          </div>
        </div>
      </section>

      <section className="section demo-timeline-section section-divider">
        <div className="shell">
          <SectionHeading
            eyebrow="Twenty-two seconds"
            title="One clear visual story."
            description="Keep the screen focused on the workflow, compress waiting time, and let the artifacts carry the explanation."
          />
          <ol className="demo-timeline">
            {[
              [
                "00–03",
                "Prompt",
                "Submit the vague recommendation-bias request with analyze-only authority.",
              ],
              [
                "03–06",
                "Context",
                "Show the project root, mode, and repository context being grounded.",
              ],
              [
                "06–09",
                "Structure",
                "Reveal the problem frame and task contract as compact artifact cards.",
              ],
              [
                "09–13",
                "Evidence",
                "Inspect the ranking implementation and preserve the repository source reference.",
              ],
              [
                "13–17",
                "Verify",
                "Highlight analyze_only, zero changed files, and unavailable runtime evidence.",
              ],
              [
                "17–22",
                "Report",
                "End on confirmed findings, unverified claims, and the next evidence needed.",
              ],
            ].map(([time, title, description]) => (
              <li key={time}>
                <time>{time}s</time>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="section transcript-section section-divider"
        id="demo-transcript"
      >
        <div className="shell transcript-grid">
          <div>
            <p className="eyebrow">Demo transcript</p>
            <h2>What the loop communicates.</h2>
          </div>
          <div className="transcript-copy">
            <p>
              A developer reports that one school always appears first. Telic
              preserves the analyze-only boundary, grounds repository context,
              and turns the request into explicit acceptance and evidence needs.
            </p>
            <p>
              Repository evidence shows ranking behavior that always returns the
              first item. Without browser or production data, Telic does not
              claim the dataset is biased. The final report separates the code
              finding from the unverified runtime explanation and confirms that
              no files changed.
            </p>
          </div>
        </div>
      </section>

      <section className="section page-cta-section">
        <div className="shell page-cta">
          <div>
            <p className="eyebrow">Explore the implementation</p>
            <h2>The fixture and workflow are open source.</h2>
          </div>
          <div className="page-cta-actions">
            <TrackedLink
              className="button button-primary"
              eventName="install_cta_clicked"
              href="/install"
            >
              Install Telic <ArrowRight aria-hidden="true" />
            </TrackedLink>
            <TrackedLink
              className="button button-secondary"
              eventName="github_clicked"
              href={siteConfig.github}
              target="_blank"
              rel="noreferrer"
            >
              <GitFork aria-hidden="true" /> GitHub
            </TrackedLink>
          </div>
        </div>
      </section>
    </main>
  );
}
