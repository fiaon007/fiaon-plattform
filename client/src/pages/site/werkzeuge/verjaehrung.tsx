// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/verjaehrung · /en/tools/limitation-check — Verjährungs-Rechner
// (23.08.2026, zweisprachig 02.09.2026)
//
// Fälligkeit, Titel, letzte Anerkennung → Verjährungsdatum nach §§ 195, 199,
// 197, 212 BGB, Stand heute, und die Formulierung für die Einrede (bleibt
// deutsch, weil der Empfänger deutsch liest). Texte: client/src/i18n/wz-verjaehrung.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_VERJAEHRUNG_WOERTER } from "@/i18n/wz-verjaehrung";
import "@/styles/ratgeber.css";

const fmtDe = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);
const jahresende = (d: Date, plusJahre: number) => new Date(d.getFullYear() + plusJahre, 11, 31, 23, 59, 59);

export default function Verjaehrung() {
  const t = useWoerter(WZ_VERJAEHRUNG_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/limitation-check" : "/werkzeuge/verjaehrung";
  const fmt = (d: Date) => d.toLocaleDateString(en ? "en-GB" : "de-DE", { day: "2-digit", month: "long", year: "numeric" });

  const [faellig, setFaellig] = useState("");
  const [titel, setTitel] = useState<"nein" | "ja" | "">("");
  const [anerkannt, setAnerkannt] = useState("");
  const [gehemmt, setGehemmt] = useState<"nein" | "ja" | "">("");
  const [kopiert, setKopiert] = useState(false);
  const heute = useMemo(() => new Date(), []);

  const e = useMemo(() => {
    const f = parse(faellig); if (!f || !titel) return null;
    const a = parse(anerkannt);
    if (titel === "ja") {
      const d = new Date(f); d.setFullYear(d.getFullYear() + 30);
      return { datum: d, verjaehrt: d < heute, art: "tituliert", regel: t.regelTitel, hinweis: "" };
    }
    let start = f; let grund = t.regelDrei;
    if (a && a > f) { start = a; grund += t.regelAnerkannt(fmt(a)); }
    const d = jahresende(start, 3);
    const hinweis = gehemmt === "ja" ? t.hinweisGehemmt : "";
    return { datum: d, verjaehrt: d < heute && gehemmt !== "ja", art: "regel", regel: grund, hinweis };
  }, [faellig, titel, anerkannt, gehemmt, heute, t, en]);

  // Die Einrede bleibt deutsch — sie geht an einen deutschsprachigen Gläubiger.
  const text = e ? t.einrede(fmtDe(e.datum)) : "";

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
              <p className="wz-hinweis">{t.hinweis1}</p>
              <div className="wz-felder"><label><span>{t.faelligkeit}</span><input type="date" value={faellig} onChange={(ev) => setFaellig(ev.target.value)} /></label></div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${titel === "nein" ? " an" : ""}`} onClick={() => setTitel("nein")}><b>{t.titelNein}</b></button>
                <button type="button" className={`wz-option${titel === "ja" ? " an" : ""}`} onClick={() => setTitel("ja")}><b>{t.titelJa}</b><small>{t.titelJaHinweis}</small></button>
              </div>
            </div>
            {titel === "nein" && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
                <p className="wz-hinweis">{t.hinweis3}</p>
                <div className="wz-felder"><label><span>{t.anerkennung}</span><input type="date" value={anerkannt} onChange={(ev) => setAnerkannt(ev.target.value)} /></label></div>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${gehemmt === "nein" ? " an" : ""}`} onClick={() => setGehemmt("nein")}><b>{t.gehemmtNein}</b></button>
                  <button type="button" className={`wz-option${gehemmt === "ja" ? " an" : ""}`} onClick={() => setGehemmt("ja")}><b>{t.gehemmtJa}</b><small>{t.gehemmtJaHinweis}</small></button>
                </div>
              </div>
            )}
          </div>
          {e && (titel === "ja" || gehemmt) && (
            <div className={`wz-ergebnis${e.verjaehrt ? " gut" : ""}`}>
              <span className="wz-stufe" style={{ background: e.verjaehrt ? "#047857" : e.hinweis ? "#b45309" : "#1d4ed8" }}>{e.verjaehrt ? t.stufeVerjaehrt : e.hinweis ? t.stufePruefung : t.stufeNicht}</span>
              <h3>{e.verjaehrt ? t.verjaehrtSeit(fmt(e.datum)) : t.verjaehrungAm(fmt(e.datum), !!e.hinweis)}</h3>
              <p>{e.regel}</p>
              {e.hinweis && <p className="wz-hinweis">{e.hinweis}</p>}
              {e.verjaehrt ? (
                <>
                  <div className="wz-schritt"><small>{t.wichtig}</small><p>{t.wichtigText}</p></div>
                  <div className="wz-schritt"><small>{t.formulierung}</small>{t.formulierungHinweis && <p className="wz-hinweis">{t.formulierungHinweis}</p>}<p lang="de">{text}</p></div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch { /* egal */ } }}>{kopiert ? t.kopiert : t.kopieren}</button>
                    <Knopf href={zu("/inkasso-brief-erhalten")} still>{t.inkassoWasTun}</Knopf>
                  </div>
                </>
              ) : (
                <div className="wz-schritt"><small>{t.naechsterSchritt}</small><p>{t.naechsterSchrittText}</p></div>
              )}
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" />
    </Dunkel>
  );
}
