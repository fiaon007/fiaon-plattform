// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/widerspruch — Löschantrag und Widerspruch gegen einen Eintrag
// (02.09.2026, E-080)
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
import "@/styles/ratgeber.css";

const AUSKUNFTEIEN = [
  { key: "schufa", name: "SCHUFA Holding AG", adresse: ["Kormoranweg 5", "65201 Wiesbaden"], land: "DE" },
  { key: "boniversum", name: "Creditreform Boniversum GmbH", adresse: ["Hellersbergstraße 11", "41460 Neuss"], land: "DE" },
  { key: "crif-de", name: "CRIF GmbH", adresse: ["Leopoldstraße 244", "80807 München"], land: "DE" },
  { key: "ksv", name: "KSV1870 Information GmbH", adresse: ["Wagenseilgasse 7", "1120 Wien"], land: "AT" },
  { key: "crif-at", name: "CRIF GmbH", adresse: ["Rothschildplatz 3", "1020 Wien"], land: "AT" },
] as const;

type Grund = "mahnung" | "bestritten" | "frist" | "falsch" | "";

const GRUENDE: { key: Grund; titel: string; kurz: string }[] = [
  { key: "mahnung", titel: "Ohne zwei Mahnungen gemeldet", kurz: "Ich habe vor der Meldung keine zwei Mahnungen mit mindestens vier Wochen Abstand erhalten – oder keinen Hinweis, dass gemeldet wird." },
  { key: "bestritten", titel: "Ich hatte der Forderung widersprochen", kurz: "Die Forderung war bestritten, bevor sie gemeldet wurde – bestrittene Forderungen dürfen nicht gemeldet werden." },
  { key: "frist", titel: "Die Löschfrist ist abgelaufen", kurz: "Die Forderung ist erledigt, die Speicherfrist ist um – der Eintrag steht trotzdem noch." },
  { key: "falsch", titel: "Der Eintrag ist falsch", kurz: "Falscher Betrag, falsches Datum, falsche Person, doppelt gemeldet oder die Erledigung fehlt." },
];

const FRAGEN = [
  { f: "Kann ich mit diesem Schreiben jeden Eintrag löschen lassen?", a: "Nein. Ein inhaltlich richtiger, zulässig gemeldeter Eintrag bleibt bis zum Ablauf der Speicherfrist – auch nach dem besten Brief. Das Schreiben wirkt dort, wo die Meldung die gesetzlichen Voraussetzungen nicht erfüllt hat (§ 31 Abs. 2 BDSG), wo Daten falsch sind (Art. 16 DSGVO) oder wo die Frist abgelaufen ist (Art. 17 DSGVO)." },
  { f: "Schreibe ich an die Auskunftei oder an den Gläubiger?", a: "An beide. Die Auskunftei ist rechtlich verantwortlich für die Daten, die sie speichert, und muss prüfen. Der Gläubiger hat gemeldet und kann die Meldung zurücknehmen – oft geht das schneller. Deshalb erzeugt das Werkzeug zwei Schreiben." },
  { f: "Wie lange hat die Auskunftei Zeit zu antworten?", a: "Unverzüglich, spätestens innerhalb eines Monats nach Eingang (Art. 12 Abs. 3 DSGVO). Bei komplizierten Fällen darf sie die Frist um zwei Monate verlängern, muss das aber innerhalb des ersten Monats mitteilen. Deshalb steht im Schreiben eine Frist von vier Wochen." },
  { f: "Was tue ich, wenn die Auskunftei ablehnt oder nicht antwortet?", a: "Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde (Art. 77 DSGVO) – für die SCHUFA ist das der Hessische Beauftragte für Datenschutz und Informationsfreiheit. Zusätzlich gibt es den Ombudsmann der SCHUFA. Beides ist kostenlos. FIAON übernimmt diese Eskalation für Kunden." },
  { f: "Soll ich per E-Mail oder per Post schicken?", a: "Per Post als Einschreiben mit Rückschein – oder per Einwurf-Einschreiben. Sie brauchen später den Nachweis, wann das Schreiben zugegangen ist. Eine Kopie des Ausweises verlangen Auskunfteien oft zur Identifikation; schwärzen Sie darauf alles außer Name, Anschrift und Geburtsdatum." },
];

const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

