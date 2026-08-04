import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Share2, Image as BildIcon } from "lucide-react";
import { ACCENT } from "./AdminShell";

// ═══════════════════════════════════════════════════════════════════════════
// Rangliste als Bild — für die Vertriebsgruppe
//
// Zweck: ein Bild, das man in WhatsApp schickt und das Lust auf den nächsten
// Abschluss macht. Deshalb drei Entscheidungen:
//
//  1. ABSCHLÜSSE statt Euro. Provisionen sind Gehalt; Gehalt gehört nicht in
//     eine Gruppe von Kollegen. Die Zahl der Abschlüsse ist der sportliche
//     Vergleich, den jeder sofort versteht.
//  2. Hochformat 1080×1350. Das ist das Format, das WhatsApp und Instagram
//     ohne Beschnitt anzeigen; ein Querformat wird in der Vorschau zerschnitten.
//  3. Gezeichnet auf Canvas, nicht als Screenshot einer HTML-Ansicht. Damit
//     sieht das Bild auf jedem Gerät gleich aus, braucht keine Fremdbibliothek
//     und ist in Millisekunden fertig.
//
// Der Zeitraum steht IM Bild (von–bis). Ohne Datum ist eine Rangliste in einer
// Gruppe wertlos: niemand weiß, ob sie von heute oder vom letzten Monat ist.
// ═══════════════════════════════════════════════════════════════════════════

type Zeitraum = "tag" | "woche" | "monat";

interface AgentRang {
  id: number; name: string; abschluesse: number;
  provisionCents: number; umsatzCents: number;
}

const BREITE = 1080;
const HOEHE = 1350;

const ZEITRAUM_LABEL: Record<Zeitraum, string> = {
  tag: "Heute", woche: "Diese Woche", monat: "Dieser Monat",
};

function dt(iso: string, mitJahr = true): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", ...(mitJahr ? { year: "numeric" } : {}),
  });
}

/** Zeitraum als Klartext — „01.08. – 04.08.2026“ liest sich in einer Gruppe
 *  eindeutiger als „monat“. */
function zeitraumText(zeitraum: Zeitraum, von: string, bis: string): string {
  if (zeitraum === "tag") {
    const d = new Date(`${bis}T12:00:00Z`);
    return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }
  if (von === bis) return dt(bis);
  return `${dt(von, false)} – ${dt(bis)}`;
}

// ── Zeichenhelfer ────────────────────────────────────────────────────────────
function rund(ctx: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, b, h, r);
    return;
  }
  // Fallback für ältere Safari-Versionen — ohne das bricht das ganze Bild.
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + b, y, x + b, y + h, r);
  ctx.arcTo(x + b, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + b, y, r);
  ctx.closePath();
}

