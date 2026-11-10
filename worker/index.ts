// SentinelPrint background worker.
//
//   npm run worker
//
// Responsibilities:
//  1. Consume cloud-scan jobs from the BullMQ "scan" queue (when REDIS_URL set).
//  2. Run the scheduled re-scan tick on an interval.
//
// With no REDIS_URL, there is no queue to consume, but the scheduler still runs
// and dispatches scans in-process (single-node mode).

import { env } from "../src/lib/env";
import { SCAN_QUEUE, BULK_QUEUE, queueEnabled, getConnection } from "../src/lib/queue";
import { runAuditJob } from "../src/lib/audit-core";
import { runBulkCheckJob } from "../src/lib/bulkcheck";
import { processDueSchedules } from "../src/lib/schedule-runner";

function log(...a: unknown[]) {
  console.log(new Date().toISOString(), "[worker]", ...a);
}

async function main() {
  log(`starting — queue ${queueEnabled ? "ENABLED (Redis)" : "DISABLED (in-process fallback)"}`);

  // 1. Scan queue consumer.
  if (queueEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Worker } = require("bullmq");
    const worker = new Worker(
      SCAN_QUEUE,
      async (job: { data: { auditId: string } }) => {
        log(`running scan job for audit ${job.data.auditId}`);
        await runAuditJob(job.data.auditId);
      },
      { connection: getConnection(), concurrency: 4 }
    );
    worker.on("failed", (job: any, err: Error) => log("job failed:", job?.id, err?.message));
    worker.on("completed", (job: any) => log("job completed:", job?.id));
    log("scan worker listening");

    const bulkWorker = new Worker(
      BULK_QUEUE,
      async (job: { data: { bulkId: string } }) => {
        log(`running bulk check ${job.data.bulkId}`);
        await runBulkCheckJob(job.data.bulkId);
      },
      { connection: getConnection(), concurrency: 2 }
    );
    bulkWorker.on("failed", (job: any, err: Error) => log("bulk failed:", job?.id, err?.message));
    log("bulk-check worker listening");
  }

  // 2. Scheduler tick.
  const tick = async () => {
    try {
      const res = await processDueSchedules();
      if (res.due > 0) log(`scheduler: due=${res.due} dispatched=${res.dispatched} skipped=${res.skipped}`);
    } catch (err) {
      log("scheduler error:", err instanceof Error ? err.message : err);
    }
  };
  await tick();
  setInterval(tick, env.schedulerTickMs);
  log(`scheduler running every ${Math.round(env.schedulerTickMs / 1000)}s`);
}

main().catch((err) => {
  console.error("worker fatal:", err);
  process.exit(1);
});
