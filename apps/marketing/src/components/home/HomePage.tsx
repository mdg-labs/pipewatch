import { HomeAnchorNav } from "./HomeAnchorNav";
import { HomeEditionsSection } from "./HomeEditionsSection";
import { HomeFeatureHighlights } from "./HomeFeatureHighlights";
import { HomeFinalCtaBand } from "./HomeFinalCtaBand";
import { HomeHero } from "./HomeHero";
import { HomePricingPreview } from "./HomePricingPreview";
import { HomeProblemSolution } from "./HomeProblemSolution";
import { HomeSocialProofBar } from "./HomeSocialProofBar";

import "./home.css";

export interface HomePageProps {
  starCount: number | null;
}

export function HomePage({ starCount }: HomePageProps) {
  return (
    <div className="home-page">
      <HomeHero />
      <HomeSocialProofBar starCount={starCount} />
      <HomeAnchorNav />
      <HomeProblemSolution />
      <HomeFeatureHighlights />
      <HomeEditionsSection />
      <HomePricingPreview />
      <HomeFinalCtaBand />
    </div>
  );
}
