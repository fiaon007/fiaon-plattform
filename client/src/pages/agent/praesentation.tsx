// ═══════════════════════════════════════════════════════════════════════════
// /agent/praesentation — Cinematische Vollbild-Präsentation des FIAON Office
// (23.08.2026, Bezug „Plan §4/§11" + §22/E-054)
//
// Für Zoom-Onboardings neuer Mitarbeiter: der Präsentierende teilt den
// Bildschirm und führt durch JEDEN Raum des Office — ehrlich und präzise,
// kein Marketing. Jede Folie beschreibt, was die Seite wirklich ist und
// wirklich tut; Quelle der Wahrheit sind die echten Seiten (pipeline.tsx,
// bestand.tsx, onboarding-raum.tsx, calendar.tsx, collections.tsx, tools/,
// wallet.tsx, gehalt.tsx, academy/, TerminErinnerung.tsx, Softphone.tsx,
// OfficeShell.tsx) und der Plan (§13–§20, E-042…E-051).
//
// Bedienung: ←/→, Leertaste, Klick = weiter · Escape/Knopf = Kapitelübersicht
// · N = Sprecher-Notizen (nur Desktop) · Vollbild über die Fullscreen-API
// (Muster: admin-schulung.tsx — API + Klasse am <html>, fullscreenchange
// synchronisiert den Zustand, wenn jemand über F11/Browserleiste aussteigt).
// Fortschrittsleiste unten, Ken-Burns auf den Bühnenbildern aus
// client/public/office/*.jpg, prefers-reduced-motion schaltet Bewegung ab.
//
// KEINE OfficeShell — eigene dunkle Bühne (position:fixed, deckt alles).
// Kein Server-Aufruf, keine Kundendaten: reine Erklärungs-Inhalte.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Minimize2, NotebookPen, Phone } from "lucide-react";
import "@/styles/office-praesentation.css";

