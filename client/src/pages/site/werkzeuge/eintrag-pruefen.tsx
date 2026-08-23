// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/eintrag-pruefen — „Ist mein Eintrag angreifbar?" (23.08.2026)
//
// Fünf Fragen, eine ehrliche Einschätzung: hoch / mittel / gering / keine
// Aussicht — mit Begründung nach § 31 BDSG, den Löschfristen und dem BGH-
// Urteil zur Restschuldbefreiung. Kein Login, keine Speicherung. Das Werkzeug
// ist der Einstieg in den Ratgeber und in den Antrag (Lead-Magnet aus dem
// Strategie-Papier). Österreich/Schweiz: dieselbe Logik, andere Namen.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

type Land = "DE" | "AT" | "CH";
const AUSKUNFTEI: Record<Land, string> = { DE: "SCHUFA", AT: "KSV1870 / CRIF", CH: "CRIF / Intrum" };

interface Frage { key: string; frage: string; hinweis?: string; optionen: { wert: string; label: string; text?: string }[]; wenn?: (a: Record<string, string>) => boolean }
const FRAGEN: Frage[] = [
  { key: "art", frage: "Um welche Art von Eintrag geht es?", optionen: [
    { wert: "offen", label: "Eine offene Forderung", text: "Sie haben (noch) nicht bezahlt." },
    { wert: "bezahlt", label: "Eine bezahlte Forderung", text: "Der Eintrag steht trotz Zahlung." },
    { wert: "insolvenz", label: "Insolvenz / Restschuldbefreiung", text: "Das Verfahren ist abgeschlossen." },
    { wert: "falsch", label: "Der Eintrag ist falsch", text: "Nicht meine Forderung, falscher Betrag, falsche Person." },
  ] },
  { key: "mahnung", frage: "Wurden Sie vor der Meldung schriftlich gemahnt?", hinweis: "Gemeint sind Mahnungen des Gläubigers oder Inkassos – mit Hinweis, dass ein Eintrag droht.", wenn: (a) => a.art === "offen" || a.art === "bezahlt",
    optionen: [
      { wert: "zwei", label: "Ja, mindestens zweimal", text: "mit mehreren Wochen Abstand und Hinweis auf die Meldung" },
      { wert: "eine", label: "Nur einmal" },
      { wert: "keine", label: "Nein, keine Mahnung" },
      { wert: "unklar", label: "Weiß ich nicht mehr" },
    ] },
  { key: "bestritten", frage: "Haben Sie die Forderung damals schriftlich bestritten?", wenn: (a) => a.art === "offen" || a.art === "bezahlt",
    optionen: [{ wert: "ja", label: "Ja, schriftlich" }, { wert: "nein", label: "Nein" }] },
  { key: "tituliert", frage: "Gibt es einen Vollstreckungsbescheid oder ein Urteil dazu?", wenn: (a) => a.art === "offen" || a.art === "bezahlt",
    optionen: [{ wert: "ja", label: "Ja" }, { wert: "nein", label: "Nein" }, { wert: "unklar", label: "Weiß ich nicht" }] },
  { key: "wann", frage: "Wann haben Sie bezahlt?", wenn: (a) => a.art === "bezahlt",
    optionen: [
      { wert: "schnell", label: "Innerhalb von 100 Tagen nach der Meldung", text: "und es gibt keine weiteren Einträge" },
      { wert: "ueber3", label: "Vor mehr als drei Jahren" },
      { wert: "ueber18", label: "Vor 18 Monaten bis drei Jahren" },
      { wert: "kuerzer", label: "Vor weniger als 18 Monaten" },
    ] },
  { key: "seit", frage: "Wie lange ist die Restschuldbefreiung her?", wenn: (a) => a.art === "insolvenz",
    optionen: [{ wert: "ueber6", label: "Mehr als sechs Monate" }, { wert: "unter6", label: "Weniger als sechs Monate" }] },
];

