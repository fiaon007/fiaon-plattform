// ═══════════════════════════════════════════════════════════════════════════
// ARAS IN DER AKTE (E-408 Scheibe 2, Nachtrag Akte-Steuerung 19.10.2026)
//
// Justin: „in der Akte ein Knopf wie ‚ARAS anrufen lassen‘ mit Erklärung, was das ist … individuelle Sachen eintippen … oder
// mit 1 Klick die Arbeit abgeben.“ — und 20.10.2026: „… am besten öffnet sich so ein kurzer Chat wo genau abgefragt wird
// damit ARAS perfekt arbeiten kann“.
//
// EINE Karte, zwei Orte (Office-Akte und Chefbüro-Akte — beide sind pipeline.tsx `Akte`):
//   · ARAS anrufen lassen — öffnet den Auftrags-Chat (ArasBriefingChat): ARAS schlägt aus der Akte EINES vor, fragt
//     höchstens dreimal nach und zeigt die Auftragskarte; geht Anrufen gerade nicht, sagt der Chat in EINEM Satz warum
//     und bietet Mara an. Der Knopf ist nie grau.
//   · Offenes an ARAS abgeben — alles Offene mit Häkchen, EIN Anruf; was bei dir bleibt, steht daneben.
//   · Geplant (zurücknehmen) · Was ARAS gemacht hat (Ergebnis, Aufnahme nur nach Ja, Daumen) — mit dem Auftrag aus dem
//     Chat: wer hat was angewiesen, Chat nachlesen.
//   · Was ARAS wissen muss · ARAS für diesen Kunden aus
// Server: server/routes/fiaon-aras-akte.ts (+ fiaon-aras-briefing-chat.ts) · Lage: server/lib/fiaon-aras-akte.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { api } from "@/pages/agent/shared";
import { AnrufPlayer } from "@/components/AnrufPlayer";
import { ArasBriefingChat, BriefingKurz } from "@/components/agent/ArasBriefingChat";
import type { BriefingSicht } from "@shared/fiaon-aras-briefing-chat";
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

