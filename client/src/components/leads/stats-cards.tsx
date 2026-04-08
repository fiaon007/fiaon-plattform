import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { Users, Phone, CheckCircle, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import type { Lead } from "@shared/schema";

export function StatsCards() {
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const stats = [
    {
      title: "Total Leads",
      value: leads.length,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/20",
    },
    {
      title: "Contacted",
      value: leads.filter((lead: Lead) => lead.status === "contacted").length,
      icon: Phone,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    {
      title: "Converted",
      value: leads.filter((lead: Lead) => lead.status === "converted").length,
      icon: CheckCircle,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      title: "Conversion Rate",
      value: leads.length > 0 
        ? `${((leads.filter((lead: Lead) => lead.status === "converted").length / leads.length) * 100).toFixed(1)}%`
        : "0%",
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
                      {stat.title === "Total Leads" ? (
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
