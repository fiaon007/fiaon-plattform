// ═══════════════════════════════════════════════════════════════════════════
// /schufa-neutral-anfragen · /en/schufa-neutral-enquiries — der Pfeiler zur
// Anfrage-Suche (30.08.2026, zweisprachig 02.09.2026)
//
// Suchintention: „kreditanfrage schufa neutral“. Der ganze Unterschied liegt
// in zwei Wörtern auf dem Bankformular: „Anfrage Kredit“ gegen „Anfrage
// Kreditkonditionen". Die Gegenüberstellung mit Umschalter macht ihn
// fühlbar — zwei Glas-Karten, eine leuchtet. Texte: client/src/i18n/schufa-neutral-anfragen.ts.
// JSON-LD: Article + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { SCHUFA_NEUTRAL_WOERTER } from "@/i18n/schufa-neutral-anfragen";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const LISTE: React.CSSProperties = { margin: 0, padding: "0 0 0 18px", display: "grid", gap: 8, fontSize: 14, lineHeight: 1.6, color: "#334155" };

function Punkte({ zeilen }: { zeilen: [string, string, string][] }) {
  return (
    <ul style={LISTE}>
      {zeilen.map(([a, fett, b], i) => (
        <li key={i}>{a}{fett && <b>{fett}</b>}{b}</li>
      ))}
    </ul>
  );
}

export default function SchufaNeutralAnfragen() {
  const t = useWoerter(SCHUFA_NEUTRAL_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/schufa-neutral-enquiries" : "/schufa-neutral-anfragen";
  const [seite, setSeite] = useState<"konditionen" | "kredit">("konditionen");

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten
        pfad={pfad}
        titel={t.seoTitel}
        beschreibung={t.seoBeschreibung}
        fragen={t.fragen}
        artikel={{ ueberschrift: t.artikel, stand: "2026-08-30" }}
        krumen={[{ name: t.krume, pfad }]}
      />

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
        {/* Die Gegenüberstellung mit Umschalter. */}
        <Block schmal titel={t.vergleichTitel} lead={t.vergleichLead}>
          <div style={{ textAlign: "center" }}>
            <div className="sx-umschalter" role="tablist" aria-label={t.umschalterAria}>
              <button type="button" role="tab" aria-selected={seite === "konditionen"} className={seite === "konditionen" ? "an" : ""} onClick={() => setSeite("konditionen")}>{t.tabKonditionen}</button>
              <button type="button" role="tab" aria-selected={seite === "kredit"} className={seite === "kredit" ? "an" : ""} onClick={() => setSeite("kredit")}>{t.tabKredit}</button>
            </div>
          </div>
          <div className="sx-vergleich">
            <Glas className={seite === "konditionen" ? "an" : "matt"} tag={t.konditionenTag} titel={t.konditionenTitel}>
              <Punkte zeilen={t.konditionen} />
            </Glas>
            <Glas className={seite === "kredit" ? "an" : "matt"} tag={t.kreditTag} titel={t.kreditTitel}>
              <Punkte zeilen={t.kredit} />
            </Glas>
          </div>
          <p className="dk-leise" style={{ marginTop: 16 }}>{t.merkzettel}</p>
        </Block>

        <Block schmal titel={t.schritteTitel} lead={t.schritteLead}>
          <div className="wz-fragen">
            {t.schritte.map((s) => (
              <div className="wz-frage" key={s.nr}>
                <p className="wz-nr">{s.nr}</p>
                <h3>{s.titel}</h3>
                <p className="wz-hinweis">{s.text}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block schmal titel={t.wirkungTitel} lead={t.wirkungLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.tabelleKopf.map((k, i) => <th scope="col" key={i}>{k || " "}</th>)}</tr></thead>
              <tbody>
                {t.tabelle.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <Auf>
            <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.7, color: "#475569", maxWidth: "68ch" }}>{t.logik}</p>
          </Auf>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            {t.weiterA}<a href={zu("/schufa-score-verstehen")} style={{ color: "#1d4ed8" }}>{t.weiterLink1}</a>{t.weiterB}
            <a href={zu("/ratenzahlung-und-bonitaet")} style={{ color: "#1d4ed8" }}>{t.weiterLink2}</a>{t.weiterC}
            <a href="/werkzeuge/kreditrechner" style={{ color: "#1d4ed8" }}>{t.weiterLink3}</a>{t.weiterD}
          </p>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.fussA}<a href={zu("/bonitaetsauskunft-beantragen")} style={{ color: "#1d4ed8" }}>{t.fussLink}</a>{t.fussB}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
