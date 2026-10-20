// Reiter „Stufe“ (E-408 Scheibe 3 Teil 2): die Ausbaustufe und die Stufen-Ampel der letzten 14 Tage aus /chef/aras/stufe.
// Nur Anzeige — die Stufe stellst du im Reiter „Einstellungen“ (Ausbaustufe), die Automatik schaltet selbst (Rot → zurück).
import { useTakt, Fehler, NichtVerbunden } from "../ki-teile";
import { STUFEN, type Stufe } from "@shared/fiaon-aras";
import { STUFEN_ZIELE, type AmpelPunkt } from "@shared/fiaon-aras-stufe";

interface StufeLage { ok: boolean; stufe: number; auto: boolean; naechste?: string; tage: { tag: string; stufe: number; farbe: string; entscheidung: string | null; punkte: AmpelPunkt[] }[] }
const KLASSE: Record<string, string> = { gruen: "gut", gelb: "warn", rot: "krit" };
const TEXT: Record<string, string> = { gruen: "grün", gelb: "gelb", rot: "rot", leer: "keine Kundenanrufe" };

export default function ArasStufe({ verbunden }: { verbunden: boolean }) {
  const { daten, fehler, status, neu } = useTakt<StufeLage>(verbunden ? "/chef/aras/stufe" : null, 60_000);
  if (!verbunden || status === 404) return <NichtVerbunden />;
  if (fehler && !daten) return <Fehler text={fehler} erneut={neu} />;
  if (!daten) return <div className="ki-leer">lädt …</div>;
  const st = Math.max(0, Math.min(3, daten.stufe)) as Stufe;
  const s = STUFEN[st];
  const brauche = STUFEN_ZIELE.tageHoch[st];
  return (
    <div data-ki="aras-stufe">
      <div className="ki-karte">
        <h2>Ausbaustufe {st} · {s.name} <span className="ki-still ki-klein">· Automatik {daten.auto ? "an" : "aus"}</span></h2>
        <p className="ki-klein" style={{ margin: 0 }}>
          {st === 0 ? "Aras ruft nur dich an (Probe) — Kunden erst ab Stufe 1." : `${s.versucheJeTag} Anrufe am Tag · ${s.parallel} gleichzeitig · ${s.tagEuro} € Tagesdeckel.`}
          {brauche ? ` Nach ${brauche} grünen Tagen geht es von selbst eine Stufe hoch.` : ""}
          {st >= 1 ? " Bei Rot geht es sofort eine Stufe zurück — du bekommst dann eine Karte." : ""}
        </p>
        {daten.naechste ? <p className="ki-still ki-klein" style={{ margin: "6px 0 0" }}>Stand: {daten.naechste}</p> : null}
      </div>
      <div className="ki-karte ki-abstand">
        <h2>Ampel der letzten 14 Tage</h2>
        {daten.tage.length ? (
          <div className="ki-tabelle-rahmen">
            <table className="ki-tabelle">
              <thead><tr><th>Tag</th><th>Stufe</th><th>Ampel</th><th>Was auffällt</th><th>Entscheidung</th></tr></thead>
              <tbody>
                {daten.tage.map((t) => {
                  const auffaellig = t.punkte.filter((p) => p.farbe === "rot" || p.farbe === "gelb");
                  return (
                    <tr key={t.tag}>
                      <td>{t.tag.split("-").reverse().join(".")}</td>
                      <td>{t.stufe >= 0 ? t.stufe : "—"}</td>
                      <td><span className={`ki-punkt ${KLASSE[t.farbe] ?? ""}`} aria-hidden="true" /> {TEXT[t.farbe] ?? t.farbe}</td>
                      <td className="ki-klein" title={t.punkte.map((p) => `${p.name}: ${p.wert} (Ziel ${p.ziel})`).join("\n")}>{auffaellig.length ? auffaellig.map((p) => `${p.name}: ${p.wert}`).join(" · ") : "—"}</td>
                      <td className="ki-klein">{t.entscheidung ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="ki-still">Noch keine Tage — die Ampel beginnt mit den ersten Kundenanrufen.</p>}
        <p className="ki-still ki-klein" style={{ marginBottom: 0 }}>Ziele: erreicht ≥ 25 % (Rückrufe ≥ 40 %) · Zahlung binnen 48 h ≥ 20–30 % · unter {STUFEN_ZIELE.kostenJeZahlungEuro} € je Zahlung · {STUFEN_ZIELE.minutenVon}–{STUFEN_ZIELE.minutenBis} Minuten · rot ab 3 % Abbrüchen oder 2 % Prüf-Fehlern.</p>
      </div>
    </div>
  );
}
