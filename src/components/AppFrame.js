"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LogOut } from "lucide-react";

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function AppFrame({ brandLabel, brandSub, navLinks, name, roleLabel, onLogout, children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-canvas p-3 sm:p-6 md:p-8">
      <div className="mx-auto flex max-w-[1500px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-seal/20 md:min-h-[calc(100vh-4rem)] md:flex-row">
        {/* Sidebar */}
        <aside className="flex shrink-0 flex-col bg-seal text-parchment md:w-64">
          <div className="flex items-center gap-2.5 px-6 py-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-display text-base font-bold text-seal">
              A
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold leading-tight">{brandLabel}</p>
              <p className="truncate text-xs text-parchment/50">{brandSub}</p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-1 md:flex-col md:overflow-visible md:px-4">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-white font-semibold text-seal"
                      : "text-parchment/70 hover:bg-white/10 hover:text-parchment"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden px-4 pb-6 md:block">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-parchment/70 transition hover:bg-white/10 hover:text-parchment"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
              Log out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 bg-mist/40">
          <header className="flex items-center gap-4 border-b border-black/5 px-5 py-4 md:px-8">
            <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm text-ink/40 shadow-sm sm:flex">
              <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>Search here</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-ink">{name || "—"}</p>
                <p className="text-xs leading-tight text-ink/40">{roleLabel}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-seal text-sm font-semibold text-parchment">
                {initials(name)}
              </div>
              <button onClick={onLogout} className="text-ink/40 hover:text-clay md:hidden" aria-label="Log out">
                <LogOut className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </header>

          <main className="px-5 py-7 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
