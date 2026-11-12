// ═══════════════════════════════════════════════════════════════════════════
// fiaon.com/ — FIAON GLOBAL: EIN PRODUKT, EIN KONFIGURATOR (Register E-509, 12.11.2026)
//
// Justin (12.11.2026): „wir sollten die Pakete weg — die US LLC Gründung mit aktiver Betreuung (volle Package, perfekt
// animiert anführen aber clean halten, sauber halten, platz lassen, Rechtsberatung rein, Steuerberatung — all das) und
// wenn er dann gründen will kann man auswählen für was man sich interessiert … und dann soll er seine Funding Summe
// auswählen … und dann eben unsere Preise — einfach so gestalten dass der Kunde selbstständig abschließen kann … das
// muss der Motor unserer Plattform sein, der Sales Apparat! — ein WOW Gefühl und Erlebnis für den Klienten.“
//
// ── AUFBAU SEIT E-509 ──────────────────────────────────────────────────────
//   Bühne (eine große dünne Zahl: der eine Preis; Kacheln Kapitalrahmen, Team, Vertrag)
//   → Das eine Produkt (#produkt): acht Bereiche an Haarlinien, daneben die Urkunde mit dem Preis
//   → So läuft es (#ablauf): vier Schritte
//   → Der Konfigurator (#konfigurator): Schwerpunkte, Kapitalrahmen, Preisblatt, Angaben — die EINE dunkle Glasfläche
//   → Geld-zurück-Garantie
//   → Instagram/Facebook (der Vorführraum pausiert, bis Filme und Konzept-PDF zum einen Produkt passen)
//   → Ein Ansprechpartner statt acht (#leistungen), Der Bogen (#bogen)
//   → Erstgespräch (#gespraech) → Fragen (#fragen) → Schlussband → Klebeleiste am Handy.
// Weg seit E-509: die vier Pakettafeln, die Viererwahl, die Vergleichstabelle, der Paketfuß, das Band „Jahresbetreuung“
// und die Etappen-Karten mit „ab Paket“. Die Sätze des Produkts, der Preise und des Konfigurators stehen in
// shared/fiaon-global-verkauf.ts (dieselben Funktionen rechnen im Vertrag); Bühne, Schaltzentrale, Bogen, Gespräch und
// Schlussband behalten ihre abgenommenen Bausteine. Bis E-509 (06.10.2026, E-293): Hero → Pakete → Jahresbetreuung …
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dunkel, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_BUEHNE_WOERTER, GLOBAL_WOERTER, type GlobalBegriff } from "@/i18n/global";
import { GLOBAL_ROLLEN, GLOBAL_INKLUSIVE, GLOBAL_KAPITAL_FREI } from "@shared/fiaon-global";
import { werbeEreignis } from "@/lib/werbung";
import SternZentrale from "@/components/site/global/SternZentrale";
import HeroGlas from "@/components/site/global/HeroGlas";
import GlobalBogen from "@/components/site/global/GlobalBogen";
import GlobalSchlussBild from "@/components/site/global/GlobalSchlussBild";
import { VerkaufProdukt, VerkaufAblauf, VerkaufGarantie } from "@/components/site/global/VerkaufProdukt";
import VerkaufKonfigurator from "@/components/site/global/VerkaufKonfigurator";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { SozialFenster } from "@/components/site/sozial/SozialFenster";
import { BUSINESS_START } from "@shared/fiaon-business-grenze";
import { VERKAUF_TEXTE, VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur, verkaufUsd } from "@shared/fiaon-global-verkauf";
import "@/styles/global.css";
import "@/styles/global-grafik.css";
import "@/styles/global-apple.css";
import "@/styles/global-verkauf.css";

