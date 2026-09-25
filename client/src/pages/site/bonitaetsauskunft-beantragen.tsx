// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft-beantragen — der Pfeiler zum Beschaffungs-Suchwort
// (30.08.2026)
//
// Suchintention: „bonitätsauskunft beantragen / kostenlos“. Die Seite ist
// ehrlich: Der kostenlose Weg (Datenkopie nach Art. 15 DSGVO) steht ganz
// vorne — und daneben die FIAON-Bonitätsauskunft für alle, die Anforderung,
// Erklärung und Fristenprüfung abgeben wollen. Ehrlichkeit ist hier keine
// Tugend, sondern die Verkaufsstrategie: Wer den Gratisweg verschweigt,
// wirkt wie die Anbieter, vor denen wir warnen.
// JSON-LD: Service + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /bonitaetsauskunft-beantragen und
// /en/request-your-credit-report; Texte im Wörterbuch client/src/i18n/bonitaetsauskunft-beantragen.ts.
//
// 24.09.2026 (E-240): Die Seite verkaufte „74 € einmalig" und schickte jeden
// Knopf auf /antrag — in die Paketstrecke, die die Auskunft gar nicht kennt.
// Jetzt:
//   · jeder Kaufknopf führt auf /bonitaet-antrag (Unternehmen mit ?art=firma,
//     aus dem Länder-Umschalter zusätzlich ?land=; die Antragsseite liest beides
//     vor, POST /payment-order nimmt art:"firma" an),
//   · beide Preise nebeneinander (149 € einzeln, 74 € mit laufendem Paket —
//     nie als Streichpreis), dazu die Firmenpreise,
//   · die Leistung je Land und Art aus shared/fiaon-auskunft.ts (Österreich
//     und Schweiz lesen nie „SCHUFA" als Anbieter),
//   · JSON-LD mit zwei Angeboten: privat 149 €, Unternehmen 349 € (die
//     Einzelpreise — der Kundenpreis gilt nur mit Paket und ist kein
//     öffentliches Angebot),
//   · der Abschluss mit eigenen Knöpfen statt KartenAufruf (der führt fest
//     auf /antrag); Fußsatz und Kartenbild bleiben dieselben.
//
// 25.09.2026 (E-241): Die Seite gehört optisch zur Seitenfamilie
// /bonitaetsauskunft — derselbe Kopf (BxHero mit Preiszeile), dieselben
// Knöpfe, derselbe Abschluss (BxSchluss statt Kartenbild) und die Kaufleiste
// am Handy; auf Deutsch dazu die Unternavigation und Verweise in die Familie.
// Inhalt, FAQ und canonical bleiben (die Seite ist das Suchziel zu
// „Bonitätsauskunft beantragen"). Brotkrumen: FIAON › Bonitätsauskunft ›
// Bonitätsauskunft beantragen — sichtbar und im Markup gleich.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Auf } from "@/components/site/DunkleBuehne";
import { BxHero, BxSchluss, KaufLeiste, PreisZeile, type BxEigeneWorte } from "@/pages/site/bonitaetsauskunft/bausteine";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { BONITAETSAUSKUNFT_WOERTER } from "@/i18n/bonitaetsauskunft-beantragen";
import {
  AUSKUNFT_PREISE_CENTS, auskunfteienFuer, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

/** Der öffentliche Bestellweg — privat und für Unternehmen. */
const BESTELLEN = "/bonitaet-antrag";
const BESTELLEN_FIRMA = "/bonitaet-antrag?art=firma";
const LAENDER: AuskunftLand[] = ["DE", "AT", "CH"];
const ARTEN: AuskunftArt[] = ["privat", "firma"];

function Haken() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
}

