// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/verzugszinsen · /en/tools/late-payment-interest
// Verzugsrechner für Firmen (09.09.2026, E-099).
// Texte: client/src/i18n/wz-verzugszinsen.ts — die Nachforderung bleibt deutsch.
//
// RECHTSGRUNDLAGE (nachschlagbar):
//   · § 286 Abs. 1 BGB — Verzug durch Mahnung.
//   · § 286 Abs. 2 Nr. 1 BGB — Verzug ohne Mahnung bei kalendermäßig
//     bestimmter Leistungszeit.
//   · § 286 Abs. 3 BGB — spätestens 30 Tage nach Fälligkeit und Zugang der
//     Rechnung; gegenüber Verbrauchern nur mit Hinweis in der Rechnung.
//   · § 288 Abs. 1 BGB — fünf Prozentpunkte über dem Basiszinssatz.
//   · § 288 Abs. 2 BGB — NEUN Prozentpunkte bei Entgeltforderungen, an denen
//     kein Verbraucher beteiligt ist.
//   · § 288 Abs. 5 BGB — Pauschale 40 Euro; Satz 3: anzurechnen auf einen
//     Schadensersatz, soweit er in Kosten der Rechtsverfolgung begründet ist.
//   · § 288 Abs. 6 BGB — abweichende Vereinbarungen unwirksam; der Ausschluss
//     der Pauschale gilt im Zweifel als grob unbillig.
//   · § 247 BGB — Basiszinssatz, Neufestsetzung zum 1.1. und 1.7.
//
// BASISZINSSATZ (Deutsche Bundesbank, zwei unabhängige Quellen abgeglichen,
// abgerufen 09.09.2026). Läuft der Verzug über einen Stichtag, wird JEDER
// Abschnitt einzeln gerechnet — ein Mischsatz wäre falsch.
// Zinsformel: Betrag × Satz × Tage / 365 (tagegenau, deutsche Praxis).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_VERZUGSZINSEN_WOERTER } from "@/i18n/wz-verzugszinsen";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };
const eurDe = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Basiszinssatz nach § 247 BGB, gültig AB dem jeweiligen Tag (aufsteigend). */
const BASISZINS: { ab: string; satz: number }[] = [
  { ab: "2024-01-01", satz: 3.62 },
  { ab: "2024-07-01", satz: 3.37 },
  { ab: "2025-01-01", satz: 2.27 },
  { ab: "2025-07-01", satz: 1.27 },
  { ab: "2026-01-01", satz: 1.27 },
  { ab: "2026-07-01", satz: 1.52 },
];
const TAG = 86400000;
const alsTag = (s: string) => { const [j, m, t] = s.split("-").map(Number); return Date.UTC(j, m - 1, t); };
const alsText = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const heute = () => alsText(Date.now());

/** Zerlegt den Verzugszeitraum an den Basiszins-Stichtagen und rechnet je Abschnitt. */
function zinsAbschnitte(betrag: number, vonMs: number, bisMs: number, punkte: number) {
  const stuecke: { von: string; bis: string; tage: number; satz: number; zins: number }[] = [];
  if (!(bisMs > vonMs) || betrag <= 0) return stuecke;
  const grenzen = BASISZINS.map((b) => alsTag(b.ab));
  let start = vonMs;
  while (start < bisMs) {
    const naechste = grenzen.find((g) => g > start);
    const ende = naechste && naechste < bisMs ? naechste : bisMs;
    // Der zuletzt VOR dem Abschnittsbeginn festgesetzte Satz gilt.
    const gueltig = [...BASISZINS].reverse().find((b) => alsTag(b.ab) <= start);
    const basis = gueltig ? gueltig.satz : BASISZINS[0].satz;
    const tage = Math.round((ende - start) / TAG);
    const satz = basis + punkte;
    const zins = (betrag * satz * tage) / 100 / 365;
    // Zwei Stichtage können denselben Satz tragen (1,27 % zum 01.07.2025 und
    // unverändert zum 01.01.2026). Dann gehören sie in EINE Zeile — ein Schnitt
    // ohne Satzwechsel wäre für den Leser nur verwirrend.
    const letzte = stuecke[stuecke.length - 1];
    if (letzte && letzte.satz === satz) {
      letzte.bis = alsText(ende); letzte.tage += tage; letzte.zins += zins;
    } else {
      stuecke.push({ von: alsText(start), bis: alsText(ende), tage, satz, zins });
    }
    start = ende;
  }
  return stuecke;
}