/** Läuft der Nutzer mit abgeschalteter Bewegung? (Muster admin-schulung.tsx) */
function nutztRuhe(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// ── Animierte Zahl: zählt beim Erscheinen der Folie hoch ────────────────────
function Zahl({ bis, nachkomma = 0, suffix = "", label }: { bis: number; nachkomma?: number; suffix?: string; label: string }) {
  const [wert, setWert] = useState(() => (nutztRuhe() ? bis : 0));
  useEffect(() => {
    if (nutztRuhe()) { setWert(bis); return; }
    let start: number | null = null; let raf = 0;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / 1100);
      setWert(bis * (1 - Math.pow(1 - p, 3))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bis]);
  return (
    <div className="pr-zahl">
      <b>{wert.toFixed(nachkomma).replace(".", ",")}{suffix}</b>
      <small>{label}</small>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI-UI — stilisierte, CSS-nachgebaute Kartenelemente (keine Screenshots)
// ═══════════════════════════════════════════════════════════════════════════
function Mini({ kopf, children }: { kopf: string; children: ReactNode }) {
  return <div className="pr-mini"><div className="pr-mini-kopf">{kopf}</div>{children}</div>;
}

const MiniRaeume = (
  <Mini kopf="Die Leiste · Workspace / Team / Me">
    <div className="pr-gruppe">Workspace</div>
    {["Dashboard", "Pipeline", "Bestand", "Calendar", "Onboarding", "Tasks", "Inbox", "Tickets", "Tools", "Collections"].map((r) => (
      <div className="pr-mk" key={r} data-heiss={r === "Pipeline" ? "1" : undefined}><b>{r}</b></div>
    ))}
    <div className="pr-gruppe">Team · Me</div>
    <div className="pr-mk"><b>Team · Feed · Academy</b><small>Wallet · Earnings · Availability</small></div>
  </Mini>
);

const MiniArbeitsliste = (
  <Mini kopf="Arbeitsliste · immer genau 6 Karten">
    <div className="pr-gruppe">Bezahlt gemeldet – Termin fehlt</div>
    <div className="pr-mk" data-heiss="1"><b>Kunde 1</b><small>anrufen → Termin</small></div>
    <div className="pr-mk" data-heiss="1"><b>Kunde 2</b><small>anrufen → Termin</small></div>
    <div className="pr-gruppe">Antrag fertig – Rechnung offen</div>
    <div className="pr-mk"><b>Kunde 3</b><small>Termin + Rechnung ansprechen</small></div>
    <div className="pr-mk"><b>Kunde 4</b><small>Termin + Rechnung ansprechen</small></div>
    <div className="pr-gruppe">Registriert – noch kein Antrag</div>
    <div className="pr-mk"><b>Kunde 5</b><small>Daten aufnehmen, Vertrag am Telefon</small></div>
    <div className="pr-mk"><b>Kunde 6</b><small>Daten aufnehmen, Vertrag am Telefon</small></div>
  </Mini>
);

const MiniErgebnis = (
  <Mini kopf="Ein Ergebnis je Anruf — nie mehr">
    <div className="pr-mk" data-heiss="1"><b>Mandat angenommen</b><small>nur mit gebuchtem Termin</small></div>
    <div className="pr-mk"><b>Mandat nicht zustande gekommen</b><small>mit Grund:</small></div>
    <div className="pr-mk"><span>Nicht erreicht</span><small>Automatik übernimmt</small></div>
    <div className="pr-mk"><span>Nummer falsch</span><small>Mail mit Korrektur-Link</small></div>
    <div className="pr-mk"><span>Kein Interesse</span><small>Kunde wird gesperrt</small></div>
    <div className="pr-mk"><span>Überlegt noch</span><small>Rückruf-Termin</small></div>
  </Mini>
);

const MiniSlots = (
  <Mini kopf="Termin buchen = klicken, nicht tippen">
    <div className="pr-slots">
      <span className="pr-slot">09:00</span>
      <span className="pr-slot" data-weg="1">09:30</span>
      <span className="pr-slot">10:00</span>
      <span className="pr-slot" data-an="1">10:30</span>
      <span className="pr-slot">11:00</span>
      <span className="pr-slot" data-weg="1">11:30</span>
    </div>
    <p style={{ margin: "12px 0 0", fontSize: 12, color: "#9ca3af" }}>
      Freie Zeiten aus deiner Availability. Ein gebuchter Slot ist echt blockiert — auch für die Online-Buchung des Kunden.
    </p>
  </Mini>
);

const MiniAkte = (
  <Mini kopf="Die Akte · eine Lade, sieben Reiter">
    <div className="pr-reiterleiste">
      {["Überblick", "Zahlungen & Raten", "Gespräche", "E-Mails", "Dokumente", "Aktivität", "Daten"].map((r, i) => (
        <span className="pr-reiter" data-an={i === 0 ? "1" : undefined} key={r}>{r}</span>
      ))}
    </div>
    <div className="pr-mk" data-heiss="1"><b>Situation: Bezahlt gemeldet – Termin fehlt</b></div>
    <div className="pr-mk"><span className="pr-knopf"><Phone size={13} strokeWidth={1.75} /> Jetzt anrufen</span><span className="pr-knopf" data-still="1">Mehr</span></div>
    <div className="pr-mk"><span>Kartenstatus</span><small>In Bearbeitung</small></div>
  </Mini>
);

function MiniRing() {
  const r = 34; const u = 2 * Math.PI * r;
  return (
    <Mini kopf="Bestand · dein Portfolio">
      <div className="pr-ring">
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" />
          <circle cx="42" cy="42" r={r} fill="none" stroke="#3b82f6" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${u * 0.26} ${u}`} transform="rotate(-90 42 42)" />
        </svg>
        <div><b>132<span style={{ color: "#64748b", fontSize: 18 }}> / 500</span></b><small>Mandate — erst ab 500 wird abgegeben</small></div>
      </div>
      <div className="pr-mk" style={{ marginTop: 14 }}><span>Dein Bestand zahlt dir</span><b>je Monat, solange Raten kommen</b></div>
    </Mini>
  );
}

const MiniAmpeln = (
  <Mini kopf="Kundenkarten mit Gesundheits-Ampel">
    <div className="pr-mk"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="pr-ampel" data-t="gut" />Kunde A</span><small>läuft · SEPA aktiv</small></div>
    <div className="pr-mk"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="pr-ampel" data-t="warn" />Kunde B</span><small>Rate offen · kein SEPA</small></div>
    <div className="pr-mk"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="pr-ampel" data-t="rot" />Kunde C</span><small>überfällig seit 9 Tagen</small></div>
    <div className="pr-mk"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="pr-ampel" data-t="warn" />Kunde D</span><small>&gt; 14 Tage kein Kontakt</small></div>
  </Mini>
);

const MiniKacheln = (
  <Mini kopf="Onboarding · Kacheln sind Filter">
    <div className="pr-slots" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
      <span className="pr-slot" data-an="1">Heute geplant · 3</span>
      <span className="pr-slot">Heute erledigt · 1</span>
      <span className="pr-slot">Nicht erschienen · 0</span>
      <span className="pr-slot">Wartet auf Gespräch · 4</span>
    </div>
    <p style={{ margin: "12px 0 0", fontSize: 12, color: "#9ca3af" }}>
      Klick auf eine Kachel filtert die Liste darunter. Die Zahlen rechnet der Server auf DEINE Kunden — nicht global.
    </p>
  </Mini>
);

const MiniTermintreue = (
  <Mini kopf="Popup · 5, 2 und 1 Minute vorher">
    <div className="pr-popup-mock">
      <b>Termin in 5 Minuten</b>
      <small>Startgespräch · direkt zum Kunden</small>
      <div className="pr-knopfzeile">
        <span className="pr-knopf"><Phone size={13} strokeWidth={1.75} /> Anrufen</span>
        <span className="pr-knopf" data-still="1">Zur Akte</span>
      </div>
    </div>
    <table className="pr-tabelle" style={{ marginTop: 14 }}>
      <tbody>
        <tr><td>Pünktlich</td><td>Anruf bis +2 Min</td></tr>
        <tr><td>Verspätet</td><td>+2 bis +15 · wird gemeldet</td></tr>
        <tr><td>Verpasst</td><td>kein Anruf bis +15 · wird gemeldet</td></tr>
      </tbody>
    </table>
  </Mini>
);

const MiniReaktivierung = (
  <Mini kopf="Der weiche Einstieg — kein Inkasso-Ton">
    <p className="pr-zitat">
      „Guten Tag, mein Name ist … Ich rufe an, um mich als Ihr fester Ansprechpartner vorzustellen.
      Ich weiß, Sie hatten einen wirklich schwierigen Start — das tut mir leid."
    </p>
    <div className="pr-mk" style={{ marginTop: 14 }} data-heiss="1"><b>Weg a: Kunde zahlt</b><small>Altbestand: 50 % der Zahlung für dich</small></div>
    <div className="pr-mk"><b>Weg b: 1 Monat aussetzen</b><small>0 € — aber Onboarding-Termin gebucht</small></div>
  </Mini>
);

const MiniWerkzeuge = (
  <Mini kopf="Tools · fünf Werkzeuge, ein Klick">
    <div className="pr-mk"><b>Paketfinder</b><small>Situation → Paket + deine Provision</small></div>
    <div className="pr-mk"><b>Gesprächs-Begleiter</b><small>Leitfaden mit Timer, live im Anruf</small></div>
    <div className="pr-mk"><b>Rechtsrechner</b><small>Löschfrist · Verjährung · Inkassokosten</small></div>
    <div className="pr-mk"><b>Tages-Check</b><small>Ziel 5 Abschlüsse als Ring</small></div>
  </Mini>
);

const MiniLeitfaeden = (
  <Mini kopf="Leitfäden · nach dem, was zu tun ist">
    <div className="pr-mk" data-heiss="1"><b>A · Bezahlt gemeldet</b><small>Willkommen → Termin sofort → Zahlung bestätigen</small></div>
    <div className="pr-mk"><b>B · Antrag, unbezahlt</b><small>Bezug auf Antrag → Termin → Rechnung</small></div>
    <div className="pr-mk"><b>C · Registriert (Lead)</b><small>Daten aufnehmen → Vertrag am Telefon → Termin</small></div>
    <div className="pr-mk"><b>Reaktivierung</b><small>weich, mit Entschuldigung — nie Druck</small></div>
  </Mini>
);

const MiniVerguetung = (
  <Mini kopf="Vergütung · die Bausteine">
    <table className="pr-tabelle">
      <tbody>
        <tr><td>Je bankbestätigter Paket-Rate</td><td>25 %</td></tr>
        <tr><td>… mit Academy-Zertifikat</td><td>30 %</td></tr>
        <tr><td>74-€-Auskunftszahlung beim Onboarding</td><td>10 € fix</td></tr>
        <tr><td>Reaktivierte Rate aus dem Altbestand</td><td>50 % der Zahlung</td></tr>
        <tr><td>Aussetzen statt Zahlung (1 Monat)</td><td>0 €</td></tr>
      </tbody>
    </table>
  </Mini>
);

const MiniBoni = (
  <Mini kopf="Boni · für Qualität und Bindung">
    <div className="pr-mk"><b>500 €</b><small>Quartal · ≥ 85 % der Raten im eigenen Stamm pünktlich</small></div>
    <div className="pr-mk"><b>1.500 €</b><small>einmalig · 100 aktive Kunden</small></div>
    <div className="pr-mk" data-heiss="1"><b>5.000 €</b><small>einmalig · 500 aktive Kunden</small></div>
  </Mini>
);

const MiniPruefung = (
  <Mini kopf="Abschlussprüfung · schummelsicher">
    <table className="pr-tabelle">
      <tbody>
        <tr><td>Fragen je Durchlauf</td><td>25 aus dem Pool</td></tr>
        <tr><td>Auswertung</td><td>nur auf dem Server</td></tr>
        <tr><td>Bestanden ab</td><td>85 %</td></tr>
        <tr><td>Wiederholung</td><td>frühestens nach 24 h</td></tr>
        <tr><td>Versuche</td><td>max. 3 je Woche</td></tr>
      </tbody>
    </table>
  </Mini>
);

const MiniStatus = (
  <Mini kopf="Inaktivität · nach 4 Minuten ohne Eingabe">
    <div className="pr-popup-mock">
      <b>Bist du noch da?</b>
      <small>60-Sekunden-Ring — ohne Antwort: Status Pause</small>
      <div className="pr-knopfzeile">
        <span className="pr-knopf">Ich bin da</span>
        <span className="pr-knopf" data-still="1">Pause machen</span>
      </div>
    </div>
    <div className="pr-mk" style={{ marginTop: 14 }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="pr-ampel" data-t="gut" />Online</span><small>erreichbar, bekommt Anrufe</small></div>
    <div className="pr-mk"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="pr-ampel" data-t="warn" />Pause</span><small>keine Anrufe, keine neuen Kunden</small></div>
  </Mini>
);

const MiniPille = (
  <Mini kopf="Gesprächs-Pille · telefonieren und arbeiten">
    <div className="pr-mk" data-heiss="1"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Phone size={14} strokeWidth={1.75} /> Gespräch läuft · 02:41</span><small>Aufnahme ●</small></div>
    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#9ca3af", lineHeight: 1.55 }}>
      Minimiert schwebt das Gespräch als Pille — darunter bleibt die Akte bedienbar:
      freie Termine buchen, Zahlungsdaten senden, Notiz schreiben. Auflegen bringt dich immer zum Ergebnis.
    </p>
  </Mini>
);

// ═══════════════════════════════════════════════════════════════════════════
// DER INHALT — 11 Kapitel, je 2–7 Folien. Ehrlich und präzise: jede Aussage
// stammt aus den echten Seiten bzw. dem Plan (Fundstellen im Dateikopf).
// ═══════════════════════════════════════════════════════════════════════════
interface Folie {
  kicker: string;
  titel: ReactNode;
  text: ReactNode;              // 2–4 Sätze Klartext, Du-Form
  mini?: ReactNode;             // stilisierte Mini-UI (CSS, kein Screenshot)
  zahlen?: { bis: number; nachkomma?: number; suffix?: string; label: string }[];
  notizen: [string, string] | [string, string, string]; // Sprecher-Stichpunkte (Taste N)
}
interface Kapitel { key: string; name: string; kurz: string; szene: string; folien: Folie[] }

const V = ({ children }: { children: ReactNode }) => <span className="pr-verlauf">{children}</span>;

const KAPITEL: Kapitel[] = [
  {
    key: "willkommen", name: "Willkommen", kurz: "Was FIAON ist, was deine Rolle ist", szene: "schreibtisch",
    folien: [
      {
        kicker: "FIAON Office · Onboarding-Präsentation",
        titel: <>Willkommen im <V>FIAON Office.</V></>,
        text: <>
          <p>Das Office ist dein digitaler Arbeitsplatz: alle Räume, alle Kunden, alle Werkzeuge in einem Browserfenster — am Rechner und am Handy.</p>
          <p>Diese Präsentation zeigt dir <strong>jeden Raum so, wie er wirklich ist</strong>: was er tut, was von dir erwartet wird und was du damit verdienst. Kein Marketing.</p>
        </>,
        notizen: ["Bildschirm teilen, Vollbild einschalten", "Ankündigen: Fragen jederzeit, am Ende offene Runde"],
      },
      {
        kicker: "Was FIAON tut",
        titel: <>FIAON <V>begleitet</V> Menschen zu besserer Bonität.</>,
        text: <>
          <p>Unsere Kunden haben negative Einträge, Rückstände oder einfach keinen Überblick. FIAON sortiert ihre Lage, zeigt die rechtlichen Wege (Löschfristen, Verjährung, Selbstauskunft) und begleitet sie Monat für Monat.</p>
          <p>Zwei Wörter benutzen wir <strong>nie</strong>: FIAON gibt keine Rechtsberatung und verspricht kein bestimmtes Ergebnis. Wir sagen stattdessen „begleitet", „zeigt", „sortiert" — wer mehr zusagt, sagt etwas Falsches zu.</p>
        </>,
        notizen: ["Wortregel ernst nehmen — steht auch in der Academy", "Beispiele: „begleitet“, „zeigt“, „sortiert“"],
      },
      {
        kicker: "Deine Rolle",
        titel: <>Du bist <V>Bonitätsmanager</V> — ein Kunde, ein Betreuer.</>,
        text: <>
          <p>Es gibt keine getrennten Abteilungen mehr: Du gewinnst das Mandat, führst das Startgespräch, betreust die 12 Raten und holst überfällige Raten zurück. <strong>Der ganze Kundenweg gehört dir</strong> — und damit die ganze Provision.</p>
          <p>Kunden werden immer gesiezt, im Team wird geduzt. Diana im Back-Office kümmert sich übergreifend um Forderungen und Zahlungen.</p>
        </>,
        notizen: ["E-045: eine Rolle statt Vertrieb/Onboarding/Inkasso", "Provision folgt der Betreuung — auch bei Übergaben"],
      },
      {
        kicker: "Die Räume",
        titel: <>Eine Leiste, <V>alle Räume.</V></>,
        text: <>
          <p>Links (am Handy als Schublade) liegt die Raumleiste, gruppiert in Workspace, Team und Me. Die Raumnamen sind Englisch, alle Inhalte Deutsch.</p>
          <p>Jeder Raum hat genau eine Aufgabe. Wir gehen sie jetzt der Reihe nach durch — in der Reihenfolge, in der du sie im Alltag brauchst.</p>
        </>,
        mini: MiniRaeume,
        notizen: ["Kurz die Leiste im echten Office zeigen (Demo-Zugang)", "Handy erwähnen: alles ist handytauglich gebaut"],
      },
    ],
  },
  {
    key: "dashboard", name: "Dashboard", kurz: "Die Startseite informiert — sie arbeitet nicht", szene: "schreibtisch",
    folien: [
      {
        kicker: "Dashboard · /agent/start",
        titel: <>Die Startseite <V>informiert</V> — sie arbeitet nicht.</>,
        text: <>
          <p>Das Dashboard hat bewusst <strong>keinen einzigen Arbeitsknopf</strong>: kein „Erreicht", kein Anrufen. Der Grund: Eine Tagesliste neben der Arbeitsliste wären zwei Wahrheiten über denselben Bestand — und zwei Leute rufen denselben Menschen an.</p>
          <p>Es beantwortet drei Fragen: Was habe ich verdient? Wie viele Kunden warten? Was ist heute vereinbart? Jede Zahl ist ein Link in den Raum, in dem gearbeitet wird.</p>
        </>,
        notizen: ["Herkunft erzählen: Feedback aus dem Team (Doppelarbeit)", "Gearbeitet wird in Pipeline/Bestand, nie hier"],
      },
      {
        kicker: "Dashboard · Termintreue",
        titel: <>Deine <V>Termintreue</V> steht auf dem Dashboard.</>,
        text: <>
          <p>Das Dashboard zeigt dir deine eigene Termintreue-Karte: pünktlich, verspätet, verpasst. Dieselben Zahlen sieht auch die Leitung — dazu gleich mehr im Kapitel Calendar.</p>
          <p>Außerdem läuft oben eine Erinnerungsleiste mit deinen nächsten Rückrufen und Terminen. Sie zählt herunter und blockiert nichts.</p>
        </>,
        notizen: ["Leiste kurz zeigen, wenn ein Termin ansteht", "Termintreue wird serverseitig gemessen — nicht selbst gemeldet"],
      },
      {
        kicker: "Dashboard · Zahlen",
        titel: <>Drei Fragen, <V>drei Wege.</V></>,
        text: <>
          <p>Verdienst führt in die Wallet, wartende Kunden in die Pipeline, heutige Termine in den Calendar. So bleibt die Startseite ein Überblick — und die Arbeit passiert dort, wo das Ergebnis gebucht wird.</p>
        </>,
        zahlen: [
          { bis: 3, label: "Fragen, die die Seite beantwortet" },
          { bis: 0, label: "Arbeitsknöpfe — mit Absicht" },
        ],
        notizen: ["Kurz halten — der spannende Teil kommt jetzt", "Überleitung: „Der Raum, in dem Umsatz passiert“"],
      },
    ],
  },
  {
    key: "pipeline", name: "Pipeline", kurz: "Arbeitsliste 2+2+2, ein Ergebnisweg, die Akte", szene: "kundenbuch",
    folien: [
      {
        kicker: "Pipeline · /agent/pipeline",
        titel: <>Die Pipeline ist <V>deine Arbeitsliste.</V></>,
        text: <>
          <p>Du siehst hier <strong>immer genau 6 Kunden</strong> — je 2 aus drei Gruppen. Kein Stapel mit 400 Namen, kein Suchen: Wenn du einen erledigst, rückt sofort der nächste seiner Gruppe nach. Ein endloser, aufgeräumter Fluss.</p>
          <p>Die Gruppen heißen nach dem, was zu tun ist — nicht nach Buchstaben.</p>
        </>,
        mini: MiniArbeitsliste,
        zahlen: [{ bis: 6, label: "Karten — nie mehr auf einmal" }],
        notizen: ["2+2+2 erklären: heißeste Gruppe oben", "Nachrücken live im Demo-Zugang zeigen"],
      },
      {
        kicker: "Pipeline · Fokus-Karte",
        titel: <>Oben steht immer: <V>Jetzt anrufen.</V></>,
        text: <>
          <p>Die Fokus-Karte zeigt den wertvollsten nächsten Anruf: Name, Situation, „Warum jetzt" in zwei Zeilen und der erwartete Wert — inklusive deiner Provision. Ein großer Knopf startet den Anruf direkt im Office.</p>
          <p>Während des Gesprächs kannst du alles Nötige aus der Karte heraus: Akte ändern, Zugänge senden, Zahlungsdaten senden, Termin einbuchen.</p>
        </>,
        notizen: ["Softphone kommt als eigenes Kapitel", "„Warum jetzt“ ist fachlich begründet, nicht generisch"],
      },
      {
        kicker: "Pipeline · Ergebnisweg",
        titel: <>Am Ende gibt es <V>genau ein Ergebnis.</V></>,
        text: <>
          <p>Kein Menü mit hundert Wegen: Jeder Anruf endet mit <strong>„Mandat angenommen"</strong> — das geht nur mit einem echt gebuchten Termin — oder <strong>„Mandat nicht zustande gekommen"</strong> mit einem von vier Gründen.</p>
          <p>Das Wording ist bewusst seriös wie bei einer Kanzlei: Der Kunde nimmt die Betreuung an, oder eben noch nicht.</p>
        </>,
        mini: MiniErgebnis,
        notizen: ["„Mandat angenommen“ setzt den Kunden in deinen Bestand", "Vier Gründe kurz durchgehen — nächste Folie: die Automatik"],
      },
      {
        kicker: "Pipeline · Automatik",
        titel: <>„Nicht erreicht" arbeitet <V>die Automatik.</V></>,
        text: <>
          <p>Nach „Nicht erreicht" verlässt die Karte sofort deine Liste (Wiedervorlage). Nach dem 2. Versuch geht automatisch die Terminlink-Mail raus, nach dem 4. ruht der Kunde 14 Tage — <em>du verbrennst keine Zeit mit Mailbox-Schleifen</em>.</p>
          <p>„Nummer falsch" löst eine Mail mit Korrektur-Link aus. „Kein Interesse" sperrt den Kunden bei allen Mitarbeitern — Daten bleiben aus rechtlichen Gründen erhalten. „Überlegt noch" bucht einen Rückruf.</p>
        </>,
        notizen: ["Bezahlt-gemeldete bleiben trotz Staffel in der Liste — Geld im Spiel", "Jeder erreichte Kontakt setzt den Zähler zurück"],
      },
      {
        kicker: "Pipeline · Klick-Slots",
        titel: <>Termine bucht man <V>mit einem Klick.</V></>,
        text: <>
          <p>Du tippst kein Datum: Die freien Zeiten aus deiner eigenen Availability erscheinen als Klick-Slots — im Gespräch, direkt in der Karte oder Akte. Dieselbe Rechnung nutzt auch die Buchungsseite des Kunden.</p>
          <p>Ein vergebener Slot ist wirklich blockiert. Doppelbuchungen gibt es nicht.</p>
        </>,
        mini: MiniSlots,
        notizen: ["Voraussetzung: Availability gepflegt (Kapitel Regeln)", "Terminlink des Kunden bucht automatisch die richtige Terminart"],
      },
      {
        kicker: "Pipeline · Die Akte",
        titel: <>Die Akte zeigt dir <V>alles.</V></>,
        text: <>
          <p>Als Betreuer siehst du den ganzen Kunden: jede Bestellung, Zahlung und Rate, jede E-Mail, jeden Anruf mit Aufnahme, jedes Dokument — und im Reiter „Aktivität" sogar jeden Klick des Kunden in der Antragsstrecke.</p>
          <p>Der Überblick ist ein Situations-Kopf: <strong>eine</strong> Klartext-Karte, <strong>ein</strong> Primär-Knopf, alles Weitere im „Mehr"-Menü. Fehlt ein Datum, ist der Hinweis klickbar und springt direkt ins Feld.</p>
        </>,
        mini: MiniAkte,
        notizen: ["Reiter einmal durchklicken im Demo-Zugang", "Situations-Text wird serverseitig abgeleitet — eine Wahrheit"],
      },
      {
        kicker: "Pipeline · Kartenstatus",
        titel: <>Kartenstatus: erst <V>vollständig</V> zählt.</>,
        text: <>
          <p>Bei jedem Kunden steht als Platzhalter „In Bearbeitung". Erst wenn <strong>Paket bezahlt + 74-€-Auskunft bezahlt + Kontoauszug + Ausweis</strong> da sind, heißt es „Vollständig — liegt bei FIAON zur Bearbeitung".</p>
          <p>Diese Regel rechnet der Server, nicht du. Dein Job ist, die vier Bausteine mit dem Kunden vollzumachen.</p>
        </>,
        notizen: ["Vier Bausteine auswendig können", "Vollständige Kunden werden für die Verwaltung sichtbar"],
      },
    ],
  },
  {
    key: "bestand", name: "Bestand", kurz: "Dein Portfolio: Mandate, Ampeln, SEPA", szene: "kundenbuch",
    folien: [
      {
        kicker: "Bestand · /agent/bestand",
        titel: <>Der Bestand ist <V>dein Portfolio.</V></>,
        text: <>
          <p>Hier wohnen nur <strong>übernommene Mandate</strong> — Kunden, bei denen du „Mandat angenommen" gebucht hast. Eine Zuweisung in der Arbeitsliste zählt noch nicht.</p>
          <p>Dein Bestand darf bis 500 Mandate wachsen; erst dann musst du abgeben. Gibst du einen Kunden an Kollegen ab, geht der Provisionsanspruch mit — Provision folgt der Betreuung.</p>
        </>,
        mini: <MiniRing />,
        notizen: ["Unterschied Zuweisung vs. Mandat betonen", "500er-Grenze: Historie 150 → 10 → 500, jetzt fix"],
      },
      {
        kicker: "Bestand · Kopfzahlen",
        titel: <>Der Kopf zeigt, <V>was dein Bestand wert ist.</V></>,
        text: <>
          <p>Oben stehen vier Wahrheiten: Mandate x/500 als Ring, „Dein Bestand zahlt dir X € im Monat" (Summe der Monatsraten mal dein Provisionssatz), die Ratengesundheit als Balken (pünktlich, offen, überfällig) und die SEPA-Quote.</p>
          <p>Das ist dein wiederkehrendes Einkommen — es wächst mit jedem Mandat, das seine Raten zahlt.</p>
        </>,
        notizen: ["Kernbotschaft: Bestand = monatliches Einkommen", "Ratengesundheit ist der früheste Warnindikator"],
      },
      {
        kicker: "Bestand · Karten",
        titel: <>Jede Karte hat eine <V>Gesundheits-Ampel.</V></>,
        text: <>
          <p>Je Kunde: Ampel (läuft, Rate offen, überfällig seit X Tagen, kein SEPA), Monatsrate, nächster Termin — oder gelb „lange kein Kontakt" nach 14 Tagen. Schnell-Aktionen: Anrufen, Akte, Senden.</p>
          <p>Filter-Chips (Überfällig, Kein SEPA, Termin fällig, kein Kontakt), Suche und Sortierung halten auch 500 Karten bedienbar.</p>
        </>,
        mini: MiniAmpeln,
        notizen: ["Rot/gelb zuerst abarbeiten — dafür sind die Filter da", "Akte ist dieselbe Lade wie in der Pipeline"],
      },
      {
        kicker: "Bestand · SEPA-Wahrheit",
        titel: <>SEPA: so läuft <V>das Geld wirklich.</V></>,
        text: <>
          <p>Die <strong>erste Zahlung ist immer eine Überweisung</strong> — Paketrechnung und 74-€-Auskunft zahlt der Kunde aktiv, nie per Lastschrift. Die monatlichen Folgeraten laufen per SEPA, das der Kunde im Kundenbereich einrichtet.</p>
          <p>An jeder offenen Rate steht der Grund: kein SEPA eingerichtet, Rücklastschrift oder schlicht offen. Zahlungen bestätigt derzeit der Admin von Hand — bis dahin gilt eine Rate als offen.</p>
        </>,
        notizen: ["„Kein SEPA“ = Kunde ansprechen, Einrichtung zeigen", "Ehrlich sagen: noch keine automatische Bank-Anbindung"],
      },
    ],
  },
  {
    key: "termine", name: "Calendar & Onboarding", kurz: "Termine pur, Onboarding-Cockpit, Termintreue", szene: "schreibtisch",
    folien: [
      {
        kicker: "Calendar · /agent/kalender",
        titel: <>Der Calendar zeigt <V>nur gebuchte Termine.</V></>,
        text: <>
          <p>Tag- und Wochenansicht, deine Rückrufe und die vom Kunden gebuchten Termine, farbig nach Terminart — mehr nicht. Ein Klick auf einen Termin öffnet die Kundenakte, das Popover behält Anrufen und Details.</p>
          <p>Grau und blau im Raster kommt aus deiner Availability: Man sieht sofort, wann du buchbar bist.</p>
        </>,
        notizen: ["Bewusst „pur“: Startgespräche-Verwaltung ist ausgezogen", "Wochenansicht mit Überlappungs-Spalten kurz zeigen"],
      },
      {
        kicker: "Onboarding · /agent/onboarding",
        titel: <>Onboarding ist <V>ein eigener Raum.</V></>,
        text: <>
          <p>Hier machst du deine Startgespräche: Oben die Fokus-Karte „Dein nächstes Onboarding" mit Countdown und großem „Gespräch führen" — das öffnet das Cockpit mit der Lage des Kunden und den Schritten.</p>
          <p>Nachtragen, „Nicht erschienen", Einladungen und Wartende anrufen: alles in diesem Raum.</p>
        </>,
        notizen: ["Cockpit führt durchs Gespräch — nichts auswendig nötig", "Startgespräche gehen an den Betreuer, keinen Pool"],
      },
      {
        kicker: "Onboarding · Kacheln",
        titel: <>Kacheln sind <V>Filter</V> — und deine Zahlen.</>,
        text: <>
          <p>Heute geplant, heute erledigt, nicht erschienen, wartet auf Gespräch: Jede Kachel filtert per Klick die Liste darunter. Der Server rechnet die Zahlen auf deine eigenen Kunden — nicht auf alle.</p>
        </>,
        mini: MiniKacheln,
        notizen: ["Früher stand hier eine globale Zahl — bewusst korrigiert", "„Wartet auf Gespräch“: einladen oder direkt anrufen"],
      },
      {
        kicker: "Onboarding · Das Ziel",
        titel: <>Das Ziel heißt <V>74 €.</V></>,
        text: <>
          <p>Im Startgespräch zählt eine Zahlung: die 74-€-Bonitätsauskunft. Zahlt der Kunde sie, bekommst du <strong>10 € Bonus</strong> — und der Kunde wird aktiviert. Hat ein Altfall sie schon bezahlt, gibt es keinen Bonus; das Onboarding machst du trotzdem.</p>
          <p>Ohne Auskunft keine Analyse, ohne Analyse keine Begleitung — deshalb ist diese Zahlung der Dreh- und Angelpunkt.</p>
        </>,
        zahlen: [
          { bis: 74, suffix: " €", label: "Auskunftszahlung des Kunden" },
          { bis: 10, suffix: " €", label: "dein Bonus je Zahlung" },
        ],
        notizen: ["Warum 74 €: Auskunft ist Grundlage der Arbeit", "Aktivierung im Gespräch = bester Moment"],
      },
      {
        kicker: "Termintreue · Erinnerung",
        titel: <>Vor jedem Termin: <V>5 · 2 · 1.</V></>,
        text: <>
          <p>Fünf, zwei und eine Minute vor jedem gebuchten Termin springt ein zentriertes Glas-Popup auf — mit direktem Anruf-Knopf. Zusätzlich läuft oben die Erinnerungsleiste mit Countdown.</p>
          <p>Verpassen ist damit keine Frage des Vergessens mehr.</p>
        </>,
        mini: MiniTermintreue,
        notizen: ["Popups kommen je Schwelle genau einmal", "Leiste deckt auch Rückrufe und Überfälliges ab"],
      },
      {
        kicker: "Termintreue · Messung",
        titel: <>Pünktlichkeit wird <V>gemessen</V> — ehrlich gesagt.</>,
        text: <>
          <p>Der Server vergleicht Terminbeginn und tatsächlichen Anrufstart: pünktlich bis +2 Minuten, verspätet bis +15 (wird gemeldet), verpasst ohne Anruf bis +15 (wird gemeldet). Ab 3 Verpassten wirst du gewarnt.</p>
          <p><strong>Ab 5 verpassten Terminen endet die Zusammenarbeit</strong> — das System legt der Leitung die Prüfung vor, die Entscheidung trifft ein Mensch. Ein gebuchter Termin ist ein Versprechen an einen Kunden.</p>
        </>,
        notizen: ["Nicht drohen — als Fairness gegenüber Kunden erklären", "Zähler und Meldungen sieht auch die Leitung"],
      },
    ],
  },
  {
    key: "collections", name: "Collections", kurz: "Überfällige eigene Kunden weich zurückholen", szene: "kasse",
    folien: [
      {
        kicker: "Collections · /agent/collections",
        titel: <>Collections heißt: <V>zurückholen, nicht eintreiben.</V></>,
        text: <>
          <p>Hier stehen die überfälligen Raten <strong>deiner eigenen Kunden</strong> — der Server macht die Reihenfolge. Diana im Back-Office sieht als Einzige alle Kunden übergreifend.</p>
          <p>Das ist ausdrücklich kein Inkasso-Raum: Viele dieser Kunden haben lange gewartet, und der Anruf beginnt mit einer Entschuldigung.</p>
        </>,
        notizen: ["Kopfzahlen kommen aus deiner eigenen Liste", "Ton entscheidet: Vorstellung, kein Druck"],
      },
      {
        kicker: "Collections · Zwei Wege",
        titel: <>Jeder Anruf hat <V>zwei gute Ausgänge.</V></>,
        text: <>
          <p>Weg a: Der Kunde zahlt die überfällige Rate. Weg b: Du setzt ihn einen Monat aus — die Fälligkeiten verschieben sich, dafür gibt es kein Geld, aber du hast dich vorgestellt und buchst direkt den Onboarding-Termin.</p>
          <p>Beides ist ein Erfolg: Ein ausgesetzter Kunde mit Termin ist mehr wert als ein verlorener.</p>
        </>,
        mini: MiniReaktivierung,
        notizen: ["Aussetzen ist eine echte Aktion in der Akte, mit Protokoll", "Zitat vorlesen — der Ton ist der Leitfaden"],
      },
      {
        kicker: "Collections · Der 50-%-Bonus",
        titel: <>50 % gibt es <V>nur für den Altbestand.</V></>,
        text: <>
          <p>Holst du eine überfällige Rate aus dem <strong>Altbestand</strong> zurück (Kunden von vor dem Office-Start, ein fester Stichtag), gehören 50 % dieser Zahlung dir. Bei Kunden ab dem Neustart gilt die normale Provision von 25 bzw. 30 % — kein 50-%-Bonus.</p>
          <p>Der Stichtag liegt in den Einstellungen; der Zahlungsmotor entscheidet, nicht du.</p>
        </>,
        zahlen: [{ bis: 50, suffix: " %", label: "der Zahlung — nur Altbestand" }],
        notizen: ["Regel E-042a: erst allgemein, dann auf Altbestand begrenzt", "Missverständnis vorbeugen: Neubestand = normale Provision"],
      },
      {
        kicker: "Collections · Grenzen",
        titel: <>Was du hier <V>nicht</V> darfst.</>,
        text: <>
          <p>Erlass, Stundung, Kürzung oder Storno gibt es in diesem Raum nicht. Der einzige Ausweg bei echter Not ist „Härtefall an den Vorgesetzten" — die Entscheidung trifft die Leitung.</p>
          <p>Ergebnisse hältst du mit Zusage-Datum und Notiz fest; Erinnerungen und Rechnungen verschickst du per Knopf.</p>
        </>,
        notizen: ["Klare Grenze schützt vor Zusagen, die keiner halten kann", "Härtefall dokumentieren, nicht selbst entscheiden"],
      },
    ],
  },
  {
    key: "tools", name: "Tools & Leitfäden", kurz: "Fünf Werkzeuge, Leitfäden A/B/C und Reaktivierung", szene: "schreibtisch",
    folien: [
      {
        kicker: "Tools · /agent/tools",
        titel: <>Fünf Werkzeuge, <V>ein Klick.</V></>,
        text: <>
          <p>Der Paketfinder macht aus Ziel, Einträgen und Budget das passende Paket samt Rate und deiner Provision — Preise kommen immer aus dem Katalog, nie aus dem Kopf. Der Gesprächs-Begleiter läuft live im Anruf mit Timer und Abhak-Schritten.</p>
          <p>Der Rechtsrechner liefert Löschfrist, Verjährung und Inkassokosten mit dem Satz, den du dem Kunden vorlesen kannst. Der Tages-Check zeigt deinen Tag in Zahlen — Ziel: 5 Abschlüsse.</p>
        </>,
        mini: MiniWerkzeuge,
        notizen: ["Paketfinder im Demo-Zugang einmal durchspielen", "Rechtsrechner = nachschlagen statt raten"],
      },
      {
        kicker: "Leitfäden",
        titel: <>Für jede Lage <V>ein Leitfaden.</V></>,
        text: <>
          <p><strong>A</strong> — der Kunde hat „bezahlt" gemeldet: Willkommen als Kunde, Termin sofort aus deiner Availability, Zahlung bestätigen lassen. <strong>B</strong> — Antrag fertig, Rechnung offen: Bezug auf den Antrag, Termin, dann dezent die Rechnung.</p>
          <p><strong>C</strong> — frisch registriert: Daten aufnehmen, Vertrag am Telefon, Zugänge senden, Termin. Dazu der Reaktivierungs-Leitfaden mit dem weichen Einstieg.</p>
        </>,
        mini: MiniLeitfaeden,
        notizen: ["Leitfäden nicht ablesen — als Gerüst nutzen", "Wichtig bei B: Rechnung ging nach Antrag automatisch raus"],
      },
      {
        kicker: "Leitfäden · Abruf",
        titel: <>Leitfäden sind <V>immer griffbereit.</V></>,
        text: <>
          <p>Du findest sie an drei Orten: im Gesprächs-Begleiter unter Tools, direkt in der Akte am jeweiligen Kunden und in der Academy als Kapitel mit Übungen. Ein Wortlaut, drei Türen.</p>
        </>,
        notizen: ["Regel §13: jederzeit auf Abruf — bewusst dreifach verlinkt", "In der Pipeline stehen alle vier als Legende unten"],
      },
      {
        kicker: "Tools · Tages-Check",
        titel: <>Der Tages-Check hält dir <V>den Spiegel hin.</V></>,
        text: <>
          <p>Kontakte, erreichte Kunden, Termine und Abschlüsse heute — mit dem Ziel 5 Abschlüsse als Ring und dem Hinweis, was jetzt am meisten bringt, inklusive Anruf-Knopf.</p>
          <p>Morgens einmal öffnen, mittags einmal, fertig. Er ersetzt keine Arbeit, er ordnet sie.</p>
        </>,
        zahlen: [{ bis: 5, label: "Abschlüsse — das Tagesziel" }],
        notizen: ["5/Tag ist ambitioniert, aber die Rechenbasis in Earnings", "Ring füllt sich aus echten Ergebnissen, nicht Selbstauskunft"],
      },
    ],
  },
  {
    key: "geld", name: "Wallet & Earnings", kurz: "Was du verdienst — und wann es fließt", szene: "kasse",
    folien: [
      {
        kicker: "Vergütung",
        titel: <>Die Bausteine <V>deines Verdienstes.</V></>,
        text: <>
          <p>Basis sind <strong>25 % jeder bezahlten Rate</strong> deiner Kunden — jede Rate, 12 Monate, ohne Deckel. Mit dem Academy-Zertifikat dauerhaft 30 %. Dazu 10 € je 74-€-Auskunftszahlung im Onboarding und 50 % je reaktivierter Altbestands-Rate.</p>
        </>,
        mini: MiniVerguetung,
        zahlen: [{ bis: 25, suffix: " %", label: "je Rate · 30 % mit Zertifikat" }],
        notizen: ["Kein Verdienst-Deckel — bewusste Entscheidung", "Provision hängt an der Betreuung, nicht am Erstverkauf"],
      },
      {
        kicker: "Vergütung · Auszahlung",
        titel: <>„Ausgezahlt wird, <V>was angekommen ist."</V></>,
        text: <>
          <p>Provision gibt es nur auf <strong>bankbestätigte</strong> Raten — nicht auf Versprechen, nicht auf „bezahlt" geklickt. Die erste Zahlung eines Kunden ist immer eine Überweisung mit Referenz, Folgeraten laufen per SEPA.</p>
          <p>Das schützt dich auch: Was in deiner Wallet steht, ist echtes Geld, keine Hochrechnung.</p>
        </>,
        notizen: ["Der Satz ist die Hausregel — wörtlich so kommunizieren", "Abgleich läuft über den Kontoeingang"],
      },
      {
        kicker: "Boni",
        titel: <>Boni für <V>Qualität und Bindung.</V></>,
        text: <>
          <p>500 € je Quartal, wenn mindestens 85 % der Raten in deinem Stamm pünktlich kommen. 1.500 € einmalig bei 100 aktiven Kunden, 5.000 € einmalig bei 500. Es gibt keine Boni fürs bloße Telefonieren — belohnt wird, dass Kunden bleiben und zahlen.</p>
        </>,
        mini: MiniBoni,
        notizen: ["Boni-Logik: Bestandspflege schlägt Schlagzahl", "500 aktive Kunden = zugleich die Bestandsgrenze"],
      },
      {
        kicker: "Wallet · /agent/wallet",
        titel: <>Die Wallet ist <V>dein Kontoauszug.</V></>,
        text: <>
          <p>Vier Reiter: Guthaben (jede Gutschrift einzeln, mit Kunde, Rate und Satz), Auszahlung (alle zwei Wochen, auf Antrag), Leistung (deine Zahlen im Zeitraum) und das Partnerprogramm mit Meilensteinen.</p>
          <p>Alles rechnet der Server in Cent — du siehst fertige, nachvollziehbare Beträge.</p>
        </>,
        notizen: ["Jede Zeile ist einem Kunden zuordenbar", "Wunschgehalt-Simulation im Guthaben-Reiter zeigen"],
      },
      {
        kicker: "Earnings · /agent/gehalt",
        titel: <>Earnings: <V>rechne dich selbst.</V></>,
        text: <>
          <p>Der Rechner zeigt, was X Abschlüsse am Tag über 12 Monate bedeuten — mit dem echten Paketmix aus unseren Kontoauszügen und einer ehrlichen Haltequote (80 % zahlen Rate 2, danach 92 % je Monat). Keine Fantasiezahlen.</p>
          <p>Er ist Orientierung, keine Zusage — aber die Annahmen stehen offen daneben.</p>
        </>,
        notizen: ["Haltequote betonen — wir rechnen Abgänge ein", "Gut fürs Zielgespräch: 2 vs. 5 Abschlüsse vergleichen"],
      },
    ],
  },
  {
    key: "academy", name: "Academy", kurz: "Ausbildung, Prüfung, Urkunde, +5 %", szene: "akademie",
    folien: [
      {
        kicker: "Academy · /agent/academy",
        titel: <>Die Academy ist <V>deine Ausbildung.</V></>,
        text: <>
          <p>Zehn Kapitel: FIAON, die Plattform Raum für Raum, der Ablauf, das Gespräch, Rechtswissen, SCHUFA/KSV1870/CRIF, Österreich, Schweiz, die Werkzeuge, reale Situationen. Kapitel schalten nacheinander frei.</p>
          <p>Sie ist bewusst <strong>nicht in zwei Stunden durchklickbar</strong>: Der Server misst Mindestlesezeiten je Schritt, Übungen brauchen ein Ergebnis. Plane 10 bis 15 Stunden ein.</p>
        </>,
        zahlen: [
          { bis: 10, label: "Kapitel" },
          { bis: 15, label: "Stunden — realistisches Ziel" },
        ],
        notizen: ["Freischaltung der Reihe nach, kein Springen", "Rechtswissen ist quellenbasiert, kein Hörensagen"],
      },
      {
        kicker: "Academy · Üben",
        titel: <>Hier wird <V>geübt,</V> nicht nur gelesen.</>,
        text: <>
          <p>Einwand-Trainer (Einwand, drei Antworten, Bewertung mit Begründung), Zeitleisten, Wortwächter, Rechner, Fälle aus anonymisierten echten Situationen — etwa „Kunde zahlt 79,99 € statt 74 €" oder „Kunde will kündigen".</p>
          <p>Jedes Kapitel endet mit einem kurzen Test.</p>
        </>,
        notizen: ["Übungen sind Pflichtteil des Fortschritts", "Fälle stammen aus echten, anonymisierten Situationen"],
      },
      {
        kicker: "Academy · Prüfung",
        titel: <>Die Prüfung ist <V>schummelsicher</V> gebaut.</>,
        text: <>
          <p>25 Zufallsfragen aus einem großen Pool, gemischte Antworten, Zeitlimit je Frage, Auswertung nur auf dem Server — die Lösungen liegen nie im Browser. Tab-Wechsel werden vermerkt.</p>
          <p>Bestanden ab 85 %. Wiederholung frühestens nach 24 Stunden, höchstens 3 Versuche je Woche.</p>
        </>,
        mini: MiniPruefung,
        notizen: ["Prüfungsergebnis sieht auch die Leitung", "Wer die Academy ernst nimmt, besteht — sie bereitet exakt vor"],
      },
      {
        kicker: "Academy · Zertifikat",
        titel: <>Das Zertifikat bringt <V>dauerhaft +5 %.</V></>,
        text: <>
          <p>Bestehst du die Abschlussprüfung, bist du „Zertifizierter Bonitätsmanager": Dein Provisionssatz steigt von 25 auf <strong>30 % — dauerhaft, auf alle Raten</strong>. Dazu gibt es eine Urkunde als PDF mit Urkundennummer und Prüf-Code.</p>
          <p>Das ist die schnellste Gehaltserhöhung, die du dir selbst geben kannst.</p>
        </>,
        zahlen: [{ bis: 5, suffix: " %", label: "mehr — auf jede künftige Rate" }],
        notizen: ["+5 % rechnet der Server automatisch ein", "Urkunde ist druckbar, mit Prüf-Code verifizierbar"],
      },
    ],
  },
  {
    key: "team", name: "Team & Kommunikation", kurz: "Team, Feed, Inbox, Tickets, Tasks — kurz", szene: "flur",
    folien: [
      {
        kicker: "Team & Feed",
        titel: <>Remote, aber <V>nicht allein.</V></>,
        text: <>
          <p>Der Team-Raum zeigt, wer online ist, wer telefoniert, wer Pause macht — aktualisiert im Minutentakt. Im Feed liest du unter „Neuigkeiten" das Update-Protokoll: was am Office gebaut wurde und wie man es bedient.</p>
          <p>Unter „Feedback" meldest du Fehler und Ideen — mit Screenshot, mit Verlauf, und gute Meldungen werden mit Boni bedankt.</p>
        </>,
        notizen: ["Feedback wird wirklich gelesen und beantwortet", "Updates-Badge verschwindet nach dem Lesen"],
      },
      {
        kicker: "Inbox & Tickets",
        titel: <>Inbox schreibt, <V>Tickets antworten.</V></>,
        text: <>
          <p>Die Inbox ist deine Mail-Zentrale: gesendete Mails, Vorlagen je Kunde, Verlauf, KI-Hilfe für Entwürfe. Bausteine füllt der Server je Empfänger — du verschickst nie versehentlich Platzhalter.</p>
          <p>Tickets sind die Anliegen der Kunden: erst deine eigenen, dann der Pool ohne Betreuer. Deine Antwort landet beim Kunden unter „Hilfe &amp; Anliegen" und in der Akte.</p>
        </>,
        notizen: ["Tickets alle 90 Sekunden aktualisiert", "Antwort immer per Sie, ruhig und konkret"],
      },
      {
        kicker: "Tasks",
        titel: <>Tasks: was die Verwaltung <V>von dir braucht.</V></>,
        text: <>
          <p>Vier Reiter: „Zu tun" (Aufgaben mit Frist — nur du hakst sie ab), „Aufträge" (Übergaben des Betreibers: annehmen, Rückfrage stellen, Ergebnis melden, zurückgeben), „Hinweise" (nur zur Kenntnis) und „Erledigt".</p>
          <p>Jeder Auftrag hat eine Zeitleiste — wer wann was gesagt und getan hat.</p>
        </>,
        notizen: ["Aufträge kommen aus der TODO-Liste der Verwaltung", "Rückfragen sind erwünscht — besser als raten"],
      },
    ],
  },
  {
    key: "regeln", name: "Softphone, Status & Start", kurz: "Telefon, Präsenz, Availability — und los", szene: "flur",
    folien: [
      {
        kicker: "Softphone",
        titel: <>Telefoniert wird <V>im Office.</V></>,
        text: <>
          <p>Das Softphone ist eingebaut — kein privates Handy, keine fremde Nummer. Jeder Anruf landet automatisch beim richtigen Kunden in der Akte, mit Aufnahme.</p>
          <p>Gespräche werden aufgezeichnet, und <strong>der Pflichtsatz sagt es dem Kunden</strong> zu Beginn. Ein roter Punkt zeigt dir die laufende Aufnahme; will der Kunde ohne Aufnahme sprechen, beendest du sie — es steht dann „ohne Aufnahme".</p>
        </>,
        notizen: ["Pflichtsatz ist nicht verhandelbar — rechtliche Grundlage", "Aufnahmen später in der Akte anhörbar (auch Leitung)"],
      },
      {
        kicker: "Softphone · Pille",
        titel: <>Anrufen und <V>weiterarbeiten.</V></>,
        text: <>
          <p>Am Handy minimierst du das Gespräch zur schwebenden Pille — darunter bleibt die Akte voll bedienbar: Slots buchen, Zahlungsdaten senden, Notizen. Legst du auf, führt dich das Office immer zum Ergebnis — ein Anruf ohne Ergebnis existiert nicht.</p>
        </>,
        mini: MiniPille,
        notizen: ["Pille = E-047, direkt aus Praxis-Feedback gebaut", "Erreichbar heißt: Tab offen — sonst klingelt es ins Leere"],
      },
      {
        kicker: "Status",
        titel: <>Zwei Zustände: <V>Online und Pause.</V></>,
        text: <>
          <p>Mehr gibt es nicht — wer abgemeldet ist, ist offline. Online heißt erreichbar: Anrufe und neue Kunden kommen zu dir. Pause heißt: nichts davon.</p>
          <p>Nach 4 Minuten ohne Maus, Tastatur oder Touch fragt ein Glas-Popup „Bist du noch da?" mit einem 60-Sekunden-Ring. Ohne Antwort stellt dich das Office auf Pause — ehrlicher Status statt leerem Platz.</p>
        </>,
        mini: MiniStatus,
        notizen: ["Kein Überwachungs-Framing: Kunden sollen echte Erreichbarkeit sehen", "Team-Raum zeigt Online/Pause/Offline für alle"],
      },
      {
        kicker: "Availability",
        titel: <>Ohne Wochenplan <V>läuft nichts.</V></>,
        text: <>
          <p>In Availability malst du deine Arbeitswoche — halbe Stunden, Mo bis So. <strong>Ohne gespeicherten Wochenplan mit mindestens 15 Stunden bekommst du keine Leads und keine Termine.</strong> Fehlt er, erinnert dich das Office alle 5 Minuten.</p>
          <p>Deine freien Zeiten sind zugleich die Klick-Slots, die du und deine Kunden buchen — der Plan ist also dein Kalenderfundament.</p>
        </>,
        zahlen: [{ bis: 15, suffix: " h", label: "Mindest-Verfügbarkeit je Woche" }],
        notizen: ["Erster Arbeitsschritt überhaupt: Availability füllen", "Arbeitszeit soll ausgelastet sein — Termine füllen sie"],
      },
      {
        kicker: "Zusammenfassung",
        titel: <>Dein Tag in <V>einem Satz.</V></>,
        text: <>
          <p>Availability gepflegt, Status Online, Pipeline abtelefonieren (6 Karten, ein Ergebnis je Anruf), Onboardings pünktlich führen, Bestand mit den Ampeln gesund halten, Collections weich zurückholen — und die Wallet zeigt dir, was davon angekommen ist.</p>
        </>,
        notizen: ["Reihenfolge = empfohlener Tagesablauf", "Rückfragen sammeln, bevor die letzte Folie kommt"],
      },
      {
        kicker: "FIAON Office",
        titel: <>Fragen? → Dein erster Tag beginnt <V>in der Academy.</V></>,
        text: <>
          <p>Nach dieser Runde bekommst du deinen Zugang. Kapitel 1 wartet — und mit dem Zertifikat steigst du auf 30 %.</p>
        </>,
        notizen: ["Offene Fragerunde", "Zugangsdaten und erster Academy-Auftrag direkt im Anschluss"],
      },
    ],
  },
];

// Flache Folienliste für Navigation und Fortschritt.
const ALLE: { kapitel: number; folie: number }[] = [];
KAPITEL.forEach((k, ki) => k.folien.forEach((_, fi) => ALLE.push({ kapitel: ki, folie: fi })));

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// ═══════════════════════════════════════════════════════════════════════════
export default function AgentPraesentationPage() {
  const [pos, setPos] = useState(0);                 // Index in ALLE
  const [uebersicht, setUebersicht] = useState(false);
  const [notizen, setNotizen] = useState(false);
  const [vollbild, setVollbild] = useState(false);
  const wurzel = useRef<HTMLDivElement | null>(null);

  const { kapitel: ki, folie: fi } = ALLE[pos];
  const kap = KAPITEL[ki];
  const folie = kap.folien[fi];

  const springe = useCallback((i: number) => {
    setPos(Math.max(0, Math.min(ALLE.length - 1, i)));
  }, []);

  // ── Klasse am <html>: Softphone-Knopf weg, kein Scrollen dahinter ────────
  useEffect(() => {
    document.documentElement.classList.add("pr-an");
    return () => document.documentElement.classList.remove("pr-an");
  }, []);

  // ── Vollbild über die Fullscreen-API (Muster admin-schulung.tsx) ─────────
  useEffect(() => {
    if (vollbild) {
      void document.documentElement.requestFullscreen?.().catch(() => {
        // Kein Vollbild erlaubt (manche Einstellungen)? Die Bühne deckt
        // ohnehin das ganze Fenster — der Nutzer merkt keinen Fehler.
      });
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, [vollbild]);
  useEffect(() => {
    // F11 oder Browser-Leiste: der Zustand folgt dem Browser.
    const auf = () => { if (!document.fullscreenElement) setVollbild(false); };
    document.addEventListener("fullscreenchange", auf);
    return () => document.removeEventListener("fullscreenchange", auf);
  }, []);

  // ── Tasten: ←/→, Leertaste, Escape = Übersicht, N = Notizen ──────────────
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault(); setUebersicht(false); springe(pos + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault(); setUebersicht(false); springe(pos - 1);
      } else if (e.key === "Escape") {
        // Escape verlässt zuerst das native Vollbild (macht der Browser
        // selbst) — hier schaltet es die Kapitelübersicht.
        setUebersicht((v) => !v);
      } else if (e.key === "n" || e.key === "N") {
        setNotizen((v) => !v);
      }
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [pos, springe]);

  const ruhe = nutztRuhe();

  return (
    <div
      className="pr" ref={wurzel} role="application" aria-label="FIAON Office Präsentation"
      onClick={() => { if (!uebersicht) springe(pos + 1); }}
    >
      {/* Bühnenbild des Kapitels mit Ken-Burns (key erzwingt den Wechsel) */}
      <div className="pr-buehne" aria-hidden="true">
        <img key={kap.szene} src={`/office/${kap.szene}.jpg`} alt=""
          style={ruhe ? { animation: "none" } : undefined} />
      </div>

      <div className="pr-marke">FIA<span>ON</span> · OFFICE</div>

      {/* Bedienleiste */}
      <div className="pr-leiste" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setNotizen((v) => !v)} data-an={notizen ? "1" : undefined} title="Sprecher-Notizen (N)">
          <NotebookPen size={15} strokeWidth={1.75} /><span>Notizen</span>
        </button>
        <button type="button" onClick={() => setUebersicht((v) => !v)} data-an={uebersicht ? "1" : undefined} title="Kapitelübersicht (Esc)">
          <LayoutGrid size={15} strokeWidth={1.75} /><span>Kapitel</span>
        </button>
        <button type="button" onClick={() => setVollbild((v) => !v)} data-an={vollbild ? "1" : undefined} title="Vollbild">
          {vollbild ? <Minimize2 size={15} strokeWidth={1.75} /> : <Maximize2 size={15} strokeWidth={1.75} />}
          <span>{vollbild ? "Vollbild aus" : "Vollbild"}</span>
        </button>
      </div>

      {/* Pfeile für Maus-Bedienung */}
      <button type="button" className="pr-pfeil" data-seite="l" disabled={pos === 0}
        onClick={(e) => { e.stopPropagation(); springe(pos - 1); }} aria-label="Zurück">
        <ChevronLeft size={20} strokeWidth={1.75} />
      </button>
      <button type="button" className="pr-pfeil" data-seite="r" disabled={pos === ALLE.length - 1}
        onClick={(e) => { e.stopPropagation(); springe(pos + 1); }} aria-label="Weiter">
        <ChevronRight size={20} strokeWidth={1.75} />
      </button>

      {/* Die Folie — key erzwingt die Erschein-Animation je Wechsel */}
      <div className="pr-folie" key={pos} data-ohne-mini={folie.mini ? undefined : "1"}>
        <div>
          <span className="pr-pille">{folie.kicker}</span>
          <h1>{folie.titel}</h1>
          <div className="pr-text">{folie.text}</div>
          {folie.zahlen && (
            <div className="pr-zahlen">
              {folie.zahlen.map((z) => (
                <Zahl key={z.label} bis={z.bis} nachkomma={z.nachkomma} suffix={z.suffix} label={z.label} />
              ))}
            </div>
          )}
        </div>
        {folie.mini}
      </div>

      {/* Sprecher-Notizen (Taste N, nur Desktop — CSS blendet sie am Handy aus) */}
      {notizen && (
        <div className="pr-notizen" onClick={(e) => e.stopPropagation()}>
          <b>Sprecher-Notizen</b>
          <ul>{folie.notizen.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}

      {/* Kapitelübersicht (Escape / Knopf) */}
      {uebersicht && (
        <div className="pr-uebersicht" onClick={(e) => e.stopPropagation()}>
          <h2>Kapitel</h2>
          <div className="pr-uebersicht-raster">
            {KAPITEL.map((k, i) => {
              const start = ALLE.findIndex((a) => a.kapitel === i);
              return (
                <button type="button" key={k.key} className="pr-kapitelkarte" data-an={i === ki ? "1" : undefined}
                  onClick={() => { springe(start); setUebersicht(false); }}>
                  <i>Kapitel {i + 1} · {k.folien.length} Folien</i>
                  <b>{k.name}</b>
                  <small>{k.kurz}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fortschritt */}
      <span className="pr-stand">{kap.name} · Folie {pos + 1} / {ALLE.length}</span>
      <div className="pr-fortschritt" aria-hidden="true">
        <i style={{ width: `${((pos + 1) / ALLE.length) * 100}%` }} />
      </div>
    </div>
  );
}
