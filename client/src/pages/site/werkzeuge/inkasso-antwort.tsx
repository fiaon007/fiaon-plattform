// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/inkasso-antwort — der Antwortbrief an das Inkassounternehmen
// (02.09.2026, E-080)
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
import "@/styles/ratgeber.css";

type Haltung = "unbekannt" | "kosten" | "verjaehrt" | "bezahlt" | "";
const HALTUNGEN: { key: Haltung; titel: string; kurz: string }[] = [
  { key: "unbekannt", titel: "Ich kenne die Forderung nicht", kurz: "Kein Vertrag, kein Kauf, keine Erinnerung – oder der Brief nennt keinen Grund." },
  { key: "kosten", titel: "Die Forderung stimmt, die Kosten nicht", kurz: "Die Hauptforderung ist berechtigt, aber Inkassogebühren, Auskunftskosten oder Zinsen sind überhöht." },
  { key: "verjaehrt", titel: "Die Forderung ist verjährt", kurz: "Die Forderung ist älter als drei Jahre zum Jahresende – ohne Titel, ohne Anerkenntnis." },
  { key: "bezahlt", titel: "Ich habe bereits bezahlt", kurz: "Die Forderung ist beglichen, das Inkasso mahnt trotzdem." },
];

const FRAGEN = [
  { f: "Muss ich auf einen Inkassobrief überhaupt antworten?", a: "Rechtlich nicht – aber Schweigen ist die schlechteste Antwort. Ein bestrittener Anspruch darf nicht an Auskunfteien gemeldet werden (§ 31 Abs. 2 Nr. 4 Buchst. d BDSG); wer nicht widerspricht, bestreitet nicht. Ein kurzes, sachliches Schreiben schützt Sie vor der Meldung und zwingt das Inkasso, seine Unterlagen zu zeigen." },
  { f: "Was muss ein Inkassounternehmen mir mitteilen?", a: "Seit dem 1. Oktober 2021 mit der ersten Geltendmachung (§ 13a RDG): Name und Anschrift des Auftraggebers, den Forderungsgrund – bei Verträgen mit Vertragsgegenstand und Datum des Vertragsschlusses –, bei Zinsen die Berechnung, bei Inkassokosten Art, Höhe und Entstehungsgrund, und ob es sich um eine abgetretene Forderung handelt. Fehlt das, verlangen Sie es – genau das tut der Brief." },
  { f: "Darf ich die Forderung bestreiten, obwohl sie vielleicht stimmt?", a: "Sie dürfen jederzeit Nachweise verlangen und die Forderung bis zur Vorlage bestreiten. Das ist kein Betrug, sondern Ihr Recht: Wer Geld von Ihnen will, muss belegen, wofür. Stellt sich die Forderung als berechtigt heraus, zahlen oder vereinbaren Sie Raten – dann mit korrigierten Kosten." },
  { f: "Was tue ich, wenn nach dem Brief ein Mahnbescheid kommt?", a: "Innerhalb von zwei Wochen Widerspruch beim Mahngericht einlegen – das Formular liegt bei, eine Begründung ist nicht nötig. Der Mahnbescheid-Fristenrechner nennt Ihnen den letzten Tag. Ohne Widerspruch wird die Forderung tituliert, egal ob sie berechtigt ist." },
  { f: "Kann das Inkasso trotzdem einen SCHUFA-Eintrag veranlassen?", a: "Nicht rechtmäßig, solange Sie bestritten haben. Geschieht es doch, ist der Eintrag angreifbar – nutzen Sie den Widerspruch-Generator für den Löschantrag an die Auskunftei. Heben Sie Ihr Schreiben und den Einlieferungsbeleg auf: Sie sind der Beweis, dass die Forderung bestritten war." },
];

const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