function einschaetzung(a: Record<string, string>, land: Land): { stufe: "hoch" | "mittel" | "gering" | "keine"; titel: string; text: string; schritt: string; artikel: string } {
  const ask = AUSKUNFTEI[land];
  if (a.art === "falsch") return { stufe: "hoch", titel: "Ein falscher Eintrag muss berichtigt oder gelöscht werden.", text: "Falsche Person, falscher Betrag oder eine Forderung, die es nie gab: Hier greift das Recht auf Berichtigung (Art. 16 DSGVO) – und bei einer Forderung, die nie bestand, auf Löschung (Art. 17). Entscheidend sind Belege: Ausweis, Kontoauszug, Schriftwechsel.", schritt: `Datenkopie anfordern, den Eintrag mit Belegen bestreiten – an ${ask} und an das meldende Unternehmen. Frist: ein Monat.`, artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
  if (a.art === "insolvenz") return a.seit === "ueber6"
    ? { stufe: "hoch", titel: "Nach sechs Monaten muss der Eintrag weg.", text: "Der Bundesgerichtshof hat 2023 entschieden: Die Restschuldbefreiung darf nur so lange gespeichert werden wie im Insolvenzportal – sechs Monate. Ein älterer Eintrag ist angreifbar.", schritt: `Löschantrag nach Art. 17 DSGVO an ${ask} mit Bezug auf das BGH-Urteil und dem Datum der Restschuldbefreiung.`, artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" }
    : { stufe: "gering", titel: "Noch innerhalb der sechs Monate.", text: "Bis sechs Monate nach der Restschuldbefreiung darf die Information gespeichert werden. Danach ist sie angreifbar – notieren Sie sich das Datum.", schritt: "Sechs Monate abwarten, dann Löschantrag. Bis dahin: Girokonto sichern, Zahlungen pünktlich.", artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
  // offen / bezahlt
  if (a.tituliert === "ja") {
    if (a.art === "bezahlt" && a.wann === "ueber3") return { stufe: "hoch", titel: "Bezahlt und älter als drei Jahre – der Eintrag steht zu lange.", text: "Auch titulierte, erledigte Forderungen werden drei Jahre nach der Erledigung gelöscht. Steht der Eintrag länger, ist er angreifbar.", schritt: `Löschantrag an ${ask} mit dem Zahlungsnachweis und dem Erledigungsdatum.`, artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
    return { stufe: a.art === "bezahlt" ? "gering" : "keine", titel: "Eine titulierte Forderung ist schwer angreifbar.", text: "Mit Vollstreckungsbescheid oder Urteil gelten die Mahnvoraussetzungen nicht. Der Eintrag ist berechtigt, solange die Forderung offen ist; nach Erledigung läuft die Löschfrist von drei Jahren.", schritt: a.art === "offen" ? "Erledigung: Ratenvereinbarung oder Vergleich mit dem Gläubiger, Erledigungsvermerk sichern." : "Erledigungsvermerk prüfen, Löschdatum notieren (drei Jahre nach Zahlung).", artikel: "/ratgeber/kreditkarte-trotz-schufa-eintrag" };
  }
  if (a.bestritten === "ja") return { stufe: "hoch", titel: "Eine bestrittene Forderung darf nicht gemeldet werden.", text: "§ 31 Abs. 2 BDSG verlangt, dass die Forderung nicht bestritten wurde. Haben Sie sie schriftlich bestritten, fehlt eine Voraussetzung für die Meldung – unabhängig davon, ob sie berechtigt war.", schritt: `Widerspruch an ${ask} und an den Gläubiger mit Kopie Ihres damaligen Schreibens; Löschung verlangen.`, artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
  if (a.mahnung === "keine" || a.mahnung === "eine") return { stufe: "hoch", titel: "Ohne zwei Mahnungen war die Meldung unzulässig.", text: "Für die Meldung einer offenen Forderung verlangt § 31 Abs. 2 BDSG mindestens zwei schriftliche Mahnungen mit vier Wochen Abstand und einen Hinweis auf die Meldung. Die Beweislast dafür liegt beim meldenden Unternehmen.", schritt: `Widerspruch an ${ask} und den Gläubiger: Nachweis der Mahnungen verlangen, sonst Löschung. Frist ein Monat, danach Datenschutzbehörde.`, artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
  if (a.art === "bezahlt") {
    if (a.wann === "ueber3") return { stufe: "hoch", titel: "Bezahlt und älter als drei Jahre – der Eintrag steht zu lange.", text: "Erledigte Forderungen werden drei Jahre nach der Erledigung taggenau gelöscht. Steht der Eintrag länger, verstößt das gegen die Verhaltensregeln der Auskunfteien.", schritt: `Löschantrag an ${ask} mit Zahlungsnachweis und Erledigungsdatum.`, artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
    if (a.wann === "schnell") return { stufe: "mittel", titel: "Schnell bezahlt: Die kurze Frist von 18 Monaten gilt.", text: "Seit 2024 wird eine Forderung, die innerhalb von 100 Tagen nach der Meldung beglichen wurde, schon nach 18 Monaten gelöscht – wenn keine weiteren Einträge vorliegen. Prüfen Sie, ob die Frist schon abgelaufen ist.", schritt: "Erledigungsdatum prüfen. Ist es länger als 18 Monate her: Löschantrag mit Hinweis auf die verkürzte Frist.", artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
    if (a.mahnung === "unklar") return { stufe: "mittel", titel: "Die Mahnungen sind der Hebel – lassen Sie sie nachweisen.", text: "Ob der Eintrag angreifbar ist, hängt davon ab, ob vor der Meldung ordnungsgemäß gemahnt wurde. Das muss das meldende Unternehmen belegen können.", schritt: "Beim Gläubiger die Mahnungen anfordern; fehlen sie, Löschung verlangen. Parallel: Erledigungsvermerk prüfen.", artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" };
    return { stufe: "gering", titel: "Berechtigt gemeldet, bezahlt – jetzt läuft die Frist.", text: "Der Eintrag bleibt bis drei Jahre nach der Erledigung stehen. Was sich ändern lässt: nichts an diesem Eintrag, aber viel an allem anderen – Konto, Zahlungsverhalten, keine neuen Anfragen.", schritt: "Löschdatum notieren. Girokonto sichern, Zahlungen pünktlich, keine Kreditanfragen streuen.", artikel: "/ratgeber/kreditkarte-trotz-schufa-eintrag" };
  }
  // offen, gemahnt, nicht bestritten, nicht tituliert
  return a.mahnung === "unklar"
    ? { stufe: "mittel", titel: "Unklar – lassen Sie die Mahnungen nachweisen.", text: "Die Meldung ist nur zulässig, wenn zweimal gemahnt wurde. Fordern Sie die Nachweise an; fehlen sie, ist der Eintrag angreifbar. Parallel: Forderung prüfen und erledigen.", schritt: "Mahnungen beim Gläubiger anfordern, Forderung prüfen (Verjährung? Höhe?), Ratenangebot vorbereiten.", artikel: "/ratgeber/schufa-eintrag-loeschen-lassen" }
    : { stufe: "keine", titel: "Berechtigt und offen – hier hilft Erledigung, keine Löschung.", text: "Gemahnt, nicht bestritten, offen: Der Eintrag erfüllt die Voraussetzungen. Er verschwindet, wenn die Forderung erledigt ist und die Frist abläuft – seit 2024 schon nach 18 Monaten, wenn Sie innerhalb von 100 Tagen nach der Meldung zahlen.", schritt: "Ratenvereinbarung oder Vergleich mit dem Gläubiger, schriftlich, Erledigungsvermerk sichern.", artikel: "/ratgeber/kreditkarte-trotz-schufa-eintrag" };
}

const STUFE = { hoch: { label: "Gute Aussicht", farbe: "#059669" }, mittel: { label: "Mittlere Aussicht", farbe: "#2563eb" }, gering: { label: "Geringe Aussicht", farbe: "#d97706" }, keine: { label: "Keine Löschung – aber ein Weg", farbe: "#64748b" } };

export default function EintragPruefen() {
  const [land, setLand] = useState<Land>(() => (sessionStorage.getItem("fiaon_land") as Land) || "DE");
  const [a, setA] = useState<Record<string, string>>({});
  const fragen = useMemo(() => FRAGEN.filter((f) => !f.wenn || f.wenn(a)), [a]);
  const fertig = fragen.every((f) => a[f.key]);
  const ergebnis = useMemo(() => (fertig ? einschaetzung(a, land) : null), [a, land, fertig]);
  const setzen = (k: string, v: string) => setA((x) => { const n = { ...x, [k]: v }; if (k === "art") return { art: v }; return n; });

  return (
    <Dunkel seite="ratgeber" titel="Ist mein Eintrag angreifbar? · Werkzeug" beschreibung="Fünf Fragen, eine ehrliche Einschätzung: Ob Ihr SCHUFA-, KSV- oder CRIF-Eintrag gelöscht werden kann – nach § 31 BDSG, Löschfristen und BGH-Rechtsprechung. Kostenlos, ohne Anmeldung.">
      <Hero bild="/kino/akten.jpg" pille="Werkzeug · kostenlos, ohne Anmeldung" titel={<>Ist mein Eintrag <span className="dk-verlauf">angreifbar?</span></>}
            lead="Fünf Fragen, eine ehrliche Einschätzung. Wir prüfen die Voraussetzungen, die das Gesetz für eine Meldung verlangt – und sagen auch, wenn ein Eintrag berechtigt ist."
            knoepfe={<><Knopf href="#pruefer">Prüfung starten</Knopf><Knopf href="/ratgeber" still>Zum Ratgeber</Knopf></>} />
      <Licht>
        <Block id="pruefer" pille="Die Prüfung" titel={<>Fünf Fragen. <span className="dk-verlauf">Eine Antwort.</span></>} mitte>
          <div className="rg-filter" style={{ marginTop: 8 }}>
            {(["DE", "AT", "CH"] as Land[]).map((l) => <button key={l} type="button" data-an={land === l ? "1" : undefined} onClick={() => setLand(l)}>{l === "DE" ? "Deutschland · SCHUFA" : l === "AT" ? "Österreich · KSV/CRIF" : "Schweiz · CRIF/Intrum"}</button>)}
          </div>
          <div className="wz-fragen">
            {fragen.map((f, i) => (
              <div key={f.key} className="wz-frage">
                <p className="wz-nr">Frage {i + 1} von {fragen.length}</p>
                <h3>{f.frage}</h3>
                {f.hinweis && <p className="wz-hinweis">{f.hinweis}</p>}
                <div className="wz-optionen">
                  {f.optionen.map((o) => (
                    <button key={o.wert} type="button" className={`wz-option${a[f.key] === o.wert ? " an" : ""}`} onClick={() => setzen(f.key, o.wert)}>
                      <b>{o.label}</b>{o.text && <span>{o.text}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {ergebnis && (
            <div className="wz-ergebnis" style={{ borderColor: STUFE[ergebnis.stufe].farbe }}>
              <span className="wz-stufe" style={{ background: STUFE[ergebnis.stufe].farbe }}>{STUFE[ergebnis.stufe].label}</span>
              <h3>{ergebnis.titel}</h3>
              <p>{ergebnis.text}</p>
              <div className="wz-schritt"><small>Ihr nächster Schritt</small><p>{ergebnis.schritt}</p></div>
              <div className="dk-knoepfe" style={{ justifyContent: "flex-start", marginTop: 18 }}>
                <Knopf href="/antrag">FIAON übernimmt das</Knopf>
                <Knopf href={ergebnis.artikel} still>Im Ratgeber nachlesen</Knopf>
              </div>
              <p className="rg-hinweis">Diese Einschätzung beruht auf Ihren Angaben und den allgemeinen Regeln (§ 31 BDSG, Verhaltensregeln der Auskunfteien, BGH 2023). Sie ersetzt keine Prüfung des Einzelfalls. Für Österreich und die Schweiz gelten ähnliche, nicht identische Regeln.</p>
            </div>
          )}
        </Block>
      </Licht>
      <Zwischenruf text="FIAON beschafft Ihre Auskunft, bewertet jeden Eintrag und bereitet das passende Schreiben vor – Sie geben frei, wir versenden." knopf="Konto eröffnen" href="/antrag" still={{ knopf: "Selbstauskunft-Generator", href: "/werkzeuge/selbstauskunft" }} />
    </Dunkel>
  );
}