function Winkel({ offen }: { offen: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: offen ? "rotate(180deg)" : undefined, transition: "transform .25s" }}><path d="m6 9 6 6 6-6" /></svg>;
}
const Pfeil = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Ein Abschnitt, der einmal `data-an` bekommt, wenn er ins Bild kommt (Glanz der H2 einmal, Grafiken). */
function Sek({ id, className, children }: { id?: string; className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -25% 0px");
  return <section ref={ref} id={id} className={className} style={id ? { scrollMarginTop: 72 } : undefined}>{children}</section>;
}

// ── ZWEI STARTSEITEN, EIN AUFBAU (19.09.2026, E-196) ─────────────────────────
// /business/privatpersonen zeigt dieselbe Seite mit eigenem Kopf und eigener Schlusszeile (GLOBAL_WOERTER.*.privat).
// Seit E-509 schließt jeder als Person ab (Vertrag der Fassung C) — die beiden Seiten unterscheiden sich nur im Ton.
export default function Business() {
  return <BusinessSeite zielgruppe="unternehmen" />;
}

export function BusinessSeite({ zielgruppe = "unternehmen" }: { zielgruppe?: "unternehmen" | "privat" }) {
  const basis = useWoerter(GLOBAL_WOERTER);
  const privat = zielgruppe === "privat";
  const t = privat ? { ...basis, ...basis.privat } : basis;
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const V = VERKAUF_TEXTE[s];
  // 29.10.2026 (E-461): Die Übersicht ist die Startseite fiaon.com/ (und /en) — vorher /business.
  const seitePfad = privat ? (s === "en" ? "/en/business/private-individuals" : "/business/privatpersonen") : BUSINESS_START[s];
  const preis = verkaufEur(VERKAUF_PREISE.gruendungCents, s);
  const begriff = (k: GlobalBegriff) => ({ wort: t.begriffWoerter[k], erklaerung: t.begriffe[k] });

  const [thema] = useState<string | null>(null);
  const [alleFragen, setAlleFragen] = useState(false);
  // Klebeleiste am Handy: aus, solange Bühne, Konfigurator, Kalender oder Schlussband im Bild stehen.
  const [leiste, setLeiste] = useState(false);
  const fragenRestRef = useRef<HTMLDivElement>(null);
  const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

  useEffect(() => {
    // Wer mit #gespraech oder #konfigurator ankommt (alte Links auf #pakete landen beim Konfigurator), landet dort —
    // erst nach dem ersten Bild, sonst misst der Browser die Höhe der Seite falsch.
    const anker = window.location.hash === "#pakete" || window.location.hash === "#jahresbetreuung" ? "#konfigurator" : window.location.hash;
    if (anker && /^#[A-Za-z][\w-]*$/.test(anker)) requestAnimationFrame(() => setTimeout(() => document.querySelector(anker)?.scrollIntoView(), 60));
  }, []);

  useEffect(() => {
    let bild = 0;
    const messen = () => {
      bild = 0;
      const h = window.innerHeight;
      const rahmen = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
      const imBild = (r: DOMRect | null) => !!r && r.top < h * 0.85 && r.bottom > h * 0.15;
      const kopf = rahmen(".hg");
      const schluss = rahmen(".fg-schluss");
      setLeiste(!(!kopf || kopf.bottom >= 80 || imBild(rahmen("#konfigurator")) || imBild(rahmen("#gespraech")) || (!!schluss && schluss.top < h)));
    };
    const planen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", planen);
    return () => { window.removeEventListener("scroll", planen); window.removeEventListener("resize", planen); if (bild) cancelAnimationFrame(bild); };
  }, []);

  // Die zugeklappten Fragen sind für Tab und Screenreader aus (inert), solange sie zu sind (per Ref: React 18/19 lesen inert verschieden).
  useEffect(() => { fragenRestRef.current?.toggleAttribute("inert", !alleFragen); }, [alleFragen]);

  const zumGespraech = () => document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() });
  const zumKonfigurator = (ort: string) => () => {
    werbeEreignis("global_beauftragen_klick", { seite: seitePfad, ort });
    document.getElementById("konfigurator")?.scrollIntoView({ behavior: glatt() });
  };
  const frei = GLOBAL_KAPITAL_FREI[s];
  const buehne = GLOBAL_BUEHNE_WOERTER[s];

  // Die Fragen stehen im Wörterbuch (i18n/global.ts) — dieselbe Liste, aus der das FAQ-Markup für Suchmaschinen entsteht.
  const fragen = basis.fragen;
  const fragenZuerst = fragen.slice(0, 5);
  const fragenRest = fragen.slice(5);

  // Die Augenzeile: „Privatpersonen“ führt auf die Startseite für Privatpersonen (nicht auf ihr selbst).
  const augeIdx = privat ? -1 : t.auge.indexOf(t.augeLink);
  const auge = augeIdx < 0 ? t.auge : (
    <span>{t.auge.slice(0, augeIdx)}<a href={s === "en" ? "/en/business/private-individuals" : "/business/privatpersonen"}>{t.augeLink}</a>{t.auge.slice(augeIdx + t.augeLink.length)}</span>
  );
  const rahmenSpanne = s === "en"
    ? `${verkaufUsd(VERKAUF_RAHMEN.minUsd, "en")} – ${verkaufUsd(VERKAUF_RAHMEN.maxUsd, "en")}`
    : `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} – ${verkaufUsd(VERKAUF_RAHMEN.maxUsd, "de")}`;

  return (
    <Dunkel seite="business" titel={privat ? t.metaTitel : V.seo.titel} beschreibung={privat ? t.metaBeschreibung : V.seo.beschreibung}>
      <div className="fg fg-neu">
        {/* ── 1 Die Glas-Bühne (E-442): EINE große dünne Zahl — seit E-509 der eine Preis des einen Produkts ── */}
        <HeroGlas en={s === "en"} onPakete={zumKonfigurator("buehne")} onGespraech={zumGespraech} t={{
          auge, ab: "", preis,
          label: V.buehne.label,
          h1a: V.buehne.h1a, h1b: V.buehne.h1b, wechsel: V.buehne.wechsel, lead: V.buehne.lead,
          knopfPakete: V.buehne.knopf, knopfGespraech: V.buehne.knopfGespraech, mikro: V.buehne.mikro,
          kapitalTitel: V.buehne.kapitalTitel, kapitalWert: rahmenSpanne, kapitalSatz: V.buehne.kapitalSatz,
          kapitalFrei: frei.kurz, fussnoteNr: 1, fussnote: `${frei.satz} ${frei.steuer}`,
          personTitel: buehne.person, teamTitel: buehne.teamAuge, teamHinweis: buehne.teamHinweis, teamAnhalten: buehne.teamAnhalten, teamFortsetzen: buehne.teamFortsetzen, vertragTitel: buehne.vertragAuge,
          vertrag: t.vertrauensleiste, mustervertragHref: s === "en" ? "/en/business/mustervertrag" : "/business/mustervertrag",
          weiter: buehne.weiterBlick, blickName: buehne.blickName,
        }} />

        {/* ── 2 Das eine Produkt ── */}
        <VerkaufProdukt sprache={s} onKonfigurator={zumKonfigurator("produkt")} />

        {/* ── 3 So läuft es ── */}
        <VerkaufAblauf sprache={s} />

        {/* ── 4 Der Konfigurator — die eine dunkle Glasfläche der Seite ── */}
        <section className="fg-sek vk-konfig-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{V.konfig.auge}</span><h2 className="fg-h2">{V.konfig.h2a} <em>{V.konfig.h2b}</em></h2></div>
              <p className="fg-lead">{V.konfig.lead}</p>
            </div>
            <VerkaufKonfigurator sprache={s} />
          </div>
        </section>

        {/* ── 5 Geld-zurück-Garantie ── */}
        <VerkaufGarantie sprache={s} />

        {/* E-509 (12.11.2026): Der Vorführraum (E-313: Filme, Kino, Konzept als PDF-Mappe) steht hier vorerst nicht — Konzept-PDF
            und Filme zeigen noch die vier Pakete mit ihren alten Preisen. Er kommt zurück, sobald sie zum einen Produkt passen
            (components/site/global/GlobalVorfuehrraum.tsx bleibt unverändert). */}

        {/* ── 6b FIAON auf Instagram und Facebook (E-296): NUR Beiträge von FIAON Global ── */}
        <SozialFenster aussehen="kanzlei" marke="global" />

        {/* ── 7 Ein Ansprechpartner statt acht ── */}
        <Sek id="leistungen" className="fg-sek fg-stern-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf mitte">
              <div><span className="fg-auge">{t.vsAuge}</span><h2 className="fg-h2">{t.vsH2}</h2></div>
            </div>
            <SternZentrale knoten={t.sternKnoten} ohne={t.ohne} schalter={t.sternSchalter} mitte={t.sternMitte} sie={t.sternSie} legende={t.sternLegende}
              label={t.sternLabel} inklusive={GLOBAL_INKLUSIVE[s]} begriffe={[begriff("registeredAgent"), begriff("operatingAgreement"), begriff("usCpa")]} />
            <div className="fg-stern-unter">
              <p className="fg-stern-partner">{GLOBAL_ROLLEN[s].partner}</p>
            </div>
            <div id="fuer-wen" className="fg-fuer-chips" style={{ scrollMarginTop: 96 }}>
              <span>{t.fuerKurz}</span>
              <ul>
                {t.fuerChips.map((c) => <li key={c.text}>{c.pfad ? <a href={c.pfad}>{c.text}</a> : <span>{c.text}</span>}</li>)}
              </ul>
            </div>
          </div>
        </Sek>

        {/* ── 7b Der Bogen (09.10.2026): Europa → Miami → Kapital zurück nach Europa ── */}
        <Sek id="bogen" className="fg-sek stein fg-bogen-sek">
          <div className="fg-rahmen fg-bogen-raster">
            <div className="fg-bogen-text">
              <span className="fg-auge">{buehne.bogenAuge}</span>
              <h2 className="fg-h2">{buehne.bogenH2a} <em>{buehne.bogenH2b}</em></h2>
              <p className="fg-lead">{buehne.bogenLead}</p>
              <dl className="fg-bogen-punkte">
                {buehne.bogenPunkte.map((p, i) => (
                  <div key={p.titel}><i aria-hidden="true">{["I", "II", "III"][i]}</i><dt>{p.titel}</dt><dd>{p.text}</dd></div>
                ))}
              </dl>
              <div className="fg-knoepfe">
                <button type="button" className="fg-knopf" onClick={zumKonfigurator("bogen")}>{V.buehne.knopf}<Pfeil /></button>
              </div>
            </div>
            <div className="fg-bogen-bild"><GlobalBogen w={buehne} etappen={V.ablauf.schritte.map((x) => x.titel)} /></div>
          </div>
        </Sek>

        {/* ── 8 Erstgespräch ── */}
        <Sek id="gespraech" className="fg-sek fg-gespraech-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2">{t.gespraechH2}</h2></div>
            </div>
            <GlobalGespraech paket={null} thema={thema} punkte={false} />
          </div>
        </Sek>

        {/* ── 9 Fragen: fünf sichtbar, die übrigen im DOM hinter dem Knopf ── */}
        <Sek id="fragen" className="fg-sek stein">
          <div className="fg-rahmen fg-fragen">
            <div className="fg-fragen-kopf">
              <span className="fg-auge">{t.fragenAuge}</span>
              <h2 className="fg-h2">{t.fragenH2}</h2>
              <a className="fg-fragen-alle" href={s === "en" ? "/en/business/faq" : "/business/fragen"}>{t.fragenAlle}<Pfeil /></a>
            </div>
            <div className="fg-fragen-liste">
              <Fragen items={fragenZuerst} start={null} />
              {fragenRest.length > 0 && (
                <>
                  <div id="fg-fragen-rest" ref={fragenRestRef} className={`fg-fragen-rest${alleFragen ? " auf" : ""}`}>
                    <div><Fragen items={fragenRest} start={null} /></div>
                  </div>
                  <button type="button" className="fg-tarif-mehr fg-fragen-mehr" aria-expanded={alleFragen} aria-controls="fg-fragen-rest" onClick={() => setAlleFragen(!alleFragen)}>
                    {alleFragen ? t.wenigerLeistungen : t.fragenAlleZahl(fragen.length)}<Winkel offen={alleFragen} />
                  </button>
                </>
              )}
            </div>
          </div>
        </Sek>

        {/* ── 10 Schlussband ── */}
        <section className="fg-schluss mit-bild">
          <GlobalSchlussBild nachweis={t.szeneKi} />
          <div className="fg-rahmen">
            <div className="fg-schluss-text">
              <h2 className="fg-h2">{t.schlussA}<em>{t.schlussB}</em></h2>
              <div className="fg-knoepfe">
                <button type="button" className="fg-knopf" onClick={zumKonfigurator("schluss")}>{V.buehne.knopf}<Pfeil /></button>
                <button type="button" className="fg-knopf hell" onClick={zumGespraech}>{t.knopfGespraech}</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Klebeleiste am Handy: ein Weg zum Angebot, einer zum Gespräch ── */}
        <div className={`fg-mobil${leiste ? " da" : ""}`} aria-hidden={!leiste}>
          <button type="button" className="hell" onClick={zumGespraech} tabIndex={leiste ? 0 : -1}>{V.leiste.gespraech}</button>
          <button type="button" className="voll" onClick={zumKonfigurator("leiste")} tabIndex={leiste ? 0 : -1}>{V.leiste.zusammenstellen(preis)}</button>
        </div>
      </div>
    </Dunkel>
  );
}
