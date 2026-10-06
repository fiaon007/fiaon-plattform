// ═══════════════════════════════════════════════════════════════════════════
// /privatkunden — die meistbesuchte Seite, neu gebaut (23.08.2026, Justin:
// „komplett neu, PERFEKT, High End — und pitche stark die Kreditkarte.
// Wer hier ein Paket wählt, startet direkt in der Antragssequenz.")
//
// Dramaturgie: Die Karte ist das Ziel, FIAON der Weg. Hero mit der Karte →
// Zahlen → der Weg in vier Etappen → die Pakete (ein Klick = Antrag, Schritt 1,
// Paket gesetzt) → was FIAON tut → ehrlicher Vergleich → die Karte im Detail
// (Readiness) → Vertrauen → Fragen → Abschluss. Wenig Text je Block, jeder
// Satz in Sie-Form, keine Versprechen: Über Konto, Karte und Rahmen entscheidet
// die Bank — FIAON bereitet vor.
//
// 02.09.2026: zweisprachig — /privatkunden (Deutsch) und /en/personal
// (Englisch); Texte im Wörterbuch client/src/i18n/privatkunden.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PRIVATKUNDEN_WOERTER } from "@/i18n/privatkunden";
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Licht, Szenenbild } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import { paket as paketVon, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import { betrag, landLesen, type Land } from "@/lib/fiaon-land";
import "@/styles/privatkunden.css";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { SozialFenster } from "@/components/site/sozial/SozialFenster";

// Die Pakete: Schlüssel, Ziel-Rahmen, Farbe — Name, Untertitel und Merkmale
// stehen im Wörterbuch unter demselben Schlüssel. 05.10.2026, E-283: im
// Wortlaut von /start (client/src/lib/paket-merkmale.ts), ohne die Zeile „Ziel: …“.
// 05.10.2026 (E-284, Justin: „am Handy schön, clean, zentriert — das Limit im Mittelpunkt,
// und die Kreditkarten viel besser, die sehen so billig aus"): je Stufe ein eigenes Metall —
// Stahlblau, Königsblau, Mitternacht, Schwarzmetall —, die Stufe steht auf der Karte.
const PAKETE = [
  { key: "start", lim: 500, stufe: "STARTER", bg: "linear-gradient(135deg,#79a8ea 0%,#4579c6 46%,#2b5596 100%)" },
  { key: "pro", lim: 5000, rec: true, stufe: "PRO", bg: "linear-gradient(135deg,#4486ff 0%,#1d4ed8 48%,#122c80 100%)" },
  { key: "ultra", lim: 15000, stufe: "ULTRA", bg: "linear-gradient(135deg,#2c4f8c 0%,#172c57 50%,#0a1530 100%)" },
  { key: "highend", lim: 25000, stufe: "HIGH END", bg: "linear-gradient(135deg,#454c5a 0%,#1a1f2a 52%,#040609 100%)" },
];

/** Kontaktlos-Zeichen (vier Bögen) — gezeichnet, kein Markenlogo. */
function Kontaktlos() {
  return (
    <svg className="pk-karte-funk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M8.5 9.2a4.2 4.2 0 0 1 0 5.6" /><path d="M11.6 7.1a7.4 7.4 0 0 1 0 9.8" /><path d="M14.7 5a10.6 10.6 0 0 1 0 14" /><path d="M17.8 3a13.8 13.8 0 0 1 0 18" />
    </svg>
  );
}

function Readiness({ label }: { label: string }) {
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(72), 400); return () => clearTimeout(t); }, []);
  const r = 78, u = 2 * Math.PI * r;
  return (
    <div className="pk-ready">
      <svg viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
        <defs><linearGradient id="pkRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#60a5fa" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="url(#pkRing)" strokeWidth="10" strokeLinecap="round" strokeDasharray={u} strokeDashoffset={u * (1 - p / 100)} transform="rotate(-90 90 90)" style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="pk-ready-mitte"><b className="zahl">{p}%</b><small>{label}</small></div>
    </div>
  );
}

