// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/loeschfrist — Löschfrist-Rechner (23.08.2026)
//
// Art des Eintrags + Daten → taggenaues Löschdatum nach den Verhaltensregeln
// der Auskunfteien, inklusive 100-Tage-Regel (seit 2024). Alles im Browser,
// nichts wird gespeichert. Kostenlos, ohne Anmeldung.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

type Art = "erledigt" | "offen" | "titel" | "rsb" | "anfrage" | "konto";
const ARTEN: { wert: Art; label: string; hinweis: string }[] = [
  { wert: "erledigt", label: "Erledigte Forderung (bezahlt)", hinweis: "Der Eintrag trägt einen Erledigungsvermerk." },
  { wert: "offen", label: "Offene Forderung (noch nicht bezahlt)", hinweis: "Ohne Erledigung läuft keine Löschfrist." },
  { wert: "titel", label: "Titulierte Forderung (Mahn-/Vollstreckungsbescheid)", hinweis: "Gerichtlich festgestellt." },
  { wert: "rsb", label: "Restschuldbefreiung nach Insolvenz", hinweis: "Seit März 2023 nur noch sechs Monate." },
  { wert: "anfrage", label: "Kreditanfrage", hinweis: "Keine Negativinformation, aber gespeichert." },
  { wert: "konto", label: "Gekündigtes Konto / gekündigte Karte (durch die Bank)", hinweis: "Kündigung wegen Vertragsverstoß." },
];

const tage = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const plusMonate = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);

