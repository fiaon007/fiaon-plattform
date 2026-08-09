import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { statusAusTierGrund, stufeAusTier } from "@shared/fiaon-kundenstatus";
import { FiaonEbene } from "@/components/FiaonEbene";
import { FiaonFilter, FiaonFilterChips } from "@/components/FiaonFilter";

// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN-ZENTRALE — eine Seite statt sechs
//
// Bis zum 09.08.2026 sprang der Vorgesetzte zwischen „Kunden — die eine Liste",
// „Anträge & KYC", „Kunden & Zuordnung", „Offene Kartei", „Leads" und
// „Kündigungen". Jede hatte ihre eigene Suche, ihre eigenen Filter und ihre
// eigene Vorstellung davon, was ein Kunde ist. Wer eine Person suchte, musste
// raten, auf welcher Seite sie wohnt.
//
// FILTER STEHEN IN DER ADRESSE. Ein Kollege soll einen Link schicken können
// statt „geh auf Kunden, dann Stufe B, dann ohne Agent". Das ist der
// eigentliche Grund für die URL-Persistenz — nicht Technik, sondern Zuruf.
//
// „ALLE TREFFER WÄHLEN" GEHT ÜBER SEITENGRENZEN. Eine Auswahl, die nur die
// sichtbaren fünfzig meint, ist eine Falle: Man klickt „alle", sieht 50 und
// löscht dann doch nur 50 von 2.000 — oder schlimmer, man glaubt es seien 50.
// ═══════════════════════════════════════════════════════════════════════════

interface Zeile {
  person_id: number;
  name: string;
  priority_tier: number;
  tier_reason: string;
  primary_phone: string | null;
  email: string | null;
  ref: string | null;
  zahlungsreferenz: string | null;
  paket: string | null;
  agent: string | null;
  umsatz: string | null;
  letzter_kontakt: string | null;
  ist_test_am: string | null;
}

interface LoeschKandidat {
  personId: number; name: string; art: string; begruendung: string;
}

const STUFEN_KNOPF: { wert: string; titel: string; schluessel: string }[] = [
  { wert: "A", titel: "Stufe A", schluessel: "stufe_a" },
  { wert: "B", titel: "Stufe B", schluessel: "stufe_b" },
  { wert: "C", titel: "Stufe C", schluessel: "stufe_c" },
  { wert: "bezahlt", titel: "Bezahlt", schluessel: "bezahlt" },
];

/**
 * Die Spezialfilter — Schlüssel und Klartext getrennt.
 *
 * Der Schlüssel steht in der Adresse, der Titel auf dem Chip. Eine gemeinsame
 * Liste wäre bequem und hätte die Folge, dass jemand den Titel ändert und die
 * Adressen aller geteilten Links kaputtgehen.
 */
const SPEZIAL_SCHLUESSEL = [
  "ohneAgent", "kycOffen", "zahlungUnbestaetigt", "kuendigungen", "ruhend",
  "ohneTelefon", "dubletten", "anonyme", "tests", "archiv",
] as const;

const SPEZIAL_TITEL: Record<string, string> = {
  ohneAgent: "Ohne Agent",
  kycOffen: "KYC zu prüfen",
  zahlungUnbestaetigt: "Zahlung über 7 Tage offen",
  kuendigungen: "Kündigungen",
  ruhend: "Ruhend",
  ohneTelefon: "Ohne Telefon",
  dubletten: "Dubletten-Verdacht",
  anonyme: "Anonyme Abbrecher",
  tests: "Testeinträge",
  archiv: "Archiviertes",
};


const SORTIERUNG = [
  { wert: "arbeit", titel: "Arbeitsreihenfolge" },
  { wert: "neueste", titel: "Neueste" },
  { wert: "name", titel: "Name" },
  { wert: "umsatz", titel: "Umsatz" },
];

/** Vier Zeichen, 20×20, 1,5 px, currentColor — wie überall im Haus. */
function Zeichen({ art, size = 15 }: { art: "haken" | "kreuz" | "brief" | "muell"; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor",
    strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true, focusable: "false" as const,
  };
  if (art === "haken") return <svg {...p}><path d="m4 10.5 4 4 8-9" /></svg>;
  if (art === "kreuz") return <svg {...p}><path d="m5 5 10 10M15 5 5 15" /></svg>;
  if (art === "brief") {
    return <svg {...p}><rect x="2.5" y="4.5" width="15" height="11" rx="2" /><path d="m3 6 6.3 4.6c.4.3 1 .3 1.4 0L17 6" /></svg>;
  }
  return <svg {...p}><path d="M4 6h12M8 6V4.5c0-.6.4-1 1-1h2c.6 0 1 .4 1 1V6M6 6l.8 9.5c0 .6.5 1 1 1h4.4c.5 0 1-.4 1-1L14 6" /></svg>;
}

