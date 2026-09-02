// 02.09.2026: zweisprachig — /oesterreich und /en/austria; Texte im Wörterbuch
// client/src/i18n/laender.ts (Block „oesterreich"), Bühne: Wien bei Nacht.
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { LAENDER_WOERTER } from "@/i18n/laender";

export default function Oesterreich() {
  const t = useWoerter(LAENDER_WOERTER).oesterreich;
  const sprache = useSprache();
  const zu = (p: string) => inSprache(p, sprache);
  return (
    <Dunkel seite="privatkunden" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <Hero pille={t.pille} titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
            lead={t.lead}
            knoepfe={<><Knopf href="/antrag">{t.beschaffen}</Knopf><Knopf href={zu("/werkzeuge/selbstauskunft")} still>{t.brief}</Knopf></>}
            szene={<Szenenbild src="/kino/wien.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={t.zahlen} /></div>
      </section>

      <Block pille={t.werPille} titel={<>{t.werH2a}<span className="dk-verlauf">{t.werH2b}</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          {t.stellen.map((s, i) => <Auf key={s.tag} verzoegerung={i * 80}><Glas tag={s.tag} titel={s.titel}>{s.text}</Glas></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block pille={t.rechtePille} titel={<>{t.rechteH2a}<span className="dk-verlauf">{t.rechteH2b}</span></>}>
          <Zeilen items={t.rechte} />
        </Block>
        <Block pille={t.wegPille} titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>}>
          <Schritte items={t.weg} />
        </Block>
      </Licht>

      <Block pille={t.werkzeugePille} titel={<>{t.werkzeugeH2a}<span className="dk-verlauf">{t.werkzeugeH2b}</span></>} mitte>
        <div className="hw-raster">
          {t.werkzeuge.map((w, i) => <Auf key={w.href} verzoegerung={i * 90}><a href={zu(w.href)} className="hw-karte"><span className="hw-tag">{w.tag}</span><h3>{w.titel}</h3><p>{w.text}</p><span className="hw-mehr">{w.mehr}</span></a></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block schmal pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenA}</b>{t.zwischenB}</>} knopf={t.beschaffen} href="/antrag" still={{ knopf: t.anderesLand, href: zu(t.anderesLandHref) }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText} knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href={zu("/preise")} still>{t.preise}</Knopf></>} />
    </Dunkel>
  );
}
