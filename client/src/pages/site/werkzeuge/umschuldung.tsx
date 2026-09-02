// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/umschuldung · /en/tools/debt-consolidation — Umschuldungsrechner
// (26.08.2026, zweisprachig 02.09.2026)
//
// Bis zu vier bestehende Kredite (plus Dispo) → was kostet das Weiterlaufen,
// was kostet die Zusammenlegung, wo liegt die Ersparnis. Der Dispo hat ein
// eigenes Feld: der teuerste Kredit der meisten Haushalte taucht in keiner
// Kreditliste auf. Texte: client/src/i18n/wz-umschuldung.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_UMSCHULDUNG_WOERTER } from "@/i18n/wz-umschuldung";
import "@/styles/ratgeber.css";
import { betragEingabe } from "@/lib/zahl-eingabe";

/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const num = (s: string) => { const n = betragEingabe(s); return Number.isFinite(n) ? n : 0; };

function annuitaet(kredit: number, zinsJahr: number, monate: number) {
  if (kredit <= 0 || monate <= 0) return { rate: 0, gesamt: 0, zinsen: 0 };
  if (zinsJahr <= 0) return { rate: kredit / monate, gesamt: kredit, zinsen: 0 };
  const q = 1 + zinsJahr / 100 / 12;
  const qn = Math.pow(q, monate);
  const rate = (kredit * qn * (q - 1)) / (qn - 1);
  return { rate, gesamt: rate * monate, zinsen: rate * monate - kredit };
}

interface AlterKredit { rest: string; rate: string; zins: string }
const LEER: AlterKredit = { rest: "", rate: "", zins: "" };

export default function Umschuldung() {
  const t = useWoerter(WZ_UMSCHULDUNG_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/debt-consolidation" : "/werkzeuge/umschuldung";
  const loc = en ? "en-GB" : "de-DE";
  const eur = (n: number) => en ? "€" + n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const eur0 = (n: number) => en ? "€" + Math.round(n).toLocaleString(loc) : Math.round(n).toLocaleString(loc) + " €";

  const [kredite, setKredite] = useState<AlterKredit[]>([{ ...LEER }, { ...LEER }]);
  const [dispo, setDispo] = useState("");
  const [dispoZins, setDispoZins] = useState(t.dispoZinsStart);
  const [neuZins, setNeuZins] = useState(t.neuZinsStart);
  const [neuMonate, setNeuMonate] = useState("60");

  const setzen = (i: number, feld: keyof AlterKredit, wert: string) =>
    setKredite((ks) => ks.map((k, j) => (j === i ? { ...k, [feld]: wert } : k)));

  const zahlen = useMemo(() => {
    const alte = kredite.map((k) => ({ rest: num(k.rest), rate: num(k.rate), zins: num(k.zins) })).filter((k) => k.rest > 0 && k.rate > 0);
    const dispoBetrag = num(dispo);
    const dz = num(dispoZins);
    const gesamtRest = alte.reduce((s, k) => s + k.rest, 0) + dispoBetrag;
    if (gesamtRest < 500) return null;
    // Weiterlaufen: Restlaufzeit je Altkredit aus Rest, Rate und Zins; der Dispo läuft rechnerisch drei Jahre weiter.
    let alteKosten = 0, alteRate = 0;
    for (const k of alte) {
      const mz = k.zins / 100 / 12;
      const zinsMonat = k.rest * mz;
      if (k.rate <= zinsMonat) { alteKosten += k.rest * 3; alteRate += k.rate; continue; }
      const n = mz > 0 ? Math.log(k.rate / (k.rate - k.rest * mz)) / Math.log(1 + mz) : k.rest / k.rate;
      alteKosten += k.rate * n;
      alteRate += k.rate;
    }
    const dispoKosten = dispoBetrag > 0 ? dispoBetrag + dispoBetrag * (dz / 100) * 3 : 0;
    const nz = num(neuZins);
    const nm = Math.max(6, Math.min(120, num(neuMonate)));
    const neu = annuitaet(gesamtRest, nz, nm);
    const vorfaelligkeit = alte.reduce((s, k) => s + k.rest, 0) * 0.01;
    const ersparnis = alteKosten + dispoKosten - (neu.gesamt + vorfaelligkeit);
    return { gesamtRest, alteKosten: alteKosten + dispoKosten, alteRate, dispoBetrag, neu, nm, nz, vorfaelligkeit, ersparnis };
  }, [kredite, dispo, dispoZins, neuZins, neuMonate]);

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
              {kredite.map((k, i) => (
                <div className="wz-felder" key={i}>
                  <label><span>{t.rest(i + 1)}</span><input inputMode="decimal" value={k.rest} onChange={(e) => setzen(i, "rest", e.target.value)} placeholder={t.bspRest} /></label>
                  <label><span>{t.rate}</span><input inputMode="decimal" value={k.rate} onChange={(e) => setzen(i, "rate", e.target.value)} placeholder={t.bspRate} /></label>
                  <label><span>{t.zins}</span><input inputMode="decimal" value={k.zins} onChange={(e) => setzen(i, "zins", e.target.value)} placeholder={t.bspZins} /></label>
                </div>
              ))}
              {kredite.length < 4 && (
                <button type="button" className="wz-option" style={{ marginTop: 10 }} onClick={() => setKredite((ks) => [...ks, { ...LEER }])}><b>{t.weiterer}</b></button>
              )}
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <div className="wz-felder">
                <label><span>{t.dispo}</span><input inputMode="decimal" value={dispo} onChange={(e) => setDispo(e.target.value)} placeholder={t.bspDispo} /></label>
                <label><span>{t.dispoZins}</span><input inputMode="decimal" value={dispoZins} onChange={(e) => setDispoZins(e.target.value)} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
              <div className="wz-felder">
                <label><span>{t.neuZins}</span><input inputMode="decimal" value={neuZins} onChange={(e) => setNeuZins(e.target.value)} /></label>
                <label><span>{t.laufzeit}</span><input inputMode="numeric" value={neuMonate} onChange={(e) => setNeuMonate(e.target.value)} /></label>
              </div>
            </div>
          </div>

          {zahlen && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: zahlen.ersparnis > 0 ? "#047857" : "#b91c1c" }}>{zahlen.ersparnis > 0 ? t.ersparnis(eur0(zahlen.ersparnis)) : t.lohntNicht}</span>
              <h3>{zahlen.ersparnis > 0 ? t.titelSpart(eur0(zahlen.ersparnis)) : t.titelWeiter}</h3>
              <p>
                {t.weiterA}<b>{eur0(zahlen.alteKosten)}</b>{zahlen.dispoBetrag > 0 && t.weiterDispo}
                {t.neuA(eur0(zahlen.gesamtRest), zahlen.nm, zahlen.nz.toLocaleString(loc))}<b>{eur0(zahlen.neu.gesamt + zahlen.vorfaelligkeit)}</b>
                {t.neuB(eur0(zahlen.vorfaelligkeit))}<b>{eur(zahlen.neu.rate)}</b>{t.neuC(eur(zahlen.alteRate))}{zahlen.dispoBetrag > 0 && t.plusDispo}{t.punkt}
              </p>
              <div className="wz-schritt">
                <small>{t.naechsterSchritt}</small>
                <p>{zahlen.ersparnis > 0 ? t.schrittSpart : t.schrittWeiter}</p>
              </div>
              <div className="wz-knoepfe">
                <Knopf href={zu("/werkzeuge/eintrag-pruefen")}>{t.pruefen}</Knopf>
                <Knopf href="/antrag" still>{t.fiaonUebernimmt}</Knopf>
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
