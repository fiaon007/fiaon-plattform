// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL (Neubau 17.09.2026, neu gestaltet 18.09.2026, E-188;
// neu geordnet 19.09.2026, E-192; neu gebaut 06.10.2026, E-293)
//
// Justin (17.09.): „FIAON positioniert sich für den B2B-Sektor komplett neu …
// Firmengründung in den USA, Steuerberater, Kreditkarten-System, Fundings —
// alles remote und über uns." Justin (19.09., /goal): „Die Business Seite muss
// PERFEKT sein, dass sie konvertieren kann … aus JEDER Perspektive."
// Justin (06.10., Logbuch): „Business-Bereich übersichtlicher, grafischer,
// moderner, Texte neu (auch Bürgschaft bei ausgewählten Kunden)."
//
// ── AUFBAU SEIT 06.10.2026 (BAUPLAN /business, Scheibe A) ──────────────────
// Gemessen waren 17,7 Bildschirme und rund 2.730 Wörter; die Pakete begannen
// erst nach vier Bildschirmen. Jetzt eine Seite, ein Weg, ein Preis:
//   Hero (Kapitalrahmen UND Festpreis im ersten Bild, Urkunde, Vertrauensleiste)
//   → Pakete (#pakete) mit Wegleiste (#ablauf), drei Tafeln, VIP-Bühne, Klappe
//     „Alle Leistungen im Vergleich“ (#vergleich), Paketfuß, Beleg „Im Festpreis“
//     und dem Kleingedruckten in drei Spalten (Geld zurück, Nicht im Festpreis,
//     Pflichthinweise — immer offen, nie geklappt)
//   → Jahresbetreuung als Band (#jahresbetreuung)
//   → Ein Ansprechpartner statt acht (#leistungen: Stern, Partnersatz, Ehrlich-
//     Zeile, Für-wen-Chips #fuer-wen)
//   → Persönliches Angebot mit Bürgschaftszusage (#persoenliches-angebot, nur bei
//     GLOBAL_BUERGSCHAFT_SEITE.aktiv und deutsch — Start: aus)
//   → Erstgespräch (#gespraech) → Fragen (#fragen, fünf sichtbar) → Schlussband
//   → Klebeleiste am Handy (vier Lagen, Bauplan 2.12).
// Weg: Mandat-Karte, Nachrichtenlage (jetzt auf /business/wissen), „Der Weg“ als
// Abschnitt, Für-wen-Kacheln, drei Uhren (jetzt „Drei Orte“ im Fuß), „Klare
// Verhältnisse“, Kontaktkasten. Grafiken in Scheibe A als ruhige Haarlinien;
// Bewegung (Scheibe B) und Higgsfield-Objekte (Scheibe C) folgen.
//
// Gestrichen bleibt (17.–19.09.): Justins eigener Fall, das Team, „Aus einer
// Hand“ als Doppelung. Preise kommen aus dem Katalog (shared/fiaon-pakete.ts),
// Leistungen, Inklusivliste, Vergleich und Pflichthinweise aus
// shared/fiaon-global.ts — dieselben Sätze stehen im Vertrag.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dunkel, Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_WOERTER, type GlobalBegriff } from "@/i18n/global";
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_INKLUSIVE, GLOBAL_LAUFEND,
  GLOBAL_NICHT_INKLUSIVE, GLOBAL_VERGLEICH, GLOBAL_KAPITAL_FREI, GLOBAL_BUERGSCHAFT_SEITE, globalPaket, globalPreisText, globalPlanungText,
  globalKapitalSpanne, globalJahresbetreuungPreisText,
} from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { GLOBAL_VERBUNDEN } from "@shared/fiaon-global-partner";
import { globalSeite } from "@shared/fiaon-global-seiten";
import { werbeEreignis } from "@/lib/werbung";
import GlobalJahresbetreuung from "@/components/site/GlobalJahresbetreuung";
import GlobalTafel, { Haken, Pfeil, TAFEL_ETAPPE_AB, TAFEL_ZUERST, tafelEtappenBis } from "@/components/site/global/GlobalTafel";
import WegLinie from "@/components/site/global/WegLinie";
import GlobalStern from "@/components/site/global/GlobalStern";
import GlobalBeleg from "@/components/site/global/GlobalBeleg";
import GlobalBuergschaft from "@/components/site/global/GlobalBuergschaft";
import GlobalObjekt from "@/components/site/global/GlobalObjekt";
import HeroLinie from "@/components/site/global/HeroLinie";
import GlobalSchlussBild from "@/components/site/global/GlobalSchlussBild";
import { GLOBAL_BILDER } from "@/lib/global-bilder";
import { mitBegriffen } from "@/components/site/global/Begriff";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { SozialFenster } from "@/components/site/sozial/SozialFenster";
import "@/styles/global.css";
import "@/styles/global-grafik.css";

