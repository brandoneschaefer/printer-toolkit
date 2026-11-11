// Minimal transactional email via the Resend REST API.
//
// Uses fetch (no SDK dependency) so the standalone worker can import it without
// pulling extra packages. Intentionally FREE of "server-only" — it is called
// from audit-core, which the worker process runs outside a request.
//
// When RESEND_API_KEY is not configured, send() is a silent no-op that returns
// false, so the app (and every audit) runs fine with email turned off.

import { env } from "./env";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  const key = env.alerts.resendApiKey;
  if (!key) return false; // email disabled — no-op
  if (to.length === 0) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.alerts.fromEmail,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend responded ${res.status}: ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
