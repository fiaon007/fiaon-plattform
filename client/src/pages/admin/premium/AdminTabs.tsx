import { Users, History, Activity } from "lucide-react";
import type { TabId } from "./constants";

interface AdminTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  transition: string;
}

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "audit", label: "Activity Log", icon: History },
  { id: "health", label: "System", icon: Activity },
];

export function AdminTabs({ activeTab, onTabChange, transition }: AdminTabsProps) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-2xl mb-6"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--aras-glass-border)" }}
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${transition}`}
          style={{
            background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
            color: activeTab === tab.id ? "white" : "var(--aras-soft)",
          }}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
