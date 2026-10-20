// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/ki-qualitaet — PRÜF-MARA (E-409, 19.10.2026)
//
// Fehlerquote je Werkzeug/Spielart/Kanal, die Befunde (nur Auffälliges hat eine
// Karte), „Jetzt prüfen“, Vorschläge „gelb → grün“. Prüfquote steht in den
// Einstellungen. Keine Mitarbeiter-Pflicht — die zweite KI prüft die erste.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { akteLink } from "@/lib/akte-link";
import type { Fehlerquote, PruefZeile } from "@shared/fiaon-ki-team";
import { Kopf, KiRundgang, Fehler, Stand, Meldung, useMeldung, useTakt, senden, zahl, tagZeit } from "./ki-teile";

const KANAL: Record<string, string> = { telefon: "Telefon", mail: "Mail", whatsapp: "WhatsApp" };
const URTEIL: Record<string, { text: string; ton: string }> = { ok: { text: "ok", ton: "gut" }, auffaellig: { text: "auffällig", ton: "warn" }, fehler: { text: "Regelverstoß", ton: "krit" } };

export default function ChefKiQualitaet() {
  const [tage, setTage] = useState(7);
  const [kanal, setKanal] = useState<string>("");
  const [urteil, setUrteil] = useState<string>("");
  const pfad = `/chef/ki/qualitaet?tage=${tage}${kanal ? `&kanal=${kanal}` : ""}${urteil ? `&urteil=${urteil}` : ""}`;
  const { daten, fehler, neu, geladenAm } = useTakt<{ ok: boolean; quote: Fehlerquote; liste: PruefZeile[]; stand: { heute: number; auffaellig: number; offenKarten: number; letzterLauf: { am: string; geprueft: number; auffaellig: number; grund?: string } | null } }>(pfad, 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const meld = useMeldung();
  const jetzt = async () => {
    setBusy("jetzt");
    try { const r = await senden<{ geprueft: number; auffaellig: number; grund?: string }>("/chef/ki/pruefung/jetzt"); meld.gut(r.grund === "schalter_aus" ? "Prüf-Mara ist ausgeschaltet (Einstellungen › Leitplanken)." : `${r.geprueft} geprüft, ${r.auffaellig} auffällig.`); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const entscheiden = async (z: PruefZeile, was: "in_ordnung" | "anweisen" | "sperren") => {
    setBusy(`p${z.id}`);
    try { const r = await senden<{ hinweis: string | null }>(`/chef/ki/pruefung/${z.id}`, { was }); meld.gut(r.hinweis ?? "Entschieden."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const q = daten?.quote;
  const g = q?.gesamt;
  return (
    <div className="ki ki-qualitaet">
      <KiRundgang schluessel="kiQualitaet" raum="ki-qualitaet" />
      <Kopf titel="Qualität · Prüf-Mara" satz="Die zweite KI prüft die erste — Karten nur bei Auffälligem." kinder={
        <>
          <button type="button" className="ki-knopf klein" data-ki="jetzt" disabled={busy === "jetzt"} onClick={jetzt} title="Einen Prüf-Lauf jetzt starten (sonst alle 2 Minuten).">Jetzt prüfen</button>
          <a className="ki-pille" href="/chef/s/ki-einstellungen#leitplanken" title="Prüfquote je Kanal und Deckel stehen in den Einstellungen.">Quote & Deckel</a>
          <Stand am={geladenAm} neu={neu} />
        </>
      } />
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <section className="ki-buehne" data-ki="buehne" aria-label="Fehlerquote">
        <div className="ki-zahlen">
          <div><span className={`ki-zahl${g && g.quote >= 5 ? " ki-warn-t" : ""}`}>{g ? `${g.quote.toLocaleString("de-DE")} %` : "—"}</span><small>auffällig ({tage} Tage)</small></div>
          <div><span className="ki-zahl">{zahl(g?.n)}</span><small>geprüft</small></div>
          <div><span className="ki-zahl">{zahl(daten?.stand.heute)}</span><small>heute geprüft</small></div>
          <div><span className={`ki-zahl${daten?.stand.offenKarten ? " ki-warn-t" : ""}`}>{zahl(daten?.stand.offenKarten)}</span><small>Karten offen</small></div>
        </div>
        <p className="ki-still ki-klein ki-abstand">
          {daten?.stand.letzterLauf ? `Letzter Lauf ${tagZeit(daten.stand.letzterLauf.am)}: ${daten.stand.letzterLauf.geprueft} geprüft${daten.stand.letzterLauf.grund === "schalter_aus" ? " · Prüf-Mara ist AUS" : ""}.` : "Seit dem Start noch kein Lauf — alle 2 Minuten."}
        </p>
        {q?.vorschlaege.length ? <ul className="ki-liste ki-abstand">{q.vorschlaege.map((v, i) => <li key={i} className="ki-zeile"><span><span className="ki-punkt gruen" aria-hidden="true" /> {v} <a href="/chef/s/ki-werkzeuge">Werkzeuge</a></span></li>)}</ul> : null}
        <Meldung m={meld.m} />
      </section>
      <div className="ki-raster zwei ki-abstand">
        <section className="ki-karte" data-ki="quote" aria-label="Quote je Werkzeug">
          <h2>Je Werkzeug / Spielart <span className="ki-still ki-klein">· {tage} Tage</span></h2>
          <div className="ki-segment" role="group" aria-label="Zeitraum">
            {[7, 28, 90].map((t) => <button key={t} type="button" className={tage === t ? "an" : ""} onClick={() => setTage(t)}>{t} Tage</button>)}
          </div>
          {!q?.je.length ? <p className="ki-still ki-abstand">Noch keine Prüfungen in diesem Zeitraum.</p> : (
            <ul className="ki-liste ki-abstand">
              {q.je.slice(0, 20).map((z, i) => (
                <li key={i} className="ki-zeile ki-zeile-rechts">
                  <div className="ki-zeile-kopf"><span className="ki-etikett">{KANAL[z.kanal] ?? z.kanal}</span><b>{z.schluessel.replace(/^(postfach|aktion|vorlage|spielart):/, "")}</b><span className="ki-still ki-klein">{zahl(z.n)} geprüft</span></div>
                  <span className={`ki-zahl${z.quote >= 5 ? " ki-warn-t" : ""}`}>{z.quote.toLocaleString("de-DE")} %</span>
                  <span className="ki-zeile-satz"><span className="ki-balken"><i className={z.quote >= 10 ? "krit" : z.quote >= 5 ? "warn" : ""} style={{ width: `${Math.min(100, z.quote * 4)}%` }} /></span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="ki-karte" data-ki="befunde" aria-label="Befunde">
          <h2>Befunde</h2>
          <div className="ki-chips">
            <div className="ki-segment" role="group" aria-label="Kanal">
              {["", "telefon", "mail", "whatsapp"].map((k) => <button key={k || "alle"} type="button" className={kanal === k ? "an" : ""} onClick={() => setKanal(k)}>{k ? KANAL[k] : "alle"}</button>)}
            </div>
            <div className="ki-segment" role="group" aria-label="Urteil">
              {["", "auffaellig", "fehler"].map((u) => <button key={u || "alle"} type="button" className={urteil === u ? "an" : ""} onClick={() => setUrteil(u)}>{u ? URTEIL[u].text : "alle Urteile"}</button>)}
            </div>
          </div>
          {!daten?.liste.length ? <p className="ki-still ki-abstand">Keine Befunde.</p> : (
            <ul className="ki-liste ki-abstand">
              {daten.liste.map((z) => {
                const u = URTEIL[z.urteil] ?? URTEIL.ok;
                const link = z.personId ? akteLink(z.personId, "chef") : null;
                const auf = offen === z.id;
                return (
                  <li key={z.id} className="ki-zeile" data-ki-pruefung={z.id}>
                    <div className="ki-zeile-kopf">
                      <span className={`ki-punkt ${u.ton}`} aria-hidden="true" />
                      <b>{u.text}</b>
                      <span className="ki-still ki-klein">{KANAL[z.kanal] ?? z.kanal} · {tagZeit(z.am)}{z.schluessel ? ` · ${z.schluessel.replace(/^(postfach|aktion|vorlage|spielart):/, "")}` : ""}</span>
                      {link ? <a href={link}>{z.name || "Akte"}</a> : null}
                      {z.entschieden ? <span className="ki-pille">{z.entschieden === "in_ordnung" ? "in Ordnung" : z.entschieden === "anweisen" ? "angewiesen" : z.entschieden === "neu_bewertet" ? "neu bewertet" : "gesperrt"}</span> : null}
                    </div>
                    <button type="button" className="ki-knopf text ki-klein" onClick={() => setOffen(auf ? null : z.id)}>{auf ? "weniger" : `${z.punkte.length} Punkt${z.punkte.length === 1 ? "" : "e"}`}</button>
                    {auf ? (
                      <div className="ki-zeile-satz">
                        {z.punkte.length ? <ul className="ki-liste">{z.punkte.map((p, i) => <li key={i}><span className={`ki-punkt ${p.schwere === "hart" ? "rot" : "gelb"}`} aria-hidden="true" /> <b className="ki-leise">{p.regel.replace(/_/g, " ")}</b>: {p.hinweis}{p.treffer ? <span className="ki-still"> — „{p.treffer}“</span> : null}</li>)}</ul> : <span>Keine Punkte.</span>}
                        {z.begruendung ? <p className="ki-still">{z.begruendung}</p> : null}
                        <p className="ki-still ki-klein">Modell: {z.modell ?? "—"} · {(z.kostenCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
                        {z.urteil !== "ok" && !z.entschieden ? (
                          <div className="ki-chips" style={{ marginTop: 6 }}>
                            <button type="button" className="ki-knopf klein" disabled={busy === `p${z.id}`} onClick={() => entscheiden(z, "in_ordnung")}>In Ordnung</button>
                            <button type="button" className="ki-knopf klein" disabled={busy === `p${z.id}`} onClick={() => entscheiden(z, "anweisen")} title="Der Hinweis wandert in die Hausanweisung des Kanals.">{z.kanal === "telefon" ? "Aras anweisen" : "Mara anweisen"}</button>
                            {z.kanal === "telefon" && z.personId ? <button type="button" className="ki-knopf klein warn" disabled={busy === `p${z.id}`} onClick={() => entscheiden(z, "sperren")}>Person für Aras sperren</button> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
