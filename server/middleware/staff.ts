// ============================================================================
// Staff & Admin Middleware - Role-based access control
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Middleware: Require Staff or Admin role
export const requireStaffOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.session.userId as string;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        userRole: users.userRole,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['staff', 'admin'].includes(user.userRole || '')) {
      // Also allow username 'ADMIN' for backwards compatibility
      if (user.username !== 'ADMIN') {
        return res.status(403).json({ error: 'Staff or admin access required' });
      }
    }

    // Attach user to request for downstream use
    (req as any).user = user;
    (req.session as any).username = user.username;

    return next();
  } catch (err) {
    console.error('[STAFF-MIDDLEWARE] Error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};
