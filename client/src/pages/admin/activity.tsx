"use client";

import { CommandCenterLayout } from "@/components/admin/CommandCenterLayout";
import { ActivityFeedEnhanced } from "@/components/admin/ActivityFeedEnhanced";

// ============================================================================
// Activity Feed Page - Admin Dashboard (Enhanced with SSE)
// ============================================================================

export default function ActivityPage() {
  return (
    <CommandCenterLayout>
      <ActivityFeedEnhanced />
    </CommandCenterLayout>
  );
}
