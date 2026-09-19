// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · FIRMEN-RADAR (19.09.2026)
//
// Justin: „Baue alles fix fertig für den Radar (aber nicht bei Nikita, Admin!),
// der uns PERFEKTE Firmen sucht (jeden Tag 50) bzw. auf Knopfdruck: Bereich
// wählen, Firma wählen, dann scannt die KI das gesamte Unternehmen und schreibt
// eine super personalisierte E-Mail — 100 % angepasst, 100 % menschlich."
//
// Oben das Instrument (Tagesziel als Ring, Versand, Antworten, KI-Kosten), die
// Suche mit den zehn Bereichen und das Feld für eine Website von Hand. Darunter
// links die Firmen, rechts die Akte: Warum die Firma passt (mit Quelle), der
// Scan mit wörtlich belegten Aufhängern, die Mail als Vorschau, zum Ändern und
// zum Ausgeben — als Entwurf ins Postfach oder, nach Bestätigung, direkt.
// Die Arbeit macht der Server (server/lib/fiaon-radar.ts); hier wird nichts
// erfunden und nichts ohne Klick verschickt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { API, datum, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { RADAR_BEREICHE, RADAR_STATUS, RADAR_ZIELBILD, radarBereich, type RadarStatus } from "@shared/fiaon-radar";
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
type Lauf = { id: number; art: string; bereich: string | null; land: string | null; status: "laeuft" | "fertig" | "fehler"; vorgeschlagen: number; neu: number; verworfen: { name: string; website: string; grund: string }[]; fehler: string | null; created_at: string; fertig_am: string | null };
type Uebersicht = {
  firmen: Zeile[]; heute: string; tagesziel: number; kostenHeute: number; deckel: number; postfaecher: string[];
  absender: { name: string; rolle: string; telefon: string }; gmail: boolean; ki: boolean;
  zahlen: { heute: number; heute_tageslauf: number; gesamt: number; versendet: number; antworten: number; offen: number };
  laeufe: Lauf[];
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

function Ring({ wert, ziel }: { wert: number; ziel: number }) {
  const r = 30, u = 2 * Math.PI * r, anteil = Math.max(0, Math.min(1, ziel ? wert / ziel : 0));
  return (
    <svg className="cr-ring" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r={r} className="grund" />
      <circle cx="38" cy="38" r={r} className="wert" style={{ strokeDasharray: u, strokeDashoffset: u * (1 - anteil) }} />
    </svg>
  );
}

function Passung({ wert }: { wert: number | null }) {
  if (wert == null) return <span className="cr-passung leer">—</span>;
  return <span className={`cr-passung${wert >= 80 ? " hoch" : wert >= 60 ? " mittel" : ""}`} title="Wie gut die Firma ins Zielbild passt (Einschätzung der KI)">{wert}</span>;
}

function Stand({ s }: { s: RadarStatus }) {
  const d = RADAR_STATUS[s] ?? { label: s, ton: "neu" };
  return <span className={`cr-stand ${d.ton}`}>{d.label}</span>;
}

export default function ChefRadar() {
  const [zeitraum, setZeitraum] = useState<"heute" | "alle">("heute");
  const [bereichFilter, setBereichFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);

  const [sucheOffen, setSucheOffen] = useState(false);
  const [suchBereich, setSuchBereich] = useState(RADAR_BEREICHE[0].key);
  const [suchLand, setSuchLand] = useState<string>("");
  const [stichwort, setStichwort] = useState("");
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [laufFehler, setLaufFehler] = useState<string | null>(null);
  const [laufStart, setLaufStart] = useState<number>(0);
  const [jetzt, setJetzt] = useState(Date.now());
  const [website, setWebsite] = useState("");
  const [manuellFehler, setManuellFehler] = useState<string | null>(null);
  const [manuellLaeuft, setManuellLaeuft] = useState(false);

  const [heute] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (zeitraum === "heute") p.set("tag", heute);
    if (bereichFilter) p.set("bereich", bereichFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (suche.trim().length >= 2) p.set("suche", suche.trim());
    return p.toString();
  }, [zeitraum, bereichFilter, statusFilter, suche, heute]);
  const { daten, laedt, fehler, neu } = useDaten<Uebersicht>(`/chef/radar?${qs}`, [qs]);

  // Die Suche läuft im Hintergrund — alle drei Sekunden nachsehen.
  const laufRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lauf || lauf.status !== "laeuft") return;
    laufRef.current = lauf.id;
    const uhr = window.setInterval(async () => {
      setJetzt(Date.now());
      try {
        const j = await rufen<{ lauf: Lauf }>(`/chef/radar/lauf/${lauf.id}`, "GET");
        if (laufRef.current !== lauf.id) return;
        if (j.lauf.status !== "laeuft") { setLauf(j.lauf); neu(); }
      } catch { /* nächster Versuch in drei Sekunden */ }
    }, 3000);
    return () => window.clearInterval(uhr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lauf?.id, lauf?.status]);

  const sucheStarten = async () => {
    setLaufFehler(null);
    try {
      const j = await rufen<{ laufId: number }>("/chef/radar/suchen", "POST", { bereich: suchBereich, land: suchLand || null, stichwort: stichwort.trim() || null, anzahl: 10 });
      setLaufStart(Date.now()); setJetzt(Date.now());
      setLauf({ id: j.laufId, art: "suche", bereich: suchBereich, land: suchLand || null, status: "laeuft", vorgeschlagen: 0, neu: 0, verworfen: [], fehler: null, created_at: new Date().toISOString(), fertig_am: null });
      setZeitraum("heute"); setBereichFilter(""); setStatusFilter("");
    } catch (e: any) { setLaufFehler(e.message); }
  };

  const manuell = async () => {
    setManuellFehler(null); setManuellLaeuft(true);
    try {
      const j = await rufen<{ id: number }>("/chef/radar/manuell", "POST", { website, bereich: suchBereich });
      setWebsite(""); setZeitraum("alle"); neu(); setGewaehlt(j.id);
    } catch (e: any) { setManuellFehler(e.message); }
    finally { setManuellLaeuft(false); }
  };

  const z = daten?.zahlen;
  const firmen = daten?.firmen ?? [];
  const sekunden = lauf && lauf.status === "laeuft" ? Math.max(0, Math.round((jetzt - laufStart) / 1000)) : 0;

  return (
    <div className="cr">
      <Rundgang raum="firmen-radar" titel="Firmen-Radar" schritte={RUNDGAENGE.firmenRadar.schritte} />

      {/* ── Das Instrument ─────────────────────────────────────────────── */}
      <section className="cr-kopf">
        <div className="cr-kopf-ziel">
          <Ring wert={z?.heute ?? 0} ziel={daten?.tagesziel ?? 50} />
          <div>
            <span className="cr-auge">Heute gefunden</span>
            <b>{z?.heute ?? 0}<small> / {daten?.tagesziel ?? 50}</small></b>
            <span className="cr-klein">{z?.heute_tageslauf ?? 0} vom Tageslauf · {Math.max(0, (z?.heute ?? 0) - (z?.heute_tageslauf ?? 0))} von Hand</span>
          </div>
        </div>
        <div className="cr-kopf-zahlen">
          <div><b>{z?.offen ?? 0}</b><span>Mails bereit</span></div>
          <div><b>{z?.versendet ?? 0}</b><span>versendet</span></div>
          <div><b>{z?.antworten ?? 0}</b><span>Antworten</span></div>
          <div><b>{(daten?.kostenHeute ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b><span>KI heute · Deckel {daten?.deckel ?? 25} €</span></div>
        </div>
        <div className="cr-kopf-tun">
          <button type="button" className="cr-knopf hell" onClick={() => setSucheOffen(!sucheOffen)} aria-expanded={sucheOffen}>
            {sucheOffen ? "Suche schließen" : "Firmen suchen"}
          </button>
        </div>
        {daten && (!daten.ki || !daten.gmail) && (
          <p className="cr-hinweis warn">
            {!daten.ki && "Ohne OpenAI-Schlüssel (OPENAI_API_KEY) sucht und schreibt der Radar nicht. "}
            {!daten.gmail && "Ohne Gmail-Anbindung (GOOGLE_SA_KEY) gehen weder Entwürfe noch Mails hinaus."}
          </p>
        )}
      </section>

      {/* ── Suchen: Bereich wählen, dann Knopf ─────────────────────────── */}
      {sucheOffen && (
        <section className="cr-such">
          <div className="cr-such-kopf">
            <b>In welchem Bereich soll der Radar suchen?</b>
            <span className="cr-klein">Die KI sucht im Netz, der Server prüft jede Firma: echte Website, Name auf der Seite, lesbares Impressum.</span>
          </div>
          <div className="cr-bereiche" role="radiogroup" aria-label="Bereich">
            {RADAR_BEREICHE.map((b) => (
              <button key={b.key} type="button" role="radio" aria-checked={suchBereich === b.key} className={suchBereich === b.key ? "an" : undefined} onClick={() => setSuchBereich(b.key)} title={b.satz}>
                <b>{b.label}</b><span>{b.satz}</span>
              </button>
            ))}
          </div>
          <div className="cr-such-zeile">
            <div className="cr-segment" role="radiogroup" aria-label="Land">
              {[["", "Alle"], ["DE", "DE"], ["AT", "AT"], ["CH", "CH"]].map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={suchLand === k} className={suchLand === k ? "an" : undefined} onClick={() => setSuchLand(k)}>{l}</button>
              ))}
            </div>
            <input className="cr-feld" value={stichwort} onChange={(e) => setStichwort(e.target.value)} placeholder="Stichwort (optional), z. B. Messe in Las Vegas, Kosmetik, München" maxLength={120} />
            <button type="button" className="cr-knopf" onClick={sucheStarten} disabled={lauf?.status === "laeuft"}>
              {lauf?.status === "laeuft" ? "Suche läuft …" : "10 Firmen suchen"}
            </button>
          </div>
          {laufFehler && <p className="cr-hinweis fehler">{laufFehler}</p>}
          {lauf && (
            <div className={`cr-lauf ${lauf.status}`} aria-live="polite">
              {lauf.status === "laeuft" && (<><span className="cr-lauf-balken" aria-hidden="true" /><span>Die KI recherchiert in „{radarBereich(lauf.bereich)?.label}“ und der Server prüft jede Website … {sekunden} s</span></>)}
              {lauf.status === "fertig" && (
                <details>
                  <summary><b>{lauf.neu} neue Firmen</b> im Radar · {lauf.vorgeschlagen} vorgeschlagen · {lauf.verworfen.length} verworfen</summary>
                  <ul>{lauf.verworfen.map((v, i) => <li key={i}><b>{v.name}</b> ({v.website}) — {v.grund}</li>)}</ul>
                </details>
              )}
              {lauf.status === "fehler" && <span>Die Suche ist abgebrochen: {lauf.fehler}</span>}
            </div>
          )}
          <div className="cr-such-zeile">
            <input className="cr-feld" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Oder eine bestimmte Firma: Website eintragen (firma.de)" maxLength={200}
                   onKeyDown={(e) => { if (e.key === "Enter" && website.trim()) void manuell(); }} />
            <button type="button" className="cr-knopf hell" onClick={manuell} disabled={!website.trim() || manuellLaeuft}>{manuellLaeuft ? "Prüft …" : "Firma aufnehmen"}</button>
          </div>
          {manuellFehler && <p className="cr-hinweis fehler">{manuellFehler}</p>}
          <details className="cr-zielbild">
            <summary>Wonach der Radar sucht</summary>
            <ul>{RADAR_ZIELBILD.muss.map((x) => <li key={x}>✓ {x}</li>)}{RADAR_ZIELBILD.nie.map((x) => <li key={x} className="nie">✕ {x}</li>)}</ul>
          </details>
        </section>
      )}

      {/* ── Arbeitsfläche ─────────────────────────────────────────────── */}
      <div className="cr-arbeit">
        <section className="cr-liste" aria-label="Firmen">
          <div className="cr-filter">
            <div className="cr-segment" role="radiogroup" aria-label="Zeitraum">
              <button type="button" role="radio" aria-checked={zeitraum === "heute"} className={zeitraum === "heute" ? "an" : undefined} onClick={() => setZeitraum("heute")}>Heute</button>
              <button type="button" role="radio" aria-checked={zeitraum === "alle"} className={zeitraum === "alle" ? "an" : undefined} onClick={() => setZeitraum("alle")}>Alle</button>
            </div>
            <select className="cr-feld" value={bereichFilter} onChange={(e) => setBereichFilter(e.target.value)} aria-label="Bereich">
              <option value="">Alle Bereiche</option>
              {RADAR_BEREICHE.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
            <select className="cr-feld" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Stand">
              <option value="">Jeder Stand</option>
              {(Object.keys(RADAR_STATUS) as RadarStatus[]).map((s) => <option key={s} value={s}>{RADAR_STATUS[s].label}</option>)}
            </select>
            <input className="cr-feld" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, Domäne, Ort" aria-label="Suche" />
          </div>
          {fehler && <Fehlermeldung text={fehler} erneut={neu} />}
          {laedt && !daten && <Geruest zeilen={8} />}
          {daten && !firmen.length && (
            <div className="cr-leer">
              <b>{zeitraum === "heute" ? "Heute noch keine Firmen." : "Keine Firma passt zu diesem Filter."}</b>
              <span>Der Tageslauf sucht stündlich zwischen 6 und 20 Uhr, bis {daten.tagesziel} Firmen im Radar stehen. Oder oben „Firmen suchen“.</span>
            </div>
          )}
          <ol className="cr-zeilen">
            {firmen.map((f) => (
              <li key={f.id}>
                <button type="button" className={`cr-zeile${gewaehlt === f.id ? " an" : ""}`} onClick={() => setGewaehlt(f.id)} aria-current={gewaehlt === f.id ? "true" : undefined}>
                  <Passung wert={f.passung} />
                  <span className="cr-zeile-rumpf">
                    <b>{f.name}</b>
                    <span className="cr-zeile-kurz">{f.kurz || f.domain}</span>
                    <span className="cr-zeile-fuss">
                      <span className="cr-chip">{radarBereich(f.bereich)?.label ?? f.bereich}</span>
                      <span>{[f.ort, f.land].filter(Boolean).join(", ")}</span>
                      {!f.email && <span className="cr-ohne">ohne E-Mail</span>}
                    </span>
                  </span>
                  <Stand s={f.status} />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="cr-akte-rahmen" aria-label="Akte">
          {gewaehlt ? <Akte key={gewaehlt} id={gewaehlt} uebersicht={daten} onGeaendert={neu} /> : (
            <div className="cr-leer gross">
              <b>Eine Firma links wählen.</b>
              <span>Dann: scannen (die KI liest die ganze Website), Mail schreiben lassen, prüfen, ändern — und als Entwurf ins Postfach oder direkt senden.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Die Akte einer Firma ──────────────────────────────────────────────────────
function Akte({ id, uebersicht, onGeaendert }: { id: number; uebersicht: Uebersicht | null; onGeaendert: () => void }) {
  const [f, setF] = useState<Voll | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeit, setArbeit] = useState<null | "scan" | "mail" | "speichern" | "entwurf" | "senden" | "status">(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [hinweis, setHinweis] = useState("");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [betreff, setBetreff] = useState("");
  const [koerper, setKoerper] = useState("");
  const [ps, setPs] = useState("");
  const [postfach, setPostfach] = useState("");
  const [an, setAn] = useState("");
  const [sendenFrage, setSendenFrage] = useState(false);
  const [verantwortet, setVerantwortet] = useState(false);

  const laden = async () => {
    try {
      const j = await rufen<{ firma: Voll }>(`/chef/radar/firma/${id}`, "GET");
      setF(j.firma); setFehler(null);
      setAn(j.firma.email ?? "");
      if (j.firma.mail) { setBetreff(j.firma.mail.betreff); setKoerper([...j.firma.mail.absaetze, j.firma.mail.frage].join("\n\n")); setPs(j.firma.mail.ps ?? ""); }
    } catch (e: any) { setFehler(e.message); }
  };
  useEffect(() => { void laden(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (!postfach && uebersicht?.postfaecher?.length) setPostfach(uebersicht.postfaecher[0]); }, [uebersicht, postfach]);

  const tun = async (art: NonNullable<typeof arbeit>, fn: () => Promise<unknown>, gut: string) => {
    setArbeit(art); setMeldung(null);
    try { await fn(); await laden(); onGeaendert(); setMeldung({ art: "gut", text: gut }); }
    catch (e: any) { setMeldung({ art: "fehler", text: e.message }); }
    finally { setArbeit(null); }
  };

  if (fehler) return <Fehlermeldung text={fehler} erneut={laden} />;
  if (!f) return <Geruest zeilen={10} />;
  const b = radarBereich(f.bereich);
  const imp = f.impressum ?? {};
  const scan = f.scan;
  const mail = f.mail;
  const zu = f.status === "gesperrt" || f.status === "kein_interesse";
  const schonRaus = f.status === "versendet" || !!f.versendet_am;

  return (
    <div className="cr-akte">
      <header className="cr-akte-kopf">
        <div>
          <span className="cr-auge">{b?.label ?? f.bereich} · {LAND[f.land ?? ""] ?? f.land ?? "?"}{f.ort ? ` · ${f.ort}` : ""} · gefunden {datum(f.created_at)}</span>
          <h2>{f.name}</h2>
          <a href={f.website} target="_blank" rel="noopener noreferrer" className="cr-link">{f.domain} ↗</a>
        </div>
        <div className="cr-akte-kopf-rechts"><Passung wert={f.passung} /><Stand s={f.status} /></div>
      </header>

      <div className="cr-kontakt">
        <div><span>Ansprechpartner</span><b>{f.ansprechpartner || "— (nicht im Impressum)"}</b></div>
        <div><span>E-Mail</span><b>{f.email || "—"}</b></div>
        <div><span>Telefon</span><b>{imp.telefon || "—"}</b></div>
        <div><span>Register</span><b>{[imp.registergericht, imp.registernummer].filter(Boolean).join(" ") || "—"}</b></div>
      </div>
      {imp.quelle === "website" && <p className="cr-klein">Das Impressum ließ sich nicht lesen — die E-Mail steht wörtlich auf {imp.seite}.</p>}
      {imp.quelle !== "website" && imp.seite && <p className="cr-klein">Aus dem Impressum ({imp.seite}) — jeder Wert steht dort wörtlich.{imp.emailSeite ? ` Die E-Mail stand nicht im Impressum, sondern auf ${imp.emailSeite}.` : ""}</p>}

      {!!f.gruende?.length && (
        <div className="cr-block">
          <h3>Warum sie passt <small>(Einschätzung der KI mit Quelle)</small></h3>
          <ul className="cr-gruende">{f.gruende.map((g, i) => <li key={i}>{g.text}{g.url && <> — <a href={g.url} target="_blank" rel="noopener noreferrer" className="cr-link">Quelle ↗</a></>}</li>)}</ul>
          {!!f.signale?.length && <div className="cr-signale">{f.signale.map((s) => <span key={s} className="cr-chip">{s}</span>)}</div>}
        </div>
      )}

      {/* ── Die Schritte ── */}
      <div className="cr-schritte">
        <button type="button" className={`cr-knopf${scan ? " hell" : ""}`} disabled={!!arbeit || zu} onClick={() => tun("scan", () => rufen(`/chef/radar/firma/${id}/scannen`), "Gescannt — die Aufhänger stehen unten.")}>
          {arbeit === "scan" ? "KI liest die Website …" : scan ? "Erneut scannen" : "1 · Firma scannen"}
        </button>
        <button type="button" className={`cr-knopf${mail ? " hell" : ""}`} disabled={!!arbeit || zu} onClick={() => tun("mail", () => rufen(`/chef/radar/firma/${id}/mail`, "POST", { hinweis: hinweis.trim() || null }), "Die Mail steht — bitte lesen, bei Bedarf ändern.")}>
          {arbeit === "mail" ? (scan ? "KI schreibt die Mail …" : "KI scannt und schreibt …") : mail ? "Neu schreiben" : "2 · Mail schreiben"}
        </button>
        <input className="cr-feld" value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="Wunsch an die KI (optional), z. B. Fokus auf Kapital für Europa" maxLength={400} />
      </div>
      {arbeit && (arbeit === "scan" || arbeit === "mail") && <div className="cr-lauf laeuft"><span className="cr-lauf-balken" aria-hidden="true" /><span>Das dauert 30 bis 90 Sekunden — die KI liest bis zu acht Seiten und sucht nach Meldungen.</span></div>}
      {meldung && <p className={`cr-hinweis ${meldung.art}`}>{meldung.text}</p>}

      {scan && (
        <div className="cr-block">
          <h3>Scan <small>{seit(scan.am)} · {scan.seiten.length} Seiten gelesen{scan.verworfen ? ` · ${scan.verworfen} unbelegte Aufhänger verworfen` : ""}</small></h3>
          <p className="cr-profil">{scan.profil?.zusammenfassung}</p>
          <dl className="cr-profil-raster">
            <div><dt>Kunden</dt><dd>{scan.profil?.zielkunden || "—"}</dd></div>
            <div><dt>Größe</dt><dd>{scan.profil?.groesse || "—"}</dd></div>
            <div><dt>US-Bezug</dt><dd>{scan.profil?.us_bezug || "—"}</dd></div>
            <div><dt>Kapitalbedarf</dt><dd>{scan.profil?.kapital_bedarf || "—"}</dd></div>
            <div><dt>Passendes Paket</dt><dd>{paketName(scan.profil?.passendes_paket) ?? "—"}{scan.profil?.paket_grund ? ` — ${scan.profil.paket_grund}` : ""}</dd></div>
            {!!scan.profil?.risiken?.length && <div><dt>Könnte nicht passen, weil</dt><dd>{scan.profil.risiken.join(" · ")}</dd></div>}
          </dl>
          <h4>Belegte Aufhänger</h4>
          {!scan.aufhaenger.length && <p className="cr-hinweis warn">Kein Aufhänger ließ sich wörtlich belegen — ohne ihn schreibt der Radar keine Mail.</p>}
          <ol className="cr-aufhaenger">
            {scan.aufhaenger.map((a, i) => (
              <li key={i}>
                <b>{a.text}</b>
                <q>{a.beleg}</q>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="cr-link">{a.quelle === "web" ? "Meldung" : "Website"} ↗</a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {mail && (
        <div className="cr-block cr-mail">
          <h3>Die Mail <small>{mail.geaendert ? "von Hand geändert" : `geschrieben ${seit(mail.erstellt_am)}`}{mail.paket ? ` · nennt ${paketName(mail.paket)}` : ""}</small></h3>
          {!!mail.sperrend?.length && <p className="cr-hinweis fehler">Sperrt Entwurf und Versand: {mail.sperrend.join(" · ")}</p>}
          {!!mail.warnungen?.length && <p className="cr-hinweis warn">Hinweis: {mail.warnungen.join(" · ")}</p>}
          <div className="cr-betreff"><span>Betreff</span><b>{mail.betreff}</b></div>
          {!bearbeiten ? (
            <>
              <iframe className="cr-vorschau" title="Vorschau der Mail" sandbox="" srcDoc={mail.html} />
              <div className="cr-mail-tun">
                <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(true)} disabled={schonRaus}>Text ändern</button>
                <button type="button" className="cr-knopf hell" onClick={() => { void navigator.clipboard?.writeText(mail.text); setMeldung({ art: "gut", text: "Text kopiert." }); }}>Text kopieren</button>
              </div>
            </>
          ) : (
            <div className="cr-bearbeiten">
              <label><span>Betreff</span><input className="cr-feld" value={betreff} onChange={(e) => setBetreff(e.target.value)} maxLength={120} /></label>
              <label><span>Text (Absätze durch eine Leerzeile trennen; der letzte Absatz ist die Schlussfrage — Anrede und Gruß setzt der Radar)</span>
                <textarea className="cr-feld" value={koerper} onChange={(e) => setKoerper(e.target.value)} rows={12} />
              </label>
              <label><span>PS (optional)</span><input className="cr-feld" value={ps} onChange={(e) => setPs(e.target.value)} maxLength={400} /></label>
              <div className="cr-mail-tun">
                <button type="button" className="cr-knopf" disabled={!!arbeit} onClick={() => tun("speichern", async () => { await rufen(`/chef/radar/firma/${id}/mail`, "PUT", { betreff, koerper, ps }); setBearbeiten(false); }, "Gespeichert — Vorschau und Prüfung sind neu.")}>
                  {arbeit === "speichern" ? "Speichert …" : "Speichern"}
                </button>
                <button type="button" className="cr-knopf hell" onClick={() => setBearbeiten(false)}>Abbrechen</button>
              </div>
            </div>
          )}

          {!schonRaus && !zu && (
            <div className="cr-ausgabe">
              <label><span>Absender</span>
                <select className="cr-feld" value={postfach} onChange={(e) => setPostfach(e.target.value)}>
                  {(uebersicht?.postfaecher ?? []).map((p) => <option key={p} value={p}>{uebersicht?.absender.name} · {p}</option>)}
                </select>
              </label>
              <label><span>An</span><input className="cr-feld" value={an} onChange={(e) => setAn(e.target.value)} placeholder="E-Mail der Firma" /></label>
              <div className="cr-mail-tun">
                <button type="button" className="cr-knopf" disabled={!!arbeit || !!mail.sperrend?.length || !postfach}
                        onClick={() => tun("entwurf", () => rufen(`/chef/radar/firma/${id}/ausgeben`, "POST", { art: "entwurf", postfach, an }), `Liegt als Entwurf in ${postfach} — dort lesen und senden.`)}>
                  {arbeit === "entwurf" ? "Legt an …" : f.status === "im_postfach" ? "Entwurf neu ins Postfach" : "Als Entwurf ins Postfach"}
                </button>
                <button type="button" className="cr-knopf warm" disabled={!!arbeit || !!mail.sperrend?.length || !postfach} onClick={() => { setSendenFrage(true); setVerantwortet(false); }}>
                  Direkt senden …
                </button>
              </div>
              {sendenFrage && (
                <div className="cr-senden-frage" role="dialog" aria-label="Versand bestätigen">
                  <b>Mail an {an || "?"} aus {postfach} senden?</b>
                  <p>Werbe-Mails an Firmen brauchen in Deutschland, Österreich und der Schweiz eine vorherige Einwilligung — auch einzeln und persönlich (DE § 7 Abs. 2 Nr. 2 UWG, AT § 174 TKG 2021, CH Art. 3 Abs. 1 lit. o UWG). Ohne Einwilligung drohen Abmahnungen. Der Radar schickt je Firma genau eine Mail, nie an die Sperrliste, immer mit Abmeldesatz.</p>
                  <label className="cr-haken"><input type="checkbox" checked={verantwortet} onChange={(e) => setVerantwortet(e.target.checked)} /> Ich habe die Mail gelesen und verantworte den Versand.</label>
                  <div className="cr-mail-tun">
                    <button type="button" className="cr-knopf warm" disabled={!verantwortet || !!arbeit}
                            onClick={() => tun("senden", async () => { await rufen(`/chef/radar/firma/${id}/ausgeben`, "POST", { art: "senden", postfach, an, bestaetigt: true }); setSendenFrage(false); }, `Gesendet an ${an}.`)}>
                      {arbeit === "senden" ? "Sendet …" : "Jetzt senden"}
                    </button>
                    <button type="button" className="cr-knopf hell" onClick={() => setSendenFrage(false)}>Abbrechen</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {schonRaus && <p className="cr-hinweis gut">Versendet {f.versendet_am ? datum(f.versendet_am) : ""}{f.postfach ? ` aus ${f.postfach}` : ""} — je Firma geht genau eine erste Mail.</p>}
        </div>
      )}

      {/* ── Stand von Hand ── */}
      <div className="cr-stand-tun">
        {f.status === "im_postfach" && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "versendet" }), "Als versendet markiert.")}>Im Postfach gesendet — als versendet markieren</button>}
        {schonRaus && f.status !== "antwort" && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "antwort" }), "Antwort vermerkt.")}>Antwort erhalten</button>}
        {!zu && <button type="button" className="cr-textknopf" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "kein_interesse" }), "Vermerkt — die Firma kommt auf die Sperrliste.")}>Kein Interesse</button>}
        {!zu && <button type="button" className="cr-textknopf rot" disabled={!!arbeit} onClick={() => tun("status", () => rufen(`/chef/radar/firma/${id}/status`, "POST", { status: "gesperrt" }), "Gesperrt — nie wieder im Radar.")}>Sperren</button>}
      </div>
    </div>
  );
}
