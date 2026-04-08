/**
 * ============================================================================
 * ARAS COMMAND CENTER - SETTINGS
 * ============================================================================
 * Internal CRM settings and configuration
 * ============================================================================
 */

import { motion } from "framer-motion";
import { Settings, Bell, Shield, Database, Users, Palette, AlertCircle } from "lucide-react";
import InternalLayout from "@/components/internal/internal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useArasDebugMount } from "@/hooks/useArasDebug";

const SETTINGS_SECTIONS = [
  {
    title: "Notifications",
    description: "Manage alert preferences and notification channels",
    icon: Bell,
    status: "coming_soon" as const,
  },
  {
    title: "Team & Roles",
    description: "Manage team members and access permissions",
    icon: Users,
    status: "coming_soon" as const,
  },
  {
    title: "Security",
    description: "API keys, sessions, and security settings",
    icon: Shield,
    status: "coming_soon" as const,
  },
  {
    title: "Data & Export",
    description: "Export CRM data and manage backups",
    icon: Database,
    status: "coming_soon" as const,
  },
  {
    title: "Appearance",
    description: "Customize dashboard theme and layout",
    icon: Palette,
    status: "coming_soon" as const,
  },
];

export default function InternalSettings() {
  useArasDebugMount('InternalSettings', '/internal/settings');

  return (
    <InternalLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-orange-400" />
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Settings
            </h1>
          </div>
          <p className="text-gray-400">
            Configure your ARAS Command Center preferences
          </p>
        </motion.div>

        {/* Coming Soon Notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Settings Coming Soon</h3>
                <p className="text-gray-400 text-sm">
                  Advanced configuration options are being developed. Current system uses environment-based configuration.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SETTINGS_SECTIONS.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
              >
                <Card className="bg-white/5 border-white/10 hover:bg-white/8 transition-all h-full opacity-60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-white/5">
                        <Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="px-2 py-1 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400 uppercase tracking-wider">
                        Coming Soon
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-white text-lg mb-2">{section.title}</CardTitle>
                    <p className="text-gray-500 text-sm">{section.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Current Config Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-400" />
                Current Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Environment:</span>
                  <span className="text-white ml-2">
                    {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">ARAS AI:</span>
                  <span className="text-green-400 ml-2">Enabled</span>
                </div>
                <div>
                  <span className="text-gray-500">RBAC:</span>
                  <span className="text-green-400 ml-2">Active (admin/staff)</span>
                </div>
                <div>
                  <span className="text-gray-500">Debug Mode:</span>
                  <span className="text-gray-400 ml-2">
                    {typeof window !== 'undefined' && localStorage.getItem('aras_debug') === '1' 
                      ? 'Enabled' 
                      : 'Disabled'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 pt-2 border-t border-white/10">
                Configuration is managed via environment variables. Contact your administrator for changes.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </InternalLayout>
  );
}
