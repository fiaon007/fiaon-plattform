// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft/fragen — ALLE FRAGEN, EHRLICH (25.09.2026, E-241)
//
// Drei Gruppen, jede sichtbar mit `Fragen` (der eine FAQ-Baustein der Website);
// FAQPage bekommt genau diese Fragen — nicht mehr, nicht weniger.
// ═══════════════════════════════════════════════════════════════════════════
import { Knopf, Fragen } from "@/components/site/DunkleBuehne";
import { BX, BX_FRAGEN_SEITE, BX_PFAD, bestellPfad } from "@/i18n/bonitaetsauskunft-familie";
import { BX_FRAGEN_GRUPPEN } from "@/i18n/bonitaetsauskunft-fragen";
import { Abschnitt, Band, BxHero, BxRahmen, PreisZeile, Weiterlesen } from "./bausteine";

export default function BonitaetsauskunftFragen() {
  const t = BX_FRAGEN_SEITE;
  return (
    <BxRahmen
      seite="fragen" krume={t.krume} fragen={BX_FRAGEN_GRUPPEN.flat()}
      hero={(
        <BxHero
          seite="fragen" bild={t.bild} krume={t.krume} pille={t.pille} h1a={t.h1a} h1b={t.h1b} lead={t.lead}
          preis={<PreisZeile />}
          knoepfe={<>
            <Knopf href={bestellPfad()}>{BX.knopfBestellen}</Knopf>
            <Knopf href={BX_PFAD.ablauf} still>{BX.knopfAblauf}</Knopf>
          </>}
        />
      )}
    >
      {t.gruppen.map((g, i) => (
        <Abschnitt key={g.titel} marke={`Teil ${i + 1} von ${t.gruppen.length}`} titel={g.titel} text={g.text}>
          <Fragen items={BX_FRAGEN_GRUPPEN[i]} />
          {i === 0 && <Band satz={t.bandSatz} />}
        </Abschnitt>
      ))}
      <Weiterlesen links={t.weiter} />
    </BxRahmen>
  );
}
