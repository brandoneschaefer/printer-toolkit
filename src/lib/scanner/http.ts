// HTTP(S) management-interface probe.
// - Detects a reachable embedded web server and its vendor/server banner.
// - Flags plaintext (HTTP) administration.
// - Conservatively tests a SMALL curated set of well-known printer default
//   credentials over HTTP Basic auth only (no brute force, no form fuzzing).

import http from "node:http";
import https from "node:https";

export interface HttpProbe {
  reachable: boolean;
  scheme: "http" | "https";
  statusCode?: number;
  server?: string;
  title?: string;
  requiresAuth: boolean;
  authScheme?: string; // e.g. "Basic"
  defaultCredential?: string; // "user:pass" if one authenticated
}

// A deliberately tiny, well-documented default-credential list. Authorized
// audit use only; expanding this into a brute-force list is out of scope.
const DEFAULT_CREDS: Array<[string, string]> = [
  ["admin", "admin"],
  ["admin", ""],
  ["admin", "1234"],
  ["admin", "password"],
];

function request(
  scheme: "http" | "https",
  host: string,
  port: number,
  timeoutMs: number,
  auth?: string
): Promise<{ statusCode?: number; headers: http.IncomingHttpHeaders; body: string } | null> {
  return new Promise((resolve) => {
    const lib = scheme === "https" ? https : http;
    const req = lib.request(
      {
        host,
        port,
        method: "GET",
        path: "/",
        timeout: timeoutMs,
        auth,
        // Printer web servers routinely use self-signed certs; we are
        // assessing exposure, not validating the chain here.
        rejectUnauthorized: false,
        headers: { "User-Agent": "SentinelPrint-Audit/1.0", Accept: "text/html" },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          if (body.length < 8192) body += c.toString("utf8");
        });
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      }
    );
    req.once("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.once("error", () => resolve(null));
    req.end();
  });
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]{0,120})<\/title>/i);
  return m ? m[1].trim() : undefined;
}

export async function httpProbe(
  host: string,
  port: number,
  scheme: "http" | "https",
  timeoutMs: number,
  testDefaultCreds: boolean
): Promise<HttpProbe | null> {
  const res = await request(scheme, host, port, timeoutMs);
  if (!res) return null;

  const authHeader = (res.headers["www-authenticate"] || "") as string;
  const requiresAuth = res.statusCode === 401 || /basic|digest/i.test(authHeader);
  const probe: HttpProbe = {
    reachable: true,
    scheme,
    statusCode: res.statusCode,
    server: (res.headers["server"] as string) || undefined,
    title: extractTitle(res.body),
    requiresAuth,
    authScheme: authHeader.split(" ")[0] || undefined,
  };

  // Only test defaults when authorized AND the server uses HTTP Basic (the
  // one scheme we can safely probe without side effects).
  if (testDefaultCreds && requiresAuth && /basic/i.test(authHeader)) {
    for (const [user, pass] of DEFAULT_CREDS) {
      const authed = await request(scheme, host, port, timeoutMs, `${user}:${pass}`);
      if (authed && authed.statusCode && authed.statusCode >= 200 && authed.statusCode < 400) {
        probe.defaultCredential = `${user}:${pass || "<blank>"}`;
        break;
      }
    }
  }

  return probe;
}
