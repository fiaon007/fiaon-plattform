// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/ki-einstellungen — EINSTELLUNGEN & KASSE (E-409, 19.10.2026)
//
// Rendert NUR das Schalter-Register (shared/fiaon-ki-schalter.ts): je Schalter
// ein Satz, Vorgabe und Grenze im Tooltip, Speichern über den Setzer des
// Eintrags (nicht eine Sammelroute). Was keinen Setzer hat, steht hier nicht.
// Kasse: KI + Telefon je Tag und Dienst, Deckel, Anbieter, KI-Pause. Protokoll:
// wer hat was geschaltet (fiaon_admin_log) und Maras/Aras’ Ereignisse.
// E-458 (29.10.2026): DIE EHRLICHE KI-KASSE — echte Dollar, Gesamtdeckel je
// Berliner Tag, Anteile je Bereich (Töpfe), Nachhol-Bremse, Bremsungen,
// Cache-Quote und Modell je Aufgabe (GET /chef/ki/kasse, fiaon-ki-kasse.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { GRUPPEN, setzerKoerper, wertPruefen, grenzeText, rueckfrageFuer, type RegisterEintrag, type SchalterGruppe } from "@shared/fiaon-ki-schalter";
import type { KostenDienst } from "@shared/fiaon-ki-team";
import { KASSE_TOEPFE, anteileFehler, bereichLabel, type KasseTopf } from "@shared/fiaon-ki-kasse";
import { Kopf, KiRundgang, NichtVerbunden, Fehler, Stand, Meldung, useMeldung, useTakt, senden, euro, usd, betrag, tagZeit, uhr } from "./ki-teile";

type Eintrag = Omit<RegisterEintrag, "jsonPruefen" | "muss"> & { muss?: string };
interface Daten { ok: boolean; register: Eintrag[]; werte: Record<string, string>; gesetzt: Record<string, boolean>; arasVerbunden: boolean }
interface Kosten { ok: boolean; heute: KostenDienst[]; verlauf: { tag: string; ki: number; telefon: number }[]; anbieter: string }
interface KasseTopfSicht { key: KasseTopf; label: string; satz: string; vorrang: boolean; cents: number; grenzeCents: number; anteil: number; gebremst: number }
interface KasseLage {
  ok: boolean; tag: string; an: boolean; tagUsd: number; anteile: Record<KasseTopf, number>; nachholUsd: number;
  summeCents: number; stundeCents: number; nachhol: { seit: string; bis: string } | null;
  status: "aus" | "laeuft" | "nachhol" | "nur_antworten" | "voll"; statusText: string;
  toepfe: KasseTopfSicht[]; bremsen: { am: string; text: string }[];
  cache: { dienst: string; eingabe: number; gecacht: number; quote: number }[];
  modelle: { aufgabe: string; label: string; kunde: boolean; modell: string; schluessel: string | null; erlaubt: string[] }[];
}
/** Diese Kassen-Schalter haben eine eigene Stelle im Kassen-Block (Anteile, Modell je Aufgabe) — nicht in der Liste. */
const EIGENE_STELLE = /^(ki_kasse_anteile|ki_modell_)/;
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

