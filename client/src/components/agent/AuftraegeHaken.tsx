// ═══════════════════════════════════════════════════════════════════════════
// HÄKCHEN „DAMIT ERLEDIGT“ BEIM GESPRÄCHSERGEBNIS (E-397, 19.10.2026)
//
// Gemessen am 19.10.2026: Daniel trug in 14 Tagen 499 Gesprächsergebnisse ein und
// erledigte in 30 Tagen 17 Aufträge — jeder Anruf war Arbeit ohne Wirkung. Unter
// den Ergebnis-Knöpfen stehen jetzt die offenen Aufträge DIESES Kunden, die bei
// dir liegen, je mit einem Häkchen. Wählst du danach ein „Erreicht“-Ergebnis,
// gehen die angehakten mit zu (derselbe Weg wie der Knopf „Erledigt“; bei
// Kündigung, Widerruf, Beschwerde und Lage-Aufträgen braucht es die Notiz).
// Hell (Kundenkarte, ErgebnisWahl) und dunkel (Akte, ErgebnisWahlDunkel).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { api } from "@/pages/agent/shared";

interface Offen { id: number; titel: string; artLabel: string; ergebnisPflicht: boolean; dringend: boolean }

export function AuftraegeHaken({ personId, gewaehlt, onWahl, neu, dunkel }: {
  personId: number | null | undefined;
  gewaehlt: number[];
  onWahl: (ids: number[]) => void;
  /** Zähler: ändert er sich, lädt die Liste neu (nach dem Speichern). */
  neu?: number;
  dunkel?: boolean;
}) {
  const [liste, setListe] = useState<Offen[]>([]);
  useEffect(() => {
    let lebt = true;
    if (!personId) { setListe([]); return; }
    void api(`/agent/auftraege/kunde/${personId}`).then((r) => { if (lebt && r.ok) setListe(r.json?.auftraege ?? []); });
    return () => { lebt = false; };
  }, [personId, neu]);
  if (!liste.length) return null;
  const an = (id: number, ja: boolean) => onWahl(ja ? Array.from(new Set([...gewaehlt, id])) : gewaehlt.filter((x) => x !== id));
  return (
    <div className={dunkel ? "pi-haken" : "fi-haken mt-2.5 p-3 rounded-xl"} data-fiaon="auftraege-haken"
         style={dunkel ? undefined : { background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
      <p className={dunkel ? "pi-haken-kopf" : "text-[12px] font-semibold mb-1.5"} style={dunkel ? undefined : { color: "var(--fi-text-leise)" }}>
        Offene Aufträge zu diesem Kunden — hake ab, was das Gespräch erledigt hat (gilt bei „Erreicht“):
      </p>
      <ul className={dunkel ? "pi-haken-liste" : "space-y-1"}>
        {liste.map((a) => (
          <li key={a.id}>
            <label className={dunkel ? "pi-haken-zeile" : "flex items-start gap-2 text-[12.5px] cursor-pointer"}>
              <input type="checkbox" checked={gewaehlt.includes(a.id)} onChange={(e) => an(a.id, e.target.checked)}
                     data-fiaon="auftrag-haken" style={{ marginTop: 3, accentColor: "#2563eb" }} />
              <span>
                <b>damit erledigt:</b> {a.artLabel}{a.titel && a.titel !== a.artLabel ? ` — ${a.titel}` : ""}
                {a.ergebnisPflicht ? <small className={dunkel ? "pi-haken-hinweis" : "block text-[11px]"} style={dunkel ? undefined : { color: "#b45309" }}> (braucht eine Notiz zum Gespräch)</small> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
