/**
 * ============================================================================
 * ARAS COMMAND CENTER - Accept Invitation Page
 * ============================================================================
 * Allows invited staff to set their password and join the team
 * Token-based validation with 7-day expiry
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Shield, Lock, User, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type InviteStatus = "loading" | "valid" | "invalid" | "expired" | "accepted" | "error";

interface InviteData {
  email: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setError("No invitation token provided");
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/admin/staff/invite/validate?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          if (data.error?.includes("expired")) {
            setStatus("expired");
          } else if (data.error?.includes("used") || data.error?.includes("accepted")) {
            setStatus("accepted");
          } else {
            setStatus("invalid");
          }
          setError(data.error);
          return;
        }

        setInviteData(data.invitation);
        setStatus("valid");
      } catch (err: any) {
        setStatus("error");
        setError(err.message);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/staff/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Success - redirect to login or internal dashboard
      setStatus("accepted");
      setTimeout(() => {
        setLocation("/auth");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 
            className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            ARAS COMMAND CENTER
          </h1>
          <p className="text-gray-400 mt-2">Team Invitation</p>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
          <CardContent className="p-8">
            {/* Loading State */}
            {status === "loading" && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 mx-auto text-orange-400 animate-spin mb-4" />
                <p className="text-gray-400">Validating invitation...</p>
              </div>
            )}

            {/* Invalid Token */}
            {status === "invalid" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Invalid Invitation</h2>
                <p className="text-gray-400 mb-6">{error || "This invitation link is not valid."}</p>
                <Button onClick={() => setLocation("/auth")} variant="outline">
                  Go to Login
                </Button>
              </div>
            )}

            {/* Expired Token */}
            {status === "expired" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Invitation Expired</h2>
                <p className="text-gray-400 mb-6">
                  This invitation has expired. Please contact your administrator for a new invitation.
                </p>
                <Button onClick={() => setLocation("/auth")} variant="outline">
                  Go to Login
                </Button>
              </div>
            )}

            {/* Already Accepted */}
            {status === "accepted" && (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </motion.div>
                <h2 className="text-xl font-semibold text-white mb-2">Welcome to the Team!</h2>
                <p className="text-gray-400 mb-4">Your account has been created successfully.</p>
                <p className="text-sm text-gray-500">Redirecting to login...</p>
              </div>
            )}

            {/* Valid - Show Form */}
            {status === "valid" && inviteData && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-orange-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    You're Invited!
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Join as <span className="text-orange-400 font-medium">{inviteData.role}</span>
                  </p>
                </div>

                {/* Email (readonly) */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-300">
                    {inviteData.email}
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      required
                      minLength={3}
                      className="pl-10 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      required
                      minLength={8}
                      className="pl-10 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      className="pl-10 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Join ARAS Command Center"
                  )}
                </Button>
              </form>
            )}

            {/* Error State */}
            {status === "error" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Something Went Wrong</h2>
                <p className="text-gray-400 mb-6">{error || "An unexpected error occurred."}</p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