function Winkel({ offen }: { offen: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: offen ? "rotate(180deg)" : undefined, transition: "transform .25s" }}><path d="m6 9 6 6 6-6" /></svg>;
}

const FOKUS = "global_kapital";
/** „Struktur“ statt „Global Struktur“ — in der Viererwahl und der Klebeleiste am Handy (dort zählt jede Zeile). */
const kurzName = (name: string) => name.replace(/^Global\s+/, "");
/** Etappen und Reihenfolge der Leistungen je Tafel: eine Quelle in GlobalTafel.tsx, die auch die Unterseiten lesen
 *  (06.10.2026, E-293). Hier nur nach Index der Tafel. */
const ETAPPE_AB = TAFEL_ETAPPE_AB;
const etappenBis = (i: number) => tafelEtappenBis(GLOBAL_PAKETE[i]?.key ?? "global_struktur");
const ZUERST = TAFEL_ZUERST;
/** Die fünf sichtbaren Fragen (Index im Wörterbuch, dessen Reihenfolge das FAQ-Markup trägt); der Rest hinter „Alle 17 Fragen“. */
const FRAGEN_ZUERST = [0, 1, 7, 3, 5];

/** Ein Abschnitt, der einmal `data-an` bekommt, wenn er ins Bild kommt (Glanz der H2 einmal, Grafiken).
 *  06.10.2026 (E-293, Gutachten): Schwelle 0 mit einem Rand statt eines Anteils der Höhe — #pakete ist am Handy
 *  rund 3.270 px hoch, 15 % davon (490 px) passen in kein Handy quer; dann käme data-an nie. */