export default function Privatkunden() {
  const t = useWoerter(PRIVATKUNDEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  // Das Land wie auf /start (?land=…, sonst die letzte Wahl, sonst Deutschland) — es steckt in den Merkmalen.
  const [land] = useState<Land>(() => landLesen());
  const zu = (p: string) => inSprache(p, sprache);
  // Preise in der Sprache der Seite: 7,99 € (de) — €7.99 (en).
  const preis = (key: string) => { const c = paketVon(key)?.preisCents ?? 0; return en ? "€" + (c / 100).toFixed(2) : (c / 100).toFixed(2).replace(".", ",") + " €"; };
  const auskunft = en ? "€" + SCHUFA_PREIS_EURO.toFixed(2) : SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";
  const start = (key: string) => { try { sessionStorage.setItem("fiaon_paket", key); } catch { /* egal */ } window.location.href = `/antrag?pack=${key}&src=privatkunden`; };
  // Das Limit in der Sprache der Seite und im Land wie die Merkmale: „bis 5.000 €" / „bis CHF 5'000" / „up to €5,000".
  const rahmen = (lim: number) => t.bisRahmen(en ? "€" + lim.toLocaleString("en-GB") : betrag(lim.toLocaleString("de-DE"), land));

  // ── Am Handy: eine wischbare Reihe, eine Karte in der Mitte (Pro zuerst), Punkte darunter ──
  const reihe = useRef<HTMLDivElement>(null);
  const [aktiv, setAktiv] = useState(1);
  useEffect(() => {
    const r = reihe.current;
    if (!r || typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches) return;
    const el = r.children[1] as HTMLElement | undefined;
    if (el) r.scrollLeft = el.offsetLeft - (r.clientWidth - el.clientWidth) / 2;
    let lauf = 0;
    const beimWischen = () => {
      cancelAnimationFrame(lauf);
      lauf = requestAnimationFrame(() => {
        const mitte = r.scrollLeft + r.clientWidth / 2;
        let best = 0, abstand = Infinity;
        Array.from(r.children).forEach((c, i) => { const e = c as HTMLElement; const d = Math.abs(e.offsetLeft + e.clientWidth / 2 - mitte); if (d < abstand) { abstand = d; best = i; } });
        setAktiv(best);
      });
    };
    r.addEventListener("scroll", beimWischen, { passive: true });
    return () => { r.removeEventListener("scroll", beimWischen); cancelAnimationFrame(lauf); };
  }, []);
  const zuKarte = (i: number) => {
    const r = reihe.current; const el = r?.children[i] as HTMLElement | undefined;
    if (r && el) r.scrollTo({ left: el.offsetLeft - (r.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  };
  return (
    <Dunkel seite="privatkunden" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <Hero
        bild="/kino/karte.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#pakete">{t.paketWaehlen}</Knopf><Knopf href={zu("/werkzeuge/eintrag-pruefen")} still>{t.eintragPruefen}</Knopf></>}
        szene={<KartenSzene anzahl={1} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={t.zahlen} />
      </Block>

      <Block id="weg" pille={t.wegPille} titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>} lead={t.wegLead}>
        <Schritte items={t.weg} />
      </Block>

      <Licht>
        <Block id="pakete" pille={t.paketePille} titel={<>{t.paketeH2a}<span className="dk-verlauf">{t.paketeH2b}</span></>} lead={t.paketeLead} mitte>
          <div className="pk-pakete" ref={reihe}>
            {PAKETE.map((p, i) => {
              const w = t.pakete[p.key];
              return (
                <Auf key={p.key} verzoegerung={i * 90}>
                  <button type="button" className="pk-paket" data-top={p.rec ? "1" : undefined} onClick={() => start(p.key)} aria-label={t.waehlenUndStarten(w.name)}>
                    {p.rec && <span className="band">{t.beliebt}</span>}
                    <div className={`pk-karte pk-karte-${p.key}`} style={{ background: p.bg }} aria-hidden="true">
                      <span className="pk-karte-wort"><FiaonWortmarke /></span>
                      <Kontaktlos />
                      <span className="pk-karte-chip" />
                      <span className="pk-karte-inhaber">{t.karteName}</span>
                      <span className="pk-karte-stufe">{p.stufe}</span>
                    </div>
                    <div className="pk-rahmen">
                      <small>{t.zielRahmen}</small>
                      <b className="dk-verlauf zahl">{rahmen(p.lim)}</b>
                    </div>
                    <p className="name">{w.name}<span className="sub"> · {w.sub}</span></p>
                    <p className="betrag zahl">{preis(p.key)}<small>{t.proMonat}</small></p>
                    <ul className="dk-liste">{w.feats(land).map((f) => <li key={f}>{f}</li>)}</ul>
                    <span className={`dk-knopf${p.rec ? "" : " still"}`}>{t.mitStarten(w.name.replace("FIAON ", ""))}</span>
                  </button>
                </Auf>
              );
            })}
          </div>
          <div className="pk-punkte" role="tablist" aria-label={t.paketePille}>
            {PAKETE.map((p, i) => (
              <button key={p.key} type="button" role="tab" aria-selected={aktiv === i} aria-label={t.pakete[p.key].name} className={aktiv === i ? "an" : undefined} onClick={() => zuKarte(i)} />
            ))}
          </div>
          <p className="dk-leise" style={{ marginTop: 26, maxWidth: "72ch", marginLeft: "auto", marginRight: "auto" }}>{t.paketeHinweis(auskunft)}</p>
        </Block>

        <Block pille={t.tutPille} titel={<>{t.tutH2a}<span className="dk-verlauf">{t.tutH2b}</span></>} mitte>
          <div style={{ textAlign: "left" }}><Karten items={t.tut} /></div>
        </Block>

        <Block pille={t.vergleichPille} titel={<>{t.vergleichH2a}<span className="dk-verlauf">{t.vergleichH2b}</span></>} mitte>
          <div className="pk-vergleich">
            <table>
              <thead><tr>{t.vergleichKopf.map((k, i) => <th key={i} className={i === 3 ? "fiaon" : undefined}>{k}</th>)}</tr></thead>
              <tbody>
                {t.vergleich.map((z) => <tr key={z[0]}><td>{z[0]}</td><td>{z[1]}</td><td>{z[2]}</td><td className="fiaon">{z[3]}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Block>
      </Licht>

      <Szenenbild tief src="/kino/karte.jpg" titel={<>{t.szeneA}<span className="dk-verlauf">{t.szeneB}</span></>} text={t.szeneText} />

      <Block id="karte" pille={t.kartePille} titel={<>{t.karteH2a}<span className="dk-verlauf">{t.karteH2b}</span></>} lead={t.karteLead}>
        <div className="dk-zweispaltig" style={{ marginTop: 48, alignItems: "center" }}>
          <div className="pk-ready-text">
            <div className="dk-raster zwei" style={{ marginTop: 0 }}>
              {t.karte.map((k, i) => <Auf key={k.titel} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
            </div>
          </div>
          <Auf verzoegerung={150}><div className="pk-ready-buehne"><Readiness label={t.readiness} /><p>{t.readinessBeispiel}</p></div></Auf>
        </div>
      </Block>

      <Block pille={t.vertrauenPille} titel={<>{t.vertrauenH2a}<span className="dk-verlauf">{t.vertrauenH2b}</span></>} lead={t.vertrauenLead}>
        <div className="dk-raster" style={{ marginTop: 48 }}>
          {t.vertrauen.map((k, i) => <Auf key={k.tag} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
        </div>
      </Block>

      {/* E-296 (06.10.2026): FIAON auf Instagram und Facebook — erst Beiträge der Privatlinie, unter drei alle. */}
      <SozialFenster aussehen="dunkel" marke="fiaon" ersatz="alle" mindestens={3} />

      <Zwischenruf text={t.zwischenruf} knopf={t.paketWaehlen} href="#pakete" still={{ knopf: t.erstAuskunft, href: zu("/bonitaet") }} />

      <Block schmal pille={t.fragenPille}>
        <Fragen items={t.fragen} />
      </Block>

      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
                 text={t.abschlussText}
                 knoepfe={<><Knopf href="#pakete">{t.paketWaehlen}</Knopf><Knopf href="/demo/kundenbereich" still>{t.bereichAnsehen}</Knopf></>} />
    </Dunkel>
  );
}
