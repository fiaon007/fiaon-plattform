// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/dispo-rechner · /en/tools/overdraft-calculator — Was der
// Dauer-Dispo kostet und was der Ausstieg bringt (02.09.2026, E-080;
// zweisprachig 03.09.2026, Texte: client/src/i18n/wz-dispo-rechner.ts)
//
// Durchschnittlicher Dispozins in Deutschland: rund 11,3 Prozent (Verivox,
// November 2025; Stiftung Warentest Juni 2025: 11,22 Prozent). Spanne der
// Banken etwa 7 bis 17 Prozent. Der Rechner nimmt den eigenen Zinssatz der
// Bank (steht im Preisaushang) und vergleicht drei Wege: weiter im Minus,
// Ratenkredit zur Ablösung, Abbau in festen Monatsraten aus dem Spielraum.
//
// Warum das Werkzeug hier steht: Für Kartenpartner und Banken ist ein
// dauerhaft ausgereizter Dispo das Negativmerkmal, das keine Auskunftei
// zeigt – es steht im Kontoauszug. Wer ihn abbaut, baut Bonität.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_DISPO_WOERTER } from "@/i18n/wz-dispo-rechner";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };

/** Annuität: Monatsrate für Betrag B, Jahreszins p, n Monate. */
const annuitaet = (B: number, p: number, n: number) => { const i = p / 100 / 12; return i === 0 ? B / n : (B * i) / (1 - Math.pow(1 + i, -n)); };
/** Monate bis null bei fester Rate R und Jahreszins p (Restschuld verzinst). */
function monateBisNull(B: number, p: number, R: number): { monate: number; zinsen: number } | null {
  const i = p / 100 / 12; if (R <= B * i) return null;
  let rest = B, zinsen = 0, m = 0;
  while (rest > 0.005 && m < 600) { const z = rest * i; zinsen += z; rest = rest + z - R; m++; }
  return { monate: m, zinsen };
}

export default function DispoRechner() {
  const t = useWoerter(WZ_DISPO_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/overdraft-calculator" : "/werkzeuge/dispo-rechner";
  const loc = en ? "en-GB" : "de-DE";
  const eur = (n: number) => n.toLocaleString(loc, { style: "currency", currency: "EUR" });
  const [stand, setStand] = useState("");
  const [zins, setZins] = useState(t.zinsStart);
  const [abbau, setAbbau] = useState("");
  const [kreditZins, setKreditZins] = useState(t.kreditZinsStart);
  const [laufzeit, setLaufzeit] = useState(24);
  const B = zahl(stand), p = zahl(zins), R = zahl(abbau), pk = zahl(kreditZins);

  const e = useMemo(() => {
    if (B <= 0 || p <= 0) return null;
    const jahrZins = B * p / 100;
    const ratenRate = annuitaet(B, pk, laufzeit);
    const ratenZinsen = ratenRate * laufzeit - B;
    const plan = R > 0 ? monateBisNull(B, p, R) : null;
    const planPlus = R > 0 ? monateBisNull(B, p, R + 50) : null;
    return { jahrZins, ratenRate, ratenZinsen, plan, planPlus };
  }, [B, p, R, pk, laufzeit]);

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
              <div className="wz-felder drei">
                <label><span>{t.stand}</span><input value={stand} onChange={(ev) => setStand(ev.target.value)} inputMode="decimal" placeholder={t.bspStand} /></label>
                <label><span>{t.zins}</span><input value={zins} onChange={(ev) => setZins(ev.target.value)} inputMode="decimal" /></label>
                <label><span>{t.abbau}</span><input value={abbau} onChange={(ev) => setAbbau(ev.target.value)} inputMode="decimal" placeholder={t.bspAbbau} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <p className="wz-hinweis">{t.hinweis2}</p>
              <div className="wz-felder drei">
                <label><span>{t.kreditZins}</span><input value={kreditZins} onChange={(ev) => setKreditZins(ev.target.value)} inputMode="decimal" /></label>
                <label><span>{t.laufzeit}</span><select value={laufzeit} onChange={(ev) => setLaufzeit(Number(ev.target.value))}>{[12, 18, 24, 36, 48].map((n) => <option key={n} value={n}>{t.monate(n)}</option>)}</select></label>
              </div>
            </div>
          </div>
          {e && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#b45309" }}>{t.kostet}</span>
              <h3>{t.titel(eur(e.jahrZins), eur(e.jahrZins / 12))}</h3>
              <p>{t.text(eur(B), p.toLocaleString(loc), eur(e.jahrZins * 3))}</p>
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td>{t.zeileWeiter}</td><td>{t.zeileWeiterWert(eur(e.jahrZins * 3))}</td></tr>
                  <tr><td>{t.zeileKredit(laufzeit, pk.toLocaleString(loc))}</td><td>{t.zeileKreditWert(eur(e.ratenRate), eur(e.ratenZinsen))}</td></tr>
                  {e.plan && <tr><td>{t.zeileAbbau(eur(R))}</td><td>{t.zeileAbbauWert(e.plan.monate, eur(e.plan.zinsen))}</td></tr>}
                  {e.planPlus && <tr className="summe"><td>{t.zeileAbbau(eur(R + 50))}</td><td>{t.zeileAbbauWert(e.planPlus.monate, eur(e.planPlus.zinsen))}</td></tr>}
                </tbody>
              </table></div>
              {R > 0 && !e.plan && <p className="wz-hinweis">{t.deckt(eur(R), eur(e.jahrZins / 12))}</p>}
              <div className="wz-schritt"><small>{t.lesen}</small><p>{t.lesenA(eur(B))}<a href={zu("/werkzeuge/spielraum")}>{t.lesenLink}</a>{t.lesenB}</p></div>
              <div className="wz-schritt"><small>{t.handgriffe}</small><p>{t.handgriffeA}<a href={zu("/schufa-neutral-anfragen")}>{t.handgriffeLink}</a>{t.handgriffeB}</p></div>
              <div className="wz-knoepfe"><Knopf href={zu("/werkzeuge/umschuldung")} still>{t.umschuldung}</Knopf><Knopf href={zu("/werkzeuge/spielraum")} still>{t.spielraum}</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/privatkunden")} still={{ knopf: t.bonitaet, href: zu("/bonitaet-verbessern") }} />
    </Dunkel>
  );
}
