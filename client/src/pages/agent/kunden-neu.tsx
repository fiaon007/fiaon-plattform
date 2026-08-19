import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProduktDialog } from "@/components/agent/ProduktDialog";
import { KundeAnlegen } from "@/components/agent/KundeAnlegen";
import { AgentShell } from "./shared";
import { Reveal } from "./motion";
import { Skelett, eur, useReduzierteBewegung, useToast } from "@/lib/fiaon-ui";
import { ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";
import { statusAusTierGrund, STUFEN, type Stufe } from "@shared/fiaon-kundenstatus";
import { MarkeBrief, SendeMenue } from "@/components/SendeMenue";
import { Gespraechsblatt } from "@/components/Gespraechsblatt";
import { MarkeFunke, anrufStarten } from "@/components/Softphone";
import { RechnungBestaetigung } from "@/components/agent/RechnungBestaetigung";
import { ErgebnisWahl, type ErgebnisAusgang } from "@/components/agent/ErgebnisWahl";
import { ERGEBNIS_TEXT, type Ergebnis } from "@shared/fiaon-kontakt-ergebnis-liste";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/kunden — DIE EINE ARBEITSLISTE
//
// Warum diese Seite die alte Tagesliste ersetzt (Vertrieb, 05.08.2026):
//   Florentine: „Unser Vorschlag wäre daher, alle Kunden ausschließlich unter
//               Meine Kunden zu führen und diese Liste von oben nach unten
//               abzuarbeiten. So hätte jeder einen festen Kundenbestand,
//               Doppelbearbeitungen würden vermieden."
//
// Zwei Listen über denselben Bestand sind zwei Wahrheiten. Also gibt es genau
// eine: diese. Sie enthält JEDEN zugewiesenen Kunden und ist von oben nach unten
// abarbeitbar — die Reihenfolge kommt vom Server (fiaon-agent-start.ts) und
// nimmt dem Agenten die Frage ab, wen er als nächstes anruft:
//
//   1 Gebuchter Termin heute (der Kunde hat die Uhrzeit selbst gewählt)
//   2 Zahlungszusage heute oder überfällig
//   3 Rückruftermin heute oder überfällig
//   4 Stufe A — Zahlung gemeldet
//   5 Stufe B — Rechnung offen → Frist abgelaufen → Antrag abgeschlossen
//   6 Stufe C — Antrag abgebrochen → nur Lead
//   innerhalb jeder Gruppe: längste Wartezeit zuerst
//
// Die Stufen A/B/C sind KEINE neue Einstufung, sondern der Klartext für das
// vorhandene `priority_tier` (shared/fiaon-kundenstatus.ts). Sie stehen als
// Marke auf jeder Karte, damit niemand raten muss, warum die Liste so
// sortiert ist.
//
// Bezahlte Kunden stehen NIE in der Standardliste. Sie sind kein Arbeitsvorrat
// und über den Filter „Bezahlt" erreichbar.
// ═══════════════════════════════════════════════════════════════════════════

interface Kunde {
  personId: number;
  name: string;
  telefon: string | null;
  telefonWaehlbar: string | null;
  telefonHinweis: string | null;
  /** Nummer national geschrieben, Land fehlt → nicht anrufbar (31.08.2026). */
  nummerOhneLand?: boolean;
  /** Der Sperrgrund fuer „Zahlungsdaten senden" — vom Server, bei jedem Laden. */
  sendeGrund?: string | null;
  /** Die fehlenden Pflichtfelder im Klartext („Geburtsdatum, IBAN"). */
  fehlendeFelder?: string | null;
  sendeMoeglich?: boolean;
  sendeText?: string | null;
  sendeTat?: string | null;
  nummerRoh?: string | null;
  landVorschlag?: { land: string | null; grund: string };
  email: string | null;
  tier: number;
  tierGrund: string;
  titel: string;
  hinweis: string;
  produkt: string | null;
  // ── ALLE BUCHUNGEN, NICHT NUR DIE NEUESTE ────────────────────────────────
  // Ein Agent über Shahed Mohammad: „Jetzt ist das Paket bei mir komplett
  // verschwunden und er taucht nur noch wegen der Schufa auf." Er hatte beides
  // gebucht — die Karte zeigte nur den jüngeren Vorgang.
  buchungen?: {
    ref: string; art: "paket" | "bonitaet" | "sonstiges"; bezeichnung: string;
    betragCents: number | null; zahlungText: string; bezahlt: boolean; offen: boolean;
    gestelltAm: string | null; faelligAm: string | null;
    verwendungszweck: string | null; erledigt: boolean;
  }[];
  betrag: number | null;
  zusagedatum: string | null;
  wiedervorlage: string | null;
  rueckrufAm: string | null;
  nichtErreicht: number;
  rechnungVersandt: number;
  stufe: Stufe | null;
  ruhtSeit: string | null;
  terminlinkMailAm: string | null;
  terminAm: string | null;
  terminLink: string;
  gesperrt: boolean;
  betreutSeit: string | null;
  letzterKontakt: string | null;
  letztesErgebnis: string | null;
  stammdaten: { strasse: string | null; plz: string | null; ort: string | null; land: string | null; geburtsdatum: string | null } | null;
  zahlung: {
    referenz: string | null; status: string | null; ref: string | null;
    /** Bankverbindung und fertiger Klartext kommen vom Server — eine Quelle. */
    empfaenger?: string | null; iban?: string | null; bic?: string | null;
    klartext?: string | null;
  } | null;
}

type Zaehler = Record<string, number>;

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

// ── Filter ────────────────────────────────────────────────────────────────
// Reihenfolge nach Dringlichkeit, nicht nach Alphabet: Was man am häufigsten
// braucht, steht links, wo der Daumen zuerst hinkommt.
const FILTER: { key: string; label: string; zaehler: string }[] = [
  { key: "alle", label: "Alle", zaehler: "alle" },
  { key: "zusage_heute", label: "Zusage heute", zaehler: "zusage_heute" },
  { key: "ueberfaellig", label: "Überfällig", zaehler: "ueberfaellig" },
  { key: "rueckruf", label: "Rückruf", zaehler: "rueckruf" },
  { key: "tier1", label: "Zahlung gemeldet", zaehler: "tier1" },
  // Wer einen fertigen Antrag hat, aber nie eine Rechnung bekam. Hier liegt
  // die groesste Menge unerledigter Arbeit im Haus.
  { key: "rechnung_stellen", label: "Rechnung stellen", zaehler: "rechnung_stellen" },
  { key: "rechnung_offen", label: "Rechnung offen", zaehler: "rechnung_offen" },
  { key: "frist_abgelaufen", label: "Frist abgelaufen", zaehler: "frist_abgelaufen" },
  { key: "antrag_offen", label: "Antrag offen", zaehler: "antrag_offen" },
  { key: "leads", label: "Leads", zaehler: "leads" },
  { key: "nicht_erreicht", label: "Nicht erreicht", zaehler: "nicht_erreicht" },
  // Der Ruhe-Pool ist ein Filter, kein Loch: Wer viermal nicht erreicht wurde,
  // steht hier — sichtbar, zählbar, jederzeit aufrufbar.
  { key: "ruhend", label: "Ruhend", zaehler: "ruhend" },
  // ── WARTET AUF DEN KUNDEN ────────────────────────────────────────────────
  // Nummern-Anfrage raus, Antwort steht beim Kunden. GEMESSEN: 185 solche
  // Fälle standen weiter JEDEN TAG in der Arbeitsliste, 120 davon länger als
  // sieben Tage. Sie sind jetzt hier — sichtbar, zählbar, nicht im Weg.
  { key: "wartend", label: "Wartend (Kunde)", zaehler: "wartend" },
  { key: "bezahlt", label: "Bezahlt (Bestand)", zaehler: "bezahlt" },
  { key: "gesperrt", label: "Gesperrt", zaehler: "gesperrt" },
  // ── NUMMER OHNE LAND (31.08.2026) ───────────────────────────────────────
  // Seit dem 31.08.2026 wird eine national geschriebene Nummer ohne Land
  // ABGELEHNT statt geraten (Befund: Kunde Maurizio Pampanini, CH — dreimal
  // wurde +49797435749 gewählt statt +41797435749, also eine fremde deutsche
  // Nummer). Diese Kunden sind damit nicht anrufbar.
  //
  // Ein Filter mit Zähler und nicht eine CSV-Datei: Die Datei wäre nach zwei
  // Tagen vergessen. Der Zähler wird leer, und das sieht man.
  { key: "nummer_ohne_land", label: "Nummer nicht wählbar", zaehler: "nummer_ohne_land" },
];

/**
 * Die Stufen-Marke: ein Buchstabe, ein Klartext.
 *
 * Der Buchstabe allein wäre eine Geheimsprache — deshalb steht der Text
 * daneben, wo Platz ist, und im `title`, wo keiner ist. Beides kommt aus
 * shared/fiaon-kundenstatus.ts, damit Liste, Kopfzeile und Server denselben
 * Wortlaut benutzen.
 */
function StufenMarke({ stufe, kurz = false }: { stufe: Stufe; kurz?: boolean }) {
  const farbe = stufe.ton === "warnung" ? "var(--fi-tier1)"
    : stufe.ton === "offen" ? "var(--fi-tier2)" : "var(--fi-tier3)";
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title={`Stufe ${stufe.marke} — ${stufe.text}. ${stufe.begruendung}`}>
      <span aria-hidden="true"
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] text-[11px] font-bold leading-none"
            style={{ background: farbe, color: "#fff" }}>
        {stufe.marke}
      </span>
      {!kurz && (
        <span className="text-[11.5px] font-semibold" style={{ color: farbe }}>
          {stufe.text}
        </span>
      )}
      <span className="sr-only">Stufe {stufe.marke}: {stufe.text}</span>
    </span>
  );
}

/**
 * Der Vorrat je Stufe — „A: 4 · B: 31 · C: 120".
 *
 * Beantwortet die Frage, die sich ein Agent morgens stellt: Habe ich Pflicht
 * oder Kür vor mir? Eine leere Stufe wird ausgegraut statt versteckt; dass A
 * leer IST, ist die wichtigste Auskunft der Zeile.
 */
function VorratsKopf({ vorrat }: { vorrat: Record<string, number> }) {
  const reihe = (["A", "B", "C"] as const).map((m) => ({ stufe: STUFEN[m], n: vorrat[m] ?? 0 }));
  const pflicht = (vorrat.A ?? 0) + (vorrat.B ?? 0);
  return (
    <div className="fi-karte px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {reihe.map(({ stufe, n }) => (
          <div key={stufe.marke} className="flex items-center gap-2" style={{ opacity: n === 0 ? 0.45 : 1 }}>
            <StufenMarke stufe={stufe} />
            <span className="fi-zahl text-[15px] font-bold leading-none">{n}</span>
          </div>
        ))}
        <p className="text-[12px] ml-auto" style={{ color: "var(--fi-text-still)" }}>
          {pflicht > 0
            ? `${pflicht} in der Pflicht — Stufe C wird erst danach gearbeitet.`
            : (vorrat.C ?? 0) > 0
              ? "A und B sind leer. Jetzt sind die Leads dran."
              : "Nichts offen."}
        </p>
      </div>
    </div>
  );
}

const SORT: { key: string; label: string }[] = [
  { key: "arbeit", label: "Arbeitsreihenfolge" },
  { key: "neu", label: "Zuletzt hinzugefügt" },
  { key: "betrag", label: "Nach Betrag" },
  { key: "name", label: "Nach Name" },
];

// ═══════════════════════════════════════════════════════════════════════════
// DIE ERGEBNISLISTE STEHT NICHT MEHR HIER (19.08.2026)
//
// Hier lagen zwei Fassungen: `ERGEBNISSE` (neun Knöpfe mit `braucht`) und
// `ERGEBNIS_TEXT` (neun Klartexte). Zwei weitere lagen in `Softphone.tsx` und
// im Server, eine fünfte in `kontakt-ergebnis.tsx` — und DIE hatte
// „Erreicht – Sonstiges" gar nicht.
//
// Fünf Fassungen einer Liste sind der Grund, warum dieselbe Meldung dreimal
// kam. Sie stehen jetzt in `shared/fiaon-kontakt-ergebnis-liste.ts`, und die
// Knöpfe rendert `components/agent/ErgebnisWahl.tsx` — ein Bauteil für alle
// Wege.
// ═══════════════════════════════════════════════════════════════════════════

const TIER_FARBE: Record<number, string> = {
  0: "var(--fi-erfolg)", 1: "var(--fi-tier1)", 2: "var(--fi-tier2)", 3: "var(--fi-tier3)",
};

// Statustexte kommen aus dem EINEN Vokabular (shared/fiaon-kundenstatus.ts).
// Hier stand bis zum 08.08.2026 eine eigene Tabelle — eine von neun im Client,
// jede mit eigener Formulierung für denselben Zustand.