function eur(cent: unknown): string {
  const n = Number(cent ?? 0);
  return n === 0 ? "—" : `${n.toFixed(2).replace(".", ",")} €`;
}

function wann(iso: string | null): string {
  if (!iso) return "nie";
  const tage = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (tage === 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 30) return `vor ${tage} T`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" });
}

export default function AdminKundenZentrale() {
  const [, navigate] = useLocation();
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set());
  const [alleTreffer, setAlleTreffer] = useState<number[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [loeschDialog, setLoeschDialog] = useState<any>(null);
  const [bestaetigung, setBestaetigung] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // ── Filter aus der Adresse ───────────────────────────────────────────────
  // Einzige Wahrheit: die Adresszeile. Kein zweiter Zustand daneben, der
  // auseinanderlaufen könnte.
  // ── DER BUG, DEN DER BETREIBER GEMELDET HAT (11.08.2026) ────────────────
  // Hier stand `useMemo(() => new URLSearchParams(window.location.search), [
  //   window.location.search ])`. Das sieht richtig aus und ist es nicht:
  // `window.location.search` ist keine reaktive Quelle. React erfährt nichts
  // von einer Adressänderung, also wurde die Abhängigkeit nie neu bewertet und
  // der Lade-Effekt nie erneut ausgelöst. Ein Filterklick änderte die Adresse
  // und sonst nichts — die Liste kam erst nach einem Vollreload.
  //
  // `useSearch()` aus wouter ABONNIERT den Suchteil der Adresse. Damit rendert
  // die Komponente neu, sobald sich ein Filter ändert, und der Effekt läuft.
  const suche = useSearch();
  const params = useMemo(() => new URLSearchParams(suche), [suche]);
  const [suchtext, setSuchtext] = useState(params.get("q") ?? "");

  const setzeFilter = useCallback((aenderungen: Record<string, string | null>) => {
    // Vom ABONNIERTEN Stand ausgehen, nicht von window.location: Zwei Klicks
    // in schneller Folge lesen sonst beide den Stand VOR dem ersten — und der
    // erste Filter fällt still wieder heraus.
    const p = new URLSearchParams(suche);
    for (const [k, v] of Object.entries(aenderungen)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    // Jede Filteränderung springt auf Seite eins — sonst steht man auf Seite 7
    // einer Liste, die nur noch drei Seiten hat, und sieht nichts.
    if (!("offset" in aenderungen)) p.delete("offset");
    navigate(`/admin/kunden${p.toString() ? `?${p}` : ""}`, { replace: true });
  }, [navigate, suche]);

  const laden = useCallback(async () => {
    setLaedt(true);
    // Aus dem ABONNIERTEN Suchteil, nicht aus window.location: Sonst liest
    // der Aufruf denselben veralteten Stand, den der Effekt gerade verlassen
    // hat.
    const r = await fetch(`/api/fiaon/admin/zentrale/kunden?${suche}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setDaten(j);
    setLaedt(false);
  }, [suche]);

  useEffect(() => { void laden(); }, [laden, suche]);
  // Auswahl fällt weg, wenn sich die Treffermenge ändert — sonst löscht man
  // Zeilen, die man gar nicht mehr sieht.
  useEffect(() => { setGewaehlt(new Set()); setAlleTreffer(null); }, [suche]);

  const zahlen = daten?.zahlen ?? {};
  const zeilen: Zeile[] = daten?.zeilen ?? [];
  const gesamt = daten?.gesamt ?? 0;
  const offset = Number(params.get("offset") ?? 0);
  const grenze = 50;
  const anzahlGewaehlt = alleTreffer ? alleTreffer.length : gewaehlt.size;
  const auswahlIds = () => (alleTreffer ?? Array.from(gewaehlt));

  const anKnopf = (s: string) => params.get(s) === "1";
  const stufen = (params.get("stufe") ?? "").split(",").filter(Boolean);

  const loeschVorschau = async () => {
    setBusy("vorschau");
    const r = await fetch("/api/fiaon/admin/zentrale/kunden/loeschen/vorschau", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds: auswahlIds() }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.error || "Vorschau nicht möglich." }); return; }
    setLoeschDialog(j);
    setBestaetigung("");
  };

  const loeschen = async () => {
    setBusy("loeschen");
    const r = await fetch("/api/fiaon/admin/zentrale/kunden/loeschen", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds: auswahlIds(), bestaetigung }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.error || "Fehler." }); return; }
    setLoeschDialog(null);
    setMeldung({ art: "gut", text: j.meldung });
    setGewaehlt(new Set()); setAlleTreffer(null);
    void laden();
  };

  const aktion = async (art: string, extra: Record<string, unknown> = {}) => {
    setBusy(art);
    const r = await fetch("/api/fiaon/admin/zentrale/kunden/aktion", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds: auswahlIds(), art, ...extra }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
    if (j?.ok) { setGewaehlt(new Set()); setAlleTreffer(null); void laden(); }
  };

  return (
    <>
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-4">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Kunden-Zentrale</h1>
          <p className="text-[12.5px] text-slate-400 mt-0.5">
            Jede Person genau einmal — Leads, Kunden, Anträge, KYC, Kündigungen. Filter stehen in der Adresse und sind teilbar.
          </p>
        </div>
        {meldung && (
          <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {/* ── Suche und Sortierung ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={suchtext}
            onChange={(e) => setSuchtext(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setzeFilter({ q: suchtext || null }); }}
            onBlur={() => setzeFilter({ q: suchtext || null })}
            placeholder="Name, E-Mail, Nummer (auch mit Leerzeichen), Referenz — auch alte Adressen"
            className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13.5px] outline-none focus:border-[#2563eb]"
            style={{ minHeight: 42 }}
          />
          <select value={params.get("sortierung") ?? "arbeit"}
                  onChange={(e) => setzeFilter({ sortierung: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px]"
                  style={{ minHeight: 42 }}>
            {SORTIERUNG.map((s) => <option key={s.wert} value={s.wert}>{s.titel}</option>)}
          </select>
          <a href={`/api/fiaon/admin/zentrale/kunden/export?${params}`}
             className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600"
             style={{ minHeight: 42, display: "inline-flex", alignItems: "center" }}>
            CSV
          </a>
        </div>

        {/* ── Stufen ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button type="button" onClick={() => setzeFilter({ stufe: null })}
                  className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                  style={stufen.length === 0
                    ? { background: "#1d4ed8", color: "#fff" }
                    : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
            Alle <span className="tabular-nums opacity-70">{zahlen.alle ?? "—"}</span>
          </button>
          {STUFEN_KNOPF.map((s) => {
            const an = stufen.includes(s.wert);
            return (
              <button key={s.wert} type="button"
                      onClick={() => setzeFilter({
                        stufe: (an ? stufen.filter((x) => x !== s.wert) : [...stufen, s.wert]).join(",") || null,
                      })}
                      className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                      style={an
                        ? { background: "#1d4ed8", color: "#fff" }
                        : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
                {s.titel} <span className="tabular-nums opacity-70">{zahlen[s.schluessel] ?? "—"}</span>
              </button>
            );
          })}
        </div>

        {/* ── Filter-Knopf und aktive Chips ─────────────────────────────
            Vorher standen hier vierzehn Knöpfe in zwei Reihen. Das ist keine
            Leiste, das ist eine Wand: Man liest sie nicht, man sucht darin.
            Jetzt EIN Knopf mit Zahl — und was eingestellt ist, steht als Chip
            daneben, nicht als Farbe unter dreizehn anderen. */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <FiaonFilter
            gruppen={[
              {
                titel: "Arbeitslage",
                art: "schalter",
                optionen: [
                  { schluessel: "ohneAgent", titel: "Ohne Agent", anzahl: zahlen.ohne_agent,
                    erklaerung: "Niemand ist zuständig — die teuerste Lücke im Haus." },
                  { schluessel: "kycOffen", titel: "KYC zu prüfen", anzahl: zahlen.kyc_offen,
                    erklaerung: "Unterlagen liegen vor, geprüft ist nichts." },
                  { schluessel: "zahlungUnbestaetigt", titel: "Zahlung über 7 Tage offen",
                    anzahl: zahlen.zahlung_unbestaetigt,
                    erklaerung: "Gemeldet, aber nicht gebucht." },
                  { schluessel: "kuendigungen", titel: "Kündigungen", anzahl: zahlen.kuendigungen },
                  { schluessel: "ruhend", titel: "Ruhend", anzahl: zahlen.ruhend },
                ],
              },
              {
                titel: "Datenqualität",
                art: "schalter",
                optionen: [
                  { schluessel: "ohneTelefon", titel: "Ohne Telefon", anzahl: zahlen.ohne_telefon,
                    erklaerung: "Nicht anrufbar — nur per Mail erreichbar." },
                  { schluessel: "dubletten", titel: "Dubletten-Verdacht", anzahl: null,
                    erklaerung: "Gleiche Nummer oder Adresse wie jemand anderes." },
                  { schluessel: "anonyme", titel: "Anonyme Abbrecher", anzahl: zahlen.anonyme,
                    erklaerung: "Weder Mail noch Nummer hinterlegt." },
                ],
              },
              {
                titel: "Sonderansichten",
                art: "schalter",
                optionen: [
                  { schluessel: "tests", titel: "Testeinträge", anzahl: zahlen.tests,
                    erklaerung: "Nur mit diesem Schalter sichtbar." },
                  { schluessel: "archiv", titel: "Archiviertes", anzahl: null,
                    erklaerung: "Zeigt stillgelegte Bestellungen statt der aktiven." },
                ],
              },
            ]}
            aktiv={Object.fromEntries(
              SPEZIAL_SCHLUESSEL.filter((k) => params.get(k) === "1").map((k) => [k, true]),
            )}
            onAendern={(k, w) => setzeFilter({ [k]: w ? "1" : null })}
            onZuruecksetzen={() => setzeFilter(
              Object.fromEntries(SPEZIAL_SCHLUESSEL.map((k) => [k, null])),
            )}
          />

          {daten?.agenten?.length > 0 && (
            <select value={params.get("agent") ?? ""}
                    onChange={(e) => setzeFilter({ agent: e.target.value || null })}
                    aria-label="Zuständiger"
                    className="px-3 rounded-xl text-[13px] font-semibold bg-white text-slate-600 border-0"
                    style={{ height: 42, boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
              <option value="">Alle Zuständigen</option>
              {daten.agenten.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          <FiaonFilterChips
            chips={SPEZIAL_SCHLUESSEL.filter((k) => params.get(k) === "1")
              .map((k) => ({ schluessel: k, titel: SPEZIAL_TITEL[k] ?? k }))}
            onEntfernen={(k) => setzeFilter({ [k]: null })}
            onAlle={() => setzeFilter(Object.fromEntries(SPEZIAL_SCHLUESSEL.map((k) => [k, null])))}
          />
        </div>

        {/* ── Massenauswahl ────────────────────────────────────────────── */}
        {anzahlGewaehlt > 0 && (
          <div className="mb-3 p-3 rounded-2xl flex flex-wrap items-center gap-2"
               style={{ background: "rgba(29,78,216,.05)", border: "1px solid rgba(29,78,216,.18)" }}>
            <span className="text-[13px] font-bold text-[#1d4ed8]">
              {anzahlGewaehlt} gewählt
            </span>
            {!alleTreffer && gesamt > zeilen.length && (
              <button type="button"
                      onClick={async () => {
                        const r = await fetch(`/api/fiaon/admin/zentrale/kunden/alle-ids?${suche}`, { credentials: "include" });
                        const j = await r.json();
                        if (j?.ok) setAlleTreffer(j.ids);
                      }}
                      className="text-[12.5px] font-semibold underline text-[#1d4ed8]">
                Alle {gesamt} Treffer wählen
              </button>
            )}
            <button type="button" onClick={() => { setGewaehlt(new Set()); setAlleTreffer(null); }}
                    className="text-[12.5px] font-semibold text-slate-500">Auswahl aufheben</button>

            <span className="ml-auto flex flex-wrap gap-1.5">
              <button type="button" onClick={() => navigate(`/agent/mail-zentrale?personIds=${auswahlIds().join(",")}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-semibold text-slate-700">
                <Zeichen art="brief" size={13} /> Mail senden
              </button>
              <button type="button" onClick={() => void aktion("agent")} disabled={!!busy}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 disabled:opacity-40">
                Zuweisen
              </button>
              <button type="button" onClick={() => void aktion("test")} disabled={!!busy}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 disabled:opacity-40">
                Als Test
              </button>
              <button type="button" onClick={() => void aktion("archivieren", { grund: "sonstiges" })} disabled={!!busy}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 disabled:opacity-40">
                Archivieren
              </button>
              <button type="button" onClick={() => void loeschVorschau()} disabled={!!busy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white bg-[#b91c1c] disabled:opacity-40">
                <Zeichen art="muell" size={13} /> Löschen
              </button>
            </span>
          </div>
        )}

        {/* ── Liste ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="hidden lg:grid px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100"
               style={{ gridTemplateColumns: "28px 1.6fr 90px 1fr 1.1fr 110px 96px 70px" }}>
            <span />
            <span>Name</span><span>Stufe</span><span>Produkt</span><span>Kontakt</span>
            <span>Zuständig</span><span>Referenz</span><span>Letzter Kontakt</span>
          </div>

          {laedt && <p className="px-4 py-10 text-center text-[13px] text-slate-400">Wird geladen …</p>}
          {!laedt && zeilen.length === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-slate-400">Kein Treffer für diese Filter.</p>
          )}

          {!laedt && zeilen.map((z) => {
            const st = statusAusTierGrund(z.tier_reason);
            // Farbrolle statt Farbwert — das Designsystem bleibt wechselbar.
            const stFarbe = st.ton === "warnung" ? "#b45309"
              : st.ton === "offen" ? "#1d4ed8"
              : st.ton === "gut" ? "#047857" : "#64748b";
            const stufe = stufeAusTier(z.priority_tier);
            const an = alleTreffer ? alleTreffer.includes(z.person_id) : gewaehlt.has(z.person_id);
            return (
              <div key={z.person_id}
                   className="px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50/60 lg:grid block"
                   style={{ gridTemplateColumns: "28px 1.6fr 90px 1fr 1.1fr 110px 96px 70px", alignItems: "center" }}>
                <label className="inline-flex items-center mb-2 lg:mb-0" style={{ minWidth: 24, minHeight: 24 }}>
                  <input type="checkbox" checked={an} aria-label={`${z.name} wählen`}
                         onChange={() => {
                           setAlleTreffer(null);
                           setGewaehlt((s) => {
                             const n = new Set(s);
                             n.has(z.person_id) ? n.delete(z.person_id) : n.add(z.person_id);
                             return n;
                           });
                         }} />
                </label>
                <button type="button" onClick={() => navigate(`/admin/kunde/${z.ref ?? z.person_id}`)}
                        className="text-left min-w-0 block w-full lg:w-auto">
                  <span className="block text-[13.5px] font-bold text-slate-900 truncate">
                    {z.name}
                    {z.ist_test_am && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Test</span>}
                  </span>
                  {/* Auf dem Telefon UMBRECHEN statt abschneiden. Ein
                      abgeschnittener Status ist schlimmer als zwei Zeilen:
                      „Bezahlt · Bonitätsauskunft inkl. Handlun…" sagt weniger
                      als gar nichts. Gefunden vom Schmal-Prüfstand (13 px). */}
                  <span className="block text-[11.5px] text-slate-400 leading-snug lg:hidden">
                    <b className="font-semibold" style={{ color: stFarbe }}>
                      {stufe ? `${stufe.marke} · ` : ""}{st.text}
                    </b>
                    {z.paket ? ` · ${z.paket}` : ""}
                    <span className="block">{z.agent || "ohne Zuständigen"}{z.email ? ` · ${z.email}` : ""}</span>
                  </span>
                </button>
                <span className="hidden lg:block text-[11.5px] font-semibold truncate" style={{ color: stFarbe }}
                      title={st.hinweis}>
                  {stufe ? `${stufe.marke} · ` : ""}{st.text}
                </span>
                <span className="hidden lg:block text-[12px] text-slate-500 truncate">{z.paket || "—"}</span>
                <span className="hidden lg:block text-[12px] text-slate-500 truncate">
                  {z.email || z.primary_phone || "—"}
                </span>
                <span className="hidden lg:block text-[12px] text-slate-500 truncate">{z.agent || "—"}</span>
                <span className="hidden lg:block text-[11px] text-slate-400 font-mono truncate">
                  {z.zahlungsreferenz || z.ref || "—"}
                </span>
                <span className="hidden lg:block text-[11.5px] text-slate-400">{wann(z.letzter_kontakt)}</span>
              </div>
            );
          })}
        </div>

        {/* ── Blättern ─────────────────────────────────────────────────── */}
        {gesamt > grenze && (
          <div className="flex items-center justify-between mt-3 text-[12.5px]">
            <span className="text-slate-400">
              {offset + 1}–{Math.min(offset + grenze, gesamt)} von {gesamt}
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={offset === 0}
                      onClick={() => setzeFilter({ offset: String(Math.max(0, offset - grenze)) })}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40">
                Zurück
              </button>
              <button type="button" disabled={offset + grenze >= gesamt}
                      onClick={() => setzeFilter({ offset: String(offset + grenze) })}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40">
                Weiter
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ── Lösch-Dialog auf der FiaonEbene ───────────────────────────
          Vorher ein weißer Kasten auf schwarzem Schleier. Der gefährlichste
          Knopf im Haus verdient die beste Darstellung: Wer hier hastig klickt,
          löscht Menschen. */}
      <FiaonEbene
        offen={!!loeschDialog}
        onZu={() => setLoeschDialog(null)}
        titel="Was mit dieser Auswahl passiert"
        ueberschrift="Bitte genau lesen"
        breite={600}
        marke={<Zeichen art="muell" size={17} />}
        fuss={loeschDialog ? (
          <>
            {/* Ein Kontrollkästchen klickt man weg. Einen Satz mit einer Zahl
                darin tippt man nicht versehentlich. */}
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              Zur Bestätigung eintippen:{" "}
              <span className="font-mono text-slate-900">{loeschDialog.bestaetigung}</span>
            </label>
            <input value={bestaetigung} onChange={(e) => setBestaetigung(e.target.value)}
                   aria-label="Bestätigungstext"
                   className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#b91c1c]"
                   style={{ minHeight: 42 }} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setLoeschDialog(null)}
                      className="text-[13px] font-semibold text-slate-500">Abbrechen</button>
              <button type="button" onClick={() => void loeschen()}
                      disabled={busy === "loeschen" || bestaetigung.trim() !== loeschDialog.bestaetigung}
                      className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#b91c1c] disabled:opacity-30"
                      style={{ boxShadow: "0 12px 26px -12px rgba(185,28,28,.55)" }}>
                {busy === "loeschen" ? "Läuft …" : "Endgültig ausführen"}
              </button>
            </div>
          </>
        ) : undefined}
        kinder={loeschDialog ? (
          <>
            {/* Zwei Kategorien, getrennt gezählt. Ein einziger Zähler
                „N Einträge" würde verschleiern, dass mit der Hälfte etwas
                völlig anderes geschieht. */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-3.5 rounded-2xl"
                   style={{ background: "linear-gradient(160deg, rgba(185,28,28,.09), rgba(185,28,28,.03))",
                            boxShadow: "inset 0 0 0 1px rgba(185,28,28,.16)" }}>
                <p className="text-[26px] font-bold leading-none text-[#b91c1c] tabular-nums">
                  {loeschDialog.endgueltig}
                </p>
                <p className="text-[11.5px] font-semibold mt-1 text-[#b91c1c]">endgültig gelöscht</p>
              </div>
              <div className="p-3.5 rounded-2xl"
                   style={{ background: "linear-gradient(160deg, rgba(217,119,6,.09), rgba(217,119,6,.03))",
                            boxShadow: "inset 0 0 0 1px rgba(217,119,6,.16)" }}>
                <p className="text-[26px] font-bold leading-none text-[#b45309] tabular-nums">
                  {loeschDialog.anonymisiert}
                </p>
                <p className="text-[11.5px] font-semibold mt-1 text-[#b45309]">anonymisiert</p>
              </div>
            </div>

            {loeschDialog.hinweise.map((h: string, i: number) => (
              <p key={i} className="text-[12.5px] leading-relaxed text-slate-600 mb-2.5">{h}</p>
            ))}

            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
              Im Einzelnen
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #eef2f7" }}>
              {loeschDialog.kandidaten.slice(0, 40).map((k: LoeschKandidat) => (
                <div key={k.personId} className="px-3.5 py-2.5 text-[12px]"
                     style={{ borderBottom: "1px solid #f8fafc" }}>
                  <span className="font-semibold text-slate-800">{k.name}</span>
                  <span className="ml-2 font-bold" style={{
                    color: k.art === "endgueltig" ? "#b91c1c" : k.art === "anonymisiert" ? "#b45309" : "#94a3b8",
                  }}>
                    {k.art === "endgueltig" ? "endgültig" : k.art === "anonymisiert" ? "anonymisiert" : "übersprungen"}
                  </span>
                  <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{k.begruendung}</span>
                </div>
              ))}
              {loeschDialog.kandidaten.length > 40 && (
                <p className="px-3.5 py-2.5 text-[11.5px] text-slate-400">
                  … und {loeschDialog.kandidaten.length - 40} weitere.
                </p>
              )}
            </div>
          </>
        ) : null}
      />
    </>
  );
}
