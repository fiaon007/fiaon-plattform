// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE VORLAGE FÜR ALLE UNTERSEITEN (19.09.2026, E-191)
//
// Eine Seite, viele Adressen: /business/<slug> und /business/wissen/<slug>
// lesen ihren Inhalt aus shared/fiaon-global-seiten (dieselbe Quelle, aus der
// der Server Titel, Korpus und FAQ für Suchmaschinen rendert).
// Seit 24.09.2026 (E-234) auch englisch: /en/business/<slug> und
// /en/business/knowledge/<slug> — die Sprache kommt aus der Registerseite
// (globalSprache), die festen Wörter aus client/src/i18n/global-seite.ts.
//
// ── AUFBAU SEIT 06.10.2026 (E-293, Bauplan /business Kapitel 5, Scheibe D) ──
//   Lesefortschritt
//   Kopf: Brotkrumen · Augenzeile · H1 · Lead · zwei Knöpfe · Ziffern als
//         schmale Leiste — rechts das Merkblatt als Karteikarte (drei Zeilen,
//         „Alle Angaben“ klappbar; am Handy ganz zugeklappt)
//   Körper: links das Inhaltsverzeichnis (läuft mit), rechts zuerst die
//           Antwortkarte „Kurz beantwortet“, dann die Abschnitte mit römischer
//           Ziffer — Etappen als Weg, Hinweise als Randnotiz (≥ 1280 px in
//           einer eigenen Spalte), Tabellen aus Haarlinien, Karten mit
//           Linien-Zeichen, Pakete als dieselben Tafeln wie auf /business —,
//           die Fragen, Stand und Quellen (klappbar)
//   Jahresbetreuung als Band · Erstgespräch (Kalender erst auf Wunsch) ·
//   Weiterlesen · Schlussband · Handlungsleiste am Handy
// Nur Darstellung: Kein Registertext ändert sich. Was der Korpus für
// Suchmaschinen enthält (blockAlsText), bleibt sichtbar; Zugeklapptes steht
// in <details> im DOM, nie display:none.
// Gestaltung: styles/global.css (.fg, Farben, Glanz) + styles/global-seiten.css
// (.fd-) + styles/global-grafik.css (Tafel, Jahresband, Bewegungsgrundgesetz).
//
// ── E-510 (13.11.2026): DIE VORLAGE IM KANZLEI-TON ─────────────────────────
// Papier, Linie, eine Bühne (UX-Prüfung 12.11., Abschnitt 3):
//   · Linien statt Kästen: Karten, Rollen, Verzeichnisse, Fragen und „Weiterlesen“ stehen an Haarlinien; keine
//     Symbol-Kacheln mehr. Ein Kasten bleibt nur, was ein Gegenstand ist: die Karteikarte, die Karte „Ein Mandat“,
//     die Gesprächskarte.
//   · EINE dunkle Fläche: das Schlussband — ruhiges Navy, Schrift, die Handlungen. Ohne Bild. Der Kopf der Karteikarte
//     und der Fuß sind hell. Steht der Honorarrechner auf der Seite (Baustein „finder“), ist ER die dunkle Fläche und
//     das Schlussband hell.
//   · Darüber das Vertrauens-Band (GlobalVertrauen): vier Tatsachen mit Verweis, die Presse-Zeile genau einmal.
//   · Bewegung: Jeder Abschnitt erscheint einmal als Ganzes (data-an), seine Linie zeichnet sich — kein Absatz fliegt
//     einzeln. Das Inhaltsverzeichnis führt eine Marke weich zum gelesenen Abschnitt.
//   · Handlungen heißen überall gleich (handlung() aus shared/fiaon-global-saetze). Auf der Österreich-Seite gibt es
//     nur „Gespräch vereinbaren“, keinen Betrag und keine Karte „Ein Mandat“ (Leitfaden 5.12).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dunkel, Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalSchlagzeilen from "@/components/site/GlobalSchlagzeilen";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { ohneBindestrichBruch } from "@/components/site/global/Wortbruch";
import Merkblatt from "@/components/site/global-seite/Merkblatt";
import GlobalVertrauen from "@/components/site/global/GlobalVertrauen";
import SeitenWeg from "@/components/site/global-seite/SeitenWeg";
import GespraechKarte from "@/components/site/global-seite/GespraechKarte";
import { OrteKarte, RollenDreieck } from "@/components/site/global-seite/SeitenBausteine";
import NotFound from "@/pages/not-found";
import { GLOBAL_WOERTER } from "@/i18n/global";
import { GLOBAL_SEITE_WOERTER } from "@/i18n/global-seite";
import {
  globalSeite, globalKrumen, globalInhalt, globalSprache, GLOBAL_SEITE_WORTE, type GlobalBlock, type GlobalSeite,
} from "@shared/fiaon-global-seiten";
import { globalMenuePunkt } from "@shared/fiaon-global-menue";
import type { GlobalSchluessel } from "@shared/fiaon-global";
import { globalStartPfad, globalSeitePfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
// Feste Sätze und die Namen der Handlungen — eine Quelle, hier wird keiner getippt (Sprachleitfaden 5.3, 7).
import { handlung, hauptHandlung, satz, satzLand, weitererSatz, type SatzLand } from "@shared/fiaon-global-saetze";
import { businessArtikelAusPfad, businessArtikelPfad } from "@shared/fiaon-business-artikel";
import { markdownZuHtml } from "@shared/fiaon-markdown";
import { begriffStand, begriffeVerlinken, type Textteil } from "@shared/fiaon-global-begriffe";
import { werbeEreignis } from "@/lib/werbung";
import { VerkaufKarte } from "@/components/site/global/VerkaufProdukt";
import VerkaufKonfigurator from "@/components/site/global/VerkaufKonfigurator";
import { verkaufPfad } from "@shared/fiaon-global-verkauf";
import "@/styles/global-tokens.css";
import "@/styles/global.css";
import "@/styles/global-seiten.css";
import "@/styles/global-grafik.css";
import "@/styles/global-apple.css";

const ROEMISCH = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

export function Pfeil({ groesse = 15 }: { groesse?: number }) {
  return <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

type Sp = "de" | "en";
const datumIn = (iso: string, sp: Sp) => new Date(`${iso}T12:00:00`).toLocaleDateString(sp === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric" });
const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

// ── Die Seite ────────────────────────────────────────────────────────────────
export default function GlobalSeitePage() {
  const pfad = typeof window !== "undefined" ? window.location.pathname : "";
  const s = globalSeite(pfad);
  if (s) return <Seite s={s} />;
  // E-439 (27.10.2026): Kein Registereintrag? Dann vielleicht ein Artikel der Business-Redaktion.
  const artikel = businessArtikelAusPfad(pfad);
  return artikel ? <RedaktionsArtikel slug={artikel.slug} sp={artikel.sprache} /> : <NotFound />;
}

// ── Ein Artikel der Business-Redaktion im Kleid der Unterseiten (E-439, 27.10.2026) ──
// Die Tagesartikel (fiaon_ratgeber, bereich business) liefen bis heute auf der dunklen Privat-Bühne unter
// /ratgeber/<slug>. Jetzt sehen sie aus wie jede Seite von FIAON Global: Kopf mit Merkblatt, Inhaltsverzeichnis,
// Antwortkarte, Abschnitte, Fragen, die Karte „Ein Mandat“. Der Text kommt aus dem Markdown der Redaktion — Abschnitt für Abschnitt.
interface RedaktionsDaten { slug: string; titel: string; untertitel: string | null; teaser: string; inhalt: string; kategorie: string; land: string;
  lesezeit: number; faq: { frage: string; antwort: string }[]; metaTitel: string; metaBeschreibung: string; veroeffentlichtAm: string | null; aktualisiertAm: string; bereich: string; sprache?: string }

function redaktionsSeite(a: RedaktionsDaten, sp: Sp): GlobalSeite {
  const en = sp === "en";
  const teile = a.inhalt.split(/^## +/m);
  const vorweg = teile[0].trim();
  const abschnitte = teile.slice(1).map((t, i) => {
    const [kopf, ...rest] = t.split("\n");
    return { typ: "html" as const, id: `a${i + 1}`, h2: kopf.trim(), html: markdownZuHtml(rest.join("\n").trim()) };
  }).filter((b) => b.h2 && !/^(Quellen|Sources)$/i.test(b.h2));
  const quellenTeil = teile.slice(1).find((t) => /^(Quellen|Sources)\s*$/i.test(t.split("\n")[0].trim()));
  const quellen = quellenTeil ? Array.from(quellenTeil.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)).map((m) => ({ titel: m[1], url: m[2] })) : [];
  const [h1, ...h1rest] = a.titel.split(/:\s+/);
  const stand = (a.aktualisiertAm || a.veroeffentlichtAm || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const datum = datumIn(stand, sp);
  return {
    pfad: businessArtikelPfad(a.slug, sp), sprache: sp, art: "wissen",
    seo: { titel: a.metaTitel || a.titel, beschreibung: a.metaBeschreibung || a.teaser },
    stand, erschienen: (a.veroeffentlichtAm || stand).slice(0, 10), kennung: en ? "Editorial" : "Redaktion",
    auge: en ? "Knowledge · Latest from the editorial team" : "Wissen · Aktuell aus der Redaktion",
    h1: h1rest.length ? `${h1}:` : a.titel, h1b: h1rest.length ? h1rest.join(": ") : undefined,
    lead: a.untertitel || a.teaser,
    blick: [
      [en ? "As of" : "Stand", datum],
      [en ? "Reading time" : "Lesezeit", en ? `${a.lesezeit} min` : `${a.lesezeit} Min.`],
      [en ? "Written by" : "Redaktion", "FIAON Global"],
      [en ? "With FIAON Global" : "Mit FIAON Global", weitererSatz("PRODUKTNAME", sp)],
    ],
    kurz: vorweg ? vorweg.replace(/[*_`#>\[\]]/g, "").replace(/\(https?:[^)]+\)/g, "").split(/\n\n/)[0].slice(0, 700) : a.teaser,
    bloecke: [
      ...abschnitte,
      // Der eine Satz zur Einordnung kommt aus den festen Sätzen — für Beiträge über Österreich in der Fassung für Österreich.
      { typ: "paket", id: "mandat", h2: en ? "Under one engagement" : "In einem Mandat", lead: weitererSatz(/^(at|aut|österreich|oesterreich|austria)$/i.test(a.land ?? "") ? "POSITIONIERUNG-AT" : "POSITIONIERUNG", sp), paket: "global_banking" },
    ],
    fragen: a.faq.map((f) => ({ f: f.frage, a: f.antwort })),
    paket: "global_banking",
    weiter: en ? ["/en/business/knowledge", "/en/business/us-company-formation", "/en/business/us-business-credit-cards", "/en/business/costs"]
      : ["/business/wissen", "/business/us-firmengruendung", "/business/firmenkarten-kapital", "/business/kosten"],
    quellen,
  };
}

function RedaktionsArtikel({ slug, sp }: { slug: string; sp: Sp }) {
  const [s, setS] = useState<GlobalSeite | null>(null);
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => {
    let vorbei = false;
    fetch(`/api/fiaon/ratgeber/${encodeURIComponent(slug)}`).then((r) => r.json()).then((j) => {
      if (vorbei) return;
      const a = j?.artikel as RedaktionsDaten | undefined;
      if (!j?.ok || !a || a.bereich !== "business") { setFehlt(true); return; }
      const asp: Sp = a.sprache === "en" ? "en" : "de";
      // Falsche Sprache in der Adresse → auf die richtige (der Server leitet dasselbe per 301).
      if (asp !== sp) { window.location.replace(businessArtikelPfad(slug, asp)); return; }
      setS(redaktionsSeite(a, asp));
    }).catch(() => { if (!vorbei) setFehlt(true); });
    return () => { vorbei = true; };
  }, [slug, sp]);
  if (fehlt) return <NotFound />;
  if (!s) return <Dunkel seite="business" sprache={sp} titel="FIAON Global" beschreibung=""><div style={{ minHeight: "70vh" }} /></Dunkel>;
  return <Seite s={s} />;
}

// 29.10.2026 (E-459): Die Vorlage zeichnet auch Seiten außerhalb des Registers — die Vertrauensseite „Ist FIAON seriös?“
// (pages/site/ist-fiaon-serioes.tsx) gibt ihren Datensatz (shared/fiaon-serioes-seite.ts) direkt hinein.
export function GlobalSeitenAnsicht({ s }: { s: GlobalSeite }) {
  return <Seite s={s} />;
}

/** Wörter der Vorlage, die keine festen Sätze sind (deutsch und englisch — die Wortwand liest sie hier). */
const VORLAGE_WORT = {
  de: { lesezeit: (min: number) => `Lesezeit: ${min} ${min === 1 ? "Minute" : "Minuten"}`, nachOben: "Nach oben", honorar: "Honorar" },
  en: { lesezeit: (min: number) => `Reading time: ${min} ${min === 1 ? "minute" : "minutes"}`, nachOben: "Back to top", honorar: "Fees" },
} as const;

function Seite({ s }: { s: GlobalSeite }) {
  const sp = globalSprache(s);
  const t = GLOBAL_WOERTER[sp];
  const u = GLOBAL_SEITE_WOERTER[sp];
  const w = GLOBAL_SEITE_WORTE[sp];
  const v = VORLAGE_WORT[sp];
  // Das Land der Seite: „AT“ und „CH“ für die beiden Länderseiten, sonst „DE“ (Leitfaden 5.12).
  const land = satzLand(s.pfad);
  // E-379 (15.10.2026): Auf der Wissen-Übersicht stehen die neuesten Beiträge der Redaktion — jeden Tag einer
  // für Unternehmer (server/lib/fiaon-ratgeber-redaktion.ts). Nur deutsch: Die Redaktion schreibt deutsch.
  const mitAktuell = s.art === "hub";
  const [aktuell, setAktuell] = useState<RedaktionsBeitrag[]>([]);
  useEffect(() => {
    if (!mitAktuell) return;
    let vorbei = false;
    fetch(`/api/fiaon/ratgeber?bereich=business&sprache=${sp}&limit=60`).then((r) => r.json())
      .then((j) => { if (!vorbei) setAktuell(Array.isArray(j?.artikel) ? j.artikel : []); }).catch(() => {});
    return () => { vorbei = true; };
  }, [mitAktuell]);
  // E-439: Fachbegriffe im Fließtext verlinken — erstes Vorkommen, höchstens sechs je Seite (shared/fiaon-global-begriffe.ts).
  const begriffe = useMemo(() => {
    const stand = begriffStand(sp, s.pfad, (p) => !!globalSeite(p));
    const plan = new Map<string, Textteil[]>();
    for (const b of s.bloecke) if (b.typ === "text") b.absaetze.forEach((a, i) => plan.set(`${b.id}:${i}`, begriffeVerlinken(a, stand)));
    return plan;
  }, [s, sp]);
  const inhalt = useMemo(() => {
    const basis = globalInhalt(s);
    return mitAktuell && aktuell.length ? [basis[0], { id: "aktuell", titel: AKTUELL_TITEL[sp] }, ...basis.slice(1)] : basis;
  }, [s, mitAktuell, aktuell.length]);
  const nummer = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    for (const e of inhalt) if (e.id !== "kurz") m.set(e.id, ROEMISCH[n++] ?? String(n));
    return m;
  }, [inhalt]);
  const aktiv = useScrollspy(inhalt.map((e) => e.id));
  const fortschritt = useRef<HTMLSpanElement>(null);
  const kopf = useRef<HTMLElement>(null);
  const text = useRef<HTMLElement>(null);
  const verzeichnis = useRef<HTMLOListElement>(null);
  useEinmalSichtbar(kopf, 0.1);
  const [leiste, setLeiste] = useState(false);
  // 06.10.2026 (E-293): Der Kalender lädt erst auf Wunsch — oder sofort, wenn jemand mit #gespraech ankommt.
  const [gespraechOffen, setGespraechOffen] = useState(() => typeof window !== "undefined" && window.location.hash === "#gespraech");
  // Lesezeit: aus den Wörtern des Texts gezählt (220 Wörter je Minute), nicht geschätzt.
  const [minuten, setMinuten] = useState(0);
  useEffect(() => {
    const worte = (text.current?.textContent ?? "").trim().split(/\s+/).filter(Boolean).length;
    setMinuten(worte ? Math.max(1, Math.round(worte / 220)) : 0);
  }, [s, aktuell.length]);

  useEffect(() => {
    const neu = () => {
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - window.innerHeight);
      fortschritt.current?.style.setProperty("--fd-p", String(Math.min(1, window.scrollY / max)));
      // Die Handlungsleiste am Handy weicht, solange das Erstgespräch im Bild steht — sie läge sonst über Kalender und Formular.
      const g = document.getElementById("gespraech")?.getBoundingClientRect();
      const imGespraech = !!g && g.top < window.innerHeight * 0.75 && g.bottom > window.innerHeight * 0.35;
      setLeiste(window.scrollY > 560 && !imGespraech);
    };
    const hash = () => { if (window.location.hash === "#gespraech") setGespraechOffen(true); };
    neu();
    window.addEventListener("scroll", neu, { passive: true });
    window.addEventListener("resize", neu);
    window.addEventListener("hashchange", hash);
    // Wer mit #anker ankommt, landet dort — erst nach dem ersten Bild.
    if (window.location.hash) requestAnimationFrame(() => setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView(), 80));
    return () => { window.removeEventListener("scroll", neu); window.removeEventListener("resize", neu); window.removeEventListener("hashchange", hash); };
  }, []);

  // Die Marke im Inhaltsverzeichnis gleitet zum gelesenen Abschnitt (nur transform; CSS: .fd-inhalt ol::after).
  useEffect(() => {
    const ol = verzeichnis.current;
    const a = ol?.querySelector<HTMLElement>('a[aria-current="true"]');
    if (!ol || !a) return;
    ol.style.setProperty("--fd-marke-y", `${a.offsetTop}px`);
    ol.style.setProperty("--fd-marke-h", `${a.offsetHeight}px`);
    ol.setAttribute("data-marke", "1");
  }, [aktiv, inhalt.length]);

  // E-509 (12.11.2026): Es gibt EIN Produkt. Jeder Knopf zum Angebot führt zum Honorarrechner; das Feld `paket` der Seite
  // stellt dort nur noch den Start-Rahmen des Reglers (?paket= → verkaufUsdAusPaket).
  const paket = s.paket ?? null;
  const beauftragen = paket ? globalStartPfad(paket, sp) : verkaufPfad(sp);
  // Die Handlungen heißen überall gleich (Leitfaden 7). Österreich: nur das Gespräch.
  const angebotWort = handlung("angebot", sp);
  const gespraechWort = handlung("gespraech", sp);
  const nurGespraech = hauptHandlung(sp, land) === gespraechWort;
  // Jeder Weg zum Gespräch öffnet die Karte an ihrer Stelle.
  const oeffneGespraech = (_wahl?: GlobalSchluessel) => {
    setGespraechOffen(true);
    requestAnimationFrame(() => document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }));
  };
  const zumGespraech = (e: React.MouseEvent) => { e.preventDefault(); oeffneGespraech(); };
  const klickBeauftragen = () => werbeEreignis("global_beauftragen_klick", { paket: paket ?? "", seite: s.pfad });
  const krumen = globalKrumen(s);
  const stand = u.stand(datumIn(s.stand, sp));
  // Steht der Honorarrechner auf der Seite, ist ER die eine dunkle Fläche — das Schlussband bleibt dann hell.
  const mitRechner = s.bloecke.some((b) => b.typ === "finder");
  /** Die zwei Knöpfe einer Stelle: die Haupt-Handlung voll, das Gespräch hell — in Österreich nur das Gespräch. */
  const knoepfe = (pfeil = true) => (nurGespraech
    ? <a className="fg-knopf" href="#gespraech" onClick={zumGespraech}>{gespraechWort}{pfeil && <Pfeil />}</a>
    : (
      <>
        <a className="fg-knopf" href={beauftragen} onClick={klickBeauftragen}>{angebotWort}{pfeil && <Pfeil />}</a>
        <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{gespraechWort}</a>
      </>
    ));

  return (
    <Dunkel seite="business" titel={s.seo.titel} beschreibung={s.seo.beschreibung} sprache={sp}>
      <div className="fg fd" data-land={land}>
        <div className="fd-fortschritt" aria-hidden="true"><i ref={fortschritt as any} /></div>

        {/* ── Kopf ───────────────────────────────────────────────────────── */}
        <header ref={kopf} className="fd-kopf neu">
          <div className="fg-rahmen fd-kopf-raster">
            <Auf>
              <nav aria-label={u.krumen}>
                <ol className="fd-krumen">
                  {/* 19.09.2026: Die Brotkrumen beginnen bei FIAON Global — nie auf der Startseite der Privatkunden. */}
                  {krumen.map((k, i) => (
                    <li key={k.pfad}>{i === krumen.length - 1 ? <span aria-current="page">{k.name}</span> : <a href={k.pfad}>{k.name}</a>}</li>
                  ))}
                </ol>
              </nav>
              <span className="fg-auge">{s.auge}</span>
              <h1 className="fg-h1 fd-h1">{ohneBindestrichBruch(s.h1)}{s.h1b && <><br /><em>{ohneBindestrichBruch(s.h1b)}</em></>}</h1>
              <p className="fd-lead">{s.lead}</p>
              <div className="fg-knoepfe fd-kopf-knoepfe">{knoepfe()}</div>
              {/* Kennziffern als schmale Leiste: höchstens drei Werte, jede Zahl mit ihrem Satz (Blickfang-Regel). */}
              {s.ziffern?.length ? (
                <div className="fd-leiste">
                  {s.ziffern.slice(0, 3).map((z) => <div key={z.label}><b>{z.wert}</b><span>{z.label}</span></div>)}
                </div>
              ) : null}
              <p className="fd-kopf-stand">{stand}</p>
            </Auf>
            <Auf verzoegerung={140}>
              <Merkblatt titel={u.blick} kennung={s.kennung} zeilen={s.blick} alle={u.alleAngaben} punkte={u.blickPunkte(s.blick.length)}
                stand={stand} firma={`${FIAON_FIRMA.name} · Companies House ${FIAON_FIRMA.companyNo}`} />
            </Auf>
          </div>
        </header>

        {/* 06.10.2026 (E-293): Die Nachrichtenlage stand bis heute auf /business direkt nach dem Hero — noch bevor das
            Angebot erklärt war. Sie steht jetzt auf der Wissen-Übersicht (/business/wissen), mit denselben Daten
            (shared/fiaon-global-schlagzeilen.ts) und derselben Prüfung (pruef-global-seiten.ts §9). */}
        {s.art === "hub" && (
          <GlobalSchlagzeilen sprache={sp} auge={t.presseAuge} h2={t.presseH2} stand={t.presseStand} zurQuelle={t.presseZurQuelle}
            hinweis={t.presseHinweis} laufband={t.presseLaufband} pause={t.pressePause} weiter={t.presseWeiter} />
        )}

        {/* ── Körper ─────────────────────────────────────────────────────── */}
        <div className="fd-koerper neu">
          <nav className="fd-inhalt" aria-label={u.inhaltLabel}>
            <p>{u.inhalt}{minuten > 0 && <span className="fd-inhalt-zeit">{v.lesezeit(minuten)}</span>}</p>
            <ol ref={verzeichnis}>
              {inhalt.map((e) => (
                <li key={e.id}><a href={`#${e.id}`} aria-current={aktiv === e.id ? "true" : undefined}
                  onClick={(ev) => { ev.preventDefault(); document.getElementById(e.id)?.scrollIntoView({ behavior: glatt() }); history.replaceState(null, "", `#${e.id}`); }}>
                  <i>{e.id === "kurz" ? "—" : nummer.get(e.id)}</i>{e.titel}
                </a></li>
              ))}
            </ol>
            <a className="fd-inhalt-oben" href="#inhalt" onClick={(ev) => { ev.preventDefault(); window.scrollTo({ top: 0, behavior: glatt() }); }}>{v.nachOben}</a>
            <div className="fd-inhalt-fuss">{knoepfe(false)}</div>
          </nav>

          <article ref={text} className="fd-text neu">
            {/* Die Antwortkarte ist das erste Element im Körper (Bauplan Kapitel 5, Punkt 3). */}
            <section id="kurz" className="fd-antwort" aria-label={w.kurz}>
              <span className="fd-marke">{w.kurz}</span>
              <p>{s.kurz}</p>
            </section>

            <details className="fd-inhalt-mobil">
              <summary>{u.inhaltLabel}{minuten > 0 && <span className="fd-inhalt-zeit">{v.lesezeit(minuten)}</span>}</summary>
              <ol>
                {inhalt.map((e) => <li key={e.id}><a href={`#${e.id}`}><i>{e.id === "kurz" ? "—" : nummer.get(e.id)}</i>{e.titel}</a></li>)}
              </ol>
            </details>

            {mitAktuell && aktuell.length > 0 && <RedaktionAktuell beitraege={aktuell} nr={nummer.get("aktuell")} sp={sp} />}

            {s.bloecke.map((b, i) => <Baustein key={b.id} b={b} nr={nummer.get(b.id)} seite={s} sp={sp} land={land} begriffe={begriffe} onGespraech={oeffneGespraech}
              randUnten={b.typ === "hinweis" && !randDaneben(s.bloecke[i + 1])} />)}

            {s.fragen.length > 0 && (
              <Abschnitt id="fragen">
                <span className="fd-nr">{nummer.get("fragen")}.</span>
                <h2 className="fd-h2 fg-h2">{w.fragen}</h2>
                <div className="fd-fragen"><Fragen items={s.fragen} ebene={3} /></div>
              </Abschnitt>
            )}

            <footer className="fd-vermerk">
              <span><b>{u.vermerkStand}</b> {datumIn(s.stand, sp)} · <b>{u.vermerkRedaktion}</b> FIAON Global · <b>{u.vermerkKennung}</b> {s.kennung}</span>
              {s.quellen?.length ? (
                <details className="fd-quellen">
                  <summary>{u.quellenZahl(s.quellen.length)}</summary>
                  <ol>{s.quellen.map((q) => <li key={q.url}><a href={q.url} target="_blank" rel="noopener noreferrer">{q.titel}</a></li>)}</ol>
                </details>
              ) : null}
              <span>{u.vermerkHinweis}</span>
            </footer>
          </article>
        </div>

        {/* E-509 (12.11.2026): Das Band „Jahresbetreuung“ (E-196) steht hier nicht mehr — seine Sätze sprachen vom Paket.
            Die Jahresbetreuung nennt jetzt die Karte „Ein Mandat“ und das Honorarblatt des Rechners. */}

        {/* ── Gespräch ───────────────────────────────────────────────────── */}
        <section id="gespraech" className="fg-sek stein fd-gespraech">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2">{t.gespraechH2}</h2></div>
                <p className="fg-lead">{t.gespraechLead}</p>
              </div>
            </Auf>
            <GespraechKarte sp={sp} offen={gespraechOffen} onOeffnen={() => setGespraechOffen(true)} paket={null} />
          </div>
        </section>

        {/* ── Weiterlesen: ein Verzeichnis an Haarlinien ───────────────────── */}
        {s.weiter.length > 0 && (
          <WeiterAbschnitt>
            <h2 className="fg-auge" id="fd-weiter-titel">{u.weiterlesen}</h2>
            <div className="fd-weiter-raster">
              {s.weiter.map((p) => {
                const z = p === globalSeitePfad(sp) ? null : globalSeite(p);
                const titel = z ? `${z.h1.replace(/[.]$/, "")}` : u.uebersichtTitel;
                return (
                  <a key={p} href={p}>
                    <span className="tag">{z ? z.auge.split(" · ").pop() : "FIAON Global"}</span>
                    <span className="titel">{titel}</span>
                    <span className="text">{z ? globalMenuePunkt(z.pfad)?.text ?? z.seo.beschreibung.slice(0, 90) + "…" : u.uebersichtText}</span>
                    <span className="pfeil"><Pfeil /></span>
                  </a>
                );
              })}
            </div>
          </WeiterAbschnitt>
        )}

        {/* ── Vertrauens-Band: vier Tatsachen mit Verweis, die Presse-Zeile genau einmal (Leitfaden 6.1) ── */}
        <GlobalVertrauen sprache={sp} land={land} leitsatz />

        {/* ── Schlussband — auf den Unterseiten die EINE dunkle Fläche: ruhiges Navy, Schrift, die Handlungen ── */}
        <section className={`fg-schluss ruhig${mitRechner ? " hell" : ""}`}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-schluss-text">
                <h2 className="fg-h2">{s.schluss?.a ?? t.schlussA}<em>{s.schluss?.b ?? t.schlussB}</em></h2>
                {/* Österreich: Der allgemeine Schluss-Satz nennt das Angebot — dort steht nur der eine Satz S17 (Leitfaden 5.12). */}
                <p className="fg-lead">{s.schluss?.text ?? (land === "AT" ? satz("S17", sp, "AT") : t.schlussText)}</p>
                <div className="fg-knoepfe">{knoepfe()}</div>
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Handlungsleiste am Handy: zwei Wege, in Österreich einer ─────── */}
        <div className={`fd-mobil${leiste ? " da" : ""}${nurGespraech ? " eins" : ""}`} aria-hidden={!leiste} {...(leiste ? {} : { inert: "" })}>
          {nurGespraech
            ? <a className="voll" href="#gespraech" onClick={zumGespraech}>{gespraechWort}</a>
            : (
              <>
                <a className="hell" href="#gespraech" onClick={zumGespraech}>{gespraechWort}</a>
                <a className="voll" href={beauftragen} onClick={klickBeauftragen}>{angebotWort}</a>
              </>
            )}
        </div>
      </div>
    </Dunkel>
  );
}

/** „Weiterlesen“ erscheint einmal als Ganzes, seine Zeilen gleiten gestaffelt nach (data-an wie jeder Abschnitt). */
function WeiterAbschnitt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -10% 0px");
  return <section ref={ref} className="fd-weiter" aria-labelledby="fd-weiter-titel">{children}</section>;
}

// ── Welcher Abschnitt gerade gelesen wird ────────────────────────────────────
function useScrollspy(ids: string[]): string | null {
  const [aktiv, setAktiv] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((eintraege) => {
      const sichtbar = eintraege.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (sichtbar[0]) setAktiv(sichtbar[0].target.id);
    }, { rootMargin: "-18% 0px -70% 0px", threshold: 0 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids.join("|")]);
  return aktiv;
}

// ── Aktuell aus der Redaktion (E-379) ───────────────────────────────────────
interface RedaktionsBeitrag { slug: string; titel: string; teaser: string; land: string; lesezeit: number; veroeffentlichtAm: string | null }
const AKTUELL_TITEL = { de: "Aktuell aus der Redaktion", en: "Latest from the editorial team" } as const;
const AKTUELL_SICHTBAR = 6;

/**
 * Die neuesten Business-Artikel als Verzeichnis — dieselbe Haarlinien-Liste wie „verzeichnis“. Die Links tragen
 * ?bereich=business: Menü und Fußzeile bleiben die von FIAON Global (lib/bereich.ts — ein Geschäftskunde verlässt
 * die Business-Welt nie aus Versehen).
 */
function RedaktionAktuell({ beitraege, nr, sp }: { beitraege: RedaktionsBeitrag[]; nr?: string; sp: Sp }) {
  const [alle, setAlle] = useState(false);
  const sichtbar = alle ? beitraege : beitraege.slice(0, AKTUELL_SICHTBAR);
  const am = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(sp === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }) : "");
  return (
    <Abschnitt id="aktuell">
      <Kopf nr={nr} h2={AKTUELL_TITEL[sp]} lead={sp === "en" ? "New articles for business owners — current, with sources." : "Jeden Tag ein neuer Beitrag für Unternehmer — aktuell, mit Quellen."} />
      <ul className="fd-verzeichnis">
        {sichtbar.map((b) => (
          <li key={b.slug}><a href={businessArtikelPfad(b.slug, sp)}>
            <span><span className="tag">{am(b.veroeffentlichtAm)} · {b.lesezeit} {sp === "en" ? "min" : "Min."}</span><span className="titel">{b.titel}</span><span className="text">{b.teaser}</span></span>
            <span className="pfeil"><Pfeil groesse={18} /></span>
          </a></li>
        ))}
      </ul>
      {beitraege.length > AKTUELL_SICHTBAR && (
        <button type="button" className="fg-textknopf fd-mehr" onClick={() => setAlle((x) => !x)}>
          {alle ? (sp === "en" ? "Show fewer" : "Weniger zeigen") : (sp === "en" ? `All ${beitraege.length} articles` : `Alle ${beitraege.length} Beiträge`)}
        </button>
      )}
    </Abschnitt>
  );
}

