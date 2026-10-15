// ═══════════════════════════════════════════════════════════════════════════
// AKTE · ÜBERBLICK: DER GROSSE KNOPF ZUR FIAON BONITÄTSAUSWERTUNG (E-330, 12.10.2026)
//
// Florentine (Team, 12.10.): „Wo kann ich die Bonitätsauskunft bestellen? War mir
// sicher letzte Woche einen Button gehabt zu haben, aber nun ist er weg."
// Justin: Der Knopf muss es dem Mitarbeiter ermöglichen, für den Kunden — wenn alles
// korrekt hochgeladen ist — die große Bonitätsauswertung (Ampel je Bereich, exakt auf
// den Punkt, konkrete Handlungsempfehlungen) MANUELL auszulösen. Viele haben bezahlt
// und warten (gemessen 12.10.: 141 zahlende Kunden mit Ausweis und Kontoauszug, keine
// Auswertung je übergeben). Ausdrücklich KEIN Sammellauf: jede Auswertung kostet,
// also löst sie ein Mensch aus, Kunde für Kunde.
//
// Die Auswertung selbst gab es schon (E-IT-D, FinanzauswertungAkte.tsx) — als kleiner
// Knopf unten im Reiter „Dokumente". Diese Karte ist derselbe Weg, nur dort, wo man
// hinschaut: dieselben Routen (/agent/kunden/:id/finanzauswertung), dieselbe Freigabe-
// Regel (Vier-Augen bei roter Lage oder Vorbehalt), derselbe Doppelklick-Schutz im
// Server (ein Lauf je Person, frischer Entwurf kommt zurück). Anfordern, Sichtprüfung
// des Ausweises, Verwerfen und alle Fassungen bleiben im Reiter „Dokumente".
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { AMPEL_WORT, FRIST_TEXT, type Ampel, type AuswertungInhalt } from "@shared/fiaon-finanzauswertung";
import "@/styles/office-bonitaetsauswertung.css";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;

async function api(pfad: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any }> {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init }).catch(() => null);
  const json = await r?.json().catch(() => null);
  return { ok: !!r?.ok && !!json?.ok, status: r?.status ?? 0, json };
}

const tag = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const euroGanz = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;
const ruhig = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

/**
 * Die Arbeitsschritte des Laufs (laufDurchfuehren) — angezeigt nach der verstrichenen Zeit, nicht gemeldet.
 * E-358 (14.10.2026, Justin: „es muss noch eine perfekte Animation dazu geben“): sieben Schritte (Wortlaut Justin: „Kundenprofil analysieren“, „Bonität vollständig analysiert“), dazu das
 * entstehende Dokument (Werk) und ein Fortschritt, der sich dem Ende nähert, ohne es zu behaupten.
 */
const LAUF_SCHRITTE: { titel: string; ab: number }[] = [
  { titel: "Kundenprofil analysieren", ab: 0 },
  { titel: "Jede Buchung zuordnen", ab: 8 },
  { titel: "Einnahmen und Ausgaben rechnen", ab: 20 },
  { titel: "Ampeln und Finanzwert setzen", ab: 32 },
  { titel: "Bericht schreiben", ab: 45 },
  { titel: "Bonität vollständig analysiert", ab: 62 },
  { titel: "PDF setzen", ab: 75 },
];
/** Fortschritt aus der Zeit: nähert sich 96 %, erreicht 100 % erst mit dem fertigen Entwurf. */
const fortschritt = (sek: number) => Math.min(0.96, 1 - Math.exp(-sek / 55));
const uhr = (sek: number) => `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, "0")}`;

