// ═══════════════════════════════════════════════════════════════════════════
// /bonitaet-verbessern — der Pfeiler zu Justins Suchwort „Bonität optimieren"
// (26.08.2026)
//
// Die Seite ordnet die Hebel nach WIRKUNG, nicht nach Beliebtheit: Was in
// Wochen wirkt, was Monate braucht, was gar nichts bringt (und trotzdem
// überall empfohlen wird). Der Neunzig-Tage-Plan ist das teilbare Stück —
// und jede Etappe verlinkt das Werkzeug, das sie vorbereitet.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /bonitaet-verbessern und /en/strengthen-your-credit-file;
// Texte im Wörterbuch client/src/i18n/bonitaet-verbessern.ts.
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten, Schritte } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { BONITAET_VERBESSERN_WOERTER } from "@/i18n/bonitaet-verbessern";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function BonitaetVerbessern() {
  const t = useWoerter(BONITAET_VERBESSERN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/strengthen-your-credit-file" : "/bonitaet-verbessern";
  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} artikel={{ ueberschrift: t.artikel, stand: "2026-08-26" }} krumen={[{ name: t.krume, pfad }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/cockpit.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>
      <Licht>
        <Block titel={t.grossTitel} lead={t.grossLead}><Karten items={t.gross} /></Block>
        <Block titel={t.stillTitel} lead={t.stillLead}><Karten items={t.still} /></Block>
        <Zwischenruf text={<><b>{t.zwischen1A}</b>{t.zwischen1B}</>} knopf={t.zumCheck} href={zu("/werkzeuge/schulden-check")} />
        <Block titel={t.planTitel} lead={t.planLead}>
          <Schritte items={t.plan} />
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href={zu("/werkzeuge")}>{t.alleWerkzeuge}</Knopf>
            <Knopf href="/antrag" still>{t.planMachen}</Knopf>
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
      <Zwischenruf text={<><b>{t.zwischen2A}</b>{t.zwischen2B}</>} knopf={t.ordnenLassen} href="/antrag" />
    </Dunkel>
  );
}
