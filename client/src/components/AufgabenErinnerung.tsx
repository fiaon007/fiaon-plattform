// ═══════════════════════════════════════════════════════════════════════════
// NEU VON MARA — DIE KARTE UNTEN RECHTS (24.09.2026, E-240)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Mara legt beim Betreuer Aufgaben an („Kunde hat geschrieben — bitte heute
// antworten", „WhatsApp: bitte übernehmen", ab E-240 auch „Kundin hat keine
// Auskunft"). Gesehen hat sie fast niemand: Am 24.09.2026 waren 392 von 404
// offenen Aufträgen beim Team nie geöffnet. Für Termine gibt es die Leiste
// und das Popup (TerminErinnerung.tsx) — für Aufgaben gab es nur die Mail
// über Make und den Zähler im Menü. Justin: Mara informiert den Betreuer
// AKTIV — Mail UND Popup.
//
// ── WAS DIE KARTE TUT ──────────────────────────────────────────────────────
//   1. Alle 45 s (nur wenn die Seite sichtbar ist) fragt sie
//      GET /agent/aufgaben/neu: die neuesten ungelesenen eigenen Aufgaben,
//      höchstens fünf, dazu die Gesamtzahl. Server:
//      server/routes/fiaon-agent-aufgaben-popup.ts.
//   2. Oben steht die neueste groß — Kunde, Titel, der jüngste Absatz des
//      Aufgabentexts —, darunter bis zu vier weitere als Zeile. Dringende
//      (Priorität 1) haben einen roten Rand.
//   3. „Öffnen" setzt „gesehen" (agent_gelesen_am — derselbe Merker wie in
//      /agent/aufgaben, keine zweite Wahrheit) und führt in die Akte.
//   4. „Später" blendet die Karte aus, bis eine Aufgabe NEUER ist als die
//      neueste gerade gezeigte. Gemerkt je Mitarbeiter in localStorage — die
//      Aufgaben bleiben ungelesen und stehen weiter in /agent/aufgaben.
//      „Öffnen" merkt denselben Stand: Wer eine Aufgabe aufmacht, will in
//      der Akte arbeiten und nicht, dass sofort die nächste darüber springt.
//   5. Ein leiser Doppelton, wenn während der Arbeit eine NEUE Aufgabe
//      eintrifft — nie beim ersten Laden, nie im Kundengespräch. Abschaltbar
//      in der Karte (der Knopf zeigt den Zustand „Ton an"/„Ton aus"), gemerkt
//      in localStorage.
//
// ── WARUM UNTEN RECHTS UND NICHT ALS POPUP IN DER MITTE ────────────────────
// Das zentrierte Glas-Popup gehört dem Termin, der in fünf Minuten beginnt —
// dort MUSS der Mitarbeiter reagieren. Eine Aufgabe darf warten, bis er den
// Satz zu Ende getippt hat. Die Karte blockiert nichts (kein Hintergrund,
// kein Fokusraub) und liegt unter Telefon (290/300) und Modalen (320+) —
// und ÜBER dem runden Telefonknopf (unten rechts, 58 px), nie auf ihm.
//
// ── JEDE SEITE HAT IHREN EIGENEN RAHMEN ────────────────────────────────────
// AgentShell (pages/agent/shared.tsx) wird mit jeder Seite neu gebaut, diese
// Karte also auch. Was den Seitenwechsel überleben muss (der Stand für den
// Ton, die letzte Lage, „Später"), liegt deshalb auf Modulebene und wird beim
// Aufbau sofort gelesen — nicht erst in einem Effekt, sonst blitzt eine
// weggeklickte Karte bei jedem Seitenwechsel auf; was ein Neuladen überleben muss
// („Später", „Ton aus"), in localStorage — jeder Zugriff in try/catch, denn
// ein gesperrter Speicher darf die Karte nie umwerfen.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { maraMarke } from "@shared/fiaon-mara-marke";
import { agentSitzung, telefon } from "@/lib/office-zustand";
import "@/styles/office-aufgaben-erinnerung.css";

