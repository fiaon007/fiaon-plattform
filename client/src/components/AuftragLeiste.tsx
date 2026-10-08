// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFTRAG-LEISTE IN DER AKTE (E-IT-F, 08.10.2026, Punkt 7)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Gearbeitet wird in der Akte, nicht in der Liste. VORHER führte „Kunde
// öffnen" per vollem Seitenwechsel aus der App (ein laufendes Gespräch brach
// ab, E-169), in der Akte wusste niemand mehr, um welchen Auftrag es ging,
// und beim Zurückkommen stand derselbe Auftrag wieder ganz oben — weil ihn
// niemand geschlossen hatte. „Die gerade erledigte Aufgabe wird weiter als
// nächste angezeigt."
//
// ── WAS DIE LEISTE TUT ─────────────────────────────────────────────────────
// Steht in der Adresse „?auftrag=<id>" (Liste → „Akte", Popup → „Öffnen"),
// zeigt sich unten eine schmale Leiste: Art · Kunde · Eingang · Status, dazu
//   „Erledigt"          schließt den Auftrag (dieselbe Route wie die Liste;
//                       ein Pflichtsatz öffnet ein Feld in der Leiste),
//   „Nächster Auftrag"  der nächste WIRKLICH offene Auftrag — dieselbe
//                       Reihenfolge wie die Liste (shared/fiaon-auftrag-arten.ts),
//                       per App-Navigation in dessen Akte,
//   „Liste"             zurück in Tasks → Aufträge.
// Sie fragt alle 30 s und nach jeder Änderung nach: Erledigt ein Ergebnis in
// der Akte den Auftrag automatisch, steht hier „Automatisch erledigt durch …"
// und der Weg zum nächsten. Kein vollständiger Seitenwechsel, kein Fokusraub.
//
// Gebaut ohne Eingriff in pipeline.tsx: Die Akte öffnet sich über das Ereignis
// „fiaon-akte-oeffnen" (dieselbe Tür wie aus dem Telefon und dem Popup).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { auftragStatus, eingangText, type AuftragRichtung } from "@shared/fiaon-auftrag-arten";
import "@/styles/office-auftrag-leiste.css";

interface LeistenAuftrag {
  id: number; titel: string; status: string; personId: number | null; ref: string | null;
  kundeAnzeige?: string; kunde?: string | null; artLabel?: string; eingangAm?: string | null; createdAt?: string | null;
  frageAnAgent?: boolean; frageOffen?: boolean; ergebnisPflicht?: boolean; erledigtArt?: string | null; erledigtVon?: string | null;
  erledigtEreignis?: string | null; wiederOffenAm?: string | null; wiederOffenGrund?: string | null; ungelesen?: boolean; weitereZumKunden?: number;
}
interface Naechster { id: number; personId: number | null; ref: string | null; kunde: string; artLabel: string }

const TAKT_MS = 30_000;

async function holen(pfad: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
    const json = await r.json().catch(() => null);
    return { ok: r.ok && json?.ok !== false, status: r.status, json };
  } catch { return { ok: false, status: 0, json: null }; }
}

function richtungLesen(): AuftragRichtung {
  try { return window.localStorage.getItem("fiaon-auftraege-richtung") === "neu" ? "neu" : "alt"; } catch { return "alt"; }
}