export default function BonitaetsauskunftBeantragen() {
  const t = useWoerter(BONITAETSAUSKUNFT_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/request-your-credit-report" : "/bonitaetsauskunft-beantragen";

  // Preise in der Sprache der Seite: „149 €" (de) — „€149" (en).
  const euro = (c: number) => (en ? "€" + (c / 100).toLocaleString("en-GB") : euroText(c));
  const P = AUSKUNFT_PREISE_CENTS;
  const einzeln = euro(P.privat.einzeln);
  const mitPaket = euro(P.privat.mitAbo);

  // Die Auskunfteien eines Landes als Satzteil, in der Sprache der Seite.
  const bei = (land: AuskunftLand) => {
    const n = auskunfteienFuer(land).map((a) => a.kurz);
    return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} ${en ? "and" : "und"} ${n[n.length - 1]}`;
  };
  const [land, setLand] = useState<AuskunftLand>("DE");
  const [art, setArt] = useState<AuskunftArt>("privat");

  // Service-Markup: die Dienstleistung, wie sie sichtbar auf der Seite steht —
  // zwei Angebote zu den Einzelpreisen (privat und Unternehmen).
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: t.ldName,
      serviceType: t.ldArt,
      provider: { "@type": "Organization", name: "FIAON", url: "https://fiaon.com" },
      areaServed: ["DE", "AT", "CH"],
      offers: [
        { "@type": "Offer", name: t.ldName, price: String(P.privat.einzeln / 100), priceCurrency: "EUR", url: `https://fiaon.com${BESTELLEN}` },
        { "@type": "Offer", name: t.ldFirma, price: String(P.firma.einzeln / 100), priceCurrency: "EUR", url: `https://fiaon.com${BESTELLEN_FIRMA}` },
      ],
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t.ldName, t.ldArt, t.ldFirma, P.privat.einzeln, P.firma.einzeln]);

  const leistung = t.leistung(art, land, bei(land));
  // E-241: die Worte für Preiszeile, Abschluss und Kaufleiste der Seitenfamilie — in der Sprache der Seite.
  const worte: BxEigeneWorte = {
    einzeln, einmal: t.preisZeileEinmal, mitPaket: t.preisMitPaket(mitPaket), steuer: t.preisSteuer,
    leisteWas: t.leisteWas, leistePaket: t.leistePaket(mitPaket), leisteKnopf: t.leisteKnopf,
  };
  const preisDerArt = art === "firma"
    ? t.leistungPreis(euro(P.firma.einzeln), euro(P.firma.mitAbo))
    : t.leistungPreis(einzeln, mitPaket);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen}
        krumen={en ? [{ name: t.krume, pfad }] : [{ name: t.krumeFamilie, pfad: "/bonitaetsauskunft" }, { name: t.krume, pfad }]} />

      <div className="bx">
      <BxHero
        seite={null} bild="/kino/akten.jpg" krume={t.krume} familie={!en}
        krumen={en ? <nav className="bx-krumen" aria-label="Breadcrumbs"><a href="/en">FIAON</a><i aria-hidden="true">/</i><span aria-current="page">{t.krume}</span></nav> : undefined}
        pille={t.pille} h1a={t.h1a.trim()} h1b={t.h1b} lead={t.lead(einzeln, mitPaket)}
        preis={<PreisZeile eigen={worte} />}
        knoepfe={<>
          <Knopf href={BESTELLEN}>{t.antragStarten}</Knopf>
          <Knopf href={BESTELLEN_FIRMA} still>{t.fuerFirmen}</Knopf>
        </>}
      />

      <Licht>
        <Block schmal titel={t.vergleichTitel} lead={t.vergleichLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.kopf.map((k, i) => <th key={i} scope="col">{k || "\u00a0"}</th>)}</tr></thead>
              <tbody>{[t.preisZeile(einzeln, mitPaket), ...t.zeilen].map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            {t.gratisA}<a href={zu("/werkzeuge/selbstauskunft")} style={{ color: "#1d4ed8" }}>{t.gratisLink1}</a>{t.gratisB}<a href={zu("/werkzeuge/eintrag-pruefen")} style={{ color: "#1d4ed8" }}>{t.gratisLink2}</a>{t.gratisC}
          </p>
        </Block>

        {/* ── WAS GELIEFERT WIRD — JE LAND UND ART (E-240) ───────────────────
            Dieselbe Liste wie in Mail, Kundenbereich und Maras Wissen
            (auskunftLeistung). Wer in Österreich wohnt, sieht KSV1870 und CRIF —
            nicht „SCHUFA". */}
        <Block schmal mitte titel={t.leistungTitel} lead={t.leistungLead}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <div className="sx-umschalter" role="group" aria-label={t.leistungTitel}>
              {LAENDER.map((l) => <button key={l} type="button" className={land === l ? "an" : ""} aria-pressed={land === l} onClick={() => setLand(l)}>{t.laender[l]}</button>)}
            </div>
            <div className="sx-umschalter" role="group" aria-label={t.fuerFirmen}>
              {ARTEN.map((a) => <button key={a} type="button" className={art === a ? "an" : ""} aria-pressed={art === a} onClick={() => setArt(a)}>{t.arten[a]}</button>)}
            </div>
          </div>
          <Auf>
            <div className="sx-preis" style={{ maxWidth: 560 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff" }}>{preisDerArt}</p>
              <ul className="zeilen">
                {leistung.map((z) => <li key={z}><Haken />{z}</li>)}
              </ul>
              <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 22 }}>
                {/* Art und Land gehen mit: /bonitaet-antrag liest ?art= und ?land= vor. */}
                <Knopf href={`${BESTELLEN}?art=${art}&land=${land}`}>{t.antragStarten}</Knopf>
              </div>
            </div>
          </Auf>
        </Block>

        <Block schmal titel={t.ablaufTitel} lead={t.ablaufLead}>
          <Auf>
            <div className="sx-zeitleiste">
              {t.ablauf.map((e, i) => (
                <div key={e.titel} className="sx-etappe">
                  <div className="spur"><span className="punkt">{i + 1}</span>{i < t.ablauf.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{e.dauer}</span><h3>{e.titel}</h3><p>{e.text}</p></div>
                </div>
              ))}
            </div>
          </Auf>
        </Block>

        <Block schmal mitte titel={t.erhaltenTitel} lead={t.erhaltenLead}>
          <Auf>
            <div className="sx-dokument" role="img" aria-label={t.dokumentAria}>
              <div className="kopf"><b>{t.dokumentTitel}</b><span>{t.dokumentBeispiel}</span></div>
              <div className="rumpf">
                {t.dokumentZeilen.map((z) => <div key={z[0]} className="zeile"><span>{z[0]}</span><b className={z[2] || undefined}>{z[1]}</b></div>)}
              </div>
            </div>
          </Auf>
        </Block>

        <Block schmal mitte titel={t.preisTitel}>
          <Auf>
            <div className="sx-preis">
              <div className="betrag">{einzeln}<small>{t.preisEinmalig}</small></div>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(226, 236, 250, .85)" }}>{t.preisMitPaket(mitPaket)}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(196, 216, 246, .7)" }}>{t.preisFirma(euro(P.firma.einzeln), euro(P.firma.mitAbo))}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(196, 216, 246, .6)" }}>{t.preisSteuer}</p>
              <ul className="zeilen">
                {t.preisZeilen.map((z) => <li key={z}><Haken />{z}</li>)}
              </ul>
              <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 22 }}>
                <Knopf href={BESTELLEN}>{t.antragStarten}</Knopf>
                <Knopf href={BESTELLEN_FIRMA} still>{t.fuerFirmen}</Knopf>
              </div>
            </div>
          </Auf>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            {t.weiterlesen}
            {t.weiterLinks.map((l, i) => <span key={l.href}><a href={zu(l.href)} style={{ color: "#1d4ed8" }}>{l.t}</a>{i < t.weiterLinks.length - 1 ? " · " : ". "}</span>)}
            {t.fussSatz}
          </p>
          {t.familieLinks.length > 0 && (
            <p className="bx-antrag-mehr">
              {t.familieSatz}
              {t.familieLinks.map((l, i) => <span key={l.href}><a href={l.href}>{l.t}</a>{i < t.familieLinks.length - 1 ? " · " : ""}</span>)}
            </p>
          )}
        </Block>
      </Licht>

      {/* ── DER ABSCHLUSS (E-241): wie die Seitenfamilie — mit den Worten dieser Seite, in beiden Sprachen. ── */}
      <BxSchluss eigen={{ ...worte, pille: t.schlussPille, titel: t.aufrufTitel, satz: t.aufrufSatz(einzeln, mitPaket), knopf: t.antragStarten, knopf2: { text: t.kostenlosPruefen, href: zu("/kontakt") }, fuss: t.aufrufFuss }} />
      </div>
      <KaufLeiste eigen={worte} />
    </Dunkel>
  );
}