interface NeueAufgabe {
  id: number;
  titel: string;
  auszug: string | null;
  prioritaet: number;
  dringend: boolean;
  quelle: string;
  /** Mara hat die Aufgabe angelegt (Postfach, WhatsApp, weitere Mara-Werkzeuge). */
  vonMara: boolean;
  /** „E-Mail", „WhatsApp" — oder bei Hausquellen deren Name („Antrag", „Zahlungen" …). */
  kanal: string | null;
  kunde: string | null;
  personId: number | null;
  ref: string | null;
  ziel: { href: string; text: string };
  faelligAm: string | null;
  /** ISO — die letzte Bewegung der Aufgabe (Anlage, Übergabe, neue Kundenmail). */
  neuSeit: string;
}

interface Lage {
  ok: true;
  agentId: number;
  gesamt: number;
  /** ISO der neuesten ungelesenen Aufgabe — null, wenn nichts ungelesen ist. */
  stand: string | null;
  aufgaben: NeueAufgabe[];
}

/** Wie oft wird nachgesehen? Auftrag: 45 s — schnell genug für „heute antworten", ohne die Datenbank zu treiben. */
const TAKT_MS = 45_000;

// Die Aufschrift „von Mara" kommt aus der Marke — dieselbe wie an Maras
// Rückrufen in Kalender und Terminleiste (shared/fiaon-mara-marke.ts).
const VON_MARA = maraMarke("mara_mail")?.text ?? "von Mara";

const spaeterSchluessel = (agentId: number) => `fiaon-aufg-spaeter-${agentId}`;
const TON_SCHLUESSEL = "fiaon-aufg-ton";

function lesen(k: string): string | null {
  try { return window.localStorage.getItem(k); } catch { return null; }
}
function schreiben(k: string, v: string): void {
  try { window.localStorage.setItem(k, v); } catch { /* gesperrt — dann gilt es nur bis zum Neuladen */ }
}

// ── DER STAND FÜR DEN TON — ÜBERLEBT DEN SEITENWECHSEL ─────────────────────
// null = in diesem Tab noch nie geladen. Die erste Antwort setzt nur die
// Grundlinie: Wer das Office öffnet, bekommt die Karte, aber keinen Ton für
// Aufgaben, die schon seit Stunden da sind.
let tonStand: string | null = null;
let tonBereit = false;
let tonKontext: AudioContext | null = null;

// ── WAS DEN SEITENWECHSEL ÜBERLEBT (Gegenlesen 24.09.2026, E-240) ──────────
// VORHER stand „Später" nur im React-Zustand und wurde erst in einem Effekt
// aus localStorage nachgeladen — NACH dem ersten Zeichnen. Weil der Rahmen je
// Seite neu gebaut wird, blitzte die weggeklickte Karte bei JEDEM
// Seitenwechsel einmal auf (im Prüfstand gemessen: nach „Später" und nach
// „Öffnen" je ein Auftauchen), und eine offene Karte verschwand bis zur
// Antwort des Servers und flog dann neu herein.
// NACHHER: Die letzte Lage und der Merker liegen auf Modulebene und werden
// beim Aufbau SOFORT gelesen. Die letzte Lage gilt nur für dieselbe Sitzung
// (E-Mail aus agentSitzung) — nach einem Wechsel des Mitarbeiters am selben
// Gerät steht nie die Liste des Vorgängers in der Ecke.
let letzteLage: { email: string; lage: Lage } | null = null;
const spaeterMerker = new Map<number, string>();
/** War die Karte auf der vorigen Seite zu sehen? Dann fliegt sie nicht neu herein. */
let zuletztGezeigt = false;

