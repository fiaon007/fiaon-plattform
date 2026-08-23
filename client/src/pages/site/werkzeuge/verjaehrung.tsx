// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/verjaehrung — Verjährungs-Rechner (23.08.2026)
//
// Fälligkeit, Titel, letzte Anerkennung → Verjährungsdatum nach §§ 195, 199,
// 197, 212 BGB, Stand heute, und die Formulierung für die Einrede.
// Kostenlos, ohne Anmeldung, nichts wird gespeichert.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);
const jahresende = (d: Date, plusJahre: number) => new Date(d.getFullYear() + plusJahre, 11, 31, 23, 59, 59);

export default function Verjaehrung() {
  const [faellig, setFaellig] = useState("");
  const [titel, setTitel] = useState<"nein" | "ja" | "">("");
  const [anerkannt, setAnerkannt] = useState("");
  const [gehemmt, setGehemmt] = useState<"nein" | "ja" | "">("");
  const [kopiert, setKopiert] = useState(false);
  const heute = useMemo(() => new Date(), []);

  const e = useMemo(() => {
    const f = parse(faellig); if (!f || !titel) return null;
    const a = parse(anerkannt);
    if (titel === "ja") {
      const d = new Date(f); d.setFullYear(d.getFullYear() + 30);
      return { datum: d, verjaehrt: d < heute, art: "tituliert", regel: "Titulierte Forderungen (Vollstreckungsbescheid, Urteil, vollstreckbarer Vergleich) verjähren erst nach 30 Jahren (§ 197 Abs. 1 Nr. 3 BGB). Ein Mahnbescheid allein ist noch kein Titel – er hemmt die Verjährung nur.", hinweis: "" };
    }
    let start = f; let grund = "Die regelmäßige Verjährung beträgt drei Jahre und beginnt mit dem Ende des Jahres, in dem die Forderung fällig wurde und der Gläubiger davon wusste (§§ 195, 199 BGB).";
    if (a && a > f) { start = a; grund += ` Durch Ihre Anerkennung am ${fmt(a)} (Teilzahlung, Ratenvereinbarung, Stundungsbitte) hat die Verjährung neu begonnen (§ 212 BGB) – gerechnet ab dem Ende dieses Jahres.`; }
    let d = jahresende(start, 3);
    let hinweis = "";
    if (gehemmt === "ja") { hinweis = "Ein zugestellter Mahnbescheid, eine Klage oder laufende Verhandlungen hemmen die Verjährung (§§ 203, 204 BGB): Die Zeit der Hemmung wird nicht mitgerechnet, in der Regel bis sechs Monate nach Ende des Verfahrens. Das genaue Datum verschiebt sich entsprechend – lassen Sie es prüfen."; }
    return { datum: d, verjaehrt: d < heute && gehemmt !== "ja", art: "regel", regel: grund, hinweis };
  }, [faellig, titel, anerkannt, gehemmt, heute]);

  const text = e ? `Die geltend gemachte Forderung ist nach meiner Prüfung verjährt (Verjährungseintritt am ${fmt(e.datum)}, §§ 195, 199 BGB). Ich erhebe hiermit ausdrücklich die Einrede der Verjährung und werde keine Zahlung leisten. Bitte bestätigen Sie die Einstellung der Beitreibung. Eine Meldung an Auskunfteien ist unzulässig; sollte eine Meldung erfolgt sein, fordere ich die unverzügliche Rücknahme.` : "";

  return (
    <Dunkel seite="ratgeber" titel="Verjährungs-Rechner · Ist die Forderung verjährt?" beschreibung="Kostenlos: Fälligkeit, Titel und letzte Anerkennung eingeben – der Rechner nennt das Verjährungsdatum nach BGB und liefert die Formulierung für die Einrede der Verjährung.">
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Ist die Forderung <span className="dk-verlauf">verjährt?</span></h1>
          <p className="dk-lead">Drei Jahre ab Jahresende – oder 30 Jahre mit Titel. Der Rechner nennt das Datum und formuliert die Einrede, die Inkassobüros nicht gern lesen.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Wann wurde die Forderung fällig?</h3>
              <p className="wz-hinweis">Meist das Datum der Rechnung oder der ersten Mahnung. Wenn Sie es nicht genau wissen: irgendein Tag des richtigen Jahres genügt – es zählt das Jahresende.</p>
              <div className="wz-felder"><label><span>Fälligkeit</span><input type="date" value={faellig} onChange={(ev) => setFaellig(ev.target.value)} /></label></div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Gibt es einen Titel?</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${titel === "nein" ? " an" : ""}`} onClick={() => setTitel("nein")}><b>Nein – nur Mahnungen und Inkassoschreiben</b></button>
                <button type="button" className={`wz-option${titel === "ja" ? " an" : ""}`} onClick={() => setTitel("ja")}><b>Ja – Vollstreckungsbescheid, Urteil oder Vergleich</b><small>Ein Mahnbescheid allein ist kein Titel.</small></button>
              </div>
            </div>
            {titel === "nein" && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 3</p><h3>Haben Sie die Forderung später anerkannt oder wurde sie gehemmt?</h3>
                <p className="wz-hinweis">Eine Teilzahlung, eine Ratenvereinbarung oder eine Bitte um Stundung gilt als Anerkenntnis – die drei Jahre beginnen dann neu.</p>
                <div className="wz-felder"><label><span>Letzte Anerkennung (optional)</span><input type="date" value={anerkannt} onChange={(ev) => setAnerkannt(ev.target.value)} /></label></div>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${gehemmt === "nein" ? " an" : ""}`} onClick={() => setGehemmt("nein")}><b>Kein Mahnbescheid, keine Klage</b></button>
                  <button type="button" className={`wz-option${gehemmt === "ja" ? " an" : ""}`} onClick={() => setGehemmt("ja")}><b>Mahnbescheid oder Klage zugestellt</b><small>Hemmt die Verjährung.</small></button>
                </div>
              </div>
            )}
          </div>
          {e && (titel === "ja" || gehemmt) && (
            <div className={`wz-ergebnis${e.verjaehrt ? " gut" : ""}`}>
              <span className="wz-stufe" style={{ background: e.verjaehrt ? "#047857" : e.hinweis ? "#b45309" : "#1d4ed8" }}>{e.verjaehrt ? "Voraussichtlich verjährt" : e.hinweis ? "Prüfung nötig" : "Noch nicht verjährt"}</span>
              <h3>{e.verjaehrt ? `Verjährt seit dem ${fmt(e.datum)}.` : `Verjährung ${e.hinweis ? "frühestens " : ""}am ${fmt(e.datum)}.`}</h3>
              <p>{e.regel}</p>
              {e.hinweis && <p className="wz-hinweis">{e.hinweis}</p>}
              {e.verjaehrt ? (
                <>
                  <div className="wz-schritt"><small>Wichtig</small><p>Verjährung wirkt nur, wenn Sie sich darauf berufen – und nur, solange Sie nicht zahlen oder anerkennen. Nichts überweisen, keine Raten vereinbaren, nichts „zur Prüfung“ zusagen. Schriftlich die Einrede erheben.</p></div>
                  <div className="wz-schritt"><small>Formulierung für Ihr Schreiben</small><p>{text}</p></div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch { /* egal */ } }}>{kopiert ? "Kopiert" : "Einrede kopieren"}</button>
                    <Knopf href="/ratgeber/inkasso-schreiben-erhalten-was-tun" still>Inkasso: Was tun?</Knopf>
                  </div>
                </>
              ) : (
                <div className="wz-schritt"><small>Ihr nächster Schritt</small><p>Forderung und Kosten prüfen (Inkassokosten-Prüfer), Mahnungen anfordern, und – falls berechtigt – möglichst innerhalb von 100 Tagen nach einer Meldung begleichen.</p></div>
              )}
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: §§ 195, 197, 199, 203, 204, 212 BGB. Richtwerte; Hemmungen und Sonderfristen (z. B. bei Schadensersatz oder Erbschaft) kann das Werkzeug nicht vollständig abbilden. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Alte Forderung, neuer Brief?</b> FIAON prüft Verjährung, Mahnungen und Meldung – und antwortet dem Inkassobüro in Ihrem Namen.</>} knopf="FIAON übernimmt das" href="/antrag" />
    </Dunkel>
  );
}
