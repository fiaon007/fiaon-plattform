// ═══════════════════════════════════════════════════════════════════════════
// /agent/kalender — Raum „Calendar“ (23.08.2026, Plan §4/§11)
//
// Ersetzt kalender.tsx. Dunkle Bühne, Glas, handytauglich.
//
// Daten:  GET /agent/calendar?from&to   (eigene Rückrufe/Zusagen + vom Kunden
//                                         gebuchte Termine, zwei Quellen)
//         GET /agent/arbeitszeiten       (Verfügbarkeit → grau/blau im Raster)
//         GET /agent/termine/uebernehmer?termin=ID (Übergabe)
//         GET /agent/kunden/liste?q=     (Kundensuche für „Termin anlegen“)
// Aktionen wie bisher (gleiche Pfade, gleiche Payloads):
//         POST /agent/calendar/:id/done · /reschedule { scheduledAt }
//         POST /agent/termine/:id/ergebnis { ergebnis } · /uebergeben { agentId, grund }
//         POST /agent/termine { personId, beginn } · POST /agent/termine/:id/absagen
// Anruf: Ereignis `fiaon-anrufen`. Akte: /agent/kunden?person=<ID>
// (identisch mit /agent/pipeline — beide Routen zeigen dieselbe Seite).
//
// 23.08.2026 abends (Justins Auftrag, Screenshot Wochenansicht): Terminblöcke
// waren gequetscht. Neu: Raster 00–24 h im Scrollrahmen (Start bei 08:00),
// Mindesthöhe 34 px je Block, Spaltenaufteilung bei Überlappung statt Stapeln,
// Glas-Popover bei Hover/Klick (Handy: Bottom-Sheet), Verlauf je Terminart
// mit Lichtkante und Zeitbalken links – konsistent bis in die Tageskarten.
//
// 24.08.2026 (E-051, Plan §20): DER CALENDAR IST PUR.
// VORHER: der Startgespräche-Reiter samt Kennzahl-Kacheln lebte hier mit drin.
// NACHHER: Der Calendar zeigt NUR die gebuchten Termine (Startgespräche
// erscheinen als normale Einträge mit ihrer Terminart-Farbe), Tag/Woche, der
// Reihe nach. 1 Klick auf einen Termin öffnet die Kundenakte; das Popover
// (Hover, am Handy erster Tap) behält Anrufen/Details und trägt „Akte“ groß.
// Die Startgespräche-Sektion arbeitet jetzt im eigenen Raum Onboarding
// (onboarding-raum.tsx) — hier steht nur noch eine Hinweis-Karte mit Link.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation } from "wouter";
import { Phone, Check, X, ChevronLeft, ChevronRight, Plus, CalendarClock, StickyNote, ExternalLink, Clock, UserRoundCheck, Search, Sparkles } from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-calendar.css";

