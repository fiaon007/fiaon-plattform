import { useState } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { loginMutation } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      window.location.href = "/";
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <GlassNav activePage="login" />

      {/* Main Content */}
      <div className="relative z-10 max-w-[480px] mx-auto px-4 pt-32 pb-16">
        {/* Login Card */}
        <div className="animate-[fadeInUp_.6s_ease]">
          <div className="fiaon-glass-panel rounded-3xl p-8 sm:p-10 relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 opacity-15" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 8s ease-in-out infinite"
              }} />
              <div className="absolute inset-0 opacity-10" style={{
                background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8), transparent 70%)"
              }} />
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 fiaon-gradient-text-animated">
                  Willkommen zurück
                </h1>
                <p className="text-[15px] text-gray-500 leading-relaxed">
                  Melde dich an, um auf dein FIAON Dashboard zuzugreifen
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email/Username */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                    E-Mail oder Benutzername
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="deine@email.de"
                    className="w-full px-4 py-3 rounded-xl bg-white/50 border border-gray-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 outline-none transition-all text-[14px]"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                    Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl bg-white/50 border border-gray-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 outline-none transition-all text-[14px]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
                    />
                    <span className="text-[13px] text-gray-600">Angemeldet bleiben</span>
                  </label>
                  <a href="#" className="text-[13px] font-medium text-[#2563eb] hover:underline">
                    Passwort vergessen?
                  </a>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full py-4 rounded-xl text-[15px] font-semibold text-white transition-all fiaon-btn-gradient disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                >
                  <span className="relative z-10">
                    {loginMutation.isPending ? "Wird geladen..." : "Anmelden"}
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  </div>
                </button>

                {/* Error Message */}
                {loginMutation.error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-600 text-center">
                    {(loginMutation.error as Error).message}
                  </div>
                )}
              </form>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 backdrop-blur text-gray-500">oder</span>
                </div>
              </div>

              {/* Register Link */}
              <div className="text-center">
                <p className="text-[14px] text-gray-600 mb-3">
                  Noch kein FIAON Konto?
                </p>
                <a
                  href="/antrag"
                  className="inline-block px-6 py-3 rounded-xl text-[14px] font-semibold text-[#2563eb] border-2 border-[#2563eb] bg-transparent hover:bg-[#2563eb] hover:text-white transition-all duration-300"
                >
                  Konto eröffnen
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Links */}
        <div className="mt-8 text-center space-y-2">
          <a href="/terms" className="block text-[13px] text-gray-500 hover:text-gray-700">
            AGB
          </a>
          <a href="/privacy" className="block text-[13px] text-gray-500 hover:text-gray-700">
            Datenschutz
          </a>
        </div>
      </div>

      <PremiumFooter />
    </div>
  );
}
