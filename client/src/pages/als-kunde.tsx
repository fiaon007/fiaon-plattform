// ═══════════════════════════════════════════════════════════════════════════
// DIE SCHLEUSE IN DIE KUNDENSICHT
//
// ── WARUM ES DIESE ZWISCHENSEITE GIBT ──────────────────────────────────────
// Das Kundenportal hat keine Server-Sitzung: Der Login legt seine Antwort in
// `sessionStorage.fiaon_user`, und alle Portalseiten lesen von dort. Ein
// Ansichts-Cookie allein würde also nichts bewirken — das Portal würde niemanden
// finden und zur Anmeldung schicken.
//
// Diese Seite holt die Kundendaten in GENAU der Form, die der Login liefert,
// legt sie ab und geht weiter ins Portal. Danach sieht der Betreiber exakt den
// Zustand dieses Kunden — Kontostufe, Gate, Bonitätskarte, Sperrkarten,
// Unterlagen, Rechnungen — ohne dass eine einzige Portalseite etwas von der
// Ansicht wissen muss.
//
// ── DIE ALTERNATIVE WÄRE SCHLECHTER GEWESEN ────────────────────────────────
// „Jede Portalseite bekommt einen Ansichts-Modus" hätte bedeutet: Jede neue
// Seite muss daran denken. Sie hätte es nicht getan, und dann zeigt die neue
// Seite die Daten des Betreibers statt die des Kunden.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

export default function AlsKundePage(): JSX.Element {
  const [fehler, setFehler] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    (async () => {
      try {
        const j = await fetch("/api/fiaon/kundenansicht/stand", { credentials: "include" })
          .then((r) => r.json());
        if (weg) return;
        if (!j?.ok || !j.aktiv) {
          setFehler(j?.grund ?? "Diese Ansicht ist nicht (mehr) gültig. Bitte in der Kundenakte neu starten.");
          return;
        }
        setName(j.name ?? null);
        // Die Anmeldedaten des Kunden in der Form des Logins ablegen.
        sessionStorage.setItem("fiaon_user", JSON.stringify(j.user));
        // Merker für den Banner: Er soll nicht bei jedem Seitenwechsel erst
        // fragen müssen, ob eine Ansicht läuft. Die WAHRHEIT bleibt das Cookie
        // auf dem Server — dieser Merker ist nur für die Anzeige.
        sessionStorage.setItem("fiaon_kundenansicht", JSON.stringify({
          name: j.name, bis: j.bis, art: j.art, zurueck: j.zurueck,
        }));
        // `replace` statt `href`: Der Zurück-Knopf des Browsers soll nicht in
        // diese Schleuse zurückführen und die Ansicht erneut starten.
        window.location.replace("/dashboard");
      } catch {
        if (!weg) setFehler("Verbindung fehlgeschlagen.");
      }
    })();
    return () => { weg = true; };
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-start justify-center px-5 py-20">
      <div className="w-full max-w-[420px]">
        <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase mb-8">FIAON</div>
        {fehler ? (
          <>
            <h1 className="text-[19px] font-medium text-slate-900 mb-3">Ansicht nicht möglich</h1>
            <p className="text-[14px] leading-relaxed text-slate-600 mb-6">{fehler}</p>
            <button type="button" onClick={() => window.history.back()}
                    className="text-[13px] px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50">
              Zurück
            </button>
          </>
        ) : (
          <>
            <h1 className="text-[19px] font-medium text-slate-900 mb-2">
              Öffne das Portal{name ? ` von ${name}` : ""} …
            </h1>
            <p className="text-[13.5px] leading-relaxed text-slate-500">
              Nur-Ansicht. Es entstehen keine Aktionen im Namen des Kunden.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
