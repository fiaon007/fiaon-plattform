// ═══════════════════════════════════════════════════════════════════════════
// DIE PAKETBEZEICHNUNG — ODER DIE EHRLICHE LÜCKE
//
// ── DER BEFUND (22.08.2026) ────────────────────────────────────────────────
// Der Betreiber meldete Bestellungen, die „bezahlt — ohne Bezeichnung" zeigen.
//
// GEMESSEN: 39 bezahlte Bestellungen ohne `pack_name`. Fünf ließen sich aus
// dem Betrag ableiten (exakter Preistreffer) und sind nachgetragen. Bei den
// übrigen 34 gibt es KEINEN Hinweis: kein Betrag, kein Bankeingang, kein
// Paket-Schlüssel. Alle aus Ende Juni / Anfang Juli 2026.
//
// ── WARUM HIER NICHT GERATEN WIRD ──────────────────────────────────────────
// Ein geratenes Paket landet in der Rechnung, in der Abo-Rate und in der
// Provisionsrechnung — und niemand könnte hinterher sagen, ob es stimmt. Eine
// sichtbare Lücke ist ehrlich; eine gefüllte Lücke ist eine Behauptung.
//
// Vorher stand an diesen Stellen ein Gedankenstrich („—"). Der sieht aus wie
// „kein Paket bestellt" und nicht wie „wir wissen es nicht". Bei einer
// BEZAHLTEN Bestellung ist das ein Unterschied, der eine Nachfrage auslösen
// muss.
// ═══════════════════════════════════════════════════════════════════════════

export function PaketName({
  name, bezahlt, klein = false,
}: {
  name: string | null | undefined;
  /** Ist die Bestellung bezahlt? Nur dann ist eine fehlende Bezeichnung ein Problem. */
  bezahlt?: boolean;
  klein?: boolean;
}) {
  const sauber = String(name ?? "").trim();
  if (sauber) {
    return <span className={klein ? "text-[11px]" : "text-[12px] font-medium text-slate-700"}>{sauber}</span>;
  }

  // Unbezahlt und ohne Paket: ein Formularentwurf. Der Gedankenstrich ist richtig.
  if (!bezahlt) {
    return <span className="text-[12px] text-slate-400">—</span>;
  }

  // Bezahlt und ohne Paket: das muss jemand nachtragen.
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[11.5px] font-semibold" style={{ color: "#b45309" }}>
        Paket unbekannt
      </span>
      <span className="text-[10.5px] px-1.5 py-0.5 rounded"
            style={{ background: "rgba(217,119,6,.12)", color: "#92400e" }}
            title="Bezahlt, aber ohne Paketbezeichnung. Es gibt keinen Betrag und keinen Bankeingang, aus dem sich das Paket ableiten ließe — bitte im Gespräch klären und hier eintragen. Betrifft 34 Bestellungen aus Juni/Juli 2026.">
        nachtragen
      </span>
    </span>
  );
}
