"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { registerAction, type ActionState } from "@/lib/actions/auth";

const initial: ActionState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-bold text-white">
          <ShieldCheck className="h-6 w-6 text-brand-400" /> PRET
        </Link>
        <div className="card">
          <h1 className="text-xl font-semibold text-white">Create your company account</h1>
          <p className="mt-1 text-sm text-slate-400">Each account is an isolated tenant workspace.</p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="orgName">Company name</label>
              <input id="orgName" name="orgName" className="input" placeholder="Acme Corp" required />
            </div>
            <div>
              <label className="label" htmlFor="name">Your name (optional)</label>
              <input id="name" name="name" className="input" placeholder="Jordan Lee" />
            </div>
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" className="input" placeholder="you@acme.com" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="input" placeholder="At least 8 characters" required />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{state.error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-300 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
