export const homeAnchorLinks = [
  { href: "#problem", label: "Problem", event: "home-nav-problem" },
  { href: "#features", label: "Features", event: "home-nav-features" },
  { href: "#editions", label: "Editions", event: "home-nav-editions" },
  { href: "#pricing", label: "Pricing", event: "home-nav-pricing" },
] as const;

export const socialProofItems = [
  "Open source",
  "Self-hostable",
  "Real-time SSE",
  "EU data residency",
] as const;

export const featureHighlights = [
  {
    id: "live-pipeline",
    eyebrow: "Feature 01",
    title: "Live pipeline view",
    description:
      "See every workflow run the moment it starts. Jobs, steps, durations — live, without refreshing.",
    bullets: [
      "Server-sent events, zero polling",
      "Visual DAG — see job dependencies instantly",
      "Failed step highlighted automatically",
    ],
    visual: "pipeline-dag" as const,
  },
  {
    id: "multi-repo",
    eyebrow: "Feature 02",
    title: "Multi-repo dashboard",
    description:
      "One dashboard for all your repos. Sort by failure rate, filter by status, spot problems instantly.",
    bullets: [
      "7-day sparklines for every repo",
      "Filter by status, sort by last run",
      "All pipeline states represented",
    ],
    visual: "repo-grid" as const,
  },
  {
    id: "insights",
    eyebrow: "Feature 03",
    title: "Insights",
    description:
      "Understand failure trends, slow jobs, and flaky workflows across your workspace — without exporting CSVs.",
    bullets: [
      "Failure rate trends over 7 and 30 days",
      "Slowest jobs and steps ranked",
      "Repo health at a glance",
    ],
    visual: "insights-chart" as const,
  },
  {
    id: "self-hostable",
    eyebrow: "Feature 04",
    title: "Self-hostable",
    description:
      "Run PipeWatch CE on your own infrastructure with Docker Compose. Same codebase, no licence key.",
    bullets: [
      "Single-command Docker Compose setup",
      "All features included — free forever",
      "Your data stays on your network",
    ],
    visual: "docker-compose" as const,
  },
] as const;

export const pricingPlans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    highlight: false,
    summary: "1 workspace · 10 repos · 30-day retention",
    features: ["Live pipeline view", "Basic insights", "API access"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/mo",
    highlight: true,
    badge: "Most popular",
    summary: "3 workspaces · 50 repos · 365-day retention",
    features: ["Advanced analytics", "Up to 5 members", "Priority queue"],
  },
  {
    id: "business",
    name: "Business",
    price: "$49",
    period: "/mo",
    highlight: false,
    summary: "Unlimited workspaces · repos · members",
    features: ["Priority support", "Advanced analytics", "SSO (soon)"],
  },
] as const;
