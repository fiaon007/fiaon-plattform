// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft — DIE BAUSTEINE DER SEITENFAMILIE (25.09.2026, E-241)
//
// Justin: „Die Boni-Seite komplett überarbeiten und mehrere Seiten anlegen,
// dass, wenn man auf Bonitätsauskunft geht, alles perfekt ist — wirklich HIGH
// END, der ganze Ablauf, und wir direkt verkaufen können."
//
// ── DER RAHMEN JEDER SEITE (BxRahmen) ─────────────────────────────────────
//   dunkler Kopf (Bild, Brotkrumen, H1, Preis, Knöpfe) mit der Unternavigation
//   → heller Mittelteil (Licht) mit Inhalt links und der Bestellkarte rechts
//   → dunkler Abschluss → am Handy die Kaufleiste unten.
// Der Kaufweg ist überall EIN Klick: jeder Knopf führt auf /bonitaet-antrag
// (E-240, der eine Bestellweg), mit ?art= und ?land=, wo die Seite sie kennt.
//
// ── DIE EINE NAVY-GLAS-FLÄCHE (justin-design-geschmack) ───────────────────
// Auf den Unterseiten ist es die Bestellkarte in der Seitenleiste, auf der
// Übersicht die Preistafel im Kopf. Alles andere ist matt: Haarlinien,
// Weißraum, dünne Schrift. Der Grund hinter dem Glas ist statisch.
//
// ── SCROLLEN ──────────────────────────────────────────────────────────────
// Auf den Privatseiten scrollt #root, nicht das Fenster (index.css) — deshalb
// arbeitet die Kaufleiste mit IntersectionObserver statt window.scrollY, und
// sie sitzt per Portal an <body> (main trägt z-index 1, der Fuß läge sonst darüber).
//
// ── MESSUNG ───────────────────────────────────────────────────────────────
// Die Übersicht meldet Meta ein ViewContent mit content_category „auskunft"
// (META_PRODUKT) — nur mit Marketing-Einwilligung und geladenem Pixel;
// metaEreignis prüft beides selbst (client/src/lib/werbung.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dunkel, Licht, Knopf, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { metaEreignis, einwilligungLesen, EINWILLIGUNG_EREIGNIS } from "@/lib/werbung";
import { META_PRODUKT } from "@shared/fiaon-meta-ereignisse";
import { seoSeite } from "@shared/fiaon-seo-seiten";
import {
  AUSKUNFT_PREISE_CENTS, auskunfteienFuer, auskunftLand, auskunftLeistung, type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { landErkennen } from "@/lib/land-erkennen";
import {
  BX, BX_BEISPIEL, BX_FAMILIE, BX_PFAD, BX_PREIS, BX_SCHRITTE, bestellPfad, bxPreis, kundenpreisPfad, type BxSeite,
} from "@/i18n/bonitaetsauskunft-familie";
import type { BxFrage } from "@/i18n/bonitaetsauskunft-fragen";
import "@/styles/bonitaetsauskunft.css";

// Dunkel kennt „bonitaetsauskunft" nicht in seiner Seitenliste (DunkleBuehne.tsx gehört
// nicht zu E-241). Der Wert geht unverändert als activePage an GlassNav — das ihn seit
// E-241 kennt und den Menüpunkt „Bonitätsauskunft" hervorhebt.
const SEITE_IM_MENUE = "bonitaetsauskunft" as unknown as "ratgeber";
const URSPRUNG = "https://fiaon.com";

// ── Zeichen (selbst gezeichnet, 1,5 px, currentColor — AGENTS.md) ─────────
export function Pfeil({ gross = false }: { gross?: boolean }) {
  const g = gross ? 18 : 15;
  return <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
export function Haken() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
}

// ═══════════════════════════════════════════════════════════════════════════
// KOPF
// ═══════════════════════════════════════════════════════════════════════════
function Krumen({ seite, krume }: { seite: BxSeite | null; krume?: string }) {
  return (
    <nav className="bx-krumen" aria-label="Brotkrumen">
      <a href="/">FIAON</a><i aria-hidden="true">/</i>
      {seite === "hub"
        ? <span aria-current="page">Bonitätsauskunft</span>
        : <><a href={BX_PFAD.hub}>Bonitätsauskunft</a><i aria-hidden="true">/</i><span aria-current="page">{krume}</span></>}
    </nav>
  );
}

/** Die Unternavigation — unten im Kopf, auf jeder Seite der Familie gleich. */
export function Familie({ aktiv }: { aktiv: BxSeite | null }) {
  const spur = useRef<HTMLDivElement>(null);
  // Am Handy läuft die Leiste seitlich — der aktive Punkt rückt in die Mitte,
  // ohne die Seite senkrecht zu bewegen (kein scrollIntoView).
  useEffect(() => {
    const s = spur.current;
    const a = s?.querySelector<HTMLElement>('[aria-current="page"]');
    if (s && a && s.scrollWidth > s.clientWidth) s.scrollLeft = Math.max(0, a.offsetLeft - (s.clientWidth - a.offsetWidth) / 2);
  }, [aktiv]);
  return (
    <nav className="bx-familie" aria-label={BX.familieAria}>
      <div className="bx-rahmen">
        <div className="bx-familie-spur" ref={spur}>
          {BX_FAMILIE.map((e) => (
            <a key={e.seite} href={BX_PFAD[e.seite]} aria-current={aktiv === e.seite ? "page" : undefined}>{e.kurz}</a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function BxHero({ seite, bild, krume, krumen, pille, h1a, h1b, lead, preis, knoepfe, fakten, instrument, familie = true }: {
  /** null = eine Seite außerhalb der Familie (z. B. /bonitaetsauskunft-beantragen). */
  seite: BxSeite | null; bild: string; krume?: string;
  /** Eigene Brotkrumen statt „FIAON / Bonitätsauskunft / …" (englische Seite). */
  krumen?: ReactNode;
  pille: string; h1a: string; h1b: string; lead: string;
  preis?: ReactNode; knoepfe: ReactNode; fakten?: string[]; instrument?: ReactNode;
  /** false = ohne Unternavigation (die Familie gibt es nur auf Deutsch). */
  familie?: boolean;
}) {
  return (
    <section className={`bx-hero${instrument ? " mit-instrument" : ""}`}>
      <div className="dk-hero-bild" aria-hidden="true">
        <img src={bild} alt="" decoding="async" {...({ fetchpriority: "high" } as any)} />
        <div className="schleier" />
      </div>
      <div className="bx-rahmen bx-hero-raster">
        <div className="bx-hero-text bx-rein">
          {krumen ?? <Krumen seite={seite} krume={krume} />}
          <span className="dk-pille">{pille}</span>
          {/* Der Text der H1 ist „h1a h1b" — genau so steht er in shared/fiaon-seo-seiten.ts. */}
          <h1 className="bx-h1">{h1a} <span className="zwei">{h1b}</span></h1>
          <p className="bx-lead">{lead}</p>
          {preis}
          <div className="bx-knoepfe">{knoepfe}</div>
          {fakten && (
            <ul className="bx-fakten">{fakten.map((f) => <li key={f}><Haken />{f}</li>)}</ul>
          )}
        </div>
        {instrument && <div className="bx-hero-instrument bx-rein spaet">{instrument}</div>}
      </div>
      {familie && <Familie aktiv={seite} />}
    </section>
  );
}

/**
 * Der Weg zum Kundenpreis am Preis (26.09.2026, E-243): „Schon FIAON-Kunde? Kundenpreis-Link
 * anfordern" → /bonitaet-antrag?kunde=1. Nur auf den deutschen Seiten der Familie — die
 * zweisprachige Seite (eigene Worte, `eigen`) bekommt ihn nur, wenn sie ihn selbst mitbringt.
 */
export function KundenpreisLink({ art, land, eigen, className, stil }: {
  art: AuskunftArt; land?: AuskunftLand; eigen?: BxEigeneWorte; className?: string; stil?: CSSProperties;
}) {
  const text = eigen ? eigen.kundenpreis : BX.kundenpreisLink;
  if (!text) return null;
  return <a className={className} style={stil} href={kundenpreisPfad(art, land)}>{text}</a>;
}
const LINK_IM_KOPF: CSSProperties = { color: "inherit", textDecoration: "underline", textDecorationColor: "rgba(147,197,253,.45)", textUnderlineOffset: 3 };

/** Die Preiszeile im Kopf: beide Preise nebeneinander, nie als Streichpreis (PAngV § 11). */
export function PreisZeile({ art = "privat", eigen }: { art?: AuskunftArt; eigen?: BxEigeneWorte }) {
  const p = bxPreis(art);
  const e = eigen ?? {};
  return (
    <div className="bx-preiszeile">
      <p><b className="zahl">{e.einzeln ?? p.einzeln}</b><span>{e.einmal ?? BX.karteEinmal}</span></p>
      <p className="zweit">{e.mitPaket ?? BX.preisMitPaket(p.paket)}</p>
      <p className="steuer">{e.steuer ?? BX_PREIS.steuer}</p>
      {/* E-243: der Kundenpreis-Link direkt unter dem Preis. */}
      {(!eigen || eigen.kundenpreis) && (
        <p className="zweit" style={{ marginTop: 10 }}><KundenpreisLink art={art} eigen={eigen} stil={LINK_IM_KOPF} /></p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MITTELTEIL
// ═══════════════════════════════════════════════════════════════════════════
export function Abschnitt({ id, marke, titel, text, children }: {
  id?: string; marke: string; titel: string; text?: ReactNode; children?: ReactNode;
}) {
  return (
    <section id={id} className="bx-abschnitt">
      <Auf>
        <p className="bx-marke">{marke}</p>
        <h2 className="bx-h2">{titel}</h2>
        {text && <p className="bx-text">{text}</p>}
      </Auf>
      {children}
    </section>
  );
}

/**
 * Die Länderwahl einer Seite mit Schalter (Übersicht, Unternehmen) — Gegenlesen E-241.
 * Vorher trug jeder Kaufknopf dort ?land=DE, auch wenn niemand gewählt hatte. Die Bestellseite
 * erkennt das Land aber nur OHNE ?land= selbst (IP, dann Gerät — lib/land-erkennen.ts): Ein
 * Besucher aus Wien landete so auf „Deutschland" mit der Vollmacht für SCHUFA, CRIF und
 * Boniversum. Jetzt zeigt die Seite das erkannte Land (derselbe Vorschlag wie auf der
 * Bestellseite), und der Link trägt ?land= nur, wenn der Mensch selbst gewählt hat.
 */
export function useLandWahl() {
  const [land, setzeLand] = useState<AuskunftLand>("DE");
  const [gewaehlt, setGewaehlt] = useState(false);
  const beruehrt = useRef(false);
  useEffect(() => {
    let weg = false;
    landErkennen()
      .then((l) => { if (!weg && !beruehrt.current && l) setzeLand(auskunftLand(l)); })
      .catch(() => { /* bleibt Deutschland */ });
    return () => { weg = true; };
  }, []);
  const setLand = (l: AuskunftLand) => { beruehrt.current = true; setGewaehlt(true); setzeLand(l); };
  return { land, setLand, linkLand: gewaehlt ? land : undefined };
}

/** Eine Wahl aus zwei oder drei — hell (Mittelteil) oder dunkel (Tafel im Kopf). */
export function Schalter<W extends string>({ werte, wert, setze, namen, aria, dunkel = false }: {
  werte: readonly W[]; wert: W; setze: (w: W) => void; namen: Record<W, string>; aria: string; dunkel?: boolean;
}) {
  return (
    <div className={`bx-schalter${dunkel ? " dunkel" : ""}`} role="group" aria-label={aria}>
      {werte.map((w) => (
        <button key={w} type="button" aria-pressed={w === wert} onClick={() => setze(w)}>{namen[w]}</button>
      ))}
    </div>
  );
}

/** Die Leistung — wörtlich aus shared/fiaon-auskunft.ts (dieselbe Liste wie Bestellseite, Mail und Mara). */
export function LeistungListe({ art, land }: { art: AuskunftArt; land: AuskunftLand }) {
  return (
    <ol className="bx-leistung">
      {auskunftLeistung(art, land).map((z) => <li key={z}><span>{z}</span></li>)}
    </ol>
  );
}

/** Die Auskunfteien eines Landes mit Ort und Rechtsgrundlage — nur Anschriften, die das Haus kennt. */
export function Stellen({ land }: { land: AuskunftLand }) {
  return (
    <div className="bx-stellen">
      {auskunfteienFuer(land).map((a) => (
        <div key={a.key} className="bx-stelle">
          <div><b>{a.kurz}</b><span>{a.name} · {a.anschrift[1].replace(/^\d+\s*/, "")}</span></div>
          <em>Datenkopie nach {a.recht}</em>
        </div>
      ))}
    </div>
  );
}

/** Die vier Schritte als Weg. */
export function WegSchritte() {
  return (
    <ol className="bx-weg">
      {BX_SCHRITTE.map((s, i) => (
        <li key={s.titel} className="bx-schritt">
          <span className="n zahl" aria-hidden="true">{i + 1}</span>
          <div>
            <span className="wann">{s.wann}</span>
            <h3>{s.titel}</h3>
            <p>{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Das Beispiel eines Handlungsplans — erfunden und als solches gekennzeichnet. */
export function BeispielPlan() {
  const b = BX_BEISPIEL;
  return (
    <figure className="bx-papier" aria-label={b.aria}>
      <div className="bx-papier-kopf">
        <div><b>{b.kopf}</b><span>{b.fuer}</span></div>
        <span className="bx-stempel">{b.stempel}</span>
      </div>
      <div className="bx-papier-tabelle" role="table" aria-label={b.kopf}>
        <div className="kopfzeile" role="row">{b.spalten.map((s) => <span key={s} role="columnheader">{s}</span>)}</div>
        {b.zeilen.map((z) => (
          <div key={z.eintrag} className="zeile" role="row">
            <span role="cell" className="eintrag"><small>{z.stelle}</small>{z.eintrag}</span>
            <span role="cell"><em className={`bx-chip ${z.ton}`}>{z.einordnung}</em></span>
            <span role="cell" className="schritt">{z.schritt}</span>
          </div>
        ))}
      </div>
      <div className="bx-papier-plan">
        <p className="titel">{b.planTitel}</p>
        <ol>{b.plan.map((p) => <li key={p}>{p}</li>)}</ol>
      </div>
      <figcaption>{b.fuss}</figcaption>
    </figure>
  );
}

export function Weiterlesen({ links }: { links: { href: string; t: string }[] }) {
  return (
    <nav className="bx-weiterlesen" aria-label={BX.weiterlesen}>
      <p className="bx-marke">{BX.weiterlesen}</p>
      <ul>{links.map((l) => <li key={l.href}><a href={l.href}><span>{l.t}</span><Pfeil /></a></li>)}</ul>
      <p className="bx-stand">{BX.stand}</p>
    </nav>
  );
}

/** Zwischenruf im Mittelteil: ein Satz, ein Knopf. */
export function Band({ satz, art = "privat", land }: { satz: string; art?: AuskunftArt; land?: AuskunftLand }) {
  const p = bxPreis(art);
  // Gegenlesen E-241: Die Klasse am Rahmen erlaubt dem folgenden Abschnitt, seine Haarlinie
  // wegzulassen — sonst lag sie 8 px unter dem Rand des Bands (doppelte Linie).
  return (
    <Auf className="bx-band-rahmen">
      <div className="bx-band">
        <p>{satz}<span>{p.einzeln} {BX.preisEinmal} · {BX.preisMitPaket(p.paket)}</span></p>
        <Knopf href={bestellPfad(art, land)}>{art === "firma" ? BX.knopfBestellenFirma : BX.knopfBestellen}</Knopf>
      </div>
    </Auf>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SEITENLEISTE: DIE BESTELLKARTE (die Navy-Glas-Fläche der Unterseiten)
// ═══════════════════════════════════════════════════════════════════════════
export function Bestellkarte({ art, land, aktiv }: { art: AuskunftArt; land: AuskunftLand | null; aktiv: BxSeite }) {
  const p = bxPreis(art);
  return (
    <aside className="bx-leiste" aria-label={art === "firma" ? BX.karteTagFirma : BX.karteTag}>
      <div className="bx-karte">
        <span className="tag">{art === "firma" ? BX.karteTagFirma : BX.karteTag}</span>
        <div className="betrag"><b className="zahl">{p.einzeln}</b><span>{BX.karteEinmal}</span></div>
        <p className="paket">{BX.kartePaket(p.paket)}</p>
        <p className="steuer">{BX_PREIS.steuer}</p>
        {art === "firma" && (<>
          <p className="unter">{BX.karteFirmaBei}</p>
          <div className="bx-chips"><span>Creditreform</span><span>CRIF</span></div>
        </>)}
        {land ? (<>
          <p className="unter">{art === "firma" ? BX.kartePersoenlich : BX.karteBei}</p>
          <div className="bx-chips">{auskunfteienFuer(land).map((a) => <span key={a.key}>{a.kurz}</span>)}</div>
        </>) : (
          <p className="alle">{art === "firma" ? BX.karteAlleFirma : BX.karteAlle}</p>
        )}
        <ul>{BX.kartePunkte.map((z) => <li key={z}><Haken /><span>{z}</span></li>)}</ul>
        <a className="bx-karte-knopf" href={bestellPfad(art, land ?? undefined)}>
          {art === "firma" ? BX.knopfBestellenFirma : BX.knopfBestellen}<Pfeil />
        </a>
        {/* E-243: Kunden mit laufendem Paket direkt zum Kundenpreis-Link. */}
        <KundenpreisLink art={art} land={land ?? undefined} className="bx-karte-leise" />
        {aktiv !== "ablauf" && <a className="bx-karte-leise" href={BX_PFAD.ablauf}>{BX.karteAblauf}</a>}
      </div>
      <nav className="bx-seiten" aria-label={BX.karteSeitenTitel}>
        <p>{BX.karteSeitenTitel}</p>
        <div>
          {BX_FAMILIE.filter((e) => e.seite !== aktiv).map((e) => (
            <a key={e.seite} href={BX_PFAD[e.seite]} title={e.satz}>{e.kurz}</a>
          ))}
        </div>
      </nav>
    </aside>
  );
}

/** Am Ende des Mittelteils: zurück und weiter in der Familie. */
function WeiterInDerFamilie({ aktiv }: { aktiv: BxSeite }) {
  const i = BX_FAMILIE.findIndex((e) => e.seite === aktiv);
  const vor = i > 0 ? BX_FAMILIE[i - 1] : null;
  const nach = i >= 0 && i < BX_FAMILIE.length - 1 ? BX_FAMILIE[i + 1] : BX_FAMILIE[0];
  return (
    <nav className="bx-blaettern" aria-label={BX.weiterTitel}>
      {vor ? (
        <a href={BX_PFAD[vor.seite]} className="zurueck">
          <small>{BX.zurueck}</small><b>{vor.kurz}</b><span>{vor.satz}</span>
        </a>
      ) : <span />}
      {nach && nach.seite !== aktiv && (
        <a href={BX_PFAD[nach.seite]} className="vor">
          <small>{BX.weiter}</small><b>{nach.kurz}</b><span>{nach.satz}</span>
        </a>
      )}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABSCHLUSS UND KAUFLEISTE
// ═══════════════════════════════════════════════════════════════════════════
/** Eigene Worte für Abschluss und Kaufleiste — für die zweisprachige Seite /bonitaetsauskunft-beantragen. */
export interface BxEigeneWorte {
  pille?: string; titel?: string; satz?: string; einzeln?: string; einmal?: string; mitPaket?: string; steuer?: string;
  knopf?: string; knopf2?: { text: string; href: string }; fuss?: string;
  leisteWas?: string; leistePaket?: string; leisteKnopf?: string;
  /** E-243: der Satz zum Kundenpreis-Link — ohne ihn zeigt eine Seite mit eigenen Worten keinen. */
  kundenpreis?: string;
}

export function BxSchluss({ art = "privat", land, eigen }: { art?: AuskunftArt; land?: AuskunftLand; eigen?: BxEigeneWorte }) {
  const p = bxPreis(art);
  const e = eigen ?? {};
  const zweiter = e.knopf2 ?? { text: BX.knopfFragen, href: BX_PFAD.fragen };
  return (
    <section className="bx-schluss">
      <div className="bx-schluss-licht" aria-hidden="true" />
      <div className="bx-rahmen">
        <Auf>
          <span className="dk-pille">{e.pille ?? BX.schlussPille}</span>
          <h2>{e.titel ?? BX.schlussTitel}</h2>
          <p className="satz">{e.satz ?? (art === "firma" ? BX.schlussSatzFirma : BX.schlussSatz)}</p>
          <p className="preis"><b className="zahl">{e.einzeln ?? p.einzeln}</b><span>{e.einmal ?? BX.preisEinmal}</span><i aria-hidden="true">·</i><span>{e.mitPaket ?? BX.preisMitPaket(p.paket)}</span></p>
          <p className="steuer">{e.steuer ?? BX_PREIS.steuer}</p>
          <div className="bx-knoepfe mitte">
            <Knopf href={bestellPfad(art, land)}>{e.knopf ?? (art === "firma" ? BX.knopfBestellenFirma : BX.knopfBestellen)}</Knopf>
            <Knopf href={zweiter.href} still>{zweiter.text}</Knopf>
          </div>
          {/* E-243: der Weg zum Kundenpreis unter den Knöpfen (nicht auf Seiten mit eigenen Worten ohne Satz). */}
          <KundenpreisLink art={art} land={land} eigen={eigen} className="bx-karte-leise" stil={{ marginTop: 16 }} />
          <p className="fuss">{e.fuss ?? BX.schlussFuss}</p>
        </Auf>
      </div>
    </section>
  );
}

/**
 * Am Handy (und Tablet) der Kaufweg in einem Tipp: erscheint, sobald der Kopf
 * aus dem Bild ist, und geht, sobald der Abschluss kommt — dort stehen dieselben Knöpfe.
 */
export function KaufLeiste({ art = "privat", land, eigen }: { art?: AuskunftArt; land?: AuskunftLand; eigen?: BxEigeneWorte }) {
  const [da, setDa] = useState(false);
  const [ziel, setZiel] = useState<HTMLElement | null>(null);
  useEffect(() => { setZiel(document.body); }, []);
  useEffect(() => {
    const kopf = document.querySelector(".bx-hero");
    const schluss = document.querySelector(".bx-schluss");
    if (!kopf || !schluss || typeof IntersectionObserver === "undefined") return;
    let kopfSichtbar = true;
    let schlussNah = false;
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (e.target === kopf) kopfSichtbar = e.isIntersecting;
        // Abschluss im Bild ODER schon darüber (dann ist der Fuß im Bild).
        if (e.target === schluss) schlussNah = e.isIntersecting || e.boundingClientRect.top < 0;
      }
      setDa(!kopfSichtbar && !schlussNah);
    }, { rootMargin: "-30% 0px 0px 0px", threshold: 0 });
    io.observe(kopf); io.observe(schluss);
    return () => io.disconnect();
  }, []);
  if (!ziel) return null;
  const p = bxPreis(art);
  const e = eigen ?? {};
  return createPortal(
    <div className={`bx-kaufleiste${da ? " da" : ""}`} aria-hidden={!da}>
      <div className="was">
        <span>{e.leisteWas ?? (art === "firma" ? BX.leisteWasFirma : BX.leisteWas)}</span>
        <b>{e.einzeln ?? p.einzeln}<small> · {e.leistePaket ?? BX.leistePaket(p.paket)}</small></b>
      </div>
      <a href={bestellPfad(art, land)} tabIndex={da ? 0 : -1}>{e.leisteKnopf ?? BX.leisteKnopf}<Pfeil /></a>
    </div>,
    ziel,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUKTURIERTE DATEN UND MESSUNG
// ═══════════════════════════════════════════════════════════════════════════
/** Service-Markup mit beiden Preisen je Art — nur, was sichtbar auf der Seite steht. */
function ServiceLd({ arten, land, pfad, name }: { arten: AuskunftArt[]; land?: AuskunftLand; pfad: string; name: string }) {
  const schluessel = `${arten.join(",")}|${land ?? ""}|${pfad}`;
  useEffect(() => {
    const angebote = arten.flatMap((a) => {
      const pr = AUSKUNFT_PREISE_CENTS[a];
      const was = a === "firma" ? "Bonitätsauskunft für Unternehmen" : "Bonitätsauskunft";
      const url = `${URSPRUNG}${bestellPfad(a, land)}`;
      return [
        { "@type": "Offer", name: `${was} — einzeln`, price: (pr.einzeln / 100).toFixed(2), priceCurrency: "EUR", url, availability: "https://schema.org/InStock" },
        { "@type": "Offer", name: `${was} — Kundenpreis mit laufendem FIAON-Paket`, price: (pr.mitAbo / 100).toFixed(2), priceCurrency: "EUR", url, availability: "https://schema.org/InStock",
          description: "Gilt für Kundinnen und Kunden mit einem laufenden, bezahlten FIAON-Paket." },
      ];
    });
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-seo", "seite");
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name,
      serviceType: "Anforderung und Erklärung von Bonitätsauskünften (Datenkopien) mit Handlungsplan und fertigen Schreiben",
      provider: { "@type": "Organization", name: "FIAON", url: URSPRUNG },
      areaServed: land ? [land] : ["DE", "AT", "CH"],
      url: `${URSPRUNG}${pfad}`,
      offers: angebote,
    });
    document.head.appendChild(el);
    return () => el.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, name]);
  return null;
}

/**
 * ViewContent für Meta (E-241): Die Übersicht ist die Landeseite der Auskunft-Anzeigen.
 * Der Pixel lädt erst nach der Einwilligung und nach einer Abfrage — deshalb ein paar
 * späte Versuche und ein zweiter Anlauf, wenn die Einwilligung auf dieser Seite fällt.
 * Einmal je Seitenaufruf.
 */
export function useAuskunftAnsicht(seite: BxSeite) {
  useEffect(() => {
    let gemeldet = false;
    const ref = `auskunft.${seite}.${Math.round(Date.now() / 60000)}`;
    const melden = () => {
      if (gemeldet) return;
      const pixel = (window as unknown as { fbq?: unknown }).fbq;
      if (!einwilligungLesen()?.marketing || !pixel) return;
      gemeldet = true;
      metaEreignis("ViewContent", ref, {
        content_category: META_PRODUKT.auskunft,
        content_name: "Bonitätsauskunft",
        value: AUSKUNFT_PREISE_CENTS.privat.einzeln / 100,
      });
    };
    const uhren: number[] = [];
    const versuchen = () => { melden(); for (const ms of [700, 2000, 5000]) uhren.push(window.setTimeout(melden, ms)); };
    versuchen();
    window.addEventListener(EINWILLIGUNG_EREIGNIS, versuchen);
    return () => { uhren.forEach((u) => window.clearTimeout(u)); window.removeEventListener(EINWILLIGUNG_EREIGNIS, versuchen); };
  }, [seite]);
}

// ═══════════════════════════════════════════════════════════════════════════
// DER RAHMEN
// ═══════════════════════════════════════════════════════════════════════════
export function BxRahmen({ seite, krume, art = "privat", land, arten, fragen, hero, leiste = true, children }: {
  seite: BxSeite;
  /** Name der Seite in den Brotkrumen (Unterseiten). */
  krume?: string;
  /** Für Bestellkarte, Kaufleiste und Abschluss. */
  art?: AuskunftArt;
  land?: AuskunftLand;
  /** Welche Angebote das Service-Markup trägt (Standard: die Art der Seite). */
  arten?: AuskunftArt[];
  /** Die sichtbaren Fragen der Seite → FAQPage. */
  fragen?: BxFrage[];
  hero: ReactNode;
  /** false = ohne Seitenleiste (Übersicht: die Tafel steht im Kopf). */
  leiste?: boolean;
  children: ReactNode;
}) {
  const pfad = BX_PFAD[seite];
  const eintrag = seoSeite(pfad);
  const krumen = seite === "hub"
    ? [{ name: "Bonitätsauskunft", pfad }]
    : [{ name: "Bonitätsauskunft", pfad: BX_PFAD.hub }, { name: krume ?? "", pfad }];
  return (
    <Dunkel seite={SEITE_IM_MENUE} titel={eintrag?.titel ?? "Bonitätsauskunft"} beschreibung={eintrag?.beschreibung ?? ""}>
      <SeoDaten pfad={pfad} titel={eintrag?.titel ?? ""} beschreibung={eintrag?.beschreibung ?? ""} fragen={fragen} krumen={krumen} />
      <ServiceLd arten={arten ?? [art]} land={land} pfad={pfad} name={art === "firma" ? "FIAON-Bonitätsauskunft für Unternehmen" : "FIAON-Bonitätsauskunft mit Handlungsplan"} />
      <div className="bx">
        {hero}
        <Licht>
          <div className="bx-rahmen">
            <div className={`bx-bahn${leiste ? "" : " ohne-leiste"}`}>
              <div className="bx-haupt">{children}<WeiterInDerFamilie aktiv={seite} /></div>
              {leiste && <Bestellkarte art={art} land={land ?? null} aktiv={seite} />}
            </div>
          </div>
        </Licht>
        <BxSchluss art={art} land={land} />
      </div>
      <KaufLeiste art={art} land={land} />
    </Dunkel>
  );
}
