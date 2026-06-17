#!/usr/bin/env python3
"""Parse pipewatch-development-roadmap.md and sync to GitHub issues."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

OWNER = "mdg-labs"
REPO = "pipewatch"
MILESTONE = 1
ASSIGNEE = "mdguggenbichler"
PROJECT_ID = "PVT_kwDODv-LLc4Ba3QP"
STATUS_FIELD_ID = "PVTSSF_lADODv-LLc4Ba3QPzhVryEg"
READY_STATUS_ID = "a0e7153f"
ISSUE_TYPE_FEATURE = "IT_kwDODv-LLc4B0C9-"
ISSUE_TYPE_TASK = "IT_kwDODv-LLc4B0C98"
FIELD_PRIORITY = "IFSS_kgDOAkmjgg"
FIELD_EFFORT = "IFSS_kgDOAkmjhQ"
PRIORITY_MEDIUM = "IFSSO_kgDOBADGPw"
EFFORT_LOW = "IFSSO_kgDOBADGQw"
EFFORT_MEDIUM = "IFSSO_kgDOBADGQg"
EFFORT_HIGH = "IFSSO_kgDOBADGQQ"
ROADMAP = Path(__file__).resolve().parents[1] / "docs/internal/pipewatch-development-roadmap.md"
MAP_FILE = Path(__file__).resolve().parents[1] / "docs/internal/github-roadmap-issue-map.json"

EFFORT_TO_ORG = {"XS": EFFORT_LOW, "S": EFFORT_LOW, "M": EFFORT_MEDIUM, "L": EFFORT_HIGH, "XL": EFFORT_HIGH}

EPIC_ORDER = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15", "P16", "P17", "P18", "P19", "P21"]

EPIC_META = {
    "P0": ("Monorepo & tooling foundation", "domain:infrastructure", "Empty repo → buildable Turborepo with apps/packages skeleton, edition config, env validation, Sentry hooks."),
    "P1": ("Design system package", "domain:frontend", "Port V1 design tokens and core components into packages/ui for use by web + marketing."),
    "P2": ("Database schema & migrations", "domain:infrastructure", "Full MVP Drizzle schema per PRD §6 with vendor-neutral naming."),
    "P3": ("API platform (Hono + OpenAPI)", "domain:backend", "Versioned REST API skeleton with Scalar docs, auth middleware hooks, workspace scoping."),
    "P4": ("Authentication", "domain:backend", "GitHub OAuth, JWT sessions, refresh rotation, API keys."),
    "P5": ("Workspaces, members, invites", "domain:backend", "Full workspace CRUD, membership, invite flow, public invite accept."),
    "P6": ("GitHub integration service", "domain:backend", "GitHub App installation, token refresh, repo discovery, integrations REST."),
    "P7": ("Worker, queues & ingestion", "domain:backend", "BullMQ worker processing webhooks, backfill, polling, retention."),
    "P8": ("Pipeline REST + insights", "domain:backend", "Expose runs, jobs, steps, insights to dashboard."),
    "P9": ("SSE real-time", "domain:backend", "Live run/job updates to dashboard without polling."),
    "P10": ("Webhooks & public APIs", "domain:backend", "Inbound webhooks and cloud-only public endpoints."),
    "P11": ("Stripe billing & plan enforcement", "domain:backend", "Cloud billing checkout, portal, webhooks, enforce limits."),
    "P12": ("Web app shell & shared layout", "domain:frontend", "Next.js app with sidebar, auth gating, design system wired."),
    "P13": ("Auth & onboarding UI", "domain:frontend", "Sign-in, CE bootstrap, onboarding wizard, invite accept pages."),
    "P14": ("Dashboard & pipeline UI", "domain:frontend", "Dashboard, repo detail, run detail, repo settings, insights pages."),
    "P15": ("Settings & account UI", "domain:frontend", "Workspace settings, members, integrations, API keys, billing, account."),
    "P16": ("Marketing site", "domain:operations", "Marketing layout, homepage, pricing, docs, changelog, waitlist, legal."),
    "P17": ("CE Docker Compose delivery", "domain:infrastructure", "Production Dockerfiles and docker-compose for PipeWatch CE."),
    "P18": ("CI/CD & deployment workflows", "domain:infrastructure", "CI workflows, deploy orchestrator, sync-secrets, CE image builds."),
    "P19": ("E2E & launch hardening", "domain:operations", "Playwright E2E, OpenAPI audit, CE smoke docs, page inventory checklist."),
    "P21": ("Test infrastructure", "domain:infrastructure", "Ephemeral Postgres/Redis for integration tests, Vitest + ReportPortal."),
}


def epic_title(phase: str) -> str:
    name, _, _ = EPIC_META[phase]
    return f"[{phase}] {name}"


@dataclass
class Task:
    id: str
    title: str
    phase: str
    domain: str
    deps: str
    effort: str
    doc_ref: str = ""
    design_ref: str = ""
    route: str = ""
    acceptance: list[str] = field(default_factory=list)
    tests: str = ""


def gh_api(method_path: str, http_method: str = "GET", payload: dict | None = None) -> dict:
    cmd = ["gh", "api", method_path, "-X", http_method]
    if payload is not None:
        cmd.extend(["--input", "-"])
    proc = subprocess.run(
        cmd,
        input=json.dumps(payload).encode() if payload is not None else None,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"gh api failed ({' '.join(cmd)}): {proc.stderr.decode()}\n{proc.stdout.decode()}"
        )
    out = proc.stdout.decode().strip()
    return json.loads(out) if out else {}


def gh_graphql(query: str) -> dict:
    proc = subprocess.run(["gh", "api", "graphql", "-f", f"query={query}"], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)
    data = json.loads(proc.stdout)
    if data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"]))
    return data["data"]


def load_existing_issues() -> tuple[dict[str, int], dict[str, dict]]:
    """Return epic_nums by phase and task_records by roadmap id from open issues."""
    proc = subprocess.run(
        ["gh", "api", f"repos/{OWNER}/{REPO}/issues?state=open&per_page=100", "--paginate"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)
    raw = proc.stdout.strip()
    # --paginate may emit a JSON array per page on separate lines or one merged array
    if raw.startswith("["):
        issues = json.loads(raw)
    else:
        issues = []
        for line in raw.splitlines():
            chunk = json.loads(line)
            if isinstance(chunk, list):
                issues.extend(chunk)
            else:
                issues.append(chunk)
    epic_nums: dict[str, int] = {}
    task_records: dict[str, dict] = {}
    title_to_phase = {name: phase for phase, (name, _, _) in EPIC_META.items()}
    for issue in issues:
        labels = [lb["name"] for lb in issue.get("labels", [])]
        title = issue["title"]
        if "type:epic" in labels:
            m = re.match(r"^\[(P\d+)\]\s+", title)
            if m and m.group(1) in EPIC_META:
                epic_nums[m.group(1)] = issue["number"]
            elif title in title_to_phase:
                epic_nums[title_to_phase[title]] = issue["number"]
        m = re.match(r"^\[(P\d+-\d+)\]", title)
        if m:
            task_records[m.group(1)] = {
                "number": issue["number"],
                "id": issue["id"],
                "node_id": issue["node_id"],
                "title": title.split("] ", 1)[-1],
            }
    return epic_nums, task_records


def parse_roadmap(text: str) -> list[Task]:
    tasks: list[Task] = []
    current: Task | None = None
    in_ac = False

    for line in text.splitlines():
        m = re.match(r"^- \[ \] \*\*(P\d+-\d+)\*\* — (.+)$", line)
        if m:
            if current:
                tasks.append(current)
            tid, title = m.groups()
            current = Task(id=tid, title=title.strip(), phase=tid.split("-")[0], domain="", deps="", effort="M")
            in_ac = False
            continue
        if not current:
            continue
        if line.strip().startswith("- **Domain:**"):
            parts = line.split("|")
            for p in parts:
                if "domain:" in p:
                    current.domain = re.search(r"domain:\w+", p).group(0)
                if "Deps:" in p:
                    current.deps = p.split("Deps:")[-1].strip()
                if "Effort:" in p:
                    current.effort = p.split("Effort:")[-1].strip()
        elif line.strip().startswith("- **Doc ref:**"):
            current.doc_ref = line.split("**Doc ref:**", 1)[1].strip()
        elif line.strip().startswith("- **Design ref:**"):
            current.design_ref = line.split("**Design ref:**", 1)[1].strip()
        elif line.strip().startswith("- **Route:**"):
            current.route = line.split("**Route:**", 1)[1].strip()
        elif line.strip() == "- **Acceptance criteria:**":
            in_ac = True
        elif line.strip().startswith("- **Tests:**"):
            current.tests = line.split("**Tests:**", 1)[1].strip()
            in_ac = False
        elif in_ac and line.strip().startswith("- "):
            current.acceptance.append(line.strip()[2:])
        elif line.startswith("## P") and current:
            tasks.append(current)
            current = None
            in_ac = False
    if current:
        tasks.append(current)
    return tasks


def task_body(task: Task, epic_num: int | None) -> str:
    ac = "\n".join(f"- [ ] {c}" for c in task.acceptance)
    lines = [
        f"## {task.title}",
        "",
        f"**Roadmap ID:** `{task.id}`",
        f"**Parent feature:** #{epic_num}" if epic_num else "",
        f"**Depends on:** {task.deps or 'none'}",
        f"**Spec refs:** {task.doc_ref}" if task.doc_ref else "",
        f"**Design refs:** {task.design_ref}" if task.design_ref else "",
        f"**Route:** {task.route}" if task.route else "",
        "",
        "---",
        "",
        "### Acceptance criteria",
        "",
        ac or "- [ ] See roadmap",
        "",
        "---",
        "",
        "### Verification",
        "",
        task.tests or "pnpm lint, typecheck, test:unit, build as applicable",
        "",
        "---",
        "",
        "Source: `docs/internal/pipewatch-development-roadmap.md`",
    ]
    return "\n".join(l for l in lines if l is not None)


def epic_body(phase: str, children: list[tuple[str, int, str]]) -> str:
    name, _, goal = EPIC_META[phase]
    rows = "\n".join(f"| #{num} | `{tid}` | {title[:60]} |" for tid, num, title in children)
    return f"""## Feature: {name}

