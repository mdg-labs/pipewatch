import type { PipelineJob } from "@pipewatch/types";

export const DAG_NODE_WIDTH = 140;
export const DAG_NODE_HEIGHT = 72;
export const DAG_COLUMN_GAP = 80;
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

function nodePosition(column: number, row: number): { x: number; y: number } {
  return {
    x: DAG_PADDING + column * (DAG_NODE_WIDTH + DAG_COLUMN_GAP),
    y: DAG_PADDING + row * (DAG_NODE_HEIGHT + DAG_ROW_GAP),
  };
}

function buildEdgePath(
  from: DagNodeLayout,
  to: DagNodeLayout,
): string {
  const fromX = from.x + DAG_NODE_WIDTH;
  const fromY = from.y + DAG_NODE_HEIGHT / 2;
  const toX = to.x;
  const toY = to.y + DAG_NODE_HEIGHT / 2;
  const midX = fromX + (toX - fromX) / 2;

  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

/** Compute DAG node positions and connector paths for the job graph (page B6). */
export function layoutJobDag(jobs: PipelineJob[], nowMs = Date.now()): JobDagLayout {
  const waves = groupJobsIntoWaves(jobs, nowMs);

  if (waves.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const nodes: DagNodeLayout[] = [];

  waves.forEach((wave, column) => {
    wave.forEach((job, row) => {
      const position = nodePosition(column, row);
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
          path: buildEdgePath(fromNode, toNode),
        });
      }
    }
  }

  const maxRows = Math.max(...waves.map((wave) => wave.length), 1);
  const width =
    DAG_PADDING * 2 +
    waves.length * DAG_NODE_WIDTH +
    Math.max(0, waves.length - 1) * DAG_COLUMN_GAP;
  const height =
    DAG_PADDING * 2 +
    maxRows * DAG_NODE_HEIGHT +
    Math.max(0, maxRows - 1) * DAG_ROW_GAP;

  return { nodes, edges, width, height };
}
