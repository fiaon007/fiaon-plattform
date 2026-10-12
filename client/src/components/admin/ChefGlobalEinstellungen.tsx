// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL — Gespräche je Tag und Justins Google-Kalender (E-342)
//
// Justin, 12.10.2026: „auf 8 erhöhen, vielleicht sogar auf 12 — und die
// Termine müssen sich immer in meinen Kalender synchronisieren."
// Eine Leiste im Arbeitsraum: der Tagesdeckel (eine Einstellung für /business
// und das Startgespräch), wer die Website-Gespräche führt, und ob die Termine
// direkt in Google stehen (fiaon-google-kalender.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarClock, Copy, RefreshCw, UserRound } from "lucide-react";

interface GoogleStand {
  freigabe: "ok" | "fehlt" | "fehler" | "aus" | "kein_konto";
  clientId: string | null; bereiche: string;
  konten: { id: number; name: string; email: string }[];
  eingetragen: number; zuletztOk: string | null; fehler: string | null; an: boolean;
}
interface Stand { proTag: number; proTagVorgabe: number; zustaendig: { id: number; name: string } | null; google: GoogleStand }

const STUFEN = [4, 6, 8, 10, 12];

async function json(url: string, body?: unknown): Promise<any> {
  const r = await fetch(url, body === undefined ? { credentials: "include" } : {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `Fehler ${r.status}`);
  return j;
}

function zeit(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ChefGlobalEinstellungen() {
  const [s, setS] = useState<Stand | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [hilfe, setHilfe] = useState(false);

  const laden = () => json("/api/fiaon/chef/global/einstellungen").then(setS).catch((e) => setMeldung({ text: e.message, gut: false }));
  useEffect(() => { void laden(); }, []);

  const deckel = async (n: number) => {
    setMeldung(null);
    try { const j = await json("/api/fiaon/chef/global/einstellungen", { proTag: n }); setS((x) => x && { ...x, proTag: j.proTag }); setMeldung({ text: j.meldung, gut: true }); }
    catch (e: any) { setMeldung({ text: e.message, gut: false }); }
  };
  const google = async (body: { an?: boolean; jetzt?: boolean }) => {
    setLaeuft(true); setMeldung(null);
    try { const j = await json("/api/fiaon/chef/global/google-kalender", body); setS((x) => x && { ...x, google: j.google }); }
    catch (e: any) { setMeldung({ text: e.message, gut: false }); }
    finally { setLaeuft(false); }
  };
  const kopieren = (t: string) => { void navigator.clipboard?.writeText(t).then(() => setMeldung({ text: "Kopiert.", gut: true })); };

  if (!s) return null;
  const g = s.google;
  const ton = g.freigabe === "ok" ? "gruen" : g.freigabe === "fehler" ? "rot" : g.freigabe === "fehlt" ? "gelb" : "grau";
  const status = g.freigabe === "ok" ? `Live · ${g.eingetragen} Termin${g.eingetragen === 1 ? "" : "e"} eingetragen`
    : g.freigabe === "fehlt" ? "Wartet auf deine Freigabe"
    : g.freigabe === "fehler" ? "Fehler beim Eintragen"
    : g.freigabe === "aus" ? "Ausgeschaltet" : "Kein Konto hinterlegt";

  return (
    <section className="cge" aria-label="Gespräche und Kalender">
      <div className="cge-feld">
        <span className="cge-titel"><CalendarClock size={15} strokeWidth={1.75} /> Gespräche je Tag</span>
        <div className="cge-wahl" role="radiogroup" aria-label="Global-Gespräche je Tag">
          {STUFEN.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={s.proTag === n}
              className={s.proTag === n ? "an" : ""} onClick={() => void deckel(n)}>{n}</button>
          ))}
        </div>
        <small title="Gilt für den Kalender auf /business und für Startgespräche aus Individualangeboten.">Website und Startgespräche</small>
      </div>

      <div className="cge-feld">
        <span className="cge-titel"><UserRound size={15} strokeWidth={1.75} /> Website-Gespräche führt</span>
        <b className="cge-wert">{s.zustaendig?.name ?? "niemand"}</b>
        <small><a href="/chef/rueckholung">ändern</a></small>
      </div>

      <div className="cge-feld breit">
        <span className="cge-titel"><CalendarCheck2 size={15} strokeWidth={1.75} /> Dein Google-Kalender</span>
        <span className={`cge-status ${ton}`}><i />{status}</span>
        <small>
          {g.konten.length ? g.konten.map((k) => k.email).join(", ") : "—"}
          {g.freigabe === "ok" && g.zuletztOk ? ` · geprüft ${zeit(g.zuletztOk)}` : ""}
          {g.fehler ? ` · ${g.fehler}` : ""}
        </small>
        <div className="cge-knoepfe">
          <button type="button" className="cge-knopf" disabled={laeuft} onClick={() => void google({ jetzt: true })}>
            <RefreshCw size={13} className={laeuft ? "dreht" : ""} /> Jetzt abgleichen
          </button>
          {g.clientId && g.freigabe !== "ok" && (
            <button type="button" className="cge-knopf leise" onClick={() => setHilfe(!hilfe)} aria-expanded={hilfe}>So gibst du frei</button>
          )}
          {g.clientId && (
            <button type="button" className="cge-knopf leise" onClick={() => void google({ an: !g.an })}>{g.an ? "Ausschalten" : "Einschalten"}</button>
          )}
        </div>
      </div>

      {hilfe && g.clientId && (
        <ol className="cge-hilfe">
          <li><a href="https://admin.google.com/ac/owl/domainwidedelegation" target="_blank" rel="noreferrer">admin.google.com → Domainweite Delegierung</a> öffnen.</li>
          <li>Beim Dienstkonto <code>{g.clientId}</code> <button type="button" onClick={() => kopieren(g.clientId!)} aria-label="Client-ID kopieren"><Copy size={12} /></button> auf „Bearbeiten“.</li>
          <li>Bereiche ersetzen durch <code>{g.bereiche}</code> <button type="button" onClick={() => kopieren(g.bereiche)} aria-label="Bereiche kopieren"><Copy size={12} /></button> — gmail.modify bleibt drin.</li>
          <li>Speichern, dann hier „Jetzt abgleichen“.</li>
        </ol>
      )}

      {meldung && <p className={`cge-meldung${meldung.gut ? " gut" : ""}`} role="status">{meldung.text}</p>}
    </section>
  );
}
