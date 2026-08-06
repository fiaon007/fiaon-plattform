import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentShell } from "./shared";
import { Reveal } from "./motion";
import { Skelett, eur, useReduzierteBewegung, useToast } from "@/lib/fiaon-ui";
import { ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";

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
//   1 Zahlungszusage heute oder überfällig
//   2 Rückruftermin heute oder überfällig
//   3 Zahlung gemeldet
//   4 Rechnung offen → Frist abgelaufen → Antrag abgeschlossen
//   5 Antrag abgebrochen → nur Lead
//   innerhalb jeder Gruppe: längste Wartezeit zuerst
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
  betrag: number | null;
  zusagedatum: string | null;
  wiedervorlage: string | null;
  rueckrufAm: string | null;
  nichtErreicht: number;
  rechnungVersandt: number;
  gesperrt: boolean;
  betreutSeit: string | null;
  letzterKontakt: string | null;
  letztesErgebnis: string | null;
  stammdaten: { strasse: string | null; plz: string | null; ort: string | null; land: string | null; geburtsdatum: string | null } | null;
  zahlung: { referenz: string | null; status: string | null; ref: string | null } | null;
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
  { key: "bezahlt", label: "Bezahlt (Bestand)", zaehler: "bezahlt" },
  { key: "gesperrt", label: "Gesperrt", zaehler: "gesperrt" },
];

const SORT: { key: string; label: string }[] = [
  { key: "arbeit", label: "Arbeitsreihenfolge" },
  { key: "neu", label: "Zuletzt hinzugefügt" },
  { key: "betrag", label: "Nach Betrag" },
  { key: "name", label: "Nach Name" },
];

/** Die Ergebnisse — dieselben Namen wie im Server. */
const ERGEBNISSE: { art: string; label: string; braucht?: "zusage" | "termin" }[] = [
  { art: "erreicht_zahlt_gleich", label: "Zahlt sofort" },
  { art: "erreicht_zahlt_am", label: "Zahlt am …", braucht: "zusage" },
  { art: "nicht_erreicht", label: "Nicht erreicht" },
  { art: "mailbox", label: "Mailbox besprochen" },
  { art: "rueckruf_termin", label: "Rückruf vereinbart", braucht: "termin" },
  { art: "erreicht_abgelehnt", label: "Erreicht – abgelehnt" },
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
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Falsche Nummer",
  nummer_blockiert: "Anrufer blockiert — an Kollegen übergeben",
};

const TIER_FARBE: Record<number, string> = {
  0: "var(--fi-erfolg)", 1: "var(--fi-tier1)", 2: "var(--fi-tier2)", 3: "var(--fi-tier3)",
};

const STATUS_TEXT: Record<string, string> = {
  bezahlt: "Bezahlt",
  zahlung_angekuendigt: "Zahlung gemeldet",
  rechnung_offen: "Rechnung offen",
  zahlungsfrist_abgelaufen: "Frist abgelaufen",
  antrag_abgeschlossen: "Antrag abgeschlossen",
  antrag_abgebrochen: "Antrag abgebrochen",
  nur_lead: "Lead",
  ausgeschlossen: "Ausgeschlossen",
};

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
  const [laedt, setLaedt] = useState(true);
  const [filter, setFilter] = useState("alle");
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
    if (person) { setOffen(Number(person)); gesprungen.current = Number(person); }
  }, []);

  const laden = useCallback(async (leise = false) => {
    if (!leise) setLaedt(true);
    const p = new URLSearchParams({ filter, sort });
    if (suche.trim()) p.set("q", suche.trim());
    const r = await api(`/agent/kunden/liste?${p.toString()}`);
    if (r.ok) {
      setListe(r.json.kunden);
      setZaehler(r.json.zaehler);
    }
    setLaedt(false);
  }, [filter, sort, suche]);

  useEffect(() => {
    const t = setTimeout(() => void laden(), suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [laden, suche]);

  /** Eine Karte aus der Liste nehmen, ohne die ganze Liste neu zu holen. */
  const entfernen = (personId: number) => setListe((l) => l.filter((k) => k.personId !== personId));
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

        {/* Filter-Chips mit Zählern. Ein Chip ohne Zahl ist eine Behauptung —
            die Zahl sagt, ob sich der Klick lohnt. */}
        <Reveal index={1}>
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
              onZaehler={() => void laden(true)}
            />
          ))}
        </div>

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
  k, index, offen, onOeffnen, onWeg, onNeu, onZaehler,
}: {
  k: Kunde; index: number; offen: boolean;
  onOeffnen: () => void; onWeg: () => void; onNeu: (k: Kunde) => void; onZaehler: () => void;
}) {
  const { zeige } = useToast();
  const reduziert = useReduzierteBewegung();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [feldOffen, setFeldOffen] = useState<"zusage" | "termin" | "notiz" | null>(null);
  const [datumWert, setDatumWert] = useState(tagPlus(1));
  const [zeitWert, setZeitWert] = useState("10:00");
  const [notiz, setNotiz] = useState("");
  const [verlauf, setVerlauf] = useState<any[] | null>(null);

  const zusage = relativ(k.zusagedatum);
  const rueckruf = k.rueckrufAm ? new Date(k.rueckrufAm) : null;
  const rueckrufFaellig = rueckruf ? rueckruf.getTime() <= Date.now() : false;

  /** Ein Ergebnis festhalten. Verschwindet der Kunde aus der Ansicht, sagt der
   *  Server das über die Wirkung — wir raten es nicht. */
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
    if (art === "erreicht_abgelehnt" || r.json.uebergabe?.ok) onWeg();
    else if (r.json.kunde) onNeu(r.json.kunde);
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

  const verlaufLaden = async () => {
    if (verlauf) return;
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    setVerlauf(r.ok ? r.json.verlauf : []);
  };

  useEffect(() => { if (offen) void verlaufLaden(); }, [offen]);

  return (
    <div id={`kunde-${k.personId}`} className="fi-karte relative overflow-hidden"
         style={reduziert ? undefined : { animation: "fiKarteAuf 340ms cubic-bezier(.32,.72,0,1) both", animationDelay: `${Math.min(index, 8) * 35}ms` }}
         data-fi-kunde={k.personId}>
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
              <span className="font-semibold" style={{ color: TIER_FARBE[k.tier] }}>
                {STATUS_TEXT[k.tierGrund] || k.tierGrund}
              </span>
              {k.betrag != null && <span>· {eur(k.betrag)}</span>}
              {k.produkt && <span className="truncate">· {k.produkt}</span>}
            </p>
          </button>
          <span className="shrink-0 flex flex-col items-end gap-1">
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

        {/* Erste Reihe: Anrufen · Zahlungsdaten · Mail */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {k.telefonWaehlbar ? (
            <a href={`tel:${k.telefonWaehlbar}`}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
