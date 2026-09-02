// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/loeschfrist · /en/tools/deletion-deadline — Löschfrist-Rechner
// (23.08.2026, zweisprachig 02.09.2026)
//
// Art des Eintrags + Daten → taggenaues Löschdatum nach den Verhaltensregeln
// der Auskunfteien, inklusive 100-Tage-Regel (seit 2024). Alles im Browser,
// nichts wird gespeichert. Texte: client/src/i18n/wz-loeschfrist.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_LOESCHFRIST_WOERTER, type LfArt } from "@/i18n/wz-loeschfrist";
import "@/styles/ratgeber.css";

const tage = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const plusMonate = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);

export default function Loeschfrist() {
  const t = useWoerter(WZ_LOESCHFRIST_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/deletion-deadline" : "/werkzeuge/loeschfrist";
  const fmt = (d: Date) => d.toLocaleDateString(en ? "en-GB" : "de-DE", { day: "2-digit", month: "long", year: "numeric" });

  const [art, setArt] = useState<LfArt | "">("");
  const [erledigt, setErledigt] = useState("");
  const [gemeldet, setGemeldet] = useState("");
  const [weitere, setWeitere] = useState<"nein" | "ja" | "">("");
  const heute = useMemo(() => new Date(), []);

  const ergebnis = useMemo(() => {
    if (!art) return null;
    const e = parse(erledigt), m = parse(gemeldet);
    const leer = (titel: string) => ({ titel, datum: null as Date | null, regel: "", schritt: "", link: "", linkText: "" });
    if (art === "offen") return { titel: t.offenTitel, datum: null as Date | null, regel: t.offenRegel, schritt: t.offenSchritt, link: zu("/werkzeuge/eintrag-pruefen"), linkText: t.offenLink };
    if (art === "anfrage") {
      if (!e) return leer(t.bitteAnfrage);
      return { titel: t.loeschungAm(fmt(plusMonate(e, 12))), datum: plusMonate(e, 12), regel: t.anfrageRegel, schritt: t.anfrageSchritt, link: zu("/schufa-score-verstehen"), linkText: t.anfrageLink };
    }
    if (art === "rsb") {
      if (!e) return leer(t.bitteRsb);
      const d = plusMonate(e, 6);
      return { titel: d < heute ? t.haetteSeinMuessen(fmt(d)) : t.loeschungAm(fmt(d)), datum: d, regel: t.rsbRegel, schritt: d < heute ? t.rsbSchrittVorbei : t.rsbSchritt, link: "/ratgeber/eugh-urteile-schufa-2023-was-sie-bedeuten", linkText: t.rsbLink };
    }
    if (!e) return leer(t.bitteErledigt);
    let monate = 36, regel = t.regelDrei;
    let kurz = false;
    if (art === "erledigt" && m && weitere === "nein") {
      const frist = tage(m, e);
      if (frist >= 0 && frist <= 100 && m >= new Date("2024-01-01")) { monate = 18; kurz = true; regel = t.regelKurz(frist); }
      else if (frist > 100) regel += t.regelZuSpaet(frist);
    } else if (art === "erledigt" && m && weitere === "ja") regel += t.regelWeitere;
    const d = plusMonate(e, monate);
    const rest = tage(heute, d);
    return { titel: rest < 0 ? t.haetteSeinMuessen(fmt(d)) : t.loeschungIn(fmt(d), rest), datum: d, regel, kurz, schritt: rest < 0 ? t.schrittVorbei : kurz ? t.schrittKurz : t.schrittRegulaer, link: rest < 0 ? zu("/werkzeuge/selbstauskunft") : "/ratgeber/100-tage-regel-schufa-2024", linkText: rest < 0 ? t.linkVorbei : t.linkRegel };
  }, [art, erledigt, gemeldet, weitere, heute, t, en]);

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
              <div className="wz-optionen">{t.arten.map((a) => <button key={a.wert} type="button" className={`wz-option${art === a.wert ? " an" : ""}`} onClick={() => setArt(a.wert)}><b>{a.label}</b><small>{a.hinweis}</small></button>)}</div>
            </div>
            {art && art !== "offen" && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt2}</p>
                <h3>{art === "anfrage" ? t.datumAnfrage : art === "rsb" ? t.datumRsb : t.datumErledigt}</h3>
                {art !== "anfrage" && art !== "rsb" && <p className="wz-hinweis">{t.hinweisErledigt}</p>}
                <div className="wz-felder"><label><span>{t.datum}</span><input type="date" value={erledigt} onChange={(e) => setErledigt(e.target.value)} max="2099-12-31" /></label></div>
              </div>
            )}
            {art === "erledigt" && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt3}</p><h3>{t.frage3}</h3>
                <p className="wz-hinweis">{t.hinweis3}</p>
                <div className="wz-felder"><label><span>{t.meldedatum}</span><input type="date" value={gemeldet} onChange={(e) => setGemeldet(e.target.value)} /></label></div>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${weitere === "nein" ? " an" : ""}`} onClick={() => setWeitere("nein")}><b>{t.keineWeiteren}</b></button>
                  <button type="button" className={`wz-option${weitere === "ja" ? " an" : ""}`} onClick={() => setWeitere("ja")}><b>{t.weitere}</b></button>
                </div>
              </div>
            )}
          </div>
          {ergebnis && ergebnis.regel && (
            <div className={`wz-ergebnis${ergebnis.datum && ergebnis.datum < heute ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: ergebnis.datum && ergebnis.datum < heute ? "#b91c1c" : (ergebnis as any).kurz ? "#047857" : "#1d4ed8" }}>{ergebnis.datum && ergebnis.datum < heute ? t.stufeUeberschritten : (ergebnis as any).kurz ? t.stufeKurz : t.stufeRegulaer}</span>
              <h3>{ergebnis.titel}</h3>
              <p>{ergebnis.regel}</p>
              <div className="wz-schritt"><small>{t.naechsterSchritt}</small><p>{ergebnis.schritt}</p></div>
              <div className="wz-knoepfe"><Knopf href={ergebnis.link}>{ergebnis.linkText}</Knopf><Knopf href="/antrag" still>{t.fiaonUebernimmt}</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" />
    </Dunkel>
  );
}