export default function Widerspruch() {
  const [grund, setGrund] = useState<Grund>("");
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
    <Dunkel seite="ratgeber" titel="Widerspruch-Generator · Löschantrag gegen einen Eintrag" beschreibung="Löschantrag und Widerspruch gegen einen SCHUFA-, KSV- oder CRIF-Eintrag in zwei Minuten: Grund wählen, Eckdaten eintragen, zwei fertige Schreiben. Kostenlos, nichts wird gespeichert.">
      <SeoDaten pfad="/werkzeuge/widerspruch" titel="Löschantrag & Widerspruch gegen SCHUFA-Eintrag: Generator" beschreibung="Löschantrag nach Art. 17 DSGVO und Widerspruch nach § 31 BDSG in zwei Minuten: Grund wählen, Eckdaten eintragen, zwei fertige Schreiben. Kostenlos." fragen={FRAGEN} werkzeug={{ name: "Widerspruch-Generator" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Widerspruch-Generator", pfad: "/werkzeuge/widerspruch" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Der Löschantrag, <span className="dk-verlauf">fertig formuliert.</span></h1>
          <p className="dk-lead">Wählen Sie, was mit dem Eintrag nicht stimmt. Das Werkzeug schreibt den Antrag an die Auskunftei und die Aufforderung an den Gläubiger – mit den richtigen Paragrafen, Fristen und der Bitte um Nachweise.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was stimmt mit dem Eintrag nicht?</h3>
              <p className="wz-hinweis">Unsicher? Der <a href="/werkzeuge/eintrag-pruefen">Eintrag-Prüfer</a> stellt fünf Fragen und sagt, welcher Grund passt. Ist der Eintrag richtig und zulässig gemeldet, hilft kein Schreiben – dann zählt die <a href="/werkzeuge/loeschfrist">Löschfrist</a>.</p>
              <div className="wz-optionen zwei">
                {GRUENDE.map((g) => (
                  <button key={g.key} type="button" className={`wz-option${grund === g.key ? " an" : ""}`} onClick={() => setGrund(g.key)}><b>{g.titel}</b><small>{g.kurz}</small></button>
                ))}
              </div>
            </div>
            {grund && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 2</p><h3>Die Eckdaten</h3>
                <div className="wz-felder drei">
                  <label><span>Auskunftei</span>
                    <select value={ask} onChange={(ev) => setAsk(ev.target.value)}>{AUSKUNFTEIEN.map((x) => <option key={x.key} value={x.key}>{x.name} ({x.land})</option>)}</select>
                  </label>
                  <label><span>Gläubiger / Inkasso</span><input value={f.glaeubiger} onChange={set("glaeubiger")} placeholder="z. B. Musterversand GmbH" /></label>
                  <label><span>Anschrift Gläubiger</span><input value={f.glAdresse} onChange={set("glAdresse")} placeholder="Straße, PLZ Ort" /></label>
                  <label><span>Aktenzeichen / Kennung</span><input value={f.aktenzeichen} onChange={set("aktenzeichen")} placeholder="aus dem Schreiben" /></label>
                  <label><span>Betrag (€)</span><input value={f.betrag} onChange={set("betrag")} inputMode="decimal" placeholder="z. B. 348,20" /></label>
                  {grund === "frist" && <label><span>Erledigt am</span><input value={f.erledigt} onChange={set("erledigt")} placeholder="TT.MM.JJJJ" /></label>}
                  {grund === "bestritten" && <label><span>Widerspruch am</span><input value={f.datum} onChange={set("datum")} placeholder="TT.MM.JJJJ" /></label>}
                  {grund === "falsch" && <label><span>Was ist richtig?</span><input value={f.datum} onChange={set("datum")} placeholder="z. B. Betrag 120 €, bezahlt am …" /></label>}
                </div>
              </div>
            )}
            {grund && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 3</p><h3>Ihre Angaben</h3>
                <div className="wz-felder drei">
                  <label><span>Vor- und Nachname</span><input value={f.name} onChange={set("name")} /></label>
                  <label><span>Geburtsdatum</span><input value={f.geburt} onChange={set("geburt")} placeholder="TT.MM.JJJJ" /></label>
                  <label><span>Straße, Hausnummer</span><input value={f.strasse} onChange={set("strasse")} /></label>
                  <label><span>PLZ Ort</span><input value={f.plzOrt} onChange={set("plzOrt")} /></label>
                </div>
                <p className="wz-hinweis">Nichts davon verlässt Ihren Browser. Das Werkzeug speichert und sendet nichts.</p>
              </div>
            )}
          </div>
          {grund && (
            <>
              <div className="wz-schritt" style={{ marginTop: 26 }}><small>Schreiben 1 · an die Auskunftei</small><p>Per Einschreiben. Frist: vier Wochen. Ausweiskopie beilegen, geschwärzt bis auf Name, Anschrift, Geburtsdatum.</p></div>
              <div className="wz-brief-wrap"><div className="wz-brief">{briefAuskunftei}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={() => kopieren("a")}>{kopiert === "a" ? "Kopiert" : "Schreiben kopieren"}</button>
                  <button type="button" className="dk-knopf still" onClick={() => drucken(briefAuskunftei)}>Drucken</button>
                </div>
              </div>
              <div className="wz-schritt" style={{ marginTop: 26 }}><small>Schreiben 2 · an den Gläubiger</small><p>Parallel abschicken. Der Gläubiger kann die Meldung selbst zurücknehmen – das ist oft der schnellere Weg.</p></div>
              <div className="wz-brief-wrap"><div className="wz-brief">{briefGlaeubiger}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={() => kopieren("g")}>{kopiert === "g" ? "Kopiert" : "Schreiben kopieren"}</button>
                  <button type="button" className="dk-knopf still" onClick={() => drucken(briefGlaeubiger)}>Drucken</button>
                  <Knopf href="/werkzeuge/loeschfrist" still>Löschfrist prüfen</Knopf>
                </div>
              </div>
              <div className="wz-schritt" style={{ marginTop: 26 }}><small>Und danach</small><p>Zugang notieren, vier Wochen warten, Antwort prüfen. Keine Antwort oder eine Ablehnung ohne Begründung: Beschwerde bei der Datenschutzaufsicht (Art. 77 DSGVO) – kostenlos. Danach die Datenkopie erneut anfordern und nachsehen, ob der Eintrag wirklich weg ist.</p></div>
            </>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: § 31 Abs. 2 BDSG, Art. 12, 15, 16, 17, 19, 21, 77 DSGVO, Verhaltensregeln der Wirtschaftsauskunfteien (Stand 2024). Das Werkzeug ersetzt keine Rechtsberatung. Ein richtiger, zulässig gemeldeter Eintrag bleibt bis zum Fristablauf – das sagen wir Ihnen lieber jetzt als nach vier Wochen Warten.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Lieber nicht selbst nachhalten?</b> FIAON prüft jeden Eintrag, versendet die Schreiben per Einschreiben, verfolgt die Antwort und eskaliert zur Aufsicht – Sie geben nur frei.</>} knopf="FIAON übernimmt das" href="/antrag" still={{ knopf: "Wie FIAON arbeitet", href: "/fiaon-erfahrungen" }} />
    </Dunkel>
  );
}
