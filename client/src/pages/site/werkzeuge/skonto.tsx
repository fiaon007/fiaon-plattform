// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/skonto · /en/tools/early-payment-discount
// Skonto-Rechner (09.09.2026, E-099). Texte: client/src/i18n/wz-skonto.ts
//
// FORMEL (genaue Fassung, nicht die Faustformel):
//   Jahreszins = Skontosatz / (100 − Skontosatz) × 360 / (Ziel − Skontofrist)
// Die Division durch (100 − Satz) ist der korrekte Bezug: Der Skontobetrag
// wird auf dem Betrag gespart, den man tatsächlich zahlt — also auf 98 statt
// auf 100 Prozent. Die verbreitete Faustformel „Satz × 360 / Tage" rechnet
// gegen 100 und liegt deshalb systematisch etwas zu niedrig.
// 360 Zinstage: kaufmännische Konvention im deutschen Geschäftsverkehr.
//
// RECHTLICHER RAND (im Text, nicht in der Rechnung):
//   § 271a Abs. 1 BGB — Zahlungsziel über 60 Tage zwischen Unternehmen nur
//   wirksam bei ausdrücklicher Vereinbarung und wenn nicht grob unbillig.
//   § 271a Abs. 2 BGB — öffentliche Auftraggeber: grundsätzlich 30 Tage,
//   über 60 Tage unwirksam.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_SKONTO_WOERTER } from "@/i18n/wz-skonto";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };
const ZINSTAGE = 360;

export default function Skonto() {
  const t = useWoerter(WZ_SKONTO_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/early-payment-discount" : "/werkzeuge/skonto";
  const eur = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const pro = (n: number) => `${n.toLocaleString(en ? "en-GB" : "de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

  const [seite, setSeite] = useState<"zahlen" | "geben">("zahlen");
  const [betrag, setBetrag] = useState("");
  const [satz, setSatz] = useState("");
  const [frist, setFrist] = useState("");
  const [ziel, setZiel] = useState("");
  const [kk, setKk] = useState("");

  const e = useMemo(() => {
    const B = zahl(betrag), S = zahl(satz), F = zahl(frist), Z = zahl(ziel), K = zahl(kk);
    if (B <= 0 || S <= 0 || S >= 100 || Z <= F) return null;
    const tage = Z - F;
    const skonto = (B * S) / 100;
    const zahlbetrag = B - skonto;
    const jahreszins = (S / (100 - S)) * (ZINSTAGE / tage) * 100;
    const unplausibel = tage > 300;
    const lohnt = K > 0 ? jahreszins > K : null;
    return { B, S, tage, skonto, zahlbetrag, jahreszins, K, lohnt, unplausibel };
  }, [betrag, satz, frist, ziel, kk]);

  const stufe = !e ? "" : seite === "geben" ? (e.jahreszins > 15 ? "teuer" : "guenstig") : e.lohnt === false ? "nicht" : "lohnt";
  const farbe = stufe === "teuer" ? "#b45309" : stufe === "nicht" ? "#b45309" : "#047857";
  const stufeText = stufe === "teuer" ? t.stufeTeuer : stufe === "guenstig" ? t.stufeGuenstig : stufe === "nicht" ? t.stufeLohntNicht : t.stufeLohnt;

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
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${seite === "zahlen" ? " an" : ""}`} onClick={() => setSeite("zahlen")}><b>{t.seiteZahlen}</b><small>{t.seiteZahlenHinweis}</small></button>
                <button type="button" className={`wz-option${seite === "geben" ? " an" : ""}`} onClick={() => setSeite("geben")}><b>{t.seiteGeben}</b><small>{t.seiteGebenHinweis}</small></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <div className="wz-felder drei">
                <label><span>{t.betrag}</span><input value={betrag} onChange={(ev) => setBetrag(ev.target.value)} inputMode="decimal" placeholder={t.bspBetrag} /></label>
                <label><span>{t.satz}</span><input value={satz} onChange={(ev) => setSatz(ev.target.value)} inputMode="decimal" placeholder={t.bspSatz} /></label>
                <label><span>{t.frist}</span><input value={frist} onChange={(ev) => setFrist(ev.target.value)} inputMode="numeric" placeholder={t.bspFrist} /></label>
              </div>
              <div className="wz-felder" style={{ marginTop: 12 }}>
                <label><span>{t.ziel}</span><input value={ziel} onChange={(ev) => setZiel(ev.target.value)} inputMode="numeric" placeholder={t.bspZiel} /></label>
              </div>
              <p className="wz-hinweis">{t.hinweis2}</p>
            </div>

            {seite === "zahlen" && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
                <p className="wz-hinweis">{t.hinweis3}</p>
                <div className="wz-felder">
                  <label><span>{t.kk}</span><input value={kk} onChange={(ev) => setKk(ev.target.value)} inputMode="decimal" placeholder={t.bspKk} /></label>
                </div>
              </div>
            )}
          </div>

          {e && (
            <div className={`wz-ergebnis${stufe === "lohnt" || stufe === "guenstig" ? " gut" : ""}`}>
              <span className="wz-stufe" style={{ background: farbe }}>{stufeText}</span>
              <h3>{seite === "geben" ? t.titelGeben(pro(e.jahreszins)) : t.titelZahlen(pro(e.jahreszins))}</h3>
              <p>
                {seite === "geben"
                  ? t.deutungGeben(pro(e.jahreszins))
                  : e.K <= 0
                    ? t.deutungZahlenOhneKk(pro(e.jahreszins))
                    : e.lohnt
                      ? t.deutungZahlenLohnt(pro(e.jahreszins), pro(e.K))
                      : t.deutungZahlenNicht(pro(e.jahreszins), pro(e.K))}
              </p>
              {e.unplausibel && <p className="wz-hinweis">{t.hinweisGrenze}</p>}
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td>{t.ersparnis}</td><td>{eur(e.skonto)}</td></tr>
                  <tr><td>{t.zahlbetrag}</td><td>{eur(e.zahlbetrag)}</td></tr>
                  <tr><td>{t.tageFrueher}</td><td>{e.tage}</td></tr>
                  <tr><td><b>{t.jahreszins}</b></td><td><b>{pro(e.jahreszins)}</b></td></tr>
                </tbody>
              </table></div>
              <div className="wz-schritt"><small>{t.formel}</small><p>{t.formelText}</p></div>
              <div className="wz-schritt"><small>{t.fristTitel}</small><p>{t.fristText}</p></div>
              <div className="wz-knoepfe">
                <Knopf href={zu("/werkzeuge/verzugszinsen")} still>{t.weiterLink}</Knopf>
              </div>
              <div className="wz-schritt"><small>{t.grenze}</small><p>{t.grenzeText}</p></div>
              <div className="wz-schritt"><small>{t.standTitel}</small><p>{t.stand}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>

      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/business")} still={{ knopf: t.weiterLink, href: zu("/werkzeuge/bonitaetsindex") }} />
    </Dunkel>
  );
}