// ── Zeit in Europe/Berlin (nie über toISOString, AGENTS.md) ─────────────────
interface Teile { y: number; m: number; d: number; h: number; min: number; wd: number }
const TEILER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
function teile(d: Date): Teile {
  const o = TEILER.formatToParts(d).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour) % 24, min: Number(o.minute), wd: WD[o.weekday] ?? 1 };
}
const dayKey = (d: Date) => { const t = teile(d); return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`; };
const minuten = (d: Date) => { const t = teile(d); return t.h * 60 + t.min; };
const uhr = (d: Date) => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const datumKurz = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const datumLang = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
const zeitTag = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** Ein Datum (Mittag UTC) zu einem Tagesschlüssel — damit +n Tage nie die Berliner Tagesgrenze verfehlt. */
const ausKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const plusTage = (key: string, n: number) => { const d = ausKey(key); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); };
/** „YYYY-MM-DDTHH:MM“ (Eingabe in Berliner Zeit) → absoluter ISO-Zeitpunkt. */
function berlinIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  let t = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) { const p = teile(new Date(t)); t -= Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - t; }
  return new Date(t).toISOString();
}
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const STUNDE_PX = 44;               // Wochenraster: Höhe einer Stunde in Pixeln (00–24 h)
const MIN_BLOCK = 34;               // Mindesthöhe eines Terminblocks – lesbar auch bei 20 min
const SCROLL_START = 8 * STUNDE_PX; // beim Öffnen automatisch zu 08:00 scrollen
const anrufen = (nummer: string | null | undefined, personId: number | null | undefined, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId: personId ?? null, name } })); };

// ── Termin (zwei Quellen: Verlauf = eigene Notiz, Termin = vom Kunden gebucht) ──
interface Termin {
  id: number; ref: string; payment_reference?: string | null; outcome: string | null;
  scheduled_at: string | null; promised_date: string | null; note: string | null;
  first_name: string | null; last_name: string | null; contact_name: string | null; company_name: string | null;
  payment_status: string; phone: string | null; phone_country_code: string | null; contact_phone: string | null;
  art?: "verlauf" | "termin"; schluessel?: string; status?: string; abgesagt?: boolean; absageText?: string | null;
  buchungsquelle?: string; person_id?: number | null; quelle?: string; dauer_min?: number | null;
  terminArtText?: string | null; terminArtTon?: string | null; terminArtErklaerung?: string | null;
}
const tName = (a: Termin) => a.company_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || a.ref;
const tPhone = (a: Termin) => a.phone ? `${a.phone_country_code || ""}${a.phone}`.replace(/\s/g, "") : a.contact_phone ? a.contact_phone.replace(/\s/g, "") : null;
const tZeit = (a: Termin) => new Date(a.scheduled_at || a.promised_date || 0);
const tKey = (a: Termin) => a.schluessel ?? `${a.art ?? "verlauf"}:${a.id}`;
const akteHref = (a: { person_id?: number | null; personId?: number | null; ref?: string | null }) => a.person_id || a.personId ? `/agent/kunden?person=${a.person_id ?? a.personId}` : `/agent/kunden?ref=${encodeURIComponent(a.ref || "")}`;

interface Block { wochentag: number; von: string; bis: string }

// ── Spaltenaufteilung im Wochenraster ───────────────────────────────────────
// Blöcke bekommen eine Mindesthöhe (MIN_BLOCK); wer sich dadurch – oder echt –
// überlappt, wird nebeneinander versetzt statt übereinander gestapelt.
interface WLage { top: number; hoehe: number; links: number; breite: number } // top/hoehe px, links/breite %
function wochenLayout(liste: Termin[]): Map<string, WLage> {
  const H = STUNDE_PX;
  const its = liste.map((a) => {
    const dauer = Math.max(15, Number(a.dauer_min) || 30);
    const hoehe = Math.max(MIN_BLOCK, (dauer / 60) * H);
    const top = Math.max(0, Math.min((minuten(tZeit(a)) / 60) * H, 24 * H - hoehe));
    return { key: tKey(a), top, ende: top + hoehe };
  }).sort((x, y) => x.top - y.top || y.ende - x.ende);
  const res = new Map<string, WLage>();
  let gruppe: typeof its = []; let gruppenEnde = -1;
  const abschliessen = () => {
    if (!gruppe.length) return;
    const spaltenEnde: number[] = []; const spalte = new Map<string, number>();
    for (const it of gruppe) {
      let s = spaltenEnde.findIndex((e) => e <= it.top + 1);
      if (s === -1) { s = spaltenEnde.length; spaltenEnde.push(0); }
      spaltenEnde[s] = it.ende + 2; spalte.set(it.key, s); // 2 px Luft = „beinahe überlappend“ zählt mit
    }
    const n = spaltenEnde.length;
    for (const it of gruppe) res.set(it.key, { top: it.top, hoehe: it.ende - it.top, links: (spalte.get(it.key)! / n) * 100, breite: 100 / n });
    gruppe = [];
  };
  for (const it of its) {
    if (gruppe.length && it.top >= gruppenEnde) { abschliessen(); gruppenEnde = -1; }
    gruppe.push(it); gruppenEnde = Math.max(gruppenEnde, it.ende + 2);
  }
  abschliessen();
  return res;
}

export default function AgentCalendarPage() { return <AgentShell><CalendarInnen /></AgentShell>; }

function CalendarInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Calendar"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [ansicht, setAnsicht] = useState<"tag" | "woche">("woche");
  const [, navigiere] = useLocation();
  // E-051: 1 Klick auf einen Termin → Kundenakte. Am Handy (kein Hover)
  // öffnet der erste Tap stattdessen das Popover mit großem „Akte“-Knopf.
  const zurAkte = (a: Termin) => navigiere(akteHref(a));
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setJetzt(new Date()), 60_000); return () => clearInterval(i); }, []);
  const heuteKey = dayKey(jetzt);
  const [tagKey, setTagKey] = useState(heuteKey);
  const [wochenVersatz, setWochenVersatz] = useState(0);

  const [termine, setTermine] = useState<Termin[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bloecke, setBloecke] = useState<Block[]>([]);
  const [stundenWoche, setStundenWoche] = useState<number | null>(null);
  const [vollstaendig, setVollstaendig] = useState(true);
  const [detail, setDetail] = useState<Termin | null>(null);
  const [anlegen, setAnlegen] = useState(false);

  const flash = (text: string, warn = false) => { setMeldung({ text, warn }); setTimeout(() => setMeldung(null), 4500); };

  // Woche: Montag der angezeigten Woche (Berliner Zeit)
  const montagKey = useMemo(() => plusTage(heuteKey, -(teile(jetzt).wd - 1) + wochenVersatz * 7), [heuteKey, wochenVersatz]); // eslint-disable-line react-hooks/exhaustive-deps
  const wochenKeys = useMemo(() => Array.from({ length: 7 }, (_, i) => plusTage(montagKey, i)), [montagKey]);

  const laden = useCallback(() => {
    const von = new Date(Math.min(Date.now() - 14 * 864e5, ausKey(montagKey).getTime() - 864e5));
    const bis = new Date(Math.max(Date.now() + 28 * 864e5, ausKey(montagKey).getTime() + 9 * 864e5));
    api(`/agent/calendar?from=${encodeURIComponent(von.toISOString())}&to=${encodeURIComponent(bis.toISOString())}`).then((r) => {
      if (r.ok) { setTermine([...(r.json.data ?? []), ...(r.json.gebuchteTermine ?? [])]); setFehler(null); }
      else setFehler(r.json?.error || "Der Kalender konnte nicht geladen werden.");
      setLaedt(false);
    }).catch(() => { setFehler("Keine Verbindung."); setLaedt(false); });
  }, [montagKey]);
  useEffect(() => { laden(); }, [laden]);
  useEffect(() => {
    api("/agent/arbeitszeiten").then((r) => { if (r.ok) { setBloecke(r.json.bloecke || []); setStundenWoche(Number(r.json.stundenProWoche ?? 0)); setVollstaendig(!!r.json.vollstaendig); } }).catch(() => {});
  }, []);

  const freiAm = useCallback((wd: number) => bloecke.filter((b) => b.wochentag === wd).map((b) => [hm(b.von), hm(b.bis)] as [number, number]), [bloecke]);
  const inVerfuegbarkeit = useCallback((d: Date) => { const m = minuten(d); return freiAm(teile(d).wd).some(([v, b]) => m >= v && m < b); }, [freiAm]);

  const ueberfaellig = useMemo(() => termine.filter((a) => !a.abgesagt && tZeit(a) < jetzt && dayKey(tZeit(a)) !== heuteKey).sort((a, b) => +tZeit(a) - +tZeit(b)), [termine, jetzt, heuteKey]);
  const proTag = useCallback((key: string) => termine.filter((a) => dayKey(tZeit(a)) === key).sort((a, b) => +tZeit(a) - +tZeit(b)), [termine]);
  const heuteListe = useMemo(() => proTag(heuteKey), [proTag, heuteKey]);
  const tagListe = useMemo(() => proTag(tagKey), [proTag, tagKey]);

  // ── Aktionen (unverändert aus kalender.tsx) ──────────────────────────────
  const entfernen = (a: Termin) => setTermine((v) => v.filter((x) => tKey(x) !== tKey(a)));
  const erledigt = async (a: Termin) => {
    setBusy(tKey(a));
    const r = a.art === "termin"
      ? await api(`/agent/termine/${a.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis: "erledigt" }) })
      : await api(`/agent/calendar/${a.id}/done`, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Termin als erledigt markiert."); entfernen(a); setDetail(null); laden(); } else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };
  const verpasst = async (a: Termin) => {
    if (a.art !== "termin") return;
    setBusy(tKey(a));
    const r = await api(`/agent/termine/${a.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis: "verpasst" }) });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Als nicht erschienen vermerkt."); entfernen(a); setDetail(null); laden(); } else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };
  const verschieben = async (a: Termin, wert: string) => {
    setBusy(tKey(a));
    const r = await api(`/agent/calendar/${a.id}/reschedule`, { method: "POST", body: JSON.stringify({ scheduledAt: wert }) });
    setBusy(null);
    if (r.ok) { flash("Termin verschoben."); setDetail(null); laden(); return true; }
    flash(r.json?.error || "Das hat nicht geklappt.", true); return false;
  };
  const uebergeben = async (a: Termin, agentId: number, grund: string) => {
    setBusy(tKey(a));
    const r = await api(`/agent/termine/${a.id}/uebergeben`, { method: "POST", body: JSON.stringify({ agentId, grund }) });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Termin übergeben."); setDetail(null); laden(); return true; }
    flash(r.json?.error || "Die Übergabe hat nicht geklappt.", true); return false;
  };
  const absagen = async (a: Termin) => {
    if (a.art !== "termin") return;
    setBusy(tKey(a));
    const r = await api(`/agent/termine/${a.id}/absagen`, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash("Termin abgesagt – der Kunde wird informiert."); setDetail(null); laden(); } else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };

  // ── Glas-Popover im Wochenraster (Hover = flüchtig, Klick = fest) ────────
  const [popover, setPopover] = useState<{ a: Termin; fest: boolean; links: number; oben: number } | null>(null);
  const wocheRef = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const zuTimer = useRef<number | null>(null);
  useEffect(() => () => { if (hoverTimer.current) window.clearTimeout(hoverTimer.current); if (zuTimer.current) window.clearTimeout(zuTimer.current); }, []);
  const popAuf = (a: Termin, el: HTMLElement, fest: boolean) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (zuTimer.current) window.clearTimeout(zuTimer.current);
    const r = el.getBoundingClientRect();
    const links = r.right + 316 < window.innerWidth ? r.right + 10 : Math.max(8, r.left - 312);
    const oben = Math.max(12, Math.min(window.innerHeight - 320, r.top - 6));
    setPopover({ a, fest, links, oben });
  };
  const hoverAuf = (a: Termin, el: HTMLElement) => {
    if (popover?.fest || detail) return;
    if (zuTimer.current) window.clearTimeout(zuTimer.current);
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => popAuf(a, el, false), 120);
  };
  const hoverZu = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (zuTimer.current) window.clearTimeout(zuTimer.current);
    zuTimer.current = window.setTimeout(() => setPopover((p) => (p && !p.fest ? null : p)), 250);
  };
  // Beim Öffnen der Woche zu 08:00 springen – Randtermine bleiben per Scroll erreichbar.
  useEffect(() => { if (ansicht === "woche" && !laedt && wocheRef.current) wocheRef.current.scrollTop = SCROLL_START; }, [ansicht, laedt]);

  const wochenTitel = `${datumKurz(ausKey(wochenKeys[0]))} – ${datumKurz(ausKey(wochenKeys[6]))}`;
  const tagDate = ausKey(tagKey);

  return (
    <div className="ca">
      <section className="ca-kopf">
        <div>
          <span className="ca-pille">{datumLang(jetzt)} · {uhr(jetzt)} Uhr</span>
          <h1>{heuteListe.length ? <>Heute <span className="ca-verlauf">{heuteListe.length} {heuteListe.length === 1 ? "Termin" : "Termine"}</span>{ueberfaellig.length ? <>, {ueberfaellig.length} überfällig.</> : "."}</> : ueberfaellig.length ? <><span className="ca-verlauf">{ueberfaellig.length} überfällig</span> – heute frei.</> : <>Heute <span className="ca-verlauf">frei.</span></>}</h1>
          <p>Rückrufe, Zusagen und Termine, die Kunden bei dir gebucht haben. Grau ist außerhalb deiner Verfügbarkeit – dort kommen keine neuen Buchungen.</p>
        </div>
        <div className="ca-lage">
          <small>Diese Woche</small>
          <div className="ca-lage-zahl"><b>{wochenKeys.reduce((s, k) => s + proTag(k).filter((a) => !a.abgesagt).length, 0)}</b><span>Termine</span></div>
          <div className="ca-lage-zeile"><span>Überfällig</span><b className={ueberfaellig.length ? "warn" : ""}>{ueberfaellig.length}</b></div>
          <div className="ca-lage-zeile"><span>Verfügbarkeit</span><b className={vollstaendig ? "" : "warn"}>{stundenWoche == null ? "–" : `${stundenWoche.toLocaleString("de-DE")} h / Woche`}</b></div>
          <Link href="/agent/arbeitszeiten" className="ca-link">{vollstaendig ? "Zeiten ändern" : "Verfügbarkeit eintragen"} <ChevronRight size={14} /></Link>
        </div>
      </section>

      {fehler && <p className="ca-fehler">{fehler}</p>}
      {meldung && <p className={`ca-meldung${meldung.warn ? " warn" : ""}`}>{meldung.text}</p>}

      {/* E-051: Startgespräche haben ihren eigenen Raum – hier nur der Wegweiser. */}
      <Link href="/agent/onboarding" className="ca-hinweiskarte">
        <Sparkles size={16} strokeWidth={1.75} />
        <span>Deine Startgespräche führst du im Raum <b>Onboarding</b> – mit Kacheln, Wartenden und dem Gesprächs-Cockpit.</span>
        <em>Zum Raum <ChevronRight size={14} /></em>
      </Link>

      <section className="ca-leiste">
        <div className="ca-reiter" role="tablist">
          <button type="button" role="tab" aria-selected={ansicht === "tag"} className={ansicht === "tag" ? "an" : ""} onClick={() => { setAnsicht("tag"); setTagKey(heuteKey); }}>Tag</button>
          <button type="button" role="tab" aria-selected={ansicht === "woche"} className={ansicht === "woche" ? "an" : ""} onClick={() => setAnsicht("woche")}>Woche</button>
        </div>
        <div className="ca-nav">
          <button type="button" aria-label="Zurück" onClick={() => ansicht === "tag" ? setTagKey(plusTage(tagKey, -1)) : setWochenVersatz(wochenVersatz - 1)}><ChevronLeft size={18} /></button>
          <b>{ansicht === "tag" ? (tagKey === heuteKey ? `Heute, ${datumKurz(tagDate)}` : tagDate.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })) : wochenTitel}</b>
          <button type="button" aria-label="Weiter" onClick={() => ansicht === "tag" ? setTagKey(plusTage(tagKey, 1)) : setWochenVersatz(wochenVersatz + 1)}><ChevronRight size={18} /></button>
          {(ansicht === "tag" ? tagKey !== heuteKey : wochenVersatz !== 0) && <button type="button" style={{ width: "auto", padding: "0 12px" }} onClick={() => { setTagKey(heuteKey); setWochenVersatz(0); }}>Heute</button>}
        </div>
        <button type="button" className="ca-knopf" onClick={() => setAnlegen(true)}><Plus size={16} strokeWidth={1.75} /> Termin anlegen</button>
      </section>

      {laedt && <p className="ca-lade">Lade …</p>}

      {!laedt && ueberfaellig.length > 0 && (
        <section className="ca-block">
          <div className="ca-block-kopf"><b className="warn">Überfällig ({ueberfaellig.length})</b><small>Erst das, dann der Tag.</small></div>
          {ueberfaellig.map((a) => <Zeile key={tKey(a)} a={a} datum busy={busy === tKey(a)} onAkte={() => zurAkte(a)} onOeffnen={() => setDetail(a)} onErledigt={() => erledigt(a)} ausser={!inVerfuegbarkeit(tZeit(a))} />)}
        </section>
      )}

      {ansicht === "tag" && !laedt && (
        <section className="ca-block">
          <div className="ca-block-kopf"><b>{tagKey === heuteKey ? "Heute" : datumLang(tagDate)}</b><small>{tagListe.length ? `${tagListe.length} ${tagListe.length === 1 ? "Termin" : "Termine"}` : "nichts geplant"}</small></div>
          <Tagband frei={freiAm(teile(tagDate).wd)} jetzt={tagKey === heuteKey ? minuten(jetzt) : null} />
          {tagListe.length === 0 && <p className="ca-leer">{freiAm(teile(tagDate).wd).length ? "Kein Termin an diesem Tag. Deine Zeiten sind frei für Buchungen." : "Kein Termin – und keine Verfügbarkeit an diesem Tag. Kunden können hier nichts buchen."}</p>}
          {tagListe.map((a) => <Zeile key={tKey(a)} a={a} busy={busy === tKey(a)} onAkte={() => zurAkte(a)} onOeffnen={() => setDetail(a)} onErledigt={() => erledigt(a)} ausser={!inVerfuegbarkeit(tZeit(a))} />)}
        </section>
      )}

      {ansicht === "woche" && !laedt && (
        <>
          <section className="ca-woche" aria-label="Wochenansicht" ref={wocheRef} onScroll={() => setPopover(null)}>
            <div className="ca-w-zeiten">
              <div className="ca-w-ecke" />
              <div className="ca-w-zeitspalte" style={{ height: 24 * STUNDE_PX }}>
                {Array.from({ length: 25 }, (_, i) => <span key={i} style={{ top: i * STUNDE_PX }}>{String(i % 24).padStart(2, "0")}</span>)}
              </div>
            </div>
            {wochenKeys.map((key, i) => {
              const d = ausKey(key); const liste = proTag(key); const frei = freiAm(i + 1); const istHeute = key === heuteKey;
              const lage = wochenLayout(liste);
              const px = (m: number) => (m / 60) * STUNDE_PX;
              return (
                <div key={key} className={`ca-w-tag${istHeute ? " heute" : ""}`}>
                  <button type="button" className="ca-w-kopf" onClick={() => { setTagKey(key); setAnsicht("tag"); }} title="Tag öffnen">
                    {istHeute ? <em>Heute</em> : <b>{TAGE[i]}</b>}<small>{datumKurz(d)}</small>{istHeute && <b style={{ fontSize: 11 }}>{TAGE[i]}</b>}
                  </button>
                  <div className="ca-w-spalte" style={{ height: 24 * STUNDE_PX }}>
                    <div className="ca-w-ausser" style={{ top: 0, bottom: 0 }} />
                    {frei.map(([v, b], k) => <div key={k} className="ca-w-frei" style={{ top: px(v), height: px(b) - px(v) }} />)}
                    {Array.from({ length: 25 }, (_, h) => <div key={h} className="ca-w-linie" style={{ top: h * STUNDE_PX }} />)}
                    {istHeute && <div className="ca-w-jetzt" style={{ top: px(minuten(jetzt)) }} />}
                    {liste.map((a) => {
                      const l = lage.get(tKey(a))!;
                      const kompakt = l.hoehe < 50; // erst ab ausreichender Höhe zweizeilig
                      const ton = a.terminArtTon || (a.art === "verlauf" ? "#94a3b8" : "#3b82f6");
                      return (
                        <button key={tKey(a)} type="button"
                                className={`ca-w-termin${a.art === "verlauf" ? " verlauf" : ""}${a.abgesagt ? " abgesagt" : ""}${a.status === "verpasst" ? " verpasst" : ""}${tZeit(a) < jetzt && !a.abgesagt ? " vorbei" : ""}${!inVerfuegbarkeit(tZeit(a)) ? " ausser" : ""}${kompakt ? " kompakt" : ""}`}
                                style={{ top: l.top, height: l.hoehe, left: `calc(${l.links}% + 3px)`, width: `calc(${l.breite}% - 6px)`, "--ca-ton": ton } as CSSProperties}
                                onClick={(e) => popAuf(a, e.currentTarget, true)}
                                onMouseEnter={(e) => hoverAuf(a, e.currentTarget)}
                                onMouseLeave={hoverZu}
                                title={`${uhr(tZeit(a))} ${tName(a)}`}>
                          {kompakt ? <span className="eins"><b>{uhr(tZeit(a))}</b> · {tName(a)}</span> : <><b>{uhr(tZeit(a))}</b><span>{tName(a)}</span></>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
          <div className="ca-w-legende">
            <span><i style={{ background: "rgba(59,130,246,.35)" }} />Verfügbar</span>
            <span><i style={{ background: "repeating-linear-gradient(135deg,rgba(255,255,255,.25) 0 3px,transparent 3px 6px)" }} />Außerhalb deiner Zeiten</span>
            <span><i style={{ background: "linear-gradient(180deg,#3b82f6,#2563eb)" }} />Vom Kunden gebucht</span>
            <span><i style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.3)" }} />Selbst notiert / Zusage</span>
            <span><i style={{ background: "#fbbf24", height: 2, marginTop: 5 }} />Jetzt</span>
          </div>
          {/* Handy: die Woche als Tageskarten */}
          <section className="ca-wochenliste" aria-label="Wochenliste">
            {wochenKeys.map((key, i) => {
              const liste = proTag(key); const frei = freiAm(i + 1); const istHeute = key === heuteKey;
              return (
                <div key={key} className={`ca-tageskarte${istHeute ? " heute" : ""}`}>
                  <div className="ca-tageskarte-kopf"><b>{istHeute ? "Heute" : `${TAGE[i]}, ${datumKurz(ausKey(key))}`}</b><small>{frei.length ? frei.map(([v, b]) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}–${String(Math.floor(b / 60)).padStart(2, "0")}:${String(b % 60).padStart(2, "0")}`).join(" · ") : "nicht verfügbar"}</small></div>
                  {liste.length === 0 && <p className="ca-leer">–</p>}
                  {liste.map((a) => <Zeile key={tKey(a)} a={a} busy={busy === tKey(a)} onAkte={() => zurAkte(a)} onOeffnen={() => setDetail(a)} onErledigt={() => erledigt(a)} ausser={!inVerfuegbarkeit(tZeit(a))} />)}
                </div>
              );
            })}
          </section>
        </>
      )}

      {ansicht === "start" && <Startgespraeche />}

      {popover && (
        <Popover a={popover.a} fest={popover.fest} links={popover.links} oben={popover.oben}
                 ausser={!inVerfuegbarkeit(tZeit(popover.a))}
                 onZu={() => setPopover(null)}
                 onHalten={() => { if (zuTimer.current) window.clearTimeout(zuTimer.current); }}
                 onLoslassen={hoverZu}
                 onDetails={() => { setDetail(popover.a); setPopover(null); }} />
      )}
      {detail && (
        <Detail a={detail} busy={busy === tKey(detail)} ausser={!inVerfuegbarkeit(tZeit(detail))} onZu={() => setDetail(null)}
                onErledigt={() => erledigt(detail)} onVerpasst={() => verpasst(detail)} onVerschieben={(w) => verschieben(detail, w)}
                onUebergeben={(id, g) => uebergeben(detail, id, g)} onAbsagen={() => absagen(detail)} />
      )}
      {anlegen && <Anlegen vorschlag={tagKey === heuteKey ? "" : `${tagKey}T10:00`} onZu={() => setAnlegen(false)} onFertig={(t) => { setAnlegen(false); flash(t); laden(); }} />}
    </div>
  );
}