function lageAusSpeicher(): Lage | null {
  const email = agentSitzung.lesen()?.email ?? null;
  return letzteLage && email && letzteLage.email === email ? letzteLage.lage : null;
}
function lageMerken(lage: Lage | null): void {
  const email = agentSitzung.lesen()?.email ?? null;
  letzteLage = lage && email ? { email, lage } : null;
}
function spaeterLesen(agentId: number): string | null {
  // Beide Quellen, der jüngere Merker gilt: die Modulebene hält auch bei
  // gesperrtem Speicher (bis zum Neuladen), localStorage bringt ein „Später"
  // aus einem zweiten Tab desselben Mitarbeiters mit.
  const hier = spaeterMerker.get(agentId) ?? null;
  const gespeichert = lesen(spaeterSchluessel(agentId));
  return hier && gespeichert ? (hier > gespeichert ? hier : gespeichert) : hier ?? gespeichert;
}

/** Zwei kurze, weiche Sinustöne (E5 → A5), sehr leise. Scheitert still, wenn der Browser Ton sperrt. */
function leiserTon(): void {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    tonKontext = tonKontext ?? new AC();
    const k = tonKontext;
    if (k.state === "suspended") void k.resume().catch(() => {});
    const t0 = k.currentTime + 0.02;
    ([[659.25, 0], [880, 0.15]] as const).forEach(([hz, ab]) => {
      const o = k.createOscillator();
      const g = k.createGain();
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t0 + ab);
      g.gain.exponentialRampToValueAtTime(0.045, t0 + ab + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ab + 0.34);
      o.connect(g).connect(k.destination);
      o.start(t0 + ab);
      o.stop(t0 + ab + 0.36);
    });
  } catch { /* kein Ton — die Karte ist die Nachricht */ }
}

