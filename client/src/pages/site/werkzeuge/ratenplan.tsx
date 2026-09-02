// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/ratenplan — Ratenplan-Rechner mit Angebotsschreiben
// (02.09.2026, E-080)
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
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const heute = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

const FRAGEN = [
  { f: "Muss ein Gläubiger Ratenzahlung annehmen?", a: "Nein. Eine Forderung ist auf einmal fällig; Ratenzahlung ist ein Entgegenkommen. In der Praxis nehmen Gläubiger und Inkassounternehmen realistische Angebote fast immer an – sie bekommen sonst gar nichts oder müssen teuer vollstrecken. Entscheidend ist, dass die Rate tragfähig ist und pünktlich kommt." },
  { f: "Wie hoch sollte die Rate sein?", a: "So hoch, dass sie auch in einem schlechten Monat sicher kommt – nicht so hoch, wie es sich im besten Monat anfühlt. Faustregel aus der Schuldnerberatung: höchstens die Hälfte des Betrags, der nach allen Fixkosten übrig bleibt. Eine geplatzte Rate kostet mehr Vertrauen als eine kleine Rate über einen längeren Zeitraum." },
  { f: "Was ist mit Zinsen und Inkassokosten?", a: "Fragen Sie im Angebot ausdrücklich nach dem Verzicht auf weitere Verzugszinsen und Kosten ab Beginn der Ratenzahlung. Viele Gläubiger stimmen zu, weil die Sicherheit der Zahlung mehr wert ist. Die bisher aufgelaufenen Inkassokosten sollten Sie vorher mit dem Inkassokosten-Prüfer nachrechnen – überhöhte Posten gehören nicht in den Ratenplan." },
  { f: "Verhindert ein Ratenplan den SCHUFA-Eintrag?", a: "Nicht automatisch, aber oft: Solange eine Ratenvereinbarung besteht und eingehalten wird, gilt die Forderung in der Regel nicht mehr als fällig im Sinne von § 31 Abs. 2 BDSG – eine Meldung wäre angreifbar. Deshalb steht im Schreiben die Bitte um Bestätigung, dass während der Ratenzahlung keine Meldung erfolgt. Lassen Sie sich das schriftlich geben." },
  { f: "Ist eine Ratenvereinbarung ein Schuldanerkenntnis?", a: "Sie kann so gewertet werden – und lässt die Verjährung neu beginnen (§ 212 BGB). Prüfen Sie deshalb VOR dem Angebot, ob die Forderung vielleicht schon verjährt oder überhaupt berechtigt ist. Ein Ratenplan ist der richtige Schritt bei einer berechtigten, nicht verjährten Forderung – nicht bei einer zweifelhaften." },
];

