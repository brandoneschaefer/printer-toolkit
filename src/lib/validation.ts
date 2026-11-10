import { z } from "zod";

export const registerSchema = z.object({
  orgName: z.string().min(2, "Company name is required").max(100),
  name: z.string().min(1).max(100).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const targetSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  value: z.string().min(1, "Host or CIDR is required").max(100),
  authorized: z.boolean(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const runAuditSchema = z.object({
  name: z.string().min(1, "Audit name is required").max(120),
  targetIds: z.array(z.string()).min(1, "Select at least one target"),
  activeProbes: z.boolean().default(true),
  executor: z.enum(["CLOUD", "COLLECTOR"]).default("CLOUD"),
  collectorId: z.string().optional().or(z.literal("")),
});
