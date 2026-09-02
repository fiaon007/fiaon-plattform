// ═══════════════════════════════════════════════════════════════════════════
// /eintrag-verjaehrung — der Pfeiler zur Fristen-Suche (30.08.2026)
//
// Suchintention: „schufa eintrag löschen nach jahren / verjährung“. Kern der
// Seite ist der kleine Verjährungs-Checker: Art des Eintrags + Datum →
// „gespeichert bis voraussichtlich …“. REIN INFORMATIV — er verspricht
// nichts, er rechnet nur die bekannten Fristen nach. Der Unterschied
// zwischen Speicherfrist (Auskunftei) und Verjährung (Forderung) wird
// ausdrücklich erklärt, weil genau diese Verwechslung die Suche prägt.
// JSON-LD: Article + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /eintrag-verjaehrung und /en/entries-and-limitation;
// Texte im Wörterbuch client/src/i18n/eintrag-verjaehrung.ts; der Checker rechnet gleich.
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { EINTRAG_VERJAEHRUNG_WOERTER } from "@/i18n/eintrag-verjaehrung";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

type EintragsArt = "erledigt" | "hundert" | "restschuld" | "anfrage" | "vertrag" | "offen";

function monateDazu(iso: string, monate: number): Date | null {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + monate);
  return d;
}

export default function EintragVerjaehrung() {
  const t = useWoerter(EINTRAG_VERJAEHRUNG_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/entries-and-limitation" : "/eintrag-verjaehrung";
  const alsText = (d: Date) => d.toLocaleDateString(en ? "en-GB" : "de-DE", { day: "2-digit", month: "long", year: "numeric" });
  const [art, setArt] = useState<EintragsArt>("erledigt");
  const [datum, setDatum] = useState<string>("");

  const gewaehlt = t.arten.find((a) => a.wert === art) || t.arten[0];
  const ergebnis = useMemo(() => {
    if (art === "offen") return { satz: t.offenSatz };
    if (art === "vertrag") return { satz: t.vertragSatz };
    if (!datum) return null;
    const monate = art === "erledigt" ? 36 : art === "hundert" ? 18 : art === "restschuld" ? 6 : 12;
    const bis = monateDazu(datum, monate);
    if (!bis) return null;
    const vorbei = bis.getTime() < Date.now();
    return { satz: vorbei ? t.vorbeiSatz(alsText(bis)) : t.bisSatz(alsText(bis), monate), vorbei };
  }, [art, datum, t]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} artikel={{ ueberschrift: t.artikel, stand: "2026-08-30" }} krumen={[{ name: t.krume, pfad }]} />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">{t.antragStarten}</Knopf>
            <Knopf href={zu("/kontakt")} still>{t.kostenlosPruefen}</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        <Block schmal titel={t.checkerTitel} lead={t.checkerLead}>
          <div className="sx-checker" data-fiaon="verjaehrungs-checker">
            <div className="felder">
              <label>
                {t.artLabel}
                <select value={art} onChange={(e) => setArt(e.target.value as EintragsArt)}>
                  {t.arten.map((a) => <option key={a.wert} value={a.wert}>{a.label}</option>)}
                </select>
              </label>
              <label>
                {gewaehlt.datumLabel}
                <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} max="2099-12-31" />
              </label>
            </div>
            {ergebnis && (
              <div className="ergebnis" role="status">
                <b>{ergebnis.satz}</b>
              </div>
            )}
            <p className="klein">{t.checkerKlein}</p>
          </div>
        </Block>

        <Block schmal titel={t.fristenTitel} lead={t.fristenLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.fristenKopf.map((k) => <th key={k} scope="col">{k}</th>)}</tr></thead>
              <tbody>{t.fristen.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </Block>

        <Block titel={t.unterschiedTitel} lead={t.unterschiedLead}>
          <Karten items={t.unterschied} />
        </Block>

        <Block schmal titel={t.wegTitel} lead={t.wegLead}>
          <div className="wz-fragen">
            {t.weg.map((s, i) => (
              <div key={s.titel} className="wz-frage">
                <p className="wz-nr">{t.schritt} {i + 1}</p>
                <h3>{s.titel}</h3>
                <p className="wz-hinweis">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="dk-leise" style={{ marginTop: 18 }}>
            {t.selbstA}<a href={zu("/werkzeuge/loeschfrist")} style={{ color: "#1d4ed8" }}>{t.selbstLink1}</a>{t.selbstB}<a href={zu("/werkzeuge/verjaehrung")} style={{ color: "#1d4ed8" }}>{t.selbstLink2}</a>{t.selbstC}<a href={zu("/schufa-eintrag-loeschen")} style={{ color: "#1d4ed8" }}>{t.selbstLink3}</a>{t.selbstD}
          </p>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.fussA}<a href={zu("/glossar-bonitaet")} style={{ color: "#1d4ed8" }}>{t.fussLink}</a>{t.fussB}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
