// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL (Neubau 17.09.2026, neu gestaltet 18.09.2026, E-188)
//
// Justin (17.09.): „FIAON positioniert sich für den B2B-Sektor komplett neu …
// Firmengründung in den USA, Steuerberater, Kreditkarten-System, Fundings —
// alles remote und über uns." Justin (18.09.): „In den Paketen sind ALLE
// Gebühren enthalten … Das dunkle Matte wirkt total billig — mehr
// Informationen, mehr Conversion, seriöser, cleaner. Eine Mischung aus super
// seriösem Anwalt, Bank und Unternehmensberatung."
//
// ── AUFBAU ─────────────────────────────────────────────────────────────────
// Hell wie ein Kanzlei- oder Bankauftritt (Stil: styles/global.css, .fg-):
//   Hero mit Mandatsübersicht → Ohne/Mit → Aus einer Hand → Der Weg (I–IV)
//   → Für wen → Pakete (Festpreis, alles inklusive) → Vergleichstabelle
//   → Unterlagen → Klare Verhältnisse (Rollen, Vertragspartner) → Menschen
//   → Gespräch → Fragen → Schlussband.
// Zwei dunkle Flächen, sonst Papier: der Kopf der Mandatsübersicht und das
// Schlussband. Zwei Handlungen auf der ganzen Seite: direkt beauftragen
// (/business/start) oder ein Gespräch vereinbaren (#gespraech).
//
// Preise kommen aus dem Katalog (shared/fiaon-pakete.ts), Leistungen,
// Inklusivliste, Vergleich und Pflichthinweise aus shared/fiaon-global.ts —
// dieselben Sätze stehen im Vertrag, den der Kunde unterschreibt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { Team } from "@/components/site/Team";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { GLOBAL_WOERTER } from "@/i18n/global";
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_INKLUSIVE, GLOBAL_LAUFEND,
  GLOBAL_UNTERLAGEN_TEXTE, GLOBAL_VERGLEICH, globalPreisText, globalPlanungText,
} from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
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

