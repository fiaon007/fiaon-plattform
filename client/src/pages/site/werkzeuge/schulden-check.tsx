// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/schulden-check · /en/tools/debt-check — Der Schulden-Check
// (26.08.2026, zweisprachig 03.09.2026)
//
// Einnahmen, Ausgaben, Raten, Rückstände → eine ehrliche Ampel mit den
// Kennzahlen, die auch eine Schuldnerberatung ansetzen würde. Bei Rot steht
// die KOSTENLOSE staatlich anerkannte Schuldnerberatung VOR jedem FIAON-Knopf.
// Texte: client/src/i18n/wz-schulden-check.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_SCHULDEN_CHECK_WOERTER } from "@/i18n/wz-schulden-check";
import "@/styles/ratgeber.css";

const num = (s: string) => { const r = String(s).trim(); const n = Number(/,\d{1,2}$/.test(r) ? r.replace(/\./g, "").replace(",", ".") : r.replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? n : 0; };

export default function SchuldenCheck() {
  const t = useWoerter(WZ_SCHULDEN_CHECK_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/debt-check" : "/werkzeuge/schulden-check";
  const eur0 = (n: number) => en ? "€" + Math.round(n).toLocaleString("en-GB") : Math.round(n).toLocaleString("de-DE") + " €";

  const [netto, setNetto] = useState("");
  const [wohnen, setWohnen] = useState("");
  const [leben, setLeben] = useState("");
  const [raten, setRaten] = useState("");
  const [rueckstand, setRueckstand] = useState("");
  const [mahnungen, setMahnungen] = useState<"" | "keine" | "mahnungen" | "inkasso">("");

  const lage = useMemo(() => {
    const n = num(netto);
    if (n < 100) return null;
    const w = num(wohnen), l = num(leben), r = num(raten), rs = num(rueckstand);
    const frei = n - w - l - r;
    const quote = n > 0 ? (r / n) * 100 : 0;
    const monate = rs > 0 ? (frei > 0 ? rs / frei : Infinity) : 0;
    let stufe: "gruen" | "gelb" | "rot";
    if (frei < 0 || monate === Infinity || mahnungen === "inkasso") stufe = "rot";
    else if (quote > 40 || monate > 12 || mahnungen === "mahnungen") stufe = "gelb";
    else stufe = "gruen";
    return { n, frei, quote, rs, monate, stufe };
  }, [netto, wohnen, leben, raten, rueckstand, mahnungen]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} werkzeug={{ name: t.werkzeugName }} krumen={[{ name: t.krumeWerkzeuge, pfad: zu("/werkzeuge") }, { name: t.krume, pfad }]} />
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
              <p className="wz-hinweis">{t.hinweis1}</p>
              <div className="wz-felder">
                <label><span>{t.netto}</span><input inputMode="decimal" value={netto} onChange={(e) => setNetto(e.target.value)} placeholder={t.bspNetto} /></label>
                <label><span>{t.wohnen}</span><input inputMode="decimal" value={wohnen} onChange={(e) => setWohnen(e.target.value)} placeholder={t.bspWohnen} /></label>
                <label><span>{t.leben}</span><input inputMode="decimal" value={leben} onChange={(e) => setLeben(e.target.value)} placeholder={t.bspLeben} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <div className="wz-felder">
                <label><span>{t.raten}</span><input inputMode="decimal" value={raten} onChange={(e) => setRaten(e.target.value)} placeholder={t.bspRaten} /></label>
                <label><span>{t.rueckstand}</span><input inputMode="decimal" value={rueckstand} onChange={(e) => setRueckstand(e.target.value)} placeholder={t.bspRueckstand} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
              <div className="wz-optionen">
                <button type="button" className={`wz-option${mahnungen === "keine" ? " an" : ""}`} onClick={() => setMahnungen("keine")}><b>{t.keine}</b><small>{t.keineHinweis}</small></button>
                <button type="button" className={`wz-option${mahnungen === "mahnungen" ? " an" : ""}`} onClick={() => setMahnungen("mahnungen")}><b>{t.mahnungen}</b><small>{t.mahnungenHinweis}</small></button>
                <button type="button" className={`wz-option${mahnungen === "inkasso" ? " an" : ""}`} onClick={() => setMahnungen("inkasso")}><b>{t.inkasso}</b><small>{t.inkassoHinweis}</small></button>
              </div>
            </div>
          </div>

          {lage && mahnungen && (
            <div className={`wz-ergebnis${lage.stufe === "rot" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: lage.stufe === "rot" ? "#b91c1c" : lage.stufe === "gelb" ? "#b45309" : "#047857" }}>
                {lage.stufe === "rot" ? t.stufeRot : lage.stufe === "gelb" ? t.stufeGelb : t.stufeGruen}
              </span>
              <h3>{lage.frei < 0 ? t.fehlt(eur0(-lage.frei)) : t.bleibt(eur0(lage.frei), Math.round(lage.quote))}</h3>
              <p>
                {lage.stufe === "rot" && lage.frei < 0 && t.rotMinus}
                {lage.stufe === "rot" && lage.frei >= 0 && t.rotInkasso}
                {lage.stufe === "gelb" && `${t.gelbA}${lage.quote > 40 ? t.gelbQuote(Math.round(lage.quote)) : ""}${lage.rs > 0 && lage.monate > 12 ? t.gelbRueckstand(eur0(lage.rs)) : ""}${t.gelbB}`}
                {lage.stufe === "gruen" && t.gruen}
              </p>
              <div className="wz-schritt">
                <small>{t.naechsterSchritt}</small>
                {lage.stufe === "rot" ? <p><b>{t.rotSchrittFett}</b>{t.rotSchritt}</p> : lage.stufe === "gelb" ? <p>{t.gelbSchritt}</p> : <p>{t.gruenSchritt}</p>}
              </div>
              <div className="wz-knoepfe">
                {lage.stufe !== "rot" && <Knopf href={zu("/werkzeuge/umschuldung")}>{t.zusammenlegung}</Knopf>}
                <Knopf href={lage.stufe === "rot" ? zu("/kontakt") : "/antrag"} still>{lage.stufe === "rot" ? t.sprechen : t.ordnen}</Knopf>
              </div>
            </div>
          )}

          <h2 className="dk-h2" style={{ marginTop: 56 }}>{t.fragenTitel}</h2>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/kontakt")} />
    </Dunkel>
  );
}
