// ═══════════════════════════════════════════════════════════════════════════
// DIE SCHAUBILDER DER ACADEMY — SELBST GEZEICHNET
//
// ── WARUM SELBST GEZEICHNET UND KEINE ICON-BIBLIOTHEK ─────────────────────
// AGENTS.md: „Keine Emojis, keine Icon-Bibliotheken. Ordnung entsteht durch
// Ziffern, Haarlinien und Weißraum." Ein Pfeil aus einer Bibliothek sieht in
// jedem zweiten Produkt gleich aus — und ein Trichter aus drei Lucide-Icons
// wäre ein Trichter aus drei Icons, kein Trichter.
//
// Drei Bilder, je eines pro Reise:
//   · DER KUNDENWEG als Fluss — Vertrieb (und der einzige Ort, an dem der
//     ganze Ablauf auf einmal zu sehen ist)
//   · DIE STUFEN A/B/C als Trichter — Vertrieb/Onboarding
//   · DER ABO-ZYKLUS als Kreis mit Jahrestag — Forderungsmanagement
//
// ── DER AUFBAU IST DIE ERKLÄRUNG ──────────────────────────────────────────
// Die Teile erscheinen NACHEINANDER, in der Reihenfolge des Ablaufs. Ein Bild,
// das fertig da ist, wird überflogen; ein Bild, das sich aufbaut, wird gelesen.
// Deshalb `stroke-dashoffset` auf den Verbindungslinien: Der Fluss FLIESST.
//
// `prefers-reduced-motion`: alles statisch, aber VOLLSTÄNDIG sichtbar. Wer den
// Eintritt über `opacity: 0` baut und nur die Animation abschaltet, zeigt eine
// leere Fläche — das ist der häufigste Fehler dabei.
//
// ── ZAHLEN STATT BEHAUPTUNGEN ─────────────────────────────────────────────
// Wo eine Messung existiert, steht sie im Bild: 120 Termine aus Terminlinks,
// 336 bezahlte Kunden ohne Termin. Ein Schaubild ohne Zahlen ist eine
// Behauptung mit Kästchen.
// ═══════════════════════════════════════════════════════════════════════════

