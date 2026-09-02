// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/spielraum · /en/tools/monthly-headroom — Spielraum-Rechner
// (23.08.2026, zweisprachig 03.09.2026)
//
// Einnahmen und Fixkosten → monatlicher Spielraum, Quote, und was Banken
// bei Karte und Rahmen daraus lesen (Richtwerte). Texte: client/src/i18n/wz-spielraum.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_SPIELRAUM_WOERTER } from "@/i18n/wz-spielraum";
import "@/styles/ratgeber.css";

const z = (s: string) => { const r = String(s).trim(); const n = parseFloat(/,\d{1,2}$/.test(r) ? r.replace(/\./g, "").replace(",", ".") : r.replace(/,/g, "")); return isFinite(n) && n >= 0 ? n : 0; };

export default function Spielraum() {
  const t = useWoerter(WZ_SPIELRAUM_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/monthly-headroom" : "/werkzeuge/spielraum";
  const euro = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const [ein, setEin] = useState("");
  const [ein2, setEin2] = useState("");
  const [k, setK] = useState<Record<string, string>>({});
  const e = useMemo(() => {
    const einnahmen = z(ein) + z(ein2); if (!einnahmen) return null;
    const fix = t.felder.reduce((s, [key]) => s + z(k[key] || ""), 0);
    const spiel = einnahmen - fix; const quote = fix / einnahmen;
    const raten = z(k.raten || "");
    const stufe = spiel < 0 ? { key: "minus", farbe: "#b91c1c" } : quote > 0.85 ? { key: "eng", farbe: "#b45309" } : quote > 0.7 ? { key: "solide", farbe: "#1d4ed8" } : { key: "komfortabel", farbe: "#047857" };
    const rahmen = Math.max(0, Math.min(25000, Math.round(spiel * 8 / 500) * 500));
    return { einnahmen, fix, spiel, quote, raten, stufe, rahmen };
  }, [ein, ein2, k, t]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" /><div className="schleier" /></div>
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
                <label><span>{t.netto}</span><input inputMode="decimal" placeholder={t.bspNetto} value={ein} onChange={(ev) => setEin(ev.target.value)} /></label>
                <label><span>{t.weitere}</span><input inputMode="decimal" placeholder={t.bspWeitere} value={ein2} onChange={(ev) => setEin2(ev.target.value)} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <div className="wz-felder drei">{t.felder.map(([key, l, ph]) => <label key={key}><span>{l}</span><input inputMode="decimal" placeholder={ph} value={k[key] || ""} onChange={(ev) => setK({ ...k, [key]: ev.target.value })} /></label>)}</div>
            </div>
          </div>
          {e && (
            <div className="wz-ergebnis" style={{ borderColor: e.stufe.farbe }}>
              <span className="wz-stufe" style={{ background: e.stufe.farbe }}>{t.stufen[e.stufe.key]}</span>
              <h3>{e.spiel < 0 ? t.fehlt(euro(-e.spiel)) : t.spielraum(euro(e.spiel))}</h3>
              <table className="wz-tabelle"><tbody>
                <tr><td>{t.zeileEinnahmen}</td><td>{euro(e.einnahmen)}</td></tr>
                <tr><td>{t.zeileFix}</td><td>− {euro(e.fix)}</td></tr>
                <tr><td>{t.zeileQuote}</td><td>{Math.round(e.quote * 100)} %</td></tr>
                <tr className="summe"><td>{t.zeileSpielraum}</td><td>{euro(e.spiel)}</td></tr>
              </tbody></table>
              <p>{e.spiel < 0 ? t.textMinus : e.quote > 0.85 ? t.textEng : e.quote > 0.7 ? t.textSolide : t.textKomfortabel}</p>
              {e.spiel > 0 && <div className="wz-schritt"><small>{t.richtwert}</small><p>{t.richtwertText(euro(Math.max(500, e.rahmen)))}</p></div>}
              <div className="wz-knoepfe"><Knopf href={zu("/werkzeuge/karten-check")}>{t.kartenCheck}</Knopf><Knopf href="/antrag" still>{t.auskunft}</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/demo/kundenbereich" />
    </Dunkel>
  );
}
