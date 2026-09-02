// /partner · /en/partners — Geschäftspartner: Banken, Kartenherausgeber, Auskunfteien, Inkasso, Vermittler.
// Zweisprachig 02.09.2026, Texte: client/src/i18n/partner.ts. Wortverbot „Affiliate" beachtet.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenSzene from "@/components/home3d/KartenSzene";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PARTNER_WOERTER } from "@/i18n/partner";

export default function Partner() {
  const t = useWoerter(PARTNER_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/partners" : "/partner";
  return (
    <Dunkel seite="partner" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />
      <Hero
        bild="/kino/partner.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#anfrage">{t.partnerWerden}</Knopf><Knopf href="#fuer-wen" still>{t.fuerWen}</Knopf></>}
        szene={<KartenSzene anzahl={2} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={t.kennzahlen} />
      </Block>

      <Block id="fuer-wen" pille={t.wenPille} titel={<>{t.wenA}<span className="dk-verlauf">{t.wenB}</span></>}>
        <Karten items={t.wen} zwei />
      </Block>

      <Block pille={t.wegPille} titel={<>{t.wegA}<span className="dk-verlauf">{t.wegB}</span></>} lead={t.wegLead}>
        <Schritte items={t.weg} />
      </Block>

      <Zwischenruf text={t.zwischenruf} knopf={t.gespraech} href="#anfrage" still={{ knopf: t.kundenweg, href: zu("/") }} />

      <Block pille={t.erhaltenPille} titel={<>{t.erhaltenA}<span className="dk-verlauf">{t.erhaltenB}</span></>}>
        <Karten items={t.erhalten} zwei />
      </Block>

      <Block pille={t.zusammenPille} titel={<>{t.zusammenA}<span className="dk-verlauf">{t.zusammenB}</span></>}>
        <Schritte items={t.zusammen} />
      </Block>

      <Block pille={t.vermittlerPille} titel={<>{t.vermittlerA}<span className="dk-verlauf">{t.vermittlerB}</span>{t.vermittlerC}</>} schmal>
        <Auf>
          <Glas ruhig>
            <ul className="dk-liste" style={{ marginTop: 0 }}>
              {t.vermittler.map((x) => <li key={x}>{x}</li>)}
            </ul>
            <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href={zu("/karriere")} still>{t.einzelperson}</Knopf></div>
          </Glas>
        </Auf>
      </Block>

      <Block id="anfrage" pille={t.anfragePille} titel={<>{t.anfrageA}<span className="dk-verlauf">{t.anfrageB}</span></>} lead={t.anfrageLead} schmal>
        <Anfrage art="partner" knopf={t.anfrageKnopf} hinweis={t.anfrageHinweis}
                 felder={[
                   { name: "name", label: t.felder.name, pflicht: true },
                   { name: "firma", label: t.felder.firma, pflicht: true },
                   { name: "email", label: t.felder.email, typ: "email", pflicht: true },
                   { name: "telefon", label: t.felder.telefon, typ: "tel" },
                   { name: "rolle", label: t.felder.rolle, pflicht: true, optionen: t.rollen },
                   { name: "land", label: t.felder.land, optionen: t.laender },
                   { name: "text", label: t.felder.text, typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille={t.fragenPille}>
        <Fragen items={t.fragen} />
      </Block>

      <Abschluss
        titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
        text={t.abschlussText}
        knoepfe={<><Knopf href="#anfrage">{t.partnerWerden}</Knopf><Knopf href="/investoren" still>{t.investoren}</Knopf></>}
      />
    </Dunkel>
  );
}
