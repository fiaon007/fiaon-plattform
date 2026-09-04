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
import { TERMIN_ARTEN, terminArtAusQuelle } from "@shared/fiaon-termin-art";
import { nachbereitungsWege, nachLageSatz, type NachEingang, type NachLage }
  from "@shared/fiaon-anruf-nachbereitung";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

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

/**
 * Wie lange noch bis zum Termin — 24.08.2026.
 *
 * Justin: „neben der Uhrzeit steht überall ‚20 min' — da soll stehen, wie
 * viele Minuten noch bis zum Termin, oder Stunden, wenn es zu lange ist."
 * VORHER stand dort die DAUER des Gesprächs. Die ist bei jedem Termin
 * dieselbe (20 Minuten) und sagt deshalb nichts — sie stand bei allen
 * Karten gleich da. NACHHER sagt die Zeile, wann es so weit ist: „in 12 Min",
 * „in 3 Std", „gleich", oder bei einem verstrichenen Termin „seit 5 Min".
 */
function bisZumTermin(d: Date, jetzt: number): string {
  const min = Math.round((new Date(d).getTime() - jetzt) / 60000);
  if (min >= -1 && min <= 1) return "jetzt";
  if (min > 0) {
    if (min < 60) return `in ${min} Min`;
    const std = Math.floor(min / 60);
    if (std < 24) return min % 60 === 0 ? `in ${std} Std` : `in ${std} Std ${min % 60} Min`;
    const tage = Math.round(std / 24);
    return tage === 1 ? "morgen" : `in ${tage} Tagen`;
  }
  const weg = -min;
  if (weg < 60) return `seit ${weg} Min`;
  const std = Math.floor(weg / 60);
  if (std < 24) return `seit ${std} Std`;
  const tage = Math.round(std / 24);
  return tage === 1 ? "seit gestern" : `seit ${tage} Tagen`;
}
const datumKurz = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const datumLang = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
const zeitTag = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** Ein Datum (Mittag UTC) zu einem Tagesschlüssel — damit +n Tage nie die Berliner Tagesgrenze verfehlt. */
const ausKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const plusTage = (key: string, n: number) => { const d = ausKey(key); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); };
// ═══════════════════════════════════════════════════════════════════════════
// DER UMRECHNER IST WEG — UND DAS IST DIE KORREKTUR
//
// ── DER BEFUND (25.08.2026, 11:58 Uhr) ────────────────────────────────────
// Florentine: „Ich kann keinen Termin anlegen. 11 Uhr morgen ist frei und in
// meiner Dienstzeit." Justin: „Verfügbarkeit is aber?" Florentine: „Ja …
// Termin ist frei aber einen Termin erstellen geht trotzdem nicht."
//
// In fiaon_termin_versuche standen ihre vier Versuche mit dem Grund
// `kein_slot` — und mit dem Zeitpunkt, der beim Server ANKAM:
//   2026-08-26 09:00 Berlin.
// Sie hatte 11:00 eingetippt. Zwei Stunden zu früh, also vor ihrem
// Dienstbeginn um 10:00. Der Server hat völlig richtig abgelehnt; er bekam
// nie die Zeit, die sie gemeint hat.
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Hier stand eine Funktion `berlinIso`, die die Wandzeit in einen absoluten
// Zeitpunkt umrechnen sollte. Sie lief zwei Runden und zog den Zeitversatz in
// JEDER Runde erneut ab — von dem bereits berichtigten Wert statt vom
// Ausgangswert. Nach der ersten Runde stimmte das Ergebnis, die zweite hat es
// wieder kaputtgemacht.
//
// GEMESSEN über alle 52.704 Viertelstunden des Jahres 2026 (beide
// Zeitumstellungen enthalten): 52.698 davon falsch — 100,0 %. Im Sommer um
// zwei Stunden daneben, im Winter um eine. JEDER von Hand angelegte Termin
// war betroffen, seit es die Funktion gibt.
//
// ── WARUM ERSATZLOS ───────────────────────────────────────────────────────
// Der Server kann das längst und besser: `parseBerlinInput`
// (server/lib/fiaon-time.ts) nimmt eine nackte Wandzeit als Berliner Zeit und
// beherrscht die Zeitumstellung sauber. Genau so schickt das Verschieben im
// selben Dialog seinen Wert — es hat nie gehakt. Es gab also zwei Sprachen in
// einer Datei, und die zweite war die kaputte.
//
// Ein reparierter Umrechner wäre wieder eine zweite Stelle, an der dieselbe
// Rechnung passiert. Eine Rechnung, die es nur einmal gibt, kann nicht
// auseinanderlaufen. Das `datetime-local`-Feld liefert bereits genau das
// Format, das der Server erwartet.
// ═══════════════════════════════════════════════════════════════════════════
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
// ═══════════════════════════════════════════════════════════════════════════
// DAS ZEITFENSTER DER WOCHENANSICHT
//
// Justin, 24.08.2026: „Mach den Kalender bitte so ‚kleiner', dass man darin
// nicht mehr scrollen muss — man soll auf 1 Blick eine volle und cleane
// Übersicht haben."
//
// VORHER wurden immer volle 24 Stunden gezeichnet, fest mit 44 px je Stunde:
// 1.056 px hoch in einem Kasten mit `max-height: 72vh`. Das Raster MUSSTE
// scrollen — und zwar durch acht Stunden Nacht, in denen nie ein Termin liegt.
//
// NACHHER zeigt die Woche nur das Fenster, in dem wirklich etwas passiert:
// die hinterlegten Arbeitszeiten, erweitert um jeden Termin, der außerhalb
// davon liegt (sonst würde er verschwinden — das wäre der schlimmere Fehler),
// plus eine Stunde Luft oben und unten. Die Stundenhöhe wird danach so
// gerechnet, dass dieses Fenster in den freien Platz passt. Ergebnis: ein Blick
// statt Scrollen, ohne dass ein einziger Termin verlorengeht.
// ═══════════════════════════════════════════════════════════════════════════
const MIN_BLOCK = 34;               // Mindesthöhe eines Terminblocks – lesbar auch bei 20 min
const MIN_SPANNE = 8;               // nie weniger als 8 Stunden zeigen – sonst wirkt der Tag gestaucht
const STUNDE_PX_MIN = 26;           // darunter wird eine Stunde unlesbar
const STUNDE_PX_MAX = 62;           // darüber wirkt ein leerer Tag auseinandergezogen

/** Das Fenster [vonStunde, bisStunde) aus Arbeitszeiten und Terminen. */
function zeitFenster(bloecke: [number, number][], termineMin: number[]): [number, number] {
  const werte: number[] = [];
  for (const [v, b] of bloecke) { werte.push(v); werte.push(b); }
  // Termine zählen mit ihrem Ende (großzügig 60 min), damit der letzte nicht
  // halb am unteren Rand klebt.
  for (const m of termineMin) { werte.push(m); werte.push(m + 60); }
  if (!werte.length) return [8, 20];                       // nichts hinterlegt: der klassische Bürotag
  let von = Math.floor(Math.min(...werte) / 60) - 1;
  let bis = Math.ceil(Math.max(...werte) / 60) + 1;
  von = Math.max(0, von); bis = Math.min(24, bis);
  // Auf die Mindestspanne aufziehen – erst nach unten, dann nach oben.
  while (bis - von < MIN_SPANNE && bis < 24) bis++;
  while (bis - von < MIN_SPANNE && von > 0) von--;
  return [von, bis];
}
const anrufen = (nummer: string | null | undefined, personId: number | null | undefined, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId: personId ?? null, name } })); };

