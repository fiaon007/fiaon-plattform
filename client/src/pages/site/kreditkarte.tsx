// ═══════════════════════════════════════════════════════════════════════════
// /kreditkarte — Kreditkarte trotz Eintrag: der Weg über die Auskunft (23.08.2026)
//
// Pitch-Seite für die Karte (Privatkunden): Bühne mit Kartenbild, Kennzahlen,
// die drei Kartenwege, interaktive Rahmen-Zeitachse, „Was Herausgeber sehen",
// Karten-Check-Einstieg, Fragen, Abschluss. Keine Zusagen — die Bank entscheidet.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /kreditkarte (Deutsch) und /en/credit-card
// (Englisch); Texte im Wörterbuch client/src/i18n/kreditkarte.ts.
import { useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Zeilen, Fragen, Zwischenruf, Abschluss } from "@/components/site/DunkleBuehne";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { KREDITKARTE_WOERTER } from "@/i18n/kreditkarte";
import "@/styles/kreditkarte.css";
import "@/styles/seo-seiten.css";

export default function Kreditkarte() {
  const t = useWoerter(KREDITKARTE_WOERTER);
  const sprache = useSprache();
  const zu = (p: string) => inSprache(p, sprache);
  const [i, setI] = useState(0);
  const ETAPPEN = t.etappen;
  return (
    <Dunkel seite="privatkunden" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <section className="dk-film-hero">
        <video autoPlay muted loop playsInline poster="/kino/karte.jpg" aria-hidden="true"><source src="/kino/karte.mp4" type="video/mp4" /></video>
        <div className="schleier" />
        <div className="dk-rahmen">
          <Auf>
            <span className="dk-pille">{t.pille}</span>
            <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
            <p className="dk-lead">{t.lead}</p>
            <div className="dk-knoepfe"><Knopf href={zu("/werkzeuge/karten-check")}>{t.kartenCheck}</Knopf><Knopf href="#weg" still>{t.wieWaechst}</Knopf></div>
          </Auf>
        </div>
      </section>

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={t.zahlen} /></div>
      </section>

      <Block pille={t.wegePille} titel={<>{t.wegeH2a}<span className="dk-verlauf">{t.wegeH2b}</span></>} lead={t.wegeLead}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          {t.wege.map((w, n) => <Auf key={w.tag} verzoegerung={n * 80}><Glas tag={w.tag} titel={w.titel}>{w.text}</Glas></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block id="weg" pille={t.zeitPille} titel={<>{t.zeitH2a}<span className="dk-verlauf">{t.zeitH2b}</span></>} lead={t.zeitLead}>
          <div className="kk-zeit">
            <div className="kk-punkte">{ETAPPEN.map((e, n) => <button key={e.monat} type="button" className={`kk-punkt${i === n ? " an" : ""}${n < i ? " vorbei" : ""}`} onClick={() => setI(n)}><span>{e.monat}</span><b>{e.titel}</b></button>)}</div>
            <div className="kk-karte" key={i}>
              <small>{ETAPPEN[i].monat}</small>
              <h3>{ETAPPEN[i].titel}</h3>
              <p>{ETAPPEN[i].text}</p>
              <div className="kk-rahmen"><span>{t.typischerRahmen}</span><b>{ETAPPEN[i].rahmen}</b></div>
              <div className="kk-knoepfe"><button type="button" className="dk-knopf still" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>{t.zurueck}</button><button type="button" className="dk-knopf" onClick={() => setI(Math.min(ETAPPEN.length - 1, i + 1))} disabled={i === ETAPPEN.length - 1}>{t.weiter}</button></div>
            </div>
          </div>
        </Block>

        <Block pille={t.sehenPille} titel={<>{t.sehenH2a}<span className="dk-verlauf">{t.sehenH2b}</span></>} lead={t.sehenLead}>
          <Zeilen items={t.sehen} />
          <div className="dk-knoepfe" style={{ marginTop: 26 }}><Knopf href={zu("/werkzeuge/spielraum")}>{t.spielraum}</Knopf><Knopf href={zu("/werkzeuge/eintrag-pruefen")} still>{t.eintragPruefen}</Knopf></div>
        </Block>

        {/* Weiterlesen (30.08.2026): die Themenseiten, die hier anschliessen. */}
        <Block schmal titel={t.weiterlesen}>
          <div className="sx-vertiefen">
            {t.weiterLinks.map((w) => <a key={w.href} href={zu(w.href)}><b>{w.t}</b><span>{w.s}</span></a>)}
          </div>
        </Block>
      </Licht>

      <Block pille={t.ehrlichPille} titel={<>{t.ehrlichH2a}<span className="dk-verlauf">{t.ehrlichH2b}</span></>} mitte>
        <div className="dk-raster" style={{ textAlign: "left", marginTop: 28 }}>
          {t.ehrlich.map((w, n) => <Auf key={w.tag} verzoegerung={n * 80}><Glas tag={w.tag} titel={w.titel}>{w.text}</Glas></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block schmal pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.checkStarten} href={zu("/werkzeuge/karten-check")} still={{ knopf: t.paketeAnsehen, href: zu("/privatkunden") }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText} knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href={zu("/preise")} still>{t.preise}</Knopf></>} />
    </Dunkel>
  );
}