/** E-458: die Anteile je Topf (B2B, Antworten, Privat, Haus, Reserve) — fünf Zahlen, zusammen 100 %, ein Speichern. */
function AnteileFeld({ e, wert, gesetzt, busy, onSpeichern }: { e: Eintrag; wert: string; gesetzt: boolean; busy: boolean; onSpeichern: (e: Eintrag, w: string) => Promise<void> }) {
  const start = useMemo(() => {
    let o: any = {};
    try { o = JSON.parse(wert || "{}") ?? {}; } catch { o = {}; }
    return Object.fromEntries(KASSE_TOEPFE.map((k) => [k, String(o[k] ?? "")])) as Record<KasseTopf, string>;
  }, [wert]);
  const [w, setW] = useState(start);
  useEffect(() => { setW(start); }, [start]);
  const zahlen = Object.fromEntries(KASSE_TOEPFE.map((k) => [k, Number(w[k])])) as Record<KasseTopf, number>;
  const summe = KASSE_TOEPFE.reduce((x, k) => x + (Number(w[k]) || 0), 0);
  const fehler = anteileFehler(zahlen);
  const geaendert = KASSE_TOEPFE.some((k) => w[k] !== start[k]);
  const titel = grenzeText({ ...(e as any), muss: undefined } as RegisterEintrag);
  return (
    <div className={`ki-feld ki-anteile${geaendert ? " geaendert" : ""}`} data-ki-schalter={e.schluessel}>
      <label title={titel}>{e.label}{!gesetzt ? <span className="ki-still ki-klein"> · Vorgabe</span> : null}</label>
      <small>{e.satz} Antworten an Menschen dürfen bei Knappheit mehr nehmen (Vorrang); die Reserve ist nur für sie.</small>
      <div className="ki-eingabe ki-anteile-eingabe">
        {KASSE_TOEPFE.map((k) => (
          <label key={k} className="ki-anteil" htmlFor={`ka-${k}`}>
            <span>{bereichLabel(k)}</span>
            <span className="ki-anteil-zahl"><input id={`ka-${k}`} type="number" min={0} max={100} value={w[k]} disabled={busy} onChange={(ev) => setW({ ...w, [k]: ev.target.value })} />%</span>
          </label>
        ))}
        <span className={summe === 100 ? "ki-still ki-klein" : "ki-krit-t ki-klein"}>= {summe} %</span>
        {geaendert ? <button type="button" className="ki-knopf klein haupt" disabled={busy || !!fehler} onClick={() => void onSpeichern(e, JSON.stringify(zahlen))} title={fehler ?? "Speichern"}>OK</button> : null}
        {geaendert && fehler ? <span className="ki-krit-t ki-klein">{fehler}</span> : null}
      </div>
    </div>
  );
}

const STATUS_TON: Record<KasseLage["status"], { pille: string; punkt: string }> = {
  aus: { pille: "", punkt: "" }, laeuft: { pille: "gut", punkt: "gut" }, nachhol: { pille: "akz", punkt: "gelb" },
  nur_antworten: { pille: "akz", punkt: "gelb" }, voll: { pille: "krit", punkt: "krit" },
};