// ── Termin (zwei Quellen: Verlauf = eigene Notiz, Termin = vom Kunden gebucht) ──
interface Termin {
  id: number; ref: string; payment_reference?: string | null; outcome: string | null;
  scheduled_at: string | null; promised_date: string | null; note: string | null;
  first_name: string | null; last_name: string | null; contact_name: string | null; company_name: string | null;
  payment_status: string; phone: string | null; phone_country_code: string | null; contact_phone: string | null;
  art?: "verlauf" | "termin"; schluessel?: string; status?: string; abgesagt?: boolean; absageText?: string | null;
  buchungsquelle?: string; person_id?: number | null; quelle?: string; dauer_min?: number | null;
  // ── WER HAT GEBUCHT? (24.08.2026) ────────────────────────────────────────
  // VORHER leitete die Anzeige das aus `quelle === "termin"` ab — und das ist
  // nur die DATENQUELLE (fiaon_termine statt Verlauf). Ein vom Mitarbeiter
  // selbst eingetragener Rückruf (`buchungsquelle='agent_manuell'`) steht auch
  // dort und wurde deshalb als „Kunde hat gebucht" ausgegeben. NACHHER sagt es
  // der Server (`selbstGebucht`), und die Marke folgt ihm.
  selbstGebucht?: boolean; herkunft?: string | null;
  terminArtText?: string | null; terminArtTon?: string | null; terminArtErklaerung?: string | null;
}
const tName = (a: Termin) => a.company_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || a.ref;
const tPhone = (a: Termin) => a.phone ? `${a.phone_country_code || ""}${a.phone}`.replace(/\s/g, "") : a.contact_phone ? a.contact_phone.replace(/\s/g, "") : null;
const tZeit = (a: Termin) => new Date(a.scheduled_at || a.promised_date || 0);
const tKey = (a: Termin) => a.schluessel ?? `${a.art ?? "verlauf"}:${a.id}`;
// ── HAT DER KUNDE SELBST GEWÄHLT? (24.08.2026) ──────────────────────────────
// Die eine Antwort für alle drei Anzeigen (Zeile, Popover, Dialog) und für den
// Hinweis „verschieben geht nicht". Der Server liefert `selbstGebucht`; die
// zweite Bedingung ist der Rückfall, falls eine ältere Antwort das Feld noch
// nicht trägt — dann entscheidet dieselbe Regel aus der Buchungsquelle.
const tSelbstGebucht = (a: Termin) =>
  a.quelle === "termin" && (a.selbstGebucht ?? a.buchungsquelle !== "agent_manuell");
// ── DER TERMIN FUEHRT IN SEINEN ARBEITSBEREICH (27.08.2026, Team-P.11) ─────
// Vorher landete JEDER Klick in der CRM-Akte — auch ein Onboarding-Termin
// (dort fehlen Agenda und Abschluss) und ein Zahlungs-Termin (dort fehlt die
// Forderungssicht). Jetzt entscheidet die Terminart:
//   onboarding_call → Onboarding-Raum (Gespraech fuehren, dokumentieren,
//                     abschliessen — erst DER Abschluss schaltet den Kunden
//                     frei und beendet den gemeldeten Buchungs-Kreislauf)
//   inkasso_call    → Forderungsmanagement (Collections-Sicht)
//   alles andere    → CRM-/Vertriebsakte wie bisher
const akteHref = (a: { person_id?: number | null; personId?: number | null; ref?: string | null; quelle?: string }) => {
  const pid = a.person_id ?? a.personId;
  if (a.quelle === "onboarding_call" && pid) return `/agent/onboarding?person=${pid}`;
  if (a.quelle === "inkasso_call" && pid) return `/agent/collections?person=${pid}`;
  return pid ? `/agent/kunden?person=${pid}` : `/agent/kunden?ref=${encodeURIComponent(a.ref || "")}`;
};

interface Block { wochentag: number; von: string; bis: string }

