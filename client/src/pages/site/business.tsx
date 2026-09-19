// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL (Neubau 17.09.2026, neu gestaltet 18.09.2026, E-188;
// neu geordnet 19.09.2026, E-192)
//
// Justin (17.09.): „FIAON positioniert sich für den B2B-Sektor komplett neu …
// Firmengründung in den USA, Steuerberater, Kreditkarten-System, Fundings —
// alles remote und über uns." Justin (18.09.): „In den Paketen sind ALLE
// Gebühren enthalten … Eine Mischung aus super seriösem Anwalt, Bank und
// Unternehmensberatung." Justin (19.09., /goal): „Die Business Seite muss
// PERFEKT sein, dass sie konvertieren kann … aus JEDER Perspektive."
//
// ── AUFBAU (19.09.2026) ────────────────────────────────────────────────────
// Hell wie ein Kanzlei- oder Bankauftritt (Stil: styles/global.css, .fg-):
//   Hero (Kapitalrahmen UND Festpreis im ersten Bildschirm, Auftragsübersicht)
//   → Acht Anlaufstellen oder ein Vertrag (#leistungen, mit ehrlicher Zeile)
//   → Der Weg I–IV (#ablauf, je Etappe: ab welchem Paket)
//   → Pakete (#pakete) mit Inklusivliste, Geld zurück, „Nicht im Festpreis",
//     Pflichthinweisen → Vergleichstabelle (am Handy zugeklappt)
//   → Erstgespräch (#gespraech) → Für wen (#fuer-wen) → Klare Verhältnisse
//   → Fragen (#fragen, mit den Einwänden aus dem Verkauf) → Schlussband.
//   Am Handy eine Handlungsleiste: Erstgespräch + „Pakete ab …", nach den
//   Paketen „Jetzt beauftragen".
// Gestrichen am 19.09.: „Aus einer Hand" (doppelt), „Unterlagen" (jetzt eine
// Frage), das Verzeichnis (Menü und Fußzeile führen alle Unterseiten) und der
// Erfahrungssatz („Wir sind diesen Weg selbst gegangen" — Justins eigener Fall
// gehört nicht auf die Seite, Entscheidung 17.09.). Das Team steht seit
// 18.09.2026 abends nicht mehr hier (Justin: „Das Team bitte weg").
//
// ── KAPITALRAHMEN UND GLANZ (18.09.2026 abends, Justin) ────────────────────
// „Statt Planungsgröße sowas wie Kapitalgröße — und präsenter machen, darum
// geht's ja." Der Kapitalrahmen steht im Kopf der Seite (Spanne über alle
// Pakete) und auf jeder Tafel groß über dem Preis; der Satz „über den Rahmen
// entscheidet das Institut" steht direkt darunter (Blickfang-Regel). Seit
// 19.09. steht der Festpreis „ab …" gleich daneben — wer ihn erst am Ende
// der Seite findet, rechnet mit mehr.
//
// Preise kommen aus dem Katalog (shared/fiaon-pakete.ts), Leistungen,
// Inklusivliste, Vergleich und Pflichthinweise aus shared/fiaon-global.ts —
// dieselben Sätze stehen im Vertrag, den der Kunde unterschreibt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_WOERTER } from "@/i18n/global";
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_INKLUSIVE, GLOBAL_LAUFEND,
  GLOBAL_NICHT_INKLUSIVE, GLOBAL_VERGLEICH, globalPaket, globalPreisText, globalPlanungText, globalKapital, globalKapitalSpanne,
  type GlobalSchluessel,
} from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { GLOBAL_STANDORTE, standortNachweis } from "@shared/fiaon-global-partner";
import { globalSeite } from "@shared/fiaon-global-seiten";
import { werbeEreignis } from "@/lib/werbung";
import GlobalUhren from "@/components/site/GlobalUhren";
import GlobalSchlagzeilen from "@/components/site/GlobalSchlagzeilen";
import GlobalJahresbetreuung from "@/components/site/GlobalJahresbetreuung";
import { GlobalVipBuehne, GlobalVipTicket } from "@/components/site/GlobalVip";
import "@/styles/global.css";

