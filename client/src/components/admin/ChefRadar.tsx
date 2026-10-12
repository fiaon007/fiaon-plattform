// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · FIRMEN-RADAR (19.09.2026, Fassung 2)
//
// Justin nach dem ersten Tag: „Bei manchen kommt: Keine gültige
// Empfängeradresse. Das muss ja bitte vollständig sein — und mehrere
// gleichzeitig markieren und versenden — und bisschen cleaner, moderner alles,
// dass man mehr Platz hat und verständlicher."
//
// Also: eine Tabelle über die ganze Breite statt zweier enger Spalten, Reiter
// nach Stand mit Zahlen, Häkchen je Zeile und unten eine Leiste für den Stapel
// (vorbereiten · Entwürfe · senden). Die Akte öffnet sich als Seitenblatt mit
// drei Reitern (Überblick · Website-Scan · Mail) — dort ist Platz für Vorschau
// und Versand. Fehlt eine Adresse, lässt sie sich nachsuchen oder eintragen;
// ohne Adresse geht nichts hinaus.
//
// Gesendet wird nie ohne Klick: Der Stapel fragt vorher, zwischen zwei Mails
// liegen 20 bis 45 Sekunden. Die Arbeit macht server/lib/fiaon-radar.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API, datum, seit, eur, zahl, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  RADAR_BEREICHE, RADAR_GRUPPEN, RADAR_STATUS, RADAR_STAPEL_MAX, RADAR_ZIELBILD, RADAR_TRICHTER, RADAR_ANTWORT_ARTEN, RADAR_KERNSATZ,
  RADAR_NACHFASS_TAGE, RADAR_HOECHSTENS_JE_TAG, RADAR_SIGNALE, RADAR_SIGNAL_AB, radarBereich, type RadarStatus, type RadarAntwortArt,
} from "@shared/fiaon-radar";
import { GLOBAL_PAKETE } from "@shared/fiaon-global";
import "@/styles/office-rundgang.css";
import "@/styles/chef-radar.css";

type Grund = { text: string; url: string };
type Zeile = {
  id: number; tag: string; quelle: string; bereich: string; land: string | null; name: string; domain: string; website: string;
  ort: string | null; kurz: string | null; passung: number | null; gruende: Grund[]; signale: string[]; email: string | null;
  ansprechpartner: string | null; status: RadarStatus; gescannt_am: string | null; mail_am: string | null; versendet_am: string | null;
  postfach: string | null; hat_scan: boolean; hat_mail: boolean; created_at: string;
  signal?: { art?: string; beleg?: string; url?: string } | null; signal_staerke?: number | null; antwort_am?: string | null; antwort_art?: string | null;
  lead_am?: string | null; termin_am?: string | null; kauf_am?: string | null; nachfass_stufe?: number | null; nachfass_faellig?: string | null; adresse_vorschlag?: string | null;
};
type TrichterTag = {
  tag: string; gefunden: number; angeschrieben: number; nachfass: number; unzustellbar: number; antworten: number;
  leads: number; termine: number; angebote: number; kaeufe: number; umsatzCents: number; absagen: number;
};
type Automatik = { versand: boolean; jeTag: number; nachfass: boolean; mara: "auto" | "entwurf" | "aus"; abPassung: number };
type Trichter = {
  tage: TrichterTag[]; summe: TrichterTag & { zugestellt: number }; gesamt: TrichterTag & { zugestellt: number }; heute: TrichterTag;
  ziel: { leads: number; kaeufe: number }; vorrat: number; automatik: Automatik;
};
type Post = {
  id: number; firma_id: number; postfach: string; richtung: "ein" | "aus"; art: string; von: string; betreff: string; datum: string;
  text: string | null; zusammenfassung: string | null; neue_adresse: string | null; mara_text: string | null; mara_status: string | null;
  mara_pruefung: string[]; mara_am: string | null; firma: string; domain: string; firma_status: string; ansprechpartner: string | null;
};
type Aufhaenger = { text: string; beleg: string; url: string; quelle: "website" | "web" };
type Mail = {
  betreff: string; anrede: string; absaetze: string[]; frage: string; ps: string; paket: string | null; html: string; text: string;
  links: { gespraech: string; seite: string }; warnungen: string[]; sperrend: string[]; geaendert: boolean; erstellt_am: string;
};
type Voll = Zeile & {
  impressum: any; notiz: string | null; gmail_entwurf_id: string | null;
  scan: { profil: any; aufhaenger: Aufhaenger[]; verworfen: number; seiten: { url: string; titel: string }[]; am: string } | null;
  mail: Mail | null;
};
type Lauf = {
  id: number; art: string; bereich: string | null; land: string | null; status: "laeuft" | "fertig" | "fehler" | "abgebrochen";
  vorgeschlagen: number; neu: number; gesamt: number; fertig: number; aktuell: string | null;
  ergebnisse: { id: number; name: string; ok: boolean; text: string }[];
  verworfen: { name: string; website: string; grund: string }[]; fehler: string | null; created_at: string; fertig_am: string | null;
};
type Uebersicht = {
  firmen: Zeile[]; heute: string; tagesziel: number; stapelMax: number; kostenHeute: number; deckel: number; postfaecher: string[];
  absender: { name: string; rolle: string; telefon: string }; gmail: boolean; ki: boolean;
  zahlen: { heute: number; heute_tageslauf: number; gesamt: number; versendet: number; antworten: number; leads: number; kaeufe: number; offen: number };
  nachStand: Record<string, number>; laeufe: Lauf[];
};

