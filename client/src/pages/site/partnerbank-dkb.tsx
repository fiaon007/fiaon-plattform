// ═══════════════════════════════════════════════════════════════════════════
// /partnerbank-dkb — Konto und Karte mit unserer Partnerbank (14.10.2026)
//
// Justin: „eine eigene Unterseite, wo alle Vorteile des Kontos und der
// Kreditkarte sind, grafisch schön dargestellt … mit unserer exklusiven
// Partnerschaft — cinematisch schön in FIAON Glas CI."
//
// Aufbau: Kino-Hero mit zwei schwebenden Glaskarten (Symbolbild, ohne Logo der
// Bank) → Kennzahlen → Girokonto → Aktivstatus zum Umschalten → Lichtband
// (Kreditkarte, Debit oder Kredit, Kontomodelle) → Sicherheit mit Handy-Szene →
// Brücke → Partnerschaft mit dem Weg in fünf Etappen → Offen gesagt + Fragen
// (Lichtband) → Abschluss.
//
// Leitplanken: Zahlen der Bank nur aus shared/fiaon-partnerbank-dkb.ts (mit
// Stand und Quelle), Kartenzeit nur aus shared/fiaon-karten-weg.ts, „exklusiv"
// meint den begleiteten Weg für FIAON-Kunden — das Konto selbst steht jedem
// offen, und das sagt die Seite. Die Vergütung steht offen da (wie AGB § 2).
// Kein direkter Antragslink: Den persönlichen Link bekommt der Kunde, sobald seine
// FIAON-Bonitätsauswertung vorliegt (E-363) — sonst ließe sich keine Eröffnung zuordnen.
// Zweisprachig: /partnerbank-dkb und /en/partner-bank-dkb (client/src/i18n/partnerbank-dkb.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type ReactNode } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Kennzahlen, Fragen, Szenenbild, Abschluss } from "@/components/site/DunkleBuehne";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PARTNERBANK_WOERTER, type PartnerbankSymbol } from "@/i18n/partnerbank-dkb";
import { aktionLaeuft, dkbStandText, DKB_QUELLE } from "@shared/fiaon-partnerbank-dkb";
import "@/styles/seo-seiten.css";
import "@/styles/partnerbank-dkb.css";

/** Feine Linien-Symbole, 24er Raster, Strichstärke 1.6 — eine Familie für die ganze Seite. */
const PFADE: Record<PartnerbankSymbol, ReactNode> = {
  konto: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  karte: <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><rect x="5.5" y="9" width="4" height="3" rx=".8" /><path d="M14 15h4" /></>,
  uhr: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  blitz: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  wechsel: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  handy: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  schild: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  regler: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  schloss: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  glocke: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  zwei: <><circle cx="9" cy="8.5" r="3" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.6c2.6-.4 4.8 1 5.5 4.4" /></>,
  stern: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" />,
  kind: <><circle cx="12" cy="7" r="3" /><path d="M7 21v-4.5a5 5 0 0 1 10 0V21M9.5 13.5 12 16l2.5-2.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  pfad: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 17h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" /></>,
  auswertung: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  mensch: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></>,
  kiosk: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  notfall: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16v.5" /></>,
  rahmen: <><path d="M4 18 9.5 12l3.5 3.5L20 8" /><path d="M15 8h5v5" /></>,
};
function Sym({ s }: { s: PartnerbankSymbol }) {
  return <svg className="pb-sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PFADE[s]}</svg>;
}

/** Eine Karte als Glaskörper — Symbolbild, bewusst ohne Logo der Bank. */
function Karte({ art, kopf, fuss }: { art: "debit" | "kredit"; kopf: string; fuss: string }) {
  return (
    <div className={`pb-karte pb-${art}`}>
      <span className="pb-k-kopf">{kopf}</span>
      <span className="pb-k-chip" />
      <svg className="pb-k-funk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 8.5a5 5 0 0 1 0 7M11.5 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17" /></svg>
      <span className="pb-k-nummer">•••• •••• •••• 2026</span>
      <span className="pb-k-fuss">{fuss}</span>
      <span className="pb-k-glanz" />
    </div>
  );
}

function KartenSzene({ t }: { t: typeof PARTNERBANK_WOERTER.de }) {
  // Die Szene neigt sich zur Maus (nur Maus — am Handy schwebt sie von selbst).
  const neigen = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const b = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--nx", (((e.clientX - b.left) / b.width) - 0.5).toFixed(3));
    e.currentTarget.style.setProperty("--ny", (((e.clientY - b.top) / b.height) - 0.5).toFixed(3));
  };
  const gerade = (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty("--nx", "0"); e.currentTarget.style.setProperty("--ny", "0"); };
  return (
    <div className="pb-szene" onPointerMove={neigen} onPointerLeave={gerade}>
      <div className="pb-lichtkegel" aria-hidden="true" />
      <div className="pb-raum" aria-hidden="true">
        <Karte art="debit" kopf={t.karteKonto} fuss={t.karteDebit} />
        <Karte art="kredit" kopf={t.karteKarte} fuss={t.karteKredit} />
        <div className="pb-boden" />
      </div>
      {t.chips.map((c, i) => <div key={c.t} className={`pb-chip c${i}`}><Sym s={c.s} /><span>{c.t}</span></div>)}
      <span className="pb-symbolbild">{t.symbolbild}</span>
    </div>
  );
}

