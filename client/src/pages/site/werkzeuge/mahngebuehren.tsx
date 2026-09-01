// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/mahngebuehren — Mahngebühren-Prüfer (02.09.2026, E-080)
//
// Regeln, die der Prüfer anwendet:
//   · Die erste Mahnung nach Fälligkeit setzt in der Regel erst in Verzug
//     (§ 286 Abs. 1 BGB) – Kosten dafür sind nicht ersatzfähig, außer der
//     Verzug bestand schon (Kalenderdatum, 30-Tage-Regel nach Rechnung mit
//     Hinweis, § 286 Abs. 2 und 3 BGB).
//   · Ab Verzug: nur der tatsächliche Schaden – Porto, Papier, Druck. Keine
//     Personal- oder Verwaltungskosten. Pauschalen in AGB müssen dem
//     typischen Schaden entsprechen (§ 309 Nr. 5 BGB); der BGH hat 2,50 Euro
//     gegenüber Verbrauchern gekippt, weil die echten Kosten bei 0,76 Euro
//     lagen (Urteil vom 26.06.2019, VIII ZR 95/18).
//   · Verzugszinsen: 5 Prozentpunkte über dem Basiszinssatz (§ 288 Abs. 1
//     BGB). Die 40-Euro-Pauschale gilt NUR zwischen Unternehmern (§ 288
//     Abs. 5 BGB) – gegenüber Verbrauchern nie.
// Als zulässigen Richtwert je Mahnung ab Verzug setzt der Prüfer 1,00 Euro
// an (Porto Standardbrief 0,95 Euro seit 2025 plus Papier); vereinbarte
// Pauschalen bis 1,50 Euro gelten als vertretbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const RICHTWERT = 1.0, VERTRETBAR = 1.5;

const FRAGEN = [
  { f: "Darf ein Gläubiger für die erste Mahnung Gebühren verlangen?", a: "In der Regel nicht. Die erste Mahnung nach Fälligkeit ist das, was Sie überhaupt erst in Verzug setzt (§ 286 Abs. 1 BGB) – ihre Kosten entstehen vor dem Verzug und sind kein Verzugsschaden. Anders nur, wenn Sie schon vorher in Verzug waren: bei einem festen Zahlungsdatum im Vertrag oder 30 Tage nach einer Rechnung, die auf diese Folge hinweist (§ 286 Abs. 2 und 3 BGB)." },
  { f: "Wie hoch dürfen Mahngebühren sein?", a: "So hoch wie der tatsächliche Schaden: Porto, Papier, Druck – typischerweise um einen Euro. Personal, Software, Verwaltung darf nicht umgelegt werden. Der BGH hat eine Pauschale von 2,50 Euro gegenüber Verbrauchern für unwirksam erklärt, weil die echten Kosten bei 0,76 Euro lagen (26.06.2019, VIII ZR 95/18). Pauschalen von 5, 7,50 oder 10 Euro sind gegenüber Verbrauchern nicht haltbar." },
  { f: "Und die 40-Euro-Pauschale?", a: "Sie gilt ausschließlich, wenn der Schuldner kein Verbraucher ist (§ 288 Abs. 5 BGB) – also zwischen Unternehmen. Taucht sie in einer Mahnung an Sie als Privatperson auf, ist sie unzulässig. Das Gleiche gilt für „Bearbeitungsgebühren“, „Kontoführungsgebühren“ oder „Adressermittlung“ ohne Nachweis." },
  { f: "Wie hoch dürfen Verzugszinsen sein?", a: "Fünf Prozentpunkte über dem Basiszinssatz der Bundesbank (§ 288 Abs. 1 BGB); der Basiszinssatz wird zum 1. Januar und 1. Juli festgesetzt. Ein höherer Zins ist nur zulässig, wenn er vertraglich vereinbart oder als konkreter Schaden nachgewiesen ist – etwa, weil der Gläubiger selbst einen teureren Kredit in Anspruch nehmen musste." },
  { f: "Was tue ich mit überhöhten Gebühren?", a: "Die Hauptforderung zahlen (wenn sie berechtigt ist), die überhöhten Nebenkosten schriftlich zurückweisen – mit dem Text aus dem Prüfer. Viele Gläubiger streichen die Posten dann stillschweigend. Bleiben sie hart, muss der Gläubiger die Kosten einklagen und nachweisen; das tut bei einem Euro Streitwert niemand." },
];

