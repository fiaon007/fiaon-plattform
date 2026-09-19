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
import { GLOBAL_STANDORTE } from "@shared/fiaon-global-partner";
import { werbeEreignis } from "@/lib/werbung";
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

export default function Business() {
  const t = useWoerter(GLOBAL_WOERTER);
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const start = (paket?: string) => globalStartPfad(paket, s);
  const abPreis = globalPreisText("global_struktur", s);

  // Der Paketwunsch reist von der Tafel („Erst sprechen") in den Kalender.
  const [wunsch, setWunsch] = useState<string | null>(null);
  // Am Handy steht immer EINE Tafel da, die Wahl darüber zeigt alle vier Preise (CSS greift nur unter 641 px).
  const [mobilPaket, setMobilPaket] = useState<string>("global_struktur");
  // Die Vergleichstabelle ist am Handy zugeklappt (CSS greift nur unter 900 px).
  const [tabelleAuf, setTabelleAuf] = useState(false);
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
  const klick = (paket?: string, ort = "") => () => werbeEreignis("global_beauftragen_klick", { paket: paket ?? "", seite: s === "en" ? "/en/business" : "/business", ort });
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
                </dl>
                <figcaption className="fg-mandat-fuss">{t.mandatPartner}: <b>{FIAON_FIRMA.name}</b> · Companies House No. {FIAON_FIRMA.companyNo} · {FIAON_FIRMA.ortZeile.split(",")[0]}</figcaption>
              </figure>
            </Auf>
          </div>
        </section>

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
              <div className="fg-pakete">
                {GLOBAL_PAKETE.map((p, i) => {
                  const w = p[s];
                  const kapital = globalKapital(p.key, s);
                  const vip = p.key === "global_vip";
                  return (
                    <Auf key={p.key} verzoegerung={i * 70}>
                      <article id={`paket-${p.key}`} className={`fg-paket${p.key === FOKUS ? " fokus" : ""}${p.key === mobilPaket ? " gewaehlt" : ""}`} style={{ height: "100%" }} aria-label={w.name}>
                        {p.key === FOKUS && <span className="fg-paket-band">{t.fokusBand}</span>}
                        <span className="marke">{w.marke}</span>
                        <h3>{w.name}</h3>
                        <p className="fuer">{w.fuer}</p>
                        <div className="fg-kapital">
                          {/* „bis zu" gehört in die Überzeile — so bleibt die Zahl allein und jede Tafel gleich hoch */}
                          <span>{kapital.bisZu ? `${t.planung} ${kapital.bisZu}` : t.planung}</span>
                          <b className="fg-glanz">{kapital.wert}</b>
                          <em>{t.planungZusatz}</em>
                        </div>
                        <div className="fg-preis">
                          <span className="fg-preis-marke">{t.festpreis}</span>
                          <b className="fg-glanz">{globalPreisText(p.key, s)}</b>
                          <span className="fg-chip"><Haken groesse={13} />{t.inklusive}</span>
                        </div>
                        <div className="fg-masse">
                          <div><span>{t.begleitung}</span><b>{w.dauerKurz}</b></div>
                        </div>
                        <ul>{w.leistungen.map((x, j) => <li key={x} className={j === 0 && i > 0 ? "erbe" : undefined}><Haken />{x}</li>)}</ul>
                        <div className="tun">
                          {/* Global VIP beginnt mit einem Gespräch — für 35.999 € kauft niemand ohne. */}
                          {vip ? (
                            <>
                              <button type="button" className="fg-knopf voll" onClick={() => zumGespraech(p.key)}>
                                <span className="lang">{t.vipGespraech(w.name)}</span><span className="kurz">{t.vipGespraechKurz}</span>
                              </button>
                              <a className="fg-textknopf" href={start(p.key)} onClick={klick(p.key, "tafel")}>{t.direktBeauftragen}</a>
                            </>
                          ) : (
                            <>
                              <a className={`fg-knopf voll${p.key === FOKUS ? "" : " hell"}`} href={start(p.key)} aria-label={t.beauftragen(w.name)} onClick={klick(p.key, "tafel")}>
                                <span className="lang">{t.beauftragen(w.name)}</span><span className="kurz">{t.beauftragenKurz}</span><Pfeil />
                              </a>
                              <button type="button" className="fg-textknopf" onClick={() => zumGespraech(p.key)}>{t.erstSprechen}</button>
                            </>
                          )}
                        </div>
                      </article>
                    </Auf>
                  );
                })}
              </div>
            </div>
            <div className="fg-paket-fuss">
              <p>
                {t.vertragVorab}{s === "de" && <> <a href="/business/mustervertrag">{t.mustervertragLesen}</a>.</>} {t.perRechnung} {t.kostenHinweis}
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

        {/* ── Alle Leistungen im Vergleich ───────────────────────────────────── */}
        <section className={`fg-sek fg-vergleich${tabelleAuf ? " auf" : ""}`}>
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
              {/* 19.09.2026 (E-191): Auch ohne eigene Firma — die englische Seite führt direkt in den Auftrag. */}
              <a className="fg-privat" href={s === "en" ? globalStartPfad(undefined, "en", "privat") : "/business/privatpersonen"}>
                <span className="fg-privat-rumpf">
                  <span className="fg-auge">{t.privatAuge}</span>
                  <b>{t.privatTitel}</b>
                  <span>{t.privatText}</span>
                </span>
                <span className="fg-privat-knopf">{t.privatKnopf}<Pfeil /></span>
              </a>
              <p className="fg-ausstieg">{t.fuerAusstieg}</p>
            </Auf>
          </div>
        </section>

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
                        {o.adresse.join(", ")} · {t.standorteLand[o.schluessel]}{o.register ? <><br />{o.register}</> : null}
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
            <Fragen items={t.fragen} />
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
