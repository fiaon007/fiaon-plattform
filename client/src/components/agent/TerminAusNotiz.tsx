// ═══════════════════════════════════════════════════════════════════════════
// „DARAUS EINEN TERMIN MACHEN?“ — DIE KARTE NACH DER NOTIZ (19.10.2026, E-397)
//
// Daniel notierte am 16.10. „telefoniert am Montag 11 Uhr mit Justin“ — und kein Termin entstand. Jetzt:
// Steht in einer gespeicherten Notiz ein künftiger Tag mit Uhrzeit, liefert der Server einen Vorschlag
// (server/lib/fiaon-termin-aus-notiz.ts), und hier erscheint EIN Klick: „Ja, eintragen“.
//
// Warum ein Host neben dem Telefon und nicht in der Kundenkarte: Nach vielen Ergebnissen verlässt die Karte die
// Liste (onWeg) — die Frage muss stehen bleiben. Kundenkarte, Akte und Telefon rufen nur
// `terminVorschlagZeigen(antwort.terminVorschlag, name)`; der Host steht in SoftphoneHost (nur im Office).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

export interface TerminVorschlagDaten {
  personId: number;
  wandzeit: string;
  teilnehmerId: number;
  teilnehmerName: string;
  genannt: boolean;
  wannText: string;
  notiz: string;
  kundeName?: string | null;
}

const EREIGNIS = "fiaon-termin-vorschlag";

/** Zeigt die Frage, wenn die Antwort einen Vorschlag trägt — sonst passiert nichts. */
export function terminVorschlagZeigen(v: unknown, kundeName?: string | null): void {
  if (!v || typeof v !== "object" || !(v as TerminVorschlagDaten).wandzeit) return;
  window.dispatchEvent(new CustomEvent(EREIGNIS, { detail: { ...(v as TerminVorschlagDaten), kundeName: kundeName ?? null } }));
}

export function TerminAusNotizHost() {
  const [v, setV] = useState<TerminVorschlagDaten | null>(null);
  const [stand, setStand] = useState<"frage" | "laeuft" | "ok" | "fehler">("frage");
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const an = (e: Event) => {
      const d = (e as CustomEvent).detail as TerminVorschlagDaten | undefined;
      if (d?.wandzeit && d?.personId) { setV(d); setStand("frage"); setText(null); }
    };
    window.addEventListener(EREIGNIS, an);
    return () => window.removeEventListener(EREIGNIS, an);
  }, []);
  // Nach dem Erfolg geht die Karte nach ein paar Sekunden von selbst.
  useEffect(() => {
    if (stand !== "ok") return;
    const t = setTimeout(() => setV(null), 6000);
    return () => clearTimeout(t);
  }, [stand]);

  if (!v) return null;

  const eintragen = async () => {
    setStand("laeuft");
    const r = await fetch(`/api/fiaon/agent/crm/kunden/${v.personId}/termin-aus-notiz`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notiz: v.notiz, wandzeit: v.wandzeit, teilnehmerId: v.teilnehmerId }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      setStand("ok");
      setText(j.meldung || "Termin eingetragen.");
      window.dispatchEvent(new CustomEvent("fiaon-termin-gebucht", { detail: { personId: v.personId } }));
    } else {
      setStand("fehler");
      setText(j?.error || (r ? `Der Server hat mit ${r.status} geantwortet — nichts eingetragen.` : "Keine Verbindung — nichts eingetragen."));
    }
  };

  const mitWem = v.genannt ? `mit ${v.teilnehmerName}` : "bei dir";
  return (
    <div role="dialog" aria-live="polite" aria-label="Daraus einen Termin machen?" data-fiaon="termin-aus-notiz"
         style={{
           position: "fixed", zIndex: 70, left: "50%", bottom: 92, transform: "translateX(-50%)",
           width: "min(440px, calc(100vw - 32px))", boxSizing: "border-box",
           background: "#ffffff", color: "#0b1f3a", borderRadius: 16, padding: "14px 16px",
           border: "1px solid rgba(37, 99, 235, 0.25)", boxShadow: "0 18px 40px -18px rgba(11, 31, 58, 0.45)",
           fontSize: 13, lineHeight: 1.4,
         }}>
      <div style={{ fontWeight: 800, fontSize: 14 }}>Daraus einen Termin machen?</div>
      <div style={{ marginTop: 4, fontWeight: 600 }} data-fiaon="termin-aus-notiz-wann">
        {v.wannText} · {mitWem}{v.kundeName ? ` · ${v.kundeName}` : ""}
      </div>
      {stand === "frage" || stand === "laeuft" ? (
        <>
          <div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>
            Aus deiner Notiz erkannt. Ein Klick trägt ihn in den Kalender ein; der Kunde bekommt eine Bestätigung.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={stand === "laeuft"} onClick={() => void eintragen()} data-fiaon="termin-aus-notiz-ja"
                    style={{ background: "#2563eb", color: "#fff", border: 0, borderRadius: 12, padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: stand === "laeuft" ? "wait" : "pointer" }}>
              {stand === "laeuft" ? "Trägt ein …" : "Ja, eintragen"}
            </button>
            <button type="button" disabled={stand === "laeuft"} onClick={() => setV(null)} data-fiaon="termin-aus-notiz-nein"
                    style={{ background: "transparent", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 12, padding: "8px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              Nein, danke
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
          <div role={stand === "fehler" ? "alert" : undefined} data-fiaon="termin-aus-notiz-ausgang"
               style={{ flex: 1, fontWeight: 600, color: stand === "ok" ? "#15803d" : "#b91c1c" }}>{text}</div>
          <button type="button" onClick={() => setV(null)} aria-label="Schließen"
                  style={{ background: "transparent", border: 0, color: "#64748b", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
      )}
    </div>
  );
}