export default function Mahngebuehren() {
  const [hauptforderung, setHauptforderung] = useState("");
  const [anzahl, setAnzahl] = useState(2);
  const [gebuehrJe, setGebuehrJe] = useState("");
  const [erste, setErste] = useState<"ja" | "nein" | "">("");
  const [pauschale40, setPauschale40] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const H = zahl(hauptforderung), G = zahl(gebuehrJe);

  const e = useMemo(() => {
    if (G <= 0 || !erste) return null;
    const mahnungenAbVerzug = erste === "ja" ? anzahl : Math.max(0, anzahl - 1);
    const verlangt = G * anzahl + (pauschale40 ? 40 : 0);
    const zulaessig = mahnungenAbVerzug * RICHTWERT;
    const vertretbar = mahnungenAbVerzug * VERTRETBAR;
    const zuViel = Math.max(0, verlangt - vertretbar);
    const stufe = verlangt <= vertretbar ? "ok" : G > 5 || pauschale40 ? "alarm" : "hoch";
    return { mahnungenAbVerzug, verlangt, zulaessig, vertretbar, zuViel, stufe };
  }, [G, anzahl, erste, pauschale40]);

  const text = e ? `Die geltend gemachten Mahnkosten in Höhe von ${eur(e.verlangt)} weise ich zurück. Ersatzfähig ist nur der tatsächlich entstandene Verzugsschaden (Porto und Materialkosten je Mahnung ab Verzug); Personal- und Verwaltungskosten sind nicht umlagefähig. Eine Pauschale, die den typischen Schaden übersteigt, ist gegenüber Verbrauchern unwirksam (§ 309 Nr. 5 Buchst. a BGB; BGH, Urteil vom 26.06.2019, VIII ZR 95/18).${erste === "nein" ? " Die Kosten der ersten Mahnung sind zudem nicht ersatzfähig, da erst sie den Verzug begründet hat (§ 286 Abs. 1 BGB)." : ""}${pauschale40 ? " Die Pauschale nach § 288 Abs. 5 BGB gilt ausschließlich gegenüber Unternehmern und findet auf mich als Verbraucher keine Anwendung." : ""} Ich bin bereit, Mahnkosten in Höhe von ${eur(e.vertretbar)} auszugleichen; darüber hinausgehende Beträge werde ich nicht zahlen.` : "";
  const kopieren = async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };

  return (
    <Dunkel seite="ratgeber" titel="Mahngebühren-Prüfer · Was darf ein Gläubiger verlangen?" beschreibung="Mahngebühren nachrechnen: Anzahl der Mahnungen und Gebühr eingeben – der Prüfer sagt, was nach BGB und BGH zulässig ist, und formuliert die Zurückweisung überhöhter Pauschalen. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/mahngebuehren" titel="Mahngebühren-Prüfer: Wie hoch dürfen Mahnkosten sein?" beschreibung="Mahngebühren nachrechnen: Anzahl der Mahnungen und Gebühr eingeben – der Prüfer sagt, was nach § 286, § 288 BGB und BGH VIII ZR 95/18 zulässig ist, und formuliert die Zurückweisung." fragen={FRAGEN} werkzeug={{ name: "Mahngebühren-Prüfer" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Mahngebühren-Prüfer", pfad: "/werkzeuge/mahngebuehren" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Mahngebühren: <span className="dk-verlauf">Was davon ist erlaubt?</span></h1>
          <p className="dk-lead">Ein Brief kostet rund einen Euro – nicht 7,50. Der Prüfer rechnet nach, was ein Gläubiger für Mahnungen verlangen darf, und formuliert die Zurückweisung für alles darüber.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was steht in der Mahnung?</h3>
              <div className="wz-felder drei">
                <label><span>Hauptforderung (€)</span><input value={hauptforderung} onChange={(ev) => setHauptforderung(ev.target.value)} inputMode="decimal" placeholder="z. B. 89,90" /></label>
                <label><span>Anzahl Mahnungen</span><select value={anzahl} onChange={(ev) => setAnzahl(Number(ev.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label><span>Gebühr je Mahnung (€)</span><input value={gebuehrJe} onChange={(ev) => setGebuehrJe(ev.target.value)} inputMode="decimal" placeholder="z. B. 5,00" /></label>
              </div>
              <div className="wz-optionen zwei" style={{ marginTop: 12 }}>
                <button type="button" className={`wz-option${pauschale40 ? " an" : ""}`} onClick={() => setPauschale40(!pauschale40)}><b>Es wird eine Pauschale von 40 Euro verlangt</b><small>„Verzugspauschale nach § 288 Abs. 5 BGB“</small></button>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Waren Sie schon vor der ersten Mahnung in Verzug?</h3>
              <p className="wz-hinweis">Ja, wenn im Vertrag ein festes Zahlungsdatum stand oder die Rechnung vor mehr als 30 Tagen kam und auf den Verzug hingewiesen hat. Nein, wenn die erste Mahnung die erste Erinnerung überhaupt war.</p>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${erste === "nein" ? " an" : ""}`} onClick={() => setErste("nein")}><b>Nein – die erste Mahnung war die erste Erinnerung</b><small>Dann ist die erste Mahnung kostenlos.</small></button>
                <button type="button" className={`wz-option${erste === "ja" ? " an" : ""}`} onClick={() => setErste("ja")}><b>Ja – Datum im Vertrag oder Rechnung mit Hinweis älter als 30 Tage</b></button>
              </div>
            </div>
          </div>
          {e && (
            <div className={`wz-ergebnis${e.stufe === "ok" ? " gut" : e.stufe === "alarm" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: e.stufe === "ok" ? "#047857" : e.stufe === "alarm" ? "#b91c1c" : "#b45309" }}>{e.stufe === "ok" ? "Im Rahmen" : e.stufe === "alarm" ? "Deutlich überhöht" : "Überhöht"}</span>
              <h3>{e.stufe === "ok" ? `Verlangt werden ${eur(e.verlangt)} – das ist vertretbar.` : `Verlangt werden ${eur(e.verlangt)}, vertretbar sind höchstens ${eur(e.vertretbar)}.`}</h3>
              <p>{e.mahnungenAbVerzug} Mahnung{e.mahnungenAbVerzug === 1 ? "" : "en"} ab Verzug × Richtwert {eur(RICHTWERT)} (Porto und Papier) = {eur(e.zulaessig)}; mit einer vereinbarten Pauschale bis {eur(VERTRETBAR)} je Mahnung höchstens {eur(e.vertretbar)}. {erste === "nein" ? "Die erste Mahnung zählt nicht – sie hat den Verzug erst begründet. " : ""}{pauschale40 ? "Die 40-Euro-Pauschale gilt nur zwischen Unternehmern. " : ""}{e.zuViel > 0 ? `Zu viel verlangt: ${eur(e.zuViel)}.` : ""}</p>
              {e.zuViel > 0 && (
                <>
                  <div className="wz-schritt"><small>Formulierung für Ihre Antwort</small><p>{text}</p></div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? "Kopiert" : "Zurückweisung kopieren"}</button>
                    <Knopf href="/werkzeuge/inkasso-antwort" still>Ganzer Antwortbrief</Knopf>
                  </div>
                </>
              )}
              <div className="wz-schritt"><small>Wichtig</small><p>Die Hauptforderung{H > 0 ? ` von ${eur(H)}` : ""} bleibt davon unberührt: Ist sie berechtigt, zahlen Sie sie – möglichst innerhalb von 100 Tagen nach einer etwaigen Meldung. Zurückgewiesen werden nur die überhöhten Nebenkosten. Kommt später ein Inkassobüro dazu, prüft der <a href="/werkzeuge/inkassokosten">Inkassokosten-Prüfer</a> dessen Gebühren.</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: §§ 280, 286, 288 Abs. 1 und 5, 309 Nr. 5 BGB; BGH, Urteil vom 26.06.2019, VIII ZR 95/18. Richtwert ein Euro je Mahnung (Porto Standardbrief 0,95 Euro seit 2025 zuzüglich Material); Pauschalen bis 1,50 Euro als vertretbar angesetzt – Gerichte entscheiden im Einzelfall. Das Werkzeug ersetzt keine Rechtsberatung. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Mahnung, Inkasso, Eintrag – die Treppe hat vier Stufen.</b> FIAON hält sie auf jeder an: Kosten prüfen, Raten vereinbaren, Meldung verhindern, Eintrag angreifen.</>} knopf="FIAON übernimmt das" href="/antrag" still={{ knopf: "Ratenzahlung & Bonität", href: "/ratenzahlung-und-bonitaet" }} />
    </Dunkel>
  );
}
