// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/inkassokosten · /en/tools/debt-collection-costs — Inkassokosten-
// Prüfer (23.08.2026, zweisprachig 03.09.2026)
//
// Hauptforderung + geforderte Posten → zulässige Kosten nach § 13e RDG und
// RVG (Anlage 2, Stand 2021), Differenz und fertige Formulierung für die
// Zurückweisung (bleibt deutsch). Texte: client/src/i18n/wz-inkassokosten.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_INKASSOKOSTEN_WOERTER } from "@/i18n/wz-inkassokosten";
import "@/styles/ratgeber.css";
import { betragEingabe } from "@/lib/zahl-eingabe";

// RVG Anlage 2 (Gebührentabelle, seit 1.1.2021): Gegenstandswert bis … → 1,0-Gebühr
const TABELLE: [number, number][] = [[500, 49], [1000, 88], [1500, 127], [2000, 166], [3000, 222], [4000, 278], [5000, 334], [6000, 390], [7000, 446], [8000, 502], [9000, 558], [10000, 614], [13000, 666], [16000, 718], [19000, 770], [22000, 822], [25000, 874], [30000, 955], [35000, 1036], [40000, 1117], [45000, 1198], [50000, 1279]];
const gebuehr10 = (wert: number) => { for (const [bis, g] of TABELLE) if (wert <= bis) return g; return 1279 + Math.ceil((wert - 50000) / 15000) * 110; };
const euroDe = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const zahl = (s: string) => { const n = betragEingabe(s); return Number.isFinite(n) ? n : 0; };

export default function Inkassokosten() {
  const t = useWoerter(WZ_INKASSOKOSTEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/debt-collection-costs" : "/werkzeuge/inkassokosten";
  const euro = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const satzText = (s: number) => en ? s.toFixed(1) : s.toFixed(1).replace(".", ",");

  const [haupt, setHaupt] = useState("");
  const [kosten, setKosten] = useState("");
  const [auslagen, setAuslagen] = useState("");
  const [sonst, setSonst] = useState("");
  const [lage, setLage] = useState<"erstes" | "weiter" | "">("");
  const [kopiert, setKopiert] = useState(false);

  const e = useMemo(() => {
    const h = zahl(haupt); if (!h || !lage) return null;
    const satz = lage === "erstes" ? 0.5 : 0.9;
    let geb = Math.round(gebuehr10(h) * satz * 100) / 100;
    let deckel = "";
    // § 13e Abs. 1 RDG: Bei Hauptforderungen bis 50 Euro ist höchstens eine 0,5-Geschäftsgebühr
    // erstattungsfähig (24,50 Euro nach Tabelle), außer die Sache ist besonders umfangreich.
    if (h <= 50) { const max = Math.round(gebuehr10(h) * 0.5 * 100) / 100; if (geb > max) { geb = max; deckel = t.deckel; } }
    const ausl = Math.min(20, Math.round(geb * 0.2 * 100) / 100);
    const gef = zahl(kosten) + zahl(auslagen) + zahl(sonst);
    const zul = geb + ausl;
    const diff = Math.round((gef - zul) * 100) / 100;
    return { h, satz, geb, ausl, zul, gef, diff, deckel, sonst: zahl(sonst) };
  }, [haupt, kosten, auslagen, sonst, lage, t]);

  // Die Zurückweisung bleibt deutsch — sie geht an ein deutsches Inkassobüro.
  const text = e ? `Die Hauptforderung in Höhe von ${euroDe(e.h)} sowie Inkassokosten in gesetzlich zulässiger Höhe (${e.satz.toFixed(1).replace(".", ",")}-Geschäftsgebühr nach RVG: ${euroDe(e.geb)}, zuzüglich Auslagenpauschale ${euroDe(e.ausl)}) werde ich begleichen. Die darüber hinaus geforderten Kosten in Höhe von ${euroDe(Math.max(0, e.diff))} weise ich zurück; sie übersteigen die nach § 13e RDG in Verbindung mit dem RVG erstattungsfähige Vergütung.${e.sonst ? " Posten wie „Kontoführung“ oder „Adressermittlung“ sind ohne Nachweis nicht erstattungsfähig." : ""} Bitte legen Sie die Berechnung der Gebühren im Einzelnen dar oder bestätigen Sie die Erledigung mit Zahlung des genannten Betrags.` : "";

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} />
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
                <label><span>{t.haupt}</span><input inputMode="decimal" placeholder={t.bspHaupt} value={haupt} onChange={(ev) => setHaupt(ev.target.value)} /></label>
                <label><span>{t.gebuehr}</span><input inputMode="decimal" placeholder={t.bspGebuehr} value={kosten} onChange={(ev) => setKosten(ev.target.value)} /></label>
                <label><span>{t.auslagen}</span><input inputMode="decimal" placeholder={t.bspAuslagen} value={auslagen} onChange={(ev) => setAuslagen(ev.target.value)} /></label>
                <label><span>{t.sonst}</span><input inputMode="decimal" placeholder={t.bspSonst} value={sonst} onChange={(ev) => setSonst(ev.target.value)} /></label>
              </div>
              <p className="wz-hinweis">{t.hinweisZinsen}</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${lage === "erstes" ? " an" : ""}`} onClick={() => setLage("erstes")}><b>{t.lageErstes}</b><small>{t.lageErstesHinweis}</small></button>
                <button type="button" className={`wz-option${lage === "weiter" ? " an" : ""}`} onClick={() => setLage("weiter")}><b>{t.lageWeiter}</b><small>{t.lageWeiterHinweis}</small></button>
              </div>
            </div>
          </div>
          {e && (
            <div className={`wz-ergebnis${e.diff > 5 ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: e.diff > 5 ? "#b91c1c" : "#047857" }}>{e.diff > 5 ? t.ueberhoeht(euro(e.diff)) : t.imRahmen}</span>
              <h3>{e.diff > 5 ? t.titelUeberhoeht(euro(e.zul), euro(e.gef)) : t.titelImRahmen(euro(e.gef), euro(e.zul))}</h3>
              <table className="wz-tabelle"><tbody>
                <tr><td>{t.zeileGebuehr(satzText(e.satz), euro(e.h))}</td><td>{euro(e.geb)}</td></tr>
                <tr><td>{t.zeileAuslagen}</td><td>{euro(e.ausl)}</td></tr>
                <tr><td>{t.zeileSonst}</td><td>{euro(0)}</td></tr>
                <tr className="summe"><td>{t.zeileSumme}</td><td>{euro(e.zul)}</td></tr>
              </tbody></table>
              {e.deckel && <p className="wz-hinweis">{e.deckel}</p>}
              {e.diff > 5 && (
                <>
                  <div className="wz-schritt"><small>{t.formulierung}</small>{t.formulierungHinweis && <p className="wz-hinweis">{t.formulierungHinweis}</p>}<p lang="de">{text}</p></div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch { /* egal */ } }}>{kopiert ? t.kopiert : t.kopieren}</button>
                    <Knopf href={zu("/inkasso-brief-erhalten")} still>{t.regelnDetail}</Knopf>
                  </div>
                </>
              )}
              {e.diff <= 5 && <div className="wz-schritt"><small>{t.naechsterSchritt}</small><p>{t.naechsterSchrittText}</p></div>}
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" />
    </Dunkel>
  );
}
