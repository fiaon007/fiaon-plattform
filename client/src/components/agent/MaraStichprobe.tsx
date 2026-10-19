// ═══════════════════════════════════════════════════════════════════════════
// SCHULUNG › MARA-STICHPROBE (E-406 B3, 19.10.2026)
//
// Justin, Vorschlag 3: „Die Stichprobe macht ein Mensch: 10 Minuten pro Woche, 20 Fälle. Vorschlag: Diana als
// Trainerin (E-161).“ Keine neue Seite — ein Abschnitt der Schulungs-Seite (/agent/schulung), für Trainerin und
// Vertriebsleitung. GET /agent/schulung/mara-stichprobe (zieht die Woche beim ersten Öffnen selbst),
// POST /agent/schulung/mara-stichprobe/:id { urteil: "ok" | "nicht_ok", grund }.
//   · 20 Dinge, die Mara letzte Woche getan hat — je eins: was der Kunde schrieb, was Mara tat.
//   · ok oder nicht ok; bei „nicht ok“ ein kurzer Grund (was war falsch?). Ändern geht.
//   · Darunter die Fehlerquote je Werkzeug (letzte 4 Wochen). Sie steht auch in der Ampel im Mara-Steuerpult.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { akteLink } from "@/lib/akte-link";

const HELL = "#0F172A";
const LEISE = "#475569";
const LEISER = "#64748B";
const AKZENT = "#1D4ED8";
const GUT = "#15803D";
const ROT = "#B91C1C";

interface Fall {
  id: number; woche: string; werkzeug: string; werkzeugText: string; art: string; artText: string;
  personId: number | null; name: string | null; kanal: string | null; am: string | null; titel: string | null;
  kundeText: string | null; maraText: string | null;
  urteil: "ok" | "nicht_ok" | null; grund: string | null; bewertetVon: string | null; bewertetAm: string | null;
}
interface Quote { werkzeug: string; n: number; nichtOk: number; quote: number | null }
interface Daten { woche: string; faelle: Fall[]; quoten: Quote[]; werkzeuge: { key: string; label: string }[] }

