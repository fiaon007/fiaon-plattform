// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/mahnbescheid — Fristenrechner für Mahnbescheid und
// Vollstreckungsbescheid (02.09.2026, E-080)
//
// Der gelbe Umschlag vom Amtsgericht ist die eine Stelle im ganzen Weg, an
// der ein Kalender über Jahre entscheidet: Zwei Wochen ab Zustellung für den
// Widerspruch (§ 694 ZPO). Wer sie verpasst, bekommt einen Vollstreckungs-
// bescheid (§ 699 ZPO) – dagegen wieder zwei Wochen Einspruch (§ 700 i. V. m.
// § 339 ZPO). Danach ist die Forderung tituliert: 30 Jahre vollstreckbar
// (§ 197 Abs. 1 Nr. 3 BGB) und meldefähig, egal ob bestritten.
//
// Das Werkzeug rechnet die Fristen taggenau (Zustellung zählt nicht mit,
// § 222 ZPO i. V. m. §§ 187, 188 BGB; endet die Frist an Samstag, Sonntag
// oder Feiertag, gilt der nächste Werktag) und sagt, was auf dem Formular
// anzukreuzen ist. Bundesweite Feiertage sind hinterlegt; Landesfeiertage
// nicht – deshalb der Hinweis, einen Tag Reserve zu lassen.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const fmt = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);

/** Bundesweite Feiertage (ohne Landesfeiertage). Ostern nach Gauß. */
function feiertage(jahr: number): Set<string> {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  const ostern = new Date(jahr, monat - 1, tag, 12);
  const plus = (n: number) => { const x = new Date(ostern); x.setDate(x.getDate() + n); return x; };
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return new Set([
    `${jahr}-01-01`, `${jahr}-05-01`, `${jahr}-10-03`, `${jahr}-12-25`, `${jahr}-12-26`,
    iso(plus(-2)), iso(plus(1)), iso(plus(39)), iso(plus(50)),
  ]);
}

function fristEnde(zustellung: Date, tage: number): { ende: Date; verschoben: boolean } {
  const ende = new Date(zustellung); ende.setDate(ende.getDate() + tage);
  let verschoben = false;
  for (let i = 0; i < 10; i++) {
    const wt = ende.getDay(); const iso = ende.toISOString().slice(0, 10);
    if (wt === 0 || wt === 6 || feiertage(ende.getFullYear()).has(iso)) { ende.setDate(ende.getDate() + 1); verschoben = true; } else break;
  }
  return { ende, verschoben };
}

const FRAGEN = [
  { f: "Prüft das Gericht, ob die Forderung berechtigt ist?", a: "Nein. Das Mahnverfahren ist ein automatisiertes Verfahren: Das Mahngericht prüft nur, ob der Antrag formal vollständig ist – nicht, ob die Forderung besteht. Deshalb kommen auch verjährte, überhöhte oder erfundene Forderungen als Mahnbescheid. Der Widerspruch ist Ihr einziger Hebel, und er kostet nichts." },
  { f: "Muss ich den Widerspruch begründen?", a: "Nein. Ein Kreuz im Feld „Ich widerspreche dem Anspruch insgesamt“, Datum, Unterschrift – das genügt (§ 694 ZPO). Eine Begründung können Sie später im streitigen Verfahren liefern. Wichtig ist nur, dass der Widerspruch innerhalb von zwei Wochen beim Mahngericht EINGEHT." },
  { f: "Was passiert nach dem Widerspruch?", a: "Der Gläubiger muss entscheiden, ob er klagt. Erst dann prüft ein Gericht die Forderung inhaltlich – mit Ihren Einwänden (Verjährung, überhöhte Inkassokosten, nie bestellt). Viele Inkassounternehmen klagen bei begründetem Widerspruch nicht. Ohne Widerspruch bekommen sie den Titel ohne jede Prüfung." },
  { f: "Ich habe die zwei Wochen verpasst – ist alles verloren?", a: "Nicht sofort. Der Gläubiger muss den Vollstreckungsbescheid erst beantragen; gegen den haben Sie erneut zwei Wochen ab Zustellung für den Einspruch (§ 700 ZPO). Auch ein verspäteter Widerspruch wird als Einspruch gegen den Vollstreckungsbescheid gewertet. Erst wenn auch diese Frist verstreicht, ist die Forderung tituliert – 30 Jahre vollstreckbar." },
  { f: "Führt ein Mahnbescheid zu einem SCHUFA-Eintrag?", a: "Der Mahnbescheid selbst nicht. Ein Vollstreckungsbescheid oder ein Urteil ist dagegen eine titulierte Forderung, die unabhängig von § 31 Abs. 2 Nr. 4 BDSG gemeldet werden darf – auch wenn Sie die Forderung bestreiten. Deshalb ist die Widerspruchsfrist die wichtigste Frist im ganzen Weg." },
];

