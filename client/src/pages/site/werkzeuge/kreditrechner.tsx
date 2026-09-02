// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/kreditrechner · /en/tools/loan-calculator — Kreditrechner
// (26.08.2026, zweisprachig 03.09.2026)
//
// Betrag, Laufzeit, Zins → Monatsrate, Gesamtkosten, Zinsanteil, Tilgungsplan.
// Annuitätenformel, kaufmännisch gerundet. Alles im Browser, nichts wird
// gespeichert. Der Zwei-Drittel-Zins (§ 6a PAngV) ist die Botschaft: Wer
// seine Bonität ordnet, zahlt für denselben Kredit weniger.
// Texte: client/src/i18n/wz-kreditrechner.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_KREDITRECHNER_WOERTER } from "@/i18n/wz-kreditrechner";
import "@/styles/ratgeber.css";

/** Annuität: Rate = K · q^n · (q−1) / (q^n − 1), q = 1 + Monatszins. */
function annuitaet(kredit: number, zinsJahr: number, monate: number) {
  if (kredit <= 0 || monate <= 0) return null;
  if (zinsJahr <= 0) return { rate: kredit / monate, gesamt: kredit, zinsen: 0 };
  const q = 1 + zinsJahr / 100 / 12;
  const qn = Math.pow(q, monate);
  const rate = (kredit * qn * (q - 1)) / (qn - 1);
  return { rate, gesamt: rate * monate, zinsen: rate * monate - kredit };
}
/** Zahl aus Eingabe — deutsch (1.500,50) wie englisch (1,500.50). */
const num = (s: string) => { const r = String(s).trim(); const n = Number(/,\d{1,2}$/.test(r) ? r.replace(/\./g, "").replace(",", ".") : r.replace(/,/g, "")); return Number.isFinite(n) ? n : NaN; };

export default function Kreditrechner() {
  const t = useWoerter(WZ_KREDITRECHNER_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/loan-calculator" : "/werkzeuge/kreditrechner";
  const loc = en ? "en-GB" : "de-DE";
  const eur = (n: number) => en ? "€" + n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const eur0 = (n: number) => en ? "€" + Math.round(n).toLocaleString(loc) : Math.round(n).toLocaleString(loc) + " €";
  const pz = (n: number) => n.toLocaleString(loc);

  const [betrag, setBetrag] = useState("15000");
  const [monate, setMonate] = useState("60");
  const [zins, setZins] = useState(t.zinsStart);

  const zahlen = useMemo(() => {
    const k = num(betrag), m = Number(monate), z = num(zins);
    if (!Number.isFinite(k) || !Number.isFinite(m) || !Number.isFinite(z) || k < 100 || m < 6 || z < 0 || z > 30) return null;
    const beworben = annuitaet(k, z, m);
    // Erfahrungswert: Der Zwei-Drittel-Zins liegt bei bonitätsabhängigen Angeboten häufig zwei bis vier Punkte über dem Schaufensterzins.
    const zweiDrittel = annuitaet(k, z + 3, m);
    if (!beworben || !zweiDrittel) return null;
    return { k, m, z, beworben, zweiDrittel, mehr: zweiDrittel.gesamt - beworben.gesamt };
  }, [betrag, monate, zins]);

  const verlauf = useMemo(() => {
    if (!zahlen) return [];
    const { k, z, beworben } = zahlen;
    const zeilen: { monat: number; zinsanteil: number; tilgung: number; rest: number }[] = [];
    let rest = k;
    for (let i = 1; i <= Math.min(12, zahlen.m); i++) {
      const zinsanteil = rest * (z / 100 / 12);
      const tilgung = beworben.rate - zinsanteil;
      rest = Math.max(0, rest - tilgung);
      zeilen.push({ monat: i, zinsanteil, tilgung, rest });
    }
    return zeilen;
  }, [zahlen]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten
        pfad={pfad}
        titel={t.metaTitel}
        beschreibung={t.seoBeschreibung}
        fragen={t.fragen}
        werkzeug={{ name: t.werkzeugName }}
        krumen={[{ name: t.krumeWerkzeuge, pfad: zu("/werkzeuge") }, { name: t.krume, pfad }]}
      />
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
              <p className="wz-nr">{t.angaben}</p><h3>{t.frage}</h3>
              <p className="wz-hinweis">{t.hinweis}</p>
              <div className="wz-felder">
                <label><span>{t.betrag}</span><input inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="15000" /></label>
                <label><span>{t.laufzeit}</span><input inputMode="numeric" value={monate} onChange={(e) => setMonate(e.target.value)} placeholder="60" /></label>
                <label><span>{t.zins}</span><input inputMode="decimal" value={zins} onChange={(e) => setZins(e.target.value)} placeholder={t.zinsStart} /></label>
              </div>
            </div>
          </div>

          {zahlen && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#1d4ed8" }}>{t.beispiel}</span>
              <h3>{t.imMonat(eur(zahlen.beworben.rate), eur0(zahlen.beworben.gesamt))}</h3>
              <p>{t.satz(eur0(zahlen.k), zahlen.m, pz(zahlen.z), eur0(zahlen.beworben.zinsen))}</p>
              <div className="wz-schritt">
                <small>{t.schaufenster}</small>
                <p>{t.zweiDrittelA(pz(zahlen.z + 3), eur(zahlen.zweiDrittel.rate), eur0(zahlen.zweiDrittel.gesamt))}<b>{t.zweiDrittelFett(eur0(zahlen.mehr))}</b>{t.zweiDrittelB}</p>
              </div>
              {verlauf.length > 0 && (
                <div className="wz-tabelle-huelle">
                  <table className="wz-tabelle">
                    <caption>{t.tabelle}</caption>
                    <thead><tr>{t.kopf.map((k) => <th scope="col" key={k}>{k}</th>)}</tr></thead>
                    <tbody>
                      {verlauf.map((v) => (
                        <tr key={v.monat}><td>{v.monat}</td><td>{eur(v.zinsanteil)}</td><td>{eur(v.tilgung)}</td><td>{eur(v.rest)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="wz-knoepfe">
                <Knopf href={zu("/werkzeuge/umschuldung")}>{t.umschuldung}</Knopf>
                <Knopf href="/antrag" still>{t.bonitaetOrdnen}</Knopf>
              </div>
            </div>
          )}

          <h2 className="dk-h2" style={{ marginTop: 56 }}>{t.fragenTitel}</h2>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" />
    </Dunkel>
  );
}
