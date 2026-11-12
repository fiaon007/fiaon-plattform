// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-LAGE — die Startseite des Chefbüros (E-508, 12.11.2026)
//
// Justin: „Ich brauche eine Zusammenfassung der heutigen Woche, am besten jeden Tag — wie ein Live-Feed. Ich möchte
//          immer die wichtigsten Infos wissen: Welchen Auftragswert haben wir draußen, bei wem warten wir, was wurde
//          gesprochen, wie viel brauchen wir, um unsere monatlichen Fixkosten zu decken, was sind die nächsten
//          Schritte pro Mandant? … seriös, Kanzlei-Stil mit guten Animationen … ich will über die Plattform ALLES
//          managen.“
//
// Aufbau von oben nach unten: Auftragswert (die EINE Navy-Fläche) · Fixkosten · Feed der Woche neben „Wir warten auf“,
// den nächsten Gesprächen und den Partner-Aufgaben · der nächste Schritt je Mandant mit Knöpfen.
// Eine Antwort vom Server (GET /chef/global-lage), leise nachgeladen alle 60 Sekunden; gerechnet wird in
// shared/fiaon-chef-global-lage.ts. Kein Knopf hier sendet eine Mail, bucht Geld oder stellt eine Rechnung.
// Gestaltung: chef-global-lage.css (.cgl-), hell auf dem ruhigen Standbild, Serife nur für Überschriften und Zahlen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { API, Geruest, Fehlermeldung, Hochzaehler, useDaten, ruhig } from "./chef-teile";
import {
  FEED_ART_NAME, FEED_WOCHE_ZAEHLT, LAGE_NOTIZ_MAX, LAGE_WIEDERVORLAGE_TEXT_MAX, tagKurz, tagPlus, tageZwischen,
  type FeedArt, type FeedEintrag, type FeedTag, type LageAntwort, type LageFixkosten, type LageAuftragswert,
  type LagePhase, type LageWartet, type LagePartnerBlock, type LageTermin,
} from "@shared/fiaon-chef-global-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-global-lage.css";

type Mandant = LageAntwort["mandanten"][number];
const NACHLADEN_MS = 60_000;