// ── Eine Terminzeile ─────────────────────────────────────────────────────────
function Zeile({ a, datum, busy, ausser, onOeffnen, onErledigt }: { a: Termin; datum?: boolean; busy: boolean; ausser: boolean; onOeffnen: () => void; onErledigt: () => void }) {
  const tel = tPhone(a); const d = tZeit(a);
  const ton = a.terminArtTon || (a.quelle === "termin" ? "#3b82f6" : "#94a3b8"); // gleicher Zeitbalken wie im Wochenraster
  return (
    <div className={`ca-zeile mit-ton${a.abgesagt ? " abgesagt" : ""}`} style={{ "--ca-ton": ton } as CSSProperties} onClick={onOeffnen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOeffnen(); }}>
      <div className={`ca-zeit${ausser ? " ausser" : ""}`}><b>{uhr(d)}</b><small>{datum ? datumKurz(d) : a.dauer_min ? `${a.dauer_min} min` : ausser ? "außerhalb" : ""}</small></div>
      <div className="ca-wer">
        <b>{tName(a)}</b>
        {a.absageText && <span className="ca-hinweis warn">{a.absageText}</span>}
        {a.status === "verpasst" && <span className="ca-hinweis rot">Ohne Ergebnis verstrichen – mit „Nicht erschienen“ abschließen</span>}
        <small>
          {a.terminArtText && <span className="ca-marke blau" title={a.terminArtErklaerung || undefined} style={a.terminArtTon ? { color: a.terminArtTon, borderColor: `${a.terminArtTon}66` } : undefined}>{a.terminArtText}</span>}
          {a.quelle === "termin" ? <span className="ca-marke kunde">Kunde hat gebucht</span> : <span>{a.scheduled_at ? "selbst notiert" : "Zahlungs-Zusage"}</span>}
          {ausser && <span className="ca-marke warn" title="Liegt außerhalb deiner eingetragenen Verfügbarkeit"><Clock size={10} style={{ marginRight: 4 }} />außerhalb deiner Zeiten</span>}
        </small>
      </div>
      <div className="ca-aktion" onClick={(e) => e.stopPropagation()}>
        {tel && <button type="button" className="ca-knopf klein" onClick={() => anrufen(tel, a.person_id, tName(a))}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>}
        <button type="button" className="ca-knopf klein still" disabled={busy || a.abgesagt === true} title={a.abgesagt ? "Dieser Termin ist abgesagt." : "Erledigt"} onClick={onErledigt} aria-label="Erledigt"><Check size={15} strokeWidth={2} /></button>
        <button type="button" className="ca-knopf klein still" onClick={onOeffnen}>Mehr</button>
      </div>
    </div>
  );
}

