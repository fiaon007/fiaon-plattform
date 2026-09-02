// /team — Wer FIAON baut: drei Gesellschafter im Betrieb, ein Investor, ein Weg für neue Kollegen.
// 02.09.2026: zweisprachig — /team (Deutsch) und /en/team (Englisch); Texte in client/src/i18n/team.ts.
import { Dunkel, Hero, Block, Karten, Schritte, Zwischenruf, Abschluss, Knopf } from "@/components/site/DunkleBuehne";
import { Team, Mitarbeiter, PERSONEN, INVESTOR } from "@/components/site/Team";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { TEAM_WOERTER } from "@/i18n/team";

export default function TeamSeite() {
  const t = useWoerter(TEAM_WOERTER);
  const sprache = useSprache();
  const zu = (p: string) => inSprache(p, sprache);
  return (
    <Dunkel seite="team" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <Hero
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#kontakt">{t.kontakt}</Knopf><Knopf href={zu("/karriere")} still>{t.teilWerden}</Knopf></>}
        szene={<SchichtenSzene namen={t.szeneNamen} className="absolute inset-0" />}
        bild="/kino/presse.jpg"
      />

      <Block pille={t.teamPille} titel={<>{t.teamH2a}<span className="dk-verlauf">{t.teamH2b}</span></>} lead={t.teamLead} mitte>
        <div style={{ textAlign: "left" }}><Mitarbeiter /></div>
      </Block>

      <Block pille={t.gesPille} titel={<>{t.gesH2a}<span className="dk-verlauf">{t.gesH2b}</span></>} mitte>
        <div style={{ textAlign: "left" }}><Team /></div>
      </Block>

      <Block pille={t.arbeitPille} titel={<>{t.arbeitH2a}<span className="dk-verlauf">{t.arbeitH2b}</span></>} lead={t.arbeitLead}>
        <Schritte items={t.arbeit} />
      </Block>

      <Block pille={t.grundPille} titel={<>{t.grundH2a}<span className="dk-verlauf">{t.grundH2b}</span></>}>
        <Karten items={t.grund} zwei />
      </Block>

      <Zwischenruf text={t.zwischenruf} knopf={t.bewerben} href={zu("/karriere") + "#bewerbung"} still={{ knopf: t.fuerPartner, href: zu("/partner") }} />

      <Block id="kontakt" pille={t.kontaktPille} titel={<>{t.kontaktH2a}<span className="dk-verlauf">{t.kontaktH2b}</span></>} schmal>
        <div className="dk-raster" style={{ marginTop: 40 }}>
          {PERSONEN.map((p) => (
            <div key={p.kuerzel} className="dk-glas ruhig">
              <span className="tag">{(t.personen[p.kuerzel]?.rolle ?? p.rolle).split(" · ")[0]}</span>
              <h3 className="dk-h3">{p.name}</h3>
              <p style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 14.5 }}>
                <a href={`mailto:${p.email}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{p.email}</a>
                {p.telefon && <a href={`tel:${p.telefon.replace(/\s/g, "")}`} style={{ color: "#9ca3af", textDecoration: "none" }}>{p.telefon}</a>}
              </p>
            </div>
          ))}
          <div className="dk-glas ruhig">
            <span className="tag">{t.investor}</span>
            <h3 className="dk-h3">{INVESTOR.name}</h3>
            <p className="dk-leise" style={{ marginTop: 10, lineHeight: 1.6 }}>{INVESTOR.adresse.join(" · ")}<br /><a href={`mailto:${INVESTOR.email}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{INVESTOR.email}</a></p>
          </div>
        </div>
        <p className="dk-leise" style={{ marginTop: 20 }}>{t.fussZeile}</p>
      </Block>

      <Abschluss
        titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
        text={t.abschlussText}
        knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href="/investoren" still>{t.fuerInvestoren}</Knopf></>}
      />
    </Dunkel>
  );
}