/** Das entstehende Dokument: gestapelte Seiten, Skala, sieben Ampeln, Zeilen, Lichtstreifen, Seitenzähler. */
function Werk({ sek }: { sek: number }) {
  const seite = sek < 45 ? 1 : Math.min(25, 1 + Math.floor((sek - 45) / 1.4));
  const bogen = Math.min(1, sek / 40);
  return (
    <div className="ba-werk" aria-hidden="true">
      <div className="ba-blatt ba-blatt-3" />
      <div className="ba-blatt ba-blatt-2" />
      <div className="ba-blatt ba-blatt-1">
        <svg className="ba-werk-skala" viewBox="0 0 100 56">
          <path d="M8 50 A42 42 0 0 1 92 50" className="spur" />
          <path d="M8 50 A42 42 0 0 1 92 50" className="wert" style={{ strokeDashoffset: `${(1 - bogen) * 132}` }} />
        </svg>
        <div className="ba-werk-ampeln">{Array.from({ length: 7 }, (_, i) => <i key={i} className={sek >= 32 + i * 1.6 ? "an" : ""} style={{ ["--i" as string]: i }} />)}</div>
        <div className="ba-werk-zeilen">{[92, 78, 86, 64, 88, 72].map((w, i) => <i key={i} className={sek >= 45 + i * 2 ? "an" : ""} style={{ ["--w" as string]: `${w}%` }} />)}</div>
        <i className="ba-werk-strahl" />
      </div>
      <div className="ba-werk-seite">Seite {seite} / 25</div>
    </div>
  );
}

/** Zählt beim Erscheinen von 0 auf den Wert hoch (ruhig: sofort). */
function useHochzaehlen(ziel: number | null): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (ziel == null) return;
    if (ruhig()) { setN(ziel); return; }
    let f = 0;
    const t0 = performance.now();
    const schritt = (t: number) => {
      const p = Math.min(1, (t - t0) / 1300);
      setN(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) f = requestAnimationFrame(schritt);
    };
    f = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(f);
  }, [ziel]);
  return n;
}

function Stern() {
  return (
    <svg className="ba-stern" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z" fill="currentColor" />
      <path d="M19 15.5l.8 2.2 2.2.8-2.2.8L19 21.5l-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="currentColor" opacity=".7" />
    </svg>
  );
}

function Pruefzeichen({ ok }: { ok: boolean | null }) {
  return <span className={`ba-pz ${ok === true ? "ja" : ok === false ? "nein" : "frei"}`} aria-hidden="true">{ok === true ? "✓" : ok === false ? "✕" : "–"}</span>;
}

/** Ergebnis einer Fassung: Finanzwert, Gesamt-Ampel, sieben Bereichs-Ampeln, die ersten Schritte. */
function Ergebnis({ f, inhalt }: { f: any; inhalt: AuswertungInhalt | null }) {
  const wert = useHochzaehlen(f.finanzwert ?? null);
  const gesamt = (f.gesamt ?? "offen") as Ampel;
  const ampeln = inhalt?.ampeln ?? [];
  const schritte = (inhalt?.schritte ?? []).slice(0, 3);
  const spar = inhalt?.sparpotenzial;
  return (
    <div className="ba-ergebnis">
      <div className="ba-wertzeile">
        <div className="ba-wert" aria-label={`FIAON-Finanzwert ${f.finanzwert ?? "—"} von 999`}>
          <span className="ba-wert-zahl">{f.finanzwert != null ? wert : "—"}</span>
          <span className="ba-wert-max">/ 999</span>
        </div>
        <div className="ba-gesamt">
          <span className={`ba-lampe ${gesamt}`} aria-hidden="true" />
          <span><b>{AMPEL_WORT[gesamt] ?? gesamt}</b>{f.band ? ` · ${f.band}` : ""}{f.vorbehalt ? " · mit Vorbehalt" : ""}</span>
        </div>
      </div>
      {ampeln.length > 0 && (
        <ul className="ba-ampeln" aria-label="Ampel je Bereich">
          {ampeln.map((a, i) => (
            <li key={a.key} style={{ ["--i" as string]: i }} title={a.grund}>
              <span className={`ba-lampe klein ${a.ampel}`} aria-hidden="true" />
              <span className="ba-ampel-titel">{a.titel}</span>
              <span className="ba-ampel-wort">{AMPEL_WORT[a.ampel]}</span>
            </li>
          ))}
        </ul>
      )}
      {(schritte.length > 0 || (spar && spar.bisCents > 0)) && (
        <div className="ba-plan">
          <div className="ba-plan-kopf">
            <span>Plan für den Kunden</span>
            {spar && spar.bisCents > 0 && <span className="ba-spar">Spielraum {euroGanz(spar.vonCents)}–{euroGanz(spar.bisCents)} im Monat</span>}
          </div>
          {schritte.map((s, i) => (
            <div key={i} className="ba-schritt" style={{ ["--i" as string]: i }}>
              <span className={`ba-frist f-${s.frist}`}>{FRIST_TEXT[s.frist]}</span>
              <span>{s.titel}</span>
            </div>
          ))}
          {(inhalt?.schritte?.length ?? 0) > 3 && (() => { const n = inhalt!.schritte.length - 3; return <div className="ba-mehr-schritte">+ {n} {n === 1 ? "weiterer Schritt" : "weitere Schritte"} im PDF</div>; })()}
        </div>
      )}
    </div>
  );
}

