// ═══════════════════════════════════════════════════════════════════════════
// PaketAufstieg — der Moment nach der Freigabe (22.09.2026, E-210)
//
// Justin: „am Ende auch sowas vorstellen wie: ‚Sie wurden auch für folgendes
// Paket akzeptiert‘ — und dann schlagen wir alle Pakete perfekt vor."
//
// Hier steht der Mensch auf dem höchsten Punkt des Antrags: Die Prüfung ist
// durch, die Zahl steht groß auf dem Bildschirm. Genau jetzt zeigt diese
// Fläche, was daneben noch offen steht — nicht als Verkaufsdruck, sondern als
// Tür, die schon aufgeht: gleiche Angaben, gleicher Antrag, ein Klick.
//
// Bewusst NUR nach oben: Wer Pro gewählt hat, sieht Ultra und High End. Ein
// Rückwärtsgang wäre hier nur ein Anlass, kleiner zu denken.
//
// Wortregeln: keine Empfehlung („empfehlen" ist ein verbotenes Wort), keine
// Zusage der Bank. Freigegeben ist das FIAON-Programm — dieselbe Sprache wie
// „Genehmigt mit …" eine Zeile darüber.
// ═══════════════════════════════════════════════════════════════════════════

export interface AufstiegPaket {
  key: string; name: string; sub: string; fee: number; lim: number;
  bg: string; feats: readonly string[] | string[];
}

const eur = (n: number) => `${n.toLocaleString("de-DE")} €`;
const euroFein = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export function PaketAufstieg({
  pakete, aktuell, onWechsel, gewechseltZu,
}: {
  pakete: readonly AufstiegPaket[];
  aktuell: AufstiegPaket;
  onWechsel: (p: AufstiegPaket) => void;
  /** Auf dieses Paket wurde gerade gewechselt — für die Bestätigung. */
  gewechseltZu?: string | null;
}) {
  const hoeher = pakete.filter((p) => p.lim > aktuell.lim);
  if (hoeher.length === 0) {
    return (
      <div className="max-w-xl mx-auto mb-10 px-4">
        <p className="text-[13px] text-gray-400">
          Sie sind im größten Paket freigegeben — mehr geht bei FIAON nicht.
        </p>
      </div>
    );
  }

  return (
    <section className="max-w-5xl mx-auto mb-12 px-4 text-left" aria-label="Weitere freigegebene Pakete">
      <div className="text-center mb-7">
        <span className="inline-block text-[10.5px] font-semibold tracking-[.18em] uppercase text-[#2563eb] mb-3">
          Ebenfalls freigegeben
        </span>
        <h3 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-gray-900 leading-tight">
          Ihre Prüfung reicht über {aktuell.name} hinaus.
        </h3>
        <p className="text-[14px] text-gray-500 mt-2 max-w-xl mx-auto leading-relaxed">
          Diese Pakete sind für Sie ebenfalls freigegeben. Ein Klick genügt — Ihre Angaben bleiben, der Antrag läuft
          einfach im größeren Rahmen weiter.
        </p>
      </div>

      <div className={`grid gap-4 ${hoeher.length === 1 ? "max-w-md mx-auto" : hoeher.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {hoeher.map((p, i) => {
          const hoechstes = i === hoeher.length - 1;
          const mehrLimit = p.lim - aktuell.lim;
          const mehrGebuehr = p.fee - aktuell.fee;
          const gerade = gewechseltZu === p.key;
          return (
            <article
              key={p.key}
              className={`relative rounded-3xl border p-5 sm:p-6 flex flex-col transition-all duration-300 ${
                hoechstes
                  ? "fiaon-glass-panel border-[#2563eb]/25 shadow-[0_18px_50px_-24px_rgba(37,99,235,.55)]"
                  : "bg-white border-slate-200 hover:border-[#2563eb]/40 hover:shadow-[0_14px_40px_-26px_rgba(15,23,42,.45)]"
              }`}
              style={{ animation: `fadeInUp .5s ease ${0.08 * i + 0.1}s both` }}
            >
              {hoechstes && (
                <span
                  className="absolute -top-2.5 left-5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide text-white"
                  style={{ background: "linear-gradient(135deg,#1e40af,#2563eb)" }}
                >
                  Größter Sprung
                </span>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-gray-900 leading-snug">{p.name}</p>
                  <p className="text-[12px] text-gray-400">{p.sub}</p>
                </div>
                <span
                  className="w-10 h-7 rounded-md shrink-0 shadow-inner"
                  style={{ background: p.bg }}
                  aria-hidden="true"
                />
              </div>

              <p className="mt-4 text-[34px] sm:text-[38px] font-bold tracking-tight leading-none fiaon-gradient-text-animated">
                {eur(p.lim)}
              </p>
              <p className="text-[12px] text-gray-500 mt-1.5">
                <b className="text-[#2563eb]">+{eur(mehrLimit)}</b> gegenüber {aktuell.name}
              </p>

              <ul className="mt-4 space-y-1.5 flex-1">
                {p.feats.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-gray-600 leading-snug">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" className="mt-[3px] shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[12px] text-gray-500">
                {euroFein(p.fee)} monatlich · <span className="text-gray-400">{mehrGebuehr > 0 ? `${euroFein(mehrGebuehr)} mehr als jetzt` : "gleicher Beitrag"}</span>
              </p>

              <button
                type="button"
                onClick={() => onWechsel(p)}
                disabled={gerade}
                className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full py-3 px-4 text-[13.5px] font-medium transition-all duration-300 disabled:opacity-100 ${
                  hoechstes
                    ? "fiaon-btn-gradient text-white shadow-lg shadow-blue-500/25 hover:-translate-y-0.5"
                    : "border border-slate-300 text-gray-700 hover:border-[#2563eb] hover:text-[#2563eb]"
                }`}
                style={{ minHeight: 44 }}
              >
                {gerade ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Gewählt</span>
                  </>
                ) : (
                  <>
                    <span>Auf {p.name} wechseln</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>

      <p className="text-center text-[11.5px] text-gray-400 mt-5">
        Sie bleiben in Ihrem Antrag — nichts wird neu geprüft, nichts geht verloren.
      </p>
    </section>
  );
}

export default PaketAufstieg;
