// ═══════════════════════════════════════════════════════════════════════════
// ANLIEGEN AUS DEM KUNDENBEREICH — MARA ANTWORTET SELBST (19.10.2026, E-406 C1)
//
// Justin (Vorschlag 3, „Mara führt den Betrieb“): Mara beantwortet Anliegen aus „Hilfe & Anliegen“ selbst. Hier:
// ein Schalter (Standard an) und eine Zeile Zahlen — im Reiter „Mail“ des Mara-Steuerpults, keine neue Seite.
// Server: GET/POST /chef/mara/anliegen (server/routes/fiaon-mara-steuerpult.ts → server/lib/fiaon-mara-anliegen.ts).
// Bausteine wie „Nach 2× nicht erreicht“ (ChefMaraTermine.tsx): Statuszeile, Schalter, Info-Knopf, Meldung.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { API, zahl, useDaten } from "./chef-teile";
import { useMeldung, Meldung, InfoKnopf } from "./mara-lage";

type AnliegenAntwort = {
  ok: true; an: boolean; offen: number; heute: number; wartet: number; deckelEuro: number; kostenHeuteEuro: number;
  woche: { beantwortet: number; entwuerfe: number; mensch: number };
  gruende: { grund: string; n: number }[];
};

async function post(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt — bitte noch einmal.");
  return j;
}

export default function MaraAnliegenSchalter() {
  const d = useDaten<AnliegenAntwort>("/chef/mara/anliegen");
  const [stand, setStand] = useState<AnliegenAntwort | null>(null);
  const [busy, setBusy] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);
  const { meldung, melden, zu } = useMeldung();
  const s = stand ?? d.daten;

  const umschalten = async () => {
    if (!s) return;
    setBusy(true);
    try {
      const j = (await post("/chef/mara/anliegen", { an: !s.an })) as AnliegenAntwort;
      setStand(j);
      melden(j.an ? "An — Mara beantwortet Anliegen aus dem Kundenbereich selbst. Heikles bleibt beim Team."
        : "Aus — Anliegen beantwortet wieder nur das Team.", "anliegen");
    } catch (e: any) { melden(e.message, "anliegen", true); } finally { setBusy(false); }
  };

  return (
    <div className="mt-nachfass" data-mara-anliegen>
      <div className="mara-status mt-status" aria-label="Anliegen aus dem Kundenbereich">
        <div className="st voll">
          <button type="button" className={`mara-schalter mt-nf-schalter${s?.an ? " an" : ""}`} data-mara-schalter="anliegen"
            aria-pressed={!!s?.an} disabled={busy || !s} onClick={() => void umschalten()}>
            <span className="bahn" aria-hidden="true" />
            <span>{!s ? "Anliegen im Kundenbereich …" : s.an ? "Mara beantwortet Anliegen im Kundenbereich" : "Anliegen: nur das Team antwortet"}</span>
          </button>
          <InfoKnopf offen={infoOffen} onClick={() => setInfoOffen((x) => !x)} label="Was der Schalter tut" />
        </div>
        {s ? (
          <div className="st mt-st-text">
            <div className="st-text">
              <div>{zahl(s.heute)} heute · {zahl(s.woche.beantwortet)} in 7 Tagen{s.wartet ? ` · ${zahl(s.wartet)} warten` : ""}</div>
              <small>
                {s.woche.mensch ? `${zahl(s.woche.mensch)} beim Team (heikel)` : "nichts Heikles offen"}
                {s.woche.entwuerfe ? ` · ${zahl(s.woche.entwuerfe)} Vorschläge` : ""}
                {` · Kosten heute ${s.kostenHeuteEuro.toFixed(2).replace(".", ",")} $ von ${zahl(s.deckelEuro)} $`}
              </small>
            </div>
          </div>
        ) : d.fehler ? (
          <div className="st mt-st-text"><div className="st-text"><small>{d.fehler}</small></div></div>
        ) : null}
      </div>
      {infoOffen && (
        <p className="mara-info">
          <b>Schreibt ein Kunde unter „Hilfe & Anliegen“,</b> antwortet Mara selbst — mit Akte, Werkzeugen und derselben
          Prüfung wie im Postfach. Die Antwort steht beim Kunden im Bereich, er bekommt eine Benachrichtigung. Nur 8 bis 20 Uhr.
          Nie bei Kündigung, Widerruf, Beschwerde, Anwalt, Erstattung, Bestreiten, Löschwunsch oder Post mit Frist — das bleibt
          beim Team (Hinweis auf /agent/anliegen). Nie bei FIAON Global und Testkonten. KI-Pause: Anliegen warten und werden nachgeholt.
          {s?.gruende.length ? ` Beim Team: ${s.gruende.map((g) => `${g.grund} (${zahl(g.n)})`).join(" · ")}.` : ""}
        </p>
      )}
      <Meldung m={meldung} ort="anliegen" onZu={zu} />
    </div>
  );
}