// ── Tagesband: Verfügbarkeit des Tages, 6–22 Uhr ─────────────────────────────
function Tagband({ frei, jetzt }: { frei: [number, number][]; jetzt: number | null }) {
  const VON = 6 * 60, BIS = 22 * 60; const pos = (m: number) => `${Math.max(0, Math.min(100, ((m - VON) / (BIS - VON)) * 100))}%`;
  return (
    <>
      <div className="ca-tagband" aria-label="Verfügbarkeit heute">
        {frei.map(([v, b], i) => <i key={i} style={{ left: pos(v), width: `calc(${pos(b)} - ${pos(v)})` }} />)}
        {[6, 9, 12, 15, 18, 21].map((h) => <span key={h} style={{ left: `calc(${pos(h * 60)} + 6px)` }}>{h}</span>)}
        {jetzt != null && jetzt >= VON && jetzt <= BIS && <em style={{ left: pos(jetzt) }} />}
      </div>
      <div className="ca-tagband-legende"><span><i style={{ background: "rgba(59,130,246,.45)" }} />deine Zeiten</span><span><i style={{ background: "rgba(255,255,255,.08)" }} />außerhalb (grau)</span>{jetzt != null && <span><i style={{ background: "#fbbf24", width: 2 }} />jetzt</span>}</div>
    </>
  );
}

