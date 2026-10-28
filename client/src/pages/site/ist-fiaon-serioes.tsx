// ═══════════════════════════════════════════════════════════════════════════
// /ist-fiaon-serioes · /en/is-fiaon-legit — „Ist FIAON seriös? Die Fakten“ (28.10.2026, E-445)
//
// Suchintention (Search Console 28.10.2026): „fiaon seriös“, „fiaon kreditkarte erfahrungen“, „ist das
// abzocke“. Wer das sucht, steht vor der Entscheidung und sieht unter unserem Treffer fremde Warnlisten.
// Diese Seite antwortet mit Prüfbarem statt mit Eigenlob: Registereintrag, das eine Geschäftskonto,
// was FIAON ist und was nicht, Laufzeit, Datenschutz, Kontaktwege, Verwechslungsgefahr.
//
// Eine Quelle: Abschnitte und „Auf einen Blick“ aus shared/fiaon-serioes.ts (dieselben Sätze stehen im
// Vorab-HTML), Bankverbindung über shared/fiaon-serioes.ts aus shared/fiaon-bank.ts, Firma aus shared/fiaon-firma.ts.
// Die Schwester /fiaon-erfahrungen („So arbeitet FIAON“) zeigt Ablauf und Seriositäts-Check — hier nur Fakten.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Zeilen, Glas, Karten, Fragen, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { SERIOES_WOERTER } from "@/i18n/ist-fiaon-serioes";
import { SERIOES_TEXTE, SERIOES_PFAD, COMPANIES_HOUSE_URL, type SerioesAbschnitt } from "@shared/fiaon-serioes";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const textStil = { fontSize: 15.5, lineHeight: 1.75 } as const;

export default function IstFiaonSerioes() {
  const t = useWoerter(SERIOES_WOERTER);
  const s = useWoerter(SERIOES_TEXTE);
  const sprache = useSprache();
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = SERIOES_PFAD[sprache];
  const a = Object.fromEntries(s.abschnitte.map((x) => [x.id, x])) as Record<string, SerioesAbschnitt>;
  const titel = (x: SerioesAbschnitt) => <>{x.h2a}<span className="dk-verlauf">{x.h2b}</span></>;
  // „Keine Bank: …“ → Kachel mit Titel und Text (Text groß beginnend — im Englischen folgt dem Doppelpunkt ein kleiner Buchstabe).
  const nicht = (a.was.punkte ?? []).map((p) => { const i = p.indexOf(": "); const rest = p.slice(i + 2); return { titel: p.slice(0, i), text: rest.charAt(0).toUpperCase() + rest.slice(1) }; });

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/akten.jpg"
        pille={t.pille(s.stand)}
        titel={<>{s.h1a}<span className="dk-verlauf">{s.h1b}</span></>}
        lead={s.lead}
        knoepfe={<><Knopf href="#fakten">{t.dieFakten}</Knopf><Knopf href={zu("/kontakt")} still>{t.kontakt}</Knopf></>}
      />

      <Block id="fakten" schmal titel={s.blickH2}>
        <Glas ruhig><Zeilen items={s.blick} /></Glas>
      </Block>

      <Licht>
        <Block id={a.wer.id} schmal titel={titel(a.wer)} lead={a.wer.text}>
          <div className="sx-vertiefen">
            <a href={COMPANIES_HOUSE_URL} target="_blank" rel="noopener noreferrer"><b>{t.registerPruefen}</b><span>Companies House · {FIAON_FIRMA.companyNo}</span></a>
            <a href="/impressum"><b>{t.impressum}</b><span>{FIAON_FIRMA.name} · {FIAON_FIRMA.ortZeile}</span></a>
            <a href={zu("/team")}><b>{t.team}</b><span>{FIAON_FIRMA.director}</span></a>
          </div>
        </Block>

        <Block id={a.zahlung.id} schmal titel={titel(a.zahlung)} lead={a.zahlung.text}>
          <Glas tag={t.bankTag} style={{ marginTop: 32 }}>
            <Zeilen items={a.zahlung.zeilen ?? []} />
          </Glas>
          <ul className="dk-text" style={{ ...textStil, margin: "22px 0 0 18px" }}>
            {(a.zahlung.punkte ?? []).map((p) => <li key={p}>{p}</li>)}
          </ul>
        </Block>

        <Block id={a.was.id} titel={titel(a.was)} lead={a.was.text}>
          <Karten items={nicht} />
        </Block>

        <Block id={a.laufzeit.id} schmal titel={titel(a.laufzeit)} lead={a.laufzeit.text}>
          <div className="dk-knoepfe">
            <Knopf href="/agb" still>{t.agb}</Knopf>
            <Knopf href="/widerrufsbelehrung" still>{t.widerruf}</Knopf>
            <Knopf href={zu("/preise")} still>{t.preise}</Knopf>
          </div>
        </Block>

        <Block id={a.daten.id} schmal titel={titel(a.daten)} lead={a.daten.text}>
          <div className="dk-knoepfe">
            <Knopf href={zu("/sicherheit")} still>{t.sicherheit}</Knopf>
            <Knopf href="/privacy" still>{t.datenschutz}</Knopf>
          </div>
        </Block>

        <Block id={a.kontakt.id} schmal titel={titel(a.kontakt)} lead={a.kontakt.text}>
          <div className="dk-knoepfe">
            <Knopf href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</Knopf>
            <Knopf href={`mailto:${FIAON_FIRMA.email}`} still>{FIAON_FIRMA.email}</Knopf>
            <Knopf href={zu("/kontakt")} still>{t.dringend}</Knopf>
          </div>
        </Block>

        <Block id={a.verwechslung.id} schmal titel={titel(a.verwechslung)}>
          <Glas ruhig><p className="dk-text" style={textStil}>{a.verwechslung.text}</p></Glas>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
        </Block>

        <Block schmal>
          <div className="sx-vertiefen">
            <a href={zu("/fiaon-erfahrungen")}><b>{t.soArbeitet}</b><span>{t.soArbeitetSatz}</span></a>
          </div>
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.schlussA}</b>{t.schlussB}</>} knopf={t.kontakt} href={zu("/kontakt")} still={{ knopf: t.termin, href: zu("/termin") }} />
    </Dunkel>
  );
}
