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
import { useEffect, useState } from "react";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PRIVATKUNDEN_WOERTER } from "@/i18n/privatkunden";
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Licht, Szenenbild } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import { paket as paketVon, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import "@/styles/privatkunden.css";

// Die Pakete: Schlüssel, Name, Ziel-Rahmen, Farbe — die Texte (Untertitel,
// Ziel, Leistungen) stehen im Wörterbuch unter demselben Schlüssel.
const PAKETE = [
  { key: "start", name: "FIAON Start", lim: 500, bg: "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)" },
  { key: "pro", name: "FIAON Pro", lim: 5000, rec: true, bg: "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)" },
  { key: "ultra", name: "FIAON Ultra", lim: 15000, bg: "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)" },
  { key: "highend", name: "FIAON High End", lim: 25000, bg: "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)" },
];

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
  const zu = (p: string) => inSprache(p, sprache);
  // Preise in der Sprache der Seite: 7,99 € (de) — €7.99 (en).
  const preis = (key: string) => { const c = paketVon(key)?.preisCents ?? 0; return en ? "€" + (c / 100).toFixed(2) : (c / 100).toFixed(2).replace(".", ",") + " €"; };
  const auskunft = en ? "€" + SCHUFA_PREIS_EURO.toFixed(2) : SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";
  const start = (key: string) => { try { sessionStorage.setItem("fiaon_paket", key); } catch { /* egal */ } window.location.href = `/antrag?pack=${key}&src=privatkunden`; };
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
          <div className="pk-pakete">
            {PAKETE.map((p, i) => {
              const w = t.pakete[p.key];
              return (
                <Auf key={p.key} verzoegerung={i * 90}>
                  <button type="button" className="pk-paket" data-top={p.rec ? "1" : undefined} onClick={() => start(p.key)} aria-label={t.waehlenUndStarten(p.name)}>
                    {p.rec && <span className="band">{t.beliebt}</span>}
                    <div className="pk-karte" style={{ background: p.bg }}>
                      <span className="chip" /><span className="wort">FIAON</span>
                      <span className="limit">{en ? "€" + p.lim.toLocaleString("en-GB") : p.lim.toLocaleString("de-DE") + " €"}</span>
                      <span className="inhaber">{t.zielRahmen}</span>
                    </div>
                    <p className="name">{p.name}</p>
                    <p className="sub">{w.sub}</p>
                    <p className="betrag dk-verlauf zahl">{preis(p.key)}<small>{t.proMonat}</small></p>
                    <p className="ziel">{t.ziel}{w.ziel}</p>
                    <ul className="dk-liste">{w.feats.map((f) => <li key={f}>{f}</li>)}</ul>
                    <span className={`dk-knopf${p.rec ? "" : " still"}`}>{t.mitStarten(p.name.replace("FIAON ", ""))}</span>
                  </button>
                </Auf>
              );
            })}
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