// ── Glas-Popover: der Block darf klein sein, die Bedienung liegt hier ────────
// Hover zeigt es flüchtig, Klick pinnt es (mit Hintergrund zum Schließen).
// Am Handy (≤700px) wird es per CSS zum Bottom-Sheet.
function Popover({ a, fest, links, oben, ausser, onZu, onHalten, onLoslassen, onDetails }: {
  a: Termin; fest: boolean; links: number; oben: number; ausser: boolean;
  onZu: () => void; onHalten: () => void; onLoslassen: () => void; onDetails: () => void;
}) {
  const tel = tPhone(a); const d = tZeit(a);
  const dauer = Number(a.dauer_min) || null;
  const ende = dauer ? new Date(+d + dauer * 60000) : null;
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onZu]);
  return (
    <>
      {fest && <div className="ca-popover-hintergrund" onClick={onZu} />}
      <div className="ca-popover" role="dialog" aria-label={tName(a)} style={{ left: links, top: oben }} onMouseEnter={onHalten} onMouseLeave={onLoslassen}>
        <div className="ca-popover-kopf">
          <b>{tName(a)}</b>
          {fest && <button type="button" className="ca-zu klein" onClick={onZu} aria-label="Schließen"><X size={15} /></button>}
        </div>
        <div className="ca-popover-zeit"><CalendarClock size={14} strokeWidth={1.75} /><span>{zeitTag(d.toISOString())} Uhr</span><small>{ende && dauer ? `bis ${uhr(ende)} · ${dauer} min` : "ohne feste Dauer"}</small></div>
        <div className="ca-popover-marken">
          {a.terminArtText && <span className="ca-marke blau" title={a.terminArtErklaerung || undefined} style={a.terminArtTon ? { color: a.terminArtTon, borderColor: `${a.terminArtTon}66` } : undefined}>{a.terminArtText}</span>}
          {a.quelle === "termin" ? <span className="ca-marke kunde">Kunde hat gebucht</span> : <span className="ca-marke">{a.scheduled_at ? "selbst notiert" : "Zahlungs-Zusage"}</span>}
          {a.abgesagt && <span className="ca-marke warn">{a.absageText || "abgesagt"}</span>}
          {a.status === "verpasst" && <span className="ca-marke rot">nicht erschienen – offen</span>}
          {ausser && <span className="ca-marke warn">außerhalb deiner Zeiten</span>}
        </div>
        {a.note && <p className="ca-popover-notiz">{a.note}</p>}
        <div className="ca-popover-knoepfe">
          {tel && <button type="button" className="ca-knopf klein" onClick={() => anrufen(tel, a.person_id, tName(a))}><Phone size={13} strokeWidth={1.75} /> Anrufen</button>}
          <Link href={akteHref(a)} className="ca-knopf klein still"><ExternalLink size={13} strokeWidth={1.75} /> Akte</Link>
          <button type="button" className="ca-knopf klein still" onClick={onDetails}>Details</button>
        </div>
      </div>
    </>
  );
}

