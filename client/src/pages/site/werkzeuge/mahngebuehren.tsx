// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/mahngebuehren · /en/tools/reminder-fees — Mahngebühren-Prüfer
// (02.09.2026, E-080; zweisprachig 03.09.2026, Texte: client/src/i18n/wz-mahngebuehren.ts;
// die Zurückweisung bleibt deutsch)
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
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_MAHNGEBUEHREN_WOERTER } from "@/i18n/wz-mahngebuehren";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

const eurDe = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };
// QUELLEN (für die Review nachschlagbar):
//  · BGH, Urteil vom 26.06.2019, Az. VIII ZR 95/18 (Mahnpauschale 2,50 € gegenüber
//    Verbrauchern unwirksam; nachgewiesene Kosten 0,76 €). Sekundär: finanztip.de/
//    mahngebuehren, paywise.de/wissen/mahngebuehren, schuldnerberatung.de/mahngebuehren
//    — abgerufen 02.09.2026.
//  · § 286 Abs. 1–3 BGB (Verzug), § 288 Abs. 1 BGB (5 Punkte über Basiszins),
//    § 288 Abs. 5 BGB (40-€-Pauschale nur, wenn Schuldner kein Verbraucher),
//    § 309 Nr. 5 BGB (Pauschalierung von Schadensersatz in AGB).
//  · Porto Standardbrief 0,95 € seit 01.01.2025 (Deutsche Post, Preisverzeichnis).
// RICHTWERT = tatsächlicher Schaden je Mahnung ab Verzug (Porto + Material);
// VERTRETBAR = vertraglich vereinbarte Pauschale, die Gerichte noch mittragen.
const RICHTWERT = 1.0, VERTRETBAR = 1.5;

export default function Mahngebuehren() {
  const t = useWoerter(WZ_MAHNGEBUEHREN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/reminder-fees" : "/werkzeuge/mahngebuehren";
  const eur = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
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

  const text = e ? `Die geltend gemachten Mahnkosten in Höhe von ${eurDe(e.verlangt)} weise ich zurück. Ersatzfähig ist nur der tatsächlich entstandene Verzugsschaden (Porto und Materialkosten je Mahnung ab Verzug); Personal- und Verwaltungskosten sind nicht umlagefähig. Eine Pauschale, die den typischen Schaden übersteigt, ist gegenüber Verbrauchern unwirksam (§ 309 Nr. 5 Buchst. a BGB; BGH, Urteil vom 26.06.2019, VIII ZR 95/18).${erste === "nein" ? " Die Kosten der ersten Mahnung sind zudem nicht ersatzfähig, da erst sie den Verzug begründet hat (§ 286 Abs. 1 BGB)." : ""}${pauschale40 ? " Die Pauschale nach § 288 Abs. 5 BGB gilt ausschließlich gegenüber Unternehmern und findet auf mich als Verbraucher keine Anwendung." : ""} Ich bin bereit, Mahnkosten in Höhe von ${eurDe(e.vertretbar)} auszugleichen; darüber hinausgehende Beträge werde ich nicht zahlen.` : "";
  const kopieren = async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };

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
              <div className="wz-felder drei">
                <label><span>{t.haupt}</span><input value={hauptforderung} onChange={(ev) => setHauptforderung(ev.target.value)} inputMode="decimal" placeholder={t.bspHaupt} /></label>
                <label><span>{t.anzahl}</span><select value={anzahl} onChange={(ev) => setAnzahl(Number(ev.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label><span>{t.gebuehrJe}</span><input value={gebuehrJe} onChange={(ev) => setGebuehrJe(ev.target.value)} inputMode="decimal" placeholder={t.bspGebuehr} /></label>
              </div>
              <div className="wz-optionen zwei" style={{ marginTop: 12 }}>
                <button type="button" className={`wz-option${pauschale40 ? " an" : ""}`} onClick={() => setPauschale40(!pauschale40)}><b>{t.pauschale40}</b><small>{t.pauschale40Hinweis}</small></button>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <p className="wz-hinweis">{t.hinweis2}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${erste === "nein" ? " an" : ""}`} onClick={() => setErste("nein")}><b>{t.ersteNein}</b><small>{t.ersteNeinHinweis}</small></button>
                <button type="button" className={`wz-option${erste === "ja" ? " an" : ""}`} onClick={() => setErste("ja")}><b>{t.ersteJa}</b></button>
              </div>
            </div>
          </div>
          {e && (
            <div className={`wz-ergebnis${e.stufe === "ok" ? " gut" : e.stufe === "alarm" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: e.stufe === "ok" ? "#047857" : e.stufe === "alarm" ? "#b91c1c" : "#b45309" }}>{e.stufe === "ok" ? t.stufeOk : e.stufe === "alarm" ? t.stufeAlarm : t.stufeHoch}</span>
              <h3>{e.stufe === "ok" ? t.titelOk(eur(e.verlangt)) : t.titelZuViel(eur(e.verlangt), eur(e.vertretbar))}</h3>
              <p>{t.rechnung(e.mahnungenAbVerzug, eur(RICHTWERT), eur(e.zulaessig), eur(VERTRETBAR), eur(e.vertretbar))}{erste === "nein" ? t.ersteZaehltNicht : ""}{pauschale40 ? t.nurUnternehmer : ""}{e.zuViel > 0 ? t.zuViel(eur(e.zuViel)) : ""}</p>
              {e.zuViel > 0 && (
                <>
                  <div className="wz-schritt"><small>{t.formulierung}</small>{t.formulierungHinweis && <p className="wz-hinweis">{t.formulierungHinweis}</p>}<p lang="de">{text}</p></div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? t.kopiert : t.kopieren}</button>
                    <Knopf href={zu("/werkzeuge/inkasso-antwort")} still>{t.ganzerBrief}</Knopf>
                  </div>
                </>
              )}
              <div className="wz-schritt"><small>{t.standTitel}</small><p>{t.stand}</p></div>
              <div className="wz-schritt"><small>{t.wichtig}</small><p>{t.wichtigA}{H > 0 ? t.wichtigVon(eur(H)) : ""}{t.wichtigB}<a href={zu("/werkzeuge/inkassokosten")}>{t.wichtigLink}</a>{t.wichtigC}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.ratenzahlung, href: zu("/ratenzahlung-und-bonitaet") }} />
    </Dunkel>
  );
}
