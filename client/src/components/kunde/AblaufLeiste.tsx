// ═══════════════════════════════════════════════════════════════════════════
// DIE ABLAUF-LEISTE — EIN Bauteil für Akte, Schublade und Portal
//
// ── DER AUFTRAG (20.08.2026) ───────────────────────────────────────────────
// „KOPF: Name + Stufen-MARKE aus der einen Ableitung, ABLAUF-LEISTE (Antrag ✓ ·
// Zahlung ✓ · Startgespräch ○ · Auskunft ○ · Voll aktiv ○ · Abo läuft) — jeder
// sieht in einer Sekunde, WO im Ablauf dieser Kunde steht und was der nächste
// Schritt ist."
//
// ── WARUM EIN BAUTEIL UND NICHT ZWEI ───────────────────────────────────────
// GEMESSEN: Die Verwaltungs-Akte hat 1.324 Zeilen, das Vertriebs-Cockpit
// 1.172. Beide zeichnen denselben Kunden, jede mit eigenem Quelltext. Eine
// Änderung an einer Stelle erreicht die andere nicht — und niemand merkt es,
// weil beide für sich richtig aussehen.
//
// Dieses Bauteil ist der Anfang der Zusammenführung: Kopf und Ablauf sind ab
// jetzt EINE Fassung. Die Sektionen folgen, aber sie folgen hier hinein — nicht
// in eine dritte Datei.
//
// ── WARUM DIE STATIONEN NICHT „SCHRITTE" HEISSEN ───────────────────────────
// Ein „Schritt 3 von 6" verspricht eine Reihenfolge, die es nicht gibt: Die
// Auskunft kann vor oder nach dem Gespräch kommen, das Abo läuft parallel. Es
// sind STATIONEN eines Wegs, und man sieht, welche erreicht sind.
// ═══════════════════════════════════════════════════════════════════════════

export type Kundenstufe = "kein_zugang" | "wartet_auf_onboarding" | "voll_aktiv";

export interface AblaufStand {
  antrag: boolean;
  zahlung: boolean;
  startgespraech: boolean;
  auskunft: boolean;
  vollAktiv: boolean;
  aboLaeuft: boolean;
}

/** Die Marke — dieselben Worte und Farben wie im Server (fiaon-kundenstufe.ts). */
export function stufenMarke(stufe: Kundenstufe): { text: string; farbe: string; hell: string } {
  switch (stufe) {
    case "kein_zugang":
      return { text: "Kein Zugang", farbe: "#64748b", hell: "rgba(100,116,139,.1)" };
    case "wartet_auf_onboarding":
      return { text: "Wartet auf Startgespräch", farbe: "#b45309", hell: "rgba(180,83,9,.1)" };
    default:
      return { text: "Voll aktiv", farbe: "#047857", hell: "rgba(4,120,87,.1)" };
  }
}

/** Ein Haken (erreicht) oder ein Ring (offen) — 1,5 px, currentColor. */
function Zeichen({ fertig }: { fertig: boolean }) {
  if (fertig) {
    return (
      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m4.5 10.5 3.6 3.6L15.5 6.5" />
      </svg>
    );
  }
  return (
    <span aria-hidden="true" style={{
      width: 9, height: 9, borderRadius: 999,
      boxShadow: "inset 0 0 0 1.5px currentColor", opacity: .45,
    }} />
  );
}

/**
 * Die Leiste.
 *
 * `dicht` für die Schublade (weniger Platz), normal für die Akte.
 */
