// ═══════════════════════════════════════════════════════════════════════════
// BESUCHER › GOOGLE — die Search Console im Chefbüro (28.10.2026, E-454)
//
// Justin: „Ja Zugang — die Google-Zahlen landen automatisch im Chefbüro."
// Der Tageslauf holt jeden Morgen ab 5 Uhr (server/lib/fiaon-search-console.ts);
// diese Ansicht liest nur den abgelegten Stand (GET /chef/google).
//   1. Kacheln: Klicks, Impressionen, CTR, Position — mit den 28 Tagen davor
//   2. Fast auf Seite 1: Suchanfragen auf Platz 8–20 mit Impressionen
//   3. Suchanfragen, Seiten, Länder, Geräte
//   4. Neu bei Google / Noch nicht bei Google (URL-Prüfung, bis 150 am Tag)
//   5. Sitemap-Stand
// Fehlt der Zugang (API aus, Dienstkonto ohne Freigabe), steht nur das da —
// mit dem Satz, was fehlt. „Jetzt abrufen“ sehen Geschäftsführung und Inhaber.
// Wenig Text (Justin 12.10.): Erklärungen im title.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { API, Karte, zahl, seit, datum } from "./chef-teile";

interface Kennzahlen { klicks: number; impressionen: number; ctr: number; position: number | null }
interface Eintrag extends Kennzahlen { name: string }
interface Stand {
  ok: true;
  zustand: "ok" | "zugang_fehlt" | "fehler" | "leer";
  grund: string | null;
  letzterVersuch: string | null;
  stand: string | null;
  zeitraum: { von: string; bis: string; vorherVon: string; vorherBis: string } | null;
  summen: { jetzt: Kennzahlen; vorher: Kennzahlen } | null;
  verlauf: (Kennzahlen & { tag: string })[];
  fastSeiteEins: Eintrag[]; anfragen: Eintrag[]; seiten: Eintrag[]; laender: Eintrag[]; geraete: Eintrag[];
  sitemaps: { pfad: string; eingereicht: string | null; gelesen: string | null; wartet: boolean; warnungen: number; fehler: number; adressen: number | null }[];
  pruefung: { gestoppt?: string | null } | null;
  adressen: {
    gesamt: number; beiGoogle: number; nicht: number; ungeprueft: number; heute: number; budget: number;
    neu: { adresse: string; seit: string | null }[];
    fehlt: { adresse: string; prio: number; abdeckung: string | null; crawl: string | null; link: string | null }[];
  };
  laeuft: boolean;
  darfAbrufen: boolean;
  hand: { am: string; ergebnis: { zustand: string; grund: string | null } } | null;
}

// ── Formate ─────────────────────────────────────────────────────────────────
const komma = (n: number, stellen = 1) => n.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
const prozent = (anteil: number) => `${komma(anteil * 100)} %`;
const tagKurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const pfadVon = (adresse: string) => { try { const u = new URL(adresse); return `${u.pathname}${u.search}` || "/"; } catch { return adresse; } };

// Google liefert Länder als ISO-3166-alpha-3 in Kleinbuchstaben.
const LAENDER: Record<string, string> = {
  deu: "Deutschland", aut: "Österreich", che: "Schweiz", lie: "Liechtenstein", lux: "Luxemburg", usa: "USA",
  gbr: "Großbritannien", nld: "Niederlande", bel: "Belgien", fra: "Frankreich", ita: "Italien", esp: "Spanien",
  pol: "Polen", tur: "Türkei", are: "VAE", can: "Kanada", irl: "Irland", dnk: "Dänemark", swe: "Schweden",
  nor: "Norwegen", cze: "Tschechien", hun: "Ungarn", rou: "Rumänien", hrv: "Kroatien", srb: "Serbien",
  grc: "Griechenland", prt: "Portugal", ind: "Indien", bra: "Brasilien", rus: "Russland", ukr: "Ukraine",
  zaf: "Südafrika", aus: "Australien", cyp: "Zypern", mlt: "Malta", tha: "Thailand", sgp: "Singapur",
};
const landName = (c: string) => LAENDER[c.toLowerCase()] ?? c.toUpperCase();
const GERAETE: Record<string, string> = { DESKTOP: "Computer", MOBILE: "Handy", TABLET: "Tablet" };

