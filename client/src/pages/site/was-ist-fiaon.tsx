// /was-ist-fiaon — die Vision, genau erklärt. Zwölf Blöcke, cinematisch, auf der dunklen Bühne.
// Quelle der Inhalte: 05_Vision/VISION.md (der eine Satz, drei Schichten, Markt, Nordstern).
// 02.09.2026: zweisprachig — /was-ist-fiaon (Deutsch) und /en/what-is-fiaon (Englisch);
// alle Texte im Wörterbuch client/src/i18n/was-ist-fiaon.ts, Sprache aus der Adresse.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Szenenbild } from "@/components/site/DunkleBuehne";
import { Team } from "@/components/site/Team";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import ArasCore from "@/components/home3d/ArasCore";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import KartenSzene from "@/components/home3d/KartenSzene";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WAS_IST_FIAON_WOERTER } from "@/i18n/was-ist-fiaon";

export default function WasIstFiaon() {
  const t = useWoerter(WAS_IST_FIAON_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  return (
    <Dunkel seite="was-ist-fiaon" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      {/* 1 · Hero */}
      <Hero
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href="#schichten" still>{t.dreiSchichten}</Knopf></>}
        szene={<NeuralSphere variant="hero" className="absolute inset-0" />}
        bild="/kino/hero.jpg"
      />

      {/* 2 · Die Idee */}
      <Block pille={t.ideePille} titel={<>{t.ideeH2a}<span className="dk-verlauf">{t.ideeH2b}</span></>} lead={t.ideeLead} mitte>
        <div className="dk-raster" style={{ textAlign: "left" }}>
          {t.schichten.map((k, i) => <Auf key={k.tag} verzoegerung={i * 90}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
        </div>
      </Block>

      {/* 3 · Warum es FIAON gibt */}
      <Block pille={t.warumPille} titel={<>{t.warumH2a}<span className="dk-verlauf">{t.warumH2b}</span></>} lead={t.warumLead}>
        <Karten items={t.markt} />
        <Auf><p className="dk-lead" style={{ marginTop: 40, color: "#e5e7eb" }}>{t.platzA}<span className="dk-verlauf">{t.platzB}</span></p></Auf>
      </Block>

      <Szenenbild src="/kino/akten.jpg" titel={<>{t.szene1a}<span className="dk-verlauf">{t.szene1b}</span></>} text={t.szene1Text} />

      {/* 4 · Schicht 1: Einsicht */}
      <Block id="schichten" pille={t.s1Pille} titel={<>{t.s1H2a}<span className="dk-verlauf">{t.s1H2b}</span></>} lead={t.s1Lead}>
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <Auf><div className="dk-szene gross"><SchichtenSzene namen={["SCHUFA", "KSV", "CRIF"]} className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 18 }}>
            {t.s1Karten.map((k, i) => <Auf key={k.tag} verzoegerung={i * 100}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
          </div>
        </div>
        <Kennzahlen items={t.s1Zahlen} />
      </Block>

      {/* 5 · Schicht 2: Aktion */}
      <Block pille={t.s2Pille} titel={<>{t.s2H2a}<span className="dk-verlauf">{t.s2H2b}</span></>} lead={t.s2Lead}>
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <div style={{ display: "grid", gap: 18 }}>
            {t.s2Karten.map((k, i) => <Auf key={k.tag} verzoegerung={i * 100}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
          </div>
          <Auf verzoegerung={150}><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Szenenbild tief src="/kino/tuer.jpg" titel={<>{t.szene2a}<span className="dk-verlauf">{t.szene2b}</span></>} text={t.szene2Text} />

      {/* 6 · Schicht 3: Zugang */}
      <Block pille={t.s3Pille} titel={<>{t.s3H2a}<span className="dk-verlauf">{t.s3H2b}</span></>} lead={t.s3Lead}>
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <Auf><div className="dk-szene gross"><KartenSzene anzahl={1} className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 18 }}>
            {t.s3Karten.map((k, i) => <Auf key={k.tag} verzoegerung={i * 100}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
          </div>
        </div>
      </Block>

      {/* 7 · Der Weg eines Kunden */}
      <Block pille={t.wegPille} titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>} mitte>
        <div style={{ textAlign: "left" }}><Schritte items={t.weg} /></div>
      </Block>

      {/* 8 · Nordstern */}
      <Block pille={t.nordPille} titel={<>{t.nordH2a}<span className="dk-verlauf">{t.nordH2b}</span></>} lead={t.nordLead}>
        <Karten items={t.nord} />
      </Block>

      {/* 9 · Der Markt */}
      <Block pille={t.marktPille} titel={<>{t.marktH2a}<span className="dk-verlauf">{t.marktH2b}</span>{t.marktH2c}</>} lead={t.marktLead}>
        <Kennzahlen items={t.marktZahlen} />
      </Block>

      {/* 10 · Die Menschen */}
      <Block pille={t.menschenPille} titel={<>{t.menschenH2a}<span className="dk-verlauf">{t.menschenH2b}</span></>} lead={t.menschenLead}>
        <Team kompakt />
        <div className="dk-knoepfe"><Knopf href={zu("/team")} still>{t.teamKnopf}</Knopf></div>
      </Block>

      {/* 11 · Grundsätze */}
      <Block pille={t.grundPille} titel={<>{t.grundH2a}<span className="dk-verlauf">{t.grundH2b}</span></>}>
        <Karten items={t.grund} zwei />
      </Block>

      <Block eng schmal>
        <Zitat text={t.zitat} wer={t.zitatWer} en={en} />
      </Block>

      <Zwischenruf text={t.zwischenruf} knopf={t.jetztStarten} href="/antrag" still={{ knopf: t.paketeAnsehen, href: en ? "/en/pricing" : "/#setups" }} />

      {/* 12 · Fragen */}
      <Block schmal pille={t.fragenPille}>
        <Fragen items={t.fragen} />
      </Block>

      <Abschluss
        titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
        text={t.abschlussText}
        knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href={zu("/team")} still>{t.werDasBaut}</Knopf></>}
      />
    </Dunkel>
  );
}
