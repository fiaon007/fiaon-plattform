// Demo data for prototype showcase
export const demoUser = {
  id: "demo-user",
  email: "demo@arasai.com",
  firstName: "Alex",
  lastName: "Thompson",
  profileImageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
  plan: "pro",
  tokenBalance: 7500,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date()
};

export const demoLeads = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.johnson@techcorp.com",
    phone: "+1 (555) 123-4567",
    company: "TechCorp Solutions",
    status: "hot",
    notes: "Interested in Enterprise plan. Follow up next week.",
    createdAt: new Date("2024-12-20"),
    userId: "demo-user"
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "m.chen@innovate.io",
    phone: "+1 (555) 987-6543",
    company: "Innovate.io",
    status: "warm",
    notes: "Requested demo for voice automation features.",
    createdAt: new Date("2024-12-19"),
    userId: "demo-user"
  },
  {
    id: 3,
    name: "Emma Rodriguez",
    email: "emma.r@salesforce.com",
    phone: "+1 (555) 555-0123",
    company: "Salesforce",
    status: "contacted",
    notes: "Discussed pricing options. Waiting for decision.",
    createdAt: new Date("2024-12-18"),
    userId: "demo-user"
  },
  {
    id: 4,
    name: "James Wilson",
    email: "james.wilson@startup.com",
    phone: "+1 (555) 777-8888",
    company: "Startup Inc",
    status: "cold",
    notes: "Found through LinkedIn. Potential fit for Pro plan.",
    createdAt: new Date("2024-12-17"),
    userId: "demo-user"
  },
  {
    id: 5,
    name: "Lisa Park",
    email: "lisa.park@enterprise.com",
    phone: "+1 (555) 999-0000",
    company: "Enterprise Corp",
    status: "converted",
    notes: "Signed Enterprise contract. Setup scheduled for next week.",
    createdAt: new Date("2024-12-16"),
    userId: "demo-user"
  }
];

export const demoCampaigns = [
  {
    id: 1,
    name: "Q1 Enterprise Outreach",
    type: "voice",
    status: "active",
    targetAudience: "Enterprise decision makers",
    message: "Hi {name}, I'm calling from ARAS AI to discuss how we can revolutionize your sales process...",
    leadsCount: 150,
    completedCalls: 78,
    successRate: 24.5,
    createdAt: new Date("2024-12-15"),
    userId: "demo-user"
  },
  {
    id: 2,
    name: "SaaS Startup Follow-up",
    type: "email",
    status: "paused",
    targetAudience: "SaaS startup founders",
    message: "Following up on our previous conversation about automating your sales workflow...",
    leadsCount: 85,
    completedCalls: 45,
    successRate: 18.2,
    createdAt: new Date("2024-12-10"),
    userId: "demo-user"
  },
  {
    id: 3,
    name: "Holiday Special Promotion",
    type: "voice",
    status: "completed",
    targetAudience: "Existing customers",
    message: "Season's greetings! We have a special upgrade offer for valued customers like you...",
    leadsCount: 200,
    completedCalls: 200,
    successRate: 31.5,
    createdAt: new Date("2024-12-01"),
    userId: "demo-user"
  }
];

export const demoChatMessages = [
  {
    id: 1,
    message: "Hello! I'm your ARAS AI assistant. How can I help you optimize your sales process today?",
    isAi: true,
    timestamp: new Date("2024-12-21T10:00:00"),
    userId: "demo-user"
  },
  {
    id: 2,
    message: "I need help creating a new voice campaign for our Q1 prospects",
    isAi: false,
    timestamp: new Date("2024-12-21T10:01:00"),
    userId: "demo-user"
  },
  {
    id: 3,
    message: "I'd be happy to help you create an effective voice campaign! Let me guide you through the process. First, let's define your target audience. Are you focusing on enterprise clients, SMBs, or a specific industry?",
    isAi: true,
    timestamp: new Date("2024-12-21T10:01:30"),
    userId: "demo-user"
  },
  {
    id: 4,
    message: "We're targeting enterprise clients in the technology sector",
    isAi: false,
    timestamp: new Date("2024-12-21T10:02:00"),
    userId: "demo-user"
  },
  {
    id: 5,
    message: "Perfect! Technology enterprises are great candidates for AI-powered sales automation. I recommend using our professional voice agent 'Marcus' for tech industry outreach. Would you like me to suggest some proven conversation starters and key talking points for this audience?",
    isAi: true,
    timestamp: new Date("2024-12-21T10:02:45"),
    userId: "demo-user"
  }
];

