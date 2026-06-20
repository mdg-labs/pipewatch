const KNOWN_TRIGGER_TYPES = [
  "push",
  "pull_request",
  "schedule",
  "workflow_dispatch",
  "repository_dispatch",
  "release",
  "issue",
  "unknown",
] as const;

type KnownTriggerType = (typeof KNOWN_TRIGGER_TYPES)[number];

function isKnownTriggerType(value: string): value is KnownTriggerType {
  return (KNOWN_TRIGGER_TYPES as readonly string[]).includes(value);
}

function titleCaseTriggerType(triggerType: string): string {
  return triggerType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTriggerLabel(
  triggerType: string,
  t?: (key: KnownTriggerType) => string,
): string {
  if (t && isKnownTriggerType(triggerType)) {
    return t(triggerType);
  }

  return titleCaseTriggerType(triggerType);
}