export default function Ratenplan() {
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

zu der von Ihnen geltend gemachten Forderung in Höhe von ${eur(F)} biete ich Ihnen eine Ratenzahlung an. Ich habe meine monatlichen Einnahmen und Ausgaben geprüft; die folgende Rate kann ich verlässlich leisten:

  Monatliche Rate: ${eur(rate)}
  Erste Rate am: ${f.ersteRate || "[Datum, z. B. der 1. des nächsten Monats]"}
  Laufzeit: ${monate} Monate (letzte Rate ${eur(letzte)})

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
    <Dunkel seite="ratgeber" titel="Ratenplan-Rechner · Angebot, das der Gläubiger annimmt" beschreibung="Forderung und monatlicher Spielraum eingeben – der Rechner nennt eine Rate, die hält, die Laufzeit und erzeugt das Angebotsschreiben mit Bitte um Zins- und Meldeverzicht. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/ratenplan" titel="Ratenzahlung vereinbaren: Rechner und Angebotsschreiben" beschreibung="Forderung und Spielraum eingeben – der Rechner nennt eine Rate, die hält, die Laufzeit und schreibt das Angebot an Gläubiger oder Inkasso mit Bitte um Zins- und Meldeverzicht." fragen={FRAGEN} werkzeug={{ name: "Ratenplan-Rechner" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Ratenplan-Rechner", pfad: "/werkzeuge/ratenplan" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Die Rate, die <span className="dk-verlauf">wirklich hält.</span></h1>
          <p className="dk-lead">Gläubiger nehmen Angebote an, die tragfähig sind – nicht die höchsten. Der Rechner findet die Rate, die auch im schlechten Monat kommt, und schreibt das Angebot dazu.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Die Forderung und Ihr Spielraum</h3>
              <p className="wz-hinweis">Spielraum = was nach Miete, Strom, Versicherungen, Lebensmitteln, Fahrtkosten und laufenden Raten übrig bleibt. Unsicher? Der <a href="/werkzeuge/spielraum">Spielraum-Rechner</a> rechnet es aus.</p>
              <div className="wz-felder">
                <label><span>Forderung gesamt (€)</span><input value={forderung} onChange={(ev) => setForderung(ev.target.value)} inputMode="decimal" placeholder="z. B. 1.840" /></label>
                <label><span>Monatlicher Spielraum (€)</span><input value={spielraum} onChange={(ev) => setSpielraum(ev.target.value)} inputMode="decimal" placeholder="z. B. 180" /></label>
              </div>
            </div>
            {e && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 2</p><h3>Welche Rate bieten Sie an?</h3>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${rate === e.sicher ? " an" : ""}`} onClick={() => setRateWahl(e.sicher)}><b>{eur(e.sicher)} im Monat – sicher</b><small>Die Hälfte Ihres Spielraums. {e.mSicher} Monate. Hält auch, wenn ein Monat schlecht läuft.</small></button>
                  <button type="button" className={`wz-option${rate === e.zuegig ? " an" : ""}`} onClick={() => setRateWahl(e.zuegig)}><b>{eur(e.zuegig)} im Monat – zügig</b><small>70 Prozent Ihres Spielraums. {e.mZuegig} Monate. Nur, wenn Ihre Einnahmen stabil sind.</small></button>
                </div>
                {e.warnung && <p className="wz-hinweis" style={{ marginTop: 10 }}>Über drei Jahre Laufzeit: Viele Gläubiger akzeptieren das nur mit Nachweis (Haushaltsrechnung). Prüfen Sie, ob eine Einmalzahlung mit Teilverzicht möglich ist – oder ob eine Schuldnerberatung der bessere Weg ist.</p>}
              </div>
            )}
            {e && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 3</p><h3>Die Angaben für das Schreiben</h3>
                <div className="wz-felder drei">
                  <label><span>Vor- und Nachname</span><input value={f.name} onChange={set("name")} /></label>
                  <label><span>Straße, Hausnummer</span><input value={f.strasse} onChange={set("strasse")} /></label>
                  <label><span>PLZ Ort</span><input value={f.plzOrt} onChange={set("plzOrt")} /></label>
                  <label><span>Gläubiger / Inkasso</span><input value={f.glaeubiger} onChange={set("glaeubiger")} /></label>
                  <label><span>Anschrift Gläubiger</span><input value={f.glAdresse} onChange={set("glAdresse")} /></label>
                  <label><span>Aktenzeichen</span><input value={f.aktenzeichen} onChange={set("aktenzeichen")} /></label>
                  <label><span>Erste Rate am</span><input value={f.ersteRate} onChange={set("ersteRate")} placeholder="TT.MM.JJJJ" /></label>
                </div>
              </div>
            )}
          </div>
          {e && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>Ihr Angebot</span>
              <h3>{eur(rate)} im Monat, {monate} Monate, letzte Rate {eur(letzte)}.</h3>
              <p>Rechnen Sie einmal nach: Was passiert, wenn Ihr Spielraum 20 Prozent kleiner ist als gedacht? Bleiben dann noch {eur(Math.round(S * 0.8))} – und ist die Rate von {eur(rate)} davon noch zahlbar? Wenn nein, wählen Sie die sichere Variante. Eine kleine Rate, die zwölfmal pünktlich kommt, baut Bonität; eine große, die zweimal platzt, zerstört sie.</p>
              <div className="wz-schritt"><small>Vorher prüfen</small><p>Ist die Forderung überhaupt berechtigt und nicht <a href="/werkzeuge/verjaehrung">verjährt</a>? Sind die <a href="/werkzeuge/inkassokosten">Inkassokosten</a> zulässig? Ein Ratenangebot kann als Anerkenntnis gelten – es gehört zu einer berechtigten Forderung, nicht zu einer zweifelhaften.</p></div>
              <div className="wz-schritt" style={{ marginTop: 22, borderColor: "rgba(180,83,9,.35)", background: "#fffaf0" }}><small style={{ color: "#b45309" }}>Muster, keine Rechtsberatung</small><p>Dieses Schreiben ist ein Mustertext zum Selbst-Anpassen. Es bewertet nicht Ihren Einzelfall und ersetzt keine Rechtsberatung – prüfen Sie Sachverhalt, Daten und Fristen selbst oder mit einer Beratungsstelle. Der Unterschied zum FIAON-Programm: Dort sind die Schreiben anwaltlich geprüft, werden per Einschreiben versendet, jede Antwort wird verfolgt und Fristen werden gehalten.</p></div>
              <div className="wz-brief-wrap" style={{ marginTop: 22 }}><div className="wz-brief">{brief}</div>
                <div className="wz-knoepfe">
                  <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? "Kopiert" : "Angebot kopieren"}</button>
                  <button type="button" className="dk-knopf still" onClick={drucken}>Drucken</button>
                  <Knopf href="/ratenzahlung-und-bonitaet" still>Warum Raten Bonität bauen</Knopf>
                </div>
              </div>
              <div className="wz-schritt"><small>Nach der Zusage</small><p>Alle Raten auf denselben Tag legen – direkt nach dem Gehaltseingang. Dauerauftrag statt Handüberweisung. Eine Rate als Puffer auf dem Konto lassen. Jede Bestätigung aufheben: Sie ist der Beleg, wenn die Auskunftei später einen Erledigt-Vermerk braucht.</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Rechenregel: sichere Rate = die Hälfte des Spielraums, zügige Rate = 70 Prozent, jeweils auf 5 Euro abgerundet. Grundlage der Hinweise: § 31 Abs. 2 BDSG, § 212 BGB. Das Werkzeug ersetzt keine Schuldnerberatung – bei mehreren Gläubigern oder wenn die Raten den Spielraum übersteigen, ist die kostenlose, staatlich anerkannte Schuldnerberatung der richtige Weg. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Mehrere Gläubiger, ein Plan?</b> FIAON leitet den Spielraum aus Ihrem Kontoauszug ab, schlägt Raten vor, die passen, versendet die Angebote und verfolgt jede Antwort.</>} knopf="FIAON übernimmt das" href="/antrag" still={{ knopf: "Schulden-Check", href: "/werkzeuge/schulden-check" }} />
    </Dunkel>
  );
}
