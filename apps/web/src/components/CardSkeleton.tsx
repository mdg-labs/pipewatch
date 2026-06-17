import { Skeleton } from "@pipewatch/ui";

import "./loading-skeletons.css";

export interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 1 }: CardSkeletonProps) {
  return (
    <div
      className="pw-card-skeleton-grid"
      aria-busy="true"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={`card-${index}`} className="pw-card-skeleton">
          <Skeleton variant="line" width="40%" height={10} />
          <Skeleton variant="line" width="65%" height={28} />
          <Skeleton variant="line" width="50%" height={10} />
        </div>
      ))}
    </div>
  );
}
