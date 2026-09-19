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
import { API, datum, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { RADAR_BEREICHE, RADAR_GRUPPEN, RADAR_STATUS, RADAR_STAPEL_MAX, RADAR_ZIELBILD, radarBereich, type RadarStatus } from "@shared/fiaon-radar";
import { GLOBAL_PAKETE } from "@shared/fiaon-global";
import "@/styles/office-rundgang.css";
import "@/styles/chef-radar.css";

type Grund = { text: string; url: string };
type Zeile = {
  id: number; tag: string; quelle: string; bereich: string; land: string | null; name: string; domain: string; website: string;
  ort: string | null; kurz: string | null; passung: number | null; gruende: Grund[]; signale: string[]; email: string | null;
  ansprechpartner: string | null; status: RadarStatus; gescannt_am: string | null; mail_am: string | null; versendet_am: string | null;
  postfach: string | null; hat_scan: boolean; hat_mail: boolean; created_at: string;
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
  zahlen: { heute: number; heute_tageslauf: number; gesamt: number; versendet: number; antworten: number; offen: number };
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
  const [gruppe, setGruppe] = useState("");
  const [bereichFilter, setBereichFilter] = useState("");
  const [nurHeute, setNurHeute] = useState(false);
  const [suche, setSuche] = useState("");
  const [auswahl, setAuswahl] = useState<number[]>([]);
  const [offen, setOffen] = useState<number | null>(null);
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [suchen, setSuchen] = useState(false);
  const [website, setWebsite] = useState(false);
  const [sendenFrage, setSendenFrage] = useState(false);
  const [verantwortet, setVerantwortet] = useState(false);
  const [postfach, setPostfach] = useState("");
  const [wegZu, setWegZu] = useState(() => { try { return localStorage.getItem("fiaon_radar_weg") === "zu"; } catch { return false; } });

  const [heute] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (nurHeute) p.set("tag", heute);
    if (gruppe) p.set("gruppe", gruppe);
    if (bereichFilter) p.set("bereich", bereichFilter);
    if (suche.trim().length >= 2) p.set("suche", suche.trim());
    return p.toString();
  }, [gruppe, bereichFilter, nurHeute, suche, heute]);
  const { daten, laedt, fehler, neu } = useDaten<Uebersicht>(`/chef/radar?${qs}`, [qs]);

  useEffect(() => { if (!postfach && daten?.postfaecher?.length) setPostfach(daten.postfaecher[0]); }, [daten, postfach]);

  // Ein laufender Lauf (Suche oder Stapel) wird alle drei Sekunden nachgefragt.
  const laufId = lauf?.id ?? null;
  const laeuft = lauf?.status === "laeuft";
  useEffect(() => {
    if (!laufId || !laeuft) return;
    const uhr = window.setInterval(async () => {
      try {
        const j = await rufen<{ lauf: Lauf }>(`/chef/radar/lauf/${laufId}`, "GET");
        setLauf(j.lauf);
        neu();
      } catch { /* beim nächsten Mal */ }
    }, 3000);
    return () => window.clearInterval(uhr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laufId, laeuft]);

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
    <div className="cr">
      <Rundgang raum="firmen-radar" titel="Firmen-Radar" schritte={RUNDGAENGE.firmenRadar.schritte} />

      {/* ── Kopf ─────────────────────────────────────────────────────────── */}
      <header className="cr-kopf">
        <div className="cr-kopf-text">
          <h1>Firmen-Radar</h1>
          <p>Findet passende Firmen, liest ihre Website und schreibt jeder eine eigene, persönliche Mail.</p>
        </div>
        <div className="cr-kopf-zahlen">
          <div><b>{z?.heute ?? 0}<small> / {daten?.tagesziel ?? 50}</small></b><span>heute gefunden</span><Balken wert={z?.heute ?? 0} ziel={daten?.tagesziel ?? 50} /></div>
          <div><b>{gezaehlt(["mail", "im_postfach"])}</b><span>Mails bereit</span></div>
          <div><b>{z?.versendet ?? 0}</b><span>versendet</span></div>
          <div><b>{z?.antworten ?? 0}</b><span>Antworten</span></div>
          <div><b>{(daten?.kostenHeute ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b><span>KI heute · Deckel {daten?.deckel ?? 25} €</span></div>
        </div>
        <div className="cr-kopf-tun">
          <button type="button" className="cr-knopf hell" onClick={() => setWebsite(true)}>Website aufnehmen</button>
          <button type="button" className="cr-knopf" onClick={() => setSuchen(true)}>Firmen suchen</button>
        </div>
      </header>

      {!wegZu && (
        <p className="cr-weg">
          <b>So geht’s:</b> <span>1 · Firmen finden</span> <i aria-hidden="true">→</i> <span>2 · anhaken</span> <i aria-hidden="true">→</i> <span>3 · „Mails vorbereiten“</span> <i aria-hidden="true">→</i> <span>4 · lesen, dann senden</span>
          <button type="button" className="cr-textknopf" onClick={() => { setWegZu(true); try { localStorage.setItem("fiaon_radar_weg", "zu"); } catch { /* egal */ } }}>verstanden</button>
        </p>
      )}
      {daten && (!daten.ki || !daten.gmail) && (
        <p className="cr-hinweis warn">
          {!daten.ki && "Ohne OpenAI-Schlüssel sucht und schreibt der Radar nicht. "}
          {!daten.gmail && "Ohne Gmail-Anbindung gehen weder Entwürfe noch Mails hinaus."}
        </p>
      )}
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}
      {lauf && <LaufBanner lauf={lauf} onZu={() => setLauf(null)} onAbbrechen={() => { void rufen(`/chef/radar/lauf/${lauf.id}/abbrechen`).catch(() => {}); }} />}

      {/* ── Reiter und Filter ────────────────────────────────────────────── */}
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

      {/* ── Tabelle ──────────────────────────────────────────────────────── */}
      {fehler && <Fehlermeldung text={fehler} erneut={neu} />}
      {laedt && !daten && <Geruest zeilen={8} />}
      {daten && !firmen.length && (
        <div className="cr-leer">
          <b>Hier ist gerade nichts.</b>
          <span>Der Tageslauf sucht stündlich zwischen 6 und 20 Uhr, bis {daten.tagesziel} Firmen im Radar stehen. Oder oben „Firmen suchen“.</span>
        </div>
      )}
      {!!firmen.length && (
        <div className="cr-tabelle-rahmen">
          <table className="cr-tabelle">
            <thead>
              <tr>
                <th className="cr-haken-spalte">
                  <input type="checkbox" checked={alleGewaehlt} aria-label="Alle auswählen"
                         onChange={(e) => setAuswahl(e.target.checked ? firmen.slice(0, max).map((f) => f.id) : [])} />
                </th>
                <th>Passung</th><th>Firma</th><th>Bereich</th><th>Ort</th><th>Kontakt</th><th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {firmen.map((f) => (
                <tr key={f.id} className={`${auswahl.includes(f.id) ? "gewaehlt " : ""}${offen === f.id ? "offen" : ""}`} onClick={() => setOffen(f.id)}>
                  <td className="cr-haken-spalte" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={auswahl.includes(f.id)} aria-label={`${f.name} auswählen`}
                           onChange={(e) => setAuswahl((a) => (e.target.checked ? [...a, f.id] : a.filter((x) => x !== f.id)))} />
                  </td>
                  <td><Passung wert={f.passung} /></td>
                  <td className="cr-firma"><b>{f.name}</b><span>{f.kurz || f.domain}</span></td>
                  <td className="cr-leise-spalte">{radarBereich(f.bereich)?.label ?? f.bereich}</td>
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

      {/* ── Stapel ───────────────────────────────────────────────────────── */}
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
            <button type="button" className="cr-knopf warm" disabled={laeuft || !postfach} onClick={() => { setVerantwortet(false); setSendenFrage(true); }}>Senden …</button>
            <button type="button" className="cr-textknopf" onClick={() => setAuswahl([])}>Auswahl aufheben</button>
          </div>
        </div>
      )}

      {/* ── Fenster ──────────────────────────────────────────────────────── */}
      {suchen && <SuchFenster onZu={() => setSuchen(false)} onLauf={(l) => { setLauf(l); setSuchen(false); setGruppe(""); }} />}
      {website && <WebsiteFenster onZu={() => setWebsite(false)} onFertig={(id) => { setWebsite(false); neu(); setOffen(id); }} />}
      {sendenFrage && (
        <Fenster titel={`${Math.min(auswahl.length, max)} Mails senden?`} onZu={() => setSendenFrage(false)}>
          <p>Aus <b>{postfach}</b>. Zwischen zwei Mails liegen 20 bis 45 Sekunden. Jede Mail ist einzeln geschrieben; Firmen ohne Adresse und Mails mit Regelverstoß werden übersprungen.</p>
          <p className="cr-recht">Werbe-Mails an Firmen brauchen in Deutschland, Österreich und der Schweiz eine vorherige Einwilligung — auch einzeln und persönlich (DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG). Ohne Einwilligung drohen Abmahnungen.</p>
          <label className="cr-haken-zeile"><input type="checkbox" checked={verantwortet} onChange={(e) => setVerantwortet(e.target.checked)} /> Ich habe die Mails gelesen und verantworte den Versand.</label>
          <div className="cr-fenster-tun">
            <button type="button" className="cr-knopf warm" disabled={!verantwortet} onClick={() => void stapel("senden", true)}>Jetzt senden</button>
            <button type="button" className="cr-knopf hell" onClick={() => setSendenFrage(false)}>Abbrechen</button>
          </div>
        </Fenster>
      )}
      {offen && <Akte key={offen} id={offen} uebersicht={daten} postfach={postfach} onPostfach={setPostfach} onZu={() => setOffen(null)} onGeaendert={neu} />}
    </div>
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
  const [land, setLand] = useState("");
  const [stichwort, setStichwort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const starten = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const j = await rufen<{ laufId: number }>("/chef/radar/suchen", "POST", { bereich, land: land || null, stichwort: stichwort.trim() || null, anzahl: 10 });
      onLauf({ id: j.laufId, art: "suche", bereich, land: land || null, status: "laeuft", vorgeschlagen: 0, neu: 0, gesamt: 0, fertig: 0, aktuell: null, ergebnisse: [], verworfen: [], fehler: null, created_at: new Date().toISOString(), fertig_am: null });
    } catch (e: any) { setFehler(e.message); setLaeuft(false); }
  };
  return (
    <Fenster titel="Firmen suchen" onZu={onZu}>
      <p className="cr-klein">Die KI sucht im Netz, der Server prüft jede Firma: erreichbare Website, Firmenname auf der Seite, E-Mail aus dem Impressum oder wörtlich von der Website. Ohne Adresse kommt sie nicht in den Radar.</p>
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
  const [reiter, setReiter] = useState<"ueberblick" | "scan" | "mail">("ueberblick");
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
      if (zuerst.current) { zuerst.current = false; if (j.firma.mail) setReiter("mail"); else if (j.firma.scan) setReiter("scan"); }
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
  const schritt = raus ? 4 : mail ? 3 : scan ? 2 : 1;

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
              {["Gefunden", "Gescannt", "Mail bereit", "Versendet"].map((t, i) => (
                <li key={t} className={schritt > i + 1 ? "da" : schritt === i + 1 ? "jetzt" : undefined}>{t}</li>
              ))}
            </ol>

            <nav className="cr-blatt-reiter" role="tablist">
              {([["ueberblick", "Überblick"], ["scan", "Website-Scan"], ["mail", "Mail"]] as const).map(([k, l]) => (
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

                      {!raus && !zu && (
                        <div className="cr-ausgabe">
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
                      {raus && <p className="cr-hinweis gut">Versendet {f.versendet_am ? datum(f.versendet_am) : ""}{f.postfach ? ` aus ${f.postfach}` : ""} — je Firma geht genau eine erste Mail.</p>}
                    </>
                  )}
                </>
              )}
            </div>

            <footer className="cr-blatt-fuss">
              {f.status === "im_postfach" && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "versendet" }), "Als versendet vermerkt.")}>Im Postfach gesendet</button>}
              {raus && f.status !== "antwort" && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "antwort" }), "Antwort vermerkt.")}>Antwort erhalten</button>}
              {!zu && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "kein_interesse" }), "Vermerkt — kommt auf die Sperrliste.")}>Kein Interesse</button>}
              {!zu && <button type="button" className="cr-textknopf rot" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "gesperrt" }), "Gesperrt.")}>Sperren</button>}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
