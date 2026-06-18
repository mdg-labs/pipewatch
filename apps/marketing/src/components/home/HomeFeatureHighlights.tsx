import { featureHighlights } from "./home-content";
import { HomeFeatureVisual } from "./HomeFeatureVisual";
import { SectionViewTracker } from "./SectionViewTracker";

import "./home.css";

type Feature = (typeof featureHighlights)[number];

function FeatureCopy({ feature }: { feature: Feature }) {
  return (
    <div className="home-feature-copy">
      <p className="home-section-eyebrow">{feature.eyebrow}</p>
      <h2 id={`home-feature-${feature.id}`} className="home-section-title">
        {feature.title}
      </h2>
      <p className="home-section-body">{feature.description}</p>
      <ul className="home-feature-bullets">
        {feature.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </div>
  );
}

export function HomeFeatureHighlights() {
  return (
    <SectionViewTracker sectionId="features" eventName="home-section-view">
      <div id="features" className="home-features">
        {featureHighlights.map((feature, index) => {
          const reversed = index % 2 === 1;

          return (
            <section
              key={feature.id}
              className={`home-feature ${reversed ? "home-feature-reversed" : ""} ${index % 2 === 1 ? "home-feature-surface" : ""}`}
              aria-labelledby={`home-feature-${feature.id}`}
            >
              <div className="home-feature-grid">
                {reversed ? (
                  <>
                    <div className="home-feature-visual">
                      <HomeFeatureVisual type={feature.visual} />
                    </div>
                    <FeatureCopy feature={feature} />
                  </>
                ) : (
                  <>
                    <FeatureCopy feature={feature} />
                    <div className="home-feature-visual">
                      <HomeFeatureVisual type={feature.visual} />
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </SectionViewTracker>
  );
}