export default function Business() {
  const t = useWoerter(GLOBAL_WOERTER);
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const zu = (p: string) => inSprache(p, sprache);
  const start = (paket: string) => globalStartPfad(paket, s);

  // Der Paketwunsch reist von der Tafel („Erst sprechen") in den Kalender.
  const [wunsch, setWunsch] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paket");
    if (p) setWunsch(p);
    // Wer mit #gespraech oder #pakete ankommt (z. B. von /termin?quelle=global), landet dort —
    // erst nach dem ersten Bild, sonst misst der Browser die Höhe der Seite falsch.
    const anker = window.location.hash;
    if (anker) requestAnimationFrame(() => setTimeout(() => document.querySelector(anker)?.scrollIntoView(), 60));
  }, []);
  const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;
  const zumGespraech = (paket?: string) => {
    if (paket) setWunsch(paket);
    document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() });
  };
  const zuDenPaketen = () => document.getElementById("pakete")?.scrollIntoView({ behavior: glatt() });

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <div className="fg">
        {/* ── Hero: Anspruch links, das Mandat rechts ────────────────────────── */}
        <section className="fg-hero">
          <div className="fg-rahmen fg-hero-raster">
            <Auf>
              <span className="fg-auge">{t.auge}</span>
              <h1 className="fg-h1">{t.h1a}<br /><em>{t.h1b}</em></h1>
              <p className="fg-lead">{t.lead}</p>
              <div className="fg-knoepfe">
                <button type="button" className="fg-knopf" onClick={zuDenPaketen}>{t.knopfPakete}<Pfeil /></button>
                <button type="button" className="fg-knopf hell" onClick={() => zumGespraech()}>{t.knopfGespraech}</button>
              </div>
              <ul className="fg-vertrauen">{t.vertrauen.map((x) => <li key={x}><Haken />{x}</li>)}</ul>
            </Auf>
            <Auf verzoegerung={140}>
              <figure className="fg-mandat" aria-label={t.mandatTitel}>
                <div className="fg-mandat-kopf"><b>{t.mandatTitel}</b><span>{t.mandatMarke}</span></div>
                <dl>
                  {t.mandat.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><Haken />{v}</dd></div>)}
                </dl>
                <figcaption className="fg-mandat-fuss">{t.mandatPartner}: <b>{FIAON_FIRMA.name}</b> · Companies House No. {FIAON_FIRMA.companyNo} · {FIAON_FIRMA.ortZeile.split(",")[0]}</figcaption>
              </figure>
            </Auf>
          </div>
        </section>

        {/* ── Acht Anlaufstellen oder ein Vertrag ────────────────────────────── */}
        <section className="fg-sek">
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
            </Auf>
          </div>
        </section>

        {/* ── Aus einer Hand ─────────────────────────────────────────────────── */}
        <section className="fg-sek stein">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.handAuge}</span><h2 className="fg-h2">{t.handH2}</h2></div>
                <p className="fg-lead">{t.handLead}</p>
              </div>
            </Auf>
            <Auf verzoegerung={80}>
              <div className="fg-vier">
                {t.hand.map((k) => <div key={k.tag}><span className="tag">{k.tag}</span><h3>{k.titel}</h3><p>{k.text}</p></div>)}
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Der Weg ────────────────────────────────────────────────────────── */}
        <section className="fg-sek stein" style={{ paddingTop: 24 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.wegAuge}</span><h2 className="fg-h2">{t.wegH2}</h2></div>
                <p className="fg-lead">{t.wegLead}</p>
              </div>
            </Auf>
            <Auf verzoegerung={80}>
              <ol className="fg-weg">
                {t.weg.map((w, i) => (
                  <li key={w.titel}><span className="nr">{ROEMISCH[i]}</span><h3>{w.titel}</h3><span className="dauer">{w.dauer}</span><p>{w.text}</p></li>
                ))}
              </ol>
              <p className="fg-zitat">{t.wegErfahrung}</p>
            </Auf>
          </div>
        </section>

        {/* ── Für wen ────────────────────────────────────────────────────────── */}
        <section className="fg-sek eng">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.fuerAuge}</span><h2 className="fg-h2">{t.fuerH2}</h2></div>
                <p className="fg-lead">{t.fuerLead}</p>
              </div>
              <div className="fg-fuer">{t.fuer.map((x) => <div key={x.tag}><b>{x.tag}</b><p>{x.text}</p></div>)}</div>
              <p className="fg-ausstieg">{t.fuerAusstieg}</p>
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
            <div className="fg-pakete">
              {GLOBAL_PAKETE.map((p, i) => {
                const w = p[s];
                return (
                  <Auf key={p.key} verzoegerung={i * 70}>
                    <article className={`fg-paket${p.key === FOKUS ? " fokus" : ""}`} style={{ height: "100%" }}>
                      <span className="marke">{w.marke}</span>
                      <h3>{w.name}</h3>
                      <p className="fuer">{w.fuer}</p>
                      <div className="fg-preis">
                        <b>{globalPreisText(p.key, s)}</b>
                        <span>{t.festpreis}</span>
                        <span className="fg-chip"><Haken groesse={13} />{t.inklusive}</span>
                      </div>
                      <div className="fg-masse">
                        <div><span>{t.planung}</span><b>{globalPlanungText(p.key, s)}</b><em>{t.planungZusatz}</em></div>
                        <div><span>{t.begleitung}</span><b>{w.dauerKurz}</b></div>
                      </div>
                      <ul>{w.leistungen.map((x, j) => <li key={x} className={j === 0 && i > 0 ? "erbe" : undefined}><Haken />{x}</li>)}</ul>
                      <div className="tun">
                        <a className="fg-knopf voll" href={start(p.key)} aria-label={t.beauftragen(w.name)}>{t.beauftragenKurz}<Pfeil /></a>
                        <button type="button" className="fg-textknopf" onClick={() => zumGespraech(p.key)}>{t.erstSprechen}</button>
                      </div>
                    </article>
                  </Auf>
                );
              })}
            </div>
            <p className="fg-paket-fuss">{t.kostenHinweis}</p>

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
              <div className="fg-zwei">
                {GLOBAL_GELD_ZURUECK.aktiv && (
                  <div className="fg-karte">
                    <span className="tag">FIAON</span>
                    <h3>{GLOBAL_GELD_ZURUECK[s].titel}</h3>
                    <p>{GLOBAL_GELD_ZURUECK[s].text}</p>
                    <p className="klein">{GLOBAL_GELD_ZURUECK[s].bedingungen}</p>
                  </div>
                )}
                <div className="fg-karte">
                  <h3 style={{ marginTop: 0 }}>{t.wissenTitel}</h3>
                  <ul>{GLOBAL_PFLICHTHINWEIS[s].map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Alle Leistungen im Vergleich ───────────────────────────────────── */}
        <section className="fg-sek">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.vergleichAuge}</span><h2 className="fg-h2">{t.vergleichH2}</h2></div>
                <p className="fg-lead">{t.vergleichLead}</p>
              </div>
            </Auf>
            <p className="fg-wisch">{t.wischen}</p>
            <div className="fg-tabelle" role="region" aria-label={t.vergleichH2} tabIndex={0}>
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
                  <tr className="zahl"><th scope="row">{t.zeileFestpreis}</th>{GLOBAL_PAKETE.map((p) => <td key={p.key} className={p.key === FOKUS ? "fokus" : undefined}>{globalPreisText(p.key, s)}</td>)}</tr>
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
                    {GLOBAL_PAKETE.map((p) => <td key={p.key} className={p.key === FOKUS ? "fokus" : undefined}><a className={`fg-knopf${p.key === FOKUS ? "" : " hell"}`} href={start(p.key)} aria-label={t.beauftragen(p[s].name)}>{t.beauftragenKurz}</a></td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* ── Unterlagen ─────────────────────────────────────────────────────── */}
        <section className="fg-sek stein eng">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.unterlagenAuge}</span><h2 className="fg-h2">{t.unterlagenH2}</h2></div>
                <p className="fg-lead">{t.unterlagenLead}</p>
              </div>
              <ol className="fg-unterlagen">{GLOBAL_UNTERLAGEN_TEXTE[s].map((x) => <li key={x}>{x.charAt(0).toUpperCase() + x.slice(1)}</li>)}</ol>
            </Auf>
          </div>
        </section>

        {/* ── Klare Verhältnisse ─────────────────────────────────────────────── */}
        <section className="fg-sek">
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
              <div className="fg-partei">
                <div>
                  <span className="fg-auge">{t.vertragspartnerTitel}</span>
                  <h3>{FIAON_FIRMA.name}</h3>
                  <p>{t.vertragspartnerText}</p>
                </div>
                <address>
                  {FIAON_FIRMA.name}<br />
                  {FIAON_FIRMA.strasse}<br />
                  {FIAON_FIRMA.ortZeile}, {FIAON_FIRMA.land}<br />
                  <span>{FIAON_FIRMA.register}, No. {FIAON_FIRMA.companyNo}</span><br />
                  <span>Director: {FIAON_FIRMA.director}</span><br />
                  <a href={`mailto:${FIAON_FIRMA.email}`} style={{ color: "var(--navy)" }}>{FIAON_FIRMA.email}</a>
                </address>
              </div>
              <div className="fg-ablauf">
                <h3>{t.ablaufTitel}</h3>
                <ol>{t.ablauf.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
            </Auf>
          </div>
        </section>

        {/* ── Die Menschen ───────────────────────────────────────────────────── */}
        <section className="fg-sek stein">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.teamAuge}</span><h2 className="fg-h2">{t.teamH2}</h2></div>
                <p className="fg-lead">{t.teamLead}</p>
              </div>
            </Auf>
            <Team kompakt />
            <div className="fg-knoepfe"><a className="fg-knopf hell" href={zu("/team")}>{t.teamKnopf}</a></div>
          </div>
        </section>

        {/* ── Gespräch ───────────────────────────────────────────────────────── */}
        <section id="gespraech" className="fg-sek" style={{ scrollMarginTop: 72 }}>
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

        {/* ── Fragen ─────────────────────────────────────────────────────────── */}
        <section className="fg-sek stein">
          <div className="fg-rahmen schmal">
            <Auf>
              <span className="fg-auge">{t.fragenAuge}</span>
              <h2 className="fg-h2">{t.fragenH2}</h2>
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
              <button type="button" className="fg-knopf" onClick={zuDenPaketen}>{t.knopfPakete}</button>
              <button type="button" className="fg-knopf hell" onClick={() => zumGespraech()}>{t.knopfGespraech}</button>
            </div>
          </div>
        </section>
      </div>
    </Dunkel>
  );
}
