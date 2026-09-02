// ═══════════════════════════════════════════════════════════════════════════
// /ratenzahlung-und-bonitaet · /en/instalments-and-credit-file — der Pfeiler
// zur Raten-Suche (30.08.2026, zweisprachig 02.09.2026)
//
// Suchintention: „raten zahlen schufa auswirkung“. Die Botschaft der Seite
// ist eine einzige, in beide Richtungen: Pünktliche Raten sind der stärkste
// Hebel, den man selbst in der Hand hat — und Rückstände eskalieren in
// bekannten, vorhersehbaren Stufen. Die 12er-Ratenleiste ist dieselbe
// Bildsprache wie in unseren Kunden-Mails. Texte: client/src/i18n/ratenzahlung.ts.
// JSON-LD: Article + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { RATENZAHLUNG_WOERTER } from "@/i18n/ratenzahlung";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function RatenzahlungUndBonitaet() {
  const t = useWoerter(RATENZAHLUNG_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/instalments-and-credit-file" : "/ratenzahlung-und-bonitaet";

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
        {/* Die 12er-Ratenleiste — die Bildsprache unserer Mails. */}
        <Block schmal titel={t.leisteTitel} lead={t.leisteLead}>
          <Auf>
            <div className="sx-raten" role="img" aria-label={t.leisteAria}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div className="sx-rate" key={i}>
                  <span className="balken" style={{ ["--v" as any]: `${0.15 + i * 0.12}s` }} />
                  <small>{i + 1}</small>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.65, color: "#475569", maxWidth: "68ch" }}>{t.leisteText}</p>
          </Auf>
        </Block>

        {/* Die Eskalationstreppe. */}
        <Block schmal titel={t.treppeTitel} lead={t.treppeLead}>
          <Auf>
            <div className="sx-treppe">
              {t.stufen.map((s, i) => (
                <div className={`sx-stufe s${i + 1}`} key={s.titel}>
                  <span>{s.zeit}</span>
                  <b>{s.titel}</b>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </Auf>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            {t.treppeA}<a href={zu("/inkasso-brief-erhalten")} style={{ color: "#1d4ed8" }}>{t.treppeLink1}</a>{t.treppeB}
            <a href={zu("/eintrag-verjaehrung")} style={{ color: "#1d4ed8" }}>{t.treppeLink2}</a>{t.treppeC}
          </p>
        </Block>

        <Block titel={t.tippsTitel} lead={t.tippsLead}>
          <Karten items={t.tipps.map((k) => ({ tag: k.tag, titel: k.titel, text: k.text }))} />
        </Block>

        <Block schmal mitte titel={t.kalenderTitel} lead={t.kalenderLead}>
          <Auf>
            <Glas ruhig>
              <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>{t.kalenderText}</p>
              <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 18 }}>
                <Knopf href={zu("/preise")}>{t.paketeAnsehen}</Knopf>
                <Knopf href="/werkzeuge/spielraum" still>{t.spielraum}</Knopf>
              </div>
            </Glas>
          </Auf>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.vertiefen}
            {t.vertiefenLinks.map((l, i) => (
              <span key={l.href}>{i > 0 && " · "}<a href={zu(l.href)} style={{ color: "#1d4ed8" }}>{l.t}</a></span>
            ))}
            . {t.fussSatz}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
