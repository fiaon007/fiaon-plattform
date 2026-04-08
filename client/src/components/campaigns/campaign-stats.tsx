import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { Megaphone, Users, Phone, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Campaign, Lead, CallLog } from "@shared/schema";

interface CampaignStatsProps {
  campaigns?: Campaign[];
}

export function CampaignStats({ campaigns = [] }: CampaignStatsProps) {
  const { user } = useAuth();

  // Fetch user's real data
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: !!user,
    retry: false,
  });

  const { data: callLogs = [] } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
    enabled: !!user,
    retry: false,
  });

  // Calculate real stats from user's data
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const contactedLeads = callLogs.length;
  const convertedLeads = leads.filter(l => l.status === 'hot').length;

  const stats = [
    {
      title: "Active Campaigns",
      value: activeCampaigns,
      icon: Megaphone, 
      color: "text-primary",
      bgColor: "bg-primary/20",
    },
    {
      title: "Total Leads",
      value: leads.length,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      title: "Contacted",
      value: contactedLeads,
      icon: Phone,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    {
      title: "Converted",
      value: convertedLeads,
      icon: TrendingUp,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">
                      {stat.title === "Active Campaigns" ? (
                        <GradientText>{stat.value}</GradientText>
                      ) : (
                        <span className={stat.color}>{stat.value}</span>
                      )}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
