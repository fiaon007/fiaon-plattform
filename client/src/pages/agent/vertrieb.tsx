import { useCallback, useEffect, useMemo, useState } from "react";
import { KundenKopf } from "@/components/kunde/AblaufLeiste";
import { anrufStarten } from "@/components/Softphone";
import { AgentShell } from "./shared";
import { Reveal } from "./motion";
import { Skelett, eur, useReduzierteBewegung, useToast } from "@/lib/fiaon-ui";
import { ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";
import { VertriebZusage, useZusage } from "./vertrieb-zusage";
import { VertriebZahlungen, VertriebDokumente, VertriebZugang, LageTafel, ServiceZahlen, PipelineZahlen } from "./vertrieb-service";
import DublettenArbeitsplatz from "@/components/admin/DublettenArbeitsplatz";
import { statusAusTierGrund } from "@shared/fiaon-kundenstatus";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/vertrieb — Gesamtsicht für die Vertriebsleitung
//
// Zwei Menschen im Team führen den Vertrieb. Sie brauchen den Blick über ALLE
// Kunden und die Möglichkeit, selbst zuzuweisen und Daten zu korrigieren — sonst
// müssen sie für jede Kleinigkeit beim Vorgesetzter anfragen. Genau das war die
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
  const [bereich, setBereich] = useState<"kunden" | "zahlungen" | "dokumente" | "zugang" | "dubletten">("kunden");
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

  const ladeKopf = useCallback(async () => {
    const r = await api("/agent/vertrieb/uebersicht");
    if (r.status === 404) { setKeinZugang(true); setLaedt(false); return; }
    // Erklärung noch offen (oder zwischenzeitlich neu gefasst): Tafel zeigen,
    // nicht eine leere Seite mit unerklärlichen Nullen.
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { void erneutPruefen(); setLaedt(false); return; }
    if (r.ok) { setZahlen(r.json.zahlen); setAgenten(r.json.agenten); }
  }, [erneutPruefen]);

  const ladeListe = useCallback(async (leise = false) => {
    if (!leise) setLaedt(true);
    const p = new URLSearchParams({ filter });
    if (agentFilter !== null) p.set("agent", String(agentFilter));
    if (suche.trim()) p.set("q", suche.trim());
    const r = await api(`/agent/vertrieb/personen?${p.toString()}`);
    if (r.status === 404) { setKeinZugang(true); setLaedt(false); return; }
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { void erneutPruefen(); setLaedt(false); return; }
    if (r.ok) setPersonen(r.json.personen);
    setLaedt(false);
  }, [filter, agentFilter, suche, erneutPruefen]);

  // Erst laden, wenn die Erklärung geklärt ist. Sonst rennen Anfragen in ein 403
  // und die Tafel stünde über einer Seite, die gerade Fehler sammelt.
  useEffect(() => { if (geprueft && !zusage) void ladeKopf(); }, [ladeKopf, geprueft, zusage]);

  const ladeService = useCallback(async () => {
    const r = await api("/agent/vertrieb/service");
    if (r.ok) { setService(r.json.zahlen); setPipeline(r.json.pipeline || null); }
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
    if (!confirm(
      `${gewaehlt.length} Kunde(n) ${agentId ? `an ${ziel} zuweisen` : "aus der Zuweisung nehmen"}?\n\n`
      + `Der Provisionsanspruch bleibt beim dokumentierten Betreuer — eine Zuweisung verschiebt nur die `
      + `Zuständigkeit, nicht das Geld.\n\nJede Änderung wird protokolliert.`,
    )) return;
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

  const akteOeffnen = async (personId: number) => {
    setAkte({ laedt: true, personId });
    const r = await api(`/agent/vertrieb/person/${personId}`);
    if (r.ok) setAkte({ ...r.json, personId });
    else { setAkte(null); zeige("fehler", "Akte nicht ladbar", r.json?.error || ""); }
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

          {/* Bereichswahl — die vier Arbeiten der Vertriebsleitung. */}
          <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
              {([
                ["kunden", "Kunden", null],
                ["zahlungen", "Zahlungen", (service?.gemeldet ?? 0) + (service?.fristAbgelaufen ?? 0)],
                ["dokumente", "Unterlagen", service?.dokumenteFehlen ?? 0],
                ["zugang", "Zugang", service?.zugangOffen ?? 0],
                ["dubletten", "Dubletten", service?.dubletten ?? 0],
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

        {bereich !== "kunden" && bereich !== "dubletten" && (
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
                        [a.betreut, "betreut", "var(--fi-text-still)"],
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
              {agenten.length === 0 && <p className="px-4 py-4 text-[13px]" style={{ color: "var(--fi-text-still)" }}>Wird geladen …</p>}
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
                  Nur {agenten.find((a) => a.id === agentFilter)?.name || "ohne Zuständigen"} ✕
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

        {/* Tabelle */}
        <div className="mt-3 fi-karte overflow-hidden">
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

      {akte && <Akte daten={akte} onSchliessen={() => setAkte(null)}
                     onGeaendert={() => { void ladeListe(true); void ladeKopf(); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Akte — Stammdaten korrigieren, dokumentieren, sperren, senden
// ═══════════════════════════════════════════════════════════════════════════
function Akte({ daten, onSchliessen, onGeaendert }: { daten: any; onSchliessen: () => void; onGeaendert: () => void }) {
  const { zeige } = useToast();
  const [busy, setBusy] = useState(false);
  // „Lage" steht zuerst: Wenn ein Agent anruft, lautet die Frage fast immer
  // „ist das Geld da / was fehlt / warum kommt er nicht rein" — und nicht
  // „wie ist die Straße geschrieben".
  const [reiter, setReiter] = useState<
    "lage" | "zugang" | "zahlung" | "verwaltung" | "stammdaten" | "verlauf" | "zuweisungen"
  >("lage");
  // Ein Grund ist Pflicht bei allem, was Zugang verschafft oder Geld bewegt.
  const [grund, setGrund] = useState("");
  const [einmalPasswort, setEinmalPasswort] = useState<{ pw: string; bis: string } | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [zugangStand, setZugangStand] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
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

  const zahlungBuchen = async () => {
    if (grund.trim().length < 5) { zeige("fehler", "Beleg fehlt", "Bitte notieren, woher du weißt, dass gezahlt wurde."); return; }
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/zahlung-gebucht`,
      { method: "POST", body: JSON.stringify({ grund }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", "Gebucht", r.json.meldung ?? "Die Zahlung ist vermerkt."); setGrund(""); onGeaendert(); }
    else zeige("fehler", "Nicht gebucht", r.json?.error || "");
  };

  const zahlungsdaten = async () => {
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/zahlungsdaten`, { method: "POST", body: JSON.stringify({}) });
    setBusy(false);
    if (r.ok) zeige("erfolg", "Zahlungsdaten versandt", `An ${r.json.versandtAn}`);
    else zeige("fehler", "Nicht versandt", r.json?.error || "");
  };

  return (
    <>
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
            <button type="button" onClick={() => void zahlungsdaten()} disabled={busy}
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
            {reiter === "lage" && <LageTafel personId={Number(daten.personId)} />}

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

                <button type="button" onClick={() => void zahlungsdaten()} disabled={busy}
                        className="fi-sendeknopf inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold">
                  <ZeichenSenden size={14} /> Zahlungsdaten erneut schicken
                </button>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] mb-1.5"
                         style={{ color: "var(--fi-text-still)" }}>
                    Beleg (Pflicht)
                  </label>
                  <input value={grund} onChange={(e) => setGrund(e.target.value)}
                         placeholder="z. B. Überweisung am 09.08. im Kontoauszug gesehen"
                         className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none"
                         style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)" }} />
                  <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    Woher weißt du, dass gezahlt wurde? Der Satz steht dauerhaft am Kunden — er
                    ist der Beleg, wenn später jemand fragt.
                  </p>
                </div>
                <button type="button" onClick={() => void zahlungBuchen()}
                        disabled={busy || grund.trim().length < 5}
                        className="fi-primaerknopf px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
                  Als bezahlt buchen
                </button>
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
                  ] as const).map(([feld, label]) => (
                    <label key={feld} className={feld === "company_name" || feld === "primary_email" || feld === "street" ? "col-span-2" : ""}>
                      <span className="block text-[11px] font-semibold uppercase tracking-[.06em] mb-1"
                            style={{ color: "var(--fi-text-still)" }}>{label}</span>
                      <input value={form[feld] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [feld]: e.target.value }))}
                             className="w-full h-[36px] px-2.5 rounded-lg border bg-white text-[13px] outline-none"
                             style={{ borderColor: "var(--fi-linie)" }} />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => void speichern()} disabled={busy}
                        className="fi-primaerknopf px-4 py-2.5 mt-3.5 text-[13px] font-semibold text-white">
                  {busy ? "Speichere …" : "Stammdaten speichern"}
                </button>
                <p className="mt-2 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                  Jede Änderung wird mit altem und neuem Wert protokolliert. Zahlungen buchen und Provisionen ändern
                  bleibt beim Vorgesetzter.
                </p>

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