/** Name kürzen, statt über den Rand laufen zu lassen. */
function kuerze(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

const MEDAILLEN: Record<number, [string, string, string]> = {
  1: ["#fde68a", "#f59e0b", "#7c4a03"],
  2: ["#f1f5f9", "#cbd5e1", "#334155"],
  3: ["#fed7aa", "#ea9a5b", "#7c2d12"],
};

/**
 * Malt die Rangliste. Reine Zeichenfunktion ohne Seiteneffekte, damit sie
 * sowohl für die Vorschau als auch für den Download dasselbe Ergebnis liefert.
 */
function malen(
  ctx: CanvasRenderingContext2D,
  daten: { zeitraum: Zeitraum; von: string; bis: string; agenten: AgentRang[] },
) {
  const { zeitraum, von, bis, agenten } = daten;
  ctx.clearRect(0, 0, BREITE, HOEHE);

  // ── Grund: tiefes Nachtblau mit zwei Lichtern. Dasselbe Material wie die
  //    Geldtafel im Dashboard, damit das Bild als FIAON erkennbar ist.
  const grund = ctx.createLinearGradient(0, 0, BREITE * 0.6, HOEHE);
  grund.addColorStop(0, "#14265c");
  grund.addColorStop(0.55, "#0d1a3f");
  grund.addColorStop(1, "#080f24");
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, BREITE, HOEHE);

  const licht1 = ctx.createRadialGradient(150, -80, 0, 150, -80, 760);
  licht1.addColorStop(0, "rgba(96,165,250,.42)");
  licht1.addColorStop(1, "rgba(96,165,250,0)");
  ctx.fillStyle = licht1;
  ctx.fillRect(0, 0, BREITE, HOEHE);

  const licht2 = ctx.createRadialGradient(BREITE + 60, HOEHE + 60, 0, BREITE + 60, HOEHE + 60, 700);
  licht2.addColorStop(0, "rgba(29,78,216,.5)");
  licht2.addColorStop(1, "rgba(29,78,216,0)");
  ctx.fillStyle = licht2;
  ctx.fillRect(0, 0, BREITE, HOEHE);

  // ── Kopf
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 62px Outfit, system-ui, sans-serif";
  ctx.fillText("FIAON", 72, 132);

  ctx.fillStyle = "rgba(255,255,255,.42)";
  ctx.font = "700 20px Outfit, system-ui, sans-serif";
  ctx.letterSpacing = "5px";
  ctx.fillText("VERTRIEB · RANGLISTE", 74, 168);
  ctx.letterSpacing = "0px";

  // Zeitraum-Plakette oben rechts
  const label = ZEITRAUM_LABEL[zeitraum].toUpperCase();
  ctx.font = "700 22px Outfit, system-ui, sans-serif";
  const pb = ctx.measureText(label).width + 44;
  rund(ctx, BREITE - 72 - pb, 92, pb, 50, 25);
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#93c5fd";
  ctx.textAlign = "center";
  ctx.fillText(label, BREITE - 72 - pb / 2, 124);
  ctx.textAlign = "left";

  // ── Zeitraum in Klartext
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "500 30px Outfit, system-ui, sans-serif";
  ctx.fillText(zeitraumText(zeitraum, von, bis), 72, 242);

  // ── Überschrift
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 74px Outfit, system-ui, sans-serif";
  ctx.fillText("Abschlüsse", 72, 336);

  const gesamt = agenten.reduce((s, a) => s + a.abschluesse, 0);
  ctx.fillStyle = "rgba(147,197,253,.85)";
  ctx.font = "600 28px Outfit, system-ui, sans-serif";
  ctx.fillText(`${gesamt} im Team${gesamt > 0 ? " — wer legt nach?" : ""}`, 74, 380);

  // ── Rangzeilen
  const max = Math.max(1, ...agenten.map((a) => a.abschluesse));
  const liste = agenten.slice(0, 5);
  // Die Zeilen füllen den verfügbaren Platz aus und werden darin zentriert.
  // Mit fester Zeilenhöhe klaffte bei vier Agenten unten ein Loch von 200px —
  // das sieht nach abgeschnittenem Bild aus, nicht nach Absicht.
  const oben = 440;
  const unten = HOEHE - 190;      // darunter beginnt der Fußbereich
  const platz = unten - oben;
  const luft = liste.length > 4 ? 16 : 20;
  const hoehe = Math.min(190, Math.floor((platz - luft * (liste.length - 1)) / Math.max(1, liste.length)));
  const gesamtHoehe = liste.length * hoehe + (liste.length - 1) * luft;
  const start = oben + Math.max(0, Math.floor((platz - gesamtHoehe) / 2));

  liste.forEach((a, i) => {
    const y = start + i * (hoehe + luft);
    const platz = i + 1;
    const erster = platz === 1 && a.abschluesse > 0;

    // Karte
    rund(ctx, 72, y, BREITE - 144, hoehe, 26);
    const fuell = ctx.createLinearGradient(0, y, 0, y + hoehe);
    fuell.addColorStop(0, erster ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.085)");
    fuell.addColorStop(1, "rgba(255,255,255,.04)");
    ctx.fillStyle = fuell;
    ctx.fill();
    ctx.strokeStyle = erster ? "rgba(245,158,11,.55)" : "rgba(255,255,255,.13)";
    ctx.lineWidth = erster ? 2.5 : 1.5;
    ctx.stroke();

    // Medaille
    const mx = 72 + 60;
    const my = y + hoehe / 2;
    const rad = 34;
    const farben = MEDAILLEN[platz];
    ctx.beginPath();
    ctx.arc(mx, my, rad, 0, Math.PI * 2);
    if (farben) {
      const g = ctx.createLinearGradient(mx, my - rad, mx, my + rad);
      g.addColorStop(0, farben[0]);
      g.addColorStop(1, farben[1]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "rgba(255,255,255,.14)";
    }
    ctx.fill();
    ctx.fillStyle = farben ? farben[2] : "rgba(255,255,255,.7)";
    ctx.font = "800 34px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(platz), mx, my + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 40px Outfit, system-ui, sans-serif";
    const nameX = mx + rad + 30;
    const nameMax = BREITE - 144 - (nameX - 72) - 250;
    ctx.fillText(kuerze(ctx, a.name, nameMax), nameX, my - 4);

    // Balken: zeigt den Abstand zur Spitze, ohne dass man rechnen muss.
    const bBreite = nameMax;
    const bY = my + 18;
    rund(ctx, nameX, bY, bBreite, 10, 5);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fill();
    if (a.abschluesse > 0) {
      const w = Math.max(14, Math.round((a.abschluesse / max) * bBreite));
      rund(ctx, nameX, bY, w, 10, 5);
      const bg = ctx.createLinearGradient(nameX, 0, nameX + w, 0);
      if (erster) { bg.addColorStop(0, "#fbbf24"); bg.addColorStop(1, "#f59e0b"); }
      else { bg.addColorStop(0, "#3b82f6"); bg.addColorStop(1, "#93c5fd"); }
      ctx.fillStyle = bg;
      ctx.fill();
    }

    // Zahl rechts
    ctx.textAlign = "right";
    ctx.fillStyle = erster ? "#fcd34d" : "#ffffff";
    ctx.font = "800 68px Outfit, system-ui, sans-serif";
    ctx.fillText(String(a.abschluesse), BREITE - 108, my + 8);
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = "600 19px Outfit, system-ui, sans-serif";
    ctx.fillText(a.abschluesse === 1 ? "Abschluss" : "Abschlüsse", BREITE - 108, my + 36);
    ctx.textAlign = "left";
  });

  // ── Fuß
  const fy = HOEHE - 96;
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(72, fy - 44);
  ctx.lineTo(BREITE - 72, fy - 44);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "600 24px Outfit, system-ui, sans-serif";
  ctx.fillText("Jeder Abschluss zählt.", 72, fy);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,.32)";
  ctx.font = "500 21px Outfit, system-ui, sans-serif";
  ctx.fillText(
    `Stand ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr`,
    BREITE - 72, fy,
  );
  ctx.textAlign = "left";
}

