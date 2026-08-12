import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentShell } from "./shared";
import { Reveal } from "./motion";
import { Skelett, eur, useReduzierteBewegung, useToast } from "@/lib/fiaon-ui";
import { ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";
import { statusAusTierGrund, STUFEN, type Stufe } from "@shared/fiaon-kundenstatus";
import { MarkeBrief, SendeMenue } from "@/components/SendeMenue";
import { Gespraechsblatt } from "@/components/Gespraechsblatt";
import { MarkeFunke, anrufStarten } from "@/components/Softphone";

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
  { key: "rechnung_offen", label: "Rechnung offen", zaehler: "rechnung_offen" },
  { key: "frist_abgelaufen", label: "Frist abgelaufen", zaehler: "frist_abgelaufen" },
  { key: "antrag_offen", label: "Antrag offen", zaehler: "antrag_offen" },
  { key: "leads", label: "Leads", zaehler: "leads" },
  { key: "nicht_erreicht", label: "Nicht erreicht", zaehler: "nicht_erreicht" },
  // Der Ruhe-Pool ist ein Filter, kein Loch: Wer viermal nicht erreicht wurde,
  // steht hier — sichtbar, zählbar, jederzeit aufrufbar.
  { key: "ruhend", label: "Ruhend", zaehler: "ruhend" },
  { key: "bezahlt", label: "Bezahlt (Bestand)", zaehler: "bezahlt" },
  { key: "gesperrt", label: "Gesperrt", zaehler: "gesperrt" },
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

/** Die Ergebnisse — dieselben Namen wie im Server. */
const ERGEBNISSE: { art: string; label: string; braucht?: "zusage" | "termin" | "notiz" }[] = [
  { art: "erreicht_zahlt_gleich", label: "Zahlt sofort" },
  { art: "erreicht_zahlt_am", label: "Zahlt am …", braucht: "zusage" },
  { art: "nicht_erreicht", label: "Nicht erreicht" },
  { art: "mailbox", label: "Mailbox besprochen" },
  { art: "rueckruf_termin", label: "Rückruf vereinbart", braucht: "termin" },
  { art: "erreicht_abgelehnt", label: "Erreicht – abgelehnt" },
  // ── ERREICHT, ABER NOCH OHNE ERGEBNIS ──────────────────────────────────
  // Ein Agent: „Mir fehlt ein Status fuer Kunden, die ich erreicht habe, bei
  // denen aber noch kein klares Ergebnis vorliegt. Wenn ich nur eine Notiz
  // hinterlege, zaehlt der Kunde nicht als angerufen."
  //
  // `braucht: "notiz"` oeffnet beim Anklicken direkt das Notizfeld — genau
  // wie er es vorgeschlagen hat. Ohne Text kein Speichern: Ein Gespraech ohne
  // Ergebnis UND ohne Vermerk waere nur ein Haken.
  { art: "erreicht_sonstiges", label: "Erreicht – Sonstiges", braucht: "notiz" },
  { art: "nummer_falsch", label: "Falsche Nummer" },
  // Gemeldet 06.08.2026: Manche Kunden blockieren die Nummer eines Agenten und
  // gehen beim nächsten ran. Dieser Knopf gibt den Kunden weiter, statt ihn
  // stumm in der Liste altern zu lassen.
  { art: "nummer_blockiert", label: "Anrufer blockiert" },
];

/** Ergebnis-Kürzel in Klartext — im Verlauf soll niemand Feldnamen lesen. */
const ERGEBNIS_TEXT: Record<string, string> = {
  erreicht_zahlt_gleich: "Zahlt sofort",
  erreicht_zahlt_am: "Zahlt am vereinbarten Datum",
  erreicht_abgelehnt: "Erreicht – abgelehnt",
  erreicht_sonstiges: "Erreicht – Sonstiges",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Falsche Nummer",
  nummer_blockiert: "Anrufer blockiert — an Kollegen übergeben",
};

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
  const [feldOffen, setFeldOffen] = useState<"zusage" | "termin" | "notiz" | null>(null);
  const [datumWert, setDatumWert] = useState(tagPlus(1));
  const [zeitWert, setZeitWert] = useState("10:00");
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

  const ergebnis = async (art: string, zusatz: Record<string, unknown> = {}) => {
    setLaeuft(art);
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art, notiz: notiz.trim() || undefined, ...zusatz }),
    });
    setLaeuft(null);
    if (!r.ok) {
      zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen.");
      return;
    }
    // Eine misslungene Übergabe ist kein Erfolg: Wenn jeder Kollege schon
    // blockiert wurde, muss der Agent das lesen und nicht ein grünes Häkchen.
    zeige(r.json.uebergabe && !r.json.uebergabe.ok ? "info" : "erfolg",
      r.json.meldung || "Gespeichert", k.name);
    setFeldOffen(null);
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
  };

  const zahlungsdaten = async () => {
    setLaeuft("rechnung");
    const r = await api(`/agent/crm/kunden/${k.personId}/rechnung`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    if (r.ok) {
      zeige(r.json.warnung ? "info" : "erfolg", "Zahlungsdaten versandt",
        r.json.warnung || `An ${r.json.versandtAn} — mit Bankverbindung, Verwendungszweck und Rechnung.`);
      if (r.json.kunde) onNeu(r.json.kunde);
    } else zeige("fehler", "Nicht versandt", r.json?.error || "Bitte erneut versuchen.");
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
            <span className="inline-flex flex-col px-3 py-2 text-[12px] font-medium"
                  style={{
                    borderRadius: "var(--fi-radius-knopf)", background: "var(--fi-flaeche-warnung, #fffbeb)",
                    color: "var(--fi-tier2)", border: "1px solid var(--fi-tier2)",
                  }}>
              <span className="fi-zahl font-bold">{k.telefon}</span>
              <span className="text-[10.5px] leading-tight">Ländervorwahl fehlt</span>
            </span>
          ) : (
            <span className="px-3 py-2.5 text-[12px] font-medium"
                  style={{
                    borderRadius: "var(--fi-radius-knopf)", background: "var(--fi-seite)",
                    color: "var(--fi-text-still)", border: "1px solid var(--fi-linie)",
                  }}>
              keine Nummer
            </span>
          )}

          <button type="button" onClick={() => void zahlungsdaten()} disabled={!!laeuft || !k.email}
                  title={k.email ? `Zahlungsdaten und Rechnung an ${k.email}` : "Keine E-Mail hinterlegt"}
                  className="fi-sendeknopf inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold">
            <ZeichenSenden size={15} />
            {laeuft === "rechnung" ? "Sende …" : "Zahlungsdaten senden"}
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

        {/* Zweite Reihe: die sieben Ergebnisse */}
        <p className="mt-3.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[.06em]"
           style={{ color: "var(--fi-text-still)" }}>
          Ergebnis festhalten
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ERGEBNISSE.map((e) => (
            <button key={e.art} type="button" disabled={!!laeuft}
                    onClick={() => {
                      if (e.braucht === "zusage") { setFeldOffen(feldOffen === "zusage" ? null : "zusage"); return; }
                      if (e.braucht === "termin") { setFeldOffen(feldOffen === "termin" ? null : "termin"); return; }
                      // ── „ERREICHT – SONSTIGES" ÖFFNET DIE NOTIZ ───────────
                      // Der Vorschlag des Agenten wörtlich: „Beim Anklicken
                      // öffnet sich direkt die Notiz, in der eingetragen werden
                      // kann, was besprochen wurde und wie man verblieben ist."
                      //
                      // Ohne Text wird nicht gespeichert: Ein Gespräch ohne
                      // Ergebnis UND ohne Vermerk wäre nur ein Haken, und in
                      // drei Tagen weiß niemand mehr, worum es ging.
                      if (e.braucht === "notiz") {
                        if (!notiz.trim()) { setFeldOffen("notiz"); return; }
                        void ergebnis(e.art);
                        return;
                      }
                      // Die Übergabe ist die einzige Aktion hier, die den Kunden
                      // aus der eigenen Hand gibt — und sie verschiebt damit auch
                      // die Chance auf die Provision. Das gehört vor den Klick,
                      // nicht in eine Meldung danach.
                      if (e.art === "nummer_blockiert" && !confirm(
                        `${k.name} hat deine Nummer blockiert?\n\n`
                        + `Der Kunde geht sofort an den Kollegen mit dem kleinsten Bestand, der bei `
                        + `ihm noch nicht blockiert wurde. Er verschwindet aus deiner Liste.\n\n`
                        + `Wichtig: Die Provision folgt dem, der den Abschluss dokumentiert. `
                        + `Macht der Kollege den Abschluss, gehört sie ihm.`,
                      )) return;
                      void ergebnis(e.art);
                    }}
                    className="fi-zweitknopf px-3 py-2.5 text-[12.5px] font-medium">
              {laeuft === e.art ? "…" : e.label}
            </button>
          ))}
          <span className="ml-auto text-[11.5px] fi-zahl" style={{ color: "var(--fi-text-still)" }}>
            {k.nichtErreicht > 0 && `${k.nichtErreicht}× nicht erreicht`}
            {k.nichtErreicht > 0 && k.rechnungVersandt > 0 && " · "}
            {k.rechnungVersandt > 0 && `${k.rechnungVersandt}× Zahlungsdaten`}
          </span>
        </div>

        {/* Datumsfelder — nur eines gleichzeitig offen */}
        {feldOffen === "zusage" && (
          <div className="mt-2.5 p-3 rounded-xl flex flex-wrap items-center gap-2" style={{ background: "var(--fi-seite)" }}>
            <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>Zahlt am</label>
            <input type="date" value={datumWert} min={heuteIso()} onChange={(e) => setDatumWert(e.target.value)}
                   className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                   style={{ borderColor: "var(--fi-linie)" }} />
            <button type="button" disabled={!datumWert || !!laeuft}
                    onClick={() => void ergebnis("erreicht_zahlt_am", { zusageDatum: datumWert })}
                    className="fi-primaerknopf px-3 py-2 text-[12px] font-bold text-white">
              Zusage speichern
            </button>
          </div>
        )}
        {feldOffen === "termin" && (
          <div className="mt-2.5 p-3 rounded-xl flex flex-wrap items-center gap-2" style={{ background: "var(--fi-seite)" }}>
            <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>Rückruf am</label>
            <input type="date" value={datumWert} min={heuteIso()} onChange={(e) => setDatumWert(e.target.value)}
                   className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                   style={{ borderColor: "var(--fi-linie)" }} />
            <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>um</label>
            <input type="time" value={zeitWert} step={900} onChange={(e) => setZeitWert(e.target.value)}
                   className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                   style={{ borderColor: "var(--fi-linie)" }} />
            <button type="button" disabled={!datumWert || !!laeuft}
                    onClick={() => void ergebnis("rueckruf_termin", { terminDatum: datumWert, terminZeit: zeitWert })}
                    className="fi-primaerknopf px-3 py-2 text-[12px] font-bold text-white">
              Termin speichern
            </button>
          </div>
        )}

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
                <p className="text-[11px] font-semibold uppercase tracking-[.07em] mb-2"
                   style={{ color: "var(--fi-text-still)" }}>
                  Buchungen
                </p>
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
                    </div>
                  ))}
                </div>
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
                        {v.agentName || v.agent || "System"}: {ERGEBNIS_TEXT[v.ergebnis] || (v.art === "note" ? "Notiz" : v.art)}
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
    </div>
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
