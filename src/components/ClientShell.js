"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/apply", label: "Apply for scholarship" },
  { href: "/accredited", label: "Accredited" },
  { href: "/documents", label: "Documents" },
  { href: "/profile", label: "Profile" },
];

export default function ClientShell({ acName, children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-seal/10 bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="seal-ring border-seal text-seal">AC</div>
            <div>
              <p className="font-display text-lg font-semibold leading-tight text-seal">
                Accreditation Portal
              </p>
              <p className="text-xs text-ink/50">Applicant workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink/60 sm:inline">
              {acName || "Applicant"}
            </span>
            <button onClick={handleLogout} className="btn-ghost">
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 pb-2">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-seal px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-seal text-parchment"
                    : "text-seal/70 hover:bg-seal/5 hover:text-seal"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
