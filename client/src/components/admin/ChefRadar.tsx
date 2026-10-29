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
import { createPortal } from "react-dom";
import { API, datum, seit, eur, zahl, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  RADAR_BEREICHE, RADAR_GRUPPEN, RADAR_STATUS, RADAR_STAPEL_MAX, RADAR_ZIELBILD, RADAR_TRICHTER, RADAR_ANTWORT_ARTEN, RADAR_KERNSATZ,
  RADAR_NACHFASS_TAGE, RADAR_HOECHSTENS_JE_TAG, RADAR_SIGNALE, RADAR_SIGNAL_AB, RADAR_BRIEF_ANBIETER, radarBereich,
  type RadarStatus, type RadarAntwortArt, type RadarBriefAnbieter,
} from "@shared/fiaon-radar";
import { RADAR_SZENARIEN, type RadarSzenario } from "@shared/fiaon-radar-szenarien";
import { GLOBAL_PAKETE } from "@shared/fiaon-global";
import "@/styles/office-rundgang.css";
import "@/styles/chef-radar.css";

type Grund = { text: string; url: string };
type Zeile = {
  id: number; tag: string; quelle: string; bereich: string; land: string | null; name: string; domain: string; website: string;
  ort: string | null; kurz: string | null; passung: number | null; gruende: Grund[]; signale: string[]; email: string | null;
  ansprechpartner: string | null; status: RadarStatus; gescannt_am: string | null; mail_am: string | null; versendet_am: string | null;
  postfach: string | null; hat_scan: boolean; hat_mail: boolean; created_at: string;
  signal?: { art?: string; label?: string; beleg?: string; url?: string } | null; signal_staerke?: number | null; antwort_am?: string | null; antwort_art?: string | null;
  lead_am?: string | null; termin_am?: string | null; kauf_am?: string | null; nachfass_stufe?: number | null; nachfass_faellig?: string | null; adresse_vorschlag?: string | null;
  entscheider?: { name: string; rolle: string | null; email: string; anrede: string | null; quelle: string; weg: string } | null; entscheider_am?: string | null;
  brief_status?: string | null; brief_versendet_am?: string | null; brief_besuche?: number | null;
  archiviert_am?: string | null; archiv_grund?: string | null;
};
type TrichterTag = {
  tag: string; gefunden: number; angeschrieben: number; nachfass: number; unzustellbar: number; antworten: number;
  leads: number; termine: number; angebote: number; kaeufe: number; umsatzCents: number; absagen: number;
  briefe: number; besuche: number; briefKostenCents: number;
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
  // E-361: was die Einordnung aus der Antwort las — und der Termin, den Mara daraus eingetragen hat.
  sprache?: string | null; wunsch_termin?: string | null; buchungslink?: string | null; telefon?: string | null; spaeter_datum?: string | null;
  termin_id?: number | null; firma_telefon?: string | null;
};
type Aufhaenger = { text: string; beleg: string; url: string; quelle: "website" | "web" };
type Mail = {
  betreff: string; anrede: string; absaetze: string[]; frage: string; ps: string; paket: string | null; html: string; text: string;
  links: { gespraech: string; seite: string }; warnungen: string[]; sperrend: string[]; geaendert: boolean; erstellt_am: string;
};
type PruefKi = { ok: boolean; punkte: { regel: string; stelle: string; hinweis: string }[]; gruende?: string[]; ki_klang: number | null; modell: string; am: string; versuch: number };
type Voll = Zeile & {
  impressum: any; notiz: string | null; gmail_entwurf_id: string | null;
  // E-458: das Urteil der Prüf-KI zur gespeicherten Fassung, der Strom und der Stand in der Warteschlange.
  pruef_ki?: PruefKi | null; strom?: string | null; motor_status?: string | null; motor_grund?: string | null;
  scan: { profil: any; aufhaenger: Aufhaenger[]; verworfen: number; seiten: { url: string; titel: string }[]; am: string } | null;
  mail: Mail | null;
  brief?: { betreff: string; erstellt_am: string } | null;
};
type Lauf = {
  id: number; art: string; bereich: string | null; land: string | null; status: "laeuft" | "fertig" | "fehler" | "abgebrochen";
  vorgeschlagen: number; neu: number; gesamt: number; fertig: number; aktuell: string | null;
  ergebnisse: { id: number; name: string; ok: boolean; text: string }[];
  verworfen: { name: string; website: string; grund: string }[]; fehler: string | null; created_at: string; fertig_am: string | null;
};
// E-458 (29.10.2026): der Mail-Motor — zwei Ströme, Warteschlange, ehrliche Leistung.
type MotorStrom = {
  bereit: number; arbeit: number; sendet: number; gesendetHeute: number; verworfenHeute: number; vorrat: number;
  gruende: { grund: string; n: number }[]; stunden: { stunde: number; n: number }[];
};
type MotorStand = {
  einstellung: { tage: number[]; von: string; bis: string; firmenJeStunde: number; partnerJeStunde: number; puffer: number; haltbarTage: number; link: "termin" | "keiner"; kiKlangMax: number; aehnlichMax: number; sucheTagesziel: number; sucheLaeufe: number };
  an: boolean; abPassung: number; imFenster: boolean; bremse: number;
  leistung: { ziel: number; moeglich: number; leistungJeStunde: number; je: { firma: number; partner: number }; tagJe: { firma: number; partner: number }; satz: string; postfaecherNoetig: number };
  postfaecher: { adresse: string; grenze: number; heute: number; reserve?: number; bereit: boolean; pause?: boolean }[];
  stroeme: { firma: MotorStrom; partner: MotorStrom };
};
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
/** „Mo–Fr 07–19“ aus den Motor-Schaltern. */
function fensterText(e: MotorStand["einstellung"] | undefined | null): string {
  if (!e) return "Mo–Fr 07–19";
  const t = [...e.tage].sort((a, b) => a - b);
  const zusammen = t.length > 1 && t.every((x, i) => i === 0 || x === t[i - 1] + 1);
  const tage = zusammen ? `${WOCHENTAGE[t[0] - 1]}–${WOCHENTAGE[t[t.length - 1] - 1]}` : t.map((x) => WOCHENTAGE[x - 1]).join(", ");
  const kurz = (u: string) => (u.endsWith(":00") ? u.slice(0, 2) : u);
  return `${tage} ${kurz(e.von)}–${kurz(e.bis)}`;
}

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
  const motor = useDaten<MotorStand>(`/chef/radar/motor`, [runde]);
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

      <MaraKopf trichter={t.daten} uebersicht={u.daten} motor={motor.daten} onGeaendert={neuLaden} />
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
      {haupt === "firmen" && <FirmenListe runde={runde} postfach={postfach} lauf={lauf} setLauf={setLauf} onFirma={firmaOeffnen} offen={offen} onSuchen={() => setSuchen(true)} onWebsite={() => setWebsite(true)} />}
      {haupt === "automatik" && <AutomatikTafel trichter={t.daten} uebersicht={u.daten} motor={motor.daten} onGeaendert={neuLaden} />}
      {haupt === "automatik" && <MaraTesten />}
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

