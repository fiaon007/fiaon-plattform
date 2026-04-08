import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageCircle, 
  LayoutDashboard,
  Phone, 
  Megaphone,
  Contact,
  Calendar,
  Zap,
  BookOpen, 
  CreditCard, 
  Settings, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  Users
} from "lucide-react";
import { useState } from "react";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ activeSection, onSectionChange, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['power']); // Power ist initial aufgeklappt

  const navItems = [
    { id: "space", label: "Space", icon: MessageCircle },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { 
      id: "power", 
      label: "Power", 
      icon: Phone,
      subItems: [
        { id: "power", label: "Einzelanruf", icon: Zap },
        { id: "campaigns", label: "Kampagnen", icon: Megaphone },
        { id: "contacts", label: "Kontakte", icon: Contact },
        { id: "calendar", label: "Kalender", icon: Calendar }
      ]
    },
    { id: "leads", label: "Wissensdatenbank", icon: BookOpen },
    { id: "billing", label: "Ihr Plan", icon: CreditCard },
    { id: "settings", label: "Einstellungen", icon: Settings },
  ];

  const toggleMenu = (itemId: string) => {
    setExpandedMenus(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  return (
    <motion.div 
      className="relative flex-shrink-0"
      initial={false}
      animate={{ width: isCollapsed ? 72 : 220 }}
      transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
    >
      {/* Clean Background */}
      <div className="absolute inset-0">
        {/* Subtle Background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        />

        {/* Subtle Animated Border */}
        <motion.div
          className="absolute right-0 top-0 bottom-0 w-[1px]"
          style={{
            background: 'linear-gradient(180deg, transparent, rgba(254, 145, 0, 0.15), transparent)',
            backgroundSize: '100% 200%'
          }}
          animate={{
            backgroundPosition: ['0% 0%', '0% 100%', '0% 0%']
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Logo Section */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center p-5' : 'justify-between px-5 py-5'}`}>
          <motion.div
            className="relative"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <img 
              src={arasLogo} 
              alt="ARAS AI" 
              className={`relative ${isCollapsed ? 'w-10 h-10' : 'w-12 h-12'} transition-all duration-300 object-contain`}
            />
          </motion.div>
          
          {!isCollapsed && onToggleCollapse && (
            <motion.button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-full transition-all"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
              whileHover={{ 
                scale: 1.05,
                borderColor: 'rgba(254, 145, 0, 0.2)'
              }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-3 h-3 text-gray-500" />
            </motion.button>
          )}
        </div>

        {/* Expand Button (when collapsed) */}
        {isCollapsed && onToggleCollapse && (
          <div className="flex justify-center pb-4">
            <motion.button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-full transition-all"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
              whileHover={{ 
                scale: 1.05,
                borderColor: 'rgba(254, 145, 0, 0.2)'
              }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronRight className="w-3 h-3 text-gray-500" />
            </motion.button>
          </div>
        )}
        
        {/* Navigation Items */}
        <nav className={`flex-shrink-0 flex flex-col justify-start ${isCollapsed ? 'px-3' : 'px-4'} pt-6 pb-2`}>
          <div className="space-y-3">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const isHovered = hoveredItem === item.id;
              const hasSubItems = 'subItems' in item && item.subItems;
              const isExpanded = expandedMenus.includes(item.id);
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                >
                  {/* Main Item */}
                  <motion.div
                    onClick={() => {
                      if (hasSubItems && !isCollapsed) {
                        toggleMenu(item.id);
                      } else if (!hasSubItems) {
                        window.location.href = item.id === 'space' ? '/app' : `/app/${item.id}`;
                      }
                    }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="relative block group cursor-pointer"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Wave Border Animation Container */}
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      {/* Fluid Wave Border */}
                      {(isActive || isHovered) && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: isActive
                              ? `linear-gradient(90deg, 
                                  transparent 0%, 
                                  rgba(254, 145, 0, 0.3) 25%, 
                                  rgba(233, 215, 196, 0.3) 50%, 
                                  rgba(163, 78, 0, 0.3) 75%, 
                                  transparent 100%)`
                              : `linear-gradient(90deg, 
                                  transparent 0%, 
                                  rgba(254, 145, 0, 0.15) 50%, 
                                  transparent 100%)`,
                            backgroundSize: '200% 100%',
                            padding: '1px',
                          }}
                          animate={{
                            backgroundPosition: isActive || isHovered 
                              ? ['200% 0%', '-200% 0%']
                              : '0% 0%'
                          }}
                          transition={{
                            backgroundPosition: {
                              duration: isActive ? 2 : 1.5,
                              repeat: Infinity,
                              ease: 'linear'
                            }
                          }}
                        >
                          {/* Inner transparent background */}
                          <div className="absolute inset-[1px] rounded-full bg-[#0f0f0f]" />
                        </motion.div>
                      )}
                      
                      {/* Default border when not active/hovered */}
                      {!isActive && !isHovered && (
                        <div className="absolute inset-0 rounded-full border border-white/[0.08]" />
                      )}
                    </div>

                    {/* Button Content */}
                    <div
                      className={`relative flex ${isCollapsed ? 'justify-center' : 'items-center'} ${isCollapsed ? 'p-2.5' : 'px-3 py-2'} rounded-full`}
                    >
                      {/* Icon */}
                      <Icon 
                        className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} transition-all`}
                        style={{
                          color: isActive ? '#FE9100' : isHovered ? '#e9d7c4' : '#6b7280'
                        }}
                      />

                      {/* Label - ONLY VISIBLE WHEN OPEN */}
                      {!isCollapsed && (
                        <motion.span
                          className="ml-3 text-[11px] font-medium tracking-wide flex-1"
                          style={{
                            fontFamily: 'Orbitron, sans-serif',
                            color: isActive ? '#FE9100' : isHovered ? '#e9d7c4' : '#9ca3af'
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {item.label}
                        </motion.span>
                      )}

                      {/* Chevron für Untermenü */}
                      {hasSubItems && !isCollapsed && (
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown 
                            className="w-3 h-3"
                            style={{ color: isActive ? '#FE9100' : '#6b7280' }}
                          />
                        </motion.div>
                      )}

                      {/* Active Dot Indicator */}
                      {isActive && !hasSubItems && (
                        <motion.div
                          className={`absolute ${isCollapsed ? 'bottom-0.5 left-1/2 -translate-x-1/2' : 'right-2 top-1/2 -translate-y-1/2'} w-1 h-1 rounded-full`}
                          style={{
                            background: '#FE9100',
                          }}
                          animate={{
                            opacity: [0.4, 1, 0.4]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </div>
                  </motion.div>

                  {/* Submenu */}
                  {hasSubItems && !isCollapsed && (
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden mt-2 ml-4 space-y-2"
                        >
                          {item.subItems.map((subItem: any) => {
                            const SubIcon = subItem.icon;
                            const isSubActive = activeSection === subItem.id;
                            const isSubHovered = hoveredItem === subItem.id;

                            return (
                              <motion.a
                                key={subItem.id}
                                href={`/app/${subItem.id}`}
                                onMouseEnter={() => setHoveredItem(subItem.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                                className="relative block group"
                                whileTap={{ scale: 0.98 }}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ duration: 0.2 }}
                              >
                                <div className="relative flex items-center px-3 py-2 rounded-lg transition-all"
                                  style={{
                                    background: isSubActive 
                                      ? 'rgba(254, 145, 0, 0.1)' 
                                      : isSubHovered 
                                        ? 'rgba(255, 255, 255, 0.03)' 
                                        : 'transparent',
                                    border: `1px solid ${isSubActive ? 'rgba(254, 145, 0, 0.3)' : 'transparent'}`
                                  }}
                                >
                                  <SubIcon 
                                    className="w-3.5 h-3.5"
                                    style={{
                                      color: isSubActive ? '#FE9100' : isSubHovered ? '#e9d7c4' : '#6b7280'
                                    }}
                                  />
                                  <span
                                    className="ml-2 text-[10px] font-medium tracking-wide"
                                    style={{
                                      fontFamily: 'Orbitron, sans-serif',
                                      color: isSubActive ? '#FE9100' : isSubHovered ? '#e9d7c4' : '#9ca3af'
                                    }}
                                  >
                                    {subItem.label}
                                  </span>

                                  {/* Active indicator für Subitem */}
                                  {isSubActive && (
                                    <motion.div
                                      className="absolute right-2 w-1 h-1 rounded-full"
                                      style={{ background: '#FE9100' }}
                                      animate={{ opacity: [0.4, 1, 0.4] }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                    />
                                  )}
                                </div>
                              </motion.a>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </motion.div>
              );
            })}
          </div>
        </nav>
        
        {/* Logout Button - Simple & Transparent */}
        <div className={`flex-shrink-0 ${isCollapsed ? 'px-3 py-2' : 'px-4 py-2'}`}>
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
            className="relative w-full group"
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => setHoveredItem('logout')}
            onMouseLeave={() => setHoveredItem(null)}
            style={{ opacity: 0.7 }}
          >
            {/* Button Container */}
            <motion.div
              className={`relative flex ${isCollapsed ? 'justify-center' : 'items-center'} ${isCollapsed ? 'p-2.5' : 'px-3 py-2'} rounded-full transition-all duration-200`}
              style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid',
                borderColor: hoveredItem === 'logout'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(239, 68, 68, 0.2)',
                opacity: hoveredItem === 'logout' ? 1 : 0.8
              }}
            >
              <LogOut 
                className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} transition-all`}
                style={{
                  color: hoveredItem === 'logout' ? '#ef4444' : '#dc2626'
                }}
              />
              
              {/* Label - ONLY VISIBLE WHEN OPEN */}
              {!isCollapsed && (
                <motion.span
                  className="ml-3 text-[11px] font-medium tracking-wide"
                  style={{ 
                    fontFamily: 'Orbitron, sans-serif',
                    color: hoveredItem === 'logout' ? '#ef4444' : '#9b5a5a'
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  Abmelden
                </motion.span>
              )}
            </motion.div>
          </motion.button>
        </div>
      </div>

      {/* ARAS Font */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" 
        rel="stylesheet" 
      />
    </motion.div>
  );
}