function Sek({ id, className, children }: { id?: string; className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -25% 0px");
  return <section ref={ref} id={id} className={className} style={id ? { scrollMarginTop: 72 } : undefined}>{children}</section>;
}

/** Die Linien-Zeichen der Vertrauensleiste: Paragraf, Dokument, Rechnung, Register. */
function LeistenZeichen({ i }: { i: number }) {
  const pfade = [
    "M8.5 4.5c-2-1.6-5-.6-4.4 1.5.6 2.2 6.4 2.6 6.4 5.3 0 1.8-2.5 2.4-3.9 1.4M11.5 15.5c2 1.6 5 .6 4.4-1.5-.6-2.2-6.4-2.6-6.4-5.3 0-1.8 2.5-2.4 3.9-1.4",
    "M5.5 2.5h6.5l3.5 3.5v11.5h-10zM12 2.5V6h3.5M8 10h5M8 13h5",
    "M5 2.5h10v15l-2-1.3-1.7 1.3-1.6-1.3L8 17.5l-1.5-1.3L5 17.5zM7.5 7h5M7.5 10h5M7.5 13h3",
    "M3 7.5 10 3l7 4.5M4 8h12M5.5 9v6M10 9v6M14.5 9v6M3.5 16.5h13",
  ];
  return <svg className="fg-leiste-zeichen" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={pfade[i]} /></svg>;
}

// ── ZWEI STARTSEITEN, EIN AUFBAU (19.09.2026, E-196) ─────────────────────────
// Justin: „Auf /business/privatpersonen soll die Privatperson auch die anderen
// Pakete zur Auswahl bekommen". Dieselbe Seite mit eigenem Kopf, eigenen Fragen
// und eigenen Für-wen-Chips (GLOBAL_WOERTER.*.privat); jede Paket-Tafel führt in
// den Auftrag als Privatperson (?art=privat).
export default function Business() {
  return <BusinessSeite zielgruppe="unternehmen" />;
}

export function BusinessSeite({ zielgruppe = "unternehmen" }: { zielgruppe?: "unternehmen" | "privat" }) {
  const basis = useWoerter(GLOBAL_WOERTER);
  const privat = zielgruppe === "privat";
  const t = privat ? { ...basis, ...basis.privat } : basis;
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const start = (paket?: string) => globalStartPfad(paket, s, privat ? "privat" : undefined);
  const seitePfad = privat ? (s === "en" ? "/en/business/private-individuals" : "/business/privatpersonen") : s === "en" ? "/en/business" : "/business";
  const abPreis = globalPreisText("global_struktur", s);
  const begriff = (k: GlobalBegriff) => ({ wort: t.begriffWoerter[k], erklaerung: t.begriffe[k] });

  // Der Paketwunsch reist von der Tafel („Erst sprechen") in den Kalender, das Thema vom persönlichen Angebot.
  const [wunsch, setWunsch] = useState<string | null>(null);
  const [thema, setThema] = useState<string | null>(null);
  // Am Handy: welche Tafel der Wischreihe gerade in der Mitte steht (Startwert Global Struktur oder ?paket=).
  const [mobilPaket, setMobilPaket] = useState<string>("global_struktur");
  const [tabelleAuf, setTabelleAuf] = useState(false);
  const [alleFragen, setAlleFragen] = useState(false);
  // Klebeleiste am Handy: aus (Hero, Kalender, Angebot, Schlussband) · vor den Paketen · in den Paketen · danach.
  const [leiste, setLeiste] = useState<"aus" | "vor" | "in" | "nach">("aus");
  const tafeln = useRef<HTMLDivElement>(null);
  const fragenRestRef = useRef<HTMLDivElement>(null);
  const handy = () => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 640px)").matches;
  const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

  /** Die Wischreihe am Handy auf eine Tafel stellen — waagerecht, ohne die Seite zu verschieben. */
  const wischeZu = (key: string, verhalten: ScrollBehavior) => {
    const reihe = tafeln.current;
    const el = document.getElementById(`paket-${key}`)?.closest<HTMLElement>(".dk-auf");
    if (!reihe || !el || !handy()) return;
    reihe.scrollTo({ left: el.offsetLeft - (reihe.clientWidth - el.clientWidth) / 2, behavior: verhalten });
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paket");
    if (p) setWunsch(p);
    if (p && globalPaket(p)) { setMobilPaket(globalPaket(p)!.key); requestAnimationFrame(() => wischeZu(globalPaket(p)!.key, "auto")); }
    // Wer mit #gespraech oder #pakete ankommt (z. B. von /termin?quelle=global), landet dort —
    // erst nach dem ersten Bild, sonst misst der Browser die Höhe der Seite falsch.
    const anker = window.location.hash;
    if (anker) requestAnimationFrame(() => setTimeout(() => document.querySelector(anker)?.scrollIntoView(), 60));
  }, []);

  // Am Handy setzt die Tafel in der Mitte der Wischreihe die Wahl (Viererwahl, Klebeleiste, Wegleiste) — aber erst,
  // wenn das Wischen zur Ruhe gekommen ist. 06.10.2026 (Justin: „beim Wischen stecken die“): Vorher wechselte ein
  // IntersectionObserver die Wahl MITTEN im Wischen, die Reihe änderte daraufhin ihre Höhe (animiert), und Safari
  // rastete beim Neuberechnen auf die alte Tafel zurück. Jetzt ändert sich während des Wischens nichts am Layout.
  const wischtBis = useRef(0);
  useEffect(() => {
    const reihe = tafeln.current;
    if (!reihe) return;
    let ruhe = 0;
    const mitte = () => {
      if (!handy()) return;
      const r = reihe.getBoundingClientRect();
      const ziel = r.left + r.width / 2;
      let best: HTMLElement | null = null, abstand = Infinity;
      reihe.querySelectorAll<HTMLElement>("[id^='paket-']").forEach((el) => {
        const b = el.getBoundingClientRect();
        const d = Math.abs(b.left + b.width / 2 - ziel);
        if (d < abstand) { abstand = d; best = el; }
      });
      if (best) setMobilPaket((best as HTMLElement).id.replace(/^paket-/, ""));
    };
    const beimWischen = () => {
      wischtBis.current = Date.now() + 160;
      window.clearTimeout(ruhe);
      ruhe = window.setTimeout(mitte, 160);
    };
    reihe.addEventListener("scroll", beimWischen, { passive: true });
    return () => { reihe.removeEventListener("scroll", beimWischen); window.clearTimeout(ruhe); };
  }, []);

  // Am Handy ist die Wischreihe so hoch wie die Tafel in der Mitte — nicht wie die längste (Global VIP), sonst
  // klafft unter Global Struktur eine Lücke. Aufgeklappte Leistungen ändern die Höhe mit (ResizeObserver). Die Höhe
  // wird nie während des Wischens gesetzt (siehe oben), sonst rastet Safari zurück.
  useEffect(() => {
    const reihe = tafeln.current;
    const el = document.getElementById(`paket-${mobilPaket}`);
    if (!reihe || !el) return;
    let warten = 0;
    const setzen = () => {
      window.clearTimeout(warten);
      const rest = wischtBis.current - Date.now();
      if (rest > 0) { warten = window.setTimeout(setzen, rest + 20); return; }
      reihe.style.height = handy() ? `${el.offsetHeight + 22}px` : "";
    };
    setzen();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(setzen);
    ro?.observe(el);
    window.addEventListener("resize", setzen);
    return () => { ro?.disconnect(); window.removeEventListener("resize", setzen); window.clearTimeout(warten); };
  }, [mobilPaket]);

  // 06.10.2026 (E-293, Gutachten): Im Paketabschnitt klebten am Handy drei Leisten zugleich (Kopf 73 px, Viererwahl
  // ≈ 62 px, Klebeleiste 64 px) — ein Viertel des Bildschirms genau dort, wo gewählt wird. Beim Abwärtsscrollen in
  // #pakete fährt der Kopf deshalb ein (html.fg-kopf-weg, styles/global-grafik.css), beim Aufwärtsscrollen kommt er
  // wieder; die Viererwahl rückt dann nach oben. Außerhalb von #pakete steht der Kopf immer.
  useEffect(() => {
    let bild = 0;
    let zuletzt = window.scrollY;
    const kopfWeg = (an: boolean) => document.documentElement.classList.toggle("fg-kopf-weg", an);
    const messen = () => {
      bild = 0;
      const y = window.scrollY;
      const runter = y > zuletzt + 2;
      const hoch = y < zuletzt - 2;
      if (runter || hoch) zuletzt = y;
      const h = window.innerHeight;
      const rahmen = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
      const imBild = (r: DOMRect | null) => !!r && r.top < h * 0.85 && r.bottom > h * 0.15;
      const kopf = rahmen(".fg-hero");
      const pakete = rahmen("#pakete");
      const schluss = rahmen(".fg-schluss");
      const inPaketen = handy() && !!pakete && pakete.top < 0 && pakete.bottom > h * 0.5;
      if (!inPaketen) kopfWeg(false);
      else if (runter) kopfWeg(true);
      else if (hoch) kopfWeg(false);
      if (!kopf || kopf.bottom >= 80 || imBild(rahmen("#gespraech")) || imBild(rahmen("#persoenliches-angebot")) || (!!schluss && schluss.top < h)) { setLeiste("aus"); return; }
      if (!pakete || pakete.top > h * 0.5) setLeiste("vor");
      else if (pakete.bottom > h * 0.5) setLeiste("in");
      else setLeiste("nach");
    };
    const planen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", planen);
    return () => { window.removeEventListener("scroll", planen); window.removeEventListener("resize", planen); if (bild) cancelAnimationFrame(bild); kopfWeg(false); };
  }, []);

  // Die zugeklappten Fragen sind für Tab und Screenreader aus (inert), solange sie zu sind. Per Ref statt als
  // JSX-Attribut: React 18 setzt inert="" als Attribut, React 19 liest "" als false — nach einem Update wären
  // die zwölf unsichtbaren Fragen sonst wieder per Tab erreichbar (06.10.2026, E-293, Gutachten).
  useEffect(() => { fragenRestRef.current?.toggleAttribute("inert", !alleFragen); }, [alleFragen]);

  const zumGespraech = (paket?: string, neuesThema?: string) => {
    if (paket) setWunsch(paket);
    if (neuesThema) setThema(neuesThema);
    document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() });
  };
  const zuDenPaketen = () => document.getElementById("pakete")?.scrollIntoView({ behavior: glatt() });
  const zurJahresbetreuung = (e: React.MouseEvent) => { e.preventDefault(); document.getElementById("jahresbetreuung")?.scrollIntoView({ behavior: glatt() }); };
  // Antippen der Viererwahl: Die Reihe gleitet selbst — die Höhe folgt erst danach (wischtBis, Safari rastet sonst zurück).
  const paketZeigen = (key: string) => { wischtBis.current = Date.now() + 700; setMobilPaket(key); wischeZu(key, glatt()); };
  const geld = GLOBAL_GELD_ZURUECK.aktiv ? GLOBAL_GELD_ZURUECK[s] : null;
  // 19.09.2026 — Justin: „Das Kapital muss NICHT in den USA ausgegeben werden." Im Kopf steht der kurze
  // Satz am Kapitalrahmen, die Fußnote nennt beide Bedingungen (Institut, Partner-Steuerberater). Seit
  // 06.10.2026 steht „Geld zurück" nicht mehr im Hero, sondern einmal mit Bedingungen im Kleingedruckten —
  // die Fußnote hat deshalb immer die Nummer 1.
  const frei = GLOBAL_KAPITAL_FREI[s];
  const nrFrei = 1;
  // Wie auf Unterseiten und Landingpages: Jeder Klick auf „beauftragen" zählt (nur mit Einwilligung, lib/werbung.ts).
  const klick = (paket?: string, ort = "") => () => werbeEreignis("global_beauftragen_klick", { paket: paket ?? "", seite: seitePfad, ort });
  const mobilIndex = Math.max(0, GLOBAL_PAKETE.findIndex((p) => p.key === mobilPaket));
  const mobilPaketDaten = GLOBAL_PAKETE[mobilIndex];
  const mobilVip = mobilPaketDaten.key === "global_vip";
  const angebot = GLOBAL_BUERGSCHAFT_SEITE.aktiv && s === "de" ? GLOBAL_BUERGSCHAFT_SEITE.de : null;

  // Die Fragen: fünf sichtbar, der Rest dahinter (Privatpersonen: die Fragen des Registereintrags, die ersten fünf).
  const fragen = privat ? globalSeite(s === "en" ? "/en/business/private-individuals" : "/business/privatpersonen")?.fragen ?? t.fragen : t.fragen;
  const fragenZuerst = privat ? fragen.slice(0, 5) : FRAGEN_ZUERST.map((i) => fragen[i]).filter(Boolean);
  const fragenRest = fragen.filter((f) => !fragenZuerst.includes(f));

  // Die Augenzeile: „Privatpersonen“ führt auf die Startseite für Privatpersonen (nicht auf ihr selbst).
  // Text und Link stehen in EINEM <span>: .fg-auge ist ein Flex-Rahmen, sonst würden Textknoten und Link zwei
  // Spalten und „Privatpersonen“ stünde am Handy als eigene Spalte neben dem Text (06.10.2026, E-293, Gutachten).
  const augeIdx = privat ? -1 : t.auge.indexOf(t.augeLink);
  const auge = augeIdx < 0 ? t.auge : (
    <span>{t.auge.slice(0, augeIdx)}<a href={s === "en" ? "/en/business/private-individuals" : "/business/privatpersonen"}>{t.augeLink}</a>{t.auge.slice(augeIdx + t.augeLink.length)}</span>
  );

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <div className="fg fg-neu">
        {/* ── 1 Hero: Anspruch, Kapitalrahmen und Festpreis links, die Urkunde rechts, darunter die Vertrauensleiste ── */}
        <section className="fg-hero">
          <div className="fg-rahmen fg-hero-raster">
            {/* Die Aufwärts-Haarlinie vom Siegel zum Festpreis (ab 1.024 px) — zuerst im DOM, damit Text und Urkunde darüber liegen. */}
            <HeroLinie />
            <Auf className="fg-hero-text">
              <span className="fg-auge">{auge}</span>
              <h1 className="fg-h1">{t.h1a}<br /><em>{t.h1b}</em></h1>
              <p className="fg-lead">{mitBegriffen(t.lead, [begriff("ein"), begriff("itin")])}</p>
              <div className="fg-kopf-zahlen">
                <div>
                  <span>{mitBegriffen(t.kapitalKopf, [begriff("kapitalrahmen")])}</span>
                  <b className="fg-glanz">{globalKapitalSpanne(s)}</b>
                  <em>{t.kapitalKopfZusatz}</em>
                  <p className="fg-chip fg-kapital-frei"><Haken groesse={12} /><span>{frei.kurz}<sup>{nrFrei}</sup></span></p>
                </div>
                <div>
                  <span>{t.preisKopf}</span>
                  <b className="fg-glanz">{t.preisAb} {abPreis}</b>
                  <em>{t.preisKopfZusatz}</em>
                  <a className="fg-jahr-zeile" href="#jahresbetreuung" onClick={zurJahresbetreuung}>{t.jahrZeile(globalJahresbetreuungPreisText(s))}</a>
                </div>
              </div>
              <div className="fg-knoepfe fg-hero-knoepfe">
                <button type="button" className="fg-knopf" onClick={zuDenPaketen}>{t.knopfPakete}<Pfeil /></button>
                <button type="button" className="fg-knopf hell fg-hero-gespraech" onClick={() => zumGespraech()}>{t.knopfGespraech}</button>
              </div>
              <p className="fg-mikro">{t.gespraechMikro}</p>
              <p className="fg-fussnote"><sup>{nrFrei}</sup> {frei.satz} {frei.steuer}</p>
            </Auf>
            {/* Die Gründungsurkunde (HF-1, Scheibe C) mit Siegel-Licht. Am Handy steht sie ganz (nicht mehr angeschnitten —
                Justin 06.10.: „Bilder abgeschnitten“) unter den Knöpfen, der Bildnachweis senkrecht daneben wie am Desktop. */}
            <div className="fg-hero-objekt-rahmen">
              <GlobalObjekt art="urkunde" hero bild={GLOBAL_BILDER.urkunde} licht="siegel" className="fg-hero-objekt"
                groesse="(max-width: 720px) 220px, (max-width: 900px) 30vw, 400px" nachweis={t.bildKi} />
            </div>
          </div>
          <div className="fg-rahmen">
            <ul className="fg-vertrauensleiste">
              {t.vertrauensleiste.map((x, i) => (
                <li key={x}><LeistenZeichen i={i} />
                  {i === 1 ? <a href={s === "en" ? "/en/business/mustervertrag" : "/business/mustervertrag"}>{x}</a> : <span>{x}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 2 Pakete: Wegleiste, Tafeln, VIP, Vergleich, Paketfuß, Beleg, Kleingedrucktes ── */}
        <Sek id="pakete" className="fg-sek stein fg-pakete-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{t.paketeAuge}</span><h2 className="fg-h2">{t.paketeH2}</h2></div>
              <p className="fg-lead">{mitBegriffen(t.paketeLead, [begriff("kapitalrahmen")])}</p>
            </div>
            <WegLinie id="ablauf" label={t.wegLabel} stempel={t.stempelInstitut} bis={etappenBis(mobilIndex)} klammer={t.inJedemPaket} nachweis={t.bilderKi}
              titelInhalt={(i) => mitBegriffen(t.weg[i].titel, [begriff("kartenleiter")])}
              etappen={t.weg.map((w, i) => ({
                titel: w.titel,
                dauer: w.dauer,
                text: mitBegriffen(w.text, [begriff("herausgeber"), begriff("bareinlage"), begriff("registeredAgent"), begriff("operatingAgreement")]),
                abzeichen: i < 2 ? undefined : t.abPaket(globalPaket(ETAPPE_AB[i])![s].name),
              }))} />
            <p className="fg-weg-lead">{t.wegLead}</p>

            {/* Am Handy: die Viererwahl mit Preis über der Wischreihe — sie klebt nur, solange eine Tafel zu sehen ist. */}
            <div className="fg-pakete-rahmen">
              <div className="fg-paket-wahl" role="group" aria-label={t.paketeAuge}>
                {GLOBAL_PAKETE.map((p) => (
                  <button key={p.key} type="button" id={`wahl-${p.key}`} aria-pressed={mobilPaket === p.key} aria-controls={`paket-${p.key}`} onClick={() => paketZeigen(p.key)}>
                    <b>{kurzName(p[s].name)}</b><span>{globalPreisText(p.key, s)}</span>
                  </button>
                ))}
              </div>
              <div className="fg-tarife" ref={tafeln}>
                {/* „Kapitalrahmen“ ist auf den Tafeln kein Begriff-Knopf mehr: Hero und Paket-Lead erklären ihn schon,
                    vier weitere Tab-Halte vor „Jetzt beauftragen“ verlängern nur den Weg (06.10.2026, Gutachten). */}
                {GLOBAL_PAKETE.map((p, i) => (
                  <Auf key={p.key} verzoegerung={i * 70}>
                    <GlobalTafel p={p} s={s} t={t} bis={etappenBis(i)} zuerst={ZUERST[p.key]} fokus={p.key === FOKUS} gewaehlt={p.key === mobilPaket}
                      startHref={start(p.key)} onBeauftragen={klick(p.key, "tafel")} onGespraech={() => zumGespraech(p.key)} />
                  </Auf>
                ))}
              </div>
              <div className="fg-wisch-punkte" aria-hidden="true">
                {GLOBAL_PAKETE.map((p) => <i key={p.key} className={`${p.key === mobilPaket ? "an" : ""}${p.key === "global_vip" ? " vip" : ""}`} />)}
              </div>
            </div>

            {/* Alle Leistungen im Vergleich — die Tabelle unverändert, auf allen Breiten erst auf Wunsch. */}
            <div id="vergleich" className={`fg-vergleich${tabelleAuf ? " auf" : ""}`} style={{ scrollMarginTop: 88 }}>
              <button type="button" className="fg-tarif-vergleich" aria-expanded={tabelleAuf} aria-controls="fg-tabelle" onClick={() => setTabelleAuf(!tabelleAuf)}>
                {t.zumVergleich}<Winkel offen={tabelleAuf} />
              </button>
              <p className="fg-wisch">{t.wischen}</p>
              <div className="fg-tabelle" id="fg-tabelle" role="region" aria-label={t.zumVergleich} tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t.leistung}</th>
                      {GLOBAL_PAKETE.map((p) => (
                        <th key={p.key} scope="col" className={p.key === FOKUS ? "fokus" : undefined}><b>{p[s].name}</b><span>{globalPreisText(p.key, s)}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="zahl"><th scope="row">{t.zeilePlanung}</th>{GLOBAL_PAKETE.map((p) => <td key={p.key} className={p.key === FOKUS ? "fokus" : undefined}>{globalPlanungText(p.key, s)}</td>)}</tr>
                    <tr className="zahl"><th scope="row">{t.zeileDauer}</th>{GLOBAL_PAKETE.map((p) => <td key={p.key} className={p.key === FOKUS ? "fokus" : undefined}>{p[s].dauerKurz}</td>)}</tr>
                    {GLOBAL_VERGLEICH.map((g) => [
                      <tr key={g.titel.de} className="gruppe"><td colSpan={GLOBAL_PAKETE.length + 1}>{g.titel[s]}</td></tr>,
                      ...g.zeilen.map((z) => (
                        <tr key={z.de}>
                          <th scope="row">{z[s]}</th>
                          {GLOBAL_PAKETE.map((p) => (
                            <td key={p.key} className={p.key === FOKUS ? "fokus" : undefined}>
                              {z.in[p.key] ? <span role="img" aria-label={t.ja}><Haken /></span> : <span role="img" aria-label={t.nein} className="fg-strich" />}
                            </td>
                          ))}
                        </tr>
                      )),
                    ])}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td />
                      {GLOBAL_PAKETE.map((p) => <td key={p.key} className={p.key === FOKUS ? "fokus" : undefined}><a className={`fg-knopf${p.key === FOKUS ? "" : " hell"}`} href={start(p.key)} aria-label={t.beauftragen(p[s].name)} onClick={klick(p.key, "tabelle")}>{t.beauftragenKurz}</a></td>)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="fg-paket-fuss">
              {/* Das Kapital der Tafeln ist nicht an die USA gebunden — mit beiden Bedingungen (GLOBAL_KAPITAL_FREI). */}
              <p className="fg-paket-europa"><Haken groesse={14} /><span>{frei.satz} {frei.steuer}</span></p>
              <p>{t.kostenHinweis} <a href={s === "en" ? "/en/business/package-finder" : "/business/paket-finder"}>{t.finderLink}</a></p>
            </div>

            {/* Der Beleg „Im Festpreis“ — der Vertragswortlaut (GLOBAL_INKLUSIVE, GLOBAL_LAUFEND) in der Klappe. */}
            <GlobalBeleg className="fg-inkl" auge={t.inklAuge} titel={t.inklTitel} zeilen={t.beleg} summe={t.belegSumme} preis={`${t.preisAb} ${abPreis}`}
              klappe={t.belegKlappe} vertrag={GLOBAL_INKLUSIVE[s]} laufend={GLOBAL_LAUFEND[s]} />

            {/* Das Kleingedruckte: immer offen, drei ruhige Spalten, gleicher Wortlaut wie im Vertrag. */}
            <div className={`fg-kleingedruckt${geld ? "" : " ohne-geld"}`}>
              {geld && (
                <div>
                  <h3><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" /></svg>{geld.kurz}</h3>
                  <p>{geld.bedingungen}</p>
                </div>
              )}
              <div>
                <h3><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" /><path d="M5 8h6" /></svg>{t.nichtTitel}</h3>
                <ul>{GLOBAL_NICHT_INKLUSIVE[s].map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <h3><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5M4 7v6.5h8V7" /></svg>{t.wissenTitel}</h3>
                <ul>{GLOBAL_PFLICHTHINWEIS[s].map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
          </div>
        </Sek>

        {/* ── 3 Jahresbetreuung als Band (trägt id="jahresbetreuung" selbst) ── */}
        <GlobalJahresbetreuung sprache={s} groesse="band" startPfad={start()} knopf={t.jbKnopf} so={t.jbSo} />

        {/* ── 3b FIAON auf Instagram und Facebook (E-296): NUR Beiträge von FIAON Global — kein Rückfall auf „alle“,
               die Business-Welt zeigt nie Privatthemen (E-192, Prüfung 06.10.2026); ohne Beiträge nur die Profile.
               Seit 06.10. abends direkt nach Paketen und Jahresbetreuung (Justin: „höher setzen … präsenter“). ── */}
        <SozialFenster aussehen="kanzlei" marke="global" />

        {/* ── 4 Ein Ansprechpartner statt acht ── */}
        <Sek id="leistungen" className="fg-sek fg-stern-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf mitte">
              <div><span className="fg-auge">{t.vsAuge}</span><h2 className="fg-h2">{t.vsH2}</h2></div>
            </div>
            <GlobalStern knoten={t.sternKnoten} ohne={t.ohne} schalter={t.sternSchalter} mitte={t.sternMitte} sie={t.sternSie} legende={t.sternLegende}
              label={t.sternLabel} inklusive={GLOBAL_INKLUSIVE[s]} begriffe={[begriff("registeredAgent"), begriff("operatingAgreement"), begriff("usCpa")]} />
            <div className="fg-stern-unter">
              <p className="fg-stern-partner">{GLOBAL_ROLLEN[s].partner}</p>
              {/* Ehrlich statt laut: Wer nur die Gesellschaft braucht, ist woanders günstiger. */}
              <p className="fg-ehrlich-zeile"><b>{t.ehrlichTitel}:</b> {t.ehrlichText}{" "}
                <a href={s === "en" ? "/en/business/comparison" : "/business/vergleich"}>{t.ehrlichLink}<Pfeil /></a></p>
            </div>
            <div id="fuer-wen" className="fg-fuer-chips" style={{ scrollMarginTop: 96 }}>
              <span>{t.fuerKurz}</span>
              <ul>
                {t.fuerChips.map((c) => <li key={c.text}>{c.pfad ? <a href={c.pfad}>{c.text}</a> : <span>{c.text}</span>}</li>)}
              </ul>
            </div>
          </div>
        </Sek>

        {/* ── 5 Persönliches Angebot mit Bürgschaftszusage — Schalter in shared/fiaon-global.ts (Start: aus) ── */}
        {angebot && (
          <GlobalBuergschaft texte={angebot} verbunden={GLOBAL_VERBUNDEN}
            onGespraech={() => { klick(undefined, "angebot")(); zumGespraech(undefined, angebot.thema); }} />
        )}

        {/* ── 6 Erstgespräch ── */}
        <Sek id="gespraech" className="fg-sek fg-gespraech-sek">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2">{t.gespraechH2}</h2></div>
              <p className="fg-lead">{t.gespraechLead}</p>
            </div>
            <GlobalGespraech paket={wunsch} thema={thema} punkte={false} />
          </div>
        </Sek>

        {/* ── 7 Fragen: fünf sichtbar, die übrigen im DOM hinter „Alle 17 Fragen“ ── */}
        <Sek id="fragen" className="fg-sek stein">
          <div className="fg-rahmen fg-fragen">
            <div className="fg-fragen-kopf">
              <span className="fg-auge">{t.fragenAuge}</span>
              <h2 className="fg-h2">{t.fragenH2}</h2>
              <a className="fg-fragen-alle" href={s === "en" ? "/en/business/faq" : "/business/fragen"}>{t.fragenAlle}<Pfeil /></a>
            </div>
            <div className="fg-fragen-liste">
              {/* Privatpersonen: die Fragen aus dem Registereintrag — dasselbe FAQ-Markup wie das Vorab-HTML dieser Adresse. */}
              {/* Alle Antworten beginnen zu — die fünf Fragen selbst sind die Übersicht (Bauplan 2.8, Wortbudget). */}
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

        {/* ── 8 Schlussband ── */}
        <section className="fg-schluss mit-bild">
          <GlobalSchlussBild nachweis={t.szeneKi} />
          <div className="fg-rahmen">
            <div className="fg-schluss-text">
              <h2 className="fg-h2">{t.schlussA}<em>{t.schlussB}</em></h2>
              <div className="fg-knoepfe">
                <a className="fg-knopf" href={start()} onClick={klick(undefined, "schluss")}>{t.schlussBeauftragen}<Pfeil /></a>
                <button type="button" className="fg-knopf hell" onClick={() => zumGespraech()}>{t.knopfGespraech}</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Klebeleiste am Handy (Bauplan 2.12): in den Paketen folgt sie der Tafel in der Mitte ──
            06.10.2026 (Gutachten): nur bis 640 px — darüber stehen die Tafeln untereinander, keine Wischreihe setzt
            die Wahl, und die Leiste hätte immer Global Struktur angeboten. Der Kurzname („Struktur · 2.499 € —
            beauftragen“) passt einzeilig. Bei Global VIP führt sie wie die Tafel mit dem Gespräch; der Direktkauf
            über 35.999 € ist der helle Knopf (Messpunkt ort „leiste“ bleibt). */}
        <div className={`fg-mobil${leiste !== "aus" ? " da" : ""}${leiste === "in" ? " in-paketen" : ""}`} aria-hidden={leiste === "aus"}>
          {leiste === "in" && (
            <span className="fg-mobil-linie" aria-hidden="true">{[0, 1, 2, 3].map((j) => <i key={j} className={j < etappenBis(mobilIndex) ? "an" : undefined} />)}</span>
          )}
          {leiste === "in" && mobilVip ? (
            <>
              <a className="hell" href={start(mobilPaket)} tabIndex={0} onClick={klick(mobilPaket, "leiste")}>{t.direktBeauftragen}</a>
              <button type="button" className="voll" onClick={() => zumGespraech(mobilPaket)} tabIndex={0} aria-label={t.vipGespraech(mobilPaketDaten[s].name)}>{t.vipGespraechKurz}</button>
            </>
          ) : leiste === "in"
            ? <button type="button" className="hell" onClick={() => zumGespraech(mobilPaket)} tabIndex={0}>{t.erstSprechen}</button>
            : <button type="button" className="hell" onClick={() => zumGespraech()} tabIndex={leiste === "aus" ? -1 : 0}>{t.leisteGespraech}</button>}
          {leiste === "in" && mobilVip ? null : leiste === "in" ? (
            <a className="voll" href={start(mobilPaket)} tabIndex={0} onClick={klick(mobilPaket, "leiste")}>{t.leisteTafel(kurzName(mobilPaketDaten[s].name), globalPreisText(mobilPaket, s))}</a>
          ) : leiste === "nach" ? (
            <a className="voll" href={start()} tabIndex={0} onClick={klick(undefined, "leiste")}>{t.leisteBeauftragen}</a>
          ) : (
            <button type="button" className="voll" onClick={zuDenPaketen} tabIndex={leiste === "aus" ? -1 : 0}>{t.leistePakete(abPreis)}</button>
          )}
        </div>
      </div>
    </Dunkel>
  );
}
