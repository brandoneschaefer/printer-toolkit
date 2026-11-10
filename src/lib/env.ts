// Centralised, typed access to environment configuration.

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    return "";
  }
  return v;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

export const env = {
  appUrl: str("APP_URL", "http://localhost:3000"),
  authSecret: str("AUTH_SECRET", "dev-insecure-secret-change-me-please-32++"),

  billing: {
    mockMode: bool("BILLING_MOCK_MODE", true),
    stripeSecretKey: str("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET"),
    priceOneTime: str("STRIPE_PRICE_ONE_TIME_AUDIT"),
    priceSubscription: str("STRIPE_PRICE_SUBSCRIPTION_MONTHLY"),
    publishableKey: str("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  },

  scanner: {
    maxHosts: int("SCANNER_MAX_HOSTS", 256),
    tcpTimeoutMs: int("SCANNER_TCP_TIMEOUT_MS", 2500),
  },

  // Published collector image shown in the one-command Docker install snippet.
  collectorImage: str("COLLECTOR_IMAGE", "ghcr.io/brandoneschaefer/sentinelprint-collector:latest"),
  // Raw URL of the Windows one-click PowerShell installer.
  collectorInstallerUrl: str(
    "COLLECTOR_INSTALLER_URL",
    "https://raw.githubusercontent.com/brandoneschaefer/PRET-Printer-Exploitation-Toolkit/main/installer/install-collector.ps1"
  ),

  // When set, cloud scans are dispatched to a BullMQ worker over Redis.
  // When empty, scans run in-process (fine for single-node / local dev).
  redisUrl: str("REDIS_URL"),

  // How often the worker checks for due scheduled re-scans (ms).
  schedulerTickMs: int("SCHEDULER_TICK_MS", 60000),
};

// Pricing shown in the UI. (Stripe is the source of truth for real charges.)
export const PRICING = {
  oneTimeAuditCents: 49900, // $499 per on-demand audit
  subscriptionMonthlyCents: 29900, // $299/mo continuous monitoring
  currency: "usd",
};
