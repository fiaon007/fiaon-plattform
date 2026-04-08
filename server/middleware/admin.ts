import { Request, Response, NextFunction } from 'express';
import { client } from '../db';

/**
 * Normalize role to lowercase for consistent comparison
 * Handles: ADMIN → admin, Staff → staff, USER → user
 */
function normalizeRole(role: any): string {
  return String(role || '').trim().toLowerCase();
}

/**
 * VALID_ROLES: The only roles allowed in the system
 */
export const VALID_ROLES = ['user', 'staff', 'admin'] as const;
export type UserRole = typeof VALID_ROLES[number];

/**
 * requireAdmin - Middleware that requires admin role
 * Uses userRole field from DB, NOT username check
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No session' });
    }

    const userId = req.session.userId as string;

    // Fetch user with role from DB
    const [user] = await client`
      SELECT id, username, user_role FROM users WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
    }

    const role = normalizeRole(user.user_role);

    // Admin-only access
    if (role !== 'admin') {
      console.warn(`[ADMIN] Access denied for ${user.username} (role: ${role})`);
      return res.status(403).json({ 
        ok: false, 
        code: 'FORBIDDEN', 
        message: 'Admin access required.' 
      });
    }

    // Attach user info to request for downstream use
    (req as any).adminUser = {
      id: user.id,
      username: user.username,
      role
    };
    (req.session as any).username = user.username;

    console.log(`[ADMIN] ✅ Access granted for ${user.username} (admin)`);
    return next();
  } catch (err: any) {
    console.error('[ADMIN] Middleware error:', err);
    return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: 'Admin check failed' });
  }
};

/**
 * requireStaffOrAdmin - Middleware that requires staff or admin role
 */
export const requireStaffOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No session' });
    }

    const userId = req.session.userId as string;

    const [user] = await client`
      SELECT id, username, user_role FROM users WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
    }

    const role = normalizeRole(user.user_role);

    if (role !== 'admin' && role !== 'staff') {
      console.warn(`[ADMIN] Staff/Admin access denied for ${user.username} (role: ${role})`);
      return res.status(403).json({ 
        ok: false, 
        code: 'FORBIDDEN', 
        message: 'Staff or Admin access required.' 
      });
    }

    (req as any).adminUser = { id: user.id, username: user.username, role };
    (req.session as any).username = user.username;

    console.log(`[ADMIN] ✅ Staff/Admin access granted for ${user.username} (${role})`);
    return next();
  } catch (err: any) {
    console.error('[ADMIN] Middleware error:', err);
    return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: 'Access check failed' });
  }
};

/**
 * Bootstrap first admin - Call this on server startup
 * If no admin exists, promotes ADMIN user or first user to admin
 */
export async function bootstrapFirstAdmin(): Promise<void> {
  try {
    // Count existing admins
    const [adminCount] = await client`
      SELECT COUNT(*) as count FROM users WHERE LOWER(user_role) = 'admin'
    `;

    if (parseInt(adminCount?.count || '0') > 0) {
      console.log('[BOOTSTRAP] ✅ Admin already exists, skipping bootstrap');
      return;
    }

    console.log('[BOOTSTRAP] ⚠️ No admin found, attempting bootstrap...');

    // Strategy 1: Look for user with username 'ADMIN' (case-insensitive)
    const [adminUser] = await client`
      SELECT id, username FROM users WHERE LOWER(username) = 'admin' LIMIT 1
    `;

    if (adminUser) {
      await client`
        UPDATE users SET user_role = 'admin' WHERE id = ${adminUser.id}
      `;
      console.log(`[BOOTSTRAP] ✅ Promoted '${adminUser.username}' to admin (matched username)`);
      return;
    }

    // Strategy 2: Check env var BOOTSTRAP_ADMIN_USERNAME
    const bootstrapUsername = process.env.BOOTSTRAP_ADMIN_USERNAME;
    if (bootstrapUsername) {
      const [envUser] = await client`
        SELECT id, username FROM users WHERE LOWER(username) = ${bootstrapUsername.toLowerCase()} LIMIT 1
      `;
      if (envUser) {
        await client`
          UPDATE users SET user_role = 'admin' WHERE id = ${envUser.id}
        `;
        console.log(`[BOOTSTRAP] ✅ Promoted '${envUser.username}' to admin (from BOOTSTRAP_ADMIN_USERNAME)`);
        return;
      }
    }

    // Strategy 3: Promote first registered user
    const [firstUser] = await client`
      SELECT id, username FROM users ORDER BY created_at ASC LIMIT 1
    `;

    if (firstUser) {
      await client`
        UPDATE users SET user_role = 'admin' WHERE id = ${firstUser.id}
      `;
      console.log(`[BOOTSTRAP] ✅ Promoted '${firstUser.username}' to admin (first user fallback)`);
      return;
    }

    console.log('[BOOTSTRAP] ⚠️ No users exist yet, skipping bootstrap');
  } catch (err) {
    console.error('[BOOTSTRAP] ❌ Error during admin bootstrap:', err);
  }
}
