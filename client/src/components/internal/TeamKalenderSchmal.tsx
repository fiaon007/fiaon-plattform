// ═══════════════════════════════════════════════════════════════════════════
// TERMINE ALS LISTE — FÜR SCHMALE GERÄTE
//
// ══════════════════════════════════════════════════════════════════════════
// WICHTIG: DIESE DATEI ENTSTAND FÜR EINEN AUFTRAG, DER SICH BEIM MESSEN
// AUFGELÖST HAT (24.08.2026)
//
// Der Auftrag lautete: „team-calendar.tsx (grid-cols-7) unter 768 px als
// Kartenliste — bei 3.870 Zeilen nicht umbauen, sondern eine schlanke
// Mobil-Fassung daneben."
//
// Die Messung danach ergab:
//   · `TeamCalendar` wird in KEINER Seite eingebunden — kein Import, nirgends.
//   · Die Tabelle `team_calendar` dahinter hat **0 Einträge**.
//   · Die ECHTEN Termine liegen in `fiaon_termine`: **120 Stück**, mit
//     `quelle`, `status`, `agent_id`, `person_id`.
//
// Eine Mobil-Fassung für eine leere, nicht eingebundene Ansicht zu bauen wäre
// Arbeit, die niemand sieht. Der Kern der Bitte — „Termine am Telefon lesbar" —
// gilt aber weiter, nur für die richtigen Daten.
//
// Deshalb ist dieses Bauteil DATENQUELLEN-FREI: Es nimmt eine Liste von
// Terminen und zeigt sie. Die Termin-Zentrale (/admin/termine, Teil 1 des
// Auftrags) benutzt es für ihre 380-px-Ansicht.
// ══════════════════════════════════════════════════════════════════════════
//
// ── WAS EINE LISTE BESSER KANN ─────────────────────────────────────────────
// Auf einem Telefon liest niemand ein Raster. Er will wissen: „Was ist heute
// noch? Was kommt morgen?" — also Tage als Abschnitte, Termine als Karten mit
// Uhrzeit, Name und Art. Vergangene Tage werden nicht gezeigt: Sie kosten
// Platz und niemand scrollt am Telefon nach oben.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo } from "react";

/**
 * Ein Termin, wie ihn `fiaon_termine` führt — bewusst NUR die Felder, die diese
 * Liste anzeigt. Wer mehr braucht, öffnet die Akte.
 */
export interface SchmalTermin {
  id: string | number;
  /** Beginn als ISO-Zeichenkette oder Date. */
  start: string | Date;
  title?: string | null;
  /** Wer hat den Termin? */
  agentName?: string | null;
  /** Woher kommt er (Onboarding, Rückruf, Portal …)? */
  art?: string | null;
  /** Kunde, falls verknüpft. */
  kundeName?: string | null;
  kundeRef?: string | null;
  status?: string | null;
}

const TAG_LANG = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "long",
});
const UHR = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
});
/** Der Tagesschlüssel in Berliner Zeit — nicht über toISOString (das ist UTC). */
const TAG_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
});

function alsDatum(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Farbe je Status — bernstein heißt „jemand muss etwas tun". */
const TON: Record<string, string> = {
  gebucht: "#2563eb",
  erledigt: "#059669",
  verpasst: "#d97706",
  storniert: "#94a3b8",
};

export function TeamKalenderSchmal({
  termine, tage = 14, onTerminClick,
}: {
  termine: SchmalTermin[];
  /** Wie viele Tage nach vorn. 14 ist eine Bildschirmlänge Scrollen. */
  tage?: number;
  onTerminClick?: (t: SchmalTermin) => void;
}) {
  const abschnitte = useMemo(() => {
    // ── HEUTE 0 UHR IN BERLINER ZEIT ────────────────────────────────────
    // `new Date().setHours(0,0,0,0)` nimmt die Zeitzone des BROWSERS. Sitzt
    // jemand auf Mallorca oder ist sein Gerät auf UTC gestellt, fängt der Tag
    // an der falschen Stelle an — und der erste Termin fehlt.
    const heuteKey = TAG_KEY.format(new Date());
    const gruppen = new Map<string, SchmalTermin[]>();

    for (const t of termine) {
      const d = alsDatum(t.start);
      if (Number.isNaN(d.getTime())) continue;
      const key = TAG_KEY.format(d);
      // Vergangene Tage nicht: Sie kosten Platz, und am Telefon scrollt
      // niemand nach oben.
      if (key < heuteKey) continue;
      const liste = gruppen.get(key) ?? [];
      liste.push(t);
      gruppen.set(key, liste);
    }

    return Array.from(gruppen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, tage)
      .map(([key, liste]) => ({
        key,
        istHeute: key === heuteKey,
        beschriftung: TAG_LANG.format(alsDatum(liste[0].start)),
        termine: liste.sort((a, b) =>
          alsDatum(a.start).getTime() - alsDatum(b.start).getTime()),
      }));
  }, [termine, tage]);

  if (abschnitte.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-slate-400">
        Keine Termine in den nächsten {tage} Tagen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {abschnitte.map((a) => (
        <section key={a.key}>
          <h3 className="text-[11px] font-bold uppercase tracking-[.12em] mb-1.5"
              style={{ color: a.istHeute ? "#2563eb" : "#94a3b8" }}>
            {a.istHeute ? `Heute · ${a.beschriftung}` : a.beschriftung}
            <span className="ml-1.5 font-semibold tabular-nums">({a.termine.length})</span>
          </h3>
          <ul className="space-y-1.5">
            {a.termine.map((t) => {
              const ton = TON[String(t.status ?? "gebucht")] ?? "#2563eb";
              return (
                <li key={String(t.id)}>
                  {/* Ein Listeneintrag, der etwas tut, ist ein Knopf — nicht ein
                      div mit onClick. Sonst erreicht ihn niemand mit der
                      Tastatur, und Vorleseprogramme übergehen ihn. */}
                  <button
                    type="button"
                    onClick={() => onTerminClick?.(t)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-white flex items-start gap-3"
                    style={{
                      boxShadow: "inset 0 0 0 1px rgba(15,23,42,.08)",
                      borderLeft: `3px solid ${ton}`,
                      // 44 px ist die Fingerkuppe. Alles darunter wird
                      // danebengetippt.
                      minHeight: 52,
                    }}
                  >
                    <span className="text-[13px] font-bold tabular-nums shrink-0"
                          style={{ color: ton, minWidth: 44 }}>
                      {UHR.format(alsDatum(t.start))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-slate-800 truncate">
                        {t.kundeName || t.title || "Termin"}
                      </span>
                      <span className="block text-[11.5px] text-slate-500 truncate">
                        {[t.agentName, t.art, t.status && t.status !== "gebucht" ? t.status : null]
                          .filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