/** Mit oder ohne Aktivstatus — das eine dunkle Instrument der Seite. */
function Aktivstatus({ t }: { t: typeof PARTNERBANK_WOERTER.de }) {
  const [mit, setMit] = useState(true);
  return (
    <div className={`pb-aktiv${mit ? " an" : ""}`}>
      <div className="pb-schalter" role="tablist" aria-label={t.schalterAria}>
        <span className="pb-schalter-pille" aria-hidden="true" />
        <button type="button" role="tab" aria-selected={mit} className={mit ? "an" : ""} onClick={() => setMit(true)}>{t.schalterMit}</button>
        <button type="button" role="tab" aria-selected={!mit} className={!mit ? "an" : ""} onClick={() => setMit(false)}>{t.schalterOhne}</button>
      </div>
      <div className="pb-aktiv-zeilen" role="tabpanel">
        {t.aktivZeilen.map((z, i) => (
          <div key={z.label} className="pb-az">
            <span className="pb-az-label">{z.label}</span>
            <b key={mit ? "m" : "o"} className={`pb-az-wert${mit ? " gut" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
              {mit && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              {mit ? z.mit : z.ohne}
            </b>
          </div>
        ))}
      </div>
      <p className="pb-aktiv-fuss">{t.aktivFuss}</p>
    </div>
  );
}

/** Das Handy mit Card Control — die Schalter lassen sich wirklich umlegen (Symbolbild). */
function Handy({ t, en }: { t: typeof PARTNERBANK_WOERTER.de; en: boolean }) {
  const orte = en ? ["In shops", "Online", "Cash machines", "Abroad"] : ["An der Kasse", "Online", "Am Automaten", "Im Ausland"];
  const [an, setAn] = useState([true, true, true, false]);
  return (
    <div className="pb-handy">
      <div className="pb-handy-rahmen">
        <div className="pb-handy-insel" aria-hidden="true" />
        <div className="pb-push" aria-hidden="true">
          <Sym s="glocke" />
          <div><b>{en ? "Payment · €12.80" : "Zahlung · 12,80 €"}</b><small>{en ? "Visa debit card · just now" : "Visa Debitkarte · gerade eben"}</small></div>
        </div>
        <div className="pb-handy-kopf">Card Control</div>
        <div className="pb-handy-liste">
          {orte.map((o, i) => (
            <label key={o} className="pb-handy-zeile">
              <span>{o}</span>
              <input type="checkbox" checked={an[i]} onChange={() => setAn((v) => v.map((x, j) => (j === i ? !x : x)))} />
              <span className="pb-kippe" aria-hidden="true" />
            </label>
          ))}
        </div>
        <div className="pb-handy-sperre"><Sym s="schloss" />{en ? "Block card temporarily" : "Karte vorübergehend sperren"}</div>
      </div>
      <span className="pb-symbolbild">{t.symbolbild}</span>
    </div>
  );
}

export default function PartnerbankDkb() {
  const t = useWoerter(PARTNERBANK_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const aktion = aktionLaeuft();
  return (
    <Dunkel seite="privatkunden" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <section className="dk-hero pb-hero">
        <div className="pb-hero-nebel" aria-hidden="true" />
        <div className="dk-rahmen dk-zweispaltig">
          <Auf>
            <span className="dk-pille">{t.pille}</span>
            <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
            <p className="dk-lead">{t.lead}</p>
            <div className="dk-knoepfe"><Knopf href="/antrag">{t.knopfStart}</Knopf><Knopf href="#vorteile" still>{t.knopfVorteile}</Knopf></div>
          </Auf>
          <Auf verzoegerung={150}><KartenSzene t={t} /></Auf>
        </div>
      </section>

      <section className="dk-block eng pb-zahlen" style={{ paddingTop: 0 }}>
        <div className="dk-rahmen"><Kennzahlen items={t.zahlen} /></div>
      </section>

      <Block id="vorteile" pille={t.kontoPille} titel={<>{t.kontoH2a}<span className="dk-verlauf">{t.kontoH2b}</span></>} lead={t.kontoLead}>
        <div className="pb-raster">
          {t.konto.map((k, i) => (
            <Auf key={k.titel} verzoegerung={i * 70}>
              <div className="dk-glas pb-vorteil"><span className="pb-ikone"><Sym s={k.s} /></span><h3 className="dk-h3">{k.titel}</h3><p className="dk-text">{k.text}</p></div>
            </Auf>
          ))}
        </div>
      </Block>

      <Block pille={t.aktivPille} titel={<>{t.aktivH2a}<span className="dk-verlauf">{t.aktivH2b}</span></>} lead={t.aktivLead}>
        <Auf><Aktivstatus t={t} /></Auf>
      </Block>

      <Licht>
        <Block pille={t.kartePille} titel={<>{t.karteH2a}<span className="dk-verlauf">{t.karteH2b}</span></>} lead={t.karteLead}>
          <div className="pb-karte-buehne">
            <Auf>
              <div className="pb-solo">
                <div className="pb-solo-raum"><Karte art="kredit" kopf={t.karteKarte} fuss={t.karteKredit} /></div>
                <span className="pb-symbolbild">{t.symbolbild}</span>
              </div>
            </Auf>
            <div className="pb-liste">
              {t.karteVorteile.map((k, i) => (
                <Auf key={k.titel} verzoegerung={i * 60}>
                  <div className="pb-punkt"><span className="pb-ikone"><Sym s={k.s} /></span><div><h3>{k.titel}</h3><p>{k.text}</p></div></div>
                </Auf>
              ))}
            </div>
          </div>
          {aktion && <Auf><p className="pb-aktion"><Sym s="stern" /><span>{t.aktion}</span></p></Auf>}
        </Block>

        <Block schmal eng titel={t.vergleichTitel}>
          <div className="pb-vergleich">
            {t.vergleich.map((v, i) => (
              <Auf key={v.kopf} verzoegerung={i * 90}>
                <div className={`pb-vg${i === 1 ? " kredit" : ""}`}>
                  <span className="pb-vg-mini" aria-hidden="true" />
                  <h3>{v.kopf}</h3>
                  <span className="pb-vg-preis">{v.preis}</span>
                  <ul>{v.punkte.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </Auf>
            ))}
          </div>
        </Block>

        <Block eng pille={t.kontenPille} titel={<>{t.kontenH2a}<span className="dk-verlauf">{t.kontenH2b}</span></>}>
          <div className="pb-raster drei">
            {t.konten.map((k, i) => (
              <Auf key={k.titel} verzoegerung={i * 80}>
                <div className="dk-glas pb-vorteil"><span className="pb-ikone"><Sym s={k.s} /></span><h3 className="dk-h3">{k.titel}</h3><p className="dk-text">{k.text}</p></div>
              </Auf>
            ))}
          </div>
        </Block>
      </Licht>

      <Block pille={t.sicherPille} titel={<>{t.sicherH2a}<span className="dk-verlauf">{t.sicherH2b}</span></>} lead={t.sicherLead}>
        <div className="pb-sicher">
          <Auf><Handy t={t} en={en} /></Auf>
          <div className="pb-sicher-raster">
            {t.sicher.map((k, i) => (
              <Auf key={k.titel} verzoegerung={i * 70}>
                <div className="dk-glas pb-vorteil"><span className="pb-ikone"><Sym s={k.s} /></span><h3 className="dk-h3">{k.titel}</h3><p className="dk-text">{k.text}</p></div>
              </Auf>
            ))}
          </div>
        </div>
      </Block>

      <Szenenbild tief src="/kino/partner.jpg" titel={t.szeneTitel} text={t.szeneText} />

      <Block pille={t.partnerPille} titel={<>{t.partnerH2a}<span className="dk-verlauf">{t.partnerH2b}</span></>} lead={t.partnerLead}>
        <div className="pb-raster vier">
          {t.partnerPlus.map((k, i) => (
            <Auf key={k.titel} verzoegerung={i * 80}>
              <div className="dk-glas pb-vorteil pb-plus"><span className="pb-ikone"><Sym s={k.s} /></span><h3 className="dk-h3">{k.titel}</h3><p className="dk-text">{k.text}</p></div>
            </Auf>
          ))}
        </div>
        <Auf>
          <h3 className="pb-weg-titel">{t.wegTitel}</h3>
          <ol className="pb-weg">
            {t.weg.map((w, i) => (
              <li key={w.titel} className="pb-etappe">
                <span className="pb-etappe-n">{i + 1}</span>
                <span className="pb-etappe-dauer">{w.dauer}</span>
                <h4>{w.titel}</h4>
                <p>{w.text}</p>
              </li>
            ))}
          </ol>
        </Auf>
        <div className="dk-knoepfe"><Knopf href="/antrag">{t.knopfStart}</Knopf><Knopf href={zu("/termin")} still>{t.termin}</Knopf></div>
      </Block>

      <Licht>
        <Block schmal pille={t.offenPille}>
          <Auf>
            <div className="pb-offen">
              {t.offen.map((s) => <p key={s}>{s}</p>)}
              <p className="pb-quelle">{t.quelle(dkbStandText(sprache))} <a href={DKB_QUELLE} target="_blank" rel="noopener noreferrer">{t.quelleLink} ↗</a></p>
            </div>
          </Auf>
        </Block>
        <Block schmal eng pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <Abschluss
        titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
        text={t.abschlussText}
        knoepfe={<><Knopf href="/antrag">{t.knopfStart}</Knopf><Knopf href={zu("/termin")} still>{t.termin}</Knopf></>}
      />
    </Dunkel>
  );
}
