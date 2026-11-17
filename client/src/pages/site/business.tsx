// ═══════════════════════════════════════════════════════════════════════════
// fiaon.com/ — FIAON GLOBAL: DAS ALTE GEWAND MIT DEN NEUEN INHALTEN (17.11.2026)
//
// Justin (17.11.2026): „Was ist mit unserer Startseite passiert? Wir hatten da mal geile Animationen, geilen Apple-Hero …
// warum wurde das so billig geändert? Auch dass wir bei der Presse waren, kommt gar nicht zur Geltung — ich will mein altes
// Design mit allen neuen Änderungen.“ Und: „nichts soll weg, nur erweitert werden, angepasst an die Änderungen — es muss
// einfach perfekt aussehen.“
// Darum steht wieder das Gewand vom 29.10. (E-442/E-461, von Justin abgenommen) — mit den Inhalten seit E-509 (ein Mandat,
// ein Honorarrechner) und E-510 (Sprachleitfaden, sechs Schritte). Vorher→Nachher: Seit 13.11. stand hier die ruhige
// Kanzlei-Fassung (Satz statt Zahl, Haarlinien, helles Ende, ohne Instagram, Stern, Bogen und Schlussbild).
//
// ── AUFBAU ────────────────────────────────────────────────────────────────────
//   1  Die Glas-Bühne (HeroGlas): Zahl „2.799 €“ mit Glanz, darunter die Zeile zum Erfolgshonorar, Tipp-Zeile, zwei Pillen;
//      beim Scrollen drei Kacheln (Kapitalrahmen · das Team im Wechsel · Ihr Vertrag) und „Auf einen Blick“ als Glasfläche
//   2  Die Presse-Bühne (GlobalPresse) — NEU: „Zitiert in Die Presse“ groß, mit Zeitungsblatt aus Glas
//   3  Ein Mandat: acht Bereiche mit der Urkunde (VerkaufProdukt) — statt der drei Pakettafeln
//   4  Persönlich in Miami (GlobalMiami) — die Navy-Bühne der früheren VIP-Tafel, jetzt „ab 1 Mio. US-Dollar“
//   5  Sechs Schritte (GlobalSchritte) — statt der vier Etappen
//   6  Ihr Angebot: der Honorarrechner (VerkaufKonfigurator)
//   7  Wenn die Finanzierung ausbleibt + Pflichthinweise (VerkaufGarantie) — statt des Kleingedruckten
//   8  Jahresbetreuung als Band (GlobalJahresbetreuung, „im Mandat enthalten“)
//   9  FIAON Global auf Instagram und Facebook (SozialFenster)
//  10  Ein Ansprechpartner statt acht Anlaufstellen (SternZentrale mit Ohne/Mit) + Partnersatz + „Ehrlich gesagt“
//  11  Was FIAON ist — und was nicht, darunter „Für wen“ (VerkaufRolle)
//  12  Von Europa nach Miami — und zurück (GlobalBogen)
//  13  Erstgespräch → 14 Fragen → 15 Schlussband mit Bild (GlobalSchlussBild) → Leiste am Handy
// Nicht zurück: der Vorführraum (beide Filme nennen noch „ab 2.499 Euro“, Pakete und „Kartenleiter“ — er kommt mit neuen
// Filmen wieder) und das Vertrauens-Band als eigene Zeile (seine Tatsachen stehen jetzt in der Vertrag-Kachel, die Presse
// hat ihre eigene Bühne — die Presse-Zeile steht so weiter genau einmal auf der Seite).
// Sätze: Produkt, Honorar, Honorarrechner in shared/fiaon-global-verkauf.ts; feste Sätze in shared/fiaon-global-saetze.ts;
// die Sätze der zurückgeholten Abschnitte in i18n/global.ts (GLOBAL_START_WOERTER).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dunkel, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_WOERTER, GLOBAL_BUEHNE_WOERTER, GLOBAL_START_WOERTER } from "@/i18n/global";
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, GLOBAL_INKLUSIVE } from "@shared/fiaon-global";
import { werbeEreignis } from "@/lib/werbung";
import HeroGlas from "@/components/site/global/HeroGlas";
import GlobalPresse from "@/components/site/global/GlobalPresse";
import GlobalMiami from "@/components/site/global/GlobalMiami";
import SternZentrale from "@/components/site/global/SternZentrale";
import GlobalBogen from "@/components/site/global/GlobalBogen";
import GlobalSchlussBild from "@/components/site/global/GlobalSchlussBild";
import GlobalJahresbetreuung from "@/components/site/GlobalJahresbetreuung";
import { SozialFenster } from "@/components/site/sozial/SozialFenster";
import GlobalSchritte from "@/components/site/global/GlobalSchritte";
import { VerkaufProdukt, VerkaufGarantie, VerkaufRolle } from "@/components/site/global/VerkaufProdukt";
import VerkaufKonfigurator, { VerkaufKonfigLead } from "@/components/site/global/VerkaufKonfigurator";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { sauber } from "@/components/site/global/VerkaufSatz";
import { BUSINESS_START } from "@shared/fiaon-business-grenze";
import { VERKAUF_TEXTE, VERKAUF_PREISE, verkaufEur } from "@shared/fiaon-global-verkauf";
import { SAETZE_BETRAEGE, vertrauensBand } from "@shared/fiaon-global-saetze";
// Kopf der Seite /business/privatpersonen: aus dem Registereintrag — eine Quelle für Titel, Beschreibung, H1 und Einleitung.
import { PRIVAT_SEITE } from "@shared/fiaon-global-seiten/privat";
import { PRIVAT_SEITE_EN } from "@shared/fiaon-global-seiten/en/privat";
import "@/styles/global.css";
import "@/styles/global-grafik.css";
import "@/styles/global-apple.css";
import "@/styles/global-verkauf.css";
import "@/styles/global-startseite.css";

