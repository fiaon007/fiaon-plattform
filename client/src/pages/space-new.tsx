import { StartLaunchpad } from "@/components/space/start-launchpad";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

export default function Space() {
  const { user, isLoading } = useAuth();
  const companyHint = (user as any)?.company;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div
            className="w-16 h-16 border-4 border-[#FE9100] border-t-transparent rounded-full mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-gray-400 text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            ARAS AI lädt...
          </p>
        </div>
      </div>
    );
  }

  return (
    <StartLaunchpad companyHint={companyHint}>
      <ErrorBoundary fallbackTitle="Chat konnte nicht geladen werden">
        <ChatInterface />
      </ErrorBoundary>
    </StartLaunchpad>
  );
}