const CSS = `
/* Der Knopf: Glas mit einem Lichtstreifen, der beim Zeigen einmal durchläuft.
   Einmal — nicht in Dauerschleife; ein blinkender Knopf wirkt wie ein Fehler. */
.rt-knopf{
  position:relative; overflow:hidden;
  display:inline-flex; align-items:center; gap:6px;
  height:30px; padding:0 11px; border-radius:9px;
  font-size:11.5px; font-weight:700; color:#fff; white-space:nowrap;
  background:linear-gradient(180deg,#1d4ed8,#1e40af);
  box-shadow:0 3px 10px -3px rgba(29,78,216,.65), inset 0 1px 0 rgba(255,255,255,.28);
  transition:transform 140ms cubic-bezier(.32,.72,0,1), box-shadow 220ms ease;
}
.rt-knopf:hover{ transform:translateY(-1px); box-shadow:0 8px 20px -6px rgba(29,78,216,.8), inset 0 1px 0 rgba(255,255,255,.34); }
.rt-knopf:active{ transform:translateY(0) scale(.96); }
.rt-knopf::after{
  content:""; position:absolute; top:0; bottom:0; width:40%;
  background:linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
  transform:translateX(-160%);
}
.rt-knopf:hover::after{ animation:rtGlanz 700ms cubic-bezier(.32,.72,0,1) 1; }
@keyframes rtGlanz{ to{ transform:translateX(320%) } }

.rt-hinter{
  position:fixed; inset:0; z-index:95; background:rgba(7,11,22,.62);
  -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
  animation:rtAuf 240ms cubic-bezier(.32,.72,0,1) both;
}
.rt-fenster{
  position:relative; width:100%; max-width:430px; max-height:92vh; overflow-y:auto;
  border-radius:24px; padding:18px;
  background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(250,252,255,.98));
  border:1px solid rgba(255,255,255,.7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 40px 90px -20px rgba(13,26,63,.6);
  animation:rtHoch 380ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes rtAuf{ from{opacity:0} to{opacity:1} }
@keyframes rtHoch{ from{opacity:0; transform:translateY(20px) scale(.97)} to{opacity:1; transform:none} }

/* Die Vorschau schwebt leicht gekippt — man sieht sofort, dass es ein BILD ist
   und nicht ein weiterer Kasten der Oberfläche. */
.rt-vorschau{
  display:block; width:100%; border-radius:14px;
  box-shadow:0 18px 40px -12px rgba(13,26,63,.55), 0 2px 6px rgba(13,26,63,.25);
  transform:perspective(1200px) rotateX(1.5deg);
}
.rt-wahl{ display:flex; padding:3px; border-radius:11px; background:#eef2f7; box-shadow:inset 0 1px 2px rgba(15,23,42,.08); }
.rt-wahl button{ flex:1; padding:7px 0; border-radius:8px; font-size:12.5px; font-weight:700; color:#64748b; transition:all 180ms cubic-bezier(.32,.72,0,1); }
.rt-wahl button[data-an="1"]{ background:#fff; color:#0f172a; box-shadow:0 1px 3px rgba(15,23,42,.16); }

@media (prefers-reduced-motion: reduce){
  .rt-knopf:hover::after{ animation:none } .rt-hinter,.rt-fenster{ animation:none !important }
  .rt-vorschau{ transform:none }
}
`;

