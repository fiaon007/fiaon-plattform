import AdminApplicationsManager from "@/components/admin/AdminApplicationsManager";

// ════════════════════════════════════════════════════════════════════
// /admin/database → Kunden & Anträge (P3-B).
// Ersetzt das frühere „Cockpit" mit zweiter Sidebar: zeigt jetzt NUR noch
// die echte Kunden-/Antragsverwaltung. Übersicht/Aufgaben liegen im Hub,
// Kündigungen/Investoren/Dubletten sind eigene Nav-Punkte, die Stripe-/
// Buchhaltungs-Gimmicks wurden entfernt (siehe CHANGELOG P3-B).
// ════════════════════════════════════════════════════════════════════

export default function AdminKundenPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <AdminApplicationsManager />
    </div>
  );
}
