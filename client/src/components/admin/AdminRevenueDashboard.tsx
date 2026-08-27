// ═══════════════════════════════════════════════════════════════════════════
// STRIPE IST GESCHICHTE (27.08.2026, Justins Auftrag: „STRIPE überall
// löschen — wirklich alles weg")
//
// Diese Komponente zog jede Kartenzahlung einzeln aus der Stripe-API und
// nannte das „Umsatz" — während das Geschäft längst per Banküberweisung
// läuft. Die Server-Routen (/admin/stripe/*) sind entfernt; die Wahrheit
// über den Umsatz steht im Chefbüro unter „Verdienst & Wert".
// ═══════════════════════════════════════════════════════════════════════════
export default function AdminRevenueDashboard() {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Diese Ansicht ist umgezogen.</p>
      <p style={{ margin: 0, fontSize: 13.5, color: "#64748b", maxWidth: 520 }}>
        Die Stripe-Auswertung ist abgeschaltet — sie zeigte Kartenzahlungen, die es nicht mehr gibt.
        Umsatz, monatliche Einnahmen (MRR), Vertragsbestand und Unternehmenswert stehen jetzt im
        Chefbüro unter <b>Verdienst &amp; Wert</b>, gerechnet aus den bankbestätigten Zahlungen.
      </p>
      <a href="/chef/wert" style={{ marginTop: 6, padding: "10px 18px", borderRadius: 12,
        background: "#1d4ed8", color: "#fff", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
        Zu Verdienst &amp; Wert
      </a>
    </div>
  );
}
