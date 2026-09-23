// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/provisionen — die Provisionsautomatik (23.09.2026)
//
// Ein Schalter, und daneben die Rechnung dazu: Was wäre gebucht worden,
// solange er aus ist? Nichts geht verloren — jede Vormerkung lässt sich mit
// einem Klick nachbuchen oder verwerfen.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { API, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import "@/styles/chef-provisionen.css";

interface Vormerkung {
  id: number; agent: string; kunde: string | null; ref: string | null; zahlung: string | null; paket: string | null;
  betragEuro: number; satz: number; basisEuro: number; art: string; quelle: string | null;
  anlass: string; notiz: string | null; am: string; erledigtAm: string | null; erledigtVon: string | null;
}
interface Stand {
  an: boolean;
  status: string;
  zahlen: { offen: number; offenEuro: number; gebucht: number; verworfen: number };
  vormerkungen: Vormerkung[];
  letzteBuchungen: { id: number; agent: string; ref: string | null; betragEuro: number; art: string; status: string; am: string }[];
}

const euro = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

export default function ChefProvisionen() {
  const [status, setStatus] = useState<"offen" | "gebucht" | "verworfen">("offen");
  const stand = useDaten<Stand>(`/chef/provisionen/stand?status=${status}`, [status]);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const s = stand.daten;

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 7000); };

  const schalten = async (an: boolean) => {
    if (an && !window.confirm("Automatik wieder einschalten?\n\nAb sofort wird jede Provision wieder sofort gebucht. Offene Vormerkungen bleiben stehen — die buchst du separat.")) return;
    setBeschaeftigt("schalter");
    try { await senden("/chef/provisionen/automatik", { an }); melden(an ? "Automatik läuft wieder." : "Automatik ist aus — ab jetzt wird nur noch vorgemerkt."); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const buchen = async (id: number) => {
    setBeschaeftigt(`b${id}`);
    try { const j = await senden("/chef/provisionen/buchen", { id }); melden(j.hinweis || "Gebucht."); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const alleBuchen = async () => {
    if (!s || !window.confirm(`${s.zahlen.offen} Vormerkungen über ${euro(s.zahlen.offenEuro)} jetzt buchen?`)) return;
    setBeschaeftigt("alle");
    try { const j = await senden("/chef/provisionen/alle-buchen", {}); melden(`${j.gebucht} gebucht.`); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const verwerfen = async (v: Vormerkung) => {
    const grund = window.prompt(`Vormerkung über ${euro(v.betragEuro)} für ${v.agent} verwerfen. Warum?`, "");
    if (grund === null) return;
    setBeschaeftigt(`v${v.id}`);
    try { await senden("/chef/provisionen/verwerfen", { id: v.id, grund }); melden("Verworfen."); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };

  return (
    <div className="pv">
      {stand.laedt && !s && <Geruest zeilen={6} />}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && (
        <>
          <header className="pv-kopf">
            <div>
              <h1>Provisionen</h1>
              <p className="pv-still">
                {s.an
                  ? "Jede bestätigte Zahlung bucht die Provision sofort — wie immer."
                  : "Die Automatik ist aus. Es wird nichts gebucht, sondern vorgemerkt — hier nachzubuchen, wenn du es willst."}
              </p>
            </div>
            <button type="button" className={`pv-schalter${s.an ? " an" : ""}`} onClick={() => void schalten(!s.an)} disabled={beschaeftigt === "schalter"} aria-pressed={s.an}>
              <span aria-hidden="true" />{s.an ? "Automatik läuft" : "Automatik aus"}
            </button>
          </header>

          <section className="pv-zahlen" aria-label="Stand">
            <div className="pv-zahl"><span>Vorgemerkt</span><b>{s.zahlen.offen}</b><small>seit dem Abschalten</small></div>
            <div className="pv-zahl gross"><span>Summe offen</span><b>{euro(s.zahlen.offenEuro)}</b><small>nicht gebucht, nicht ausgezahlt</small></div>
            <div className="pv-zahl"><span>Nachgebucht</span><b>{s.zahlen.gebucht}</b><small>von Hand freigegeben</small></div>
            <div className="pv-zahl"><span>Verworfen</span><b>{s.zahlen.verworfen}</b><small>mit Begründung</small></div>
          </section>

          <div className="pv-leiste">
            <div className="pv-reiter">
              {([["offen", "Offen"], ["gebucht", "Gebucht"], ["verworfen", "Verworfen"]] as const).map(([k, t]) => (
                <button key={k} type="button" className={status === k ? "an" : ""} onClick={() => setStatus(k)}>{t}</button>
              ))}
            </div>
            {status === "offen" && s.zahlen.offen > 0 && (
              <button type="button" className="pv-knopf voll" onClick={() => void alleBuchen()} disabled={!!beschaeftigt}>
                {beschaeftigt === "alle" ? "Bucht …" : `Alle ${s.zahlen.offen} buchen`}
              </button>
            )}
          </div>

          {s.vormerkungen.length === 0 ? (
            <p className="pv-leer">
              {status === "offen"
                ? (s.an ? "Nichts vorgemerkt — die Automatik läuft ja." : "Noch nichts vorgemerkt. Sobald eine Zahlung gebucht wird, erscheint sie hier.")
                : "Nichts in dieser Liste."}
            </p>
          ) : (
            <div className="pv-tabelle-huelle">
              <table className="pv-tabelle">
                <thead>
                  <tr><th>Mensch</th><th>Mitarbeiter</th><th>Anlass</th><th className="r">Basis</th><th className="r">Satz</th><th className="r">Betrag</th><th>Wann</th><th /></tr>
                </thead>
                <tbody>
                  {s.vormerkungen.map((v) => (
                    <tr key={v.id}>
                      <td><b>{v.kunde ?? "—"}</b><span className="pv-still"> {v.ref ?? ""}</span></td>
                      <td>{v.agent}{v.art !== "own" ? <span className="pv-marke">{v.art}</span> : null}</td>
                      <td>{v.anlass}{v.paket ? <span className="pv-still"> · {v.paket}</span> : null}</td>
                      <td className="r">{euro(v.basisEuro)}</td>
                      <td className="r">{v.satz.toLocaleString("de-DE")} %</td>
                      <td className="r"><b>{euro(v.betragEuro)}</b></td>
                      <td className="pv-still">{seit(v.am)}</td>
                      <td className="pv-tat">
                        {status === "offen" ? (
                          <>
                            <button type="button" className="pv-knopf" disabled={!!beschaeftigt} onClick={() => void buchen(v.id)}>
                              {beschaeftigt === `b${v.id}` ? "…" : "Buchen"}
                            </button>
                            <button type="button" className="pv-klein" disabled={!!beschaeftigt} onClick={() => void verwerfen(v)}>Verwerfen</button>
                          </>
                        ) : (
                          <span className="pv-still">{v.erledigtVon ?? ""}{v.erledigtAm ? ` · ${seit(v.erledigtAm)}` : ""}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details className="pv-letzte">
            <summary>Die letzten echten Buchungen ({s.letzteBuchungen.length})</summary>
            <div className="pv-tabelle-huelle">
              <table className="pv-tabelle">
                <thead><tr><th>Mitarbeiter</th><th>Antrag</th><th>Art</th><th className="r">Betrag</th><th>Status</th><th>Wann</th></tr></thead>
                <tbody>
                  {s.letzteBuchungen.map((c) => (
                    <tr key={c.id}>
                      <td>{c.agent}</td><td>{c.ref ?? "—"}</td><td>{c.art}</td>
                      <td className="r">{euro(c.betragEuro)}</td><td>{c.status}</td><td className="pv-still">{seit(c.am)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {meldung && <div className="pv-meldung" role="status">{meldung}</div>}
    </div>
  );
}
