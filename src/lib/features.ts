// Product feature toggles.
//
// Launch toggle: hide the one-time "On-demand audit" tier everywhere — landing
// pricing, dashboard billing (purchase + credits UI), and credit-related
// prompts — so the product presents ONLY the Continuous monitoring plan.
// Flip to `true` to reintroduce the one-time tier; all markup is kept behind
// this flag, so re-enabling is a one-line change.
export const SHOW_ONE_TIME_AUDIT = false;

// Simplified product mode: collapse the dashboard to just "Tracked URLs",
// "Alerts", and "Billing". Adding a URL auto-authorizes it (attestation
// checkbox) and creates a weekly monitoring schedule. Set to `false` to
// restore the full dashboard (Authorization, Targets, Collectors, Audits,
// Schedules, Exposure check, Leads).
export const SIMPLE_MONITORING_MODE = true;
