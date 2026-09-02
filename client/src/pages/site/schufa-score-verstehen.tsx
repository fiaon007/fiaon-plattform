// ═══════════════════════════════════════════════════════════════════════════
// /schufa-score-verstehen — der Pfeiler zur Verständnis-Suche
// (30.08.2026; NEU GESCHRIEBEN 02.09.2026 für den neuen SCHUFA-Score, E-081)
//
// ── WARUM NEU ─────────────────────────────────────────────────────────────
// Seit dem 17. März 2026 gibt es den neuen SCHUFA-Score: eine Skala von 100
// bis 999 Punkten, zwölf veröffentlichte Kriterien mit Höchstpunkten, fünf
// Score-Klassen. Er ersetzt den Basisscore (0–100 Prozent) und die sechs
// Branchenscores (Übergangsfrist für Unternehmen bis Ende 2028). Die alte
// Fassung dieser Seite erklärte den Prozentwert und „97,5 %" — auf einer
// YMYL-Seite ein Vertrauensrisiko, sobald der Leser die neue Zahl sieht.
//
// Quellen: schufa.de/scoring-daten/neuer-score/ (Klassen, Anteile,
// Übergangsfrist); schufa.de Kriterienseiten (Höchstpunkte je Kriterium);
// SCHUFA-Pressemitteilung 17.03.2026 (presseportal.de/pm/121716/6235040);
// Verbraucherzentrale, „Neuer Schufa-Score: Die wichtigsten Infos"
// (26.06.2026). Suchintention: „schufa score bedeutung / tabelle / neuer
// score". JSON-LD: Article + FAQPage (SeoDaten).
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /schufa-score-verstehen und /en/schufa-score;
// Texte im Wörterbuch client/src/i18n/schufa-score-verstehen.ts (Zahlen dort belegt).
import { Dunkel, Block, Licht, Knopf, Karten, Fragen, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { SCHUFA_SCORE_WOERTER } from "@/i18n/schufa-score-verstehen";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function SchufaScoreVerstehen() {
  const t = useWoerter(SCHUFA_SCORE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/schufa-score" : "/schufa-score-verstehen";
  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} artikel={{ ueberschrift: t.artikel, stand: "2026-09-02" }} krumen={[{ name: t.krume, pfad }]} />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">{t.antragStarten}</Knopf>
            <Knopf href={zu("/werkzeuge/eintrag-pruefen")} still>{t.eintragPruefen}</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        <Block schmal titel={t.skalaTitel} lead={t.skalaLead}>
          <Auf>
            <div className="sx-skala" aria-hidden="true">
              <div className="sx-skala-band"><span className="sx-skala-zeiger" /></div>
              <div className="sx-skala-marken"><span>100</span><span>642</span><span>709</span><span>776</span><span>999</span></div>
            </div>
            <p className="lesart" style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.65, color: "#475569" }}>{t.skalaText}</p>
          </Auf>
        </Block>

        <Block schmal titel={t.klassenTitel} lead={t.klassenLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.klassenKopf.map((k) => <th key={k} scope="col">{k}</th>)}</tr></thead>
              <tbody>{t.klassen.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>{t.klassenQuelleA}<a href={zu("/schufa-eintrag-loeschen")} style={{ color: "#1d4ed8" }}>{t.klassenQuelleLink}</a>{t.klassenQuelleB}</p>
        </Block>

        <Block schmal titel={t.kriterienTitel} lead={t.kriterienLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.kriterienKopf.map((k) => <th key={k} scope="col">{k}</th>)}</tr></thead>
              <tbody>
                {t.kriterien.map((k) => (
                  <tr key={k.nr}><td><b>{k.nr}. {k.name}</b><br /><span style={{ color: "#475569", fontSize: 13 }}>{k.was}</span></td><td>{k.punkte}</td></tr>
                ))}
                <tr className="summe"><td>{t.summe}</td><td>999</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>{t.kriterienQuelle}</p>
        </Block>

        <Block titel={t.hebelTitel} lead={t.hebelLead}>
          <Karten items={t.hebel} />
        </Block>

        <Block schmal titel={t.fiaonTitel} lead={t.fiaonLead}>
          <div className="wz-fragen">
            {t.schritte.map((s, i) => (
              <div key={s.titel} className="wz-frage">
                <p className="wz-nr">{t.schritt} {i + 1}</p>
                <h3>{s.titel}</h3>
                <p className="wz-hinweis">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href={zu("/bonitaetsauskunft-beantragen")}>{t.soLaeuft}</Knopf>
            <Knopf href={zu("/werkzeuge/selbstauskunft")} still>{t.selbstAnfordern}</Knopf>
          </div>
        </Block>

        <Block schmal titel={t.beispielTitel} lead={t.beispielLead}>
          <Auf>
            <Glas ruhig>
              <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.75 }}>{t.beispiel}</p>
            </Glas>
          </Auf>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.vertiefen}
            {t.vertiefenLinks.map((l, i) => <span key={l.href}><a href={zu(l.href)} style={{ color: "#1d4ed8" }}>{l.t}</a>{i < t.vertiefenLinks.length - 1 ? " · " : ". "}</span>)}
            {t.fussSatz}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