const tag = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
/** Die Stichprobe der Woche (Montag `woche`) zieht aus Maras VORWOCHE: Montag bis Sonntag davor. */
const vorwoche = (woche: string) => {
  const t = (n: number) => new Date(Date.parse(`${woche}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  return `${tag(t(-7))}–${tag(t(-1))}`;
};
const wann = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const prozent = (q: number | null) => (q == null ? "—" : `${(q * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`);

function FallKarte({ f, onGespeichert }: { f: Fall; onGespeichert: (neu: Fall) => void }) {
  const [urteil, setUrteil] = useState<"ok" | "nicht_ok" | null>(f.urteil);
  const [grund, setGrund] = useState(f.grund ?? "");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const akte = f.personId ? akteLink(f.personId) : null;
  const speichern = async (u: "ok" | "nicht_ok") => {
    setUrteil(u);
    if (u === "nicht_ok" && grund.trim().length < 5) { setFehler("Bitte kurz den Grund schreiben (was war falsch?) — dann „Speichern“."); return; }
    setBusy(true); setFehler(null);
    try {
      const r = await fetch(`/api/fiaon/agent/schulung/mara-stichprobe/${f.id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urteil: u, grund }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) onGespeichert(j.fall); else setFehler(j?.error || "Nicht gespeichert.");
    } finally { setBusy(false); }
  };
  const knopf = (aktiv: boolean, farbe: string): CSSProperties => ({
    minHeight: 36, padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer",
    border: `1px solid ${aktiv ? farbe : "#CBD5E1"}`, background: aktiv ? farbe : "#fff", color: aktiv ? "#fff" : HELL,
  });
  return (
    <article data-fiaon="stichprobe-fall" style={{ background: "#fff", border: `1px solid ${f.urteil === "nicht_ok" ? "#FCA5A5" : f.urteil === "ok" ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: 12, padding: "12px 14px" }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
        <b style={{ color: HELL, fontSize: 14 }}>{f.werkzeugText}</b>
        <span style={{ color: LEISER, fontSize: 12 }}>{f.artText}{f.kanal ? ` · ${f.kanal === "whatsapp" ? "WhatsApp" : f.kanal === "mail" ? "Mail" : f.kanal}` : ""} · {wann(f.am)}</span>
        <span style={{ flex: 1 }} />
        {akte ? <a href={akte} target="_blank" rel="noreferrer" style={{ color: AKZENT, fontSize: 12.5 }}>{f.name || `Person ${f.personId}`}</a> : null}
      </header>
      {f.titel ? <p style={{ color: LEISE, fontSize: 12.5, margin: "6px 0 0" }}>{f.titel}</p> : null}
      {f.kundeText ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: LEISER, fontSize: 11.5, fontWeight: 700 }}>Kunde schrieb</div>
          <p style={{ color: HELL, fontSize: 13, margin: "2px 0 0", whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>{f.kundeText}</p>
        </div>
      ) : null}
      {f.maraText ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: LEISER, fontSize: 11.5, fontWeight: 700 }}>Mara</div>
          <p style={{ color: HELL, fontSize: 13, margin: "2px 0 0", whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", background: "#F1F5F9", borderRadius: 8, padding: "8px 10px" }}>{f.maraText}</p>
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
        <button type="button" disabled={busy} style={knopf(urteil === "ok", GUT)} onClick={() => void speichern("ok")}>ok</button>
        <button type="button" disabled={busy} style={knopf(urteil === "nicht_ok", ROT)} onClick={() => setUrteil("nicht_ok")}>nicht ok</button>
        {f.bewertetVon ? <span style={{ color: LEISER, fontSize: 12 }}>bewertet von {f.bewertetVon}</span> : null}
      </div>
      {(urteil === "nicht_ok" || f.grund) && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input value={grund} onChange={(e) => setGrund(e.target.value)} maxLength={600} placeholder={urteil === "nicht_ok" ? "Was war falsch? (Pflicht)" : "Grund (freiwillig)"}
            style={{ flex: "1 1 260px", minHeight: 36, borderRadius: 10, border: "1px solid #CBD5E1", padding: "6px 10px", fontSize: 13 }} />
          <button type="button" disabled={busy || !urteil} style={knopf(false, AKZENT)} onClick={() => urteil && void speichern(urteil)}>Speichern</button>
        </div>
      )}
      {fehler ? <p style={{ color: ROT, fontSize: 12.5, margin: "6px 0 0" }}>{fehler}</p> : null}
    </article>
  );
}

export function MaraStichprobe() {
  const [d, setD] = useState<Daten | null>(null);
  const [kein, setKein] = useState(false);
  const laden = useCallback(() => {
    fetch("/api/fiaon/agent/schulung/mara-stichprobe", { credentials: "include" })
      .then(async (r) => { const j = await r.json().catch(() => null); if (j?.ok) setD(j); else setKein(true); })
      .catch(() => setKein(true));
  }, []);
  useEffect(() => { laden(); }, [laden]);
  if (kein || !d) return null;
  const bewertet = d.faelle.filter((f) => f.urteil).length;
  const label = Object.fromEntries(d.werkzeuge.map((w) => [w.key, w.label]));
  const ersetzen = (neu: Fall) => setD((alt) => (alt ? { ...alt, faelle: alt.faelle.map((f) => (f.id === neu.id ? neu : f)) } : alt));
  return (
    <section id="mara-stichprobe" data-fiaon="mara-stichprobe" style={{ marginTop: 26 }}>
      <h2 style={{ color: HELL, fontSize: 17, margin: "0 0 6px" }}>Mara-Stichprobe</h2>
      <p style={{ color: LEISE, fontSize: 13.5, margin: "0 0 10px" }}>
        20 Dinge, die Mara letzte Woche getan hat. Du sagst: ok oder nicht ok — bei „nicht ok“ mit Grund.
      </p>
      <p data-fiaon="stichprobe-stand" style={{ color: bewertet === d.faelle.length && d.faelle.length ? GUT : AKZENT, fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>
        Maras Woche {vorwoche(d.woche)} · {bewertet} von {d.faelle.length} bewertet
      </p>
      {d.faelle.length === 0 ? <p style={{ color: LEISER, fontSize: 13 }}>Diese Woche gibt es noch nichts zu bewerten.</p> : (
        <div style={{ display: "grid", gap: 10 }}>
          {d.faelle.map((f) => <FallKarte key={f.id} f={f} onGespeichert={ersetzen} />)}
        </div>
      )}
      {d.quoten.length > 0 && (
        <div data-fiaon="stichprobe-quoten" style={{ marginTop: 16 }}>
          <h3 style={{ color: HELL, fontSize: 14, margin: "0 0 6px" }}>Fehlerquote je Werkzeug (letzte 8 Wochen)</h3>
          <div style={{ display: "grid", gap: 4 }}>
            {d.quoten.map((q) => (
              <div key={q.werkzeug} style={{ display: "flex", gap: 10, fontSize: 13, color: HELL }}>
                <span style={{ flex: 1 }}>{label[q.werkzeug] ?? q.werkzeug}</span>
                <span style={{ color: LEISER }}>{q.nichtOk} von {q.n} nicht ok</span>
                <b style={{ minWidth: 64, textAlign: "right", color: (q.quote ?? 0) >= 0.02 ? ROT : GUT }}>{prozent(q.quote)}</b>
              </div>
            ))}
          </div>
          <p style={{ color: LEISER, fontSize: 12, margin: "6px 0 0" }}>Unter 2 % in 4 Wochen hintereinander: Justin bekommt den Vorschlag, Mara dort mehr zu erlauben.</p>
        </div>
      )}
    </section>
  );
}
