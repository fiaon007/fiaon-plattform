// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/schuldenplan · /en/tools/debt-free-plan — Schuldenfrei-Plan:
// Lawine oder Schneeball (02.09.2026, E-080; zweisprachig 03.09.2026,
// Texte: client/src/i18n/wz-schuldenplan.ts)
//
// Bis zu sechs Schulden (Betrag, Zins, Mindestrate) und ein monatliches
// Budget. Der Rechner simuliert Monat für Monat zwei Strategien:
//   Lawine   – Extra-Geld auf die teuerste Schuld (höchster Zins): am
//              wenigsten Zinsen, mathematisch optimal.
//   Schneeball – Extra-Geld auf die kleinste Schuld: erste Erfolge früh,
//              psychologisch stabiler; kostet meist etwas mehr Zinsen.
// Ergebnis: Monate bis schuldenfrei, Zinsen gesamt, Reihenfolge der
// Tilgung, und die Differenz der beiden Wege. Dazu die ehrliche Grenze: Wenn
// das Budget die Mindestraten nicht deckt, gehört der Fall in die
// kostenlose Schuldnerberatung – nicht in einen Rechner.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_SCHULDENPLAN_WOERTER } from "@/i18n/wz-schuldenplan";
import "@/styles/ratgeber.css";

const zahl = (s: string) => { const r = String(s).trim(); const n = parseFloat(/,\d{1,2}$/.test(r) ? r.replace(/\./g, "").replace(",", ".") : r.replace(/,/g, "")); return isFinite(n) ? n : 0; };

type Schuld = { name: string; betrag: string; zins: string; rate: string };
const LEER: Schuld = { name: "", betrag: "", zins: "", rate: "" };

function simulieren(schulden: { name: string; rest: number; zins: number; rate: number }[], budget: number, strategie: "lawine" | "schneeball") {
  const s = schulden.map((x) => ({ ...x }));
  let monat = 0, zinsen = 0; const reihenfolge: { name: string; monat: number }[] = [];
  while (s.some((x) => x.rest > 0.005) && monat < 600) {
    monat++;
    let frei = budget;
    for (const x of s) { if (x.rest <= 0) continue; const z = x.rest * x.zins / 100 / 12; x.rest += z; zinsen += z; }
    for (const x of s) { if (x.rest <= 0) continue; const p = Math.min(x.rate, x.rest); x.rest -= p; frei -= p; }
    const offen = s.filter((x) => x.rest > 0.005);
    if (offen.length && frei > 0) {
      const ziel = strategie === "lawine" ? offen.reduce((a, b) => (b.zins > a.zins ? b : a)) : offen.reduce((a, b) => (b.rest < a.rest ? b : a));
      const p = Math.min(frei, ziel.rest); ziel.rest -= p; frei -= p;
      if (frei > 0) { for (const x of offen) { if (frei <= 0 || x.rest <= 0) continue; const q = Math.min(frei, x.rest); x.rest -= q; frei -= q; } }
    }
    for (const x of s) if (x.rest <= 0.005 && !reihenfolge.find((r) => r.name === x.name)) { x.rest = 0; reihenfolge.push({ name: x.name, monat }); }
  }
  return { monate: monat, zinsen, reihenfolge };
}

