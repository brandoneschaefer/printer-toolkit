import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (env.billing.mockMode) {
    throw new Error("Stripe is in mock mode; real client is unavailable.");
  }
  if (!env.billing.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!client) {
    client = new Stripe(env.billing.stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
  }
  return client;
}

export const stripeEnabled = !env.billing.mockMode && !!env.billing.stripeSecretKey;
