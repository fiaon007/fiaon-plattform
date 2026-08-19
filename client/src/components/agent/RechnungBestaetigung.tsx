// ═══════════════════════════════════════════════════════════════════════════
// „DAS BEKOMMT DER KUNDE" — DIE BESTÄTIGUNG VOR DEM SENDEN
//
// ── DER ANLASS (Florentine Lombardi, 19.08.2026) ───────────────────────────
// „Er wollte ein Pro-Paket. Das High End habe ich rausgenommen. Wenn ich auf
// Rechnung senden drücke, bekommt er aber eine E-Mail für das High-End-Paket."
//
// Die falsche Auflösung ist behoben (server/lib/fiaon-massgebliche-bestellung.ts).
// Das genügt nicht: Der Agent hat gedrückt und WUSSTE NICHT, was rausgeht.
// Gefunden wurde der Fehler, weil der Kunde sich gemeldet hat — im
// Zustellprotokoll stehen fünf falsche Mails an denselben Menschen, bevor es
// jemandem auffiel.
//
// ── WARUM EIN BAUTEIL UND NICHT DREI DIALOGE ──────────────────────────────
// Der Knopf steht an drei Stellen: Kundenkarte, Vertriebsansicht und
// Vollpfleger-Fluss. Drei Dialoge wären drei Wortlaute, und der vierte
// Aufrufort bekäme keinen. Genau so ist der Fehler entstanden, den diese
// Bestätigung abfängt: sechs Wege, die dieselbe Frage jeder für sich
// beantworteten.
//
// ── WAS ER ANZEIGT ────────────────────────────────────────────────────────
// Paket, Betrag, Verwendungszweck, Empfängeradresse — und ausdrücklich, wenn es
// mehrere offene Buchungen gibt. Alles kommt aus EINER Vorschau-Route
// (`/agent/crm/kunden/:id/rechnung-vorschau`), die nichts sendet. Eine Vorschau,
// die schon etwas auslöst, macht den zweiten Klick zur Lüge.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

export interface RechnungVorschau {
  ok: boolean;
  moeglich: boolean;
  ersteRechnung: boolean;
  ref?: string;
  paket: string | null;
  betragCents: number | null;
  betragText?: string | null;
  verwendungszweck: string | null;
  empfaenger: string | null;
  weitereOffen: number;
  hinweis: string | null;
  error?: string;
}

interface Props {
  personId: number;
  kundeName: string;
  /** Wird mit der geprüften Referenz aufgerufen — der Server prüft sie erneut. */
  onSenden: (ref: string | null) => void | Promise<void>;
  onAbbrechen: () => void;
  /** Läuft der Versand gerade? Dann ist der Knopf gesperrt. */
  laeuft?: boolean;
}

export function RechnungBestaetigung({
  personId, kundeName, onSenden, onAbbrechen, laeuft,
}: Props) {
  const [v, setV] = useState<RechnungVorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    void (async () => {
      const r = await fetch(`/api/fiaon/agent/crm/kunden/${personId}/rechnung-vorschau`,
        { credentials: "include" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (weg) return;
      if (j?.ok) setV(j);
      else setFehler(j?.error || "Die Vorschau konnte nicht geladen werden.");
    })();
    return () => { weg = true; };
  }, [personId]);

  const geld = (c: number | null | undefined) =>
    c == null ? null : `${(c / 100).toFixed(2).replace(".", ",")} €`;

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-3"
         style={{ background: "rgba(15,23,42,.5)", backdropFilter: "blur(3px)" }}
         role="dialog" aria-modal="true" aria-label="Zahlungsdaten senden">
      <div className="w-full max-w-[430px] bg-white rounded-2xl border border-slate-200 p-4 sm:p-5"
           style={{ boxShadow: "0 24px 60px -20px rgba(15,23,42,.4)" }}>
        <h2 className="text-[15px] font-bold text-slate-900">Das bekommt {kundeName}</h2>

        {!v && !fehler && (
          <p className="text-[12.5px] text-slate-500 mt-2">Wird geprüft …</p>
        )}
        {fehler && (
          <p className="text-[12.5px] mt-2" style={{ color: "#b91c1c" }}>{fehler}</p>
        )}

        {v && (
          <>
            {/* ── DER HINWEIS ZUERST ────────────────────────────────────────
                Wenn es mehrere offene Buchungen gibt, ist das die wichtigste
                Zeile im Fenster — sie steht deshalb ÜBER den Angaben und nicht
                als Fußnote darunter. */}
            {v.hinweis && (
              <p className="text-[12.5px] mt-2.5 px-3 py-2 rounded-xl leading-relaxed"
                 style={v.weitereOffen > 0 || !v.moeglich
                   ? { background: "rgba(180,83,9,.09)", border: "1px solid rgba(180,83,9,.28)", color: "#92400e" }
                   : { background: "rgba(29,78,216,.06)", border: "1px solid rgba(29,78,216,.2)", color: "#1e3a8a" }}>
                {v.hinweis}
              </p>
            )}

            {v.moeglich && (
              <div className="mt-3 text-[13px]">
                {([
                  ["Paket", v.paket ?? "— ohne Paketnamen —"],
                  ["Betrag", v.betragText ?? geld(v.betragCents) ?? "wird jetzt gesetzt"],
                  ["Verwendungszweck", v.verwendungszweck ?? "wird jetzt erzeugt"],
                  ["An", v.empfaenger ?? "—"],
                ] as [string, string][]).map(([k, w]) => (
                  <div key={k}
                       className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-[11.5px] uppercase tracking-[.06em] text-slate-400 shrink-0">{k}</span>
                    <span className="font-semibold text-slate-900 text-right break-all">{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onAbbrechen}
                      className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-white border border-slate-200 text-slate-600">
                Abbrechen
              </button>
              <button type="button"
                      disabled={!v.moeglich || !!laeuft}
                      onClick={() => void onSenden(v.ref ?? null)}
                      className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
                      style={{ background: "#1d4ed8" }}>
                {laeuft ? "Sende …" : v.ersteRechnung ? "Rechnung stellen und senden" : "Jetzt senden"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Der Server prüft die Bestellung noch einmal. Wurde sie zwischenzeitlich
              getauscht, wird der Versand abgelehnt statt falsch ausgeführt.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
