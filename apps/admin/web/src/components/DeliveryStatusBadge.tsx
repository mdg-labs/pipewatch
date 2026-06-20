import type { DeliveryOutcome } from "../api/types.js";
import { Badge, StatusBadge, type PipelineStatus } from "@pipewatch/ui";

const OUTCOME_LABEL: Record<DeliveryOutcome, string> = {
  success: "Success",
  http_failure: "HTTP failure",
  unreachable: "Unreachable",
};

const OUTCOME_STATUS: Record<DeliveryOutcome, PipelineStatus> = {
  success: "success",
  http_failure: "failure",
  unreachable: "failure",
};

type DeliveryStatusBadgeProps = {
  outcome: DeliveryOutcome;
  statusCode: number;
};

/** Map webhook delivery outcome to shared status badge primitives. */
export function DeliveryStatusBadge({
  outcome,
  statusCode,
}: DeliveryStatusBadgeProps) {
  if (outcome === "unreachable") {
    return (
      <Badge variant="failure" aria-label="Unreachable delivery">
        Unreachable ({statusCode})
      </Badge>
    );
  }

  return (
    <StatusBadge
      status={OUTCOME_STATUS[outcome]}
      label={`${OUTCOME_LABEL[outcome]} (${String(statusCode)})`}
      size="md"
    />
  );
}

export function deliveryOutcomeLabel(outcome: DeliveryOutcome): string {
  return OUTCOME_LABEL[outcome];
}

export function isUnreachableDelivery(statusCode: number): boolean {
  return statusCode === 0;
}
