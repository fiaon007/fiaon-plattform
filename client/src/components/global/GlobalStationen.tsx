// ═══════════════════════════════════════════════════════════════════════════
// DER STATIONEN-EDITOR — Fahrplan eines Global-Mandats mit echten Werten (22.10.2026)
//
// Justin: „Die Schritte wie ITIN, D-U-N-S, EIN müssen besser aussehen, und wir
//          müssen die echten Werte eintragen können — nicht nur einen Status
//          im Dropdown. 100 % funktional."
//
// Ein Bauteil für zwei Räume: Chefbüro › Global (dunkel) und Office › Global-Akte
// (hell). Je Station eine Karte: Status mit Datum (offen · in Arbeit · beantragt ·
// erledigt · entfällt), die eigenen Felder der Station (EIN, ITIN, D-U-N-S,
// Telefon, Adressen, Konto …), das passende Dokument, Hinweis für den Kunden und
// interne Notiz. Karten und Kreditrahmen sind Zeilen in Banken & Kapital — je
// Karte eine Zeile, direkt hier gepflegt.
//
// Felder, Prüfung und Formate kommen aus shared/fiaon-global-stationen.ts — die
// Karte zeigt beim Verlassen eines Feldes dieselbe Meldung, die der Server beim
// Speichern gäbe. Speichern ist „optimistisch“: Die Karte zeigt die neuen Werte
// sofort; geht etwas schief, springt sie zurück, und der Fehler BLEIBT stehen.
// Die ITIN steht nie im Klartext in der Seite — nur nach „Anzeigen“, für 20 s.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { GLOBAL_ETAPPEN, US_BUNDESSTAATEN, globalDokumentArtText } from "@shared/fiaon-global-bereich";
import { GLOBAL_FAHRPLAN, GLOBAL_KAPITAL_STATUS, GLOBAL_SCHRITT_STATUS, GLOBAL_SCHRITT_STATUS_TEXT, globalUsd, type GlobalSchrittStatus } from "@shared/fiaon-global-mandat";
import {
  GLOBAL_STATION_DOKUMENT, GLOBAL_STATION_FELDER, GLOBAL_STATION_KAPITAL, GLOBAL_STATION_UNTERSCHRIFT, STATION_ROLLEN, stationKontaktWarnungen, stationKontaktpersonStaat, stationStatusName,
  stationTelefonText, stationWertePruefen, type StationFeld,
} from "@shared/fiaon-global-stationen";
import "@/styles/global-stationen.css";

type T = Record<string, any>;
export interface StationenDaten {
  schritte: T[]; gesellschaft: T | null; gesellschaftPlus: T | null; kapital: T[];
  /** Dokumente der Akte (für „Dokument zur Station“): id, art, name, url. */
  dokumente?: { id: number | string; art: string; name?: string; titel?: string; url: string; unterschrift?: { gefordert: boolean; unterschrieben: boolean; modus?: string } }[];
  /** E-424: der Kunde selbst als Kontaktperson — aus dem Auftrag vorbelegt. */
  kontaktVorschlag?: { name: string; email: string; telefon: string; adresse: string; rolle: string } | null;
}
type Antwort = { ok: boolean; error?: string; feld?: string; meldung?: string; [k: string]: unknown };

