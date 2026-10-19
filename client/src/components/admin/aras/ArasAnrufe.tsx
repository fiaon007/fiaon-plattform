// Reiter „Anrufe“ (E-409): Liste mit Spielart, Ergebnis, Dauer, Kosten — Detail mit Transkript, Werkzeugen, Prüf-Urteil, Aufnahme.
import { useState } from "react";
import { akteLink } from "@/lib/akte-link";
import type { AnrufZeile, PruefZeile } from "@shared/fiaon-ki-team";
import { useTakt, holen, Fehler, NichtVerbunden, tagZeit, euro } from "../ki-teile";
import { SPIELART_TEXT, ergebnisText } from "./aras-teile";

interface Detail extends Omit<AnrufZeile, "pruefung"> { briefing?: any; transkript?: { t: number; wer: string; text: string }[] | null; zusammenfassung?: string | null; werkzeuge?: { werkzeug: string; eingabe: any; ergebnis: any; ok: boolean; dauerMs: number }[]; aufnahmeUrl?: string | null; pruefung?: PruefZeile | null; kiHinweisAm?: string | null; aufnahmeJaAm?: string | null; aufnahmeNeinAm?: string | null }

export default function ArasAnrufe({ verbunden }: { verbunden: boolean }) {
  const [tag, setTag] = useState("");
  const { daten, fehler, status, neu } = useTakt<{ ok: boolean; zeilen: AnrufZeile[] }>(verbunden ? `/chef/aras/anrufe${tag ? `?tag=${tag}` : ""}` : null, 30_000);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [laedt, setLaedt] = useState<number | null>(null);
  if (!verbunden || status === 404) return <NichtVerbunden />;
  const oeffnen = async (z: AnrufZeile) => {
    if (detail?.id === z.id) { setDetail(null); return; }
    setLaedt(z.id);
    try { setDetail(await holen<Detail>(`/chef/aras/anrufe/${z.id}`)); } catch { setDetail(null); } finally { setLaedt(null); }
  };
  return (
    <div>
      <div className="ki-chips" style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Tag JJJJ-MM-TT (leer = heute)" value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: 220 }} aria-label="Tag" />
      </div>
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <div className="ki-karte">
        {!daten?.zeilen.length ? <p className="ki-still">Keine Anrufe an diesem Tag.</p> : (
          <ul className="ki-liste">
            {daten.zeilen.map((z) => {
              const link = z.personId ? akteLink(z.personId, "chef") : null;
              const offen = detail?.id === z.id;
              return (
                <li key={z.id} className="ki-zeile" data-ki-anruf={z.id}>
                  <div className="ki-zeile-kopf">
                    <span className="ki-pille akz">{SPIELART_TEXT[z.spielart] ?? z.spielart}</span>
                    {link ? <a href={link}>{z.name || "Akte"}</a> : <span>{z.name || "—"}</span>}
                    <b>{ergebnisText(z.ergebnis)}</b>
                    <span className="ki-still ki-klein">{tagZeit(z.am)} · {Math.floor(z.dauerSek / 60)}:{String(z.dauerSek % 60).padStart(2, "0")} · {euro(z.kostenCents / 100)}</span>
                    {z.pruefung && z.pruefung !== "ok" && z.pruefung !== "offen" ? <span className={`ki-pille ${z.pruefung === "fehler" ? "krit" : "warn"}`}>Prüf-Mara: {z.pruefung}</span> : null}
                    {z.uebergabe ? <span className="ki-pille">übergeben: {z.uebergabe}</span> : null}
                  </div>
                  <button type="button" className="ki-knopf text ki-klein" disabled={laedt === z.id} onClick={() => oeffnen(z)}>{offen ? "schließen" : "Details"}</button>
                  {offen && detail ? (
                    <div className="ki-zeile-satz">
                      {detail.zusammenfassung ? <p>{detail.zusammenfassung}</p> : null}
                      <p className="ki-still ki-klein">KI-Hinweis {detail.kiHinweisAm ? tagZeit(detail.kiHinweisAm) : "—"} · Aufnahme {detail.aufnahmeJaAm ? "Ja" : detail.aufnahmeNeinAm ? "Nein" : "—"}</p>
                      {detail.aufnahmeUrl ? <audio controls preload="none" src={detail.aufnahmeUrl} style={{ width: "100%", maxWidth: 420 }} /> : null}
                      {detail.transkript?.length ? <div className="ki-ticker" style={{ maxHeight: 260, overflow: "auto" }}>{detail.transkript.map((t, i) => <p key={i} style={{ whiteSpace: "normal" }}><b>{t.wer === "kunde" ? "Kunde" : "Aras"}:</b> {t.text}</p>)}</div> : <p className="ki-still ki-klein">Kein Transkript (Aufnahme ohne Ja — nur die Zusammenfassung).</p>}
                      {detail.werkzeuge?.length ? <ul className="ki-liste">{detail.werkzeuge.map((w, i) => <li key={i}><span className={`ki-punkt ${w.ok ? "gut" : "krit"}`} aria-hidden="true" /> {w.werkzeug} <span className="ki-still">· {w.dauerMs} ms</span></li>)}</ul> : null}
                      {detail.pruefung ? <p className="ki-klein">Prüf-Mara: <b className="ki-leise">{detail.pruefung.urteil}</b>{detail.pruefung.punkte?.length ? ` — ${detail.pruefung.punkte.map((p) => p.hinweis).join(" · ")}` : ""}</p> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
