// ═══════════════════════════════════════════════════════════════════════════
// DIE GESPRÄCHSBÜHNE — ein Startgespräch, geführt statt improvisiert
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Der Kunde hat bezahlt, sein Konto wartet auf dieses Gespräch. Fünfzehn
// Minuten, sechs Schritte, danach ist er freigeschaltet. Diese Ebene ist alles,
// was der Mitarbeiter während des Gesprächs braucht — und nichts, was ihn
// ablenkt.
//
// ── WARUM EINE BÜHNE UND KEINE LISTE ───────────────────────────────────────
// Ein Startgespräch, das jeder anders führt, ist sechsmal ein anderes Produkt.
// Die Agenda steht im Repo (`shared/fiaon-onboarding-agenda.ts`), die Notizen
// entstehen WÄHREND des Gesprächs, und am Ende schaltet EIN Knopf frei. Wer
// hinterher aus dem Gedächtnis dokumentiert, dokumentiert das, was er behalten
// hat — nicht das, was gesagt wurde.
//
// ── DIE FORM ───────────────────────────────────────────────────────────────
// `FiaonEbene`: Glas nur auf den schwebenden Leisten, Körper ruhig und lesbar,
// Eintritt aus der Tiefe. Auf 380 px steht alles untereinander; die Fußleiste
// klebt unten, weil der Abschluss-Knopf immer erreichbar sein muss.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// 24.08.2026: Der Weg „Kunde nicht erschienen“ ist ein eigenes Bauteil — hier
// UND im Onboarding-Raum dasselbe (siehe dortigen Kommentar).
import { NichtErschienenWahl } from "@/components/agent/NichtErschienen";
import { KernbotschaftKarte } from "@/components/KernbotschaftKarte";
import { FiaonEbene } from "@/components/FiaonEbene";
import {
  AGENDA, darfAbschliessen, fortschritt, type AgendaStand,
} from "@shared/fiaon-onboarding-agenda";

/** Haken — 20×20, 1,5 px, currentColor (AGENTS.md: keine Icon-Bibliotheken). */
function Haken({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m4.5 10.5 3.6 3.6L15.5 6.5" />
    </svg>
  );
}

/**
 * Eine Rufnummer zum ABLESEN gruppieren: +49 176 1234 5678.
 *
 * Ohne Gruppen ist eine zwölfstellige Zahl eine Wand, und wer sie abtippt,
 * verliert die Stelle. Die Gruppierung folgt der deutschen Lesegewohnheit
 * (Land · Vorwahl · Rest in Vierergruppen) und lässt unbekannte Formate
 * unverändert — eine falsch gruppierte Nummer ist schlimmer als eine
 * ungruppierte.
 */
function nummerGruppiert(nummer: string): string {
  const roh = String(nummer).replace(/\s+/g, "");
  const m = /^\+49(\d{3,4})(\d+)$/.exec(roh);
  if (!m) return nummer;
  const rest = m[2].replace(/(\d{4})(?=\d)/g, "$1 ");
  return `+49 ${m[1]} ${rest}`;
}

/** Hörer — für den Anrufen-Knopf. */
function Hoerer({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
    </svg>
  );
}

export interface CockpitTermin {
  id: number;
  personId: number;
  name: string;
  telefon: string | null;
  email: string | null;
  beginn: string;
  datumText: string;
  uhrzeit: string;
  dauerMin: number;
  status: string;
  paket?: string | null;
  zahlungsstand?: string | null;
}

interface Lage {
  paket: string | null;
  zahlungsstand: string | null;
  dokumente: { fehlend?: { art: string; label: string }[]; stand: string | null } | null;
  bonitaet: string | null;
  stufe: string | null;
  /** P7 (28.08.2026): Stammdaten und Ratenstand — die Kundendaten IM Cockpit. */
  stammdaten?: {
    name: string; geburtsdatum: string | null; adresse: string | null;
    telefon: string | null; email: string | null;
  } | null;
  raten?: {
    bezahlt: number; offen: number; ueberfaellig: number;
    naechsteAm: string | null; rateCents: number | null;
  } | null;
}

