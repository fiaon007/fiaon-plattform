// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft — DIE ÜBERSICHT (25.09.2026, E-241)
//
// Die Tür zur Bonitätsauskunft: Menüpunkt, Anzeigen-Ziel, Weiterleitung von
// /bonitaet und /bonitaet-service. Aufbau nach Justins Auftrag:
//   Kopf mit klarem Angebot (beide Preise, Hauptknopf → /bonitaet-antrag,
//   zweiter Knopf „So läuft es ab") und der Preistafel vor der Mappe —
//   was Sie bekommen (je Land und Art) — für wen — der Ablauf in vier Schritten
//   — ein Handlungsplan als Beispiel mit erfundenen Daten — die ehrliche Antwort
//   auf „kostenlos?" — Fragen — Abschluss.
//
// Land und Art: Die Tafel im Kopf und „Was Sie bekommen" teilen EINE Wahl —
// wer oben Österreich wählt, liest unten KSV1870 und CRIF, und der Knopf trägt
// ?land=AT mit auf die Bestellseite.
//
// Messung: ViewContent mit content_category „auskunft" (useAuskunftAnsicht).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Knopf, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { auskunfteienFuer, type AuskunftArt, type AuskunftLand } from "@shared/fiaon-auskunft";
import {
  BX, BX_HUB, BX_HUB_WEITER, BX_PFAD, BX_PREIS, LAND_NAME, bestellPfad, bxPreis,
} from "@/i18n/bonitaetsauskunft-familie";
import { BX_FRAGEN_HUB } from "@/i18n/bonitaetsauskunft-fragen";
import {
  Abschnitt, Band, BeispielPlan, BxHero, BxRahmen, Haken, KundenpreisLink, LeistungListe, Pfeil, PreisZeile, Schalter, Weiterlesen, WegSchritte,
  useAuskunftAnsicht, useLandWahl,
} from "./bausteine";

const LAENDER = ["DE", "AT", "CH"] as const;
const ARTEN = ["privat", "firma"] as const;

/** Die Mappe: drei Blätter (Aufbau der Lieferung) und davor die Preistafel — die Navy-Glas-Fläche der Seite. */
function Mappe({ land, setLand, linkLand }: { land: AuskunftLand; setLand: (l: AuskunftLand) => void; linkLand?: AuskunftLand }) {
  const h = BX_HUB;
  return (
    <div className="bx-mappe" role="group" aria-label={h.mappeAria}>
      <div className="bx-blaetter" aria-hidden="true">
        {h.mappeBlaetter.map((b, i) => (
          <div key={b.tag} className={`bx-blatt b${i + 1}`}>
            <span className="tag">{b.tag}</span>
            <b>{b.titel}</b>
            {i < 2 ? (
              <div className="zeilen">{[92, 74, 86, 58, 80, 66, 88, 52].map((w, k) => <i key={k} style={{ width: `${w}%` }} />)}</div>
            ) : (
              <ul className="plan">{h.mappePlan.map((p) => <li key={p.t}><i className={p.ton} />{p.t}</li>)}</ul>
            )}
          </div>
        ))}
        <span className="bx-mappe-unter">{h.mappeUnter}</span>
      </div>

      <div className="bx-tafel">
        <span className="tag">{h.tafelTag}</span>
        <div className="betrag"><b className="zahl">{BX_PREIS.privat}</b><span>{BX.karteEinmal}</span></div>
        <p className="paket">{BX.kartePaket(BX_PREIS.privatPaket)}</p>
        {/* Gegenlesen E-241: Ab 1024 px trägt die Tafel den Preis des Kopfs allein (die Preiszeile
            links entfällt dort, bx-hero.mit-instrument) — die Steuerzeile gehört dann hierher (PAngV). */}
        <p className="steuer">{BX_PREIS.steuer}</p>
        <Schalter werte={LAENDER} wert={land} setze={setLand} namen={LAND_NAME} aria={h.tafelLandAria} dunkel />
        <p className="unter">{BX.karteBei}</p>
        <div className="bx-chips">{auskunfteienFuer(land).map((a) => <span key={a.key}>{a.kurz}</span>)}</div>
        <a className="bx-karte-knopf" href={bestellPfad("privat", linkLand)}>{BX.knopfBestellen}<Pfeil /></a>
        {/* E-243: Kunden mit laufendem Paket direkt zum Kundenpreis-Link (die Preiszeile links entfällt ab 1024 px). */}
        <KundenpreisLink art="privat" land={linkLand} className="bx-karte-leise" />
      </div>
    </div>
  );
}

