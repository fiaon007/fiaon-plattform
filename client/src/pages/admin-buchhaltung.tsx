import AccountingDashboard from "@/components/admin/AccountingDashboard";
import AdminLedgerManager from "@/components/admin/AdminLedgerManager";

// ════════════════════════════════════════════════════════════════════
// /admin/buchhaltung — Buchhaltung & Ausbuchung (P3-B).
// Der P3-Report zeigt echte Daten (accounting_ledger: 143 Zeilen,
// accounting_entries: 8, config/balance vorhanden) — daher NICHT entfernt,
// sondern aus der aufgelösten /admin/database-Sidebar hierher übernommen.
// Offen (Vorgesetzten-Entscheidung): Sind das FIAON-Zahlen? Dann perspektivisch
// mit /admin/verbuchungen zusammenführen; falls Fremdprodukt → hier entfernen.
// ════════════════════════════════════════════════════════════════════

export default function AdminBuchhaltung() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <AccountingDashboard />
      <AdminLedgerManager />
    </div>
  );
}
