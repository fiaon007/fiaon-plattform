import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Phone, Key, Save, CheckCircle, AlertCircle, User, Bell, Globe, Loader2, Edit, Mail, Calendar, Shield, Trash2 } from "lucide-react";
import { GradientText } from "@/components/ui/gradient-text";
import { GlowButton } from "@/components/ui/glow-button";
// Token response type
type TokenResponse = { balance: number };

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [twilioData, setTwilioData] = useState({
    accountSid: "",
    authToken: "",
    phoneNumber: "",
  });

  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
  });

  const [appSettings, setAppSettings] = useState({
    notifications: true,
    autoSave: true,
    theme: "dark",
    language: "en",
    timezone: "UTC",
  });

  const [showTwilioEdit, setShowTwilioEdit] = useState(false);
  const [showTwilioDelete, setShowTwilioDelete] = useState(false);

  // Fetch user's token balance
  const { data: userTokens } = useQuery<TokenResponse>({
    queryKey: ["/api/user/tokens"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  // Fetch user subscription status
  const { data: userSubscription } = useQuery<any>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  // Helper functions for subscription display
  const getAccountStatus = () => {
    const isTrialUser = userSubscription?.status === "trial" || userSubscription?.status === "trialing";
    return isTrialUser ? "Free Trial" : "Active";
  };

  const getPlanName = () => {
    const isTrialUser = userSubscription?.status === "trial" || userSubscription?.status === "trialing";
    if (isTrialUser) return "Free Trial";
    
    const plan = userSubscription?.plan || "starter";
    switch (plan) {
      case "pro":
        return "Pro Plan";
      case "enterprise":
        return "Enterprise Plan";
      default:
        return "Starter Plan";
    }
  };

  const getStatusBadgeStyle = () => {
    const isTrialUser = userSubscription?.status === "trial" || userSubscription?.status === "trialing";
    return isTrialUser 
      ? "text-blue-400 border-blue-400/50 bg-blue-400/10"
      : "text-green-400 border-green-400/50 bg-green-400/10";
  };

  // Fetch Twilio settings
  const { data: twilioSettings, refetch: refetchTwilioSettings } = useQuery<{ configured: boolean; accountSid?: string; phoneNumber?: string }>({
    queryKey: ["/api/settings/twilio"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  // Twilio configuration mutation
  const twilioConfigMutation = useMutation({
    mutationFn: async (configData: any) => {
      const response = await apiRequest("POST", "/api/settings/twilio", configData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save Twilio settings");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Twilio Configuration Validated & Saved",
        description: "Your Twilio credentials have been verified and saved successfully. Voice calls will now connect to real phone numbers.",
      });
      setTwilioData({ accountSid: "", authToken: "", phoneNumber: "" });
      setShowTwilioEdit(false);
      refetchTwilioSettings();
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.message || "Failed to save Twilio settings",
        variant: "destructive",
      });
    },
  });

  // Twilio delete mutation
  const twilioDeleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/settings/twilio");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Removed",
        description: "Twilio settings have been deleted successfully.",
      });
      refetchTwilioSettings();
      setShowTwilioDelete(false);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed", 
        description: error.message || "Failed to remove Twilio configuration",
        variant: "destructive",
      });
    },
  });

  const handleTwilioConfig = () => {
    if (!twilioData.accountSid || !twilioData.authToken || !twilioData.phoneNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all Twilio credentials",
        variant: "destructive",
      });
      return;
    }
    twilioConfigMutation.mutate(twilioData);
  };

  const handleTwilioDelete = () => {
    twilioDeleteMutation.mutate();
  };

  // Profile update mutation
  const profileUpdateMutation = useMutation({
    mutationFn: async (updatedProfile: any) => {
      const response = await apiRequest("PUT", "/api/user/profile", updatedProfile);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // App settings update mutation
  const settingsUpdateMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      const response = await apiRequest("PUT", "/api/user/settings", updatedSettings);
      if (response.ok) {
        return { success: true };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your application settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleProfileUpdate = () => {
    if (!profileData.username) {
      toast({
        title: "Missing Information",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }
    profileUpdateMutation.mutate(profileData);
  };

  const handleSettingsUpdate = () => {
    const updatedSettings = {
      notifications: appSettings.notifications,
      autoSave: appSettings.autoSave,
      theme: appSettings.theme,
      language: appSettings.language,
      timezone: appSettings.timezone,
    };
    settingsUpdateMutation.mutate(updatedSettings);
  };

  // Show loading state while authentication is in progress
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const tokenBalance = userTokens?.balance || 0;

  // Initialize profile data when user data is available
  useEffect(() => {
    if (user) {
      setProfileData({
        username: (user as any).username || "",
        email: (user as any).email || "",
        firstName: (user as any).firstName || "",
        lastName: (user as any).lastName || "",
      });
    }
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeSection="settings" onSectionChange={() => {}} />
      <div className="flex-1 flex flex-col content-zoom">
        <TopBar 
          currentSection="settings" 
          subscriptionData={userSubscription}
          user={user as any}
          isVisible={true}
        />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-3xl font-orbitron font-bold">
                <GradientText>Settings</GradientText>
              </h1>
              <p className="text-muted-foreground">
                Configure your ARAS AI platform preferences and integrations
              </p>
            </div>

            {/* Profile Settings */}
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Settings
                </CardTitle>
                <CardDescription>Manage your personal information and account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input 
                      id="username" 
                      placeholder="Your username"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email"
                      placeholder="your.email@example.com"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      placeholder="John"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Doe"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Account Status</p>
                    <Badge variant="outline" className={getStatusBadgeStyle()}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {getAccountStatus()}
                    </Badge>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <Badge variant="outline" className={getStatusBadgeStyle()}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {getPlanName()}
                    </Badge>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Token Balance</p>
                    <p className="font-medium">{tokenBalance} tokens</p>
                  </div>
                </div>

                <GlowButton 
                  onClick={handleProfileUpdate} 
                  disabled={profileUpdateMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {profileUpdateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating Profile...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Update Profile
                    </>
                  )}
                </GlowButton>
              </CardContent>
            </Card>

            {/* Twilio Integration */}
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Twilio Voice Integration
                </CardTitle>
                <CardDescription>
                  Configure Twilio for real phone calls in your POWER module
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                  <div>
                    <p className="font-medium">Voice Calling Status</p>
                    <p className="text-sm text-muted-foreground">
                      Current telephony integration status
                    </p>
                  </div>
                  <div>
                    {twilioSettings?.configured ? (
                      <Badge variant="outline" className="text-green-400 border-green-400/50 bg-green-400/10">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Live Calls Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-400 border-orange-400/50 bg-orange-400/10">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Simulation Mode
                      </Badge>
                    )}
                  </div>
                </div>

                {twilioSettings?.configured ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-400">✓ Twilio is configured and ready for live calls</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTwilioEdit(true)}
                          className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTwilioDelete(true)}
                          className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Account SID: {twilioSettings.accountSid}</p>
                      <p>Phone Number: {twilioSettings.phoneNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                      <p className="font-medium mb-2">Get your Twilio credentials:</p>
                      <p>1. Visit <span className="text-primary">console.twilio.com</span></p>
                      <p>2. Copy your Account SID and Auth Token</p>
                      <p>3. Buy a phone number from Twilio</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="accountSid">Account SID *</Label>
                        <Input 
                          id="accountSid" 
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={twilioData.accountSid}
                          onChange={(e) => setTwilioData(prev => ({ ...prev, accountSid: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="authToken">Auth Token *</Label>
                        <Input 
                          id="authToken" 
                          type="password"
                          placeholder="Your Twilio Auth Token"
                          value={twilioData.authToken}
                          onChange={(e) => setTwilioData(prev => ({ ...prev, authToken: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="phoneNumber">Twilio Phone Number *</Label>
                      <Input 
                        id="phoneNumber" 
                        placeholder="+1234567890"
                        value={twilioData.phoneNumber}
                        onChange={(e) => setTwilioData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      />
                    </div>

                    <GlowButton 
                      onClick={handleTwilioConfig} 
                      disabled={twilioConfigMutation.isPending}
                      className="w-full md:w-auto"
                    >
                      {twilioConfigMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving Configuration...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Twilio Configuration
                        </>
                      )}
                    </GlowButton>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Application Preferences */}
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Application Preferences
                </CardTitle>
                <CardDescription>Configure how ARAS AI behaves and appears</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive campaign updates and alerts</p>
                      </div>
                      <Switch 
                        checked={appSettings.notifications}
                        onCheckedChange={(checked) => setAppSettings(prev => ({ ...prev, notifications: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto-Save</p>
                        <p className="text-sm text-muted-foreground">Automatically save your work</p>
                      </div>
                      <Switch 
                        checked={appSettings.autoSave}
                        onCheckedChange={(checked) => setAppSettings(prev => ({ ...prev, autoSave: checked }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Select value={appSettings.language} onValueChange={(value) => setAppSettings(prev => ({ ...prev, language: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="de">Deutsch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={appSettings.timezone} onValueChange={(value) => setAppSettings(prev => ({ ...prev, timezone: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                          <SelectItem value="Europe/London">London</SelectItem>
                          <SelectItem value="Europe/Paris">Paris</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <GlowButton 
                  onClick={handleSettingsUpdate} 
                  disabled={settingsUpdateMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {settingsUpdateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Preferences
                    </>
                  )}
                </GlowButton>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security & Privacy
                </CardTitle>
                <CardDescription>Manage your account security and data privacy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="font-medium mb-2">Password Security</p>
                    <p className="text-sm text-muted-foreground mb-3">Last changed: Never</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Change Password
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="font-medium mb-2">Data Export</p>
                    <p className="text-sm text-muted-foreground mb-3">Download your data</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Export Data
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded">
                  <p className="font-medium mb-1">Data Privacy</p>
                  <p>Your data is encrypted and securely stored. We never share your personal information with third parties.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Twilio Dialog */}
        {showTwilioEdit && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border/30 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Edit Twilio Configuration</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editAccountSid">Account SID *</Label>
                  <Input 
                    id="editAccountSid" 
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioData.accountSid}
                    onChange={(e) => setTwilioData(prev => ({ ...prev, accountSid: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="editAuthToken">Auth Token *</Label>
                  <Input 
                    id="editAuthToken" 
                    type="password"
                    placeholder="Your Twilio Auth Token"
                    value={twilioData.authToken}
                    onChange={(e) => setTwilioData(prev => ({ ...prev, authToken: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="editPhoneNumber">Twilio Phone Number *</Label>
                  <Input 
                    id="editPhoneNumber" 
                    placeholder="+1234567890"
                    value={twilioData.phoneNumber}
                    onChange={(e) => setTwilioData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <GlowButton 
                    onClick={handleTwilioConfig} 
                    disabled={twilioConfigMutation.isPending}
                    className="flex-1"
                  >
                    {twilioConfigMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Update Configuration
                      </>
                    )}
                  </GlowButton>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowTwilioEdit(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Twilio Confirmation Dialog */}
        {showTwilioDelete && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border/30 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-red-400">Remove Twilio Configuration</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to remove your Twilio configuration? This will disable real voice calling functionality and switch back to simulation mode.
              </p>
              
              <div className="flex gap-3">
                <Button 
                  variant="destructive" 
                  onClick={handleTwilioDelete}
                  disabled={twilioDeleteMutation.isPending}
                  className="flex-1"
                >
                  {twilioDeleteMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Configuration
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowTwilioDelete(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}