export default function BonitaetsauskunftUebersicht() {
  useAuskunftAnsicht("hub");
  const h = BX_HUB;
  // Gegenlesen E-241: erkanntes Land in der Anzeige, ?land= im Link nur nach eigener Wahl (useLandWahl).
  const { land, setLand, linkLand } = useLandWahl();
  const [art, setArt] = useState<AuskunftArt>("privat");

  return (
    <BxRahmen
      seite="hub" leiste={false} arten={["privat", "firma"]}
      hero={(
        <BxHero
          seite="hub" bild="/kino/akten.jpg" pille={h.pille} h1a={h.h1a} h1b={h.h1b} lead={h.lead}
          preis={<PreisZeile />}
          knoepfe={<>
            <Knopf href={bestellPfad()}>{BX.knopfBestellen}</Knopf>
            <Knopf href={BX_PFAD.ablauf} still>{BX.knopfAblauf}</Knopf>
          </>}
          fakten={h.fakten}
          instrument={<Mappe land={land} setLand={setLand} linkLand={linkLand} />}
        />
      )}
    >
      {/* ── 01 · Was Sie bekommen ── */}
      <Abschnitt id="leistung" marke="Leistung" titel={h.bekommenTitel} text={h.bekommenText}>
        <Auf>
          <div className="bx-wahl">
            <Schalter werte={LAENDER} wert={land} setze={setLand} namen={LAND_NAME} aria={BX_HUB.tafelLandAria} />
            <Schalter werte={ARTEN} wert={art} setze={setArt} namen={h.arten} aria={h.artAria} />
          </div>
          <div className="bx-leistung-rahmen">
            <LeistungListe art={art} land={land} />
            <div className="bx-leistung-preis">
              <p><b className="zahl">{bxPreis(art).einzeln}</b> {BX.preisEinmal}</p>
              <p>{BX.preisMitPaket(bxPreis(art).paket)}</p>
              {/* Gegenlesen E-241: Preis mit Kaufknopf — die Steuerzeile gehört dazu (PAngV). */}
              <p className="steuer">{BX_PREIS.steuer}</p>
              <Knopf href={bestellPfad(art, linkLand)}>{art === "firma" ? BX.knopfBestellenFirma : BX.knopfBestellen}</Knopf>
              {/* E-243: der Weg zum Kundenpreis unter dem Kaufknopf. */}
              <p style={{ marginTop: 14, textAlign: "center" }}>
                <KundenpreisLink art={art} land={linkLand} stil={{ color: "var(--bx-tinte)", textDecoration: "underline", textDecorationColor: "rgba(37,99,235,.35)", textUnderlineOffset: 3 }} />
              </p>
            </div>
          </div>
        </Auf>
      </Abschnitt>

      {/* ── 02 · Für wen ── */}
      <Abschnitt id="fuer-wen" marke="Länder und Unternehmen" titel={h.werTitel} text={h.werText}>
        <Auf>
          <div className="bx-wegweiser">
            {h.werZeilen.map((z) => {
              const p = bxPreis(z.art);
              return (
                <a key={z.seite} href={BX_PFAD[z.seite]}>
                  <span className="land">{z.name}</span>
                  <span className="bei">{z.bei}</span>
                  <span className="preis">{p.einzeln} · mit Paket {p.paket}</span>
                  <Pfeil gross />
                </a>
              );
            })}
          </div>
        </Auf>
      </Abschnitt>

      {/* ── 03 · Ablauf ── */}
      <Abschnitt id="ablauf" marke="Ablauf" titel={h.ablaufTitel} text={h.ablaufText}>
        <Auf><WegSchritte /></Auf>
        <p className="bx-mehr"><a href={BX_PFAD.ablauf}>{h.ablaufMehr}<Pfeil /></a></p>
      </Abschnitt>

      {/* ── 04 · Beispiel ── */}
      <Abschnitt id="beispiel" marke="Beispiel" titel={h.beispielTitel} text={h.beispielText}>
        <Auf><BeispielPlan /></Auf>
        <p className="bx-mehr"><a href={BX_PFAD.handlungsplan}>{h.beispielMehr}<Pfeil /></a></p>
      </Abschnitt>

      <Band satz={h.bandSatz} land={linkLand} />

      {/* ── 05 · Kostenlos oder von uns — ehrlich, nicht als Hauptweg ── */}
      <Abschnitt id="kostenlos" marke="Ehrlich gesagt" titel={h.kostenlosTitel}>
        <Auf>
          <blockquote className="bx-zitat">{h.kostenlosZitat}</blockquote>
          <div className="bx-wege">
            <div className="bx-weg-karte">
              <p className="kopf">{h.selbstTitel}</p>
              <p className="preis zahl">{h.selbstPreis}</p>
              <ul>{h.selbstZeilen.map((z) => <li key={z}>{z}</li>)}</ul>
              <a className="leise" href="/werkzeuge/selbstauskunft">{h.selbstLink}<Pfeil /></a>
            </div>
            <div className="bx-weg-karte fiaon">
              <p className="kopf">{h.fiaonTitel}</p>
              <p className="preis zahl">{BX_PREIS.privat}<small> · mit Paket {BX_PREIS.privatPaket}</small></p>
              <ul>{h.fiaonZeilen.map((z) => <li key={z}><Haken />{z}</li>)}</ul>
              <Knopf href={bestellPfad("privat", linkLand)}>{BX.knopfBestellen}</Knopf>
            </div>
          </div>
        </Auf>
      </Abschnitt>

      {/* ── 06 · Fragen (Auszug; FAQPage nur auf /bonitaetsauskunft/fragen) ── */}
      <Abschnitt id="fragen" marke="Fragen" titel={h.fragenTitel}>
        <Fragen items={BX_FRAGEN_HUB} />
        <p className="bx-mehr"><a href={BX_PFAD.fragen}>{h.fragenMehr}<Pfeil /></a></p>
      </Abschnitt>

      <Weiterlesen links={BX_HUB_WEITER} />
    </BxRahmen>
  );
}
