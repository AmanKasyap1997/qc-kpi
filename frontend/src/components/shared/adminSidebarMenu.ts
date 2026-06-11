import { LayoutDashboard, FileUp, ShieldBan, ShieldAlert, CheckCircle } from "lucide-react";
import type { MenuItem } from "../../types/AdminSidebar";

export const adminSidebarMenu: MenuItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/dashboard",
  }
];
