// ═══════════════════════════════════════════════════════════════════════════
// /partnernetzwerk (+ /vorsorge /recht /steuern /energie /telekommunikation) · /en/partner-network/… (E-388, 16.10.2026)
//
// Justin: „mach eine eigene Seite für die Privatkunden — Vermögensberater, Rechtsanwälte, Steuerberater, Energieversorger …
// wo die sich bei uns bewerben können, Vorteile für den Kunden und für den Dienstleister … richtig schöne Seiten, gut
// erklärt und cinematisch mit vielen Animationen“ + „auf der Seite einen Demo-Zugang“.
//
// Eine Komponente für Hub und fünf Bereiche (der Pfad entscheidet). Aufbau je Bereich: Kino-Hero mit Lichtfäden und
// schwebenden Chips → Bereichsleiste → Vorteile für Kunden → Brücke Kunde ↔ FIAON ↔ Partner → Vorteile für Partner →
// Zeitstrahl → Preis-Glas → Anforderungen → Demo-Bildschirm → Fragen → Bewerbung → Abschluss.
// Preise: shared/fiaon-partnernetz.ts · Texte: client/src/i18n/partnernetz.ts · Demo: /partner/demo (koop-partner.tsx).
// Bewegung: CSS (styles/partnernetz.css), bei prefers-reduced-motion still.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Dunkel, Block, Auf, Knopf, Fragen, Abschluss, Anfrage } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { PARTNERNETZ_WOERTER, type NetzKarte, type NetzSeite, type NetzSymbol } from "@/i18n/partnernetz";
import { NETZ_BEREICHE, NETZ_PFAD, NETZ_BEREICH_NAME, netzBereichAusPfad, netzDemoPfad, type NetzBereich } from "@shared/fiaon-partnernetz";
import "@/styles/partnernetz.css";

const BILD: Record<NetzBereich | "hub", string> = {
  hub: "/kino/partnernetz-netz.jpg", vorsorge: "/kino/partnernetz-vorsorge.jpg", recht: "/kino/partnernetz-recht.jpg",
  steuern: "/kino/partnernetz-steuern.jpg", energie: "/kino/partnernetz-energie.jpg", telekom: "/kino/partnernetz-telekom.jpg",
};

