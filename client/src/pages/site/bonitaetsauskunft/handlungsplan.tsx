// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft/handlungsplan — WAS DRINSTEHT (25.09.2026, E-241)
//
// Was der Plan enthält, welche Schreiben es gibt (Hauswissen: Academy
// Kapitel 6 — Löschung nach Fristablauf, Berichtigung, Erledigung nachtragen),
// ein Plan und ein Schreiben als Beispiel mit erfundenen Daten und die Grenze:
// keine Rechtsberatung, keine Löschzusage — die Auskunftei entscheidet.
// ═══════════════════════════════════════════════════════════════════════════
import { Knopf, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { BX, BX_HUB, BX_PFAD, BX_PLAN, bestellPfad } from "@/i18n/bonitaetsauskunft-familie";
import { BX_FRAGEN_PLAN } from "@/i18n/bonitaetsauskunft-fragen";
import { Abschnitt, Band, BeispielPlan, BxHero, BxRahmen, Pfeil, PreisZeile, Weiterlesen } from "./bausteine";

export default function BonitaetsauskunftHandlungsplan() {
  const t = BX_PLAN;
  const b = t.brief;
  return (
    <BxRahmen
      seite="handlungsplan" krume={t.krume} fragen={BX_FRAGEN_PLAN}
      hero={(
        <BxHero
          seite="handlungsplan" bild={t.bild} krume={t.krume} pille={t.pille} h1a={t.h1a} h1b={t.h1b} lead={t.lead}
          preis={<PreisZeile />}
          knoepfe={<>
            <Knopf href={bestellPfad()}>{BX.knopfBestellen}</Knopf>
            <Knopf href={BX_PFAD.ablauf} still>{BX.knopfAblauf}</Knopf>
          </>}
        />
      )}
    >
      <Abschnitt marke="Inhalt" titel={t.inhaltTitel} text={t.inhaltText}>
        <Auf><ol className="bx-leistung">{t.inhaltPunkte.map((p) => <li key={p}><span>{p}</span></li>)}</ol></Auf>
      </Abschnitt>

      <Abschnitt marke="Beispiel" titel={BX_HUB.beispielTitel} text={BX_HUB.beispielText}>
        <Auf><BeispielPlan /></Auf>
      </Abschnitt>

      <Abschnitt marke="Schreiben" titel={t.schreibenTitel} text={t.schreibenText}>
        <Auf>
          <div className="bx-schreiben">
            {t.schreiben.map((s, i) => (
              <article key={s.titel}>
                <span className="n zahl">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.titel}</h3>
                <p>{s.wann}</p>
                <em>{s.grund}</em>
              </article>
            ))}
          </div>
        </Auf>
      </Abschnitt>

      <Abschnitt marke="Beispiel" titel={t.briefTitel} text={t.briefText}>
        <Auf>
          <figure className="bx-brief" aria-label={`${b.betreff} — ${b.marke}`}>
            <span className="bx-stempel">{b.marke}</span>
            <address>{b.an.map((z) => <span key={z}>{z}</span>)}</address>
            <p className="betreff">{b.betreff}</p>
            {b.absaetze.map((a) => <p key={a}>{a}</p>)}
            <p className="unterschrift">{b.unterschrift}</p>
          </figure>
        </Auf>
      </Abschnitt>

      <Band satz={t.bandSatz} />

      <Abschnitt marke="Grenzen" titel={t.grenzeTitel} text={t.grenzeText} />

      <Abschnitt marke="Fragen" titel={t.fragenTitel}>
        <Fragen items={BX_FRAGEN_PLAN} />
        <p className="bx-mehr"><a href={BX_PFAD.fragen}>{BX_HUB.fragenMehr}<Pfeil /></a></p>
      </Abschnitt>

      <Weiterlesen links={t.weiter} />
    </BxRahmen>
  );
}
