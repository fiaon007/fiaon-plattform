// ═══════════════════════════════════════════════════════════════════════════
// /sicherheit — Datenschutz & Sicherheit (23.08.2026)
//
// Was mit den sensibelsten Daten passiert, die es über einen Menschen gibt:
// Hosting, Verschlüsselung, Vollmacht, Freigabe, Löschung, Zahlungen, Rechte.
// Werkzeug: Datenschutz-Check (was darf wer, in 6 Fragen). Ehrlich, konkret.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /sicherheit (Deutsch) und /en/security (Englisch);
// Texte im Wörterbuch client/src/i18n/sicherheit.ts.
import { useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { SICHERHEIT_WOERTER } from "@/i18n/sicherheit";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function Sicherheit() {
  const t = useWoerter(SICHERHEIT_WOERTER);
  const sprache = useSprache();
  const zu = (p: string) => inSprache(p, sprache);
  const [offen, setOffen] = useState<number | null>(null);
  return (
    <Dunkel seite="was-ist-fiaon" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <Hero pille={t.pille} titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
            lead={t.lead}
            knoepfe={<><Knopf href="#check">{t.check}</Knopf><Knopf href="#prinzipien" still>{t.prinzipien}</Knopf></>}
            szene={<Szenenbild src="/kino/datenraum.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={t.zahlen} /></div>
      </section>

      <Block id="prinzipien" pille={t.prinzPille} titel={<>{t.prinzH2a}<span className="dk-verlauf">{t.prinzH2b}</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          {t.prinz.map((k, i) => <Auf key={k.tag} verzoegerung={i * 60}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block pille={t.technikPille} titel={<>{t.technikH2a}<span className="dk-verlauf">{t.technikH2b}</span></>}>
          <Zeilen items={t.technik} />
        </Block>

        <Block id="check" pille={t.checkPille} titel={<>{t.checkH2a}<span className="dk-verlauf">{t.checkH2b}</span></>} lead={t.checkLead} mitte>
          <div className="wz-fragen" style={{ maxWidth: 820, margin: "36px auto 0", textAlign: "left" }}>
            {t.checks.map((c, i) => (
              <button key={c.f} type="button" className={`wz-frage sc-frage${offen === i ? " offen" : ""}`} onClick={() => setOffen(offen === i ? null : i)} aria-expanded={offen === i}>
                <h3>{c.f}</h3>
                {offen === i && <p className="sc-antwort">{c.a}</p>}
              </button>
            ))}
          </div>
        </Block>

        <Block pille={t.rechtePille} titel={<>{t.rechteH2a}<span className="dk-verlauf">{t.rechteH2b}</span></>}>
          <Schritte items={t.rechte} />
        </Block>

        <Block schmal titel={t.weiterlesen}>
          <div className="sx-vertiefen">
            {t.weiter.map((w) => <a key={w.href} href={zu(w.href)}><b>{w.t}</b><span>{w.s}</span></a>)}
          </div>
        </Block>
      </Licht>

      <Licht>
        <Block schmal pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.kontakt} href={zu("/kontakt")} still={{ knopf: t.datenschutz, href: "/datenschutz" }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText} knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href={zu("/plattform-konzept")} still>{t.diePlattform}</Knopf></>} />
    </Dunkel>
  );
}
