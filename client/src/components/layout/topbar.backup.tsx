import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GradientText } from "@/components/ui/gradient-text";
import { Crown, Users, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import type { User, SubscriptionResponse } from "@shared/schema";

interface TopBarProps {
  currentSection: string;
  subscriptionData?: SubscriptionResponse;
  user: User | null;
}

export function TopBar({ currentSection, subscriptionData, user }: TopBarProps) {
  const getSectionTitle = (section: string) => {
    switch (section) {
      case "space":
        return "SPACE";
      case "power":
        return "POWER";
      case "leads":
        return "RESULTS";
      case "billing":
        return "Billing";
      case "settings":
        return "Settings";
      case "aras-mailing":
        return "ARAS Mailing";
      default:
        return "SPACE";
    }
  };

  const getUserInitials = (user: User | null) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-orbitron font-bold">
          <GradientText>{getSectionTitle(currentSection)}</GradientText>
        </h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center space-x-2 bg-secondary px-3 py-1 rounded-lg"
        >
          <Crown className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium capitalize">
            {subscriptionData?.status === "trial" || subscriptionData?.status === "trialing" 
              ? "Free Trial" 
              : `${subscriptionData?.plan || 'Free'} Plan`
            }
          </span>
        </motion.div>
        
        <Avatar className="w-8 h-8">
          <AvatarImage src={user?.profileImageUrl || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getUserInitials(user)}
          </AvatarFallback>
        </Avatar>
        
        <Button
          variant="ghost"
          size="sm"  
          onClick={async () => {
            try {
              await fetch('/api/logout', { method: 'POST', credentials: 'include' });
              window.location.href = '/auth';
            } catch (error) {
              console.error('Logout failed:', error);
              window.location.href = '/auth';
            }
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
        </Button>

      </div>
    </div>
  );
}
