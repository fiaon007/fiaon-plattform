// ═══════════════════════════════════════════════════════════════════════════
// HÄKCHEN „MARA SCHICKT DIE ZUSAMMENFASSUNG“ BEIM GESPRÄCHSERGEBNIS (E-406 C2, 19.10.2026)
//
// Justin (Vorschlag 3): „Nach dem Anruf genügt ein Klick auf das Ergebnis. Die Nacharbeit macht Mara.“ Unter den
// Ergebnis-Knöpfen steht EINE Zeile: das Häkchen (an, wo es passt) und was Mara dem Kunden mailt — „59,99 € bis
// Mi 22.10. + Zahlungsseite“, „Rückruf Mi 22.10., 14:00 Uhr bestätigen“, „kurze Zusammenfassung deiner Notiz“,
// „Upload-Link für Kontoauszüge“. Geht nichts (Global, Sperre, keine Adresse, keine offene Zahlung …), sagt die
// Zeile warum — ohne Häkchen. Die Zeile kommt aus derselben Regel wie beim Server (shared/fiaon-mara-nacharbeit.ts);
// der Server prüft beim Speichern und beim Senden noch einmal. Hell (Kundenkarte) und dunkel (Akte).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, type RefObject } from "react";
import { api } from "@/pages/agent/shared";
import { nacharbeitVorschau, type NacharbeitVorschauDaten } from "@shared/fiaon-mara-nacharbeit";

/**
 * Die Daten fürs Häkchen — einmal je Kunde, neu nach jedem Speichern (`neu`). Mit `ort` (die Ergebnis-Zeile) erst,
 * wenn sie im Bild ist: „Meine Kunden“ zeigt die Ergebniszeile auf JEDER Karte — ohne das fragten 30 Karten auf einmal.
 */
export function useMaraNacharbeit(personId: number | null | undefined, neu = 0, ort?: RefObject<HTMLElement | null>): NacharbeitVorschauDaten | null {
  const [d, setD] = useState<NacharbeitVorschauDaten | null>(null);
  const [sichtbar, setSichtbar] = useState(!ort);
  useEffect(() => {
    if (sichtbar || !ort) return;
    const el = ort.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSichtbar(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setSichtbar(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ort, sichtbar]);
  useEffect(() => {
    let lebt = true;
    setD(null);
    if (!personId || !sichtbar) return;
    void api(`/agent/crm/kunden/${personId}/mara-nacharbeit`).then((r) => {
      if (!lebt) return;
      setD(r.ok ? (r.json as NacharbeitVorschauDaten) : { an: false, sperrGrund: null, betrag: null, zahlungGrund: null, fehlende: [] });
    });
    return () => { lebt = false; };
  }, [personId, neu, sichtbar]);
  return d;
}

export function MaraNacharbeitHaken({ daten, ergebnis, notiz, zusageDatum, terminDatum, terminZeit, heute, an, onAn, dunkel }: {
  daten: NacharbeitVorschauDaten | null;
  /** Das Ergebnis, das gerade offen ist — ohne offenes Feld „Zahlt sofort“ (der Knopf speichert ohne Feld). */
  ergebnis: string | null;
  notiz?: string;
  zusageDatum?: string;
  terminDatum?: string;
  terminZeit?: string;
  heute: string;
  an: boolean;
  onAn: (ja: boolean) => void;
  dunkel?: boolean;
}) {
  if (!daten || !daten.an) return null;
  const v = nacharbeitVorschau(daten, { ergebnis, notiz, zusageDatum, terminDatum, terminZeit, heute });
  if (!v.art) return null;
  const vorZeile = ergebnis === "erreicht_zahlt_gleich" ? "bei „Zahlt sofort“: " : "";
  const text = `${vorZeile}${v.zeile}`;
  return (
    <label className={dunkel ? "pi-haken pi-haken-zeile" : "mt-2 flex items-start gap-2 text-[12px] cursor-pointer p-2.5 rounded-xl"}
           data-fiaon="mara-nacharbeit"
           style={dunkel ? { cursor: v.moeglich ? "pointer" : "default" } : { background: "var(--fi-seite)", border: "1px solid var(--fi-linie)", cursor: v.moeglich ? "pointer" : "default" }}
           title="Mara schickt dem Kunden nach dem Speichern eine kurze Mail (8–20 Uhr, sonst am nächsten Morgen). Der Vermerk steht in der Akte.">
      <input type="checkbox" checked={v.moeglich && an} disabled={!v.moeglich} onChange={(e) => onAn(e.target.checked)}
             data-fiaon="mara-nacharbeit-haken" style={{ marginTop: 2, accentColor: "#2563eb" }} />
      <span>
        <b>Mara schickt die Zusammenfassung</b>{" "}
        <span style={dunkel ? { color: v.moeglich ? "#cbd5e1" : "#94a3b8" } : { color: v.moeglich ? "var(--fi-text-leise)" : "var(--fi-text-still)" }}>· {text}</span>
      </span>
    </label>
  );
}
