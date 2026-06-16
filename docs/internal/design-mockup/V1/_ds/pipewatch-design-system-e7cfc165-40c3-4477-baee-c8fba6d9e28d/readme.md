# PipeWatch Design System

**Version:** 0.1 · **Author:** MDG Labs · **Date:** June 2026

> A calm, precise control room for your CI/CD — modern and minimal, with a distinct personality.

PipeWatch is a CI/CD monitoring platform (Community Edition + Cloud). This design system provides the complete visual language, component library, and interactive UI kit for building PipeWatch surfaces.

---

## Sources

Bootstrapped from the **PipeWatch Design Direction v0.1** brief (MDG Labs, June 2026). No external codebase or Figma file was provided at initial creation.

- **Figma:** *(link when available — attach to update this DS)*
- **GitHub:** *(link when available)*

---

## Content Fundamentals

### Voice & Tone
Direct, technical, human — not corporate, not jokey. PipeWatch trusts its users (developers) to be capable. Inform; don't coach.

**Adjectives:** precise, calm, confident, direct. **Not:** jovial, exclamatory, apologetic.

### Rules
| Topic | Rule | Example |
|-------|------|---------|
| Casing | Sentence case everywhere | "Repository settings" not "Repository Settings" |
| Numbers | Always figures | "3 runs" not "three runs" |
| Emoji | Never in product UI | — |
| Oxford comma | Yes | "build, test, and deploy" |
| Empty states | Short + honest | "No runs yet." |
| Errors | Specific, actionable | "Repository not found" not "Something went wrong" |
| Durations | Compact monospace | `2m 14s` · `48s` · `1h 02m` |
| Times | Relative recent / absolute in logs | "3 min ago" / "2026-06-15 14:32" |
| Technical strings | Lowercase mono | `main` · `a4f92c1` |

### Status Labels
`Succeeded` · `Failed` · `Running` · `Queued` · `Cancelled` · `Skipped`

---

## Visual Foundations

### Color System
Three-layer palette:

**1. Cool Slate (neutrals):** 252° temperature hint gives surfaces character vs. pure grey. 13-step scale (50–950). Dark mode is `:root` default; light mode via `[data-theme="light"]`.

**2. Amber Signal (brand accent):** `oklch(70% 0.195 55)` — warm amber evoking precision instrument indicator lights. Used sparingly: primary actions, active states, focus rings, logo mark. This is the color people remember PipeWatch by. Not the default SaaS blue.

**3. Status palette:** Calibrated for screen-day-long legibility:
- **Success** `oklch(63% 0.163 148)` — understated green
- **Failure** `oklch(58% 0.205 23)` — calm red, non-alarmist
- **Running** = accent amber (it is an "active signal")
- **Cancelled** = neutral slate
- **Skipped** `oklch(60% 0.090 298)` — muted violet
- **Queued** `oklch(62% 0.105 232)` — steel blue

All status indicators pair icon + color + label (never color alone — WCAG).

### Typography
- **UI sans:** Hanken Grotesk — geometric grotesque, subtle technical quality, legible at 12px
- **Monospace:** JetBrains Mono — expressive, excellent small-size legibility
- **Base size:** 14px (data-dense developer tool)
- **Hierarchy:** weight + size only — no underlines, no decorative elements
- **Tabular figures:** always in tables and numeric displays
- **Monospace used for:** commit SHAs, branch names, run IDs, durations, env vars, repo paths

⚠️ **Font licensing:** Both are freely licensed and self-hostable. Production builds MUST self-host via `@font-face` — no Google Fonts CDN (GDPR/DSGVO). See `tokens/fonts.css` for the template.

### Spacing
4px base unit. Named tokens `--space-1` through `--space-32`. Default gutters: `--space-5` (cards), `--space-8` (page).

### Border Radius — soft-but-not-pill
`4px` chips/tags · `6px` buttons/inputs · `8px` cards ★ · `12px` modals · `9999px` pills/avatars

### Backgrounds & Surfaces
**No gradients, no textures.** Solid surfaces only. Dark mode: 5-level elevation from `--bg-base` (darkest) to `--bg-overlay` (lightest). Surfaces defined primarily by borders; shadows reserved for floating elements (tooltips, modals).

### Motion
- **Live pulse:** `opacity 1→0.25` at 1.5s — signals "this run is alive"
- **Transitions:** 100ms fast (hover), 180ms normal (state)
- **Easing:** `cubic-bezier(0, 0, 0.2, 1)` ease-out for all interactions
- **No bounce, no spring** — technical, not playful
- **Respects** `prefers-reduced-motion`

### Hover / Press States
- Hover: background shifts one elevation level (`--bg-elevated` → `--bg-overlay`)
- Press: `transform: scale(0.97)` on buttons
- Focus: double-ring `0 0 0 2px bg-base, 0 0 0 4px accent` — always amber

---

## Iconography

