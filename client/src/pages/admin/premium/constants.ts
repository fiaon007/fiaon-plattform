import { Users, Shield, Crown } from "lucide-react";

export const PLAN_OPTIONS = [
  { key: "free", label: "Free", color: "#6B7280" },
  { key: "pro", label: "Pro", color: "#3B82F6" },
  { key: "ultra", label: "Ultra", color: "#8B5CF6" },
  { key: "ultimate", label: "Ultimate", color: "#FE9100" },
] as const;

export const STATUS_OPTIONS = ["active", "trialing", "canceled", "past_due"] as const;

export const ROLE_OPTIONS = [
  { key: "user", label: "User", color: "#6B7280", icon: Users },
  { key: "staff", label: "Staff", color: "#8B5CF6", icon: Shield },
  { key: "admin", label: "Admin", color: "#FE9100", icon: Crown },
] as const;

export type TabId = "users" | "audit" | "health";
export type ModalType = "plan" | "password" | "details" | "role" | null;
export type SortField = "username" | "email" | "createdAt" | "subscriptionPlan" | "userRole";
export type SortDir = "asc" | "desc";
export type StatusFilter = "all" | "active" | "disabled";

export function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.users && Array.isArray(data.users)) return data.users;
  return [];
}

export function snakeToCamel(arr: any[]): any[] {
  return arr.map((obj) => {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camel] = v;
      if (camel !== k) out[k] = v;
    }
    return out;
  });
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `vor ${days}d`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
}

export function getRoleColor(role: string): string {
  return ROLE_OPTIONS.find((r) => r.key === role?.toLowerCase())?.color || "#6B7280";
}

export function getPlanColor(plan: string): string {
  return PLAN_OPTIONS.find((p) => p.key === plan?.toLowerCase())?.color || "#6B7280";
}
