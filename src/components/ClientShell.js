"use client";

import { useRouter } from "next/navigation";
import { LayoutDashboard, ClipboardList, Award, FolderOpen, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AppFrame from "@/components/AppFrame";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/apply", label: "Apply as AC", icon: ClipboardList },
  { href: "/accredited", label: "Accredited", icon: Award },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export default function ClientShell({ acName, children }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AppFrame
      brandLabel="Accreditation"
      brandSub="User portal"
      navLinks={LINKS}
      name={acName}
      roleLabel="Applicant"
      onLogout={handleLogout}
    >
      {children}
    </AppFrame>
  );
}
