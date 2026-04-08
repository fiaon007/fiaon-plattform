import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Send, Users, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { User, SubscriptionResponse } from "@shared/schema";

export default function ArasMailingPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  
  // Fetch user's subscription data
  const { data: subscriptionData } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  const features = [
    {
      icon: Mail,
      title: "Email Campaigns",
      description: "Create and manage automated email marketing campaigns"
    },
    {
      icon: Users,
      title: "Contact Management", 
      description: "Organize and segment your email subscribers"
    },
    {
      icon: Send,
      title: "Automated Sequences",
      description: "Set up drip campaigns and follow-up sequences"
    },
    {
      icon: TrendingUp,
      title: "Analytics & Reporting",
      description: "Track open rates, clicks, and conversion metrics"
    }
  ];

  const stats = [
    { label: "Active Campaigns", value: "0", icon: Clock },
    { label: "Total Contacts", value: "0", icon: Users },
    { label: "Emails Sent", value: "0", icon: Send },
    { label: "Success Rate", value: "0%", icon: CheckCircle }
  ];

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar 
        activeSection="aras-mailing"
        onSectionChange={() => {}}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden content-zoom">
        <TopBar currentSection="aras-mailing" subscriptionData={subscriptionData} user={user as User} isVisible={true} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">ARAS Mailing</h1>
                <p className="text-muted-foreground mt-2">
                  Powerful email marketing and automation platform
                </p>
              </div>
              <Button className="bg-primary hover:bg-primary/90">
                <Mail className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-5 h-5 text-primary" />
                          <span className="text-sm font-medium text-muted-foreground">
                            {stat.label}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold">{stat.value}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <CardTitle className="text-xl">{feature.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-base">
                          {feature.description}
                        </CardDescription>
                        <Button variant="outline" className="w-full mt-4">
                          Coming Soon
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Integration Notice */}
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="w-6 h-6" />
                  <span>Email Marketing Integration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  ARAS Mailing will integrate seamlessly with your existing sales automation workflows, 
                  allowing you to create comprehensive multi-channel campaigns that combine voice calling, 
                  AI chat, and email marketing for maximum engagement.
                </p>
                <div className="flex space-x-3">
                  <Button variant="outline">
                    Learn More
                  </Button>
                  <Button>
                    Request Early Access
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}