export default function RanglisteTeilen() {
  const [offen, setOffen] = useState(false);
  const [zeitraum, setZeitraum] = useState<Zeitraum>("tag");
  const [daten, setDaten] = useState<{ von: string; bis: string; agenten: AgentRang[] } | null>(null);
  const [bild, setBild] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Daten für den gewählten Zeitraum holen und Bild neu malen.
  useEffect(() => {
    if (!offen) return;
    let lebt = true;
    setLaedt(true);
    setMeldung(null);
    fetch(`/api/fiaon/admin/hub/rangliste?zeitraum=${zeitraum}`, { credentials: "include" })
      .then((r) => r.json())
      .then(async (j) => {
        if (!lebt) return;
        if (!j?.ok) { setMeldung(j?.error || "Rangliste konnte nicht geladen werden."); return; }
        setDaten({ von: j.von, bis: j.bis, agenten: j.agenten || [] });
        // Auf die Schrift warten: ohne das malt Canvas beim ersten Mal in einer
        // Ersatzschrift, und das Bild sieht anders aus als die Vorschau.
        try { await (document as any).fonts?.ready; } catch { /* egal */ }
        if (!lebt) return;
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        if (!ctx) { setMeldung("Dieser Browser kann kein Bild erzeugen."); return; }
        malen(ctx, { zeitraum, von: j.von, bis: j.bis, agenten: j.agenten || [] });
        setBild(c.toDataURL("image/png"));
      })
      .catch(() => lebt && setMeldung("Keine Verbindung zum Server."))
      .finally(() => lebt && setLaedt(false));
    return () => { lebt = false; };
  }, [offen, zeitraum]);

  const dateiname = useCallback(
    () => `FIAON-Rangliste-${ZEITRAUM_LABEL[zeitraum].replace(/\s/g, "-")}-${daten?.bis || ""}.png`,
    [zeitraum, daten],
  );

  const herunterladen = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dateiname();
      a.click();
      // Der Objekt-URL muss wieder freigegeben werden, sonst bleibt das Bild
      // bis zum Neuladen im Speicher.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMeldung("Bild gespeichert.");
    }, "image/png");
  };

  /** Direkt weitergeben (Handy: öffnet WhatsApp & Co. mit dem Bild im Anhang). */
  const teilen = async () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(async (blob) => {
      if (!blob) return;
      const datei = new File([blob], dateiname(), { type: "image/png" });
      const n = navigator as any;
      if (n.canShare?.({ files: [datei] })) {
        try {
          await n.share({ files: [datei], title: "FIAON Rangliste" });
          setMeldung("Weitergegeben.");
        } catch { /* Abbruch durch den Nutzer ist kein Fehler */ }
      } else {
        setMeldung("Direktes Teilen kann dieser Browser nicht — das Bild wird stattdessen gespeichert.");
        herunterladen();
      }
    }, "image/png");
  };

  const teilenMoeglich = typeof navigator !== "undefined" && !!(navigator as any).canShare;

  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="rt-knopf" onClick={() => setOffen(true)}>
        <BildIcon size={13} /> Als Bild teilen
      </button>

      {offen && createPortal(
        <>
          <div className="rt-hinter" onClick={() => setOffen(false)} />
          <div className="fixed inset-0 z-[96] flex items-center justify-center p-4 pointer-events-none">
            <div className="rt-fenster pointer-events-auto" role="dialog" aria-modal="true" aria-label="Rangliste als Bild">
              <div className="flex items-start gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold text-slate-900">Rangliste als Bild</h3>
                  <p className="text-[11.5px] text-slate-500 leading-snug">
                    Hochformat für WhatsApp. Zeigt Abschlüsse und Zeitraum — keine Beträge.
                  </p>
                </div>
                <button type="button" onClick={() => setOffen(false)}
                  className="shrink-0 w-8 h-8 rounded-lg border bg-white flex items-center justify-center text-slate-400 hover:text-slate-700"
                  style={{ borderColor: "#e4e9f2" }} aria-label="Schließen">
                  <X size={15} />
                </button>
              </div>

              <div className="rt-wahl mb-3">
                {(["tag", "woche", "monat"] as Zeitraum[]).map((z) => (
                  <button key={z} type="button" data-an={zeitraum === z ? "1" : undefined} onClick={() => setZeitraum(z)}>
                    {z === "tag" ? "Täglich" : z === "woche" ? "Wöchentlich" : "Monatlich"}
                  </button>
                ))}
              </div>

              {/* Das Zeichenbrett bleibt unsichtbar — gezeigt wird das Ergebnis. */}
              <canvas ref={canvasRef} width={BREITE} height={HOEHE} className="hidden" />

              {laedt && <p className="py-10 text-center text-[13px] text-slate-400">Bild wird erzeugt …</p>}
              {!laedt && bild && <img src={bild} alt="Vorschau der Rangliste" className="rt-vorschau" />}
              {meldung && <p className="mt-2.5 text-[12px] text-slate-500">{meldung}</p>}

              <div className="flex items-center gap-2 mt-3.5">
                <button type="button" onClick={herunterladen} disabled={!bild}
                  className="flex-1 h-[42px] rounded-xl text-[13px] font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: `linear-gradient(180deg,${ACCENT},#1e40af)`, boxShadow: "0 4px 14px -6px rgba(29,78,216,.7)" }}>
                  <Download size={15} /> Herunterladen
                </button>
                {teilenMoeglich && (
                  <button type="button" onClick={() => void teilen()} disabled={!bild}
                    className="h-[42px] px-4 rounded-xl border bg-white text-[13px] font-bold text-slate-700 inline-flex items-center gap-2 disabled:opacity-40"
                    style={{ borderColor: "#e4e9f2" }}>
                    <Share2 size={15} /> Teilen
                  </button>
                )}
              </div>

              {daten && daten.agenten.length > 0 && (
                <p className="mt-2.5 text-[11px] text-slate-400 leading-snug">
                  {daten.agenten.reduce((s, a) => s + a.abschluesse, 0)} Abschlüsse im Zeitraum
                  {" "}{zeitraumText(zeitraum, daten.von, daten.bis)}. Gezählt werden Eigenabschlüsse mit gebuchter Provision.
                </p>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
