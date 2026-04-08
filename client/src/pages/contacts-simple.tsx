import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { User, SubscriptionResponse } from "@shared/schema";

export default function ContactsSimple() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  // Fetch subscription
  const { data: subscriptionData } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  const handleSectionChange = (section: string) => {
    window.location.href = `/app/${section}`;
  };

  return (
    <div className="flex h-screen relative overflow-hidden bg-black">
      <Sidebar
        activeSection="contacts"
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <TopBar
          currentSection="contacts"
          subscriptionData={subscriptionData}
          user={user as User}
          isVisible={true}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-4">
              📇 Kontakte (Minimal Test)
            </h1>
            <p className="text-gray-400">
              Wenn du das hier siehst, funktioniert die Basis-Struktur!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
