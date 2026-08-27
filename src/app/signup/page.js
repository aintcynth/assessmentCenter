"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [acName, setAcName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { ac_name: acName, phone, address, role: "user" } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setNotice("Check your inbox to confirm your email, then log in.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-seal text-lg font-display font-bold text-parchment mx-auto mb-4">AC</div>
          <h1 className="font-display text-2xl font-semibold text-seal">Create your account</h1>
          <p className="mt-1 text-sm text-ink/60">Register to apply for center accreditation.</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="acName">Assessment center / applicant name</label>
            <input
              id="acName"
              required
              className="input-field"
              value={acName}
              onChange={(e) => setAcName(e.target.value)}
              placeholder="Cagayan Proficiency Training Center Inc."
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
            />
          </div>
          <div>
            <label className="label" htmlFor="address">Address</label>
            <textarea
              id="address"
              className="input-field"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, Province"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          {error && <p className="text-sm text-clay">{error}</p>}
          {notice && <p className="text-sm text-moss">{notice}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-seal hover:text-brass">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
