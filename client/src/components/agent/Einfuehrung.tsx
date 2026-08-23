// ═══════════════════════════════════════════════════════════════════════════
// EINFÜHRUNG — der geführte Rundgang durchs FIAON Office (23.08.2026, Plan §4/§11)
//
// Öffnet sich beim ERSTEN Login automatisch (Merker serverseitig je Konto:
// GET/POST /agent/einfuehrung, server/routes/fiaon-office-einfuehrung.ts;
// localStorage nur als schneller Cache) und erzählt in 17 Glas-Karten den
// ganzen Weg. Schritte mit `ziel` wechseln WIRKLICH in den Raum (wouter),
// die Karte steht dann am Rand, damit man den Raum dahinter sieht.
//
// ── E-045 (Plan §17), Vorher → Nachher ─────────────────────────────────────
// VORHER:  drei Rollen-Fassungen (Vertrieb 16 Schritte; Onboarding mit
//          vertieftem Calendar-Schritt; Inkasso 13 Schritte mit Collections
//          statt Pipeline/Ergebnisweg/Bestand).
// NACHHER: EINE Fassung für alle. Es gibt nur noch die Rolle Bonitäts-
//          manager, die den Kunden komplett übernimmt: Mandat gewinnen
//          (Arbeitsliste) → Startgespräch/Onboarding selbst führen (Ziel:
//          74-€-SCHUFA-Zahlung, 10 € Bonus) → Betreuung über 12 Raten →
//          Reaktivierung überfälliger Raten (50 %-Bonus, weicher Leitfaden).
//          Collections- und Startgespräch-Schritt gehören für ALLE hinein.
//          Die `rolle`-Prop bleibt nur für eine Kleinigkeit: Bei 'inkasso'
//          (Diana, Back-Office Forderungen & Zahlungen) kommt ein Zusatzsatz,
//          dass sie ALLE überfälligen Kunden sieht.
//
// Weil jede Agentenseite ihre eigene AgentShell/OfficeShell aufbaut, wird
// diese Komponente bei jedem Raumwechsel NEU eingehängt — der laufende
// Rundgang überlebt das über sessionStorage (fiaon_ef_schritt).
//
// Neustart jederzeit: CustomEvent „fiaon-einfuehrung-starten“ (Kachel auf
// /agent/more, Knopf im Schubladen-Fuß der OfficeShell). Die Rolle kommt als
// Prop aus der OfficeShell — bewusst NICHT über useAgentInfo(), weil das
// einen Import-Kreis OfficeShell → Einfuehrung → shared → OfficeShell zöge.
//
// Wortregeln: Mitarbeiter geduzt, Kunden in zitierten Sätzen gesiezt,
// nie „beraten“/„Garantie“, keine Emojis. Bestand: KEIN 10er-Limit (Plan
// §15a) — Arbeitsliste 6 (2+2+2), Bestand bis 500, Übergabe = Provision weg.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles, Activity, Clock, LayoutDashboard, BookUser, CheckCircle2, Layers,
  FileText, Phone, Calendar, Wrench, MessagesSquare, Wallet, GraduationCap,
  Users, Landmark, Flag, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import "@/styles/office-einfuehrung.css";

interface Schritt { key: string; titel: string; ziel?: string; lage: "mitte" | "rand"; Icon: any; absaetze: string[] }

const CACHE = "fiaon_einfuehrung";       // localStorage: "gesehen" = nicht mehr automatisch zeigen
const LAUF = "fiaon_ef_schritt";         // sessionStorage: laufender Rundgang überlebt Raumwechsel