export function AblaufLeiste({ stand, dicht = false }: { stand: AblaufStand; dicht?: boolean }) {
  const stationen: { text: string; fertig: boolean; hinweis?: string }[] = [
    { text: "Antrag", fertig: stand.antrag },
    { text: "Zahlung", fertig: stand.zahlung },
    { text: "Startgespräch", fertig: stand.startgespraech },
    { text: "Auskunft", fertig: stand.auskunft, hinweis: "freiwillig" },
    { text: "Voll aktiv", fertig: stand.vollAktiv },
    { text: "Abo läuft", fertig: stand.aboLaeuft },
  ];
  return (
    <div className="flex items-center flex-wrap" style={{ gap: dicht ? 4 : 6 }}
         role="list" aria-label="Der Weg dieses Kunden">
      {stationen.map((st, i) => (
        <div key={st.text} className="flex items-center" style={{ gap: dicht ? 4 : 6 }} role="listitem">
          <span className="inline-flex items-center gap-1.5 rounded-full font-semibold"
                style={{
                  padding: dicht ? "2px 8px" : "3px 10px",
                  fontSize: dicht ? 10.5 : 11.5,
                  background: st.fertig ? "rgba(4,120,87,.09)" : "rgba(15,23,42,.045)",
                  color: st.fertig ? "#047857" : "#64748b",
                  boxShadow: st.fertig
                    ? "inset 0 0 0 1px rgba(4,120,87,.22)"
                    : "inset 0 0 0 1px rgba(15,23,42,.08)",
                }}
                title={st.fertig ? `${st.text}: erreicht` : `${st.text}: offen`}>
            <Zeichen fertig={st.fertig} />
            {st.text}
            {st.hinweis && !st.fertig && !dicht && (
              <span style={{ fontSize: 9.5, opacity: .7 }}>{st.hinweis}</span>
            )}
          </span>
          {i < stationen.length - 1 && (
            <span aria-hidden="true" style={{
              width: dicht ? 6 : 9, height: 1,
              background: st.fertig ? "rgba(4,120,87,.3)" : "rgba(15,23,42,.12)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Der nächste Schritt — als Satz, mit optionaler Handlung.
 *
 * ── WARUM ALS SATZ UND NICHT ALS ZAHL ────────────────────────────────────
 * „Nächster Schritt: Startgespräch — Einladung erneut senden" beantwortet die
 * Frage, die jeder Mitarbeiter zuerst hat. „Stufe 2 von 4" beantwortet sie
 * nicht; man müsste erst lernen, was Stufe 2 bedeutet.
 */
export function NaechsterSchritt({ text, aktion }: {
  text: string;
  aktion?: { text: string; onClick: () => void; laeuft?: boolean } | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-2.5"
         style={{
           background: "rgba(29,78,216,.045)",
           boxShadow: "inset 0 0 0 1px rgba(29,78,216,.14)",
         }}>
      <span className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: "#1e40af" }}>
        Nächster Schritt
      </span>
      <span className="text-[12.5px] leading-snug min-w-0 flex-1" style={{ color: "#1e3a8a" }}>
        {text}
      </span>
      {aktion && (
        <button type="button" onClick={aktion.onClick} disabled={aktion.laeuft}
                className="shrink-0 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
                style={{ padding: "6px 13px", background: "#1d4ed8", minHeight: 32 }}>
          {aktion.laeuft ? "…" : aktion.text}
        </button>
      )}
    </div>
  );
}

/**
 * Der ganze Kopf: Name, Marke, Leiste, nächster Schritt.
 *
 * Akte und Schublade rufen DIESES Bauteil — nicht jede ihre eigene Fassung.
 */
export function KundenKopf({
  name, stufe, stand, naechsterSchritt, aktion, marken, dicht = false, ausnahme,
}: {
  name: string;
  stufe: Kundenstufe;
  stand: AblaufStand;
  naechsterSchritt: string;
  aktion?: { text: string; onClick: () => void; laeuft?: boolean } | null;
  /** Zusätzliche Marken (Direktzahler, DSGVO gelöscht …). */
  marken?: { text: string; farbe?: string }[];
  dicht?: boolean;
  /** Ist die Onboarding-Pflicht ausgesetzt? Dann steht der Grund hier. */
  ausnahme?: { gesetzt: boolean; grund: string | null; von: string | null } | null;
}) {
  const m = stufenMarke(stufe);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <h1 className={`font-bold text-slate-900 ${dicht ? "text-[17px]" : "text-xl"}`}>{name}</h1>
        {/* ── DIE MARKE AUS DER EINEN ABLEITUNG ──────────────────────────
            Vorher las die Akte einen Statustext, das Portal eine Spalte und die
            Kachel `account_status`. Drei Quellen, drei Wahrheiten. */}
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
              style={{ background: m.hell, color: m.farbe, boxShadow: `inset 0 0 0 1px ${m.farbe}33` }}>
          {m.text}
        </span>
        {marken?.map((mk) => (
          <span key={mk.text}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
            {mk.text}
          </span>
        ))}
      </div>

      <div className={dicht ? "mt-2" : "mt-3"}>
        <AblaufLeiste stand={stand} dicht={dicht} />
      </div>

      {ausnahme?.gesetzt && (
        <p className="mt-2.5 text-[12px] leading-snug rounded-lg px-3 py-2"
           style={{ background: "rgba(180,83,9,.06)", color: "#92400e",
                    boxShadow: "inset 0 0 0 1px rgba(180,83,9,.18)" }}>
          <b>Onboarding-Pflicht ausgesetzt.</b> {ausnahme.grund}
          {ausnahme.von ? ` (${ausnahme.von})` : ""}
        </p>
      )}

      <div className={dicht ? "mt-2.5" : "mt-3.5"}>
        <NaechsterSchritt text={naechsterSchritt} aktion={aktion} />
      </div>
    </div>
  );
}
