// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/ki-einstellungen — EINSTELLUNGEN & KASSE (E-409, 19.10.2026)
//
// Rendert NUR das Schalter-Register (shared/fiaon-ki-schalter.ts): je Schalter
// ein Satz, Vorgabe und Grenze im Tooltip, Speichern über den Setzer des
// Eintrags (nicht eine Sammelroute). Was keinen Setzer hat, steht hier nicht.
// Kasse: KI + Telefon je Tag und Dienst, Deckel, Anbieter, KI-Pause. Protokoll:
// wer hat was geschaltet (fiaon_admin_log) und Maras/Aras’ Ereignisse.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { GRUPPEN, setzerKoerper, wertPruefen, grenzeText, rueckfrageFuer, type RegisterEintrag, type SchalterGruppe } from "@shared/fiaon-ki-schalter";
import type { KostenDienst } from "@shared/fiaon-ki-team";
import { Kopf, KiRundgang, NichtVerbunden, Fehler, Stand, Meldung, useMeldung, useTakt, senden, euro, tagZeit } from "./ki-teile";

type Eintrag = Omit<RegisterEintrag, "jsonPruefen" | "muss"> & { muss?: string };
interface Daten { ok: boolean; register: Eintrag[]; werte: Record<string, string>; gesetzt: Record<string, boolean>; arasVerbunden: boolean }
interface Kosten { ok: boolean; heute: KostenDienst[]; verlauf: { tag: string; ki: number; telefon: number }[]; anbieter: string }
interface Protokoll { ok: boolean; schaltungen: { am: string; wer: string; methode: string; pfad: string; ziel: string | null; notiz: string | null }[]; ereignisse: { id: number; am: string; kanal: string; art: string; ok: boolean; text: string; personId: number | null; name: string | null }[] }