export function ArasKarte({ personId, melden }: { personId: number; melden: Melden }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [briefings, setBriefings] = useState<BriefingSicht[]>([]);
  const [chat, setChat] = useState(false);
  const [abgebenOffen, setAbgebenOffen] = useState(false);
  const [erklaert, setErklaert] = useState(false);
  const [benachrichtigen, setBenachrichtigen] = useState(true);
  const [haken, setHaken] = useState<string[]>([]);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const [sperrGrund, setSperrGrund] = useState("");
  const [offenId, setOffenId] = useState<number | null>(null);
  const [urteilGrund, setUrteilGrund] = useState("");

  const laden = useCallback(async () => {
    const [r, b] = await Promise.all([api(`/agent/kunden/${personId}/aras`), api(`/agent/kunden/${personId}/aras/briefings`)]);
    if (r.ok) { setLage(r.json); setNotiz(r.json.notiz?.text ?? ""); }
    if (b.ok && Array.isArray(b.json?.briefings)) setBriefings(b.json.briefings);
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { setChat(false); setAbgebenOffen(false); setHinweise([]); }, [personId]);

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
  const abgeben = () => tun("abgeben", `/agent/kunden/${personId}/aras/auftrag`,
    { punkte: haken, wann: "bald", benachrichtigen, abgeben: true }, "An ARAS abgegeben", () => setAbgebenOffen(false));

  const l = lage;
  /** Der Auftrag aus dem Chat zu einem Plan-Eintrag bzw. einem Anruf (wer hat was angewiesen). */
  const ausChatPlan = (id: number) => briefings.find((b) => b.planIds.includes(id)) ?? null;
  const ausChatAnruf = (id: number) => briefings.find((b) => b.arasAnrufIds.includes(id)) ?? null;
  return (
    <section className={`ak${chat ? " mit-chat" : ""}`} data-fiaon="aras-karte">
      <div className="ak-kopf">
        <div>
          <b>ARAS</b> <span className="ak-still">KI-Kollegin am Telefon</span>
          <p>ARAS ruft den Kunden an, klärt das Anliegen und erledigt, was sie kann — Zahlungslink, Zusage, Termin, Unterlagen anfordern.</p>
          <button type="button" className="ak-link" onClick={() => setErklaert((x) => !x)} aria-expanded={erklaert}>Was passiert dann?</button>
          {erklaert && (
            <ol className="ak-schritte">
              <li>Du sagst ARAS im Chat, was sie sagen oder fragen soll — sie fragt höchstens dreimal nach und zeigt dir den Auftrag.</li>
              <li>ARAS ruft im Anruffenster an — höchstens einmal am Tag und dreimal die Woche (du und ARAS zusammen). Im ersten Satz sagt sie, dass sie eine KI ist; aufgezeichnet wird nur, wenn der Kunde Ja sagt.</li>
              <li>Das Ergebnis steht danach hier in der Akte — wie bei deinem eigenen Anruf. Du bekommst eine Nachricht im Office.</li>
            </ol>
          )}
        </div>
        <div className="ak-knoepfe">
          <button type="button" className="pi-knopf klein" disabled={!!laeuft} aria-expanded={chat}
                  onClick={() => { setAbgebenOffen(false); setChat((x) => !x); }}>ARAS anrufen lassen</button>
          <button type="button" className="pi-knopf klein still" disabled={!l.offen.length || !!laeuft}
                  onClick={() => {
                    // Geht Anrufen gerade nicht, sagt es der Chat (mit Mara als Weg) — statt einer Maske, die nichts einplanen kann.
                    if (!l.geht.ok) { setChat(true); setAbgebenOffen(false); return; }
                    setHaken(l.offen.map((p) => p.art)); setChat(false); setAbgebenOffen((x) => !x);
                  }}
                  title={l.offen.length ? "Alles Offene in EINEM Anruf" : "Gerade ist nichts offen, was ARAS übernehmen kann."}>Offenes an ARAS abgeben</button>
        </div>
      </div>
      {!chat && !l.geht.ok && l.geht.grund && <p className="ak-grund">{l.geht.grund}</p>}
      {!chat && l.geht.ok && l.hinweis && <p className="ak-hinweis">{l.hinweis}</p>}

      {chat && <ArasBriefingChat personId={personId} melden={melden} onZu={() => setChat(false)} onGeaendert={() => void laden()} />}

      {abgebenOffen && !chat && (
        <div className="ak-maske">
          <p className="ak-satz">ARAS übernimmt in <b>einem</b> Anruf, in dieser Reihenfolge:</p>
          {l.offen.map((p) => (
            <label key={p.art} className="ak-haken">
              <input type="checkbox" checked={haken.includes(p.art)} onChange={(e) => setHaken((h) => (e.target.checked ? [...h, p.art] : h.filter((x) => x !== p.art)))} /> {p.label}
            </label>
          ))}
          <p className="ak-bleibt"><b>Bleibt bei dir:</b> {l.bleibtBeiDir.join(" · ")} — dabei verbindet ARAS zu dir oder bucht einen Rückruf.</p>
          <label className="ak-haken"><input type="checkbox" checked={benachrichtigen} onChange={(e) => setBenachrichtigen(e.target.checked)} /> Mich nach dem Anruf benachrichtigen</label>
          {hinweise.length > 0 && <ul className="ak-warnliste">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
          <div className="ak-tun">
            <button type="button" className="pi-knopf" disabled={laeuft === "abgeben" || !haken.length} onClick={() => void abgeben()}>{laeuft === "abgeben" ? "Gibt ab …" : `An ARAS abgeben (${haken.length})`}</button>
            <button type="button" className="pi-knopf still" onClick={() => setAbgebenOffen(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {l.geplant.length > 0 && (
        <div className="ak-block">
          <h4>Geplant</h4>
          <ul className="ak-liste">
            {l.geplant.map((g) => {
              const b = ausChatPlan(g.id);
              return (
                <li key={g.id}>
                  <span><b>{g.art}</b> · {g.status === "gewaehlt" || g.status === "laeuft" ? "läuft gerade" : `ab ${zeit(g.ab)}`}{g.von ? ` · von ${g.von}` : " · automatisch"}{g.versuch > 1 ? ` · Versuch ${g.versuch}` : ""}</span>
                  {b ? <BriefingKurz b={b} /> : g.auftrag && <em>„{g.auftrag}“</em>}
                  {g.punkte.length > 0 && <em>{g.punkte.join(" · ")}</em>}
                  {g.zuruecknehmbar && <button type="button" className="pi-link" disabled={!!laeuft} onClick={() => void tun(`z${g.id}`, `/agent/kunden/${personId}/aras/plan/${g.id}/zuruecknehmen`, {}, "Zurückgenommen")}>zurücknehmen</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {l.verlauf.length > 0 && (
        <div className="ak-block">
          <h4>Was ARAS gemacht hat</h4>
          <ul className="ak-liste">
            {l.verlauf.map((v) => {
              const b = ausChatAnruf(v.arasAnrufId);
              return (
                <li key={v.arasAnrufId} className="ak-verlauf">
                  <button type="button" className="ak-zeile" onClick={() => setOffenId((x) => (x === v.arasAnrufId ? null : v.arasAnrufId))} aria-expanded={offenId === v.arasAnrufId}>
                    <span><b>{zeit(v.am)}</b> · {v.art} · {v.laeuft ? "läuft gerade" : v.ergebnisText}</span>
                    <small>{v.dauerSek ? dauer(v.dauerSek) : ""}{v.kostenEuro ? ` · ${v.kostenEuro.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : ""}</small>
                  </button>
                  {offenId === v.arasAnrufId && (
                    <div className="ak-detail">
                      {b ? <BriefingKurz b={b} /> : v.auftragVon && <p className="ak-still">Auftrag von {v.auftragVon}</p>}
                      {v.zusammenfassung && <p>{v.zusammenfassung}</p>}
                      <p className="ak-still">KI-Hinweis {v.kiHinweis ? "gesagt" : "fehlte"} · Aufnahme {v.aufnahme === "ja" ? "mit Ja" : v.aufnahme === "nein" ? "abgelehnt" : "nicht gefragt"}</p>
                      {v.hatAufnahme && <AnrufPlayer anrufId={v.callId} ton="dunkel" />}
                      {v.transkript && v.transkript.length > 0 && (
                        <details className="ak-transkript"><summary>Gespräch nachlesen</summary>
                          {v.transkript.map((t, i) => <p key={i}><b>{t.wer === "kunde" ? "Kunde" : "ARAS"}:</b> {t.text}</p>)}
                        </details>
                      )}
                      {v.urteil ? <p className="ak-still">Dein Urteil: {v.urteil === "hoch" ? "Daumen hoch" : "Daumen runter"}{v.urteilGrund ? ` — ${v.urteilGrund}` : ""}</p> : !v.laeuft && (
                        <div className="ak-tun">
                          <span className="ak-still">Wie war ARAS?</span>
                          <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={() => void tun(`u${v.arasAnrufId}`, `/agent/kunden/${personId}/aras/anruf/${v.arasAnrufId}/urteil`, { daumen: "hoch" }, "Danke!")}>Daumen hoch</button>
                          <input className="pi-eingabe ak-grundfeld" value={urteilGrund} maxLength={300} onChange={(e) => setUrteilGrund(e.target.value)} placeholder="Was war nicht gut? (freiwillig)" aria-label="Grund für Daumen runter" />
                          <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={() => void tun(`u${v.arasAnrufId}`, `/agent/kunden/${personId}/aras/anruf/${v.arasAnrufId}/urteil`, { daumen: "runter", grund: urteilGrund }, "Danke — fließt in den Feinschliff.", () => setUrteilGrund(""))}>Daumen runter</button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="ak-block ak-zwei">
        <div className="ak-feld">Was ARAS wissen muss
          <textarea className="pi-eingabe ak-text" rows={2} maxLength={300} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. „nur abends erreichbar“, „spricht wenig Deutsch“" />
          <div className="ak-tun">
            <button type="button" className="pi-knopf klein still" disabled={laeuft === "notiz" || notiz === (l.notiz.text ?? "")} onClick={() => void tun("notiz", `/agent/kunden/${personId}/aras/notiz`, { text: notiz }, "Gespeichert")}>Speichern</button>
            {l.notiz.von && <small className="ak-still">zuletzt {l.notiz.von}{l.notiz.am ? `, ${zeit(l.notiz.am)}` : ""}</small>}
          </div>
        </div>
        <div className="ak-feld">ARAS für diesen Kunden
          {l.sperre.aus ? (
            <>
              <p className="ak-satz">Aus{l.sperre.am ? ` seit ${zeit(l.sperre.am)}` : ""}{l.sperre.grund ? ` — „${l.sperre.grund}“` : ""}{l.sperre.von ? ` (${l.sperre.von})` : ""}.</p>
              <div className="ak-tun"><button type="button" className="pi-knopf klein still" disabled={laeuft === "schalter"} onClick={() => void tun("schalter", `/agent/kunden/${personId}/aras/schalter`, { aus: false }, "Wieder an")}>Wieder einschalten</button></div>
            </>
          ) : (
            <>
              <input className="pi-eingabe" value={sperrGrund} maxLength={200} onChange={(e) => setSperrGrund(e.target.value)} placeholder="Grund (freiwillig)" />
              <div className="ak-tun"><button type="button" className="pi-knopf klein still" disabled={laeuft === "schalter"} onClick={() => void tun("schalter", `/agent/kunden/${personId}/aras/schalter`, { aus: true, grund: sperrGrund }, "ARAS ist für diesen Kunden aus", () => setSperrGrund(""))}>ARAS für diesen Kunden aus</button></div>
            </>
          )}
          {l.sperre.telefonGesperrt && <small className="ak-still">Der Kunde will gar keine Anrufe mehr — die Sperre gilt für alle.</small>}
        </div>
      </div>
    </section>
  );
}
