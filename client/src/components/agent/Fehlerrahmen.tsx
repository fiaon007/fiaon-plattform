// ═══════════════════════════════════════════════════════════════════════════
// DER FEHLERRAHMEN — STATT EINER WEISSEN FLÄCHE EINE KARTE MIT GRUND
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Im Bereich ‚Vertriebsleitung' kann ich bei den Kunden die Kundenakte nicht
// öffnen. Wenn ich eine Kundenakte anklicke, öffnet sich lediglich ein weißes
// Fenster. Die eigentliche Kundenakte wird nicht geladen."
//
// ── WAS AM BILDSCHIRM PASSIERT (Browser-Nachstellung, 19.08.2026) ──────────
// `scripts/schau-neun-punkte.ts` hat es aufgenommen: eine hellgraue Fläche mit
// einem blassen Ring in der Mitte, sechs Sekunden lang, ohne ein Wort. Zwei
// Stellen erzeugen das:
//
//   1. `AgentShell` zeigt diesen Ring, solange `onboardingComplete === null`
//      ist — ohne Zeitgrenze und ohne Fehlerweg.
//   2. Die Akten-Schublade in `vertrieb.tsx` rendert bei `daten.laedt || !p`
//      eine leere Karte mit einem Skelettbalken. Antwortet die Route mit
//      `ok: true`, aber ohne `person`, bleibt genau diese leere Karte STEHEN —
//      für immer, ohne Meldung und ohne Ausweg.
//
// ── WARUM EIN RAHMEN UND NICHT DREI REPARATUREN ───────────────────────────
// Beide Fälle oben sind behoben. Aber „weiße Fläche" ist eine FEHLERKLASSE,
// nicht ein Fehler: Ein Haken hinter einem `return`, ein `.map` auf `undefined`,
// ein Feld, das der Server umbenennt. Der nächste Fall dieser Klasse kommt, und
// er soll dann eine Karte zeigen und nicht Weiß.
//
// ── WARUM NICHT `components/ErrorBoundary.tsx` ─────────────────────────────
// Die gibt es, sie sitzt in `main.tsx` um die GANZE Anwendung und ist dort
// richtig. Sie ersetzt aber die ganze Seite, und sie zeichnet mit
// `lucide-react` — beides passt hier nicht: Eine kaputte Schublade darf nicht
// die Kundenliste dahinter mitnehmen, und AGENTS.md verbietet
// Icon-Bibliotheken. Dies ist ein ÖRTLICHER Rahmen um ein Bauteil, keine
// zweite Fassung derselben Wand.
// ═══════════════════════════════════════════════════════════════════════════
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Was hier kaputtgegangen ist — steht in der Karte („Die Kundenakte"). */
  was?: string;
  /** Wird beim Klick auf „Schließen" gerufen. Fehlt er, wird neu geladen. */
  onSchliessen?: () => void;
  // ══════════════════════════════════════════════════════════════════════════
  // DER NOTWEG (20.08.2026)
  //
  // Am 20.08. hat ein Haken-Fehler die Kundenakte für ALLE Kunden zerstört. Der
  // Rahmen zeigte den Grund — aber das Team kam an die Kundendaten nicht mehr
  // heran. Ein Renderfehler in EINER Ansicht darf nicht den Zugriff auf die
  // Daten kosten.
  //
  // `notweg` ist die Kerndaten-Ansicht ohne die kaputte Darstellung: Name,
  // Nummer, E-Mail, Referenz, Stand. Kein Ersatz für die Akte, aber genug, um
  // weiterzuarbeiten und zu telefonieren.
  // ══════════════════════════════════════════════════════════════════════════
  /** Die Kerndaten, die auch ohne die Ansicht lesbar bleiben müssen. */
  notweg?: { titel: string; zeilen: { feld: string; wert: string | null }[] } | null;
  /** Welche Ansicht genau gescheitert ist („Reiter Lage", „Schublade"). */
  ansicht?: string;
}

interface Stand {
  fehler: Error | null;
  /** Zeigt der Rahmen gerade die Kerndaten statt der Fehlermeldung? */
  listeOffen: boolean;
}

export class Fehlerrahmen extends Component<Props, Stand> {
  constructor(props: Props) {
    super(props);
    this.state = { fehler: null, listeOffen: false };
  }

  static getDerivedStateFromError(fehler: Error): Partial<Stand> {
    return { fehler };
  }

