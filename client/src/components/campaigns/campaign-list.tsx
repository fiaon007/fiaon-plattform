import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GradientText } from "@/components/ui/gradient-text";
import { GlowButton } from "@/components/ui/glow-button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Plus, Play, Pause, MoreHorizontal, Megaphone } from "lucide-react";
import { motion } from "framer-motion";
import type { Campaign } from "@shared/schema";

interface CampaignListProps {
  campaigns?: Campaign[];
}

export function CampaignList({ campaigns = [] }: CampaignListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const isLoading = false; // Remove loading state since campaigns are passed as props

  // Demo function for campaign updates
  const handleUpdateCampaign = (id: number, updates: any) => {
    toast({
      title: "Campaign Updated",
      description: "Campaign status has been updated successfully.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400";
      case "paused":
        return "bg-yellow-500/20 text-yellow-400";
      case "completed":
        return "bg-blue-500/20 text-blue-400";
      case "draft":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  // Function to update campaign status (currently placeholder)
  const toggleCampaignStatus = (campaign: any) => {
    handleUpdateCampaign(campaign.id, { 
      status: campaign.status === "active" ? "paused" : "active" 
    });
  };

  const filteredCampaigns = campaigns.filter((campaign: any) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <GradientText>Campaigns</GradientText>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            <GradientText>Campaigns</GradientText>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <GlowButton>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </GlowButton>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first campaign to start automating your sales process.
            </p>
            <GlowButton>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </GlowButton>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCampaigns.map((campaign: any, index: number) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-lg">{campaign.name}</h3>
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-3">
                      {campaign.description || "No description"}
                    </p>
                    <div className="flex space-x-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Leads: </span>
                        <span className="font-medium">{campaign.totalLeads || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contacted: </span>
                        <span className="font-medium">{campaign.contacted || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Converted: </span>
                        <span className="font-medium">{campaign.converted || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleUpdateCampaign(campaign.id, { status: campaign.status === "active" ? "paused" : "active" })}
                    >
                      {campaign.status === "active" ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
