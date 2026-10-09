// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG AUF DER ZAHLUNGSSEITE (09.10.2026, E-318)
//
// Justin: „dass dort sein Vertrag angezeigt wird … seriöser“ und „vielleicht seine Gründungsurkunde animiert mit seinem
// LLC-Namen“. Oben: die Urkunde (Rahmen zeichnet sich, der Name schreibt sich ein, das Siegel prägt sich ein) mit dem
// ehrlichen Satz „Anmeldung nach Ihrer Zahlung“ — eingetragen ist sie erst danach. Darunter Vertrag und Rechnung als PDF.
// Unten (AuftragWeiter): „So geht es weiter“ und die Ansprechpartner. Alle Sätze kommen vom Server (ZahlungAuftragKontext).
// Bei prefers-reduced-motion steht alles sofort.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import type { ZahlungAuftragKontext } from "@shared/fiaon-zahlung-auftrag";

const WORTE = { urkunde: "Articles of Organization", anmeldung: "Anmeldung nach Ihrer Zahlung", pdf: "PDF öffnen" };

function ruhig(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

function Urkunde({ name, zeile }: { name: string; zeile: string }) {
  const [n, setN] = useState(ruhig() ? name.length : 0);
  useEffect(() => {
    if (ruhig()) return;
    let i = 0;
    let t = 0;
    const tick = () => { i += 1; setN(i); if (i < name.length) t = window.setTimeout(tick, 70); };
    t = window.setTimeout(tick, 900);
    return () => window.clearTimeout(t);
  }, [name]);
  return (
    <div className="za-urkunde" role="img" aria-label={`${name} — ${zeile}`}>
      <svg className="za-rahmen" viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
        <rect x="6" y="6" width="388" height="208" rx="10" pathLength={1} />
        <rect x="14" y="14" width="372" height="192" rx="7" pathLength={1} />
      </svg>
      <div className="za-urkunde-innen">
        <div className="za-urkunde-kopf">
          <span className="za-auge">{WORTE.urkunde}</span>
          <span className="za-siegel" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="6" /><path d="M8.5 15 7 21l5-2.5 5 2.5-1.5-6" /><path d="m9.6 10 1.7 1.7 3.1-3.3" /></svg>
          </span>
        </div>
        <p className="za-name" aria-hidden="true">{name.slice(0, n)}<span className={`za-cursor${n >= name.length ? " aus" : ""}`}>|</span></p>
        <p className="za-zeile">{zeile}</p>
        <p className="za-status"><span className="za-punkt" />{WORTE.anmeldung}</p>
      </div>
    </div>
  );
}

export function AuftragKopf({ a }: { a: ZahlungAuftragKontext }) {
  return (
    <section className="za-block" aria-label={a.auge}>
      <p className="za-block-auge">{a.auge}</p>
      {a.gesellschaft && <Urkunde name={a.gesellschaft} zeile={a.gesellschaftZeile} />}
      <p className="za-satz">{a.satz}</p>
      {a.pruefungen && a.pruefungen.length > 0 && (
        <div className="za-pruef">
          {a.pruefTitel && <p className="za-titel-klein">{a.pruefTitel}</p>}
          <ul>
            {a.pruefungen.map((p, i) => (
              <li key={p.titel} className={p.stand} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
                <span className="za-haken" aria-hidden="true">
                  {p.stand === "ok"
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5.5 12.5 4.2 4.2 8.8-9.2" /></svg>
                    : <span className="za-offen-punkt" />}
                </span>
                <span><b>{p.titel}</b><span>{p.text}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="za-dokumente">
        <p className="za-titel-klein">{a.dokumenteTitel}</p>
        {a.dokumente.map((d) => (
          <a key={d.titel} className="za-dokument" href={d.href} target="_blank" rel="noreferrer">
            <span className="za-dok-symbol" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3h8l4 4v14h-12z" /><path d="M14.5 3v4h4M9 11h6M9 14h6M9 17h4" /></svg>
            </span>
            <span className="za-dok-text"><b>{d.titel}</b><span>{d.unter}</span></span>
            <span className="za-dok-pfeil">{WORTE.pdf} →</span>
          </a>
        ))}
        {a.hinweis && <p className={a.hinweisBetont ? "za-hinweis za-hinweis-box" : "za-hinweis"}>{a.hinweis}</p>}
      </div>
    </section>
  );
}

export function AuftragWeiter({ a }: { a: ZahlungAuftragKontext }) {
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  return (
    <>
      {a.schritte.length > 0 && (
        <section className="za-block za-weiter" aria-label={a.schritteTitel}>
          <p className="za-titel">{a.schritteTitel}</p>
          <ol className="za-schritte">
            {a.schritte.map((s, i) => (
              <li key={s.titel}><span className="za-nr">{i + 1}</span><span><b>{s.titel}</b><span>{s.text}</span></span></li>
            ))}
          </ol>
        </section>
      )}
      {a.ansprechpartner.length > 0 && (
        <section className="za-block" aria-label={a.ansprechTitel}>
          <p className="za-titel">{a.ansprechTitel}</p>
          <ul className="za-personen">
            {a.ansprechpartner.map((p) => (
              <li key={p.kuerzel}>
                <span className="za-bild">
                  {ohneBild[p.kuerzel]
                    ? <span className="za-mono" aria-hidden="true">{p.name.split(/\s+/).map((t) => t[0]).join("").slice(0, 2)}</span>
                    : <img src={p.portrait} alt={p.name} width={56} height={56} loading="lazy" onError={() => setOhneBild((o) => ({ ...o, [p.kuerzel]: true }))} />}
                </span>
                <span className="za-person-text">
                  <b>{p.name}</b><span>{p.rolle}</span>
                  <a href={`mailto:${p.email}`}>{p.email}</a>
                  <a href={`tel:${p.telefon.replace(/\s/g, "")}`}>{p.telefon}</a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Die Gestaltung — FIAON-CI: Glasblau #288DFA (Licht) und #1D4ED8 (Tiefe), Navy-Text, milchiges Glas, dünne Schrift; KEIN Gold. */
export const AUFTRAG_CSS = `
.za-block{background:#fff;border:1px solid #e3e9f3;border-radius:16px;padding:22px 22px 20px;margin:0 0 20px;text-align:left;
  box-shadow:0 1px 2px rgba(29,78,216,.04),0 12px 32px -22px rgba(29,78,216,.28)}
.za-block-auge{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#1D4ED8;font-weight:500;margin:0 0 14px}
.za-titel{font-family:'Newsreader',Georgia,serif;font-weight:400;font-size:21px;color:#0c1a2e;margin:0 0 14px}
.za-titel-klein{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b7587;font-weight:500;margin:18px 0 8px}
.za-satz{font-size:14px;line-height:1.6;color:#3b4658;margin:14px 0 0}
/* Die Urkunde — milchiges FIAON-Glasblau mit Lichtkante, wie Apples Glas (Justin 04.10./09.10.: „unser Glasblau“) */
.za-urkunde{position:relative;border-radius:14px;overflow:hidden;container-type:inline-size;
  background:radial-gradient(120% 140% at 0% 0%,rgba(255,255,255,.95) 0%,rgba(236,244,255,.9) 45%,rgba(214,231,255,.85) 100%);
  border:1px solid rgba(40,141,250,.28);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(29,78,216,.06),0 18px 40px -24px rgba(29,78,216,.45),0 2px 6px rgba(29,78,216,.06)}
.za-urkunde::before{content:"";position:absolute;inset:-40% -10% auto auto;width:70%;height:120%;pointer-events:none;
  background:radial-gradient(closest-side,rgba(40,141,250,.18),transparent 70%)}
.za-urkunde::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.75) 50%,transparent 65%);
  transform:translateX(-120%);animation:za-glanz 2.4s cubic-bezier(.22,1,.36,1) 2.6s 1 forwards}
.za-rahmen{position:absolute;inset:0;width:100%;height:100%}
.za-rahmen rect{fill:none;stroke:#288DFA;stroke-opacity:.75;stroke-width:1.2;stroke-dasharray:1;stroke-dashoffset:1;animation:za-zeichnen 1.6s cubic-bezier(.22,1,.36,1) .1s forwards;vector-effect:non-scaling-stroke}
.za-rahmen rect+rect{stroke:#1D4ED8;stroke-opacity:.35;stroke-width:.8;animation-delay:.35s}
.za-urkunde-innen{position:relative;padding:26px 28px 22px}
.za-urkunde-kopf{display:flex;justify-content:space-between;align-items:center}
.za-auge{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:#1D4ED8;font-weight:500}
.za-siegel{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;color:#fff;position:relative;
  background:linear-gradient(145deg,#5aa9ff 0%,#288DFA 40%,#1D4ED8 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 8px 18px -6px rgba(29,78,216,.6);
  opacity:0;transform:scale(1.8) rotate(-18deg);animation:za-praegen .55s cubic-bezier(.2,1.4,.4,1) 2.3s forwards}
.za-name{margin:18px 0 0;min-height:1.2em;font-family:'Newsreader',Georgia,serif;font-weight:300;font-size:min(40px,10cqw);line-height:1.15;letter-spacing:.01em;color:#0b1c36;overflow-wrap:anywhere}
.za-cursor{display:inline-block;margin-left:2px;color:#288DFA;animation:za-blinken 1s steps(1) infinite}
.za-cursor.aus{animation:za-weg .4s ease .6s forwards}
.za-zeile{margin:6px 0 0;font-size:12px;color:#5b6b85;letter-spacing:.03em}
.za-status{margin:16px 0 0;padding-top:12px;border-top:1px dashed rgba(40,141,250,.35);display:flex;align-items:center;gap:8px;font-size:12.5px;color:#3b4658}
.za-punkt{width:8px;height:8px;border-radius:50%;background:#288DFA;box-shadow:0 0 0 0 rgba(40,141,250,.55);animation:za-puls 2s ease-out infinite}
.za-dokument{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #eef2f8;text-decoration:none;color:#0c1a2e}
.za-dokument:hover .za-dok-pfeil{color:#1D4ED8;transform:translateX(3px)}
.za-dok-symbol{flex:0 0 40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#eef3fe;color:#1D4ED8;box-shadow:inset 0 0 0 1px #d6e1fb}
.za-dok-text{display:grid;gap:2px;min-width:0;flex:1}
.za-dok-text b{font-size:14.5px;font-weight:500}
.za-dok-text span{font-size:12.5px;color:#6b7587;overflow-wrap:anywhere}
.za-dok-pfeil{flex:0 0 auto;font-size:12.5px;color:#288DFA;font-weight:500;transition:transform .3s,color .3s;white-space:nowrap}
.za-hinweis{margin:10px 0 0;font-size:12.5px;color:#6b7587}
.za-hinweis-box{margin-top:14px;padding:14px 16px;border-radius:12px;font-size:13.5px;line-height:1.6;color:#0b1c36;
  background:linear-gradient(180deg,#f3f8ff,#e8f1ff);border:1px solid rgba(40,141,250,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
.za-schritte{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.za-schritte li{display:flex;gap:14px;align-items:flex-start}
.za-nr{flex:0 0 30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:500;
  background:linear-gradient(145deg,#288DFA,#1D4ED8);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 6px 14px -6px rgba(29,78,216,.55)}
.za-schritte b{display:block;font-size:14.5px;color:#0c1a2e;font-weight:500}
.za-schritte li>span>span{display:block;margin-top:2px;font-size:13.5px;line-height:1.55;color:#3b4658}
.za-personen{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.za-personen li{display:flex;gap:12px;align-items:center}
.za-bild img,.za-mono{width:56px;height:56px;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:#eef3fe;color:#1D4ED8;font-family:Georgia,serif;font-size:20px;box-shadow:0 0 0 1px #d6e1fb}
.za-person-text{display:grid;gap:1px;min-width:0}
.za-person-text b{font-size:14.5px;color:#0c1a2e;font-weight:500}
.za-person-text span{font-size:12px;color:#6b7587}
.za-person-text a{font-size:13px;color:#1D4ED8;text-decoration:none;overflow-wrap:anywhere}
.za-person-text a:hover{text-decoration:underline}
.za-pruef ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.za-pruef li{display:flex;gap:12px;align-items:flex-start;opacity:0;transform:translateY(6px);animation:za-auf .5s cubic-bezier(.22,1,.36,1) forwards}
.za-haken{flex:0 0 24px;height:24px;border-radius:50%;display:grid;place-items:center;color:#fff;margin-top:1px;
  background:linear-gradient(145deg,#288DFA,#1D4ED8);box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
.za-pruef li.offen .za-haken{background:#eef3fe;box-shadow:inset 0 0 0 1px #c8d6f5}
.za-offen-punkt{width:8px;height:8px;border-radius:50%;background:#288DFA;animation:za-puls 2s ease-out infinite}
.za-pruef b{display:block;font-size:14px;color:#0c1a2e;font-weight:500}
.za-pruef li>span>span{display:block;font-size:12.5px;color:#6b7587;margin-top:1px}
@keyframes za-auf{to{opacity:1;transform:none}}
@keyframes za-zeichnen{to{stroke-dashoffset:0}}
@keyframes za-praegen{to{opacity:1;transform:scale(1) rotate(0)}}
@keyframes za-glanz{to{transform:translateX(120%)}}
@keyframes za-blinken{50%{opacity:0}}
@keyframes za-weg{to{opacity:0}}
@keyframes za-puls{0%{box-shadow:0 0 0 0 rgba(40,141,250,.55)}100%{box-shadow:0 0 0 10px rgba(40,141,250,0)}}
@media (prefers-reduced-motion: reduce){
  .za-rahmen rect{animation:none;stroke-dashoffset:0}
  .za-siegel{animation:none;opacity:1;transform:none}
  .za-urkunde::after,.za-cursor,.za-punkt,.za-offen-punkt{animation:none}
  .za-pruef li{animation:none;opacity:1;transform:none}
  .za-cursor{display:none}
}
@media (max-width:480px){.za-block{padding:18px 16px}.za-urkunde-innen{padding:22px 20px 18px}.za-dok-pfeil{display:none}}
`;
