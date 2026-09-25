// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft/schufa · /oesterreich · /schweiz — DIE LÄNDERSEITEN
// (25.09.2026, E-241)
//
// Eine Seite je Land, ein Aufbau: bei wem wir anfragen (nur die Auskunfteien
// aus shared/fiaon-auskunft.ts, mit Ort und Rechtsgrundlage) — was Sie
// bekommen (die eine Leistungsliste) — ein landeseigener Abschnitt — Fragen.
// Jeder Kaufknopf trägt ?land= mit auf /bonitaet-antrag.
//
// Österreich und Schweiz lesen nie „SCHUFA" (E-240: am 24.09. bekamen 111
// Österreicher die „SCHUFA-Datenkopie" angemahnt).
// ═══════════════════════════════════════════════════════════════════════════
import { Knopf, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { BX, BX_HUB, BX_LAENDER, BX_PFAD, bestellPfad } from "@/i18n/bonitaetsauskunft-familie";
import { BX_FRAGEN_LAND } from "@/i18n/bonitaetsauskunft-fragen";
import { Abschnitt, Band, BxHero, BxRahmen, LeistungListe, Pfeil, PreisZeile, Stellen, Weiterlesen } from "./bausteine";

export default function LandSeite({ land }: { land: "DE" | "AT" | "CH" }) {
  const t = BX_LAENDER[land];
  const fragen = BX_FRAGEN_LAND[land];
  return (
    <BxRahmen
      seite={t.seite} krume={t.krume} land={land} fragen={fragen}
      hero={(
        <BxHero
          seite={t.seite} bild={t.bild} krume={t.krume} pille={t.pille} h1a={t.h1a} h1b={t.h1b} lead={t.lead}
          preis={<PreisZeile />}
          knoepfe={<>
            <Knopf href={bestellPfad("privat", land)}>{BX.knopfBestellen}</Knopf>
            <Knopf href={BX_PFAD.ablauf} still>{BX.knopfAblauf}</Knopf>
          </>}
        />
      )}
    >
      <Abschnitt marke="Auskunfteien" titel={t.beiTitel} text={t.beiText}>
        <Auf><Stellen land={land} /></Auf>
      </Abschnitt>

      <Abschnitt marke="Leistung" titel={t.bekommenTitel} text={t.bekommenText}>
        <Auf><LeistungListe art="privat" land={land} /></Auf>
      </Abschnitt>

      <Band satz={t.bandSatz} land={land} />

      <Abschnitt marke={t.eigenMarke} titel={t.eigenTitel} text={t.eigenText}>
        {t.eigenPunkte && (
          <Auf>
            <ul className="bx-punkte">{t.eigenPunkte.map((p) => <li key={p}>{p}</li>)}</ul>
          </Auf>
        )}
      </Abschnitt>

      <Abschnitt marke="Fragen" titel={t.fragenTitel}>
        <Fragen items={fragen} />
        <p className="bx-mehr"><a href={BX_PFAD.fragen}>{BX_HUB.fragenMehr}<Pfeil /></a></p>
      </Abschnitt>

      <Weiterlesen links={t.weiter} />
    </BxRahmen>
  );
}
