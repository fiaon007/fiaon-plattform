// ═══════════════════════════════════════════════════════════════════════════
// DREI UHREN: DEUTSCHLAND, FLORIDA, LONDON (19.09.2026, E-196)
//
// Justin: „3D-Uhren — wie im Weißen Haus oder bei bekannten Nachrichtensendern,
// die man oft in Filmen sieht — mit deutscher Zeit, Florida-Zeit, London-Zeit."
// Die Wand der Weltzeituhren aus dem Nachrichtenstudio, im Stil der Seite:
// gebürstetes Metall, Glas, schwarze Zeiger, der Sekundenzeiger im Blau der
// Marke. Keine Marke, kein Senderlogo — nur die Anmutung.
//
// Die Zeit kommt aus Intl (formatToParts, nie Number(format()) — siehe die
// Berlin-Stunden-Falle), die Winkel wachsen mit der Epoche: So dreht kein
// Zeiger beim Sprung von 59 auf 0 rückwärts. Sommer- und Winterzeit stimmen
// von selbst; der Abstand zu Deutschland wird jede Minute neu gerechnet.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

export interface UhrOrt { zone: string; ort: string; zusatz: string }

/** Minuten, die eine Zeitzone gerade vor UTC liegt (negativ: dahinter). */
function versatzMinuten(zone: string, jetzt: Date): number {
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(jetzt);
  const w = (typ: string) => Number(teile.find((t) => t.type === typ)?.value ?? "0");
  const alsUtc = Date.UTC(w("year"), w("month") - 1, w("day"), w("hour") % 24, w("minute"));
  const minuteUtc = Math.floor(jetzt.getTime() / 60_000) * 60_000;
  return Math.round((alsUtc - minuteUtc) / 60_000);
}

const zwei = (n: number) => String(n).padStart(2, "0");

function Uhr({ ort, jetzt, deutschlandVersatz, gleichText, differenzText }: {
  ort: UhrOrt; jetzt: Date; deutschlandVersatz: number;
  gleichText: string; differenzText: (stunden: number) => string;
}) {
  const versatz = versatzMinuten(ort.zone, jetzt);
  // Winkel wachsen mit der Zeit — ein Zeiger springt nie rückwärts.
  const lokaleMinuten = Math.floor(jetzt.getTime() / 60_000) + versatz;
  const sekunden = Math.floor(jetzt.getTime() / 1000);
  const s = sekunden % 60;
  const stundeWinkel = lokaleMinuten * 0.5;
  const minuteWinkel = lokaleMinuten * 6 + s * 0.1;
  const sekundeWinkel = sekunden * 6;
  const stunde = Math.floor((((lokaleMinuten % 1440) + 1440) % 1440) / 60);
  const minute = ((lokaleMinuten % 60) + 60) % 60;
  const abstand = Math.round((versatz - deutschlandVersatz) / 60);

  return (
    <figure className="fg-uhr">
      <div className="fg-uhr-wand">
        <div className="fg-uhr-gehaeuse" role="img" aria-label={`${ort.ort}: ${zwei(stunde)}:${zwei(minute)}`}>
          <svg className="fg-uhr-blatt" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="96" className="flaeche" />
            {Array.from({ length: 60 }, (_, i) => (
              <line key={i} x1="100" y1={i % 5 === 0 ? 11 : 12} x2="100" y2={i % 5 === 0 ? 25 : 18}
                    className={i % 5 === 0 ? "strich gross" : "strich"} transform={`rotate(${i * 6} 100 100)`} />
            ))}
            {[12, 3, 6, 9].map((z, i) => {
              const w = (i * 90 - 90) * (Math.PI / 180);
              return <text key={z} x={100 + Math.cos(w) * 58} y={100 + Math.sin(w) * 58} className="ziffer" textAnchor="middle" dominantBaseline="central">{z}</text>;
            })}
            <g className="zeiger stunde" style={{ transform: `rotate(${stundeWinkel}deg)` }}>
              <path d="M96.6 112 L98.4 52 Q100 47 101.6 52 L103.4 112 Z" />
            </g>
            <g className="zeiger minute" style={{ transform: `rotate(${minuteWinkel}deg)` }}>
              <path d="M97.6 116 L99.1 26 Q100 22 100.9 26 L102.4 116 Z" />
            </g>
            <g className="zeiger sekunde" style={{ transform: `rotate(${sekundeWinkel}deg)` }}>
              <line x1="100" y1="124" x2="100" y2="20" />
              <circle cx="100" cy="30" r="4.2" />
            </g>
            <circle cx="100" cy="100" r="5.2" className="nabe" />
            <circle cx="100" cy="100" r="2" className="nabe-kern" />
          </svg>
          <span className="fg-uhr-glas" aria-hidden="true" />
        </div>
      </div>
      <figcaption>
        <b>{ort.ort}</b>
        <span className="zeit">{zwei(stunde)}:{zwei(minute)}</span>
        <span className="zusatz">{ort.zusatz}</span>
        <span className="abstand">{abstand === 0 ? gleichText : differenzText(abstand)}</span>
      </figcaption>
    </figure>
  );
}

export default function GlobalUhren({ auge, h2, lead, orte, gleichText, differenzText }: {
  auge: string; h2: string; lead: string; orte: readonly UhrOrt[];
  gleichText: string; differenzText: (stunden: number) => string;
}) {
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    let wecker = 0;
    // Auf die volle Sekunde ausgerichtet; im Hintergrund-Tab ruht die Uhr.
    const ticken = () => {
      setJetzt(new Date());
      wecker = window.setTimeout(ticken, 1000 - (Date.now() % 1000) + 5);
    };
    const sichtbar = () => {
      window.clearTimeout(wecker);
      if (document.visibilityState === "visible") ticken();
    };
    ticken();
    document.addEventListener("visibilitychange", sichtbar);
    return () => { window.clearTimeout(wecker); document.removeEventListener("visibilitychange", sichtbar); };
  }, []);
  const deutschlandVersatz = versatzMinuten("Europe/Berlin", jetzt);

  return (
    <section className="fg-sek eng fg-uhren-sek" aria-labelledby="fg-uhren-h2">
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{auge}</span><h2 id="fg-uhren-h2" className="fg-h2">{h2}</h2></div>
          <p className="fg-lead">{lead}</p>
        </div>
        <div className="fg-uhren">
          {orte.map((o) => (
            <Uhr key={o.zone} ort={o} jetzt={jetzt} deutschlandVersatz={deutschlandVersatz} gleichText={gleichText} differenzText={differenzText} />
          ))}
        </div>
      </div>
    </section>
  );
}