export function BonitaetsauswertungKarte({ personId, name, melden, onDetails }: {
  personId: number; name: string; melden: Melden; onDetails: () => void;
}) {
  const [d, setD] = useState<any | null>(null);
  const [inhalt, setInhalt] = useState<{ id: number; inhalt: AuswertungInhalt | null } | null>(null);
  const [busy, setBusy] = useState<"" | "start" | "frei">("");
  const [frage, setFrage] = useState(false);
  const [sek, setSek] = useState(0);
  const startRef = useRef<number | null>(null);

  const laden = useCallback(async () => {
    const r = await api(`/agent/kunden/${personId}/finanzauswertung`);
    setD(r.ok ? r.json : { fehler: r.json?.error || "Die Auswertung ließ sich nicht laden." });
  }, [personId]);
  useEffect(() => { setD(null); setInhalt(null); setFrage(false); void laden(); }, [laden]);

  const fassungen: any[] = Array.isArray(d?.fassungen) ? d.fassungen : [];
  const laeuft = !!d?.laeuft;
  const entwurf = fassungen.find((f) => f.status === "entwurf") ?? null;
  const aktuell = fassungen.find((f) => f.status === "freigegeben") ?? null;
  const zeigen = entwurf ?? aktuell;
  const letzte = fassungen[0] ?? null;
  const gescheitert = !laeuft && letzte?.status === "fehler" && (!zeigen || new Date(letzte.erstelltAm) > new Date(zeigen.erstelltAm)) ? letzte : null;

  // Läuft eine Auswertung: alle vier Sekunden nachsehen (höchstens drei Minuten), dazu die Uhr für die Schritte.
  useEffect(() => {
    if (!laeuft) { startRef.current = null; return; }
    if (startRef.current == null) startRef.current = d?.laeuft?.erstelltAm ? new Date(d.laeuft.erstelltAm).getTime() : Date.now();
    let n = 0;
    // E-352: Der Lauf liest einen ungelesenen Kontoauszug jetzt selbst zuerst — bis zu fünf Minuten nachsehen.
    const abfrage = window.setInterval(() => { n++; if (n > 75) window.clearInterval(abfrage); else void laden(); }, 4000);
    const uhr = window.setInterval(() => setSek(Math.max(0, Math.round((Date.now() - (startRef.current ?? Date.now())) / 1000))), 500);
    return () => { window.clearInterval(abfrage); window.clearInterval(uhr); };
  }, [laeuft, laden]);

  // Den Inhalt (Ampeln, Plan) der gezeigten Fassung nachladen.
  useEffect(() => {
    if (!zeigen || inhalt?.id === zeigen.id) return;
    void api(`/agent/kunden/${personId}/finanzauswertung/${zeigen.id}`).then((r) => setInhalt({ id: zeigen.id, inhalt: r.ok ? r.json?.fassung?.inhalt ?? null : null }));
  }, [zeigen?.id, personId]);

  if (!d) return <section className="ba ba-laedt" aria-busy="true"><div className="ba-innen"><div className="ba-skelett" /><div className="ba-skelett kurz" /></div></section>;
  if (d.fehler) return <section className="ba ba-still"><div className="ba-innen"><p className="ba-satz">{d.fehler}</p></div></section>;

  const v = d.voraussetzungen;
  if (!v) return null;
  const leitung = d.rolle === "admin" || d.rolle === "vertriebsleiter";

  const erstellen = async () => {
    if (busy || laeuft) return;
    setBusy("start");
    const r = await api(`/agent/kunden/${personId}/finanzauswertung`, { method: "POST", body: "{}" });
    setBusy("");
    if (r.ok) { startRef.current = Date.now(); setSek(0); melden("gut", "Bonitätsauswertung startet", r.json?.meldung); void laden(); }
    else melden("schlecht", "Nicht gestartet", r.json?.error || "Bitte erneut versuchen.");
  };
  const freigeben = async () => {
    if (!entwurf || busy) return;
    setBusy("frei");
    const r = await api(`/agent/kunden/${personId}/finanzauswertung/${entwurf.id}/freigeben`, { method: "POST", body: "{}" });
    setBusy(""); setFrage(false);
    if (r.ok) { melden("gut", "An den Kunden übergeben", r.json?.meldung); void laden(); }
    else melden("schlecht", "Nicht übergeben", r.json?.error || "Bitte erneut versuchen.");
  };

  const zustand = laeuft ? "laeuft" : entwurf ? "entwurf" : gescheitert ? "fehler" : aktuell ? "frei" : v.bereit ? "bereit" : "fehlt";
  const chip = { laeuft: "Wird entwickelt", entwurf: "Prüfen & freigeben", fehler: "Gescheitert", frei: "Beim Kunden", bereit: "Startklar", fehlt: "Unterlagen fehlen" }[zustand];
  // E-358 (14.10.2026): kein Vier-Augen mehr — wer entwickelt hat, prüft und gibt frei (der Server prüft die Rolle).
  const darfNicht = entwurf ? !!d.veraltet : true;
  const pdf = (f: any) => `/api/fiaon/agent/kunden/${personId}/finanzauswertung/${f.id}/pdf`;
  const aktiv = LAUF_SCHRITTE.reduce((i, s, j) => (sek >= s.ab ? j : i), 0);

  return (
    <section className={`ba ba-${zustand}`} data-fiaon="bonitaetsauswertung" aria-live="polite">
      <div className="ba-innen">
        <header className="ba-kopf">
          <span className="ba-marke"><Stern />FIAON Bonitätsauswertung</span>
          <span className={`ba-chip ${zustand}`}>{chip}</span>
        </header>
        {/* E-365: Worauf die Auswertung beruht — gekauft (74/149 €), im Paket enthalten (Kartenlink wartet) oder keins von beiden. */}
        {d.grundlage && (
          <p className="ba-grundlage" data-fiaon="bonitaet-grundlage">
            {d.grundlage.art === "bezahlt"
              ? <>Bezahlt{d.grundlage.betragText ? ` · ${d.grundlage.betragText}` : ""}{d.grundlage.ref ? ` · ${d.grundlage.ref}` : ""}</>
              : d.grundlage.art === "inklusive"
                ? <>Im Paket enthalten — der Kartenlink wartet auf die Bonität</>
                : <>Nicht gekauft und nicht im Paket enthalten (Kartenlink schon da oder kein Paket)</>}
          </p>
        )}

        {zustand === "fehlt" && (
          <>
            <h3 className="ba-titel">Noch nicht startklar</h3>
            <p className="ba-satz">Es fehlt noch: {[!d.ausweisVorhanden ? "Ausweis" : null, v.kontoauszug?.stand === "fehlt" ? "Kontoauszug" : null].filter(Boolean).join(" und ") || "ein lesbarer Kontoauszug"}. Sobald beides hochgeladen ist, geht der Knopf an.</p>
            <div className="ba-pruefung">
              <div><Pruefzeichen ok={v.ausweis?.ok ?? false} /><b>Ausweis</b><span>{v.ausweis?.satz}</span></div>
              <div><Pruefzeichen ok={v.kontoauszug?.ok ?? false} /><b>Kontoauszug</b><span>{v.kontoauszug?.satz}</span></div>
              <div><Pruefzeichen ok={null} /><b>Bonität</b><span>Jetzt entwickeln — sobald Ausweis und Kontoauszug da sind.</span></div>
            </div>
            <div className="ba-knoepfe">
              <button type="button" className="ba-start aus" disabled title="Erst wenn Ausweis und Kontoauszug hochgeladen sind.">
                <Stern />Bonität jetzt entwickeln
              </button>
              <button type="button" className="ba-neben" onClick={onDetails}>Fehlendes anfordern oder Ausweis bestätigen →</button>
            </div>
          </>
        )}

        {zustand === "bereit" && (
          <>
            <h3 className="ba-titel">Ausweis und Kontoauszug sind da — die Bonität kann jetzt entwickelt werden.</h3>
            <p className="ba-satz">Ampel für sieben Bereiche, FIAON-Finanzwert, ein konkreter Plan mit Fristen und das PDF für {name || "den Kunden"}. Danach prüfst du das PDF und gibst es frei — der Kunde bekommt es sofort mit Mail.</p>
            <div className="ba-haken">
              <span><Pruefzeichen ok={v.ausweis?.ok ? true : null} />Ausweis{v.ausweis?.ok ? "" : " (Vorbehalt)"}</span>
              <span><Pruefzeichen ok={v.kontoauszug?.ok ? true : null} />Kontoauszug{v.kontoauszug?.stand === "pruefen" ? " (wird zuerst gelesen)" : v.kontoauszug?.ok ? "" : " (Vorbehalt)"}</span>
              <span><Pruefzeichen ok={null} />Bonität: jetzt entwickeln{v.auskunft?.ausgewertet ? " (Auskunft fließt ein)" : ""}</span>
            </div>
            {/* E-352: Was nicht ideal ist, sperrt nicht mehr — es steht als Vorbehalt im Bericht (und braucht die Freigabe der Leitung). */}
            {!v.vollstaendig && (
              <ul className="ba-vorbehalt-liste">
                {!v.ausweis?.ok && <li>{v.ausweis?.satz}</li>}
                {!v.kontoauszug?.ok && v.kontoauszug?.stand !== "pruefen" && <li>{v.kontoauszug?.satz}</li>}
                <li className="ba-klein">Steht als Vorbehalt im Bericht.</li>
              </ul>
            )}
            {/* E-365: gekauft, Beginn vor Ablauf der Widerrufsfrist nicht verlangt — der Knopf wartet bis zum Fristende. */}
            {d.startSperre && <p className="ba-hinweis" data-fiaon="bonitaet-widerruf">{d.startSperre.satz}</p>}
            <div className="ba-knoepfe">
              <button type="button" className={`ba-start${d.startSperre ? " aus" : ""}`} disabled={!!busy || !!d.startSperre} onClick={() => void erstellen()}
                title={d.startSperre ? `Ab dem ${d.startSperre.abText}` : undefined}>
                <Stern />{busy === "start" ? "Startet …" : d.startSperre ? `Ab dem ${d.startSperre.abText}` : "Bonität jetzt entwickeln"}
              </button>
              <span className="ba-klein">Ein Klick, ein Kunde — dauert ein bis drei Minuten.</span>
            </div>
          </>
        )}

        {zustand === "laeuft" && (
          <div className="ba-entsteht">
            <Werk sek={sek} />
            <div className="ba-entsteht-text">
              <h3 className="ba-titel">Die Bonität wird entwickelt …</h3>
              <div className="ba-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fortschritt(sek) * 100)} aria-label="Fortschritt">
                <i style={{ width: `${(fortschritt(sek) * 100).toFixed(1)}%` }} />
              </div>
              <div className="ba-fortschritt-zeile"><span>{LAUF_SCHRITTE[aktiv]?.titel} …</span><span className="ba-uhr">{uhr(sek)}</span></div>
              <ol className="ba-lauf">
                {LAUF_SCHRITTE.map((s, i) => (
                  <li key={s.titel} className={i < aktiv ? "fertig" : i === aktiv ? "jetzt" : ""}>
                    <span className="ba-punkt" aria-hidden="true">{i < aktiv ? "✓" : ""}</span>{s.titel}
                  </li>
                ))}
              </ol>
              <p className="ba-klein">Ein bis drei Minuten. Die Karte aktualisiert sich von selbst — du kannst solange weiterarbeiten. Du bekommst auch eine Mail mit dem PDF.</p>
            </div>
          </div>
        )}

        {zustand === "fehler" && gescheitert && (
          <>
            <h3 className="ba-titel">Der letzte Lauf ist gescheitert.</h3>
            <p className="ba-satz">{gescheitert.fehler || "Ohne Begründung abgebrochen."}</p>
            <div className="ba-knoepfe">
              <button type="button" className="ba-start" disabled={!v.bereit || !!busy} onClick={() => void erstellen()}><Stern />{busy === "start" ? "Startet …" : "Erneut erstellen"}</button>
              <button type="button" className="ba-neben" onClick={onDetails}>Unterlagen ansehen →</button>
            </div>
          </>
        )}

        {(zustand === "entwurf" || zustand === "frei") && zeigen && (
          <>
            <Ergebnis key={zeigen.id} f={zeigen} inhalt={inhalt && inhalt.id === zeigen.id ? inhalt.inhalt : null} />
            <p className="ba-klein">
              {zeigen.nummer} · erstellt {tag(zeigen.erstelltAm)}{zeigen.erstelltVon ? ` von ${zeigen.erstelltVon}` : ""}
              {zustand === "frei" ? ` · übergeben ${tag(zeigen.freigegebenAm)} · ${zeigen.kundeGelesenAm ? `vom Kunden geöffnet ${tag(zeigen.kundeGelesenAm)}` : "vom Kunden noch nicht geöffnet"}` : ""}
            </p>
            {d.veraltet && <p className="ba-hinweis">{d.veraltetGrund === "format"
              ? "Diese Fassung hat noch das alte Berichtsformat (vor dem 14.10.). Erst eine neue Fassung erstellen — sie hat das volle Format."
              : "Seit dieser Fassung sind neue Unterlagen da — sie ist veraltet. Erst eine neue Fassung erstellen."}</p>}
            {zustand === "entwurf" && !d.veraltet && (
              <p className="ba-schritt-hinweis"><b>Jetzt prüfen und freigeben:</b> „PDF ansehen“, kurz durchsehen, dann „Freigeben &amp; an den Kunden“ — er bekommt sie sofort mit Mail und PDF.</p>
            )}
            {frage && entwurf ? (
              <div className="ba-frage" role="group" aria-label="Übergabe bestätigen">
                <span>{entwurf.nummer} freigeben? Sie erscheint sofort im Bereich von {name || "dem Kunden"}, und er bekommt eine Mail mit dem PDF.</span>
                <div className="ba-knoepfe">
                  <button type="button" className="ba-start klein" disabled={busy === "frei"} onClick={() => void freigeben()}>{busy === "frei" ? "Gibt frei …" : "Ja, freigeben"}</button>
                  <button type="button" className="ba-neben" onClick={() => setFrage(false)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div className="ba-knoepfe">
                {zustand === "entwurf" && (
                  <button type="button" className="ba-start klein" disabled={darfNicht || !!busy}
                          title={d.veraltet ? "Veraltet: erst eine neue Fassung erstellen" : "Erscheint sofort im Bereich des Kunden, dazu Mail mit PDF"}
                          onClick={() => setFrage(true)}>Freigeben &amp; an den Kunden</button>
                )}
                <a className="ba-neben knopf" href={pdf(zeigen)} target="_blank" rel="noreferrer">PDF ansehen ↗</a>
                {/* Eine neue Fassung kostet wie die erste — angeboten nur, wenn neue Unterlagen sie nötig machen. */}
                {d.veraltet && v.bereit && (
                  <button type="button" className="ba-neben knopf" disabled={!!busy} onClick={() => void erstellen()}>{busy === "start" ? "Startet …" : "Neue Fassung erstellen"}</button>
                )}
                <button type="button" className="ba-neben" onClick={onDetails}>Alle Fassungen →</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