// ── Formate ──────────────────────────────────────────────────────────────────
/** Geld ohne Nachkommastellen, wenn es glatte Euro sind („2.799 €“, „1.234,50 €“). */
const geld = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const mehrzahl = (n: number, eins: string, viele: string) => `${n.toLocaleString("de-DE")} ${n === 1 ? eins : viele}`;
const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const langerTag = (tag: string) => new Date(`${tag}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** „seit 3 Tagen“ aus einem Zeitpunkt oder Tag. */
function seitText(wann: string | null, heute: string): string {
  if (!wann) return "—";
  const tag = wann.length > 10 ? new Date(wann).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }) : wann;
  const d = tageZwischen(tag, heute);
  return d <= 0 ? "heute" : d === 1 ? "gestern" : `${d} Tagen`;
}
/** „bis 19.11. (in 7 Tagen)“ */
function bisText(bis: string | null, heute: string): string {
  if (!bis) return "—";
  const d = tageZwischen(heute, bis);
  return `${tagKurz(bis)}${d === 0 ? " · heute" : d === 1 ? " · morgen" : d > 1 ? ` · in ${d} Tagen` : ` · seit ${-d} ${d === -1 ? "Tag" : "Tagen"}`}`;
}

async function senden(pfad: string, body?: unknown): Promise<{ ok: boolean; meldung?: string; error?: string; [k: string]: unknown }> {
  try {
    const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || (r.status === 403 ? "Dafür reicht deine Stufe nicht." : `Fehler ${r.status}`) };
    return j;
  } catch { return { ok: false, error: "Keine Verbindung zum Server — nichts gespeichert." }; }
}

const PHASE_NAME: Record<LagePhase, string> = { angebot: "Angebot offen", abgelaufen: "Angebot abgelaufen", zahlung: "Angenommen · Zahlung offen", arbeit: "Mandat läuft", fertig: "Abgeschlossen" };
const WOCHE_WORT: Partial<Record<FeedArt, [string, string]>> = {
  anfrage: ["Anfrage", "Anfragen"], gespraech: ["Gespräch", "Gespräche"], angebot: ["Angebot angelegt", "Angebote angelegt"],
  gelesen: ["Angebot gelesen", "Angebote gelesen"], annahme: ["Annahme", "Annahmen"], zahlung: ["Zahlung", "Zahlungen"], unterlage: ["Unterlage", "Unterlagen"],
};

/** Ein Abschnitt mit Augenzeile, Titel und einer Haarlinie — überall derselbe Kopf. */
function Abschnitt({ id, auge, titel, zahl, rechts, children, klasse = "" }: { id: string; auge: string; titel: string; zahl?: number | string; rechts?: ReactNode; children: ReactNode; klasse?: string }) {
  return (
    <section className={`cgl-abschnitt ${klasse}`} id={`cgl-${id}`} data-cgl={id}>
      <header className="cgl-abschnitt-kopf">
        <div>
          <span className="cgl-auge">{auge}</span>
          <h2>{titel}{zahl !== undefined && <em>{zahl}</em>}</h2>
        </div>
        {rechts}
      </header>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · AUFTRAGSWERT — die eine Navy-Fläche
// ═══════════════════════════════════════════════════════════════════════════
function Auftragswert({ a }: { a: LageAuftragswert }) {
  const spalten: { titel: string; anzahl: string; z1: [string, number]; z2: [string, number]; summe?: number; hinweis?: string }[] = [
    { titel: "Wartet auf Annahme", anzahl: mehrzahl(a.offen.anzahl, "Angebot", "Angebote"), z1: ["Start-Betrag", a.offen.startCents], z2: ["Erfolgshonorar", a.offen.erfolgCents], summe: a.offen.startCents + a.offen.erfolgCents },
    { titel: "Zahlung offen", anzahl: mehrzahl(a.angenommen.anzahl, "Mandant", "Mandanten"), z1: ["Start-Betrag", a.angenommen.startCents], z2: ["Erfolgshonorar", a.angenommen.erfolgCents], summe: a.angenommen.startCents + a.angenommen.erfolgCents },
    {
      titel: "Mandat läuft", anzahl: mehrzahl(a.bezahlt.anzahl, "Mandant", "Mandanten"), z1: ["Start bezahlt", a.bezahlt.startCents], z2: ["Honorar offen", a.bezahlt.erfolgCents],
      hinweis: a.bezahlt.erfolgGestelltCents > 0 ? `davon ${geld(a.bezahlt.erfolgGestelltCents)} schon in Rechnung gestellt` : undefined,
    },
  ];
  return (
    <section className="cgl-wert" data-cgl="auftragswert" aria-label="Auftragswert draußen">
      <div className="cgl-wert-kopf">
        <span className="cgl-auge hell">Auftragswert draußen</span>
        <p className="cgl-wert-zahl"><Hochzaehler ziel={a.draussenCents} formatieren={geld} /></p>
        <p className="cgl-wert-satz">
          Alles, was noch nicht bezahlt ist. Davon schon zugesagt: <b>{geld(a.zugesagtCents)}</b>.
          {a.nachErgebnis > 0 && <> Dazu {mehrzahl(a.nachErgebnis, "Mandant", "Mandanten")} mit Honorar nach Ergebnis.</>}
        </p>
      </div>
      <div className="cgl-wert-spalten">
        {spalten.map((s) => (
          <div key={s.titel} className="cgl-wert-spalte">
            <span className="cgl-auge hell">{s.titel}</span>
            <b>{s.anzahl}</b>
            <dl>
              <div><dt>{s.z1[0]}</dt><dd>{geld(s.z1[1])}</dd></div>
              <div><dt>{s.z2[0]}</dt><dd>{geld(s.z2[1])}</dd></div>
              {s.summe !== undefined && <div className="summe"><dt>zusammen</dt><dd>{geld(s.summe)}</dd></div>}
            </dl>
            {s.hinweis && <small>{s.hinweis}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · FIXKOSTEN — eine ruhige Anzeige
// ═══════════════════════════════════════════════════════════════════════════
function Fixkosten({ f, heute, darfSetzen, neu }: { f: LageFixkosten; heute: string; darfSetzen: boolean; neu: () => void }) {
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Der Balken wächst einmal von 0 auf seinen Wert — danach steht er.
  const [gezeichnet, setGezeichnet] = useState(ruhig());
  useEffect(() => { const t = window.setTimeout(() => setGezeichnet(true), 120); return () => window.clearTimeout(t); }, []);
  const monat = new Date(`${heute}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC", month: "long" });
  const deckung = Math.min(100, f.deckungProzent ?? 0);
  const mit = Math.min(100, f.mitZugesagtProzent ?? 0);
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const j = await senden("/chef/global-lage/fixkosten", { betrag: wert });
    setLaeuft(false);
    if (!j.ok) { setFehler(j.error || "Nicht gespeichert."); return; }
    setOffen(false); neu();
  };
  const stand = f.stand === "gedeckt" ? "Der Monat ist gedeckt."
    : f.stand === "zugesagt" ? `Es fehlen noch ${geld(f.fehltCents)}. Die Zusagen decken das, sobald sie bezahlt sind.`
    : `Es fehlen noch ${geld(f.fehltCents)}.${f.abschluesseNoetig ? ` Das sind etwa ${mehrzahl(f.abschluesseNoetig, "Abschluss", "Abschlüsse")} zum Schnitt der offenen Angebote.` : ""}`;
  return (
    <section className="cgl-fix" data-cgl="fixkosten" aria-label="Deckung der Fixkosten">
      <header>
        <span className="cgl-auge">Fixkosten im {monat}</span>
        {darfSetzen && !offen && <button type="button" className="cgl-link" onClick={() => { setWert((f.fixCents / 100).toLocaleString("de-DE")); setOffen(true); }} data-cgl="fixkosten-aendern">Ändern</button>}
      </header>
      {offen ? (
        <form className="cgl-fix-form" onSubmit={(e) => { e.preventDefault(); void speichern(); }}>
          <label htmlFor="cgl-fixwert">Fixkosten je Monat in Euro</label>
          <div>
            <input id="cgl-fixwert" inputMode="decimal" autoFocus value={wert} onChange={(e) => setWert(e.target.value)} placeholder="19.000" />
            <button type="submit" className="cgl-knopf voll" disabled={laeuft}>{laeuft ? "Speichert …" : "Speichern"}</button>
            <button type="button" className="cgl-knopf" onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
          {fehler && <p className="cgl-fehler" role="alert">{fehler}</p>}
        </form>
      ) : (
        <p className="cgl-fix-zahl">
          <b>{f.deckungProzent ?? 0} %</b>
          <span>von {geld(f.fixCents)} gedeckt{f.vorgabe ? " (Startwert — bitte prüfen)" : ""}</span>
        </p>
      )}
      <div className="cgl-balken" role="img" aria-label={`${f.deckungProzent ?? 0} Prozent gedeckt, mit Zusagen ${f.mitZugesagtProzent ?? 0} Prozent; ${f.monatVorbeiProzent} Prozent des Monats sind vorbei`}>
        <i className="zugesagt" style={{ width: `${gezeichnet ? mit : 0}%` }} />
        <i className="gedeckt" style={{ width: `${gezeichnet ? deckung : 0}%` }} />
        <u style={{ left: `${Math.min(100, f.monatVorbeiProzent)}%` }} title={`${f.monatVorbeiProzent} % des Monats sind vorbei`} />
      </div>
      <p className="cgl-fix-stand">{stand}</p>
      <dl className="cgl-fix-liste">
        <div><dt>Eingegangen im {monat}</dt><dd>{geld(f.monatCents)}</dd></div>
        <div><dt>davon FIAON Global</dt><dd>{geld(f.globalMonatCents)}</dd></div>
        <div><dt>Zugesagt, noch nicht bezahlt</dt><dd>{geld(f.zugesagtCents)}</dd></div>
      </dl>
      <small className="cgl-fix-fuss">Der Strich zeigt, wie viel vom Monat vorbei ist ({f.monatVorbeiProzent} %).</small>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · WIR WARTEN AUF
// ═══════════════════════════════════════════════════════════════════════════
const WARTET_ART: Record<LageWartet["art"], string> = { kunde: "Kunde", amt: "Behörde", partner: "Partner", wiedervorlage: "Wiedervorlage" };

function WartetZeile({ w, heute, erledigen, zuMandant }: { w: LageWartet; heute: string; erledigen?: (id: number) => void; zuMandant?: (schluessel: string) => void }) {
  return (
    <li className={`cgl-wartet-zeile${w.ueberfaellig ? " rot" : ""}`}>
      <span className={`cgl-punkt ${w.art}`} aria-hidden="true" />
      <div className="cgl-wartet-wer">
        {w.mandant && zuMandant ? <button type="button" className="cgl-name" onClick={() => zuMandant(w.mandant!)}>{w.wer}</button>
          : w.ziel ? <Link href={w.ziel} className="cgl-name">{w.wer}</Link> : <span className="cgl-name">{w.wer}</span>}
        <span>{w.worauf}</span>
      </div>
      <dl>
        <div><dt>{WARTET_ART[w.art]} · seit</dt><dd>{seitText(w.seit, heute)}</dd></div>
        <div><dt>bis</dt><dd className={w.ueberfaellig ? "rot" : ""}>{bisText(w.bis, heute)}</dd></div>
      </dl>
      {w.notizId != null && erledigen && <button type="button" className="cgl-knopf klein" onClick={() => erledigen(w.notizId!)}>Erledigt</button>}
    </li>
  );
}

function Wartet({ liste, heute, neu, zuMandant }: { liste: LageWartet[]; heute: string; neu: () => void; zuMandant: (s: string) => void }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const erledigen = async (id: number) => {
    const j = await senden(`/chef/global-lage/wiedervorlage/${id}/erledigt`);
    if (!j.ok) setFehler(j.error || "Nicht gespeichert."); else { setFehler(null); neu(); }
  };
  return (
    <Abschnitt id="wartet" auge="Bei wem warten wir" titel="Wir warten auf" zahl={liste.length}>
      {fehler && <p className="cgl-fehler" role="alert">{fehler}</p>}
      {liste.length === 0 ? <p className="cgl-leer">Gerade wartet niemand auf niemanden.</p> : (
        <ul className="cgl-wartet">{liste.map((w) => <WartetZeile key={w.schluessel} w={w} heute={heute} erledigen={erledigen} zuMandant={zuMandant} />)}</ul>
      )}
    </Abschnitt>
  );
}

function Termine({ liste, heute }: { liste: LageTermin[]; heute: string }) {
  if (!liste.length) return null;
  return (
    <Abschnitt id="termine" auge="Die nächsten zehn Tage" titel="Gespräche" zahl={liste.length}
               rechts={<Link href="/chef/global-kunden" className="cgl-link">Ergebnis eintragen</Link>}>
      <ul className="cgl-termine">
        {liste.map((t) => {
          const d = tageZwischen(heute, t.tag);
          return (
            <li key={t.id}>
              <time dateTime={`${t.tag}T${t.uhr}`}><b>{d === 0 ? "Heute" : d === 1 ? "Morgen" : tagKurz(t.tag)}</b>{t.uhr}</time>
              <div><span className="cgl-name">{t.name}</span><span>{[t.mit ? `mit ${t.mit}` : "", t.thema ?? ""].filter(Boolean).join(" · ") || "Gespräch"}</span></div>
            </li>
          );
        })}
      </ul>
    </Abschnitt>
  );
}

function Partner({ p, heute }: { p: LagePartnerBlock; heute: string }) {
  if (!p.gesamt) return null;
  return (
    <Abschnitt id="partner" auge="Partner und Behörden" titel="Aufgaben fällig" zahl={p.gesamt}
               rechts={<Link href="/chef/s/geschaeftspartner?reiter=partner" className="cgl-link">Alle im Partner-CRM</Link>}>
      {p.ueberfaellig > 0 && <p className="cgl-hinweis">{mehrzahl(p.ueberfaellig, "Aufgabe ist", "Aufgaben sind")} überfällig — die jüngsten stehen oben.</p>}
      <ul className="cgl-wartet schmal">{p.liste.map((w) => <WartetZeile key={w.schluessel} w={w} heute={heute} />)}</ul>
    </Abschnitt>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · DER FEED DER WOCHE
// ═══════════════════════════════════════════════════════════════════════════
const TAG_ZEILEN = 9;

function FeedZeile({ e, neu }: { e: FeedEintrag; neu: boolean }) {
  const [auf, setAuf] = useState(false);
  const lang = (e.text?.length ?? 0) > 150;
  return (
    <li className={`cgl-feed-zeile ${e.art}${e.laut ? "" : " leise"}${neu ? " neu" : ""}`}>
      <time>{e.uhr}</time>
      <span className="cgl-feed-punkt" aria-hidden="true" />
      <div className="cgl-feed-inhalt">
        <p className="cgl-feed-kopf">
          <span className="cgl-feed-art">{FEED_ART_NAME[e.art]}</span>
          <span className="cgl-name">{e.wer}</span>
          <span className="cgl-feed-titel">{e.titel}</span>
          {e.betragCents != null && e.betragCents > 0 && <b className="cgl-feed-betrag">{geld(e.betragCents)}</b>}
        </p>
        {e.text && (
          <p className={`cgl-feed-text${auf || !lang ? " auf" : ""}`} onClick={lang ? () => setAuf((v) => !v) : undefined} title={lang ? (auf ? "Kürzer" : "Ganzer Text") : undefined} data-volltext>
            {e.text}
          </p>
        )}
      </div>
      {e.ziel && <Link href={e.ziel} className="cgl-feed-ziel" aria-label={`Öffnen: ${e.wer}`}>Öffnen</Link>}
    </li>
  );
}

function FeedTagBlock({ t, alles, neueIds }: { t: FeedTag; alles: boolean; neueIds: Set<string> }) {
  const [ganz, setGanz] = useState(false);
  const liste = alles ? t.eintraege : t.eintraege.filter((e) => e.laut);
  const sichtbar = ganz ? liste : liste.slice(0, TAG_ZEILEN);
  const leise = t.eintraege.length - t.eintraege.filter((e) => e.laut).length;
  return (
    <div className="cgl-feed-tag" data-cgl-tag={t.tag}>
      <header>
        <h3>{t.name}</h3>
        <span>{liste.length === 0 ? "nichts" : mehrzahl(liste.length, "Eintrag", "Einträge")}{!alles && leise > 0 ? ` · ${leise} leise ausgeblendet` : ""}</span>
      </header>
      {liste.length === 0 ? <p className="cgl-leer">{t.eintraege.length ? "Nur leise Einträge (Mails, Änderungen) — unter „Alles“ sichtbar." : "An diesem Tag ist nichts passiert."}</p> : (
        <ol className="cgl-feed-liste">{sichtbar.map((e) => <FeedZeile key={e.id} e={e} neu={neueIds.has(e.id)} />)}</ol>
      )}
      {liste.length > TAG_ZEILEN && (
        <button type="button" className="cgl-link mehr" onClick={() => setGanz((v) => !v)}>{ganz ? "Weniger zeigen" : `Alle ${liste.length} zeigen`}</button>
      )}
    </div>
  );
}

function Feed({ l, setWoche, neueIds, neu }: { l: LageAntwort; setWoche: (w: string | null) => void; neueIds: Set<string>; neu: () => void }) {
  const [alles, setAlles] = useState<boolean>(() => { try { return window.localStorage.getItem("cgl-feed-alles") === "1"; } catch { return false; } });
  const umschalten = (v: boolean) => { setAlles(v); try { window.localStorage.setItem("cgl-feed-alles", v ? "1" : "0"); } catch { /* egal */ } };
  const [notizAuf, setNotizAuf] = useState(false);
  const w = l.woche;
  const zahlen = FEED_WOCHE_ZAEHLT.filter((a) => (w.zahlen[a] ?? 0) > 0);
  return (
    <Abschnitt id="feed" auge={w.istDieseWoche ? "Diese Woche · lädt jede Minute nach" : "Rückblick"} titel={w.name} klasse="cgl-feed"
               rechts={(
                 <div className="cgl-feed-nav" role="group" aria-label="Woche wählen">
                   <button type="button" className="cgl-knopf klein" onClick={() => setWoche(w.vorher)} data-cgl="woche-davor">‹ Woche davor</button>
                   {!w.istDieseWoche && <button type="button" className="cgl-knopf klein" onClick={() => setWoche(w.nachher)}>Woche danach ›</button>}
                   {!w.istDieseWoche && <button type="button" className="cgl-knopf klein voll" onClick={() => setWoche(null)}>Diese Woche</button>}
                 </div>
               )}>
      <div className="cgl-feed-leiste">
        <ul className="cgl-feed-zahlen" aria-label="Die Woche in Zahlen">
          {zahlen.length === 0 ? <li>Noch nichts in dieser Woche.</li> : zahlen.map((a) => (
            <li key={a}><b>{a === "zahlung" ? geld(w.zahlungCents) : w.zahlen[a]}</b>{a === "zahlung" ? "eingegangen" : WOCHE_WORT[a]![(w.zahlen[a] ?? 0) === 1 ? 0 : 1]}</li>
          ))}
        </ul>
        <div className="cgl-feed-wahl">
          <div className="cgl-schalter" role="group" aria-label="Was der Feed zeigt">
            <button type="button" aria-pressed={!alles} className={!alles ? "an" : ""} onClick={() => umschalten(false)}>Wichtiges</button>
            <button type="button" aria-pressed={alles} className={alles ? "an" : ""} onClick={() => umschalten(true)}>Alles</button>
          </div>
          <button type="button" className="cgl-knopf klein" onClick={() => setNotizAuf((v) => !v)} data-cgl="notiz-frei">{notizAuf ? "Schließen" : "Notiz festhalten"}</button>
        </div>
      </div>
      {notizAuf && <NotizForm bezugArt="frei" bezugId="" name="Allgemein" heute={l.heute} fertig={() => { setNotizAuf(false); neu(); }} abbrechen={() => setNotizAuf(false)} />}
      {w.tage.map((t) => <FeedTagBlock key={t.tag} t={t} alles={alles} neueIds={neueIds} />)}
    </Abschnitt>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · DER NÄCHSTE SCHRITT JE MANDANT
// ═══════════════════════════════════════════════════════════════════════════
function NotizForm({ bezugArt, bezugId, name, heute, fertig, abbrechen }: { bezugArt: string; bezugId: string; name: string; heute: string; fertig: (meldung: string) => void; abbrechen: () => void }) {
  const [text, setText] = useState("");
  const [am, setAm] = useState("");
  const [stichwort, setStichwort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const j = await senden("/chef/global-lage/notiz", { bezugArt, bezugId, art: "gespraech", text, wiedervorlageAm: am || null, wiedervorlageText: stichwort || null });
    setLaeuft(false);
    if (!j.ok) { setFehler(j.error || "Nicht gespeichert."); return; }
    fertig(String(j.meldung || "Gespeichert."));
  };
  return (
    <form className="cgl-form" onSubmit={(e) => { e.preventDefault(); void speichern(); }} data-cgl="notiz-form">
      <label>
        <span>Was wurde gesprochen? <i>{name}</i></span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={LAGE_NOTIZ_MAX} autoFocus placeholder="Kurz in eigenen Worten — steht danach im Feed und an der Karte." />
      </label>
      <div className="cgl-form-zeile">
        <label>
          <span>Wiedervorlage am</span>
          <input type="date" value={am} min={heute} onChange={(e) => setAm(e.target.value)} />
        </label>
        <label className="breit">
          <span>Stichwort dazu</span>
          <input type="text" value={stichwort} maxLength={LAGE_WIEDERVORLAGE_TEXT_MAX} onChange={(e) => setStichwort(e.target.value)} placeholder="z. B. anrufen, Angebot besprechen" disabled={!am} />
        </label>
      </div>
      <div className="cgl-form-fuss">
        <div className="cgl-schnell" aria-label="Schnellwahl Wiedervorlage">
          {[1, 3, 7].map((n) => <button key={n} type="button" onClick={() => setAm(tagPlus(heute, n))}>{n === 1 ? "morgen" : `in ${n} Tagen`}</button>)}
        </div>
        <button type="button" className="cgl-knopf" onClick={abbrechen}>Abbrechen</button>
        <button type="submit" className="cgl-knopf voll" disabled={laeuft || (!text.trim() && !am)}>{laeuft ? "Speichert …" : "Festhalten"}</button>
      </div>
      {fehler && <p className="cgl-fehler" role="alert">{fehler}</p>}
    </form>
  );
}

function VerlaengernForm({ m, heute, fertig, abbrechen }: { m: Mandant; heute: string; fertig: (meldung: string) => void; abbrechen: () => void }) {
  const basis = m.gueltigBis && m.gueltigBis > heute ? m.gueltigBis : heute;
  const [bis, setBis] = useState(tagPlus(basis, 7));
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const j = await senden(`/chef/global-lage/angebot/${m.angebotId}/gueltigkeit`, { gueltigBis: bis });
    setLaeuft(false);
    if (!j.ok) { setFehler(j.error || "Nicht gespeichert."); return; }
    fertig(String(j.meldung || "Verlängert."));
  };
  return (
    <form className="cgl-form" onSubmit={(e) => { e.preventDefault(); void speichern(); }} data-cgl="verlaengern-form">
      <div className="cgl-form-zeile">
        <label>
          <span>Neu gültig bis <i>bisher {tagKurz(m.gueltigBis)}</i></span>
          <input type="date" value={bis} min={heute} max={tagPlus(heute, 60)} onChange={(e) => setBis(e.target.value)} autoFocus />
        </label>
      </div>
      <p className="cgl-form-hinweis">Ändert nur das Datum — kein Preis, kein Text, keine Mail an den Kunden.</p>
      <div className="cgl-form-fuss">
        <div className="cgl-schnell" aria-label="Schnellwahl">
          {[7, 14].map((n) => <button key={n} type="button" onClick={() => setBis(tagPlus(heute, n))}>{n} Tage ab heute</button>)}
        </div>
        <button type="button" className="cgl-knopf" onClick={abbrechen}>Abbrechen</button>
        <button type="submit" className="cgl-knopf voll" disabled={laeuft}>{laeuft ? "Speichert …" : "Verlängern"}</button>
      </div>
      {fehler && <p className="cgl-fehler" role="alert">{fehler}</p>}
    </form>
  );
}

function MandantKarte({ m, heute, darfVerlaengern, neu, markiert }: { m: Mandant; heute: string; darfVerlaengern: boolean; neu: () => void; markiert: boolean }) {
  const [form, setForm] = useState<"notiz" | "verlaengern" | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const w = m.wert;
  const [bezugArt, bezugId] = m.schluessel.split(":") as [string, string];
  const kopieren = async () => {
    if (!m.link) return;
    try { await navigator.clipboard.writeText(m.link); }
    catch {
      const t = document.createElement("textarea"); t.value = m.link; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch { /* egal */ } t.remove();
    }
    setKopiert(true); window.setTimeout(() => setKopiert(false), 2200);
  };
  const fertig = (text: string) => { setForm(null); setMeldung(text); neu(); };
  const geldZeile = [
    w.startCents > 0 ? `Start ${geld(w.startCents)}${w.startBezahlt ? " · bezahlt" : w.startOffenCents < w.startCents ? ` · offen ${geld(w.startOffenCents)}` : ""}` : "",
    w.erfolgNachErgebnis ? "Erfolgshonorar nach Ergebnis" : w.erfolgCents > 0 ? `Erfolgshonorar ${geld(w.erfolgCents)}${w.erfolgStand === "bezahlt" ? " · bezahlt" : w.erfolgStand === "gestellt" ? " · Rechnung gestellt" : ""}` : "",
  ].filter(Boolean);
  const letzte = m.notizen[0];
  return (
    <article className={`cgl-karte ${m.schritt.ton}${m.schritt.ueberfaellig ? " rot" : ""}${markiert ? " markiert" : ""}`} id={`cgl-m-${m.schluessel.replace(/[^A-Za-z0-9-]/g, "-")}`} data-cgl-mandant={m.schluessel}>
      <header>
        <span className={`cgl-punkt ${m.schritt.ton}`} aria-hidden="true" />
        <h3>{m.name}</h3>
        <span className="cgl-phase">{PHASE_NAME[m.phase]}{m.phase === "angebot" && m.gueltigBis ? ` · bis ${tagKurz(m.gueltigBis)}` : ""}</span>
      </header>
      <p className="cgl-schritt">{m.schritt.schritt}</p>
      <p className="cgl-warum">{m.schritt.warum}</p>
      {geldZeile.length > 0 && <p className="cgl-geld">{geldZeile.join(" · ")}</p>}
      {letzte && (
        <blockquote className="cgl-notiz" data-volltext>
          <span>{letzte.text || (letzte.wiedervorlageAm ? `Wiedervorlage ${tagKurz(letzte.wiedervorlageAm)}${letzte.wiedervorlageText ? `: ${letzte.wiedervorlageText}` : ""}` : "")}</span>
          <cite>{tagKurz(letzte.tag)}{letzte.von ? ` · ${letzte.von}` : ""}{letzte.text && letzte.wiedervorlageAm && !letzte.erledigt ? ` · Wiedervorlage ${tagKurz(letzte.wiedervorlageAm)}` : ""}</cite>
        </blockquote>
      )}
      {meldung && <p className="cgl-ok" role="status">{meldung}</p>}
      <div className="cgl-knoepfe">
        {m.link && <a className="cgl-knopf" href={m.link} target="_blank" rel="noopener noreferrer">Angebot ansehen</a>}
        {m.link && <button type="button" className="cgl-knopf" onClick={() => void kopieren()}>{kopiert ? "Kopiert" : "Link kopieren"}</button>}
        {m.kannVerlaengern && darfVerlaengern && <button type="button" className="cgl-knopf" aria-expanded={form === "verlaengern"} onClick={() => setForm(form === "verlaengern" ? null : "verlaengern")}>Verlängern</button>}
        <button type="button" className="cgl-knopf" aria-expanded={form === "notiz"} onClick={() => setForm(form === "notiz" ? null : "notiz")}>Notiz &amp; Wiedervorlage</button>
        {m.ziele.akte && <Link href={m.ziele.akte} className="cgl-knopf">Akte &amp; Unterlagen</Link>}
        {!m.ziele.akte && m.ziele.angebot && <Link href={m.ziele.angebot} className="cgl-knopf">Angebot verwalten</Link>}
      </div>
      {form === "notiz" && <NotizForm bezugArt={bezugArt} bezugId={bezugId} name={m.name} heute={heute} fertig={fertig} abbrechen={() => setForm(null)} />}
      {form === "verlaengern" && <VerlaengernForm m={m} heute={heute} fertig={fertig} abbrechen={() => setForm(null)} />}
      {m.meilensteinOffen && m.ziele.angebot && (
        <p className="cgl-meilenstein">
          <b>Achtung, Rechnung:</b> {m.meilensteinKnopf ? `Der Knopf „${m.meilensteinKnopf}“` : "Der Meilenstein-Knopf"} im Angebot stellt sofort die Rechnung
          für das Erfolgshonorar ({geld(w.erfolgCents)}) — nur mit Justins Wort. <Link href={m.ziele.angebot}>Zum Knopf im Angebot</Link>
        </p>
      )}
    </article>
  );
}

function Mandanten({ l, neu, markiert }: { l: LageAntwort; neu: () => void; markiert: string | null }) {
  const uns = l.mandanten.filter((m) => m.schritt.ton === "uns");
  const wartet = l.mandanten.filter((m) => m.schritt.ton === "kunde" || m.schritt.ton === "amt");
  const ruhe = l.mandanten.filter((m) => m.schritt.ton === "ruhe");
  const darfVerlaengern = l.stufe !== "leitung";
  const gruppe = (titel: string, satz: string, liste: Mandant[], schluessel: string) => liste.length > 0 && (
    <div className="cgl-gruppe" data-cgl-gruppe={schluessel}>
      <header><h3>{titel}<em>{liste.length}</em></h3><span>{satz}</span></header>
      <div className="cgl-karten">{liste.map((m) => <MandantKarte key={m.schluessel} m={m} heute={l.heute} darfVerlaengern={darfVerlaengern} neu={neu} markiert={markiert === m.schluessel} />)}</div>
    </div>
  );
  return (
    <Abschnitt id="mandanten" auge="Jeder Mandant, ein Schritt" titel="Nächster Schritt je Mandant" zahl={l.mandanten.length}
               rechts={<Link href="/chef/global-kunden" className="cgl-link">Alle Akten</Link>}>
      {l.mandanten.length === 0 && <p className="cgl-leer">Noch kein Angebot und keine Akte.</p>}
      {gruppe("Wir sind dran", "Nachfassen, verlängern, Neues ansehen.", uns, "uns")}
      {gruppe("Wartet", "Der Kunde oder eine Behörde ist am Zug.", wartet, "wartet")}
      {gruppe("Ruhig", "Nichts offen.", ruhe, "ruhe")}
    </Abschnitt>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// ═══════════════════════════════════════════════════════════════════════════
export default function ChefGlobalLage() {
  const [woche, setWoche] = useState<string | null>(null);
  const { daten, laedt, fehler, neu, leise } = useDaten<LageAntwort>(`/chef/global-lage${woche ? `?woche=${woche}` : ""}`, [], NACHLADEN_MS);
  const rundgangStart = useRef<(() => void) | null>(null);
  // Was beim leisen Nachladen NEU dazukommt, leuchtet einmal kurz auf — beim ersten Laden und beim Wochenwechsel nichts.
  const bekannt = useRef<{ woche: string; ids: Set<string> } | null>(null);
  const [neueIds, setNeueIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!daten) return;
    const ids = new Set(daten.woche.tage.flatMap((t) => t.eintraege.map((e) => e.id)));
    const vorher = bekannt.current;
    if (vorher && vorher.woche === daten.woche.montag) {
      const frisch = new Set(Array.from(ids).filter((id) => !vorher.ids.has(id)));
      if (frisch.size) { setNeueIds(frisch); const t = window.setTimeout(() => setNeueIds(new Set()), 6000); bekannt.current = { woche: daten.woche.montag, ids }; return () => window.clearTimeout(t); }
    }
    bekannt.current = { woche: daten.woche.montag, ids };
  }, [daten]);
  // Von „Wir warten auf“ zur Karte des Mandanten springen (und sie kurz markieren).
  const [markiert, setMarkiert] = useState<string | null>(null);
  const zuMandant = (schluessel: string) => {
    setMarkiert(schluessel);
    const el = document.getElementById(`cgl-m-${schluessel.replace(/[^A-Za-z0-9-]/g, "-")}`);
    el?.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => setMarkiert((v) => (v === schluessel ? null : v)), 2600);
  };
  const springen = (id: string) => document.getElementById(`cgl-${id}`)?.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "start" });
  const wege = useMemo(() => daten ? [
    { id: "feed", text: "Feed" }, { id: "wartet", text: `Wir warten auf · ${daten.wartet.length}` },
    { id: "mandanten", text: `Mandanten · ${daten.mandanten.length}` }, ...(daten.termine.length ? [{ id: "termine", text: `Gespräche · ${daten.termine.length}` }] : []),
  ] : [], [daten]);

  return (
    <div className="cgl">
      <Rundgang raum="chef-global-lage" titel="Global-Lage" schritte={RUNDGAENGE.chefGlobalLage.schritte} knopf="keiner" startRef={rundgangStart} />
      <div className="cgl-blatt">
        <header className="cgl-kopf">
          <div>
            <span className="cgl-auge">Chefbüro · FIAON Global</span>
            <h1>Lage</h1>
            <p>{daten ? langerTag(daten.heute) : " "}</p>
          </div>
          <div className="cgl-kopf-rechts">
            {daten && <span className="cgl-stand" title="Die Seite lädt jede Minute leise nach, solange der Tab offen ist."><i aria-hidden="true" />Stand {uhrzeit(daten.stand)} Uhr</span>}
            <button type="button" className="cgl-link" onClick={() => leise()} data-cgl="aktualisieren">Aktualisieren</button>
            <button type="button" className="cgl-link" onClick={() => rundgangStart.current?.()} data-cgl="rundgang">Rundgang</button>
          </div>
        </header>

        {laedt && !daten && <div className="cgl-laedt"><Geruest zeilen={7} /></div>}
        {fehler && !daten && <div className="cgl-laedt"><Fehlermeldung text={fehler} erneut={neu} /></div>}

        {daten && (
          <>
            {daten.luecken.length > 0 && (
              <p className="cgl-luecke" role="status"><b>Nicht alles ließ sich laden:</b> {daten.luecken.join(", ")}. Die übrigen Angaben stimmen. <button type="button" className="cgl-link" onClick={neu}>Nochmal versuchen</button></p>
            )}
            <nav className="cgl-wege" aria-label="Abschnitte der Lage">
              {wege.map((x) => <button key={x.id} type="button" onClick={() => springen(x.id)}>{x.text}</button>)}
            </nav>
            <div className={`cgl-oben${daten.fixkosten ? "" : " allein"}`}>
              <Auftragswert a={daten.auftragswert} />
              {daten.fixkosten && <Fixkosten f={daten.fixkosten} heute={daten.heute} darfSetzen={daten.stufe === "inhaber"} neu={neu} />}
            </div>
            <div className="cgl-mitte">
              <Feed l={daten} setWoche={setWoche} neueIds={neueIds} neu={neu} />
              <div className="cgl-seite">
                <Wartet liste={daten.wartet} heute={daten.heute} neu={neu} zuMandant={zuMandant} />
                <Termine liste={daten.termine} heute={daten.heute} />
                <Partner p={daten.partner} heute={daten.heute} />
              </div>
            </div>
            <Mandanten l={daten} neu={neu} markiert={markiert} />
            <footer className="cgl-fuss">
              <span>Privatkunden: <Link href="/chef/lage">Lagezimmer Privat</Link></span>
              <span>Hier sendet nichts von allein. Mails gehen nur als Entwurf, Rechnungen nur mit deinem Wort.</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
