// ═══════════════════════════════════════════════════════════════════════════
// GEBURTSDATUM-FELD — EIN BAUTEIL FÜR ALLE STELLEN
// E-IT-G (08.10.2026), Punkt (14) der Team-Rückmeldung
//
// Team: „Beim Geburtsdatum kommt 63 statt 1963 heraus, und man muss ewig
// zurückscrollen.“ Ursache: das Datumsfeld des Browsers (type=date) macht aus
// 1-7-1-1-6-3 den 17.11.0063, und sein Kalender öffnet im heutigen Monat.
//
// Dieses Bauteil ersetzt JEDE Geburtsdatum-Eingabe (Akte, Kunde anlegen,
// Chef-Akte, Antrag alt und neu, Auskunft, Passwort vergessen, Kündigung,
// Global-Angebot, Mitarbeiterverträge, Partnervereinbarung):
//   · drei Felder TT · MM · JJJJ, Zifferntastatur, kein Kalender, keine Liste —
//     nichts zum Scrollen;
//   · „4“ im Tag wird „04“, „2“ im Monat „02“, nach zwei Ziffern springt der
//     Cursor weiter, ein Trennzeichen (. , / - Leertaste) ebenso; Rücktaste im
//     leeren Feld springt zurück;
//   · freie Eingabe: „14.03.1963“, „14031963“, „1963-03-14“ (Einfügen, Autofill
//     oder getippt) wird auf die drei Felder verteilt;
//   · ein zweistelliges Jahr wird beim Verlassen SICHTBAR ergänzt („63“ → 1963);
//   · darunter steht immer eine Zeile zum Gegenlesen („17. November 1963 ·
//     62 Jahre“) oder die Meldung; bei einer Rückfrage („stimmt das?“) der Knopf
//     „Stimmt so“.
// Die Regeln (Format, Jahrhundert, Plausibilität, Alter je Kontext) stehen
// NICHT hier, sondern in shared/fiaon-geburtsdatum.ts — derselbe Leser prüft
// im Server noch einmal.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  geburtsdatumLesen, geburtSpeicherbar, geburtTeileAus, geburtTeileAusEingabe, geburtsdatumIso, geburtRuecklesen,
  type GeburtErgebnis, type GeburtKontext, type GeburtTeile,
} from "@shared/fiaon-geburtsdatum";

type Teil = keyof GeburtTeile;
const REIHE: Teil[] = ["tag", "monat", "jahr"];
const LAENGE: Record<Teil, number> = { tag: 2, monat: 2, jahr: 4 };
const ETIKETT: Record<Teil, string> = { tag: "Tag", monat: "Monat", jahr: "Jahr" };
const PLATZ: Record<Teil, string> = { tag: "TT", monat: "MM", jahr: "JJJJ" };
const AUTOFILL: Record<Teil, string> = { tag: "bday-day", monat: "bday-month", jahr: "bday-year" };

/**
 * Der Zustand eines Geburtsdatum-Felds: die drei Teile, das Prüfergebnis und
 * die Bestätigung (gilt nur für genau das bestätigte Datum). `iso` ist nur
 * gesetzt, wenn gespeichert werden darf (ok, oder Rückfrage bestätigt).
 */
export function useGeburtsdatum(start: unknown, kontext: GeburtKontext) {
  const startIso = geburtsdatumIso(start);
  const [teile, setTeile] = useState<GeburtTeile>(() => geburtTeileAus(start));
  const [bestaetigtFuer, setBestaetigtFuer] = useState<string | null>(null);
  const erg = useMemo(() => geburtsdatumLesen(teile, kontext), [teile, kontext]);
  const bestaetigt = !!erg.iso && bestaetigtFuer === erg.iso;
  const iso = geburtSpeicherbar(erg, bestaetigt) ? erg.iso : null;
  return {
    teile, setTeile, erg, bestaetigt, iso, startIso,
    bestaetigen: () => setBestaetigtFuer(erg.iso),
    /** Geändert gegenüber dem Startwert (und speicherbar)? */
    geaendert: !!iso && iso !== startIso,
    /** Nichts eingetragen. */
    leer: erg.stand === "leer",
    /** Warum (noch) nicht gespeichert werden kann — oder null. */
    sperrGrund: erg.stand === "leer" ? null : iso ? null : (erg.meldung || "Bitte das Geburtsdatum prüfen."),
    /** Für die Antwort des Servers: die Rückfrage bestätigt mitschicken. */
    bestaetigtMitsenden: erg.stand === "pruefen" && bestaetigt,
    zuruecksetzen: (wert: unknown) => { setTeile(geburtTeileAus(wert)); setBestaetigtFuer(null); },
  };
}
export type GeburtsdatumZustand = ReturnType<typeof useGeburtsdatum>;