export default function Mahnbescheid() {
  const [art, setArt] = useState<"mahn" | "voll" | "">("");
  const [zustellung, setZustellung] = useState("");
  const z = parse(zustellung);
  const heute = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);

  const e = useMemo(() => {
    if (!z || !art) return null;
    const frist = fristEnde(z, 14);
    const rest = Math.round((frist.ende.getTime() - heute.getTime()) / 86_400_000);
    return { frist, rest, abgelaufen: rest < 0 };
  }, [z, art, heute]);

  return (
    <Dunkel seite="ratgeber" titel="Mahnbescheid-Fristenrechner · Zwei Wochen, die alles entscheiden" beschreibung="Mahnbescheid oder Vollstreckungsbescheid erhalten? Zustelldatum eingeben – der Rechner nennt den letzten Tag für Widerspruch oder Einspruch, was anzukreuzen ist und was danach passiert. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/mahnbescheid" titel="Mahnbescheid-Fristenrechner: Widerspruch bis wann?" beschreibung="Mahnbescheid erhalten? Zustelldatum eingeben – der Rechner nennt den letzten Tag für Widerspruch oder Einspruch (§§ 694, 700 ZPO), was anzukreuzen ist und was danach passiert." fragen={FRAGEN} werkzeug={{ name: "Mahnbescheid-Fristenrechner" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Mahnbescheid-Fristenrechner", pfad: "/werkzeuge/mahnbescheid" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Gelber Umschlag: <span className="dk-verlauf">Bis wann muss ich reagieren?</span></h1>
          <p className="dk-lead">Zwei Wochen ab Zustellung – taggenau gerechnet, Wochenenden und Feiertage berücksichtigt. Der Rechner sagt, welcher Tag der letzte ist, was Sie ankreuzen und was passiert, wenn Sie nichts tun.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was steht oben auf dem Schreiben?</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${art === "mahn" ? " an" : ""}`} onClick={() => setArt("mahn")}><b>Mahnbescheid</b><small>Gelber Umschlag vom Amtsgericht (Mahngericht). Noch kein Titel.</small></button>
                <button type="button" className={`wz-option${art === "voll" ? " an" : ""}`} onClick={() => setArt("voll")}><b>Vollstreckungsbescheid</b><small>Der zweite Schritt – jetzt zählt die Einspruchsfrist.</small></button>
              </div>
            </div>
            {art && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 2</p><h3>Wann wurde er zugestellt?</h3>
                <p className="wz-hinweis">Das Datum steht auf dem gelben Umschlag (Vermerk des Zustellers) – nicht das Datum des Bescheids. Bei Einwurf in den Briefkasten zählt der Tag des Einwurfs.</p>
                <div className="wz-felder"><label><span>Zustelldatum</span><input type="date" value={zustellung} onChange={(ev) => setZustellung(ev.target.value)} /></label></div>
              </div>
            )}
          </div>
          {e && (
            <div className={`wz-ergebnis${e.abgelaufen ? " alarm" : e.rest <= 3 ? " alarm" : " gut"}`}>
              <span className="wz-stufe" style={{ background: e.abgelaufen ? "#b91c1c" : e.rest <= 3 ? "#b45309" : "#047857" }}>{e.abgelaufen ? "Frist abgelaufen" : e.rest === 0 ? "Heute ist der letzte Tag" : `Noch ${e.rest} Tag${e.rest === 1 ? "" : "e"}`}</span>
              <h3>{art === "mahn" ? "Widerspruch" : "Einspruch"} spätestens am {fmt(e.frist.ende)}{e.frist.verschoben ? " (verschoben, weil das rechnerische Ende auf Wochenende oder Feiertag fiel)" : ""}.</h3>
              <p>Die Frist beträgt zwei Wochen ab Zustellung ({art === "mahn" ? "§ 694 ZPO" : "§ 700 Abs. 1 i. V. m. § 339 ZPO"}). Der Zustelltag zählt nicht mit; endet die Frist an einem Samstag, Sonntag oder bundesweiten Feiertag, gilt der nächste Werktag (§ 222 ZPO). Entscheidend ist der EINGANG beim Gericht – nicht der Poststempel. Landesfeiertage sind nicht hinterlegt: Lassen Sie einen Tag Reserve.</p>
              {!e.abgelaufen ? (
                <>
                  <div className="wz-schritt"><small>Was Sie ankreuzen</small><p>{art === "mahn" ? "Auf dem beiliegenden Formular „Widerspruch gegen den Mahnbescheid“: das Feld „Ich widerspreche dem Anspruch insgesamt“. Datum, Unterschrift. Keine Begründung nötig. An das Mahngericht, das auf dem Bescheid steht – am sichersten per Fax mit Sendebericht oder persönlich gegen Eingangsstempel, sonst Einschreiben mit ausreichend Vorlauf." : "Auf dem beiliegenden Formular „Einspruch gegen den Vollstreckungsbescheid“ – oder formlos: „Hiermit lege ich gegen den Vollstreckungsbescheid vom … (Geschäftsnummer …) Einspruch ein.“ Datum, Unterschrift, an das Mahngericht. Der Einspruch hält die Vollstreckung nicht automatisch auf – beantragen Sie zugleich die einstweilige Einstellung der Zwangsvollstreckung (§ 719 ZPO)."}</p></div>
                  <div className="wz-schritt"><small>Was danach passiert</small><p>Der Gläubiger muss klagen, wenn er die Forderung durchsetzen will – erst dann prüft ein Gericht, ob sie besteht. Bereiten Sie Ihre Einwände vor: Ist die Forderung <a href="/werkzeuge/verjaehrung">verjährt</a>? Sind die <a href="/werkzeuge/inkassokosten">Inkassokosten</a> überhöht? Haben Sie je einen Vertrag geschlossen? Ein Mahnbescheid ist keine Prüfung, sondern ein Antrag – behandeln Sie ihn so.</p></div>
                </>
              ) : (
                <div className="wz-schritt"><small>Was jetzt noch geht</small><p>{art === "mahn" ? "Ein verspäteter Widerspruch gilt als Einspruch gegen den Vollstreckungsbescheid, sobald dieser zugestellt ist – dann laufen erneut zwei Wochen. Bis dahin: nichts anerkennen, nichts zahlen „zur Prüfung“, Unterlagen sammeln." : "Nach Ablauf der Einspruchsfrist ist die Forderung tituliert: 30 Jahre vollstreckbar (§ 197 BGB). Es bleiben die Vollstreckungsabwehrklage bei nachträglichen Einwänden (§ 767 ZPO) und – realistischer – eine Ratenvereinbarung mit dem Gläubiger. Sprechen Sie mit einer Schuldnerberatung oder lassen Sie FIAON die Lage prüfen."}</p></div>
              )}
              <div className="wz-knoepfe">
                <Knopf href="/werkzeuge/verjaehrung" still>Verjährung prüfen</Knopf>
                <Knopf href="/werkzeuge/inkasso-antwort" still>Antwort an das Inkasso</Knopf>
              </div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: §§ 222, 339, 694, 699, 700, 719 ZPO; §§ 187, 188, 197 BGB. Bundesweite Feiertage hinterlegt, Landesfeiertage nicht. Das Werkzeug ersetzt keine Rechtsberatung und keine Fristenkontrolle durch einen Anwalt. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Der Bescheid ist da, die Ruhe nicht?</b> FIAON prüft Forderung, Verjährung und Kosten – und bereitet den Widerspruch mit Ihnen vor, bevor die Frist läuft.</>} knopf="Lage prüfen lassen" href="/antrag" still={{ knopf: "Inkasso-Brief erhalten?", href: "/inkasso-brief-erhalten" }} />
    </Dunkel>
  );
}