export default function Verzugszinsen() {
  const t = useWoerter(WZ_VERZUGSZINSEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/late-payment-interest" : "/werkzeuge/verzugszinsen";
  const eur = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const datum = (s: string) => new Date(s).toLocaleDateString(en ? "en-GB" : "de-DE");
  const pro = (n: number) => `${n.toLocaleString(en ? "en-GB" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

  const [betrag, setBetrag] = useState("");
  const [faellig, setFaellig] = useState("");
  const [bis, setBis] = useState(heute());
  const [weg, setWeg] = useState<"frist" | "mahnung" | "dreissig" | "">("");
  const [mahnung, setMahnung] = useState("");
  const [firma, setFirma] = useState<"ja" | "nein" | "">("");
  const [kopiert, setKopiert] = useState(false);

  const e = useMemo(() => {
    const B = zahl(betrag);
    if (B <= 0 || !faellig || !bis || !weg || !firma) return null;
    if (weg === "mahnung" && !mahnung) return null;
    // Beginn des Verzugs nach dem gewählten Weg.
    const beginn =
      weg === "frist" ? alsTag(faellig) + TAG
      : weg === "mahnung" ? alsTag(mahnung) + TAG
      : alsTag(faellig) + 30 * TAG;
    const ende = alsTag(bis);
    const punkte = firma === "ja" ? 9 : 5;
    const stuecke = zinsAbschnitte(B, beginn, ende, punkte);
    const tage = stuecke.reduce((s, x) => s + x.tage, 0);
    const zins = stuecke.reduce((s, x) => s + x.zins, 0);
    const pauschale = firma === "ja" ? 40 : 0;
    return { B, beginn, tage, stuecke, zins, pauschale, zusatz: zins + pauschale, gesamt: B + zins + pauschale, punkte };
  }, [betrag, faellig, bis, weg, mahnung, firma]);

  const text = e && e.tage > 0
    ? `die Rechnung über ${eurDe(e.B)} ist seit dem ${new Date(e.beginn).toLocaleDateString("de-DE")} nicht ausgeglichen. Für den Zeitraum bis zum ${new Date(alsTag(bis)).toLocaleDateString("de-DE")} — ${e.tage} Tage — berechnen wir Verzugszinsen in Höhe von ${eurDe(e.zins)}${e.punkte === 9 ? " (neun Prozentpunkte über dem Basiszinssatz, § 288 Abs. 2 BGB)" : " (fünf Prozentpunkte über dem Basiszinssatz, § 288 Abs. 1 BGB)"}.${e.pauschale ? ` Hinzu kommt die Pauschale von 40,00 EUR nach § 288 Abs. 5 BGB.` : ""} Wir bitten um Ausgleich der Gesamtforderung von ${eurDe(e.gesamt)} bis zum Ende der kommenden Woche.`
    : "";
  const kopieren = async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} werkzeug={{ name: t.werkzeugName }} krumen={[{ name: t.krumeWerkzeuge, pfad: zu("/werkzeuge") }, { name: t.krume, pfad }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>

      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt1}</p><h3>{t.frage1}</h3>
              <p className="wz-hinweis">{t.hinweisBrutto}</p>
              <div className="wz-felder drei">
                <label><span>{t.betrag}</span><input value={betrag} onChange={(ev) => setBetrag(ev.target.value)} inputMode="decimal" placeholder={t.bspBetrag} /></label>
                <label><span>{t.faellig}</span><input type="date" value={faellig} onChange={(ev) => setFaellig(ev.target.value)} /></label>
                <label><span>{t.bis}</span><input type="date" value={bis} onChange={(ev) => setBis(ev.target.value)} /></label>
              </div>
              <p className="wz-hinweis">{t.hinweisBis}</p>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <p className="wz-hinweis">{t.hinweis2}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${weg === "frist" ? " an" : ""}`} onClick={() => setWeg("frist")}><b>{t.wegFrist}</b><small>{t.wegFristHinweis}</small></button>
                <button type="button" className={`wz-option${weg === "mahnung" ? " an" : ""}`} onClick={() => setWeg("mahnung")}><b>{t.wegMahnung}</b><small>{t.wegMahnungHinweis}</small></button>
                <button type="button" className={`wz-option${weg === "dreissig" ? " an" : ""}`} onClick={() => setWeg("dreissig")}><b>{t.wegDreissig}</b><small>{t.wegDreissigHinweis}</small></button>
              </div>
              {weg === "mahnung" && (
                <div className="wz-felder" style={{ marginTop: 12 }}>
                  <label><span>{t.mahnungAm}</span><input type="date" value={mahnung} onChange={(ev) => setMahnung(ev.target.value)} /></label>
                </div>
              )}
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
              <p className="wz-hinweis">{t.hinweis3}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${firma === "ja" ? " an" : ""}`} onClick={() => setFirma("ja")}><b>{t.jaFirma}</b><small>{t.jaFirmaHinweis}</small></button>
                <button type="button" className={`wz-option${firma === "nein" ? " an" : ""}`} onClick={() => setFirma("nein")}><b>{t.neinVerbraucher}</b><small>{t.neinVerbraucherHinweis}</small></button>
              </div>
            </div>
          </div>

          {e && (
            <div className={`wz-ergebnis${e.tage <= 0 ? "" : " gut"}`}>
              <span className="wz-stufe" style={{ background: e.tage <= 0 ? "#b45309" : "#047857" }}>{e.tage <= 0 ? t.stufeKein : t.stufeOffen}</span>
              {e.tage <= 0 ? (
                <><h3>{t.titelKein}</h3><p>{t.keinText}</p></>
              ) : (
                <>
                  <h3>{t.titel(e.tage, eur(e.zusatz))}</h3>
                  <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                    <tbody>
                      <tr><td>{t.verzugAb}</td><td>{datum(alsText(e.beginn))}</td></tr>
                      <tr><td>{t.zeileZins}</td><td>{eur(e.zins)}</td></tr>
                      {e.pauschale > 0 && <tr><td>{t.zeilePauschale}</td><td>{eur(e.pauschale)}</td></tr>}
                      <tr><td><b>{t.zeileSumme}</b></td><td><b>{eur(e.zusatz)}</b></td></tr>
                      <tr><td><b>{t.zeileGesamt}</b></td><td><b>{eur(e.gesamt)}</b></td></tr>
                    </tbody>
                  </table></div>

                  {e.stuecke.length > 1 && (
                    <div className="wz-schritt">
                      <small>{t.satzZeile}</small>
                      <p>{t.teilzeitraeume}</p>
                      <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                        <tbody>
                          <tr><td>{t.spalteZeitraum}</td><td>{t.spalteTage}</td><td>{t.spalteSatz}</td><td>{t.spalteZins}</td></tr>
                          {e.stuecke.map((x) => (
                            <tr key={x.von}><td>{datum(x.von)} – {datum(x.bis)}</td><td>{x.tage}</td><td>{pro(x.satz)}</td><td>{eur(x.zins)}</td></tr>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  )}

                  <div className="wz-schritt">
                    <small>{t.formulierung}</small>
                    <p className="wz-hinweis">{t.formulierungHinweis}</p>
                    <p lang="de">{text}</p>
                  </div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? t.kopiert : t.kopieren}</button>
                    <Knopf href={zu("/werkzeuge/bonitaetsindex")} still>{t.weiterLink}</Knopf>
                  </div>
                  {e.pauschale > 0 && <div className="wz-schritt"><small>{t.anrechnung}</small><p>{t.anrechnungText}</p></div>}
                  <div className="wz-schritt"><small>{t.agb}</small><p>{t.agbText}</p></div>
                </>
              )}
              <div className="wz-schritt"><small>{t.grenze}</small><p>{t.grenzeText}</p></div>
              <div className="wz-schritt"><small>{t.standTitel}</small><p>{t.stand}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>

      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/business")} still={{ knopf: t.weiterLink, href: zu("/werkzeuge/bonitaetsindex") }} />
    </Dunkel>
  );
}
