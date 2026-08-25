"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/accredited", label: "Accredited" },
  { href: "/admin/centers", label: "Centers" },
  { href: "/admin/certificates", label: "Certificate of accreditation" },
  { href: "/admin/qualification", label: "Qualification" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminShell({ acName, children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-parchment md:flex">
      <aside className="border-b border-seal/10 bg-seal-dark text-parchment md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-6 py-5">
          <div className="seal-ring border-brass-light text-brass-light">AC</div>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">Admin Console</p>
            <p className="text-xs text-parchment/60">Accreditation review</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-seal px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brass text-seal-dark"
                    : "text-parchment/75 hover:bg-white/5 hover:text-parchment"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-6 pb-6 md:block">
          <p className="mb-2 text-xs text-parchment/50">{acName || "Administrator"}</p>
          <button onClick={handleLogout} className="text-sm font-medium text-brass-light hover:text-brass">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