// ── Detail-Dialog mit allen Aktionen ─────────────────────────────────────────
function Detail({ a, busy, ausser, onZu, onErledigt, onVerpasst, onVerschieben, onUebergeben, onAbsagen }: {
  a: Termin; busy: boolean; ausser: boolean; onZu: () => void; onErledigt: () => void; onVerpasst: () => void;
  onVerschieben: (wert: string) => Promise<boolean>; onUebergeben: (agentId: number, grund: string) => Promise<boolean>; onAbsagen: () => void;
}) {
  const [modus, setModus] = useState<null | "verschieben" | "uebergeben" | "absagen">(null);
  const [wert, setWert] = useState("");
  const [kollegen, setKollegen] = useState<{ id: number; name: string; rolle: string; zustaendig?: boolean }[]>([]);
  const [soll, setSoll] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("");
  const [grund, setGrund] = useState("");
  const tel = tPhone(a); const d = tZeit(a); const istTermin = a.art === "termin"; const gebucht = istTermin && !a.abgesagt && a.status !== "verpasst";
  useEffect(() => { setModus(null); setWert(""); setAgentId(""); setGrund(""); }, [a]);
  // Mit ?termin= sortiert der Server die Zuständigen nach oben (C12-e).
  useEffect(() => {
    if (modus !== "uebergeben") return;
    setKollegen([]);
    void api(`/agent/termine/uebernehmer?termin=${a.id}`).then((r) => { if (r.ok) { setKollegen(r.json?.kollegen ?? []); setSoll(r.json?.soll ?? null); } });
  }, [modus, a.id]);

  return (
    <div className="ca-dialog-hintergrund" onClick={onZu} role="dialog" aria-modal="true">
      <div className="ca-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ca-dialog-kopf">
          <div><h2>{tName(a)}</h2><small>{a.payment_reference || a.ref}</small></div>
          <button type="button" className="ca-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div className="ca-dialog-zeile"><CalendarClock size={16} strokeWidth={1.75} /><span>{zeitTag(d.toISOString())} Uhr</span><small>deutsche Zeit{a.dauer_min ? ` · ${a.dauer_min} min` : ""}</small></div>
        <div className="ca-dialog-zeile" style={{ flexWrap: "wrap" }}>
          {a.terminArtText && <span className="ca-marke blau" style={a.terminArtTon ? { color: a.terminArtTon, borderColor: `${a.terminArtTon}66` } : undefined}>{a.terminArtText}</span>}
          {a.quelle === "termin" ? <span className="ca-marke kunde">Kunde hat gebucht</span> : <span className="ca-marke">{a.scheduled_at ? "Rückruf-Termin" : "Zahlungs-Zusage"}</span>}
          {a.abgesagt && <span className="ca-marke warn">{a.absageText || "abgesagt"}</span>}
          {a.status === "verpasst" && <span className="ca-marke rot">nicht erschienen – offen</span>}
          {ausser && <span className="ca-marke warn">außerhalb deiner Zeiten</span>}
        </div>
        {a.note && <p className="ca-notiz"><StickyNote size={14} strokeWidth={1.75} style={{ verticalAlign: -2, marginRight: 6, color: "#93c5fd" }} />{a.note}</p>}

        {!modus && (
          <div className="ca-dialog-aktionen">
            {tel && <button type="button" className="ca-knopf" onClick={() => anrufen(tel, a.person_id, tName(a))}><Phone size={15} strokeWidth={1.75} /> Anrufen</button>}
            <Link href={akteHref(a)} className="ca-knopf still"><ExternalLink size={15} strokeWidth={1.75} /> Zur Akte</Link>
            {!a.abgesagt && <button type="button" className="ca-knopf gut" disabled={busy} onClick={onErledigt}><Check size={15} strokeWidth={2} /> Erledigt</button>}
            {a.art !== "termin" && <button type="button" className="ca-knopf still" onClick={() => setModus("verschieben")}>Verschieben</button>}
            {istTermin && !a.abgesagt && <button type="button" className="ca-knopf still" disabled={busy} onClick={onVerpasst} title="Kunde ist nicht erschienen – zählt als Fehlversuch">Nicht erschienen</button>}
            {istTermin && !a.abgesagt && <button type="button" className="ca-knopf still" disabled={busy} onClick={() => setModus("uebergeben")}><UserRoundCheck size={15} strokeWidth={1.75} /> Übergeben</button>}
            {gebucht && <button type="button" className="ca-knopf rot" disabled={busy} onClick={() => setModus("absagen")}>Absagen</button>}
          </div>
        )}
        {a.quelle === "termin" && !modus && <p className="ca-lade" style={{ marginTop: 12 }}>Diesen Termin hat der Kunde selbst gewählt – verschieben geht nicht. Wenn die Zeit nicht passt: anrufen oder absagen, dann bucht der Kunde neu.</p>}

        {modus === "verschieben" && (
          <div className="ca-form">
            <p>Neuer Zeitpunkt (deutsche Zeit). Die Erinnerung wird erneut fällig.</p>
            <input type="datetime-local" className="ca-feld" value={wert} onChange={(e) => setWert(e.target.value)} aria-label="Neuer Zeitpunkt" />
            <div className="ca-form-knoepfe">
              <button type="button" className="ca-knopf" disabled={!wert || busy} onClick={() => void onVerschieben(wert)}>Speichern</button>
              <button type="button" className="ca-knopf still" onClick={() => setModus(null)}>Abbrechen</button>
            </div>
          </div>
        )}
        {modus === "uebergeben" && (
          <div className="ca-form">
            <p>Wer übernimmt? Der Grund ist Pflicht – der Kollege liest ihn morgen früh. Der Kunde bekommt eine Info-Mail mit dem neuen Ansprechpartner; die Zeit bleibt.</p>
            <select className="ca-feld" value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Neuer Ansprechpartner">
              <option value="">Wer übernimmt?</option>
              {kollegen.map((k) => <option key={k.id} value={k.id}>{k.name} — {k.rolle}{k.zustaendig ? " · zuständig" : soll ? " · Vertretung" : ""}</option>)}
            </select>
            <input type="text" className="ca-feld" value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="Grund — zum Beispiel: krank bis Freitag" aria-label="Grund der Übergabe" />
            <div className="ca-form-knoepfe">
              <button type="button" className="ca-knopf" disabled={!agentId || grund.trim().length < 5 || busy} onClick={() => void onUebergeben(Number(agentId), grund.trim())}>{busy ? "Übergibt …" : "Übergeben & Kunden informieren"}</button>
              <button type="button" className="ca-knopf still" onClick={() => setModus(null)}>Abbrechen</button>
              {(!agentId || grund.trim().length < 5) && <small>{!agentId ? "Bitte einen Kollegen auswählen." : "Bitte den Grund in einem Satz."}</small>}
            </div>
          </div>
        )}
        {modus === "absagen" && (
          <div className="ca-form">
            <p>Der Termin wird abgesagt und der Kunde informiert. Er kann danach einen neuen Termin wählen.</p>
            <div className="ca-form-knoepfe">
              <button type="button" className="ca-knopf rot" disabled={busy} onClick={onAbsagen}>{busy ? "Sagt ab …" : "Ja, absagen"}</button>
              <button type="button" className="ca-knopf still" onClick={() => setModus(null)}>Nein</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Termin anlegen: eigener Kunde + Zeitpunkt → POST /agent/termine ──────────
function Anlegen({ vorschlag, onZu, onFertig }: { vorschlag: string; onZu: () => void; onFertig: (meldung: string) => void }) {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<{ personId: number; name: string; telefon?: string | null }[]>([]);
  const [sucht, setSucht] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<{ personId: number; name: string } | null>(null);
  const [wann, setWann] = useState(vorschlag);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setTreffer([]); return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSucht(true);
      api(`/agent/kunden/liste?q=${encodeURIComponent(q.trim())}&limit=12`).then((r) => { setTreffer(r.ok ? (r.json.kunden || []) : []); setSucht(false); }).catch(() => setSucht(false));
    }, 250);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);
  const speichern = async () => {
    if (!gewaehlt || !wann) return;
    const beginn = berlinIso(wann); if (!beginn) { setFehler("Zeitpunkt unlesbar."); return; }
    setBusy(true); setFehler(null);
    const r = await api("/agent/termine", { method: "POST", body: JSON.stringify({ personId: gewaehlt.personId, beginn }) });
    setBusy(false);
    if (r.ok) onFertig(`Termin angelegt: ${r.json?.termin?.datumText || ""} ${r.json?.termin?.uhrzeit || ""} Uhr – ${gewaehlt.name} bekommt eine Bestätigung.`);
    else setFehler(r.json?.error || "Der Termin konnte nicht angelegt werden.");
  };
  return (
    <div className="ca-dialog-hintergrund" onClick={onZu} role="dialog" aria-modal="true">
      <div className="ca-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ca-dialog-kopf"><div><h2>Termin anlegen</h2><small>Für einen deiner Kunden. Er bekommt eine Bestätigung per E-Mail.</small></div><button type="button" className="ca-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button></div>
        <div className="ca-form" style={{ marginTop: 0 }}>
          {!gewaehlt ? (
            <>
              <div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 14, top: 15, color: "#64748b" }} /><input className="ca-feld" style={{ paddingLeft: 38 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kunde suchen – Name, E-Mail, Nummer" autoFocus aria-label="Kunde suchen" /></div>
              {sucht && <p>Sucht …</p>}
              {!sucht && q.trim().length >= 2 && treffer.length === 0 && <p>Niemand gefunden. Nur eigene Kunden lassen sich eintragen.</p>}
              <div className="ca-treffer">{treffer.map((k) => <button key={k.personId} type="button" onClick={() => setGewaehlt({ personId: k.personId, name: k.name })}><span>{k.name}</span><small>{k.telefon || ""}</small></button>)}</div>
            </>
          ) : (
            <>
              <div className="ca-treffer"><button type="button" className="an" onClick={() => setGewaehlt(null)}><span>{gewaehlt.name}</span><small>ändern</small></button></div>
              <p>Zeitpunkt (deutsche Zeit). Buchungen außerhalb deiner Verfügbarkeit lehnt das System ab.</p>
              <input type="datetime-local" className="ca-feld" value={wann} onChange={(e) => setWann(e.target.value)} aria-label="Zeitpunkt" />
            </>
          )}
          {fehler && <p className="ca-fehler">{fehler}</p>}
          <div className="ca-form-knoepfe">
            <button type="button" className="ca-knopf" disabled={!gewaehlt || !wann || busy} onClick={() => void speichern()}>{busy ? "Legt an …" : "Termin anlegen"}</button>
            <button type="button" className="ca-knopf still" onClick={onZu}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTGESPRÄCHE (aus startgespraeche.tsx, Onboarding-Rolle)
// ═══════════════════════════════════════════════════════════════════════════
interface SgTermin {
  id: number; personId: number; name: string; vorname: string | null; telefon: string | null; email: string | null;
  beginn: string; datum: string; datumText: string; uhrzeit: string; dauerMin: number; status: string; notiz: string | null;
  heute: boolean; vorbei: boolean; erledigtAm?: string | null; abgesagtAm?: string | null; quelle?: string | null;
  terminArtText?: string | null; terminArtTon?: string | null;
}
interface Kennzahlen { heuteGeplant?: number; heuteErledigt?: number; heuteNoShow?: number; wartend?: number; wartendOhneTermin?: number; freigeschaltetWoche?: number }
interface Wartender { personId: number; name: string; telefon: string | null; email: string | null; paket: string | null; tage: number | null; terminAm: string | null; eingeladenAm: string | null; verpasst: number }
const sgErledigt = (t: SgTermin) => t.status === "erledigt" || t.status === "verpasst" || !!t.erledigtAm || !!t.abgesagtAm;

function Startgespraeche() {
  const [termine, setTermine] = useState<SgTermin[]>([]);
  const [zahlen, setZahlen] = useState<Kennzahlen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [zusageOffen, setZusageOffen] = useState(false);
  const [reiter, setReiter] = useState<"offen" | "erledigt" | "wartende">("offen");
  const [offen, setOffen] = useState<number | null>(null);
  const [cockpit, setCockpit] = useState<SgTermin | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; warn?: boolean } | null>(null);
  const flash = (text: string, warn = false) => { setMeldung({ text, warn }); setTimeout(() => setMeldung(null), 4500); };

  const laden = useCallback(async () => {
    const r = await api("/agent/onboarding/termine");
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { setZusageOffen(true); setLaedt(false); return; }
    if (r.ok) setTermine(r.json.termine || []);
    const k = await api("/agent/onboarding/kennzahlen");
    if (k.ok) setZahlen(k.json);
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const offene = useMemo(() => termine.filter((t) => !sgErledigt(t)), [termine]);
  const erledigte = useMemo(() => termine.filter(sgErledigt).sort((a, b) => +new Date(b.erledigtAm ?? b.beginn) - +new Date(a.erledigtAm ?? a.beginn)), [termine]);
  const tage = useMemo(() => {
    const map = new Map<string, SgTermin[]>();
    for (const t of (reiter === "erledigt" ? erledigte : offene)) { const l = map.get(t.datum) || []; l.push(t); map.set(t.datum, l); }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [offene, erledigte, reiter]);

  if (zusageOffen) return <div className="ca-hell"><ZusageTafel basis="/agent/onboarding/zusage" ton="dunkel" onAngenommen={() => { setZusageOffen(false); setLaedt(true); void laden(); }} /></div>;

  return (
    <>
      {meldung && <p className={`ca-meldung${meldung.warn ? " warn" : ""}`}>{meldung.text}</p>}
      <section className="ca-zahlen">
        {[
          ["Heute geplant", zahlen?.heuteGeplant, "Startgespräche, die heute stattfinden sollen."],
          ["Heute erledigt", zahlen?.heuteErledigt, "Heute geführte Gespräche – jedes hat ein Konto freigeschaltet."],
          ["Nicht erschienen", zahlen?.heuteNoShow, "Heute nicht erschienen. Diese Kunden werden automatisch erneut eingeladen."],
          ["Wartet auf Gespräch", zahlen?.wartend, "Bezahlte Kunden, deren Konto bis zum Startgespräch eingeschränkt bleibt – hausweit."],
          ["Davon ohne Termin", zahlen?.wartendOhneTermin, "Wartende, die noch keinen Termin gewählt haben."],
          ["Freigeschaltet (7 Tage)", zahlen?.freigeschaltetWoche, "Konten, die in den letzten sieben Tagen voll freigeschaltet wurden."],
        ].map(([t, w, h], i) => <div key={String(t)} className={`ca-zahl${i === 3 ? " hervor" : ""}`} title={String(h)}><small>{t}</small><b>{zahlen ? (w ?? 0) : "–"}</b></div>)}
      </section>

      <div className="ca-reiter" role="tablist">
        {([["offen", "Offen", offene.length], ["erledigt", "Erledigt", erledigte.length], ["wartende", "Wartende", zahlen?.wartendOhneTermin ?? 0]] as const).map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={reiter === k} className={reiter === k ? "an" : ""} onClick={() => setReiter(k)}>{l} <em>{n}</em></button>
        ))}
      </div>

      {reiter === "wartende" && <Wartende onGeaendert={() => void laden()} flash={flash} />}

      {reiter !== "wartende" && (
        <section className="ca-sg-liste">
          {laedt && <p className="ca-lade">Lade …</p>}
          {!laedt && tage.length === 0 && (
            <div className="ca-block"><p className="ca-leer">{reiter === "erledigt" ? "Noch nichts abgeschlossen. Geführte und verpasste Gespräche stehen hier – mit Haken und Uhrzeit." : `Kein offenes Startgespräch. Bezahlte Kunden werden beim ersten Login eingeladen und wählen ihre Zeit selbst.${erledigte.length ? ` ${erledigte.length} bereits bearbeitete stehen unter „Erledigt“.` : ""}`}</p></div>
          )}
          {!laedt && tage.map(([datum, liste]) => (
            <div key={datum}>
              <span className={`ca-tag-titel${liste[0].heute ? " heute" : ""}`}>{liste[0].heute ? "Heute" : liste[0].datumText}</span>
              <div className="ca-sg-liste">
                {liste.map((t) => <SgKarte key={t.id} t={t} offen={offen === t.id} onOeffnen={() => setOffen(offen === t.id ? null : t.id)} onFertig={() => void laden()} onCockpit={() => setCockpit(t)} flash={flash} />)}
              </div>
            </div>
          ))}
        </section>
      )}

      {cockpit && (
        <OnboardingCockpit
          termin={{ id: cockpit.id, personId: cockpit.personId, name: cockpit.name, telefon: cockpit.telefon ?? null, email: cockpit.email ?? null, beginn: cockpit.beginn, datumText: cockpit.datumText, uhrzeit: cockpit.uhrzeit, dauerMin: cockpit.dauerMin, status: cockpit.status }}
          onZu={() => setCockpit(null)}
          onFertig={(m) => { setCockpit(null); flash(`Startgespräch abgeschlossen. ${m || ""}`); void laden(); }}
          onAnrufen={(nummer, personId, name) => anrufen(nummer, personId, name)}
        />
      )}
    </>
  );
}

function SgKarte({ t, offen, onOeffnen, onFertig, onCockpit, flash }: { t: SgTermin; offen: boolean; onOeffnen: () => void; onFertig: () => void; onCockpit: () => void; flash: (text: string, warn?: boolean) => void }) {
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [notizFehler, setNotizFehler] = useState<string | null>(null);
  useEffect(() => {
    if (!offen) return;
    let weg = false;
    void api(`/agent/onboarding/person/${t.personId}/verlauf`).then((r) => { if (!weg) setVerlauf(r.ok ? (r.json.verlauf ?? []) : []); });
    return () => { weg = true; };
  }, [offen, t.personId]);
  const notizSpeichern = async () => {
    const text = notiz.trim();
    if (text.length < 2) { setNotizFehler("Bitte etwas mehr als ein Zeichen."); return; }
    setBusy("notiz"); setNotizFehler(null);
    const r = await api(`/agent/onboarding/person/${t.personId}/notiz`, { method: "POST", body: JSON.stringify({ notiz: text }) });
    setBusy(null);
    if (!r.ok) { setNotizFehler(r.json?.error || "Die Notiz wurde nicht gespeichert."); return; }
    setNotiz(""); setVerlauf(r.json.verlauf ?? []); flash("Notiz gespeichert – sie steht im Verlauf des Kunden.");
  };
  const dokumentieren = async (ergebnis: "erledigt" | "verpasst") => {
    setBusy(ergebnis);
    const r = await api(`/agent/onboarding/termine/${t.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis, notiz: notiz.trim() || undefined }) });
    setBusy(null);
    if (!r.ok) { flash(r.json?.error || "Nicht gespeichert – bitte erneut versuchen.", true); return; }
    flash(r.json.hinweis || "Festgehalten."); setNotiz(""); onFertig();
  };
  const einladen = async () => {
    setBusy("einladung");
    const r = await api(`/agent/onboarding/person/${t.personId}/einladung`, { method: "POST" });
    setBusy(null);
    flash(r.ok ? `Einladung verschickt an ${t.email}` : (r.json?.error || r.json?.grund || "Nicht verschickt – bitte später erneut."), !r.ok);
  };
  return (
    <div className={`ca-sg-karte${t.heute ? " heute" : ""}`}>
      <div className="ca-sg-kopf">
        <div className="ca-zeit"><b>{t.uhrzeit}</b><small>{t.dauerMin} min</small></div>
        <div className="ca-wer" onClick={onOeffnen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOeffnen(); }}>
          <b>{t.name}</b>
          <small>
            {t.terminArtText && <span className="ca-marke blau" style={t.terminArtTon ? { color: t.terminArtTon, borderColor: `${t.terminArtTon}66` } : undefined}>{t.terminArtText}</span>}
            <span>{t.telefon || "keine Nummer hinterlegt"}</span>
            {t.status === "erledigt" && <span className="ca-marke kunde"><Check size={10} style={{ marginRight: 3 }} />erledigt{t.erledigtAm ? ` · ${uhr(new Date(t.erledigtAm))}` : ""}</span>}
            {t.status === "verpasst" && <span className="ca-marke warn">nicht erschienen</span>}
            {!!t.abgesagtAm && <span className="ca-marke">vom Kunden abgesagt · {zeitTag(t.abgesagtAm)}</span>}
          </small>
        </div>
        <div className="ca-aktion">
          {t.status === "gebucht" && <button type="button" className="ca-knopf klein" onClick={onCockpit}>Gespräch führen</button>}
          {t.telefon && <button type="button" className="ca-knopf klein still" onClick={() => anrufen(t.telefon, t.personId, t.name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>}
          <button type="button" className="ca-knopf klein still" onClick={onOeffnen}>{offen ? "Zu" : "Mehr"}</button>
        </div>
      </div>
      {offen && (
        <div className="ca-sg-auf">
          <div><span className="ca-sg-titel">Lage des Kunden</span><div className="ca-hell"><LageTafel personId={t.personId} basis="/agent/onboarding/person" /></div></div>
          {t.status === "gebucht" && (
            <div>
              <span className="ca-sg-titel">Ergebnis festhalten</span>
              <div className="ca-aktion" style={{ justifyContent: "flex-start" }}>
                <button type="button" className="ca-knopf klein" onClick={onCockpit} disabled={!!busy}>Gespräch führen</button>
                <button type="button" className="ca-knopf klein still" onClick={() => void dokumentieren("erledigt")} disabled={!!busy}>{busy === "erledigt" ? "…" : "Nachtragen: geführt"}</button>
                <button type="button" className="ca-knopf klein still" onClick={() => void dokumentieren("verpasst")} disabled={!!busy}>{busy === "verpasst" ? "…" : "Nicht erschienen"}</button>
                <button type="button" className="ca-knopf klein still" onClick={() => void einladen()} disabled={!!busy}>{busy === "einladung" ? "…" : "Einladung erneut senden"}</button>
              </div>
              <p className="ca-lade" style={{ marginTop: 8 }}>„Nicht erschienen“ zählt wie ein erfolgloser Anruf und lädt den Kunden erneut ein.</p>
            </div>
          )}
          <div>
            <span className="ca-sg-titel">Notiz zum Kunden</span>
            <textarea className="ca-feld" rows={2} value={notiz} onChange={(e) => { setNotiz(e.target.value); setNotizFehler(null); }} placeholder="Was ist zu wissen? Steht danach im Verlauf des Kunden." aria-label="Notiz zum Kunden" />
            <div className="ca-form-knoepfe" style={{ marginTop: 8 }}>
              <button type="button" className="ca-knopf klein still" onClick={() => void notizSpeichern()} disabled={busy === "notiz" || notiz.trim().length < 2}>{busy === "notiz" ? "Speichert …" : "Notiz speichern"}</button>
              {notizFehler && <small style={{ color: "#f87171" }} role="alert">{notizFehler}</small>}
            </div>
            {!verlauf && <p className="ca-lade" style={{ marginTop: 8 }}>Lade Verlauf …</p>}
            {verlauf && verlauf.length === 0 && <p className="ca-lade" style={{ marginTop: 8 }}>Noch kein Eintrag.</p>}
            {verlauf && verlauf.length > 0 && <ul className="ca-verlauf-liste">{verlauf.map((v: any, i: number) => <li key={i}><b>{zeitTag(v.am)}</b> · <span>{v.agent_name || "System"}</span>{v.notiz && <> — {v.notiz}</>}</li>)}</ul>}
          </div>
          {t.notiz && <p className="ca-notiz">Gesprächsnotiz: {t.notiz}</p>}
          <Link href={`/agent/kunden?person=${t.personId}`} className="ca-link"><ExternalLink size={14} /> Zur Akte</Link>
        </div>
      )}
    </div>
  );
}

function Wartende({ onGeaendert, flash }: { onGeaendert: () => void; flash: (text: string, warn?: boolean) => void }) {
  const [zeilen, setZeilen] = useState<Wartender[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nur, setNur] = useState<"ohne_termin" | "alle">("ohne_termin");
  const [busy, setBusy] = useState<number | null>(null);
  const [link, setLink] = useState<Record<number, string>>({});
  const laden = useCallback(async () => {
    const r = await api("/agent/onboarding/wartende");
    if (r.ok) { setZeilen(r.json.wartende || []); setFehler(null); } else setFehler(r.json?.error || `Die Liste kam nicht (HTTP ${r.status}).`);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const einladen = async (w: Wartender) => {
    setBusy(w.personId);
    const r = await api(`/agent/onboarding/wartende/${w.personId}/einladung`, { method: "POST" });
    setBusy(null);
    if (r.json?.terminLink) setLink((l) => ({ ...l, [w.personId]: r.json.terminLink }));
    if (r.ok) { flash(`Einladung verschickt – ${w.name} hat den Terminlink per E-Mail bekommen.`); void laden(); onGeaendert(); }
    else flash(r.json?.error || r.json?.grund || "Nicht verschickt – bitte anrufen und den Link durchgeben.", true);
  };
  const sichtbar = (zeilen ?? []).filter((w) => nur === "alle" || !w.terminAm);
  return (
    <section className="ca-block">
      <div className="ca-block-kopf">
        <div><b>Bezahlt, aber noch kein Startgespräch</b><br /><small>Hausweit, nach Wartezeit sortiert. Ohne Termin: Terminlink mit einem Klick. Ohne Reaktion: anrufen.</small></div>
        <div className="ca-wartend-filter">{([["ohne_termin", "Ohne Termin"], ["alle", "Alle Wartenden"]] as const).map(([k, l]) => <button key={k} type="button" className={nur === k ? "an" : ""} onClick={() => setNur(k)}>{l}</button>)}</div>
      </div>
      {fehler && <p className="ca-fehler">{fehler} <button type="button" className="ca-knopf klein still" style={{ marginLeft: 8 }} onClick={() => void laden()}>Noch einmal laden</button></p>}
      {!zeilen && !fehler && <p className="ca-lade">Lade …</p>}
      {zeilen && sichtbar.length === 0 && <p className="ca-leer">Niemand wartet{nur === "ohne_termin" ? " ohne Termin" : ""}.</p>}
      {sichtbar.map((w) => (
        <div key={w.personId} className="ca-zeile" style={{ gridTemplateColumns: "1fr auto", cursor: "default" }}>
          <div className="ca-wer">
            <b>{w.name}</b>
            <small><span>{w.paket || "Paket"}</span>{w.tage != null && <span>· bezahlt vor {w.tage} {w.tage === 1 ? "Tag" : "Tagen"}</span>}{w.verpasst > 0 && <span>· {w.verpasst}× nicht erschienen</span>}</small>
            <span className={`ca-stand ${w.terminAm ? "gut" : w.eingeladenAm ? "warn" : "rot"}`}>{w.terminAm ? `Termin gebucht: ${zeitTag(w.terminAm)}` : w.eingeladenAm ? `Eingeladen am ${zeitTag(w.eingeladenAm)} — noch keine Buchung` : "Noch nie eingeladen"}</span>
            {link[w.personId] && <span className="ca-code">Terminlink zum Durchgeben: {link[w.personId]}</span>}
          </div>
          <div className="ca-aktion">
            {w.telefon && <button type="button" className="ca-knopf klein" onClick={() => anrufen(w.telefon, w.personId, w.name)}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>}
            {!w.terminAm && <button type="button" className="ca-knopf klein still" disabled={busy === w.personId} onClick={() => void einladen(w)}>{busy === w.personId ? "Sendet …" : w.eingeladenAm ? "Erneut einladen" : "Einladung senden"}</button>}
            <Link href={`/agent/kunden?person=${w.personId}`} className="ca-knopf klein still">Akte</Link>
          </div>
        </div>
      ))}
    </section>
  );
}
