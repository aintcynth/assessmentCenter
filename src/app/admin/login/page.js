"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    setLoading(false);
    if (profile?.role !== "admin") {
      setError("This account doesn't have administrator access.");
      await supabase.auth.signOut();
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-seal-dark px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="seal-ring mx-auto mb-4 border-brass-light text-brass-light">AC</div>
          <h1 className="font-display text-2xl font-semibold text-parchment">Admin console</h1>
          <p className="mt-1 text-sm text-parchment/60">Review and issue accreditation.</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-seal border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <label className="label !text-brass-light" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label !text-brass-light" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-clay">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-parchment/40">
          Applicant? <Link href="/login" className="underline hover:text-parchment">Go to applicant login</Link>
        </p>
      </div>
    </div>
  );
}