function heuteIso(): string {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function tagPlus(n: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function dtag(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
/** Relativ und in Klartext — „heute", „seit 3 Tagen überfällig", „in 4 Tagen". */
function relativ(iso: string | null): { text: string; dringend: boolean } | null {
  if (!iso) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = Math.round((d.getTime() - heute.getTime()) / 86_400_000);
  if (t < 0) return { text: `seit ${Math.abs(t)} ${Math.abs(t) === 1 ? "Tag" : "Tagen"} überfällig`, dringend: true };
  if (t === 0) return { text: "heute", dringend: true };
  if (t === 1) return { text: "morgen", dringend: false };
  return { text: `in ${t} Tagen`, dringend: false };
}
function wartezeit(iso: string | null): string {
  if (!iso) return "noch kein Kontakt";
  const tage = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (tage <= 0) return "heute kontaktiert";
  if (tage === 1) return "gestern kontaktiert";
  return `seit ${tage} Tagen kein Kontakt`;
}

export default function AgentKundenSeite() {
  return (
    <AgentShell>
      <Inhalt />
    </AgentShell>
  );
}

function Inhalt() {
  const [liste, setListe] = useState<Kunde[]>([]);
  const [zaehler, setZaehler] = useState<Zaehler>({});
  const [vorrat, setVorrat] = useState<Record<string, number>>({});
  // Welche Karten in dieser Sitzung schon ein Ergebnis bekommen haben. Sie
  // bleiben an ihrer Stelle stehen — gedämpft und mit Marke — statt sich
  // wegzusortieren.
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [filter, setFilter] = useState("alle");
  // Wer über ?person= angesprungen wurde, muss in der Liste sein — auch wenn
  // der Filter ihn sonst ausblendet.
  const [nurPerson, setNurPerson] = useState<number | null>(null);
  const [sort, setSort] = useState("arbeit");
  const [suche, setSuche] = useState("");
  // Der Anlage-Dialog. Aufgeklappt bleibt er offen, bis der Agent schließt — er
  // arbeitet darin mehrere Schritte ab (anlegen → Zahlungsdaten → Termin).
  const [anlageOffen, setAnlageOffen] = useState(false);
  const [offen, setOffen] = useState<number | null>(null);
  // Wurde die Karte über die Adresse angesprungen (?person=), muss sie sichtbar
  // werden. Bei 150 Zeilen liegt sie sonst weit unter dem Bildrand, und der
  // Agent landet auf einer Liste, die scheinbar nicht auf seinen Klick reagiert.
  const gesprungen = useRef<number | null>(null);
  const reduziert = useReduzierteBewegung();

  // Startseite und Startseiten-Kacheln springen mit ?filter= und ?person= hierher.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("filter");
    if (f && FILTER.some((x) => x.key === f)) setFilter(f);
    const person = p.get("person");
    if (person) {
      setOffen(Number(person));
      gesprungen.current = Number(person);
      // ── DER GESUCHTE KUNDE MUSS IN DER LISTE SEIN ────────────────────────
      // Ein Agent: „Wenn ich auf einen gebuchten Termin klicke, lande ich zwar
      // im Bereich Kunden, aber nicht beim entsprechenden Kunden und muss ihn
      // anschließend nochmal manuell suchen."
      //
      // Der Sprung war gebaut — er ging nur ins Leere, wenn der Kunde nicht in
      // der gerade gefilterten Liste steht. Ein Rückruf kann bei jemandem
      // liegen, der ruht, bezahlt hat oder in einer anderen Stufe ist.
      //
      // `nurPerson` sagt dem Server: Diesen einen liefere mir auf jeden Fall,
      // unabhängig vom Filter.
      setNurPerson(Number(person));
    }
  }, []);

  /**
   * Die Liste holen.
   *
   * ── DER FEHLER, DEN DAS BEHEBT ────────────────────────────────────────────
   * Ein Agent: „Wenn ich bei jemandem ‚zahlt sofort‘ oder ‚nicht erreicht‘
   * drücke, rutscht er einfach 2–3 Leute runter — komme so echt durcheinander."
   *
   * Ursache: Die Liste sortiert nach `promised_payment_date` und
   * `follow_up_date` — genau den Feldern, die ein Ergebnis SETZT. Nach dem
   * Buchen wurde die ganze Liste neu geholt, und der Kunde ordnete sich
   * selbst an eine andere Stelle. Zwei Karten weiter unten stand plötzlich
   * jemand anderes, und der Agent verlor die Zeile, an der er war.
   *
   * Das ist kein Sortierfehler, sondern ein Denkfehler: Wer eine Liste von
   * oben nach unten abarbeitet, braucht eine Liste, die stillhält. Eine
   * Reihenfolge, die sich unter den Händen ändert, macht Fließbandarbeit
   * unmöglich — man muss nach jeder Buchung neu suchen, wo man war.
   *
   * `nurZaehler` holt deshalb nur die Zahlen. Die Reihenfolge bleibt, wie sie
   * war, bis der Agent sie BEWUSST neu ordnet.
   */
  const laden = useCallback(async (leise = false, nurZaehler = false) => {
    if (!leise) setLaedt(true);
    const p = new URLSearchParams({ filter, sort });
    if (suche.trim()) p.set("q", suche.trim());
    if (nurPerson) p.set("person", String(nurPerson));
    const r = await api(`/agent/kunden/liste?${p.toString()}`);
    if (r.ok) {
      // Die Liste NUR ersetzen, wenn es ausdrücklich gewollt ist.
      if (!nurZaehler) {
        setListe(r.json.kunden);
        setErledigt(new Set());
      }
      setZaehler(r.json.zaehler);
      setVorrat(r.json.vorrat || {});
    }
    setLaedt(false);
  }, [filter, sort, suche, nurPerson]);

  useEffect(() => {
    const t = setTimeout(() => void laden(), suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [laden, suche]);

  /** Eine Karte aus der Liste nehmen, ohne die ganze Liste neu zu holen. */
  const entfernen = (personId: number) => {
    setListe((l) => l.filter((k) => k.personId !== personId));
    setErledigt((e) => { const n = new Set(e); n.delete(personId); return n; });
  };
  const ersetzen = (k: Kunde) => setListe((l) => l.map((x) => (x.personId === k.personId ? k : x)));

  const geoeffnet = useMemo(() => liste.find((k) => k.personId === offen) || null, [liste, offen]);

  // Erst wenn die Liste da ist, kann gerollt werden — vorher gibt es die Karte
  // im Dokument nicht. Danach wird der Merker gelöscht, damit ein späteres
  // Aufklappen die Seite nicht ruckelt.
  useEffect(() => {
    const ziel = gesprungen.current;
    if (!ziel || laedt) return;
    const el = document.getElementById(`kunde-${ziel}`);
    if (!el) { gesprungen.current = null; return; }
    el.scrollIntoView({ behavior: reduziert ? "auto" : "smooth", block: "center" });
    gesprungen.current = null;
  }, [laedt, liste, reduziert]);

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: "var(--fi-breite-max)" }}>
        <Reveal index={0}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
                <span className="fi-gradient-text">Kunden</span>
              </h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
                {laedt ? "Lade deine Kunden …"
                  : `${zaehler.alle ?? 0} Kunden gehören dir. Von oben nach unten — die Reihenfolge steht schon.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                      className="h-[36px] px-2.5 rounded-xl border bg-white text-[12.5px] font-semibold outline-none"
                      style={{ borderColor: "var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                {SORT.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <input value={suche} onChange={(e) => setSuche(e.target.value)}
                     placeholder="Name, E-Mail, Nummer, Referenz"
                     className="h-[36px] px-3 rounded-xl border bg-white text-[13px] outline-none w-[190px] sm:w-[250px]"
                     style={{ borderColor: "var(--fi-linie)" }} />
            </div>
          </div>
        </Reveal>

        {/* ══════════════════════════════════════════════════════════════
            KUNDE ANLEGEN (25.08.2026)

            ── DER FEHLGRIFF DAVOR ─────────────────────────────────────
            Dieser Knopf stand zuerst in `pages/agent/kunden.tsx`. Die Route
            /agent/kunden zeigt aber DIESE Datei (kunden-neu.tsx) — die alte
            liegt unter /agent/meine-kunden-alt. Der Browsertest fand den Knopf
            nicht, und erst der SCREENSHOT zeigte, dass eine ganz andere Seite
            geladen war.
            Zwei Dateien mit fast gleichem Namen: Wer eine Seite ändert, prüft
            zuerst in App.tsx, welche die Route bedient.

            ── WARUM HIER OBEN ────────────────────────────────────────
            GEMESSEN am 23.08.: Es gab KEINE Route, mit der ein Mitarbeiter
            einen Kunden anlegen konnte. Der Agent hatte den Menschen am
            Telefon und musste die Verwaltung bitten.
            ══════════════════════════════════════════════════════════════ */}
        <Reveal index={1}>
          <div className="mt-4">
            <KundeAnlegen
              offen={anlageOffen}
              aufKlappen={setAnlageOffen}
              fertig={() => { void laden(true); }}
            />
          </div>
        </Reveal>

        {/* Der eigene Vorrat je Stufe. Zuerst die Frage „Pflicht oder Kür?",
            dann erst die Filter. */}
        {!laedt && (
          <Reveal index={1}>
            <div className="mt-4"><VorratsKopf vorrat={vorrat} /></div>
          </Reveal>
        )}

        {/* Filter-Chips mit Zählern. Ein Chip ohne Zahl ist eine Behauptung —
            die Zahl sagt, ob sich der Klick lohnt. */}
        <Reveal index={2}>
          <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
              {FILTER.map((f) => {
                const n = zaehler[f.zaehler] ?? 0;
                const an = filter === f.key;
                if (!an && n === 0 && f.key !== "alle") return null;
                return (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                          className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150"
                          style={an
                            ? { background: "var(--fi-primaer)", color: "#fff", boxShadow: "0 4px 12px -6px rgba(29,78,216,.6)" }
                            : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                    {f.label}
                    <span className="ml-1.5 fi-zahl" style={{ opacity: an ? 0.85 : 0.55 }}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Liste */}
        {/* ── WOHIN SIND SIE GEGANGEN? ──────────────────────────────────────
            Wer eine Karte verschwinden sieht, muss wissen, wo sie geblieben
            ist. Sonst entsteht das Gefühl, etwas verloren zu haben — und
            genau dieses Gefühl hat den Agenten dazu gebracht, dieselben
            Leute zweimal anzurufen. */}
        {(zaehler?.wartet ?? 0) > 0 && filter !== "nicht_erreicht" && (
          <button type="button" onClick={() => setFilter("nicht_erreicht")}
                  className="fi-kk-wartet">
            <span className="fi-kk-wartet-zahl">{zaehler.wartet}</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="fi-kk-wartet-titel">
                {zaehler.wartet === 1 ? "Einer wartet auf seinen Termin" : `${zaehler.wartet} warten auf ihren Termin`}
              </span>
              <span className="fi-kk-wartet-text">
                Nicht erreicht — sie haben den Buchungslink und wählen selbst eine Uhrzeit.
                Ruf sie nicht erneut an. Antippen, um sie zu sehen.
              </span>
            </span>
          </button>
        )}

        {erledigt.size > 0 && (
          <button type="button" onClick={() => void laden()} className="fi-kk-neuordnen">
            <span className="fi-kk-neuordnen-zahl">{erledigt.size}</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="fi-kk-neuordnen-titel">
                {erledigt.size === 1 ? "Ein Ergebnis gebucht" : `${erledigt.size} Ergebnisse gebucht`}
              </span>
              <span className="fi-kk-neuordnen-text">
                Die Reihenfolge ist absichtlich stehen geblieben, damit du deine Zeile behältst.
                Hier tippen, wenn du neu ordnen willst.
              </span>
            </span>
          </button>
        )}

        {/* ── DIE LEISTEN STEHEN ÜBER DER LISTE ───────────────────────────
            Sie standen zuerst DARUNTER. Bei 937 Kunden sieht das niemand —
            gemessen: Der Zähler stand mit „90" im Dokument, im Bild war er
            nicht. Eine Auskunft, die man erst nach 937 Karten findet, ist
            keine Auskunft. */}
        <div className="mt-4 space-y-2.5">
          {laedt && [0, 1, 2, 3].map((i) => (
            <div key={i} className="fi-karte p-4 sm:p-5">
              <Skelett h={18} w="52%" />
              <div className="mt-2"><Skelett h={13} w="34%" /></div>
              <div className="mt-4 flex gap-2">
                <Skelett h={38} w={116} /><Skelett h={38} w={150} />
              </div>
            </div>
          ))}

          {!laedt && liste.length === 0 && (
            <div className="fi-karte p-6 text-center">
              <p className="text-[14px] font-semibold">
                {suche ? "Kein Treffer." : filter === "alle" ? "Dir ist gerade kein Kunde zugewiesen." : "In dieser Ansicht ist nichts offen."}
              </p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                {suche
                  ? "Suche über Name, E-Mail, Telefonnummer oder Referenz."
                  : filter === "alle"
                    ? "Neue Kunden kommen automatisch dazu. Betreute Kunden bleiben bei dir — niemand nimmt sie dir weg."
                    : "Wechsle auf „Alle“, um deinen gesamten Bestand zu sehen."}
              </p>
            </div>
          )}

          {!laedt && liste.map((k, i) => (
            <KundenKarte
              key={k.personId}
              k={k}
              index={i}
              offen={offen === k.personId}
              onOeffnen={() => setOffen(offen === k.personId ? null : k.personId)}
              onWeg={() => entfernen(k.personId)}
              onNeu={(neu) => ersetzen(neu)}
              erledigt={erledigt.has(k.personId)}
              onErledigt={() => setErledigt((e) => new Set(e).add(k.personId))}
              onZaehler={() => void laden(true, true)}
            />
          ))}
        </div>

        {/* ── DER BEWUSSTE SCHRITT ─────────────────────────────────────────
            Die Liste ordnet sich nicht mehr selbst neu. Wer fertig ist,
            drückt hier — dann verschwinden die erledigten Karten und die
            Reihenfolge stimmt wieder. Das ist der Unterschied zwischen einer
            Liste, die man abarbeitet, und einer, die sich unter den Händen
            bewegt. */}
        {!laedt && liste.length > 0 && (
          <p className="mt-5 text-[11.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
            Diese Liste ist dein Bestand. Kunden, die du dokumentiert hast, bleiben bei dir — die automatische
            Verteilung fasst sie nicht mehr an. Bezahlte Kunden verschwinden aus der Arbeitsliste und stehen unter
            „Bezahlt (Bestand)".
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Eine Karte — sie trägt ALLES, was zum Arbeiten nötig ist
// ═══════════════════════════════════════════════════════════════════════════
function KundenKarte({
  k, index, offen, erledigt, onOeffnen, onWeg, onNeu, onErledigt, onZaehler,
}: {
  k: Kunde; index: number; offen: boolean;
  /** Hat diese Karte in dieser Sitzung schon ein Ergebnis bekommen? */
  erledigt: boolean;
  onOeffnen: () => void; onWeg: () => void; onNeu: (k: Kunde) => void;
  onErledigt: () => void; onZaehler: () => void;
}) {
  const { zeige } = useToast();
  const reduziert = useReduzierteBewegung();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  // ── DIE NACHGETRAGENE E-MAIL (27.08.2026) ────────────────────────────────
  // 165 der 477 gesperrten Zahlungsdaten-Knöpfe scheitern an einer fehlenden
  // Adresse. Das Feld steht deshalb direkt am gesperrten Knopf — ein
  // Seitenwechsel für eine Eingabe ist die häufigste Stelle, an der jemand
  // aufgibt.
  //
  // AGENTS.md: Haken stehen ÜBER dem ersten `return`, nicht dort, wo man sie
  // braucht — sonst „Rendered more hooks than during the previous render".
  const [mailNachtrag, setMailNachtrag] = useState("");
  // Der Produkt-Dialog. AGENTS.md: Haken stehen ÜBER dem ersten `return`.
  const [produktOffen, setProduktOffen] = useState(false);

  // ── `feldOffen` UND `zeitWert` SIND WEG (19.08.2026) ────────────────────
  // `feldOffen` kannte drei Werte — „zusage", „termin", „notiz" — und angezeigt
  // wurden zwei. Der dritte war der Fehler: ein Zustand ohne Bauteil. Er bleibt
  // nicht als „vielleicht nützlich" stehen, sonst setzt ihn der Nächste wieder.
  // Beides führt jetzt `ErgebnisWahl` selbst.
  const [datumWert] = useState(tagPlus(1));
  /** Die Notiz am Verlauf (unten in der Schublade) — NICHT die Pflichtnotiz. */
  const [notiz, setNotiz] = useState("");
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  // Das Sende-Menü gehört zur Karte und nicht zur Liste: Es zeigt den Zustand
  // GENAU dieses Kunden, und zwei geöffnete Karten sollen sich nicht in die
  // Quere kommen.
  const [sendeMenue, setSendeMenue] = useState<number | null>(null);
  const [blatt, setBlatt] = useState<number | null>(null);

  const zusage = relativ(k.zusagedatum);
  const rueckruf = k.rueckrufAm ? new Date(k.rueckrufAm) : null;
  const rueckrufFaellig = rueckruf ? rueckruf.getTime() <= Date.now() : false;
  const termin = k.terminAm ? new Date(k.terminAm) : null;
  const heuteBerlin = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const terminHeute = termin
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(termin) === heuteBerlin
    : false;
  /** Rückmeldung für den Terminlink-Knopf — getrennt vom Zahlungsdaten-Knopf. */
  const [linkKopiert, setLinkKopiert] = useState(false);

  /** Ein Ergebnis festhalten. Verschwindet der Kunde aus der Ansicht, sagt der
   *  Server das über die Wirkung — wir raten es nicht. */
  const [testOffen, setTestOffen] = useState(false);
  const [testNotiz, setTestNotiz] = useState("");
  /** Sichtbare Rückmeldung nach dem Kopieren — ein stummer Klick ist kein Klick. */
  const [kopiert, setKopiert] = useState(false);
  const [belegOffen, setBelegOffen] = useState(false);
  const [belegDatum, setBelegDatum] = useState("");
  const [belegNotiz, setBelegNotiz] = useState("");
  const [belegDatei, setBelegDatei] = useState<File | null>(null);

  /**
   * Zahlungsbeleg hochladen.
   *
   * Er landet an der Bestellung und erscheint für die Vertriebsleitung neben dem
   * Bankeingang — statt in einer WhatsApp-Gruppe zu versanden. Der Upload bucht
   * NICHTS; er beschleunigt nur die Prüfung.
   */
  const belegHochladen = async () => {
    if (!belegDatei) {
      zeige("fehler", "Keine Datei gewählt", "Bitte das Foto oder PDF der Überweisung auswählen.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(belegDatum)) {
      zeige("fehler", "Datum fehlt", "Bitte das Überweisungsdatum laut Beleg angeben.");
      return;
    }
    setLaeuft("beleg");
    const daten = new FormData();
    daten.append("beleg", belegDatei);
    daten.append("datum", belegDatum);
    if (belegNotiz.trim()) daten.append("notiz", belegNotiz.trim());
    const antwort = await fetch(`/api/fiaon/agent/crm/kunden/${k.personId}/zahlungsbeleg`, {
      method: "POST", credentials: "include", body: daten,
    }).then((r) => r.json()).catch(() => null);
    setLaeuft(null);
    if (antwort?.ok) {
      setBelegOffen(false); setBelegDatei(null); setBelegDatum(""); setBelegNotiz("");
      zeige("erfolg", "Beleg hinterlegt", antwort.meldung || "Er steht jetzt bei der Zahlungsprüfung.");
    } else {
      zeige("fehler", "Nicht hinterlegt", antwort?.error || "Bitte erneut versuchen.");
    }
  };

  /**
   * Zahlungsdaten in die Zwischenablage.
   *
   * Der Text kommt fertig formatiert vom Server (`zahlung.klartext`), damit
   * Empfänger, IBAN und Verwendungszweck aus derselben Quelle stammen wie die
   * Rechnung. Eine im Frontend abgeschriebene IBAN wäre irgendwann die falsche.
   */
  const zahlungsdatenKopieren = async () => {
    const text = k.zahlung?.klartext;
    if (!text) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Rückfall für Browser ohne Clipboard-Erlaubnis (und für http://)
      try {
        const feld = document.createElement("textarea");
        feld.value = text;
        feld.style.position = "fixed";
        feld.style.opacity = "0";
        document.body.appendChild(feld);
        feld.select();
        ok = document.execCommand("copy");
        document.body.removeChild(feld);
      } catch { ok = false; }
    }
    if (ok) {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } else {
      zeige("fehler", "Kopieren nicht möglich", "Bitte den Verwendungszweck von Hand übernehmen.");
    }
  };

  /**
   * Den persönlichen Terminlink in die Zwischenablage — für Kunden ohne
   * E-Mail. Der Agent schickt ihn über WhatsApp, der Kunde bucht selbst.
   * Derselbe Weg wie bei den Zahlungsdaten, damit niemand zwei Bedienungen
   * lernen muss.
   */
  const terminlinkKopieren = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(k.terminLink);
      ok = true;
    } catch {
      try {
        const feld = document.createElement("textarea");
        feld.value = k.terminLink;
        feld.style.position = "fixed";
        feld.style.opacity = "0";
        document.body.appendChild(feld);
        feld.select();
        ok = document.execCommand("copy");
        document.body.removeChild(feld);
      } catch { ok = false; }
    }
    if (ok) {
      setLinkKopiert(true);
      setTimeout(() => setLinkKopiert(false), 2500);
    } else {
      zeige("fehler", "Kopieren nicht möglich", "Bitte den Link von Hand aus der Adresszeile übernehmen.");
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DAS ERGEBNIS GIBT SEINEN AUSGANG ZURÜCK (19.08.2026)
  //
  // Vorher endete diese Funktion im Fehlerfall mit einem `return` — der Aufrufer
  // erfuhr nichts. Das Ergebnis-Bauteil braucht die Antwort, um den Grund AM
  // FELD anzuzeigen: Ein Kurzhinweis, der nach vier Sekunden verschwindet, ist
  // bei einer abgelehnten Pflichtnotiz zu wenig — der Agent tippt gerade.
  //
  // Die Notiz kommt als Parameter und nicht mehr aus dem Zustand der Karte: Das
  // Bauteil führt sein eigenes Feld, und zwei Quellen für denselben Text wären
  // wieder die Fehlerklasse, die diesen Umbau ausgelöst hat.
  // ══════════════════════════════════════════════════════════════════════════
  const ergebnis = async (
    art: string, zusatz: Record<string, unknown> = {},
  ): Promise<ErgebnisAusgang> => {
    setLaeuft(art);
    const eigeneNotiz = typeof zusatz.notiz === "string" ? zusatz.notiz.trim() : "";
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, {
      method: "POST",
      body: JSON.stringify({ art, ...zusatz, notiz: eigeneNotiz || notiz.trim() || undefined }),
    });
    setLaeuft(null);
    if (!r.ok) {
      const grund = r.json?.error || "Nicht gespeichert. Bitte erneut versuchen.";
      zeige("fehler", "Nicht gespeichert", grund);
      return { ok: false, fehler: grund };
    }
    // Eine misslungene Übergabe ist kein Erfolg: Wenn jeder Kollege schon
    // blockiert wurde, muss der Agent das lesen und nicht ein grünes Häkchen.
    zeige(r.json.uebergabe && !r.json.uebergabe.ok ? "info" : "erfolg",
      r.json.meldung || "Gespeichert", k.name);
    setNotiz("");
    // „Abgelehnt" nimmt den Kunden aus jeder Liste; eine geglückte Übergabe
    // ebenso — er gehört dann einem Kollegen. Alles andere bleibt sichtbar,
    // damit man den neuen Stand sieht (Zähler, Wiedervorlage, Mahnstufe).
    // ══════════════════════════════════════════════════════════════════════
    // ZWEI ARTEN VON ERGEBNIS — ZWEI ARTEN, DAMIT UMZUGEHEN
    //
    // ── DER ANLASS ────────────────────────────────────────────────────────
    // Ein Agent: „Wenn ich den Kunden ‚nicht erreicht' klicke, bleibt er
    // trotzdem in der Liste — verschwinden tut er bei mir nicht."
    //
    // Das ist richtig und war falsch. Der Unterschied:
    //
    //   VERABREDET  → Der Kunde ist heute FERTIG. „Nicht erreicht" setzt eine
    //                 Wiedervorlage auf morgen und schickt ab dem zweiten Mal
    //                 einen Terminlink. Es gibt heute nichts mehr zu tun, also
    //                 muss die Karte WEG — sonst ruft man denselben Menschen
    //                 zweimal an. Für den Kunden aufdringlich, für den Agenten
    //                 Zeitverlust, und die Liste wird nie kürzer.
    //
    //   IN DER PFLICHT → „Zahlt sofort" heißt: Das Geld wird erwartet. Der
    //                 Kunde bleibt sichtbar, gedämpft und mit Marke, damit der
    //                 Agent seine Zeile behält.
    //
    // Die Karte ist nicht verloren: Sie steht im Filter „Nicht erreicht" und
    // in jeder Suche. Nur die Frage „wen rufe ich JETZT an?" beantwortet sie
    // nicht mehr.
    // ══════════════════════════════════════════════════════════════════════
    const VERABREDET = [
      "nicht_erreicht", "mailbox", "rueckruf_termin", "nummer_falsch", "nummer_blockiert",
    ];

    if (art === "erreicht_abgelehnt" || r.json.uebergabe?.ok) onWeg();
    else if (VERABREDET.includes(art)) {
      // Kurz die Marke zeigen, dann ausgleiten. Ein Verschwinden ohne
      // Rückmeldung fühlt sich wie ein Fehler an — der Agent soll SEHEN, dass
      // sein Klick angekommen ist, bevor die Karte geht.
      onErledigt();
      setTimeout(() => onWeg(), 900);
    } else if (r.json.kunde) {
      onNeu(r.json.kunde);
      onErledigt();
    } else onErledigt();
    onZaehler();
    return { ok: true };
  };

  /**
   * Eine doppelte Buchung aus der Liste nehmen.
   *
   * ── DIE RÜCKFRAGE IST PFLICHT ─────────────────────────────────────────
   * Es ist kein Löschen, aber es ändert, was der Kunde bezahlen soll. Wer
   * versehentlich die falsche wegräumt, merkt es erst, wenn das Geld für die
   * andere Referenz eintrifft.
   */
  // ══════════════════════════════════════════════════════════════════════
  // MEHRFACHAUSWAHL — 406 Menschen mit 1.083 Buchungen
  //
  // ── DER BEFUND (16.08.2026, gemessen) ────────────────────────────────
  // 406 Personen haben mehr als eine offene Buchung, insgesamt 1.083 Zeilen.
  // Ein Fall hatte 18. Einzeln wegräumen heißt: 18 Bestätigungsdialoge für
  // einen Kunden — und wer das dreimal macht, klickt beim vierten Mal blind
  // durch.
  //
  // Jetzt: Häkchen an den unbezahlten Buchungen, EIN Dialog mit Zähler. Die
  // drei Wände gelten je Buchung weiter (nicht bezahlt, nicht die letzte,
  // Zugriff erlaubt) — sie stehen im Server und werden hier nicht umgangen.
  // Teilerfolge werden benannt: „7 weggeräumt, 2 blieben stehen, weil …".
  // ══════════════════════════════════════════════════════════════════════
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const umschalten = (ref: string) => setAuswahl((v) => {
    const n = new Set(v);
    if (n.has(ref)) n.delete(ref); else n.add(ref);
    return n;
  });

  const auswahlWegraeumen = async () => {
    const refs = Array.from(auswahl);
    if (refs.length === 0) return;
    const zeilen = (k.buchungen ?? []).filter((b) => refs.includes(b.ref));
    const summe = zeilen.reduce((s, b) => s + Number(b.betragCents ?? 0), 0);
    if (!confirm(
      `${refs.length} ${refs.length === 1 ? "Buchung" : "Buchungen"} aus der Liste nehmen?\n\n`
      + `${zeilen.map((b) => `· ${b.bezeichnung}${b.betragCents != null ? ` (${eur(b.betragCents)})` : ""}`).join("\n")}\n\n`
      + `Summe: ${eur(summe)}\n\n`
      + "Sie werden archiviert, nicht gelöscht — die Vertriebsleitung kann sie "
      + "zurückholen. Bezahlte Buchungen und die letzte verbleibende bleiben "
      + "in jedem Fall stehen.",
    )) return;

    setLaeuft("arch-auswahl");
    // Der Reihe nach, nicht parallel: Die Wand „das ist die letzte Buchung"
    // rechnet mit dem Stand NACH den vorherigen. Parallel gerechnet würden
    // alle gleichzeitig prüfen und alle durchkommen — der Kunde stünde ohne
    // jede Bestellung da.
    const geschafft: string[] = [];
    const geblieben: { ref: string; grund: string }[] = [];
    for (const ref of refs) {
      const r = await api(`/agent/buchungen/${encodeURIComponent(ref)}/archivieren`,
        { method: "POST", body: JSON.stringify({ grund: "doppelt" }) });
      if (r.ok) geschafft.push(ref);
      else geblieben.push({ ref, grund: r.json?.error || "unbekannter Grund" });
    }
    setLaeuft(null);
    setAuswahl(new Set());

    if (geblieben.length === 0) {
      zeige("erfolg", "Weggeräumt",
        `${geschafft.length} ${geschafft.length === 1 ? "Buchung" : "Buchungen"} archiviert.`);
    } else {
      // Teilerfolge werden BENANNT. „Es hat nicht ganz geklappt" ist keine
      // Auskunft; der Mensch muss wissen, welche und warum.
      zeige(geschafft.length > 0 ? "info" : "fehler",
        geschafft.length > 0
          ? `${geschafft.length} weggeräumt, ${geblieben.length} blieben stehen`
          : "Keine weggeräumt",
        geblieben.map((g) => `${g.ref}: ${g.grund}`).join(" · ").slice(0, 400));
    }
    const frisch = await api(`/agent/crm/kunden/${k.personId}`);
    if (frisch.ok && frisch.json?.kunde) onNeu(frisch.json.kunde);
    onZaehler();
  };

  const buchungWegraeumen = async (b: { ref: string; bezeichnung: string; betragCents: number | null }) => {
    const betrag = b.betragCents != null ? eur(b.betragCents) : "ohne Betrag";
    if (!confirm(
      `„${b.bezeichnung}" (${betrag}) aus der Liste nehmen?\n\n`
      + `Der Kunde behält seine anderen Buchungen. Diese hier verschwindet aus `
      + `deiner Liste — sie wird archiviert, nicht gelöscht, und die `
      + `Vertriebsleitung kann sie zurückholen.\n\n`
      + `Referenz: ${b.ref}`,
    )) return;
    setLaeuft(`arch-${b.ref}`);
    const r = await api(`/agent/buchungen/${encodeURIComponent(b.ref)}/archivieren`,
      { method: "POST", body: JSON.stringify({ grund: "doppelt" }) });
    setLaeuft(null);
    if (!r.ok) {
      zeige("fehler", "Nicht möglich", r.json?.error || "Bitte erneut versuchen.");
      return;
    }
    zeige("erfolg", "Buchung weggeräumt", r.json.meldung);
    // Die Karte neu holen: Der Server liefert die Buchungen mit, und ohne
    // dieses Nachladen stünde die weggeräumte Zeile weiter da.
    const frisch = await api(`/agent/crm/kunden/${k.personId}`);
    if (frisch.ok && frisch.json?.kunde) onNeu(frisch.json.kunde);
    onZaehler();
  };

  /**
   * Die fehlende E-Mail nachtragen — über die bestehende Stammdaten-Route.
   *
   * ── WARUM DIREKT HIER ─────────────────────────────────────────────────────
   * GEMESSEN am 27.08.2026: 165 der 477 gesperrten Zahlungsdaten-Knöpfe
   * scheitern an einer fehlenden Adresse. Ein Seitenwechsel für eine Eingabe
   * ist die häufigste Stelle, an der jemand aufgibt — und dann bleibt der Kunde
   * ohne Zahlungsdaten.
   *
   * Die Route (`POST /agent/customers/:ref/stammdaten`) schreibt über
   * `updateCustomerContact`: ein Verlaufseintrag je Feld, und der alte Wert
   * wandert als Alias an die Person. Eine eigene Fassung hier wäre die zweite
   * Wahrheit über die Adresse eines Menschen.
   */
  const mailNachtragen = async () => {
    const wert = mailNachtrag.trim();
    // Eine lebende Bestellung als Aufsatzpunkt — die Route arbeitet auf `ref`.
    const ref = (k.buchungen ?? []).find((b) => !b.erledigt)?.ref
      ?? (k.buchungen ?? [])[0]?.ref;
    if (!ref) {
      zeige("fehler", "Keine Bestellung",
        "Ohne Bestellung gibt es keine Akte, an der die Adresse hängt. "
        + "Bitte erst ein Produkt anlegen.");
      return;
    }
    setLaeuft("mailnachtrag");
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`,
      { method: "POST", body: JSON.stringify({ email: wert }) });
    setLaeuft(null);
    if (!r.ok) {
      zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen.");
      return;
    }
    zeige("erfolg", "E-Mail gespeichert",
      `${wert} steht jetzt an der Akte. Der Zahlungsdaten-Knopf ist frei.`);
    setMailNachtrag("");
    // Die Karte neu holen — sonst bleibt der Knopf gesperrt, obwohl die
    // Adresse da ist.
    const frisch = await api(`/agent/crm/kunden/${k.personId}`);
    if (frisch.ok && frisch.json?.kunde) onNeu(frisch.json.kunde);
  };

  // ── ERST BESTÄTIGEN, DANN SENDEN (31.08.2026) ───────────────────────────
  // Vorher ging die Mail auf den ersten Klick raus, und der Agent sah erst
  // hinterher, was drinstand. Florentine hat den falschen Paketnamen nur
  // gefunden, weil der Kunde sich gemeldet hat — fünf Mails später.
  const [bestaetigen, setBestaetigen] = useState(false);
  /** Der Grund einer abgelehnten Sendung — er bleibt IM Dialog stehen. */
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);

  const zahlungsdaten = async (ref: string | null = null) => {
    setLaeuft("rechnung");
    // Die Referenz, die in der Vorschau STAND, geht mit: Der Server prüft sie
    // gegen seine Auflösung und lehnt ab, wenn sie zwischenzeitlich getauscht
    // wurde. Ein Client, dem man glaubt, ist eine Wand aus Papier.
    const r = await api(`/agent/crm/kunden/${k.personId}/rechnung`,
      { method: "POST", body: JSON.stringify({ ref }) });
    setLaeuft(null);
    // ══════════════════════════════════════════════════════════════════════
    // JEDER AUSGANG IST SICHTBAR (19.08.2026)
    //
    // ── DIE MELDUNG (Daniel Stripling) ──────────────────────────────────
    // „Ich gehe auf ‚Zahlungsdaten senden' → ‚Rechnung stellen & senden'.
    // Danach passiert teilweise gar nichts. Es erscheint keine Fehlermeldung
    // und es ist nicht ersichtlich, ob die Rechnung tatsächlich versendet
    // wurde."
    //
    // ── WAS HIER FALSCH WAR ─────────────────────────────────────────────
    // `setBestaetigen(false)` stand VOR der Auswertung. Der Dialog schloss
    // sich also in JEDEM Fall — auch im Fehlerfall. Zurück blieb die Karte
    // und ein Kurzhinweis, der nach wenigen Sekunden verschwindet. Wer in
    // dem Moment auf den Kunden am Telefon hört, sieht ihn nicht: „es
    // passiert nichts".
    //
    // Jetzt: Bei einem FEHLER bleibt der Dialog offen und trägt den Grund
    // (`sendeFehler`). Nur der ERFOLG schließt ihn — und dann steht der
    // Vorgang sofort im Verlauf der Karte, nicht erst nach dem nächsten
    // Aufklappen.
    // ══════════════════════════════════════════════════════════════════════
    if (!r.ok) {
      const grund = r.json?.error || "Der Server hat den Versand abgelehnt, ohne einen Grund zu nennen.";
      setSendeFehler(grund);
      zeige("fehler", "Nicht versandt", grund);
      return;
    }
    setSendeFehler(null);
    setBestaetigen(false);
    zeige(r.json.warnung ? "info" : "erfolg",
      r.json.warnung ? "Versandt, mit Hinweis" : "Rechnung und Zahlungsdaten gesendet",
      r.json.warnung
        || `An ${r.json.versandtAn} — mit Bankverbindung, Verwendungszweck und Rechnung. `
           + "Der Vorgang steht im Verlauf.");
    if (r.json.kunde) onNeu(r.json.kunde);
    // Der Beweis für den Agenten: sein Vorgang, sofort, in der Karte.
    await verlaufNachladen();
  };

  const nummerKorrektur = async () => {
    setLaeuft("nummer");
    const r = await api(`/agent/crm/kunden/${k.personId}/nummer-korrektur`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    if (r.ok) zeige("erfolg", "Bitte um Nummer versandt", `An ${r.json.versandtAn} — mit Link zum Ändern.`);
    else zeige("fehler", "Nicht versandt", r.json?.error || "Bitte erneut versuchen.");
  };

  /**
   * „Als Testeintrag melden" (08.08.2026).
   *
   * Agenten melden Fake- und Testkonten — archivieren dürfen sie sie NICHT.
   * Wer seine eigene Arbeitsliste kürzen kann, hat einen Anreiz, unbequeme
   * Kunden zu „Testeinträgen" zu erklären. Die Meldung landet als Aufgabe bei
   * der Vertriebsleitung; der Kunde bleibt bis zur Entscheidung in der Liste.
   */
  const testeintragMelden = async () => {
    const begruendung = testNotiz.trim();
    if (begruendung.length < 5) {
      zeige("fehler", "Bitte kurz begründen", "Ein Satz genügt: Woran erkennst du, dass das kein echter Kunde ist?");
      return;
    }
    setLaeuft("test");
    const r = await api(`/agent/crm/kunden/${k.personId}/testeintrag-melden`, {
      method: "POST", body: JSON.stringify({ begruendung }),
    });
    setLaeuft(null);
    if (r.ok) {
      setTestOffen(false); setTestNotiz("");
      zeige("erfolg", "Gemeldet", r.json.meldung || "Die Vertriebsleitung prüft.");
    } else zeige("fehler", "Nicht gemeldet", r.json?.error || "Bitte erneut versuchen.");
  };

  const verlaufLaden = async () => {
    if (verlauf) return;
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    setVerlauf(r.ok ? r.json.verlauf : []);
  };

  /**
   * Den Verlauf ERNEUT holen, auch wenn schon einer geladen ist.
   *
   * `verlaufLaden` steigt bei vorhandenem Verlauf sofort aus (das ist als
   * Sparmaßnahme richtig). Nach einem Versand ist das falsch: Der Agent soll
   * seinen eigenen Vorgang im Verlauf SEHEN — „es ist nicht ersichtlich, ob die
   * Rechnung tatsächlich versendet wurde" war genau diese Lücke.
   */
  const verlaufNachladen = async () => {
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    if (r.ok) setVerlauf(r.json.verlauf ?? []);
  };

  useEffect(() => { if (offen) void verlaufLaden(); }, [offen]);

  return (
    <div id={`kunde-${k.personId}`}
         className={`fi-karte relative overflow-hidden ${erledigt ? "fi-kk-erledigt" : ""}`}
         style={reduziert ? undefined : { animation: "fiKarteAuf 340ms cubic-bezier(.32,.72,0,1) both", animationDelay: `${Math.min(index, 8) * 35}ms` }}
         data-fi-kunde={k.personId} data-erledigt={erledigt ? "1" : "0"}>
      {/* ── DIE ERLEDIGT-MARKE ──────────────────────────────────────────────
          Ein Agent: „rutscht einfach 2–3 Leute runter, komme durcheinander."
          Die Karte bleibt jetzt an ihrer Stelle. Damit man trotzdem sieht,
          was schon getan ist, wird sie gedämpft und trägt diese Marke —
          statt sich stillschweigend woanders einzuordnen. */}
      {erledigt && (
        <span className="fi-kk-marke">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
               strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m4.5 10.5 3.5 3.5 7.5-8" />
          </svg>
          Ergebnis gebucht
        </span>
      )}

      {/* Statuskante — die einzige Fläche mit Statusfarbe. */}
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: zusage?.dringend || rueckrufFaellig ? "var(--fi-tier1)" : TIER_FARBE[k.tier] || "var(--fi-linie)" }} />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
        {/* Kopf: Name, Status, Geld */}
        <div className="flex items-start gap-3">
          <button type="button" onClick={onOeffnen} className="flex-1 min-w-0 text-left">
            <p className="text-[16px] font-bold leading-tight truncate">{k.name}</p>
            <p className="mt-1 text-[12.5px] flex flex-wrap items-center gap-x-2 gap-y-0.5"
               style={{ color: "var(--fi-text-still)" }}>
              {/* Die Stufe zuerst: Sie erklärt, warum diese Karte hier steht. */}
              {k.stufe && <StufenMarke stufe={k.stufe} kurz />}
              <span className="font-semibold" style={{ color: TIER_FARBE[k.tier] }}>
                {statusAusTierGrund(k.tierGrund).anzeige}
              </span>
              {/* ── WAS IST GEBUCHT UND WAS DAVON OFFEN ────────────────────
                  Statt „ein Produkt, ein Betrag" jetzt alle nicht stornierten
                  Buchungen. Bei Shahed Mohammad steht damit wieder das Paket
                  da, nicht nur die Bonitätsauskunft. */}
              {(k.buchungen ?? []).filter((b) => !b.erledigt).map((b) => (
                <span key={b.ref} className="truncate"
                      style={{ color: b.bezahlt ? "#059669" : undefined }}>
                  · {b.bezeichnung}
                  {b.betragCents != null && ` ${eur(b.betragCents)}`}
                  {b.bezahlt ? " ✓" : ""}
                </span>
              ))}
              {(k.buchungen ?? []).length === 0 && k.produkt && (
                <span className="truncate">· {k.produkt}</span>
              )}
            </p>
          </button>
          <span className="shrink-0 flex flex-col items-end gap-1">
            {termin && (
              <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-md"
                    style={terminHeute
                      ? { background: "rgba(5,150,105,.10)", color: "#059669" }
                      : { background: "rgba(29,78,216,.07)", color: "var(--fi-primaer)" }}>
                Termin {termin.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}{" "}
                {termin.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}
              </span>
            )}
            {zusage && (
              <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-md"
                    style={zusage.dringend
                      ? { background: "rgba(220,38,38,.08)", color: "var(--fi-tier1)" }
                      : { background: "rgba(29,78,216,.07)", color: "var(--fi-primaer)" }}>
                Zusage {zusage.text}
              </span>
            )}
            {rueckruf && (
              <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-md"
                    style={rueckrufFaellig
                      ? { background: "rgba(220,38,38,.08)", color: "var(--fi-tier1)" }
                      : { background: "rgba(217,119,6,.09)", color: "var(--fi-tier2)" }}>
                Rückruf {rueckruf.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}{" "}
                {rueckruf.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </span>
        </div>

        {/* Handlungshinweis aus tier-hinweise.ts — er sagt, was zu tun ist. */}
        <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
          {k.hinweis}
        </p>

        {/* ── Vorgeschichte: was mit diesem Kunden schon versucht wurde ───────
            Ohne diese Zeile wählt der Agent zum fünften Mal dieselbe Nummer.
            Sie erscheint ab dem zweiten Fehlversuch — vorher gibt es nichts zu
            erzählen. */}
        {(k.nichtErreicht >= 2 || k.ruhtSeit) && (
          <div className="mt-3 p-3 rounded-xl"
               style={{ background: k.ruhtSeit ? "rgba(100,116,139,.07)" : "rgba(217,119,6,.06)",
                        border: `1px solid ${k.ruhtSeit ? "var(--fi-linie)" : "rgba(217,119,6,.25)"}` }}>
            <p className="text-[12.5px] font-semibold leading-snug"
               style={{ color: k.ruhtSeit ? "var(--fi-text-leise)" : "var(--fi-tier2)" }}>
              {k.nichtErreicht}× nicht erreicht
              {k.letzterKontakt && `, zuletzt ${new Date(k.letzterKontakt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
              {k.terminlinkMailAm && `, Terminlink versandt ${new Date(k.terminlinkMailAm).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
            </p>
            {k.ruhtSeit && (
              <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
                Ruht bis {k.wiedervorlage ? new Date(k.wiedervorlage).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "zur Wiedervorlage"}.
                Nicht anrufen — er hat den Terminlink und meldet sich selbst.
              </p>
            )}
            {!k.email && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                  Keine E-Mail hinterlegt — es ging keine Mail raus.
                </p>
                <button type="button" onClick={() => void terminlinkKopieren()}
                        className="fi-zweitknopf inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold"
                        style={linkKopiert ? { borderColor: "#059669", color: "#059669" } : undefined}
                        title="Persönlichen Buchungslink kopieren — fertig zum Einfügen in WhatsApp">
                  {linkKopiert ? "Kopiert" : "Terminlink per WhatsApp senden"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Verwendungszweck: immer sichtbar, auch ohne E-Mail ──────────────
            Dreimal an einem Tag gemeldet: Kunde ohne E-Mail, Agent gibt die
            Zahlungsdaten am Telefon durch, es gibt keinen Verwendungszweck — und
            in der Buchhaltung liegt Geld ohne Namen. Seit 08.08.2026 hat jede
            Bestellung eine Referenz, und sie steht hier. */}
        {k.zahlung?.referenz && (
          <div className="mt-3.5 p-3 rounded-xl" style={{ background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.06em]"
                   style={{ color: "var(--fi-text-still)" }}>
                  Verwendungszweck
                </p>
                <p className="fi-zahl text-[15px] font-bold leading-tight" style={{ color: "var(--fi-text)" }}>
                  {k.zahlung.referenz}
                </p>
              </div>
              <button type="button" onClick={() => void zahlungsdatenKopieren()}
                      disabled={!k.zahlung.klartext}
                      className="fi-zweitknopf ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold"
                      style={kopiert ? { borderColor: "var(--fi-tier0, #059669)", color: "var(--fi-tier0, #059669)" } : undefined}
                      title="Empfänger, IBAN, Betrag und Verwendungszweck als Text — fertig zum Einfügen in WhatsApp">
                {kopiert ? "Kopiert" : "Zahlungsdaten kopieren"}
              </button>
            </div>
            {kopiert && (
              <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--fi-text-leise)" }}>
                Empfänger, IBAN, Betrag und Verwendungszweck liegen in der Zwischenablage — jetzt in
                WhatsApp einfügen.
              </p>
            )}

            {/* ── Zahlungsbeleg (08.08.2026) ────────────────────────────────
                Sagt der Kunde „ich habe überwiesen", gehört sein Screenshot ins
                System und nicht in die WhatsApp-Gruppe. Optional: Er
                beschleunigt die Prüfung, blockiert aber nichts. */}
            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {!belegOffen ? (
                <button type="button" onClick={() => setBelegOffen(true)}
                        className="text-[12px] font-semibold underline decoration-dotted"
                        style={{ color: "var(--fi-text-still)" }}>
                  Überweisungsbeleg hinterlegen
                </button>
              ) : (
                <div>
                  <p className="text-[11.5px] leading-snug" style={{ color: "var(--fi-text-leise)" }}>
                    Foto oder PDF der Überweisung. Es erscheint bei der Zahlungsprüfung direkt neben dem
                    Bankeingang. Gebucht wird dadurch nichts.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="file" accept="image/*,application/pdf"
                           onChange={(e) => setBelegDatei(e.target.files?.[0] ?? null)}
                           className="text-[12px]" />
                    <input type="date" value={belegDatum} onChange={(e) => setBelegDatum(e.target.value)}
                           max={new Date().toISOString().slice(0, 10)}
                           title="Überweisungsdatum laut Beleg"
                           className="h-[34px] px-2 rounded-lg border bg-white text-[12.5px] outline-none"
                           style={{ borderColor: "var(--fi-linie)" }} />
                    <input value={belegNotiz} onChange={(e) => setBelegNotiz(e.target.value)}
                           placeholder="Notiz (freiwillig)"
                           className="flex-1 min-w-[140px] h-[34px] px-2.5 rounded-lg border bg-white text-[12.5px] outline-none"
                           style={{ borderColor: "var(--fi-linie)" }} />
                    <button type="button" disabled={!belegDatei || !belegDatum || !!laeuft}
                            onClick={() => void belegHochladen()}
                            className="fi-zweitknopf px-3 py-2 text-[12px] font-semibold">
                      {laeuft === "beleg" ? "Lädt …" : "Hinterlegen"}
                    </button>
                    <button type="button" onClick={() => { setBelegOffen(false); setBelegDatei(null); }}
                            className="text-[12px] font-semibold px-1"
                            style={{ color: "var(--fi-text-still)" }}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erste Reihe: Anrufen · Zahlungsdaten · Mail */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {k.telefonWaehlbar ? (
            // Ein Klick öffnet das Softphone MIT Kundenkontext — das Gespräch
            // wird dann aufgezeichnet, zusammengefasst und dokumentiert.
            // Solange Twilio nicht eingerichtet ist, sagt das Panel das ruhig
            // und man wählt weiter von Hand (der Rechtsklick auf den Knopf
            // trägt die Nummer weiterhin als tel:-Link).
            <a href={`tel:${k.telefonWaehlbar}`}
               onClick={(e) => { e.preventDefault(); anrufStarten(k.telefonWaehlbar!, k.personId, k.name); }}
               className="fi-primaerknopf inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white">
              <ZeichenTelefon size={16} /> Anrufen
            </a>
          ) : k.telefon ? (
            /* ══════════════════════════════════════════════════════════════
               DIE LÄNDERVORWAHL AN DER STELLE ERGÄNZEN (31.08.2026)

               Hier stand nur „Ländervorwahl fehlt" — richtig und eine
               Sackgasse. Der Agent sah, dass er nicht anrufen kann, und hatte
               keinen Weg, es zu ändern; die Akte liegt zwei Klicks weiter.

               Jetzt: Auswahl, Vorschau der Wahlform, ein Klick speichert. Der
               VORSCHLAG kommt aus PLZ und Ort und ist als Vorschlag markiert —
               automatisch setzen wäre genau der Fehler, um den es geht (bei
               Maurizio Pampanini wurde +49 geraten, richtig war +41).
               ══════════════════════════════════════════════════════════════ */
            <NummerLandNachtragen k={k} onFertig={onNeu} />
          ) : (
            <span className="px-3 py-2.5 text-[12px] font-medium"
                  style={{
                    borderRadius: "var(--fi-radius-knopf)", background: "var(--fi-seite)",
                    color: "var(--fi-text-still)", border: "1px solid var(--fi-linie)",
                  }}>
              keine Nummer
            </span>
          )}

          {/* ══════════════════════════════════════════════════════════════
              DER ZAHLUNGSDATEN-KNOPF SAGT, WARUM ER GESPERRT IST (27.08.2026)

              ── DIE MELDUNG ────────────────────────────────────────────────
              Daniel Stripling: „Ich kann die Zahlungsdaten nicht jedem
              schicken." Der Knopf war grau, und im Tooltip stand höchstens
              „Keine E-Mail hinterlegt" — ein Tooltip, den auf dem Telefon
              niemand sieht.

              GEMESSEN an 600 Personen der Tagesliste: 123 sendbar, 477
              gesperrt. Die Gründe: 219× keine offene Bestellung, 165× keine
              E-Mail, 93× schon bezahlt. In den meisten Fällen sperrt der Knopf
              ZU RECHT — es fehlte nur die Auskunft, warum, und der Weg weiter.

              ── UND claimed_paid IST SENDBAR ──────────────────────────────
              Eine gemeldete Zahlung („ich habe überwiesen") gilt als OFFEN,
              solange der Kontoabgleich sie nicht bestätigt hat. Genau dann
              ruft der Kunde am häufigsten an und fragt nach den Daten. Die
              Serverregel lässt das schon zu (`payment_status IN
              ('pending_payment','claimed_paid','expired')`) — betroffen sind
              243 Personen.
              ══════════════════════════════════════════════════════════════ */}
          {(() => {
            // ══════════════════════════════════════════════════════════════
            // DER SPERRGRUND KOMMT VOM SERVER (19.08.2026)
            //
            // ── DIE MELDUNG (Florentine) ─────────────────────────────────
            // „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine
            // Mail schicken."
            //
            // ── WAS HIER STAND ───────────────────────────────────────────
            // Eine EIGENE Ableitung aus `k.buchungen`, mit dem Kommentar „Die
            // WAHRHEIT bleibt der Server" darüber — und darunter wurde trotzdem
            // selbst entschieden. Zwei Ableitungen für dieselbe Frage.
            //
            // GEMESSEN bei Florentine: Bei 139 Kunden gab diese Ableitung den
            // Knopf FREI, während der Server ablehnte. Der Agent drückt, und
            // nichts passiert. Zwei Ursachen:
            //   · `offen` zählte hier JEDE unbezahlte Bestellung — auch eine
            //     ohne gestellte Rechnung, für die der Server andere Regeln hat.
            //   · Die E-Mail wurde an der PERSON geprüft, der Server las sie
            //     aus der BESTELLUNG (behoben, aber die Lücke war real).
            //
            // Jetzt liefert der Server `sendeGrund` bei JEDEM Laden mit — in der
            // Liste und in der Einzelkarte. Kein gemerkter Zustand, keine zweite
            // Ableitung. Der Rückfall unten greift nur bei einer alten
            // Server-Fassung, die das Feld nicht kennt.
            // ══════════════════════════════════════════════════════════════
            const buchungen = k.buchungen ?? [];
            const sperre = k.sendeGrund
              ? (k.sendeMoeglich
                  ? null
                  : {
                      grund: k.sendeText || "Senden ist gerade nicht möglich.",
                      tat: k.sendeTat ?? null,
                      ziel: (k.sendeGrund === "keine_email" ? "stammdaten"
                        : k.sendeGrund === "keine_bestellung" ? "produkt"
                        : null) as "stammdaten" | "produkt" | null,
                    })
              // ── RÜCKFALL für eine Server-Fassung ohne `sendeGrund` ───────
              // Bewusst SCHMAL: nur die zwei Fälle, in denen objektiv nichts zu
              // senden ist. Alles andere gibt den Knopf frei und lässt den
              // Server entscheiden — eine Oberfläche, die mehr sperrt als der
              // Server, kostet Umsatz; eine, die zu viel freigibt, kostet einen
              // Klick.
              : !k.email
                ? {
                    grund: "Keine E-Mail-Adresse — ohne sie kann nichts rausgehen.",
                    tat: "E-Mail nachtragen", ziel: "stammdaten" as const,
                  }
                : buchungen.length === 0
                  ? {
                      grund: "Keine Bestellung vorhanden — es gibt nichts zu bezahlen.",
                      tat: "Produkt anlegen", ziel: "produkt" as const,
                    }
                  : null;

            if (!sperre) {
              return (
                <button type="button" onClick={() => setBestaetigen(true)} disabled={!!laeuft}
                        title={`Zahlungsdaten und Rechnung an ${k.email}`}
                        className="fi-sendeknopf inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold">
                  <ZeichenSenden size={15} />
                  {laeuft === "rechnung" ? "Sende …" : "Zahlungsdaten senden"}
                </button>
              );
            }

            // ── GESPERRT: GRUND SICHTBAR, NICHT IM TOOLTIP ────────────────
            // Hausregel: Ein gesperrter Knopf sagt den Grund dort, wo der
            // Finger hinzeigt. Ein Tooltip erreicht auf dem Telefon niemanden.
            return (
              <span className="inline-flex flex-col gap-1" style={{ maxWidth: 320 }}>
                <span className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold"
                      style={{
                        borderRadius: "var(--fi-radius-knopf)",
                        background: "rgba(217,119,6,.10)", color: "#92400e",
                        border: "1px solid rgba(217,119,6,.28)",
                      }}>
                  <ZeichenSenden size={15} />
                  Zahlungsdaten: gesperrt
                </span>
                <span className="text-[11.5px] leading-snug" style={{ color: "#92400e" }}>
                  {sperre.grund}
                </span>
                {/* ══════════════════════════════════════════════════════════
                    WAS GENAU FEHLT — STATT „IM FORMULAR" (19.08.2026)

                    Daniel: „Es ist nicht ersichtlich, welche Information noch
                    fehlt oder an welcher Stelle der Antrag noch
                    fertiggestellt werden soll." Der Server liefert die
                    Pflichtfelder jetzt namentlich mit; hier stehen sie.
                    ══════════════════════════════════════════════════════════ */}
                {k.sendeGrund === "antrag_unfertig" && k.fehlendeFelder && (
                  <span className="text-[11.5px] font-semibold leading-snug"
                        data-fiaon="fehlende-felder"
                        style={{ color: "#92400e" }}>
                    Es fehlt: {k.fehlendeFelder}
                  </span>
                )}
                {/* Der Knopf öffnet die Stammdaten-Felder in derselben Karte —
                    ein Seitenwechsel für drei Felder ist die häufigste Stelle,
                    an der jemand aufgibt (AGENTS.md). */}
                {k.sendeGrund === "antrag_unfertig" && (
                  <button type="button" onClick={onOeffnen}
                          data-fiaon="fehlendes-ergaenzen"
                          className="self-start text-[11.5px] font-bold underline decoration-dotted"
                          style={{ color: "#92400e" }}>
                    Fehlendes am Telefon ergänzen
                  </button>
                )}
                {/* ── DER NÄCHSTE SCHRITT, NICHT NUR DIE DIAGNOSE ──────────
                    Bei fehlender E-Mail steht das Feld direkt hier: Das löst
                    165 der 477 gesperrten Fälle mit einer Eingabe, ohne die
                    Seite zu wechseln. Die Adresse geht über die bestehende
                    Stammdaten-Route (mit Verlaufseintrag und Alias-Ablage). */}
                {sperre.ziel === "stammdaten" && (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <input value={mailNachtrag}
                           onChange={(e) => setMailNachtrag(e.target.value)}
                           placeholder="E-Mail nachtragen"
                           type="email" inputMode="email"
                           className="px-2.5 py-2 text-[12.5px]"
                           style={{
                             borderRadius: "var(--fi-radius-knopf)",
                             border: "1px solid var(--fi-linie)", minHeight: 40, minWidth: 190,
                           }} />
                    <button type="button"
                            disabled={!!laeuft || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailNachtrag.trim())}
                            onClick={() => void mailNachtragen()}
                            className="fi-zweitknopf inline-flex items-center justify-center px-3 py-2 text-[12px] font-semibold"
                            style={{ minHeight: 40 }}>
                      {laeuft === "mailnachtrag" ? "Speichert …" : "Speichern"}
                    </button>
                  </span>
                )}
                {sperre.ziel === "produkt" && (
                  /* ── DER LINK WAR EIN BLINDGÄNGER (29.08.2026) ──────────
                     Hier stand `<a href="/agent/kunden#anlegen">`. Drei Fehler
                     in einer Zeile: Der Anker existiert nicht, der Mitarbeiter
                     steht SCHON auf dieser Seite (ein Link auf dieselbe Seite
                     mit unbekanntem Anker tut nichts), und „+ Kunde anlegen"
                     hätte einen NEUEN Kunden angelegt, kein Produkt an dieser
                     Akte. Der Betreiber meldete: „es erscheint NICHTS."
                     Jetzt öffnet der Knopf den Produkt-Dialog. */
                  <button type="button" onClick={() => setProduktOffen(true)}
                          data-fiaon="produkt-oeffnen-sperre"
                          className="fi-zweitknopf inline-flex items-center justify-center px-3 py-2 text-[12px] font-semibold"
                          style={{ minHeight: 40 }}>
                    Produkt anlegen →
                  </button>
                )}
              </span>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════
              PRODUKT HINZUFÜGEN / TAUSCHEN (29.08.2026)

              Er steht IMMER da, nicht nur wenn eine Sperre ihn zeigt: Der
              häufigste Fall am Telefon ist „Pro reicht mir nicht" — und dafür
              muss niemand erst in eine Sperre laufen.

              Beschriftung nach Lage: Ist ein Paket offen, heißt es „tauschen"
              (dann ersetzt das neue das alte). Sonst „hinzufügen".
              ══════════════════════════════════════════════════════════════ */}
          <button type="button" onClick={() => setProduktOffen((v) => !v)}
                  data-fiaon="produkt-oeffnen"
                  className="fi-zweitknopf inline-flex items-center px-3 py-2.5 text-[12px] font-medium"
                  /* 44 px ist die Fingerkuppe. `py-2.5` ergab gemessen 40 px —
                     der Browsertest hat es gefunden, nicht das Auge. */
                  style={{ minHeight: 44 }}
                  title="Ein Paket aus dem Katalog an diese Akte hängen. Ein offenes Paket wird dabei ersetzt.">
            {(k.buchungen ?? []).some((b) => b.offen && b.art === "paket")
              ? "Produkt tauschen" : "Produkt hinzufügen"}
          </button>

          {k.email && (
            <a href={`mailto:${k.email}`} className="fi-zweitknopf inline-flex items-center px-3 py-2.5 text-[12px] font-medium"
               title={`Öffnet dein eigenes Mailprogramm mit ${k.email}`}>
              eigenes Mailprogramm
            </a>
          )}
          <button type="button" onClick={() => void nummerKorrektur()} disabled={!!laeuft || !k.email}
                  className="fi-zweitknopf inline-flex items-center px-3 py-2.5 text-[12px] font-medium"
                  title="Schickt dem Kunden einen Link, mit dem er seine Telefonnummer selbst korrigiert">
            {laeuft === "nummer" ? "Sende …" : "Nummer korrigieren lassen"}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            DER PRODUKT-DIALOG

            Er steht IN der Karte, nicht als Überlagerung: Auf 380 px verdeckt
            ein Dialog den Kunden, um den es geht — und der Mitarbeiter hat ihn
            am Telefon. Aufgeklappt schiebt er die Karte auseinander.
            ══════════════════════════════════════════════════════════════ */}
        <ProduktDialog
          offen={produktOffen}
          personId={k.personId}
          buchungen={(k.buchungen ?? []) as any}
          aufKlappen={setProduktOffen}
          fertig={async (meldung) => {
            zeige("erfolg", "Produkt gespeichert", meldung);
            // ── DIE KARTE NEU HOLEN ────────────────────────────────────────
            // Ohne dieses Nachladen zeigt die Karte das ALTE Paket, den alten
            // Betrag und den alten Verwendungszweck — und die Zahlungsdaten-Mail
            // ginge mit veralteten Werten raus. Genau das prüft der
            // Browsertest Feld für Feld.
            const frisch = await api(`/agent/crm/kunden/${k.personId}`);
            if (frisch.ok && frisch.json?.kunde) onNeu(frisch.json.kunde);
            onZaehler();
          }}
        />

        {/* Zweite Reihe: die sieben Ergebnisse */}
        <p className="mt-3.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[.06em]"
           style={{ color: "var(--fi-text-still)" }}>
          Ergebnis festhalten
        </p>
        {/* ══════════════════════════════════════════════════════════════
            EIN BAUTEIL STATT NEUN HANDGESCHRIEBENER KNÖPFE (19.08.2026)

            Hier standen die Knöpfe, die Datumsfelder — und der Zweig für
            „Erreicht – Sonstiges", der `setFeldOffen("notiz")` setzte. Einen
            Block, der „notiz" ANZEIGT, gab es nie. Der Knopf setzte also einen
            Zustand, den nichts liest, und kehrte zurück: keine Anfrage, kein
            Feld, keine Meldung — Daniels „es passiert nichts", wörtlich.

            `ErgebnisWahl` bringt Knöpfe, Notizpflicht mit Zeichenzähler und
            Datumsfelder mit. Softphone und Kundenkarte rendern dasselbe
            Bauteil; ein neues Ergebnis ist eine Zeile in
            `shared/fiaon-kontakt-ergebnis-liste.ts`.
            ══════════════════════════════════════════════════════════════ */}
        <ErgebnisWahl
          onErgebnis={(art, zusatz) => ergebnis(art, zusatz)}
          laeuft={laeuft}
          kundeName={k.name}
          heute={heuteIso()}
          vorgabeDatum={datumWert}
        />
        <p className="mt-1.5 text-[11.5px] fi-zahl" style={{ color: "var(--fi-text-still)" }}>
          {k.nichtErreicht > 0 && `${k.nichtErreicht}× nicht erreicht`}
          {k.nichtErreicht > 0 && k.rechnungVersandt > 0 && " · "}
          {k.rechnungVersandt > 0 && `${k.rechnungVersandt}× Zahlungsdaten`}
        </p>

        {/* Detailansicht: Stammdaten und vollständiger Verlauf */}
        <button type="button" onClick={onOeffnen}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: "var(--fi-primaer)" }}>
          {offen ? "Details schließen" : "Details, Stammdaten und Verlauf"}
          <ZeichenWinkel richtung={offen ? "oben" : "unten"} size={12} />
        </button>

        {offen && (
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {/* ══════════════════════════════════════════════════════════════
                BUCHUNGEN — WAS HAT ER BESTELLT, WAS IST OFFEN

                ── DER AUFTRAG (11.08.2026) ──────────────────────────────────
                Ein Agent: „Es wäre wichtig, dass jeder Mitarbeiter in den
                Stammdaten sehen kann: welches Paket gebucht wurde, welche
                Zusatzleistungen (z. B. Schufa), was bezahlt bzw. noch offen
                ist, wann der Antrag gestellt wurde. Aktuell kann teilweise nur
                der Vertriebsleiter diese Informationen einsehen."

                Alle vier Angaben stehen jetzt hier — für jeden, der den
                Kunden betreut, ohne Umweg über die Vertriebsleitung.
                ══════════════════════════════════════════════════════════════ */}
            {(k.buchungen ?? []).length > 0 && (
              <div className="p-3 rounded-xl sm:col-span-2"
                   style={{ background: "var(--fi-seite)" }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[.07em]"
                     style={{ color: "var(--fi-text-still)" }}>
                    Buchungen
                  </p>
                  {/* ── DER SAMMELKNOPF ──────────────────────────────────────
                      Erscheint erst, wenn etwas ausgewählt ist: Ein Knopf, der
                      immer da ist und meistens nichts tut, wird übersehen. */}
                  {auswahl.size > 0 && (
                    <>
                      <button type="button" disabled={laeuft === "arch-auswahl"}
                              onClick={() => void auswahlWegraeumen()}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-md disabled:opacity-40"
                              style={{ color: "#fff", background: "#b45309" }}>
                        {laeuft === "arch-auswahl"
                          ? "Wird weggeräumt …"
                          : `Auswahl wegräumen (${auswahl.size})`}
                      </button>
                      <button type="button" onClick={() => setAuswahl(new Set())}
                              className="text-[11px] font-semibold"
                              style={{ color: "var(--fi-text-still)" }}>
                        Auswahl aufheben
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {(k.buchungen ?? []).map((b) => (
                    <div key={b.ref}
                         className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-2.5 py-1.5 rounded-lg"
                         style={{
                           background: b.bezahlt ? "rgba(5,150,105,.06)"
                             : b.erledigt ? "rgba(15,23,42,.03)" : "rgba(217,119,6,.06)",
                           opacity: b.erledigt ? .6 : 1,
                         }}>
                      <span className="text-[12.5px] font-semibold" style={{ color: "var(--fi-text)" }}>
                        {b.bezeichnung}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={b.art === "bonitaet"
                              ? { background: "rgba(124,58,237,.1)", color: "#6d28d9" }
                              : { background: "rgba(29,78,216,.08)", color: "var(--fi-primaer)" }}>
                        {b.art === "bonitaet" ? "Zusatz" : "Paket"}
                      </span>
                      {b.betragCents != null && (
                        <span className="text-[12.5px] font-bold tabular-nums">{eur(b.betragCents)}</span>
                      )}
                      <span className="text-[11.5px] font-semibold"
                            style={{ color: b.bezahlt ? "#059669" : b.erledigt ? "var(--fi-text-still)" : "#b45309" }}>
                        {b.zahlungText}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums"
                            style={{ color: "var(--fi-text-still)" }}>
                        gestellt {b.gestelltAm ? dtag(b.gestelltAm) : "—"}
                        {b.faelligAm && !b.bezahlt && ` · fällig ${dtag(b.faelligAm)}`}
                      </span>
                      {b.verwendungszweck && !b.bezahlt && (
                        <span className="w-full text-[11px] font-mono"
                              style={{ color: "var(--fi-text-still)" }}>
                          Verwendungszweck: {b.verwendungszweck}
                        </span>
                      )}
                      {/* ══════════════════════════════════════════════════════
                          EINE DOPPELTE BUCHUNG WEGRÄUMEN

                          ── DER AUFTRAG (13.08.2026) ────────────────────────
                          Daniel Stripling um 00:30: „Man sieht hier jetzt alle
                          Anträge. Fragt man dann am Telefon nach, welchen die
                          Person möchte, löscht die anderen und sendet dann die
                          Zahlungsdaten-E-Mail? Weil Anträge rauslöschen geht
                          nicht."

                          Jetzt geht es. Es wird ARCHIVIERT, nicht gelöscht
                          (AGENTS.md) — für den Agenten sieht es gleich aus, die
                          Buchung verschwindet aus seiner Liste. Sie ist nur
                          nicht weg: Provisionsnachweis, Zahlungsspur und die
                          Möglichkeit zur Rücknahme bleiben.

                          Nur bei UNBEZAHLTEN und nur, wenn mehr als eine
                          Buchung übrig ist — der Server prüft beides erneut.
                          ══════════════════════════════════════════════════════ */}
                      {!b.bezahlt && !b.erledigt && (k.buchungen ?? []).filter((x) => !x.erledigt).length > 1 && (
                        <span className="ml-auto shrink-0 flex items-center gap-2">
                          {/* Das Häkchen für die Mehrfachauswahl. Ein echtes
                              Kontrollkästchen, kein nachgebautes: Tastatur und
                              Screenreader kennen es. */}
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer"
                                 style={{ color: "var(--fi-text-still)" }}>
                            <input type="checkbox" checked={auswahl.has(b.ref)}
                                   onChange={() => umschalten(b.ref)}
                                   aria-label={`${b.bezeichnung} zum Wegräumen auswählen`}
                                   style={{ width: 14, height: 14, accentColor: "#b45309" }} />
                            wählen
                          </label>
                          <button type="button"
                                  className="text-[11px] font-semibold px-2 py-1 rounded-md"
                                  style={{ color: "#b45309", background: "rgba(180,83,9,.08)" }}
                                  disabled={laeuft === `arch-${b.ref}` || laeuft === "arch-auswahl"}
                                  onClick={() => void buchungWegraeumen(b)}>
                            {laeuft === `arch-${b.ref}` ? "…" : "Doppelt — wegräumen"}
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* ══════════════════════════════════════════════════════════
                    WELCHE IST DIE RICHTIGE?

                    ── DANIELS ZWEITE FRAGE (13.08.2026, 00:30) ──────────────
                    „Oder wird dann die E-Mail geschickt bei dem Antrag, wo steht
                    ‚Zahlung gemeldet'?"

                    Ja — und bei 59 von 420 Kunden mit mehreren offenen
                    Buchungen weiß das System es schon: Wer bei einer Bestellung
                    „Zahlung gemeldet" hat, hat sich für DIESE entschieden.

                    Statt den Agenten raten zu lassen, steht es da. Bei den
                    übrigen bleibt die Frage am Telefon — aber dann weiß er
                    wenigstens, dass es eine gibt.
                    ══════════════════════════════════════════════════════════ */}
                {(() => {
                  const offen = (k.buchungen ?? []).filter((b) => b.offen);
                  const gemeldet = offen.filter((b) => b.zahlungText?.startsWith("Zahlung gemeldet"));
                  if (offen.length < 2) return null;
                  return (
                    <p className="mt-2 text-[12px] px-2.5 py-1.5 rounded-lg"
                       style={{ background: "rgba(29,78,216,.06)", color: "var(--fi-primaer)" }}>
                      {gemeldet.length === 1
                        ? <>Der Kunde hat für <b>{gemeldet[0].bezeichnung}</b> eine Zahlung
                            gemeldet — das ist mit hoher Wahrscheinlichkeit die gewollte
                            Buchung. Die anderen kannst du wegräumen.</>
                        : <>{offen.length} offene Buchungen. Frag am Telefon, welche der
                            Kunde will — die anderen räumst du hier weg.</>}
                    </p>
                  );
                })()}

                {/* Die Summe beantwortet die Frage, die am Telefon kommt:
                    „Was schulde ich Ihnen denn insgesamt?" */}
                {(k.buchungen ?? []).some((b) => b.offen) && (
                  <p className="mt-2 text-[12px]" style={{ color: "#b45309" }}>
                    Offen insgesamt:{" "}
                    <b>{eur((k.buchungen ?? []).filter((b) => b.offen)
                      .reduce((s, b) => s + (b.betragCents ?? 0), 0))}</b>
                  </p>
                )}
              </div>
            )}
            <div className="p-3 rounded-xl" style={{ background: "var(--fi-seite)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[.07em] mb-1.5"
                 style={{ color: "var(--fi-text-still)" }}>Stammdaten</p>
              <dl className="text-[12.5px]">
                {[
                  ["Adresse", [k.stammdaten?.strasse, [k.stammdaten?.plz, k.stammdaten?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null],
                  ["Land", k.stammdaten?.land],
                  ["Geburtsdatum", k.stammdaten?.geburtsdatum ? dtag(String(k.stammdaten.geburtsdatum)) : null],
                  ["E-Mail", k.email],
                  ["Telefon", k.telefon],
                  ["Verwendungszweck", k.zahlung?.referenz],
                  ["Wiedervorlage", k.wiedervorlage ? dtag(k.wiedervorlage) : null],
                  ["Betreut seit", k.betreutSeit ? dtag(k.betreutSeit) : null],
                ].map(([label, wert]) => (
                  <div key={String(label)} className="flex gap-2 py-0.5">
                    <dt className="w-[118px] shrink-0" style={{ color: "var(--fi-text-still)" }}>{label}</dt>
                    <dd className="min-w-0 flex-1 font-medium break-words"
                        style={{ color: wert ? "var(--fi-text)" : "var(--fi-text-still)" }}>
                      {(wert as string) || "nicht hinterlegt"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* ── E-Mails ─────────────────────────────────────────────────
                Steht VOR dem Verlauf: Die häufigste Frage am Telefon ist
                „habe ich das bekommen?", und die Antwort steht hier. */}
            <div className="p-3 rounded-xl" style={{ background: "var(--fi-seite)" }}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[.07em] flex-1"
                   style={{ color: "var(--fi-text-still)" }}>
                  E-Mails
                </p>
                <button type="button" onClick={() => setBlatt(k.personId)}
                        className="fi-zweitknopf inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold">
                  <MarkeFunke size={13} />
                  Gesprächsblatt
                </button>
                <button type="button" onClick={() => setSendeMenue(k.personId)}
                        className="fi-primaerknopf inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold">
                  <MarkeBrief size={14} />
                  E-Mail senden
                </button>
              </div>
              <Versandzentrum personId={k.personId} />
            </div>
            <SendeMenue personId={k.personId} offen={sendeMenue === k.personId}
                        onSchliessen={() => setSendeMenue(null)} onGesendet={onZaehler} />
            <Gespraechsblatt personId={k.personId} offen={blatt === k.personId}
                             onZu={() => setBlatt(null)} />

            <div className="p-3 rounded-xl" style={{ background: "var(--fi-seite)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[.07em] mb-1.5"
                 style={{ color: "var(--fi-text-still)" }}>
                Verlauf · {wartezeit(k.letzterKontakt)}
              </p>
              {!verlauf && <Skelett h={14} />}
              {verlauf && verlauf.length === 0 && (
                <p className="text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>Noch kein Eintrag.</p>
              )}
              {verlauf && verlauf.length > 0 && (
                <ul className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {verlauf.map((v: any, i: number) => (
                    <li key={i} className="text-[12px] leading-snug">
                      <span className="font-semibold">{new Date(v.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      {" · "}
                      <span style={{ color: "var(--fi-text-leise)" }}>
                        {/* `v` kommt als `any` aus dem Verlauf; die geteilte Liste
                            ist streng nach Ergebnis getippt. Der Zugriff wird
                            deshalb ausdrücklich geweitet, statt die Liste
                            aufzuweichen — der Typ ist dort die Wand. */}
                        {v.agentName || v.agent || "System"}: {(ERGEBNIS_TEXT as Record<string, string>)[String(v.ergebnis)] || (v.art === "note" ? "Notiz" : v.art)}
                      </span>
                      {v.notiz && <span style={{ color: "var(--fi-text-still)" }}> — {v.notiz}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {/* Notiz direkt hier — sie gehört zum Verlauf, nicht zu den Aktionen. */}
              <div className="mt-2.5 flex items-center gap-2">
                <input value={notiz} onChange={(e) => setNotiz(e.target.value)}
                       placeholder="Notiz hinzufügen"
                       className="flex-1 min-w-0 h-[34px] px-2.5 rounded-lg border bg-white text-[12.5px] outline-none"
                       style={{ borderColor: "var(--fi-linie)" }} />
                <button type="button" disabled={notiz.trim().length < 2 || !!laeuft}
                        onClick={() => void ergebnis("notiz")}
                        className="fi-zweitknopf px-3 py-2 text-[12px] font-semibold">
                  Speichern
                </button>
              </div>

              {/* Kein echter Kunde? Melden, nicht selbst entfernen. */}
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--fi-linie)" }}>
                {!testOffen ? (
                  <button type="button" onClick={() => setTestOffen(true)}
                          className="text-[12px] font-semibold underline decoration-dotted"
                          style={{ color: "var(--fi-text-still)" }}>
                    Kein echter Kunde? Als Testeintrag melden
                  </button>
                ) : (
                  <div>
                    <p className="text-[12px] leading-snug" style={{ color: "var(--fi-text-leise)" }}>
                      Die Vertriebsleitung prüft und legt die Bestellung ins Archiv, wenn es stimmt.
                      Du entfernst hier nichts selbst — und der Kunde bleibt bis zur Entscheidung in
                      deiner Liste.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input value={testNotiz} onChange={(e) => setTestNotiz(e.target.value)}
                             placeholder="Woran erkennst du das? (ein Satz)"
                             className="flex-1 min-w-0 h-[34px] px-2.5 rounded-lg border bg-white text-[12.5px] outline-none"
                             style={{ borderColor: "var(--fi-linie)" }} />
                      <button type="button" disabled={testNotiz.trim().length < 5 || !!laeuft}
                              onClick={() => void testeintragMelden()}
                              className="fi-zweitknopf px-3 py-2 text-[12px] font-semibold">
                        {laeuft === "test" ? "Meldet …" : "Melden"}
                      </button>
                      <button type="button" onClick={() => { setTestOffen(false); setTestNotiz(""); }}
                              className="text-[12px] font-semibold px-2"
                              style={{ color: "var(--fi-text-still)" }}>
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DIE BESTÄTIGUNG VOR DEM SENDEN (31.08.2026)
          Ein Bauteil, drei Aufrufstellen — Kundenkarte, Vertriebsansicht und
          Vollpfleger-Fluss. Drei eigene Dialoge waeren drei Wortlaute, und der
          vierte Aufrufort bekaeme keinen.
          ══════════════════════════════════════════════════════════════════ */}
      {bestaetigen && (
        <RechnungBestaetigung
          personId={k.personId}
          kundeName={k.name}
          laeuft={laeuft === "rechnung"}
          onAbbrechen={() => { setBestaetigen(false); setSendeFehler(null); }}
          onSenden={(ref) => void zahlungsdaten(ref)}
          sendeFehler={sendeFehler}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// NUMMER OHNE LAND — INLINE ERGÄNZEN
//
// ── DER ANLASS (31.08.2026) ────────────────────────────────────────────────
// Seit heute verweigert der Server eine national geschriebene Nummer ohne Land,
// statt „+49" zu raten. Bewiesen war der Schaden im Anrufprotokoll: Kunde
// Maurizio Pampanini (Winkel, CH) hat die Nummer 0797435749 — eine gültige
// SCHWEIZER Mobilnummer. Gewählt wurde dreimal +49797435749, also Deutschland.
//
// Die Verweigerung ist richtig und macht 18 Kunden unanrufbar. An dieser Stelle
// stand vorher nur „Ländervorwahl fehlt": eine wahre Aussage und eine
// Sackgasse.
//
// ── WARUM DER VORSCHLAG EIN VORSCHLAG BLEIBT ──────────────────────────────
// Aus PLZ und Ort lässt sich das Land meist ableiten — aber „meist" ist genau
// die Qualität, die diesen Fehler erzeugt hat. Der Vorschlag ist vorausgewählt
// und muss BESTÄTIGT werden. Wer ihn übernimmt, hat ihn gelesen.
// ═══════════════════════════════════════════════════════════════════════════
function NummerLandNachtragen({ k, onFertig }: { k: Kunde; onFertig: (neu: any) => void }) {
  const vorschlag = k.landVorschlag?.land ?? "";
  const [land, setLand] = useState(vorschlag);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Die Vorschau rechnet dieselbe Regel wie der Server: fuehrende 0 weg,
  // Vorwahl davor. Sie ist eine ANZEIGE — gespeichert wird, was der Server
  // daraus macht, und seine Antwort nennt die Wahlform noch einmal.
  const VORWAHL: Record<string, string> = { DE: "+49", AT: "+43", CH: "+41", IT: "+39", RO: "+40", SK: "+421" };
  const roh = String(k.nummerRoh ?? k.telefon ?? "").replace(/[\s()/.\-]/g, "");
  const wird = land && VORWAHL[land] && roh.startsWith("0")
    ? `${VORWAHL[land]}${roh.replace(/^0+/, "")}`
    : null;

  const speichern = async () => {
    setLaeuft(true);
    setFehler(null);
    const r = await fetch(`/api/fiaon/agent/crm/kunden/${k.personId}/nummer-land`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ land }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaeuft(false);
    if (j?.ok) {
      setMeldung(j.meldung);
      // Die Karte neu holen: Danach ist der Anrufknopf da, und der Zaehler im
      // Filter sinkt um eins. Ohne das bliebe die Sackgasse sichtbar, obwohl
      // sie behoben ist.
      const n = await fetch(`/api/fiaon/agent/crm/kunden/${k.personId}`,
        { credentials: "include" }).then((x) => x.json()).catch(() => null);
      if (n?.ok && n.kunde) onFertig(n.kunde);
    } else setFehler(j?.error || "Das hat nicht geklappt.");
  };

  if (meldung) {
    return (
      <span className="inline-flex flex-col px-3 py-2 text-[12px]"
            style={{
              borderRadius: "var(--fi-radius-knopf)", background: "rgba(5,150,105,.08)",
              color: "#047857", border: "1px solid rgba(5,150,105,.3)",
            }}>
        <span className="font-semibold">{meldung}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1.5 px-3 py-2"
          data-fi="nummer-ohne-land"
          style={{
            borderRadius: "var(--fi-radius-knopf)", background: "var(--fi-flaeche-warnung, #fffbeb)",
            border: "1px solid var(--fi-tier2)", maxWidth: 340,
          }}>
      <span className="fi-zahl font-bold text-[12.5px]" style={{ color: "var(--fi-tier2)" }}>
        {k.telefon}
      </span>
      <span className="text-[10.5px] leading-tight" style={{ color: "var(--fi-tier2)" }}>
        Ländervorwahl fehlt — nicht anrufbar. Woher kommt der Kunde?
      </span>
      <span className="inline-flex items-center gap-1.5">
        <select value={land} onChange={(e) => { setLand(e.target.value); setFehler(null); }}
                aria-label="Land des Kunden"
                className="text-[12px] px-2 py-1 rounded-lg border border-slate-300 bg-white">
          <option value="">— Land wählen —</option>
          <option value="AT">Österreich</option>
          <option value="DE">Deutschland</option>
          <option value="CH">Schweiz</option>
          <option value="IT">Italien</option>
          <option value="RO">Rumänien</option>
          <option value="SK">Slowakei</option>
        </select>
        <button type="button" onClick={() => void speichern()} disabled={!land || laeuft}
                className="text-[12px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50"
                style={{ background: "#1d4ed8" }}>
          {laeuft ? "…" : "Speichern"}
        </button>
      </span>
      {/* Die Vorschau: Der Agent sieht, was gewaehlt werden WIRD, bevor er
          speichert. Genau das fehlte beim Raten. */}
      {wird && (
        <span className="text-[11px] fi-zahl" style={{ color: "#1e3a8a" }}>
          {k.nummerRoh ?? k.telefon} + {land} → <b>{wird}</b>
        </span>
      )}
      {vorschlag && (
        <span className="text-[10.5px] text-slate-500">
          Vorschlag {vorschlag} ({k.landVorschlag?.grund}) — bitte prüfen, nicht raten.
        </span>
      )}
      {!vorschlag && k.landVorschlag?.grund && (
        <span className="text-[10.5px] text-slate-500">
          Kein Vorschlag: {k.landVorschlag.grund}.
        </span>
      )}
      {fehler && <span className="text-[11px]" style={{ color: "#b91c1c" }}>{fehler}</span>}
    </span>
  );
}



// ═══════════════════════════════════════════════════════════════════════════
// VERSANDZENTRUM — was ging raus, und schick es noch einmal
//
// „Der Kunde sagt, er hat nichts bekommen." Bisher: Nachricht an den
// Vorgesetzter, der sucht im Make-Protokoll. Jetzt: zwei Klicks, hier.
//
// Die drei Wände (Zustand, Tageslimit, Rechte) stehen im SERVER. Diese Seite
// zeigt nur, was er zurückgibt — auch den Grund, warum ein Knopf nicht geht.
// Ein ausgegrauter Knopf ohne Begründung erzeugt genau die Rückfrage, die das
// hier abschaffen soll.
// ═══════════════════════════════════════════════════════════════════════════
export function Versandzentrum({ personId }: { personId: number }) {
  const { zeige } = useToast();
  const [daten, setDaten] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await api(`/agent/versand/${personId}`);
    setDaten(r.ok ? r.json : { fehler: r.json?.error || "Nicht ladbar." });
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);

  const senden = async (art: string, titel: string) => {
    if (!confirm(`„${titel}" jetzt erneut an den Kunden schicken?`)) return;
    setBusy(art);
    const r = await api(`/agent/versand/${personId}/${art}`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null);
    if (r.json?.knoepfe) setDaten((d: any) => ({ ...d, knoepfe: r.json.knoepfe, historie: r.json.historie }));
    zeige(r.ok ? "erfolg" : "info", r.ok ? "Verschickt" : "Nicht verschickt",
      r.json?.meldung || r.json?.error || "Bitte erneut versuchen.");
  };

  if (!daten) return <Skelett h={18} />;
  if (daten.fehler) {
    return <p className="text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>{daten.fehler}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(daten.knoepfe || []).map((k: any) => (
          <button key={k.art} type="button" onClick={() => void senden(k.art, k.titel)}
                  disabled={!k.erlaubt || busy === k.art}
                  title={k.erlaubt ? k.zweck : (k.grund || "")}
                  className="fi-zweitknopf px-3 py-2 text-[12px] font-semibold disabled:opacity-40">
            {busy === k.art ? "…" : k.titel}
            {k.heute > 0 && <span className="ml-1.5 fi-zahl" style={{ opacity: 0.6 }}>{k.heute}/3</span>}
          </button>
        ))}
      </div>
      {/* Die Gründe im Klartext — nicht als Wolke am Mauszeiger, die auf dem
          Telefon niemand sieht. */}
      {(daten.knoepfe || []).some((k: any) => !k.erlaubt) && (
        <ul className="mt-2 space-y-0.5">
          {(daten.knoepfe || []).filter((k: any) => !k.erlaubt).map((k: any) => (
            <li key={k.art} className="text-[11.5px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
              {k.titel}: {k.grund}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3.5 text-[10.5px] font-semibold uppercase tracking-[.06em]"
         style={{ color: "var(--fi-text-still)" }}>
        Versandhistorie
      </p>
      {(daten.historie || []).length === 0 ? (
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>
          Für diesen Kunden ist noch keine Mail protokolliert.
        </p>
      ) : (
        <div className="mt-1">
          {(daten.historie || []).slice(0, 12).map((h: any) => (
            <div key={h.id} className="py-1.5 text-[12px] flex flex-wrap items-baseline gap-x-2"
                 style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
              <span className="font-semibold">{h.titel}</span>
              <span style={{ color: h.status === "versandt" ? "var(--fi-erfolg)" : "var(--fi-tier2)" }}>
                {h.status === "versandt" ? "versandt" : h.status === "uebersprungen" ? "übersprungen" : "fehlgeschlagen"}
              </span>
              <span style={{ color: "var(--fi-text-still)" }}>
                {new Date(h.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}
                {" · "}{h.ausgeloestVon}
              </span>
              {h.grund && (
                <span className="block w-full text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{h.grund}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