// ── Spaltenaufteilung im Wochenraster ───────────────────────────────────────
// Blöcke bekommen eine Mindesthöhe (MIN_BLOCK); wer sich dadurch – oder echt –
// überlappt, wird nebeneinander versetzt statt übereinander gestapelt.
interface WLage { top: number; hoehe: number; links: number; breite: number } // top/hoehe px, links/breite %
function wochenLayout(liste: Termin[], H: number, vonMin: number, gesamtPx: number): Map<string, WLage> {
  const its = liste.map((a) => {
    const dauer = Math.max(15, Number(a.dauer_min) || 30);
    const hoehe = Math.max(MIN_BLOCK, (dauer / 60) * H);
    // Der Versatz um `vonMin` ist der Kern: 09:00 sitzt jetzt bei 09:00 minus
    // Fensteranfang, nicht mehr bei „neun Stunden ab Mitternacht".
    const top = Math.max(0, Math.min(((minuten(tZeit(a)) - vonMin) / 60) * H, gesamtPx - hoehe));
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

  // 25.08.2026 (Florentine): „Der Kalender sollte beim Öffnen standardmäßig
  // direkt auf heute stehen." Die Woche bleibt einen Klick entfernt.
  const [ansicht, setAnsicht] = useState<"tag" | "woche">("tag");
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

  // ── 24.08.2026: „HEUTE N TERMINE" HIESS HIER ETWAS ANDERES ALS AUF DEM
  // DASHBOARD ──────────────────────────────────────────────────────────────
  // Diese Seite mischt ZWEI Quellen (GET /agent/calendar): gebuchte Termine
  // aus fiaon_termine UND selbst notierte Rückrufe/Zahlungs-Zusagen aus
  // fiaon_contact_log — und zählte beides zusammen als „Termine",
  // einschließlich der abgesagten. Das Dashboard zählt über /agent/termine
  // NUR die gebuchten, nicht abgesagten Termine.
  // GEMESSEN am 24.08.2026: Daniel Stripling (Konto 8) Dashboard 3 gegen
  // Kalender 6, Nikita Boychenko (Konto 13) 1 gegen 2, Rifka Rovcanin
  // (Konto 811) 2 gegen 3.
  // NACHHER trennt der Kopf die beiden Mengen und benennt sie. Die Zahl
  // „Termine" ist damit dieselbe wie auf dem Dashboard; die Liste darunter
  // zeigt weiter beides, denn beides ist Arbeit für heute.
  const heuteTermine = useMemo(() => heuteListe.filter((a) => a.quelle === "termin" && !a.abgesagt), [heuteListe]);
  const heuteRueckrufe = useMemo(() => heuteListe.filter((a) => a.quelle !== "termin"), [heuteListe]);
  const wocheGesamt = useMemo(
    () => wochenKeys.reduce((s, k) => s + proTag(k).filter((a) => !a.abgesagt).length, 0),
    [wochenKeys, proTag],
  );

  // ── Aktionen (unverändert aus kalender.tsx) ──────────────────────────────
  const entfernen = (a: Termin) => setTermine((v) => v.filter((x) => tKey(x) !== tKey(a)));
  // ══════════════════════════════════════════════════════════════════════════
  // DER HAKEN — UND WOHIN DER KUNDE DANACH GEHT
  //
  // ── DIE FRAGE (Justin, 25.08.2026) ────────────────────────────────────────
  // „Wenn ich im Kalender auf den Haken klicke, dass es gepasst hat (nicht das
  // X) — wo verschwindet der Kunde dann hin?"
  //
  // ── DIE EHRLICHE ANTWORT WAR: NIRGENDWOHIN ────────────────────────────────
  // Bei einem STARTGESPRÄCH tat der Haken viel — Konto freischalten, Mail,
  // Bonus. Bei jedem ANDEREN Termin (Vertrieb, Rückruf, Zahlung) setzte er nur
  // `status = erledigt` und schrieb eine Zeile in den Verlauf. Kein Ergebnis,
  // keine Zusage, keine Wiedervorlage. Der Mensch blieb exakt dort, wo er
  // vorher war — gleiche Stufe, gleiches Zusagedatum — und tauchte in der
  // Arbeitsliste wieder auf, als hätte das Gespräch nie stattgefunden.
  //
  // GEMESSEN am 25.08.2026: 47 von 69 erledigten Nicht-Onboarding-Terminen
  // haben KEIN Gesprächsergebnis. 68 Prozent.
  //
  // Das ist derselbe Fehler, der beim Startgespräch schon einmal behoben wurde
  // — im Code steht es wörtlich: „Der Kalender war damit eine zweite Tür zur
  // selben Handlung, und die folgenlose."
  //
  // ── NACHHER ───────────────────────────────────────────────────────────────
  // Der Haken fragt nach dem Ergebnis, bevor er den Termin schließt — mit
  // GENAU denselben Wegen wie das Softphone nach dem Auflegen (die geprüfte
  // Entscheidung aus shared/fiaon-anruf-nachbereitung.ts). Eine Wahrheit,
  // zwei Türen.
  // Startgespräche behalten ihren eigenen Weg: Dort ist das Ergebnis die
  // Freischaltung, und die Frage wäre eine zweite, andere.
  const erledigt = async (a: Termin) => {
    const art = a.terminArtText || (a.quelle ? terminArtAusQuelle(a.quelle).text : "");
    const istStart = a.quelle === "onboarding_call" || art === "Onboarding";
    if (!istStart && a.person_id) { setAbschluss(a); return; }
    setBusy(tKey(a));
    const r = a.art === "termin"
      ? await api(`/agent/termine/${a.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis: "erledigt" }) })
      : await api(`/agent/calendar/${a.id}/done`, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Termin als erledigt markiert."); entfernen(a); setDetail(null); laden(); } else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };

  /** Der Termin, für den gerade das Ergebnis gefragt wird. */
  const [abschluss, setAbschluss] = useState<Termin | null>(null);

  /** Ergebnis festhalten UND den Termin schließen — in dieser Reihenfolge. */
  const abschlussBuchen = async (a: Termin, art: string, zusatz: Record<string, unknown>) => {
    setBusy(tKey(a));
    const e = await api(`/agent/crm/kunden/${a.person_id}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art, ...zusatz }),
    });
    if (!e.ok) { setBusy(null); flash(e.json?.error || "Das Ergebnis wurde nicht gespeichert.", true); return false; }
    // Erst wenn das Ergebnis steht, wird der Termin geschlossen. Andersherum
    // wäre der Termin weg und das Ergebnis verloren.
    const r = a.art === "termin"
      ? await api(`/agent/termine/${a.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis: "erledigt" }) })
      : await api(`/agent/calendar/${a.id}/done`, { method: "POST" });
    setBusy(null);
    flash(r.ok ? (e.json?.meldung || "Ergebnis festgehalten.") : (r.json?.error || "Ergebnis steht, Termin blieb offen."), !r.ok);
    setAbschluss(null); entfernen(a); setDetail(null); laden();
    return true;
  };
  /**
   * Der Termin kam nicht zustande — mit Grund, und der Grund entscheidet.
   * 24.08.2026 (Justin): „wenn man aufs X klickt, eben wieder gefragt warum
   * nicht, und entsprechend dann ein E-Mail-Event auslösen (aber auch die
   * Funktion: Kunde löschen!)". Der Server bekommt den Grund und löst die
   * passende Nachricht aus; die Karte sagt danach, WAS passiert ist.
   */
  const nichtZustande = async (a: Termin, grund: string) => {
    if (grund === "kein_interesse") {
      const sicher = window.confirm(
        `${tName(a)} will nicht mehr?\n\n`
        + "Der Mensch wird gesperrt: Er erscheint bei keinem Mitarbeiter mehr, "
        + "und die Verteilung fasst ihn nicht mehr an. Zahlungs- und "
        + "Vertragsdaten bleiben erhalten — gelöscht wird nichts.",
      );
      if (!sicher) return;
    }
    setBusy(tKey(a));
    const r = a.art === "termin"
      ? await api(`/agent/termine/${a.id}/nicht-zustande`, { method: "POST", body: JSON.stringify({ grund }) })
      : await api(`/agent/calendar/${a.id}/done`, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Vermerkt."); entfernen(a); setDetail(null); laden(); }
    else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };

  const verpasst = async (a: Termin) => {
    if (a.art !== "termin") return;
    setBusy(tKey(a));
    const r = await api(`/agent/termine/${a.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis: "verpasst" }) });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Als nicht erschienen vermerkt."); entfernen(a); setDetail(null); laden(); } else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };
  // ── ZWEI ARTEN, ZWEI WEGE (25.08.2026) ──────────────────────────────────
  // Daniel und Florentine: „Eine Funktion zum Verschieben fehlt."
  // Sie fehlte wirklich — aber nur für ECHTE Termine. Die vorhandene Route
  // (/agent/calendar/:logId/reschedule) verschiebt Einträge im Kontaktverlauf,
  // also Rückrufe und Zahlungszusagen. Termine aus fiaon_termine kannte sie
  // nicht, deshalb war der Knopf an `art !== "termin"` gebunden und erschien
  // bei einem gebuchten Termin nie.
  // NACHHER entscheidet die ART, welcher Weg genommen wird — der Knopf steht
  // bei beiden.
  const verschieben = async (a: Termin, wert: string) => {
    setBusy(tKey(a));
    const r = a.art === "termin"
      ? await api(`/agent/termine/${a.id}/verschieben`, { method: "POST", body: JSON.stringify({ beginn: wert }) })
      : await api(`/agent/calendar/${a.id}/reschedule`, { method: "POST", body: JSON.stringify({ scheduledAt: wert }) });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis ? `${r.json.meldung} ${r.json.hinweis}` : (r.json?.meldung || "Termin verschoben.")); setDetail(null); laden(); return true; }
    flash(r.json?.error || "Das hat nicht geklappt.", true); return false;
  };
  const uebergeben = async (a: Termin, agentId: number, grund: string, trotzdem = false): Promise<boolean> => {
    setBusy(tKey(a));
    const r = await api(`/agent/termine/${a.id}/uebergeben`, { method: "POST", body: JSON.stringify({ agentId, grund, trotzdem }) });
    setBusy(null);
    if (r.ok) { flash(r.json?.hinweis || "Termin übergeben."); setDetail(null); laden(); return true; }
    // 04.09.2026 (E-120): Der Kollege hat zur Terminzeit keine Zeit hinterlegt.
    // Die Leitung darf übersteuern (Krankheit, Vertretung) — mit Rückfrage.
    if (r.status === 409 && r.json?.code === "NICHT_VERFUEGBAR" && !trotzdem && r.json?.hinweis?.includes("Leitung")) {
      if (window.confirm(`${r.json.error}\n\nTrotzdem übergeben? Der Grund steht dann im Verlauf des Kunden.`)) {
        return uebergeben(a, agentId, `${grund} (außerhalb seiner Zeiten, Leitung hat übersteuert)`, true);
      }
      return false;
    }
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

  // ── DAS ZEITFENSTER UND DIE STUNDENHÖHE (24.08.2026) ─────────────────────
  // Siehe den Kopfkommentar bei `zeitFenster`. Hier wird beides für die gerade
  // gezeigte Woche gerechnet: erst das Fenster aus Arbeitszeiten UND Terminen,
  // dann die Stundenhöhe, die dieses Fenster in den freien Platz einpasst.
  const [platzH, setPlatzH] = useState(620);
  const [vonStunde, bisStunde] = useMemo(() => {
    const alleBloecke: [number, number][] = [];
    for (let wd = 1; wd <= 7; wd++) alleBloecke.push(...freiAm(wd));
    const inWoche = termine.filter((a) => wochenKeys.includes(dayKey(tZeit(a))));
    return zeitFenster(alleBloecke, inWoche.map((a) => minuten(tZeit(a))));
  }, [freiAm, termine, wochenKeys]);
  const spanne = Math.max(1, bisStunde - vonStunde);
  const vonMin = vonStunde * 60;
  const stundePx = Math.min(STUNDE_PX_MAX, Math.max(STUNDE_PX_MIN, Math.floor(platzH / spanne)));
  const rasterPx = spanne * stundePx;

  // Wie viel Platz ist da? Vom oberen Rand des Rasters bis zum Fensterende,
  // abzüglich Legende und Luft. Wird bei jeder Größenänderung neu gemessen.
  useEffect(() => {
    if (ansicht !== "woche" || laedt) return;
    const messen = () => {
      const el = wocheRef.current;
      if (!el) return;
      const oben = el.getBoundingClientRect().top;
      const KOPFZEILE = 58;   // die klebende Tagesleiste im Raster
      const RESERVE = 96;     // Legende darunter + Luft zum Rand
      const frei = window.innerHeight - oben - KOPFZEILE - RESERVE;
      setPlatzH((alt) => (Math.abs(alt - frei) > 4 ? Math.max(200, frei) : alt));
    };
    messen();
    window.addEventListener("resize", messen);
    const t = window.setTimeout(messen, 120);   // nach dem ersten Aufbau nachfassen
    return () => { window.removeEventListener("resize", messen); window.clearTimeout(t); };
  }, [ansicht, laedt, spanne]);
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
  // 24.08.2026: Das automatische Scrollen auf 08:00 ist entfallen — das Raster
  // beginnt jetzt selbst am Anfang des Arbeitsfensters, es gibt nichts mehr
  // wegzuscrollen.

  const wochenTitel = `${datumKurz(ausKey(wochenKeys[0]))} – ${datumKurz(ausKey(wochenKeys[6]))}`;
  const tagDate = ausKey(tagKey);

  return (
    <div className="ca">
      <section className="ca-kopf">
        <div>
          <span className="ca-pille">{datumLang(jetzt)} · {uhr(jetzt)} Uhr</span>
          <h1>{heuteListe.length ? <>Heute <span className="ca-verlauf">{heuteTermine.length} {heuteTermine.length === 1 ? "Termin" : "Termine"}</span>{heuteRueckrufe.length ? <>, {heuteRueckrufe.length} {heuteRueckrufe.length === 1 ? "Rückruf" : "Rückrufe"}</> : null}{ueberfaellig.length ? <>, {ueberfaellig.length} überfällig.</> : "."}</> : ueberfaellig.length ? <><span className="ca-verlauf">{ueberfaellig.length} überfällig</span> – heute frei.</> : <>Heute <span className="ca-verlauf">frei.</span></>}</h1>
          <p>Rückrufe, Zusagen und Termine, die Kunden bei dir gebucht haben. Grau ist außerhalb deiner Verfügbarkeit – dort kommen keine neuen Buchungen.</p>
        </div>
        <div className="ca-lage">
          <small>Diese Woche</small>
          {/* 24.08.2026: Die Wochenzahl schloss Abgesagte schon immer aus, die
              Tageszahl darüber nicht — zwei Auffassungen von „Termin" auf
              EINER Seite. Jetzt sagt die Beschriftung, was gezählt wird:
              gebuchte Termine UND notierte Rückrufe, ohne die abgesagten. */}
          <div className="ca-lage-zahl"><b>{wocheGesamt}</b><span>Termine &amp; Rückrufe</span></div>
          <div className="ca-lage-zeile"><span>Überfällig</span><b className={ueberfaellig.length ? "warn" : ""}>{ueberfaellig.length}</b></div>
          <div className="ca-lage-zeile"><span>Verfügbarkeit</span><b className={vollstaendig ? "" : "warn"}>{stundenWoche == null ? "–" : `${stundenWoche.toLocaleString("de-DE")} h / Woche`}</b></div>
          <Link href="/agent/arbeitszeiten" className="ca-link">{vollstaendig ? "Zeiten ändern" : "Verfügbarkeit eintragen"} <ChevronRight size={14} /></Link>
        </div>
      </section>

      {fehler && <p className="ca-fehler">{fehler}</p>}
      {meldung && <p className={`ca-meldung${meldung.warn ? " warn" : ""}`}>{meldung.text}</p>}

      {/* E-051: Startgespräche haben ihren eigenen Raum – hier nur der Wegweiser. */}
      {/* 24.08.2026 (Justin): VORHER stand hier nur der Onboarding-Wegweiser —
          wer ihn las, hielt ALLE Termine im Kalender für Startgespräche.
          NACHHER sagt der Banner zuerst, was dieser Kalender zeigt (nämlich
          jede Art von Termin), und verweist danach auf den Raum, in dem eine
          davon geführt wird. Die Farblegende darunter macht die Arten
          unterscheidbar. */}
      <div className="ca-arten">
        <p className="ca-arten-satz">
          Hier stehen <b>alle deine Termine</b> — Vertriebsgespräche, Rückrufe, Zahlungsgespräche
          und Startgespräche. Die Farbe links an jedem Termin sagt dir, welche Art es ist.
        </p>
        <span className="ca-arten-legende">
          {TERMIN_ARTEN.map((a) => (
            <em key={a.text} title={a.erklaerung}><i style={{ background: a.ton }} />{a.text}</em>
          ))}
        </span>
        <Link href="/agent/onboarding" className="ca-hinweiskarte schmal">
          <Sparkles size={15} strokeWidth={1.75} />
          <span>Startgespräche <b>führst</b> du im Raum Onboarding – mit Cockpit und Wartenden.</span>
          <em>Zum Raum <ChevronRight size={14} /></em>
        </Link>
      </div>

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

      {ansicht === "tag" && !laedt && (
        <section className="ca-block">
          <div className="ca-block-kopf"><b>{tagKey === heuteKey ? "Heute" : datumLang(tagDate)}</b>{/* 24.08.2026: Die Zeile zählt genau das, was darunter steht — gebuchte
             Termine und notierte Rückrufe. Vorher hieß beides „Termine". */}
          <small>{tagListe.length ? `${tagListe.length} ${tagListe.length === 1 ? "Eintrag" : "Einträge"}` : "nichts geplant"}</small></div>
          <Tagband frei={freiAm(teile(tagDate).wd)} jetzt={tagKey === heuteKey ? minuten(jetzt) : null} />
          {tagListe.length === 0 && <p className="ca-leer">{freiAm(teile(tagDate).wd).length ? "Kein Termin an diesem Tag. Deine Zeiten sind frei für Buchungen." : "Kein Termin – und keine Verfügbarkeit an diesem Tag. Kunden können hier nichts buchen."}</p>}
          {tagListe.map((a) => <Zeile key={tKey(a)} a={a} busy={busy === tKey(a)} onAkte={() => zurAkte(a)} onOeffnen={() => setDetail(a)} onErledigt={() => erledigt(a)} ausser={!inVerfuegbarkeit(tZeit(a))} jetzt={jetzt.getTime()} onNichtZustande={(g) => void nichtZustande(a, g)} />)}
        </section>
      )}

      {/* 25.08.2026 (Florentine): „zuerst die normalen Termine und darunter
          die überfälligen" — der Tag zuerst, das Aufräumen danach. */}
      {!laedt && ueberfaellig.length > 0 && (
        <section className="ca-block">
          <div className="ca-block-kopf"><b className="warn">Überfällig ({ueberfaellig.length})</b><small>Nach dem Tagesgeschäft aufräumen: Ergebnis nachtragen oder neu ansetzen.</small></div>
          {ueberfaellig.map((a) => <Zeile key={tKey(a)} a={a} datum busy={busy === tKey(a)} onAkte={() => zurAkte(a)} onOeffnen={() => setDetail(a)} onErledigt={() => erledigt(a)} ausser={!inVerfuegbarkeit(tZeit(a))} jetzt={jetzt.getTime()} onNichtZustande={(g) => void nichtZustande(a, g)} />)}
        </section>
      )}

      {ansicht === "woche" && !laedt && (
        <>
          <section className="ca-woche" aria-label="Wochenansicht" ref={wocheRef} onScroll={() => setPopover(null)}>
            <div className="ca-w-zeiten">
              <div className="ca-w-ecke" />
              <div className="ca-w-zeitspalte" style={{ height: rasterPx }}>
                {Array.from({ length: spanne + 1 }, (_, i) => <span key={i} style={{ top: i * stundePx }}>{String((vonStunde + i) % 24).padStart(2, "0")}</span>)}
              </div>
            </div>
            {wochenKeys.map((key, i) => {
              const d = ausKey(key); const liste = proTag(key); const frei = freiAm(i + 1); const istHeute = key === heuteKey;
              const lage = wochenLayout(liste, stundePx, vonMin, rasterPx);
              // Minuten seit Mitternacht → Pixel im Fenster. Der Versatz um
              // `vonMin` ist der Unterschied zu vorher.
              const px = (m: number) => ((m - vonMin) / 60) * stundePx;
              return (
                <div key={key} className={`ca-w-tag${istHeute ? " heute" : ""}`}>
                  <button type="button" className="ca-w-kopf" onClick={() => { setTagKey(key); setAnsicht("tag"); }} title="Tag öffnen">
                    {istHeute ? <em>Heute</em> : <b>{TAGE[i]}</b>}<small>{datumKurz(d)}</small>{istHeute && <b style={{ fontSize: 11 }}>{TAGE[i]}</b>}
                  </button>
                  <div className="ca-w-spalte" style={{ height: rasterPx }}>
                    <div className="ca-w-ausser" style={{ top: 0, bottom: 0 }} />
                    {frei.map(([v, b], k) => <div key={k} className="ca-w-frei" style={{ top: px(v), height: px(b) - px(v) }} />)}
                    {Array.from({ length: spanne + 1 }, (_, h) => <div key={h} className="ca-w-linie" style={{ top: h * stundePx }} />)}
                    {istHeute && minuten(jetzt) >= vonMin && minuten(jetzt) <= bisStunde * 60 && <div className="ca-w-jetzt" style={{ top: px(minuten(jetzt)) }} />}
                    {liste.map((a) => {
                      const l = lage.get(tKey(a))!;
                      const kompakt = l.hoehe < 50; // erst ab ausreichender Höhe zweizeilig
                      const ton = a.terminArtTon || (a.art === "verlauf" ? "#94a3b8" : "#3b82f6");
                      return (
                        <button key={tKey(a)} type="button"
                                className={`ca-w-termin${a.art === "verlauf" ? " verlauf" : ""}${a.abgesagt ? " abgesagt" : ""}${a.status === "verpasst" ? " verpasst" : ""}${tZeit(a) < jetzt && !a.abgesagt ? " vorbei" : ""}${!inVerfuegbarkeit(tZeit(a)) ? " ausser" : ""}${kompakt ? " kompakt" : ""}`}
                                style={{ top: l.top, height: l.hoehe, left: `calc(${l.links}% + 3px)`, width: `calc(${l.breite}% - 6px)`, "--ca-ton": ton } as CSSProperties}
                                onClick={(e) => window.matchMedia("(hover: none)").matches ? popAuf(a, e.currentTarget, true) : zurAkte(a)}
                                onMouseEnter={(e) => hoverAuf(a, e.currentTarget)}
                                onMouseLeave={hoverZu}
                                title={`${uhr(tZeit(a))} ${tName(a)} – Klick öffnet die Akte`}>
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
                  {liste.map((a) => <Zeile key={tKey(a)} a={a} busy={busy === tKey(a)} onAkte={() => zurAkte(a)} onOeffnen={() => setDetail(a)} onErledigt={() => erledigt(a)} ausser={!inVerfuegbarkeit(tZeit(a))} jetzt={jetzt.getTime()} onNichtZustande={(g) => void nichtZustande(a, g)} />)}
                </div>
              );
            })}
          </section>
        </>
      )}

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

      {abschluss && (
        <TerminAbschluss a={abschluss} busy={busy === tKey(abschluss)}
                         onZu={() => setAbschluss(null)}
                         onBuchen={(art, zusatz) => abschlussBuchen(abschluss, art, zusatz)} />
      )}

      {/* ── Der Rundgang: GENAU EINMAL ────────────────────────────────────────
          24.08.2026: VORHER stand er INNERHALB der Tagesschleife der
          Wochenansicht — also siebenmal nebeneinander. Sieben Rundgänge
          bedeuten sieben Scheinwerfer, sieben Karten übereinander und sieben
          Wiederhol-Knöpfe an derselben Stelle. NACHHER steht er einmal an der
          Wurzel der Seite, unabhängig davon, ob gerade Tag oder Woche gezeigt
          wird. */}
      <Rundgang raum="calendar" titel={RUNDGAENGE.calendar.titel} schritte={RUNDGAENGE.calendar.schritte} />
    </div>
  );
}

// ── Eine Terminzeile ─────────────────────────────────────────────────────────
/**
 * Warum ein Termin nicht zustande kam — und was jeder Grund auslöst.
 *
 * 24.08.2026 (Justin): „wenn man aufs X klickt, eben wieder gefragt warum
 * nicht, und entsprechend dann ein E-Mail-Event auslösen (aber auch die
 * Funktion: Kunde löschen!)". Der Grund darf nicht nur dokumentiert werden —
 * der Kunde muss die passende Nachricht bekommen. Die `folge` steht bewusst
 * unter jedem Knopf: Wer klickt, soll vorher wissen, was der Kunde erhält.
 */
const GRUENDE: { key: string; label: string; folge: string }[] = [
  { key: "nicht_erschienen", label: "Nicht erschienen / nicht abgenommen",
    folge: "Er bekommt eine Mail mit dem Link auf einen neuen Termin." },
  { key: "nummer_falsch", label: "Telefonnummer stimmt nicht",
    folge: "Er wird gebeten, seine Rufnummer selbst zu berichtigen." },
  { key: "abgesagt", label: "Hat abgesagt / passte nicht",
    folge: "Der Termin wird abgesagt, er bekommt eine neue Einladung." },
];

function Zeile({ a, datum, busy, ausser, jetzt, onAkte, onOeffnen, onErledigt, onNichtZustande }: { a: Termin; datum?: boolean; busy: boolean; ausser: boolean; jetzt: number; onAkte: () => void; onOeffnen: () => void; onErledigt: () => void; onNichtZustande: (grund: string) => void }) {
  const tel = tPhone(a); const d = tZeit(a);
  const [grundOffen, setGrundOffen] = useState(false);
  // 24.08.2026 (Justin): „Entferne den farbigen Strich auf der linken Seite
  // der Karte." Die Art des Termins steht ohnehin als Marke im Text — der
  // Strich war eine zweite Aussage über dieselbe Sache. Die Klasse `mit-ton`
  // (und mit ihr der Balken) ist damit weg; im Wochenraster bleibt sie.
  // E-051: 1 Klick auf die Zeile → Kundenakte; das X öffnet die Gründe.
  return (
    <div className={`ca-zeile${a.abgesagt ? " abgesagt" : ""}`} onClick={onAkte} role="button" tabIndex={0} title="Klick öffnet die Akte" onKeyDown={(e) => { if (e.key === "Enter") onAkte(); }}>
      <div className={`ca-zeit${ausser ? " ausser" : ""}`}>
        <b>{uhr(d)}</b>
        <small>{datum ? datumKurz(d) : ausser ? "außerhalb" : bisZumTermin(d, jetzt)}</small>
      </div>
      <div className="ca-wer">
        <b>{tName(a)}</b>
        {a.absageText && <span className="ca-hinweis warn">{a.absageText}</span>}
        {a.status === "verpasst" && <span className="ca-hinweis rot">Ohne Ergebnis verstrichen – mit „Nicht erschienen“ abschließen</span>}
        <small>
          {a.terminArtText && <span className="ca-marke blau" title={a.terminArtErklaerung || undefined} style={a.terminArtTon ? { color: a.terminArtTon, borderColor: `${a.terminArtTon}66` } : undefined}>{a.terminArtText}</span>}
          {/* VORHER: „Kunde hat gebucht" bei JEDEM Datensatz aus fiaon_termine —
              also auch bei einem Rückruf, den der Mitarbeiter selbst
              eingetragen hat. NACHHER entscheidet `selbstGebucht`. */}
          {a.quelle === "termin"
            ? (tSelbstGebucht(a)
                ? <span className="ca-marke kunde">Kunde hat gebucht</span>
                : <span>selbst eingetragen</span>)
            : <span>{a.scheduled_at ? "selbst notiert" : "Zahlungs-Zusage"}</span>}
          {ausser && <span className="ca-marke warn" title="Liegt außerhalb deiner eingetragenen Verfügbarkeit"><Clock size={10} style={{ marginRight: 4 }} />außerhalb deiner Zeiten</span>}
        </small>
      </div>
      {/* 24.08.2026 (Justin): VORHER „Anrufen · Haken · Mehr". „Mehr" führte in
          einen Dialog und sagte nicht, wofür es gut ist. NACHHER sagen die drei
          Knöpfe, wie der Termin ausgeht: anrufen, erledigt (Haken), oder er kam
          nicht zustande (X) — dann fragt die Karte nach dem Grund, und der
          Grund löst das Passende aus. */}
      <div className="ca-aktion" onClick={(e) => e.stopPropagation()}>
        {tel && <button type="button" className="ca-knopf klein" onClick={() => anrufen(tel, a.person_id, tName(a))}><Phone size={14} strokeWidth={1.75} /> Anrufen</button>}
        <button type="button" className="ca-knopf klein gut" disabled={busy || a.abgesagt === true}
                title={a.abgesagt ? "Dieser Termin ist abgesagt." : "Gespräch hat stattgefunden"}
                onClick={onErledigt} aria-label="Erledigt"><Check size={15} strokeWidth={2} /></button>
        <button type="button" className="ca-knopf klein rot" disabled={busy || a.abgesagt === true}
                title="Termin kam nicht zustande — Grund wählen"
                onClick={() => setGrundOffen((v) => !v)} aria-label="Termin kam nicht zustande" aria-expanded={grundOffen}>
          <X size={15} strokeWidth={2} />
        </button>
        <button type="button" className="ca-knopf klein still" onClick={onOeffnen} title="Alle Angaben zum Termin">Details</button>
      </div>

      {grundOffen && (
        <div className="ca-gruende" onClick={(e) => e.stopPropagation()}>
          <p>Warum kam der Termin nicht zustande?</p>
          {GRUENDE.map((g) => (
            <button key={g.key} type="button" className="ca-grund" disabled={busy}
                    onClick={() => { setGrundOffen(false); onNichtZustande(g.key); }}>
              <b>{g.label}</b><small>{g.folge}</small>
            </button>
          ))}
          <button type="button" className="ca-grund rot" disabled={busy}
                  onClick={() => { setGrundOffen(false); onNichtZustande("kein_interesse"); }}>
            <b>Kunde will nicht mehr</b><small>Keine Mail. Der Mensch wird gesperrt und erscheint bei niemandem mehr.</small>
          </button>
          <button type="button" className="ca-link-klein" onClick={() => setGrundOffen(false)}>zurück</button>
        </div>
      )}
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
          {/* Wie in der Zeile: nur bei `selbstGebucht` (24.08.2026). */}
          {a.quelle === "termin"
            ? (tSelbstGebucht(a)
                ? <span className="ca-marke kunde">Kunde hat gebucht</span>
                : <span className="ca-marke">selbst eingetragen</span>)
            : <span className="ca-marke">{a.scheduled_at ? "selbst notiert" : "Zahlungs-Zusage"}</span>}
          {a.abgesagt && <span className="ca-marke warn">{a.absageText || "abgesagt"}</span>}
          {a.status === "verpasst" && <span className="ca-marke rot">nicht erschienen – offen</span>}
          {ausser && <span className="ca-marke warn">außerhalb deiner Zeiten</span>}
        </div>
        {a.note && <p className="ca-popover-notiz">{a.note}</p>}
        <div className="ca-popover-knoepfe">
          {/* E-051: „Akte“ ist der Hauptweg – am Handy groß im Bottom-Sheet. */}
          <Link href={akteHref(a)} className="ca-knopf klein akte"><ExternalLink size={13} strokeWidth={1.75} /> Zur Akte</Link>
          {tel && <button type="button" className="ca-knopf klein still" onClick={() => anrufen(tel, a.person_id, tName(a))}><Phone size={13} strokeWidth={1.75} /> Anrufen</button>}
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
  // ══════════════════════════════════════════════════════════════════════════
  // DAS FELD IST VORGEFÜLLT (26.08.2026, Florentines Punkt 7)
  //
  // „Wenn ich einen Termin am Laptop im Kalender verschieben möchte, wird die
  // eingetragene Uhrzeit teilweise nicht übernommen. Am Handy funktioniert
  // die Änderung, am Laptop hingegen nicht."
  //
  // URSACHE: Das Feld startete LEER. Auf dem Handy öffnet `datetime-local`
  // einen Auswahldialog, der Datum UND Uhrzeit erzwingt. Am Laptop besteht
  // das Feld aus einzelnen Abschnitten (TT.MM.JJJJ --:--); wer nur das Datum
  // tippt und die Uhrzeit stehen lässt, hat entweder einen leeren Wert
  // (Knopf bleibt aus) oder 00:00 — und der Termin landet um Mitternacht.
  //
  // NACHHER steht die BISHERIGE Zeit im Feld. Verschieben heißt fast immer
  // „dieselbe Uhrzeit, anderer Tag" oder umgekehrt — man ändert einen Teil,
  // der andere stimmt schon. Ein leeres Feld verlangt beides neu und
  // verzeiht keinen Fehler.
  // ══════════════════════════════════════════════════════════════════════════
  const [wert, setWert] = useState(() => {
    try {
      const d = new Date(a.scheduled_at ?? "");
      if (isNaN(d.getTime())) return "";
      // Berliner Wandzeit im Format, das `datetime-local` erwartet.
      const t = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(d);
      return t.replace(" ", "T").slice(0, 16);
    } catch { return ""; }
  });
  const [kollegen, setKollegen] = useState<{ id: number; name: string; rolle: string; zustaendig?: boolean; imDienst?: boolean | null; listeVoll?: boolean; mandate?: number; mandateMax?: number }[]>([]);
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
          {/* Wie in der Zeile: nur bei `selbstGebucht` (24.08.2026). Ein selbst
              eingetragener Rückruf heisst hier weiter „Rückruf-Termin". */}
          {a.quelle === "termin"
            ? (tSelbstGebucht(a)
                ? <span className="ca-marke kunde">Kunde hat gebucht</span>
                : <span className="ca-marke">selbst eingetragen</span>)
            : <span className="ca-marke">{a.scheduled_at ? "Rückruf-Termin" : "Zahlungs-Zusage"}</span>}
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
            {/* 25.08.2026: VORHER nur für Verlaufseinträge — bei einem echten
                Termin fehlte der Knopf ganz (Meldung Daniel/Florentine).
                NACHHER bei jedem. */}
            <button type="button" className="ca-knopf still" onClick={() => setModus("verschieben")}>Verschieben</button>
            {istTermin && !a.abgesagt && <button type="button" className="ca-knopf still" disabled={busy} onClick={onVerpasst} title="Kunde ist nicht erschienen – zählt als Fehlversuch">Nicht erschienen</button>}
            {istTermin && !a.abgesagt && <button type="button" className="ca-knopf still" disabled={busy} onClick={() => setModus("uebergeben")}><UserRoundCheck size={15} strokeWidth={1.75} /> Übergeben</button>}
            {gebucht && <button type="button" className="ca-knopf rot" disabled={busy} onClick={() => setModus("absagen")}>Absagen</button>}
          </div>
        )}
        {/* VORHER stand dieser Satz bei jedem Datensatz aus fiaon_termine —
            auch bei einem Rückruf, den der Mitarbeiter SELBST eingetragen hat.
            Der behauptete dann, der Kunde habe die Zeit gewählt. NACHHER nur
            noch bei `selbstGebucht` (24.08.2026). */}
        {/* 25.08.2026: Der Satz sagte „verschieben geht nicht" — das stimmte,
            solange es die Funktion nicht gab. Jetzt geht es, und der Hinweis
            sagt stattdessen, worauf zu achten ist: Der Mensch hat sich diese
            Zeit selbst ausgesucht, also gehört ein Wort dazu. */}
        {tSelbstGebucht(a) && !modus && <p className="ca-lade" style={{ marginTop: 12 }}>Diese Zeit hat der Kunde selbst gewählt. Verschieben geht — sag ihm vorher Bescheid; die neue Zeit bekommt er auch per Mail.</p>}

        {modus === "verschieben" && (
          <div className="ca-form">
            <p>Neuer Zeitpunkt (deutsche Zeit). Die Erinnerung wird erneut fällig.</p>
            <input type="datetime-local" className="ca-feld" value={wert} onChange={(e) => setWert(e.target.value)} aria-label="Neuer Zeitpunkt" />
            {/* Mitternacht ist fast nie gemeint — meist wurde die Uhrzeit
                vergessen. Lieber nachfragen als still um 00:00 buchen. */}
            {/^\d{4}-\d{2}-\d{2}T00:00$/.test(wert) && (
              <p className="ca-lade" style={{ marginTop: 8, color: "#fbbf24" }}>
                Uhrzeit steht auf 00:00 — ist das so gewollt?
              </p>
            )}
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
              {kollegen.map((k) => <option key={k.id} value={k.id}>{k.name} — {k.rolle}{k.zustaendig ? " · zuständig" : soll ? " · Vertretung" : ""}{`${k.imDienst === false ? " · hat zur Terminzeit keine Zeit hinterlegt" : k.imDienst == null ? " · keine Zeiten hinterlegt (nicht buchbar)" : " · hat Zeit"}${(k as any).listeVoll ? ` · Liste voll (${(k as any).mandate}/${(k as any).mandateMax})` : ""}`}</option>)}
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
  // 25.08.2026 (Florentine): „direkt angeben können, um welche Art von Termin
  // es sich handelt" — die Arten sind die bestehenden Gesprächsarten.
  const [art, setArt] = useState<"rueckruf" | "zahlung" | "vertrieb" | "onboarding">("rueckruf");
  const [notiz, setNotiz] = useState("");
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
    // Die Wandzeit geht so, wie sie eingetippt wurde. Der Server liest sie als
    // Berliner Zeit — siehe den Block oben bei der gelöschten `berlinIso`.
    setBusy(true); setFehler(null);
    const r = await api("/agent/termine", { method: "POST", body: JSON.stringify({ personId: gewaehlt.personId, beginn: wann, art, notiz: notiz.trim() || null }) });
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
              <p style={{ marginBottom: 4 }}>Worum geht es?</p>
              <div className="ca-treffer" role="radiogroup" aria-label="Art des Termins">
                {([["rueckruf", "Rückruf"], ["zahlung", "Zahlung"], ["vertrieb", "Vertrieb"], ["onboarding", "Onboarding"]] as const).map(([k, t]) => (
                  <button key={k} type="button" className={art === k ? "an" : ""} role="radio" aria-checked={art === k} onClick={() => setArt(k)}><span>{t}</span></button>
                ))}
              </div>
              <input className="ca-feld" value={notiz} onChange={(e) => setNotiz(e.target.value)}
                     placeholder={art === "rueckruf" ? "Warum der Rückruf? (Pflicht — steht im Termin)" : "Notiz (freiwillig)"}
                     aria-label="Begründung" />
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
// WAS KAM BEI DEM TERMIN HERAUS?
//
// Justin, 25.08.2026: „Wenn ich im Kalender auf den Haken klicke — wo
// verschwindet der Kunde dann hin?"
//
// Bis dahin: nirgendwohin. Der Haken schloss den Termin und ließ den Menschen
// unverändert in seiner Liste stehen. GEMESSEN: 47 von 69 erledigten
// Nicht-Onboarding-Terminen hatten kein Gesprächsergebnis.
//
// Diese Maske stellt dieselbe Frage wie das Softphone nach dem Auflegen und
// benutzt DIESELBE geprüfte Entscheidung (shared/fiaon-anruf-nachbereitung.ts,
// 228 Fälle im Prüfstand). Zwei Türen, eine Wahrheit — sonst hängt es davon
// ab, ob jemand über das Telefon oder über den Kalender abschließt.
// ═══════════════════════════════════════════════════════════════════════════
function TerminAbschluss({ a, busy, onZu, onBuchen }: {
  a: Termin; busy: boolean; onZu: () => void;
  onBuchen: (art: string, zusatz: Record<string, unknown>) => Promise<boolean>;
}) {
  const [urteil, setUrteil] = useState<"gut" | "nicht_erreicht" | "schlecht" | null>("gut");
  const [lage, setLage] = useState<NachEingang | null>(null);
  const [vorname, setVorname] = useState("");
  const [datumFeld, setDatumFeld] = useState<"zusage" | "termin" | null>(null);
  const [datum, setDatum] = useState("");
  const [notizFuer, setNotizFuer] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");

  // Die Lage kommt vom Server — dieselbe Antwort wie die Akte. Ein Termin, bei
  // dem der Mitarbeiter währenddessen etwas eingetragen hat, ist damit richtig
  // erfasst, statt aus dem Kalenderstand geraten.
  useEffect(() => {
    let an = true;
    if (!a.person_id) return;
    api(`/agent/crm/kunden/${a.person_id}`).then((r) => {
      if (!an || !r.ok || !r.json?.kunde) return;
      const k = r.json.kunde;
      setVorname(String(k.name || "").trim().split(/\s+/)[0] || "");
      setLage({
        lage: (r.json.situation?.art ?? "alles_gut") as NachLage,
        hatMandat: !!k.mandatSeit,
        // Der Termin, den wir gerade abschließen, zählt NICHT als „hat einen
        // Termin" — sonst fiele „neuen Termin vereinbart" aus der Auswahl.
        hatTermin: !!(k.terminAm && new Date(k.terminAm).getTime() !== new Date(a.scheduled_at ?? 0).getTime()),
        hatZusage: !!k.zusagedatum,
        ohneKunde: false,
        mitRate: false,
      });
    });
    return () => { an = false; };
  }, [a.person_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const wege = lage && urteil ? nachbereitungsWege(lage, urteil) : [];

  return (
    <div className="ca-dialog-hintergrund" onClick={onZu}>
      <div className="ca-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ergebnis des Termins">
        <div className="ca-dialog-kopf">
          <div>
            <p className="ca-pille" style={{ marginBottom: 8 }}>Termin abschließen</p>
            <h2 style={{ margin: 0, font: "300 22px/1.2 'Inter',sans-serif", color: "#fff" }}>{tName(a)}</h2>
            {lage && <p className="ca-lade" style={{ marginTop: 6 }}>{nachLageSatz(lage, vorname)}</p>}
          </div>
          <button type="button" className="ca-zu" onClick={onZu} aria-label="Schließen">
            <X size={17} />
          </button>
        </div>

        {!lage && <p className="ca-lade">Lade den Stand …</p>}

        {lage && (
          <>
            <div className="ca-urteile">
              {([["gut", "Gut gelaufen"], ["nicht_erreicht", "Nicht erschienen"], ["schlecht", "Kein Interesse"]] as const).map(([k, t]) => (
                <button key={k} type="button"
                        className={`ca-urteil${urteil === k ? " an" : ""} ton-${k}`}
                        onClick={() => { setUrteil(k); setDatumFeld(null); setNotizFuer(null); }}>{t}</button>
              ))}
            </div>

            {datumFeld && (
              <input type={datumFeld === "termin" ? "datetime-local" : "date"} value={datum}
                     onChange={(e) => setDatum(e.target.value)} className="ca-feld"
                     aria-label={datumFeld === "termin" ? "Neuer Rückruf" : "Zugesagtes Zahlungsdatum"} />
            )}
            {notizFuer && (
              <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={3} autoFocus
                        placeholder="Was wurde besprochen oder vereinbart?" className="ca-feld"
                        aria-label="Notiz zum Ergebnis" />
            )}

            <div className="ca-wege">
              {wege.map((w) => (
                <button key={w.art + w.label} type="button" disabled={busy}
                        className={`ca-weg ton-${w.ton ?? "still"}`}
                        onClick={() => {
                          if (w.braucht && datumFeld !== w.braucht) { setDatumFeld(w.braucht); return; }
                          if (w.notizPflicht && notiz.trim().length < 10) { setNotizFuer(w.art); return; }
                          const zusatz: Record<string, unknown> = {};
                          if (w.braucht === "zusage") zusatz.zusageDatum = datum;
                          if (w.braucht === "termin") { zusatz.terminDatum = datum.slice(0, 10); zusatz.terminZeit = datum.slice(11, 16); }
                          if (notiz.trim()) zusatz.notiz = notiz.trim();
                          void onBuchen(w.art, zusatz);
                        }}>
                  <b>{w.label}</b>{w.hinweis && <small>{w.hinweis}</small>}
                </button>
              ))}
            </div>

            <button type="button" className="ca-knopf still" style={{ marginTop: 12, width: "100%" }}
                    disabled={busy} onClick={() => void onBuchen("notiz", { notiz: notiz.trim() || "Termin ohne festgehaltenes Ergebnis abgeschlossen." })}>
              Ohne Ergebnis schließen
            </button>
            <p className="ca-lade" style={{ marginTop: 8 }}>
              Ein Termin ohne Ergebnis ist für den nächsten Anruf ein verlorenes Gespräch — der Mensch
              erzählt dann alles noch einmal.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
