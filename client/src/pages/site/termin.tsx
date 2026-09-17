// ═══════════════════════════════════════════════════════════════════════════
// /termin — Startgespräch buchen (02.09.2026, E-083)
//
// Seite 1 im Zehn-Seiten-Plan: Jeder Marktführer hat den Termin-Knopf im
// Menü; bei FIAON führte bisher alles in den Antrag. Wer erst reden will,
// hatte keinen Weg — und die Funnel-Analyse zeigt, dass Speed-to-Lead und
// No-Show die beiden größten Lecks sind. Diese Seite sammelt: Wunsch-
// Zeitfenster, Telefon, Anliegen — und schickt es als Anfrage der Art
// „termin" an /api/fiaon/anfrage (fiaon-anfragen.ts), wo sie als Aufgabe
// beim Betreiber landet (Fälligkeit zwei Tage). Kein Kalender-Widget:
// Der Rückruf kommt aus dem Team, das die Akte kennt.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /termin (Deutsch) und /en/book-a-call (Englisch);
// Texte im Wörterbuch client/src/i18n/termin.ts.
//
// 17.09.2026 (E-188) — DIE WEICHE FÜR FIAON GLOBAL: Wer mit ?quelle=global
// hier ankommt (Paketkarten, alte Links, Mails), will kein Startgespräch für
// Privatkunden, sondern das Erstgespräch zu FIAON Global. Das hat auf
// /business einen echten Kalender (#gespraech). Diese Seite leitet dorthin
// weiter und reicht den Paketwunsch durch — sie baut KEINE zweite Oberfläche.
// Nur bekannte Paketschlüssel gehen mit; alles andere aus der Adresszeile
// bleibt hier liegen.
import { Dunkel, Hero, Block, Licht, Knopf, Anfrage, Karten, Schritte, Fragen, Kennzahlen, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { TERMIN_WOERTER } from "@/i18n/termin";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { globalPaket } from "@shared/fiaon-global";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

/** Wohin ?quelle=global führt — null, wenn die Adresse keine Global-Anfrage ist. */
function globalZiel(suche: string, en: boolean): string | null {
  const p = new URLSearchParams(suche);
  if ((p.get("quelle") || "").trim().toLowerCase() !== "global") return null;
  const paket = globalPaket(p.get("paket"))?.key;
  return `${en ? "/en/business" : "/business"}${paket ? `?paket=${paket}` : ""}#gespraech`;
}

export default function Termin() {
  const t = useWoerter(TERMIN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const [, geheZu] = useLocation();
  const ziel = typeof window === "undefined" ? null : globalZiel(window.location.search, en);
  useEffect(() => { if (ziel) geheZu(ziel, { replace: true }); }, [ziel, geheZu]);
  // Während der Weiterleitung nichts zeigen: Sonst blitzt für einen Moment das
  // Privatkunden-Formular auf, und wer schnell ist, füllt das falsche aus.
  if (ziel) return null;
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/book-a-call" : "/termin";
  return (
    <Dunkel seite="kontakt" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/presse.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#buchen">{t.zeitfenster}</Knopf><Knopf href="/antrag" still>{t.direktStarten}</Knopf></>}
      />

      <Block eng>
        <Kennzahlen items={t.zahlen} />
      </Block>

      <Licht>
        <Block schmal titel={<>{t.ablaufH2a}<span className="dk-verlauf">{t.ablaufH2b}</span></>} lead={t.ablaufLead}>
          <Schritte items={t.ablauf} />
        </Block>

        <Block id="buchen" schmal titel={<>{t.buchenH2a}<span className="dk-verlauf">{t.buchenH2b}</span></>} lead={t.buchenLead}>
          <Anfrage
            art="termin"
            en={en}
            felder={[
              { name: "name", label: t.felder.name, pflicht: true },
              { name: "telefon", label: t.felder.telefon, typ: "tel", pflicht: true },
              { name: "email", label: t.felder.email, typ: "email", pflicht: true },
              { name: "land", label: t.felder.land, optionen: t.felder.laender, pflicht: true },
              { name: "rolle", label: t.felder.fenster, optionen: t.felder.fensterOptionen, pflicht: true },
              { name: "kunde", label: t.felder.thema, optionen: t.felder.themaOptionen, pflicht: true },
              { name: "text", label: t.felder.text, typ: "textarea", breit: true },
            ]}
            knopf={t.knopf}
            hinweis={t.hinweis}
          />
        </Block>

        <Block titel={<>{t.warumH2a}<span className="dk-verlauf">{t.warumH2b}</span></>} lead={t.warumLead}>
          <Karten items={t.warum} />
        </Block>

        <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.zurKontaktseite} href={zu("/kontakt")} still={{ knopf: t.eintragPruefen, href: zu("/werkzeuge/eintrag-pruefen") }} />
    </Dunkel>
  );
}