  componentDidCatch(fehler: Error, info: ErrorInfo): void {
    // Der Grund gehört ins Log, auch wenn die Karte ihn kürzt: Der nächste
    // Leser soll nicht dieselbe Suche machen müssen (AGENTS.md).
    console.error(`[FEHLERRAHMEN] ${this.props.was ?? "Bauteil"} ist beim Zeichnen gescheitert:`, fehler);
    console.error("[FEHLERRAHMEN] Komponenten-Pfad:", info.componentStack);
  }

  render(): ReactNode {
    const { fehler, listeOffen } = this.state;
    if (!fehler) return this.props.children;
    const was = this.props.was ?? "Dieser Bereich";
    const { notweg, ansicht } = this.props;
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4"
           style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(6px)" }}
           role="alertdialog" aria-label={`${was} konnte nicht geladen werden`}
           data-fiaon="fehlerrahmen">
        <div className="fi-karte p-5 w-full" style={{ maxWidth: 460 }}>
          <p className="text-[15px] font-bold" style={{ color: "var(--fi-text)" }}>
            {was} konnte nicht geladen werden.
          </p>
          {/* WELCHE Ansicht — nicht nur „irgendwas". Beim Notfall am 20.08.
              stand nur „Die Kundenakte", und niemand wusste, ob es die
              Schublade, ein Reiter oder die Liste war. */}
          {ansicht && (
            <p className="text-[11.5px] mt-0.5" data-fiaon="fehlerrahmen-ansicht"
               style={{ color: "var(--fi-text-still)" }}>
              Gescheitert ist: {ansicht}
            </p>
          )}
          {/* Der GRUND steht da. „Etwas ist schiefgelaufen" schickt jeden auf
              dieselbe falsche Suche — und der Betreiber kann ihn weitergeben. */}
          <p className="text-[12.5px] mt-2 px-2.5 py-2 rounded-lg leading-relaxed"
             data-fiaon="fehlerrahmen-grund"
             style={{ background: "var(--fi-seite)", color: "#b91c1c" }}>
            {fehler.message || "Kein Grund gemeldet."}
          </p>
          <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
            Die Daten sind nicht verloren — nur diese Ansicht ist gescheitert.
            Bitte den Satz oben weitergeben, wenn es wieder vorkommt.
          </p>
          {/* ── DIE KERNDATEN, WENN SIE ANGEFORDERT WERDEN ─────────────── */}
          {listeOffen && notweg && (
            <div className="mt-3 rounded-xl overflow-hidden" data-fiaon="fehlerrahmen-notweg"
                 style={{ border: "1px solid var(--fi-linie)" }}>
              <p className="px-3 py-2 text-[12px] font-bold"
                 style={{ background: "var(--fi-seite)", color: "var(--fi-text)" }}>
                {notweg.titel}
              </p>
              {notweg.zeilen.map((z) => (
                <div key={z.feld} className="flex gap-3 px-3 py-1.5"
                     style={{ borderTop: "1px solid var(--fi-linie)" }}>
                  <span className="text-[11.5px] shrink-0" style={{ color: "var(--fi-text-still)", width: 92 }}>
                    {z.feld}
                  </span>
                  <span className="text-[12.5px]" style={{ color: "var(--fi-text)", overflowWrap: "anywhere" }}>
                    {z.wert || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {/* Der Notweg zuerst: Er ist das, was die Arbeit weitergehen lässt. */}
            {notweg && !listeOffen && (
              <button type="button" data-fiaon="fehlerrahmen-notweg-knopf"
                      onClick={() => this.setState({ listeOffen: true })}
                      className="fi-primaerknopf px-3 py-2.5 text-[13px] font-bold text-white">
                Als Liste öffnen
              </button>
            )}
            <button type="button" onClick={() => window.location.reload()}
                    className={notweg && !listeOffen
                      ? "fi-zweitknopf px-3 py-2.5 text-[13px] font-semibold"
                      : "fi-primaerknopf px-3 py-2.5 text-[13px] font-bold text-white"}>
              Neu laden
            </button>
            <button type="button"
                    onClick={() => {
                      this.setState({ fehler: null });
                      this.props.onSchliessen?.();
                    }}
                    className="fi-zweitknopf px-3 py-2.5 text-[13px] font-semibold">
              Schließen
            </button>
          </div>
        </div>
      </div>
    );
  }
}