/** Die Kennung aus „?auftrag=<id>" — nur in der Akte (Kunden/Pipeline), nicht in Tasks selbst. */
export function auftragAusAdresse(pfad: string, suche: string): number | null {
  if (!/^\/agent\/(kunden|pipeline)\/?$/.test(pfad)) return null;
  const n = Number(new URLSearchParams(suche).get("auftrag"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function AuftragLeiste() {
  const [pfad, navigiere] = useLocation();
  const suche = useSearch();
  const id = auftragAusAdresse(pfad, suche);
  const [a, setA] = useState<LeistenAuftrag | null>(null);
  const [naechster, setNaechster] = useState<Naechster | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pflicht, setPflicht] = useState(false);
  const [satz, setSatz] = useState("");
  const [zu, setZu] = useState<number | null>(null);

  const laden = useCallback(async (immer = false) => {
    // Nachfragen nur im sichtbaren Tab — der erste Stand kommt immer (auch im Hintergrund geöffnet).
    if (!id || (!immer && document.hidden)) return;
    const r = await holen(`/agent/auftraege/${id}`);
    if (r.ok && r.json?.todo) { setA(r.json.todo); return; }
    if (r.status === 404) { setA(null); setMeldung(r.json?.error || "Dieser Auftrag liegt nicht bei dir."); }
  }, [id]);

  useEffect(() => {
    setA(null); setNaechster(undefined); setMeldung(null); setPflicht(false); setSatz("");
    if (!id) return;
    void laden(true);
    const uhr = window.setInterval(() => void laden(), TAKT_MS);
    const beiAenderung = () => void laden();
    const zurueck = () => { if (!document.hidden) void laden(); };
    // Gearbeitet wird in der Akte: Nach einem Klick dort (Ergebnis speichern, WhatsApp senden,
    // Unterlage anfordern) kurz danach nachsehen — so steht „Automatisch erledigt durch …" sofort
    // da, ohne dass die Akte etwas von der Leiste wissen muss. Höchstens alle 4 s.
    let zuletzt = 0; let warte: number | null = null;
    const nachKlick = () => {
      if (warte !== null || Date.now() - zuletzt < 4000) return;
      warte = window.setTimeout(() => { warte = null; zuletzt = Date.now(); void laden(); }, 1500);
    };
    window.addEventListener("agent-aufgaben-geaendert", beiAenderung);
    window.addEventListener("fiaon-ergebnis", beiAenderung);
    document.addEventListener("visibilitychange", zurueck);
    document.addEventListener("click", nachKlick, true);
    return () => {
      window.clearInterval(uhr);
      if (warte !== null) window.clearTimeout(warte);
      window.removeEventListener("agent-aufgaben-geaendert", beiAenderung);
      window.removeEventListener("fiaon-ergebnis", beiAenderung);
      document.removeEventListener("visibilitychange", zurueck);
      document.removeEventListener("click", nachKlick, true);
    };
  }, [id, laden]);

  const schliessen = () => {
    setZu(id);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("auftrag");
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}`);
    } catch { /* nur ausblenden */ }
  };

  const zumNaechsten = async () => {
    if (!id) return;
    setBusy(true);
    let n = naechster;
    if (n === undefined) {
      const r = await holen(`/agent/auftraege/naechster?nach=${id}&richtung=${richtungLesen()}`);
      n = r.ok ? (r.json?.naechster ?? null) : null;
    }
    setBusy(false);
    if (!n) { setNaechster(null); setMeldung("Keine offenen Aufträge mehr — gut gemacht."); return; }
    if (n.personId) {
      navigiere(`/agent/kunden?person=${n.personId}&auftrag=${n.id}`);
      // Steht die Pipeline schon offen, liest sie ?person= nicht neu — dieselbe Tür wie aus dem Telefon.
      const personId = n.personId;
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("fiaon-akte-oeffnen", { detail: { personId } })), 0);
    } else {
      navigiere(`/agent/aufgaben?reiter=auftraege&auftrag=${n.id}`);
    }
  };

  const erledigen = async () => {
    if (!a) return;
    if (a.ergebnisPflicht && satz.trim().length < 5) { setPflicht(true); return; }
    setBusy(true); setMeldung(null);
    const r = await holen(`/agent/auftraege/${a.id}/erledigt`, { method: "POST", body: JSON.stringify({ ergebnis: satz.trim(), richtung: richtungLesen() }) });
    setBusy(false);
    if (!r.ok) {
      if (r.json?.code === "ERGEBNIS_PFLICHT") setPflicht(true);
      setMeldung(r.json?.error || "Das hat nicht geklappt.");
      return;
    }
    if (r.json?.todo) setA(r.json.todo);
    setNaechster(r.json?.naechster ?? null);
    setPflicht(false); setSatz("");
    window.dispatchEvent(new Event("agent-aufgaben-geaendert"));
  };

  if (!id || zu === id) return null;
  if (!a) {
    return meldung ? (
      <aside className="fi-al" role="status" aria-label="Auftrag">
        <div className="fi-al-zeile"><span className="fi-al-text">{meldung}</span>
          <div className="fi-al-knoepfe"><Link href="/agent/aufgaben?reiter=auftraege" className="fi-al-knopf still">Liste</Link>
            <button type="button" className="fi-al-zu" onClick={schliessen} aria-label="Leiste schließen">×</button></div></div>
      </aside>
    ) : null;
  }
  // Gegenprüfung 08.10. (Fund 15): Die Pipeline setzt beim Kundenwechsel nur ?person= neu, ?auftrag= bleibt stehen.
  // Gehört der Auftrag zu einem ANDEREN Kunden als der offenen Akte, keine Leiste — „Erledigt“ träfe sonst den Falschen.
  const personInAdresse = Number(new URLSearchParams(suche).get("person")) || null;
  if (personInAdresse && a.personId && personInAdresse !== a.personId) return null;
  const st = auftragStatus(a);
  const fertig = a.status === "erledigt";
  return (
    <aside className="fi-al" data-fertig={fertig ? "1" : undefined} role="region" aria-label="Offener Auftrag zu diesem Kunden">
      <div className="fi-al-zeile">
        <div className="fi-al-text">
          <span className="fi-al-pille">{fertig ? st.text : "Auftrag"}</span>
          <b>{a.artLabel || a.titel}</b>
          <span className="fi-al-trenn">·</span><span>{a.kundeAnzeige || a.kunde || "ohne Kundenbezug"}</span>
          <span className="fi-al-trenn">·</span><span className="fi-al-zeit">{eingangText(a.eingangAm ?? a.createdAt ?? null)}</span>
          {!fertig && <><span className="fi-al-trenn">·</span><span>{st.text}</span></>}
          {fertig && st.grund && <span className="fi-al-grund">{a.erledigtArt === "auto" ? `durch ${st.grund}` : st.grund}</span>}
          {!fertig && (a.weitereZumKunden ?? 0) > 0 && <span className="fi-al-grund">{a.weitereZumKunden} weitere zu diesem Kunden</span>}
        </div>
        <div className="fi-al-knoepfe">
          {!fertig && !a.frageOffen && a.status !== "wartet" && (
            <button type="button" className="fi-al-knopf gut" disabled={busy} onClick={() => void erledigen()}>{busy ? "…" : "Erledigt"}</button>
          )}
          <button type="button" className={`fi-al-knopf${fertig ? " haupt" : ""}`} disabled={busy} onClick={() => void zumNaechsten()}>Nächster Auftrag →</button>
          <Link href={`/agent/aufgaben?reiter=auftraege&auftrag=${a.id}`} className="fi-al-knopf still">Liste</Link>
          <button type="button" className="fi-al-zu" onClick={schliessen} aria-label="Leiste schließen">×</button>
        </div>
      </div>
      {pflicht && !fertig && (
        <div className="fi-al-pflicht">
          <label htmlFor="fi-al-satz">{a.frageAnAgent || a.frageOffen ? "Zu diesem Auftrag gab es eine Frage — wie ist sie ausgegangen?" : "Ein Satz, was geklärt oder veranlasst ist:"}</label>
          <div className="fi-al-pflicht-reihe">
            <input id="fi-al-satz" className="fi-al-feld" value={satz} onChange={(e) => setSatz(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && satz.trim().length >= 5) void erledigen(); }} placeholder="Das Ergebnis …" />
            <button type="button" className="fi-al-knopf gut" disabled={busy || satz.trim().length < 5} onClick={() => void erledigen()}>Melden</button>
          </div>
        </div>
      )}
      {meldung && <p className="fi-al-meldung" role="status">{meldung}</p>}
    </aside>
  );
}