export default function Loeschfrist() {
  const [art, setArt] = useState<Art | "">("");
  const [erledigt, setErledigt] = useState("");
  const [gemeldet, setGemeldet] = useState("");
  const [weitere, setWeitere] = useState<"nein" | "ja" | "">("");
  const heute = useMemo(() => new Date(), []);

  const ergebnis = useMemo(() => {
    if (!art) return null;
    const e = parse(erledigt), m = parse(gemeldet);
    if (art === "offen") return { titel: "Keine Löschfrist – der Eintrag bleibt, bis die Forderung erledigt oder die Meldung unzulässig ist.", datum: null as Date | null, regel: "Offene Forderungen werden erst nach Erledigung gelöscht (drei Jahre taggenau nach Erledigung). Prüfen Sie zuerst, ob die Meldung überhaupt zulässig war: zwei Mahnungen, vier Wochen Abstand, Hinweis auf die Meldung, Forderung nicht bestritten (§ 31 Abs. 2 BDSG).", schritt: "Werkzeug „Ist mein Eintrag angreifbar?“ nutzen – oder die Forderung innerhalb von 100 Tagen nach der Meldung begleichen, dann gilt die kurze Frist von 18 Monaten.", link: "/werkzeuge/eintrag-pruefen", linkText: "Eintrag prüfen" };
    if (art === "anfrage") {
      if (!e) return { titel: "Bitte das Datum der Anfrage eingeben.", datum: null, regel: "", schritt: "", link: "", linkText: "" };
      return { titel: `Löschung am ${fmt(plusMonate(e, 12))}`, datum: plusMonate(e, 12), regel: "Kreditanfragen werden zwölf Monate gespeichert und sind nur zehn Tage lang für andere Vertragspartner sichtbar. Sie wirken nicht wie ein Negativmerkmal – viele Anfragen in kurzer Zeit können den Score aber drücken. Konditionsanfragen sind neutral.", schritt: "Bei künftigen Vergleichen ausdrücklich „Konditionsanfrage“ verlangen.", link: "/ratgeber/schufa-score-verstehen", linkText: "Score verstehen" };
    }
    if (art === "rsb") {
      if (!e) return { titel: "Bitte das Datum der Restschuldbefreiung eingeben.", datum: null, regel: "", schritt: "", link: "", linkText: "" };
      const d = plusMonate(e, 6);
      return { titel: d < heute ? `Der Eintrag hätte am ${fmt(d)} gelöscht sein müssen.` : `Löschung am ${fmt(d)}`, datum: d, regel: "Seit März 2023 speichern die Auskunfteien die Restschuldbefreiung nur noch sechs Monate – so lange wie das öffentliche Insolvenzportal. Der EuGH hat diese Linie am 7. Dezember 2023 bestätigt (C-26/22, C-64/22).", schritt: d < heute ? "Löschung nach Art. 17 DSGVO verlangen, mit Verweis auf das EuGH-Urteil. Bei Weigerung: Datenschutzbehörde." : "Löschdatum notieren und danach die Datenkopie prüfen.", link: "/ratgeber/eugh-urteile-schufa-2023-was-sie-bedeuten", linkText: "Die Urteile im Detail" };
    }
    if (!e) return { titel: "Bitte das Erledigungsdatum eingeben.", datum: null, regel: "", schritt: "", link: "", linkText: "" };
    let monate = 36, regel = "Erledigte Forderungen, titulierte Forderungen und bankseitige Kündigungen werden drei Jahre nach dem Erledigungsdatum gelöscht – taggenau, nicht mehr zum Jahresende.";
    let kurz = false;
    if (art === "erledigt" && m && weitere === "nein") {
      const frist = tage(m, e);
      if (frist >= 0 && frist <= 100 && m >= new Date("2024-01-01")) { monate = 18; kurz = true; regel = `Sie haben innerhalb von ${frist} Tagen nach der Meldung beglichen und es liegen keine weiteren Negativmerkmale vor: Es gilt die kurze Frist der Verhaltensregeln 2024 – Löschung 18 Monate nach der Erledigung statt nach drei Jahren.`; }
      else if (frist > 100) regel += ` Die 100-Tage-Regel greift nicht: Zwischen Meldung und Begleichung lagen ${frist} Tage.`;
    } else if (art === "erledigt" && m && weitere === "ja") regel += " Die 100-Tage-Regel setzt voraus, dass keine weiteren Negativmerkmale vorliegen – deshalb bleibt es bei drei Jahren.";
    const d = plusMonate(e, monate);
    const rest = tage(heute, d);
    return { titel: rest < 0 ? `Der Eintrag hätte am ${fmt(d)} gelöscht sein müssen.` : `Löschung am ${fmt(d)} – in ${rest} Tagen`, datum: d, regel, kurz, schritt: rest < 0 ? "Datenkopie anfordern und die Löschung nach Art. 17 DSGVO verlangen – eine überschrittene Frist ist ein klarer Löschgrund." : kurz ? "Den Gläubiger schriftlich auffordern, die Erledigung zu melden, und die Auskunftei auf die 100-Tage-Regel hinweisen. Löschdatum im Kalender." : "Prüfen, ob die Meldung überhaupt zulässig war – wenn Voraussetzungen fehlen, ist der Eintrag vor Ablauf der Frist angreifbar.", link: rest < 0 ? "/werkzeuge/selbstauskunft" : "/ratgeber/100-tage-regel-schufa-2024", linkText: rest < 0 ? "Datenkopie anfordern" : "Die 100-Tage-Regel" };
  }, [art, erledigt, gemeldet, weitere, heute]);

  return (
    <Dunkel seite="ratgeber" titel="Löschfrist-Rechner · Wann ist mein Eintrag weg?" beschreibung="Kostenlos: Art des Eintrags und Daten eingeben – der Rechner nennt das taggenaue Löschdatum nach den Verhaltensregeln der Auskunfteien, inklusive 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz.">
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Wann ist mein Eintrag <span className="dk-verlauf">weg?</span></h1>
          <p className="dk-lead">Drei Jahre, 18 Monate oder sechs Monate – je nach Art des Eintrags und Ihrem Verhalten. Der Rechner nennt das taggenaue Datum.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Um welchen Eintrag geht es?</h3>
              <div className="wz-optionen">{ARTEN.map((a) => <button key={a.wert} type="button" className={`wz-option${art === a.wert ? " an" : ""}`} onClick={() => setArt(a.wert)}><b>{a.label}</b><small>{a.hinweis}</small></button>)}</div>
            </div>
            {art && art !== "offen" && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 2</p>
                <h3>{art === "anfrage" ? "Datum der Anfrage" : art === "rsb" ? "Datum der Restschuldbefreiung (Beschluss)" : "Erledigungsdatum laut Datenkopie"}</h3>
                {art !== "anfrage" && art !== "rsb" && <p className="wz-hinweis">Das Datum, das der Gläubiger als Erledigung gemeldet hat – es steht in Ihrer Datenkopie. Weicht es von Ihrer Zahlung ab, lohnt sich eine Berichtigung.</p>}
                <div className="wz-felder"><label><span>Datum</span><input type="date" value={erledigt} onChange={(e) => setErledigt(e.target.value)} max="2099-12-31" /></label></div>
              </div>
            )}
            {art === "erledigt" && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 3 · für die 100-Tage-Regel</p><h3>Wann wurde die Forderung gemeldet – und gibt es weitere Einträge?</h3>
                <p className="wz-hinweis">Das Meldedatum steht ebenfalls in der Datenkopie. Ohne Angabe rechnet der Rechner mit drei Jahren.</p>
                <div className="wz-felder"><label><span>Meldedatum (optional)</span><input type="date" value={gemeldet} onChange={(e) => setGemeldet(e.target.value)} /></label></div>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${weitere === "nein" ? " an" : ""}`} onClick={() => setWeitere("nein")}><b>Keine weiteren Negativeinträge</b></button>
                  <button type="button" className={`wz-option${weitere === "ja" ? " an" : ""}`} onClick={() => setWeitere("ja")}><b>Es gibt weitere Einträge</b></button>
                </div>
              </div>
            )}
          </div>
          {ergebnis && ergebnis.regel && (
            <div className={`wz-ergebnis${ergebnis.datum && ergebnis.datum < heute ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: ergebnis.datum && ergebnis.datum < heute ? "#b91c1c" : (ergebnis as any).kurz ? "#047857" : "#1d4ed8" }}>{ergebnis.datum && ergebnis.datum < heute ? "Frist überschritten" : (ergebnis as any).kurz ? "Kurze Frist" : "Reguläre Frist"}</span>
              <h3>{ergebnis.titel}</h3>
              <p>{ergebnis.regel}</p>
              <div className="wz-schritt"><small>Ihr nächster Schritt</small><p>{ergebnis.schritt}</p></div>
              <div className="wz-knoepfe"><Knopf href={ergebnis.link}>{ergebnis.linkText}</Knopf><Knopf href="/antrag" still>FIAON übernimmt das</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024), § 31 BDSG, Art. 17 DSGVO, EuGH C-26/22. Das Werkzeug ersetzt keine Prüfung Ihrer Datenkopie. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Frist läuft – oder längst abgelaufen?</b> FIAON beschafft Ihre Auskunft, prüft jede Frist und verlangt die Löschung, wo sie fällig ist.</>} knopf="Auskunft beschaffen" href="/antrag" />
    </Dunkel>
  );
}
