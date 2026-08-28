"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Award,
  Building2,
  FileBadge,
  GraduationCap,
  Users,
  FolderOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AppFrame from "@/components/AppFrame";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/applications", label: "Applications", icon: FileText },
  { href: "/admin/documents", label: "Documents", icon: FolderOpen },
  { href: "/admin/accredited", label: "Accredited", icon: Award },
  { href: "/admin/centers", label: "Centers", icon: Building2 },
  { href: "/admin/certificates", label: "Certificate of accreditation", icon: FileBadge },
  { href: "/admin/qualification", label: "Qualification", icon: GraduationCap },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminShell({ acName, children }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <AppFrame
      brandLabel="Admin Console"
      brandSub="Accreditation review"
      navLinks={LINKS}
      name={acName}
      roleLabel="Administrator"
      onLogout={handleLogout}
    >
      {children}
    </AppFrame>
  );
}
