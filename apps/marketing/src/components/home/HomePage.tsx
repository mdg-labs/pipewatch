import { getGitHubStarCount } from "@/lib/github-stars";

import { HomeAnchorNav } from "./HomeAnchorNav";
import { HomeEditionsSection } from "./HomeEditionsSection";
import { HomeFeatureHighlights } from "./HomeFeatureHighlights";
import { HomeFinalCtaBand } from "./HomeFinalCtaBand";
import { HomeHero } from "./HomeHero";
import { HomePricingPreview } from "./HomePricingPreview";
import { HomeProblemSolution } from "./HomeProblemSolution";
import { HomeSocialProofBar } from "./HomeSocialProofBar";

import "./home.css";

export async function HomePage() {
  const starCount = await getGitHubStarCount();

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
