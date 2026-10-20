// ═══════════════════════════════════════════════════════════════════════════
// ARAS IN DER AKTE (E-408 Scheibe 2, Nachtrag Akte-Steuerung 19.10.2026)
//
// Justin: „in der Akte ein Knopf wie ‚ARAS anrufen lassen‘ mit Erklärung, was das
// ist … individuelle Sachen eintippen … oder mit 1 Klick die Arbeit abgeben.“
//
// EINE Karte, zwei Orte (Office-Akte und Chefbüro-Akte — beide sind pipeline.tsx `Akte`):
//   · Aras anrufen lassen — Anliegen (aus der Lage), Freitext (≤ 500, durch die Wortwand),
//     Zeitpunkt, „mich benachrichtigen“; geht es gerade nicht, steht EIN Satz, warum.
//   · Offenes an Aras abgeben — alles Offene mit Häkchen, EIN Anruf; was bei dir bleibt, steht daneben.
//   · Geplant (zurücknehmen) · Was Aras gemacht hat (Ergebnis, Aufnahme nur nach Ja, Daumen)
//   · Was Aras wissen muss · Aras für diesen Kunden aus
// Server: server/routes/fiaon-aras-akte.ts · Lage: server/lib/fiaon-aras-akte.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { api } from "@/pages/agent/shared";
import { AnrufPlayer } from "@/components/AnrufPlayer";
import "@/styles/office-aras.css";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;
interface OffenPunkt { art: string; label: string; satz: string }
interface Geplant { id: number; spielart: string; art: string; status: string; ab: string; bis: string; von: string | null; auftrag: string | null; punkte: string[]; versuch: number; grund: string | null; zuruecknehmbar: boolean }
interface Verlauf {
  arasAnrufId: number; callId: number; am: string; spielart: string; art: string; ergebnis: string | null; ergebnisText: string; dauerSek: number; kostenEuro: number;
  zusammenfassung: string | null; kiHinweis: boolean; aufnahme: "ja" | "nein" | null; transkript: { wer: "kunde" | "aras"; text: string }[] | null; hatAufnahme: boolean;
  urteil: string | null; urteilGrund: string | null; auftragVon: string | null; laeuft: boolean;
}
interface Lage {
  ok: boolean; aras: { kundenAn: boolean; stufe: number; notaus: boolean };
  geht: { ok: boolean; grund: string | null }; hinweis: string | null;
  sperre: { aus: boolean; grund: string | null; am: string | null; von: string | null; telefonGesperrt: boolean };
  notiz: { text: string; am: string | null; von: string | null };
  offen: OffenPunkt[]; bleibtBeiDir: string[]; geplant: Geplant[]; verlauf: Verlauf[];
}

