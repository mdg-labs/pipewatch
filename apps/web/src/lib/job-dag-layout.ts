import type { PipelineJob } from "@pipewatch/types";

export const DAG_NODE_WIDTH = 140;
export const DAG_NODE_HEIGHT = 72;
export const DAG_COLUMN_GAP = 80;
export const DAG_ROW_GAP = 24;
export const DAG_PADDING = 24;

/** Minimum readable node size before gap compaction is exhausted. */
export const DAG_MIN_NODE_WIDTH = 80;
export const DAG_MIN_NODE_HEIGHT = 48;
export const DAG_MIN_COLUMN_GAP = 16;
export const DAG_MIN_ROW_GAP = 8;
export const DAG_MIN_PADDING = 12;

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

/** Resolve scaled node/gap metrics for a column/row grid and optional container width. */
export function resolveLayoutMetrics(
  columnCount: number,
  rowCount: number,
  containerWidth?: number,
): LayoutMetrics {
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

  if (containerWidth === undefined) {
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

  const baseWidth = naturalWidth(columnCount);
  const scale = containerWidth / baseWidth;

  let nodeWidth = DAG_NODE_WIDTH * scale;
  let nodeHeight = DAG_NODE_HEIGHT * scale;
  let columnGap = DAG_COLUMN_GAP * scale;
  let rowGap = DAG_ROW_GAP * scale;
  let padding = DAG_PADDING * scale;

  if (nodeWidth < DAG_MIN_NODE_WIDTH) {
    const compactWidth =
      DAG_MIN_PADDING * 2 +
      columnCount * DAG_MIN_NODE_WIDTH +
      Math.max(0, columnCount - 1) * DAG_MIN_COLUMN_GAP;

    if (compactWidth <= containerWidth) {
      nodeWidth = DAG_MIN_NODE_WIDTH;
      nodeHeight = DAG_MIN_NODE_HEIGHT;
      columnGap = DAG_MIN_COLUMN_GAP;
      rowGap = DAG_MIN_ROW_GAP;
      const slack = containerWidth - compactWidth;
      padding = DAG_MIN_PADDING + slack / 2;
    } else {
      nodeWidth =
        (containerWidth -
          DAG_MIN_PADDING * 2 -
          Math.max(0, columnCount - 1) * DAG_MIN_COLUMN_GAP) /
        columnCount;
      nodeHeight = nodeWidth * (DAG_NODE_HEIGHT / DAG_NODE_WIDTH);
      columnGap = DAG_MIN_COLUMN_GAP;
      rowGap = DAG_MIN_ROW_GAP;
      padding = DAG_MIN_PADDING;
    }
  }

  const width = containerWidth;
  const height =
    padding * 2 + rowCount * nodeHeight + Math.max(0, rowCount - 1) * rowGap;

  return { nodeWidth, nodeHeight, columnGap, rowGap, padding, width, height };
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
  const metrics = resolveLayoutMetrics(columnCount, rowCount, options.containerWidth);

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
