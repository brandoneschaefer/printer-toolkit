# SentinelPrint

**Multi-tenant printer security auditing SaaS.** SentinelPrint assesses a
corporate printer fleet for the exposures that make printers a soft entry point
into a network — open printing protocols, default SNMP community strings,
unauthenticated PJL access, plaintext web administration, and default
credentials — then produces a prioritized remediation report.

It is built for corporate customers and billed two ways:

- **On-demand audit** — a one-time charge for a single full assessment.
- **Continuous monitoring** — a monthly subscription for unlimited re-audits.

> ### Scope & safety
> SentinelPrint performs **authorized, non-destructive assessment only**. It
> reads exposure; it never formats a filesystem, deletes jobs, resets a device,
> or runs any state-changing command. Every target must be explicitly marked as
> *authorized* by the tenant before it can be scanned. You are responsible for
> ensuring you own, or have written authorization to test, every host in scope.

---

## What it checks

| Check | Port(s) | Severity | Technique |
|-------|---------|----------|-----------|
| Telnet enabled | 23 | Critical | TCP connect |
| FTP enabled | 21 | High | TCP connect / banner |
| Default web-admin credentials | 80/443 | Critical | HTTP Basic, tiny curated default list |
| Web admin with no auth | 80 | High | HTTP response analysis |
| Web admin over plaintext HTTP | 80 | Medium | TCP + HTTP |
| Unauthenticated PJL access | 9100 | High | Read-only `@PJL INFO` identity query |
| Raw / JetDirect exposed | 9100 | Medium | TCP connect |
| SNMP default community | 161/udp | High | SNMP GET of `sysDescr` with `public`/`private` |
| Legacy LPD enabled | 515 | Low | TCP connect |
| IPP reachable | 631 | Info | TCP connect |
| TLS management endpoint | 443 | Info | HTTPS probe |

Each finding carries a severity and a concrete hardening recommendation. Results
roll up into a 0–100 **risk score** per audit.

These map directly onto the standard printer-hardening checklist: segment
printers onto an isolated VLAN, disable unused protocols (Telnet/FTP/LPD),
enforce HTTPS-only management, replace default SNMP communities (prefer SNMPv3),
and restrict raw printing to trusted print servers.

## Architecture

- **Next.js 15** (App Router, React 19, TypeScript) — UI, server actions, and the
  Stripe webhook route.
- **PostgreSQL + Prisma** — tenant-isolated data model.
- **Self-contained session auth** — bcrypt + signed JWT in an httpOnly cookie
  (`src/lib/auth.ts`). No external auth dependency.
- **Scan engine** (`src/lib/scanner/`) — pure-Node TCP/HTTP probes plus
  `net-snmp`, with bounded concurrency and a hard host cap.
- **Stripe** — one-time Checkout for audits, subscription Checkout for
  monitoring, webhook-driven entitlements, and a **mock mode** so the whole flow
  works locally with no Stripe account.

### Multi-tenancy

An `Organization` is the tenant boundary. A `User` joins organizations via
`Membership` (roles `OWNER`/`ADMIN`/`MEMBER`). The session carries the active
`orgId`, and **every** query is scoped to it — targets, audits, findings,
payments, and billing state never cross tenants.

## Project layout

```
prisma/schema.prisma        Data model (tenants, targets, audits, findings, billing)
prisma/seed.ts              Demo tenant (demo@acme.test / password123)
src/lib/
  auth.ts                   bcrypt + JWT cookie sessions
  tenant.ts                 Active-tenant context + entitlement helpers
  db.ts  env.ts             Prisma client, typed config
  audit.ts                  Audit lifecycle: entitlement -> create -> run -> persist
  billing.ts  stripe.ts     Stripe Checkout/portal + mock mode + entitlements
  scanner/                  Non-destructive assessment engine
  actions/                  Server actions (auth, targets, audits, billing)
src/app/
  page.tsx                  Marketing + pricing landing
  login/ register/          Auth
  dashboard/                Tenant app: overview, targets, audits, billing
  api/stripe/webhook/       Stripe webhook
scripts/
  scan-cli.ts               Run the engine against a host from the terminal
  mock-printer.ts           A deliberately-vulnerable fake printer for testing
```

## Quickstart (local)

Prerequisites: Node 20+, PostgreSQL 14+.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env: set DATABASE_URL, and AUTH_SECRET (openssl rand -base64 32).
# Leave BILLING_MOCK_MODE=true to run without Stripe.

# 3. Database
npm run prisma:migrate     # create schema
npm run db:seed            # demo tenant with 3 audit credits

# 4. Run
npm run dev                # http://localhost:3000
```

Log in with **demo@acme.test / password123**.

### Try a real audit

In a second terminal, start the bundled vulnerable mock printer and scan it:

```bash
npx tsx scripts/mock-printer.ts      # opens 9100/80/23/515/631 on 127.0.0.1
```

Then in the app: **Targets & scope** already has an authorized `127.0.0.1`
target (from the seed). Go to **Audits → New audit**, select it, and run. You'll
get a report with Critical/High/Medium findings and a risk score of 100.

Or skip the UI and run the engine directly:

```bash
npx tsx scripts/scan-cli.ts 127.0.0.1
```

## Billing

Two Stripe products drive entitlements:

- **One-time price** (`STRIPE_PRICE_ONE_TIME_AUDIT`) → grants **1 audit credit**.
- **Recurring monthly price** (`STRIPE_PRICE_SUBSCRIPTION_MONTHLY`) → sets the
  org to **ACTIVE** (unlimited audits while the subscription is live).

Running an audit consumes a credit unless the org has an active subscription.

### Mock mode (default)

With `BILLING_MOCK_MODE=true`, "Buy an audit" / "Start subscription" grant the
entitlement instantly without contacting Stripe — ideal for development and
demos.

### Real Stripe

1. Create the two prices in the Stripe dashboard; paste their IDs into `.env`.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; set `BILLING_MOCK_MODE=false`.
3. Point a Stripe webhook at `POST /api/stripe/webhook` for
   `checkout.session.completed`, `customer.subscription.updated|deleted`, and
   `invoice.payment_failed`. Locally: `stripe listen --forward-to
   localhost:3000/api/stripe/webhook`.

## Production notes / roadmap

This is a complete, working foundation. For production you would add:

- A durable job queue for scans (BullMQ/Redis) instead of in-process execution,
  so large scopes and scheduled subscription re-scans run on workers.
- Team invitations and the full `ADMIN`/`MEMBER` permission surface.
- PDF export of audit reports and scheduled email delivery.
- Egress controls / allowlisting so the scanner can only reach customer-attested
  ranges, plus per-tenant rate limiting.
- SSO (SAML/OIDC) for enterprise tenants.

## Legal

For authorized security assessment of your own or explicitly-authorized systems
only. Unauthorized scanning may violate computer-misuse laws. The authorization
attestation in the product is a control, not a substitute for your own legal
due diligence.
