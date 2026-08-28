"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LogOut, Menu, X, ChevronsLeft, ChevronsRight } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const COLLAPSE_KEY = "accreditation-portal:sidebar-collapsed";

export default function AppFrame({ brandLabel, brandSub, navLinks, name, roleLabel, onLogout, children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the collapsed preference (desktop only feature, safe no-op on mobile).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLLAPSE_KEY);
      if (saved) setCollapsed(saved === "1");
    } catch {
      // ignore — localStorage unavailable, just default to expanded
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-mist/40">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-seal text-parchment transition-all duration-200 md:sticky md:top-0 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-display text-base font-bold text-seal">
              A
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold leading-tight">{brandLabel}</p>
                <p className="truncate text-xs text-parchment/50">{brandSub}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-parchment/60 hover:text-parchment md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={`flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  collapsed ? "md:justify-center md:px-0" : ""
                } ${
                  active
                    ? "bg-white font-semibold text-seal"
                    : "text-parchment/70 hover:bg-white/10 hover:text-parchment"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span className={collapsed ? "md:hidden" : ""}>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 px-3 pb-4">
          <button
            onClick={onLogout}
            title={collapsed ? "Log out" : undefined}
            className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-parchment/70 transition hover:bg-white/10 hover:text-parchment ${
              collapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span className={collapsed ? "md:hidden" : ""}>Log out</span>
          </button>
          <button
            onClick={toggleCollapsed}
            className={`hidden w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-parchment/50 transition hover:bg-white/10 hover:text-parchment md:flex ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            {collapsed ? (
              <ChevronsRight className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            ) : (
              <>
                <ChevronsLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-4 sm:px-6 md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-ink/60 hover:text-ink md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>

          <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-full bg-mist px-4 py-2.5 text-sm text-ink/40 sm:flex">
            <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span>Search here</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-ink">{name || "—"}</p>
              <p className="text-xs leading-tight text-ink/40">{roleLabel}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-seal text-sm font-semibold text-parchment">
              {initials(name)}
            </div>
          </div>
        </header>

        <main className="bg-mist/40 px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
