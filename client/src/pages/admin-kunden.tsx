import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { statusAusTierGrund, stufeAusTier } from "@shared/fiaon-kundenstatus";

// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN-ZENTRALE — eine Seite statt sechs
//
// Bis zum 09.08.2026 sprang der Betreiber zwischen „Kunden — die eine Liste",
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

const SPEZIAL: { schluessel: string; titel: string; zahl: string }[] = [
  { schluessel: "ohneAgent", titel: "Ohne Agent", zahl: "ohne_agent" },
  { schluessel: "ohneTelefon", titel: "Ohne Telefon", zahl: "ohne_telefon" },
  { schluessel: "zahlungUnbestaetigt", titel: "Zahlung >7 Tage offen", zahl: "zahlung_unbestaetigt" },
  { schluessel: "kycOffen", titel: "KYC zu prüfen", zahl: "kyc_offen" },
  { schluessel: "kuendigungen", titel: "Kündigungen", zahl: "kuendigungen" },
  { schluessel: "dubletten", titel: "Dubletten-Verdacht", zahl: "" },
  { schluessel: "anonyme", titel: "Anonyme Abbrecher", zahl: "anonyme" },
  { schluessel: "ruhend", titel: "Ruhend", zahl: "ruhend" },
  { schluessel: "tests", titel: "Testeinträge", zahl: "tests" },
];

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
  const params = useMemo(() => new URLSearchParams(window.location.search), [
    typeof window !== "undefined" ? window.location.search : "",
  ]);
  const [suchtext, setSuchtext] = useState(params.get("q") ?? "");

  const setzeFilter = useCallback((aenderungen: Record<string, string | null>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(aenderungen)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    // Jede Filteränderung springt auf Seite eins — sonst steht man auf Seite 7
    // einer Liste, die nur noch drei Seiten hat, und sieht nichts.
    if (!("offset" in aenderungen)) p.delete("offset");
    navigate(`/admin/kunden${p.toString() ? `?${p}` : ""}`, { replace: true });
  }, [navigate]);

  const laden = useCallback(async () => {
    setLaedt(true);
    const p = new URLSearchParams(window.location.search);
    const r = await fetch(`/api/fiaon/admin/zentrale/kunden?${p}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setDaten(j);
    setLaedt(false);
  }, []);

  useEffect(() => { void laden(); }, [laden, params.toString()]);
  // Auswahl fällt weg, wenn sich die Treffermenge ändert — sonst löscht man
  // Zeilen, die man gar nicht mehr sieht.
  useEffect(() => { setGewaehlt(new Set()); setAlleTreffer(null); }, [params.toString()]);

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

        {/* ── Spezialfilter ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SPEZIAL.map((f) => {
            const an = anKnopf(f.schluessel);
            const n = f.zahl ? zahlen[f.zahl] : null;
            return (
              <button key={f.schluessel} type="button"
                      onClick={() => setzeFilter({ [f.schluessel]: an ? null : "1" })}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={an
                        ? { background: "rgba(29,78,216,.1)", color: "#1d4ed8" }
                        : { background: "#f8fafc", color: "#64748b" }}>
                {f.titel}{n != null && <span className="ml-1 tabular-nums opacity-70">{n}</span>}
              </button>
            );
          })}
          {daten?.agenten?.length > 0 && (
            <select value={params.get("agent") ?? ""}
                    onChange={(e) => setzeFilter({ agent: e.target.value || null })}
                    className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-50 text-slate-600 border-0">
              <option value="">Alle Zuständigen</option>
              {daten.agenten.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
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
                        const r = await fetch(`/api/fiaon/admin/zentrale/kunden/alle-ids?${params}`, { credentials: "include" });
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
            <span>Zuständig</span><span>Referenz</span><span>Kontakt</span>
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

      {/* ── Lösch-Dialog ──────────────────────────────────────────────── */}
      {loeschDialog && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setLoeschDialog(null)} aria-hidden="true"
               style={{ background: "rgba(7,11,22,.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
          <div className="fixed inset-0 z-[401] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
            <div role="dialog" aria-modal="true" aria-labelledby="loesch-titel"
                 className="w-full flex flex-col overflow-hidden pointer-events-auto"
                 style={{ maxWidth: 580, maxHeight: "90vh", background: "#fff", borderRadius: 22,
                          boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)" }}>
              <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[.2em] text-slate-400">
                  Bitte genau lesen
                </p>
                <h2 id="loesch-titel" className="mt-1 text-[20px] font-bold tracking-tight text-slate-900">
                  Was mit dieser Auswahl passiert
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
                {/* Zwei Kategorien, getrennt gezählt. Ein einziger Zähler
                    „N Einträge" würde verschleiern, dass mit der Hälfte etwas
                    völlig anderes geschieht. */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="p-3 rounded-xl" style={{ background: "rgba(185,28,28,.06)" }}>
                    <p className="text-[24px] font-bold leading-none text-[#b91c1c] tabular-nums">
                      {loeschDialog.endgueltig}
                    </p>
                    <p className="text-[11.5px] font-semibold mt-1 text-[#b91c1c]">endgültig gelöscht</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: "rgba(217,119,6,.06)" }}>
                    <p className="text-[24px] font-bold leading-none text-[#b45309] tabular-nums">
                      {loeschDialog.anonymisiert}
                    </p>
                    <p className="text-[11.5px] font-semibold mt-1 text-[#b45309]">anonymisiert</p>
                  </div>
                </div>

                {loeschDialog.hinweise.map((h: string, i: number) => (
                  <p key={i} className="text-[12.5px] leading-relaxed text-slate-600 mb-2.5">{h}</p>
                ))}

                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1.5">
                  Im Einzelnen
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                  {loeschDialog.kandidaten.slice(0, 40).map((k: LoeschKandidat) => (
                    <div key={k.personId} className="px-3 py-2 text-[12px]" style={{ borderBottom: "1px solid #f8fafc" }}>
                      <span className="font-semibold text-slate-800">{k.name}</span>
                      <span className="ml-2 font-bold" style={{
                        color: k.art === "endgueltig" ? "#b91c1c" : k.art === "anonymisiert" ? "#b45309" : "#94a3b8",
                      }}>
                        {k.art === "endgueltig" ? "endgültig" : k.art === "anonymisiert" ? "anonymisiert" : "übersprungen"}
                      </span>
                      <span className="block text-[11px] text-slate-400 leading-snug">{k.begruendung}</span>
                    </div>
                  ))}
                  {loeschDialog.kandidaten.length > 40 && (
                    <p className="px-3 py-2 text-[11.5px] text-slate-400">
                      … und {loeschDialog.kandidaten.length - 40} weitere.
                    </p>
                  )}
                </div>
              </div>

              <div className="px-5 sm:px-7 py-4 shrink-0" style={{ borderTop: "1px solid #f1f5f9" }}>
                {/* Ein Kontrollkästchen klickt man weg, ohne es zu lesen. Einen
                    Satz mit einer Zahl darin tippt man nicht versehentlich. */}
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                  Zur Bestätigung eintippen: <span className="font-mono text-slate-900">{loeschDialog.bestaetigung}</span>
                </label>
                <input value={bestaetigung} onChange={(e) => setBestaetigung(e.target.value)}
                       className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#b91c1c]"
                       style={{ minHeight: 42 }} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setLoeschDialog(null)}
                          className="text-[13px] font-semibold text-slate-500">Abbrechen</button>
                  <button type="button" onClick={() => void loeschen()}
                          disabled={busy === "loeschen" || bestaetigung.trim() !== loeschDialog.bestaetigung}
                          className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#b91c1c] disabled:opacity-30">
                    {busy === "loeschen" ? "Läuft …" : "Endgültig ausführen"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
