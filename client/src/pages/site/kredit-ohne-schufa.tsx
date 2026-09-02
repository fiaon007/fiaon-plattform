// ═══════════════════════════════════════════════════════════════════════════
// /kredit-ohne-schufa — der ehrliche Pfeiler zum härtesten Suchwort
// (26.08.2026)
//
// „Kredit ohne Schufa" wird hunderttausendfach gesucht — und die Treffer
// sind fast durchweg Lockangebote. Diese Seite gewinnt nicht, indem sie
// dasselbe verspricht, sondern indem sie als Einzige erklärt, was wirklich
// dahintersteckt: was es gibt, was es kostet, woran man Betrug erkennt —
// und dass der bessere Weg fast immer ist, die Auskunft in Ordnung zu
// bringen, statt sie zu umgehen. YMYL-Seiten gewinnen mit Vertrauen.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /kredit-ohne-schufa und /en/loans-without-schufa;
// Texte im Wörterbuch client/src/i18n/kredit-ohne-schufa.ts.
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten, Schritte } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { KREDIT_OHNE_SCHUFA_WOERTER } from "@/i18n/kredit-ohne-schufa";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function KreditOhneSchufa() {
  const t = useWoerter(KREDIT_OHNE_SCHUFA_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/loans-without-schufa" : "/kredit-ohne-schufa";
  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} artikel={{ ueberschrift: t.artikel, stand: "2026-08-26" }} krumen={[{ name: t.krume, pfad }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/tuer.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>
      <Licht>
        <Block titel={t.gibtTitel} lead={t.gibtLead}><Karten items={t.gibt} /></Block>
        <Block titel={t.betrugTitel} lead={t.betrugLead}><Schritte items={t.betrug} /></Block>
        <Zwischenruf text={<><b>{t.zwischen1A}</b>{t.zwischen1B}</>} knopf={t.zumRechner} href={zu("/werkzeuge/kreditrechner")} />
        <Block titel={t.wegTitel} lead={t.wegLead}>
          <Schritte items={t.weg} />
          <div className="dk-knoepfe" style={{ marginTop: 28 }}>
            <Knopf href={zu("/werkzeuge/eintrag-pruefen")}>{t.eintragPruefen}</Knopf>
            <Knopf href="/antrag" still>{t.fiaonUebernimmt}</Knopf>
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
      <Zwischenruf text={<><b>{t.zwischen2A}</b>{t.zwischen2B}</>} knopf={t.pruefenLassen} href="/antrag" />
    </Dunkel>
  );
}