/** Läuft der Nutzer mit abgeschalteter Bewegung? */
function ruhig(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Die gemeinsame Stilbasis — Haarlinien, keine Füllflächen ohne Grund. */
const STRICH = 1.5;

interface BildProps {
  /** Die Akzentfarbe der Reise. */
  ton: string;
  /** Auf dunklem Grund (Academy) — hier immer, aber ausdrücklich. */
  hell?: string;
  leise?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DER KUNDENWEG — ALS FLUSS
// ═══════════════════════════════════════════════════════════════════════════
//
// Antrag → Zahlung → Gate → Gespräch → Freischaltung → Abo → (ggf.) Inkasso
//
// Waagerecht auf Desktop, senkrecht auf 380 px. Der Abzweig ins
// Forderungsmanagement geht nach UNTEN weg — er ist der Ausnahmefall, nicht die
// Fortsetzung. Das sagt die Form, bevor jemand den Text liest.
export function SchaubildKundenweg({ ton, hell = "#eef2fb", leise = "#9fb3d9" }: BildProps) {
  const ruhe = ruhig();
  const stationen = [
    { x: 60, label: "Antrag", unter: "Formular" },
    { x: 190, label: "Zahlung", unter: "gemeldet · verbucht" },
    { x: 320, label: "Gate", unter: "Konto wartet" },
    { x: 450, label: "Gespräch", unter: "15 Minuten" },
    { x: 580, label: "Frei", unter: "Fahrplan offen" },
    { x: 710, label: "Abo", unter: "monatlich" },
  ];

  return (
    <figure data-fiaon="schaubild-kundenweg" style={{ margin: 0 }}>
      {/* ── DIE EBENEN, NACH EINEM SCREENSHOT NEU GEORDNET ────────────────
          Erster Entwurf: „336 warten hier" bei y=146 und „Rate offen →
          Forderungsmanagement" bei y=154 — sie ÜBERLAPPTEN sich. Im Quelltext
          sah beides plausibel aus; erst der Screenshot zeigte den Salat.

          Jetzt vier klar getrennte Ebenen:
            y  20– 46   Untertitel der Stationen
            y  56– 96   Stationen und der Fluss
            y 108–150   die Gate-Marke (336 warten)
            y 176–214   der Abzweig ins Forderungsmanagement
          Die 120er-Zahl steht ÜBER dem Gespräch, nicht darunter — dort ist
          Platz, und sie gehört zum Gespräch, nicht zum Abzweig. */}
      <svg viewBox="0 0 780 236" role="img" style={{ width: "100%", height: "auto", display: "block" }}
           aria-label="Der Kundenweg: Antrag, Zahlung, Gate, Gespräch, Freischaltung, Abo — und der Abzweig ins Forderungsmanagement bei offenen Raten.">
        <title>Der Kundenweg</title>

        {/* ── DER FLUSS ─────────────────────────────────────────────────────
            Eine durchgehende Linie, die sich aufbaut. Sie liegt UNTER den
            Stationen (zuerst gezeichnet), damit die Kreise sie überdecken. */}
        <path d="M60 96 H710" stroke={ton} strokeWidth={STRICH * 1.6}
              strokeLinecap="round" fill="none"
              style={ruhe ? undefined : {
                strokeDasharray: 700, strokeDashoffset: 700,
                animation: "fiFluss 1.5s cubic-bezier(.22,1,.36,1) .1s forwards",
              }} />

        {/* ── DER ABZWEIG INS FORDERUNGSMANAGEMENT ────────────────────────
            Nach UNTEN, gestrichelt: der Ausnahmefall. Eine durchgehende Linie
            würde ihn zur Fortsetzung machen. */}
        <path d="M710 96 Q710 190 640 190 H470" stroke="#9d8cff" strokeWidth={STRICH}
              strokeDasharray="5 5" fill="none" strokeLinecap="round"
              style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 1.5s forwards" }} />
        <text x="462" y="186" textAnchor="end" fill="#c3b8ff" fontSize="11" fontWeight="700"
              style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 1.7s forwards" }}>
          Rate offen
        </text>
        <text x="462" y="201" textAnchor="end" fill="#c3b8ff" fontSize="10"
              style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 1.7s forwards" }}>
          → Forderungsmanagement
        </text>

        {/* ── DIE STATIONEN ───────────────────────────────────────────────── */}
        {stationen.map((s, i) => (
          <g key={s.label}
             style={ruhe ? undefined : {
               opacity: 0,
               animation: `fiZeig .4s ${0.25 + i * 0.16}s forwards`,
             }}>
            <circle cx={s.x} cy={96} r={13} fill="#0A1A3C" stroke={ton} strokeWidth={STRICH} />
            <text x={s.x} y={101} textAnchor="middle" fill={hell} fontSize="12" fontWeight="800">
              {i + 1}
            </text>
            <text x={s.x} y={70} textAnchor="middle" fill={hell} fontSize="13" fontWeight="700">
              {s.label}
            </text>
            <text x={s.x} y={50} textAnchor="middle" fill={leise} fontSize="10.5">
              {s.unter}
            </text>
          </g>
        ))}

        {/* ── DIE GEMESSENE ZAHL AM GATE ──────────────────────────────────
            336 bezahlte Kunden ohne Termin — genau hier bleiben sie hängen. */}
        <g style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 1.9s forwards" }}>
          <path d="M320 109 V126" stroke="#d97706" strokeWidth={STRICH} strokeDasharray="3 3" />
          <text x="320" y="141" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">
            336 warten hier
          </text>
          <text x="320" y="155" textAnchor="middle" fill="#fbbf24" fontSize="9.5">
            bezahlt, ohne Termin
          </text>
        </g>

        {/* ── UND DER HEBEL AM GESPRÄCH ─────────────────────────────────── */}
        <g style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 2.1s forwards" }}>
          {/* ── NACH OBEN, NICHT NACH UNTEN ────────────────────────────
              Unten lag sie im Weg des Abzweigs. Und sie gehört zum GESPRÄCH,
              nicht zum Forderungsmanagement — oben steht sie direkt darüber. */}
          <path d="M450 83 V30" stroke="#059669" strokeWidth={STRICH} strokeDasharray="3 3" />
          <text x="450" y="22" textAnchor="middle" fill="#8ff0c8" fontSize="11" fontWeight="700">
            120 von 120 Terminen kamen aus einem verschickten Link
          </text>
        </g>
      </svg>
      <figcaption style={{ color: leise, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Der ganze Weg auf einmal. Der Abzweig nach unten ist der Ausnahmefall —
        eine durchgehende Linie würde ihn zur Fortsetzung machen.
      </figcaption>
    </figure>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. DIE STUFEN A/B/C — ALS TRICHTER
// ═══════════════════════════════════════════════════════════════════════════
//
// A oben (Zahlung gemeldet, prüfen), B in der Mitte (Antrag fertig, hier liegt
// das Geld), C unten (Lead ohne Antrag). Die BREITE zeigt die Menge, die
// Reihenfolge die Dringlichkeit — beides ohne ein Wort.
export function SchaubildStufen({ ton, hell = "#eef2fb", leise = "#9fb3d9" }: BildProps) {
  const ruhe = ruhig();
  const stufen = [
    { key: "A", titel: "Zahlung gemeldet", was: "prüfen — hier ist Geld unterwegs",
      breite: 620, ton: "#dc2626", hell: "#fecaca" },
    { key: "B", titel: "Antrag fertig, Rechnung offen", was: "hier LIEGT das Geld",
      breite: 470, ton: "#d97706", hell: "#fbbf24" },
    { key: "C", titel: "Lead ohne Antrag", was: "erst wenn A und B leer sind",
      breite: 320, ton: "#64748b", hell: "#cbd5e1" },
  ];

  return (
    <figure data-fiaon="schaubild-stufen" style={{ margin: 0 }}>
      <svg viewBox="0 0 700 230" role="img" style={{ width: "100%", height: "auto", display: "block" }}
           aria-label="Die drei Stufen als Trichter: A Zahlung gemeldet, B Antrag fertig mit offener Rechnung, C Lead ohne Antrag. Von oben nach unten abarbeiten.">
        <title>Die Stufen A, B und C</title>

        {stufen.map((s, i) => {
          const y = 20 + i * 68;
          const x = (700 - s.breite) / 2;
          return (
            <g key={s.key}
               style={ruhe ? undefined : {
                 opacity: 0, animation: `fiRutschEin .5s cubic-bezier(.22,1,.36,1) ${i * 0.18}s forwards`,
               }}>
              {/* Der Balken — Breite = Menge. Abgerundet, weil ein Trichter
                  kein Diagramm ist. */}
              <rect x={x} y={y} width={s.breite} height={48} rx={14}
                    fill={`${s.ton}1f`} stroke={s.ton} strokeWidth={STRICH} />
              {/* Der Buchstabe, groß — er ist die Beschriftung im Portal. */}
              <text x={x + 26} y={y + 32} textAnchor="middle" fill={s.hell}
                    fontSize="21" fontWeight="800">
                {s.key}
              </text>
              <text x={x + 50} y={y + 22} fill={hell} fontSize="13" fontWeight="700">
                {s.titel}
              </text>
              <text x={x + 50} y={y + 38} fill={leise} fontSize="10.5">
                {s.was}
              </text>
              {/* Der Pfeil zur nächsten Stufe — nur zwischen den Balken. */}
              {i < stufen.length - 1 && (
                <path d={`M350 ${y + 50} V${y + 66}`} stroke={ton} strokeWidth={STRICH}
                      strokeLinecap="round" markerEnd="url(#fiPfeil)" />
              )}
            </g>
          );
        })}

        <defs>
          <marker id="fiPfeil" viewBox="0 0 8 8" refX="4" refY="4"
                  markerWidth="5" markerHeight="5" orient="auto">
            <path d="M1 1 L7 4 L1 7 z" fill={ton} />
          </marker>
        </defs>

        <text x="350" y="222" textAnchor="middle" fill={leise} fontSize="11">
          Von oben nach unten. Wer C zuerst anruft, arbeitet an der falschen Stelle.
        </text>
      </svg>
      <figcaption style={{ color: leise, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Die Breite zeigt die Menge, die Reihenfolge die Dringlichkeit. Ohne
        Rangfolge ruft jeder die an, die er kennt.
      </figcaption>
    </figure>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DER ABO-ZYKLUS — ALS KREIS MIT JAHRESTAG
// ═══════════════════════════════════════════════════════════════════════════
//
// Der Kreis ist hier kein Schmuck: Ein Abo hat keinen Anfang und kein Ende, es
// hat einen JAHRESTAG. Eine Zeitleiste würde ein Ende suggerieren.
//
// Die Marke oben ist der Jahrestag der ersten Zahlung. Rechts T+1 (überfällig),
// unten die Mahnstufen, links die Rückkehr.
export function SchaubildAboZyklus({ ton, hell = "#eef2fb", leise = "#9fb3d9" }: BildProps) {
  const ruhe = ruhig();
  // ── DIE BREITE KAM AUS EINEM SCREENSHOT (29.08.2026) ──────────────────
  // Erster Entwurf: viewBox 420 breit, Mittelpunkt bei 130. Die Beschriftungen
  // LINKS vom Kreis (textAnchor="end") endeten bei x=12 und liefen über den
  // Rand hinaus: Aus „Zahlung / oder Sperre" wurde „ung / erre", aus
  // „Mahnstufen" wurde „ahnstufen". Rechts war „Gesperrt ≠ verloren"
  // abgeschnitten.
  //
  // Im Quelltext war das nicht zu sehen — SVG schneidet stillschweigend ab.
  // Jetzt: Mittelpunkt bei 215 (links 97 px Platz für die längste
  // Beschriftung) und viewBox 620 breit für die Anmerkung rechts.
  // ── X UND Y GETRENNT (dritter Screenshot-Fund) ─────────────────────────
  // Ein Wert für beide Achsen (M = 215) schob den Kreis nach UNTEN aus dem
  // viewBox: cy 215 + R 88 = 303, das Feld ist 290 hoch. „T+1 / überfällig" und
  // „Mahnstufen / 1·2·3" waren abgeschnitten, und die Bildunterschrift lag im
  // Kreis.
  //
  // Drei Screenshots für ein Schaubild — und jeder zeigte einen Fehler, den der
  // Quelltext nicht verrät. SVG schneidet stillschweigend ab.
  const MX = 215;           // Mittelpunkt waagerecht
  const MY = 132;           // Mittelpunkt senkrecht
  const R = 88;             // Radius
  /** Winkel → Punkt auf dem Kreis. 0° ist oben (Jahrestag). */
  const punkt = (grad: number, r = R) => {
    const b = ((grad - 90) * Math.PI) / 180;
    return { x: MX + r * Math.cos(b), y: MY + r * Math.sin(b) };
  };

  const marken = [
    { grad: 0, label: "Jahrestag", unter: "Rate entsteht", farbe: ton },
    { grad: 72, label: "Rechnung", unter: "automatisch", farbe: ton },
    { grad: 144, label: "T+1", unter: "überfällig", farbe: "#d97706" },
    { grad: 216, label: "Mahnstufen", unter: "1 · 2 · 3", farbe: "#b91c1c" },
    { grad: 288, label: "Zahlung", unter: "oder Sperre", farbe: "#059669" },
  ];

  return (
    <figure data-fiaon="schaubild-abo" style={{ margin: 0 }}>
      <svg viewBox="0 0 620 292" role="img" style={{ width: "100%", height: "auto", display: "block" }}
           aria-label="Der Abo-Zyklus als Kreis: Jahrestag, Rechnung, T plus 1 überfällig, Mahnstufen, Zahlung oder Sperre — und wieder zum Jahrestag.">
        <title>Der Abo-Zyklus</title>

        {/* Der Kreis — er zeichnet sich. Ein Abo hat keinen Anfang. */}
        <circle cx={MX} cy={MY} r={R} fill="none" stroke={ton} strokeWidth={STRICH * 1.4}
                strokeLinecap="round"
                style={ruhe ? undefined : {
                  strokeDasharray: 2 * Math.PI * R,
                  strokeDashoffset: 2 * Math.PI * R,
                  // Von oben startend im Uhrzeigersinn — deshalb die Drehung.
                  transform: "rotate(-90deg)", transformOrigin: `${MX}px ${MY}px`,
                  animation: "fiKreis 1.6s cubic-bezier(.22,1,.36,1) .1s forwards",
                }} />

        {marken.map((m, i) => {
          const p = punkt(m.grad);
          const t = punkt(m.grad, R + 30);
          const linksVomKreis = t.x < MX - 6;
          const mittig = Math.abs(t.x - MX) <= 6;
          return (
            <g key={m.label}
               style={ruhe ? undefined : {
                 opacity: 0, animation: `fiZeig .4s ${0.6 + i * 0.14}s forwards`,
               }}>
              <circle cx={p.x} cy={p.y} r={7} fill="#0A1A3C" stroke={m.farbe} strokeWidth={STRICH} />
              <text x={t.x} y={t.y} fill={hell} fontSize="12" fontWeight="700"
                    textAnchor={mittig ? "middle" : linksVomKreis ? "end" : "start"}>
                {m.label}
              </text>
              <text x={t.x} y={t.y + 14} fill={leise} fontSize="10"
                    textAnchor={mittig ? "middle" : linksVomKreis ? "end" : "start"}>
                {m.unter}
              </text>
            </g>
          );
        })}

        {/* ── DIE MITTE SAGT, WORUM ES GEHT ──────────────────────────────── */}
        <g style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 1.4s forwards" }}>
          <text x={MX} y={MY - 6} textAnchor="middle" fill={hell} fontSize="14" fontWeight="800">
            Ein Abo
          </text>
          <text x={MX} y={MY + 12} textAnchor="middle" fill={leise} fontSize="10.5">
            hat kein Ende,
          </text>
          <text x={MX} y={MY + 26} textAnchor="middle" fill={leise} fontSize="10.5">
            nur einen Jahrestag
          </text>
        </g>

        {/* ── DIE SPERRE IST KEIN AUSSTIEG ───────────────────────────────
            Ein gesperrter Kunde zahlt in einem Drittel der Fälle Monate später.
            Deshalb führt der Pfeil zurück in den Kreis, nicht heraus. */}
        <g style={ruhe ? undefined : { opacity: 0, animation: "fiZeig .5s 1.6s forwards" }}>
          {/* Von der „Zahlung oder Sperre"-Marke nach rechts. Die Linie
              führt ZURÜCK zum Kreis, nicht heraus: Ein gesperrter Kunde zahlt
              in einem Drittel der Fälle Monate später. */}
          <path d="M330 216 H452" stroke="#059669" strokeWidth={STRICH}
                strokeDasharray="4 4" fill="none" strokeLinecap="round" />
          <text x="462" y="206" fill="#8ff0c8" fontSize="11.5" fontWeight="700">
            Gesperrt ≠ verloren
          </text>
          <text x="462" y="222" fill="#8ff0c8" fontSize="10">
            eine Zahlung reaktiviert
          </text>
          <text x="462" y="236" fill="#8ff0c8" fontSize="10">
            das Konto
          </text>
        </g>
      </svg>
      <figcaption style={{ color: leise, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Ein Kreis, keine Zeitleiste: Eine Leiste hätte ein Ende, ein Abo hat nur
        einen Jahrestag.
      </figcaption>
    </figure>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZUORDNUNG: WELCHES BILD IN WELCHEM KAPITEL?
// ═══════════════════════════════════════════════════════════════════════════
//
// Über den Kapitel-Schlüssel, nicht über die Position: Ein eingeschobenes
// Kapitel würde sonst das Bild verschieben.
const ZUORDNUNG: Record<string, "kundenweg" | "stufen" | "abo"> = {
  // Vertrieb
  "lead-entsteht": "kundenweg",
  "stufen-abc": "stufen",
  // Onboarding
  "zahlung-da": "kundenweg",
  "erst-login": "stufen",
  // Forderungsmanagement
  "abo-zyklus": "abo",
  "mahnstufen": "abo",
};

export function SchaubildFuerKapitel({ kapitelKey, ton }: { kapitelKey: string; ton: string }) {
  const welches = ZUORDNUNG[kapitelKey];
  if (!welches) return null;
  return (
    <div style={{ marginTop: 22, maxWidth: 780 }}>
      {welches === "kundenweg" && <SchaubildKundenweg ton={ton} />}
      {welches === "stufen" && <SchaubildStufen ton={ton} />}
      {welches === "abo" && <SchaubildAboZyklus ton={ton} />}
      {/* ── DIE ANIMATIONEN ────────────────────────────────────────────────
          Sie stehen hier, weil sie zu den Bildern gehören — und nur einmal im
          Dokument, egal wie viele Bilder erscheinen (gleiche Namen, gleiche
          Regeln).

          reduced-motion: Alles statisch UND sichtbar. Wer den Eintritt über
          `opacity: 0` baut und nur die Animation abschaltet, zeigt eine leere
          Fläche — der häufigste Fehler dabei. Deshalb `opacity: 1 !important`. */}
      <style>{`
        @keyframes fiFluss { to { stroke-dashoffset: 0; } }
        @keyframes fiKreis { to { stroke-dashoffset: 0; } }
        @keyframes fiZeig  { to { opacity: 1; } }
        @keyframes fiRutschEin {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-fiaon^="schaubild-"] * {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
