import { SectionViewTracker } from "./SectionViewTracker";

import "./home.css";

export function HomeProblemSolution() {
  return (
    <SectionViewTracker sectionId="problem" eventName="home-section-view">
      <section id="problem" className="home-problem" aria-labelledby="home-problem-heading">
        <div className="home-problem-visual" aria-hidden>
          <div className="home-problem-tabs">
            <span className="home-problem-tab home-problem-tab-active">repo-a · Actions</span>
            <span className="home-problem-tab">repo-b · Actions</span>
            <span className="home-problem-tab">repo-c · Actions</span>
            <span className="home-problem-tab home-problem-tab-more">+11 more</span>
          </div>
          <div className="home-problem-tab-content">
            <div className="home-problem-tab-pane home-problem-tab-pane-muted" />
            <div className="home-problem-tab-pane home-problem-tab-pane-muted" />
            <div className="home-problem-tab-pane home-problem-tab-pane-active">
              <div className="home-problem-run-line" />
              <div className="home-problem-run-line home-problem-run-line-short" />
            </div>
          </div>
        </div>

        <div className="home-problem-copy">
          <p className="home-section-eyebrow">The problem</p>
          <h2 id="home-problem-heading" className="home-section-title">
            Tired of tab-switching between repos?
          </h2>
          <p className="home-section-body">
            GitHub Actions lives inside each repository. When you manage dozens of repos, checking
            pipeline status means opening tab after tab — and missing failures until someone pings
            you.
          </p>
          <p className="home-section-body home-section-body-accent">
            PipeWatch aggregates every workflow run into one real-time dashboard — so you see what
            matters without leaving the page.
          </p>
        </div>
      </section>
    </SectionViewTracker>
  );
}
