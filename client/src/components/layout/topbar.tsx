import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, LogOut, Sparkles, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import type { User, SubscriptionResponse } from "@shared/schema";
import UsageWidget from "@/components/usage-widget";

interface TopBarProps {
  currentSection: string;
  subscriptionData?: SubscriptionResponse;
  user: User | null;
  isVisible: boolean;
}

export function TopBar({ currentSection, subscriptionData, user, isVisible }: TopBarProps) {
  const getSectionTitle = (path: string) => {
    switch (path) {
      case 'dashboard': return 'DASHBOARD';
      case 'space': return 'SPACE';
      case 'leads': return 'WISSENSDATENBANK';
      case 'power': return 'POWER - EINZELANRUF';
      case 'campaigns': return 'POWER - KAMPAGNEN';
      case 'contacts': return 'POWER - KONTAKTE';
      case 'calendar': return 'POWER - KALENDER';
      case 'billing': return 'IHR PLAN';
      case 'settings': return 'EINSTELLUNGEN';
      default: return 'ARAS AI';
    }
  };

  const getUserInitials = (user: User | null) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  const isPremium = subscriptionData?.plan !== "free" && subscriptionData?.plan !== "starter";

  return (
    <motion.div
      className="h-12 md:h-14 w-full bg-black/60 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-3 md:px-6 relative overflow-visible z-30 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
      initial={{ y: 0, opacity: 1 }}
      animate={{
        y: isVisible ? 0 : -56,
        opacity: isVisible ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Subtle main gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-[#0b0b0f]/60 to-black/40" />

      {/* Ambient orange glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[520px] h-[180px] bg-[#FE9100]/8 blur-[90px]" />

      {/* Fine diagonal highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-60" />

      {/* LEFT SECTION */}
      <div className="flex items-center gap-4 relative z-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col"
        >
          <span className="text-[10px] text-gray-500 font-medium tracking-[0.14em] uppercase leading-tight">
            Welcome back
          </span>
          <span className="text-xs font-semibold text-white leading-tight">
            {user?.firstName || user?.username || "User"} 👋
          </span>
        </motion.div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-7 bg-gradient-to-b from-transparent via-white/15 to-transparent" />

        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18 }}
          className="flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FE9100] shadow-[0_0_10px_rgba(254,145,0,0.8)] animate-pulse" />
          <h2
            className="text-[11px] md:text-xs font-bold tracking-[0.25em] uppercase"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            <span className="bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
              {getSectionTitle(currentSection)}
            </span>
          </h2>
        </motion.div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-2 md:gap-3 relative z-20">
        {/* Command Palette Hint */}
        <motion.button
          data-tour="mc-command-hint"
          type="button"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => {
            // Trigger Cmd/Ctrl+K programmatically
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: navigator.platform.includes('Mac'),
              ctrlKey: !navigator.platform.includes('Mac'),
              bubbles: true,
            });
            window.dispatchEvent(event);
          }}
          className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all cursor-pointer"
          title="Command Palette öffnen"
        >
          <span className="text-[9px] font-mono text-neutral-500">
            {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </span>
        </motion.button>

        {/* Usage Widget – extra z-index so Overlay stets sichtbar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="relative z-40"
        >
          <UsageWidget />
        </motion.div>

        {/* Plan Badge → /billing */}
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => (window.location.href = "/billing")}
          className="relative group cursor-pointer"
        >
          {isPremium && (
            <div className="absolute -inset-[1.5px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <motion.div
                className="w-full h-full rounded-md"
                animate={{
                  background: [
                    "linear-gradient(90deg, #FE9100 0%, #a34e00 50%, #FE9100 100%)",
                    "linear-gradient(90deg, #a34e00 0%, #FE9100 50%, #a34e00 100%)",
                    "linear-gradient(90deg, #FE9100 0%, #a34e00 50%, #FE9100 100%)",
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{
                  padding: "1px",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />
            </div>
          )}

          <div
            className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-md backdrop-blur-md transition-all duration-300 text-[10px] tracking-[0.16em] uppercase ${
              isPremium
                ? "bg-gradient-to-r from-[#FE9100]/12 to-[#a34e00]/10 border border-[#FE9100]/30 group-hover:from-[#FE9100]/18 group-hover:to-[#a34e00]/16 shadow-[0_0_18px_rgba(254,145,0,0.35)]"
                : "bg-white/4 border border-white/10 hover:bg-white/8"
            }`}
          >
            {isPremium ? (
              <motion.div
                animate={{
                  rotate: [0, 4, 0, -4, 0],
                  scale: [1, 1.06, 1],
                }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3 }}
                className="flex items-center justify-center"
              >
                <Crown className="w-3 h-3 text-[#FE9100]" />
              </motion.div>
            ) : (
              <Sparkles className="w-3 h-3 text-gray-400" />
            )}

            <span className={isPremium ? "text-[#FE9100] font-semibold" : "text-gray-300 font-medium"}>
              {subscriptionData?.status === "trial" || subscriptionData?.status === "trialing"
                ? "TRIAL"
                : subscriptionData?.plan
                ? subscriptionData.plan.toUpperCase()
                : "FREE"}
            </span>
          </div>
        </motion.button>

        {/* User Profile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="relative group"
        >
          <div className="pointer-events-none absolute -inset-[1px] rounded-lg bg-gradient-to-r from-[#FE9100]/0 via-[#FE9100]/18 to-[#FE9100]/0 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />

          <button
            type="button"
            className="relative flex items-center gap-2 bg-white/4 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/8 hover:border-white/25 transition-all duration-300"
          >
            <div className="relative">
              {isPremium && (
                <motion.div
                  className="absolute -inset-[2px] rounded-full"
                  animate={{
                    background: [
                      "linear-gradient(0deg, #FE9100, #a34e00)",
                      "linear-gradient(180deg, #a34e00, #FE9100)",
                      "linear-gradient(360deg, #FE9100, #a34e00)",
                    ],
                    rotate: [0, 360],
                  }}
                  transition={{
                    background: { duration: 3.2, repeat: Infinity },
                    rotate: { duration: 9, repeat: Infinity, ease: "linear" },
                  }}
                />
              )}
              <Avatar className="w-7 h-7 relative border-2 border-black/80 shadow-[0_0_12px_rgba(0,0,0,0.8)]">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-[#FE9100] to-[#a34e00] text-white text-[9px] font-bold">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-[10px] font-semibold text-white truncate max-w-[120px]">
                {user?.firstName || user?.username || "User"}
              </span>
              <span className="text-[9px] text-gray-400 truncate max-w-[120px]">
                {user?.email?.split("@")[0] || "user"}
              </span>
            </div>

            <ChevronDown className="w-2.5 h-2.5 text-gray-400 group-hover:text-gray-200 transition-colors" />
          </button>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await fetch("/api/logout", { method: "POST", credentials: "include" });
                window.location.href = "/auth";
              } catch (error) {
                console.error("Logout failed:", error);
                window.location.href = "/auth";
              }
            }}
            className="w-7 h-7 rounded-md bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/40 text-gray-300 hover:text-red-400 transition-all duration-300 p-0 group"
          >
            <LogOut className="w-3 h-3 group-hover:scale-110 transition-transform" />
          </Button>
        </motion.div>
      </div>

      {/* Bottom animated glow line */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[1px]">
        <motion.div
          className="h-full bg-gradient-to-r from-transparent via-[#FE9100]/40 to-transparent"
          animate={{
            opacity: [0.25, 0.7, 0.25],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </motion.div>
  );
}