**Roadmap phase:** `{phase}`
**Background:** {goal}

---

### Sub-issues

| Issue | Roadmap ID | Title |
|---|---|---|
{rows}

---

### Suggested implementation order

Implement leaf tasks in roadmap order (`{phase}-01` → `{phase}-NN`).

---

Source: `docs/internal/pipewatch-development-roadmap.md`
"""


def create_issue(
    title: str,
    body: str,
    labels: list[str],
    issue_type_id: str,
    effort_option_id: str,
) -> dict:
    issue = gh_api(
        f"repos/{OWNER}/{REPO}/issues",
        "POST",
        {
            "title": title,
            "body": body,
            "labels": labels,
            "assignees": [ASSIGNEE],
            "milestone": MILESTONE,
        },
    )
    node_id = issue["node_id"]
    gh_graphql(
        "mutation {"
        f'  updateIssue(input: {{id: "{node_id}", issueTypeId: "{issue_type_id}"}}) {{'
        "    issue { number }"
        "  }"
        "}"
    )
    gh_graphql(
        "mutation {"
        f'  setIssueFieldValue(input: {{issueId: "{node_id}", issueFields: ['
        f'    {{fieldId: "{FIELD_PRIORITY}", singleSelectOptionId: "{PRIORITY_MEDIUM}"}},'
        f'    {{fieldId: "{FIELD_EFFORT}", singleSelectOptionId: "{effort_option_id}"}}'
        f"  ]}}) {{ clientMutationId }} }}"
    )
    return issue


def add_to_project_and_ready(issue_node_id: str) -> None:
    item_id: str | None = None
    try:
        data = gh_graphql(
            "mutation {"
            f'  addProjectV2ItemById(input: {{projectId: "{PROJECT_ID}", contentId: "{issue_node_id}"}}) {{'
            "    item { id }"
            "  }"
            "}"
        )
        item_id = data["addProjectV2ItemById"]["item"]["id"]
    except RuntimeError as exc:
        if "already exists" not in str(exc).lower():
            raise
        data = gh_graphql(
            "query {"
            f'  node(id: "{issue_node_id}") {{'
            "    ... on Issue {"
            "      projectItems(first: 20) {"
            "        nodes { id project { number } }"
            "      }"
            "    }"
            "  }"
            "}"
        )
        nodes = data["node"]["projectItems"]["nodes"]
        item_id = next(n["id"] for n in nodes if n["project"]["number"] == 5)
    gh_graphql(
        "mutation {"
        f'  updateProjectV2ItemFieldValue(input: {{'
        f'    projectId: "{PROJECT_ID}", itemId: "{item_id}", fieldId: "{STATUS_FIELD_ID}",'
        f'    value: {{singleSelectOptionId: "{READY_STATUS_ID}"}}'
        f"  }}) {{ projectV2Item {{ id }} }} }}"
    )


def link_sub_issue(parent_num: int, child_db_id: int) -> None:
    gh_api(
        f"repos/{OWNER}/{REPO}/issues/{parent_num}/sub_issues",
        "POST",
        {"sub_issue_id": child_db_id},
    )


def main() -> None:
    resume = "--resume" in sys.argv
    rename_epics = "--rename-epics" in sys.argv
    text = ROADMAP.read_text()
    tasks = parse_roadmap(text)
    if resume or rename_epics:
        epic_nums, task_records = load_existing_issues()
        if rename_epics:
            for phase in [p for p in EPIC_ORDER if p in EPIC_META]:
                num = epic_nums.get(phase)
                if not num:
                    print(f"Skipping {phase}: epic not found")
                    continue
                title = epic_title(phase)
                gh_api(f"repos/{OWNER}/{REPO}/issues/{num}", "PATCH", {"title": title})
                print(f"Renamed #{num} → {title}")
            print("Done renaming epics.")
            return
        print(f"Resume: {len(epic_nums)} epics, {len(task_records)} tasks already on GitHub.")
    else:
        epic_nums = {}
        task_records = {}

    phases = [p for p in EPIC_ORDER if p in EPIC_META]
    for phase in phases:
        if phase in epic_nums:
            print(f"Skipping epic {phase} (#{epic_nums[phase]})...")
            continue
        name, domain, _ = EPIC_META[phase]
        print(f"Creating epic {phase}...")
        issue = create_issue(
            title=epic_title(phase),
            body=f"## Feature: {name}\n\nRoadmap phase `{phase}`. Sub-issues will be linked below.",
            labels=[domain, "type:epic", "effort:L"],
            issue_type_id=ISSUE_TYPE_FEATURE,
            effort_option_id=EFFORT_HIGH,
        )
        epic_nums[phase] = issue["number"]
        add_to_project_and_ready(issue["node_id"])
        time.sleep(0.3)

    for task in tasks:
        if task.id in task_records:
            print(f"Skipping task {task.id} (#{task_records[task.id]['number']})...")
            rec = task_records[task.id]
            parent = epic_nums.get(task.phase)
            if parent:
                try:
                    link_sub_issue(parent, int(rec["id"]))
                except RuntimeError as exc:
                    msg = str(exc).lower()
                    if "duplicate" not in msg and "already" not in msg and "one parent" not in msg:
                        raise
            continue
        print(f"Creating task {task.id}...")
        effort_label = f"effort:{task.effort}"
        issue = create_issue(
            title=f"[{task.id}] {task.title}",
            body=task_body(task, epic_nums.get(task.phase)),
            labels=[task.domain or EPIC_META[task.phase][1], "type:task", effort_label],
            issue_type_id=ISSUE_TYPE_TASK,
            effort_option_id=EFFORT_TO_ORG.get(task.effort, EFFORT_MEDIUM),
        )
        task_records[task.id] = {
            "number": issue["number"],
            "id": issue["id"],
            "node_id": issue["node_id"],
            "title": task.title,
        }
        add_to_project_and_ready(issue["node_id"])
        parent = epic_nums.get(task.phase)
        if parent:
            link_sub_issue(parent, int(issue["id"]))
        time.sleep(0.3)

    # Update epic bodies with child table
    for phase, epic_num in epic_nums.items():
        children = [
            (tid, rec["number"], rec["title"])
            for tid, rec in sorted(task_records.items())
            if tid.startswith(phase + "-")
        ]
        if not children:
            continue
        gh_api(
            f"repos/{OWNER}/{REPO}/issues/{epic_num}",
            "PATCH",
            {"body": epic_body(phase, children)},
        )

    out = {"epics": epic_nums, "tasks": task_records}
    MAP_FILE.write_text(json.dumps(out, indent=2))
    print(f"Done. {len(epic_nums)} epics, {len(task_records)} tasks.")
    print(f"Map written to {MAP_FILE}")

    print("Ensuring all issues are on project board with Status=Ready...")
    for phase, num in epic_nums.items():
        issue = gh_api(f"repos/{OWNER}/{REPO}/issues/{num}")
        add_to_project_and_ready(issue["node_id"])
    for rec in task_records.values():
        issue = gh_api(f"repos/{OWNER}/{REPO}/issues/{rec['number']}")
        add_to_project_and_ready(issue["node_id"])
        time.sleep(0.15)


if __name__ == "__main__":
    main()
