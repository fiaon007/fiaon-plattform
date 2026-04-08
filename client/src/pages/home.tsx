import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("space");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: tokenBalance } = useQuery<{ balance: number }>({
    queryKey: ["/api/user/tokens"],
    enabled: !!user,
  });

  const renderContent = () => {
    switch (activeSection) {
      case "space":
        return <ChatInterface />;
      case "power":
        return <div>Power section coming soon</div>;
      case "leads":
        return <div>Leads section coming soon</div>;
      case "campaigns":
        return <div>Campaigns section coming soon</div>;
      case "billing":
        return <div>Billing section coming soon</div>;
      case "settings":
        return <div>Settings section coming soon</div>;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className="flex h-screen bg-space space-pattern circuit-pattern overflow-hidden">
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col content-zoom">
        <TopBar 
          currentSection={activeSection} 
          subscriptionData={undefined} 
          user={user as User} 
          isVisible={true} 
        />
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
