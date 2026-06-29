import type { PipelineJob } from "@pipewatch/types";

/** Design mockup intrinsic node size (Run Detail.dc.html). */
export const DAG_NODE_WIDTH = 124;
export const DAG_NODE_HEIGHT = 52;
export const DAG_COLUMN_GAP = 62;
export const DAG_ROW_GAP = 24;
export const DAG_PADDING = 24;

export type DagNodeLayout = {
  jobId: string;
  column: number;
  row: number;
  x: number;
  y: number;
};

export type DagEdgeLayout = {
  fromJobId: string;
  toJobId: string;
  path: string;
};

export type JobDagLayout = {
  nodes: DagNodeLayout[];
  edges: DagEdgeLayout[];
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
};

export type LayoutJobDagOptions = {
  nowMs?: number;
  /** @deprecated Ignored — layout uses fixed intrinsic dimensions; viewport handles fit/pan/zoom. */
  containerWidth?: number;
};

type LayoutMetrics = {
  nodeWidth: number;
  nodeHeight: number;
  columnGap: number;
  rowGap: number;
  padding: number;
  width: number;
  height: number;
};

function getJobEndTime(job: PipelineJob, nowMs: number): number {
  if (job.completed_at) {
    return new Date(job.completed_at).getTime();
  }

  if (job.duration_ms !== null) {
    return new Date(job.started_at).getTime() + job.duration_ms;
  }

  return nowMs;
}

/** Group jobs into parallel waves by overlapping start/end windows (B6 DAG). */
export function groupJobsIntoWaves(
  jobs: PipelineJob[],
  nowMs = Date.now(),
): PipelineJob[][] {
  if (jobs.length === 0) {
    return [];
  }

  const waves: PipelineJob[][] = [];
  let waveEnd = 0;

  for (const job of jobs) {
    const start = new Date(job.started_at).getTime();
    const end = getJobEndTime(job, nowMs);

    if (waves.length === 0 || start >= waveEnd) {
      waves.push([job]);
      waveEnd = end;
      continue;
    }

    waves[waves.length - 1]!.push(job);
    waveEnd = Math.max(waveEnd, end);
  }

  return waves;
}

function naturalWidth(columnCount: number): number {
  return (
    DAG_PADDING * 2 +
    columnCount * DAG_NODE_WIDTH +
    Math.max(0, columnCount - 1) * DAG_COLUMN_GAP
  );
}

function naturalHeight(rowCount: number): number {
  return (
    DAG_PADDING * 2 +
    rowCount * DAG_NODE_HEIGHT +
    Math.max(0, rowCount - 1) * DAG_ROW_GAP
  );
}

/** Fixed intrinsic metrics — graph size grows with columns/rows, never upscales to fill a container. */
export function resolveLayoutMetrics(columnCount: number, rowCount: number): LayoutMetrics {
  if (columnCount === 0) {
    return {
      nodeWidth: DAG_NODE_WIDTH,
      nodeHeight: DAG_NODE_HEIGHT,
      columnGap: DAG_COLUMN_GAP,
      rowGap: DAG_ROW_GAP,
      padding: DAG_PADDING,
      width: 0,
      height: 0,
    };
  }

  return {
    nodeWidth: DAG_NODE_WIDTH,
    nodeHeight: DAG_NODE_HEIGHT,
    columnGap: DAG_COLUMN_GAP,
    rowGap: DAG_ROW_GAP,
    padding: DAG_PADDING,
    width: naturalWidth(columnCount),
    height: naturalHeight(rowCount),
  };
}

function nodePosition(
  column: number,
  row: number,
  metrics: LayoutMetrics,
): { x: number; y: number } {
  return {
    x: metrics.padding + column * (metrics.nodeWidth + metrics.columnGap),
    y: metrics.padding + row * (metrics.nodeHeight + metrics.rowGap),
  };
}

function buildEdgePath(
  from: DagNodeLayout,
  to: DagNodeLayout,
  metrics: LayoutMetrics,
): string {
  const fromX = from.x + metrics.nodeWidth;
  const fromY = from.y + metrics.nodeHeight / 2;
  const toX = to.x;
  const toY = to.y + metrics.nodeHeight / 2;
  const midX = fromX + (toX - fromX) / 2;

  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

/** Compute DAG node positions and connector paths for the job graph (page B6). */
export function layoutJobDag(
  jobs: PipelineJob[],
  optionsOrNowMs: LayoutJobDagOptions | number = {},
): JobDagLayout {
  const options =
    typeof optionsOrNowMs === "number" ? { nowMs: optionsOrNowMs } : optionsOrNowMs;
  const nowMs = options.nowMs ?? Date.now();
  const waves = groupJobsIntoWaves(jobs, nowMs);

  if (waves.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      nodeWidth: DAG_NODE_WIDTH,
      nodeHeight: DAG_NODE_HEIGHT,
    };
  }

  const columnCount = waves.length;
  const rowCount = Math.max(...waves.map((wave) => wave.length), 1);
  const metrics = resolveLayoutMetrics(columnCount, rowCount);

  const nodes: DagNodeLayout[] = [];

  waves.forEach((wave, column) => {
    wave.forEach((job, row) => {
      const position = nodePosition(column, row, metrics);
      nodes.push({
        jobId: job.id,
        column,
        row,
        x: position.x,
        y: position.y,
      });
    });
  });

  const nodeByJobId = new Map(nodes.map((node) => [node.jobId, node]));
  const edges: DagEdgeLayout[] = [];

  for (let column = 0; column < waves.length - 1; column += 1) {
    const fromJobs = waves[column]!;
    const toJobs = waves[column + 1]!;

    for (const fromJob of fromJobs) {
      for (const toJob of toJobs) {
        const fromNode = nodeByJobId.get(fromJob.id);
        const toNode = nodeByJobId.get(toJob.id);

        if (!fromNode || !toNode) {
          continue;
        }

        edges.push({
          fromJobId: fromJob.id,
          toJobId: toJob.id,
          path: buildEdgePath(fromNode, toNode, metrics),
        });
      }
    }
  }

  return {
    nodes,
    edges,
    width: metrics.width,
    height: metrics.height,
    nodeWidth: metrics.nodeWidth,
    nodeHeight: metrics.nodeHeight,
  };
}
