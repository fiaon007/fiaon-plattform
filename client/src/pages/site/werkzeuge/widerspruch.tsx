// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/widerspruch · /en/tools/deletion-request — Löschantrag und
// Widerspruch gegen einen Eintrag (02.09.2026, E-080; zweisprachig 02.09.2026 —
// beide Schreiben bleiben deutsch, Texte: client/src/i18n/wz-widerspruch.ts)
//
// Der Leser wählt, was mit seinem Eintrag nicht stimmt, trägt die Eckdaten
// ein und bekommt zwei fertige Schreiben: eines an die Auskunftei (Löschung
// nach Art. 17 DSGVO, Berichtigung nach Art. 16, Widerspruch nach Art. 21),
// eines an den meldenden Gläubiger (Rücknahme der Meldung). Kopieren oder
// drucken. Nichts wird gespeichert; alles entsteht im Browser.
//
// Rechtsgrundlagen im Text: § 31 Abs. 2 BDSG (Voraussetzungen einer Meldung),
// Art. 15–21 DSGVO, Verhaltensregeln der Wirtschaftsauskunfteien 2024
// (Löschfristen), Art. 77 DSGVO (Beschwerde bei der Aufsichtsbehörde).
// Kein Versprechen: Ein zulässig gemeldeter, richtiger Eintrag bleibt.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_WIDERSPRUCH_WOERTER } from "@/i18n/wz-widerspruch";
import "@/styles/ratgeber.css";

const AUSKUNFTEIEN = [
  { key: "schufa", name: "SCHUFA Holding AG", adresse: ["Kormoranweg 5", "65201 Wiesbaden"], land: "DE" },
  { key: "boniversum", name: "Creditreform Boniversum GmbH", adresse: ["Hellersbergstraße 11", "41460 Neuss"], land: "DE" },
  { key: "crif-de", name: "CRIF GmbH", adresse: ["Leopoldstraße 244", "80807 München"], land: "DE" },
  { key: "ksv", name: "KSV1870 Information GmbH", adresse: ["Wagenseilgasse 7", "1120 Wien"], land: "AT" },
  { key: "crif-at", name: "CRIF GmbH", adresse: ["Rothschildplatz 3", "1020 Wien"], land: "AT" },
] as const;

type Grund = "mahnung" | "bestritten" | "frist" | "falsch" | "";

const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