export function OnboardingCockpit({
  termin, onZu, onFertig, onAnrufen,
}: {
  termin: CockpitTermin;
  onZu: () => void;
  /**
   * Der Vorgang ist durch — mit der Meldung, die der Server geschickt hat.
   *
   * 24.08.2026: `warn` kam dazu. VORHER wurde jeder Ausgang gleich gemeldet;
   * ein No-Show, dessen E-Mail NICHT rausging, sah aus wie einer, dessen Mail
   * ankam. NACHHER sagt das zweite Feld, dass der Vorgang zwar dokumentiert
   * ist, die Nachricht an den Kunden aber nicht rausging. Freiwillig, damit
   * die anderen Aufrufer (Softphone, Startgespräche) unverändert bleiben.
   */
  onFertig: (meldung: string, warn?: boolean) => void;
  /** Öffnet das Softphone MIT Kundenkontext — nicht ein zweites Telefon. */
  onAnrufen?: (nummer: string, personId: number, name: string) => void;
}) {
  // ── ZWISCHENSPEICHER (22.08.2026, P-09) ─────────────────────────────────
  // Fünfzehn Minuten Notizen lagen nur im Arbeitsspeicher: Ein Reload, ein
  // versehentliches Schließen, ein 502 beim Abschluss — und alles war weg.
  // Jetzt liegt der Stand je Termin im Browser, bis das Gespräch abgeschlossen
  // ist. Kein Server-Weg: Es ist der Entwurf des Mitarbeiters, nicht die Akte.
  const speicherKey = `fiaon-cockpit-${termin.id}`;
  const [stand, setStand] = useState<AgendaStand>(() => {
    try {
      const roh = window.localStorage.getItem(speicherKey);
      const g = roh ? JSON.parse(roh) : null;
      if (g && Array.isArray(g.erledigt) && g.notizen && typeof g.notizen === "object") return g as AgendaStand;
    } catch { /* kaputter Eintrag — frisch anfangen */ }
    return { erledigt: [], notizen: {} };
  });
  useEffect(() => {
    try { window.localStorage.setItem(speicherKey, JSON.stringify(stand)); } catch { /* voll oder gesperrt */ }
  }, [stand, speicherKey]);
  // Wer mitten im Gespräch das Fenster schließt, wird gefragt — die Notizen
  // bleiben zwar gespeichert, aber der Anruf läuft noch.
  useEffect(() => {
    const hatInhalt = stand.erledigt.length > 0 || Object.values(stand.notizen).some((n) => (n ?? "").trim());
    if (!hatInhalt) return;
    const warnen = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [stand]);
  const [offen, setOffen] = useState<string | null>(AGENDA[0]?.key ?? null);

  // ══ DIE NOTIZ IST DIE GRUNDLAGE (P1, Team-Feedback 28.08.2026) ══════════
  // Florentine: „Gespräch führen → Notizen eingeben → KI analysiert →
  // fehlende Punkte werden angezeigt → alles vollständig → automatisch
  // bestätigt." Der Mitarbeiter tippt EINE Gesprächsnotiz; die Prüfung hakt
  // die belegten Agenda-Schritte ab und füllt deren Pflichtnotizen aus den
  // Sätzen der Notiz. Das manuelle Abhaken bleibt als Weg bestehen — für
  // Ausfälle der Prüfung und für alle, die lieber klicken.
  const freiKey = `fiaon-cockpit-frei-${termin.id}`;
  const [freiNotiz, setFreiNotiz] = useState<string>(() => {
    try { return window.localStorage.getItem(freiKey) ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(freiKey, freiNotiz); } catch { /* voll */ }
  }, [freiNotiz, freiKey]);
  const [analyse, setAnalyse] = useState<{
    laeuft: boolean;
    fehlt: { key: string; titel: string; hinweis: string }[] | null;
    verbesserung: string | null;
    meldung: string | null;
  }>({ laeuft: false, fehlt: null, verbesserung: null, meldung: null });

  const notizPruefen = async () => {
    if (freiNotiz.trim().length < 15) {
      setAnalyse((v) => ({ ...v, meldung: "Schreib erst ein paar Sätze — dann kann die Prüfung etwas erkennen." }));
      return;
    }
    setAnalyse({ laeuft: true, fehlt: null, verbesserung: null, meldung: null });
    try {
      const r = await fetch("/api/fiaon/agent/onboarding/notiz-analyse", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notiz: freiNotiz }),
      });
      const j = await r.json();
      if (!j?.ok) {
        setAnalyse({ laeuft: false, fehlt: null, verbesserung: null, meldung: j?.grund || "Die Prüfung ist gerade nicht erreichbar — bitte von Hand abhaken." });
        return;
      }
      // Belegte Schritte abhaken und ihre Pflichtnotiz aus der Notiz füllen.
      // Eigene, längere Schritt-Notizen werden NIE überschrieben.
      setStand((v) => {
        const erledigt = Array.from(new Set([...v.erledigt, ...j.erledigt]));
        const notizen = { ...v.notizen };
        for (const [k, satz] of Object.entries(j.notizenJeSchritt || {})) {
          if ((notizen[k] ?? "").trim().length < 10) notizen[k] = String(satz);
        }
        return { erledigt, notizen };
      });
      setAnalyse({
        laeuft: false,
        fehlt: j.fehlt || [],
        verbesserung: j.verbesserung || null,
        meldung: (j.fehlt || []).length === 0
          ? "Alle Gesprächspunkte sind belegt — du kannst direkt abschließen."
          : null,
      });
      setFehler(null);
    } catch {
      setAnalyse({ laeuft: false, fehlt: null, verbesserung: null, meldung: "Die Prüfung ist gerade nicht erreichbar — bitte von Hand abhaken." });
    }
  };
  const [lage, setLage] = useState<Lage | null>(null);
  const [busy, setBusy] = useState<"" | "fertig">("");
  // 24.08.2026: Die Grund-Wahl. Sie ERSETZT die beiden Fußknöpfe, solange sie
  // offen ist — am Handy wäre die Fußleiste sonst höher als das halbe Bild.
  const [noshowOffen, setNoshowOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sekunden, setSekunden] = useState(0);
  const gestartet = useRef(Date.now());

  // ── DIE UHR LÄUFT MIT ───────────────────────────────────────────────────
  // Nicht als Druckmittel, sondern als Auskunft: Fünfzehn Minuten sind
  // zugesagt. Wer bei Minute 24 ist, weiß es — und kann es ansprechen, statt
  // den Kunden zu überziehen.
  useEffect(() => {
    const t = setInterval(() => setSekunden(Math.round((Date.now() - gestartet.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Die Lage des Kunden: Zahlung, Unterlagen, Bonität. Wer im Gespräch nach
  // dem Kontoauszug fragt, muss wissen, ob er schon da ist.
  useEffect(() => {
    let weg = false;
    void fetch(`/api/fiaon/agent/onboarding/person/${termin.personId}/lage`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (!weg && j?.ok) setLage(j.lage ?? j); })
      .catch(() => {});
    return () => { weg = true; };
  }, [termin.personId]);

  const prozent = useMemo(() => fortschritt(stand), [stand]);
  const pruefung = useMemo(() => darfAbschliessen(stand), [stand]);

  const abhaken = useCallback((key: string) => {
    setStand((v) => ({
      ...v,
      erledigt: v.erledigt.includes(key) ? v.erledigt.filter((k) => k !== key) : [...v.erledigt, key],
    }));
    setFehler(null);
  }, []);

  const notieren = useCallback((key: string, text: string) => {
    setStand((v) => ({ ...v, notizen: { ...v.notizen, [key]: text } }));
    setFehler(null);
  }, []);

  const abschliessen = async () => {
    if (!pruefung.ok) {
      setFehler(`Es fehlt noch: ${pruefung.fehlt.join(" · ")}`);
      return;
    }
    setBusy("fertig");
    const r = await fetch(`/api/fiaon/agent/onboarding/termine/${termin.id}/ergebnis`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ergebnis: "erledigt",
        // Die gesammelten Notizen als EIN Verlaufseintrag, in der Reihenfolge
        // der Agenda — so liest es sich später wie ein Protokoll.
        // P1: Die freie Gesprächsnotiz zuerst, dann das Agenda-Protokoll.
        notiz: [
          freiNotiz.trim() ? `Gesprächsnotiz: ${freiNotiz.trim()}` : null,
          ...AGENDA
            .filter((a) => (stand.notizen[a.key] ?? "").trim())
            .map((a) => `${a.titel}: ${stand.notizen[a.key].trim()}`),
        ].filter(Boolean).join("\n"),
        agenda: stand,
        dauerSek: sekunden,
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy("");
    if (j?.ok) {
      try { window.localStorage.removeItem(speicherKey); window.localStorage.removeItem(freiKey); } catch { /* egal */ }
      onFertig(j.hinweis || "Startgespräch abgeschlossen — das Konto ist freigeschaltet.");
    } else {
      // Der Grund, nicht „hat nicht geklappt": 403 heißt Zusage fehlt, 404 der
      // Termin ist weg, 5xx der Server. Die Notizen bleiben gespeichert.
      const grund = j?.error || (r ? `HTTP ${r.status}` : "keine Verbindung");
      setFehler(`Der Abschluss hat nicht geklappt (${grund}). Deine Notizen sind zwischengespeichert — bitte noch einmal versuchen.`);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // „KUNDE NICHT ERSCHIENEN“ — 24.08.2026
  //
  // VORHER stand hier eine Sicherheitsfrage mit EINEM Ausgang: Ja/Nein, und
  // im Ja-Fall ging die Mail „Termin verpasst“ raus — auch an den Kunden, der
  // gerade abgesagt hatte, und an den mit der falschen Nummer, der sie nie
  // lesen wird.
  // NACHHER klappt an dieser Stelle die Grund-Wahl auf (NichtErschienen.tsx).
  // Sie sagt vor dem Klick, was passieren WIRD, und danach, was passiert IST.
  // Die Sicherheitsfrage entfällt: Der Grund selbst ist die Rückfrage, und
  // jeder Grund trägt seine Folge im Klartext.
  // GRUND: Auftrag des Inhabers vom 24.08.2026.
  // ══════════════════════════════════════════════════════════════════════

  const mmss = `${String(Math.floor(sekunden / 60)).padStart(2, "0")}:${String(sekunden % 60).padStart(2, "0")}`;
  const ueberzogen = sekunden > (termin.dauerMin || 15) * 60;

  return (
    // ── E-054 (Justin 24.08.2026) ─────────────────────────────────────────
    // VORHER: Die Ebene stand hell (Weiß, #0f172a, Gewichte 700/800) mitten im
    // dunklen Office-Raum — Justin: „das ist aktuell noch immer weiß und viel
    // zu wuchtig". NACHHER: `ton="dunkel"` schaltet dieselbe Ebene auf die
    // Office-CI (dunkles Glas, Lichtkante, helle Schrift); der ganze Stil
    // unten folgt derselben Formensprache wie office-pipeline.css /
    // office-onboarding.css. An der Fachlogik ändert sich nichts.
    <FiaonEbene
      offen
      onZu={onZu}
      ton="dunkel"
      titel={`Startgespräch mit ${termin.name}`}
      breite={720}
      marke={<span style={{ color: "#93c5fd" }}><Hoerer size={16} /></span>}
      kopf={
        <div className="min-w-0 flex-1">
          <p className="fi-ob-ueber">Startgespräch · {termin.datumText}, {termin.uhrzeit} Uhr</p>
          <h2 className="fi-ob-titel">{termin.name}</h2>
          <p className="fi-ob-unter">
            {[
              lage?.paket || termin.paket,
              lage?.zahlungsstand || termin.zahlungsstand,
            ].filter(Boolean).join(" · ") || "Bezahlt — wartet auf die Freischaltung"}
          </p>

          {/* ══════════════════════════════════════════════════════════════
              DIE NUMMER GROSS (19.08.2026)

              ── WARUM SIE VORHER FEHLTE UND WARUM DAS EIN PROBLEM WAR ────
              Es gab nur den Anrufen-Knopf. Der reicht, solange das Softphone
              tut — aber genau zur Terminzeit ist der schlechteste Moment für
              „das Telefon lädt nicht". Dann braucht der Mitarbeiter die Nummer
              zum ABLESEN, um vom Diensthandy zu wählen. Sie im
              Gesprächsblatt zu suchen, kostet die Minute, in der der Kunde
              bereitsitzt.

              ── WARUM GROSS UND MIT ZIFFERNABSTAND ───────────────────────
              Sie wird ABGETIPPT. Eine Nummer in 12,5 px Grau, ohne Gruppen,
              vertippt sich — und ein Vertipper ruft einen fremden Menschen an.
              Deshalb 19 px, tabellarische Ziffern, in Gruppen.

              Der Anrufen-Knopf steht direkt daneben: Wer klicken kann, klickt.
              Wer nicht kann, liest. ══════════════════════════════════════ */}
          {termin.telefon ? (
            <div className="fi-ob-nummer-zeile">
              <a href={`tel:${termin.telefon}`} className="fi-ob-nummer"
                 title="Am Telefon dieses Geräts wählen">
                {nummerGruppiert(termin.telefon)}
              </a>
              {onAnrufen && (
                <button type="button"
                        onClick={() => onAnrufen(termin.telefon!, termin.personId, termin.name)}
                        className="fi-ob-nummer-knopf">
                  <Hoerer size={14} /> Anrufen
                </button>
              )}
            </div>
          ) : (
            <p className="fi-ob-nummer-fehlt">
              Keine Telefonnummer hinterlegt — dieses Gespräch kann nicht geführt werden.
              Bitte im Gesprächsblatt nachtragen.
            </p>
          )}
        </div>
      }
      fuss={
        <div className="fi-ob-fuss">
          {fehler && <p className="fi-ob-fehler">{fehler}</p>}
          {noshowOffen ? (
            <NichtErschienenWahl
              termin={{ id: termin.id, name: termin.name }}
              onAbbruch={() => setNoshowOffen(false)}
              onFertig={(hinweis, warn) => {
                // Die Notizen dieses Gesprächs braucht niemand mehr — der
                // Vorgang ist dokumentiert, das Cockpit schließt.
                try { window.localStorage.removeItem(speicherKey); window.localStorage.removeItem(freiKey); } catch { /* egal */ }
                setNoshowOffen(false);
                onFertig(hinweis, warn);
              }}
            />
          ) : (
            <>
              <div className="fi-ob-fuss-zeile">
                <button type="button" onClick={() => setNoshowOffen(true)} disabled={busy !== ""}
                        aria-expanded={false} className="fi-ob-knopf-still">
                  Kunde nicht erschienen
                </button>
                <button type="button" onClick={() => void abschliessen()} disabled={busy !== ""}
                        className="fi-ob-knopf-haupt" data-bereit={pruefung.ok ? "ja" : undefined}>
                  {busy === "fertig" ? "Wird abgeschlossen …" : "Gespräch abschließen & freischalten"}
                </button>
              </div>
              {!pruefung.ok && (
                <p className="fi-ob-fuss-hinweis">
                  Noch offen: {pruefung.fehlt.join(" · ")}
                </p>
              )}
            </>
          )}
        </div>
      }
      kinder={
        <>
          <style>{COCKPIT_CSS}</style>

          {/* ── E-054 (Justin 24.08.2026): EIN RASTER STATT GESTAPELTER
              MARGINS ─────────────────────────────────────────────────────
              VORHER lagen Leiste, Balken, Agenda und Lage lose nebeneinander,
              jeder Block mit eigenem margin-bottom — die Abstände waren
              ungleich und der Inhalt wirkte gedrängt („viel zu wuchtig").
              NACHHER trägt EIN Grid mit festem Abstand alle Blöcke; die
              Abstände sind damit überall gleich. Reine Darstellung. */}
          <div className="fi-ob-koerper">

          {/* ── KOPFLEISTE: ANRUFEN, UHR, FORTSCHRITT ────────────────── */}
          {/* 24.08.2026: VORHER stand hier ein ZWEITER „Anrufen"-Knopf, direkt
              unter dem großen im Kopf — zwei gleiche Knöpfe übereinander, von
              denen einer überflüssig war. NACHHER trägt der Kopf den Anruf
              (dort steht auch die Nummer zum Ablesen), diese Leiste nur noch
              Uhr und Gesprächsblatt. */}
          <div className="fi-ob-leiste">
            <span className="fi-ob-uhr" data-ueber={ueberzogen ? "ja" : undefined}
                  title={`Zugesagt sind ${termin.dauerMin || 15} Minuten`}>
              {mmss}
            </span>
            <a href={`/agent/kunden?person=${termin.personId}`} className="fi-ob-blatt">
              Gesprächsblatt
            </a>
          </div>

          {/* ── FORTSCHRITT ──────────────────────────────────────────────
              24.08.2026: VORHER 4 px Balken mit eigenem margin darunter —
              NACHHER ein 3-px-Haarstrich mit seiner Beschriftung in einer
              eigenen kleinen Gruppe. Der Balken BLEIBT, nur dezenter. */}
          <div className="fi-ob-fortschritt">
            <div className="fi-ob-balken-halter" role="progressbar"
                 aria-valuenow={prozent} aria-valuemin={0} aria-valuemax={100}
                 aria-label="Fortschritt der Agenda">
              <div className="fi-ob-balken" style={{ width: `${prozent}%` }} />
            </div>
            <p className="fi-ob-balken-text">
              {stand.erledigt.length} von {AGENDA.length} Schritten · {prozent} %
            </p>
          </div>

          {/* ══ DIE KUNDENDATEN — NEBEN DER AGENDA, NICHT DAHINTER (P7) ═══
              „Sobald ich auf Gespräch führen klicke, sehe ich die Kundendaten
              nicht mehr." Jetzt stehen sie hier: Stammdaten, Paket, Zahlung,
              Raten, Unterlagen — alles, wonach ein Kunde im Gespräch fragt,
              ohne die Bühne zu verlassen. */}
          {lage?.stammdaten && (
            <div style={{ margin: "12px 0 2px", padding: "12px 16px", borderRadius: 14,
                          background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)",
                          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px 18px" }}>
              {[
                ["Geburtsdatum", lage.stammdaten.geburtsdatum
                  ? new Date(String(lage.stammdaten.geburtsdatum).slice(0, 10) + "T12:00:00Z").toLocaleDateString("de-DE")
                  : "—"],
                ["Adresse", lage.stammdaten.adresse || "—"],
                ["E-Mail", lage.stammdaten.email || "—"],
                ["Bonitätsauskunft", lage.bonitaet || "—"],
                ["Raten", lage.raten
                  ? `${lage.raten.bezahlt} bezahlt · ${lage.raten.offen} offen${lage.raten.ueberfaellig ? ` · ${lage.raten.ueberfaellig} überfällig` : ""}${lage.raten.rateCents != null ? ` · ${(lage.raten.rateCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €/Monat` : ""}`
                  : "—"],
                ["Nächste Rate", lage.raten?.naechsteAm
                  ? new Date(String(lage.raten.naechsteAm).slice(0, 10) + "T12:00:00Z").toLocaleDateString("de-DE")
                  : "—"],
                ["Unterlagen", lage.dokumente
                  ? ((lage.dokumente.fehlend?.length ?? 0) > 0
                      ? `es fehlt: ${(lage.dokumente.fehlend ?? []).map((f) => f.label).join(", ")}`
                      : "vollständig")
                  : "—"],
              ].map(([t, w]) => (
                <div key={t as string} style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(148,163,184,.85)" }}>{t}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "#e2e8f0", overflowWrap: "anywhere" }}>{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* ══ GESPRÄCHSNOTIZ MIT PRÜFUNG (P1, 28.08.2026) ═══════════════
              Eine Notiz statt sechs Kästchen: tippen, prüfen lassen, die
              belegten Schritte werden abgehakt. Nur was fehlt, wird gemeldet. */}
          <div className="fi-ob-notizpruefung" style={{ margin: "14px 0 4px", display: "grid", gap: 8 }}>
            <label style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: "#93c5fd" }}>
              Gesprächsnotiz — hier tippst du mit, die Prüfung hakt ab
            </label>
            <textarea value={freiNotiz} onChange={(e) => setFreiNotiz(e.target.value)}
                      rows={4}
                      placeholder={"Schreib mit, was besprochen wird — in ganzen Sätzen.\nBeispiel: Kunde wurde begrüßt, Ziel ist eine eigene Karte. Fahrplan erklärt. Laufende Kosten (12 Monatsraten) bestätigt. Nächste Schritte und Erreichbarkeit erklärt."}
                      style={{ width: "100%", resize: "vertical", borderRadius: 12, padding: "10px 12px",
                               fontSize: 13.5, lineHeight: 1.55, outline: "none",
                               background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.25)", color: "#e2e8f0" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={() => void notizPruefen()} disabled={analyse.laeuft}
                      style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                               background: "rgba(37,99,235,.25)", border: "1px solid rgba(96,165,250,.45)", color: "#dbeafe" }}>
                {analyse.laeuft ? "Prüft …" : "Notiz prüfen & abhaken"}
              </button>
              {analyse.meldung && (
                <span style={{ fontSize: 12.5, color: analyse.fehlt && analyse.fehlt.length === 0 ? "#86efac" : "#fbbf24" }}>
                  {analyse.meldung}
                </span>
              )}
            </div>
            {analyse.fehlt && analyse.fehlt.length > 0 && (
              <div role="alert" style={{ display: "grid", gap: 5, padding: "10px 14px", borderRadius: 12,
                                         background: "rgba(217,119,6,.12)", border: "1px solid rgba(251,191,36,.35)" }}>
                {analyse.fehlt.map((f) => (
                  <p key={f.key} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#fcd34d" }}>{f.hinweis}</p>
                ))}
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(203,213,225,.75)" }}>
                  Kläre die Punkte im Gespräch, ergänze die Notiz und prüfe erneut — oder hake unten von Hand ab.
                </p>
              </div>
            )}
            {analyse.verbesserung && (
              <div style={{ display: "grid", gap: 6, padding: "10px 14px", borderRadius: 12,
                            background: "rgba(37,99,235,.10)", border: "1px solid rgba(96,165,250,.3)" }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: "#93c5fd" }}>Vorschlag für eine sauberere Fassung:</p>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{analyse.verbesserung}</p>
                <div>
                  <button type="button"
                          onClick={() => { setFreiNotiz(analyse.verbesserung!); setAnalyse((v) => ({ ...v, verbesserung: null })); }}
                          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                   background: "transparent", border: "1px solid rgba(96,165,250,.45)", color: "#93c5fd" }}>
                    Übernehmen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── DIE AGENDA ───────────────────────────────────────────── */}
          <ol className="fi-ob-agenda">
            {AGENDA.map((a, i) => {
              const getan = stand.erledigt.includes(a.key);
              const auf = offen === a.key;
              const notiz = stand.notizen[a.key] ?? "";
              const notizFehlt = a.notizPflicht && getan && notiz.trim().length < 10;
              return (
                <li key={a.key} className="fi-ob-schritt" data-getan={getan ? "ja" : undefined}
                    data-auf={auf ? "ja" : undefined}>
                  <div className="fi-ob-schritt-kopf">
                    <button type="button" onClick={() => abhaken(a.key)}
                            aria-label={getan ? `${a.titel} wieder öffnen` : `${a.titel} abhaken`}
                            aria-pressed={getan}
                            className="fi-ob-haken" data-an={getan ? "ja" : undefined}>
                      {getan ? <Haken /> : <span className="fi-ob-nr">{i + 1}</span>}
                    </button>
                    {/* ── ZWEI KNÖPFE, ZWEI NAMEN ──────────────────────────
                        Der Haken links und dieser Titel trugen beide den
                        Schritt-Namen. Für einen Screenreader (und für den
                        Prüfstand) waren sie damit nicht unterscheidbar: „Wähle
                        ‚Fahrplan erklärt'" — welchen von beiden?
                        Aufgefallen beim Browserlauf, der den falschen traf. */}
                    <button type="button" onClick={() => setOffen(auf ? null : a.key)}
                            aria-label={`${a.titel} — Anleitung ${auf ? "zuklappen" : "aufklappen"}`}
                            className="fi-ob-schritt-titel" aria-expanded={auf}>
                      <span>{a.titel}</span>
                      {a.notizPflicht && <span className="fi-ob-pflicht">Notiz nötig</span>}
                      {notizFehlt && <span className="fi-ob-mahnt">Notiz fehlt</span>}
                    </button>
                  </div>
                  {auf && (
                    <div className="fi-ob-schritt-koerper">
                      <p className="fi-ob-zweck">{a.zweck}</p>
                      <ul className="fi-ob-punkte">
                        {a.punkte.map((punkt) => <li key={punkt}>{punkt}</li>)}
                      </ul>
                      {/* ══════════════════════════════════════════════════
                          DIE KERNBOTSCHAFT — FÜR DAS KUNDENGESPRÄCH

                          Genau an diesem Schritt („Abo-Klarheit") wird sie
                          gebraucht: Der Mitarbeiter erklärt dem Kunden die
                          laufenden Kosten, und dabei gehört der Satz über
                          Bonität und SCHUFA-Meldung dazu — im freigegebenen
                          Wortlaut, nicht in eigenen Worten.

                          Sie steht hier eingeblendet und nicht als Link: Wer
                          im Gespräch eine Seite wechseln muss, sagt den Satz
                          aus dem Gedächtnis. Und dann fehlt die Hälfte.

                          Dasselbe Bauteil wie in der Academy — eine zweite
                          Fassung wären zwei Sätze, die auseinanderlaufen.
                          ══════════════════════════════════════════════════ */}
                      {/* 24.08.2026: VORHER Inline-Stile mit fontWeight 700 und
                          eigenen Rändern, dazu die HELLE Kernbotschaft-Karte auf
                          dunklem Grund — NACHHER Versalien-Label im Haus-Muster
                          (500 / 10,5 px / .14em / #93c5fd) und dieselbe Karte in
                          ihrer dunklen Fassung. Der Wortlaut bleibt unberührt. */}
                      {a.key === "abo_klarheit" && (
                        <div className="fi-ob-kern">
                          <p className="fi-ob-kern-titel">
                            Das sagst du dem Kunden — wörtlich
                          </p>
                          <KernbotschaftKarte dunkel />
                        </div>
                      )}
                      <textarea
                        value={notiz}
                        onChange={(e) => notieren(a.key, e.target.value)}
                        rows={2}
                        placeholder={a.notizFrage || "Notiz zu diesem Schritt (freiwillig)"}
                        aria-label={`Notiz zu ${a.titel}`}
                        className="fi-ob-notiz"
                      />
                      {a.notizPflicht && (
                        <p className="fi-ob-notiz-fuss" data-fehlt={notizFehlt ? "ja" : undefined}>
                          {notiz.trim().length >= 10
                            ? "Steht im Protokoll."
                            : `Pflicht — noch ${Math.max(0, 10 - notiz.trim().length)} Zeichen`}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* ── DIE LAGE DES KUNDEN ─────────────────────────────────── */}
          {lage && (
            <div className="fi-ob-lage">
              <p className="fi-ob-lage-titel">Was wir über ihn wissen</p>
              {/* Das Feld heißt `fehlend` (server/lib/fiaon-kundenlage.ts) und ist
                  eine Liste von { art, label }. Der erste Entwurf las `fehlt` —
                  immer undefined, also stand hier IMMER „vollständig". Genau an
                  dem Schritt, der verlangt, konkret zu sagen, was fehlt. */}
              {lage.dokumente?.fehlend?.length
                ? <p className="fi-ob-lage-zeile" data-warn="ja">
                    Es fehlt: {lage.dokumente.fehlend.map((d: any) => d.label || d.art).join(", ")}
                  </p>
                : lage.dokumente
                  ? <p className="fi-ob-lage-zeile">Unterlagen sind vollständig.</p>
                  : <p className="fi-ob-lage-zeile">Unterlagen: Stand konnte nicht geladen werden.</p>}
              {lage.bonitaet && <p className="fi-ob-lage-zeile">Bonitätsauskunft: {lage.bonitaet}</p>}
            </div>
          )}
          </div>
        </>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STIL — 24.08.2026, E-054
//
// ── WARUM NEU (Justin, wörtlich) ───────────────────────────────────────────
// „hier bitte neu machen, in unseren CI — das ist aktuell noch immer weiß und
// viel zu wuchtig, man kann am Handy kaum scrollen — das muss flüssiger laufen
// und cleanere Darstellung."
//
// ── VORHER / NACHHER ───────────────────────────────────────────────────────
// VORHER: weiße Flächen (#fff), Text #0f172a, Schriftgewichte 700/800, ein
// Rahmen um jeden Kasten, Abstände über gestapelte margins.
// NACHHER: Office-Glas — rgba(15,23,42,.6), 1 px rgba(255,255,255,.12),
// backdrop-filter blur(14–16px) —, 'Inter' in 300/400/500 (NIE 700/800: genau
// das war das „Wuchtige"), Titel und Zahlen LEICHT und groß statt fett, ein
// einziges Raster mit gleichem Abstand statt margin-Stapeln.
//
// Die Werte sind nicht neu erfunden, sondern 1:1 aus office-pipeline.css und
// office-onboarding.css übernommen — ein Raum, eine Formensprache.
// ═══════════════════════════════════════════════════════════════════════════
const COCKPIT_CSS = `
/* ── DER KOPF ─────────────────────────────────────────────────────────────
   24.08.2026: VORHER 11-px-Versalien in Grau, Titel 19 px/800, Nummer 700 auf
   Weiß — NACHHER das Haus-Label (500 / 10,5 px / .14em / #93c5fd), der Name
   groß und LEICHT (300), die Nummer als Glaskachel zum Ablesen. */
.fi-ob-ueber{margin:0;font:500 10.5px/1 'Inter',sans-serif;letter-spacing:.14em;
  text-transform:uppercase;color:#93c5fd}
.fi-ob-titel{margin:10px 0 0;font:300 27px/1.15 'Inter',sans-serif;letter-spacing:-.02em;
  color:#fff;overflow-wrap:anywhere}
.fi-ob-unter{margin:5px 0 0;font:300 13px/1.55 'Inter',sans-serif;color:#9ca3af}

/* ── DIE NUMMER IM KOPF (19.08.2026, Form 24.08.2026) ─────────────────────
   Sie wird zur Terminzeit abgelesen und abgetippt. Deshalb weiterhin 19 px und
   tabellarische Ziffern — aber in 400 statt 700 und auf einer Glaskachel, die
   groß genug ist, um sie mit dem Finger zu treffen. */
.fi-ob-nummer-zeile{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
.fi-ob-nummer{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;
  border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);
  font:400 19px/1 'Inter',sans-serif;letter-spacing:.01em;font-variant-numeric:tabular-nums;
  color:#fff;text-decoration:none;transition:border-color 200ms}
.fi-ob-nummer:hover{border-color:rgba(96,165,250,.5)}
.fi-ob-nummer-knopf{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  flex:0 0 auto;min-height:40px;padding:0 16px;border-radius:999px;border:0;cursor:pointer;
  font:500 12.5px/1 'Inter',sans-serif;color:#fff;
  background:linear-gradient(135deg,#2563eb,#3b82f6);box-shadow:0 10px 24px rgba(37,99,235,.3);
  touch-action:manipulation}
/* Keine Nummer heißt: Dieses Gespräch kann nicht stattfinden. Das ist ein
   Hinweis in Bernstein, keine graue Nebenbemerkung. */
.fi-ob-nummer-fehlt{margin:14px 0 0;padding:10px 14px;border-radius:12px;
  background:rgba(245,158,11,.12);border:1px solid rgba(251,191,36,.35);
  font:400 12.5px/1.5 'Inter',sans-serif;color:#fde68a}

/* ── DER KÖRPER: EIN RASTER ───────────────────────────────────────────────
   24.08.2026: VORHER trug jeder Block seinen eigenen margin — die Abstände
   waren ungleich (14 / 16 / 6 px). NACHHER EIN Grid, ein Abstand. */
.fi-ob-koerper{display:grid;gap:22px;font-family:'Inter',sans-serif}

/* ── LEISTE: ANRUFEN, UHR, GESPRÄCHSBLATT ─────────────────────────────── */
.fi-ob-leiste{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fi-ob-anrufen{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:44px;padding:0 18px;border:0;border-radius:999px;cursor:pointer;
  background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;
  font:500 13.5px/1 'Inter',sans-serif;box-shadow:0 12px 28px rgba(37,99,235,.35);
  touch-action:manipulation}
.fi-ob-anrufen:hover{filter:brightness(1.06)}
/* Die Uhr ist eine Auskunft, kein Alarm: groß, aber LEICHT (300). */
.fi-ob-uhr{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;
  border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);
  font:300 20px/1 'Inter',sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#fff}
.fi-ob-uhr[data-ueber="ja"]{color:#fbbf24;background:rgba(245,158,11,.12);
  border-color:rgba(251,191,36,.4)}
.fi-ob-blatt{margin-left:auto;display:inline-flex;align-items:center;min-height:44px;
  font:500 12.5px/1 'Inter',sans-serif;color:#93c5fd;text-decoration:none}
.fi-ob-blatt:hover{text-decoration:underline;text-underline-offset:3px}

/* ── FORTSCHRITT: bleibt, aber dezent ─────────────────────────────────── */
.fi-ob-fortschritt{display:grid;gap:9px}
.fi-ob-balken-halter{height:3px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
.fi-ob-balken{height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#3b82f6);
  transition:width 320ms cubic-bezier(.32,.72,0,1)}
.fi-ob-balken-text{margin:0;font:400 11.5px/1 'Inter',sans-serif;letter-spacing:.04em;
  color:#64748b;font-variant-numeric:tabular-nums}

/* ── DIE AGENDA: ruhige Glaskarten ────────────────────────────────────────
   24.08.2026: VORHER weiße Kästen mit Rahmen, darin ein zweiter Kasten für die
   Notiz („Kasten im Kasten"). NACHHER eine Glasfläche je Schritt, die Anleitung
   durch EINE Haarlinie abgetrennt — kein zweiter Rahmen, kein Grau-in-Grau. */
.fi-ob-agenda{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.fi-ob-schritt{border-radius:20px;background:rgba(15,23,42,.6);
  border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);transition:border-color 200ms}
.fi-ob-schritt[data-auf="ja"]{border-color:rgba(96,165,250,.35)}
.fi-ob-schritt[data-getan="ja"]{border-color:rgba(52,211,153,.32)}
.fi-ob-schritt-kopf{display:grid;grid-template-columns:auto minmax(0,1fr);gap:13px;
  align-items:center;padding:15px 17px}
.fi-ob-haken{width:32px;height:32px;border-radius:11px;flex:0 0 auto;display:inline-flex;
  align-items:center;justify-content:center;cursor:pointer;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#93c5fd;
  transition:background 200ms,border-color 200ms;touch-action:manipulation}
.fi-ob-haken:hover{border-color:rgba(96,165,250,.5)}
.fi-ob-haken[data-an="ja"]{background:linear-gradient(135deg,#059669,#34d399);
  border-color:transparent;color:#04241b}
.fi-ob-nr{font:400 12.5px/1 'Inter',sans-serif;color:#93c5fd;font-variant-numeric:tabular-nums}
.fi-ob-schritt-titel{min-width:0;padding:0;text-align:left;background:none;border:0;cursor:pointer;
  display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-height:32px;
  font:400 14.5px/1.35 'Inter',sans-serif;color:#fff}
/* Die zwei Merker: Umriss statt Farbfläche — sie sollen den Titel nicht
   überstimmen. */
.fi-ob-pflicht,.fi-ob-mahnt{display:inline-flex;align-items:center;padding:4px 9px;
  border-radius:999px;font:500 10px/1 'Inter',sans-serif;letter-spacing:.12em;
  text-transform:uppercase;border:1px solid rgba(255,255,255,.12);color:#64748b}
.fi-ob-mahnt{color:#fde68a;border-color:rgba(251,191,36,.4)}
.fi-ob-schritt-koerper{display:grid;gap:14px;margin:0 17px;padding:15px 0 17px;
  border-top:1px solid rgba(255,255,255,.08)}
.fi-ob-zweck{margin:0;font:300 13px/1.6 'Inter',sans-serif;color:#9ca3af}
.fi-ob-punkte{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.fi-ob-punkte li{position:relative;padding-left:17px;font:300 13.5px/1.55 'Inter',sans-serif;
  color:#e5e7eb}
.fi-ob-punkte li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;
  border-radius:999px;background:#93c5fd;opacity:.85}
.fi-ob-kern{display:grid;gap:10px}
.fi-ob-kern-titel{margin:0;font:500 10.5px/1 'Inter',sans-serif;letter-spacing:.14em;
  text-transform:uppercase;color:#93c5fd}
/* Das Notizfeld: 15 px, am Handy 16 px — darunter zoomt iOS beim Antippen
   hinein, und dann steht das halbe Cockpit außerhalb des Bildes. */
.fi-ob-notiz{width:100%;min-height:84px;border-radius:14px;padding:12px 14px;
  font:400 15px/1.55 'Inter',sans-serif;color:#fff;background:rgba(2,6,23,.4);
  border:1px solid rgba(255,255,255,.14);outline:none;resize:vertical;color-scheme:dark}
.fi-ob-notiz::placeholder{color:#64748b}
.fi-ob-notiz:focus{border-color:rgba(96,165,250,.6);box-shadow:0 0 0 3px rgba(37,99,235,.2)}
.fi-ob-notiz-fuss{margin:0;font:400 11.5px/1.4 'Inter',sans-serif;color:#64748b}
.fi-ob-notiz-fuss[data-fehlt="ja"]{color:#fde68a}

/* ── DIE LAGE DES KUNDEN ──────────────────────────────────────────────── */
.fi-ob-lage{display:grid;gap:8px;padding:17px 19px;border-radius:20px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.fi-ob-lage-titel{margin:0;font:500 10.5px/1 'Inter',sans-serif;letter-spacing:.14em;
  text-transform:uppercase;color:#93c5fd}
.fi-ob-lage-zeile{margin:0;font:300 13px/1.6 'Inter',sans-serif;color:#e5e7eb}
.fi-ob-lage-zeile[data-warn="ja"]{color:#fde68a}

/* ── DIE FUSSLEISTE ───────────────────────────────────────────────────────
   Sie ist die Fußleiste der Ebene und bleibt damit IMMER sichtbar — auch am
   Handy: .fi-ebene-fuss ist flex-shrink:0 im Blatt und bringt unter 640 px
   den Sicherheitsabstand der iOS-Wischleiste schon selbst mit
   (padding-bottom: calc(13px + env(safe-area-inset-bottom)), FiaonEbene.tsx).
   Deshalb hier KEIN zweites env() — sonst steht die Leiste doppelt hoch. */
.fi-ob-fuss{display:grid;gap:11px;width:100%;font-family:'Inter',sans-serif}
.fi-ob-fehler{margin:0;padding:10px 14px;border-radius:12px;background:rgba(220,38,38,.14);
  border:1px solid rgba(248,113,113,.35);color:#fecaca;font:400 12.5px/1.5 'Inter',sans-serif}
.fi-ob-fuss-zeile{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fi-ob-knopf-still{min-height:46px;padding:0 18px;border-radius:999px;cursor:pointer;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e5e7eb;
  font:500 13px/1 'Inter',sans-serif;touch-action:manipulation}
.fi-ob-knopf-still:hover{border-color:rgba(255,255,255,.24)}
/* Der Abschluss-Knopf: still, solange etwas fehlt — grün, sobald freigeschaltet
   werden darf. Auch er trägt 500, nicht 700. */
.fi-ob-knopf-haupt{margin-left:auto;min-height:52px;padding:0 24px;border-radius:999px;
  cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);
  color:#9ca3af;font:500 14px/1 'Inter',sans-serif;touch-action:manipulation;
  transition:background 200ms,color 200ms}
.fi-ob-knopf-haupt[data-bereit="ja"]{background:linear-gradient(135deg,#059669,#34d399);
  border-color:transparent;color:#04241b;box-shadow:0 14px 30px rgba(5,150,105,.32)}
.fi-ob-knopf-haupt:disabled,.fi-ob-knopf-still:disabled{opacity:.4;cursor:default}
.fi-ob-fuss-hinweis{margin:0;font:300 11.5px/1.5 'Inter',sans-serif;color:#64748b}

/* Sichtbarer Tastatur-Fokus — auf dunklem Glas ist der Browser-Standard weg. */
.fi-ob-haken:focus-visible,.fi-ob-schritt-titel:focus-visible,.fi-ob-anrufen:focus-visible,
.fi-ob-nummer:focus-visible,.fi-ob-nummer-knopf:focus-visible,.fi-ob-blatt:focus-visible,
.fi-ob-knopf-still:focus-visible,.fi-ob-knopf-haupt:focus-visible{
  outline:2px solid rgba(96,165,250,.75);outline-offset:2px}

/* ── DAS HANDY ────────────────────────────────────────────────────────────
   Justins Hauptbeschwerde: „man kann am Handy kaum scrollen — das muss
   flüssiger laufen."
   VORHER: sechs Agenda-Karten mit je eigenem backdrop-filter INNERHALB der
   ohnehin schon unscharfen Ebene. Jede Blur-Fläche wird beim Rollen neu
   gerechnet; auf dem Telefon ruckelt genau das.
   NACHHER: unter 640 px tragen die Karten nur noch ihre Glasfarbe, der Blur
   bleibt der Ebene. Dazu 16 px im Notizfeld (kein iOS-Zoom) und die beiden
   Fußknöpfe untereinander, damit der Abschluss-Knopf nie aus dem Bild fällt.
   Feste Höhen oder overflow:hidden gibt es hier bewusst NIRGENDS — der
   Scroll-Container ist allein .fi-ebene-koerper (FiaonEbene.tsx). */
@media (max-width: 640px) {
  .fi-ob-schritt{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(15,23,42,.72)}
  .fi-ob-koerper{gap:18px}
  .fi-ob-titel{font-size:23px}
  .fi-ob-notiz{font-size:16px}
  .fi-ob-schritt-kopf{padding:13px 15px}
  .fi-ob-schritt-koerper{margin:0 15px;padding:14px 0 15px}
  .fi-ob-blatt{margin-left:0}
  .fi-ob-fuss-zeile{flex-direction:column-reverse;align-items:stretch}
  .fi-ob-knopf-haupt{margin-left:0;width:100%}
  .fi-ob-knopf-still{width:100%}
  .fi-ob-nummer{width:100%;justify-content:center}
  .fi-ob-nummer-knopf{flex:1 1 auto}
}
@media (prefers-reduced-motion: reduce) {
  .fi-ob-balken,.fi-ob-schritt,.fi-ob-haken,.fi-ob-knopf-haupt{transition:none}
}
`;
