// ═══════════════════════════════════════════════════════════════════════════
// /auskunfteien — SCHUFA, KSV1870, CRIF im Vergleich (26.08.2026)
//
// Die DACH-Seite, die niemand hat: Wer in Österreich oder der Schweiz lebt
// (oder dorthin zieht), findet zu „KSV Eintrag" und „CRIF Auskunft" fast
// nichts Brauchbares. FIAON arbeitet in allen drei Ländern — diese Seite
// ist der Beweis und der Verteiler auf /oesterreich und /schweiz.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /auskunfteien und /en/credit-bureaus;
// Texte im Wörterbuch client/src/i18n/auskunfteien.ts.
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { AUSKUNFTEIEN_WOERTER } from "@/i18n/auskunfteien";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function Auskunfteien() {
  const t = useWoerter(AUSKUNFTEIEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/credit-bureaus" : "/auskunfteien";
  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} artikel={{ ueberschrift: t.artikel, stand: "2026-08-26" }} krumen={[{ name: t.krume, pfad }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/karte.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>
      <Licht>
        <Block titel={t.systemeTitel} lead={t.systemeLead}><Karten items={t.systeme} /></Block>
        <Block schmal titel={t.vergleichTitel} lead={t.vergleichLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.kopf.map((k, i) => <th key={i} scope="col">{k || "\u00a0"}</th>)}</tr></thead>
              <tbody>{t.zeilen.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </Block>
        <Zwischenruf text={<><b>{t.zwischen1A}</b>{t.zwischen1B}</>} knopf={t.datenkopie} href={zu("/werkzeuge/selbstauskunft")} />
        <Block titel={t.laenderTitel} lead={t.laenderLead}>
          <div className="dk-knoepfe">
            <Knopf href={zu("/oesterreich")}>{t.oesterreich}</Knopf>
            <Knopf href={zu("/schweiz")}>{t.schweiz}</Knopf>
          </div>
        </Block>
        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>{t.fussSatz}</p>
        </Block>
        <Block schmal titel={t.weiterlesen}>
          <div className="sx-vertiefen">
            {t.weiter.map((w) => <a key={w.href} href={zu(w.href)}><b>{w.t}</b><span>{w.s}</span></a>)}
          </div>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischen2A}</b>{t.zwischen2B}</>} knopf={t.pruefungStarten} href="/antrag" />
    </Dunkel>
  );
}