export function Feld({ e, wert, gesetzt, busy, onSpeichern }: { e: Eintrag; wert: string; gesetzt: boolean; busy: boolean; onSpeichern: (e: Eintrag, w: string) => Promise<void> }) {
  // E-409 Fund 11: Geheime Werte (Justins Probe-Nummer) kommen nur verdeckt an („••• 678“) — das Feld startet leer,
  // die verdeckte Nummer steht als Platzhalter; gespeichert wird nur, was neu eingetippt wurde.
  const start = e.geheim ? "" : wert;
  const [w, setW] = useState(start);
  useEffect(() => { setW(start); }, [start]);
  const geaendert = w !== start;
  // Dieselbe Grenze wie auf dem Server — hier nur zur Anzeige (muss als Quelltext, kein RegExp-Objekt nach JSON).
  const pruef = useMemo(() => wertPruefen({ ...(e as any), muss: e.muss ? new RegExp(e.muss) : undefined } as RegisterEintrag, w), [e, w]);
  const titel = grenzeText({ ...(e as any), muss: undefined } as RegisterEintrag);
  // E-409 Fund 17: folgenreiche Schalter (Aras wählt, Runde „jetzt“, alte Entwürfe ablegen) fragen VOR dem Speichern nach.
  const fragen = (neu: string) => { const f = rueckfrageFuer(e, neu); return !f || window.confirm(f); };
  const speichern = () => { if (pruef.ok && fragen(pruef.wert)) void onSpeichern(e, pruef.wert); };
  const an = e.typ === "an_aus" ? w === "an" : w === "1";
  return (
    <div className={`ki-feld${geaendert ? " geaendert" : ""}`} data-ki-schalter={e.schluessel}>
      <label htmlFor={`ks-${e.schluessel}`} title={titel}>{e.label}{!gesetzt ? <span className="ki-still ki-klein"> · Vorgabe</span> : null}</label>
      <small>{e.satz}</small>
      <div className="ki-eingabe">
        {e.typ === "an_aus" || e.typ === "eins_null" ? (
          <button id={`ks-${e.schluessel}`} type="button" className={`ki-schalter${an ? " an" : ""}`} aria-pressed={an} disabled={busy} title={titel}
            onClick={() => { const neu = e.typ === "an_aus" ? (an ? "aus" : "an") : (an ? "0" : "1"); if (!fragen(neu)) return; setW(neu); void onSpeichern(e, neu); }}>
            <span className="bahn" aria-hidden="true" /><span>{an ? "an" : "aus"}</span>
          </button>
        ) : e.typ === "enum" ? (
          <select id={`ks-${e.schluessel}`} value={w} disabled={busy} onChange={(ev) => { const neu = ev.target.value; if (!fragen(neu)) return; setW(neu); void onSpeichern(e, neu); }}>
            {(e.enum ?? []).map((o) => <option key={o} value={o}>{e.enumText?.[o] ?? o}</option>)}
          </select>
        ) : e.typ === "zahl" ? (
          <>
            <input id={`ks-${e.schluessel}`} type="number" value={w} min={e.min} max={e.max} disabled={busy} onChange={(ev) => setW(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && speichern()} />
            {geaendert ? <button type="button" className="ki-knopf klein haupt" disabled={busy || !pruef.ok} onClick={speichern} title={pruef.ok ? "Speichern" : pruef.fehler}>OK</button> : null}
          </>
        ) : e.typ === "json" || (e.maxZeichen ?? 0) > 120 ? (
          <>
            <textarea id={`ks-${e.schluessel}`} className="breit" value={w} disabled={busy} onChange={(ev) => setW(ev.target.value)} />
            {geaendert ? <button type="button" className="ki-knopf klein haupt" disabled={busy || !pruef.ok} onClick={speichern} title={pruef.ok ? "Speichern" : pruef.fehler}>OK</button> : null}
          </>
        ) : (
          <>
            <input id={`ks-${e.schluessel}`} type="text" className="breit" value={w} maxLength={e.maxZeichen} disabled={busy} placeholder={e.geheim ? (wert ? `${wert} (gesetzt) — neue eintippen` : "noch keine") : undefined} autoComplete={e.geheim ? "off" : undefined} onChange={(ev) => setW(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && speichern()} />
            {geaendert ? <button type="button" className="ki-knopf klein haupt" disabled={busy || !pruef.ok} onClick={speichern} title={pruef.ok ? "Speichern" : pruef.fehler}>OK</button> : null}
          </>
        )}
        {geaendert && !pruef.ok ? <span className="ki-krit-t ki-klein">{pruef.fehler}</span> : null}
      </div>
    </div>
  );
}

export default function ChefKiEinstellungen() {
  const { daten, fehler, neu, geladenAm } = useTakt<Daten>("/chef/ki/einstellungen", 0);
  const kosten = useTakt<Kosten>("/chef/ki/kosten?tage=14", 60_000);
  const protokoll = useTakt<Protokoll>("/chef/ki/protokoll?tage=7", 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  const speichern = async (e: Eintrag, w: string) => {
    setBusy(e.schluessel);
    try {
      await senden(e.setzer.route, setzerKoerper(e as RegisterEintrag, w));
      meld.gut(`${e.label}: gespeichert.`); neu(); kosten.neu();
    } catch (err) { meld.fehler(`${e.label}: ${(err as Error).message}`); } finally { setBusy(null); }
  };
  const register = daten?.register ?? [];
  const gruppe = (g: SchalterGruppe) => register.filter((e) => e.gruppe === g && (e.dienst !== "aras" || daten?.arasVerbunden));
  const summe = (kosten.daten?.heute ?? []).reduce((s, k) => s + k.euro, 0);
  const max = Math.max(1, ...(kosten.daten?.verlauf ?? []).map((v) => v.ki + v.telefon));
  return (
    <div className="ki ki-einstellungen">
      <KiRundgang schluessel="kiEinstellungen" raum="ki-einstellungen" />
      <Kopf titel="Einstellungen & Kasse" satz="Jeder Schalter hier wirkt — Vorgabe und Grenze im Tooltip." kinder={<><Meldung m={meld.m} /><Stand am={geladenAm} neu={neu} fehler={fehler} /></>} />
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <section className="ki-buehne" id="kasse" data-ki="kasse" aria-label="Kasse">
        <h2>Kasse <span className="ki-still ki-klein">· heute {euro(summe)} · Anbieter {kosten.daten?.anbieter === "claude" ? "Anthropic (Rückweg)" : "OpenAI"} · <a href="/chef/s/mara">KI-Pause</a></span></h2>
        <div className="ki-raster zwei ki-abstand">
          <div>
            {!kosten.daten?.heute.length ? <p className="ki-still">Heute noch keine Kosten.</p> : (
              <ul className="ki-liste">
                {kosten.daten.heute.map((k) => {
                  const voll = k.deckel ? Math.min(100, Math.round((k.euro / k.deckel) * 100)) : null;
                  return (
                    <li key={k.dienst} className="ki-zeile ki-zeile-rechts" title={k.deckel ? `Deckel ${euro(k.deckel)} · ${voll} % verbraucht` : "ohne Deckel"}>
                      <div className="ki-zeile-kopf"><b>{k.label}</b>{k.deckel ? <span className="ki-still ki-klein">von {euro(k.deckel)}</span> : null}</div>
                      <span className="ki-zahl">{euro(k.euro)}</span>
                      <span className="ki-zeile-satz"><span className="ki-balken"><i className={voll != null && voll >= 90 ? "warn" : ""} style={{ width: `${voll ?? Math.round(k.anteil)}%` }} /></span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <span className="ki-etikett">14 Tage · KI (blau) und Telefon (grau)</span>
            <div className="ki-verlauf ki-abstand" aria-hidden="true">
              {(kosten.daten?.verlauf ?? []).map((v) => (
                <div key={v.tag} title={`${v.tag}: KI ${euro(v.ki)} · Telefon ${euro(v.telefon)}`}>
                  <i className="tel" style={{ height: `${(v.telefon / max) * 100}%` }} /><i style={{ height: `${(v.ki / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <p className="ki-still ki-klein ki-abstand">Telefon ist geschätzt (4,3 ct/Min) — das Ist kommt monatlich aus der Twilio-Rechnung.</p>
          </div>
        </div>
        <div className="ki-abstand">{gruppe("kasse").map((e) => <Feld key={e.schluessel} e={e} wert={daten!.werte[e.schluessel]} gesetzt={!!daten!.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />)}</div>
      </section>
      {GRUPPEN.filter((g) => g.key !== "kasse").map((g) => {
        const liste = gruppe(g.key);
        return (
          <section key={g.key} className="ki-karte ki-abstand" id={g.key} data-ki={`gruppe-${g.key}`} aria-label={g.label}>
            <h2>{g.label} <span className="ki-still ki-klein">· {g.satz}</span></h2>
            {g.key === "aras" && !daten?.arasVerbunden ? <NichtVerbunden /> : liste.length === 0 ? <p className="ki-still">Keine Schalter.</p> : liste.map((e) => (
              <Feld key={e.schluessel} e={e} wert={daten!.werte[e.schluessel]} gesetzt={!!daten!.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />
            ))}
          </section>
        );
      })}
      <section className="ki-karte ki-abstand" id="protokoll" data-ki="protokoll" aria-label="Protokoll">
        <h2>Protokoll <span className="ki-still ki-klein">· 7 Tage · wer hat was geschaltet, was Mara und Aras getan haben</span></h2>
        <div className="ki-raster zwei">
          <div>
            <span className="ki-etikett">Schaltungen</span>
            {!protokoll.daten?.schaltungen.length ? <p className="ki-still ki-klein">Keine.</p> : (
              <ul className="ki-liste">{protokoll.daten.schaltungen.slice(0, 40).map((s, i) => (
                <li key={i} className="ki-zeile"><div className="ki-zeile-kopf"><b>{s.ziel ?? s.pfad.replace(/^.*\/chef\//, "")}</b>{s.notiz ? <span className="ki-still">{s.notiz}</span> : null}</div><span className="ki-still ki-klein">{s.wer} · {tagZeit(s.am)}</span></li>
              ))}</ul>
            )}
          </div>
          <div>
            <span className="ki-etikett">Ereignisse</span>
            {!protokoll.daten?.ereignisse.length ? <p className="ki-still ki-klein">Keine.</p> : (
              <ul className="ki-liste">{protokoll.daten.ereignisse.slice(0, 40).map((e) => (
                <li key={e.id} className="ki-zeile"><div className="ki-zeile-kopf"><span className={`ki-punkt ${e.ok ? "gut" : "krit"}`} aria-hidden="true" /><span className="ki-etikett">{e.kanal}</span><span>{e.text.length > 140 ? `${e.text.slice(0, 137)}…` : e.text}</span></div><span className="ki-still ki-klein">{e.art} · {tagZeit(e.am)}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