/** Veränderung: Text und Ton. art „prozent“ (relativ), „punkte“ (CTR), „platz“ (Position, kleiner = besser). */
function delta(jetzt: number | null, vorher: number | null, art: "prozent" | "punkte" | "platz"): { text: string; ton: "gut" | "schlecht" | "gleich" } | null {
  if (jetzt == null || vorher == null) return null;
  if (art === "platz") {
    const d = jetzt - vorher;
    if (Math.abs(d) < 0.05) return { text: "±0", ton: "gleich" };
    return { text: `${d > 0 ? "+" : "−"}${komma(Math.abs(d))}`, ton: d < 0 ? "gut" : "schlecht" };
  }
  if (art === "punkte") {
    const d = (jetzt - vorher) * 100;
    if (Math.abs(d) < 0.05) return { text: "±0", ton: "gleich" };
    return { text: `${d > 0 ? "+" : "−"}${komma(Math.abs(d))} Pkt.`, ton: d > 0 ? "gut" : "schlecht" };
  }
  if (vorher === 0) return jetzt === 0 ? { text: "±0", ton: "gleich" } : { text: "neu", ton: "gut" };
  const d = ((jetzt - vorher) / vorher) * 100;
  if (Math.abs(d) < 0.5) return { text: "±0 %", ton: "gleich" };
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d).toLocaleString("de-DE", { maximumFractionDigits: Math.abs(d) < 10 ? 1 : 0 })} %`, ton: d > 0 ? "gut" : "schlecht" };
}

// ── Ein Säulenband: Klicks je Tag, darunter Impressionen als Hauch ─────────
function Tagesband({ tage }: { tage: (Kennzahlen & { tag: string })[] }) {
  if (!tage.length) return null;
  const maxK = Math.max(1, ...tage.map((t) => t.klicks));
  const maxI = Math.max(1, ...tage.map((t) => t.impressionen));
  return (
    <div className="bzg-band" role="img" aria-label="Klicks und Impressionen je Tag">
      {tage.map((t) => (
        <span key={t.tag} className="bzg-saeule" title={`${tagKurz(t.tag)}: ${zahl(t.klicks)} Klicks · ${zahl(t.impressionen)} Impressionen`}>
          <i className="bzg-impr" style={{ height: `${(t.impressionen / maxI) * 100}%` }} />
          <i className="bzg-klick" style={{ height: `${t.klicks > 0 ? Math.max(4, (t.klicks / maxK) * 100) : 0}%` }} />
        </span>
      ))}
    </div>
  );
}

// ── Eine Liste im Stil der Ranglisten — ohne Filter, Zeilen führen nach draußen ──
interface ListZeile { name: string; wert: string; zusatz?: string; href?: string | null; balken?: number }
function Liste({ titel, wertTitel, zeilen, leer, kurz = 8, klasse = "" }: {
  titel: string; wertTitel?: string; zeilen: ListZeile[]; leer: string; kurz?: number; klasse?: string;
}) {
  const [alle, setAlle] = useState(false);
  const sichtbar = alle ? zeilen : zeilen.slice(0, kurz);
  return (
    <div className={`bz-rang bzg-liste ${klasse}`}>
      <h3>{titel}{wertTitel && <em>{wertTitel}</em>}</h3>
      {zeilen.length === 0 ? <p className="bz-leise">{leer}</p> : (
        <ul>
          {sichtbar.map((z) => {
            const inhalt = (
              <>
                <span className="bz-rang-name"><span>{z.name}</span>{z.zusatz && <small>{z.zusatz}</small>}</span>
                <span className="bz-rang-zahl">{z.wert}</span>
                {z.balken != null && <span className="bz-rang-balken" aria-hidden="true"><i style={{ width: `${Math.max(2, z.balken * 100)}%` }} /></span>}
              </>
            );
            return (
              <li key={z.name}>
                {z.href
                  ? <a className="bz-rang-zeile" href={z.href} target="_blank" rel="noopener noreferrer">{inhalt}</a>
                  : <div className="bz-rang-zeile bzg-still">{inhalt}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {zeilen.length > kurz && (
        <button type="button" className="bz-mehr" onClick={() => setAlle((a) => !a)}>{alle ? "weniger" : `alle ${zeilen.length}`}</button>
      )}
    </div>
  );
}

const suche = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=de&gl=de`;