export default function Schuldenplan() {
  const t = useWoerter(WZ_SCHULDENPLAN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/debt-free-plan" : "/werkzeuge/schuldenplan";
  const eur = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const [schulden, setSchulden] = useState<Schuld[]>(() => t.vorgaben.map((name) => ({ ...LEER, name })));
  const [budget, setBudget] = useState("");
  const set = (i: number, f: keyof Schuld) => (ev: React.ChangeEvent<HTMLInputElement>) => setSchulden(schulden.map((s, j) => (j === i ? { ...s, [f]: ev.target.value } : s)));

  const e = useMemo(() => {
    const gueltig = schulden.map((s, i) => ({ name: s.name || t.schuldN(i + 1), rest: zahl(s.betrag), zins: zahl(s.zins), rate: zahl(s.rate) })).filter((s) => s.rest > 0 && s.rate > 0);
    const B = zahl(budget);
    if (!gueltig.length || B <= 0) return null;
    const mindest = gueltig.reduce((a, s) => a + s.rate, 0);
    const gesamt = gueltig.reduce((a, s) => a + s.rest, 0);
    if (B < mindest) return { art: "fehlt" as const, fehlt: mindest - B, mindest, gesamt };
    const zinsProblem = gueltig.filter((s) => s.rate <= s.rest * s.zins / 100 / 12);
    if (zinsProblem.length) return { art: "zins" as const, zinsProblem, mindest, gesamt };
    const lawine = simulieren(gueltig, B, "lawine"); const schneeball = simulieren(gueltig, B, "schneeball");
    return { art: "plan" as const, lawine, schneeball, mindest, gesamt, extra: B - mindest };
  }, [schulden, budget, t]);

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
              <p className="wz-hinweis">{t.hinweis1}</p>
              {schulden.map((s, i) => (
                <div key={i} className="wz-felder drei" style={{ marginBottom: 10 }}>
                  <label><span>{t.bezeichnung}</span><input value={s.name} onChange={set(i, "name")} placeholder={t.schuldN(i + 1)} /></label>
                  <label><span>{t.restschuld}</span><input value={s.betrag} onChange={set(i, "betrag")} inputMode="decimal" /></label>
                  <label><span>{t.zins}</span><input value={s.zins} onChange={set(i, "zins")} inputMode="decimal" /></label>
                  <label><span>{t.mindestrate}</span><input value={s.rate} onChange={set(i, "rate")} inputMode="decimal" /></label>
                </div>
              ))}
              <div className="wz-knoepfe">
                {schulden.length < 6 && <button type="button" className="dk-knopf still" onClick={() => setSchulden([...schulden, { ...LEER }])}>{t.weitere}</button>}
                {schulden.length > 1 && <button type="button" className="dk-knopf still" onClick={() => setSchulden(schulden.slice(0, -1))}>{t.entfernen}</button>}
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <p className="wz-hinweis">{t.hinweis2A}<a href={zu("/werkzeuge/spielraum")}>{t.hinweis2Link}</a>{t.hinweis2B}</p>
              <div className="wz-felder"><label><span>{t.budget}</span><input value={budget} onChange={(ev) => setBudget(ev.target.value)} inputMode="decimal" placeholder={t.bspBudget} /></label></div>
            </div>
          </div>
          {e && e.art === "fehlt" && (
            <div className="wz-ergebnis alarm">
              <span className="wz-stufe" style={{ background: "#b91c1c" }}>{t.fehltStufe}</span>
              <h3>{t.fehltTitel(eur(e.mindest), eur(e.fehlt))}</h3>
              <p>{t.fehltA}<a href={zu("/werkzeuge/ratenplan")}>{t.fehltLink}</a>{t.fehltB}{eur(e.gesamt)}{t.fehltC}</p>
              <div className="wz-knoepfe"><Knopf href={zu("/werkzeuge/ratenplan")} still>{t.ratenangebot}</Knopf><Knopf href={zu("/werkzeuge/schulden-check")} still>{t.schuldenCheck}</Knopf></div>
            </div>
          )}
          {e && e.art === "zins" && (
            <div className="wz-ergebnis alarm">
              <span className="wz-stufe" style={{ background: "#b45309" }}>{t.zinsStufe}</span>
              <h3>{t.zinsTitel(e.zinsProblem.map((s) => s.name).join(", "))}</h3>
              <p>{t.zinsA}<a href={zu("/werkzeuge/umschuldung")}>{t.zinsLink}</a>{t.zinsB}</p>
            </div>
          )}
          {e && e.art === "plan" && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>{t.planStufe}</span>
              <h3>{t.planTitel(e.lawine.monate, e.schneeball.monate)}</h3>
              <p>{t.planText(eur(e.mindest), eur(e.extra), eur(e.gesamt), eur(e.lawine.zinsen), eur(e.schneeball.zinsen), eur(Math.abs(e.schneeball.zinsen - e.lawine.zinsen)))}{Math.abs(e.schneeball.zinsen - e.lawine.zinsen) < 60 ? t.diffKlein : t.diffGross}</p>
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td><b>{t.lawine}</b>{t.lawineErkl}</td><td>{t.monateZinsen(e.lawine.monate, eur(e.lawine.zinsen))}</td></tr>
                  {e.lawine.reihenfolge.map((r, i) => <tr key={"l" + i}><td style={{ paddingLeft: 18 }}>{i + 1}. {r.name}</td><td>{t.getilgt(r.monat)}</td></tr>)}
                  <tr><td><b>{t.schneeball}</b>{t.schneeballErkl}</td><td>{t.monateZinsen(e.schneeball.monate, eur(e.schneeball.zinsen))}</td></tr>
                  {e.schneeball.reihenfolge.map((r, i) => <tr key={"s" + i}><td style={{ paddingLeft: 18 }}>{i + 1}. {r.name}</td><td>{t.getilgt(r.monat)}</td></tr>)}
                </tbody>
              </table></div>
              <div className="wz-schritt"><small>{t.amLeben}</small><p>{t.amLebenA}<a href={zu("/ratenzahlung-und-bonitaet")}>{t.amLebenLink}</a>{t.amLebenB}</p></div>
              <div className="wz-knoepfe"><Knopf href={zu("/werkzeuge/umschuldung")} still>{t.umschuldung}</Knopf><Knopf href={zu("/werkzeuge/dispo-rechner")} still>{t.dispo}</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.beratung, href: zu("/werkzeuge/schulden-check") }} />
    </Dunkel>
  );
}
