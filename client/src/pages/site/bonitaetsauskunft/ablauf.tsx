// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft/ablauf — WAS NACH DEM KAUF PASSIERT (25.09.2026, E-241)
//
// Vier Schritte, wie sie wirklich laufen (E-240: Bestellseite → Zahlungsseite →
// Anfragen nach Zahlungseingang über die Art.-15-Vorgänge → Auswertung im
// Kundenbereich). Die Dauer ohne Zahlenversprechen: der Satz der
// Vertragsbestätigung (auskunftLeistungszeit) — die gesetzliche Frist der
// Auskunfteien ist ihre Frist, nicht unsere Zusage. Der Widerruf in Alltags-
// sprache; die Belehrung selbst steht wörtlich auf der Bestellseite.
//
// Gegenlesen E-241: Vorher stand hier erst der kurze Weg (vier Kreise) und
// darunter dieselben vier Schritte noch einmal als vier volle Abschnitte —
// zweimal derselbe Inhalt, acht gleich gebaute Blöcke. Jetzt EIN Zeitstrahl:
// je Schritt Knoten, „wann", Überschrift (H2, wortgleich mit der SEO-Tabelle)
// und der ausführliche Text.
// ═══════════════════════════════════════════════════════════════════════════
import { Knopf, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { BX, BX_ABLAUF, BX_HUB, BX_PFAD, BX_SCHRITTE, bestellPfad } from "@/i18n/bonitaetsauskunft-familie";
import { BX_FRAGEN_ABLAUF } from "@/i18n/bonitaetsauskunft-fragen";
import { Abschnitt, BxHero, BxRahmen, Pfeil, PreisZeile, Weiterlesen } from "./bausteine";

/** Der Zeitstrahl: vier Schritte, jeder mit seinem ausführlichen Text. */
function Zeitstrahl() {
  const t = BX_ABLAUF;
  return (
    <ol className="bx-zeitstrahl">
      {t.schritte.map((s, i) => {
        // „Schritt 1 · Bestellen" — der Vorsatz leiser, der Name trägt. Der Text der H2 bleibt ganz.
        const [vor, ...rest] = s.titel.split(" · ");
        return (
          <li key={s.titel}>
            <span className="knoten zahl" aria-hidden="true">{i + 1}</span>
            <Auf>
              <span className="wann">{BX_SCHRITTE[i]?.wann}</span>
              <h2>{rest.length ? <><span className="vor">{vor} · </span>{rest.join(" · ")}</> : s.titel}</h2>
              <p>{s.text}</p>
            </Auf>
          </li>
        );
      })}
    </ol>
  );
}

export default function BonitaetsauskunftAblauf() {
  const t = BX_ABLAUF;
  return (
    <BxRahmen
      seite="ablauf" krume={t.krume} fragen={BX_FRAGEN_ABLAUF}
      hero={(
        <BxHero
          seite="ablauf" bild={t.bild} krume={t.krume} pille={t.pille} h1a={t.h1a} h1b={t.h1b} lead={t.lead}
          preis={<PreisZeile />}
          knoepfe={<>
            <Knopf href={bestellPfad()}>{BX.knopfBestellen}</Knopf>
            <Knopf href={BX_PFAD.handlungsplan} still>{BX.knopfPlan}</Knopf>
          </>}
        />
      )}
    >
      <section className="bx-abschnitt bx-ohne-kopf bx-mit-strahl" aria-label={BX.antragWegAria}>
        <Zeitstrahl />
      </section>

      <Abschnitt marke="Dauer" titel={t.dauerTitel} text={t.dauerText} />

      <Abschnitt marke="Widerruf" titel={t.widerrufTitel} text={t.widerrufText}>
        <Auf>
          <ul className="bx-punkte">{t.widerrufPunkte.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="bx-mehr"><a href="/widerrufsbelehrung">{t.widerrufLink}<Pfeil /></a></p>
        </Auf>
      </Abschnitt>

      <Abschnitt marke="Fragen" titel={t.fragenTitel}>
        <Fragen items={BX_FRAGEN_ABLAUF} />
        <p className="bx-mehr"><a href={BX_PFAD.fragen}>{BX_HUB.fragenMehr}<Pfeil /></a></p>
      </Abschnitt>

      <Weiterlesen links={t.weiter} />
    </BxRahmen>
  );
}