export type GeburtVariante = "office" | "hell" | "kunde" | "antrag";

const KLASSE: Record<Exclude<GeburtVariante, "antrag">, string> = {
  office: "pi-eingabe",
  hell: "px-2.5 py-1.5 rounded-lg border border-slate-300 text-[13px] focus:border-[#2563eb] outline-none bg-white",
  kunde: "px-3 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300",
};
const ZEILE_FARBE: Record<GeburtVariante, { gut: string; warn: string }> = {
  office: { gut: "#94a3b8", warn: "#fbbf24" },
  hell: { gut: "#64748b", warn: "#b45309" },
  kunde: { gut: "#475569", warn: "#dc2626" },
  antrag: { gut: "inherit", warn: "inherit" },
};

export function GeburtsdatumFeld({
  teile, onTeile, kontext = "akte", ergebnis, bestaetigt = false, onBestaetigen,
  variante = "office", klasseEingabe, ids, zeigeFehler = false, fehlerFeld = null, fehlerAlle = false, ohneZeile = false,
  mitEtiketten = false, autoFocus = false, onEnter, feldRef, deaktiviert = false, zusatz, zeilenFarben,
}: {
  teile: GeburtTeile;
  onTeile: (t: GeburtTeile) => void;
  kontext?: GeburtKontext;
  /** Schon berechnet (z. B. aus useGeburtsdatum) — sonst rechnet das Bauteil selbst. */
  ergebnis?: GeburtErgebnis;
  bestaetigt?: boolean;
  /** Knopf „Stimmt so“ bei einer Rückfrage (nur wenn gesetzt). */
  onBestaetigen?: () => void;
  variante?: GeburtVariante;
  /** Eigene Klasse für die drei Eingaben (überschreibt die der Variante). */
  klasseEingabe?: string;
  ids?: Partial<Record<Teil, string>>;
  /** Auch „leer“ und „unvollständig“ melden (nach einem Klick auf Speichern/Weiter). */
  zeigeFehler?: boolean;
  /** Feld mit rotem Rahmen (Variante antrag: Klasse an-fehlt). */
  fehlerFeld?: Teil | null;
  /** Alle drei Felder rot (das Datum als Ganzes stimmt nicht). */
  fehlerAlle?: boolean;
  /** Keine Zeile darunter (die Seite zeigt sie selbst). */
  ohneZeile?: boolean;
  /** Kleine Beschriftung „Tag · Monat · Jahr“ über den Feldern. */
  mitEtiketten?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  /** Das erste Feld nach außen (Sprung „Geburtsdatum fehlt – jetzt nachtragen“). */
  feldRef?: (el: HTMLInputElement | null) => void;
  deaktiviert?: boolean;
  /** Etwas neben der Zeile (z. B. „Entfernen“ für die Leitung). */
  zusatz?: ReactNode;
  /** Farben der Zeile, wenn die Seite einen eigenen Grund hat (z. B. dunkler Antrag). */
  zeilenFarben?: { gut: string; warn: string };
}) {
  const refs = { tag: useRef<HTMLInputElement>(null), monat: useRef<HTMLInputElement>(null), jahr: useRef<HTMLInputElement>(null) };
  // Der jüngste Stand der drei Felder — auch zwischen zwei Darstellungen. Wer schnell tippt, schickt die
  // nächste Ziffer, bevor React neu gezeichnet hat; mit dem Stand aus der letzten Darstellung ginge sie
  // verloren (Prüfstand: aus 01 01 2012 wurde „012“).
  const stand = useRef(teile);
  stand.current = teile;
  const setzen = (t: GeburtTeile) => { stand.current = t; onTeile(t); };
  const erg = ergebnis ?? geburtsdatumLesen(teile, kontext);
  // Den Cursor ans Ende setzen, NICHT markieren: Wer schnell tippt, dessen nächste Ziffer landet sonst auf der
  // Markierung und ersetzt die schon getippte (gefunden im Prüfstand: aus 17·11·63 wurde 17·16·…).
  const fokus = (t: Teil) => {
    const el = refs[t].current;
    if (!el) return;
    el.focus();
    try { const n = el.value.length; el.setSelectionRange(n, n); } catch { /* egal */ }
  };

  // ── TIPPEN ──────────────────────────────────────────────────────────────
  const verteilen = (neu: GeburtTeile) => {
    setzen(neu);
    const leeres = REIHE.find((t) => !neu[t]);
    if (leeres) setTimeout(() => fokus(leeres), 0);
  };
  const aendern = (teil: Teil, roh: string) => {
    const jetzt = stand.current;
    // Eine ganze Angabe (Trennzeichen zwischen Ziffern, ISO, Monatsname) in irgendeinem Feld: verteilen.
    if (/\d\D+\d/.test(roh) || /[A-Za-zÄÖÜäöü]{3}/.test(roh)) {
      const t = geburtTeileAusEingabe(roh);
      if (t) { verteilen(t); return; }
    }
    let v = roh.replace(/\D/g, "");
    const trenner = /[.,/\-\s]$/.test(roh) && teil !== "jahr";
    if (teil === "tag" && v.length > 2) {
      // Am Stück getippt (Fokus sprang nicht mit): progressiv auf die Felder verteilen.
      const t = { tag: v.slice(0, 2), monat: v.slice(2, 4), jahr: v.slice(4, 8) };
      setzen(t);
      setTimeout(() => fokus(t.jahr ? "jahr" : "monat"), 0);
      return;
    }
    if (teil === "monat" && v.length > 2) {
      setzen({ ...jetzt, monat: v.slice(0, 2), jahr: v.slice(2, 6) });
      setTimeout(() => fokus("jahr"), 0);
      return;
    }
    if (teil === "tag" && v.length === 1 && (Number(v) > 3 || trenner)) v = `0${v}`;
    if (teil === "monat" && v.length === 1 && (Number(v) > 1 || trenner)) v = `0${v}`;
    v = v.slice(0, LAENGE[teil]);
    setzen({ ...jetzt, [teil]: v });
    const i = REIHE.indexOf(teil);
    if (i < 2 && v.length >= LAENGE[teil]) setTimeout(() => fokus(REIHE[i + 1]), 0);
  };
  const einfuegen = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const t = geburtTeileAusEingabe(text);
    if (t && (t.jahr || /\D/.test(text.trim()))) { e.preventDefault(); verteilen(t); }
  };
  const taste = (teil: Teil, e: KeyboardEvent<HTMLInputElement>) => {
    const i = REIHE.indexOf(teil);
    if (e.key === "Backspace" && !stand.current[teil] && i > 0) { e.preventDefault(); fokus(REIHE[i - 1]); return; }
    if (e.key === "Enter") { ergaenzen(); onEnter?.(); }
  };
  // ── VERLASSEN: sichtbar ergänzen („63“ → 1963, „4“ → 04) ────────────────
  const ergaenzen = () => {
    const alt = stand.current;
    const neu = { ...alt };
    if (neu.tag.length === 1 && neu.tag !== "0") neu.tag = `0${neu.tag}`;
    if (neu.monat.length === 1 && neu.monat !== "0") neu.monat = `0${neu.monat}`;
    if (neu.jahr.length === 2) {
      const e = geburtsdatumLesen(neu, kontext);
      if (e.jahrErgaenzt && e.jahr) neu.jahr = String(e.jahr);
    }
    if (neu.tag !== alt.tag || neu.monat !== alt.monat || neu.jahr !== alt.jahr) setzen(neu);
  };

  // ── DIE ZEILE DARUNTER ────────────────────────────────────────────────────
  const fertigGetippt = erg.stand !== "leer" && erg.stand !== "unvollstaendig";
  const zeigeMeldung = fertigGetippt || zeigeFehler;
  const istGut = erg.stand === "ok" || (erg.stand === "pruefen" && bestaetigt);
  const zeile = zeigeMeldung ? geburtRuecklesen(erg, bestaetigt) : "";
  const ergaenztHinweis = erg.jahrErgaenzt && teile.jahr.length === 2 && erg.jahr ? ` („${teile.jahr}“ als ${erg.jahr} gelesen)` : "";
  const farbe = zeilenFarben ?? ZEILE_FARBE[variante];
  // Die Variante antrag färbt nur, was die Seite sagt (ihre eigene Fehlerführung); die übrigen auch von selbst.
  const rahmenRot = (t: Teil) => fehlerAlle || fehlerFeld === t
    || (variante !== "antrag" && zeigeMeldung && !istGut && erg.feld === t && erg.stand !== "pruefen");

  const eingabe = (t: Teil, i: number) => {
    const klasse = variante === "antrag"
      ? `an-eingabe an-ziffer${rahmenRot(t) ? " an-fehlt" : ""}`
      : `${klasseEingabe ?? KLASSE[variante]}`;
    return (
      <input
        key={t}
        ref={(el) => { (refs[t] as { current: HTMLInputElement | null }).current = el; if (i === 0) feldRef?.(el); }}
        id={ids?.[t]}
        className={klasse}
        type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={AUTOFILL[t]}
        aria-label={ETIKETT[t]} placeholder={PLATZ[t]} value={teile[t]} disabled={deaktiviert}
        aria-invalid={rahmenRot(t) || undefined}
        autoFocus={autoFocus && i === 0}
        onChange={(e) => aendern(t, e.target.value)}
        onPaste={einfuegen}
        onKeyDown={(e) => taste(t, e)}
        onBlur={t === "jahr" ? ergaenzen : () => {
          const a = stand.current;
          if (t === "tag" && a.tag.length === 1 && a.tag !== "0") setzen({ ...a, tag: `0${a.tag}` });
          if (t === "monat" && a.monat.length === 1 && a.monat !== "0") setzen({ ...a, monat: `0${a.monat}` });
        }}
        style={variante === "antrag" ? undefined : {
          flex: "0 0 auto", width: t === "jahr" ? "5.6em" : "3.6em", minWidth: 0, textAlign: "center",
          fontVariantNumeric: "tabular-nums", letterSpacing: ".04em",
          ...(rahmenRot(t) ? { borderColor: farbe.warn } : {}),
        }}
      />
    );
  };

  if (variante === "antrag") {
    // Markup und Klassen wie im freigegebenen Antrag (antrag-neu.css: an-ziffern/an-ziffer/an-punkt).
    return (
      <div className="an-ziffern">
        {REIHE.map((t, i) => (
          <FragmentPunkt key={t} punkt={i < 2}>
            <div className="an-feld">
              <label htmlFor={ids?.[t]}>{ETIKETT[t]}</label>
              {eingabe(t, i)}
            </div>
          </FragmentPunkt>
        ))}
      </div>
    );
  }

  const punkt = <span aria-hidden="true" style={{ opacity: 0.5, padding: "0 1px" }}>.</span>;
  return (
    <div className="fi-geburt" role="group" aria-label="Geburtsdatum" style={{ display: "grid", gap: 4, minWidth: 0 }}>
      {mitEtiketten && (
        <div aria-hidden="true" style={{ display: "flex", gap: 6, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.7 }}>
          <span style={{ width: "3.6em", textAlign: "center" }}>Tag</span><span style={{ width: 8 }} />
          <span style={{ width: "3.6em", textAlign: "center" }}>Monat</span><span style={{ width: 8 }} />
          <span style={{ width: "5.6em", textAlign: "center" }}>Jahr</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
        {eingabe("tag", 0)}{punkt}{eingabe("monat", 1)}{punkt}{eingabe("jahr", 2)}
      </div>
      {!ohneZeile && (
        <div aria-live="polite" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minHeight: 18, fontSize: 12, lineHeight: 1.35, textTransform: "none", letterSpacing: 0, color: istGut ? farbe.gut : farbe.warn }}>
          <span data-geburt-stand={erg.stand}>{zeile}{istGut ? ergaenztHinweis : ""}</span>
          {erg.stand === "pruefen" && !bestaetigt && onBestaetigen && (
            <button type="button" onClick={onBestaetigen} data-geburt-bestaetigen
              style={{ font: "inherit", fontWeight: 600, padding: "2px 10px", borderRadius: 999, border: `1px solid ${farbe.warn}`, background: "transparent", color: "inherit", cursor: "pointer" }}>
              Stimmt so
            </button>
          )}
          {zusatz}
        </div>
      )}
    </div>
  );
}

function FragmentPunkt({ punkt, children }: { punkt: boolean; children: ReactNode }) {
  return <>{children}{punkt ? <div className="an-punkt">.</div> : null}</>;
}