export default function ChefBesucherGoogle() {
  const [d, setD] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const warteteAufAbruf = useRef(false);

  useEffect(() => {
    let weg = false;
    fetch(`${API}/chef/google`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (j?.ok) {
          setD(j as Stand); setFehler(null);
          if (warteteAufAbruf.current && !j.laeuft) {
            warteteAufAbruf.current = false;
            const e = (j as Stand).hand?.ergebnis;
            setMeldung(e ? (e.zustand === "ok" ? `Frisch von Google geholt.${e.grund ? ` ${e.grund}` : ""}` : (e.grund ?? "Der Abruf ist nicht gelungen.")) : null);
          }
        } else setFehler(j?.error || "Die Google-Zahlen ließen sich nicht laden.");
      })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); });
    return () => { weg = true; };
  }, [runde]);

  // Läuft ein Abruf, alle 4 Sekunden nachsehen.
  useEffect(() => {
    if (!d?.laeuft) return;
    const t = window.setTimeout(() => setRunde((r) => r + 1), 4000);
    return () => window.clearTimeout(t);
  }, [d, runde]);

  const abrufen = async () => {
    setMeldung(null);
    try {
      const r = await fetch(`${API}/chef/google/abrufen`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { warteteAufAbruf.current = true; setD((x) => (x ? { ...x, laeuft: true } : x)); setRunde((x) => x + 1); }
      else setMeldung(j?.error || "Der Abruf ließ sich nicht starten.");
    } catch { setMeldung("Keine Verbindung zum Server."); }
  };

  const kopf = (
    <div className="bz-abschnitt-kopf">
      <h2>Google <em>Search Console{d?.zeitraum ? ` · ${tagKurz(d.zeitraum.von)} – ${tagKurz(d.zeitraum.bis)}` : " · 28 Tage"}</em></h2>
      {d?.darfAbrufen && (
        <button type="button" className="cw-knopf klein" onClick={abrufen} disabled={d.laeuft}
                title="Zahlen, Sitemaps und URL-Prüfung jetzt neu holen (höchstens alle 10 Minuten)">
          {d.laeuft ? "holt …" : "Jetzt abrufen"}
        </button>
      )}
    </div>
  );

  if (!d) {
    return <section id="google" className="bz-abschnitt bzg">{kopf}<p className="bz-leise">{fehler ?? "lädt …"}</p></section>;
  }

  const s = d.summen;
  const zugangFehlt = d.zustand === "zugang_fehlt";
  const a = d.adressen;
  const nichtOk = d.zustand !== "ok" && d.zustand !== "leer";

  const standZeile = (
    <div className="cbes-stand bzg-stand">
      <span>
        {d.stand ? <>Stand: <b>{seit(d.stand)}</b></> : <>Noch kein Stand</>}
        {" "}· täglich ab 5 Uhr
        {a.gesamt > 0 && <> · URL-Prüfung heute {zahl(a.heute)}/{zahl(a.budget)}</>}
      </span>
      {nichtOk && d.letzterVersuch && <span className="bzg-versuch">Letzter Versuch {seit(d.letzterVersuch)}</span>}
    </div>
  );

  // ── Noch nie Daten: nur der Zustand ────────────────────────────────────
  if (!s) {
    return (
      <section id="google" className="bz-abschnitt bzg">
        {kopf}
        {standZeile}
        <div className="bz-hinweis bzg-zugang" role="status">
          {zugangFehlt
            ? <><b>Zugang fehlt noch.</b> {d.grund} Sobald er da ist, kommen die Zahlen von selbst.</>
            : d.zustand === "leer"
              ? <><b>Noch kein Abruf.</b> Der Tageslauf holt die Zahlen jeden Morgen ab 5 Uhr.</>
              : <><b>Abruf gescheitert.</b> {d.grund}</>}
        </div>
        {meldung && <p className="cw-meldung" role="status">{meldung}</p>}
      </section>
    );
  }

  const kacheln = [
    { label: "Klicks", wert: zahl(s.jetzt.klicks), titel: "Klicks aus der Google-Suche auf fiaon.com", d: delta(s.jetzt.klicks, s.vorher.klicks, "prozent") },
    { label: "Impressionen", wert: zahl(s.jetzt.impressionen), titel: "Wie oft fiaon.com in Suchergebnissen stand", d: delta(s.jetzt.impressionen, s.vorher.impressionen, "prozent") },
    { label: "CTR", wert: prozent(s.jetzt.ctr), titel: "Klicks je Impression", d: delta(s.jetzt.ctr, s.vorher.ctr, "punkte") },
    { label: "Ø Position", wert: s.jetzt.position == null ? "—" : komma(s.jetzt.position), titel: "Durchschnittliche Position in den Ergebnissen — kleiner ist besser", d: delta(s.jetzt.position, s.vorher.position, "platz") },
  ];
  const maxKlicks = Math.max(1, ...d.anfragen.map((x) => x.klicks));
  const maxSeite = Math.max(1, ...d.seiten.map((x) => x.klicks));
  const maxLand = Math.max(1, ...d.laender.map((x) => x.klicks));

  return (
    <section id="google" className="bz-abschnitt bzg">
      {kopf}
      {standZeile}
      {nichtOk && <p className="cw-meldung" role="status">Letzter Abruf ohne Daten: {d.grund}</p>}
      {meldung && <p className="cw-meldung" role="status">{meldung}</p>}

      <div className="bz-kacheln">
        {kacheln.map((k) => (
          <Karte key={k.label} klasse="bz-kz" titel={k.titel}>
            <b>{k.wert}</b>
            <em>{k.label}</em>
            {k.d && <small><span className={`bz-delta ${k.d.ton}`}>{k.d.text}</span>{d.zeitraum && <span>vs. {tagKurz(d.zeitraum.vorherVon)} – {tagKurz(d.zeitraum.vorherBis)}</span>}</small>}
          </Karte>
        ))}
      </div>
      <div className="bz-karte bzg-band-karte">
        <Tagesband tage={d.verlauf} />
        <p className="bz-legende"><span><i className="bzg-legende-klick" aria-hidden="true" /> Klicks</span><span><i className="bzg-legende-impr" aria-hidden="true" /> Impressionen</span></p>
      </div>

      <div className="bz-raenge">
        <Liste titel="Fast auf Seite 1" wertTitel="Platz 8–20" klasse="bzg-fast" kurz={10}
               leer="Gerade keine Suchanfrage auf Platz 8–20."
               zeilen={d.fastSeiteEins.map((x) => ({
                 name: x.name, wert: x.position == null ? "—" : `Platz ${komma(x.position)}`,
                 zusatz: `${zahl(x.impressionen)} Impressionen · ${zahl(x.klicks)} Klicks`, href: suche(x.name),
               }))} />
        <Liste titel="Suchanfragen" wertTitel="Klicks" leer="Noch keine Suchanfragen."
               zeilen={d.anfragen.map((x) => ({
                 name: x.name, wert: zahl(x.klicks), balken: x.klicks / maxKlicks, href: suche(x.name),
                 zusatz: `${zahl(x.impressionen)} Impr. · Platz ${x.position == null ? "—" : komma(x.position)}`,
               }))} />
        <Liste titel="Seiten" wertTitel="Klicks" leer="Noch keine Seiten."
               zeilen={d.seiten.map((x) => ({
                 name: pfadVon(x.name), wert: zahl(x.klicks), balken: x.klicks / maxSeite, href: x.name,
                 zusatz: `${zahl(x.impressionen)} Impr. · Platz ${x.position == null ? "—" : komma(x.position)}`,
               }))} />
        <Liste titel="Länder" wertTitel="Klicks" leer="Noch keine Länder." kurz={6}
               zeilen={d.laender.map((x) => ({ name: landName(x.name), wert: zahl(x.klicks), balken: x.klicks / maxLand, zusatz: `${zahl(x.impressionen)} Impr.` }))} />
        <Liste titel="Geräte" wertTitel="Klicks" leer="Noch keine Geräte."
               zeilen={d.geraete.map((x) => ({ name: GERAETE[x.name] ?? x.name, wert: zahl(x.klicks), zusatz: `${prozent(x.ctr)} CTR · Platz ${x.position == null ? "—" : komma(x.position)}` }))} />
      </div>

      <h3 className="bz-unterkopf">Bei Google <em>URL-Prüfung, Adressen aus der Sitemap</em></h3>
      <div className="bzg-index">
        <span title="Adressen aus der Sitemap, die Google aufgenommen hat"><b>{zahl(a.beiGoogle)}</b> bei Google</span>
        <span title="Geprüft, aber (noch) nicht aufgenommen"><b>{zahl(a.nicht)}</b> noch nicht</span>
        <span title="Noch nicht geprüft — kommt in den nächsten Tagen dran"><b>{zahl(a.ungeprueft)}</b> ungeprüft</span>
        <span className="bz-leise">von {zahl(a.gesamt)} in der Sitemap</span>
      </div>
      {d.pruefung?.gestoppt && <p className="cw-meldung" role="status">{d.pruefung.gestoppt}</p>}
      <div className="bz-raenge">
        <Liste titel="Neu bei Google" wertTitel="seit" leer="In den letzten 14 Tagen nichts Neues." klasse="bzg-neu"
               zeilen={a.neu.map((x) => ({ name: pfadVon(x.adresse), wert: x.seit ? datum(x.seit) : "—", href: x.adresse }))} />
        <Liste titel="Noch nicht bei Google" wertTitel="Grund laut Google" leer="Alles Geprüfte ist bei Google." kurz={10}
               zeilen={a.fehlt.map((x) => ({
                 name: pfadVon(x.adresse), wert: x.crawl ? `Crawl ${datum(x.crawl)}` : "nie gecrawlt",
                 zusatz: x.abdeckung ?? undefined, href: x.link ?? x.adresse,
               }))} />
      </div>

      {d.sitemaps.length > 0 && (
        <div className="bzg-sitemaps">
          {d.sitemaps.map((m) => (
            <span key={m.pfad} title={m.eingereicht ? `Eingereicht ${datum(m.eingereicht)}` : undefined}>
              <b>{pfadVon(m.pfad)}</b>
              {m.adressen != null && <> · {zahl(m.adressen)} Adressen</>}
              {" "}· {m.wartet ? "wartet auf Google" : m.gelesen ? `gelesen ${seit(m.gelesen)}` : "noch nicht gelesen"}
              {m.fehler > 0 && <i data-ton="rot"> {zahl(m.fehler)} Fehler</i>}
              {m.warnungen > 0 && <i data-ton="gelb"> {zahl(m.warnungen)} Warnungen</i>}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
