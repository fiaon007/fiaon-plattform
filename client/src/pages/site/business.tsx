// ═══════════════════════════════════════════════════════════════════════════
// fiaon.com/ — FIAON GLOBAL: EIN MANDAT, EIN HONORARRECHNER (Register E-509, 12.11.2026; Kanzlei-Ton E-510, 13.11.2026)
//
// Justin (12.11.2026): „wir sollten die Pakete weg — die US LLC Gründung mit aktiver Betreuung (volle Package, perfekt
// animiert anführen aber clean halten, sauber halten, platz lassen, Rechtsberatung rein, Steuerberatung — all das) …
// das muss der Motor unserer Plattform sein, der Sales Apparat! — ein WOW Gefühl und Erlebnis für den Klienten.“
// Und am selben Tag (E-510): „auf JEDER Seite muss das Wording geändert werden … keine Magie, sondern knallharte Fakten —
// präsentiere uns wie eine Kanzlei, wie internationale Unternehmensberater.“
//
// ── AUFBAU SEIT E-510 (Sprachleitfaden FIAON Global, Abschnitt 7.1; Gestaltung nach UX-Prüfung 3.10) ─────────
//   1  Bühne — DER SATZ IST DAS GRÖSSTE: die Überschrift ganz sichtbar („US-Gesellschaft gründen. In einem Mandat.“),
//      zwei Handlungen, darunter die Tatsachenreihe an einer Haarlinie (Honorar zum Auftrag · Spanne des Kapitalrahmens,
//      jede Zahl mit ihrem Satz). Unter der Bühne „Auf einen Blick“ (#auf-einen-blick): die vier Antworten der
//      30-Sekunden-Probe als Zeilen an Haarlinien.
//   2  Vertrauens-Band — vier nachprüfbare Tatsachen, jede mit ihrem Beleg (GlobalVertrauen.tsx)
//   3  Ein Mandat (#produkt) — acht Bereiche an Haarlinien, daneben die Urkunde mit dem Honorar zum Auftrag
//   4  Sechs Schritte (#ablauf) — das Herzstück: eine Linie von Schritt zu Schritt; je Schritt Satz, Bedingung,
//      Ihr Teil, Ihr Ergebnis und der, der entscheidet
//   5  Ihr Angebot (#konfigurator) — der Honorarrechner, die EINE dunkle Glasfläche der Seite
//   6  Wenn die Finanzierung ausbleibt (#geld-zurueck) — Geld-zurück-Garantie in der Mittel-Form als Band an Haarlinien,
//      im selben Band „Was Sie vor dem Mandat wissen müssen“ (die drei Pflichthinweise, Wortlaut wie im Vertrag)
//   7  Was FIAON ist — und was nicht (#rolle), darunter „Für wen“ (#fuer-wen)
//   8  Erstgespräch (#gespraech) → 9 Fragen (#fragen) → 10 Schluss (hell, an einer Linie, ohne Bild) → Leiste am Handy.
// Nach dem Honorarrechner steht kein Abschnitt mehr, der erst überzeugen soll (Leitfaden 7.1). Deshalb stehen seit E-510
// nicht mehr auf der Startseite: Instagram und Facebook (die Verweise stehen im Fuß), der Stern „Ein Ansprechpartner statt
// acht“ (er zeigt Partner bei der Arbeit — solche Sätze gehen erst live, wenn die Partner bestätigt sind), der Bogen nach
// Miami (zweite dunkle Fläche, „Team vor Ort“) und das Bild im Schlussband (dritte dunkle Fläche, erzeugter Raum). Die
// Bausteine selbst bleiben unverändert in ihren Dateien.
// Die Sätze des Produkts, des Honorars und des Honorarrechners stehen in shared/fiaon-global-verkauf.ts (dieselben
// Funktionen rechnen im Vertrag), die festen Sätze in shared/fiaon-global-saetze.ts.
//
// Die Klasse „fg-start“ am Rahmen trägt Raster und Schriftleiter der Startseite (styles/global-verkauf.css, Abschnitt 0):
// gleiche Luft je Abschnitt, Überschriften ruhig in der Schriftfarbe (kein Lichtstreif mehr über jeder H2), der zweite
// Teil einer Überschrift leiser. Im Honorarrechner selbst übernimmt am Handy seine eigene Leiste (VerkaufKonfigurator) —
// die Leiste dieser Seite ruht dann.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dunkel, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_WOERTER } from "@/i18n/global";
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "@shared/fiaon-global";
import { werbeEreignis } from "@/lib/werbung";
import HeroGlas from "@/components/site/global/HeroGlas";
import GlobalVertrauen from "@/components/site/global/GlobalVertrauen";
import GlobalSchritte from "@/components/site/global/GlobalSchritte";
import { VerkaufProdukt, VerkaufGarantie, VerkaufRolle } from "@/components/site/global/VerkaufProdukt";
import VerkaufKonfigurator, { VerkaufKonfigLead } from "@/components/site/global/VerkaufKonfigurator";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { sauber } from "@/components/site/global/VerkaufSatz";
import { BUSINESS_START } from "@shared/fiaon-business-grenze";
import { VERKAUF_TEXTE, VERKAUF_PREISE, verkaufEur } from "@shared/fiaon-global-verkauf";
import { SAETZE_BETRAEGE } from "@shared/fiaon-global-saetze";
// Kopf der Seite /business/privatpersonen: aus dem Registereintrag — eine Quelle für Titel, Beschreibung, H1 und Einleitung.
import { PRIVAT_SEITE } from "@shared/fiaon-global-seiten/privat";
import { PRIVAT_SEITE_EN } from "@shared/fiaon-global-seiten/en/privat";
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
    // nicht mehr gibt (#leistungen, #bogen), führen zum einen Mandat.
    const alt: Record<string, string> = { "#pakete": "#konfigurator", "#jahresbetreuung": "#konfigurator", "#leistungen": "#produkt", "#bogen": "#ablauf" };
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

  return (
    <Dunkel seite="business" titel={kopf.titel} beschreibung={kopf.beschreibung}>
      <div className="fg fg-neu fg-start">
        {/* ── 1 Die Bühne (E-442, E-510): der Satz groß, zwei Handlungen, darunter die Tatsachenreihe — das Honorar zum Auftrag
               (mit der Zeile zum Erfolgshonorar) und die Spanne des Kapitalrahmens (mit S9 und dem Miami-Satz). Unter der
               Bühne: „Auf einen Blick“ — die vier Antworten der 30-Sekunden-Probe. ── */}
        <HeroGlas onAngebot={zumKonfigurator("buehne")} onGespraech={zumGespraech} t={{
          auge: kopf.auge, h1a: kopf.h1a, h1b: kopf.h1b, lead: sauber(kopf.lead),
          knopfAngebot: V.buehne.knopf, knopfGespraech: V.buehne.knopfGespraech, mikro: V.buehne.mikro,
          preis, label: V.buehne.label, honorarZeile: V.buehne.honorarZeile,
          kapitalTitel: V.buehne.kapitalTitel, kapitalWert: rahmenSpanne, kapitalSatz: V.buehne.kapitalSatz,
          kapitalFrei: frei.kurz, fussnote: `${frei.satz} ${frei.steuer}`,
          blickName: V.blick.titel, blick: V.blick.punkte,
        }} />

        {/* ── 2 Das Vertrauens-Band: Register, Presse-Zeile, Vertrag vor der Unterschrift, Zahlung per Rechnung ── */}
        <GlobalVertrauen sprache={s} />

        {/* ── 3 Ein Mandat: acht Bereiche ── */}
        <VerkaufProdukt sprache={s} onKonfigurator={zumKonfigurator("produkt")} />

        {/* ── 4 Sechs Schritte, jeder mit seiner Bedingung ── */}
        <GlobalSchritte sprache={s} mehr={V.ablauf.mehr} />

        {/* ── 5 Ihr Angebot: der Honorarrechner — die eine dunkle Glasfläche der Seite ── */}
        <Sek className="fg-sek vk-konfig-sek" titelId="vk-konfig-titel">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{V.konfig.auge}</span><h2 className="fg-h2" id="vk-konfig-titel">{V.konfig.h2a} <em>{V.konfig.h2b}</em></h2></div>
              <VerkaufKonfigLead sprache={s} />
            </div>
            <VerkaufKonfigurator sprache={s} />
          </div>
        </Sek>

        {/* ── 6 Wenn die Finanzierung ausbleibt: Geld-zurück-Garantie in der Mittel-Form — ein Band an Haarlinien.
               Im selben Band darunter: „Was Sie vor dem Mandat wissen müssen“ (die drei Pflichthinweise, Wortlaut wie im
               Vertrag) — immer offen. ── */}
        <VerkaufGarantie sprache={s}>
          <div className="vk-wissen">
            <h2 id="vk-wissen-titel">{t.wissenTitel}</h2>
            <ul>{GLOBAL_PFLICHTHINWEIS[s].map((x, i) => <li key={x} style={{ ["--i" as string]: String(i) }}>{sauber(x)}</li>)}</ul>
          </div>
        </VerkaufGarantie>

        {/* ── 7 Was FIAON ist — und was nicht; darunter „Für wen“ mit den Verweisen auf die Zielgruppen-Seiten ── */}
        <VerkaufRolle sprache={s}>
          <div id="fuer-wen" className="fg-fuer-chips" style={{ scrollMarginTop: 96 }}>
            <span>{t.fuerKurz}</span>
            <ul>
              {t.fuerChips.map((c) => <li key={c.text}>{c.pfad ? <a href={c.pfad}>{c.text}</a> : <span>{c.text}</span>}</li>)}
            </ul>
          </div>
        </VerkaufRolle>

        {/* ── 8 Erstgespräch ── */}
        <Sek id="gespraech" className="fg-sek fg-gespraech-sek" titelId="fg-gespraech-titel">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2" id="fg-gespraech-titel">{t.gespraechH2}</h2></div>
            </div>
            <GlobalGespraech paket={null} thema={thema} punkte={false} />
          </div>
        </Sek>

        {/* ── 9 Fragen: fünf sichtbar, die übrigen im DOM hinter dem Knopf ── */}
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

        {/* ── 10 Schluss: ein Satz, zwei Knöpfe (Leitfaden 7.1) — hell, an einer Linie, ohne Bild. Die eine dunkle Fläche
               der Seite ist der Honorarrechner (UX-Prüfung 3.6). ── */}
        <section className="fg-schluss ruhig hell" aria-labelledby="fg-schluss-titel">
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
