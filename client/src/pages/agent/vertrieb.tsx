import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentShell } from "./shared";
import { Reveal } from "./motion";
import { Skelett, eur, useReduzierteBewegung, useToast } from "@/lib/fiaon-ui";
import { ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";
import { VertriebZusage, useZusage } from "./vertrieb-zusage";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/vertrieb — Gesamtsicht für die Vertriebsleitung
//
// Zwei Menschen im Team führen den Vertrieb. Sie brauchen den Blick über ALLE
// Kunden und die Möglichkeit, selbst zuzuweisen und Daten zu korrigieren — sonst
// müssen sie für jede Kleinigkeit beim Betreiber anfragen. Genau das war die
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

const STATUS_TEXT: Record<string, string> = {
  bezahlt: "Bezahlt", zahlung_angekuendigt: "Zahlung gemeldet",
  rechnung_offen: "Rechnung offen", zahlungsfrist_abgelaufen: "Frist abgelaufen",
  antrag_abgeschlossen: "Antrag fertig", antrag_abgebrochen: "Antrag abgebrochen",
  nur_lead: "Lead", ausgeschlossen: "Ausgeschlossen",
};
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
  useEffect(() => {
    if (!geprueft || zusage) return;
    const t = setTimeout(() => void ladeListe(), suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [ladeListe, suche, geprueft, zusage]);

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
                Alle Kunden, alle Zuständigkeiten. Zuweisen, korrigieren, dokumentieren — jede Änderung wird protokolliert.
              </p>
            </div>
            <input value={suche} onChange={(e) => setSuche(e.target.value)}
                   placeholder="Name, E-Mail, Nummer, Referenz"
                   className="h-[36px] px-3 rounded-xl border bg-white text-[13px] outline-none w-[220px] sm:w-[280px]"
                   style={{ borderColor: "var(--fi-linie)" }} />
          </div>
        </Reveal>

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
            <div className="divide-y" style={{ borderColor: "var(--fi-linie)" }}>
              {agenten.map((a) => (
                <button key={a.id} type="button"
                        onClick={() => { setAgentFilter(agentFilter === a.id ? null : a.id); setFilter("alle"); }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors duration-150"
                        style={agentFilter === a.id ? { background: "var(--fi-flaeche-akzent, #f1f5ff)" } : undefined}>
                  <span className="min-w-0 flex-1">
                    <span className="text-[13.5px] font-semibold">{a.name}</span>
                    {a.rolle === "vertriebsleiter" && (
                      <span className="ml-2 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(29,78,216,.08)", color: "var(--fi-primaer)" }}>
                        Vertriebsleitung
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[12px] fi-zahl" style={{ color: "var(--fi-text-still)" }}>
                    <b style={{ color: "var(--fi-tier1)" }}>{a.tier1}</b> gemeldet ·{" "}
                    <b style={{ color: "var(--fi-tier2)" }}>{a.tier2}</b> offen ·{" "}
                    <b style={{ color: "var(--fi-tier3)" }}>{a.tier3}</b> Leads ·{" "}
                    {a.betreut} betreut
                  </span>
                  <ZeichenWinkel richtung="rechts" size={13} className="shrink-0 opacity-40" />
                </button>
              ))}
              {agenten.length === 0 && <p className="px-4 py-4 text-[13px]" style={{ color: "var(--fi-text-still)" }}>Wird geladen …</p>}
            </div>
          </section>
        </Reveal>

        {/* Filter */}
        <Reveal index={3}>
          <div className="mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
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
                  Nur {agenten.find((a) => a.id === agentFilter)?.name || "ohne Agent"} ✕
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
                          {STATUS_TEXT[p.tierGrund] || p.tierGrund}
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
                          {p.telefonWaehlbar && (
                            <a href={`tel:${p.telefonWaehlbar}`} className="fi-zweitknopf inline-flex items-center px-2 py-1.5"
                               title={`${p.name} anrufen`} aria-label={`${p.name} anrufen`}>
                              <ZeichenTelefon size={13} />
                            </a>
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
  const [reiter, setReiter] = useState<"stammdaten" | "verlauf" | "zuweisungen">("stammdaten");
  const [form, setForm] = useState<Record<string, string>>({});
  const p = daten.person;

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

  const sperre = async (sperren: boolean) => {
    setBusy(true);
    const r = await api(`/agent/vertrieb/person/${p.personId}/sperre`, { method: "POST", body: JSON.stringify({ sperren }) });
    setBusy(false);
    if (r.ok) { zeige("erfolg", sperren ? "Gesperrt" : "Entsperrt", r.json.meldung); onGeaendert(); }
    else zeige("fehler", "Nicht möglich", r.json?.error || "");
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
              <p className="text-[16px] font-bold truncate">{p.name}</p>
              <p className="text-[12px]" style={{ color: "var(--fi-text-still)" }}>
                {STATUS_TEXT[p.tierGrund] || p.tierGrund} · zuständig: {p.agentName || "niemand"}
                {p.betreutSeit ? ` · betreut seit ${dtag(p.betreutSeit)}` : ""}
              </p>
            </div>
            <button type="button" onClick={onSchliessen} className="fi-zweitknopf px-2.5 py-1.5 text-[12px] font-semibold">
              Schließen
            </button>
          </div>

          {/* Schnellaktionen */}
          <div className="px-5 pt-3.5 flex flex-wrap items-center gap-2">
            {p.telefonWaehlbar && (
              <a href={`tel:${p.telefonWaehlbar}`} className="fi-primaerknopf inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-white">
                <ZeichenTelefon size={14} /> Anrufen
              </a>
            )}
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
            {([["stammdaten", "Stammdaten"], ["verlauf", `Verlauf (${daten.verlauf?.length || 0})`], ["zuweisungen", "Zuweisungen"]] as const).map(([k, l]) => (
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
                  bleibt beim Betreiber.
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