async function rufen<T = any>(pfad: string, methode: "POST" | "PUT" | "GET" = "POST", body?: unknown): Promise<T> {
  const r = await fetch(`${API}${pfad}`, {
    method: methode, credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) throw new Error(j?.error || `Fehler ${r.status}`);
  return j as T;
}

const paketName = (key: string | null | undefined) => GLOBAL_PAKETE.find((p) => p.key === key)?.de.name ?? null;
const LAND: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const STAPEL_TITEL: Record<string, string> = { vorbereiten: "Mails vorbereiten", entwurf: "Entwürfe ins Postfach", senden: "Mails senden" };

function Passung({ wert }: { wert: number | null }) {
  if (wert == null) return <span className="cr-passung leer">—</span>;
  return <span className={`cr-passung${wert >= 80 ? " hoch" : wert >= 60 ? " mittel" : ""}`} title="Einschätzung der KI, wie gut die Firma ins Zielbild passt">{wert}</span>;
}
function Stand({ s }: { s: RadarStatus }) {
  const d = RADAR_STATUS[s] ?? { label: s, ton: "neu" };
  return <span className={`cr-stand ${d.ton}`}>{d.label}</span>;
}
function Balken({ wert, ziel }: { wert: number; ziel: number }) {
  return <span className="cr-balken" aria-hidden="true"><i style={{ width: `${Math.max(2, Math.min(100, ziel ? (wert / ziel) * 100 : 0))}%` }} /></span>;
}

export default function ChefRadar() {
  // E-337 (12.10.2026): Die Seite ist jetzt der B2B-Vertrieb — Mara oben, darunter vier Reiter.
  const [haupt, setHaupt] = useState<HauptReiter>(() => {
    try { const r = new URLSearchParams(window.location.search).get("reiter"); if (r && HAUPT_REITER.some((h) => h.key === r)) return r as HauptReiter; } catch { /* egal */ }
    return "gespraeche";
  });
  const [offen, setOffen] = useState<number | null>(() => {
    try { const f = Number(new URLSearchParams(window.location.search).get("firma")); return Number.isInteger(f) && f > 0 ? f : null; } catch { return null; }
  });
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [suchen, setSuchen] = useState(false);
  const [website, setWebsite] = useState(false);
  const [postfach, setPostfach] = useState("");
  const [runde, setRunde] = useState(0);
  const neuLaden = () => setRunde((r) => r + 1);

  const wechseln = (r: HauptReiter) => {
    setHaupt(r);
    try { const u = new URL(window.location.href); u.searchParams.set("reiter", r); window.history.replaceState(null, "", u.toString()); } catch { /* egal */ }
  };
  const firmaOeffnen = (id: number | null) => {
    setOffen(id);
    try { const u = new URL(window.location.href); if (id) u.searchParams.set("firma", String(id)); else u.searchParams.delete("firma"); window.history.replaceState(null, "", u.toString()); } catch { /* egal */ }
  };

  const t = useDaten<Trichter>(`/chef/radar/trichter?tage=30`, [runde]);
  const u = useDaten<Uebersicht>(`/chef/radar?gruppe=gespraech`, [runde]);
  const offenePost = useDaten<{ post: Post[] }>(`/chef/radar/post?nur=offen`, [runde]);
  useEffect(() => { if (!postfach && u.daten?.postfaecher?.length) setPostfach(u.daten.postfaecher[0]); }, [u.daten, postfach]);

  // Ein laufender Lauf (Suche oder Stapel) wird alle drei Sekunden nachgefragt.
  const laufId = lauf?.id ?? null;
  const laeuft = lauf?.status === "laeuft";
  useEffect(() => {
    if (!laufId || !laeuft) return;
    const uhr = window.setInterval(async () => {
      try { const j = await rufen<{ lauf: Lauf }>(`/chef/radar/lauf/${laufId}`, "GET"); setLauf(j.lauf); neuLaden(); } catch { /* beim nächsten Mal */ }
    }, 3000);
    return () => window.clearInterval(uhr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laufId, laeuft]);
  // Mara arbeitet im Hintergrund — die Zahlen frischen sich jede Minute auf.
  useEffect(() => { const uhr = window.setInterval(neuLaden, 60_000); return () => window.clearInterval(uhr); }, []);

  const anzahlOffen = offenePost.daten?.post?.length ?? 0;

  return (
    <div className="cr cr-glas">
      <Rundgang raum="firmen-radar" titel="Firmen-Radar" schritte={RUNDGAENGE.firmenRadar.schritte} />

      <MaraKopf trichter={t.daten} uebersicht={u.daten} onGeaendert={neuLaden} onSuchen={() => setSuchen(true)} onWebsite={() => setWebsite(true)} />
      {t.fehler && <Fehlermeldung text={t.fehler} erneut={t.neu} />}
      <TrichterTafel trichter={t.daten} />

      {lauf && <LaufBanner lauf={lauf} onZu={() => setLauf(null)} onAbbrechen={() => { void rufen(`/chef/radar/lauf/${lauf.id}/abbrechen`).catch(() => {}); }} />}

      <nav className="cr-haupt" role="tablist" aria-label="Bereiche">
        {HAUPT_REITER.map((r) => (
          <button key={r.key} type="button" role="tab" aria-selected={haupt === r.key} className={haupt === r.key ? "an" : undefined} onClick={() => wechseln(r.key)}>
            {r.label}{r.key === "gespraeche" && anzahlOffen > 0 && <i>{anzahlOffen}</i>}
          </button>
        ))}
      </nav>

      {haupt === "gespraeche" && <Gespraeche runde={runde} onFirma={firmaOeffnen} onGeaendert={neuLaden} />}
      {haupt === "firmen" && <FirmenListe runde={runde} postfach={postfach} lauf={lauf} setLauf={setLauf} onFirma={firmaOeffnen} offen={offen} onSuchen={() => setSuchen(true)} />}
      {haupt === "automatik" && <AutomatikTafel trichter={t.daten} uebersicht={u.daten} onGeaendert={neuLaden} onSuchen={() => setSuchen(true)} onWebsite={() => setWebsite(true)} />}
      {haupt === "messung" && <Messung trichter={t.daten} />}

      {suchen && <SuchFenster onZu={() => setSuchen(false)} onLauf={(l) => { setLauf(l); setSuchen(false); wechseln("firmen"); }} />}
      {website && <WebsiteFenster onZu={() => setWebsite(false)} onFertig={(id) => { setWebsite(false); neuLaden(); firmaOeffnen(id); }} />}
      {offen && <Akte key={offen} id={offen} uebersicht={u.daten} postfach={postfach} onPostfach={setPostfach} onZu={() => firmaOeffnen(null)} onGeaendert={neuLaden} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-337 — MARA OBEN: DER EINE SCHALTER, DIE ZWEI ZIELE
// ═══════════════════════════════════════════════════════════════════════════
type HauptReiter = "gespraeche" | "firmen" | "automatik" | "messung";
const HAUPT_REITER: { key: HauptReiter; label: string }[] = [
  { key: "gespraeche", label: "Gespräche" },
  { key: "firmen", label: "Firmen" },
  { key: "automatik", label: "Automatik" },
  { key: "messung", label: "Messung" },
];

function Ring({ wert, ziel, label, unter }: { wert: number; ziel: number; label: string; unter?: string }) {
  const anteil = ziel > 0 ? Math.max(0, Math.min(1, wert / ziel)) : 0;
  const umfang = 2 * Math.PI * 42;
  // Die Kennung des Verlaufs darf kein Leerzeichen tragen — sonst findet url(#…) ihn nicht, und der Bogen bleibt unsichtbar.
  const kennung = `cr-ring-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`cr-ring${wert >= ziel && ziel > 0 ? " voll" : ""}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={kennung} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7cc3ff" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" className="cr-ring-spur" />
        {anteil > 0 && <circle cx="50" cy="50" r="42" className="cr-ring-wert" stroke={`url(#${kennung})`} strokeDasharray={`${umfang * anteil} ${umfang}`} transform="rotate(-90 50 50)" />}
      </svg>
      <div className="cr-ring-mitte"><b>{zahl(wert)}</b><small>von {ziel}</small></div>
      <span className="cr-ring-label">{label}</span>
      {unter && <span className="cr-ring-unter">{unter}</span>}
    </div>
  );
}

function MaraKopf({ trichter, uebersicht, onGeaendert, onSuchen, onWebsite }: {
  trichter: Trichter | null; uebersicht: Uebersicht | null; onGeaendert: () => void; onSuchen: () => void; onWebsite: () => void;
}) {
  const a = trichter?.automatik;
  const an = !!a && a.versand && a.nachfass;
  const [frage, setFrage] = useState(false);
  const [verantwortet, setVerantwortet] = useState(false);
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const h = trichter?.heute;
  const postfach = uebersicht?.postfaecher?.[0] ?? "js@fiaon.com";

  const schalten = async (ein: boolean) => {
    setArbeit("schalter"); setMeldung(null);
    try {
      await rufen("/chef/radar/automatik", "POST", ein ? { versand: true, nachfass: true, mara: "auto" } : { versand: false, nachfass: false });
      setFrage(false); setVerantwortet(false); onGeaendert();
      setMeldung({ art: "gut", text: ein ? "Mara verkauft. Erste Mails gehen werktags von 8:30 bis 17:30 Uhr hinaus, Antworten liest sie rund um die Uhr." : "Mara pausiert den Versand. Antworten liest sie weiter." });
    } catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };
  const knopf = async (name: string, pfad: string, text: (j: any) => string) => {
    setArbeit(name); setMeldung(null);
    try { const j = await rufen<any>(pfad, "POST"); onGeaendert(); setMeldung({ art: "gut", text: text(j.ergebnis ?? {}) }); }
    catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };

  return (
    <header className="cr-held">
      <div className="cr-held-text">
        <span className="cr-auge">Vertrieb · FIAON Global</span>
        <h1>Firmen-Radar</h1>
        <p>Mara findet Firmen mit Kapitalbedarf, schreibt jeder persönlich, fasst nach, beantwortet jede Antwort und bringt das Gespräch bis zum Kauf.</p>
        <div className="cr-held-tun">
          <button type="button" className="cr-glasknopf" disabled={!!arbeit} onClick={() => knopf("post", "/chef/radar/post-lauf", (e) => `Postfach geprüft: ${e.eingang ?? 0} neue Antworten, davon ${e.leads ?? 0} Leads.`)}>
            {arbeit === "post" ? "Prüft …" : "Postfach jetzt prüfen"}
          </button>
          <button type="button" className="cr-glasknopf" disabled={!!arbeit || !an} title={an ? "" : "Erst Mara einschalten"} onClick={() => knopf("versand", "/chef/radar/versand-lauf", (e) => e.grund ? `Keine Runde: ${e.grund}.` : `Runde fertig: ${e.erste ?? 0} erste Mails, ${e.nachfass ?? 0} Nachfass-Mails.`)}>
            {arbeit === "versand" ? "Sendet …" : "Jetzt eine Runde senden"}
          </button>
          <button type="button" className="cr-glasknopf leise" onClick={onSuchen}>Firmen suchen</button>
          <button type="button" className="cr-glasknopf leise" onClick={onWebsite}>Website aufnehmen</button>
        </div>
      </div>

      <div className="cr-held-ziele">
        <Ring wert={h?.leads ?? 0} ziel={trichter?.ziel.leads ?? 10} label="Leads heute" unter={`${zahl(h?.antworten ?? 0)} ${(h?.antworten ?? 0) === 1 ? "Antwort" : "Antworten"}`} />
        <Ring wert={h?.kaeufe ?? 0} ziel={trichter?.ziel.kaeufe ?? 5} label="Käufe heute" unter={h?.umsatzCents ? eur(h.umsatzCents) : `${zahl(h?.termine ?? 0)} ${(h?.termine ?? 0) === 1 ? "Termin" : "Termine"}`} />
      </div>

      <div className={`cr-mara${an ? " an" : ""}`}>
        <div className="cr-mara-kopf">
          <span className="cr-mara-punkt" aria-hidden="true" />
          <div>
            <b>Mara {an ? "verkauft" : "pausiert"}</b>
            <span>{an ? `${zahl(h?.angeschrieben ?? 0)} von ${a?.jeTag ?? 0} Mails heute · ${zahl(h?.nachfass ?? 0)} nachgefasst` : "Antworten liest sie trotzdem rund um die Uhr."}</span>
          </div>
          <button type="button" role="switch" aria-checked={an} className="cr-kippe" disabled={!!arbeit || !a} onClick={() => (an ? void schalten(false) : setFrage(true))}>
            <i aria-hidden="true" />
            <span className="sr-only">{an ? "Mara pausieren" : "Mara einschalten"}</span>
          </button>
        </div>
        <dl className="cr-mara-werte">
          <div><dt>Firmen im Vorrat</dt><dd>{zahl(trichter?.vorrat ?? 0)}</dd></div>
          <div><dt>KI heute</dt><dd>{(uebersicht?.kostenHeute ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</dd></div>
          <div className="breit"><dt>Absender</dt><dd>{postfach}</dd></div>
        </dl>
        {frage && (
          <div className="cr-mara-frage">
            <p>Mara schreibt und sendet ab jetzt selbst bis zu <b>{a?.jeTag ?? 0} erste Mails je Werktag</b> aus <b>{postfach}</b>, fasst zweimal nach und beantwortet Antworten. Aus js@ legt sie Antworten zur Freigabe bereit, statt sie selbst zu senden.</p>
            <p className="cr-recht">Werbe-Mails an Firmen brauchen in DE, AT und CH grundsätzlich eine vorherige Einwilligung (DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG). Mara hält die Leitplanken: jede Mail einzeln geschrieben, Tageskontingent, Abmeldesatz, Sperrliste.</p>
            <label className="cr-haken-zeile"><input type="checkbox" checked={verantwortet} onChange={(e) => setVerantwortet(e.target.checked)} /> Ich verantworte den automatischen Versand.</label>
            <div className="cr-fenster-zeile">
              <button type="button" className="cr-knopf" disabled={!verantwortet || !!arbeit} onClick={() => void schalten(true)}>{arbeit === "schalter" ? "Schaltet …" : "Mara einschalten"}</button>
              <button type="button" className="cr-knopf hell" onClick={() => setFrage(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
      {meldung && <p className={`cr-hinweis ${meldung.art} cr-held-meldung`}>{meldung.text}</p>}
    </header>
  );
}

// ── Der Trichter bis zum Kauf ────────────────────────────────────────────────
type Zeitraum = "heute" | "7" | "30" | "gesamt";
function TrichterTafel({ trichter }: { trichter: Trichter | null }) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>("30");
  const werte = useMemo(() => {
    if (!trichter) return null;
    const summe = (n: number) => trichter.tage.slice(0, n).reduce((a, t) => {
      const x = { ...a };
      for (const k of Object.keys(t) as (keyof TrichterTag)[]) if (typeof t[k] === "number") (x as any)[k] = ((a as any)[k] ?? 0) + (t[k] as number);
      return x;
    }, {} as Record<string, number>);
    const roh: Record<string, number> = zeitraum === "gesamt" ? (trichter.gesamt as any) : summe(zeitraum === "heute" ? 1 : Number(zeitraum));
    return { ...roh, zugestellt: Math.max(0, (roh.angeschrieben ?? 0) - (roh.unzustellbar ?? 0)) } as Record<string, number>;
  }, [trichter, zeitraum]);
  return (
    <section className="cr-trichter" aria-label="Vom Fund bis zum Kauf">
      <div className="cr-trichter-kopf">
        <h2>Vom Fund bis zum Kauf</h2>
        <div className="cr-segment" role="radiogroup" aria-label="Zeitraum">
          {([["heute", "Heute"], ["7", "7 Tage"], ["30", "30 Tage"], ["gesamt", "Gesamt"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={zeitraum === k} className={zeitraum === k ? "an" : undefined} onClick={() => setZeitraum(k)}>{l}</button>
          ))}
        </div>
      </div>
      <ol className="cr-trichter-stufen">
        {RADAR_TRICHTER.map((st, i) => {
          const wert = werte?.[st.key] ?? 0;
          const vorher = i > 0 ? werte?.[RADAR_TRICHTER[i - 1].key] ?? 0 : null;
          const quote = vorher ? Math.round((wert / vorher) * 1000) / 10 : null;
          return (
            <li key={st.key} className={i >= 4 ? "spaet" : undefined} title={st.satz}>
              <span className="cr-stufe-label">{st.label}</span>
              <b>{werte ? zahl(wert) : "—"}</b>
              <small>{quote != null && vorher ? `${quote.toLocaleString("de-DE")} %` : st.satz}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHE — jede Antwort, Maras Antwort, ein Klick
// ═══════════════════════════════════════════════════════════════════════════
const ART_TON: Record<string, string> = {
  interesse: "top", frage: "top", termin_wunsch: "top", kein_interesse: "aus", abwesend: "leise", weitergeleitet: "leise",
  falscher_empfaenger: "warn", unzustellbar: "rot", automatisch: "leise", sonstiges: "leise",
};

function Gespraeche({ runde, onFirma, onGeaendert }: { runde: number; onFirma: (id: number) => void; onGeaendert: () => void }) {
  const [nur, setNur] = useState<"offen" | "leads" | "alle">("offen");
  const { daten, laedt, fehler, neu } = useDaten<{ post: Post[] }>(`/chef/radar/post?nur=${nur}`, [nur, runde]);
  const post = daten?.post ?? [];
  return (
    <section className="cr-gespraeche">
      <div className="cr-zeile-kopf">
        <div className="cr-segment" role="radiogroup" aria-label="Filter">
          {([["offen", "Zu erledigen"], ["leads", "Leads"], ["alle", "Alle Antworten"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={nur === k} className={nur === k ? "an" : undefined} onClick={() => setNur(k)}>{l}</button>
          ))}
        </div>
        <span className="cr-klein">Mara liest alle 10 Minuten nur die Radar-Fäden — Absagen kommen von selbst auf die Sperrliste, Rückläufer bekommen eine neue Adresse.</span>
      </div>
      {fehler && <Fehlermeldung text={fehler} erneut={neu} />}
      {laedt && !daten && <Geruest zeilen={4} />}
      {daten && !post.length && (
        <div className="cr-leer">
          <b>{nur === "offen" ? "Nichts zu erledigen." : "Noch keine Antworten."}</b>
          <span>Sobald eine Firma antwortet, steht sie hier — mit Maras Antwort zur Freigabe.</span>
        </div>
      )}
      <div className="cr-post-liste">
        {post.map((p) => <PostKarte key={p.id} p={p} onFirma={onFirma} onGeaendert={() => { neu(); onGeaendert(); }} />)}
      </div>
    </section>
  );
}

function PostKarte({ p, onFirma, onGeaendert }: { p: Post; onFirma: (id: number) => void; onGeaendert: () => void }) {
  const [text, setText] = useState(p.mara_text ?? "");
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [frage, setFrage] = useState(false);
  const [hinweis, setHinweis] = useState("");
  useEffect(() => { setText(p.mara_text ?? ""); }, [p.mara_text]);
  const tun = async (name: string, fn: () => Promise<unknown>, gut: string) => {
    setArbeit(name); setMeldung(null);
    try { await fn(); setMeldung({ art: "gut", text: gut }); setFrage(false); onGeaendert(); }
    catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };
  const art = RADAR_ANTWORT_ARTEN[p.art as RadarAntwortArt];
  const fertig = p.mara_status === "gesendet" || p.mara_status === "von_hand";
  const darfAntworten = !!art && !["kein_interesse", "unzustellbar", "automatisch", "abwesend"].includes(p.art);
  return (
    <article className={`cr-post ${ART_TON[p.art] ?? "leise"}`}>
      <header className="cr-post-kopf">
        <button type="button" className="cr-post-firma" onClick={() => onFirma(p.firma_id)}>{p.firma}<span>{p.domain}</span></button>
        <span className={`cr-art ${ART_TON[p.art] ?? "leise"}`}>{art?.label ?? p.art}</span>
        <span className="cr-klein">{seit(p.datum)} · {p.von}</span>
      </header>
      {p.zusammenfassung && <p className="cr-post-satz">{p.zusammenfassung}</p>}
      {p.text && <details className="cr-post-mail"><summary>Ganze Mail lesen</summary><pre>{p.text}</pre></details>}
      {p.neue_adresse && <p className="cr-klein">Genannte Adresse: <b>{p.neue_adresse}</b> — in der Firma „Adresse übernehmen“.</p>}

      {darfAntworten && (
        <div className="cr-post-mara">
          <div className="cr-post-mara-kopf">
            <b>{fertig ? (p.mara_status === "gesendet" ? "Mara hat geantwortet" : "Von Hand beantwortet") : p.mara_text ? "Maras Antwort" : "Noch keine Antwort"}</b>
            {p.mara_am && <span className="cr-klein">{seit(p.mara_am)}</span>}
          </div>
          {!!p.mara_pruefung?.length && <p className="cr-hinweis warn">Wortwand: {p.mara_pruefung.join(" · ")}</p>}
          {(p.mara_text || !fertig) && (
            fertig
              ? <pre className="cr-post-gesendet">{p.mara_text}</pre>
              : p.mara_text
                ? <textarea className="cr-feld" rows={Math.min(18, Math.max(8, text.split("\n").length + 1))} value={text} onChange={(e) => setText(e.target.value)} />
                : null
          )}
          {!fertig && (
            <div className="cr-fenster-zeile">
              {p.mara_text && <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => setFrage(true)}>Senden …</button>}
              <input className="cr-feld" value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="Wunsch an Mara (optional): Preis nennen, Donnerstag anbieten …" maxLength={400} />
              <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => tun("mara", () => rufen(`/chef/radar/post/${p.id}/mara`, "POST", { hinweis: hinweis.trim() || null }), "Mara hat neu geschrieben.")}>
                {arbeit === "mara" ? "Mara schreibt …" : p.mara_text ? "Neu schreiben" : "Antwort schreiben lassen"}
              </button>
              {p.mara_text && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("weg", () => rufen(`/chef/radar/post/${p.id}/verwerfen`), "Verworfen.")}>Verwerfen</button>}
            </div>
          )}
          {frage && (
            <div className="cr-senden-frage">
              <b>Antwort an {p.von} aus {p.postfach} senden?</b>
              <div className="cr-fenster-zeile">
                <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => tun("senden", () => rufen(`/chef/radar/post/${p.id}/senden`, "POST", { text, bestaetigt: true }), "Gesendet.")}>
                  {arbeit === "senden" ? "Sendet …" : "Jetzt senden"}
                </button>
                <button type="button" className="cr-knopf hell" onClick={() => setFrage(false)}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIK — alle Schalter an einem Ort
// ═══════════════════════════════════════════════════════════════════════════
function AutomatikTafel({ trichter, uebersicht, onGeaendert, onSuchen, onWebsite }: {
  trichter: Trichter | null; uebersicht: Uebersicht | null; onGeaendert: () => void; onSuchen: () => void; onWebsite: () => void;
}) {
  const a = trichter?.automatik;
  const [jeTag, setJeTag] = useState<string>("");
  const [abPassung, setAbPassung] = useState<string>("");
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  useEffect(() => { if (a) { setJeTag(String(a.jeTag)); setAbPassung(String(a.abPassung)); } }, [a?.jeTag, a?.abPassung]); // eslint-disable-line react-hooks/exhaustive-deps
  const setzen = async (name: string, teil: Record<string, unknown>, gut: string) => {
    setArbeit(name); setMeldung(null);
    try { await rufen("/chef/radar/automatik", "POST", teil); onGeaendert(); setMeldung({ art: "gut", text: gut }); }
    catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };
  if (!a) return <Geruest zeilen={6} />;
  const postfach = uebersicht?.postfaecher?.[0] ?? "—";
  return (
    <section className="cr-automatik">
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      <div className="cr-kacheln">
        <article className="cr-kachel">
          <header><b>Erste Mails</b><Kippe an={a.versand} aus={!!arbeit} onKlick={() => setzen("versand", { versand: !a.versand }, a.versand ? "Erste Mails pausiert." : "Erste Mails laufen.")} /></header>
          <p>Mara wählt die Firmen mit dem stärksten Kapitalsignal, liest die Website, prüft die Lage der Firma und schreibt jede Mail einzeln. Werktags 8:30–17:30, gleichmäßig verteilt.</p>
          <div className="cr-kachel-feld">
            <label><span>Mails je Werktag</span><input className="cr-feld" type="number" min={0} max={RADAR_HOECHSTENS_JE_TAG} value={jeTag} onChange={(e) => setJeTag(e.target.value)} /></label>
            <label><span>Ab Passung</span><input className="cr-feld" type="number" min={0} max={100} value={abPassung} onChange={(e) => setAbPassung(e.target.value)} /></label>
            <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => setzen("zahlen", { jeTag: Number(jeTag), abPassung: Number(abPassung) }, "Gespeichert.")}>Speichern</button>
          </div>
          <span className="cr-klein">Höchstens {RADAR_HOECHSTENS_JE_TAG} je Postfach und Tag — darüber leidet die Zustellung.</span>
        </article>
        <article className="cr-kachel">
          <header><b>Nachfassen</b><Kippe an={a.nachfass} aus={!!arbeit} onKlick={() => setzen("nachfass", { nachfass: !a.nachfass }, a.nachfass ? "Nachfassen pausiert." : "Nachfassen läuft.")} /></header>
          <p>Zwei kurze Mails im selben Faden: nach {RADAR_NACHFASS_TAGE[0]} Tagen ein neuer Gedanke, {RADAR_NACHFASS_TAGE[1]} Tage später ein freundlicher Abschluss. Jede Antwort stoppt das Nachfassen sofort.</p>
        </article>
        <article className="cr-kachel">
          <header><b>Mara antwortet</b></header>
          <div className="cr-segment" role="radiogroup" aria-label="Mara antwortet">
            {([["auto", "Selbst"], ["entwurf", "Zur Freigabe"], ["aus", "Aus"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={a.mara === k} className={a.mara === k ? "an" : undefined} disabled={!!arbeit} onClick={() => setzen("mara", { mara: k }, "Gespeichert.")}>{l}</button>
            ))}
          </div>
          <p>Bei Interesse, Frage oder Terminwunsch schreibt Mara binnen Minuten zurück — mit zwei bis drei freien Gesprächszeiten und dem Buchungslink. {postfach === "js@fiaon.com" ? "Aus js@ sendet sie nie selbst: Ihre Antwort liegt unter „Gespräche“ zur Freigabe." : ""}</p>
        </article>
        <article className="cr-kachel">
          <header><b>Suche</b><span className="cr-chip">läuft täglich</span></header>
          <p>Der Tageslauf findet bis zu 50 neue Firmen am Tag (6–20 Uhr) — mit geprüfter Website, Impressum und einer Adresse, die einen Entscheider erreicht. Vorrat jetzt: <b>{zahl(trichter?.vorrat ?? 0)}</b> Firmen.</p>
          <div className="cr-fenster-zeile">
            <button type="button" className="cr-knopf hell" onClick={onSuchen}>Firmen suchen</button>
            <button type="button" className="cr-knopf hell" onClick={onWebsite}>Website aufnehmen</button>
          </div>
        </article>
        <article className="cr-kachel breit">
          <header><b>So klingt die erste Mail</b></header>
          <p className="cr-zitat">„{RADAR_KERNSATZ.was} {RADAR_KERNSATZ.vorteil}“</p>
          <p className="cr-klein">Dazu ein geprüfter Anlass aus der Website der Firma und eine Frage, auf die man mit einer Zeile antworten kann. Kein Preis, kein Betrag, kein Rahmen in der ersten Mail — die Zahlen gehören ins Gespräch.</p>
        </article>
        <article className="cr-kachel breit">
          <header><b>Leitplanken</b></header>
          <p className="cr-klein">Jede Mail einzeln geschrieben und gegen die Lage der Firma geprüft · Adress-Wand (kein support@, privacy@, Ticket-System, Platzhalter) · Sperrliste nach jeder Absage · Abmeldesatz und Impressum in jeder Mail · Absender {postfach} · Werbe-Mails an Firmen brauchen in DE, AT und CH grundsätzlich eine vorherige Einwilligung.</p>
        </article>
      </div>
    </section>
  );
}

function Kippe({ an, aus, onKlick }: { an: boolean; aus?: boolean; onKlick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={an} className="cr-kippe klein" disabled={aus} onClick={onKlick}>
      <i aria-hidden="true" /><span className="sr-only">{an ? "Ausschalten" : "Einschalten"}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG — jeder Tag eine Zeile
// ═══════════════════════════════════════════════════════════════════════════
function Messung({ trichter }: { trichter: Trichter | null }) {
  if (!trichter) return <Geruest zeilen={8} />;
  const spalten: [keyof TrichterTag, string][] = [
    ["gefunden", "Gefunden"], ["angeschrieben", "Angeschrieben"], ["nachfass", "Nachfass"], ["unzustellbar", "Rückläufer"], ["antworten", "Antworten"],
    ["absagen", "Absagen"], ["leads", "Leads"], ["termine", "Termine"], ["angebote", "Angebote"], ["kaeufe", "Käufe"],
  ];
  return (
    <section className="cr-messung">
      <div className="cr-tabelle-rahmen">
        <table className="cr-tabelle cr-tabelle-zahlen">
          <thead><tr><th>Tag</th>{spalten.map(([, l]) => <th key={l}>{l}</th>)}<th>Umsatz</th></tr></thead>
          <tbody>
            {trichter.tage.map((t) => (
              <tr key={t.tag} className={t.leads >= trichter.ziel.leads ? "ziel" : undefined}>
                <td>{new Date(`${t.tag}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                {spalten.map(([k]) => <td key={k} className={(t[k] as number) ? undefined : "null"}>{zahl(t[k] as number)}</td>)}
                <td>{t.umsatzCents ? eur(t.umsatzCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>30 Tage</td>{spalten.map(([k]) => <td key={k}>{zahl(trichter.summe[k] as number)}</td>)}<td>{trichter.summe.umsatzCents ? eur(trichter.summe.umsatzCents) : "—"}</td></tr>
            <tr><td>Gesamt</td>{spalten.map(([k]) => <td key={k}>{zahl(trichter.gesamt[k] as number)}</td>)}<td>{trichter.gesamt.umsatzCents ? eur(trichter.gesamt.umsatzCents) : "—"}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="cr-klein">Leads = Interesse, Sachfrage oder Terminwunsch (aus der Antwort) oder ein Termin/Auftrag über den Link der Mail. Käufe = bezahlter Global-Auftrag einer angeschriebenen Firma. Ziel je Tag: {trichter.ziel.leads} Leads, {trichter.ziel.kaeufe} Käufe.</p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN — die Liste wie bisher (Reiter, Tabelle, Stapel)
// ═══════════════════════════════════════════════════════════════════════════
function FirmenListe({ runde, postfach, lauf, setLauf, onFirma, offen, onSuchen }: {
  runde: number; postfach: string; lauf: Lauf | null; setLauf: (l: Lauf | null) => void; onFirma: (id: number) => void; offen: number | null; onSuchen: () => void;
}) {
  const [gruppe, setGruppe] = useState("");
  const [bereichFilter, setBereichFilter] = useState("");
  const [nurHeute, setNurHeute] = useState(false);
  const [suche, setSuche] = useState("");
  const [auswahl, setAuswahl] = useState<number[]>([]);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [sendenFrage, setSendenFrage] = useState(false);
  const [verantwortet, setVerantwortet] = useState(false);
  const [heute] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (nurHeute) p.set("tag", heute);
    if (gruppe) p.set("gruppe", gruppe);
    if (bereichFilter) p.set("bereich", bereichFilter);
    if (suche.trim().length >= 2) p.set("suche", suche.trim());
    return p.toString();
  }, [gruppe, bereichFilter, nurHeute, suche, heute]);
  const { daten, laedt, fehler, neu } = useDaten<Uebersicht>(`/chef/radar?${qs}`, [qs, runde]);
  const laeuft = lauf?.status === "laeuft";
  const firmen = daten?.firmen ?? [];
  const z = daten?.zahlen;
  const stand = daten?.nachStand ?? {};
  const gezaehlt = (stati: RadarStatus[]) => stati.reduce((n, s) => n + (stand[s] ?? 0), 0);
  const max = daten?.stapelMax ?? RADAR_STAPEL_MAX;
  const ohneMail = firmen.filter((f) => auswahl.includes(f.id) && !f.email).length;
  const alleGewaehlt = firmen.length > 0 && firmen.every((f) => auswahl.includes(f.id));

  const stapel = async (art: "vorbereiten" | "entwurf" | "senden", bestaetigt = false) => {
    setMeldung(null);
    try {
      const j = await rufen<{ laufId: number }>("/chef/radar/stapel", "POST", { ids: auswahl.slice(0, max), art, postfach, bestaetigt });
      setLauf({ id: j.laufId, art: "stapel", bereich: art, land: null, status: "laeuft", vorgeschlagen: 0, neu: 0, gesamt: Math.min(auswahl.length, max), fertig: 0, aktuell: null, ergebnisse: [], verworfen: [], fehler: null, created_at: new Date().toISOString(), fertig_am: null });
      setSendenFrage(false); setVerantwortet(false); setAuswahl([]);
    } catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
  };

  return (
    <section className="cr-firmen">
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      <div className="cr-reiter">
        <div className="cr-reiter-liste" role="tablist" aria-label="Stand">
          <button type="button" role="tab" aria-selected={gruppe === ""} className={gruppe === "" ? "an" : undefined} onClick={() => setGruppe("")}>Alle <i>{z?.gesamt ?? 0}</i></button>
          {RADAR_GRUPPEN.map((g) => (
            <button key={g.key} type="button" role="tab" aria-selected={gruppe === g.key} className={gruppe === g.key ? "an" : undefined} onClick={() => setGruppe(g.key)}>
              {g.label} <i>{g.ohneMail ? (stand["ohne_mail"] ?? 0) : gezaehlt(g.stati)}</i>
            </button>
          ))}
        </div>
        <div className="cr-reiter-filter">
          <label className="cr-schalter"><input type="checkbox" checked={nurHeute} onChange={(e) => setNurHeute(e.target.checked)} /> nur heute</label>
          <select className="cr-feld" value={bereichFilter} onChange={(e) => setBereichFilter(e.target.value)} aria-label="Bereich">
            <option value="">Alle Bereiche</option>
            {RADAR_BEREICHE.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
          <input className="cr-feld" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, Domäne, Ort" aria-label="Suchen" />
        </div>
      </div>

      {fehler && <Fehlermeldung text={fehler} erneut={neu} />}
      {laedt && !daten && <Geruest zeilen={8} />}
      {daten && !firmen.length && (
        <div className="cr-leer">
          <b>Hier ist gerade nichts.</b>
          <span>Der Tageslauf sucht stündlich zwischen 6 und 20 Uhr, bis {daten.tagesziel} Firmen im Radar stehen. <button type="button" className="cr-textknopf" onClick={onSuchen}>Jetzt suchen</button></span>
        </div>
      )}
      {!!firmen.length && (
        <div className="cr-tabelle-rahmen">
          <table className="cr-tabelle">
            <thead>
              <tr>
                <th className="cr-haken-spalte">
                  <input type="checkbox" checked={alleGewaehlt} aria-label="Alle auswählen" onChange={(e) => setAuswahl(e.target.checked ? firmen.slice(0, max).map((f) => f.id) : [])} />
                </th>
                <th>Passung</th><th>Firma</th><th>Signal</th><th>Ort</th><th>Kontakt</th><th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {firmen.map((f) => (
                <tr key={f.id} className={`${auswahl.includes(f.id) ? "gewaehlt " : ""}${offen === f.id ? "offen" : ""}`} onClick={() => onFirma(f.id)}>
                  <td className="cr-haken-spalte" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={auswahl.includes(f.id)} aria-label={`${f.name} auswählen`} onChange={(e) => setAuswahl((a) => (e.target.checked ? [...a, f.id] : a.filter((x) => x !== f.id)))} />
                  </td>
                  <td><Passung wert={f.passung} /></td>
                  <td className="cr-firma"><b>{f.name}</b><span>{f.kurz || f.domain}</span></td>
                  <td className="cr-leise-spalte"><SignalPunkte staerke={f.signal_staerke ?? null} titel={f.signal?.art ?? radarBereich(f.bereich)?.label ?? ""} /></td>
                  <td className="cr-leise-spalte">{[f.ort, f.land].filter(Boolean).join(", ")}</td>
                  <td className="cr-kontakt-spalte">
                    {f.email ? <><span className="cr-mail" title={f.email}>{f.email}</span>{f.ansprechpartner && <span className="cr-ap" title={f.ansprechpartner}>{f.ansprechpartner}</span>}</> : <span className="cr-ohne">E-Mail fehlt</span>}
                  </td>
                  <td><Stand s={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {auswahl.length > 0 && (
        <div className="cr-stapel" role="region" aria-label="Ausgewählte Firmen">
          <div className="cr-stapel-text">
            <b>{Math.min(auswahl.length, max)} ausgewählt</b>
            {auswahl.length > max && <span className="cr-klein">höchstens {max} auf einmal</span>}
            {ohneMail > 0 && <span className="cr-klein">{ohneMail} ohne E-Mail — der Radar sucht sie nach</span>}
          </div>
          <div className="cr-stapel-tun">
            <button type="button" className="cr-knopf hell" disabled={laeuft} onClick={() => stapel("vorbereiten")}>Mails vorbereiten</button>
            <button type="button" className="cr-knopf hell" disabled={laeuft || !postfach} onClick={() => stapel("entwurf")}>Als Entwürfe ins Postfach</button>
            <button type="button" className="cr-knopf" disabled={laeuft || !postfach} onClick={() => { setVerantwortet(false); setSendenFrage(true); }}>Senden …</button>
            <button type="button" className="cr-textknopf" onClick={() => setAuswahl([])}>Auswahl aufheben</button>
          </div>
        </div>
      )}
      {sendenFrage && (
        <Fenster titel={`${Math.min(auswahl.length, max)} Mails senden?`} onZu={() => setSendenFrage(false)}>
          <p>Aus <b>{postfach}</b>. Zwischen zwei Mails liegen 20 bis 45 Sekunden. Jede Mail ist einzeln geschrieben; Firmen ohne Adresse und Mails mit Regelverstoß werden übersprungen.</p>
          <p className="cr-recht">Werbe-Mails an Firmen brauchen in Deutschland, Österreich und der Schweiz eine vorherige Einwilligung — auch einzeln und persönlich (DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG). Ohne Einwilligung drohen Abmahnungen.</p>
          <label className="cr-haken-zeile"><input type="checkbox" checked={verantwortet} onChange={(e) => setVerantwortet(e.target.checked)} /> Ich habe die Mails gelesen und verantworte den Versand.</label>
          <div className="cr-fenster-tun">
            <button type="button" className="cr-knopf" disabled={!verantwortet} onClick={() => void stapel("senden", true)}>Jetzt senden</button>
            <button type="button" className="cr-knopf hell" onClick={() => setSendenFrage(false)}>Abbrechen</button>
          </div>
        </Fenster>
      )}
    </section>
  );
}

function SignalPunkte({ staerke, titel }: { staerke: number | null; titel: string }) {
  const n = Math.max(0, Math.min(5, staerke ?? 0));
  return (
    <span className="cr-signal" title={staerke ? `Kapitalsignal ${n}/5${titel ? ` · ${titel}` : ""}` : "noch kein belegtes Kapitalsignal"}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "an" : undefined} />)}
    </span>
  );
}

// ── Der Laufbalken oben ───────────────────────────────────────────────────────
function LaufBanner({ lauf, onZu, onAbbrechen }: { lauf: Lauf; onZu: () => void; onAbbrechen: () => void }) {
  const laeuft = lauf.status === "laeuft";
  const titel = lauf.art === "stapel" ? STAPEL_TITEL[lauf.bereich ?? ""] ?? "Stapel" : `Suche · ${radarBereich(lauf.bereich)?.label ?? ""}`;
  const anteil = lauf.gesamt ? Math.round((lauf.fertig / lauf.gesamt) * 100) : null;
  const gut = lauf.ergebnisse?.filter((e) => e.ok).length ?? 0;
  return (
    <div className={`cr-lauf ${lauf.status}`} aria-live="polite">
      <div className="cr-lauf-kopf">
        <b>{titel}</b>
        {laeuft && <span>{lauf.art === "stapel" ? `${lauf.fertig} von ${lauf.gesamt}${lauf.aktuell ? ` · ${lauf.aktuell}` : ""}` : "läuft — das dauert ein bis zwei Minuten"}</span>}
        {lauf.status === "fertig" && <span>{lauf.art === "stapel" ? `fertig — ${gut} von ${lauf.gesamt} erledigt` : `fertig — ${lauf.neu} neue Firmen aus ${lauf.vorgeschlagen} Vorschlägen`}</span>}
        {lauf.status === "abgebrochen" && <span>abgebrochen</span>}
        {lauf.status === "fehler" && <span>abgebrochen: {lauf.fehler}</span>}
        <div className="cr-lauf-tun">
          {laeuft ? <button type="button" className="cr-textknopf" onClick={onAbbrechen}>Abbrechen</button>
                  : <button type="button" className="cr-textknopf" onClick={onZu}>Schließen</button>}
        </div>
      </div>
      {laeuft && <span className={`cr-lauf-balken${anteil == null ? " unbekannt" : ""}`} style={anteil != null ? { width: `${Math.max(3, anteil)}%` } : undefined} aria-hidden="true" />}
      {!laeuft && !!lauf.ergebnisse?.length && (
        <details><summary>Ergebnis je Firma</summary>
          <ul>{lauf.ergebnisse.map((e, i) => <li key={i} className={e.ok ? undefined : "schlecht"}><b>{e.name}</b> — {e.text}</li>)}</ul>
        </details>
      )}
      {!laeuft && !!lauf.verworfen?.length && (
        <details><summary>{lauf.verworfen.length} Vorschläge verworfen</summary>
          <ul>{lauf.verworfen.map((v, i) => <li key={i}><b>{v.name}</b> ({v.website}) — {v.grund}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

// ── Ein Fenster ───────────────────────────────────────────────────────────────
function Fenster({ titel, onZu, children }: { titel: string; onZu: () => void; children: ReactNode }) {
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [onZu]);
  return (
    <div className="cr-schatten" onClick={onZu}>
      <div className="cr-fenster" role="dialog" aria-modal="true" aria-label={titel} onClick={(e) => e.stopPropagation()}>
        <header><h2>{titel}</h2><button type="button" className="cr-zu" onClick={onZu} aria-label="Schließen">×</button></header>
        <div className="cr-fenster-rumpf">{children}</div>
      </div>
    </div>
  );
}

function SuchFenster({ onZu, onLauf }: { onZu: () => void; onLauf: (l: Lauf) => void }) {
  const [bereich, setBereich] = useState(RADAR_BEREICHE[0].key);
  const [signal, setSignal] = useState(RADAR_SIGNALE[0].key);
  const [land, setLand] = useState("");
  const [stichwort, setStichwort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const starten = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const j = await rufen<{ laufId: number }>("/chef/radar/suchen", "POST", { bereich, signal, land: land || null, stichwort: stichwort.trim() || null, anzahl: 10 });
      onLauf({ id: j.laufId, art: "suche", bereich, land: land || null, status: "laeuft", vorgeschlagen: 0, neu: 0, gesamt: 0, fertig: 0, aktuell: null, ergebnisse: [], verworfen: [], fehler: null, created_at: new Date().toISOString(), fertig_am: null });
    } catch (e: any) { setFehler(e.message); setLaeuft(false); }
  };
  return (
    <Fenster titel="Firmen suchen" onZu={onZu}>
      <p className="cr-klein">Die KI jagt ein Kapitalsignal, der Server prüft jede Firma: erreichbare Website, Firmenname auf der Seite, eine Adresse, die einen Entscheider erreicht, und das Signal wörtlich auf seiner Quelle. Ab Stärke {RADAR_SIGNAL_AB} schreibt Mara selbst.</p>
      <div className="cr-bereiche" role="radiogroup" aria-label="Kapitalsignal">
        {RADAR_SIGNALE.map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={signal === x.key} className={signal === x.key ? "an" : undefined} onClick={() => setSignal(x.key)}>
            <b>{x.label} <SignalPunkte staerke={x.staerke} titel="" /></b><span>{x.suche}</span>
          </button>
        ))}
      </div>
      <span className="cr-auge">Branche</span>
      <div className="cr-bereiche" role="radiogroup" aria-label="Bereich">
        {RADAR_BEREICHE.map((b) => (
          <button key={b.key} type="button" role="radio" aria-checked={bereich === b.key} className={bereich === b.key ? "an" : undefined} onClick={() => setBereich(b.key)}>
            <b>{b.label}</b><span>{b.satz}</span>
          </button>
        ))}
      </div>
      <div className="cr-fenster-zeile">
        <div className="cr-segment" role="radiogroup" aria-label="Land">
          {[["", "Alle"], ["DE", "DE"], ["AT", "AT"], ["CH", "CH"]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={land === k} className={land === k ? "an" : undefined} onClick={() => setLand(k)}>{l}</button>
          ))}
        </div>
        <input className="cr-feld" value={stichwort} onChange={(e) => setStichwort(e.target.value)} placeholder="Stichwort (optional): Messe in Las Vegas, Kosmetik, München …" maxLength={120} />
      </div>
      {fehler && <p className="cr-hinweis fehler">{fehler}</p>}
      <details className="cr-zielbild">
        <summary>Wonach der Radar sucht</summary>
        <ul>{RADAR_ZIELBILD.muss.map((x) => <li key={x}>✓ {x}</li>)}{RADAR_ZIELBILD.nie.map((x) => <li key={x} className="nie">✕ {x}</li>)}</ul>
      </details>
      <div className="cr-fenster-tun">
        <button type="button" className="cr-knopf" onClick={starten} disabled={laeuft}>{laeuft ? "Startet …" : "10 Firmen suchen"}</button>
        <button type="button" className="cr-knopf hell" onClick={onZu}>Abbrechen</button>
      </div>
    </Fenster>
  );
}

function WebsiteFenster({ onZu, onFertig }: { onZu: () => void; onFertig: (id: number) => void }) {
  const [adresse, setAdresse] = useState("");
  const [bereich, setBereich] = useState(RADAR_BEREICHE[0].key);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const aufnehmen = async () => {
    setLaeuft(true); setFehler(null);
    try { const j = await rufen<{ id: number }>("/chef/radar/manuell", "POST", { website: adresse, bereich }); onFertig(j.id); }
    catch (e: any) { setFehler(e.message); setLaeuft(false); }
  };
  return (
    <Fenster titel="Firma per Website aufnehmen" onZu={onZu}>
      <p className="cr-klein">Adresse der Firma eintragen — der Radar liest Impressum und Kontaktseite und legt sie an.</p>
      <div className="cr-fenster-zeile">
        <input className="cr-feld" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="firma.de" maxLength={200} onKeyDown={(e) => { if (e.key === "Enter" && adresse.trim()) void aufnehmen(); }} />
        <select className="cr-feld" value={bereich} onChange={(e) => setBereich(e.target.value)} aria-label="Bereich">
          {RADAR_BEREICHE.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
      </div>
      {fehler && <p className="cr-hinweis fehler">{fehler}</p>}
      <div className="cr-fenster-tun">
        <button type="button" className="cr-knopf" onClick={aufnehmen} disabled={!adresse.trim() || laeuft}>{laeuft ? "Prüft …" : "Aufnehmen"}</button>
        <button type="button" className="cr-knopf hell" onClick={onZu}>Abbrechen</button>
      </div>
    </Fenster>
  );
}

// ── Die Akte als Seitenblatt ──────────────────────────────────────────────────
function Akte({ id, uebersicht, postfach, onPostfach, onZu, onGeaendert }: {
  id: number; uebersicht: Uebersicht | null; postfach: string; onPostfach: (p: string) => void; onZu: () => void; onGeaendert: () => void;
}) {
  const [f, setF] = useState<Voll | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [reiter, setReiter] = useState<"ueberblick" | "scan" | "mail" | "verlauf">("ueberblick");
  const [verlauf, setVerlauf] = useState<Post[] | null>(null);
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [hinweis, setHinweis] = useState("");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [betreff, setBetreff] = useState("");
  const [koerper, setKoerper] = useState("");
  const [ps, setPs] = useState("");
  const [an, setAn] = useState("");
  const [sendenFrage, setSendenFrage] = useState(false);
  const zuerst = useRef(true);

  const laden = async () => {
    try {
      const j = await rufen<{ firma: Voll }>(`/chef/radar/firma/${id}`, "GET");
      setF(j.firma); setFehler(null); setAn(j.firma.email ?? "");
      if (j.firma.mail) { setBetreff(j.firma.mail.betreff); setKoerper([...j.firma.mail.absaetze, j.firma.mail.frage].join("\n\n")); setPs(j.firma.mail.ps ?? ""); }
      if (zuerst.current) {
        zuerst.current = false;
        if (j.firma.versendet_am) setReiter("verlauf"); else if (j.firma.mail) setReiter("mail"); else if (j.firma.scan) setReiter("scan");
      }
      if (j.firma.versendet_am) rufen<{ post: Post[] }>(`/chef/radar/post?firma=${id}`, "GET").then((v) => setVerlauf(v.post)).catch(() => setVerlauf([]));
    } catch (e: any) { setFehler(e.message); }
  };
  useEffect(() => { void laden(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [onZu]);

  const tun = async (name: string, fn: () => Promise<unknown>, gut: string, danach?: () => void) => {
    setArbeit(name); setMeldung(null);
    try { await fn(); await laden(); onGeaendert(); setMeldung({ art: "gut", text: gut }); danach?.(); }
    catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };

  const imp = f?.impressum ?? {};
  const scan = f?.scan;
  const mail = f?.mail;
  const zu = f?.status === "gesperrt" || f?.status === "kein_interesse";
  const raus = f?.status === "versendet" || !!f?.versendet_am;
  // E-337: Der Weg geht bis zum Kauf.
  const schritt = f?.kauf_am ? 8 : f?.status === "angebot" ? 7 : f?.termin_am ? 6 : f?.lead_am ? 5 : raus ? 4 : mail ? 3 : scan ? 2 : 1;
  // Nach einem Rückläufer oder einer neuen Adresse vom falschen Empfänger darf die erste Mail EINMAL an die neue Adresse.
  const neuerVersuch = !!f && (f.status === "unzustellbar" || (f.status === "antwort" && f.antwort_art === "falscher_empfaenger")) && !!f.email;

  return (
    <div className="cr-schatten" onClick={onZu}>
      <aside className="cr-blatt" role="dialog" aria-modal="true" aria-label={f?.name ?? "Firma"} onClick={(e) => e.stopPropagation()}>
        {fehler && <Fehlermeldung text={fehler} erneut={laden} />}
        {!f && !fehler && <Geruest zeilen={10} />}
        {f && (
          <>
            <header className="cr-blatt-kopf">
              <div>
                <span className="cr-auge">{radarBereich(f.bereich)?.label ?? f.bereich} · {LAND[f.land ?? ""] ?? f.land ?? "?"}{f.ort ? ` · ${f.ort}` : ""} · gefunden {datum(f.created_at)}</span>
                <h2>{f.name}</h2>
                <a href={f.website} target="_blank" rel="noopener noreferrer" className="cr-link">{f.domain} ↗</a>
              </div>
              <div className="cr-blatt-kopf-rechts">
                <Passung wert={f.passung} /><Stand s={f.status} />
                <button type="button" className="cr-zu" onClick={onZu} aria-label="Schließen">×</button>
              </div>
            </header>

            <ol className="cr-schritte" aria-label="Fortschritt">
              {["Gefunden", "Gescannt", "Mail bereit", "Versendet", "Lead", "Termin", "Angebot", "Kauf"].map((t, i) => (
                <li key={t} className={schritt > i + 1 ? "da" : schritt === i + 1 ? "jetzt" : undefined}>{t}</li>
              ))}
            </ol>

            <nav className="cr-blatt-reiter" role="tablist">
              {([["ueberblick", "Überblick"], ["scan", "Website-Scan"], ["mail", "Mail"], ...(raus ? [["verlauf", `Verlauf${verlauf?.length ? ` · ${verlauf.length}` : ""}`]] : [])] as [typeof reiter, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={reiter === k} className={reiter === k ? "an" : undefined} onClick={() => setReiter(k)}>{l}</button>
              ))}
            </nav>

            {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
            {(arbeit === "scan" || arbeit === "mail") && <p className="cr-hinweis">Das dauert 30 bis 90 Sekunden — die KI liest bis zu acht Seiten und sucht nach Meldungen.</p>}

            <div className="cr-blatt-rumpf">
              {reiter === "ueberblick" && (
                <>
                  <div className="cr-kontakt">
                    <div><span>Ansprechpartner</span><b>{f.ansprechpartner || "— (nicht im Impressum)"}</b></div>
                    <div><span>E-Mail</span><b>{f.email || "— fehlt"}</b></div>
                    <div><span>Telefon</span><b>{imp.telefon || "—"}</b></div>
                    <div><span>Register</span><b>{[imp.registergericht, imp.registernummer].filter(Boolean).join(" ") || "—"}</b></div>
                  </div>
                  {!f.email && (
                    <div className="cr-ohne-mail">
                      <b>Für diese Firma fehlt die E-Mail-Adresse.</b>
                      <p className="cr-klein">Der Radar nimmt nur Adressen, die wirklich auf der Website stehen — auch hinter mailto-Verweisen, Cloudflare-Schutz oder Schreibweisen wie „info [at] firma [dot] de“. Manche Firmen zeigen nur ein Formular.</p>
                      <div className="cr-fenster-zeile">
                        <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => tun("nachsuchen", () => rufen(`/chef/radar/firma/${id}/nachsuchen`), "Nachgesucht.")}>
                          {arbeit === "nachsuchen" ? "Sucht …" : "Noch einmal nachsuchen"}
                        </button>
                        <input className="cr-feld" value={an} onChange={(e) => setAn(e.target.value)} placeholder="Adresse von Hand eintragen" />
                        <button type="button" className="cr-knopf hell" disabled={!!arbeit || !an.trim()} onClick={() => tun("kontakt", () => rufen(`/chef/radar/firma/${id}/kontakt`, "POST", { email: an }), "Adresse gespeichert.")}>Übernehmen</button>
                      </div>
                    </div>
                  )}
                  {f.adresse_vorschlag && (
                    <div className="cr-ohne-mail">
                      <b>Neue Adresse aus der Antwort: {f.adresse_vorschlag}</b>
                      <div className="cr-fenster-zeile">
                        <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => tun("adresse", () => rufen(`/chef/radar/firma/${id}/adresse-uebernehmen`), "Übernommen — die erste Mail kann jetzt einmal an die neue Adresse.", () => setReiter("mail"))}>Adresse übernehmen</button>
                      </div>
                    </div>
                  )}
                  {f.signal?.art && (
                    <div className="cr-block">
                      <h3>Kapitalsignal <small>Stärke {f.signal_staerke ?? "?"} von 5</small></h3>
                      <p className="cr-profil">{f.signal.art}{f.signal.beleg ? <> — <q>{f.signal.beleg}</q></> : null}</p>
                      {f.signal.url && <a href={f.signal.url} target="_blank" rel="noopener noreferrer" className="cr-link">Beleg ↗</a>}
                    </div>
                  )}
                  {imp.quelle === "website" && <p className="cr-klein">Kein lesbares Impressum — die Adresse steht wörtlich auf {imp.seite}.</p>}
                  {imp.quelle !== "website" && imp.seite && <p className="cr-klein">Aus dem Impressum ({imp.seite}) — jeder Wert steht dort wörtlich.{imp.emailSeite ? ` Die Adresse stand auf ${imp.emailSeite}.` : ""}</p>}
                  {!!f.gruende?.length && (
                    <div className="cr-block">
                      <h3>Warum sie passt <small>(Einschätzung der KI mit Quelle)</small></h3>
                      <ul className="cr-gruende">{f.gruende.map((g, i) => <li key={i}>{g.text}{g.url && <> — <a href={g.url} target="_blank" rel="noopener noreferrer" className="cr-link">Quelle ↗</a></>}</li>)}</ul>
                      {!!f.signale?.length && <div className="cr-signale">{f.signale.map((s) => <span key={s} className="cr-chip">{s}</span>)}</div>}
                    </div>
                  )}
                </>
              )}

              {reiter === "scan" && (
                <>
                  <div className="cr-fenster-zeile">
                    <button type="button" className={`cr-knopf${scan ? " hell" : ""}`} disabled={!!arbeit || zu} onClick={() => tun("scan", () => rufen(`/chef/radar/firma/${id}/scannen`), "Gescannt.")}>
                      {arbeit === "scan" ? "KI liest die Website …" : scan ? "Erneut scannen" : "Firma scannen"}
                    </button>
                  </div>
                  {!scan && <p className="cr-klein">Noch nicht gescannt. Die KI liest bis zu acht Seiten und sucht nach Meldungen; jeder Aufhänger braucht ein wörtliches Zitat.</p>}
                  {scan && (
                    <div className="cr-block">
                      <h3>Profil <small>{seit(scan.am)} · {scan.seiten.length} Seiten{scan.verworfen ? ` · ${scan.verworfen} unbelegte Aufhänger verworfen` : ""}</small></h3>
                      <p className="cr-profil">{scan.profil?.zusammenfassung}</p>
                      <dl className="cr-profil-raster">
                        <div><dt>Kunden</dt><dd>{scan.profil?.zielkunden || "—"}</dd></div>
                        <div><dt>Größe</dt><dd>{scan.profil?.groesse || "—"}</dd></div>
                        <div><dt>US-Bezug</dt><dd>{scan.profil?.us_bezug || "—"}</dd></div>
                        <div><dt>Kapitalbedarf</dt><dd>{scan.profil?.kapital_bedarf || "—"}</dd></div>
                        <div><dt>Passendes Paket</dt><dd>{paketName(scan.profil?.passendes_paket) ?? "—"}{scan.profil?.paket_grund ? ` — ${scan.profil.paket_grund}` : ""}</dd></div>
                        {!!scan.profil?.risiken?.length && <div><dt>Könnte nicht passen</dt><dd>{scan.profil.risiken.join(" · ")}</dd></div>}
                      </dl>
                      <h4>Belegte Aufhänger</h4>
                      {!scan.aufhaenger.length && <p className="cr-hinweis warn">Kein Aufhänger ließ sich belegen — ohne ihn schreibt der Radar keine Mail.</p>}
                      <ol className="cr-aufhaenger">
                        {scan.aufhaenger.map((a, i) => (
                          <li key={i}><b>{a.text}</b><q>{a.beleg}</q><a href={a.url} target="_blank" rel="noopener noreferrer" className="cr-link">{a.quelle === "web" ? "Meldung" : "Website"} ↗</a></li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}

              {reiter === "mail" && (
                <>
                  <div className="cr-fenster-zeile">
                    <button type="button" className={`cr-knopf${mail ? " hell" : ""}`} disabled={!!arbeit || zu} onClick={() => tun("mail", () => rufen(`/chef/radar/firma/${id}/mail`, "POST", { hinweis: hinweis.trim() || null }), "Die Mail steht.")}>
                      {arbeit === "mail" ? "KI schreibt …" : mail ? "Neu schreiben" : "Mail schreiben"}
                    </button>
                    <input className="cr-feld" value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="Wunsch an die KI (optional): Fokus auf Kapital für Europa …" maxLength={400} />
                  </div>
                  {!mail && <p className="cr-klein">Noch keine Mail. Sie entsteht aus den belegten Aufhängern des Scans — wenn nötig, scannt der Radar vorher selbst.</p>}
                  {mail && (
                    <>
                      {!!mail.sperrend?.length && <p className="cr-hinweis fehler">Sperrt Entwurf und Versand: {mail.sperrend.join(" · ")}</p>}
                      {!!mail.warnungen?.length && <p className="cr-hinweis warn">Hinweis: {mail.warnungen.join(" · ")}</p>}
                      <div className="cr-betreff"><span>Betreff</span><b>{mail.betreff}</b></div>
                      {!bearbeiten ? (
                        <>
                          <iframe className="cr-vorschau" title="Vorschau der Mail" sandbox="" srcDoc={mail.html} />
                          <div className="cr-fenster-zeile">
                            <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(true)} disabled={raus}>Text ändern</button>
                            <button type="button" className="cr-knopf hell" onClick={() => { void navigator.clipboard?.writeText(mail.text); setMeldung({ art: "gut", text: "Text kopiert." }); }}>Text kopieren</button>
                          </div>
                        </>
                      ) : (
                        <div className="cr-bearbeiten">
                          <label><span>Betreff</span><input className="cr-feld" value={betreff} onChange={(e) => setBetreff(e.target.value)} maxLength={120} /></label>
                          <label><span>Text — Absätze durch eine Leerzeile trennen; der letzte Absatz ist die Schlussfrage. Anrede und Gruß setzt der Radar.</span>
                            <textarea className="cr-feld" value={koerper} onChange={(e) => setKoerper(e.target.value)} rows={14} />
                          </label>
                          <label><span>PS (optional)</span><input className="cr-feld" value={ps} onChange={(e) => setPs(e.target.value)} maxLength={400} /></label>
                          <div className="cr-fenster-zeile">
                            <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => tun("speichern", () => rufen(`/chef/radar/firma/${id}/mail`, "PUT", { betreff, koerper, ps }), "Gespeichert.", () => setBearbeiten(false))}>Speichern</button>
                            <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(false)}>Abbrechen</button>
                          </div>
                        </div>
                      )}

                      {(!raus || neuerVersuch) && !zu && (
                        <div className="cr-ausgabe">
                          {neuerVersuch && <p className="cr-hinweis warn">Die erste Mail kam nicht an — sie darf einmal an die neue Adresse {f.email}.</p>}
                          <label><span>Absender</span>
                            <select className="cr-feld" value={postfach} onChange={(e) => onPostfach(e.target.value)}>
                              {(uebersicht?.postfaecher ?? []).map((p) => <option key={p} value={p}>{uebersicht?.absender.name} · {p}</option>)}
                            </select>
                          </label>
                          <label><span>An</span><input className="cr-feld" value={an} onChange={(e) => setAn(e.target.value)} placeholder="E-Mail der Firma" /></label>
                          <div className="cr-fenster-zeile">
                            <button type="button" className="cr-knopf" disabled={!!arbeit || !!mail.sperrend?.length || !postfach || !an.trim()}
                                    onClick={() => tun("entwurf", () => rufen(`/chef/radar/firma/${id}/ausgeben`, "POST", { art: "entwurf", postfach, an }), `Liegt als Entwurf in ${postfach}.`)}>
                              {arbeit === "entwurf" ? "Legt an …" : f.status === "im_postfach" ? "Entwurf erneut ablegen" : "Als Entwurf ins Postfach"}
                            </button>
                            <button type="button" className="cr-knopf warm" disabled={!!arbeit || !!mail.sperrend?.length || !postfach || !an.trim()} onClick={() => setSendenFrage(true)}>Direkt senden …</button>
                          </div>
                          {sendenFrage && (
                            <div className="cr-senden-frage">
                              <b>Mail an {an} aus {postfach} senden?</b>
                              <p className="cr-recht">Werbe-Mails an Firmen brauchen in DE, AT und CH eine vorherige Einwilligung — auch einzeln und persönlich (DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG).</p>
                              <div className="cr-fenster-zeile">
                                <button type="button" className="cr-knopf warm" disabled={!!arbeit}
                                        onClick={() => tun("senden", () => rufen(`/chef/radar/firma/${id}/ausgeben`, "POST", { art: "senden", postfach, an, bestaetigt: true }), `Gesendet an ${an}.`, () => setSendenFrage(false))}>
                                  {arbeit === "senden" ? "Sendet …" : "Jetzt senden"}
                                </button>
                                <button type="button" className="cr-knopf hell" onClick={() => setSendenFrage(false)}>Abbrechen</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {raus && !neuerVersuch && <p className="cr-hinweis gut">Versendet {f.versendet_am ? datum(f.versendet_am) : ""}{f.postfach ? ` aus ${f.postfach}` : ""} — je Firma geht genau eine erste Mail.{f.nachfass_faellig ? ` Nachfassen ${f.nachfass_stufe ? `(Stufe ${(f.nachfass_stufe ?? 0) + 1}) ` : ""}ab ${datum(f.nachfass_faellig)}.` : ""}</p>}
                    </>
                  )}
                </>
              )}
              {reiter === "verlauf" && (
                <>
                  {!verlauf && <Geruest zeilen={4} />}
                  {verlauf && !verlauf.length && <p className="cr-klein">Noch nichts im Faden — Mara liest das Postfach alle 10 Minuten.</p>}
                  <ol className="cr-faden">
                    {(verlauf ?? []).slice().sort((x, y) => String(x.datum).localeCompare(String(y.datum))).map((v) => (
                      <li key={v.id} className={v.richtung === "aus" ? "aus" : "ein"}>
                        <div className="cr-faden-kopf">
                          <b>{v.richtung === "aus" ? (v.art === "mara" ? "Mara" : v.art === "von_hand" ? "Von Hand" : v.art?.startsWith("nachfass") ? `Nachfass ${v.art.slice(8)}` : "Erste Mail") : (RADAR_ANTWORT_ARTEN[v.art as RadarAntwortArt]?.label ?? v.art)}</b>
                          <span className="cr-klein">{v.datum ? new Date(v.datum).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                        {v.zusammenfassung && <p className="cr-faden-satz">{v.zusammenfassung}</p>}
                        {v.text && <details><summary>Text</summary><pre>{v.text}</pre></details>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            <footer className="cr-blatt-fuss">
              {f.status === "im_postfach" && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "versendet" }), "Als versendet vermerkt.")}>Im Postfach gesendet</button>}
              {raus && !f.lead_am && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "lead" }), "Als Lead vermerkt.")}>Lead (Interesse)</button>}
              {raus && !f.termin_am && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "termin" }), "Termin vermerkt.")}>Termin vereinbart</button>}
              {raus && !f.kauf_am && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "kauf" }), "Kauf vermerkt.")}>Gekauft</button>}
              {!zu && f.status !== "passt_nicht" && !raus && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "passt_nicht" }), "Aussortiert — passt nicht.")}>Passt nicht</button>}
              {!zu && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "kein_interesse" }), "Vermerkt — kommt auf die Sperrliste.")}>Kein Interesse</button>}
              {!zu && <button type="button" className="cr-textknopf rot" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "gesperrt" }), "Gesperrt.")}>Sperren</button>}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