export default function Widerspruch() {
  const t = useWoerter(WZ_WIDERSPRUCH_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/deletion-request" : "/werkzeuge/widerspruch";
  const [grund, setGrund] = useState<Grund>("");
  void en;
  const [ask, setAsk] = useState<string>(() => { try { return sessionStorage.getItem("fiaon_land") === "AT" ? "ksv" : "schufa"; } catch { return "schufa"; } });
  const [f, setF] = useState({ name: "", geburt: "", strasse: "", plzOrt: "", glaeubiger: "", glAdresse: "", aktenzeichen: "", betrag: "", datum: "", erledigt: "" });
  const [kopiert, setKopiert] = useState<"" | "a" | "g">("");
  const a = AUSKUNFTEIEN.find((x) => x.key === ask) || AUSKUNFTEIEN[0];
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ev.target.value });
  const ort = f.plzOrt ? f.plzOrt.replace(/^\d+\s*/, "") : "[Ort]";

  const begruendung = useMemo(() => {
    const g = f.glaeubiger || "[Gläubiger]";
    const az = f.aktenzeichen ? ` (Kennzeichen ${f.aktenzeichen})` : "";
    const b = f.betrag ? ` über ${f.betrag} Euro` : "";
    switch (grund) {
      case "mahnung": return `Der Eintrag zur Forderung von ${g}${az}${b} wurde ohne die Voraussetzungen des § 31 Abs. 2 Nr. 4 BDSG gemeldet: Ich habe vor der Meldung keine zwei schriftlichen Mahnungen mit einem Abstand von mindestens vier Wochen erhalten und wurde nicht rechtzeitig, mindestens aber in der ersten Mahnung, auf die bevorstehende Meldung an eine Auskunftei hingewiesen. Eine Meldung ohne diese Voraussetzungen ist unzulässig; die Daten sind unverzüglich zu löschen (Art. 17 Abs. 1 Buchst. d DSGVO). Zugleich widerspreche ich der Verarbeitung nach Art. 21 DSGVO.`;
      case "bestritten": return `Die von ${g}${az} gemeldete Forderung${b} habe ich vor der Meldung bestritten${f.datum ? ` (Widerspruch vom ${f.datum})` : ""}. Bestrittene Forderungen dürfen nach § 31 Abs. 2 Nr. 4 Buchst. d BDSG nicht an Auskunfteien übermittelt werden. Die Meldung war damit von Anfang an unzulässig; ich verlange die unverzügliche Löschung nach Art. 17 Abs. 1 Buchst. d DSGVO und widerspreche der weiteren Verarbeitung nach Art. 21 DSGVO.`;
      case "frist": return `Die von ${g}${az} gemeldete Forderung${b} ist erledigt${f.erledigt ? ` (Zahlung am ${f.erledigt})` : ""}. Nach den Verhaltensregeln der Wirtschaftsauskunfteien sind erledigte Forderungen taggenau drei Jahre nach Erledigung zu löschen – bei vollständigem Ausgleich innerhalb von 100 Tagen nach der Meldung bereits nach 18 Monaten. Diese Frist ist abgelaufen. Die weitere Speicherung ist nicht mehr erforderlich; ich verlange die Löschung nach Art. 17 Abs. 1 Buchst. a DSGVO.`;
      case "falsch": return `Der Eintrag zur Forderung von ${g}${az}${b} ist unrichtig. ${f.datum ? `Richtig ist: ${f.datum}. ` : ""}Unrichtige personenbezogene Daten sind nach Art. 16 DSGVO unverzüglich zu berichtigen; soweit die Angaben nicht belegt werden können, sind sie nach Art. 17 DSGVO zu löschen. Ich bitte um Mitteilung, welche Nachweise dem Eintrag zugrunde liegen (Art. 15 Abs. 1 Buchst. g DSGVO).`;
      default: return "";
    }
  }, [grund, f]);

  const briefAuskunftei = useMemo(() => `${f.name || "[Vor- und Nachname]"}
${f.strasse || "[Straße und Hausnummer]"}
${f.plzOrt || "[PLZ Ort]"}
${f.geburt ? `Geburtsdatum: ${f.geburt}` : "Geburtsdatum: [TT.MM.JJJJ]"}

${a.name}
${a.adresse.join("\n")}

${ort}, ${heute()}

${grund === "falsch" ? "Antrag auf Berichtigung (Art. 16 DSGVO), hilfsweise Löschung (Art. 17 DSGVO)" : "Antrag auf Löschung nach Art. 17 DSGVO und Widerspruch nach Art. 21 DSGVO"}

Sehr geehrte Damen und Herren,

in der von Ihnen zu meiner Person gespeicherten Datenkopie ist ein Eintrag enthalten, der nicht rechtmäßig ist.

${begruendung}

Ich fordere Sie auf, den Eintrag innerhalb von vier Wochen nach Zugang dieses Schreibens zu löschen bzw. zu berichtigen und mir dies schriftlich zu bestätigen (Art. 12 Abs. 3, Art. 19 DSGVO). Bitte teilen Sie mir außerdem mit, an welche Vertragspartner der Eintrag in den letzten zwölf Monaten übermittelt wurde, und informieren Sie diese über die Löschung.

Sollte ich innerhalb dieser Frist keine Bestätigung erhalten, werde ich mich an die zuständige Datenschutzaufsichtsbehörde wenden (Art. 77 DSGVO).

Mit freundlichen Grüßen

${f.name || "[Vor- und Nachname]"}

Anlage: Kopie des Ausweises (bis auf Name, Anschrift und Geburtsdatum geschwärzt)`, [f, a, begruendung, grund, ort]);

  const briefGlaeubiger = useMemo(() => `${f.name || "[Vor- und Nachname]"}
${f.strasse || "[Straße und Hausnummer]"}
${f.plzOrt || "[PLZ Ort]"}

${f.glaeubiger || "[Gläubiger / Inkassounternehmen]"}
${f.glAdresse || "[Anschrift des Gläubigers]"}

${ort}, ${heute()}

Rücknahme der Meldung an ${a.name}${f.aktenzeichen ? ` – Ihr Zeichen ${f.aktenzeichen}` : ""}

Sehr geehrte Damen und Herren,

Sie haben zu meiner Person einen Eintrag bei ${a.name} veranlasst.

${begruendung}

Ich fordere Sie auf, die Meldung innerhalb von 14 Tagen nach Zugang dieses Schreibens gegenüber ${a.name} zurückzunehmen bzw. berichtigen zu lassen und mir die Rücknahme schriftlich zu bestätigen. Eine parallele Aufforderung habe ich an die Auskunftei gerichtet.

Bitte legen Sie mir außerdem dar, auf welcher Grundlage die Meldung erfolgt ist – insbesondere Kopien der Mahnungen mit Datum und den Hinweis auf die Meldung.

Mit freundlichen Grüßen

${f.name || "[Vor- und Nachname]"}`, [f, a, begruendung, ort]);

  const kopieren = async (welcher: "a" | "g") => { try { await navigator.clipboard.writeText(welcher === "a" ? briefAuskunftei : briefGlaeubiger); setKopiert(welcher); setTimeout(() => setKopiert(""), 2500); } catch { /* egal */ } };
  const drucken = (text: string) => {
    const w = window.open("", "_blank", "width=820,height=1000"); if (!w) return;
    w.document.write(`<!doctype html><title>Schreiben</title><pre style="font:14px/1.6 -apple-system,Helvetica,Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:700px">${text.replace(/</g, "&lt;")}</pre>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

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
              <p className="wz-hinweis">{t.hinweis1A}<a href={zu("/werkzeuge/eintrag-pruefen")}>{t.hinweis1Link1}</a>{t.hinweis1B}<a href={zu("/werkzeuge/loeschfrist")}>{t.hinweis1Link2}</a>{t.hinweis1C}</p>
              <div className="wz-optionen zwei">
                {t.gruende.map((g) => (
                  <button key={g.key} type="button" className={`wz-option${grund === g.key ? " an" : ""}`} onClick={() => setGrund(g.key)}><b>{g.titel}</b><small>{g.kurz}</small></button>
                ))}
              </div>
            </div>
            {grund && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
                <div className="wz-felder drei">
                  <label><span>{t.auskunftei}</span>
                    <select value={ask} onChange={(ev) => setAsk(ev.target.value)}>{AUSKUNFTEIEN.map((x) => <option key={x.key} value={x.key}>{x.name} ({x.land})</option>)}</select>
                  </label>
                  <label><span>{t.glaeubiger}</span><input value={f.glaeubiger} onChange={set("glaeubiger")} placeholder={t.bspGlaeubiger} /></label>
                  <label><span>{t.glAdresse}</span><input value={f.glAdresse} onChange={set("glAdresse")} placeholder={t.bspGlAdresse} /></label>
                  <label><span>{t.aktenzeichen}</span><input value={f.aktenzeichen} onChange={set("aktenzeichen")} placeholder={t.bspAktenzeichen} /></label>
                  <label><span>{t.betrag}</span><input value={f.betrag} onChange={set("betrag")} inputMode="decimal" placeholder={t.bspBetrag} /></label>
                  {grund === "frist" && <label><span>{t.erledigtAm}</span><input value={f.erledigt} onChange={set("erledigt")} placeholder={t.datumFormat} /></label>}
                  {grund === "bestritten" && <label><span>{t.widerspruchAm}</span><input value={f.datum} onChange={set("datum")} placeholder={t.datumFormat} /></label>}
                  {grund === "falsch" && <label><span>{t.wasRichtig}</span><input value={f.datum} onChange={set("datum")} placeholder={t.bspRichtig} /></label>}
                </div>
              </div>
            )}
            {grund && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
                <div className="wz-felder drei">
                  <label><span>{t.name}</span><input value={f.name} onChange={set("name")} /></label>
                  <label><span>{t.geburt}</span><input value={f.geburt} onChange={set("geburt")} placeholder={t.datumFormat} /></label>
                  <label><span>{t.strasse}</span><input value={f.strasse} onChange={set("strasse")} /></label>
                  <label><span>{t.plzOrt}</span><input value={f.plzOrt} onChange={set("plzOrt")} /></label>
                </div>
                <p className="wz-hinweis">{t.hinweis3}</p>
              </div>
            )}
          </div>
          {grund && (
            <>
              <div className="wz-schritt" style={{ marginTop: 22, borderColor: "rgba(180,83,9,.35)", background: "#fffaf0" }}><small style={{ color: "#b45309" }}>{t.musterTitel}</small><p>{t.muster}</p></div>
              {t.spracheHinweis && <div className="wz-schritt" style={{ marginTop: 14 }}><p>{t.spracheHinweis}</p></div>}
              <div className="wz-schritt" style={{ marginTop: 26 }}><small>{t.brief1}</small><p>{t.brief1Text}</p></div>
              <div className="wz-brief-wrap"><div className="wz-brief" lang="de">{briefAuskunftei}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={() => kopieren("a")}>{kopiert === "a" ? t.kopiert : t.kopieren}</button>
                  <button type="button" className="dk-knopf still" onClick={() => drucken(briefAuskunftei)}>{t.drucken}</button>
                </div>
              </div>
              <div className="wz-schritt" style={{ marginTop: 26 }}><small>{t.brief2}</small><p>{t.brief2Text}</p></div>
              <div className="wz-brief-wrap"><div className="wz-brief" lang="de">{briefGlaeubiger}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={() => kopieren("g")}>{kopiert === "g" ? t.kopiert : t.kopieren}</button>
                  <button type="button" className="dk-knopf still" onClick={() => drucken(briefGlaeubiger)}>{t.drucken}</button>
                  <Knopf href={zu("/werkzeuge/loeschfrist")} still>{t.loeschfristPruefen}</Knopf>
                </div>
              </div>
              <div className="wz-schritt" style={{ marginTop: 26 }}><small>{t.danach}</small><p>{t.danachText}</p></div>
            </>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.wieFiaon, href: zu("/fiaon-erfahrungen") }} />
    </Dunkel>
  );
}
