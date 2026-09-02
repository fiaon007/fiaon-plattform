// ═══════════════════════════════════════════════════════════════════════════
// /schufa-eintrag-loeschen · /en/delete-a-schufa-entry — der Pfeiler zum
// Kauf-Suchwort (26.08.2026, zweisprachig 02.09.2026)
//
// „Schufa Eintrag löschen lassen" ist DIE Suche mit Handlungsabsicht in
// diesem Markt. Die Seite beantwortet sie vollständig: welche Einträge
// angreifbar sind, die Fristen als Tabelle, der Weg in vier Schritten —
// und verlinkt auf die drei Werkzeuge, die jeden Schritt kostenlos
// vorbereiten. Texte: client/src/i18n/schufa-eintrag-loeschen.ts.
// HowTo- und FAQ-Markup für die Rich Results.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { SCHUFA_EINTRAG_LOESCHEN_WOERTER } from "@/i18n/schufa-eintrag-loeschen";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function SchufaEintragLoeschen() {
  const t = useWoerter(SCHUFA_EINTRAG_LOESCHEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/delete-a-schufa-entry" : "/schufa-eintrag-loeschen";

  // HowTo-Markup: die vier Schritte, wie sie sichtbar auf der Seite stehen.
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: t.howto,
      step: t.schritte.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten
        pfad={pfad}
        titel={t.seoTitel}
        beschreibung={t.seoBeschreibung}
        fragen={t.fragen}
        artikel={{ ueberschrift: t.artikel, stand: "2026-08-26" }}
        krumen={[{ name: t.krume, pfad }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>
      <Licht>
        <Block titel={t.angreifbarTitel} lead={t.angreifbarLead}>
          <Karten items={t.angreifbar.map((k) => ({ tag: k.tag, titel: k.titel, text: k.text }))} />
        </Block>

        <Block schmal titel={t.fristenTitel} lead={t.fristenLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.fristenKopf.map((k) => <th scope="col" key={k}>{k}</th>)}</tr></thead>
              <tbody>
                {t.fristen.map((z) => <tr key={z[0]}><td>{z[0]}</td><td>{z[1]}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 22 }}>
            <Knopf href="/werkzeuge/loeschfrist">{t.fristBerechnen}</Knopf>
          </div>
        </Block>

        <Block titel={t.wegTitel} lead={t.wegLead}>
          <div className="wz-fragen">
            {t.schritte.map((s, i) => (
              <div className="wz-frage" key={s.name}>
                <p className="wz-nr">{t.schritt} {i + 1}</p>
                <h3>{s.name}</h3>
                <p className="wz-hinweis">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/werkzeuge/selbstauskunft">{t.datenkopie}</Knopf>
            <Knopf href="/werkzeuge/eintrag-pruefen" still>{t.eintragPruefen}</Knopf>
          </div>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>{t.fuss}</p>
        </Block>

        {/* Weiterlesen: die Themenseiten, die hier anschließen. */}
        <Block schmal titel={t.weiterTitel}>
          <div className="sx-vertiefen">
            {t.weiter.map((w) => (
              <a href={zu(w.href)} key={w.href}><b>{w.titel}</b><span>{w.text}</span></a>
            ))}
          </div>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" />
    </Dunkel>
  );
}
