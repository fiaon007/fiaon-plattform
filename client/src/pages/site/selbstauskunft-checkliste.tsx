// ═══════════════════════════════════════════════════════════════════════════
// /selbstauskunft-checkliste · /en/reading-your-credit-report — der Pfeiler
// zum Lese-Suchwort (30.08.2026, zweisprachig 02.09.2026)
//
// Suchintention: „selbstauskunft lesen / verstehen“. Kern der Seite ist die
// interaktive 10-Punkte-Checkliste (Stand bleibt im localStorage — wer
// morgen weiterliest, findet seine Haken wieder; ein Speicher für beide
// Sprachen, weil die Punkte dieselben sind) und ein annotierter
// Muster-Ausschnitt aus CSS statt Bild. Texte: client/src/i18n/selbstauskunft-checkliste.ts.
// JSON-LD: HowTo + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { SELBSTAUSKUNFT_CHECKLISTE_WOERTER } from "@/i18n/selbstauskunft-checkliste";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const SPEICHER = "fiaon_selbstauskunft_checkliste";
const ANZAHL = SELBSTAUSKUNFT_CHECKLISTE_WOERTER.de.punkte.length;

export default function SelbstauskunftCheckliste() {
  const t = useWoerter(SELBSTAUSKUNFT_CHECKLISTE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/reading-your-credit-report" : "/selbstauskunft-checkliste";

  // Haken oben (Rules of Hooks): die Checkliste lebt im localStorage.
  const [haken, setHaken] = useState<boolean[]>(() => {
    try {
      const roh = JSON.parse(localStorage.getItem(SPEICHER) || "[]");
      return Array.from({ length: ANZAHL }, (_, i) => roh[i] === true);
    } catch { return Array.from({ length: ANZAHL }, () => false); }
  });

  useEffect(() => {
    try { localStorage.setItem(SPEICHER, JSON.stringify(haken)); } catch { /* privates Fenster — dann eben ohne Merken */ }
  }, [haken]);

  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: t.howto,
      step: t.punkte.map((p, i) => ({ "@type": "HowToStep", position: i + 1, name: p.titel, text: p.text })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t]);

  const erledigt = haken.filter(Boolean).length;

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten
        pfad={pfad}
        titel={t.seoTitel}
        beschreibung={t.seoBeschreibung}
        fragen={t.fragen}
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
        {/* Die interaktive Checkliste. */}
        <Block schmal titel={t.listeTitel} lead={t.listeLead}>
          <div className="sx-liste" data-fiaon="selbstauskunft-checkliste">
            {t.punkte.map((p, i) => (
              <button
                key={p.titel} type="button"
                className={`sx-punkt${haken[i] ? " ab" : ""}`}
                aria-pressed={haken[i]}
                onClick={() => setHaken((alt) => alt.map((h, j) => (j === i ? !h : h)))}
              >
                <span className="kasten" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <span>
                  <b>{i + 1}. {p.titel}</b>
                  <p>{p.text}</p>
                </span>
              </button>
            ))}
          </div>
          <p className="sx-liste-stand" role="status">
            {t.stand(erledigt, ANZAHL)}{erledigt === ANZAHL ? t.standVoll : "."}
          </p>
          <p className="dk-leise" style={{ marginTop: 10 }}>
            {t.ohneA}<a href="/werkzeuge/selbstauskunft" style={{ color: "#1d4ed8" }}>{t.ohneLink}</a>{t.ohneB}
          </p>
        </Block>

        <Block titel={t.fehlerTitel} lead={t.fehlerLead}>
          <Karten items={t.fehler.map((f) => ({ tag: f.tag, titel: f.titel, text: f.text }))} />
        </Block>

        {/* Der annotierte Muster-Ausschnitt — CSS statt Bild. */}
        <Block schmal titel={t.musterTitel} lead={t.musterLead}>
          <div className="sx-muster" data-fiaon="muster-ausschnitt">
            <div className="kopfzeile">{t.musterKopf}</div>
            <div className="zeilen">
              {t.muster.map((z) => (
                <div className="zeile" key={z.code}>
                  <code>{z.code}</code>
                  <span className={`marke ${z.marke}`}>{z.markeText}</span>
                  <p>{z.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Block>

        <Block schmal titel={t.pruefenTitel} lead={t.pruefenLead}>
          <div className="wz-fragen">
            {t.pruefen.map((s) => (
              <div className="wz-frage" key={s.nr}>
                <p className="wz-nr">{s.nr}</p>
                <h3>{s.titel}</h3>
                <p className="wz-hinweis">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href={zu("/bonitaetsauskunft-beantragen")}>{t.zurAuskunft}</Knopf>
            <Knopf href={zu("/schufa-score-verstehen")} still>{t.erstScore}</Knopf>
          </div>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.fussA}<a href={zu("/glossar-bonitaet")} style={{ color: "#1d4ed8" }}>{t.fussLink1}</a>{t.fussB}
            <a href={zu("/auskunfteien")} style={{ color: "#1d4ed8" }}>{t.fussLink2}</a>{t.fussC}
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
