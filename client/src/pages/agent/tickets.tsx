// ═══════════════════════════════════════════════════════════════════════════
// /agent/anliegen — Raum „Tickets“ (23.08.2026, Plan §4/§11)
//
// Ersetzt anliegen.tsx (E-019). Ein Anliegen ist ein Datensatz mit Zustand:
// erst die eigenen Kunden, dann der Pool (Kunden ohne Betreuer), dann das,
// was in den letzten 14 Tagen erledigt wurde. Antworten landen beim Kunden
// unter „Hilfe & Anliegen“ und im Verlauf der Akte.
// Endpunkte wie bisher: GET /agent/tickets (alle 90 s neu),
//   POST /agent/tickets/:id/antwort { antwort, erledigt },
//   POST /agent/tickets/:id/uebernehmen. Ereignis `agent-anliegen-geaendert`.
// Anruf: `fiaon-anrufen`. Akte: /agent/kunden?ref=<REF> (Tickets tragen die Ref).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Phone, ExternalLink } from "lucide-react";
import { AgentShell, api, useAgentInfo } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-tickets.css";

interface Anliegen {
  id: number; ref: string; betreff: string; text: string;
  status: "offen" | "beantwortet" | "erledigt"; antwort: string | null;
  created_at: string; updated_at: string; beantwortet_am: string | null;
  agent_id: number | null; kunde: string; email: string | null; telefon: string | null; betreuer: string | null; meins: boolean;
}
const wann = (v: string | null) => v ? new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const alter = (v: string) => { const h = Math.floor((Date.now() - +new Date(v)) / 36e5); return h < 1 ? "gerade eben" : h < 24 ? `vor ${h} Std.` : `vor ${Math.floor(h / 24)} Tg.`; };
const anrufen = (nummer: string | null, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer: nummer.replace(/\s/g, ""), personId: null, name } })); };
const geaendert = () => window.dispatchEvent(new Event("agent-anliegen-geaendert"));

export default function AgentTicketsPage() { return <AgentShell><TicketsInnen /></AgentShell>; }

function TicketsInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tickets"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { agent } = useAgentInfo();
  const [liste, setListe] = useState<Anliegen[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [reiter, setReiter] = useState<"meine" | "pool" | "erledigt">("meine");
  const [offenId, setOffenId] = useState<number | null>(null);
  const [antwort, setAntwort] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; warn?: boolean } | null>(null);
  const flash = (text: string, warn = false) => { setMeldung({ text, warn }); setTimeout(() => setMeldung(null), 4500); };

  const laden = useCallback(() => {
    api("/agent/tickets").then((r) => { if (r.ok) { setListe(r.json.tickets || []); setFehler(null); } else setFehler(r.json?.error || "Die Anliegen konnten nicht geladen werden."); }).catch(() => setFehler("Keine Verbindung.")).finally(() => setLaedt(false));
  }, []);
  useEffect(() => { laden(); const iv = setInterval(laden, 90_000); return () => clearInterval(iv); }, [laden]);

  const meine = useMemo(() => liste.filter((a) => a.status !== "erledigt" && a.agent_id != null), [liste]);
  const pool = useMemo(() => liste.filter((a) => a.status !== "erledigt" && a.agent_id == null), [liste]);
  const erledigt = useMemo(() => liste.filter((a) => a.status === "erledigt"), [liste]);
  const sichtbar = reiter === "meine" ? meine : reiter === "pool" ? pool : erledigt;
  const offenGesamt = liste.filter((a) => a.status === "offen").length;
  const alt24 = (a: Anliegen) => a.status === "offen" && Date.now() - +new Date(a.created_at) > 864e5;
  const aelterAls24h = liste.filter(alt24).length;

  const senden = async (a: Anliegen, erledigen: boolean, text = antwort) => {
    if (text.trim().length < 2) return;
    setBusy(a.id);
    const r = await api(`/agent/tickets/${a.id}/antwort`, { method: "POST", body: JSON.stringify({ antwort: text.trim(), erledigt: erledigen }) });
    setBusy(null);
    if (r.ok) { flash(erledigen ? "Beantwortet und erledigt." : "Antwort gespeichert – das Anliegen bleibt offen."); setAntwort(""); setOffenId(null); laden(); geaendert(); }
    else flash(r.json?.error || "Das hat nicht geklappt.", true);
  };
  const uebernehmen = async (a: Anliegen) => {
    setBusy(a.id);
    const r = await api(`/agent/tickets/${a.id}/uebernehmen`, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash(`Übernommen – ${a.kunde || a.ref} liegt jetzt bei dir.`); setReiter("meine"); laden(); geaendert(); }
    else flash(r.json?.error || "Konnte nicht übernommen werden.", true);
  };

  return (
    <div className="ti">
      <section className="ti-kopf">
        <div>
          <span className="ti-pille">Tickets</span>
          <h1>{offenGesamt === 0 ? <>Alles beantwortet – <span className="ti-verlauf">nichts offen.</span></> : aelterAls24h > 0 ? <><span className="ti-verlauf">{aelterAls24h} {aelterAls24h === 1 ? "wartet" : "warten"}</span> schon länger als einen Tag.</> : <><span className="ti-verlauf">{offenGesamt} {offenGesamt === 1 ? "Anliegen" : "Anliegen"}</span> offen.</>}</h1>
          <p>Was Kunden über „Hilfe &amp; Anliegen“ schreiben. Deine Antwort sehen sie in ihrem Bereich – und sie steht im Verlauf der Akte, damit der nächste Kollege sie findet.</p>
        </div>
        <div className="ti-lage">
          <small>Lage</small>
          <div className="ti-lage-zahl"><b>{offenGesamt}</b><span>offen</span></div>
          <div className="ti-lage-zeile"><span>Im Pool (ohne Betreuer)</span><b className={pool.length ? "warn" : ""}>{pool.length}</b></div>
          <div className="ti-lage-zeile"><span>Älter als 24 h</span><b className={aelterAls24h ? "rot" : ""}>{aelterAls24h}</b></div>
        </div>
      </section>

      {fehler && <p className="ti-fehler">{fehler}</p>}
      {meldung && <p className={meldung.warn ? "ti-fehler" : "ti-meldung"}>{meldung.text}</p>}

      <div className="ti-reiter" role="tablist">
        <button type="button" role="tab" aria-selected={reiter === "meine"} className={reiter === "meine" ? "an" : ""} onClick={() => setReiter("meine")}>Zugeteilt {meine.length > 0 && <em>{meine.length}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "pool"} className={reiter === "pool" ? "an" : ""} onClick={() => setReiter("pool")}>Pool {pool.length > 0 && <em>{pool.length}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "erledigt"} className={reiter === "erledigt" ? "an" : ""} onClick={() => setReiter("erledigt")}>Erledigt</button>
      </div>

      {laedt && liste.length === 0 && <p className="ti-lade">Lade …</p>}
      {!laedt && sichtbar.length === 0 && (
        <div className="ti-leer">
          <b>{reiter === "meine" ? "Nichts offen." : reiter === "pool" ? "Der Pool ist leer." : "Noch nichts erledigt."}</b>
          <span>{reiter === "meine" ? "Sobald ein Kunde von dir schreibt, steht es hier." : reiter === "pool" ? "Anliegen von Kunden ohne Betreuer landen hier – wer antwortet, übernimmt sie." : "Erledigte Anliegen der letzten 14 Tage sammeln sich hier."}</span>
        </div>
      )}

      <div className="ti-liste">
        {sichtbar.map((a) => {
          const stufe = a.status === "erledigt" ? "erledigt" : a.agent_id == null ? "pool" : alt24(a) ? "alt" : "offen";
          const offenHier = offenId === a.id;
          const marke = a.agent_id == null && a.status !== "erledigt" ? "pool" : a.status;
          return (
            <div key={a.id} className={`ti-karte ${stufe}`}>
              <div className="ti-karte-kopf">
                <div style={{ minWidth: 0 }}>
                  <h3>{a.betreff}</h3>
                  <div className="ti-meta">
                    <b>{a.kunde || a.ref}</b>
                    {a.telefon && <button type="button" onClick={() => anrufen(a.telefon, a.kunde || a.ref)}><Phone size={12} strokeWidth={1.75} /> {a.telefon}</button>}
                    <span>{alter(a.created_at)}</span>
                    {a.betreuer && !a.meins && <span>bei <b>{a.betreuer}</b></span>}
                    <Link href={`/agent/kunden?ref=${encodeURIComponent(a.ref)}`}><ExternalLink size={12} strokeWidth={1.75} /> Akte</Link>
                  </div>
                </div>
                <span className={`ti-lage-marke ${marke}`}>{a.status === "erledigt" ? "Erledigt" : a.agent_id == null ? "Pool" : a.status === "beantwortet" ? "Beantwortet" : "Offen"}</span>
              </div>
              <p className="ti-text">{a.text}</p>
              {a.antwort && <div className="ti-antwort"><small>Antwort{a.beantwortet_am ? ` · ${wann(a.beantwortet_am)}` : ""}</small><p>{a.antwort}</p></div>}
              {a.status !== "erledigt" && (
                a.agent_id == null && !offenHier ? (
                  <div className="ti-knoepfe"><button type="button" className="ti-knopf haupt" disabled={busy === a.id} onClick={() => void uebernehmen(a)}>{busy === a.id ? "…" : "Übernehmen"}</button></div>
                ) : !offenHier ? (
                  <div className="ti-knoepfe">
                    <button type="button" className="ti-knopf haupt" onClick={() => { setOffenId(a.id); setAntwort(""); }}>{a.antwort ? "Erneut antworten" : "Antworten"}</button>
                    {a.antwort && <button type="button" className="ti-knopf" disabled={busy === a.id} onClick={() => void senden(a, true, a.antwort || "")}>Erledigt</button>}
                  </div>
                ) : (
                  <div className="ti-form">
                    <textarea className="ti-feld" value={antwort} onChange={(e) => setAntwort(e.target.value)} placeholder={`Antwort an ${a.kunde || "den Kunden"} – kurz, konkret, in Sie-Form.`} autoFocus aria-label="Antwort" />
                    <div className="ti-knoepfe" style={{ marginTop: 0 }}>
                      <button type="button" className="ti-knopf haupt" disabled={busy === a.id || antwort.trim().length < 2} onClick={() => void senden(a, true)}>Antworten &amp; erledigen</button>
                      <button type="button" className="ti-knopf" disabled={busy === a.id || antwort.trim().length < 2} onClick={() => void senden(a, false)}>Antworten, offen lassen</button>
                      <button type="button" className="ti-knopf" onClick={() => { setOffenId(null); setAntwort(""); }}>Abbrechen</button>
                    </div>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
      {agent && <p className="ti-fuss">Angemeldet als {agent.name}. Der Pool zeigt Kunden ohne Betreuer – Leitung und Admin sehen alle Anliegen. Die Liste holt sich alle 90 Sekunden den neuen Stand.</p>}
    </div>
  );
}
