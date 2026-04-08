import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

/**
 * AdminRoute — Frontend guard for admin-only pages.
 * Renders children only if user has admin role, otherwise redirects to /.
 * For staff+admin routes (internal CRM), use StaffRoute instead (if needed).
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userRole = ((user as any)?.userRole || (user as any)?.user_role || '').toLowerCase();

  if (userRole !== 'admin') {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

/**
 * StaffRoute — Frontend guard for staff+admin pages (internal CRM).
 * Renders children only if user has admin or staff role.
 */
export function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userRole = ((user as any)?.userRole || (user as any)?.user_role || '').toLowerCase();

  if (userRole !== 'admin' && userRole !== 'staff') {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
