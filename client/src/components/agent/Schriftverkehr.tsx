// ═══════════════════════════════════════════════════════════════════════════
// SCHRIFTVERKEHR — jede E-Mail zwischen Kunde und FIAON (18.09.2026)
//
// Team-Feedback, Priorität 6: „Alle relevanten E-Mail-Verläufe müssen für die
// zuständigen Mitarbeiter einsehbar sein, Kundenanfragen dürfen nicht verloren
// gehen." Eine Zeitleiste aus Eingang (was der Kunde schrieb, mit Maras Antwort
// oder Entwurf) und Ausgang (was automatisch oder von Hand rausging). Offene
// Entwürfe stehen oben markiert; ein Klick öffnet die Mail mit den Knöpfen
// „So an den Kunden senden" und „Selbst beantwortet".
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { PostmeisterMail } from "./PostmeisterMail";

interface Zeile {
  art: "ein" | "aus"; id: number; am: string; betreff: string; text: string;
  status: string; offen: boolean; dringend: boolean; von?: string; postfach?: string;
}

function zeit(v: string): string {
  return new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS: Record<string, string> = {
  beantwortet: "beantwortet", entwurf: "Entwurf wartet", auto_beantwortet: "beantwortet", geordnet: "erledigt",
  ignoriert: "abgelegt", vorgeordnet: "eingeordnet", versandt: "gesendet", zugestellt: "zugestellt",
  geoeffnet: "geöffnet", fehlgeschlagen: "nicht gesendet", gebounct: "zurückgekommen", spam: "als Spam gemeldet",
};

export function Schriftverkehr({ personId }: { personId: number }) {
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  useEffect(() => {
    let aktiv = true;
    void fetch(`/api/fiaon/agent/schriftverkehr/${personId}`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((j) => { if (!aktiv) return; if (j?.ok) setZeilen(j.zeilen); else setFehler(j?.error || "Der Schriftverkehr konnte nicht geladen werden."); });
    return () => { aktiv = false; };
  }, [personId]);

  if (fehler) return <p className="pi-sek-satz leise">{fehler}</p>;
  if (!zeilen) return <p className="pi-sek-satz leise">Lade den Schriftverkehr …</p>;
  if (zeilen.length === 0) return <p className="pi-sek-satz leise">Mit diesem Kunden gab es noch keinen Mailverkehr.</p>;
  const sortiert = [...zeilen.filter((z) => z.offen), ...zeilen.filter((z) => !z.offen)];
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {sortiert.slice(0, 60).map((z) => (
        <div key={`${z.art}-${z.id}`} style={{ border: "1px solid var(--fi-rand, #e5e9f0)", borderRadius: 10, padding: "8px 10px", background: z.offen ? "rgba(217,119,6,.06)" : "transparent" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: z.art === "ein" ? "#b45309" : "var(--fi-text-still, #64748b)" }}>
              {z.art === "ein" ? "Kunde schreibt" : `An Kunde · ${z.von}`}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--fi-text-still, #64748b)" }}>{zeit(z.am)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: z.offen ? "#b45309" : "var(--fi-text-still, #64748b)" }}>{STATUS[z.status] ?? z.status}{z.dringend ? " · dringend" : ""}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{z.betreff}</div>
          {z.text && <div style={{ fontSize: 12.5, color: "var(--fi-text-still, #64748b)", marginTop: 2 }}>{z.text}</div>}
          {z.art === "ein" && (
            <button type="button" className="pi-link" style={{ marginTop: 4 }} onClick={() => setOffen(offen === z.id ? null : z.id)}>
              {offen === z.id ? "schließen" : z.offen ? "Mail und Entwurf öffnen" : "Mail öffnen"}
            </button>
          )}
          {offen === z.id && <PostmeisterMail id={z.id} />}
        </div>
      ))}
    </div>
  );
}
