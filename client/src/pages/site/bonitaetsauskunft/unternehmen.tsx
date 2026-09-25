// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft/unternehmen — DIE AUSKUNFT FÜR FIRMEN (25.09.2026, E-241)
//
// Preise aus shared/fiaon-auskunft.ts (Unternehmen einzeln / mit Paket), die
// Leistung aus auskunftLeistung("firma", land), die Leistungszeit und der
// Unternehmer-Satz aus shared/fiaon-auskunft-widerruf.ts — dieselben Worte wie
// Bestellseite und Vertragsbestätigung. Für Firmen gilt Art. 15 DSGVO nicht;
// wann die Wirtschaftsauskunfteien liefern, liegt bei ihnen — keine Frist erfinden.
// Jeder Kaufknopf führt auf /bonitaet-antrag?art=firma (mit ?land=, wo gewählt).
// ═══════════════════════════════════════════════════════════════════════════
import { Knopf, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { BX, BX_FIRMA, BX_HUB, BX_PFAD, LAND_NAME, bestellPfad } from "@/i18n/bonitaetsauskunft-familie";
import { BX_FRAGEN_FIRMA } from "@/i18n/bonitaetsauskunft-fragen";
import { Abschnitt, Band, BxHero, BxRahmen, LeistungListe, Pfeil, PreisZeile, Schalter, Weiterlesen, useLandWahl } from "./bausteine";

const LAENDER = ["DE", "AT", "CH"] as const;

export default function BonitaetsauskunftUnternehmen() {
  const t = BX_FIRMA;
  // Gegenlesen E-241: erkanntes Land in der Anzeige, ?land= im Link nur nach eigener Wahl (useLandWahl).
  const { land, setLand, linkLand } = useLandWahl();
  return (
    <BxRahmen
      seite="unternehmen" krume={t.krume} art="firma" fragen={BX_FRAGEN_FIRMA}
      hero={(
        <BxHero
          seite="unternehmen" bild={t.bild} krume={t.krume} pille={t.pille} h1a={t.h1a} h1b={t.h1b} lead={t.lead}
          preis={<PreisZeile art="firma" />}
          knoepfe={<>
            <Knopf href={bestellPfad("firma")}>{BX.knopfBestellenFirma}</Knopf>
            <Knopf href={BX_PFAD.ablauf} still>{BX.knopfAblauf}</Knopf>
          </>}
        />
      )}
    >
      <Abschnitt marke="Leistung" titel={t.bekommenTitel} text={t.bekommenText}>
        <Auf>
          <div className="bx-wahl">
            <Schalter werte={LAENDER} wert={land} setze={setLand} namen={LAND_NAME} aria={t.landAria} />
          </div>
          <LeistungListe art="firma" land={land} />
        </Auf>
      </Abschnitt>

      {/* Gegenlesen E-241: Marke und Überschrift sagten beide „Für wen". */}
      <Abschnitt marke="Rechtsformen" titel={t.werTitel} text={t.werText}>
        <Auf>
          <dl className="bx-formen">
            {LAENDER.map((l) => <div key={l}><dt>{LAND_NAME[l]}</dt><dd>{t.rechtsformen[l]}</dd></div>)}
          </dl>
        </Auf>
      </Abschnitt>

      <Band satz={t.bandSatz} art="firma" land={linkLand} />

      <Abschnitt marke="Dauer" titel={t.dauerTitel} text={t.dauerText} />

      <Abschnitt marke="Widerruf" titel={t.widerrufTitel} text={t.widerrufText} />

      <Abschnitt marke="Fragen" titel={t.fragenTitel}>
        <Fragen items={BX_FRAGEN_FIRMA} />
        <p className="bx-mehr"><a href={BX_PFAD.fragen}>{BX_HUB.fragenMehr}<Pfeil /></a></p>
      </Abschnitt>

      <Weiterlesen links={t.weiter} />
    </BxRahmen>
  );
}
