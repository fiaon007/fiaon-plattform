// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/mahnbescheid · /en/tools/court-payment-order — Fristenrechner für
// Mahnbescheid und Vollstreckungsbescheid (02.09.2026, E-080; zweisprachig
// 03.09.2026, Texte: client/src/i18n/wz-mahnbescheid.ts)
//
// Der gelbe Umschlag vom Amtsgericht ist die eine Stelle im ganzen Weg, an
// der ein Kalender über Jahre entscheidet: Zwei Wochen ab Zustellung für den
// Widerspruch (§ 694 ZPO). Wer sie verpasst, bekommt einen Vollstreckungs-
// bescheid (§ 699 ZPO) – dagegen wieder zwei Wochen Einspruch (§ 700 i. V. m.
// § 339 ZPO). Danach ist die Forderung tituliert: 30 Jahre vollstreckbar
// (§ 197 Abs. 1 Nr. 3 BGB) und meldefähig, egal ob bestritten.
//
// Das Werkzeug rechnet die Fristen taggenau (Zustellung zählt nicht mit,
// § 222 ZPO i. V. m. §§ 187, 188 BGB; endet die Frist an Samstag, Sonntag
// oder Feiertag, gilt der nächste Werktag) und sagt, was auf dem Formular
// anzukreuzen ist. Bundesweite Feiertage sind hinterlegt; Landesfeiertage
// nicht – deshalb der Hinweis, einen Tag Reserve zu lassen.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_MAHNBESCHEID_WOERTER } from "@/i18n/wz-mahnbescheid";
import "@/styles/ratgeber.css";

const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);

/** Bundesweite Feiertage (ohne Landesfeiertage). Ostern nach Gauß. */
function feiertage(jahr: number): Set<string> {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  const ostern = new Date(jahr, monat - 1, tag, 12);
  const plus = (n: number) => { const x = new Date(ostern); x.setDate(x.getDate() + n); return x; };
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return new Set([
    `${jahr}-01-01`, `${jahr}-05-01`, `${jahr}-10-03`, `${jahr}-12-25`, `${jahr}-12-26`,
    iso(plus(-2)), iso(plus(1)), iso(plus(39)), iso(plus(50)),
  ]);
}

function fristEnde(zustellung: Date, tage: number): { ende: Date; verschoben: boolean } {
  const ende = new Date(zustellung); ende.setDate(ende.getDate() + tage);
  let verschoben = false;
  for (let i = 0; i < 10; i++) {
    const wt = ende.getDay(); const iso = ende.toISOString().slice(0, 10);
    if (wt === 0 || wt === 6 || feiertage(ende.getFullYear()).has(iso)) { ende.setDate(ende.getDate() + 1); verschoben = true; } else break;
  }
  return { ende, verschoben };
}

export default function Mahnbescheid() {
  const t = useWoerter(WZ_MAHNBESCHEID_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/court-payment-order" : "/werkzeuge/mahnbescheid";
  const fmt = (d: Date) => d.toLocaleDateString(en ? "en-GB" : "de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const [art, setArt] = useState<"mahn" | "voll" | "">("");
  const [zustellung, setZustellung] = useState("");
  const z = parse(zustellung);
  const heute = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);

  const e = useMemo(() => {
    if (!z || !art) return null;
    const frist = fristEnde(z, 14);
    const rest = Math.round((frist.ende.getTime() - heute.getTime()) / 86_400_000);
    return { frist, rest, abgelaufen: rest < 0 };
  }, [z, art, heute]);

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
                <button type="button" className={`wz-option${art === "mahn" ? " an" : ""}`} onClick={() => setArt("mahn")}><b>{t.mahn}</b><small>{t.mahnHinweis}</small></button>
                <button type="button" className={`wz-option${art === "voll" ? " an" : ""}`} onClick={() => setArt("voll")}><b>{t.voll}</b><small>{t.vollHinweis}</small></button>
              </div>
            </div>
            {art && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
                <p className="wz-hinweis">{t.hinweis2}</p>
                <div className="wz-felder"><label><span>{t.zustelldatum}</span><input type="date" value={zustellung} onChange={(ev) => setZustellung(ev.target.value)} /></label></div>
              </div>
            )}
          </div>
          {e && (
            <div className={`wz-ergebnis${e.abgelaufen ? " alarm" : e.rest <= 3 ? " alarm" : " gut"}`}>
              <span className="wz-stufe" style={{ background: e.abgelaufen ? "#b91c1c" : e.rest <= 3 ? "#b45309" : "#047857" }}>{e.abgelaufen ? t.abgelaufen : e.rest === 0 ? t.heuteLetzter : t.nochTage(e.rest)}</span>
              <h3>{t.spaetestens(art === "mahn" ? t.widerspruch : t.einspruch, fmt(e.frist.ende), e.frist.verschoben)}</h3>
              <p>{t.regel(art === "mahn" ? t.paraMahn : t.paraVoll)}</p>
              {!e.abgelaufen ? (
                <>
                  <div className="wz-schritt"><small>{t.ankreuzen}</small><p>{art === "mahn" ? t.ankreuzenMahn : t.ankreuzenVoll}</p></div>
                  <div className="wz-schritt"><small>{t.danach}</small><p>{t.danachA}<a href={zu("/werkzeuge/verjaehrung")}>{t.danachLink1}</a>{t.danachB}<a href={zu("/werkzeuge/inkassokosten")}>{t.danachLink2}</a>{t.danachC}</p></div>
                </>
              ) : (
                <div className="wz-schritt"><small>{t.jetztNoch}</small><p>{art === "mahn" ? t.jetztMahn : t.jetztVoll}</p></div>
              )}
              <div className="wz-knoepfe">
                <Knopf href={zu("/werkzeuge/verjaehrung")} still>{t.verjaehrungPruefen}</Knopf>
                <Knopf href={zu("/werkzeuge/inkasso-antwort")} still>{t.antwortInkasso}</Knopf>
              </div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.inkassoBrief, href: zu("/inkasso-brief-erhalten") }} />
    </Dunkel>
  );
}
