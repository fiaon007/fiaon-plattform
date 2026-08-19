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
  /** Was der Katalog für dieses Paket vorsieht — in Cent. */
  katalogCents?: number | null;
  /** Weicht der Betrag vom Katalogpreis ab? Dann steht eine Warnmarke daran. */
  betragWeichtAb?: boolean;
  verwendungszweck: string | null;
  empfaenger: string | null;
  /** „bestellung" oder „person" — woher die Adresse kommt. */
  empfaengerQuelle?: "bestellung" | "person" | null;
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
  // ── DAS FELD ZUM NACHTRAGEN STEHT IM DIALOG ─────────────────────────────
  // AGENTS.md: „Bei fehlender E-Mail das Eingabefeld direkt dort — ein
  // Seitenwechsel für ein Feld ist die häufigste Stelle, an der jemand
  // aufgibt." Die Haken stehen ÜBER dem ersten `return` (auch das eine
  // Hausregel, zweimal in Softphone.tsx gelernt).
  const [neueMail, setNeueMail] = useState("");
  const [traegtNach, setTraegtNach] = useState(false);
  const [nachtragFehler, setNachtragFehler] = useState<string | null>(null);

  const laden = async () => {
    const r = await fetch(`/api/fiaon/agent/crm/kunden/${personId}/rechnung-vorschau`,
      { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) { setV(j); setFehler(null); }
    else setFehler(j?.error || "Die Vorschau konnte nicht geladen werden.");
  };

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

  /**
   * Die fehlende Adresse hier nachtragen — über die BESTEHENDE Stammdaten-Route.
   *
   * `POST /agent/customers/:ref/stammdaten` schreibt über
   * `updateCustomerContact`: ein Verlaufseintrag je Feld, und der alte Wert
   * wandert als Alias an die Person. Eine eigene Route für „nur die E-Mail"
   * wäre die zweite Wahrheit über die Adresse eines Menschen — genau der
   * Fehler, den dieser Dialog gerade behebt.
   */
  const nachtragen = async () => {
    const adresse = neueMail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) {
      setNachtragFehler("Das sieht nicht wie eine E-Mail-Adresse aus.");
      return;
    }
    if (!v?.ref) {
      setNachtragFehler("Ohne Bestellung gibt es keine Akte, an der die Adresse hängt.");
      return;
    }
    setTraegtNach(true);
    setNachtragFehler(null);
    const r = await fetch(`/api/fiaon/agent/customers/${encodeURIComponent(v.ref)}/stammdaten`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adresse }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setTraegtNach(false);
    if (!j?.ok) { setNachtragFehler(j?.error || "Das Nachtragen hat nicht geklappt."); return; }
    setNeueMail("");
    // Die Vorschau neu holen, statt den Zustand von Hand zu setzen: Sonst
    // behauptet der Dialog eine Adresse, die der Server vielleicht anders
    // normalisiert hat — und gesendet wird die des Servers.
    await laden();
  };

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

            {/* ── DIE ANGABEN STEHEN IMMER DA ───────────────────────────────
                Vorher waren sie an `v.moeglich` gehängt: Wer keine Adresse
                hatte, sah ein Fenster mit einer Fehlermeldung und sonst nichts
                — kein Paket, kein Betrag, keine Referenz. Genau so sah der
                Screenshot bei Joachim Rechtsteiner aus. Was der Kunde bekommen
                SOLL, gehört auch dann auf den Bildschirm, wenn es gerade nicht
                rausgehen kann. */}
            {(v.paket || v.betragCents != null || v.verwendungszweck || v.ref) && (
              <div className="mt-3 text-[13px]" data-fiaon="rechnung-vorschau-angaben">
                {([
                  ["Paket", v.paket ?? "— ohne Paketnamen —", null],
                  ["Betrag", v.betragText ?? geld(v.betragCents) ?? "wird jetzt gesetzt",
                    // ── DIE WARNMARKE AM BETRAG ──────────────────────────
                    // Sie steht am Wert und nicht in einer Fußzeile: Wer die
                    // Zahl liest, muss die Warnung im selben Blick sehen.
                    v.betragWeichtAb
                      ? `Ungewöhnlicher Betrag — Katalogpreis wäre ${geld(v.katalogCents)}`
                      : null],
                  ["Verwendungszweck", v.verwendungszweck ?? "wird jetzt erzeugt", null],
                  ["An", v.empfaenger ?? "— keine Adresse —",
                    v.empfaenger && v.empfaengerQuelle === "person"
                      ? "aus den Stammdaten des Kunden" : null],
                ] as [string, string, string | null][]).map(([k, w, marke]) => (
                  <div key={k}
                       className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-[11.5px] uppercase tracking-[.06em] text-slate-400 shrink-0">{k}</span>
                    <span className="text-right">
                      <span className={`font-semibold break-all ${v.empfaenger || k !== "An" ? "text-slate-900" : ""}`}
                            style={!v.empfaenger && k === "An" ? { color: "#b45309" } : undefined}>{w}</span>
                      {marke && (
                        <span className="block text-[11px] font-semibold mt-0.5"
                              data-fiaon={k === "Betrag" ? "betrag-warnmarke" : "empfaenger-quelle"}
                              style={{ color: k === "Betrag" ? "#b45309" : "#64748b" }}>
                          {marke}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── OHNE ADRESSE: DAS FELD STATT EINER SACKGASSE ──────────────
                Der Knopf ist gesperrt (siehe unten) — eine Sperre ohne den
                nächsten Schritt ist eine Sackgasse (AGENTS.md). */}
            {!v.empfaenger && v.ref && (
              <div className="mt-3" data-fiaon="empfaenger-nachtragen">
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                  Trag die Adresse hier ein — sie wird in der Akte gespeichert,
                  danach kann die Mail sofort raus.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <input value={neueMail} onChange={(e) => setNeueMail(e.target.value)}
                         placeholder="E-Mail nachtragen" type="email" inputMode="email"
                         aria-label="E-Mail nachtragen"
                         className="flex-1 min-w-[180px] px-2.5 py-2 text-[12.5px] rounded-xl border border-slate-200" />
                  <button type="button"
                          disabled={traegtNach
                            || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(neueMail.trim())}
                          onClick={() => void nachtragen()}
                          className="px-3 py-2 rounded-xl text-[12px] font-semibold bg-white border border-slate-300 text-slate-700 disabled:opacity-40">
                    {traegtNach ? "Speichert …" : "Speichern"}
                  </button>
                </div>
                {nachtragFehler && (
                  <p className="text-[11.5px] mt-1" style={{ color: "#b91c1c" }}>{nachtragFehler}</p>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onAbbrechen}
                      className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-white border border-slate-200 text-slate-600">
                Abbrechen
              </button>
              {/* ── DER GESPERRTE KNOPF MUSS GESPERRT AUSSEHEN ──────────────
                  Er stand auf `disabled:opacity-50` über kräftigem Blau. Im
                  Screenshot des Betreibers wirkte er aktiv, obwohl daneben
                  „keine E-Mail-Adresse" stand — ein Klick hätte einen
                  Serverfehler erzeugt. AGENTS.md: „disabled muss SICHTBAR
                  anders sein als aktiv, nicht ähnlich." Also grau, mit Rahmen,
                  ohne Schatten. */}
              <button type="button"
                      disabled={!v.moeglich || !!laeuft}
                      onClick={() => void onSenden(v.ref ?? null)}
                      data-fiaon="rechnung-senden"
                      title={v.moeglich ? undefined : (v.hinweis ?? "Senden ist nicht möglich.")}
                      className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-bold"
                      style={v.moeglich && !laeuft
                        ? { background: "#1d4ed8", color: "#fff" }
                        : { background: "#f1f5f9", color: "#94a3b8",
                            border: "1px solid #e2e8f0", cursor: "not-allowed" }}>
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
