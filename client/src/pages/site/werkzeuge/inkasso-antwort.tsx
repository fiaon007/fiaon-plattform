// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/inkasso-antwort · /en/tools/reply-to-debt-collector — der
// Antwortbrief an das Inkassounternehmen (02.09.2026, E-080; zweisprachig
// 02.09.2026 — der Brief bleibt deutsch, Texte: client/src/i18n/wz-inkasso-antwort.ts)
//
// Vier Haltungen, vier Briefe:
//   1. „Ich kenne die Forderung nicht" → Nachweise verlangen (§ 13a RDG:
//      Auftraggeber, Forderungsgrund, Vertragsdatum, Kostenaufstellung) und
//      die Forderung bis dahin bestreiten.
//   2. „Die Forderung ist berechtigt, die Kosten nicht" → Hauptforderung
//      anerkennen, Inkassokosten nach RVG/§ 13e RDG zurückweisen.
//   3. „Die Forderung ist verjährt" → Einrede der Verjährung.
//   4. „Ich habe schon bezahlt" → Zahlungsnachweis, Rücknahme, Erledigt-Vermerk.
// Jeder Brief verlangt zusätzlich: keine Meldung an Auskunfteien, solange die
// Forderung bestritten ist (§ 31 Abs. 2 Nr. 4 Buchst. d BDSG).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_INKASSO_ANTWORT_WOERTER } from "@/i18n/wz-inkasso-antwort";
import "@/styles/ratgeber.css";

type Haltung = "unbekannt" | "kosten" | "verjaehrt" | "bezahlt" | "";
const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

