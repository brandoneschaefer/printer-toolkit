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
  collectorImage: str("COLLECTOR_IMAGE", "ghcr.io/brandoneschaefer/printertoolkit-collector:latest"),
  // Raw URL of the Windows one-click (admin) PowerShell installer.
  collectorInstallerUrl: str(
    "COLLECTOR_INSTALLER_URL",
    "https://raw.githubusercontent.com/brandoneschaefer/printer-toolkit/main/installer/install-collector.ps1"
  ),
  // Raw URL of the no-admin (per-user) Windows installer.
  collectorUserInstallerUrl: str(
    "COLLECTOR_USER_INSTALLER_URL",
    "https://raw.githubusercontent.com/brandoneschaefer/printer-toolkit/main/installer/install-collector-user.ps1"
  ),
  // Raw URL of the Linux mini-appliance provisioning script.
  collectorApplianceUrl: str(
    "COLLECTOR_APPLIANCE_URL",
    "https://raw.githubusercontent.com/brandoneschaefer/printer-toolkit/main/appliance/provision.sh"
  ),
  // Raw URL of the self-contained USB-installer builder (run once on your PC).
  collectorUsbBuilderUrl: str(
    "COLLECTOR_USB_BUILDER_URL",
    "https://raw.githubusercontent.com/brandoneschaefer/printer-toolkit/main/installer/build-usb.ps1"
  ),

  // When set, cloud scans are dispatched to a BullMQ worker over Redis.
  // When empty, scans run in-process (fine for single-node / local dev).
  redisUrl: str("REDIS_URL"),

  // How often the worker checks for due scheduled re-scans (ms).
  schedulerTickMs: int("SCHEDULER_TICK_MS", 60000),

  // Shodan API key for the public External Exposure Check (optional).
  shodanApiKey: str("SHODAN_API_KEY"),
};

// Pricing shown in the UI. (Stripe is the source of truth for real charges.)
export const PRICING = {
  oneTimeAuditCents: 49900, // $499 per on-demand audit
  subscriptionMonthlyCents: 29900, // $299/mo continuous monitoring
  currency: "usd",
};