async function senden(url: string, methode: "POST" | "DELETE", body?: unknown): Promise<Antwort> {
  try {
    const r = await fetch(url, {
      method: methode, credentials: "include",
      ...(body instanceof FormData ? { body } : body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || `Fehler ${r.status} — bitte noch einmal.`, feld: j?.feld };
    return j;
  } catch { return { ok: false, error: "Keine Verbindung zum Server — nichts gespeichert." }; }
}

const heuteBerlin = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
const tagText = (iso?: string | null) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const STATUS_TON: Record<string, string> = { offen: "leise", in_arbeit: "blau", beantragt: "blau", erledigt: "gruen", entfaellt: "leise" };
const KAPITAL_TEXT: Record<string, string> = { vorbereitung: "In Vorbereitung", beantragt: "Beantragt", in_pruefung: "In Prüfung", zugesagt: "Genehmigt", aktiv: "Aktiv", abgelehnt: "Abgelehnt", beendet: "Beendet" };

/** Der Wert eines Feldes, wie er in der Akte steht (Grunddaten oder gesellschaft_plus). */
function feldWert(f: StationFeld, g: T | null, p: T | null): string {
  const quelle = f.ort === "grund" ? g : p;
  if (f.art === "itin") return "";
  return String(quelle?.[f.feld] ?? "");
}

/** Kurzzeile unter dem Titel einer geschlossenen Karte: die wichtigsten Werte, ruhig gesetzt. */
function kurzWerte(schluessel: string, g: T | null, p: T | null, kapital: T[]): string[] {
  const gg = g ?? {}; const pp = p ?? {};
  switch (schluessel) {
    case "eingetragen": return [gg.name, gg.bundesstaat ? US_BUNDESSTAATEN[gg.bundesstaat] ?? gg.bundesstaat : "", gg.gegruendetAm ? `gegründet ${tagText(gg.gegruendetAm)}` : "", pp.aktenzeichen ? `File ${pp.aktenzeichen}` : ""].filter(Boolean);
    case "agent": return [pp.kontaktperson ? `Kontakt: ${pp.kontaktperson}` : "", pp.agentAdresse ? String(pp.agentAdresse).split("\n").slice(-1)[0] : ""].filter(Boolean);
    case "adresse": return [pp.usTelefon ? stationTelefonText(pp.usTelefon) : "", pp.usAdresse ? String(pp.usAdresse).split("\n")[0] : "", pp.privatAdresse ? "private Adresse" : ""].filter(Boolean);
    case "ein": return [pp.ein, pp.einBriefAm ? `Schreiben ${tagText(pp.einBriefAm)}` : ""].filter(Boolean);
    case "itin": return [pp.itinMaske, pp.itinBescheidAm ? `Bescheid ${tagText(pp.itinBescheidAm)}` : ""].filter(Boolean);
    case "konto": return [pp.kontoInstitut, pp.kontoEroeffnetAm ? `eröffnet ${tagText(pp.kontoEroeffnetAm)}` : ""].filter(Boolean);
    case "duns": return [pp.duns].filter(Boolean);
    default: {
      const k = GLOBAL_STATION_KAPITAL[schluessel];
      if (!k) return [];
      // Wie im Portal: die erste Karte gehört zur „Ersten Firmenkarte“, alle weiteren zur Kartenleiter.
      const alle = kapital.filter((x) => k.arten.includes(x.art));
      const liste = schluessel === "karte_1" ? alle.slice(0, 1) : schluessel === "kartenleiter" ? alle.slice(1) : alle;
      if (!liste.length) return [];
      const aktiv = liste.filter((x) => x.status === "aktiv" || x.status === "zugesagt").length;
      return [`${liste.length} ${liste.length === 1 ? "Eintrag" : "Einträge"}`, aktiv ? `${aktiv} genehmigt/aktiv` : ""].filter(Boolean);
    }
  }
}

export default function GlobalStationen({ basis, daten, onGespeichert, ton = "dunkel", startOffen = null }: {
  /** z. B. /api/fiaon/chef/global/mandate/<REF> oder /api/fiaon/agent/global/auftraege/<REF> */
  basis: string; daten: StationenDaten; onGespeichert: () => void; ton?: "dunkel" | "hell";
  /** E-455 (29.10.2026): diese Station gleich geöffnet zeigen (Chefbüro › Global-Kunden, „Wert eintragen“). Freiwillig. */
  startOffen?: string | null;
}) {
  const [offen, setOffen] = useState<string | null>(startOffen);
  // E-455: Wechselt die gewünschte Station, öffnet sie sich und rollt ins Bild.
  useEffect(() => {
    if (!startOffen) return;
    setOffen(startOffen);
    window.requestAnimationFrame(() => document.querySelector(`[data-station="${startOffen}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [startOffen]);
  const schritte = daten.schritte ?? [];
  const sichtbar = schritte.filter((s) => s.status !== "entfaellt");
  const erledigt = sichtbar.filter((s) => s.status === "erledigt").length;
  const gesamt = Math.max(1, sichtbar.length);
  return (
    <div className={`gst ${ton}`} data-fiaon="stationen-editor">
      <div className="gst-kopf">
        <div>
          <span className="gst-auge">Fahrplan · Stationen</span>
          <p className="gst-kopf-zahl"><b>{erledigt}</b> von {gesamt} Stationen erledigt</p>
        </div>
        <div className="gst-balken" role="img" aria-label={`${erledigt} von ${gesamt} erledigt`}>
          {sichtbar.map((s) => <i key={s.schluessel} className={`st-${s.status}`} title={`${s.titel}: ${GLOBAL_SCHRITT_STATUS_TEXT[s.status as GlobalSchrittStatus]?.de ?? s.status}`} />)}
        </div>
        <p className="gst-leise">Was du hier speicherst, sieht der Kunde sofort in seinem Portal — Werte schön formatiert, die ITIN nur maskiert. Interne Felder sind markiert.</p>
      </div>
      {[1, 2, 3, 4].map((etappe) => {
        const liste = schritte.filter((s) => s.etappe === etappe);
        if (!liste.length) return null;
        return (
          <section key={etappe} className="gst-etappe">
            <h4><span>{etappe}</span>{GLOBAL_ETAPPEN.find((e) => e.nr === etappe)?.de.titel}</h4>
            <div className="gst-liste">
              {liste.map((s, i) => (
                <Station key={s.schluessel} s={s} i={i} basis={basis} daten={daten} offen={offen === s.schluessel}
                  umschalten={() => setOffen(offen === s.schluessel ? null : s.schluessel)} onGespeichert={onGespeichert} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Station({ s, i, basis, daten, offen, umschalten, onGespeichert }: {
  s: T; i: number; basis: string; daten: StationenDaten; offen: boolean; umschalten: () => void; onGespeichert: () => void;
}) {
  const felder = GLOBAL_STATION_FELDER[s.schluessel] ?? [];
  const kapitalArt = GLOBAL_STATION_KAPITAL[s.schluessel];
  const dokArt = GLOBAL_STATION_DOKUMENT[s.schluessel];
  const vorlage = GLOBAL_FAHRPLAN.find((v) => v.schluessel === s.schluessel);
  const g = daten.gesellschaft; const p = daten.gesellschaftPlus;
  const ausAkte = () => ({
    status: String(s.status ?? "offen"), datum: String(s.datum ?? ""), beantragtAm: String(s.beantragtAm ?? ""),
    hinweis: String(s.hinweis ?? ""), intern: String(s.intern ?? ""),
    werte: Object.fromEntries(felder.map((f) => [f.feld, feldWert(f, g, p)])) as Record<string, string>,
  });
  // E-424: Fehlt die Kontaktperson, steht der Kunde selbst (aus dem Auftrag) vorbelegt im Entwurf — das Team prüft und speichert.
  // E-432 (28.10.2026): nur bei Wyoming (oder noch offenem Staat) — in Florida gibt es diese Pflicht nicht; die Felder bleiben.
  const vorschlag = s.schluessel === "agent" && stationKontaktpersonStaat(g?.bundesstaat) ? daten.kontaktVorschlag ?? null : null;
  const mitVorschlag = (e: ReturnType<typeof ausAkte>) => !vorschlag || e.werte.kontaktperson ? e : {
    ...e, werte: { ...e.werte, kontaktperson: vorschlag.name, kontaktRolle: e.werte.kontaktRolle || vorschlag.rolle, kontaktEmail: e.werte.kontaktEmail || vorschlag.email,
      kontaktTelefon: e.werte.kontaktTelefon || vorschlag.telefon, kontaktAdresse: e.werte.kontaktAdresse || vorschlag.adresse },
  };
  const [entwurf, setEntwurf] = useState(() => mitVorschlag(ausAkte()));
  const [basisStand, setBasisStand] = useState(ausAkte);
  const [zustand, setZustand] = useState<"ruhe" | "speichert" | "gespeichert" | "fehler">("ruhe");
  const [fehler, setFehler] = useState<{ text: string; feld?: string } | null>(null);
  const [feldFehler, setFeldFehler] = useState<Record<string, string>>({});
  const [optimistisch, setOptimistisch] = useState<T | null>(null);
  const [itinNeu, setItinNeu] = useState(false);
  const [itinKlar, setItinKlar] = useState<string | null>(null);
  const uhr = useRef<number | null>(null);
  const heute = useMemo(heuteBerlin, []);

  // Neue Daten vom Server: übernehmen, solange niemand tippt (sonst ginge eine Eingabe verloren).
  const akteSchluessel = JSON.stringify(ausAkte());
  useEffect(() => {
    const neu = ausAkte();
    const getippt = JSON.stringify(entwurf) !== JSON.stringify(basisStand);
    setBasisStand(neu);
    if (!getippt || zustand === "gespeichert") setEntwurf(mitVorschlag(neu));
    setOptimistisch(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akteSchluessel]);
  useEffect(() => () => { if (uhr.current) window.clearTimeout(uhr.current); }, []);
  // Die ITIN im Klartext verschwindet nach 20 Sekunden wieder.
  useEffect(() => { if (!itinKlar) return; const t = window.setTimeout(() => setItinKlar(null), 20_000); return () => window.clearTimeout(t); }, [itinKlar]);

  const geaenderteWerte = Object.fromEntries(Object.entries(entwurf.werte).filter(([k, w]) => w !== (basisStand.werte[k] ?? "")));
  const dirty = JSON.stringify(entwurf) !== JSON.stringify(basisStand);
  const anzeige = optimistisch ?? null;
  const status = (anzeige?.status ?? s.status) as GlobalSchrittStatus;
  const kurz = kurzWerte(s.schluessel, anzeige?.g ?? g, anzeige?.p ?? p, daten.kapital ?? []);

  const pruefeFeld = (f: StationFeld, wert: string) => {
    const r = stationWertePruefen(s.schluessel, { [f.feld]: wert }, heute);
    setFeldFehler((x) => { const n = { ...x }; if (r.ok) delete n[f.feld]; else n[f.feld] = r.error; return n; });
    // Schön formatieren, sobald das Feld verlassen wird (EIN 12-3456789, Telefon +1 …).
    if (r.ok && wert.trim() && ["ein", "duns", "telefon", "itin"].includes(f.art)) {
      const fertig = (f.ort === "grund" ? r.werte.grund : r.werte.plus)[f.feld as never] as string | null | undefined;
      if (fertig && fertig !== wert) setEntwurf((e) => ({ ...e, werte: { ...e.werte, [f.feld]: f.art === "telefon" ? stationTelefonText(fertig) : fertig } }));
    }
  };

  const setzeStatus = (st: string) => setEntwurf((e) => ({
    ...e, status: st,
    datum: st === "erledigt" && !e.datum ? heute : st !== "erledigt" && st !== s.status ? "" : e.datum,
    beantragtAm: st === "beantragt" && !e.beantragtAm ? heute : e.beantragtAm,
  }));

  const speichern = async () => {
    if (zustand === "speichert") return;
    // Erst prüfen, wie der Server prüft — ein Fehler steht sofort am Feld.
    const vor = stationWertePruefen(s.schluessel, geaenderteWerte, heute);
    if (!vor.ok) { setFeldFehler((x) => ({ ...x, [vor.feld]: vor.error })); setFehler({ text: vor.error, feld: vor.feld }); setZustand("fehler"); return; }
    const body: T = { schluessel: s.schluessel };
    if (entwurf.status !== basisStand.status) body.status = entwurf.status;
    if (entwurf.datum !== basisStand.datum) body.datum = entwurf.datum || null;
    if (entwurf.beantragtAm !== basisStand.beantragtAm) body.beantragtAm = entwurf.beantragtAm || null;
    if (entwurf.hinweis !== basisStand.hinweis) body.hinweis = entwurf.hinweis;
    if (entwurf.intern !== basisStand.intern) body.intern = entwurf.intern;
    if (Object.keys(geaenderteWerte).length) body.werte = geaenderteWerte;
    // Optimistisch: die Karte zeigt die neuen Werte, bevor der Server antwortet.
    const pNeu: T = { ...(p ?? {}) }; const gNeu: T = { ...(g ?? {}) };
    if (vor.ok) {
      for (const [k, w] of Object.entries(vor.werte.plus)) { if (k === "itin") { if (w) { pNeu.itinMaske = `•••-••-${String(w).slice(-4)}`; } else delete pNeu.itinMaske; } else pNeu[k] = w; }
      for (const [k, w] of Object.entries(vor.werte.grund)) gNeu[k] = w;
    }
    setOptimistisch({ status: entwurf.status, p: pNeu, g: gNeu });
    setZustand("speichert"); setFehler(null);
    const j = await senden(`${basis}/station`, "POST", body);
    if (!j.ok) {
      setOptimistisch(null); setZustand("fehler");
      setFehler({ text: String(j.error), feld: j.feld });
      if (j.feld) setFeldFehler((x) => ({ ...x, [String(j.feld)]: String(j.error) }));
      return;
    }
    setZustand("gespeichert"); setFehler(null); setFeldFehler({}); setItinNeu(false);
    const hinweise = Array.isArray(j.hinweise) ? (j.hinweise as string[]) : [];
    setFehler({ text: [String(j.meldung ?? "Gespeichert."), ...hinweise.map((h) => `Achtung: ${h}`)].join(" ") });
    setBasisStand(entwurf);
    if (uhr.current) window.clearTimeout(uhr.current);
    uhr.current = window.setTimeout(() => { setZustand("ruhe"); setFehler(null); }, 4200);
    onGespeichert();
  };
  const verwerfen = () => { setEntwurf(basisStand); setFeldFehler({}); setFehler(null); setZustand("ruhe"); setItinNeu(false); };

  const itinAnzeigen = async () => {
    const j = await senden(`${basis}/itin`, "POST");
    if (j.ok) setItinKlar(String(j.itin)); else { setFehler({ text: String(j.error) }); setZustand("fehler"); }
  };

  const datumZeile = [
    s.beantragtAm ? `beantragt ${tagText(s.beantragtAm)}` : "",
    s.datum && s.status === "erledigt" ? `erledigt ${tagText(s.datum)}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <article className={`gst-karte st-${status}${offen ? " auf" : ""}${dirty ? " geaendert" : ""}`} style={{ ["--i" as any]: i }} data-station={s.schluessel}>
      <button type="button" className="gst-karte-kopf" onClick={umschalten} aria-expanded={offen} aria-controls={`gst-${s.schluessel}`}>
        <span className="gst-punkt" aria-hidden="true">{status === "erledigt" ? <svg viewBox="0 0 16 16"><path d="M4 8.5l2.6 2.6L12 5.6" /></svg> : null}</span>
        <span className="gst-titel">
          <b>{s.titel}</b>
          <small>{kurz.length ? kurz.join(" · ") : (felder.length || kapitalArt ? "Noch keine Werte" : (vorlage ? "Status und Datum" : ""))}{datumZeile ? <em> · {datumZeile}</em> : null}</small>
        </span>
        <span className={`gst-pille ${STATUS_TON[status] ?? "leise"}`}>{stationStatusName(s.schluessel, status) ?? GLOBAL_SCHRITT_STATUS_TEXT[status]?.de ?? status}</span>
        {zustand === "speichert" && <span className="gst-zustand">speichert …</span>}
        {zustand === "gespeichert" && <span className="gst-zustand gut">gespeichert</span>}
        <span className="gst-winkel" aria-hidden="true" />
      </button>

      {offen && (
        <div className="gst-inhalt" id={`gst-${s.schluessel}`}>
          <p className="gst-satz">{s.text}</p>

          <div className="gst-reihe">
            <div className="gst-segment" role="radiogroup" aria-label={`Status ${s.titel}`}>
              {GLOBAL_SCHRITT_STATUS.map((st) => (
                <button key={st} type="button" role="radio" aria-checked={entwurf.status === st} className={`${entwurf.status === st ? "an" : ""} st-${st}`} onClick={() => setzeStatus(st)}>
                  {stationStatusName(s.schluessel, st) ?? GLOBAL_SCHRITT_STATUS_TEXT[st].de}
                </button>
              ))}
            </div>
            <label className="gst-feld klein">Beantragt am
              <input type="date" max={heute} value={entwurf.beantragtAm} onChange={(e) => setEntwurf({ ...entwurf, beantragtAm: e.target.value })} />
            </label>
            <label className="gst-feld klein">Erledigt am
              <input type="date" max={heute} value={entwurf.datum} onChange={(e) => setEntwurf({ ...entwurf, datum: e.target.value })} />
            </label>
          </div>

          {felder.length > 0 && (
            <div className="gst-felder">
              {felder.map((f) => {
                const fehlt = feldFehler[f.feld];
                const lbl = <span className="gst-label">{f.titel}{f.intern && <i className="gst-intern">intern</i>}</span>;
                if (f.art === "itin") {
                  const maske = (anzeige?.p ?? p)?.itinMaske as string | undefined;
                  return (
                    <div key={f.feld} className={`gst-feld${fehlt ? " fehler" : ""}`}>
                      {lbl}
                      {maske && !itinNeu ? (
                        <div className="gst-geheim">
                          <code>{itinKlar ?? maske}</code>
                          {itinKlar ? <button type="button" onClick={() => setItinKlar(null)}>Verbergen</button> : <button type="button" onClick={() => void itinAnzeigen()}>Anzeigen</button>}
                          <button type="button" onClick={() => { setItinNeu(true); setItinKlar(null); }}>Ändern</button>
                        </div>
                      ) : (
                        <input value={entwurf.werte[f.feld] ?? ""} autoComplete="off" spellCheck={false} inputMode="numeric" placeholder={f.platzhalter}
                          onChange={(e) => setEntwurf({ ...entwurf, werte: { ...entwurf.werte, [f.feld]: e.target.value } })}
                          onBlur={(e) => pruefeFeld(f, e.target.value)} aria-invalid={!!fehlt} />
                      )}
                      {fehlt ? <small className="gst-fehlertext" role="alert">{fehlt}</small> : f.hilfe ? <small>{f.hilfe}</small> : null}
                    </div>
                  );
                }
                const wert = entwurf.werte[f.feld] ?? "";
                const setze = (v: string) => setEntwurf({ ...entwurf, werte: { ...entwurf.werte, [f.feld]: v } });
                return (
                  <label key={f.feld} className={`gst-feld${f.art === "mehrzeilig" ? " breit" : ""}${fehlt ? " fehler" : ""}${f.intern ? " intern" : ""}`}>
                    {lbl}
                    {f.art === "mehrzeilig" ? <textarea rows={3} value={wert} placeholder={f.platzhalter} onChange={(e) => setze(e.target.value)} onBlur={(e) => pruefeFeld(f, e.target.value)} aria-invalid={!!fehlt} />
                      : f.art === "datum" ? <input type="date" max={heute} value={wert} onChange={(e) => setze(e.target.value)} onBlur={(e) => pruefeFeld(f, e.target.value)} aria-invalid={!!fehlt} />
                      : f.art === "staat" ? (
                        <select value={wert} onChange={(e) => setze(e.target.value)}>
                          <option value="">—</option>
                          {Object.entries(US_BUNDESSTAATEN).map(([code, n]) => <option key={code} value={code}>{n}</option>)}
                        </select>
                      ) : f.art === "rolle" ? (
                        <select value={wert} onChange={(e) => setze(e.target.value)}><option value="">—</option>{STATION_ROLLEN.map((r) => <option key={r.wert} value={r.wert}>{r.titel}</option>)}</select>
                      ) : f.art === "form" ? (
                        <select value={wert} onChange={(e) => setze(e.target.value)}><option value="">—</option><option value="LLC">LLC</option><option value="Corporation">Corporation</option></select>
                      ) : (
                        <input value={f.art === "telefon" && wert.startsWith("+1") && /^\+1\d{10}$/.test(wert) ? stationTelefonText(wert) : wert} placeholder={f.platzhalter}
                          inputMode={f.art === "telefon" || f.art === "telefon_int" ? "tel" : f.art === "ein" || f.art === "duns" ? "numeric" : f.art === "email" ? "email" : undefined}
                          autoComplete="off" spellCheck={f.art === "text"} onChange={(e) => setze(e.target.value)} onBlur={(e) => pruefeFeld(f, e.target.value)} aria-invalid={!!fehlt} />
                      )}
                    {fehlt ? <small className="gst-fehlertext" role="alert">{fehlt}</small> : f.hilfe ? <small>{f.hilfe}</small> : null}
                    {f.feld === "kontaktAdresse" && stationKontaktWarnungen(wert, entwurf.werte.agentAdresse).map((h) => <small key={h} className="gst-warnung" role="status">{h}</small>)}
                  </label>
                );
              })}
            </div>
          )}

          {vorschlag && (
            <div className="gst-kontakt-hinweis">
              <span>Kontaktperson: in der Regel der Inhaber selbst — nie jemand von FIAON. Vorbelegt aus dem Auftrag; vertraulich, nicht öffentlich.</span>
              <button type="button" className="gst-knopf leise" onClick={() => setEntwurf((e) => ({ ...e, werte: { ...e.werte, kontaktperson: vorschlag.name, kontaktRolle: vorschlag.rolle, kontaktEmail: vorschlag.email, kontaktTelefon: vorschlag.telefon, kontaktAdresse: vorschlag.adresse } }))}>Inhaber aus dem Auftrag übernehmen</button>
            </div>
          )}

          {kapitalArt && <KapitalZeilen basis={basis} arten={kapitalArt.arten} liste={(daten.kapital ?? []).filter((k) => kapitalArt.arten.includes(k.art))} onGespeichert={onGespeichert} />}

          {dokArt && <StationDokument basis={basis} art={dokArt} dokumente={(daten.dokumente ?? []).filter((d) => d.art === dokArt)} onGespeichert={onGespeichert} />}
          {GLOBAL_STATION_UNTERSCHRIFT[s.schluessel] && (() => {
            const u = GLOBAL_STATION_UNTERSCHRIFT[s.schluessel];
            return <StationDokument basis={basis} art={u.art} titel={u.titel} pflichtKey={u.pflichtKey} zurUnterschrift
              dokumente={(daten.dokumente ?? []).filter((d) => d.art === u.art && (d as any).pflichtKey === u.pflichtKey)} onGespeichert={onGespeichert} />;
          })()}

          <div className="gst-felder zwei">
            <label className="gst-feld"><span className="gst-label">Hinweis für den Kunden</span>
              <input value={entwurf.hinweis} maxLength={600} placeholder="z. B. Eingereicht — die Behörde bearbeitet in eigener Frist." onChange={(e) => setEntwurf({ ...entwurf, hinweis: e.target.value })} />
            </label>
            <label className="gst-feld intern"><span className="gst-label">Notiz<i className="gst-intern">intern</i></span>
              <input value={entwurf.intern} maxLength={1200} onChange={(e) => setEntwurf({ ...entwurf, intern: e.target.value })} />
            </label>
          </div>

          <div className="gst-fuss">
            {fehler && <p className={`gst-meldung${zustand === "fehler" ? " schlecht" : " gut"}`} role={zustand === "fehler" ? "alert" : "status"}>{fehler.text}</p>}
            <div className="gst-knoepfe">
              {dirty && <button type="button" className="gst-knopf leise" onClick={verwerfen} disabled={zustand === "speichert"}>Verwerfen</button>}
              <button type="button" className="gst-knopf" onClick={() => void speichern()} disabled={!dirty || zustand === "speichert"} data-fiaon="station-speichern">
                {zustand === "speichert" ? "Speichert …" : "Speichern"}
              </button>
            </div>
            {s.geaendertVon && <small className="gst-leise">Zuletzt: {s.geaendertVon}{s.geaendertAm ? `, ${new Date(s.geaendertAm).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</small>}
          </div>
        </div>
      )}
    </article>
  );
}

// ── Karten / Kreditrahmen: je Eintrag eine Zeile in Banken & Kapital ─────────
const LEER = { id: 0, art: "karte", produkt: "", institut: "", inhaber: "firma", status: "vorbereitung", betragUsd: "", beantragtAm: "", entschiedenAm: "", hinweis: "", intern: "", sichtbar: true };
function KapitalZeilen({ basis, arten, liste, onGespeichert }: { basis: string; arten: string[]; liste: T[]; onGespeichert: () => void }) {
  const [form, setForm] = useState<typeof LEER | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const karte = arten.includes("karte");
  const speichern = async () => {
    if (!form) return;
    setLaeuft(true); setMeldung(null);
    const j = await senden(`${basis}/kapital`, "POST", form);
    setLaeuft(false);
    if (!j.ok) { setMeldung({ text: String(j.error), gut: false }); return; }
    setMeldung({ text: String(j.meldung ?? "Gespeichert."), gut: true }); setForm(null); onGespeichert();
  };
  const entfernen = async (id: number) => {
    if (!window.confirm("Diesen Eintrag entfernen? Er verschwindet auch beim Kunden.")) return;
    const j = await senden(`${basis}/kapital/${id}`, "DELETE");
    setMeldung({ text: j.ok ? "Entfernt." : String(j.error), gut: j.ok });
    if (j.ok) onGespeichert();
  };
  return (
    <div className="gst-kapital">
      <div className="gst-kapital-kopf">
        <span className="gst-label">{karte ? "Karten — je Karte eine Zeile (die erste zählt zur „Ersten Firmenkarte“, alle weiteren zur Kartenleiter)" : "Kreditrahmen und Darlehen"}</span>
        {!form && <button type="button" className="gst-knopf leise" onClick={() => setForm({ ...LEER, art: arten[0], inhaber: karte ? "firma" : "" })}>{karte ? "+ Karte" : "+ Eintrag"}</button>}
      </div>
      {!karte && <p className="gst-leise">Über Kreditrahmen und Darlehen entscheidet allein das Institut. Der Kunde sieht einen Betrag erst ab „Genehmigt“ — nie Institut oder Produkt.</p>}
      {liste.length === 0 && !form && <p className="gst-leise">Noch nichts erfasst.</p>}
      <ul className="gst-kapital-liste">
        {liste.map((k) => {
          const ton = GLOBAL_KAPITAL_STATUS.find((x) => x.status === k.status)?.ton ?? "leise";
          return (
            <li key={k.id}>
              <div>
                <b>{k.produkt || k.institut || k.artText}</b>
                <small>{[karte ? (k.inhaber === "privat" ? "private Karte" : "Firmenkarte") : k.artText, k.institut && k.produkt ? k.institut : "", k.beantragtAm ? `beantragt ${tagText(k.beantragtAm)}` : "", k.entschiedenAm ? `entschieden ${tagText(k.entschiedenAm)}` : "", !k.sichtbar ? "nur intern" : ""].filter(Boolean).join(" · ")}</small>
              </div>
              {k.betragCents != null && <span className="gst-betrag">{globalUsd(k.betragCents)}</span>}
              <span className={`gst-pille ${ton}`}>{KAPITAL_TEXT[k.status] ?? k.statusText}</span>
              <span className="gst-mini">
                <button type="button" onClick={() => setForm({ id: k.id, art: k.art, produkt: k.produkt ?? "", institut: k.institut ?? "", inhaber: k.inhaber ?? (karte ? "firma" : ""), status: k.status, betragUsd: k.betragCents != null ? String(k.betragCents / 100) : "", beantragtAm: k.beantragtAm ?? "", entschiedenAm: k.entschiedenAm ?? "", hinweis: k.hinweis ?? "", intern: k.intern ?? "", sichtbar: !!k.sichtbar })}>Bearbeiten</button>
                <button type="button" onClick={() => void entfernen(k.id)}>Entfernen</button>
              </span>
            </li>
          );
        })}
      </ul>
      {form && (
        <div className="gst-felder gst-kapital-form">
          {!karte && <label className="gst-feld"><span className="gst-label">Art</span><select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>{arten.map((a) => <option key={a} value={a}>{a === "kreditrahmen" ? "Kreditrahmen" : "Darlehen"}</option>)}</select></label>}
          <label className="gst-feld intern"><span className="gst-label">{karte ? "Produkt" : "Bezeichnung"}<i className="gst-intern">intern</i></span><input value={form.produkt} onChange={(e) => setForm({ ...form, produkt: e.target.value })} placeholder={karte ? "z. B. Business Card" : ""} /></label>
          <label className="gst-feld intern"><span className="gst-label">Institut<i className="gst-intern">intern</i></span><input value={form.institut} onChange={(e) => setForm({ ...form, institut: e.target.value })} /></label>
          {karte && (
            <div className="gst-feld"><span className="gst-label">Karte für</span>
              <div className="gst-segment klein" role="radiogroup" aria-label="Karte für">
                {[["firma", "Firma"], ["privat", "Privat"]].map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={form.inhaber === k} className={form.inhaber === k ? "an" : ""} onClick={() => setForm({ ...form, inhaber: k })}>{t}</button>)}
              </div>
            </div>
          )}
          <label className="gst-feld"><span className="gst-label">Status</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{GLOBAL_KAPITAL_STATUS.map((x) => <option key={x.status} value={x.status}>{KAPITAL_TEXT[x.status] ?? x.titel.de}</option>)}</select>
          </label>
          <label className="gst-feld"><span className="gst-label">{karte ? "Limit (USD, optional)" : "Betrag (USD)"}</span><input inputMode="numeric" value={form.betragUsd} onChange={(e) => setForm({ ...form, betragUsd: e.target.value })} placeholder="25000" /></label>
          <label className="gst-feld"><span className="gst-label">Beantragt am</span><input type="date" max={heuteBerlin()} value={form.beantragtAm} onChange={(e) => setForm({ ...form, beantragtAm: e.target.value })} /></label>
          <label className="gst-feld"><span className="gst-label">Entschieden am</span><input type="date" max={heuteBerlin()} value={form.entschiedenAm} onChange={(e) => setForm({ ...form, entschiedenAm: e.target.value })} /></label>
          <label className="gst-feld breit"><span className="gst-label">Hinweis für den Kunden</span><input value={form.hinweis} onChange={(e) => setForm({ ...form, hinweis: e.target.value })} /></label>
          <label className="gst-haken"><input type="checkbox" checked={form.sichtbar} onChange={(e) => setForm({ ...form, sichtbar: e.target.checked })} /> Der Kunde sieht diesen Eintrag</label>
          <div className="gst-knoepfe breit">
            <button type="button" className="gst-knopf leise" onClick={() => setForm(null)} disabled={laeuft}>Abbrechen</button>
            <button type="button" className="gst-knopf" onClick={() => void speichern()} disabled={laeuft}>{laeuft ? "Speichert …" : form.id ? "Speichern" : "Anlegen"}</button>
          </div>
        </div>
      )}
      {meldung && <p className={`gst-meldung ${meldung.gut ? "gut" : "schlecht"}`} role={meldung.gut ? "status" : "alert"}>{meldung.text}</p>}
    </div>
  );
}

// ── Das Dokument zur Station (EIN-Bestätigung, ITIN-Bescheid …) ──────────────
function StationDokument({ basis, art, dokumente, onGespeichert, titel, pflichtKey, zurUnterschrift }: {
  basis: string; art: string; dokumente: NonNullable<StationenDaten["dokumente"]>; onGespeichert: () => void;
  /** Eigener Titel (z. B. „Formular SS-4 zur Unterschrift“), Pflichtunterlage und „zur Unterschrift stellen“. */
  titel?: string; pflichtKey?: string; zurUnterschrift?: boolean;
}) {
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  const scanHochladen = async (id: number | string, f: File | null) => {
    if (!f) return;
    const fd = new FormData(); fd.append("datei", f);
    setLaeuft(true); setMeldung(null);
    const j = await senden(`${basis}/dokument/${encodeURIComponent(String(id))}/scan`, "POST", fd);
    setLaeuft(false);
    setMeldung({ text: j.ok ? "Unterschriebener Scan abgelegt — die Aufgabe ans Team ist angelegt." : String(j.error), gut: j.ok });
    if (j.ok) onGespeichert();
  };
  const hochladen = async () => {
    if (!datei) return;
    if (datei.size > 15 * 1024 * 1024) { setMeldung({ text: "Die Datei ist größer als 15 MB.", gut: false }); return; }
    const fd = new FormData();
    fd.append("art", art); fd.append("datei", datei);
    // Chefbüro und Office nennen das Feld verschieden — beide bekommen ihres. Der Kunde sieht das Dokument; eine Mail geht nicht raus.
    fd.append("sichtbar", "true"); fd.append("sichtbarFuerKunde", "true"); fd.append("mitteilen", "false");
    if (zurUnterschrift) { fd.append("unterschrift", "true"); if (pflichtKey) fd.append("pflichtKey", pflichtKey); }
    if (zurUnterschrift && datei.type && datei.type !== "application/pdf") { setMeldung({ text: "Zur Unterschrift geht nur ein PDF.", gut: false }); return; }
    setLaeuft(true); setMeldung(null);
    const j = await senden(`${basis}/dokument`, "POST", fd);
    setLaeuft(false);
    if (!j.ok) { setMeldung({ text: String(j.error), gut: false }); return; }
    setMeldung({ text: zurUnterschrift ? "Liegt beim Kunden zur Unterschrift (unter „Für Sie zu tun“)." : "Im Tresor des Kunden abgelegt.", gut: true }); setDatei(null);
    if (eingabe.current) eingabe.current.value = "";
    onGespeichert();
  };
  return (
    <div className="gst-dokument">
      <span className="gst-label">{titel ?? `Dokument · ${globalDokumentArtText(art, "de")}`}</span>
      {dokumente.length > 0 && (
        <ul>{dokumente.map((d) => (
          <li key={String(d.id)}>
            <a href={d.url} target="_blank" rel="noopener noreferrer">{d.titel || d.name || globalDokumentArtText(art, "de")}</a>
            {d.unterschrift?.gefordert ? <em className="gst-leise"> · {d.unterschrift.unterschrieben ? "unterschrieben" : d.unterschrift.modus === "handschriftlich" ? "wartet auf den Scan (von Hand)" : "wartet auf Unterschrift"}</em> : null}
            {/* Der Kunde hat per Post oder Mail zurückgeschickt: den unterschriebenen Scan in seinem Namen ablegen (nur PDF). */}
            {d.unterschrift?.gefordert && !d.unterschrift.unterschrieben && d.unterschrift.modus === "handschriftlich" && (
              <label className="gst-scan">Scan im Namen des Kunden<input type="file" accept="application/pdf,.pdf" onChange={(e) => void scanHochladen(d.id, e.target.files?.[0] ?? null)} /></label>
            )}
          </li>
        ))}</ul>
      )}
      <div className="gst-dokument-zeile">
        <input ref={eingabe} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} aria-label={`${globalDokumentArtText(art, "de")} hochladen`} />
        <button type="button" className="gst-knopf leise" disabled={!datei || laeuft} onClick={() => void hochladen()}>{laeuft ? "Lädt …" : zurUnterschrift ? "Zur Unterschrift bereitstellen" : "Hochladen"}</button>
      </div>
      {meldung && <p className={`gst-meldung ${meldung.gut ? "gut" : "schlecht"}`} role={meldung.gut ? "status" : "alert"}>{meldung.text}</p>}
    </div>
  );
}