export const demoVoiceAgents = [
  {
    id: 1,
    name: "Marcus",
    description: "Professional, confident tone perfect for B2B enterprise sales",
    personality: "Professional & Authoritative",
    language: "English (US)",
    industry: "Technology & Enterprise",
    successRate: 28.5
  },
  {
    id: 2,
    name: "Sarah",
    description: "Warm, friendly approach ideal for relationship building",
    personality: "Warm & Conversational",
    language: "English (US)",
    industry: "Healthcare & Education",
    successRate: 24.2
  },
  {
    id: 3,
    name: "David",
    description: "Energetic and persuasive, great for fast-paced sales environments",
    personality: "Energetic & Persuasive",
    language: "English (US)",
    industry: "Finance & Real Estate",
    successRate: 31.8
  },
  {
    id: 4,
    name: "Emily",
    description: "Empathetic and consultative, perfect for complex solution selling",
    personality: "Empathetic & Consultative",
    language: "English (US)",
    industry: "Professional Services",
    successRate: 26.7
  }
];

export const demoCallLogs = [
  {
    id: 1,
    contactName: "Sarah Johnson",
    contactPhone: "+1 (555) 123-4567",
    duration: "4:32",
    outcome: "Interested",
    notes: "Very interested in Enterprise features. Scheduled demo for next Tuesday.",
    timestamp: new Date("2024-12-21T09:15:00"),
    voiceAgent: "Marcus",
    campaignId: 1,
    userId: "demo-user"
  },
  {
    id: 2,
    contactName: "Michael Chen",
    contactPhone: "+1 (555) 987-6543",
    duration: "2:18",
    outcome: "Callback Requested",
    notes: "Requested callback after 2 PM EST. Interested in Pro plan pricing.",
    timestamp: new Date("2024-12-21T08:45:00"),
    voiceAgent: "Marcus",
    campaignId: 1,
    userId: "demo-user"
  },
  {
    id: 3,
    contactName: "Emma Rodriguez",
    contactPhone: "+1 (555) 555-0123",
    duration: "6:47",
    outcome: "Demo Scheduled",
    notes: "Excellent conversation. Demo scheduled for Thursday 3 PM.",
    timestamp: new Date("2024-12-21T08:20:00"),
    voiceAgent: "Marcus",
    campaignId: 1,
    userId: "demo-user"
  },
  {
    id: 4,
    contactName: "James Wilson",
    contactPhone: "+1 (555) 777-8888",
    duration: "1:33",
    outcome: "Not Interested",
    notes: "Currently satisfied with existing solution. Add to follow-up list for Q2.",
    timestamp: new Date("2024-12-21T07:55:00"),
    voiceAgent: "Marcus",
    campaignId: 1,
    userId: "demo-user"
  }
];

export const demoTokenTransactions = [
  {
    id: 1,
    amount: 5000,
    type: "purchase",
    description: "Pro Plan Monthly Allocation",
    timestamp: new Date("2024-12-01"),
    userId: "demo-user"
  },
  {
    id: 2,
    amount: -150,
    type: "usage",
    description: "Voice Campaign: Q1 Enterprise Outreach",
    timestamp: new Date("2024-12-20"),
    userId: "demo-user"
  },
  {
    id: 3,
    amount: -75,
    type: "usage",
    description: "AI Chat Sessions",
    timestamp: new Date("2024-12-19"),
    userId: "demo-user"
  },
  {
    id: 4,
    amount: 1000,
    type: "purchase",
    description: "Additional Token Package",
    timestamp: new Date("2024-12-15"),
    userId: "demo-user"
  }
];

// Helper functions for demo
export const getDemoStats = () => ({
  totalLeads: demoLeads.length,
  hotLeads: demoLeads.filter(l => l.status === 'hot').length,
  activeCampaigns: demoCampaigns.filter(c => c.status === 'active').length,
  totalCalls: demoCallLogs.length,
  successRate: 28.5,
  tokenBalance: demoUser.tokenBalance
});