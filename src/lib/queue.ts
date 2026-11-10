// Cloud-scan job queue.
//
// With REDIS_URL set, scans are dispatched to a BullMQ queue and executed by
// the worker (worker/index.ts), decoupling long scans from web requests.
// Without REDIS_URL, enqueueScan falls back to running the scan in-process so
// the app still works as a single node (local dev, small deployments).
//
// No "server-only": the worker imports this module too.

import { env } from "./env";
import { runAuditJob } from "./audit-core";
import { runBulkCheckJob } from "./bulkcheck";

export const SCAN_QUEUE = "scan";
export const BULK_QUEUE = "bulkcheck";
export const queueEnabled = !!env.redisUrl;

// Lazily-created singletons (BullMQ/ioredis are optional at runtime).
let connection: any = null;
let scanQueue: any = null;
let bulkQueue: any = null;

export function getConnection(): any {
  if (!env.redisUrl) return null;
  if (!connection) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");
    connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

function getScanQueue(): any {
  if (!env.redisUrl) return null;
  if (!scanQueue) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue } = require("bullmq");
    scanQueue = new Queue(SCAN_QUEUE, { connection: getConnection() });
  }
  return scanQueue;
}

/** Dispatch a cloud audit for execution (queue if Redis, else in-process). */
export async function enqueueScan(auditId: string): Promise<void> {
  if (queueEnabled) {
    await getScanQueue().add(
      "run",
      { auditId },
      { jobId: `audit:${auditId}`, removeOnComplete: 1000, removeOnFail: 5000, attempts: 1 }
    );
    return;
  }
  // Fallback: run without blocking the caller.
  void runAuditJob(auditId).catch(() => {
    /* errors are persisted on the audit record */
  });
}

function getBulkQueue(): any {
  if (!env.redisUrl) return null;
  if (!bulkQueue) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue } = require("bullmq");
    bulkQueue = new Queue(BULK_QUEUE, { connection: getConnection() });
  }
  return bulkQueue;
}

/** Dispatch a bulk exposure check for background processing. */
export async function enqueueBulkCheck(bulkId: string): Promise<void> {
  if (queueEnabled) {
    await getBulkQueue().add("run", { bulkId }, { jobId: `bulk:${bulkId}`, removeOnComplete: 500, removeOnFail: 500, attempts: 1 });
    return;
  }
  void runBulkCheckJob(bulkId).catch(() => {
    /* errors persisted on the record */
  });
}