function Winkel({ offen }: { offen: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: offen ? "rotate(180deg)" : undefined, transition: "transform .25s" }}><path d="m6 9 6 6 6-6" /></svg>;
}
const Pfeil = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Ein Abschnitt, der einmal `data-an` bekommt, wenn er ins Bild kommt (Glanz der H2 einmal, Grafiken). */
function Sek({ id, className, titelId, children }: { id?: string; className: string; titelId?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -25% 0px");
  return <section ref={ref} id={id} className={className} aria-labelledby={titelId} style={id ? { scrollMarginTop: 72 } : undefined}>{children}</section>;
}

// ── ZWEI STARTSEITEN, EIN AUFBAU (19.09.2026, E-196) ─────────────────────────
// /business/privatpersonen zeigt dieselbe Seite mit eigenem Kopf (aus dem Registereintrag) und eigener Augenzeile.
// Seit E-509 schließt jeder als Person ab (Vertrag der Fassung C) — die beiden Seiten unterscheiden sich nur im Kopf.
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
  // Der Kopf: auf der Startseite aus VERKAUF_TEXTE (Bühne und Kopf für Suchmaschinen), auf /business/privatpersonen aus dem
  // Registereintrag der Seite — dort stehen Titel, Beschreibung, H1 und Einleitung für Vorab-HTML und Seite an EINER Stelle.
  const eintrag = s === "en" ? PRIVAT_SEITE_EN : PRIVAT_SEITE;
  const kopf = privat
    ? { titel: eintrag.seo.titel, beschreibung: eintrag.seo.beschreibung, auge: basis.privat.auge, h1a: eintrag.h1, h1b: eintrag.h1b ?? "", lead: eintrag.lead }
    : { titel: V.seo.titel, beschreibung: V.seo.beschreibung, auge: V.buehne.auge, h1a: V.buehne.h1a, h1b: V.buehne.h1b, lead: V.buehne.lead };

  const [thema] = useState<string | null>(null);
  const [alleFragen, setAlleFragen] = useState(false);
  // Klebeleiste am Handy: aus, solange Bühne, Honorarrechner, Kalender oder Schlussband im Bild stehen.
  const [leiste, setLeiste] = useState(false);
  const fragenRestRef = useRef<HTMLDivElement>(null);
  const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

  useEffect(() => {
    // Wer mit #gespraech oder #konfigurator ankommt (alte Links auf #pakete landen beim Honorarrechner), landet dort —
    // erst nach dem ersten Bild, sonst misst der Browser die Höhe der Seite falsch. Alte Anker der Abschnitte, die es
    // nicht mehr gibt (#pakete), führen zum Honorarrechner; #leistungen, #bogen und #jahresbetreuung gibt es seit 17.11. wieder.
    const alt: Record<string, string> = { "#pakete": "#konfigurator" };
    const anker = alt[window.location.hash] ?? window.location.hash;
    if (anker && /^#[A-Za-z][\w-]*$/.test(anker)) requestAnimationFrame(() => setTimeout(() => document.querySelector(anker)?.scrollIntoView(), 60));
  }, []);

  useEffect(() => {
    let bild = 0;
    const messen = () => {
      bild = 0;
      const h = window.innerHeight;
      const rahmen = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
      const imBild = (r: DOMRect | null) => !!r && r.top < h * 0.85 && r.bottom > h * 0.15;
      const buehne = rahmen(".hg");
      const schluss = rahmen(".fg-schluss");
      setLeiste(!(!buehne || buehne.bottom >= 80 || imBild(rahmen("#konfigurator")) || imBild(rahmen("#gespraech")) || (!!schluss && schluss.top < h)));
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

  // Die Fragen stehen im Wörterbuch (i18n/global.ts) — dieselbe Liste, aus der das FAQ-Markup für Suchmaschinen entsteht.
  // Sichtbar sind die ersten fünf: die vier Fragen der 30-Sekunden-Probe und „Für wen passt das Mandat nicht?“.
  const fragen = basis.fragen;
  const fragenZuerst = fragen.slice(0, 5);
  const fragenRest = fragen.slice(5);

  // Die Spanne des Kapitalrahmens aus der Preisquelle — sie steht nie ohne ihren Satz (S9 und der Miami-Satz).
  const rahmenSpanne = SAETZE_BETRAEGE[s].rahmen;
  // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — der Hinweis steht am Kapitalrahmen der Bühne (eine Quelle).
  const frei = GLOBAL_KAPITAL_FREI[s];
  // Die Sätze der zurückgeholten Abschnitte (17.11.2026) und die Wörter der Karte „Der Bogen“.
  const st = GLOBAL_START_WOERTER[s];
  const buehne = GLOBAL_BUEHNE_WOERTER[s];
  // Die Vertrag-Kachel: die nachprüfbaren Tatsachen des Vertrauens-Bands außer der Presse-Zeile (die hat ihre eigene Bühne).
  const vertragZeilen = vertrauensBand(s).filter((z) => z.art !== "presse").map((z) => (
    z.art === "register" ? { text: z.text, href: z.adresse ?? undefined, extern: true }
      : z.art === "vertrag" ? { text: z.text, href: z.adresse ?? undefined }
        : { text: z.text }
  ));

  return (
    <Dunkel seite="business" titel={kopf.titel} beschreibung={kopf.beschreibung}>
      <div className="fg fg-neu">
        {/* ── 1 Die Glas-Bühne (E-442, zurück seit 17.11.2026): die Zahl mit Glanz, die Zeile zum Erfolgshonorar, die
               Tipp-Zeile, zwei Pillen; darunter beim Scrollen die drei Kacheln und „Auf einen Blick“. ── */}
        <HeroGlas en={s === "en"} onAngebot={zumKonfigurator("buehne")} onGespraech={zumGespraech} t={{
          auge: kopf.auge, preis, label: V.buehne.label, zahlSatz: V.buehne.honorarZeile,
          h1a: kopf.h1a, h1b: kopf.h1b, wechsel: privat ? undefined : st.wechsel, lead: sauber(kopf.lead),
          knopfPakete: V.buehne.knopf, knopfGespraech: V.buehne.knopfGespraech, mikro: V.buehne.mikro,
          kapitalTitel: V.buehne.kapitalTitel, kapitalWert: rahmenSpanne, kapitalSatz: V.buehne.kapitalSatz,
          kapitalFrei: frei.kurz, fussnoteNr: 1, fussnote: `${frei.satz} ${frei.steuer}`,
          personTitel: st.personTitel, teamTitel: st.teamTitel, teamHinweis: st.teamHinweis, teamAnhalten: st.teamAnhalten, teamFortsetzen: st.teamFortsetzen,
          vertragTitel: st.vertragTitel, vertrag: vertragZeilen, weiter: st.weiter, blickName: V.blick.titel, blick: V.blick.punkte,
        }} />

        {/* ── 2 Die Presse-Bühne (neu, 17.11.2026): „Zitiert in Die Presse“ — die Presse-Zeile genau einmal auf der Seite ── */}
        <GlobalPresse sprache={s} />

        {/* ── 3 Ein Mandat: acht Bereiche mit der Urkunde ── */}
        <VerkaufProdukt sprache={s} onKonfigurator={zumKonfigurator("produkt")} />

        {/* ── 4 Persönlich in Miami — die Navy-Bühne der früheren VIP-Tafel ── */}
        <GlobalMiami w={st.miami} onGespraech={zumGespraech} />

        {/* ── 5 Sechs Schritte, jeder mit seiner Bedingung ── */}
        <GlobalSchritte sprache={s} mehr={V.ablauf.mehr} />

        {/* ── 6 Ihr Angebot: der Honorarrechner ── */}
        <Sek className="fg-sek vk-konfig-sek" titelId="vk-konfig-titel">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{V.konfig.auge}</span><h2 className="fg-h2" id="vk-konfig-titel">{V.konfig.h2a} <em>{V.konfig.h2b}</em></h2></div>
              <VerkaufKonfigLead sprache={s} />
            </div>
            <VerkaufKonfigurator sprache={s} />
          </div>
        </Sek>

        {/* ── 7 Wenn die Finanzierung ausbleibt — und darunter „Was Sie vor dem Mandat wissen müssen“ (immer offen) ── */}
        <VerkaufGarantie sprache={s}>
          <div className="vk-wissen">
            <h2 id="vk-wissen-titel">{t.wissenTitel}</h2>
            <ul>{GLOBAL_PFLICHTHINWEIS[s].map((x, i) => <li key={x} style={{ ["--i" as string]: String(i) }}>{sauber(x)}</li>)}</ul>
          </div>
        </VerkaufGarantie>

        {/* ── 8 Jahresbetreuung als Band (trägt id="jahresbetreuung" selbst) — „im Mandat enthalten“ statt „Paket“ ── */}
        <GlobalJahresbetreuung sprache={s} groesse="band" startPfad="#konfigurator" knopf={st.jbKnopf} so={st.jbSo}
          ueber={{ zeitleiste: st.jbZeit, lead: st.jbLead }} />

        {/* ── 9 FIAON Global auf Instagram und Facebook (E-296): nur Beiträge von FIAON Global ── */}
        <SozialFenster aussehen="kanzlei" marke="global" />

        {/* ── 10 Ein Ansprechpartner statt acht Anlaufstellen — die Schaltzentrale mit „Ohne / Mit FIAON Global“ ── */}
        <Sek id="leistungen" className="fg-sek fg-stern-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf mitte">
              <div><span className="fg-auge">{st.vsAuge}</span><h2 className="fg-h2">{st.vsH2}</h2></div>
            </div>
            <SternZentrale knoten={st.sternKnoten} ohne={st.ohne} schalter={st.sternSchalter} mitte={st.sternMitte} sie={st.sternSie} legende={st.sternLegende}
              label={st.sternLabel} inklusive={GLOBAL_INKLUSIVE[s]} begriffe={[]} />
            <div className="fg-stern-unter">
              <p className="fg-stern-partner">{sauber(V.partnerSatz)}</p>
              <p className="fg-ehrlich-zeile"><b>{st.ehrlichTitel}:</b> {st.ehrlichText}{" "}
                <a href={st.vergleichPfad}>{st.ehrlichLink}<Pfeil /></a></p>
            </div>
          </div>
        </Sek>

        {/* ── 11 Was FIAON ist — und was nicht; darunter „Für wen“ ── */}
        <VerkaufRolle sprache={s}>
          <div id="fuer-wen" className="fg-fuer-chips" style={{ scrollMarginTop: 96 }}>
            <span>{t.fuerKurz}</span>
            <ul>
              {t.fuerChips.map((c) => <li key={c.text}>{c.pfad ? <a href={c.pfad}>{c.text}</a> : <span>{c.text}</span>}</li>)}
            </ul>
          </div>
        </VerkaufRolle>

        {/* ── 12 Der Bogen: Europa → Miami → sechs Schritte → Mittel auch zurück nach Europa ── */}
        <Sek id="bogen" className="fg-sek stein fg-bogen-sek">
          <div className="fg-rahmen fg-bogen-raster">
            <div className="fg-bogen-text">
              <span className="fg-auge">{st.bogenAuge}</span>
              <h2 className="fg-h2">{st.bogenH2a} <em>{st.bogenH2b}</em></h2>
              <p className="fg-lead">{st.bogenLead}</p>
              <dl className="fg-bogen-punkte">
                {st.bogenPunkte.map((p, i) => (
                  <div key={p.titel}><i aria-hidden="true">{["I", "II", "III"][i]}</i><dt>{p.titel}</dt><dd>{p.text}</dd></div>
                ))}
              </dl>
              <div className="fg-knoepfe">
                <button type="button" className="fg-knopf" onClick={zumGespraech}>{st.bogenKnopf}<Pfeil /></button>
              </div>
            </div>
            <div className="fg-bogen-bild"><GlobalBogen w={buehne} etappen={buehne.bogenEtappenKurz} /></div>
          </div>
        </Sek>

        {/* ── 13 Erstgespräch ── */}
        <Sek id="gespraech" className="fg-sek fg-gespraech-sek" titelId="fg-gespraech-titel">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2" id="fg-gespraech-titel">{t.gespraechH2}</h2></div>
            </div>
            <GlobalGespraech paket={null} thema={thema} punkte={false} />
          </div>
        </Sek>

        {/* ── 14 Fragen: fünf sichtbar, die übrigen im DOM hinter dem Knopf ── */}
        <Sek id="fragen" className="fg-sek stein" titelId="fg-fragen-titel">
          <div className="fg-rahmen fg-fragen">
            <div className="fg-fragen-kopf">
              <span className="fg-auge">{t.fragenAuge}</span>
              <h2 className="fg-h2" id="fg-fragen-titel">{t.fragenH2}</h2>
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

        {/* ── 15 Schlussband mit Bild (Szene mit KI erstellt — der Nachweis steht am Bild) ── */}
        <section className="fg-schluss mit-bild" aria-labelledby="fg-schluss-titel">
          <GlobalSchlussBild nachweis={t.szeneKi} />
          <div className="fg-rahmen">
            <div className="fg-schluss-text">
              <h2 className="fg-h2" id="fg-schluss-titel">{t.schlussA}<em>{t.schlussB}</em></h2>
              <div className="fg-knoepfe">
                <button type="button" className="fg-knopf" onClick={zumKonfigurator("schluss")}>{V.buehne.knopf}<Pfeil /></button>
                <button type="button" className="fg-knopf hell" onClick={zumGespraech}>{V.buehne.knopfGespraech}</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Leiste am Handy: ein Weg zum Angebot, einer zum Gespräch — dieselben zwei Namen wie überall ── */}
        <div className={`fg-mobil${leiste ? " da" : ""}`} aria-hidden={!leiste}>
          <button type="button" className="hell" onClick={zumGespraech} tabIndex={leiste ? 0 : -1}>{V.leiste.gespraech}</button>
          <button type="button" className="voll" onClick={zumKonfigurator("leiste")} tabIndex={leiste ? 0 : -1}>{V.leiste.zusammenstellen(preis)}</button>
        </div>
      </div>
    </Dunkel>
  );
}
