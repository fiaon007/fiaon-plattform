import AdminApplicationsManager from "@/components/admin/AdminApplicationsManager";

// ════════════════════════════════════════════════════════════════════
// /admin/database → Anträge & KYC (Arbeits-Fokus, P3-B / Prompt 1/2).
// Die frühere Doppelrolle als „Kunden & Anträge" ist beendet: DIE Liste
// aller Personen lebt jetzt unter /admin/kunden (Zentrale Kundenakte),
// jede Person dort öffnet /admin/kunde/:id. Diese Seite bleibt als
// Arbeits-Fokus für Antrags-Details/KYC erhalten — ohne eigene,
// abweichende Detail-Wahrheit.
// ════════════════════════════════════════════════════════════════════

export default function AdminAntraegePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[12.5px] text-slate-600">
        Für die <span className="font-semibold text-slate-700">Akte einer Person</span> (Zahlungen, Mails, Verlauf, Agent, Dubletten) nutze{" "}
        <a href="/admin/kunden" className="font-semibold text-[#2563eb] hover:underline">Kunden — die eine Liste</a>.
      </div>
      <AdminApplicationsManager />
    </div>
  );
}