**Set:** [Lucide Icons](https://lucide.dev) — SVG, stroke-based, 2px weight, rounded caps.

Usage: `16px` for UI controls · `14px` inline with text · `20px` navigation · `24px` empty states.

Always `stroke="currentColor"`. Never PNG icons. Status icons always pair with color + label.

| Status | Lucide icon |
|--------|-------------|
| Success | `CheckCircle2` |
| Failure | `XCircle` |
| Running | `Loader2` (spin) |
| Cancelled | `MinusCircle` |
| Skipped | `SkipForward` |
| Queued | `Clock` |

---

## Components

### Core
| Component | Description |
|-----------|-------------|
| `Button` | Primary actions. Variants: primary, secondary, ghost, danger |
| `StatusBadge` | Run state: icon + color + label. All 6 states |
| `Badge` | Lightweight label/count chip |
| `Input` | Text input with label, error, hint, mono mode |
| `Card` | Surface container with optional header/footer |
| `Avatar` | Image with initials fallback, sizes xs–xl |

### Forms
| Component | Description |
|-----------|-------------|
| `Select` | Styled native select — single-value dropdown |
| `Checkbox` | Accessible checkbox with indeterminate state |
| `Switch` | Toggle for immediate-effect settings. Sizes sm/md/lg |
| `Radio` | Single radio button |
| `RadioGroup` | Mutually exclusive option group. Supports inline layout |

### Feedback
| Component | Description |
|-----------|-------------|
| `Skeleton` | Loading placeholder — line, block, circle, rounded |
| `RunPulse` | Amber animated dot for live run state |
| `EmptyState` | Zero-data state with icon, title, description, CTA |

### Navigation
| Component | Description |
|-----------|-------------|
| `Tabs` | Horizontal tab strip with amber active underline |

### Data
| Component | Description |
|-----------|-------------|
| `Sparkline` | Compact SVG trend line for 7-day sparklines |
| `RepoCard` | Composite: repo name + status badge + sparkline |

### Overlay
| Component | Description |
|-----------|-------------|
| `Dialog` | Modal with focus trap, Esc to close, portal render |
| `Tooltip` | Hover tooltip with configurable position and delay |
| `Toast` | Transient notification with 5 variants |
| `ToastStack` | Portal-rendered stack of Toast items |

---

## Templates

### PipeWatch Dashboard (`templates/dashboard/`)
Full-page DC template: sidebar nav, stat cards, runs table, EmptyState slot. Accepts `pageTitle`, `stats`, `runs`, `edition`, `userName` props.

Entry: `templates/dashboard/Dashboard.dc.html`

## UI Kits

### App (`ui_kits/app/`)
Full interactive prototype — 6 screens:
- **Dashboard:** stats, repository card grid, recent runs table
- **Runs:** full runs table with live search
- **Run detail:** stage pipeline + log output
- **Repositories:** filterable table (All/Passing/Failing/Running), search
- **Insights:** 14-day bar+line chart, repository breakdown table
- **Settings:** notifications (switches), general (selects), danger zone
- Theme toggle (dark ↔ light), nav state persisted in localStorage

Entry: `ui_kits/app/index.html`

---

## File Index

```
pipewatch-ds/
├── readme.md                   ← this file
├── SKILL.md                    ← Claude agent skill definition
├── styles.css                  ← global entry point (@imports only)
├── assets/
│   ├── logo.svg                ← mark only (32×32, currentColor)
│   └── logo-wordmark.svg       ← mark + logotype
├── tokens/
│   ├── fonts.css               ← @font-face (⚠️ see GDPR note inside)
│   ├── colors.css              ← OKLCH primitives (amber + slate + status + chart)
│   ├── semantic.css            ← theme-aware aliases (dark default, light via data-theme)
│   ├── typography.css          ← font families, type scale, weights
│   ├── spacing.css             ← 4px spacing scale + border radii
│   ├── shadows.css             ← elevation system + glow effects
│   └── motion.css              ← durations, easings, keyframes
├── components/
│   ├── core/                   ← Button, StatusBadge, Badge, Input, Card, Avatar
│   ├── forms/                  ← Select, Checkbox, Switch, Radio, RadioGroup
│   ├── feedback/               ← Skeleton, RunPulse, EmptyState
│   ├── navigation/             ← Tabs
│   ├── data/                   ← Sparkline, RepoCard
│   └── overlay/                ← Dialog, Tooltip, Toast, ToastStack
├── guidelines/                 ← Foundation specimen cards (Design System tab)
├── templates/
│   └── dashboard/              ← PipeWatch Dashboard DC template
│   ├── brand-identity.card.html
│   ├── colors-accent.card.html
│   ├── colors-neutral.card.html
│   ├── colors-status.card.html
│   ├── colors-chart.card.html
│   ├── type-families.card.html
│   ├── type-scale.card.html
│   ├── type-mono.card.html
│   ├── spacing-scale.card.html
│   ├── radius-tokens.card.html
│   ├── shadows-elevation.card.html
│   └── motion-tokens.card.html
└── ui_kits/
    └── app/
        ├── index.html          ← entry (links styles.css, loads React + Babel)
        └── App.jsx             ← full app (data, components, views)
```
