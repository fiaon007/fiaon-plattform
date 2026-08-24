import { useCallback, useEffect, useMemo, useState } from "react";
import { KundenKopf } from "@/components/kunde/AblaufLeiste";
import { anrufStarten } from "@/components/Softphone";
import { RechnungBestaetigung } from "@/components/agent/RechnungBestaetigung";
import { AgentShell, useFragen } from "./shared";
import { Reveal } from "./motion";
import { Skelett, eur, useReduzierteBewegung, useToast } from "@/lib/fiaon-ui";
import { ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";
import { VertriebZusage, useZusage } from "./vertrieb-zusage";
import { VertriebZahlungen, VertriebDokumente, VertriebZugang, LageTafel, ServiceZahlen, PipelineZahlen, BuchenDialog, Bestandswache } from "./vertrieb-service";
import DublettenArbeitsplatz from "@/components/admin/DublettenArbeitsplatz";
import { Fehlerrahmen } from "@/components/agent/Fehlerrahmen";
import { statusAusTierGrund } from "@shared/fiaon-kundenstatus";
import { PAKETE } from "@shared/fiaon-pakete";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/vertrieb — Gesamtsicht für die Vertriebsleitung
//
// Zwei Menschen im Team führen den Vertrieb. Sie brauchen den Blick über ALLE
// Kunden und die Möglichkeit, selbst zuzuweisen und Daten zu korrigieren — sonst
// müssen sie für jede Kleinigkeit beim Vorgesetzten anfragen. Genau das war die
// Bitte: „damit die für ihren Vertrieb selber alles machen können".
//
// Diese Seite ist bewusst eine TABELLE, keine Kartenliste: Hier arbeitet man
// nicht einen Kunden nach dem anderen ab, sondern vergleicht, sucht und
// verschiebt. Dafür braucht man Zeilen mit gleichen Spalten, keine Kacheln.
//
// Die Grenze steht im Server (fiaon-vertrieb.ts): Ein normaler Agent bekommt auf
// jeden Aufruf 404. Diese Seite prüft nichts selbst — eine Prüfung in der
// Oberfläche wäre ein Vorhang, keine Tür.
// ═══════════════════════════════════════════════════════════════════════════

interface Person {
  personId: number;
  name: string;
  email: string | null;
  telefon: string | null;
  telefonWaehlbar: string | null;
  tier: number;
  tierGrund: string;
  zusagedatum: string | null;
  wiedervorlage: string | null;
  rueckrufAm: string | null;
  nichtErreicht: number;
  rechnungVersandt: number;
  gesperrt: boolean;
  betreutSeit: string | null;
  agentId: number | null;
  agentName: string | null;
  betreuerName: string | null;
  letzterKontakt: string | null;
  produkt: string | null;
  betrag: number | null;
  ref: string | null;
}

interface AgentZeile {
  id: number; name: string; rolle: string;
  tier1: number; tier2: number; tier3: number; betreut: number; gesamt: number;
  /** Übernommene Mandate (mandat_seit, §16a) — dieselbe Zahl wie /agent/bestand. */
  mandate?: number;
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const FILTER: { key: string; label: string }[] = [
  { key: "alle", label: "Alle im Vertrieb" },
  { key: "ohne_agent", label: "Ohne Zuständigen" },
  { key: "zusage_heute", label: "Zusage heute" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "tier1", label: "Zahlung gemeldet" },
  { key: "tier2", label: "Rechnung offen" },
  { key: "tier3", label: "Leads" },
  { key: "betreut", label: "Bereits betreut" },
  { key: "bezahlt", label: "Bezahlt" },
  { key: "gesperrt", label: "Gesperrt" },
];

// Statustexte: shared/fiaon-kundenstatus.ts (eine Quelle für Server und Client).
const TIER_FARBE: Record<number, string> = {
  0: "var(--fi-erfolg)", 1: "var(--fi-tier1)", 2: "var(--fi-tier2)", 3: "var(--fi-tier3)",
};

function dtag(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function tageSeit(iso: string | null): string {
  if (!iso) return "nie";
  const t = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return t <= 0 ? "heute" : t === 1 ? "gestern" : `${t} Tage`;
}

export default function AgentVertriebSeite() {
  return (
    <AgentShell>
      <Inhalt />
    </AgentShell>
  );
}

function Inhalt() {
  const [zahlen, setZahlen] = useState<any>(null);
  const [agenten, setAgenten] = useState<AgentZeile[]>([]);
  const [personen, setPersonen] = useState<Person[]>([]);
  const fragen = useFragen();
  const [laedt, setLaedt] = useState(true);
  const [keinZugang, setKeinZugang] = useState(false);
  // Die Verpflichtungserklärung. Solange sie offen ist, liefert der Server
  // ohnehin keine Daten (403) — die Tafel erklärt dem Menschen, warum.
  const { zusage, geprueft, erneutPruefen, schliessen } = useZusage();
  // Vier Arbeiten, vier Reiter (06.08.2026). Sie sind getrennt, obwohl sie
  // denselben Bestand betreffen: Wer Zahlungen prüft, ist in einem anderen Kopf
  // als wer Unterlagen nachfordert. Eine gemischte Liste wäre schneller gebaut
  // und langsamer abzuarbeiten.
  // Seit 08.08.2026 fünf Reiter: „Dubletten" kam hinzu, weil die
  // Vertriebsleitung telefoniert und damit die Einzige ist, die „Axel Conrad
  // zweimal" wirklich beurteilen kann.
  const [bereich, setBereich] = useState<"kunden" | "zahlungen" | "dokumente" | "zugang" | "dubletten" | "bestandswache">("kunden");
  const [service, setService] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any>(null);
  const [filter, setFilter] = useState("alle");
  const [agentFilter, setAgentFilter] = useState<number | null>(null);
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<number[]>([]);
  const [akte, setAkte] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const { zeige } = useToast();
  const reduziert = useReduzierteBewegung();

  // ══════════════════════════════════════════════════════════════════════════
  // EINE FEHLGESCHLAGENE ABFRAGE SAGT ES — STATT EWIG ZU LADEN (19.08.2026)
  //
  // ── DIE MELDUNG (Daniel Stripling) ──────────────────────────────────────
  // „Im Bereich ‚Vertriebsleitung' kann ich bei den Kunden die Kundenakte nicht
  // öffnen … Dadurch kann ich weder die Kundendaten noch den bisherigen Verlauf
  // einsehen."
  //
  // ── WAS DER SCREENSHOT ZEIGTE (scripts/schau-neun-punkte.ts) ────────────
  // Die Seite baut sich auf — Titel, Reiter, Filter, Tabellenkopf — und darunter
  // stehen graue Balken. Sechs Sekunden, zehn Sekunden, unbegrenzt. Kein
  // Fehler in der Konsole, keine Meldung am Bildschirm.
  //
  // ── DIE URSACHE ─────────────────────────────────────────────────────────
  // JEDER Lader hier stieg im Fehlerfall still aus: `if (r.ok) setZahlen(…)` —
  // und sonst nichts. `zahlen` blieb `null`, und `null` heißt in dieser Anzeige
  // „lädt noch". Es gab keinen Zustand für „hat nicht geklappt".
  //
  // GEMESSEN gegen die echten Routen: `/agent/vertrieb/personen` und
  // `/agent/vertrieb/service` antworten mit HTTP 403, wenn die
  // Verpflichtungserklärung offen ist — und `/agent/vertrieb/zusage` brauchte
  // 6,8 Sekunden. In dieser Zeit ist die Seite vollständig leer.
  //
  // Jetzt trägt die Seite einen `fehler` und zeigt ihn. AGENTS.md: „Eine
  // Anzeige muss zwischen ‚es ist kaputt' und ‚ich kann es nicht messen'
  // unterscheiden."
  // ══════════════════════════════════════════════════════════════════════════
  const [fehler, setFehler] = useState<string | null>(null);

  /** Der Klartext zu einer gescheiterten Abfrage — nach VERURSACHER getrennt. */
  const grundVon = (r: { status: number; json: any }, was: string): string => {
    if (r.status === 401) return "Deine Sitzung ist abgelaufen — bitte neu anmelden.";
    if (r.status === 403) return r.json?.error || "Für diesen Bereich fehlt dir die Berechtigung.";
    if (r.status >= 500) return `${was} konnte der Server nicht liefern (HTTP ${r.status}). `
      + "Das ist unsere Seite — bitte melden.";
    if (r.status === 0 || !r.status) return "Keine Verbindung zum Server — Netz prüfen.";
    return r.json?.error || `${was} kam nicht (HTTP ${r.status}).`;
  };

  const ladeKopf = useCallback(async () => {
    const r = await api("/agent/vertrieb/uebersicht");
    if (r.status === 404) { setKeinZugang(true); setLaedt(false); return; }
    // Erklärung noch offen (oder zwischenzeitlich neu gefasst): Tafel zeigen,
    // nicht eine leere Seite mit unerklärlichen Nullen.
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { void erneutPruefen(); setLaedt(false); return; }
    if (r.ok) { setZahlen(r.json.zahlen); setAgenten(r.json.agenten); setFehler(null); }
    else setFehler(grundVon(r, "Die Übersicht"));
  }, [erneutPruefen]);

  const ladeListe = useCallback(async (leise = false) => {
    if (!leise) setLaedt(true);
    const p = new URLSearchParams({ filter });
    if (agentFilter !== null) p.set("agent", String(agentFilter));
    if (suche.trim()) p.set("q", suche.trim());
    const r = await api(`/agent/vertrieb/personen?${p.toString()}`);
    if (r.status === 404) { setKeinZugang(true); setLaedt(false); return; }
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { void erneutPruefen(); setLaedt(false); return; }
    if (r.ok) { setPersonen(r.json.personen); setFehler(null); }
    else setFehler(grundVon(r, "Die Kundenliste"));
    setLaedt(false);
  }, [filter, agentFilter, suche, erneutPruefen]);

  // Erst laden, wenn die Erklärung geklärt ist. Sonst rennen Anfragen in ein 403
  // und die Tafel stünde über einer Seite, die gerade Fehler sammelt.
  useEffect(() => { if (geprueft && !zusage) void ladeKopf(); }, [ladeKopf, geprueft, zusage]);

  const ladeService = useCallback(async () => {
    const r = await api("/agent/vertrieb/service");
    if (r.ok) { setService(r.json.zahlen); setPipeline(r.json.pipeline || null); }
    // Auch hier kein stilles Aussteigen mehr: „Bestand je Mitarbeiter" stand
    // im Screenshot dauerhaft auf „Wird geladen …".
    else setFehler(grundVon(r, "Die Service-Zahlen"));
  }, []);
  useEffect(() => { if (geprueft && !zusage) void ladeService(); }, [ladeService, geprueft, zusage]);
  useEffect(() => {
    if (!geprueft || zusage || bereich !== "kunden") return;
    const t = setTimeout(() => void ladeListe(), suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [ladeListe, suche, geprueft, zusage, bereich]);

  const zuweisen = async (agentId: number | null) => {
    if (gewaehlt.length === 0) return;
    const ziel = agentId ? agenten.find((a) => a.id === agentId)?.name : "niemandem";
    if (!(await fragen({
      titel: `${gewaehlt.length} Kunde(n) ${agentId ? `an ${ziel} zuweisen` : "aus der Zuweisung nehmen"}?`,
      text: "Der Provisionsanspruch bleibt beim dokumentierten Betreuer — eine Zuweisung verschiebt nur die Zuständigkeit, nicht das Geld.",
      folge: "Jede Änderung wird protokolliert.",
      ja: agentId ? "Zuweisen" : "Zuweisung aufheben",
    }))) return;
    setBusy(true);
    const r = await api("/agent/vertrieb/zuweisen", {
      method: "POST", body: JSON.stringify({ personIds: gewaehlt, agentId }),
    });
    setBusy(false);
    if (r.ok) {
      zeige("erfolg", "Zugewiesen", r.json.meldung);
      setGewaehlt([]);
      void ladeListe(true);
      void ladeKopf();
    } else zeige("fehler", "Nicht möglich", r.json?.error || "Bitte erneut versuchen.");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DIE AKTE MELDET, WARUM SIE NICHT KAM (19.08.2026)
  //
  // ── DIE MELDUNG (Daniel Stripling) ──────────────────────────────────────
  // „Wenn ich eine Kundenakte anklicke, öffnet sich lediglich ein weißes
  // Fenster. Die eigentliche Kundenakte wird nicht geladen."
  //
  // ── WAS HIER FALSCH WAR ─────────────────────────────────────────────────
  // Zwei Wege endeten in einer weißen Fläche:
  //
  //   · `if (r.ok) setAkte({ ...r.json, personId })` — antwortet die Route mit
  //     `ok: true`, aber OHNE `person`, dann ist `daten.laedt` undefiniert und
  //     `daten.person` leer. Die Schublade rendert dann ihren Ladezustand:
  //     eine leere Karte mit einem Skelettbalken. Für immer, ohne Meldung.
  //   · Der Fehlerfall schloss die Schublade sofort wieder (`setAkte(null)`)
  //     und zeigte nur einen Kurzhinweis. Wer in dem Moment auf den Kunden
  //     hört, sieht ihn nicht — es sieht aus, als sei nichts passiert.
  //
  // Jetzt trägt der Zustand einen `fehler`, die Schublade bleibt OFFEN und
  // zeigt ihn. Und `person` wird ausdrücklich geprüft: Eine Antwort ohne den
  // Menschen, um den es geht, ist ein Fehler und kein Ladezustand.
  // ══════════════════════════════════════════════════════════════════════════
  const akteOeffnen = async (personId: number) => {
    setAkte({ laedt: true, personId });
    const r = await api(`/agent/vertrieb/person/${personId}`);
    if (r.ok && r.json?.person) { setAkte({ ...r.json, personId }); return; }
    const grund = r.json?.error
      || (r.ok
        ? "Der Server hat geantwortet, aber keine Kundendaten mitgeschickt."
        : r.status === 403
          ? "Für diese Akte fehlt die Berechtigung (oder die Verpflichtungserklärung)."
          : r.status === 404
            ? "Diesen Kunden gibt es nicht mehr — vielleicht wurde er zusammengeführt."
            : `Der Server hat mit HTTP ${r.status} geantwortet.`);
    setAkte({ laedt: false, personId, fehler: grund });
    zeige("fehler", "Akte nicht ladbar", grund);
  };

  const alleWaehlen = () => {
    setGewaehlt(gewaehlt.length === personen.length ? [] : personen.map((p) => p.personId));
  };

  if (keinZugang) {
    return (
      <div className="mx-auto py-10" style={{ maxWidth: 520 }}>
        <div className="fi-karte p-6 text-center">
          <p className="text-[15px] font-bold">Nicht gefunden</p>
          <p className="text-[13px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>
            Diese Seite gibt es für dein Konto nicht.
          </p>
        </div>
      </div>
    );
  }

  if (zusage) {
    return (
      <VertriebZusage
        daten={zusage}
        onAngenommen={() => { schliessen(); void ladeKopf(); void ladeListe(); }}
      />
    );
  }

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: "min(1320px, 100%)" }}>
        <Reveal index={0}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
                <span className="fi-gradient-text">Vertrieb</span>
              </h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
                {bereich === "kunden"
                  ? "Alle Kunden, alle Zuständigkeiten. Zuweisen, korrigieren, dokumentieren — jede Änderung wird protokolliert."
                  : bereich === "zahlungen"
                    ? "Offene Zahlungen prüfen und buchen. Jede Buchung braucht einen Nachweis und schaltet das Konto sofort frei."
                    : bereich === "dokumente"
                      ? "Wo bei bezahlten Kunden noch Unterlagen fehlen — damit du am Telefon sagen kannst, was gebraucht wird."
                      : bereich === "dubletten"
                        ? "Derselbe Mensch mehrfach im Bestand — prüfen und zusammenführen."
                        : bereich === "bestandswache"
                          ? "Was liegen bleibt und Geld kostet: bezahlte Kunden ohne Startgespräch, zahlende Kunden ohne Betreuer."
                          : "Warum ein Kunde nicht in sein Konto kommt, und was konkret hilft."}
              </p>
            </div>
            {bereich === "kunden" && (
              <input value={suche} onChange={(e) => setSuche(e.target.value)}
                     placeholder="Name, E-Mail, Nummer, Referenz"
                     className="h-[36px] px-3 rounded-xl border bg-white text-[13px] outline-none w-[220px] sm:w-[280px]"
                     style={{ borderColor: "var(--fi-linie)" }} />
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              WENN ETWAS NICHT KAM, STEHT DAS HIER

              Vorher blieben die Kacheln und die Tabelle einfach als graue
              Balken stehen — unbegrenzt, ohne ein Wort. „Es werden keine
              Inhalte angezeigt" war wörtlich richtig.
              ══════════════════════════════════════════════════════════════ */}
          {fehler && (
            <div className="mt-4 fi-karte p-4" data-fiaon="vertrieb-fehler" role="alert"
                 style={{ borderColor: "rgba(185,28,28,.3)" }}>
              <p className="text-[13.5px] font-bold" style={{ color: "#b91c1c" }}>
                Diese Ansicht ist nicht vollständig geladen.
              </p>
              <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                {fehler}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button"
                        onClick={() => { setFehler(null); void ladeKopf(); void ladeService(); void ladeListe(); }}
                        className="fi-zweitknopf px-3 py-2 text-[12.5px] font-semibold">
                  Erneut versuchen
                </button>
                <button type="button" onClick={() => window.location.reload()}
                        className="fi-zweitknopf px-3 py-2 text-[12.5px] font-semibold">
                  Seite neu laden
                </button>
              </div>
            </div>
          )}

          {/* Bereichswahl — die vier Arbeiten der Vertriebsleitung. */}
          <div className="fi-rolle mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
              {([
                ["kunden", "Kunden", null],
                ["zahlungen", "Zahlungen", (service?.gemeldet ?? 0) + (service?.fristAbgelaufen ?? 0)],
                ["dokumente", "Unterlagen", service?.dokumenteFehlen ?? 0],
                ["zugang", "Zugang", service?.zugangOffen ?? 0],
                ["dubletten", "Dubletten", service?.dubletten ?? 0],
                ["bestandswache", "Bestandswache", (zahlen?.bezahltOhneOnboarding ?? 0) + (zahlen?.bezahltOhneBetreuer ?? 0)],
              ] as const).map(([k, label, zahl]) => {
                const an = bereich === k;
                return (
                  <button key={k} type="button" onClick={() => setBereich(k as any)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all duration-150"
                          style={an
                            ? { background: "var(--fi-primaer)", color: "#fff", boxShadow: "0 6px 16px -8px rgba(29,78,216,.65)" }
                            : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                    {label}
                    {!!zahl && (
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                            style={an ? { background: "rgba(255,255,255,.22)" } : { background: "var(--fi-seite)", color: "var(--fi-text-still)" }}>
                        {zahl}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {bereich === "bestandswache" && (
          <Bestandswache zahlen={zahlen} onAkte={(personId) => void akteOeffnen(personId)} />
        )}

        {bereich !== "kunden" && bereich !== "dubletten" && bereich !== "bestandswache" && (
          <div className="mt-5">
            <ServiceZahlen zahlen={service} aktiv={bereich} aufReiter={(r) => setBereich(r as any)} />
            <PipelineZahlen pipeline={pipeline} />
            <div className="mt-5">
              {bereich === "zahlungen" && <VertriebZahlungen onGebucht={() => { void ladeService(); void ladeKopf(); }} />}
              {bereich === "dokumente" && <VertriebDokumente />}
              {bereich === "zugang" && <VertriebZugang />}
            </div>
          </div>
        )}

        {/* Dubletten — dieselbe Maschine wie /admin/dubletten, hinter denselben
            Torwächtern wie der übrige Bereich (nurLeitung + nurMitZusage). Die
            Kennzahlen-Kacheln bleiben hier bewusst weg: Sie erklären Zahlungen
            und Unterlagen, nicht Personen. */}
        {bereich === "dubletten" && (
          <div className="mt-5">
            <div className="fi-karte p-4 sm:p-5 mb-4">
              <h2 className="text-[15px] font-bold" style={{ color: "var(--fi-text)" }}>
                Dubletten prüfen und zusammenführen
              </h2>
              <p className="text-[13px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-leise)" }}>
                Derselbe Mensch liegt mehrfach im Bestand — mit getrennten Bestellungen und getrennten
                Gesprächsverläufen. Die Liste ist nach Sicherheit sortiert. <b>Jeder Zusammenschluss ist
                deine Entscheidung</b>, auch bei gleicher E-Mail: Im Bestand trug eine Adresse nachweislich
                zwei Menschen. Es geht dabei nichts verloren — Bestellungen und Verlauf wandern mit,
                abweichende Angaben werden gesichert und bleiben über die Suche auffindbar. Bestellungen
                werden nicht gelöscht und nicht stillgelegt.
              </p>
              <p className="text-[12.5px] mt-2" style={{ color: "var(--fi-text-still)" }}>
                Zur Provision: Ein Zusammenschluss verschiebt die Zuständigkeit, nicht den Anspruch. Haben
                beide Seiten einen dokumentierten Betreuer, musst du ausdrücklich wählen — und die Wahl
                steht mit deinem Namen im Protokoll.
              </p>
            </div>
            <DublettenArbeitsplatz pfade={{
              liste: "/agent/vertrieb/dubletten",
              paar: "/agent/vertrieb/dubletten/paar/:a/:b",
              zusammenfuehren: "/agent/vertrieb/dubletten/zusammenfuehren",
              keineDublette: "/agent/vertrieb/dubletten/keine-dublette",
            }} />
          </div>
        )}

        {bereich === "kunden" && <>
        {/* Kopfzahlen */}
        <Reveal index={1}>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            {[
              { t: "Zahlung gemeldet", w: zahlen?.tier1, f: "tier1", c: "var(--fi-tier1)" },
              { t: "Rechnung offen", w: zahlen?.tier2, f: "tier2", c: "var(--fi-tier2)" },
              { t: "Leads", w: zahlen?.tier3, f: "tier3", c: "var(--fi-tier3)" },
              { t: "Ohne Zuständigen", w: zahlen?.ohneAgent, f: "ohne_agent", c: "var(--fi-primaer)" },
              { t: "Zusage überfällig", w: zahlen?.zusageUeberfaellig, f: "ueberfaellig", c: "var(--fi-tier1)" },
            ].map((k) => (
              <button key={k.t} type="button" onClick={() => { setFilter(k.f); setAgentFilter(null); }}
                      className="fi-karte fi-karte--hebt p-4 text-left">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]"
                   style={{ color: "var(--fi-text-still)" }}>{k.t}</p>
                {zahlen ? (
                  <p className="text-[24px] font-bold leading-none mt-1.5 fi-zahl" style={{ color: k.c }}>{k.w ?? 0}</p>
                ) : <Skelett h={26} w={48} className="mt-1.5" />}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Bestand je Mitarbeiter — der Blick, der Ungleichgewicht sichtbar macht */}
        <Reveal index={2}>
          <section className="mt-5 fi-karte overflow-hidden">
            <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.08em]"
               style={{ background: "var(--fi-seite)", color: "var(--fi-text-still)" }}>
              Bestand je Mitarbeiter
            </p>
            <style>{`
              /* ── BESTAND JE MITARBEITER: ENTZERRT ───────────────────────── */
              .fi-vb-zeile {
                width: 100%; display: flex; align-items: center; gap: 12px;
                padding: 12px 16px; border: 0; cursor: pointer; text-align: left;
                background: none; transition: background 150ms;
                /* Mindesthöhe: Damit nichts springt, wenn eine Rollenmarke
                   fehlt oder ein Name kurz ist. */
                min-height: 66px;
              }
              .fi-vb-zeile:hover { background: rgba(15,23,42,.028); }
              .fi-vb-inhalt { min-width: 0; flex: 1 1 auto; display: block; }
              .fi-vb-kopf {
                display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
                margin-bottom: 5px;
              }
              .fi-vb-name {
                font-size: 14px; font-weight: 650; color: var(--fi-text);
                /* Der Name bricht NICHT um. Ist er zu lang, wird er gekürzt —
                   ein abgeschnittener Name ist lesbar, ein umgebrochener
                   zwischen Wortteilen nicht. */
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                max-width: 100%;
              }
              .fi-vb-marke {
                flex-shrink: 0; font-size: 10px; font-weight: 700;
                padding: 2px 7px; border-radius: 7px; white-space: nowrap;
                background: rgba(29,78,216,.08); color: var(--fi-primaer);
              }
              .fi-vb-zahlen {
                display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;
              }
              .fi-vb-paar {
                display: inline-flex; align-items: baseline; gap: 4px;
                font-size: 11.5px; color: var(--fi-text-still); white-space: nowrap;
              }
              .fi-vb-paar b {
                font-size: 13px; font-weight: 700;
                font-variant-numeric: tabular-nums;
              }
              .fi-vb-winkel { flex-shrink: 0; opacity: .4; align-self: center; }

              /* Rechts so viel Luft, wie der Telefonknopf breit ist (58 px)
                 plus sein Abstand zur Kante (16 px). */
              @media (max-width: 640px) {
                .fi-vb-chips { padding-right: 82px; }
              }

              @media (max-width: 520px) {
                /* Zwei mal zwei: Vier Zahlen nebeneinander sind auf 380 px
                   nicht unterzubringen, ohne dass sie aneinanderkleben. */
                .fi-vb-zahlen {
                  display: grid; grid-template-columns: 1fr 1fr;
                  gap: 6px 12px;
                }
                .fi-vb-zeile { padding: 12px 14px; min-height: 84px; }
              }
            `}</style>
            <div className="divide-y" style={{ borderColor: "var(--fi-linie)" }}>
              {agenten.map((a) => (
                /* ── ZWEI ZEILEN STATT EINER ──────────────────────────────
                   Vorher standen Name, Rollenmarke und vier Zahlen in EINER
                   Zeile. Auf 380 px brach der Name mitten im Wort um die
                   Marke, und die Zahlen klebten aneinander.

                   Jetzt: Zeile 1 der Name, Zeile 2 die Zahlen als
                   beschriftete Paare mit festen Abständen. Auf schmalen
                   Geräten werden daraus zwei mal zwei. */
                <button key={a.id} type="button"
                        onClick={() => { setAgentFilter(agentFilter === a.id ? null : a.id); setFilter("alle"); }}
                        className="fi-vb-zeile"
                        style={agentFilter === a.id ? { background: "var(--fi-flaeche-akzent, #f1f5ff)" } : undefined}>
                  <span className="fi-vb-inhalt">
                    <span className="fi-vb-kopf">
                      <span className="fi-vb-name">{a.name}</span>
                      {a.rolle === "vertriebsleiter" && (
                        <span className="fi-vb-marke">Vertriebsleitung</span>
                      )}
                    </span>
                    <span className="fi-vb-zahlen">
                      {([
                        [a.tier1, "gemeldet", "var(--fi-tier1)"],
                        [a.tier2, "offen", "var(--fi-tier2)"],
                        [a.tier3, "Leads", "var(--fi-tier3)"],
                        // 24.08.2026: VORHER stand hier nur „betreut"
                        // (betreuung_seit). Das setzt lib/tier.ts bei JEDEM
                        // Ergebnis, auch bei „nicht erreicht" — hausweit 1678
                        // Personen gegen 411 echte Mandate. Die Überschrift
                        // der Tabelle heißt „Bestand je Mitarbeiter", und
                        // Bestand sind laut §16a die MANDATE. Sie stehen
                        // jetzt daneben, mit derselben Rechnung wie
                        // /agent/bestand.
                        [a.mandate ?? 0, "Mandate", "var(--fi-erfolg)"],
                        [a.betreut, "berührt", "var(--fi-text-still)"],
                      ] as const).map(([wert, wort, farbe]) => (
                        <span key={wort} className="fi-vb-paar">
                          <b style={{ color: farbe }}>{wert}</b>
                          <span>{wort}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <ZeichenWinkel richtung="rechts" size={13} className="fi-vb-winkel" />
                </button>
              ))}
              {/* ── 24.08.2026: „WIRD GELADEN …" ÜBER EINER LEEREN TABELLE ───
                  VORHER stand hier immer „Wird geladen …", sobald die Liste
                  leer war — auch dann, wenn die Antwort längst da war und
                  einfach keine Zeile enthielt. Das sind zwei völlig
                  verschiedene Lagen (AGENTS.md: eine Anzeige muss zwischen
                  „es ist kaputt" und „ich kann es nicht messen" unterscheiden).
                  GEMESSEN am 24.08.2026: Die Abfrage filtert auf
                  fiaon_agents.active — und während des Office-Umbaus (E-038)
                  steht active bei ALLEN echten Mitarbeitern auf FALSE (Daniel,
                  Nikita, Angelique, Rifka, Viktoria, Florentine, Lucas,
                  Hans-Jürgen, Diana). Die Tabelle lieferte also 0 Zeilen,
                  während die Kacheln darüber 199 Stufe-A-Kunden zeigten.
                  NACHHER sagt die Seite, WARUM sie leer ist. */}
              {agenten.length === 0 && (
                <p className="px-4 py-4 text-[13px]" style={{ color: "var(--fi-text-still)" }}>
                  {zahlen == null
                    ? "Wird geladen …"
                    : "Kein freigeschalteter Mitarbeiter. Diese Tabelle zeigt nur Konten, die im Admin aktiv gesetzt sind — während des Office-Umbaus ist das keines. Die Kundenzahlen oben zählen trotzdem den ganzen Bestand."}
                </p>
              )}
            </div>
          </section>
        </Reveal>

        {/* Filter */}
        <Reveal index={3}>
          {/* ── PLATZ FÜR DEN TELEFONKNOPF ──────────────────────────────────
              Der schwebende Knopf steht rechts unten und ist 58 px breit. Auf
              380 px lag er über dem letzten Filter-Chip — man konnte ihn nicht
              antippen, ohne das Telefon zu öffnen. Rechts bleibt jetzt seine
              Breite plus Rand frei. */}
          <div className="mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto fi-vb-chips">
            <div className="flex items-center gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
              {FILTER.map((f) => {
                const an = filter === f.key;
                return (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                          className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150"
                          style={an
                            ? { background: "var(--fi-primaer)", color: "#fff", boxShadow: "0 4px 12px -6px rgba(29,78,216,.6)" }
                            : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                    {f.label}
                  </button>
                );
              })}
              {agentFilter !== null && (
                <button type="button" onClick={() => setAgentFilter(null)}
                        className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap"
                        style={{ background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
                  Nur {agenten.find((a) => a.id === agentFilter)?.name || "ohne Zuständigen"} · aufheben
                </button>
              )}
            </div>
          </div>
        </Reveal>

        {/* Werkzeugleiste der Mehrfachauswahl — erscheint nur, wenn etwas gewählt
            ist. Ein leerer Balken über der Tabelle wäre eine Dauerablenkung. */}
        {gewaehlt.length > 0 && (
          <div className="mt-3 p-3 rounded-xl flex flex-wrap items-center gap-2 fi-glas"
               style={{ border: "1px solid rgba(29,78,216,.2)" }}>
            <span className="text-[13px] font-semibold">{gewaehlt.length} ausgewählt</span>
            <span className="text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>zuweisen an:</span>
            {agenten.map((a) => (
              <button key={a.id} type="button" disabled={busy} onClick={() => void zuweisen(a.id)}
                      className="fi-zweitknopf px-3 py-2 text-[12.5px] font-semibold">
                {a.name.split(" ")[0]}
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => void zuweisen(null)}
                    className="fi-zweitknopf px-3 py-2 text-[12.5px] font-semibold">
              niemandem
            </button>
            <button type="button" onClick={() => setGewaehlt([])}
                    className="ml-auto text-[12.5px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              Auswahl aufheben
            </button>
          </div>
        )}

        {/* ── AM HANDY KARTEN STATT TABELLE (Scheibe 4) ───────────────────
            Acht Spalten bei 900 px Mindestbreite hießen: waagerecht schieben.
            Die Leitung telefoniert mobil — hier stehen Name, Status,
            Zuständig, Betrag, Anrufen, Akte. Dieselben Daten, andere Form. */}
        <div className="mt-3 space-y-2 md:hidden">
          {!laedt && personen.map((p) => {
            const an = gewaehlt.includes(p.personId);
            return (
              <div key={p.personId} className="fi-karte p-3.5" style={an ? { borderColor: "rgba(29,78,216,.35)" } : undefined}>
                <div className="flex items-start gap-2.5">
                  <input type="checkbox" checked={an} className="w-4 h-4 mt-1 accent-blue-600" aria-label={`${p.name} wählen`}
                         onChange={() => setGewaehlt((g) => an ? g.filter((x) => x !== p.personId) : [...g, p.personId])} />
                  <button type="button" onClick={() => void akteOeffnen(p.personId)} className="text-left min-w-0 flex-1">
                    <span className="block text-[14px] font-bold" style={{ color: "var(--fi-text)" }}>{p.name}</span>
                    <span className="block text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{p.email || p.telefon || p.ref || "—"}</span>
                  </button>
                  <span className="text-[13px] font-bold fi-zahl">{p.betrag != null ? eur(p.betrag) : "—"}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                  <span className="font-semibold" style={{ color: TIER_FARBE[p.tier] }}>{statusAusTierGrund(p.tierGrund).anzeige}</span>
                  <span style={{ color: "var(--fi-text-still)" }}>Zuständig: {p.agentName || "niemand"}</span>
                  {p.betreuerName && <span style={{ color: "var(--fi-text-still)" }}>Betreuer: {p.betreuerName}</span>}
                  {p.zusagedatum && <span style={{ color: "var(--fi-text-still)" }}>Zusage {dtag(p.zusagedatum)}</span>}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  {p.telefonWaehlbar && (
                    <button type="button" onClick={() => anrufStarten(String(p.telefonWaehlbar), p.personId, p.name)}
                            className="fi-primaerknopf px-3.5 py-2 text-[12.5px] font-semibold text-white">Anrufen</button>
                  )}
                  <button type="button" onClick={() => void akteOeffnen(p.personId)} className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold">Akte</button>
                </div>
              </div>
            );
          })}
          {!laedt && personen.length === 0 && <p className="fi-karte p-6 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>{suche ? "Kein Treffer." : "In dieser Ansicht steht nichts."}</p>}
        </div>

        {/* Tabelle (ab Tablet) */}
        <div className="mt-3 fi-karte overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: 900 }}>
              <thead>
                <tr style={{ background: "var(--fi-seite)" }}>
                  <th className="px-3 py-2.5 w-[38px]">
                    <input type="checkbox" checked={gewaehlt.length > 0 && gewaehlt.length === personen.length}
                           onChange={alleWaehlen} className="w-4 h-4 accent-blue-600" aria-label="Alle wählen" />
                  </th>
                  {["Kunde", "Status", "Zuständig", "Betreuer", "Letzter Kontakt", "Zusage", "Betrag", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.07em] whitespace-nowrap"
                        style={{ color: "var(--fi-text-still)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laedt && [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}><td colSpan={9} className="px-3 py-3"><Skelett h={16} /></td></tr>
                ))}
                {!laedt && personen.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>
                    {suche ? "Kein Treffer." : "In dieser Ansicht steht nichts."}
                  </td></tr>
                )}
                {!laedt && personen.map((p) => {
                  const an = gewaehlt.includes(p.personId);
                  const zusageAlt = p.zusagedatum && new Date(p.zusagedatum) < new Date(new Date().toDateString());
                  return (
                    <tr key={p.personId} style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)", background: an ? "var(--fi-flaeche-akzent, #f1f5ff)" : undefined }}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={an} className="w-4 h-4 accent-blue-600"
                               onChange={() => setGewaehlt((g) => an ? g.filter((x) => x !== p.personId) : [...g, p.personId])}
                               aria-label={`${p.name} wählen`} />
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => void akteOeffnen(p.personId)} className="text-left">
                          <span className="block text-[13px] font-semibold">{p.name}</span>
                          <span className="block text-[11px]" style={{ color: "var(--fi-text-still)" }}>
                            {p.email || p.telefon || p.ref || "—"}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-[12px] font-semibold" style={{ color: TIER_FARBE[p.tier] }}>
                          {statusAusTierGrund(p.tierGrund).anzeige}
                        </span>
                        {p.gesperrt && (
                          <span className="ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: "var(--fi-seite)", color: "var(--fi-text-still)" }}>gesperrt</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap">
                        {p.agentName || <span style={{ color: "var(--fi-tier2)" }}>niemand</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: "var(--fi-text-still)" }}>
                        {p.betreuerName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: "var(--fi-text-still)" }}>
                        {tageSeit(p.letzterKontakt)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap"
                          style={{ color: zusageAlt ? "var(--fi-tier1)" : "var(--fi-text-leise)", fontWeight: zusageAlt ? 700 : 400 }}>
                        {dtag(p.zusagedatum)}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] font-semibold fi-zahl whitespace-nowrap">
                        {p.betrag != null ? eur(p.betrag) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          {/* Auch die Schnellwahl aus der Liste geht über das Softphone: Ein
                              tel-Verweis öffnet irgendein Programm und hinterlässt keine
                              Akte — kein Anruf, kein Transkript, kein Ergebnis.
                              (Der Kommentar stand zuerst INNERHALB von `&& (` — dort ist ein
                              JSX-Kommentar kein Kommentar, sondern ein Ausdruck.) */}
                          {p.telefonWaehlbar && (
                            <button type="button"
                                    onClick={(e) => { e.stopPropagation(); anrufStarten(String(p.telefonWaehlbar), p.personId, p.name); }}
                                    className="fi-zweitknopf inline-flex items-center px-2 py-1.5"
                               title={`${p.name} anrufen`} aria-label={`${p.name} anrufen`}>
                              <ZeichenTelefon size={13} />
                            </button>
                          )}
                          <button type="button" onClick={() => void akteOeffnen(p.personId)}
                                  className="fi-zweitknopf px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap">
                            Akte
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!laedt && personen.length > 0 && (
            <p className="px-3 py-2 text-[11.5px]" style={{ background: "var(--fi-seite)", color: "var(--fi-text-still)" }}>
              {personen.length} Zeile{personen.length === 1 ? "" : "n"} · Zuweisen verschiebt die Zuständigkeit, nicht die Provision
            </p>
          )}
        </div>
        </>}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DIE WAND GEGEN DIE WEISSE FLÄCHE

          Die zwei bekannten Ursachen sind behoben (fehlendes `person`, still
          geschluckter Fehler). „Weiße Fläche" ist aber eine FEHLERKLASSE: ein
          Haken hinter einem `return`, ein `.map` auf `undefined`, ein
          umbenanntes Feld. Scheitert die Akte beim Zeichnen, zeigt der Rahmen
          eine Karte mit dem Grund — und die Kundenliste dahinter bleibt heil.
          ══════════════════════════════════════════════════════════════════ */}
      {/* ── DER NOTWEG (20.08.2026) ──────────────────────────────────────
          Am 20.08. hat ein Haken-Fehler die Akte für ALLE Kunden zerstört. Der
          Rahmen nannte den Grund, aber das Team kam an die Kundendaten nicht
          mehr heran — und konnte nicht einmal telefonieren.

          Die Kerndaten kommen aus der LISTE, nicht aus der Akte: Sie liegen
          schon geladen vor (`personen`), sind also auch dann da, wenn die Akte
          gar nicht rendert. Genau das macht sie zum Notweg.

          (Ein JSX-Kommentar direkt nach `{akte && (` ist ein Syntaxfehler — er
          gehört VOR die Bedingung. Beim ersten Versuch stand er darin.) */}
      {akte && (
        <Fehlerrahmen was="Die Kundenakte" ansicht="die Akten-Schublade"
                      onSchliessen={() => setAkte(null)}
                      notweg={(() => {
                        const z = personen.find((x) => x.personId === akte?.personId);
                        if (!z) return null;
                        return {
                          titel: `${z.name} — Kerndaten aus der Liste`,
                          zeilen: [
                            { feld: "Name", wert: z.name },
                            { feld: "Telefon", wert: z.telefon },
                            { feld: "E-Mail", wert: z.email },
                            { feld: "Referenz", wert: z.ref ?? null },
                            { feld: "Stand", wert: z.tierGrund ?? null },
                            { feld: "Produkt", wert: z.produkt ?? null },
                            { feld: "Betreuer", wert: z.betreuerName ?? z.agentName ?? null },
                          ],
                        };
                      })()}>
          <Akte daten={akte} agenten={agenten} onSchliessen={() => setAkte(null)}
                onGeaendert={() => { void ladeListe(true); void ladeKopf(); }} />
        </Fehlerrahmen>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Akte — Stammdaten korrigieren, dokumentieren, sperren, senden
// ═══════════════════════════════════════════════════════════════════════════
function Akte({ daten, onSchliessen, onGeaendert, agenten = [] }: { daten: any; onSchliessen: () => void; onGeaendert: () => void; agenten?: { id: number; name: string; rolle?: string }[] }) {
  const { zeige } = useToast();
  const [busy, setBusy] = useState(false);
  // „Lage" steht zuerst: Wenn ein Agent anruft, lautet die Frage fast immer
  // „ist das Geld da / was fehlt / warum kommt er nicht rein" — und nicht
  // „wie ist die Straße geschrieben".
  const [reiter, setReiter] = useState<
    "lage" | "zugang" | "zahlung" | "verwaltung" | "stammdaten" | "verlauf" | "zuweisungen"
  >("lage");
  // Ein Grund ist Pflicht bei allem, was Zugang verschafft oder Geld bewegt.
  const fragen = useFragen();
  const [grund, setGrund] = useState("");
  // Zahlung buchen: derselbe Dialog wie im Reiter „Zahlungen" (Belegpflicht,
  // Bankeingang, echtes Eingangsdatum). Der alte Freitext-Weg ist geschlossen.
  const [buchen, setBuchen] = useState(false);
  // ── Provision & Betreuer (E-027) ────────────────────────────────────────
  const [betreuerId, setBetreuerId] = useState<string>("");
  const [betreuerGrund, setBetreuerGrund] = useState("");
  const [paketKey, setPaketKey] = useState<string>("");
  const [paketGrund, setPaketGrund] = useState("");
  const betreuerSetzen = async () => {
    if (!betreuerId || betreuerGrund.trim().length < 10) { zeige("fehler", "Begründung fehlt", "Mitarbeiter wählen und in einem Satz begründen."); return; }
    if (!(await fragen({ titel: "Provisionsanspruch setzen?", text: `Der Anspruch für ${p.name} geht an ${agenten.find((a) => String(a.id) === betreuerId)?.name || "den gewählten Mitarbeiter"}. Bereits gebuchte, noch nicht ausgezahlte Provisionen anderer werden storniert und neu gebucht.`, folge: "Mit Begründung im Protokoll und in der Akte.", ja: "Setzen" }))) return;
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/betreuer`, { method: "POST", body: JSON.stringify({ agentId: Number(betreuerId), grund: betreuerGrund.trim() }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", "Anspruch gesetzt", r.json.meldung); setBetreuerGrund(""); onGeaendert(); }
    else zeige("fehler", "Nicht gesetzt", r.json?.error || "");
  };
  const paketSetzen = async () => {
    if (!paketKey || paketGrund.trim().length < 5) { zeige("fehler", "Angabe fehlt", "Paket wählen und kurz begründen."); return; }
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/paket`, { method: "PATCH", body: JSON.stringify({ packKey: paketKey, grund: paketGrund.trim() }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", "Paket geändert", r.json.meldung); setPaketGrund(""); onGeaendert(); }
    else zeige("fehler", "Nicht geändert", r.json?.error || "");
  };
  const [einmalPasswort, setEinmalPasswort] = useState<{ pw: string; bis: string } | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [zugangStand, setZugangStand] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  // ══════════════════════════════════════════════════════════════════════════
  // DIESER HAKEN STAND 200 ZEILEN TIEFER — UND HAT DIE AKTE ZERSTÖRT
  //
  // ── DER FEHLER (React #310, gemeldet 20.08.2026) ─────────────────────────
  // „Rendered more hooks than during the previous render." Die Kundenakte ging
  // bei KEINEM Kunden mehr auf.
  //
  // `const [bestaetigen, setBestaetigen] = useState(false)` stand bei Zeile 940,
  // also NACH zwei frühen Ausstiegen:
  //     if (daten.fehler || (!daten.laedt && !p)) return …   (Fehlerkarte)
  //     if (daten.laedt || !p) return …                      (Ladezustand)
  //
  // Die Schublade öffnet mit `setAkte({ laedt: true, personId })`. Also:
  //   Durchgang 1 — laedt=true  → Ausstieg oben  → 9 Haken
  //   Durchgang 2 — Daten da    → läuft durch    → 10 Haken  → Absturz
  //
  // ── SEIT WANN, UND WARUM ES ERST JETZT AUFFIEL ──────────────────────────
  // Der Haken kam mit `e675efa` („falsches Paket in der Zahlungsdaten-Mail"),
  // also VOR dem Fehlerrahmen. Zwischen e675efa und 6a4f04e gab es keine
  // Fehlerwand um die Akte: React entmountet bei diesem Fehler den Baum, und die
  // Seite wurde WEISS.
  //
  // Das ist genau die Meldung „die Kundenakte lässt sich nicht öffnen, es werden
  // keine Inhalte angezeigt" vom 19.08. Ich habe damals den Fehlerrahmen gebaut
  // und vier Ladezustände ohne Fehlerweg behoben — alles richtig, aber die
  // EIGENTLICHE Ursache war dieser Haken, und ich habe ihn nicht gesucht. Der
  // Fehlerrahmen hat ihn jetzt aus dem Weiß geholt und beim Namen genannt.
  //
  // AGENTS.md sagt es seit dem 16.08.: „React-Haken stehen ÜBER dem ersten
  // return." Es war die dritte Wiederholung derselben Klasse.
  // ══════════════════════════════════════════════════════════════════════════
  const [bestaetigen, setBestaetigen] = useState(false);
  const p = daten.person;

  // ── DIE ABGELEITETE STUFE ──────────────────────────────────────────────
  // Eigener Aufruf, weil die Liste sie nicht mitliefert (sie hätte sie für
  // vierzig Kunden holen müssen). Für die geöffnete Akte ist eine Abfrage
  // richtig — und dieselbe, die die Verwaltung benutzt.
  const [stufenlage, setStufenlage] = useState<any>(null);
  useEffect(() => {
    if (!p?.ref) { setStufenlage(null); return; }
    let weg = false;
    void fetch(`/api/fiaon/kunde/${encodeURIComponent(p.ref)}/startgespraech`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (weg || !j?.ok || !j.stufe) return;
        setStufenlage({
          stufe: j.stufe, ablauf: j.ablauf,
          naechsterSchritt: j.naechsterSchritt, ausnahme: j.ausnahme,
        });
      })
      .catch(() => {});
    return () => { weg = true; };
  }, [p?.ref]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onSchliessen(); };
    document.addEventListener("keydown", taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", taste); document.body.style.overflow = vorher; };
  }, [onSchliessen]);

  useEffect(() => {
    if (!p) return;
    setForm({
      first_name: p.vorname || "", last_name: p.nachname || "", company_name: p.firma || "",
      primary_email: p.email || "", primary_phone: p.telefon || "",
      street: p.strasse || "", zip: p.plz || "", city: p.ort || "",
    });
  }, [daten.personId, p?.personId]);

  // ── LADEN UND SCHEITERN SIND ZWEI ZUSTÄNDE, NICHT EINER ─────────────────
  // Vorher galt `daten.laedt || !p` als „lädt noch" und zeigte einen
  // Skelettbalken. Fehlte `person`, blieb dieser Balken für immer stehen — das
  // war das weiße Fenster. Jetzt: Ein Fehler ist ein Fehler und sagt es.
  if (daten.fehler || (!daten.laedt && !p)) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
           style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(6px)" }}
           role="alertdialog" aria-label="Kundenakte konnte nicht geladen werden"
           data-fiaon="akte-fehler">
        <div className="fi-karte p-5 w-full" style={{ maxWidth: 440 }}
             onClick={(e) => e.stopPropagation()}>
          <p className="text-[15px] font-bold">Die Kundenakte konnte nicht geladen werden.</p>
          <p className="text-[12.5px] mt-2 px-2.5 py-2 rounded-lg leading-relaxed"
             style={{ background: "var(--fi-seite)", color: "#b91c1c" }}>
            {daten.fehler || "Der Server hat keine Kundendaten mitgeschickt."}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" onClick={() => window.location.reload()}
                    className="fi-primaerknopf px-3 py-2.5 text-[13px] font-bold text-white">
              Neu laden
            </button>
            <button type="button" onClick={onSchliessen}
                    className="fi-zweitknopf px-3 py-2.5 text-[13px] font-semibold">
              Schließen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (daten.laedt || !p) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
           style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(6px)" }} onClick={onSchliessen}>
        <div className="fi-karte p-6"><Skelett h={18} w={220} /></div>
      </div>
    );
  }

  const speichern = async () => {
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}`, { method: "PATCH", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) {
      zeige("erfolg", r.json.geaendert > 0 ? `${r.json.geaendert} Feld(er) geändert` : "Keine Änderung",
        r.json.geaendert > 0 ? "Alter und neuer Wert stehen im Protokoll." : "");
      onGeaendert();
    } else zeige("fehler", "Nicht gespeichert", r.json?.error || "");
  };

  // ── PORTAL ANSEHEN ──────────────────────────────────────────────────────
  // Kein `onGeaendert()`: Es ändert sich nichts am Kunden. Und kein
  // Erfolgshinweis in der Schublade — das Ergebnis ist der neue Tab.
  //
  // Der Server entscheidet über das Recht (eigene und zugewiesene Kunden). Bei
  // einer Ablehnung steht sein Satz hier, nicht ein selbst erfundener: Er weiß,
  // WARUM es nicht geht, die Oberfläche nicht.
  const portalAnsehen = async () => {
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/ansicht`, { method: "POST" });
    setBusy(false);
    if (r.ok) window.open("/als-kunde", "_blank", "noopener");
    else zeige("fehler", "Ansicht nicht möglich", r.json?.error || "");
  };

  const sperre = async (sperren: boolean) => {
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/sperre`, { method: "POST", body: JSON.stringify({ sperren }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", sperren ? "Gesperrt" : "Entsperrt", r.json.meldung); onGeaendert(); }
    else zeige("fehler", "Nicht möglich", r.json?.error || "");
  };

  /**
   * Die Aktionen der Leitung.
   *
   * ── EINGEBETTET, NICHT NEU GEBAUT ─────────────────────────────────────────
   * Jede dieser Routen existiert seit Wochen und wird an anderer Stelle
   * benutzt. Sie hier nachzubauen hieße, zwei Wege zum selben Ziel zu
   * pflegen — und beim nächsten „die Löschung braucht noch einen Grund"
   * einen davon zu vergessen.
   *
   * Die Rechte prüft in jedem Fall der SERVER. Was diese Oberfläche tut, ist
   * anbieten; was erlaubt ist, entscheidet die Route.
   */
  const zugangPruefen = async () => {
    setBusy(true);
    const r = await api(`/agent/zugang/${p.ref}/stand`).catch(() => null as any);
    setBusy(false);
    setZugangStand(r?.ok ? r.json : { fehler: r?.json?.error || "Diagnose nicht verfügbar." });
  };

  const setzLink = async () => {
    if (grund.trim().length < 5) { zeige("fehler", "Grund fehlt", "Bitte in einem Satz begründen."); return; }
    setBusy(true);
    const r = await api(`/agent/zugang/${p.ref}/setz-link`, { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", "Setz-Link verschickt", r.json.hinweis); setGrund(""); onGeaendert(); }
    else zeige("fehler", "Nicht verschickt", r.json?.error || "");
  };

  const einmalPw = async () => {
    if (grund.trim().length < 5) { zeige("fehler", "Grund fehlt", "Bitte in einem Satz begründen."); return; }
    setBusy(true);
    const r = await api(`/agent/zugang/${p.ref}/einmal-passwort`, { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(false);
    if (r.ok) {
      // EINMAL sichtbar: Es wird bewusst nicht in den Zustand geschrieben, der
      // beim Neuladen zurückkommt. Wer es wegklickt, muss ein neues erzeugen.
      setEinmalPasswort({ pw: r.json.passwort, bis: r.json.gueltigBis });
      setGrund("");
    } else zeige("fehler", "Nicht erzeugt", r.json?.error || "");
  };

  const freischalten = async () => {
    if (grund.trim().length < 5) { zeige("fehler", "Grund fehlt", "Bitte in einem Satz begründen."); return; }
    setBusy(true);
    const r = await api(`/agent/zugang/${p.ref}/freischalten`, { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", "Freigeschaltet", r.json.meldung); setGrund(""); onGeaendert(); }
    else zeige("fehler", "Nicht möglich", r.json?.error || "");
  };


  // ── ERST BESTÄTIGEN, DANN SENDEN (31.08.2026) ───────────────────────────
  // Dasselbe Bauteil wie in der Kundenkarte. Die Vertriebsleitung sieht die
  // gleiche Vorschau — sie trifft dieselbe Entscheidung und darf nicht weniger
  // wissen als der Agent.
  //
  // Der zugehörige Haken (`bestaetigen`) steht oben im Haken-Block, NICHT hier:
  // An dieser Stelle lag er nach zwei frühen Ausstiegen und hat React #310
  // ausgelöst — die Akte ging bei keinem Kunden mehr auf.

  const zahlungsdaten = async (ref: string | null = null) => {
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/zahlungsdaten`,
      { method: "POST", body: JSON.stringify({ ref }) });
    setBusy(false);
    setBestaetigen(false);
    if (r.ok) zeige("erfolg", "Zahlungsdaten versandt", `An ${r.json.versandtAn}`);
    else zeige("fehler", "Nicht versandt", r.json?.error || "");
  };

  return (
    <>
      {bestaetigen && (
        <RechnungBestaetigung
          personId={p.personId}
          kundeName={p.name}
          laeuft={busy}
          onAbbrechen={() => setBestaetigen(false)}
          onSenden={(ref) => void zahlungsdaten(ref)}
        />
      )}
      <div className="fixed inset-0 z-[100]" style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(6px)" }}
           onClick={onSchliessen} />
      <div className="fixed inset-0 z-[101] flex items-stretch justify-end pointer-events-none">
        <div className="pointer-events-auto w-full sm:w-[560px] h-full overflow-y-auto"
             style={{ background: "#fff", boxShadow: "-24px 0 60px -20px rgba(13,26,63,.45)" }}
             role="dialog" aria-modal="true" aria-label={`Akte ${p.name}`}>
          <div className="sticky top-0 z-10 px-5 py-3.5 flex items-start gap-3"
               style={{ background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)", boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
            <div className="min-w-0 flex-1">
              {/* ══════════════════════════════════════════════════════════
                  DERSELBE KOPF WIE IN DER VERWALTUNGS-AKTE (20.08.2026)

                  ── WARUM ────────────────────────────────────────────────
                  Vorher stand hier eine eigene Fassung: Name, Statustext,
                  Zuständigkeit. Die Verwaltungs-Akte hatte ihre eigene. Zwei
                  Fassungen für denselben Kunden gehen auseinander — und weil
                  beide für sich richtig aussehen, merkt es niemand.

                  `KundenKopf` ist EIN Bauteil, `dicht` für die schmale
                  Schublade. Die Zuständigkeit bleibt darunter: Sie ist eine
                  Eigenschaft der Betreuung, keine Station des Ablaufs.
                  ══════════════════════════════════════════════════════════ */}
              {stufenlage ? (
                <KundenKopf
                  name={p.name}
                  stufe={stufenlage.stufe}
                  stand={stufenlage.ablauf}
                  naechsterSchritt={stufenlage.naechsterSchritt}
                  ausnahme={stufenlage.ausnahme}
                  dicht
                />
              ) : (
                <p className="text-[16px] font-bold truncate">{p.name}</p>
              )}
              <p className="text-[12px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>
                {statusAusTierGrund(p.tierGrund).anzeige} · zuständig: {p.agentName || "niemand"}
                {p.betreutSeit ? ` · betreut seit ${dtag(p.betreutSeit)}` : ""}
              </p>
            </div>
            <button type="button" onClick={onSchliessen} className="fi-zweitknopf px-2.5 py-1.5 text-[12px] font-semibold">
              Schließen
            </button>
          </div>

          {/* ── KOPFAKTIONEN ────────────────────────────────────────────────
              „Anrufen" öffnet das Softphone MIT Kundenkontext, nicht die
              Telefon-App des Rechners: Nur so landet das Gespräch mit Aufnahme,
              Transkript und Ergebnis in der Akte. Ein `tel:`-Verweis öffnet
              irgendein Programm und hinterlässt keine Spur. */}
          <div className="px-5 pt-3.5 flex flex-wrap items-center gap-2">
            {p.telefonWaehlbar && (
              <button type="button"
                      onClick={() => {
                        anrufStarten(p.telefonWaehlbar, p.personId, p.name);
                        onSchliessen();
                      }}
                      className="fi-primaerknopf inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-white">
                <ZeichenTelefon size={14} /> Anrufen
              </button>
            )}
            <button type="button"
                    onClick={() => { window.open(`/agent/gespraech/${p.personId}`, "_blank", "noopener"); }}
                    className="fi-zweitknopf px-3 py-2 text-[12.5px] font-semibold">
              Gesprächsblatt
            </button>
            <button type="button" onClick={() => setBestaetigen(true)} disabled={busy}
                    className="fi-sendeknopf inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold">
              <ZeichenSenden size={14} /> Zahlungsdaten
            </button>
            <button type="button" onClick={() => void sperre(!p.gesperrt)} disabled={busy}
                    className="fi-zweitknopf px-3 py-2 text-[12.5px] font-semibold">
              {p.gesperrt ? "Entsperren" : "Sperren"}
            </button>
          </div>

          {/* Reiter */}
          <div className="px-5 mt-3.5 flex items-center gap-1.5">
            {([["lage", "Lage"], ["zugang", "Zugang"], ["zahlung", "Zahlung"],
               ["verwaltung", "Verwaltung"], ["stammdaten", "Stammdaten"],
               ["verlauf", `Verlauf (${daten.verlauf?.length || 0})`],
               ["zuweisungen", "Zuweisungen"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setReiter(k)}
                      className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                      style={reiter === k
                        ? { background: "var(--fi-primaer)", color: "#fff" }
                        : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                {l}
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            {reiter === "lage" && <LageTafel personId={Number(daten.personId)} karteSetzbar />}

            {/* ══════════════════════════════════════════════════════════════
                ZUGANG
                Der häufigste Anruf der Leitung ist „ich komme nicht rein".
                Drei Wege, gestuft: Der Setz-Link ist der normale (der Kunde
                wählt selbst), das Einmal-Passwort der für das Telefonat, die
                Freischaltung der für ein gesperrtes Konto.
                ══════════════════════════════════════════════════════════════ */}
            {reiter === "zugang" && (
              <div className="space-y-3">
                <button type="button" onClick={() => void zugangPruefen()} disabled={busy}
                        className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold">
                  {busy ? "Prüft …" : "Zugang prüfen"}
                </button>
                {zugangStand && (
                  <div className="px-3.5 py-3 rounded-xl text-[12.5px] leading-relaxed"
                       style={{ background: "rgba(15,23,42,.035)" }}>
                    {zugangStand.fehler
                      ? <span style={{ color: "#b45309" }}>{zugangStand.fehler}</span>
                      : (
                        <>
                          <p><b>Konto:</b> {zugangStand.konto?.status ?? "unbekannt"}</p>
                          {zugangStand.konto?.email && <p><b>Adresse:</b> {zugangStand.konto.email}</p>}
                          {zugangStand.hinweis && (
                            <p className="mt-1" style={{ color: "var(--fi-text-still)" }}>{zugangStand.hinweis}</p>
                          )}
                        </>
                      )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] mb-1.5"
                         style={{ color: "var(--fi-text-still)" }}>
                    Grund (Pflicht — steht im Protokoll)
                  </label>
                  <input value={grund} onChange={(e) => setGrund(e.target.value)}
                         placeholder="z. B. Kunde am Telefon, Passwort vergessen"
                         className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none"
                         style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)" }} />
                </div>

                {([
                  ["Setz-Link schicken", setzLink,
                   "Der Kunde bekommt eine Mail und wählt sein Passwort selbst. Der normale Weg."],
                  ["Einmal-Passwort erzeugen", einmalPw,
                   "Für das Telefonat: einmal sichtbar, 24 Stunden gültig, der Kunde muss danach ein eigenes setzen."],
                  ["Zugang freischalten", freischalten,
                   "Nur bei einem gesperrten oder nicht bestätigten Konto."],
                ] as const).map(([t, fn, erklaerung]) => (
                  <div key={t} className="px-3.5 py-3 rounded-xl"
                       style={{ boxShadow: "inset 0 0 0 1px var(--fi-linie)" }}>
                    <button type="button" onClick={() => void fn()} disabled={busy || grund.trim().length < 5}
                            className="fi-primaerknopf px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
                      {t}
                    </button>
                    <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                      {erklaerung}
                    </p>
                  </div>
                ))}

                {/* Das Passwort steht EINMAL da. Bewusst nicht im Zustand, der
                    beim Neuladen zurückkommt — wer es wegklickt, erzeugt ein
                    neues. Ein Passwort, das man wiederfinden kann, ist keins. */}
                {einmalPasswort && (
                  <div className="px-3.5 py-3 rounded-xl"
                       style={{ background: "rgba(5,150,105,.07)", boxShadow: "inset 0 0 0 1px rgba(5,150,105,.22)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: "#047857" }}>
                      Jetzt aufschreiben oder vorlesen
                    </p>
                    <p className="text-[20px] font-bold font-mono mt-1" style={{ color: "#047857" }}>
                      {einmalPasswort.pw}
                    </p>
                    <p className="text-[11.5px] mt-1" style={{ color: "#065f46" }}>
                      Gültig bis {new Date(einmalPasswort.bis).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        timeZone: "Europe/Berlin",
                      })}. Es wird nicht wieder angezeigt.
                    </p>
                    <button type="button" onClick={() => setEinmalPasswort(null)}
                            className="mt-2 text-[11.5px] font-semibold" style={{ color: "#047857" }}>
                      Gemerkt, ausblenden
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ZAHLUNG
                „Als bezahlt buchen" ist die Aktion mit den größten Folgen:
                Sie schaltet Leistungen frei und erzeugt Provisionen. Deshalb
                ein Beleg-Feld statt eines Häkchens.
                ══════════════════════════════════════════════════════════════ */}
            {reiter === "zahlung" && (
              <div className="space-y-3">
                <div className="px-3.5 py-3 rounded-xl text-[12.5px] leading-relaxed"
                     style={{ background: "rgba(15,23,42,.035)" }}>
                  <p><b>Stand:</b> {p.zahlungStatus ?? "unbekannt"}</p>
                  {p.betragCents != null && (
                    <p><b>Betrag:</b> {(Number(p.betragCents) / 100).toFixed(2).replace(".", ",")} €</p>
                  )}
                  {p.ref && <p><b>Referenz:</b> <span className="font-mono">{p.ref}</span></p>}
                </div>

                <button type="button" onClick={() => setBestaetigen(true)} disabled={busy}
                        className="fi-sendeknopf inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold">
                  <ZeichenSenden size={14} /> Zahlungsdaten erneut schicken
                </button>

                <div className="pt-1">
                  <button type="button" onClick={() => setBuchen(true)} disabled={busy || p.zahlungStatus === "paid"}
                          className="fi-primaerknopf px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
                    Zahlung prüfen und buchen
                  </button>
                  <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    Mit Beleg: Bankeingang auswählen oder Kundenbeleg, Eingangsdatum, ein Satz dazu.
                    Derselbe Weg wie im Reiter „Zahlungen" — Abo-Kette, Bestätigungsmail und Provision
                    entstehen daraus. Einen zweiten, schnelleren Weg gibt es mit Absicht nicht.
                  </p>
                </div>
                {buchen && (
                  <BuchenDialog zahlung={{ personId: p.personId, ref: p.ref }}
                                onSchliessen={() => setBuchen(false)}
                                onFertig={() => { setBuchen(false); onGeaendert(); }} />
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                VERWALTUNG
                Sperren, umhängen, löschen. Die Löschung ist die einzige
                unumkehrbare Aktion in dieser Schublade — deshalb steht sie
                unten, hinter einer Rückfrage in Klartext, und die
                Massenlöschung bleibt dem Vorgesetzten.
                ══════════════════════════════════════════════════════════════ */}
            {reiter === "verwaltung" && (
              <div className="space-y-3">
                {/* ── PORTAL ANSEHEN (19.08.2026) ─────────────────────────
                    Steht bewusst GANZ OBEN in der Verwaltung: Es ist die
                    einzige Handlung hier, die nichts verändert. Wer eine Frage
                    zum Konto eines Kunden hat, soll zuerst nachsehen können —
                    und nicht erst sperren oder umhängen müssen, um zu
                    verstehen, was der Kunde sieht.

                    Nur eigene und zugewiesene Kunden. Ein Agent ohne
                    Leitungsrolle bekommt vom Server 403 mit Begründung. */}
                <div className="px-3.5 py-3 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px var(--fi-linie)" }}>
                  <button type="button" onClick={() => void portalAnsehen()} disabled={busy}
                          className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold">
                    Portal ansehen{p.vorname ? ` als ${p.vorname}` : ""}
                  </button>
                  <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    Öffnet das Kundenportal in einem neuen Tab, genau so, wie der Kunde es sieht —
                    Nur-Ansicht, 30 Minuten. Es entstehen keine Aktionen in seinem Namen, und
                    Start und Ende stehen in seinem Verlauf.
                  </p>
                </div>

                <div className="px-3.5 py-3 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px var(--fi-linie)" }}>
                  <button type="button" onClick={() => void sperre(!p.gesperrt)} disabled={busy}
                          className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold">
                    {p.gesperrt ? "Sperre aufheben" : "Kunde sperren"}
                  </button>
                  <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    Ein gesperrter Kunde erscheint in keiner Arbeitsliste mehr und bekommt keine
                    automatischen Mails. Die Akte bleibt.
                  </p>
                </div>

                <div className="px-3.5 py-3 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px var(--fi-linie)" }}>
                  <button type="button" onClick={() => setReiter("zuweisungen")}
                          className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold">
                    Zuständigkeit ändern
                  </button>
                  <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    Jede Umhängung wird mit vorherigem und neuem Zuständigen protokolliert.
                  </p>
                </div>

                {/* ══ PROVISION & BETREUER (E-027, 22.08.2026) ══════════════
                    Justin: „Leitung darf Provision setzen." Mit Begründung,
                    im Protokoll, in der Akte — und nur, solange nichts
                    ausgezahlt ist. Eine Zuweisung verschiebt die Zuständigkeit;
                    DAS hier verschiebt das Geld. Deshalb ein eigener Block. */}
                <div className="px-3.5 py-3 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px rgba(29,78,216,.25)", background: "rgba(29,78,216,.03)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-1" style={{ color: "var(--fi-primaer)" }}>Provision & Betreuer</p>
                  <p className="text-[12.5px] mb-2.5" style={{ color: "var(--fi-text-leise)" }}>
                    Heute: <b>{p.betreuerName || daten.person?.betreuerName || "kein dokumentierter Betreuer"}</b>. Der Anspruch folgt sonst dem letzten dokumentierten Kontakt.
                  </p>
                  <div className="flex flex-col gap-2">
                    <select value={betreuerId} onChange={(e) => setBetreuerId(e.target.value)} aria-label="Mitarbeiter"
                            className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none" style={{ borderColor: "var(--fi-linie)" }}>
                      <option value="">Mitarbeiter wählen …</option>
                      {agenten.map((a) => <option key={a.id} value={a.id}>{a.name}{a.rolle ? ` — ${a.rolle}` : ""}</option>)}
                    </select>
                    <input value={betreuerGrund} onChange={(e) => setBetreuerGrund(e.target.value)} placeholder="Begründung (Pflicht), z. B. hat den Abschluss am Telefon gemacht, Kontakt nicht dokumentiert"
                           className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none" style={{ borderColor: "var(--fi-linie)" }} />
                    <button type="button" onClick={() => void betreuerSetzen()} disabled={busy || !betreuerId || betreuerGrund.trim().length < 10}
                            className="fi-primaerknopf px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
                      Provisionsanspruch setzen
                    </button>
                  </div>
                  <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    Geht nicht mehr, sobald eine Provision angefordert oder ausgezahlt ist — dann entscheidet der Vorgesetzte im Nachbuchungs-Center.
                  </p>
                </div>

                {/* ── LÖSCHUNG ────────────────────────────────────────────── */}
                <div className="px-3.5 py-3 rounded-xl"
                     style={{ background: "rgba(185,28,28,.04)", boxShadow: "inset 0 0 0 1px rgba(185,28,28,.16)" }}>
                  {!loeschFrage ? (
                    <>
                      <button type="button" onClick={() => setLoeschFrage(true)}
                              className="fi-knopf-gefahr px-3.5 text-[12.5px]">
                        Kunde löschen
                      </button>
                      <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "#7f1d1d" }}>
                        Nach den DSGVO-Regeln: Die Person wird anonymisiert, Bestellungen und
                        Zahlungen bleiben als Zahlen erhalten. Nicht umkehrbar.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-bold" style={{ color: "#b91c1c" }}>
                        {p.name} wirklich löschen?
                      </p>
                      <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "#7f1d1d" }}>
                        Name, Adresse, Telefon und E-Mail werden unwiderruflich anonymisiert.
                        Bestellungen, Zahlungen und Provisionen bleiben als Zahlen bestehen —
                        die Buchhaltung darf nicht Löcher bekommen. Der Vorgang steht mit deinem
                        Namen im Aktivitäts-Protokoll.
                      </p>
                      <input value={grund} onChange={(e) => setGrund(e.target.value)}
                             placeholder="Grund (Pflicht): z. B. Löschantrag des Kunden vom 09.08."
                             className="w-full mt-2.5 rounded-xl px-3.5 py-2.5 text-[13px] outline-none"
                             style={{ border: "1px solid rgba(185,28,28,.3)", background: "#fff" }} />
                      <div className="flex items-center gap-2 mt-2.5">
                        <button type="button" onClick={() => { setLoeschFrage(false); setGrund(""); }}
                                className="text-[12.5px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                          Behalten
                        </button>
                        <button type="button"
                                onClick={async () => {
                                  if (grund.trim().length < 8) {
                                    zeige("fehler", "Grund fehlt", "Bei einer Löschung braucht es einen vollständigen Satz.");
                                    return;
                                  }
                                  setBusy(true);
                                  const r = await api(`/agent/vertrieb/person/${p.personId}/loeschen`,
                                    { method: "POST", body: JSON.stringify({ grund }) });
                                  setBusy(false);
                                  if (r.ok) {
                                    zeige("erfolg", "Gelöscht", r.json.meldung ?? "Die Person ist anonymisiert.");
                                    onGeaendert(); onSchliessen();
                                  } else zeige("fehler", "Nicht gelöscht", r.json?.error || "");
                                }}
                                disabled={busy || grund.trim().length < 8}
                                className="ml-auto fi-knopf-gefahr fi-knopf-gefahr-voll px-4 disabled:opacity-40"
                                style={{ minHeight: 38, fontSize: 12.5 }}>
                          Endgültig löschen
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {reiter === "stammdaten" && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ["first_name", "Vorname"], ["last_name", "Nachname"],
                    ["company_name", "Firma"], ["primary_email", "E-Mail"],
                    ["primary_phone", "Telefon"], ["street", "Straße"],
                    ["zip", "PLZ"], ["city", "Ort"],
                    ["country", "Land"], ["birthdate", "Geburtsdatum"],
                  ] as const).map(([feld, label]) => (
                    <label key={feld} className={feld === "company_name" || feld === "primary_email" || feld === "street" ? "col-span-2" : ""}>
                      <span className="block text-[11px] font-semibold uppercase tracking-[.06em] mb-1"
                            style={{ color: "var(--fi-text-still)" }}>{label}</span>
                      {feld === "country" ? (
                        <select value={form[feld] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [feld]: e.target.value }))}
                                className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none" style={{ borderColor: "var(--fi-linie)" }}>
                          <option value="">—</option><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option><option value="LI">Liechtenstein</option><option value="LU">Luxemburg</option>
                        </select>
                      ) : (
                        <input type={feld === "birthdate" ? "date" : "text"} value={feld === "birthdate" ? String(form[feld] ?? "").slice(0, 10) : (form[feld] ?? "")}
                               onChange={(e) => setForm((f) => ({ ...f, [feld]: e.target.value }))}
                               className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none"
                               style={{ borderColor: "var(--fi-linie)" }} />
                      )}
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => void speichern()} disabled={busy}
                        className="fi-primaerknopf px-4 py-2.5 mt-3.5 text-[13px] font-semibold text-white">
                  {busy ? "Speichere …" : "Stammdaten speichern"}
                </button>
                <p className="mt-2 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                  Jede Änderung wird mit altem und neuem Wert protokolliert. Zahlungen buchst du unter „Zahlung" mit Beleg,
                  den Provisionsanspruch setzt du unter „Verwaltung" mit Begründung.
                </p>

                {/* ── PAKET ÄNDERN (Scheibe 4) — nur vor der Zahlung ─────────── */}
                <div className="mt-4 px-3.5 py-3 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px var(--fi-linie)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[.07em] mb-1.5" style={{ color: "var(--fi-text-still)" }}>Paket der offenen Bestellung</p>
                  <div className="flex flex-col gap-2">
                    <select value={paketKey} onChange={(e) => setPaketKey(e.target.value)} aria-label="Paket"
                            className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none" style={{ borderColor: "var(--fi-linie)" }}>
                      <option value="">Paket wählen …</option>
                      {PAKETE.filter((x) => x.abo).map((x) => <option key={x.key} value={x.key}>{x.label} — {(x.preisCents / 100).toFixed(2).replace(".", ",")} €</option>)}
                    </select>
                    <input value={paketGrund} onChange={(e) => setPaketGrund(e.target.value)} placeholder="Grund, z. B. Kunde wollte Pro statt Ultra"
                           className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none" style={{ borderColor: "var(--fi-linie)" }} />
                    <button type="button" onClick={() => void paketSetzen()} disabled={busy || !paketKey || paketGrund.trim().length < 5}
                            className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-40">Paket und Betrag setzen</button>
                  </div>
                  <p className="text-[11.5px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>Betrag kommt aus dem Katalog. Danach die Zahlungsdaten neu senden — die alte Mail nennt den alten Betrag. Nach der Zahlung: Vorgesetzter.</p>
                </div>
                {daten.bestellungen?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[.07em] mb-1.5"
                       style={{ color: "var(--fi-text-still)" }}>Bestellungen</p>
                    {daten.bestellungen.map((b: any) => (
                      <div key={b.ref} className="py-2 text-[12.5px]" style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                        <span className="font-semibold">{b.payment_reference || b.ref}</span>
                        <span style={{ color: "var(--fi-text-still)" }}>
                          {" · "}{b.payment_status}{b.amount_due ? ` · ${Number(b.amount_due).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : ""}
                          {b.agent_name ? ` · ${b.agent_name}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {reiter === "verlauf" && (
              <ul className="space-y-2">
                {(daten.verlauf || []).map((v: any, i: number) => (
                  <li key={i} className="text-[12.5px] leading-snug pb-2" style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                    <span className="font-semibold">
                      {new Date(v.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {" · "}<span>{v.agent_name || "System"}</span>
                    {v.outcome && <span style={{ color: "var(--fi-primaer)" }}> · {v.outcome}</span>}
                    {v.note && <span style={{ color: "var(--fi-text-still)" }}> — {v.note}</span>}
                  </li>
                ))}
                {(daten.verlauf || []).length === 0 && (
                  <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Noch kein Eintrag.</p>
                )}
              </ul>
            )}

            {reiter === "zuweisungen" && (
              <ul className="space-y-2">
                {(daten.zuweisungen || []).map((z: any, i: number) => (
                  <li key={i} className="text-[12.5px] leading-snug pb-2" style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                    <span className="font-semibold">
                      {new Date(z.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {" · "}
                    <span>{z.von_name || "niemand"} → {z.nach_name || "niemand"}</span>
                    <span style={{ color: "var(--fi-text-still)" }}> · {z.reason || "—"} ({z.actor || "?"})</span>
                  </li>
                ))}
                {(daten.zuweisungen || []).length === 0 && (
                  <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Keine Zuweisungshistorie.</p>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
