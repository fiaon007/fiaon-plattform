// ═══════════════════════════════════════════════════════════════════════════
// DIE SPERRKARTE — ein „noch nicht", das nach etwas aussieht
//
// ── DIE GESCHÄFTSREGEL ─────────────────────────────────────────────────────
// Nach der Zahlung kommt der Kunde herein, aber nicht überall hin: Fahrplan
// und Inhalte öffnen sich erst nach dem Startgespräch. Was er sofort sieht:
// den Termin buchen, seine Rechnungen und Zahlungsdaten, den Stand seiner
// Unterlagen und die Bonitätsauskunft samt Zahlweg.
//
// ── WARUM KEINE 404 UND KEIN VERSTECKEN ────────────────────────────────────
// Drei Wege wären möglich gewesen, zwei davon falsch:
//
//   Menüpunkt ausblenden  Der Kunde weiß nicht, dass es einen Fahrplan gibt.
//                         Er merkt es, wenn ein anderer ihn erwähnt — und
//                         fühlt sich übergangen.
//   404 / leere Seite     Sieht wie ein Fehler aus. Der Kunde schreibt dem
//                         Support, und der Support erklärt eine Absicht.
//   DIESE KARTE           Sagt, was fehlt, warum, und was der nächste
//                         Schritt ist — mit dem Knopf daneben.
//
// Eine Sperre, die ihren Grund nennt und den Ausweg zeigt, ist keine Sperre,
// sondern ein Wegweiser.
// ═══════════════════════════════════════════════════════════════════════════

/** Ein Schloss, selbst gezeichnet: 20×20, 1,5 px, currentColor (AGENTS.md). */
function ZeichenSchloss({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="4.2" y="8.6" width="11.6" height="7.4" rx="1.8" />
      <path d="M7 8.6V6.6a3 3 0 0 1 6 0v2" />
      <path d="M10 11.6v1.6" />
    </svg>
  );
}

export interface PortalSperreProps {
  /** Was gesperrt ist, in der Sprache des Kunden. */
  titel: string;
  /** Zwei bis drei Sätze: was es ist, warum es wartet. */
  text: string;
  /** Steht der Termin schon? Dann ist die Karte freundlicher. */
  termin?: { datumText: string; uhrzeit: string; agentVorname: string } | null;
  /** Der Knopf. Fehlt er, steht nur die Auskunft da. */
  aktion?: { text: string; onClick: () => void } | null;
}

export function PortalSperre({ titel, text, termin, aktion }: PortalSperreProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-white"
         style={{ borderColor: "rgba(15,23,42,.08)", boxShadow: "0 1px 3px rgba(15,23,42,.05)" }}>
      {/* Ein Hauch Tiefe, kein Farbklecks: dieselbe Sprache wie FiaonEbene. */}
      <div aria-hidden="true"
           style={{
             position: "absolute", inset: 0, pointerEvents: "none",
             background: "radial-gradient(120% 90% at 50% -20%, rgba(37,99,235,.07), transparent 62%)",
           }} />
      <div className="relative px-6 sm:px-10 py-10 sm:py-14 text-center">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
              style={{ background: "rgba(37,99,235,.08)", color: "#1d4ed8" }}>
          <ZeichenSchloss />
        </span>
        <h2 className="text-[19px] sm:text-[22px] font-bold tracking-[-.02em] text-slate-900">
          {titel}
        </h2>
        <p className="mt-2.5 mx-auto max-w-[42ch] text-[13.5px] leading-relaxed text-slate-500">
          {text}
        </p>

        {/* Haarlinie statt Balken. */}
        <div aria-hidden="true" className="mx-auto my-6"
             style={{
               height: 1, maxWidth: 220,
               background: "linear-gradient(90deg,transparent,rgba(15,23,42,.12),transparent)",
             }} />

        {termin ? (
          <p className="text-[13.5px] font-semibold text-slate-800">
            Dein Termin steht: {termin.datumText}, {termin.uhrzeit} Uhr
            <span className="block mt-1 text-[12.5px] font-normal text-slate-500">
              {termin.agentVorname} ruft dich an. Danach ist hier alles offen.
            </span>
          </p>
        ) : aktion ? (
          <button type="button" onClick={aktion.onClick}
                  className="inline-flex items-center justify-center px-6 rounded-xl text-[14.5px] font-bold text-white"
                  style={{ minHeight: 46, background: "#1d4ed8" }}>
            {aktion.text}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Der Banner für den Bestand — dezent, dauerhaft, nicht im Weg.
 *
 * GEMESSEN: 349 bezahlte Kunden ohne Startgespräch. Sie werden NICHT
 * ausgesperrt (siehe db/migrations/054_onboarding_pflicht.sql), sondern
 * eingeladen. Ein Banner, der bleibt, bis gebucht ist — und der nichts
 * verdeckt.
 */
export function StartgespraechBanner({ onBuchen }: { onBuchen: () => void }) {
  return (
    <div className="mb-5 rounded-2xl border px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2"
         style={{ borderColor: "rgba(37,99,235,.22)", background: "rgba(37,99,235,.045)" }}>
      <span className="shrink-0" style={{ color: "#1d4ed8" }}><ZeichenSchloss size={18} /></span>
      <p className="flex-1 min-w-[220px] text-[13px] leading-snug text-slate-700">
        <b className="font-bold text-slate-900">Dein Startgespräch fehlt noch.</b>{" "}
        Fünfzehn Minuten mit einem Menschen: Wir gehen deinen Fahrplan durch und
        klären, welche Unterlagen noch fehlen.
      </p>
      <button type="button" onClick={onBuchen}
              className="shrink-0 px-4 rounded-xl text-[13px] font-bold text-white"
              style={{ minHeight: 38, background: "#1d4ed8" }}>
        Termin wählen
      </button>
    </div>
  );
}