export default function InkassoAntwort() {
  const t = useWoerter(WZ_INKASSO_ANTWORT_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/reply-to-debt-collector" : "/werkzeuge/inkasso-antwort";
  const [haltung, setHaltung] = useState<Haltung>("");
  const [f, setF] = useState({ name: "", strasse: "", plzOrt: "", inkasso: "", inkAdresse: "", aktenzeichen: "", glaeubiger: "", betrag: "", kosten: "", bezahltAm: "", faellig: "" });
  const [kopiert, setKopiert] = useState(false);
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ev.target.value });
  const ort = f.plzOrt ? f.plzOrt.replace(/^\d+\s*/, "") : "[Ort]";

  const kern = useMemo(() => {
    const g = f.glaeubiger || "[angeblicher Gläubiger]";
    const b = f.betrag ? ` in Höhe von ${f.betrag} Euro` : "";
    switch (haltung) {
      case "unbekannt": return `Die von Ihnen geltend gemachte Forderung${b}, angeblich für ${g}, ist mir nicht bekannt. Ich bestreite die Forderung dem Grunde und der Höhe nach.

Nach § 13a Abs. 1 RDG sind Sie verpflichtet, mir mit der ersten Geltendmachung mitzuteilen: Name und Anschrift des Auftraggebers, den Forderungsgrund – bei Verträgen den Vertragsgegenstand und das Datum des Vertragsschlusses –, bei abgetretenen Forderungen den ursprünglichen Gläubiger, die Berechnung geltend gemachter Zinsen sowie Art, Höhe und Entstehungsgrund der Inkassokosten. Diese Angaben fehlen ganz oder teilweise. Ich fordere Sie auf, mir innerhalb von 14 Tagen die vollständigen Angaben und Nachweise (Vertrag, Bestellung, Rechnung, Mahnungen, Abtretungsurkunde) in Kopie vorzulegen.

Bis zur Vorlage werde ich keine Zahlung leisten. Eine Anerkennung ist mit diesem Schreiben ausdrücklich nicht verbunden.`;
      case "kosten": return `Die Hauptforderung von ${g}${b} stelle ich nicht in Abrede. Die von Ihnen zusätzlich verlangten Inkassokosten${f.kosten ? ` in Höhe von ${f.kosten} Euro` : ""} weise ich zurück.

Inkassokosten sind nur in der Höhe erstattungsfähig, in der sie einem Rechtsanwalt nach dem RVG zustünden (§ 13e RDG); bei einer erstmaligen Mahnung und unbestrittener Forderung ist eine Geschäftsgebühr über 0,5 (Nr. 2300 VV RVG) nicht zu rechtfertigen. Pauschale Kontoführungs-, Adressermittlungs- oder Bearbeitungsgebühren ohne Nachweis sind nicht erstattungsfähig; Mahnkosten des Gläubigers nur in tatsächlicher Höhe (BGH, Urteil vom 26.06.2019, VIII ZR 95/18).

Ich bitte um eine berichtigte Aufstellung innerhalb von 14 Tagen. Die Hauptforderung bin ich bereit auszugleichen${f.kosten ? " – gegebenenfalls in Raten, wozu ich Ihnen gern ein Angebot mache" : ""}.`;
      case "verjaehrt": return `Die von Ihnen geltend gemachte Forderung${b} für ${g}${f.faellig ? `, fällig ${f.faellig},` : ""} ist verjährt. Die regelmäßige Verjährungsfrist beträgt drei Jahre und beginnt mit dem Schluss des Jahres, in dem die Forderung entstanden ist (§§ 195, 199 BGB). Diese Frist ist abgelaufen; ein Titel liegt nicht vor, ein Anerkenntnis habe ich nicht abgegeben.

Ich erhebe hiermit ausdrücklich die Einrede der Verjährung und werde keine Zahlung leisten. Bitte bestätigen Sie mir die Einstellung der Beitreibung innerhalb von 14 Tagen.`;
      case "bezahlt": return `Die von Ihnen geltend gemachte Forderung${b} für ${g} ist bereits beglichen${f.bezahltAm ? ` (Zahlung am ${f.bezahltAm})` : ""}. Einen Zahlungsnachweis füge ich in Kopie bei.

Ich fordere Sie auf, die Beitreibung einzustellen, mir dies innerhalb von 14 Tagen zu bestätigen und – sofern eine Meldung an eine Auskunftei erfolgt ist – die Meldung unverzüglich zurückzunehmen bzw. mit dem Erledigt-Vermerk zum Zahlungsdatum versehen zu lassen. Weitere Kosten für Ihre Tätigkeit sind nicht erstattungsfähig, da die Forderung bei Beauftragung bereits erfüllt war.`;
      default: return "";
    }
  }, [haltung, f]);

  const brief = useMemo(() => `${f.name || "[Vor- und Nachname]"}
${f.strasse || "[Straße und Hausnummer]"}
${f.plzOrt || "[PLZ Ort]"}

${f.inkasso || "[Inkassounternehmen]"}
${f.inkAdresse || "[Anschrift]"}

${ort}, ${heute()}

Ihr Schreiben – Aktenzeichen ${f.aktenzeichen || "[Aktenzeichen]"}

Sehr geehrte Damen und Herren,

${kern}

Unabhängig davon widerspreche ich jeder Übermittlung meiner Daten an Auskunfteien: Eine bestrittene Forderung darf nach § 31 Abs. 2 Nr. 4 Buchst. d BDSG nicht gemeldet werden. Sollte eine Meldung bereits erfolgt sein, fordere ich deren unverzügliche Rücknahme.

Bitte kommunizieren Sie mit mir ausschließlich schriftlich. Telefonische Kontaktaufnahmen und Hausbesuche lehne ich ab.

Mit freundlichen Grüßen

${f.name || "[Vor- und Nachname]"}${haltung === "bezahlt" ? "\n\nAnlage: Zahlungsnachweis" : ""}`, [f, kern, haltung, ort]);

  const kopieren = async () => { try { await navigator.clipboard.writeText(brief); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };
  const drucken = () => { const w = window.open("", "_blank", "width=820,height=1000"); if (!w) return; w.document.write(`<!doctype html><title>Antwort an das Inkasso</title><pre style="font:14px/1.6 -apple-system,Helvetica,Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:700px">${brief.replace(/</g, "&lt;")}</pre>`); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); };

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
              <p className="wz-hinweis">{t.hinweis1A}<a href={zu("/werkzeuge/verjaehrung")}>{t.hinweis1Link1}</a>{t.hinweis1B}<a href={zu("/werkzeuge/inkassokosten")}>{t.hinweis1Link2}</a>{t.hinweis1C}</p>
              <div className="wz-optionen zwei">
                {t.haltungen.map((h) => <button key={h.key} type="button" className={`wz-option${haltung === h.key ? " an" : ""}`} onClick={() => setHaltung(h.key)}><b>{h.titel}</b><small>{h.kurz}</small></button>)}
              </div>
            </div>
            {haltung && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
                <div className="wz-felder drei">
                  <label><span>{t.inkasso}</span><input value={f.inkasso} onChange={set("inkasso")} /></label>
                  <label><span>{t.inkAdresse}</span><input value={f.inkAdresse} onChange={set("inkAdresse")} placeholder={t.bspAdresse} /></label>
                  <label><span>{t.aktenzeichen}</span><input value={f.aktenzeichen} onChange={set("aktenzeichen")} /></label>
                  <label><span>{t.glaeubiger}</span><input value={f.glaeubiger} onChange={set("glaeubiger")} placeholder={t.bspGlaeubiger} /></label>
                  <label><span>{t.betrag}</span><input value={f.betrag} onChange={set("betrag")} inputMode="decimal" /></label>
                  {haltung === "kosten" && <label><span>{t.kosten}</span><input value={f.kosten} onChange={set("kosten")} inputMode="decimal" /></label>}
                  {haltung === "verjaehrt" && <label><span>{t.faellig}</span><input value={f.faellig} onChange={set("faellig")} placeholder={t.bspFaellig} /></label>}
                  {haltung === "bezahlt" && <label><span>{t.bezahltAm}</span><input value={f.bezahltAm} onChange={set("bezahltAm")} placeholder={t.datumFormat} /></label>}
                </div>
              </div>
            )}
            {haltung && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
                <div className="wz-felder drei">
                  <label><span>{t.name}</span><input value={f.name} onChange={set("name")} /></label>
                  <label><span>{t.strasse}</span><input value={f.strasse} onChange={set("strasse")} /></label>
                  <label><span>{t.plzOrt}</span><input value={f.plzOrt} onChange={set("plzOrt")} /></label>
                </div>
              </div>
            )}
          </div>
          {haltung && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#1d4ed8" }}>{t.ihrSchreiben}</span>
              <h3>{t.ergebnisTitel}</h3>
              <p>{t.ergebnisText}</p>
              <div className="wz-schritt" style={{ marginTop: 22, borderColor: "rgba(180,83,9,.35)", background: "#fffaf0" }}><small style={{ color: "#b45309" }}>{t.musterTitel}</small><p>{t.muster}</p></div>
              {t.spracheHinweis && <div className="wz-schritt" style={{ marginTop: 14 }}><p>{t.spracheHinweis}</p></div>}
              <div className="wz-brief-wrap" style={{ marginTop: 22 }}><div className="wz-brief" lang="de">{brief}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? t.kopiert : t.kopieren}</button>
                  <button type="button" className="dk-knopf still" onClick={drucken}>{t.drucken}</button>
                  <Knopf href={zu("/werkzeuge/mahnbescheid")} still>{t.fallsMahnbescheid}</Knopf>
                </div>
              </div>
              <div className="wz-schritt"><small>{t.danach}</small><p>{t.danachA}<a href={zu("/werkzeuge/mahnbescheid")}>{t.danachLink1}</a>{t.danachB}<a href={zu("/werkzeuge/ratenplan")}>{t.danachLink2}</a>{t.danachC}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.inkassoBrief, href: zu("/inkasso-brief-erhalten") }} />
    </Dunkel>
  );
}