// Eigener kleiner api-Helfer statt Import aus shared.tsx — siehe Kopfkommentar
// (Import-Kreis). Gleicher Weg, gleiche Antwortform.
async function api(pfad: string, init?: RequestInit): Promise<{ ok: boolean; json: any }> {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

/** EINE Schrittfolge für alle (E-045). `rolle` nur für den Inkasso-Zusatzsatz. */
function schritteFuer(rolle: string): Schritt[] {
  const istInkasso = rolle === "inkasso";
  const s: Schritt[] = [];

  s.push({
    key: "willkommen", lage: "mitte", Icon: Sparkles, titel: "Willkommen im FIAON Office",
    absaetze: [
      "Schön, dass du da bist. Als Bonitätsmanager übernimmst du deine Kunden komplett: Du gewinnst das Mandat, führst das Startgespräch selbst, begleitest über alle 12 Raten – und holst überfällige Kunden selbst zurück.",
      "Wichtig für jedes Gespräch: FIAON zeigt, sortiert und begleitet. Wir versprechen nichts, was eine Bank entscheidet – genau das macht uns glaubwürdig.",
      "Dieser Rundgang führt dich einmal durch alle Räume. Weiter geht es mit dem Knopf oder den Pfeiltasten – und neu starten kannst du ihn jederzeit unter More.",
    ],
  });

  s.push({
    key: "status", lage: "rand", Icon: Activity, titel: "Online oder Pause",
    absaetze: [
      "Oben rechts steht dein Status. Online heißt: Du bekommst Anrufe und neue Kunden. Pause heißt: beides ruht – und das Team sieht, dass du kurz weg bist.",
      "Bist du ein paar Minuten ohne Maus und Tastatur, fragt das Office nach: „Bist du noch da?“ Ohne Antwort stellt es dich nach 60 Sekunden automatisch auf Pause.",
      "So landet kein Kunde bei jemandem, der gerade nicht am Platz ist.",
    ],
  });

  s.push({
    key: "availability", lage: "rand", ziel: "/agent/arbeitszeiten", Icon: Clock, titel: "Zuerst: deine Availability",
    absaetze: [
      "Dein Pflichtschritt Nummer eins: der Wochenplan. Male mindestens 15 Stunden pro Woche mit Maus oder Finger ins Raster.",
      "Ohne Plan bekommst du keine Kunden und keine Termine – und das Office erinnert dich alle 5 Minuten daran.",
      "Alle Termine, auch die, die Kunden selbst über deinen Terminlink buchen, landen nur in diesen Zeiten.",
    ],
  });

  s.push({
    key: "dashboard", lage: "rand", ziel: "/agent/start", Icon: LayoutDashboard, titel: "Dashboard – dein Schreibtisch",
    absaetze: [
      "Hier beginnt jeder Tag: deine Termine, fällige Rückrufe, offene Aufgaben und deine Kasse – als Karten, nicht als Tabellen.",
      "Jede Karte hat einen Klick: anrufen oder Akte öffnen. Was heute zählt, steht oben.",
    ],
  });

  s.push({
    key: "pipeline", lage: "rand", ziel: "/agent/pipeline", Icon: BookUser, titel: "Pipeline – hier gewinnst du das Mandat",
    absaetze: [
      "Deine Startansicht ist die Arbeitsliste: immer genau 6 frische Kunden – je 2 aus drei Gruppen.",
      "„Bezahlt gemeldet – Termin fehlt“ ist am heißesten, dann „Antrag fertig – Rechnung offen“, dann „Registriert – noch kein Antrag“.",
      "Anrufen, Ergebnis buchen, der Kunde wandert weiter – und der nächste rückt sofort nach. Ein endloser, aufgeräumter Fluss, nie überladen.",
    ],
  });

  s.push({
    key: "ergebnis", lage: "rand", ziel: "/agent/pipeline", Icon: CheckCircle2, titel: "Ein Anruf, EIN Ergebnis",
    absaetze: [
      "Am Ende jedes Anrufs gibt es genau einen Ergebnisweg mit vier Ausgängen – kein Menü mit hundert Möglichkeiten.",
      "Erfolgreich vereinbart: Der Termin ist gebucht, direkt aus deiner Availability – der Slot ist echt geblockt.",
      "Nicht erreicht: Die Automatik übernimmt. Wiedervorlage, nach dem 2. Versuch geht die Terminlink-Mail raus, nach dem 4. Versuch ruht der Kunde 14 Tage.",
      "Nummer falsch: Der Kunde bekommt eine Mail zum Aktualisieren. Kein Interesse: Der Kunde wird gesperrt und verschwindet aus allen Listen.",
    ],
  });

  s.push({
    key: "bestand", lage: "rand", ziel: "/agent/pipeline", Icon: Layers, titel: "Mein Bestand – dein Kunde bleibt dein Kunde",
    absaetze: [
      "Der zweite Reiter zeigt deine betreuten Kunden. Du begleitest jeden über alle 12 Raten – und jede bankbestätigte Rate bringt dir Provision, Monat für Monat.",
      "Dein Bestand darf auf bis zu 500 Kunden wachsen; erst danach musst du abgeben.",
      "Du kannst einen Kunden jederzeit freiwillig an einen Kollegen übergeben – damit geht aber auch der Provisionsanspruch an ihn über. Provision folgt der Betreuung.",
    ],
  });

  s.push({
    key: "akte", lage: "rand", ziel: "/agent/pipeline", Icon: FileText, titel: "Die Akte",
    absaetze: [
      "Ein Klick auf einen Kunden öffnet die Akte: Daten, Paket, Zahlungen, Gespräche und Notizen an einem Ort.",
      "Während des Gesprächs machst du alles direkt hier: Zugänge senden, Zahlungsdaten schicken, Termin einbuchen, Leitfaden der Stufe aufklappen.",
      "Jede Notiz und jedes Ergebnis landet im Kontaktprotokoll – so weiß das ganze Team, was Stand ist.",
    ],
  });

  s.push({
    key: "softphone", lage: "rand", Icon: Phone, titel: "Das Softphone",
    absaetze: [
      "Unten rechts schwebt dein Telefon. Ein Klick auf „Anrufen“ – und das Gespräch startet direkt im Browser, am besten mit Headset.",
      "Wichtig: Gespräche werden aufgezeichnet. Das schützt dich und den Kunden – halte dich deshalb an die Leitfäden.",
      "Und denk daran: Kunden sprichst du am Telefon immer mit „Sie“ an.",
    ],
  });

  s.push({
    key: "calendar", lage: "rand", ziel: "/agent/kalender", Icon: Calendar, titel: "Calendar & Startgespräch",
    absaetze: [
      "Deine Termine, Rückrufe und Zusagen in einem Raster – die Availability liegt als Fläche dahinter. Ein vergebener Termin blockiert den Slot wirklich, auch für die Online-Buchung über den Terminlink.",
      "Das Startgespräch führst du selbst – du reichst deinen Kunden nicht weiter. Das Gesprächs-Cockpit führt dich Schritt für Schritt hindurch.",
      "Ziel des Termins: die 74-€-SCHUFA-Zahlung – dafür bekommst du 10 € Bonus – und die Aktivierung des Kontos.",
      "Über den Terminlink bucht jeder Kunde automatisch das Richtige: Wer bezahlt hat, ein Startgespräch – wer noch nicht bezahlt hat, ein Vertriebsgespräch bei dir.",
    ],
  });

  s.push({
    key: "reaktivierung", lage: "rand", ziel: "/agent/collections", Icon: Landmark, titel: "Reaktivierung & Collections",
    absaetze: [
      "Wird eine Rate überfällig, gibst du deinen Kunden nicht ab – du holst ihn selbst zurück. Weich, nie hart: vorstellen, entschuldigen, zuhören.",
      "Erreichst du die Zahlung, gehören 50 % dieser Rate dir. Oder du setzt den Kunden einen Monat aus – ohne Vergütung, aber mit direkt gebuchtem Onboarding-Termin.",
      "In Collections siehst du deine überfälligen Kunden mit Fristfenster und hältst je Rate genau ein Ergebnis fest.",
      ...(istInkasso ? ["Als Back-Office Forderungen & Zahlungen siehst du hier nicht nur deine eigenen, sondern ALLE überfälligen Kunden."] : []),
    ],
  });

  s.push({
    key: "tools", lage: "rand", ziel: "/agent/tools", Icon: Wrench, titel: "Tools – vier Werkzeuge",
    absaetze: [
      "Paketfinder: Situation des Kunden eingeben, passendes Paket samt Rate und deiner Provision sehen.",
      "Gesprächs-Begleiter: der Live-Leitfaden während des Anrufs, mit Einwand-Schnellhilfe und Notizfeld.",
      "Rechtsrechner: Löschfrist, Verjährung, Inkassokosten – jedes Ergebnis endet mit dem Satz, den du dem Kunden vorlesen kannst.",
      "Tages-Check: dein Tag in Zahlen, Ziel 5 Abschlüsse.",
    ],
  });

  s.push({
    key: "leitfaeden", lage: "rand", ziel: "/agent/tools/gespraech", Icon: MessagesSquare, titel: "Leitfäden A, B, C – und Reaktivierung",
    absaetze: [
      "Stufe A (bezahlt geklickt): willkommen heißen, die Karte als Ziel oben halten, Termin sofort aus deinen Zeiten vergeben, Zahlung bestätigen lassen.",
      "Stufe B (Antrag, unbezahlt): Bezug auf Antrag und Konzept, Termin vereinbaren, dann die Rechnung ansprechen und Zahlungsdaten senden.",
      "Stufe C (Lead): Daten aufnehmen, Vertrag am Telefon, Zugänge senden, Termin – „Wenn Sie vor dem Termin die Rechnung begleichen, aktivieren wir sofort.“",
      "Reaktivierung (Rate überfällig): weich, nie hart – vorstellen, entschuldigen, dann Zahlung erreichen oder einen Monat aussetzen und direkt den Termin buchen.",
    ],
  });

  s.push({
    key: "wallet", lage: "rand", ziel: "/agent/wallet", Icon: Wallet, titel: "Wallet – deine Vergütung",
    absaetze: [
      "25 % je bankbestätigter Paket-Rate – mit Academy-Zertifikat 30 %. Dazu 10 € je 74-€-SCHUFA-Zahlung im Onboarding und 50 % des Zahlungswerts bei jeder Reaktivierung.",
      "Boni obendrauf: 500 € je Quartal bei pünktlichem Stamm, 1.500 € bei 100 und 5.000 € bei 500 aktiven Kunden.",
      "Ausgezahlt wird, was angekommen ist: Provision entsteht erst, wenn die Rate bankbestätigt ist.",
      "Eine feste Regel: Die erste Zahlung eines Kunden läuft immer direkt per Überweisung – nie per Lastschrift.",
    ],
  });

  s.push({
    key: "academy", lage: "rand", ziel: "/agent/academy", Icon: GraduationCap, titel: "Academy – deine Ausbildung",
    absaetze: [
      "Zehn Kapitel mit Übungen, Simulator und Kapiteltests – sie schalten sich nacheinander frei.",
      "Am Ende wartet die Abschlussprüfung mit Urkunde – und dein Provisionssatz steigt von 25 % auf 30 %.",
      "Alle Leitfäden findest du dort jederzeit auf Abruf.",
    ],
  });

  s.push({
    key: "team", lage: "rand", ziel: "/agent/flur", Icon: Users, titel: "Team, Feed, Inbox, Tickets",
    absaetze: [
      "Team: wer gerade online ist, telefoniert oder Pause macht – remote, aber nicht allein. Im Feed stehen Ansagen und Erfolge.",
      "Inbox bündelt deine E-Mails mit Kunden. Tickets sammelt Anliegen, die auf deine Antwort warten – beide mit Zähler in der Leiste.",
    ],
  });

  s.push({
    key: "fertig", lage: "mitte", Icon: Flag, titel: "Das war der Rundgang",
    absaetze: [
      "Du kennst jetzt den ganzen Weg: Mandat gewinnen, Startgespräch selbst führen, über 12 Raten begleiten, Überfällige zurückholen. Starte mit deiner Availability, dann mit der Arbeitsliste – der Rest kommt beim Tun.",
      "Du kannst diese Einführung jederzeit neu starten: unter More („Einführung neu starten“) oder unten in der Raumliste.",
    ],
  });

  return s;
}

export function Einfuehrung({ rolle }: { rolle: string }) {
  const [location, navigate] = useLocation();
  const schritte = useMemo(() => schritteFuer(rolle), [rolle]);

  // Laufender Rundgang überlebt Raumwechsel (jede Seite baut die Shell neu auf).
  const [offen, setOffen] = useState(() => { try { return sessionStorage.getItem(LAUF) != null; } catch { return false; } });
  const [schritt, setSchritt] = useState(() => { try { const v = sessionStorage.getItem(LAUF); return v ? Math.max(0, Number(v) || 0) : 0; } catch { return 0; } });
  useEffect(() => { try { if (offen) sessionStorage.setItem(LAUF, String(schritt)); else sessionStorage.removeItem(LAUF); } catch { /* egal */ } }, [offen, schritt]);

  // Neustart von außen (More-Kachel, Schubladen-Fuß).
  useEffect(() => {
    const starten = () => { setSchritt(0); setOffen(true); };
    window.addEventListener("fiaon-einfuehrung-starten", starten);
    return () => window.removeEventListener("fiaon-einfuehrung-starten", starten);
  }, []);

  // Erster Login: Merker je Konto vom Server, localStorage nur als Cache.
  useEffect(() => {
    if (offen) return;
    try { if (localStorage.getItem(CACHE) === "gesehen") return; } catch { /* egal */ }
    let weg = false;
    api("/agent/einfuehrung").then((r) => {
      if (weg || !r.ok) return;
      if (r.json.gesehen) { try { localStorage.setItem(CACHE, "gesehen"); } catch { /* egal */ } }
      else { setSchritt(0); setOffen(true); }
    }).catch(() => { /* Ohne Server keine Automatik — Neustart geht immer von Hand. */ });
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beenden = () => {
    setOffen(false);
    try { localStorage.setItem(CACHE, "gesehen"); } catch { /* egal */ }
    api("/agent/einfuehrung", { method: "POST", body: JSON.stringify({}) }).catch(() => {});
  };

  const gehe = (n: number) => {
    if (n < 0) return;
    if (n >= schritte.length) { beenden(); return; }
    setSchritt(n);
    const z = schritte[n].ziel;
    if (z && location !== z && !location.startsWith(z + "?")) navigate(z);
  };

  // Tastatur: ←/→ blättern, Escape überspringt.
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); gehe(Math.min(schritt + 1, schritte.length)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); gehe(schritt - 1); }
      else if (e.key === "Escape") beenden();
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, schritt, schritte, location]);

  if (!offen) return null;
  const i = Math.min(schritt, schritte.length - 1);
  const s = schritte[i];
  const letzter = i === schritte.length - 1;

  return (
    <div className={`ef ${s.lage === "mitte" ? "ef-mitte" : "ef-rand"}`} role="dialog" aria-modal="true" aria-labelledby="ef-titel">
      <div className="ef-schleier" aria-hidden="true" />
      <div className="ef-karte" key={s.key}>
        <button type="button" className="ef-zu" onClick={beenden} aria-label="Einführung schließen"><X size={16} strokeWidth={1.75} /></button>
        <div className="ef-bild" aria-hidden="true"><s.Icon size={24} strokeWidth={1.5} /></div>
        <span className="ef-pille">Einführung · {i + 1} von {schritte.length}</span>
        <h2 id="ef-titel">{s.titel}</h2>
        <div className="ef-text">{s.absaetze.map((a, k) => <p key={k}>{a}</p>)}</div>
        <div className="ef-punkte" aria-hidden="true">
          {schritte.map((x, k) => <button type="button" key={x.key} className={k === i ? "an" : k < i ? "war" : ""} tabIndex={-1} onClick={() => gehe(k)} />)}
        </div>
        <div className="ef-knoepfe">
          {i > 0 && <button type="button" className="ef-knopf still" onClick={() => gehe(i - 1)}><ChevronLeft size={16} strokeWidth={1.75} /> Zurück</button>}
          <button type="button" className="ef-knopf weiter" onClick={() => gehe(i + 1)}>
            {letzter ? "Los geht's" : "Weiter"} {!letzter && <ChevronRight size={16} strokeWidth={1.75} />}
          </button>
        </div>
        {!letzter && <button type="button" className="ef-skip" onClick={beenden}>Überspringen</button>}
      </div>
    </div>
  );
}