function MaraKopf({ trichter, uebersicht, motor, onGeaendert }: {
  trichter: Trichter | null; uebersicht: Uebersicht | null; motor: MotorStand | null; onGeaendert: () => void;
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
      setMeldung({ art: "gut", text: ein ? `Mara verkauft. Erste Mails ${fensterText(motor?.einstellung)}, vorbereitet wird rund um die Uhr, Antworten liest sie immer.` : "Mara pausiert den Versand. Antworten liest sie weiter." });
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
        <p>Mara findet Firmen mit Kapitalbedarf und schreibt den Entscheidern bis zum Kauf.</p>
        <div className="cr-held-tun">
          <button type="button" className="cr-glasknopf" disabled={!!arbeit} onClick={() => knopf("post", "/chef/radar/post-lauf", (e) => `Postfach geprüft: ${e.eingang ?? 0} neue Antworten, davon ${e.leads ?? 0} Leads.`)}>
            {arbeit === "post" ? "Prüft …" : "Postfach jetzt prüfen"}
          </button>
          <button type="button" className="cr-glasknopf" disabled={!!arbeit || !an} title={an ? "" : "Erst Mara einschalten"} onClick={() => knopf("versand", "/chef/radar/versand-lauf", (e) => e.grund ? `Keine Runde: ${e.grund}.` : `Runde fertig: ${e.erste ?? 0} erste Mails, ${e.nachfass ?? 0} Nachfass-Mails.`)}>
            {arbeit === "versand" ? "Sendet …" : "Jetzt eine Runde senden"}
          </button>
        </div>
      </div>

      <div className="cr-held-ziele">
        <Ring wert={h?.leads ?? 0} ziel={trichter?.ziel.leads ?? 10} label="Leads heute" unter={`${zahl(h?.antworten ?? 0)} ${(h?.antworten ?? 0) === 1 ? "Antwort" : "Antworten"}`} />
        <Ring wert={h?.kaeufe ?? 0} ziel={trichter?.ziel.kaeufe ?? 5} label="Käufe heute" unter={h?.umsatzCents ? eur(h.umsatzCents) : `${zahl(h?.termine ?? 0)} ${(h?.termine ?? 0) === 1 ? "Termin" : "Termine"}`} />
      </div>

      <div className={`cr-mara${an ? " an" : ""}`}>
        <div className="cr-mara-kopf">
          <span className="cr-mara-bild" aria-hidden="true"><img src="/mail/signatur/mara.png" alt="" width={44} height={44} /><span className="cr-mara-punkt" /></span>
          <div>
            <b>Mara {an ? "verkauft" : "pausiert"}</b>
            <span>{an
              ? `${fensterText(motor?.einstellung)} · Ziel ${zahl(motor?.leistung.ziel ?? 0)}/h · möglich ${zahl(Math.min(motor?.leistung.ziel ?? 0, motor?.leistung.moeglich ?? 0))}/h · heute ${zahl(h?.angeschrieben ?? 0)} erste Mails, ${zahl(h?.nachfass ?? 0)} nachgefasst`
              : "Liest Antworten weiter."}</span>
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
            <p>Je Stunde <b>{motor?.einstellung.firmenJeStunde ?? 10} Firmen und {motor?.einstellung.partnerJeStunde ?? 10} Partner</b> ({fensterText(motor?.einstellung)}), so viele die Postfächer tragen, nur an Entscheider, jede Mail von der Prüf-KI gelesen, zweimal Nachfassen.</p>
            <p className="cr-recht" title="§ 7 UWG, § 174 TKG, Art. 3 UWG CH">Werbe-Mails an Firmen brauchen in DE und CH grundsätzlich eine Einwilligung. Österreich bekommt Briefe statt Mails.</p>
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
      {/* E-339: der Brief-Kanal — Briefe an Geschäftsführer, Firmen mit Besuch über den QR-Code, Porto netto. */}
      <p className="cr-trichter-brief">
        <span>Brief-Kanal</span>
        <b>{werte ? zahl(werte.briefe ?? 0) : "—"}</b> {(werte?.briefe ?? 0) === 1 ? "Brief" : "Briefe"}
        <i aria-hidden="true">·</i><b>{werte ? zahl(werte.besuche ?? 0) : "—"}</b> QR-Besuche
        <i aria-hidden="true">·</i><b>{werte ? eur(werte.briefKostenCents ?? 0) : "—"}</b> Porto
      </p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHE — jede Antwort, Maras Antwort, ein Klick
// ═══════════════════════════════════════════════════════════════════════════
const ART_TON: Record<string, string> = {
  interesse: "top", frage: "top", termin_wunsch: "top", rueckruf: "top", info: "top", termin_gebucht: "top", kein_interesse: "aus", abwesend: "leise", weitergeleitet: "leise",
  falscher_empfaenger: "warn", einwand: "warn", termin_abgesagt: "warn", spaeter: "leise", unzustellbar: "rot", datenschutz: "rot", rechtlich: "rot", automatisch: "leise", sonstiges: "leise",
};
/** Wunschzeit „2026-10-22T10:00“ → „Do., 22.10., 10:00“. */
const wunschLesbar = (iso: string) => `${new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}, ${iso.slice(11, 16)}`;
const LEAD_ARTEN = Object.entries(RADAR_ANTWORT_ARTEN).filter(([, r]) => r.lead).map(([k]) => k);

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
        <span className="cr-klein">Absagen und Rückläufer erledigt Mara selbst.</span>
      </div>
      {fehler && <Fehlermeldung text={fehler} erneut={neu} />}
      {laedt && !daten && <Geruest zeilen={4} />}
      {daten && !post.length && (
        <div className="cr-leer">
          <b>{nur === "offen" ? "Nichts zu erledigen." : "Noch keine Antworten."}</b>
          <span>Antworten erscheinen hier mit Maras Entwurf.</span>
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
  const [terminFrage, setTerminFrage] = useState(false);
  const [telefon, setTelefon] = useState(p.telefon ?? p.firma_telefon ?? "");
  const art = RADAR_ANTWORT_ARTEN[p.art as RadarAntwortArt];
  const fertig = p.mara_status === "gesendet" || p.mara_status === "von_hand" || p.mara_status === "erledigt";
  const darfAntworten = !!art && !["kein_interesse", "unzustellbar", "automatisch", "abwesend", "rechtlich", "termin_gebucht"].includes(p.art);
  const darfEintragen = !!p.wunsch_termin && !p.termin_id && LEAD_ARTEN.includes(p.art) && !["kein_interesse", "gesperrt"].includes(p.firma_status);
  const offenOhneMara = !darfAntworten && !["automatisch", "abwesend", "unzustellbar", "kein_interesse"].includes(p.art) && !["verworfen", "erledigt"].includes(p.mara_status ?? "");
  return (
    <article className={`cr-post ${ART_TON[p.art] ?? "leise"}`}>
      <header className="cr-post-kopf">
        <button type="button" className="cr-post-firma" onClick={() => onFirma(p.firma_id)}>{p.firma}<span>{p.domain}</span></button>
        <span className={`cr-art ${ART_TON[p.art] ?? "leise"}`}>{art?.label ?? p.art}</span>
        <span className="cr-klein">{seit(p.datum)} · {p.von}</span>
      </header>
      {p.zusammenfassung && <p className="cr-post-satz">{p.zusammenfassung}</p>}
      {p.text && <details className="cr-post-mail"><summary>Ganze Mail lesen</summary><pre>{p.text}</pre></details>}
      {p.neue_adresse && <p className="cr-klein">Neue Adresse: <b>{p.neue_adresse}</b> — in der Firma übernehmen.</p>}
      {(p.sprache && p.sprache !== "de") || p.wunsch_termin || p.telefon || p.buchungslink || p.spaeter_datum || p.termin_id ? (
        <div className="cr-post-fakten">
          {p.sprache && p.sprache !== "de" && <span className="cr-chip">Antwortet auf Englisch</span>}
          {p.wunsch_termin && <span className="cr-chip">Wunschzeit {wunschLesbar(p.wunsch_termin)}</span>}
          {p.telefon && <span className="cr-chip">Tel. {p.telefon}</span>}
          {p.buchungslink && <a className="cr-chip" href={p.buchungslink} target="_blank" rel="noreferrer noopener">Ihr Buchungskalender ↗</a>}
          {p.spaeter_datum && <span className="cr-chip">Wiedervorlage {datum(p.spaeter_datum)}</span>}
          {!!p.termin_id && <span className="cr-chip gut">Termin eingetragen</span>}
        </div>
      ) : null}
      {p.art === "rechtlich" && <p className="cr-hinweis fehler">Nicht antworten. Firma und Absender stehen auf der Sperrliste — bitte selbst prüfen.</p>}
      {p.art === "datenschutz" && !fertig && <p className="cr-hinweis warn">Datenschutz: Antwort mit der Datenquelle liegt bereit. Bitte prüfen und senden — Frist ein Monat.</p>}
      {darfEintragen && !terminFrage && (
        <div className="cr-fenster-zeile">
          <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => setTerminFrage(true)}>Termin {wunschLesbar(p.wunsch_termin!)} eintragen …</button>
        </div>
      )}
      {darfEintragen && terminFrage && (
        <div className="cr-senden-frage">
          <b>{wunschLesbar(p.wunsch_termin!)} Uhr in den Global-Kalender eintragen?</b>
          <span className="cr-klein">Die Firma bekommt die Bestätigung mit Kalendereintrag, die Gesprächsperson den Auftrag. Danach schreibt Mara die Bestätigung im Faden.</span>
          <div className="cr-fenster-zeile">
            <input className="cr-feld" value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="Telefonnummer für den Anruf" maxLength={40} />
            <button type="button" className="cr-knopf" disabled={!!arbeit || telefon.replace(/\D/g, "").length < 6} onClick={() => tun("termin", () => rufen(`/chef/radar/post/${p.id}/termin`, "POST", { telefon: telefon.trim(), bestaetigt: true }), "Termin eingetragen — Mara hat die Bestätigung geschrieben.")}>
              {arbeit === "termin" ? "Trägt ein …" : "Eintragen"}
            </button>
            <button type="button" className="cr-knopf hell" onClick={() => setTerminFrage(false)}>Abbrechen</button>
          </div>
        </div>
      )}
      {offenOhneMara && (
        <div className="cr-fenster-zeile">
          <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("weg", () => rufen(`/chef/radar/post/${p.id}/verwerfen`), "Erledigt.")}>Erledigt</button>
        </div>
      )}

      {darfAntworten && (
        <div className="cr-post-mara">
          <div className="cr-post-mara-kopf">
            <b>{fertig ? (p.mara_status === "gesendet" ? "Mara hat geantwortet" : p.mara_status === "erledigt" ? "Erledigt — überholt" : "Von Hand beantwortet") : p.mara_text ? (p.art === "datenschutz" ? "Antwort von Justin (Entwurf)" : "Maras Antwort") : "Noch keine Antwort"}</b>
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
              {p.mara_text
                ? <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("weg", () => rufen(`/chef/radar/post/${p.id}/verwerfen`), "Verworfen.")}>Verwerfen</button>
                : <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("weg", () => rufen(`/chef/radar/post/${p.id}/verwerfen`), "Erledigt.")}>Erledigt</button>}
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
function AutomatikTafel({ trichter, uebersicht, motor, onGeaendert }: {
  trichter: Trichter | null; uebersicht: Uebersicht | null; motor: MotorStand | null; onGeaendert: () => void;
}) {
  const a = trichter?.automatik;
  const [abPassung, setAbPassung] = useState<string>("");
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  useEffect(() => { if (a) setAbPassung(String(a.abPassung)); }, [a?.abPassung]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <MotorKachel motor={motor} onGeaendert={onGeaendert} />
        <article className="cr-kachel">
          <header><b>Erste Mails</b><Kippe an={a.versand} aus={!!arbeit} onKlick={() => setzen("versand", { versand: !a.versand }, a.versand ? "Erste Mails pausiert." : "Erste Mails laufen.")} /></header>
          <p>Stärkstes Kapitalsignal zuerst, nur an Entscheider. {fensterText(motor?.einstellung)}, Tempo im Mail-Motor.</p>
          <div className="cr-kachel-feld">
            <label><span>Ab Passung</span><input className="cr-feld" type="number" min={0} max={100} value={abPassung} onChange={(e) => setAbPassung(e.target.value)} /></label>
            <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => setzen("zahlen", { abPassung: Number(abPassung) }, "Gespeichert.")}>Speichern</button>
          </div>
          <span className="cr-klein">Höchstens {RADAR_HOECHSTENS_JE_TAG} Mails je Postfach und Tag (mit Nachfass).</span>
        </article>
        <article className="cr-kachel">
          <header><b>Nachfassen</b><Kippe an={a.nachfass} aus={!!arbeit} onKlick={() => setzen("nachfass", { nachfass: !a.nachfass }, a.nachfass ? "Nachfassen pausiert." : "Nachfassen läuft.")} /></header>
          <p>Tag {RADAR_NACHFASS_TAGE[0]} und Tag {RADAR_NACHFASS_TAGE[0] + RADAR_NACHFASS_TAGE[1]}, im selben Faden. Jede Antwort stoppt.</p>
        </article>
        <article className="cr-kachel">
          <header><b>Mara antwortet</b></header>
          <div className="cr-segment" role="radiogroup" aria-label="Mara antwortet">
            {([["auto", "Selbst"], ["entwurf", "Zur Freigabe"], ["aus", "Aus"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={a.mara === k} className={a.mara === k ? "an" : undefined} disabled={!!arbeit} onClick={() => setzen("mara", { mara: k }, "Gespeichert.")}>{l}</button>
            ))}
          </div>
          <p>Antwortet in Minuten mit freien Terminen.{postfach === "js@fiaon.com" ? " Aus js@: zur Freigabe unter „Gespräche“." : ""}</p>
        </article>
        <article className="cr-kachel">
          <header><b>Suche</b><span className="cr-chip">läuft täglich</span></header>
          <p>Rund um die Uhr, bis 50 qualifizierte Firmen am Tag. Vorrat: <b>{zahl(trichter?.vorrat ?? 0)}</b>.</p>
        </article>
        <BriefKachel />
        <article className="cr-kachel breit">
          <header><b>So klingt die erste Mail</b></header>
          <p className="cr-zitat">„{RADAR_KERNSATZ.was} {RADAR_KERNSATZ.vorteil}“</p>
          <p className="cr-klein">Plus echter Anlass und eine Frage. Kein Preis, kein Betrag.</p>
        </article>
        <article className="cr-kachel breit">
          <header><b>Signatur an jeder Mail</b></header>
          <div className="cr-signatur-vorschau">
            <SignaturVorschau bild="/mail/signatur/mara.png" name="Mara Lindner" rolle="Digitale Assistentin von Justin Schwarzott" punkt />
            <SignaturVorschau bild="/mail/signatur/justin.png" name="Justin Schwarzott" rolle="Gründer" />
          </div>
        </article>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-458 — DER MAIL-MOTOR: Ziele je Stunde, Fenster, Tage, Warteschlange, ehrliche Leistung
// ═══════════════════════════════════════════════════════════════════════════
function MotorKachel({ motor, onGeaendert }: { motor: MotorStand | null; onGeaendert: () => void }) {
  const [firmen, setFirmen] = useState(""), [partner, setPartner] = useState(""), [von, setVon] = useState(""), [bis, setBis] = useState("");
  const [tage, setTage] = useState<number[]>([]);
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [frage, setFrage] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const e = motor?.einstellung;
  useEffect(() => {
    if (!e) return;
    setFirmen(String(e.firmenJeStunde)); setPartner(String(e.partnerJeStunde)); setVon(e.von); setBis(e.bis); setTage([...e.tage]);
  }, [e?.firmenJeStunde, e?.partnerJeStunde, e?.von, e?.bis, e?.tage?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const tun = async (name: string, fn: () => Promise<any>, gut: (j: any) => string) => {
    setArbeit(name); setMeldung(null);
    try { const j = await fn(); onGeaendert(); setMeldung({ art: "gut", text: gut(j) }); }
    catch (err: any) { setMeldung({ art: "fehler", text: err.message }); }
    finally { setArbeit(null); }
  };
  if (!motor || !e) return <article className="cr-kachel breit cr-motor"><Geruest zeilen={4} /></article>;
  const l = motor.leistung;
  const stundeVon = Math.floor(Number(e.von.slice(0, 2))), stundeBis = Math.ceil(Number(e.bis.slice(0, 2)) + Number(e.bis.slice(3)) / 60);
  const stunden = Array.from({ length: Math.max(0, stundeBis - stundeVon) }, (_, i) => stundeVon + i);
  const proStunde = (s: "firma" | "partner", h: number) => motor.stroeme[s].stunden.find((x) => x.stunde === h)?.n ?? 0;
  const spitze = Math.max(1, ...stunden.map((h) => proStunde("firma", h) + proStunde("partner", h)), e.firmenJeStunde + e.partnerJeStunde);
  return (
    <article className="cr-kachel breit cr-motor">
      <header>
        <b>Mail-Motor</b>
        <span className="cr-chip">{!motor.an ? "aus — Schalter oben" : motor.imFenster ? "sendet gerade" : "bereitet vor"}{motor.bremse < 1 ? ` · gebremst ×${String(motor.bremse).replace(".", ",")}` : ""}</span>
      </header>
      <p className="cr-motor-satz">{l.satz}{l.moeglich < l.ziel && l.postfaecherNoetig ? `. Für ${zahl(l.ziel)} je Stunde braucht es ${zahl(l.postfaecherNoetig)} warme Postfächer.` : "."}</p>
      <div className="cr-motor-stroeme">
        {(["firma", "partner"] as const).map((s) => {
          const x = motor.stroeme[s];
          return (
            <div key={s} className="cr-motor-strom">
              <b>{s === "firma" ? "Firmen mit Kapitalbedarf" : "Kooperationspartner"}</b>
              <span>{s === "firma" ? e.firmenJeStunde : e.partnerJeStunde} je Stunde · heute {zahl(x.gesendetHeute)} gesendet</span>
              <span className="cr-klein">Warteschlange: {zahl(x.bereit)} bereit · {zahl(x.arbeit)} in Arbeit · heute {zahl(x.verworfenHeute)} verworfen · Vorrat {zahl(x.vorrat)}</span>
              {!!x.gruende.length && <span className="cr-klein" title={x.gruende.map((g) => `${g.n} × ${g.grund}`).join("\n")}>Häufigster Grund: {x.gruende[0].grund}</span>}
            </div>
          );
        })}
      </div>
      <div className="cr-motor-stunden" aria-label="Erste Mails je Stunde heute">
        {stunden.map((h) => {
          const f = proStunde("firma", h), p = proStunde("partner", h);
          return (
            <span key={h} title={`${String(h).padStart(2, "0")} Uhr: ${f} Firmen, ${p} Partner`}>
              <i className="p" style={{ height: `${(p / spitze) * 100}%` }} /><i className="f" style={{ height: `${(f / spitze) * 100}%` }} />
              <small>{String(h).padStart(2, "0")}</small>
            </span>
          );
        })}
      </div>
      <div className="cr-kachel-feld">
        <label><span>Firmen je Stunde</span><input className="cr-feld" type="number" min={0} max={30} value={firmen} onChange={(ev) => setFirmen(ev.target.value)} /></label>
        <label><span>Partner je Stunde</span><input className="cr-feld" type="number" min={0} max={30} value={partner} onChange={(ev) => setPartner(ev.target.value)} /></label>
        <label><span>Von</span><input className="cr-feld" type="time" value={von} onChange={(ev) => setVon(ev.target.value)} /></label>
        <label><span>Bis</span><input className="cr-feld" type="time" value={bis} onChange={(ev) => setBis(ev.target.value)} /></label>
      </div>
      <div className="cr-motor-tage" role="group" aria-label="Sendetage">
        {WOCHENTAGE.map((t, i) => (
          <button key={t} type="button" aria-pressed={tage.includes(i + 1)} className={tage.includes(i + 1) ? "an" : undefined}
                  onClick={() => setTage((alt) => (alt.includes(i + 1) ? alt.filter((x) => x !== i + 1) : [...alt, i + 1].sort((a, b) => a - b)))}>{t}</button>
        ))}
      </div>
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      <div className="cr-fenster-zeile">
        <button type="button" className="cr-knopf hell" disabled={!!arbeit || !tage.length}
                onClick={() => void tun("speichern", () => rufen("/chef/radar/motor", "POST", { firmenJeStunde: Number(firmen), partnerJeStunde: Number(partner), von, bis, tage }), () => "Gespeichert.")}>Speichern</button>
        <button type="button" className="cr-knopf hell" disabled={!!arbeit || !motor.an} title={motor.an ? "" : "Erst Mara einschalten"}
                onClick={() => void tun("fuellen", () => rufen("/chef/radar/motor/fuellen", "POST", {}), () => "Mara bereitet bis zu drei Mails vor — das dauert ein paar Minuten.")}>{arbeit === "fuellen" ? "Startet …" : "Warteschlange jetzt füllen"}</button>
        <button type="button" className="cr-knopf warm" disabled={!!arbeit || !motor.an || !motor.imFenster || !(motor.stroeme.firma.bereit + motor.stroeme.partner.bereit)}
                title={!motor.imFenster ? "Nur im Sendefenster" : ""} onClick={() => setFrage(true)}>Jetzt eine senden …</button>
      </div>
      {frage && (
        <div className="cr-senden-frage">
          <b>Die nächste geprüfte Mail jetzt senden?</b>
          <p className="cr-recht">Alle Wände gelten: Sperrliste, kein Gespräch, keine zweite Mail, keine Mail nach Österreich, Freigabe der Prüf-KI.</p>
          <div className="cr-fenster-zeile">
            <button type="button" className="cr-knopf warm" disabled={!!arbeit}
                    onClick={() => void tun("senden", () => rufen<{ ergebnis: { gesendet: number; grund?: string } }>("/chef/radar/motor/senden", "POST", { bestaetigt: true }),
                      (j) => (j.ergebnis.gesendet ? "Gesendet." : `Nichts gesendet: ${j.ergebnis.grund ?? "keine Mail frei"}.`)).then(() => setFrage(false))}>{arbeit === "senden" ? "Sendet …" : "Jetzt senden"}</button>
            <button type="button" className="cr-knopf hell" onClick={() => setFrage(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MARA TESTEN (E-361) — eine Antwort einfügen und sehen, was Mara täte
// ═══════════════════════════════════════════════════════════════════════════
type Probe = {
  art: string; label: string; quelle: "regel" | "ki"; wunschFrei: boolean; zeiten: string[]; person: string | null;
  einordnung: { zusammenfassung: string; sprache: string; wunsch_termin: string; telefon: string; buchungslink: string; spaeter_datum: string };
  plan: { mara: "senden" | "entwurf" | "keine"; buchen: boolean; schritte: string[] };
  mara: { text: string; pruefung: string[] } | null;
};
type SzenarioErgebnis = { key: string; titel: string; erwartet: string; ist: string | null; quelle: "regel" | "ki" | "fehler"; ok: boolean; hinweis?: string };
const artLabel = (k: string | null) => (k ? RADAR_ANTWORT_ARTEN[k as RadarAntwortArt]?.label ?? k : "—");

function MaraTesten() {
  const [text, setText] = useState("");
  const [von, setVon] = useState("");
  const [betreff, setBetreff] = useState("");
  const [kopf, setKopf] = useState(false);
  const [arbeit, setArbeit] = useState<"probe" | "alle" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [alle, setAlle] = useState<{ ergebnisse: SzenarioErgebnis[]; richtig: number; gesamt: number } | null>(null);
  const beispiel = (sz: RadarSzenario) => { setText(sz.text); setVon(sz.von); setBetreff(sz.betreff); setProbe(null); setFehler(null); };
  const testen = async () => {
    setArbeit("probe"); setFehler(null); setProbe(null);
    try { setProbe(await rufen<Probe>("/chef/radar/mara-probe", "POST", { text, von: von.trim() || null, betreff: betreff.trim() || null })); }
    catch (e: any) { setFehler(e.message); }
    finally { setArbeit(null); }
  };
  const allePruefen = async () => {
    setArbeit("alle"); setFehler(null); setAlle(null);
    try { setAlle(await rufen("/chef/radar/mara-szenarien", "POST", {})); }
    catch (e: any) { setFehler(e.message); }
    finally { setArbeit(null); }
  };
  const e = probe?.einordnung;
  return (
    <section className="cr-kacheln">
      <article className="cr-kachel breit cr-mara-test">
        <header><b>Mara testen</b><span className="cr-klein">Schreibt nichts, sendet nichts, bucht nichts.</span></header>
        <p>Füge eine Antwort ein. Mara zeigt, was sie erkennt und was sie tun würde.</p>
        <select className="cr-feld" value="" aria-label="Beispiel aus dem Katalog" onChange={(ev) => { const sz = RADAR_SZENARIEN.find((x) => x.key === ev.target.value); if (sz) beispiel(sz); }}>
          <option value="">Beispiel aus dem Katalog …</option>
          {RADAR_SZENARIEN.map((sz) => <option key={sz.key} value={sz.key}>{sz.titel}</option>)}
        </select>
        <textarea className="cr-feld" rows={5} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="z. B. „Klingt spannend. Donnerstag um 10 Uhr passt mir.“" maxLength={6000} />
        {kopf ? (
          <div className="cr-fenster-zeile">
            <input className="cr-feld" value={von} onChange={(ev) => setVon(ev.target.value)} placeholder="Absender (optional)" maxLength={300} />
            <input className="cr-feld" value={betreff} onChange={(ev) => setBetreff(ev.target.value)} placeholder="Betreff (optional)" maxLength={300} />
          </div>
        ) : <div className="cr-fenster-zeile"><button type="button" className="cr-textknopf" onClick={() => setKopf(true)}>Absender und Betreff angeben</button></div>}
        <div className="cr-fenster-zeile">
          <button type="button" className="cr-knopf" disabled={!text.trim() || !!arbeit} onClick={testen}>{arbeit === "probe" ? "Mara liest …" : "Was würde Mara tun?"}</button>
          <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={allePruefen}>{arbeit === "alle" ? `Prüft ${RADAR_SZENARIEN.length} Szenarien …` : `Alle ${RADAR_SZENARIEN.length} Szenarien prüfen`}</button>
        </div>
        {fehler && <p className="cr-hinweis fehler">{fehler}</p>}
        {probe && e && (
          <div className="cr-probe">
            <div className="cr-post-kopf">
              <span className={`cr-art ${ART_TON[probe.art] ?? "leise"}`}>{probe.label}</span>
              <span className="cr-klein">{probe.quelle === "regel" ? "sicher erkannt (Regel)" : "eingeordnet von der KI"}</span>
            </div>
            {e.zusammenfassung && <p className="cr-post-satz">{e.zusammenfassung}</p>}
            {(e.sprache !== "de" || e.wunsch_termin || e.telefon || e.buchungslink || e.spaeter_datum) && (
              <div className="cr-post-fakten">
                {e.sprache !== "de" && <span className="cr-chip">Antwortet auf Englisch</span>}
                {e.wunsch_termin && <span className="cr-chip">Wunschzeit {wunschLesbar(e.wunsch_termin)}{probe.wunschFrei ? " · frei" : " · nicht frei"}</span>}
                {e.telefon && <span className="cr-chip">Tel. {e.telefon}</span>}
                {e.buchungslink && <span className="cr-chip">Eigener Buchungskalender</span>}
                {e.spaeter_datum && <span className="cr-chip">Wiedervorlage {datum(e.spaeter_datum)}</span>}
              </div>
            )}
            <ol className="cr-probe-schritte">{probe.plan.schritte.map((x) => <li key={x}>{x}</li>)}</ol>
            {probe.mara && (
              <>
                <b className="cr-probe-titel">{probe.art === "datenschutz" ? "Antwort von Justin (Entwurf)" : probe.plan.mara === "senden" ? "Mara würde senden" : "Maras Entwurf"}</b>
                <pre className="cr-post-gesendet">{probe.mara.text}</pre>
                {!!probe.mara.pruefung.length && <p className="cr-hinweis warn">Wortwand: {probe.mara.pruefung.join(" · ")} — so ginge sie nicht hinaus.</p>}
              </>
            )}
          </div>
        )}
        {alle && (
          <div className="cr-probe">
            <div className="cr-post-kopf">
              <b className="cr-probe-titel">{alle.richtig} von {alle.gesamt} richtig erkannt</b>
              <span className="cr-klein">Regel = ohne KI · KI = echte Einordnung</span>
            </div>
            {alle.ergebnisse.some((r) => !r.ok) && <ul className="cr-szenarien">{alle.ergebnisse.filter((r) => !r.ok).map((r) => <SzenarioZeile key={r.key} r={r} />)}</ul>}
            {alle.richtig > 0 && (
              <details className="cr-post-mail">
                <summary>{alle.richtig} richtig erkannt — anzeigen</summary>
                <ul className="cr-szenarien">{alle.ergebnisse.filter((r) => r.ok).map((r) => <SzenarioZeile key={r.key} r={r} />)}</ul>
              </details>
            )}
          </div>
        )}
      </article>
    </section>
  );
}

function SzenarioZeile({ r }: { r: SzenarioErgebnis }) {
  return (
    <li className={r.ok ? "gut" : "rot"}>
      <i aria-hidden="true">{r.ok ? "✓" : "✗"}</i>
      <span>{r.titel}</span>
      <span className="cr-klein">
        {r.quelle === "fehler"
          ? `Nicht geprüft: ${r.hinweis ?? "Fehler"}`
          : `${artLabel(r.ist)}${r.ist !== r.erwartet && !r.ok ? ` — richtig wäre ${artLabel(r.erwartet)}` : ""}${r.hinweis ? ` · ${r.hinweis}` : ""} · ${r.quelle === "regel" ? "Regel" : "KI"}`}
      </span>
    </li>
  );
}

function SignaturVorschau({ bild, name, rolle, punkt }: { bild: string; name: string; rolle: string; punkt?: boolean }) {
  return (
    <div className="cr-signatur">
      <img src={bild} alt="" width={56} height={56} />
      <div>
        <b>{name}</b>
        <span>{rolle}</span>
        <span className="blau">FIAON Global</span>
        <img className="linie" src="/mail/signatur/linie.gif" alt="" width={200} height={2} />
        {punkt && <span className="punkt"><img src="/mail/signatur/punkt.gif" alt="" width={10} height={10} />Antwortet meist in wenigen Minuten</span>}
      </div>
    </div>
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
    ["gefunden", "Gefunden"], ["angeschrieben", "Mails"], ["briefe", "Briefe"], ["nachfass", "Nachfass"], ["unzustellbar", "Rückläufer"], ["besuche", "QR-Besuche"],
    ["antworten", "Antworten"], ["absagen", "Absagen"], ["leads", "Leads"], ["termine", "Termine"], ["angebote", "Angebote"], ["kaeufe", "Käufe"],
  ];
  return (
    <section className="cr-messung">
      <div className="cr-tabelle-rahmen">
        <table className="cr-tabelle cr-tabelle-zahlen">
          <thead><tr><th>Tag</th>{spalten.map(([, l]) => <th key={l}>{l}</th>)}<th>Porto</th><th>Umsatz</th></tr></thead>
          <tbody>
            {trichter.tage.map((t) => (
              <tr key={t.tag} className={t.leads >= trichter.ziel.leads ? "ziel" : undefined}>
                <td>{new Date(`${t.tag}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                {spalten.map(([k]) => <td key={k} className={(t[k] as number) ? undefined : "null"}>{zahl(t[k] as number)}</td>)}
                <td>{t.briefKostenCents ? eur(t.briefKostenCents) : "—"}</td>
                <td>{t.umsatzCents ? eur(t.umsatzCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>30 Tage</td>{spalten.map(([k]) => <td key={k}>{zahl(trichter.summe[k] as number)}</td>)}<td>{trichter.summe.briefKostenCents ? eur(trichter.summe.briefKostenCents) : "—"}</td><td>{trichter.summe.umsatzCents ? eur(trichter.summe.umsatzCents) : "—"}</td></tr>
            <tr><td>Gesamt</td>{spalten.map(([k]) => <td key={k}>{zahl(trichter.gesamt[k] as number)}</td>)}<td>{trichter.gesamt.briefKostenCents ? eur(trichter.gesamt.briefKostenCents) : "—"}</td><td>{trichter.gesamt.umsatzCents ? eur(trichter.gesamt.umsatzCents) : "—"}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="cr-klein" title="Lead = Interesse, Sachfrage oder Terminwunsch in der Antwort, oder Termin/Auftrag über den Link der Mail. Kauf = bezahlter Global-Auftrag einer angeschriebenen Firma. Briefe = beim Versanddienst übergeben (ohne Testmodus). QR-Besuche = /business über den Code auf dem Brief geöffnet. Porto netto.">Ziel je Tag: {trichter.ziel.leads} Leads, {trichter.ziel.kaeufe} Käufe · Lead = Interesse, Frage oder Termin · Kauf = bezahlter Global-Auftrag.</p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN — die Liste wie bisher (Reiter, Tabelle, Stapel)
// ═══════════════════════════════════════════════════════════════════════════
function FirmenListe({ runde, postfach, lauf, setLauf, onFirma, offen, onSuchen, onWebsite }: {
  runde: number; postfach: string; lauf: Lauf | null; setLauf: (l: Lauf | null) => void; onFirma: (id: number) => void; offen: number | null; onSuchen: () => void; onWebsite: () => void;
}) {
  // E-337: Startansicht = „Qualifiziert“ (Justin: „ab jetzt nur noch qualifizierte Unternehmen“).
  const [gruppe, setGruppe] = useState("qualifiziert");
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
      <div className="cr-zeile-kopf cr-firmen-tun">
        <button type="button" className="cr-glasknopf" onClick={onSuchen}>Firmen suchen</button>
        <button type="button" className="cr-glasknopf leise" onClick={onWebsite}>Website aufnehmen</button>
      </div>
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      <div className="cr-reiter">
        <div className="cr-reiter-liste" role="tablist" aria-label="Stand">
          <button type="button" role="tab" aria-selected={gruppe === ""} className={gruppe === "" ? "an" : undefined} onClick={() => setGruppe("")}>Alle <i>{z?.gesamt ?? 0}</i></button>
          {RADAR_GRUPPEN.map((g) => (
            <button key={g.key} type="button" role="tab" aria-selected={gruppe === g.key} className={gruppe === g.key ? "an" : undefined} onClick={() => setGruppe(g.key)}>
              {g.label} <i>{g.ohneMail ? (stand["ohne_mail"] ?? 0) : g.archiv ? (stand["archiv"] ?? 0) : g.qualifiziert ? (stand["qualifiziert"] ?? 0) : gezaehlt(g.stati)}</i>
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
          <span>{gruppe === "qualifiziert" ? "Mara sucht rund um die Uhr — neue Firmen erscheinen nach der Prüfung." : "Hier steht gerade keine Firma."} <button type="button" className="cr-textknopf" onClick={onSuchen}>Jetzt suchen</button></span>
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
                    {f.entscheider
                      ? <><span className="cr-mail persoenlich" title={f.entscheider.email}>{f.entscheider.name}</span><span className="cr-ap" title={f.entscheider.email}>{f.entscheider.email}</span></>
                      : f.email ? <><span className="cr-mail sammel" title={f.email}>{f.email}</span><span className="cr-ap">{f.entscheider_am ? "kein Entscheider gefunden" : "Entscheider noch nicht gesucht"}</span></> : <span className="cr-ohne">E-Mail fehlt</span>}
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
            {ohneMail > 0 && <span className="cr-klein">{ohneMail} ohne E-Mail — wird nachgesucht</span>}
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
          <p>Aus <b>{postfach}</b>, alle 20–45 Sekunden eine. Ohne Adresse oder mit Regelverstoß: übersprungen.</p>
          <p className="cr-recht" title="DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG — gilt auch für einzelne, persönliche Mails.">Werbe-Mails an Firmen brauchen in DE, AT und CH eine vorherige Einwilligung — sonst drohen Abmahnungen.</p>
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
        {laeuft && <span>{lauf.art === "stapel" ? `${lauf.fertig} von ${lauf.gesamt}${lauf.aktuell ? ` · ${lauf.aktuell}` : ""}` : "läuft · 1–2 Minuten"}</span>}
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
  // E-337 (Justin: „das PopUp muss da aufgehen, wo man ist“): am <body> statt in der Seite — eine Glas- oder
  // Bewegungsschicht der Chef-Hülle machte „position: fixed“ sonst relativ zur Seite, und das Fenster ging mitten im Inhalt auf.
  return createPortal(
    <div className="cr-schatten mitte" onClick={onZu}>
      <div className="cr-fenster" role="dialog" aria-modal="true" aria-label={titel} onClick={(e) => e.stopPropagation()}>
        <header><h2>{titel}</h2><button type="button" className="cr-zu" onClick={onZu} aria-label="Schließen">×</button></header>
        <div className="cr-fenster-rumpf">{children}</div>
      </div>
    </div>,
    document.body,
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
  const gewaehlt = RADAR_SIGNALE.find((x) => x.key === signal);
  return (
    <Fenster titel="Firmen suchen" onZu={onZu}>
      <p className="cr-fenster-satz">Mara sucht zehn Firmen mit diesem Kapitalsignal und prüft jede.</p>
      <div className="cr-chips" role="radiogroup" aria-label="Kapitalsignal">
        {RADAR_SIGNALE.map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={signal === x.key} className={signal === x.key ? "an" : undefined} title={x.suche} onClick={() => setSignal(x.key)}>
            {x.label}<SignalPunkte staerke={x.staerke} titel="" />
          </button>
        ))}
      </div>
      {gewaehlt && <p className="cr-klein cr-fenster-erklaerung">{gewaehlt.suche.split(" — ")[0]}.</p>}
      <div className="cr-fenster-raster">
        <label><span>Branche</span>
          <select className="cr-feld" value={bereich} onChange={(e) => setBereich(e.target.value)}>
            {RADAR_BEREICHE.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </label>
        <label><span>Land</span>
          <div className="cr-segment" role="radiogroup" aria-label="Land">
            {[["", "Alle"], ["DE", "DE"], ["AT", "AT"], ["CH", "CH"]].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={land === k} className={land === k ? "an" : undefined} onClick={() => setLand(k)}>{l}</button>
            ))}
          </div>
        </label>
        <label className="breit"><span>Stichwort (optional)</span>
          <input className="cr-feld" value={stichwort} onChange={(e) => setStichwort(e.target.value)} placeholder="z. B. München, Kosmetik, Messe in Las Vegas" maxLength={120} />
        </label>
      </div>
      {fehler && <p className="cr-hinweis fehler">{fehler}</p>}
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
      <p className="cr-fenster-satz">Mara liest Impressum und Kontakt und legt die Firma an.</p>
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
  const [reiter, setReiter] = useState<"ueberblick" | "scan" | "mail" | "brief" | "verlauf">("ueberblick");
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
        if (j.firma.versendet_am || j.firma.brief_versendet_am) setReiter("verlauf"); else if (j.firma.mail) setReiter("mail"); else if (j.firma.brief) setReiter("brief"); else if (j.firma.scan) setReiter("scan");
      }
      if (j.firma.versendet_am || j.firma.brief_versendet_am) rufen<{ post: Post[] }>(`/chef/radar/post?firma=${id}`, "GET").then((v) => setVerlauf(v.post)).catch(() => setVerlauf([]));
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
  const raus = f?.status === "versendet" || !!f?.versendet_am || f?.status === "brief" || !!f?.brief_versendet_am;
  // E-337: Der Weg geht bis zum Kauf.
  const schritt = f?.kauf_am ? 8 : f?.status === "angebot" ? 7 : f?.termin_am ? 6 : f?.lead_am ? 5 : raus ? 4 : mail ? 3 : scan ? 2 : 1;
  // Nach einem Rückläufer oder einer neuen Adresse vom falschen Empfänger darf die erste Mail EINMAL an die neue Adresse.
  const neuerVersuch = !!f && (f.status === "unzustellbar" || (f.status === "antwort" && f.antwort_art === "falscher_empfaenger")) && !!f.email;

  return createPortal(
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
            {f.archiviert_am && (
              <div className="cr-archiv-leiste">
                <span>Im Archiv seit {datum(f.archiviert_am)}{f.archiv_grund ? ` · ${f.archiv_grund}` : ""}</span>
                <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("archiv", () => rufen(`/chef/radar/firma/${id}/aus-archiv`), "Zurück im Radar.")}>Aus dem Archiv holen</button>
              </div>
            )}

            <ol className="cr-schritte" aria-label="Fortschritt">
              {["Gefunden", "Gescannt", "Mail bereit", "Versendet", "Lead", "Termin", "Angebot", "Kauf"].map((t, i) => (
                <li key={t} className={schritt > i + 1 ? "da" : schritt === i + 1 ? "jetzt" : undefined}>{t}</li>
              ))}
            </ol>

            <nav className="cr-blatt-reiter" role="tablist">
              {([["ueberblick", "Überblick"], ["scan", "Website-Scan"], ["mail", "Mail"], ["brief", "Brief"], ...(raus ? [["verlauf", `Verlauf${verlauf?.length ? ` · ${verlauf.length}` : ""}`]] : [])] as [typeof reiter, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={reiter === k} className={reiter === k ? "an" : undefined} onClick={() => setReiter(k)}>{l}</button>
              ))}
            </nav>

            {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
            {(arbeit === "scan" || arbeit === "mail") && <p className="cr-hinweis" title="Die KI liest bis zu acht Seiten und sucht nach Meldungen.">Dauert 30–90 Sekunden.</p>}

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
                      <b>E-Mail-Adresse fehlt.</b>
                      <p className="cr-klein" title="Auch hinter mailto-Verweisen, Cloudflare-Schutz oder „info [at] firma [dot] de“.">Nur Adressen, die auf der Website stehen. Manche Firmen zeigen nur ein Formular.</p>
                      <div className="cr-fenster-zeile">
                        <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => tun("nachsuchen", () => rufen(`/chef/radar/firma/${id}/nachsuchen`), "Nachgesucht.")}>
                          {arbeit === "nachsuchen" ? "Sucht …" : "Noch einmal nachsuchen"}
                        </button>
                        <input className="cr-feld" value={an} onChange={(e) => setAn(e.target.value)} placeholder="Adresse von Hand eintragen" />
                        <button type="button" className="cr-knopf hell" disabled={!!arbeit || !an.trim()} onClick={() => tun("kontakt", () => rufen(`/chef/radar/firma/${id}/kontakt`, "POST", { email: an }), "Adresse gespeichert.")}>Übernehmen</button>
                      </div>
                    </div>
                  )}
                  <div className={`cr-entscheider${f.entscheider ? " da" : ""}`}>
                    <div>
                      <span className="cr-auge">Entscheider</span>
                      {f.entscheider
                        ? <><b>{f.entscheider.anrede ? `${f.entscheider.anrede} ` : ""}{f.entscheider.name}{f.entscheider.rolle ? ` · ${f.entscheider.rolle}` : ""}</b>
                            <span>{f.entscheider.email} · <a href={f.entscheider.quelle} target="_blank" rel="noopener noreferrer" className="cr-link">Quelle ↗</a></span></>
                        : <b>{f.entscheider_am ? "Keine persönliche Adresse gefunden" : "Noch nicht gesucht"}</b>}
                    </div>
                    <button type="button" className="cr-knopf hell" disabled={!!arbeit || zu} onClick={() => tun("entscheider", () => rufen(`/chef/radar/firma/${id}/entscheider`), "Entscheider-Suche fertig.")}>
                      {arbeit === "entscheider" ? "Sucht …" : f.entscheider ? "Neu suchen" : "Entscheider suchen"}
                    </button>
                  </div>
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
                      <p className="cr-profil">{f.signal.label ?? RADAR_SIGNALE.find((x) => x.key === f.signal?.art)?.label ?? f.signal.art}{f.signal.beleg ? <> — <q>{f.signal.beleg}</q></> : null}</p>
                      {f.signal.url && <a href={f.signal.url} target="_blank" rel="noopener noreferrer" className="cr-link">Beleg ↗</a>}
                    </div>
                  )}
                  {imp.quelle === "website" && <p className="cr-klein">Kein lesbares Impressum — Adresse wörtlich von {imp.seite}.</p>}
                  {imp.quelle !== "website" && imp.seite && <p className="cr-klein">Wörtlich aus dem Impressum ({imp.seite}).{imp.emailSeite ? ` Adresse von ${imp.emailSeite}.` : ""}</p>}
                  {!!f.gruende?.length && (
                    <details className="cr-block cr-klappe">
                      <summary><h3>Warum sie passt <small>{f.gruende.length} Gründe mit Quelle</small></h3></summary>
                      <ul className="cr-gruende">{f.gruende.map((g, i) => <li key={i}>{g.text}{g.url && <> — <a href={g.url} target="_blank" rel="noopener noreferrer" className="cr-link">Quelle ↗</a></>}</li>)}</ul>
                      {!!f.signale?.length && <div className="cr-signale">{f.signale.map((s) => <span key={s} className="cr-chip">{s}</span>)}</div>}
                    </details>
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
                  {!scan && <p className="cr-klein" title="Die KI liest bis zu acht Seiten und sucht nach Meldungen.">Noch nicht gescannt. Jeder Aufhänger braucht ein wörtliches Zitat.</p>}
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
                      {!scan.aufhaenger.length && <p className="cr-hinweis warn">Kein belegter Aufhänger — ohne ihn keine Mail.</p>}
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
                  {!mail && <p className="cr-klein">Noch keine Mail. Sie entsteht aus dem Scan (läuft bei Bedarf mit).</p>}
                  {mail && (
                    <>
                      {!!mail.sperrend?.length && <p className="cr-hinweis fehler">Sperrt Entwurf und Versand: {mail.sperrend.join(" · ")}</p>}
                      {!!mail.warnungen?.length && <p className="cr-hinweis warn">Hinweis: {mail.warnungen.join(" · ")}</p>}
                      {/* E-458 (Punkt 4): ohne Freigabe der Prüf-KI geht keine erste Mail hinaus — auch nicht von hier. */}
                      <div className={`cr-pruefki ${f.pruef_ki?.ok ? "gut" : f.pruef_ki ? "fehler" : "offen"}`}>
                        <span>
                          <b>Prüf-KI</b>{" "}
                          {f.pruef_ki?.ok
                            ? `freigegeben · KI-Klang ${f.pruef_ki.ki_klang ?? "—"} von 10 · Versuch ${f.pruef_ki.versuch}`
                            : f.pruef_ki
                              ? `nicht freigegeben: ${(f.pruef_ki.gruende ?? f.pruef_ki.punkte.map((x) => `${x.regel}: ${x.hinweis}`)).slice(0, 2).join(" · ")}`
                              : "hat diese Fassung noch nicht gelesen — ohne Freigabe geht sie nicht hinaus."}
                        </span>
                        {!f.pruef_ki?.ok && <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => tun("pruefen", () => rufen(`/chef/radar/firma/${id}/pruefen`, "POST", {}), "Die Prüf-KI hat gelesen.")}>{arbeit === "pruefen" ? "Prüft …" : "Prüfen lassen"}</button>}
                      </div>
                      <div className="cr-betreff"><span>Betreff</span><b>{mail.betreff}</b></div>
                      {!bearbeiten ? (
                        <>
                          <iframe className="cr-vorschau" title="Vorschau der Mail" sandbox="" srcDoc={mail.html} />
                          <div className="cr-fenster-zeile">
                            <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(true)} disabled={f.status === "versendet" || !!f.versendet_am}>Text ändern</button>
                            <button type="button" className="cr-knopf hell" onClick={() => { void navigator.clipboard?.writeText(mail.text); setMeldung({ art: "gut", text: "Text kopiert." }); }}>Text kopieren</button>
                          </div>
                        </>
                      ) : (
                        <div className="cr-bearbeiten">
                          <label><span>Betreff</span><input className="cr-feld" value={betreff} onChange={(e) => setBetreff(e.target.value)} maxLength={120} /></label>
                          <label title="Anrede und Gruß setzt der Radar."><span>Text — Leerzeile = neuer Absatz, letzter Absatz = Schlussfrage</span>
                            <textarea className="cr-feld" value={koerper} onChange={(e) => setKoerper(e.target.value)} rows={14} />
                          </label>
                          <div className="cr-fenster-zeile">
                            <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => tun("speichern", () => rufen(`/chef/radar/firma/${id}/mail`, "PUT", { betreff, koerper, ps }), "Gespeichert.", () => setBearbeiten(false))}>Speichern</button>
                            <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(false)}>Abbrechen</button>
                          </div>
                        </div>
                      )}

                      {(!(f.status === "versendet" || f.versendet_am) || neuerVersuch) && !zu && (
                        <div className="cr-ausgabe">
                          {neuerVersuch && <p className="cr-hinweis warn">Erste Mail kam nicht an — einmal an {f.email} erlaubt.</p>}
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
                              <p className="cr-recht" title="DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG">Werbe-Mails an Firmen brauchen in DE, AT und CH eine vorherige Einwilligung — auch einzeln und persönlich.</p>
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
                      {(f.status === "versendet" || !!f.versendet_am) && !neuerVersuch && <p className="cr-hinweis gut">Versendet {f.versendet_am ? datum(f.versendet_am) : ""}{f.postfach ? ` aus ${f.postfach}` : ""} — nur eine erste Mail je Firma.{f.nachfass_faellig ? ` Nachfassen ${f.nachfass_stufe ? `(Stufe ${(f.nachfass_stufe ?? 0) + 1}) ` : ""}ab ${datum(f.nachfass_faellig)}.` : ""}</p>}
                    </>
                  )}
                </>
              )}
              {reiter === "brief" && <BriefReiter id={id} gesperrt={zu} onGeaendert={() => { void laden(); onGeaendert(); }} />}
              {reiter === "verlauf" && (
                <>
                  {!verlauf && <Geruest zeilen={4} />}
                  {verlauf && !verlauf.length && <p className="cr-klein">Noch nichts — Mara liest das Postfach alle 10 Minuten.</p>}
                  <ol className="cr-faden">
                    {(verlauf ?? []).slice().sort((x, y) => String(x.datum).localeCompare(String(y.datum))).map((v) => (
                      <li key={v.id} className={v.richtung === "aus" ? "aus" : "ein"}>
                        <div className="cr-faden-kopf">
                          <b>{v.richtung === "aus" ? (v.art === "mara" ? "Mara" : v.art === "von_hand" ? "Von Hand" : v.art === "brief" ? `Brief (${v.von})` : v.art?.startsWith("nachfass") ? `Nachfass ${v.art.slice(8)}` : "Erste Mail") : (RADAR_ANTWORT_ARTEN[v.art as RadarAntwortArt]?.label ?? v.art)}</b>
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
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-339 (12.10.2026) — BRIEF STATT MAIL
// Für Firmen mit Kapitalsignal ohne persönliche Adresse des Entscheiders: Mara schreibt einen Brief an die
// Geschäftsführung (Name und Anschrift aus dem Impressum). Die Vorschau IST das Druck-PDF; gesendet wird nur mit
// Schalter „Briefversand“ (Automatik), im Tageskontingent, über Pingen oder LetterXpress — zuerst im Testmodus.
// ═══════════════════════════════════════════════════════════════════════════
type BriefDaten = {
  pruefung: { ok: boolean; punkte: { key: string; ok: boolean; text: string }[] };
  empfaenger: { zeilen: string[]; fehlt: string[]; person: string | null; anrede: string | null; land: string | null };
  brief: {
    betreff: string; anrede: string; absaetze: string[]; frage: string; warnungen: string[]; sperrend: string[]; geaendert: boolean;
    erstellt_am: string; kennung: string; link: string; quelle: string;
  } | null;
  stand: {
    status: string | null; am: string | null; versendetAm: string | null; testAm: string | null; anbieter: string | null; anbieterId: string | null;
    kostenCents: number | null; fehler: string | null; besuche: number; besuchAm: string | null;
  };
  kosten: { cents: number; geschaetzt: boolean };
  link: string; kennung: string;
};
type BriefUebersicht = {
  einstellung: { versand: boolean; jeTag: number; anbieter: RadarBriefAnbieter; testmodus: boolean; farbe: boolean };
  heute: { briefe: number; kostenCents: number; test: number };
  bereit: Record<RadarBriefAnbieter, { ok: boolean; fehlt: string[] }>;
  hoechstens: number;
};
const BRIEF_STAND: Record<string, string> = {
  entwurf: "Entwurf", sendet: "Wird übergeben …", test: "Im Testmodus übergeben — nicht gedruckt", uebergeben: "Beim Versanddienst", versendet: "Gedruckt und abgeschickt", fehler: "Fehler",
};

function BriefReiter({ id, gesperrt, onGeaendert }: { id: number; gesperrt: boolean; onGeaendert: () => void }) {
  const d = useDaten<BriefDaten>(`/chef/radar/firma/${id}/brief`, [id]);
  const u = useDaten<BriefUebersicht>(`/chef/radar/brief`, [id]);
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [hinweis, setHinweis] = useState("");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [betreff, setBetreff] = useState("");
  const [koerper, setKoerper] = useState("");
  const [frage, setFrage] = useState(false);
  const daten = d.daten;
  const brief = daten?.brief ?? null;
  useEffect(() => { if (brief) { setBetreff(brief.betreff); setKoerper([...brief.absaetze, brief.frage].join("\n\n")); } }, [brief?.erstellt_am, brief?.betreff]); // eslint-disable-line react-hooks/exhaustive-deps

  const tun = async (name: string, fn: () => Promise<unknown>, gut: string, danach?: () => void) => {
    setArbeit(name); setMeldung(null);
    try { await fn(); d.neu(); u.neu(); onGeaendert(); setMeldung({ art: "gut", text: gut }); danach?.(); }
    catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };

  if (d.fehler) return <Fehlermeldung text={d.fehler} erneut={d.neu} />;
  if (!daten) return <Geruest zeilen={6} />;
  const st = daten.stand;
  const e = u.daten?.einstellung;
  const bereit = e ? u.daten?.bereit[e.anbieter] : null;
  const unterwegs = !!st.versendetAm;
  const heute = e ? (e.testmodus ? u.daten?.heute.test ?? 0 : u.daten?.heute.briefe ?? 0) : 0;
  const anbieterName = e ? RADAR_BRIEF_ANBIETER[e.anbieter].label : "—";
  // Warum „Brief senden“ gerade nicht geht — in einem Satz, damit niemand rätselt.
  const sperre = !brief ? "Erst den Brief schreiben lassen."
    : brief.sperrend.length ? "Der Brief verletzt noch Regeln (siehe oben)."
    : !daten.pruefung.ok ? "Kein Brief für diese Firma — siehe Haken oben."
    : !e ? "Einstellungen laden …"
    : !e.versand ? "Briefversand ist aus — unter „Automatik“ einschalten."
    : !bereit?.ok ? `${anbieterName}: Zugangsdaten fehlen (${bereit?.fehlt.join(", ")}).`
    : heute >= e.jeTag ? `Tageskontingent erreicht (${e.jeTag}).`
    : null;
  const pdfAdresse = `${API}/chef/radar/firma/${id}/brief.pdf?v=${encodeURIComponent(`${brief?.erstellt_am ?? ""}-${brief?.betreff ?? ""}-${(brief?.absaetze ?? []).join("").length}-${brief?.frage?.length ?? 0}-${e?.farbe ? 1 : 0}`)}`;

  return (
    <div className="cr-brief">
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      <div className="cr-brief-oben">
        <ul className="cr-brief-punkte" aria-label="Bekommt diese Firma einen Brief?">
          {daten.pruefung.punkte.map((p) => <li key={p.key} className={p.ok ? "ja" : "nein"}><i aria-hidden="true">{p.ok ? "✓" : "✕"}</i>{p.text}</li>)}
        </ul>
        <div className="cr-brief-anschrift">
          <span className="cr-auge">Anschrift im Fenster</span>
          <address>{daten.empfaenger.zeilen.map((z, i) => <span key={i}>{z}</span>)}</address>
          {!!daten.empfaenger.fehlt.length && <span className="cr-klein">Fehlt: {daten.empfaenger.fehlt.join(", ")}</span>}
          <span className="cr-klein">Kennung {daten.kennung} · QR-Code → Gesprächstermin</span>
        </div>
      </div>

      {st.status && st.status !== "entwurf" && (
        <p className={`cr-hinweis ${st.status === "fehler" ? "fehler" : st.status === "test" ? "warn" : "gut"}`}>
          {BRIEF_STAND[st.status] ?? st.status}
          {st.anbieter ? ` · ${RADAR_BRIEF_ANBIETER[st.anbieter as RadarBriefAnbieter]?.label ?? st.anbieter}` : ""}
          {st.anbieterId ? ` · Kennung ${st.anbieterId}` : ""}
          {st.versendetAm ? ` · übergeben ${datum(st.versendetAm)}` : st.testAm ? ` · Test ${datum(st.testAm)}` : ""}
          {st.kostenCents != null && unterwegs ? ` · ${eur(st.kostenCents)} netto` : ""}
          {unterwegs ? ` · ${st.besuche ? `${zahl(st.besuche)} ${st.besuche === 1 ? "QR-Besuch" : "QR-Besuche"}${st.besuchAm ? ` (zuerst ${datum(st.besuchAm)})` : ""}` : "noch kein QR-Besuch"}` : ""}
          {st.fehler ? ` — ${st.fehler}` : ""}
        </p>
      )}

      {!unterwegs && (
        <div className="cr-fenster-zeile">
          <button type="button" className={`cr-knopf${brief ? " hell" : ""}`} disabled={!!arbeit || gesperrt || !!daten.empfaenger.fehlt.length}
                  onClick={() => tun("schreiben", () => rufen(`/chef/radar/firma/${id}/brief`, "POST", { hinweis: hinweis.trim() || null }), "Der Brief steht — die Vorschau ist das Druck-PDF.", () => setBearbeiten(false))}>
            {arbeit === "schreiben" ? "Mara schreibt …" : brief ? "Neu schreiben" : "Brief schreiben lassen"}
          </button>
          <input className="cr-feld" value={hinweis} onChange={(ev) => setHinweis(ev.target.value)} placeholder="Wunsch an Mara (optional): Fokus auf die neue Halle …" maxLength={400} />
        </div>
      )}
      {arbeit === "schreiben" && <p className="cr-hinweis" title="Mara liest Scan und Impressum und schreibt den Brief.">Dauert 30–90 Sekunden.</p>}
      {!brief && !daten.empfaenger.fehlt.length && <p className="cr-klein" title="„Herr“/„Frau“ steht nur da, wenn es auf der Quelle steht.">Noch kein Brief. Er entsteht aus dem Scan.</p>}

      {brief && (
        <>
          {!!brief.sperrend.length && <p className="cr-hinweis fehler">Sperrt den Versand: {brief.sperrend.join(" · ")}</p>}
          {!!brief.warnungen.length && <p className="cr-hinweis warn">Hinweis: {brief.warnungen.join(" · ")}</p>}
          <div className="cr-betreff"><span>Betreff</span><b>{brief.betreff}</b></div>
          {!bearbeiten ? (
            <>
              <iframe className="cr-vorschau cr-brief-pdf" title="Der Brief als PDF — so geht er in den Druck" src={`${pdfAdresse}#toolbar=0&navpanes=0&view=FitH`} />
              <div className="cr-fenster-zeile">
                <a className="cr-knopf hell" href={pdfAdresse} target="_blank" rel="noopener noreferrer">PDF öffnen ↗</a>
                {!unterwegs && <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(true)}>Text ändern</button>}
              </div>
            </>
          ) : (
            <div className="cr-bearbeiten">
              <label><span>Betreff</span><input className="cr-feld" value={betreff} onChange={(ev) => setBetreff(ev.target.value)} maxLength={120} /></label>
              <label title="Anrede, Gruß, QR-Code, Widerspruch und Datenschutzhinweis setzt der Brief selbst."><span>Text — Leerzeile = neuer Absatz, letzter Absatz = Schlussfrage</span>
                <textarea className="cr-feld" value={koerper} onChange={(ev) => setKoerper(ev.target.value)} rows={14} />
              </label>
              <div className="cr-fenster-zeile">
                <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => tun("speichern", () => rufen(`/chef/radar/firma/${id}/brief`, "PUT", { betreff, koerper }), "Gespeichert — die Vorschau ist neu gedruckt.", () => setBearbeiten(false))}>Speichern</button>
                <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(false)}>Abbrechen</button>
              </div>
            </div>
          )}

          {!unterwegs && !gesperrt && (
            <div className="cr-ausgabe">
              <div className="cr-brief-versand">
                <span>Versand</span>
                <b>{anbieterName}{e?.testmodus ? " · Testmodus" : ""}{e ? ` · ${e.farbe ? "Farbe" : "Graustufen"}` : ""}</b>
                <small>etwa {eur(daten.kosten.cents)} netto{daten.kosten.geschaetzt ? " (geschätzt)" : ""} · heute {zahl(heute)} von {e?.jeTag ?? 0} {e?.testmodus ? "Testbriefen" : "Briefen"}</small>
              </div>
              <div className="cr-fenster-zeile">
                <button type="button" className="cr-knopf warm" disabled={!!arbeit || !!sperre} title={sperre ?? ""} onClick={() => setFrage(true)}>{e?.testmodus ? "Testbrief übergeben …" : "Brief senden …"}</button>
                {sperre && <span className="cr-klein">{sperre}</span>}
              </div>
              {frage && !sperre && (
                <div className="cr-senden-frage">
                  <b>{e?.testmodus ? `Testbrief an ${anbieterName} übergeben?` : `Brief an ${daten.empfaenger.person ?? "die Geschäftsführung"} über ${anbieterName} senden?`}</b>
                  <p className="cr-recht">{e?.testmodus ? RADAR_BRIEF_ANBIETER[e.anbieter].test : `Wird gedruckt und verschickt (ca. ${eur(daten.kosten.cents)} netto). Nur ein Brief je Firma, danach nicht änderbar.`}</p>
                  <div className="cr-fenster-zeile">
                    <button type="button" className="cr-knopf warm" disabled={!!arbeit}
                            onClick={() => tun("senden", () => rufen(`/chef/radar/firma/${id}/brief/senden`, "POST", { bestaetigt: true }), e?.testmodus ? `Testbrief an ${anbieterName} übergeben — dort ansehen, ob die Anschrift im Fenster sitzt.` : `Brief an ${anbieterName} übergeben.`, () => setFrage(false))}>
                      {arbeit === "senden" ? "Übergibt …" : e?.testmodus ? "Testbrief übergeben" : "Jetzt senden"}
                    </button>
                    <button type="button" className="cr-knopf hell" onClick={() => setFrage(false)}>Abbrechen</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BriefKachel() {
  const u = useDaten<BriefUebersicht>(`/chef/radar/brief`, []);
  const [jeTag, setJeTag] = useState("");
  const [arbeit, setArbeit] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const e = u.daten?.einstellung;
  useEffect(() => { if (e) setJeTag(String(e.jeTag)); }, [e?.jeTag]); // eslint-disable-line react-hooks/exhaustive-deps
  const setzen = async (name: string, teil: Record<string, unknown>, gut: string) => {
    setArbeit(name); setMeldung(null);
    try { await rufen("/chef/radar/brief/einstellung", "POST", teil); u.neu(); setMeldung({ art: "gut", text: gut }); }
    catch (err: any) { setMeldung({ art: "fehler", text: err.message }); }
    finally { setArbeit(null); }
  };
  const runde = async () => {
    setArbeit("runde"); setMeldung(null);
    try {
      const j = await rufen<{ ergebnis: { briefe: number; test: number; uebersprungen: number; grund?: string } }>("/chef/radar/brief-lauf", "POST");
      u.neu();
      const r = j.ergebnis;
      setMeldung({ art: "gut", text: r.grund && !r.briefe && !r.test ? `Keine Runde: ${r.grund}.` : `Runde fertig: ${r.briefe} Briefe, ${r.test} Testbriefe, ${r.uebersprungen} übersprungen.` });
    } catch (err: any) { setMeldung({ art: "fehler", text: err.message }); }
    finally { setArbeit(null); }
  };
  if (!u.daten || !e) return <article className="cr-kachel breit"><Geruest zeilen={3} /></article>;
  const bereit = u.daten.bereit[e.anbieter];
  return (
    <article className="cr-kachel breit cr-brief-kachel">
      <header><b>Briefe an Geschäftsführer</b><Kippe an={e.versand} aus={!!arbeit} onKlick={() => setzen("versand", { versand: !e.versand }, e.versand ? "Briefversand aus." : "Briefversand an.")} /></header>
      <p title="Name und Anschrift aus dem Impressum; QR-Code zum Gesprächstermin, Widerspruch und Datenschutzhinweis auf jedem Brief.">Für Firmen mit Signal ab {RADAR_SIGNAL_AB} ohne persönliche Adresse. Werktags im Kontingent; von Hand in der Akte unter „Brief“.</p>
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      <div className="cr-brief-schalter">
        <div className="cr-segment" role="radiogroup" aria-label="Versanddienst">
          {(Object.keys(RADAR_BRIEF_ANBIETER) as RadarBriefAnbieter[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={e.anbieter === k} className={e.anbieter === k ? "an" : undefined} disabled={!!arbeit}
                    onClick={() => setzen("anbieter", { anbieter: k }, `${RADAR_BRIEF_ANBIETER[k].label} gewählt.`)}>{RADAR_BRIEF_ANBIETER[k].label}</button>
          ))}
        </div>
        <label className="cr-brief-kippe"><Kippe an={e.testmodus} aus={!!arbeit} onKlick={() => setzen("test", { testmodus: !e.testmodus }, e.testmodus ? "Testmodus aus — Briefe werden gedruckt und verschickt." : "Testmodus an — nichts wird gedruckt.")} /><span>Testmodus</span></label>
        <label className="cr-brief-kippe"><Kippe an={e.farbe} aus={!!arbeit} onKlick={() => setzen("farbe", { farbe: !e.farbe }, e.farbe ? "Graustufen." : "Farbdruck (Glasblau).")} /><span>Farbe</span></label>
      </div>
      <div className="cr-kachel-feld">
        <label><span>Briefe je Werktag</span><input className="cr-feld" type="number" min={0} max={u.daten.hoechstens} value={jeTag} onChange={(ev) => setJeTag(ev.target.value)} /></label>
        <button type="button" className="cr-knopf hell" disabled={!!arbeit} onClick={() => setzen("jeTag", { jeTag: Number(jeTag) }, "Gespeichert.")}>Speichern</button>
        <button type="button" className="cr-knopf hell" disabled={!!arbeit || !e.versand} title={e.versand ? "" : "Erst den Briefversand einschalten"} onClick={() => void runde()}>{arbeit === "runde" ? "Mara schreibt …" : "Jetzt eine Brief-Runde"}</button>
      </div>
      <dl className="cr-mara-werte cr-brief-werte">
        <div><dt>Heute</dt><dd>{zahl(u.daten.heute.briefe)} {u.daten.heute.briefe === 1 ? "Brief" : "Briefe"}</dd></div>
        <div><dt>Porto heute</dt><dd>{eur(u.daten.heute.kostenCents)}</dd></div>
        <div><dt>Testbriefe heute</dt><dd>{zahl(u.daten.heute.test)}</dd></div>
        <div><dt>Je Brief etwa</dt><dd>{eur(RADAR_BRIEF_ANBIETER[e.anbieter].preisCents.DE)} (DE)</dd></div>
      </dl>
      <p className={`cr-hinweis ${bereit.ok ? "gut" : "warn"}`}>
        {bereit.ok
          ? `${RADAR_BRIEF_ANBIETER[e.anbieter].label} ist eingerichtet. ${e.testmodus ? RADAR_BRIEF_ANBIETER[e.anbieter].test : "Echte Briefe: gedruckt und verschickt."}`
          : `${RADAR_BRIEF_ANBIETER[e.anbieter].label} nicht eingerichtet — fehlt in Render: ${bereit.fehlt.join(", ")}. Vorschau geht trotzdem.`}
      </p>
    </article>
  );
}