/** Das eine Zeichen der Seite: ein ruhiger Haken. */
export function Haken({ groesse = 16 }: { groesse?: number }) {
  return (
    <svg className="fg-haken" width={groesse} height={groesse} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

const FOKUS = "global_kapital";
const ROEMISCH = ["I", "II", "III", "IV"];
/** Ab welchem Paket eine Etappe des Wegs enthalten ist — deckungsgleich mit GLOBAL_VERGLEICH. */
const ETAPPE_AB: GlobalSchluessel[] = ["global_struktur", "global_struktur", "global_banking", "global_kapital"];
/** Bis zu welcher Etappe (1–4) ein Paket begleitet — aus ETAPPE_AB, also deckungsgleich mit dem Weg. */
const etappenBis = (i: number) => ETAPPE_AB.filter((ab) => GLOBAL_PAKETE.findIndex((p) => p.key === ab) <= i).length;
/** Global Struktur zeigt zuerst: Gründung, EIN/ITIN, Agent/Adresse/Telefon, erster Konto- und Kartenantrag. */
const STRUKTUR_ZUERST = [0, 1, 2, 6];

function Plus() {
  return <svg className="fg-plus" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function Winkel({ offen }: { offen: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: offen ? "rotate(180deg)" : undefined, transition: "transform .25s" }}><path d="m6 9 6 6 6-6" /></svg>;
}
/** Der Funke am VIP-Zeichen und am Band der empfohlenen Tafel. */
function Funke() {
  return <svg className="fg-funke" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor" /></svg>;
}

// ── ZWEI STARTSEITEN, EIN AUFBAU (19.09.2026, E-196) ─────────────────────────
// Justin: „Auf /business/privatpersonen soll die Privatperson auch die anderen
// Pakete zur Auswahl bekommen — vom Design her wie eine Startseite für
// Privatpersonen, viel hochwertiger und konversionsstärker." Dieselbe Seite mit
// eigenem Kopf, eigenen Fragen und „Für wen" (GLOBAL_WOERTER.*.privat); jede
// Paket-Tafel führt in den Auftrag als Privatperson (?art=privat).
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
  const seitePfad = privat ? "/business/privatpersonen" : s === "en" ? "/en/business" : "/business";
  const abPreis = globalPreisText("global_struktur", s);

  // Der Paketwunsch reist von der Tafel („Erst sprechen") in den Kalender.
  const [wunsch, setWunsch] = useState<string | null>(null);
  // Am Handy steht immer EINE Tafel da, die Wahl darüber zeigt alle vier Preise (CSS greift nur unter 641 px).
  const [mobilPaket, setMobilPaket] = useState<string>("global_struktur");
  // Die Vergleichstabelle ist am Handy zugeklappt (CSS greift nur unter 900 px).
  const [tabelleAuf, setTabelleAuf] = useState(false);
  // Aufgeklappte Leistungslisten der Tafeln (Global Struktur hat acht Punkte).
  const [mehr, setMehr] = useState<Record<string, boolean>>({});
  // Handlungsleiste am Handy: erst nach dem Kopf, nie über Kalender oder Schlussband.
  const [leiste, setLeiste] = useState<"aus" | "pakete" | "beauftragen">("aus");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paket");
    if (p) setWunsch(p);
    if (p && globalPaket(p)) setMobilPaket(globalPaket(p)!.key);
    // Wer mit #gespraech oder #pakete ankommt (z. B. von /termin?quelle=global), landet dort —
    // erst nach dem ersten Bild, sonst misst der Browser die Höhe der Seite falsch.
    const anker = window.location.hash;
    if (anker) requestAnimationFrame(() => setTimeout(() => document.querySelector(anker)?.scrollIntoView(), 60));
  }, []);

  useEffect(() => {
    let bild = 0;
    const messen = () => {
      bild = 0;
      const h = window.innerHeight;
      const oben = (id: string) => document.getElementById(id)?.getBoundingClientRect() ?? null;
      const kopf = document.querySelector(".fg-hero")?.getBoundingClientRect();
      const pakete = oben("pakete");
      const gespraech = oben("gespraech");
      const schluss = document.querySelector(".fg-schluss")?.getBoundingClientRect();
      const kopfWeg = !!kopf && kopf.bottom < 80;
      const gespraechDa = !!gespraech && gespraech.top < h * 0.85 && gespraech.bottom > h * 0.15;
      const schlussDa = !!schluss && schluss.top < h;
      if (!kopfWeg || gespraechDa || schlussDa) { setLeiste("aus"); return; }
      // Wer die Pakete gesehen hat, bekommt „Jetzt beauftragen" statt „Pakete ab …".
      setLeiste(pakete && pakete.top < h * 0.3 ? "beauftragen" : "pakete");
    };
    const planen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", planen);
    return () => { window.removeEventListener("scroll", planen); window.removeEventListener("resize", planen); if (bild) cancelAnimationFrame(bild); };
  }, []);

  const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;
  const zumGespraech = (paket?: string) => {
    if (paket) setWunsch(paket);
    document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() });
  };
  const zuDenPaketen = () => document.getElementById("pakete")?.scrollIntoView({ behavior: glatt() });
  // Unter den Tafeln: „Alle Leistungen im Vergleich" öffnet die Tabelle und gleitet hin.
  const zumVergleich = () => { setTabelleAuf(true); requestAnimationFrame(() => document.getElementById("vergleich")?.scrollIntoView({ behavior: glatt() })); };
  // Wer mitten in einer Tafel umschaltet, beginnt die neue oben — nicht irgendwo in ihrer Mitte.
  const paketZeigen = (key: string) => {
    setMobilPaket(key);
    requestAnimationFrame(() => {
      const tafel = document.getElementById(`paket-${key}`);
      if (tafel && tafel.getBoundingClientRect().top < 150) tafel.scrollIntoView({ block: "start", behavior: glatt() });
    });
  };
  const geld = GLOBAL_GELD_ZURUECK.aktiv ? GLOBAL_GELD_ZURUECK[s] : null;
  // Wie auf Unterseiten und Landingpages: Jeder Klick auf „beauftragen" zählt (nur mit Einwilligung, lib/werbung.ts).
  const klick = (paket?: string, ort = "") => () => werbeEreignis("global_beauftragen_klick", { paket: paket ?? "", seite: seitePfad, ort });
  const londonOrt = GLOBAL_STANDORTE.find((o) => o.schluessel === "london");

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <div className="fg">
        {/* ── Hero: Anspruch, Kapitalrahmen und Festpreis links, der Auftrag rechts ── */}
        <section className="fg-hero">
          <div className="fg-rahmen fg-hero-raster">
            <Auf className="fg-hero-text">
              <span className="fg-auge">{t.auge}</span>
              <h1 className="fg-h1">{t.h1a}<br /><em>{t.h1b}</em></h1>
              <p className="fg-lead">{t.lead}</p>
              <div className="fg-kopf-zahlen">
                <div>
                  <span>{t.kapitalKopf}</span>
                  <b className="fg-glanz">{globalKapitalSpanne(s)}</b>
                  <em>{t.kapitalKopfZusatz}</em>
                </div>
                <div>
                  <span>{t.preisKopf}</span>
                  <b className="fg-glanz">{t.preisAb} {abPreis}</b>
                  <em>{t.preisKopfZusatz}</em>
                </div>
              </div>
              <div className="fg-knoepfe fg-hero-knoepfe">
                <button type="button" className="fg-knopf" onClick={zuDenPaketen}>{t.knopfPakete}<Pfeil /></button>
                <button type="button" className="fg-knopf hell" onClick={() => zumGespraech()}>{t.knopfGespraech}</button>
              </div>
              <p className="fg-mikro">{t.gespraechMikro}</p>
              <ul className="fg-vertrauen">
                <li><Haken />{t.vertrauen[0]}</li>
                <li><Haken />{t.vertrauenZusatz.pfad ? <a href={t.vertrauenZusatz.pfad}>{t.vertrauenZusatz.text}</a> : t.vertrauenZusatz.text}</li>
                <li><Haken />{t.vertrauen[1]}</li>
                {geld && <li><Haken /><span>{geld.kurz}<sup>1</sup></span></li>}
              </ul>
              {geld && <p className="fg-fussnote"><sup>1</sup> {geld.bedingungen}</p>}
            </Auf>
            <Auf verzoegerung={140} className="fg-hero-auftrag">
              <figure className="fg-mandat" aria-label={t.mandatTitel}>
                <div className="fg-mandat-kopf"><b>{t.mandatTitel}</b><span>{t.mandatMarke}</span></div>
                <dl>
                  {t.mandat.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><Haken />{v}</dd></div>)}
                  <div className="preis"><dt>{t.mandatPreis}</dt><dd><Haken />{t.mandatPreisText(abPreis)}</dd></div>
                  <div><dt>{t.mandatJahr[0]}</dt><dd><Haken />{t.mandatJahr[1]}</dd></div>
                </dl>
                <figcaption className="fg-mandat-fuss">{t.mandatPartner}: <b>{FIAON_FIRMA.name}</b> · Companies House No. {FIAON_FIRMA.companyNo} · {FIAON_FIRMA.ortZeile.split(",")[0]}</figcaption>
              </figure>
            </Auf>
          </div>
        </section>

        {/* ── Nachrichtenlage: echte Meldungen mit Quelle (19.09.2026, E-196) ── */}
        <GlobalSchlagzeilen sprache={s} auge={t.presseAuge} h2={t.presseH2} stand={t.presseStand} zurQuelle={t.presseZurQuelle}
          hinweis={t.presseHinweis} laufband={t.presseLaufband} pause={t.pressePause} weiter={t.presseWeiter} />

        {/* ── Acht Anlaufstellen oder ein Vertrag ────────────────────────────── */}
        <section id="leistungen" className="fg-sek stein" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.vsAuge}</span><h2 className="fg-h2">{t.vsH2}</h2></div>
                <p className="fg-lead">{t.vsLead}</p>
              </div>
            </Auf>
            <Auf verzoegerung={80}>
              <div className="fg-vs">
                <div className="fg-vs-karte ohne">
                  <h3>{t.ohneTitel}</h3>
                  <ol>{t.ohne.map((x, i) => <li key={x}><span className="nr">{i + 1}</span>{x}</li>)}</ol>
                </div>
                <div className="fg-vs-karte mit">
                  <h3>{t.mitTitel}</h3>
                  <ul>{t.mit.map((x) => <li key={x}><Haken groesse={18} />{x}</li>)}</ul>
                  <div className="fg-knoepfe" style={{ marginTop: 30 }}>
                    <button type="button" className="fg-knopf" onClick={zuDenPaketen}>{t.knopfPakete}<Pfeil /></button>
                  </div>
                </div>
              </div>
              {/* Ehrlich statt laut: Wer nur die Gesellschaft braucht, ist woanders günstiger. */}
              <div className="fg-ehrlich">
                <b>{t.ehrlichTitel}</b>
                <p>{t.ehrlichText}</p>
                {s === "de" && <a href="/business/vergleich">{t.ehrlichLink}<Pfeil /></a>}
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Der Weg ────────────────────────────────────────────────────────── */}
        <section id="ablauf" className="fg-sek" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.wegAuge}</span><h2 className="fg-h2">{t.wegH2}</h2></div>
                <p className="fg-lead">{t.wegLead}</p>
              </div>
            </Auf>
            <Auf verzoegerung={80}>
              <ol className="fg-weg">
                {t.weg.map((w, i) => {
                  const ab = ETAPPE_AB[i];
                  return (
                    <li key={w.titel}>
                      <span className="nr">{ROEMISCH[i]}</span>
                      <span className={`fg-etappe-paket${ab === "global_struktur" ? " alle" : ""}`}>{ab === "global_struktur" ? t.inJedemPaket : t.abPaket(globalPaket(ab)![s].name)}</span>
                      <h3>{w.titel}</h3>
                      <span className="dauer">{w.dauer}</span>
                      <p>{w.text}</p>
                    </li>
                  );
                })}
              </ol>
            </Auf>
          </div>
        </section>

        {/* ── Pakete ─────────────────────────────────────────────────────────── */}
        <section id="pakete" className="fg-sek stein" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.paketeAuge}</span><h2 className="fg-h2">{t.paketeH2}</h2></div>
                <p className="fg-lead">{t.paketeLead}</p>
              </div>
            </Auf>
            {/* Am Handy: die Wahl zwischen den vier Tafeln — mit Preis, damit niemand suchen muss.
                Der Rahmen hält die Wahl nur so lange oben, wie die Tafel zu sehen ist. */}
            <div className="fg-pakete-rahmen">
              <div className="fg-paket-wahl" role="group" aria-label={t.paketeAuge}>
                {GLOBAL_PAKETE.map((p) => (
                  <button key={p.key} type="button" id={`wahl-${p.key}`} aria-pressed={mobilPaket === p.key} aria-controls={`paket-${p.key}`} onClick={() => paketZeigen(p.key)}>
                    <b>{p[s].name.replace(/^Global\s+/, "")}</b><span>{globalPreisText(p.key, s)}</span>
                  </button>
                ))}
              </div>
              {/* 19.09.2026 — Justin: „zu lang, zu schmal … das VIP-Paket muss speziell angezeigt werden".
                  Drei Tafeln nebeneinander (Zahlen nebeneinander, Knopf vor der Liste, lange Liste
                  aufklappbar), Global VIP darunter über die ganze Breite (components/site/GlobalVip.tsx). */}
              <div className="fg-tarife">
                {GLOBAL_PAKETE.map((p, i) => {
                  const w = p[s];
                  const kapital = globalKapital(p.key, s);
                  const vip = p.key === "global_vip";
                  const fokus = p.key === FOKUS;
                  const bis = etappenBis(i);
                  // Ab dem zweiten Paket ist der erste Punkt „Alles aus …" — er steht als eigene Zeile über der Liste.
                  const erbe = i > 0 ? w.leistungen[0] : null;
                  const eigene = i > 0 ? w.leistungen.slice(1) : w.leistungen;
                  const klasse = `fg-tarif${fokus ? " fokus" : ""}${vip ? " vip" : ""}${p.key === mobilPaket ? " gewaehlt" : ""}`;
                  const kapitalZeile = kapital.bisZu ? `${t.planung} ${kapital.bisZu}` : t.planung;
                  const weg = (
                    <div className="fg-tarif-weg">
                      <span className="balken" aria-hidden="true">{ROEMISCH.map((r, j) => <i key={r} className={j < bis ? "an" : undefined} />)}</span>
                      <span className="text">{t.etappenBis(ROEMISCH[bis - 1])} · {w.dauerKurz}</span>
                    </div>
                  );

                  if (vip) {
                    return (
                      <Auf key={p.key} verzoegerung={i * 70}>
                        <GlobalVipBuehne id={`paket-${p.key}`} className={klasse} label={w.name}>
                          <div className="fg-vip-text">
                            <div className="fg-vip-zeile"><span className="fg-vip-zeichen"><Funke />{t.vipZeichen}</span><span className="marke">{w.marke}</span></div>
                            <h3>{w.name}</h3>
                            <p className="fuer">{w.fuer}</p>
                            {weg}
                            <div className="fg-vip-kapital">
                              <span>{kapitalZeile}</span>
                              <b className="fg-glanz">{kapital.wert}</b>
                              <em>{t.planungZusatz}</em>
                            </div>
                            {erbe && <p className="fg-tarif-erbe"><Plus />{erbe}</p>}
                            <ul>{eigene.map((x) => <li key={x}><Haken />{x}</li>)}</ul>
                          </div>
                          <div className="fg-vip-seite">
                            <GlobalVipTicket texte={t.vipTicket} />
                            <div className="fg-vip-preis">
                              <div><span>{t.festpreis}</span><b className="fg-glanz">{globalPreisText(p.key, s)}</b></div>
                              <span className="inkl"><Haken groesse={13} />{t.inklusive}</span>
                            </div>
                            {/* Global VIP beginnt mit einem Gespräch — für 35.999 € kauft niemand ohne. */}
                            <div className="tun">
                              <button type="button" className="fg-knopf voll" aria-label={t.vipGespraech(w.name)} onClick={() => zumGespraech(p.key)}>{t.vipGespraechKurz}<Pfeil /></button>
                              <a className="fg-textknopf" href={start(p.key)} onClick={klick(p.key, "tafel")}>{t.direktBeauftragen}</a>
                            </div>
                          </div>
                        </GlobalVipBuehne>
                      </Auf>
                    );
                  }

                  const alle = mehr[p.key] === true;
                  // Global Struktur hat acht Punkte: zuerst die vier, an denen man das Paket erkennt, der Rest aufklappbar.
                  const zuerstIdx = i === 0 ? STRUKTUR_ZUERST.filter((j) => j < eigene.length) : eigene.map((_, j) => j);
                  const zuerst = zuerstIdx.map((j) => eigene[j]);
                  const danach = eigene.filter((_, j) => !zuerstIdx.includes(j));
                  return (
                    <Auf key={p.key} verzoegerung={i * 70}>
                      <article id={`paket-${p.key}`} className={klasse} aria-label={w.name}>
                        {fokus && <span className="fg-tarif-band"><Funke />{t.fokusBand}</span>}
                        <div className="fg-tarif-kopf">
                          <span className="marke">{w.marke}</span>
                          <h3>{w.name}</h3>
                          <p className="fuer">{w.fuer}</p>
                        </div>
                        {weg}
                        <div className="fg-tarif-zahlen">
                          <div>
                            <span>{kapitalZeile}</span>
                            <b className="fg-glanz">{kapital.wert}</b>
                            <em>{t.planungZusatz}</em>
                          </div>
                          <div>
                            <span>{t.festpreisKurz}</span>
                            <b className="fg-glanz">{globalPreisText(p.key, s)}</b>
                            <em className="inkl"><Haken groesse={12} />{t.einmaligInklusive}</em>
                          </div>
                        </div>
                        <div className="tun">
                          <a className={`fg-knopf voll${fokus ? "" : " hell"}`} href={start(p.key)} aria-label={t.beauftragen(w.name)} onClick={klick(p.key, "tafel")}>
                            {t.beauftragenKurz}<Pfeil />
                          </a>
                          <button type="button" className="fg-textknopf" onClick={() => zumGespraech(p.key)}>{t.erstSprechen}</button>
                        </div>
                        <div className="fg-tarif-leistungen">
                          {erbe && <p className="fg-tarif-erbe"><Plus />{erbe}</p>}
                          <ul id={`leistungen-${p.key}`}>
                            {zuerst.map((x) => <li key={x}><Haken />{x}</li>)}
                            {alle && danach.map((x) => <li key={x} className="neu"><Haken />{x}</li>)}
                          </ul>
                          {danach.length > 0 && (
                            <button type="button" className="fg-tarif-mehr" aria-expanded={alle} aria-controls={`leistungen-${p.key}`}
                                    onClick={() => setMehr({ ...mehr, [p.key]: !alle })}>
                              {alle ? t.wenigerLeistungen : t.alleLeistungen(eigene.length)}<Winkel offen={alle} />
                            </button>
                          )}
                        </div>
                      </article>
                    </Auf>
                  );
                })}
              </div>
            </div>
            <button type="button" className="fg-tarif-vergleich" onClick={zumVergleich}>{t.zumVergleich}<Pfeil /></button>
            <div className="fg-paket-fuss">
              <p>
                {t.vertragVorab} <a href={s === "en" ? "/en/business/mustervertrag" : "/business/mustervertrag"}>{t.mustervertragLesen}</a>. {t.perRechnung} {t.kostenHinweis}
              </p>
              {s === "de" && <p>{t.finderFrage} <a href="/business/paket-finder">{t.finderLink}</a></p>}
            </div>

            <Auf>
              <div className="fg-inkl">
                <div>
                  <span className="fg-auge">{t.inklAuge}</span>
                  <h3>{t.inklTitel}</h3>
                </div>
                <div>
                  <p className="fg-leise" style={{ marginTop: 0, marginBottom: 14 }}>{t.inklLead}</p>
                  <ul>{GLOBAL_INKLUSIVE[s].map((x) => <li key={x}><Haken />{x}</li>)}</ul>
                  <p className="fg-leise">{GLOBAL_LAUFEND[s]}</p>
                </div>
              </div>
            </Auf>

            <Auf>
              <div className={`fg-klar${geld ? "" : " ohne-geld"}`}>
                {geld && (
                  <div className="fg-karte geld">
                    <span className="tag">FIAON</span>
                    <h3>{geld.titel}</h3>
                    <p>{geld.text}</p>
                    <p className="klein">{geld.bedingungen}</p>
                  </div>
                )}
                <div className="fg-karte">
                  <h3 style={{ marginTop: 0 }}>{t.nichtTitel}</h3>
                  <p className="klein" style={{ marginTop: 8 }}>{t.nichtLead}</p>
                  <ul>{GLOBAL_NICHT_INKLUSIVE[s].map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div className="fg-karte">
                  <h3 style={{ marginTop: 0 }}>{t.wissenTitel}</h3>
                  <ul>{GLOBAL_PFLICHTHINWEIS[s].map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Jahresbetreuung ab dem zweiten Jahr (19.09.2026, E-196) ───────── */}
        <GlobalJahresbetreuung sprache={s} groesse="voll" startPfad={start()} onGespraech={() => zumGespraech()}
          knopf={t.jbKnopf} gespraech={t.jbGespraech} so={t.jbSo} />

        {/* ── Alle Leistungen im Vergleich ───────────────────────────────────── */}
        <section id="vergleich" className={`fg-sek fg-vergleich${tabelleAuf ? " auf" : ""}`} style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.vergleichAuge}</span><h2 className="fg-h2">{t.vergleichH2}</h2></div>
                <p className="fg-lead">{t.vergleichLead}</p>
              </div>
            </Auf>
            <button type="button" className="fg-knopf hell fg-tabelle-schalter" aria-expanded={tabelleAuf} aria-controls="fg-tabelle" onClick={() => setTabelleAuf(!tabelleAuf)}>
              {tabelleAuf ? t.tabelleZu : t.tabelleAuf}
            </button>
            <p className="fg-wisch">{t.wischen}</p>
            <div className="fg-tabelle" id="fg-tabelle" role="region" aria-label={t.vergleichH2} tabIndex={0}>
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
        </section>

        {/* ── Erstgespräch ───────────────────────────────────────────────────── */}
        <section id="gespraech" className="fg-sek stein" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2">{t.gespraechH2}</h2></div>
                <p className="fg-lead">{t.gespraechLead}</p>
              </div>
            </Auf>
            <GlobalGespraech paket={wunsch} />
          </div>
        </section>

        {/* ── Für wen ────────────────────────────────────────────────────────── */}
        <section id="fuer-wen" className="fg-sek eng" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.fuerAuge}</span><h2 className="fg-h2">{t.fuerH2}</h2></div>
                <p className="fg-lead">{t.fuerLead}</p>
              </div>
              {/* Deutsch führt jede Kachel auf ihre Unterseite; die Unterseiten gibt es nur deutsch. */}
              <div className="fg-fuer">
                {t.fuer.map((x) => x.pfad
                  ? <a key={x.tag} href={x.pfad}><b>{x.tag}</b><p>{x.text}</p><span className="pfeil"><Pfeil /></span></a>
                  : <div key={x.tag}><b>{x.tag}</b><p>{x.text}</p></div>)}
              </div>
              {t.fuerLaenderLinks.length > 0 && (
                <p className="fg-laender">{t.fuerLaender} {t.fuerLaenderLinks.map(([pfad, text], i) => <span key={pfad}>{i > 0 && " · "}<a href={pfad}>{text}</a></span>)}</p>
              )}
              {/* 19.09.2026 (E-191): Auch ohne eigene Firma — die englische Seite führt direkt in den Auftrag.
                  Auf der Startseite für Privatpersonen (E-196) zeigt die Kachel den Weg zurück für Unternehmen. */}
              {privat ? (
                <a className="fg-privat" href={s === "en" ? "/en/business" : "/business"}>
                  <span className="fg-privat-rumpf">
                    <span className="fg-auge">{basis.privat.gegenAuge}</span>
                    <b>{basis.privat.gegenTitel}</b>
                    <span>{basis.privat.gegenText}</span>
                  </span>
                  <span className="fg-privat-knopf">{basis.privat.gegenKnopf}<Pfeil /></span>
                </a>
              ) : (
                <a className="fg-privat" href={s === "en" ? globalStartPfad(undefined, "en", "privat") : "/business/privatpersonen"}>
                  <span className="fg-privat-rumpf">
                    <span className="fg-auge">{t.privatAuge}</span>
                    <b>{t.privatTitel}</b>
                    <span>{t.privatText}</span>
                  </span>
                  <span className="fg-privat-knopf">{t.privatKnopf}<Pfeil /></span>
                </a>
              )}
              <p className="fg-ausstieg">{t.fuerAusstieg}</p>
            </Auf>
          </div>
        </section>

        {/* ── Drei Uhren: Deutschland, Florida, London (19.09.2026, E-196) ─── */}
        <GlobalUhren auge={t.uhrenAuge} h2={t.uhrenH2} lead={t.uhrenLead} orte={t.uhren} gleichText={t.uhrenGleich} differenzText={t.uhrenDifferenz} />

        {/* ── Klare Verhältnisse ─────────────────────────────────────────────── */}
        <section className="fg-sek stein">
          <div className="fg-rahmen">
            <Auf>
              <span className="fg-auge">{t.sicherAuge}</span>
              <h2 className="fg-h2">{t.sicherH2}</h2>
            </Auf>
            <Auf verzoegerung={80}>
              <div className="fg-drei">
                {(["fiaon", "partner", "kosten"] as const).map((k) => (
                  <div key={k} className="fg-karte"><h3 style={{ marginTop: 0 }}>{t.rollenTitel[k]}</h3><p>{GLOBAL_ROLLEN[s][k]}</p></div>
                ))}
              </div>
              {/* Die drei Standorte — und offen gesagt, wie sie verbunden sind (shared/fiaon-global-partner.ts). */}
              <div className="fg-standorte">
                <div className="fg-standorte-kopf">
                  <span className="fg-auge">{t.standorteAuge}</span>
                  <h3>{t.standorteTitel}</h3>
                </div>
                <ul>
                  {GLOBAL_STANDORTE.map((o) => (
                    <li key={o.schluessel} className={o === londonOrt ? "vertragspartner" : undefined}>
                      <span className="stadt">{o.stadt}</span>
                      <b>{o.gesellschaft}</b>
                      <span className="rolle">{t.standorteRolle[o.schluessel]}</span>
                      <address>
                        {o.adresse.join(", ")} · {t.standorteLand[o.schluessel]}<br />{standortNachweis(o)}
                        {o === londonOrt && (
                          <><br />Director: {FIAON_FIRMA.director}<br /><a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a> · <a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a></>
                        )}
                      </address>
                    </li>
                  ))}
                </ul>
                <p className="fg-leise">{t.standorteVerbunden}{s === "de" && <> <a href="/business/partner">{t.standorteMehr}</a></>}</p>
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Fragen ─────────────────────────────────────────────────────────── */}
        <section id="fragen" className="fg-sek" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen fg-fragen">
            <Auf className="fg-fragen-kopf">
              <span className="fg-auge">{t.fragenAuge}</span>
              <h2 className="fg-h2">{t.fragenH2}</h2>
              <div className="fg-fragen-kontakt">
                <b>{t.fragenNicht}</b>
                <p>{t.fragenNichtText}</p>
                <p><a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a><br /><a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a></p>
                {s === "de" && <a className="fg-fragen-alle" href="/business/fragen">{t.fragenAlle}<Pfeil /></a>}
              </div>
            </Auf>
            {/* Privatpersonen: die Fragen aus dem Registereintrag — dasselbe FAQ-Markup wie das Vorab-HTML dieser Adresse. */}
            <Fragen items={privat ? globalSeite("/business/privatpersonen")?.fragen ?? t.fragen : t.fragen} />
          </div>
        </section>

        {/* ── Schlussband ────────────────────────────────────────────────────── */}
        <section className="fg-schluss">
          <div className="fg-rahmen schmal">
            <h2 className="fg-h2">{t.schlussA}<em>{t.schlussB}</em></h2>
            <p className="fg-lead">{t.schlussText}</p>
            <div className="fg-knoepfe">
              <a className="fg-knopf" href={start()} onClick={klick(undefined, "schluss")}>{t.schlussBeauftragen}<Pfeil /></a>
              <button type="button" className="fg-knopf hell" onClick={() => zumGespraech()}>{t.knopfGespraech}</button>
            </div>
          </div>
        </section>

        {/* ── Handlungsleiste am Handy ───────────────────────────────────────── */}
        <div className={`fg-mobil${leiste !== "aus" ? " da" : ""}`} aria-hidden={leiste === "aus"}>
          <button type="button" className="hell" onClick={() => zumGespraech()} tabIndex={leiste === "aus" ? -1 : 0}>{t.leisteGespraech}</button>
          {leiste === "beauftragen"
            ? <a className="voll" href={start()} tabIndex={0} onClick={klick(undefined, "leiste")}>{t.leisteBeauftragen}</a>
            : <button type="button" className="voll" onClick={zuDenPaketen} tabIndex={leiste === "aus" ? -1 : 0}>{t.leistePakete(abPreis)}</button>}
        </div>
      </div>
    </Dunkel>
  );
}