export default function InkassoAntwort() {
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
    <Dunkel seite="ratgeber" titel="Inkasso-Antwortbrief · Bestreiten, Nachweise verlangen, Kosten zurückweisen" beschreibung="Inkassobrief erhalten? Wählen Sie Ihre Lage – der Generator schreibt die Antwort: Nachweise nach § 13a RDG verlangen, überhöhte Kosten zurückweisen, Verjährung einwenden oder Zahlung belegen. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/inkasso-antwort" titel="Inkasso-Antwortbrief: Forderung bestreiten, Nachweise verlangen" beschreibung="Inkassobrief erhalten? Lage wählen – der Generator schreibt die Antwort: Nachweise nach § 13a RDG, Kosten zurückweisen, Verjährung einwenden, Zahlung belegen. Kostenlos." fragen={FRAGEN} werkzeug={{ name: "Inkasso-Antwortbrief" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Inkasso-Antwortbrief", pfad: "/werkzeuge/inkasso-antwort" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Die Antwort, die das Inkasso <span className="dk-verlauf">ernst nimmt.</span></h1>
          <p className="dk-lead">Ein Inkassobrief ist eine Behauptung mit Briefkopf. Wählen Sie, was auf Sie zutrifft – der Generator schreibt die Antwort mit den Paragrafen, die das Unternehmen kennt: Nachweise, Kostenkürzung, Verjährung oder Zahlungsbeleg.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was trifft auf Sie zu?</h3>
              <p className="wz-hinweis">Unsicher, ob die Forderung verjährt ist? Der <a href="/werkzeuge/verjaehrung">Verjährungs-Rechner</a> sagt es. Ob die Kosten stimmen, prüft der <a href="/werkzeuge/inkassokosten">Inkassokosten-Prüfer</a>.</p>
              <div className="wz-optionen zwei">
                {HALTUNGEN.map((h) => <button key={h.key} type="button" className={`wz-option${haltung === h.key ? " an" : ""}`} onClick={() => setHaltung(h.key)}><b>{h.titel}</b><small>{h.kurz}</small></button>)}
              </div>
            </div>
            {haltung && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 2</p><h3>Die Angaben aus dem Brief</h3>
                <div className="wz-felder drei">
                  <label><span>Inkassounternehmen</span><input value={f.inkasso} onChange={set("inkasso")} /></label>
                  <label><span>Anschrift Inkasso</span><input value={f.inkAdresse} onChange={set("inkAdresse")} placeholder="Straße, PLZ Ort" /></label>
                  <label><span>Aktenzeichen</span><input value={f.aktenzeichen} onChange={set("aktenzeichen")} /></label>
                  <label><span>Angeblicher Gläubiger</span><input value={f.glaeubiger} onChange={set("glaeubiger")} placeholder="z. B. Musterversand GmbH" /></label>
                  <label><span>Gesamtbetrag (€)</span><input value={f.betrag} onChange={set("betrag")} inputMode="decimal" /></label>
                  {haltung === "kosten" && <label><span>Davon Inkassokosten (€)</span><input value={f.kosten} onChange={set("kosten")} inputMode="decimal" /></label>}
                  {haltung === "verjaehrt" && <label><span>Fällig seit</span><input value={f.faellig} onChange={set("faellig")} placeholder="Monat/Jahr" /></label>}
                  {haltung === "bezahlt" && <label><span>Bezahlt am</span><input value={f.bezahltAm} onChange={set("bezahltAm")} placeholder="TT.MM.JJJJ" /></label>}
                </div>
              </div>
            )}
            {haltung && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 3</p><h3>Ihre Angaben</h3>
                <div className="wz-felder drei">
                  <label><span>Vor- und Nachname</span><input value={f.name} onChange={set("name")} /></label>
                  <label><span>Straße, Hausnummer</span><input value={f.strasse} onChange={set("strasse")} /></label>
                  <label><span>PLZ Ort</span><input value={f.plzOrt} onChange={set("plzOrt")} /></label>
                </div>
              </div>
            )}
          </div>
          {haltung && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#1d4ed8" }}>Ihr Schreiben</span>
              <h3>Schriftlich, per Einschreiben, mit Frist – und ohne ein Wort zu viel.</h3>
              <p>Nicht anrufen: Am Telefon wird nichts bewiesen, aber vieles versehentlich anerkannt. Der Brief enthält alles, was zählt: Ihre Haltung, die Rechtsgrundlage, die Frist – und den Widerspruch gegen jede Meldung an Auskunfteien.</p>
              <div className="wz-brief-wrap" style={{ marginTop: 22 }}><div className="wz-brief">{brief}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? "Kopiert" : "Schreiben kopieren"}</button>
                  <button type="button" className="dk-knopf still" onClick={drucken}>Drucken</button>
                  <Knopf href="/werkzeuge/mahnbescheid" still>Falls ein Mahnbescheid kommt</Knopf>
                </div>
              </div>
              <div className="wz-schritt"><small>Danach</small><p>Einlieferungsbeleg aufheben. Kommt innerhalb von 14 Tagen nichts oder nur eine weitere Mahnung ohne Nachweise: nicht zahlen, nicht anrufen, Ordner anlegen. Kommt ein Mahnbescheid: zwei Wochen Widerspruchsfrist – der <a href="/werkzeuge/mahnbescheid">Fristenrechner</a> nennt den Tag. Kommen die Nachweise und die Forderung stimmt: <a href="/werkzeuge/ratenplan">Ratenplan</a> anbieten.</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: § 13a, § 13e RDG; § 31 Abs. 2 BDSG; §§ 195, 199, 212 BGB; BGH VIII ZR 95/18. Das Werkzeug ersetzt keine Rechtsberatung. Bei gerichtlichen Schreiben (Mahnbescheid, Klage) gelten Fristen – dort zählt jeder Tag. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Mehr als ein Brief im Ordner?</b> FIAON ist Ihre Gegenprüfung: Wir prüfen Forderung, Kosten und Verjährung, schreiben in Ihrem Namen und verfolgen jede Antwort – bis der Eintrag weg ist.</>} knopf="FIAON übernimmt das" href="/antrag" still={{ knopf: "Inkasso-Brief erhalten?", href: "/inkasso-brief-erhalten" }} />
    </Dunkel>
  );
}
