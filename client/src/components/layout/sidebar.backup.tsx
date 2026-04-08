import { motion } from "framer-motion";
import { GradientText } from "@/components/ui/gradient-text";
import { Button } from "@/components/ui/button";
import { 
  MessageCircle, 
  Phone, 
  Users, 
  Megaphone, 
  CreditCard, 
  Settings,
  Bot,
  Mail,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ activeSection, onSectionChange, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const navItems = [
    { id: "space", label: "SPACE", icon: MessageCircle },
    { id: "power", label: "POWER", icon: Phone },
    { id: "voice-agents", label: "VOICE AGENTS", icon: Bot },
    { id: "leads", label: "Results", icon: Users },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const mailingModules = [
    { id: "aras-mailing", label: "ARAS Mailing", icon: Mail },
  ];

  return (
    <motion.div 
      className={`${isCollapsed ? 'w-16' : 'w-64'} bg-card/80 backdrop-blur-sm border-r border-border flex flex-col transition-all duration-300 relative z-50`}
      animate={{ width: isCollapsed ? 64 : 256 }}
    >
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex justify-center w-full">
          <img 
            src={arasLogo} 
            alt="ARAS AI" 
            className={`${isCollapsed ? 'w-10 h-10' : 'w-14 h-14'} transition-all duration-300 object-contain`}
          />
        </div>
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="p-2 hover:bg-primary/10 ml-2"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <motion.a
              key={item.id}
              href={item.id === 'space' ? '/app' : `/app/${item.id}`}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-3 px-3'} py-3 rounded-lg transition-all ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'flex-shrink-0'}`} />
              {!isCollapsed && (
                <span className="font-medium text-sm">
                  {item.label}
                </span>
              )}
            </motion.a>
          );
        })}
        
        {!isCollapsed && (
          <>

            
            {mailingModules.map((item) => {
              const Icon = item.icon;
              
              return (
                <motion.a
                  key={item.id}
                  href={`/app/${item.id}`}
                  className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">
                    {item.label}
                  </span>
                </motion.a>
              );
            })}
          </>
        )}
      </nav>
      
      {/* Logout Button */}
      <div className="p-4 border-t border-border">
        <motion.button
          onClick={async () => {
            try {
              await fetch('/api/logout', { method: 'POST', credentials: 'include' });
              window.location.href = '/auth';
            } catch (error) {
              console.error('Logout failed:', error);
              window.location.href = '/auth';
            }
          }}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-3 px-3'} py-3 rounded-lg text-muted-foreground hover:text-primary transition-all relative overflow-hidden group`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          title={isCollapsed ? "Logout" : undefined}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          />
          <LogOut className="w-5 h-5 relative z-10" />
          {!isCollapsed && <span className="relative z-10">Logout</span>}
        </motion.button>
      </div>
    </motion.div>
  );
}