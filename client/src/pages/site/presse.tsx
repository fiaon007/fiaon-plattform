// /presse · /en/press — FIAON in den Medien. Alles, was ein Journalist in fünf Minuten braucht.
// Zweisprachig 03.09.2026, Texte: client/src/i18n/presse.ts; Preise aus shared/fiaon-pakete.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Zeilen, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import ArasCore from "@/components/home3d/ArasCore";
import KartenSzene from "@/components/home3d/KartenSzene";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PRESSE_WOERTER } from "@/i18n/presse";

export default function Presse() {
  const t = useWoerter(PRESSE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/press" : "/presse";
  const euro = (c: number) => en ? "€" + (c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }) : (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
  const abos = PAKETE.filter((p) => p.abo && p.art === "privat").map((p) => p.preisCents);
  const preise = t.preisSpanne(euro(Math.min(...abos)), euro(Math.max(...abos)));
  const auskunft = t.einmalig(euro(Math.round(SCHUFA_PREIS_EURO * 100)));
  return (
    <Dunkel seite="presse" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />
      <Hero
        bild="/kino/presse.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#anfrage">{t.anfrageStellen}</Knopf><Knopf href="#fakten" still>{t.faktenBlick}</Knopf></>}
      />

      <Block id="fakten" eng>
        <div className="dk-raster zwei">
          <Auf>
            <Glas ruhig tag={t.kurzprofilTag}>
              <p className="dk-text" style={{ fontSize: 16, color: "#e5e7eb" }}>{t.kurzprofil}</p>
            </Glas>
          </Auf>
          <Auf verzoegerung={100}>
            <Glas ruhig tag={t.faktenTag}>
              <Zeilen items={t.fakten(preise, auskunft)} />
            </Glas>
          </Auf>
        </div>
      </Block>

      <Block pille={t.zahlenPille} titel={<>{t.zahlenA}<span className="dk-verlauf">{t.zahlenB}</span></>}>
        <Kennzahlen items={t.kennzahlen} />
      </Block>

      <Block pille={t.geschichtePille} titel={<>{t.geschichteA}<span className="dk-verlauf">{t.geschichteB}</span></>} lead={t.geschichteLead}>
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <div style={{ display: "grid", gap: 16 }}>
            {t.schichten.map((s, i) => <Auf key={s.tag} verzoegerung={i * 100}><Glas tag={s.tag} titel={s.titel}>{s.text}</Glas></Auf>)}
          </div>
          <Auf verzoegerung={150}><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Block eng schmal>
        <Zitat text={t.zitat} wer={t.zitatWer} />
      </Block>

      <Block pille={t.themenPille} titel={<>{t.themenA}<span className="dk-verlauf">{t.themenB}</span></>} lead={t.themenLead}>
        <Karten items={t.themen} zwei />
      </Block>

      <Zwischenruf text={t.zwischenruf} knopf={t.testperson} href="/antrag" still={{ knopf: t.startseite, href: zu("/") }} />

      <Block pille={t.meldungenPille} titel={<>{t.meldungenA}<span className="dk-verlauf">{t.meldungenB}</span></>}>
        <div className="dk-raster zwei">
          {t.meldungen.map((m, i) => <Auf key={m.titel} verzoegerung={i * 100}><Glas ruhig tag={m.tag} titel={m.titel}>{m.text}</Glas></Auf>)}
        </div>
      </Block>

      <Block pille={t.bildPille} titel={<>{t.bildA}<span className="dk-verlauf">{t.bildB}</span></>} lead={t.bildLead}>
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <Auf>
            <Glas ruhig tag={t.wortmarke}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", textAlign: "center" }}><span className="fiaon-gradient-text-animated" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.03em" }}>FIAON</span></div>
                <div style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: "28px 24px", textAlign: "center" }}><span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.03em", color: "#fff" }}>FIAON</span></div>
              </div>
              <p className="dk-leise" style={{ marginTop: 14 }}>{t.wortmarkeHinweis}</p>
            </Glas>
          </Auf>
          <Auf verzoegerung={120}><div className="dk-szene"><KartenSzene anzahl={1} className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Block id="anfrage" pille={t.anfragePille} titel={<>{t.anfrageA}<span className="dk-verlauf">{t.anfrageB}</span></>} lead={t.anfrageLead} schmal>
        <Anfrage art="presse" knopf={t.anfrageKnopf} hinweis={t.anfrageHinweis}
                 felder={[
                   { name: "name", label: t.felder.name, pflicht: true },
                   { name: "firma", label: t.felder.firma, pflicht: true },
                   { name: "email", label: t.felder.email, typ: "email", pflicht: true },
                   { name: "telefon", label: t.felder.telefon, typ: "tel" },
                   { name: "thema", label: t.felder.thema, pflicht: true },
                   { name: "frist", label: t.felder.frist, typ: "date" },
                   { name: "text", label: t.felder.text, typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille={t.fragenPille}>
        <Fragen items={t.fragen} />
      </Block>

      <Abschluss
        titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
        text={t.abschlussText}
        knoepfe={<><Knopf href="#anfrage">{t.anfrageStellen}</Knopf><Knopf href="/investoren" still>{t.investoren}</Knopf></>}
      />
    </Dunkel>
  );
}