export default function ChefKiEinstellungen() {
  const { daten, fehler, neu, geladenAm } = useTakt<Daten>("/chef/ki/einstellungen", 0);
  const kosten = useTakt<Kosten>("/chef/ki/kosten?tage=14", 60_000);
  const kasse = useTakt<KasseLage>("/chef/ki/kasse", 60_000);
  const protokoll = useTakt<Protokoll>("/chef/ki/protokoll?tage=7", 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  const speichern = async (e: Eintrag, w: string) => {
    setBusy(e.schluessel);
    try {
      await senden(e.setzer.route, setzerKoerper(e as RegisterEintrag, w));
      meld.gut(`${e.label}: gespeichert.`); neu(); kosten.neu(); kasse.neu();
    } catch (err) { meld.fehler(`${e.label}: ${(err as Error).message}`); } finally { setBusy(null); }
  };
  const register = daten?.register ?? [];
  const gruppe = (g: SchalterGruppe) => register.filter((e) => e.gruppe === g && (e.dienst !== "aras" || daten?.arasVerbunden));
  const k = kasse.daten;
  const max = Math.max(1, ...(kosten.daten?.verlauf ?? []).map((v) => v.ki + v.telefon));
  const feld = (schluessel: string) => register.find((e) => e.schluessel === schluessel);
  const gesamtVoll = k ? Math.min(100, Math.round((k.summeCents / Math.max(1, k.tagUsd * 100)) * 100)) : 0;
  const gebremst = (k?.toepfe ?? []).reduce((x, t) => x + t.gebremst, 0);
  return (
    <div className="ki ki-einstellungen">
      <KiRundgang schluessel="kiEinstellungen" raum="ki-einstellungen" />
      <Kopf titel="Einstellungen & Kasse" satz="Jeder Schalter hier wirkt — Vorgabe und Grenze im Tooltip." kinder={<><Meldung m={meld.m} /><Stand am={geladenAm} neu={neu} fehler={fehler} /></>} />
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <section className="ki-buehne ki-kasse" id="kasse" data-ki="kasse" aria-label="Kasse">
        <h2>Kasse <span className="ki-still ki-klein">· echte Dollar, wie OpenAI abrechnet · Anbieter {kosten.daten?.anbieter === "claude" ? "Anthropic (Rückweg)" : "OpenAI"} · <a href="/chef/s/mara">KI-Pause</a></span></h2>
        {kasse.fehler && !k ? <p className="ki-krit-t ki-klein ki-abstand">{kasse.fehler}</p> : null}
        {k ? (
          <>
            <div className="ki-kasse-kopf ki-abstand" data-ki="kasse-gesamt">
              <div className="ki-zahlen">
                <div><span className="ki-zahl">{usd(k.summeCents / 100)}</span><small>heute von {usd(k.tagUsd)}</small></div>
                <div title={k.nachhol ? `Nachhol-Bremse: höchstens ${usd(k.nachholUsd)} je Stunde` : "alle KI in den letzten 60 Minuten"}><span className="ki-zahl klein">{usd(k.stundeCents / 100)}</span><small>letzte Stunde</small></div>
                <div title="So oft hat die Kasse heute einen Aufruf angehalten — die Arbeit wartet und läuft im nächsten Takt."><span className="ki-zahl klein">{gebremst}</span><small>heute gebremst</small></div>
              </div>
              <span className={`ki-pille ${STATUS_TON[k.status].pille}`} data-ki="kasse-status"><span className={`ki-punkt ${STATUS_TON[k.status].punkt}`} aria-hidden="true" />{k.statusText}</span>
            </div>
            <span className="ki-balken ki-abstand" aria-hidden="true"><i className={gesamtVoll >= 100 ? "krit" : gesamtVoll >= 90 ? "voll" : ""} style={{ width: `${gesamtVoll}%` }} /></span>
            <ul className="ki-liste ki-abstand ki-toepfe" data-ki="kasse-toepfe">
              {k.toepfe.map((t) => {
                const voll = t.grenzeCents ? Math.min(100, Math.round((t.cents / t.grenzeCents) * 100)) : 0;
                return (
                  <li key={t.key} className="ki-zeile ki-zeile-rechts" data-ki-topf={t.key}>
                    <div className="ki-zeile-kopf"><b>{t.label}</b><span className="ki-still ki-klein">{t.anteil} %</span>{t.vorrang ? <span className="ki-pille akz" title="Bei Knappheit zuerst: darf über den eigenen Anteil, nimmt die Reserve und was die anderen übrig lassen.">Vorrang</span> : null}{t.gebremst ? <span className="ki-pille">{t.gebremst}× gebremst</span> : null}</div>
                    <span className="ki-zahl">{usd(t.cents / 100)} <span className="ki-still ki-klein">von {usd(t.grenzeCents / 100)}</span></span>
                    <span className="ki-zeile-satz"><span className="ki-balken"><i className={voll >= 100 ? "krit" : voll >= 90 ? "voll" : ""} style={{ width: `${voll}%` }} /></span>{t.satz}</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : !kasse.fehler ? <p className="ki-still ki-abstand">Die Kasse lädt …</p> : null}
        <div className="ki-raster zwei ki-abstand">
          <div>
            <span className="ki-etikett">Heute je Dienst</span>
            {!kosten.daten?.heute.length ? <p className="ki-still">Heute noch keine Kosten.</p> : (
              <ul className="ki-liste">
                {kosten.daten.heute.map((x) => {
                  const voll = x.deckel ? Math.min(100, Math.round((x.euro / x.deckel) * 100)) : null;
                  return (
                    <li key={x.dienst} className="ki-zeile ki-zeile-rechts" title={x.deckel ? `Deckel ${betrag(x.deckel, x.waehrung)} · ${voll} % verbraucht` : x.waehrung === "EUR" ? "Schätzung in Euro (Twilio)" : "ohne eigenen Deckel — es gilt der Anteil seines Bereichs"}>
                      <div className="ki-zeile-kopf"><b>{x.label}</b>{x.deckel ? <span className="ki-still ki-klein">von {betrag(x.deckel, x.waehrung)}</span> : null}{x.bereich ? <span className="ki-still ki-klein">· {bereichLabel(x.bereich as KasseTopf)}</span> : null}</div>
                      <span className="ki-zahl">{betrag(x.euro, x.waehrung)}</span>
                      <span className="ki-zeile-satz"><span className="ki-balken"><i className={voll != null && voll >= 90 ? "warn" : ""} style={{ width: `${voll ?? Math.round(x.anteil)}%` }} /></span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <span className="ki-etikett">14 Tage · KI in $ (blau) und Telefon in € (grau)</span>
            <div className="ki-verlauf ki-abstand" aria-hidden="true">
              {(kosten.daten?.verlauf ?? []).map((v) => (
                <div key={v.tag} title={`${v.tag}: KI ${usd(v.ki)} · Telefon ${euro(v.telefon)}`}>
                  <i className="tel" style={{ height: `${(v.telefon / max) * 100}%` }} /><i style={{ height: `${(v.ki / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <p className="ki-still ki-klein ki-abstand">KI zu Listenpreis, ohne USt. auf die Aufladung. Die Tage vor dem 29.10. sind nachgerechnet (ohne Cache-Rabatt — den gab es damals nicht gemessen). Telefon ist geschätzt (4,3 ct/Min).</p>
            {k?.cache.length ? (
              <div className="ki-abstand" data-ki="kasse-cache" title="Prompt-Caching (E-262): Diesen Teil der Eingabe las OpenAI aus dem Cache — für ein Zehntel des Preises.">
                <span className="ki-etikett">Cache heute</span>
                <p className="ki-klein ki-leise">{k.cache.slice(0, 5).map((c) => `${(kosten.daten?.heute.find((x) => x.dienst === c.dienst)?.label ?? c.dienst).replace(/^Mara · /, "")} ${c.quote.toLocaleString("de-DE")} %`).join(" · ")}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="ki-abstand">
          {gruppe("kasse").filter((e) => !EIGENE_STELLE.test(e.schluessel)).map((e) => <Feld key={e.schluessel} e={e} wert={daten!.werte[e.schluessel]} gesetzt={!!daten!.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />)}
          {feld("ki_kasse_anteile") && daten ? <AnteileFeld e={feld("ki_kasse_anteile")!} wert={daten.werte.ki_kasse_anteile} gesetzt={!!daten.gesetzt.ki_kasse_anteile} busy={busy === "ki_kasse_anteile"} onSpeichern={speichern} /> : null}
        </div>
        {k?.modelle.length ? (
          <div className="ki-abstand" data-ki="kasse-modelle">
            <span className="ki-etikett">Modell je Aufgabe</span>
            {k.modelle.map((m) => {
              const e = m.schluessel ? feld(m.schluessel) : undefined;
              return e && daten
                ? <Feld key={m.aufgabe} e={e} wert={daten.werte[e.schluessel]} gesetzt={!!daten.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />
                : (
                  <div key={m.aufgabe} className="ki-feld" data-ki-modell={m.aufgabe}>
                    <label title="Texte an Kunden bleiben auf gpt-5.5 (Justin, 29.10.2026).">{m.label}</label>
                    <small>{m.kunde ? "Texte an Kunden — fest." : "fest"}</small>
                    <div className="ki-eingabe"><span className="ki-pille">{m.modell}</span></div>
                  </div>
                );
            })}
          </div>
        ) : null}
        {k?.bremsen.length ? (
          <div className="ki-abstand" data-ki="kasse-bremsen">
            <span className="ki-etikett">Heute gebremst (die Arbeit wartet und läuft im nächsten Takt)</span>
            <ul className="ki-liste">{k.bremsen.map((b, i) => (
              <li key={i} className="ki-zeile"><div className="ki-zeile-kopf"><span className="ki-punkt gelb" aria-hidden="true" /><span>{b.text.length > 160 ? `${b.text.slice(0, 157)}…` : b.text}</span></div><span className="ki-still ki-klein">{uhr(b.am)}</span></li>
            ))}</ul>
          </div>
        ) : null}
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