/** „gerade eben", „vor 12 Min", „vor 3 Std", „gestern", „vor 4 Tagen". */
function vorWann(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std`;
  const tage = Math.round(std / 24);
  return tage === 1 ? "gestern" : `vor ${tage} Tagen`;
}

/** Die Herkunftszeile: „von Mara · E-Mail", „von Mara · WhatsApp", „Antrag". */
function herkunft(a: NeueAufgabe): string {
  if (a.vonMara) return a.kanal ? `${VON_MARA} · ${a.kanal}` : VON_MARA;
  return a.kanal || "Verwaltung";
}

function herkunftTitel(a: NeueAufgabe): string {
  if (!a.vonMara) return `Aufgabe aus: ${a.kanal || "Verwaltung"}`;
  if (a.kanal === "E-Mail") return "Mara hat diese Aufgabe aus einer Kunden-E-Mail angelegt";
  if (a.kanal === "WhatsApp") return "Mara hat diese Aufgabe aus einem WhatsApp-Gespräch angelegt";
  return "Mara hat diese Aufgabe angelegt";
}

export function AufgabenErinnerung() {
  // Beim Aufbau sofort die Lage der vorigen Seite (dieselbe Sitzung) — der
  // Server bestätigt oder korrigiert sie mit der nächsten Antwort.
  const [lage, setLageRoh] = useState<Lage | null>(lageAusSpeicher);
  const setLage = useCallback((neu: Lage | null) => { lageMerken(neu); setLageRoh(neu); }, []);
  // Nur ein Anstoß zum Neuzeichnen, wenn „Später" gesetzt wird — der Merker selbst
  // liegt auf Modulebene bzw. in localStorage und wird unten direkt gelesen.
  const [, neuZeichnen] = useState(0);
  const [tonAus, setTonAus] = useState<boolean>(() => lesen(TON_SCHLUESSEL) === "aus");
  // Stand die Karte schon auf der vorigen Seite, erscheint sie ohne Einflug.
  const [ruhig, setRuhig] = useState<boolean>(() => zuletztGezeigt);
  const [location] = useLocation();

  const holen = useCallback(async () => {
    // Nur sichtbare Seiten fragen — ein Tab im Hintergrund braucht keinen Stand.
    if (document.hidden) return;
    try {
      const r = await fetch("/api/fiaon/agent/aufgaben/neu", { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (j?.ok) setLage(j as Lage);
    } catch { /* Netz weg — beim nächsten Takt wieder */ }
  }, [setLage]);

  useEffect(() => {
    void holen();
    const uhr = window.setInterval(() => void holen(), TAKT_MS);
    // Wer den Tab wieder öffnet, will den Stand von jetzt sehen.
    const beiRueckkehr = () => { if (!document.hidden) void holen(); };
    // /agent/aufgaben meldet jede Änderung (annehmen, erledigen) — dann sofort neu zählen.
    const beiAenderung = () => void holen();
    document.addEventListener("visibilitychange", beiRueckkehr);
    window.addEventListener("agent-aufgaben-geaendert", beiAenderung);
    return () => {
      window.clearInterval(uhr);
      document.removeEventListener("visibilitychange", beiRueckkehr);
      window.removeEventListener("agent-aufgaben-geaendert", beiAenderung);
    };
  }, [holen]);

  // „Später" gehört dem Menschen, nicht dem Gerät: Schlüssel je Mitarbeiter.
  // Gelesen im Zeichnen selbst, nicht in einem Effekt — sonst blitzt die Karte
  // nach jedem Seitenwechsel einmal auf, bevor der Merker ankommt.
  const agentId = lage?.agentId ?? null;
  const spaeter = agentId ? spaeterLesen(agentId) : null;

  // Auf /agent/aufgaben steht dieselbe Liste groß — die Karte wäre ein Echo.
  const aufAufgabenSeite = location.startsWith("/agent/aufgaben");
  const aufgaben = lage?.aufgaben ?? [];
  const stand = lage?.stand ?? null;
  // ISO-Zeitpunkte desselben Servers — der Textvergleich ist der Zeitvergleich.
  const sichtbar = !aufAufgabenSeite && aufgaben.length > 0 && !!stand && (!spaeter || stand > spaeter);

  // Für die nächste Seite merken, ob die Karte stand; war sie einmal weg, fliegt
  // die nächste neue auf dieser Seite wieder sichtbar herein.
  useEffect(() => {
    zuletztGezeigt = sichtbar;
    if (!sichtbar && ruhig) setRuhig(false);
  }, [sichtbar, ruhig]);

  // ── DER TON ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lage) return;
    if (!tonBereit) { tonStand = stand; tonBereit = true; return; }
    if (!stand || (tonStand && stand <= tonStand)) return;
    tonStand = stand;
    if (sichtbar && !tonAus && !document.hidden && !telefon.gespraechLaeuft()) leiserTon();
  }, [lage, stand, sichtbar, tonAus]);

  const standMerken = () => {
    if (!stand || !agentId) return;
    spaeterMerker.set(agentId, stand);
    schreiben(spaeterSchluessel(agentId), stand);
    neuZeichnen((n) => n + 1);
  };

  const oeffnen = (a: NeueAufgabe) => {
    // keepalive: Der Seitenwechsel darf das „gesehen" nicht abbrechen. Scheitert
    // es (z. B. Nur-Ansicht der Leitung → 403), bleibt die Aufgabe ungelesen —
    // genau richtig: gesehen hat sie dann nicht der Mitarbeiter.
    void fetch(`/api/fiaon/agent/aufgaben/${a.id}/gesehen`, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: "{}",
    }).catch(() => {});
    if (lage) setLage({ ...lage, gesamt: Math.max(0, lage.gesamt - 1), aufgaben: lage.aufgaben.filter((x) => x.id !== a.id) });
    standMerken();
    // Steht die Pipeline schon offen, baut der Seitenwechsel sie nicht neu —
    // ?person= würde nicht gelesen. Dieselbe Tür wie aus dem Telefon (E-043):
    // das Ereignis „fiaon-akte-oeffnen" öffnet die Lade direkt.
    if (a.personId && a.ziel.href.startsWith("/agent/kunden?") && /^\/agent\/(kunden|pipeline)\/?$/.test(location)) {
      const personId = a.personId;
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("fiaon-akte-oeffnen", { detail: { personId } })), 0);
    }
  };

  const tonUmschalten = () => {
    const neu = !tonAus;
    setTonAus(neu);
    schreiben(TON_SCHLUESSEL, neu ? "aus" : "an");
  };

  if (!sichtbar) return null;

  const erste = aufgaben[0];
  const weitere = aufgaben.slice(1);
  const rest = Math.max(0, (lage?.gesamt ?? aufgaben.length) - aufgaben.length);
  const kopf = erste.vonMara ? "Neu von Mara" : aufgaben.length > 1 ? "Neue Aufgaben" : "Neue Aufgabe";

  return (
    <aside className="fi-auf" role="status" aria-live="polite" aria-label={`${kopf}: ${lage?.gesamt ?? aufgaben.length} ungelesen`}
           data-dringend={erste.dringend ? "1" : "0"} data-ruhig={ruhig ? "1" : undefined}>
      <div className="fi-auf-kopf">
        <span className="fi-auf-punkt" aria-hidden="true" />
        <span className="fi-auf-pille">{kopf}</span>
        <span className="fi-auf-zahl">{lage?.gesamt ?? aufgaben.length} ungelesen</span>
      </div>

      <div className="fi-auf-haupt">
        <div className="fi-auf-meta">
          <span className={`fi-auf-quelle${erste.vonMara ? " mara" : ""}`} title={herkunftTitel(erste)}>{herkunft(erste)}</span>
          {erste.dringend && <span className="fi-auf-dringend">Dringend</span>}
          <span className="fi-auf-wann">{vorWann(erste.neuSeit)}</span>
        </div>
        <h3 className="fi-auf-kunde">{erste.kunde || erste.titel}</h3>
        {erste.kunde && <p className="fi-auf-titel">{erste.titel}</p>}
        {erste.auszug && <p className="fi-auf-auszug" title={erste.auszug}>{erste.auszug}</p>}
        <div className="fi-auf-knoepfe">
          <Link href={erste.ziel.href} className="fi-auf-knopf" onClick={() => oeffnen(erste)}
                aria-label={`${erste.ziel.text}: ${erste.kunde || erste.titel}`}>
            Öffnen
          </Link>
          <button type="button" className="fi-auf-knopf still" onClick={standMerken}
                  aria-label="Karte ausblenden, bis eine neue Aufgabe kommt — die Aufgaben bleiben ungelesen">
            Später
          </button>
        </div>
      </div>

      {weitere.length > 0 && (
        <ul className="fi-auf-liste" aria-label="Weitere neue Aufgaben">
          {weitere.map((a) => (
            <li key={a.id}>
              <Link href={a.ziel.href} className="fi-auf-zeile" data-dringend={a.dringend ? "1" : "0"}
                    onClick={() => oeffnen(a)} title={a.auszug || a.titel}>
                <span className="fi-auf-zeile-oben">
                  <span className={`fi-auf-quelle${a.vonMara ? " mara" : ""}`}>{herkunft(a)}</span>
                  <span className="fi-auf-wann">{vorWann(a.neuSeit)}</span>
                </span>
                <span className="fi-auf-zeile-name">{a.kunde || a.titel}</span>
                {a.kunde && <span className="fi-auf-zeile-titel">{a.titel}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="fi-auf-fuss">
        <Link href="/agent/aufgaben" className="fi-auf-alle" onClick={standMerken}>
          {rest > 0 ? `Alle Aufgaben · ${rest} weitere` : "Alle Aufgaben"}
        </Link>
        <button type="button" className="fi-auf-ton" aria-pressed={!tonAus} onClick={tonUmschalten}
                title={tonAus ? "Kein Ton bei neuen Aufgaben" : "Leiser Ton bei neuen Aufgaben"}>
          {tonAus ? "Ton aus" : "Ton an"}
        </button>
      </div>
    </aside>
  );
}
