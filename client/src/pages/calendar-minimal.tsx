import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';

export default function CalendarMinimal() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white">Not authenticated</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar
        activeSection="calendar"
        onSectionChange={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      />
      
      <div className="flex-1 flex flex-col">
        <TopBar
          currentSection="calendar"
          subscriptionData={null as any}
          user={user as any}
          isVisible={true}
        />
        
        <div className="flex-1 p-8 text-white">
          <h1 className="text-3xl font-bold mb-4">Kalender</h1>
          <p>Minimal Calendar Page - No Errors!</p>
          <p className="mt-4 text-gray-400">
            Wenn diese Seite lädt, ist das Problem in der komplexen Calendar Implementation.
          </p>
        </div>
      </div>
    </div>
  );
}
