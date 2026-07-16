import AdminInvestorsManager from "@/components/admin/AdminInvestorsManager";

// ════════════════════════════════════════════════════════════════════
// /admin/investoren — Investoren-Verwaltung (P3-B).
// Zuvor nur in der versteckten /admin/database-Sidebar; jetzt eigener
// Nav-Punkt. Wrappt die bestehende Verwaltungs-Komponente (API /api/admin/investors).
// ════════════════════════════════════════════════════════════════════

export default function AdminInvestoren() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <AdminInvestorsManager />
    </div>
  );
}