const zeit = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const dauer = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`);
const MAX = 500;

export function ArasKarte({ personId, melden }: { personId: number; melden: Melden }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [modus, setModus] = useState<"" | "auftrag" | "abgeben">("");
  const [erklaert, setErklaert] = useState(false);
  const [anliegen, setAnliegen] = useState("");
  const [text, setText] = useState("");
  const [wann, setWann] = useState<"bald" | "heute_ab" | "morgen">("bald");
  const [ab, setAb] = useState("17:00");
  const [benachrichtigen, setBenachrichtigen] = useState(true);
  const [haken, setHaken] = useState<string[]>([]);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const [sperrGrund, setSperrGrund] = useState("");
  const [offenId, setOffenId] = useState<number | null>(null);
  const [urteilGrund, setUrteilGrund] = useState("");

  const laden = useCallback(async () => {
    const r = await api(`/agent/kunden/${personId}/aras`);
    if (r.ok) { setLage(r.json); setNotiz(r.json.notiz?.text ?? ""); }
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { setModus(""); setText(""); setAnliegen(""); setHinweise([]); }, [personId]);

  if (!lage) return null;

  async function tun(name: string, pfad: string, body: unknown, gut: string, danach?: () => void) {
    setLaeuft(name); setHinweise([]);
    const r = await api(pfad, { method: "POST", body: JSON.stringify(body ?? {}) });
    setLaeuft(null);
    if (!r.ok) {
      if (Array.isArray(r.json?.hinweise)) setHinweise(r.json.hinweise);
      melden("schlecht", "Nicht gemacht", r.json?.error ?? "Bitte erneut versuchen.");
      return;
    }
    melden("gut", gut, r.json?.meldung);
    danach?.();
    await laden();
  }
  const auftragSenden = () => tun("auftrag", `/agent/kunden/${personId}/aras/auftrag`,
    { punkte: anliegen ? [anliegen] : [], auftrag: text, wann, ab: wann === "heute_ab" ? ab : null, benachrichtigen },
    "Aras ist beauftragt", () => { setModus(""); setText(""); setAnliegen(""); });
  const abgeben = () => tun("abgeben", `/agent/kunden/${personId}/aras/auftrag`,
    { punkte: haken, wann: "bald", benachrichtigen, abgeben: true }, "An Aras abgegeben", () => setModus(""));

  const l = lage;
  const offenAuftrag = modus === "auftrag";
  const offenAbgeben = modus === "abgeben";
  return (
    <section className="ak" data-fiaon="aras-karte">
      <div className="ak-kopf">
        <div>
          <b>Aras</b> <span className="ak-still">KI-Kollege am Telefon</span>
          <p>Aras ruft den Kunden an, klärt das Anliegen und erledigt, was er kann — Zahlungslink, Zusage, Termin, Unterlagen anfordern.</p>
          <button type="button" className="ak-link" onClick={() => setErklaert((x) => !x)} aria-expanded={erklaert}>Was passiert dann?</button>
          {erklaert && (
            <ol className="ak-schritte">
              <li>Aras ruft im Anruffenster an — höchstens einmal am Tag und dreimal die Woche (du und Aras zusammen).</li>
              <li>Er sagt im ersten Satz, dass er eine KI ist. Aufgezeichnet wird nur, wenn der Kunde Ja sagt.</li>
              <li>Das Ergebnis steht danach hier in der Akte — wie bei deinem eigenen Anruf. Du bekommst eine Nachricht im Office.</li>
            </ol>
          )}
        </div>
        <div className="ak-knoepfe">
          <button type="button" className="pi-knopf klein" disabled={!l.geht.ok || !!laeuft} onClick={() => setModus(offenAuftrag ? "" : "auftrag")}>Aras anrufen lassen</button>
          <button type="button" className="pi-knopf klein still" disabled={!l.geht.ok || !l.offen.length || !!laeuft}
                  onClick={() => { setHaken(l.offen.map((p) => p.art)); setModus(offenAbgeben ? "" : "abgeben"); }}
                  title={l.offen.length ? "Alles Offene in EINEM Anruf" : "Gerade ist nichts offen, was Aras übernehmen kann."}>Offenes an Aras abgeben</button>
        </div>
      </div>
      {!l.geht.ok && l.geht.grund && <p className="ak-grund">{l.geht.grund}</p>}
      {l.geht.ok && l.hinweis && <p className="ak-hinweis">{l.hinweis}</p>}

      {offenAuftrag && (
        <div className="ak-maske">
          <label className="ak-feld">Worum geht es?
            <select className="pi-eingabe" value={anliegen} onChange={(e) => setAnliegen(e.target.value)}>
              <option value="">Nur mein Auftrag (unten)</option>
              {l.offen.map((p) => <option key={p.art} value={p.art}>{p.label}</option>)}
            </select>
          </label>
          <label className="ak-feld">Was soll Aras sagen oder erledigen?
            <textarea className="pi-eingabe ak-text" rows={3} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)}
                      placeholder="z. B. „Teile dem Kunden mit, dass er seinen Kontoauszug hochladen soll.“" />
            <small>{text.length}/{MAX} · Aras sagt es in eigenen Worten — nie mit Limit-Zusage, Druck oder Drohung.</small>
          </label>
          <div className="ak-feld">Wann?
            <div className="ak-wahl" role="group" aria-label="Wann soll Aras anrufen?">
              <button type="button" className={wann === "bald" ? "an" : ""} onClick={() => setWann("bald")}>So bald wie möglich</button>
              <button type="button" className={wann === "heute_ab" ? "an" : ""} onClick={() => setWann("heute_ab")}>Heute ab</button>
              {wann === "heute_ab" && <input type="time" className="pi-eingabe ak-uhr" value={ab} min="08:00" max="19:30" step={900} onChange={(e) => setAb(e.target.value)} aria-label="Uhrzeit" />}
              <button type="button" className={wann === "morgen" ? "an" : ""} onClick={() => setWann("morgen")}>Morgen</button>
            </div>
          </div>
          <label className="ak-haken"><input type="checkbox" checked={benachrichtigen} onChange={(e) => setBenachrichtigen(e.target.checked)} /> Mich nach dem Anruf benachrichtigen</label>
          {hinweise.length > 0 && <ul className="ak-warnliste">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
          <div className="ak-tun">
            <button type="button" className="pi-knopf" disabled={laeuft === "auftrag" || (!anliegen && text.trim().length < 5)} onClick={() => void auftragSenden()}>{laeuft === "auftrag" ? "Plant …" : "Aras anrufen lassen"}</button>
            <button type="button" className="pi-knopf still" onClick={() => { setModus(""); setHinweise([]); }}>Abbrechen</button>
          </div>
        </div>
      )}

      {offenAbgeben && (
        <div className="ak-maske">
          <p className="ak-satz">Aras übernimmt in <b>einem</b> Anruf, in dieser Reihenfolge:</p>
          {l.offen.map((p) => (
            <label key={p.art} className="ak-haken">
              <input type="checkbox" checked={haken.includes(p.art)} onChange={(e) => setHaken((h) => (e.target.checked ? [...h, p.art] : h.filter((x) => x !== p.art)))} /> {p.label}
            </label>
          ))}
          <p className="ak-bleibt"><b>Bleibt bei dir:</b> {l.bleibtBeiDir.join(" · ")} — dabei verbindet Aras zu dir oder bucht einen Rückruf.</p>
          <label className="ak-haken"><input type="checkbox" checked={benachrichtigen} onChange={(e) => setBenachrichtigen(e.target.checked)} /> Mich nach dem Anruf benachrichtigen</label>
          <div className="ak-tun">
            <button type="button" className="pi-knopf" disabled={laeuft === "abgeben" || !haken.length} onClick={() => void abgeben()}>{laeuft === "abgeben" ? "Gibt ab …" : `An Aras abgeben (${haken.length})`}</button>
            <button type="button" className="pi-knopf still" onClick={() => setModus("")}>Abbrechen</button>
          </div>
        </div>
      )}

      {l.geplant.length > 0 && (
        <div className="ak-block">
          <h4>Geplant</h4>
          <ul className="ak-liste">
            {l.geplant.map((g) => (
              <li key={g.id}>
                <span><b>{g.art}</b> · {g.status === "gewaehlt" || g.status === "laeuft" ? "läuft gerade" : `ab ${zeit(g.ab)}`}{g.von ? ` · von ${g.von}` : " · automatisch"}{g.versuch > 1 ? ` · Versuch ${g.versuch}` : ""}</span>
                {g.auftrag && <em>„{g.auftrag}“</em>}
                {g.punkte.length > 0 && <em>{g.punkte.join(" · ")}</em>}
                {g.zuruecknehmbar && <button type="button" className="pi-link" disabled={!!laeuft} onClick={() => void tun(`z${g.id}`, `/agent/kunden/${personId}/aras/plan/${g.id}/zuruecknehmen`, {}, "Zurückgenommen")}>zurücknehmen</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {l.verlauf.length > 0 && (
        <div className="ak-block">
          <h4>Was Aras gemacht hat</h4>
          <ul className="ak-liste">
            {l.verlauf.map((v) => (
              <li key={v.arasAnrufId} className="ak-verlauf">
                <button type="button" className="ak-zeile" onClick={() => setOffenId((x) => (x === v.arasAnrufId ? null : v.arasAnrufId))} aria-expanded={offenId === v.arasAnrufId}>
                  <span><b>{zeit(v.am)}</b> · {v.art} · {v.laeuft ? "läuft gerade" : v.ergebnisText}</span>
                  <small>{v.dauerSek ? dauer(v.dauerSek) : ""}{v.kostenEuro ? ` · ${v.kostenEuro.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : ""}</small>
                </button>
                {offenId === v.arasAnrufId && (
                  <div className="ak-detail">
                    {v.auftragVon && <p className="ak-still">Auftrag von {v.auftragVon}</p>}
                    {v.zusammenfassung && <p>{v.zusammenfassung}</p>}
                    <p className="ak-still">KI-Hinweis {v.kiHinweis ? "gesagt" : "fehlte"} · Aufnahme {v.aufnahme === "ja" ? "mit Ja" : v.aufnahme === "nein" ? "abgelehnt" : "nicht gefragt"}</p>
                    {v.hatAufnahme && <AnrufPlayer anrufId={v.callId} ton="dunkel" />}
                    {v.transkript && v.transkript.length > 0 && (
                      <details className="ak-transkript"><summary>Gespräch nachlesen</summary>
                        {v.transkript.map((t, i) => <p key={i}><b>{t.wer === "kunde" ? "Kunde" : "Aras"}:</b> {t.text}</p>)}
                      </details>
                    )}
                    {v.urteil ? <p className="ak-still">Dein Urteil: {v.urteil === "hoch" ? "Daumen hoch" : "Daumen runter"}{v.urteilGrund ? ` — ${v.urteilGrund}` : ""}</p> : !v.laeuft && (
                      <div className="ak-tun">
                        <span className="ak-still">Wie war Aras?</span>
                        <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={() => void tun(`u${v.arasAnrufId}`, `/agent/kunden/${personId}/aras/anruf/${v.arasAnrufId}/urteil`, { daumen: "hoch" }, "Danke!")}>Daumen hoch</button>
                        <input className="pi-eingabe ak-grundfeld" value={urteilGrund} maxLength={300} onChange={(e) => setUrteilGrund(e.target.value)} placeholder="Was war nicht gut? (freiwillig)" aria-label="Grund für Daumen runter" />
                        <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={() => void tun(`u${v.arasAnrufId}`, `/agent/kunden/${personId}/aras/anruf/${v.arasAnrufId}/urteil`, { daumen: "runter", grund: urteilGrund }, "Danke — fließt in den Feinschliff.", () => setUrteilGrund(""))}>Daumen runter</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ak-block ak-zwei">
        <div className="ak-feld">Was Aras wissen muss
          <textarea className="pi-eingabe ak-text" rows={2} maxLength={300} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. „nur abends erreichbar“, „spricht wenig Deutsch“" />
          <div className="ak-tun">
            <button type="button" className="pi-knopf klein still" disabled={laeuft === "notiz" || notiz === (l.notiz.text ?? "")} onClick={() => void tun("notiz", `/agent/kunden/${personId}/aras/notiz`, { text: notiz }, "Gespeichert")}>Speichern</button>
            {l.notiz.von && <small className="ak-still">zuletzt {l.notiz.von}{l.notiz.am ? `, ${zeit(l.notiz.am)}` : ""}</small>}
          </div>
        </div>
        <div className="ak-feld">Aras für diesen Kunden
          {l.sperre.aus ? (
            <>
              <p className="ak-satz">Aus{l.sperre.am ? ` seit ${zeit(l.sperre.am)}` : ""}{l.sperre.grund ? ` — „${l.sperre.grund}“` : ""}{l.sperre.von ? ` (${l.sperre.von})` : ""}.</p>
              <div className="ak-tun"><button type="button" className="pi-knopf klein still" disabled={laeuft === "schalter"} onClick={() => void tun("schalter", `/agent/kunden/${personId}/aras/schalter`, { aus: false }, "Wieder an")}>Wieder einschalten</button></div>
            </>
          ) : (
            <>
              <input className="pi-eingabe" value={sperrGrund} maxLength={200} onChange={(e) => setSperrGrund(e.target.value)} placeholder="Grund (freiwillig)" />
              <div className="ak-tun"><button type="button" className="pi-knopf klein still" disabled={laeuft === "schalter"} onClick={() => void tun("schalter", `/agent/kunden/${personId}/aras/schalter`, { aus: true, grund: sperrGrund }, "Aras ist für diesen Kunden aus", () => setSperrGrund(""))}>Aras für diesen Kunden aus</button></div>
            </>
          )}
          {l.sperre.telefonGesperrt && <small className="ak-still">Der Kunde will gar keine Anrufe mehr — die Sperre gilt für alle.</small>}
        </div>
      </div>
    </section>
  );
}
