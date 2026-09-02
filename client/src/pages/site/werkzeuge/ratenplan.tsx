// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/ratenplan · /en/tools/instalment-plan — Ratenplan-Rechner mit
// Angebotsschreiben (02.09.2026, E-080; zweisprachig 02.09.2026 — das Schreiben
// bleibt deutsch, Texte: client/src/i18n/wz-ratenplan.ts)
//
// Ein Gläubiger nimmt Raten an, wenn das Angebot tragfähig ist – nicht,
// wenn es hoch ist. Das Werkzeug rechnet aus Forderung und monatlichem
// Spielraum eine Rate, die hält (und zeigt, was passiert, wenn man sie um
// 20 Prozent überschätzt), und erzeugt das Angebotsschreiben: Rate, erster
// Termin, Bitte um Verzicht auf weitere Zinsen und Kosten sowie um Verzicht
// auf eine Meldung an Auskunfteien während der pünktlichen Zahlung.
//
// Bewusst keine Rechtsberatung: Ob der Gläubiger annehmen muss – nein. Ob
// er annimmt – meistens, wenn die Rate realistisch ist und pünktlich kommt.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_RATENPLAN_WOERTER } from "@/i18n/wz-ratenplan";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

const eurDe = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };
const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

export default function Ratenplan() {
  const t = useWoerter(WZ_RATENPLAN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/instalment-plan" : "/werkzeuge/ratenplan";
  const eur = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const [forderung, setForderung] = useState("");
  const [spielraum, setSpielraum] = useState("");
  const [f, setF] = useState({ name: "", strasse: "", plzOrt: "", glaeubiger: "", glAdresse: "", aktenzeichen: "", ersteRate: "" });
  const [rateWahl, setRateWahl] = useState<number | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ev.target.value });

  const F = zahl(forderung), S = zahl(spielraum);
  const e = useMemo(() => {
    if (F <= 0 || S <= 0) return null;
    const sicher = Math.max(10, Math.floor((S * 0.5) / 5) * 5);
    const zuegig = Math.max(10, Math.floor((S * 0.7) / 5) * 5);
    const monate = (r: number) => Math.ceil(F / r);
    return { sicher, zuegig, mSicher: monate(sicher), mZuegig: monate(zuegig), warnung: monate(sicher) > 36 };
  }, [F, S]);
  const rate = rateWahl ?? e?.sicher ?? 0;
  const monate = rate > 0 ? Math.ceil(F / rate) : 0;
  const letzte = rate > 0 ? F - rate * (monate - 1) : 0;
  const ort = f.plzOrt ? f.plzOrt.replace(/^\d+\s*/, "") : "[Ort]";

  const brief = useMemo(() => `${f.name || "[Vor- und Nachname]"}
${f.strasse || "[Straße und Hausnummer]"}
${f.plzOrt || "[PLZ Ort]"}

${f.glaeubiger || "[Gläubiger / Inkassounternehmen]"}
${f.glAdresse || "[Anschrift]"}

${ort}, ${heute()}

Angebot einer Ratenzahlung${f.aktenzeichen ? ` – Ihr Zeichen ${f.aktenzeichen}` : ""}

Sehr geehrte Damen und Herren,

zu der von Ihnen geltend gemachten Forderung in Höhe von ${eurDe(F)} biete ich Ihnen eine Ratenzahlung an. Ich habe meine monatlichen Einnahmen und Ausgaben geprüft; die folgende Rate kann ich verlässlich leisten:

  Monatliche Rate: ${eurDe(rate)}
  Erste Rate am: ${f.ersteRate || "[Datum, z. B. der 1. des nächsten Monats]"}
  Laufzeit: ${monate} Monate (letzte Rate ${eurDe(letzte)})

Ich bitte Sie, dieses Angebot anzunehmen und mir zu bestätigen,
  1. dass ab Beginn der Ratenzahlung keine weiteren Verzugszinsen und Kosten berechnet werden,
  2. dass während der vereinbarungsgemäßen Zahlung keine Meldung an Auskunfteien (SCHUFA, Boniversum, CRIF) erfolgt bzw. eine bestehende Meldung mit dem Erledigt-Vermerk versehen wird,
  3. dass die Beitreibung während der Ratenzahlung ruht.

Bitte nennen Sie mir die Bankverbindung und den Verwendungszweck für die Überweisungen. Die erste Rate überweise ich nach Ihrer Bestätigung, spätestens zum genannten Termin.

Dieses Angebot erfolgt ohne Anerkennung einer Rechtspflicht über den genannten Betrag hinaus; die Höhe der Nebenforderungen behalte ich mir zur Prüfung vor.

Mit freundlichen Grüßen

${f.name || "[Vor- und Nachname]"}`, [f, F, rate, monate, letzte, ort]);

  const kopieren = async () => { try { await navigator.clipboard.writeText(brief); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };
  const drucken = () => { const w = window.open("", "_blank", "width=820,height=1000"); if (!w) return; w.document.write(`<!doctype html><title>Ratenangebot</title><pre style="font:14px/1.6 -apple-system,Helvetica,Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:700px">${brief.replace(/</g, "&lt;")}</pre>`); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); };

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
              <p className="wz-hinweis">{t.hinweis1A}<a href={zu("/werkzeuge/spielraum")}>{t.hinweis1Link}</a>{t.hinweis1B}</p>
              <div className="wz-felder">
                <label><span>{t.forderung}</span><input value={forderung} onChange={(ev) => setForderung(ev.target.value)} inputMode="decimal" placeholder={t.bspForderung} /></label>
                <label><span>{t.spielraum}</span><input value={spielraum} onChange={(ev) => setSpielraum(ev.target.value)} inputMode="decimal" placeholder={t.bspSpielraum} /></label>
              </div>
            </div>
            {e && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${rate === e.sicher ? " an" : ""}`} onClick={() => setRateWahl(e.sicher)}><b>{t.sicher(eur(e.sicher))}</b><small>{t.sicherHinweis(e.mSicher)}</small></button>
                  <button type="button" className={`wz-option${rate === e.zuegig ? " an" : ""}`} onClick={() => setRateWahl(e.zuegig)}><b>{t.zuegig(eur(e.zuegig))}</b><small>{t.zuegigHinweis(e.mZuegig)}</small></button>
                </div>
                {e.warnung && <p className="wz-hinweis" style={{ marginTop: 10 }}>{t.warnung}</p>}
              </div>
            )}
            {e && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
                <div className="wz-felder drei">
                  <label><span>{t.name}</span><input value={f.name} onChange={set("name")} /></label>
                  <label><span>{t.strasse}</span><input value={f.strasse} onChange={set("strasse")} /></label>
                  <label><span>{t.plzOrt}</span><input value={f.plzOrt} onChange={set("plzOrt")} /></label>
                  <label><span>{t.glaeubiger}</span><input value={f.glaeubiger} onChange={set("glaeubiger")} /></label>
                  <label><span>{t.glAdresse}</span><input value={f.glAdresse} onChange={set("glAdresse")} /></label>
                  <label><span>{t.aktenzeichen}</span><input value={f.aktenzeichen} onChange={set("aktenzeichen")} /></label>
                  <label><span>{t.ersteRate}</span><input value={f.ersteRate} onChange={set("ersteRate")} placeholder={t.datumFormat} /></label>
                </div>
              </div>
            )}
          </div>
          {e && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>{t.ihrAngebot}</span>
              <h3>{t.ergebnisTitel(eur(rate), monate, eur(letzte))}</h3>
              <p>{t.ergebnisText(eur(Math.round(S * 0.8)), eur(rate))}</p>
              <div className="wz-schritt"><small>{t.vorher}</small><p>{t.vorherA}<a href={zu("/werkzeuge/verjaehrung")}>{t.vorherLink1}</a>{t.vorherB}<a href={zu("/werkzeuge/inkassokosten")}>{t.vorherLink2}</a>{t.vorherC}</p></div>
              <div className="wz-schritt" style={{ marginTop: 22, borderColor: "rgba(180,83,9,.35)", background: "#fffaf0" }}><small style={{ color: "#b45309" }}>{t.musterTitel}</small><p>{t.muster}</p></div>
              {t.spracheHinweis && <div className="wz-schritt" style={{ marginTop: 14 }}><p>{t.spracheHinweis}</p></div>}
              <div className="wz-brief-wrap" style={{ marginTop: 22 }}><div className="wz-brief" lang="de">{brief}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? t.kopiert : t.kopieren}</button>
                  <button type="button" className="dk-knopf still" onClick={drucken}>{t.drucken}</button>
                  <Knopf href={zu("/ratenzahlung-und-bonitaet")} still>{t.warumRaten}</Knopf>
                </div>
              </div>
              <div className="wz-schritt"><small>{t.nachZusage}</small><p>{t.nachZusageText}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.schuldenCheck, href: zu("/werkzeuge/schulden-check") }} />
    </Dunkel>
  );
}