/** Feine Linien-Symbole, 24er Raster, Strichstärke 1.6 — eine Familie für alle Seiten des Netzwerks. */
const PFADE: Record<NetzSymbol, ReactNode> = {
  termin: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h3" /></>,
  schild: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  herz: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  waage: <><path d="M12 4v16M7 20h10M5 8h14" /><path d="m5 8-2.5 6a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" /></>,
  beleg: <><path d="M6 3h9l3 3v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21V3Z" /><path d="M9 9h6M9 13h6" /></>,
  blitz: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  funk: <><path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0" /><circle cx="12" cy="12" r="1.2" /><path d="M12 13v8" /></>,
  uhr: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  haken: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  pfad: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" /></>,
  rechnung: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  menge: <><path d="M4 20V10M10 20V5M16 20v-8M22 20H2" /></>,
  auge: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  hand: <><path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7" /><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 14.5V11a1.5 1.5 0 0 1 3 0" /></>,
  netz: <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M11 6.8 6 15.2M13 6.8l5 8.4M7 17h10" /></>,
  stern: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" />,
};
function Zeichen({ s, gross = false }: { s: NetzSymbol; gross?: boolean }) {
  return (
    <span className={`pn-zeichen${gross ? " gross" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{PFADE[s]}</svg>
    </span>
  );
}
const BEREICH_ZEICHEN: Record<NetzBereich, NetzSymbol> = { vorsorge: "herz", recht: "waage", steuern: "beleg", energie: "blitz", telekom: "funk" };

// ── Kino-Hero: Bild mit langsamem Zoom, Lichtfäden, schwebende Chips ─────────────────────────────────────
function NetzHero({ bild, pille, a, b, lead, chips, knoepfe, symbolbild }: { bild: string; pille: string; a: string; b: string; lead: string; chips: string[]; knoepfe: ReactNode; symbolbild: string }) {
  return (
    <section className="pn-hero">
      <div className="pn-hero-bild" aria-hidden="true">
        <img src={bild} alt="" decoding="async" {...({ fetchpriority: "high" } as any)} />
        <div className="pn-schleier" />
      </div>
      <svg className="pn-faeden" viewBox="0 0 1440 700" preserveAspectRatio="none" aria-hidden="true">
        <path className="f1" d="M-40 520 C 300 420, 520 600, 820 470 S 1280 330, 1500 400" />
        <path className="f2" d="M-40 600 C 260 520, 600 660, 900 560 S 1300 470, 1500 520" />
        <path className="f3" d="M-40 440 C 340 380, 640 500, 960 400 S 1260 300, 1500 340" />
      </svg>
      <div className="dk-rahmen pn-hero-rahmen">
        <Auf>
          <span className="dk-pille">{pille}</span>
          <h1 className="pn-h1">{a}<span className="dk-verlauf">{b}</span></h1>
          <p className="pn-lead">{lead}</p>
          <div className="dk-knoepfe">{knoepfe}</div>
        </Auf>
        <div className="pn-chips" aria-hidden="true">
          {chips.map((c, i) => <span key={c} className="pn-chip" style={{ animationDelay: `${i * 0.9}s`, ["--i" as any]: i }}><i />{c}</span>)}
        </div>
      </div>
      <span className="pn-symbolbild">{symbolbild}</span>
      <div className="pn-scroll" aria-hidden="true"><span /></div>
    </section>
  );
}

// ── Bereichsleiste ────────────────────────────────────────────────────────
function Leiste({ aktiv, en, hubText }: { aktiv: NetzBereich | "hub"; en: boolean; hubText: string }) {
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  return (
    <nav className="pn-leiste" aria-label={en ? "Areas" : "Bereiche"}>
      <a href={P.hub} className={aktiv === "hub" ? "an" : ""}>{hubText}</a>
      {NETZ_BEREICHE.map((b) => (
        <a key={b} href={P[b]} className={aktiv === b ? "an" : ""} aria-current={aktiv === b ? "page" : undefined}>
          <Zeichen s={BEREICH_ZEICHEN[b]} />{NETZ_BEREICH_NAME[b][en ? "en" : "de"]}
        </a>
      ))}
    </nav>
  );
}

function Vorteile({ items, seite, vier = false }: { items: NetzKarte[]; seite: "kunde" | "partner"; vier?: boolean }) {
  return (
    <div className={`pn-vorteile ${seite}${vier ? " vier" : ""}`}>
      {items.map((k, i) => (
        <Auf key={k.titel} verzoegerung={i * 70}>
          <article className="pn-karte">
            <span className="pn-karte-licht" aria-hidden="true" />
            <Zeichen s={k.s} />
            <h3>{k.titel}</h3>
            <p>{k.text}</p>
          </article>
        </Auf>
      ))}
    </div>
  );
}

/** Die Brücke: Kunde ↔ FIAON ↔ Partner, mit wanderndem Lichtpunkt. */
function Bruecke({ b }: { b: NetzSeite["bruecke"] }) {
  return (
    <Auf>
      <div className="pn-bruecke">
        <div className="pn-pfeiler"><small>{b.links}</small><p>{b.linksText}</p></div>
        <div className="pn-strahl" aria-hidden="true"><span className="punkt" /><span className="punkt zwei" /></div>
        <div className="pn-mitte"><span className="pn-marke">FIAON</span><p>{b.mitte}</p></div>
        <div className="pn-strahl" aria-hidden="true"><span className="punkt" /><span className="punkt zwei" /></div>
        <div className="pn-pfeiler rechts"><small>{b.rechts}</small><p>{b.rechtsText}</p></div>
      </div>
    </Auf>
  );
}

function Zeitstrahl({ items }: { items: { titel: string; text: string }[] }) {
  return (
    <Auf>
      <ol className="pn-zeit">
        {items.map((s, i) => (
          <li key={s.titel} style={{ ["--i" as any]: i }}>
            <span className="pn-knoten">{i + 1}</span>
            <h3>{s.titel}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </Auf>
  );
}

function Preis({ p, netto }: { p: NetzSeite["preis"]; netto: string }) {
  return (
    <Auf>
      <div className="pn-preis">
        <span className="pn-preis-glanz" aria-hidden="true" />
        <div className="pn-preis-werte">
          <div><b>{p.wert}</b><span>{p.einheit}</span></div>
          {p.zweitWert && <div><b>{p.zweitWert}</b><span>{p.zweitEinheit}</span></div>}
        </div>
        <ul>{p.punkte.map((x) => <li key={x}><Zeichen s="haken" />{x}</li>)}</ul>
        <p className="pn-fein">{p.fein}</p>
        <span className="sr-only">{netto}</span>
      </div>
    </Auf>
  );
}

/** Ein schwebender Bildschirm des Partnerbereichs — der Eingang zum Demo-Zugang. */
function DemoBildschirm({ href, titel, text, punkte, knopf, en }: { href: string; titel: ReactNode; text: string; punkte: string[]; knopf: string; en: boolean }) {
  const zeilen = en
    ? [["Sarah K.", "Pension", "Tue 10:00"], ["Thomas M.", "Health cover", "Tue 14:00"], ["Lena B.", "Children", "Wed 09:00"], ["Jonas W.", "Wealth", "Wed 11:00"]]
    : [["Sarah K.", "Altersvorsorge", "Di 10:00"], ["Thomas M.", "Krankenzusatz", "Di 14:00"], ["Lena B.", "Kinder", "Mi 09:00"], ["Jonas W.", "Vermögen", "Mi 11:00"]];
  return (
    <div className="pn-demo">
      <Auf>
        <div className="pn-demo-text">
          <h2 className="dk-h2">{titel}</h2>
          <p className="dk-lead">{text}</p>
          <ul>{punkte.map((x) => <li key={x}><Zeichen s="haken" />{x}</li>)}</ul>
          <div className="dk-knoepfe"><Knopf href={href}>{knopf}</Knopf></div>
        </div>
      </Auf>
      <Auf verzoegerung={150}>
        <a href={href} className="pn-schirm" aria-label={knopf}>
          <span className="pn-schirm-band">{en ? "DEMO · SAMPLE DATA" : "DEMO · BEISPIELDATEN"}</span>
          <div className="pn-schirm-kopf">
            <div><small>{en ? "This week" : "Diese Woche"}</small><b>18<i>/20</i></b></div>
            <div><small>{en ? "This month" : "Dieser Monat"}</small><b>74</b></div>
            <div><small>{en ? "No claim" : "Ohne Reklamation"}</small><b>96<i>%</i></b></div>
          </div>
          <div className="pn-schirm-balken" aria-hidden="true">{[38, 52, 47, 61, 69, 74].map((h, i) => <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }} />)}</div>
          <ul className="pn-schirm-liste">{zeilen.map(([n, t, z]) => <li key={n}><b>{n}</b><span>{t}</span><em>{z}</em></li>)}</ul>
        </a>
      </Auf>
    </div>
  );
}

// ── Bewerbung ─────────────────────────────────────────────────────────────
function Bewerbung({ g, bereich, en }: { g: Record<string, string>; bereich: NetzBereich | null; en: boolean }) {
  const namen = NETZ_BEREICHE.map((b) => NETZ_BEREICH_NAME[b][en ? "en" : "de"]);
  return (
    <Block id="bewerbung" pille={g.bewerbungPille} titel={<>{g.bewerbungA}<span className="dk-verlauf">{g.bewerbungB}</span></>} lead={g.bewerbungLead} schmal>
      <Auf>
        <div className="pn-form">
          <Anfrage
            art="netzwerk"
            en={en}
            knopf={g.fKnopf}
            hinweis={g.fHinweis}
            vorbelegt={bereich ? { bereich: NETZ_BEREICH_NAME[bereich][en ? "en" : "de"] } : undefined}
            felder={[
              { name: "name", label: g.fName, pflicht: true },
              { name: "firma", label: g.fFirma, pflicht: true },
              { name: "email", label: g.fEmail, typ: "email", pflicht: true },
              { name: "telefon", label: g.fTelefon, typ: "tel", pflicht: true },
              { name: "bereich", label: g.fBereich, pflicht: true, optionen: namen },
              { name: "region", label: g.fRegion },
              { name: "zulassung", label: g.fZulassung, breit: true },
              { name: "menge", label: g.fMenge, breit: true },
              { name: "text", label: g.fText, typ: "textarea", breit: true },
            ]}
          />
        </div>
      </Auf>
    </Block>
  );
}

function WeitereBereiche({ aktiv, en, titel }: { aktiv: NetzBereich; en: boolean; titel: string }) {
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  return (
    <Block eng>
      <Auf><p className="pn-ueber">{titel}</p></Auf>
      <div className="pn-kacheln klein">
        {NETZ_BEREICHE.filter((b) => b !== aktiv).map((b, i) => (
          <Auf key={b} verzoegerung={i * 80}>
            <a href={P[b]} className="pn-kachel">
              <img src={BILD[b]} alt="" loading="lazy" decoding="async" />
              <span className="pn-kachel-schleier" />
              <span className="pn-kachel-inhalt"><Zeichen s={BEREICH_ZEICHEN[b]} /><b>{NETZ_BEREICH_NAME[b][en ? "en" : "de"]}</b></span>
            </a>
          </Auf>
        ))}
      </div>
    </Block>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function PartnerNetz() {
  const [pfad] = useLocation();
  const w = useWoerter(PARTNERNETZ_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const g = w.gemeinsam;
  const welche = netzBereichAusPfad(pfad) ?? "hub";
  if (welche === "hub") return <Hub en={en} />;
  const t = w[welche];
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  const demo = netzDemoPfad(welche) + (en ? "&lang=en" : "");
  return (
    <Dunkel seite="partner" titel={t.metaTitel} beschreibung={t.metaBeschreibung} sprache={sprache}>
      <SeoDaten pfad={P[welche]} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen}
                krumen={[{ name: w.hub.krume, pfad: P.hub }, { name: t.krume, pfad: P[welche] }]} />
      <NetzHero bild={BILD[welche]} pille={t.pille} a={t.h1a} b={t.h1b} lead={t.lead} chips={t.chips} symbolbild={g.symbolbild}
                knoepfe={<><Knopf href="#bewerbung">{g.bewerben}</Knopf><Knopf href={demo} still>{g.demo}</Knopf></>} />
      <Leiste aktiv={welche} en={en} hubText={g.alleBereiche} />

      <Block pille={t.kundePille} titel={<>{t.kundeH2a}<span className="dk-verlauf">{t.kundeH2b}</span></>} lead={t.kundeLead}>
        <Vorteile items={t.kunde} seite="kunde" />
      </Block>

      <Block eng><Bruecke b={t.bruecke} /></Block>

      <Block pille={t.partnerPille} titel={<>{t.partnerH2a}<span className="dk-verlauf">{t.partnerH2b}</span></>} lead={t.partnerLead}>
        <Vorteile items={t.partner} seite="partner" />
      </Block>

      <Block pille={t.ablaufPille} titel={<>{t.ablaufH2a}<span className="dk-verlauf">{t.ablaufH2b}</span></>}>
        <Zeitstrahl items={t.ablauf} />
      </Block>

      <Block pille={t.preisPille} titel={<>{t.preisH2a}<span className="dk-verlauf">{t.preisH2b}</span></>} lead={t.preisLead} schmal>
        <Preis p={t.preis} netto={g.netto} />
      </Block>

      <Block pille={t.anforderungPille} titel={<>{t.anforderungH2a}<span className="dk-verlauf">{t.anforderungH2b}</span></>} schmal>
        <Auf>
          <ul className="pn-anforderungen">{t.anforderungen.map((x, i) => <li key={x} style={{ ["--i" as any]: i }}><Zeichen s="schild" />{x}</li>)}</ul>
        </Auf>
      </Block>

      <Block>
        <DemoBildschirm href={demo} titel={<>{w.hub.demoH2a}<span className="dk-verlauf">{w.hub.demoH2b}</span></>} text={w.hub.demoText} punkte={w.hub.demoPunkte} knopf={g.demo} en={en} />
      </Block>

      <Block pille={en ? "Questions" : "Fragen"} titel={en ? <>Asked <span className="dk-verlauf">openly.</span></> : <>Offen <span className="dk-verlauf">gefragt.</span></>} schmal>
        <Fragen items={t.fragen} />
      </Block>

      <Bewerbung g={g} bereich={welche} en={en} />

      <WeitereBereiche aktiv={welche} en={en} titel={g.weitere} />

      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText}
                 knoepfe={<><Knopf href="#bewerbung">{g.bewerben}</Knopf><Knopf href={demo} still>{g.demo}</Knopf></>} />
    </Dunkel>
  );
}

function Hub({ en }: { en: boolean }) {
  const w = useWoerter(PARTNERNETZ_WOERTER);
  const sprache = useSprache();
  const g = w.gemeinsam; const t = w.hub;
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  const demo = netzDemoPfad("vorsorge") + (en ? "&lang=en" : "");
  return (
    <Dunkel seite="partner" titel={t.metaTitel} beschreibung={t.metaBeschreibung} sprache={sprache}>
      <SeoDaten pfad={P.hub} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad: P.hub }]} />
      <NetzHero bild={BILD.hub} pille={t.pille} a={t.h1a} b={t.h1b} lead={t.lead} chips={t.chips} symbolbild={g.symbolbild}
                knoepfe={<><Knopf href="#bereiche">{g.alleBereiche}</Knopf><Knopf href={demo} still>{g.demo}</Knopf></>} />
      <Leiste aktiv="hub" en={en} hubText={g.alleBereiche} />

      <Block pille={t.zweiPille} titel={<>{t.zweiH2a}<span className="dk-verlauf">{t.zweiH2b}</span></>} lead={t.zweiLead}>
        <div className="pn-zwei">
          <Auf><div className="pn-seite kunde"><small>{g.kundenSeite}</small><h3>{t.kundeTitel}</h3><ul>{t.kunde.map((x) => <li key={x}><Zeichen s="haken" />{x}</li>)}</ul></div></Auf>
          <div className="pn-zwei-naht" aria-hidden="true"><span /></div>
          <Auf verzoegerung={120}><div className="pn-seite partner"><small>{g.partnerSeite}</small><h3>{t.partnerTitel}</h3><ul>{t.partner.map((x) => <li key={x}><Zeichen s="haken" />{x}</li>)}</ul></div></Auf>
        </div>
      </Block>

      <Block id="bereiche" pille={t.bereichePille} titel={<>{t.bereicheH2a}<span className="dk-verlauf">{t.bereicheH2b}</span></>} lead={t.bereicheLead}>
        <div className="pn-kacheln">
          {NETZ_BEREICHE.map((b, i) => {
            const x = t.bereiche[b];
            return (
              <Auf key={b} verzoegerung={i * 90} className={i === 0 ? "pn-breit" : ""}>
                <a href={P[b]} className="pn-kachel gross">
                  <img src={BILD[b]} alt="" loading="lazy" decoding="async" />
                  <span className="pn-kachel-schleier" />
                  <span className="pn-kachel-inhalt">
                    <Zeichen s={BEREICH_ZEICHEN[b]} gross />
                    <small>{x.wer}</small>
                    <b>{x.titel}</b>
                    <p>{x.text}</p>
                    <em>{x.preis}<span aria-hidden="true"> →</span></em>
                  </span>
                </a>
              </Auf>
            );
          })}
        </div>
      </Block>

      <Block pille={t.wegPille} titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>}>
        <Zeitstrahl items={t.weg} />
      </Block>

      <Block pille={t.grundPille} titel={<>{t.grundH2a}<span className="dk-verlauf">{t.grundH2b}</span></>}>
        <Vorteile items={t.grund} seite="partner" vier />
      </Block>

      <Block>
        <DemoBildschirm href={demo} titel={<>{t.demoH2a}<span className="dk-verlauf">{t.demoH2b}</span></>} text={t.demoText} punkte={t.demoPunkte} knopf={g.demo} en={en} />
      </Block>

      <Block pille={en ? "Questions" : "Fragen"} titel={en ? <>Asked <span className="dk-verlauf">openly.</span></> : <>Offen <span className="dk-verlauf">gefragt.</span></>} schmal>
        <Fragen items={t.fragen} />
      </Block>

      <Bewerbung g={g} bereich={null} en={en} />

      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText}
                 knoepfe={<><Knopf href="#bewerbung">{g.bewerben}</Knopf><Knopf href="#bereiche" still>{g.alleBereiche}</Knopf></>} />
    </Dunkel>
  );
}
