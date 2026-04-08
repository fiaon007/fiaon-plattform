// Usage Limits Configuration - ARAS AI 2025
export const USAGE_LIMITS = {
  free: {
    calls: 2,
    messages: 10,
    name: 'ARAS Free – Discover Mode'
  },
  pro: {
    calls: 100,
    messages: 500,
    name: 'ARAS Pro – Growth Mode'
  },
  ultra: {
    calls: 1000,
    messages: 10000,
    name: 'ARAS Ultra – Performance Mode'
  },
  ultimate: {
    calls: 10000,
    messages: -1, // -1 = unlimited
    name: 'ARAS Ultimate – Enterprise Mode'
  }
};

export function checkUsageLimit(
  plan: string,
  currentUsage: number,
  limitType: 'calls' | 'messages'
): { allowed: boolean; limit: number; remaining: number } {
  const limits = USAGE_LIMITS[plan as keyof typeof USAGE_LIMITS] || USAGE_LIMITS.free;
  const limit = limits[limitType];
  
  if (limit === -1) {
    return { allowed: true, limit: -1, remaining: -1 };
  }
  
  const remaining = Math.max(0, limit - currentUsage);
  const allowed = currentUsage < limit;
  
  return { allowed, limit, remaining };
}
