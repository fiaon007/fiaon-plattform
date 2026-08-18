// ═══════════════════════════════════════════════════════════════════════════
// DIE KERNBOTSCHAFT ALS ZWEIGETEILTE KARTE
//
// ── EIN BAUTEIL FÜR DREI STELLEN ───────────────────────────────────────────
// Sie erscheint in der Academy (Verwaltung), in der Academy (Team) und im
// Onboarding-Cockpit beim Schritt „Abo-Klarheit". Drei Fassungen desselben
// Satzes wären drei Sätze, die auseinanderlaufen — und bei einer Aussage über
// die SCHUFA wäre das kein Schönheitsfehler.
//
// Der Wortlaut kommt aus `shared/fiaon-academy.ts`, buchstabengetreu und von
// der Geschäftsführung freigegeben. Diese Datei formuliert NICHTS um.
//
// ── DIE ZWEI PFADE ─────────────────────────────────────────────────────────
// Links grün: pünktlich + Empfehlungen = Aufbau. Rechts rot: Nichtzahlung =
// Meldung. Auf 380 px stapeln sie sich — nebeneinander wären es zwei Spalten à
// 170 px, und dann liest man beide Pfade als einen.
//
// Rot ist hier ausdrücklich richtig: Es ist keine Mahnung an einen Mitarbeiter,
// sondern eine Konsequenz für den Kunden, die er kennen muss.
// ═══════════════════════════════════════════════════════════════════════════
import { KERNBOTSCHAFT, KERNBOTSCHAFT_PFADE, KERNBOTSCHAFT_FUSSNOTE }
  from "@shared/fiaon-academy";

export function KernbotschaftKarte({ dunkel = false, gross = false }: {
  /** Auf dunklem Grund (Academy-Bühne) oder auf hellem (Cockpit)? */
  dunkel?: boolean;
  /** Im Präsentationsmodus größer. */
  gross?: boolean;
}) {
  const rahmen = dunkel ? "rgba(255,255,255,.14)" : "rgba(15,23,42,.10)";
  const satzFarbe = dunkel ? "#eef2fb" : "#0f172a";
  const leise = dunkel ? "#9fb3d9" : "#64748b";

  return (
    <div data-fiaon="kernbotschaft" style={{
      borderRadius: 20, padding: gross ? "26px 24px" : "20px 18px",
      background: dunkel ? "rgba(255,255,255,.045)" : "#fff",
      boxShadow: `inset 0 0 0 1px ${rahmen}`,
    }}>
      {/* ── DER SATZ, GROSS UND UNVERÄNDERT ─────────────────────────────── */}
      <p style={{
        margin: 0, color: satzFarbe, fontWeight: 700, letterSpacing: "-.01em",
        fontSize: gross ? "clamp(18px,2.2vw,26px)" : "clamp(15px,2vw,19px)",
        lineHeight: 1.42,
      }}>
        {KERNBOTSCHAFT}
      </p>

      {/* ── DIE ZWEI PFADE ──────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gap: 12, marginTop: 18,
        // Ab 560 px nebeneinander. Darunter gestapelt — zwei Spalten à 170 px
        // liest man als einen Pfad.
        gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
      }}>
        {([
          ["aufbau", "#059669", "#8ff0c8", "rgba(5,150,105,.10)", "rgba(5,150,105,.28)"],
          ["meldung", "#b91c1c", "#ffc9c9", "rgba(185,28,28,.09)", "rgba(185,28,28,.26)"],
        ] as const).map(([welcher, ton, tonDunkel, grund, linie]) => {
          const pfad = KERNBOTSCHAFT_PFADE[welcher];
          return (
            <div key={welcher} style={{
              borderRadius: 15, padding: "14px 15px",
              background: grund, boxShadow: `inset 0 0 0 1px ${linie}`,
            }}>
              <p style={{
                margin: 0, fontWeight: 800, letterSpacing: "-.005em",
                fontSize: gross ? 16 : 13.5,
                color: dunkel ? tonDunkel : ton,
              }}>
                {pfad.titel}
              </p>
              <ul style={{ listStyle: "none", margin: "9px 0 0", padding: 0, display: "grid", gap: 6 }}>
                {pfad.punkte.map((pt, i) => (
                  <li key={i} style={{
                    fontSize: gross ? 14.5 : 12.5, lineHeight: 1.5,
                    color: dunkel ? tonDunkel : ton,
                    // Der letzte Punkt ist die FOLGE — er wird fett.
                    fontWeight: i === pfad.punkte.length - 1 ? 700 : 400,
                    paddingLeft: 14, position: "relative",
                  }}>
                    <span aria-hidden="true" style={{
                      position: "absolute", left: 0, top: gross ? 8 : 7,
                      width: 5, height: 5, borderRadius: 999,
                      background: dunkel ? tonDunkel : ton, opacity: .8,
                    }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── DIE FUSSNOTE, KLEIN ─────────────────────────────────────────── */}
      <p style={{ margin: "14px 0 0", fontSize: 11, color: leise }}>
        {KERNBOTSCHAFT_FUSSNOTE}
      </p>
    </div>
  );
}