// ── Die Bausteine ────────────────────────────────────────────────────────────
/**
 * Ein Abschnitt, der einmal „ankommt“: data-an="1" beim Hineinscrollen (useEinmalSichtbar). Daran hängen sein Auftritt
 * als Ganzes (E-510: der Abschnitt gleitet einmal herein, seine Linie zeichnet sich, Zeilen von Listen folgen gestaffelt —
 * styles/global-apple.css), der einmalige Glanz der H2 und die Grafik-Bewegung der Bausteine. Schwelle 0 mit eigenem
 * Rand, weil ein Abschnitt höher als der Bildschirm sein kann (bewegung.ts). Ohne JS steht alles sofort.
 */
function Abschnitt({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -20% 0px");
  return <section ref={ref} id={id} className={`fd-abschnitt${className ? ` ${className}` : ""}`}>{children}</section>;
}

function Kopf({ nr, h2, lead }: { nr?: string; h2: string; lead?: string }) {
  return (
    <>
      {nr && <span className="fd-nr">{nr}.</span>}
      <h2 className="fd-h2 fg-h2">{h2}</h2>
      {lead && <p className="fd-block-lead">{lead}</p>}
    </>
  );
}

/**
 * Die Randnotiz reicht ab 1280 px über zwei Zeilen: den Abschnitt davor und den danach (06.10.2026, E-293). Ist der
 * nächste Baustein breit (Pakettafeln über beide Spalten) oder fehlt er, kann er nicht neben ihr stehen — dann blieb
 * links eine Lücke (auf /business/ablauf ≈ 225 px vor „Die vier Pakete“). Solche Notizen stehen deshalb unter ihrem
 * Abschnitt, eingerückt mit Haarlinie, wie unter 1280 px.
 */
const randDaneben = (naechster?: GlobalBlock) => !!naechster && naechster.typ !== "pakete" && naechster.typ !== "hinweis";

function Baustein({ b, nr, seite, sp, land, begriffe, onGespraech, randUnten = false }: { b: GlobalBlock; nr?: string; seite: GlobalSeite; sp: Sp; land: SatzLand; begriffe?: Map<string, Textteil[]>; onGespraech: (paket?: GlobalSchluessel) => void; randUnten?: boolean }): ReactNode {
  const u = GLOBAL_SEITE_WOERTER[sp];
  switch (b.typ) {
    case "text":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} />
          {b.absaetze.map((a, i) => (
            <p key={a.slice(0, 40)} className="fd-p">
              {(begriffe?.get(`${b.id}:${i}`) ?? [a]).map((t, j) => (typeof t === "string" ? t : <a key={j} href={t.pfad} className="fd-begriff">{t.text}</a>))}
            </p>
          ))}
          {b.punkte?.length ? <ul className="fd-punkte">{b.punkte.map((p) => <li key={p}>{p}</li>)}</ul> : null}
          {b.nach && <p className="fd-nach">{b.nach}</p>}
        </Abschnitt>
      );
    case "etappen":
      // Der Weg: dieselbe Haarlinien-Sprache wie die Wegleiste auf /business — Titel, Dauer und Text sichtbar.
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <SeitenWeg etappen={b.etappen} />
        </Abschnitt>
      );
    case "rollen":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <RollenDreieck sp={sp} />
          <div className="fd-rollen">
            {([[u.rollen.fiaon, b.fiaon, "fiaon"], [u.rollen.partner, b.partner, ""], [u.rollen.sie, b.sie, ""]] as const).map(([titel, liste, k]) => (
              <div key={titel} className={`fd-rolle ${k}`}><h3>{titel}</h3><ul>{liste.map((x) => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
        </Abschnitt>
      );
    case "tabelle":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-tabelle neu" role="group" aria-label={b.h2} tabIndex={0}>
            <table>
              <thead><tr>{b.kopf.map((k, i) => <th key={i} scope="col" className={b.hervor === i ? "hervor" : undefined}>{k}</th>)}</tr></thead>
              <tbody>
                {b.zeilen.map((z, zi) => (
                  <tr key={zi}>{z.map((zelle, i) => (i === 0 && b.kopf[0] === "" ? <th key={i} scope="row" className="zeilenkopf">{zelle}</th> : <td key={i} className={b.hervor === i ? "hervor" : undefined} data-label={i > 0 && b.kopf[i] ? b.kopf[i] : undefined}>{zelle}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.fuss?.length ? <ul className="fd-fuss">{b.fuss.map((f) => <li key={f}>{f}</li>)}</ul> : null}
        </Abschnitt>
      );
    case "karten":
      // E-510: Karten stehen an Haarlinien, ohne Symbol-Kachel — die Marke (tag) sagt, was die Karte ist.
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className={`fd-karten neu${b.spalten === 3 ? " drei" : ""}`}>
            {b.karten.map((k) => {
              const innen = (
                <>
                  {k.tag && <span className="tag">{k.tag}</span>}
                  <h3>{k.titel}</h3><p>{k.text}</p>
                </>
              );
              // 29.10.2026 (E-459): Karten mit fremder Adresse (Companies House) öffnen in einem neuen Tab — wie die Quellenliste.
              const extern = !!k.pfad && /^https?:\/\//.test(k.pfad);
              // Schlüssel aus Marke und Titel: Auf /business/partner tragen zwei Karten denselben Titel.
              const schluessel = `${k.tag ?? ""}|${k.titel}`;
              return k.pfad
                ? <a key={schluessel} className="fd-karte" href={k.pfad} {...(extern ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{innen}<span className="pfeil" aria-hidden="true"><Pfeil /></span></a>
                : <div key={schluessel} className="fd-karte">{innen}</div>;
            })}
          </div>
        </Abschnitt>
      );
    case "hinweis":
      // Randnotiz (Bauplan Kapitel 5, Punkt 5): ab 1280 px in der rechten Spalte neben dem Abschnitt davor, darunter
      // eingerückt mit Haarlinie — immer offen, jeder Punkt sichtbar (Pflichthinweise werden nie geklappt).
      return (
        <Abschnitt id={b.id} className={`fd-rand${randUnten ? " unten" : ""}`}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <ol className="fd-rand-punkte">{b.punkte.map((p) => <li key={p.slice(0, 50)}><span>{p}</span></li>)}</ol>
        </Abschnitt>
      );
    case "zitat":
      return <blockquote id={b.id} className="fd-zitat"><p>{u.zitat(b.text)}</p>{b.quelle && <footer>{b.quelle}</footer>}</blockquote>;
    // E-509 (12.11.2026): Es gibt EIN Produkt. Wo bis dahin eine Paketkarte (typ „paket“) oder alle vier (typ „pakete“)
    // standen, steht die Karte „Ein Mandat“ mit dem einen Preis und dem Weg zum Konfigurator. Das Feld `paket` des
    // Bausteins bleibt in den Seitentexten (Prüfstände, englische Zwillinge) und wird hier nicht mehr gelesen.
    case "paket":
    case "pakete":
      return (
        <Abschnitt id={b.id} className={b.typ === "pakete" ? "breit" : undefined}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          {land === "AT" ? (
            // Österreich (Leitfaden 5.12): kein Betrag, keine Karte mit Konto, Karten oder Finanzierung — nur der Satz zum
            // Honorar, der eine Satz zum weiteren Vorhaben und der Weg zum Gespräch.
            <div className="fd-mandat-at">
              <p>{weitererSatz("HONORAR-AT", sp)} {satz("S17", sp, "AT")}</p>
              <a className="fg-knopf" href="#gespraech" onClick={(e) => { e.preventDefault(); onGespraech(); }}>{handlung("gespraech", sp)}<Pfeil /></a>
            </div>
          ) : <VerkaufKarte sprache={sp} ort={seite.pfad} />}
        </Abschnitt>
      );
    case "standorte":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <OrteKarte sp={sp} />
        </Abschnitt>
      );
    // E-509: Der Finder ist der Konfigurator — dieselbe Fläche wie auf der Startseite.
    case "finder":
      return (
        <Abschnitt id={b.id} className="breit">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <VerkaufKonfigurator sprache={sp} eigeneSeite />
        </Abschnitt>
      );
    case "verzeichnis":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <ul className="fd-verzeichnis">
            {b.eintraege.map((e) => {
              const z = globalSeite(e.pfad);
              if (!z) return null;
              return (
                <li key={e.pfad}><a href={e.pfad}>
                  <span><span className="tag">{e.tag ?? z.auge}</span><span className="titel">{z.h1}{z.h1b ? ` ${z.h1b}` : ""}</span><span className="text">{z.seo.beschreibung}</span></span>
                  <span className="pfeil"><Pfeil groesse={18} /></span>
                </a></li>
              );
            })}
          </ul>
        </Abschnitt>
      );
    case "fragen":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-fragen"><Fragen items={b.fragen} ebene={3} /></div>
        </Abschnitt>
      );
    case "html":
      // E-439: ein Abschnitt eines Redaktionsartikels (Markdown → HTML, aus der eigenen Datenbank).
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} />
          <div className="fd-html" dangerouslySetInnerHTML={{ __html: b.html }} />
        </Abschnitt>
      );
  }
}
