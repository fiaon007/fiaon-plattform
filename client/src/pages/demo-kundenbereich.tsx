// ═══════════════════════════════════════════════════════════════════════════
// /demo/kundenbereich — DIE PRÄSENTATION des Kundenbereichs, wie er gemeint ist
// (23.08.2026, Justin: „Genau DAS fehlt uns. Nicht nur ein Demo-Zugang, sondern
// eine Präsentation: du navigierst, der Besucher klickt auf Weiter und staunt —
// erkläre genau, wie und warum FIAON das Problem löst, warum wir unvermeidbar
// sind. Alles mit Platzhaltern, das vollwertigste Kundendashboard, High End, 3D.")
//
// Zwei Ebenen:
//  1. DAS DASHBOARD — der Zielzustand nach dem Strategie-Papier vom 23.08.:
//     Ziel & Karten-Readiness, Bonitätsverlauf mit Monitoring, Einträge als
//     Datensätze mit KI-Einschätzung, Schreiben & Fristen, Finanzen per
//     Kontoanbindung, Einigung mit Gläubigern, Nachrichten, Tresor, Abo, Zugang.
//     Alle Daten sind erfunden (Max Mustermann, kein Kunde, keine Datenbank).
//  2. DIE FÜHRUNG — zwölf Stationen. Jede rückt einen Bereich ins Licht, dimmt
//     den Rest und erklärt in drei Sätzen: das Problem, die Lösung, warum das
//     niemand sonst so kann. Pfeiltasten, Weiter/Zurück, jederzeit „frei erkunden".
//
// Der echte, heute gebaute Bereich bleibt unter /demo/produkt erreichbar —
// diese Seite zeigt, wohin er wächst. Stil: mein-bereich.css (hell, Glas,
// Blau-Paar) plus demo-kundenbereich.css für die neuen Teile und die Führung.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@/styles/mein-bereich.css";
import "@/styles/demo-kundenbereich.css";

// ── Platzhalterdaten ────────────────────────────────────────────────────────
const KUNDE = { vorname: "Max", nachname: "Mustermann", ref: "FIAON-DEMO", paket: "FIAON Pro", rahmen: 5000, seit: "April 2026", betreuerin: "Viktoria Reichert", email: "max.mustermann@beispiel.de" };

const VERLAUF = [
  { monat: "Mär", wert: 61 }, { monat: "Apr", wert: 63, ereignis: "Start bei FIAON" }, { monat: "Mai", wert: 66 },
  { monat: "Jun", wert: 74, ereignis: "Eintrag Mobilfunk gelöscht" }, { monat: "Jul", wert: 79 }, { monat: "Aug", wert: 84, ereignis: "Kontoanbindung aktiv" },
];

const EINTRAEGE = [
  { id: 1, glaeubiger: "Mobilfunkanbieter", art: "Forderung aus Vertrag 2021", betrag: 312, datum: "11.03.2021",
    status: "geloescht" as const, stempel: "Gelöscht", aussicht: 100,
    einschaetzung: "Die Forderung war 2022 vollständig bezahlt, der Eintrag blieb trotzdem stehen. Nach Zahlung muss ein Eintrag spätestens nach der gesetzlichen Frist entfernt werden – hier war sie abgelaufen.",
    schritt: "Erledigt: Löschung am 02.06.2026 bestätigt. Der Wert ist um 8 Punkte gestiegen." },
  { id: 2, glaeubiger: "Versandhaus", art: "Inkasso-Forderung 2022", betrag: 189, datum: "27.09.2022",
    status: "laeuft" as const, stempel: "Widerspruch läuft", aussicht: 78,
    einschaetzung: "Die Forderung wurde nie ordnungsgemäß angemahnt – die Meldung an die Auskunftei setzt aber zwei Mahnungen und eine Ankündigung voraus. Formal angreifbar.",
    schritt: "Widerspruch versendet am 10.08., Frist bis 31.08. Kommt keine Antwort, gilt der Eintrag als nicht belegt – dann folgt die Beschwerde bei der Datenschutzbehörde." },
  { id: 3, glaeubiger: "Bank", art: "Ratenkredit 2024, läuft", betrag: 4800, datum: "15.01.2024",
    status: "berechtigt" as const, stempel: "Berechtigt, läuft sauber", aussicht: 0,
    einschaetzung: "Ein laufender Kredit, pünktlich bedient. Der Eintrag ist berechtigt – und er ist gut für Sie: Er zeigt, dass Sie Raten zuverlässig zahlen.",
    schritt: "Nichts zu tun. Wir behalten ihn im Blick; wenn er getilgt ist, prüfen wir den Erledigungsvermerk." },
];

const SCHREIBEN = [
  { datum: "14.05.2026", titel: "Löschantrag nach Art. 17 DSGVO", an: "Auskunftei · Eintrag Mobilfunkanbieter", weg: "Einschreiben", stand: "Antwort am 02.06. – gelöscht", ton: "gut" as const },
  { datum: "21.05.2026", titel: "Selbstauskunft nach Art. 15 DSGVO", an: "Auskunftei", weg: "Post", stand: "Datenkopie eingegangen 03.06.", ton: "gut" as const },
  { datum: "10.08.2026", titel: "Widerspruch gegen Eintrag", an: "Inkasso · Versandhaus", weg: "Einschreiben mit Rückschein", stand: "Frist läuft bis 31.08. · noch 8 Tage", ton: "frist" as const },
];

const FINANZEN = { einnahmen: 2840, ausgaben: 2315, spielraum: 525, kategorien: [
  { name: "Wohnen", betrag: 1095, anteil: .47 }, { name: "Lebensmittel", betrag: 420, anteil: .18 }, { name: "Mobilität", betrag: 245, anteil: .11 },
  { name: "Freizeit", betrag: 182, anteil: .08 }, { name: "Versicherung", betrag: 68, anteil: .03 }, { name: "Sonstiges", betrag: 305, anteil: .13 },
] };

const NACHRICHTEN = [
  { von: "viktoria", zeit: "Gestern, 16:40", text: "Guten Tag Herr Mustermann, der Widerspruch ist beim Inkasso eingegangen (Rückschein liegt vor). Frist ist der 31.08. – ich melde mich, sobald eine Antwort da ist." },
  { von: "kunde", zeit: "Gestern, 17:02", text: "Danke! Und wenn keine Antwort kommt?" },
  { von: "viktoria", zeit: "Gestern, 17:05", text: "Dann gilt der Eintrag als nicht belegt. Ich bereite für den 01.09. schon die Beschwerde bei der Datenschutzbehörde vor – Sie müssten sie nur freigeben." },
  { von: "system", zeit: "Heute, 08:15", text: "Monatlicher Abgleich abgeschlossen: keine neuen Einträge, keine neuen Anfragen. Ihr Wert: 84 (+5)." },
];

// Die drei Stufen aus dem Strategie-Papier (23.08.2026) — jede Funktion hat im Bereich einen Ort.
const STUFEN = [
  { nr: 1, titel: "Das Versprechen einlösen", zeit: "die nächsten 6–8 Wochen", funktionen: [
    { nr: 1, name: "Einträge als Datensätze, nicht als PDF", ziel: "kb-eintraege" },
    { nr: 2, name: "Schreiben-Generator mit Versand und Fristen", ziel: "kb-schreiben" },
    { nr: 3, name: "Karten-Readiness", ziel: "kb-ziel" } ] },
  { nr: 2, titel: "Bewegung jeden Monat", zeit: "Monate 2–4", funktionen: [
    { nr: 4, name: "Bonitäts-Monitoring mit Verlaufskurve", ziel: "kb-verlauf" },
    { nr: 5, name: "Open Banking – Kontoanbindung und Frühwarnung", ziel: "kb-finanzen" },
    { nr: 6, name: "Inkasso-Einigung im Bereich", ziel: "kb-einigung" },
    { nr: 7, name: "WhatsApp als Kanal", ziel: "kb-nachrichten" } ] },
  { nr: 3, titel: "Das Unicorn-Stück", zeit: "Monate 4–12", funktionen: [
    { nr: 8, name: "Karten- und Finanzierungspartner mit Vorqualifizierung", ziel: "kb-zugang" },
    { nr: 9, name: "Score-Simulator", ziel: "kb-simulator" },
    { nr: 10, name: "Der Kunde als Datenquelle – der Burggraben", ziel: "kb-wissen" } ] },
];
const FUNKTION: Record<string, string> = { "kb-eintraege": "Funktion 1 · Stufe 1", "kb-schreiben": "Funktion 2 · Stufe 1", "kb-freigabe": "Funktion 2 · Stufe 1", "kb-ziel": "Funktion 3 · Stufe 1",
  "kb-verlauf": "Funktion 4 · Stufe 2", "kb-finanzen": "Funktion 5 · Stufe 2", "kb-einigung": "Funktion 6 · Stufe 2", "kb-nachrichten": "Funktion 7 · Stufe 2",
  "kb-zugang": "Funktion 8 · Stufe 3", "kb-simulator": "Funktion 9 · Stufe 3", "kb-wissen": "Funktion 10 · Stufe 3" };

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

// ── Die zwölf Stationen der Führung ────────────────────────────────────────
interface Station { ziel: string; titel: string; ueber: string; text: ReactNode; warum: string }
const STATIONEN: Station[] = [
  { ziel: "kb-kopf", ueber: "Station 1 · Ankunft", titel: "Ein Bereich, der den Kunden kennt.",
    text: <>Max Mustermann ist seit vier Monaten bei FIAON. Er sieht beim Eintreten nicht ein Menü, sondern <b>was sich seit seinem letzten Besuch getan hat</b>: eine Antwort, ein Abgleich, ein nächster Schritt – und seine Ansprechpartnerin mit Namen.</>,
    warum: "Score-Apps zeigen eine Zahl. FIAON zeigt eine Akte mit Bewegung. Das ist der Unterschied zwischen einem Blick und einem Ergebnis." },
  { ziel: "kb-ziel", ueber: "Station 2 · Das Ziel", titel: "Karten-Readiness: Das Ziel wird messbar.",
    text: <>Aus Einträgen, Einkommen und Kontoverhalten berechnet FIAON, <b>wie weit der Kunde von seiner Kreditkarte entfernt ist</b> – heute 72 Prozent, realistisch in drei Monaten, wenn der letzte angreifbare Eintrag fällt. Jeder Meilenstein ist konkret.</>,
    warum: "Wer einen Fortschrittsbalken sieht, der steigt, kündigt nicht. Das Ziel ist nicht „bessere Bonität“ – es ist die Karte. Darum bleibt der Kunde zwölf Monate." },
  { ziel: "kb-verlauf", ueber: "Station 3 · Der Verlauf", titel: "Monitoring: Jeden Monat ein Beweis.",
    text: <>Der Wert ist von 61 auf 84 gestiegen – und jeder Sprung hat einen Grund, den die Kurve zeigt: <b>Eintrag gelöscht, Kontoanbindung aktiv</b>. Ein monatlicher Abgleich meldet neue Einträge und Anfragen, bevor sie zum Problem werden.</>,
    warum: "Einmalige Auskunft ist ein Produkt für einen Tag. Monitoring macht daraus ein Abo, das sich jeden Monat selbst rechtfertigt." },
  { ziel: "kb-eintraege", ueber: "Station 4 · Die Akte", titel: "Einträge als Daten – nicht als PDF.",
    text: <>Die Auskunft wird in einzelne Einträge zerlegt. FIAON bewertet jeden: <b>falsch, verjährt, bezahlt-aber-nicht-gelöscht, formal angreifbar oder berechtigt</b> – mit Erfolgsaussicht und einer Erklärung in Menschensprache. Ein Mitarbeiter prüft die Einschätzung, bevor der Kunde sie sieht.</>,
    warum: "Hier entsteht der Burggraben: Aus tausenden Akten lernt FIAON, welche Gläubiger löschen, welche Formulierung wirkt. Das hat keine Anwaltskanzlei und keine Score-App." },
  { ziel: "kb-schreiben", ueber: "Station 5 · Die Aktion", titel: "Schreiben, die hinausgehen – und Fristen, die jemand hält.",
    text: <>Je Eintrag der passende Brief aus anwaltlich geprüften Vorlagen. Der Kunde gibt frei, FIAON versendet <b>physisch per Einschreiben</b>, setzt die Frist, erfasst die Antwort und schlägt die nächste Stufe vor – bis zur Datenschutzbehörde.</>,
    warum: "Der Kunde schreibt nie selbst einen Brief und verpasst nie eine Frist. Das ist die Arbeit, für die er zahlt – sichtbar, Schritt für Schritt." },
  { ziel: "kb-freigabe", ueber: "Station 6 · Ein Klick", titel: "Ein Klick vom Kunden. Der Rest ist FIAON.",
    text: <>Der nächste Schritt liegt schon bereit: die Beschwerde bei der Datenschutzbehörde, falls das Inkasso bis zum 31.08. schweigt. <b>Vorbereitet, geprüft, wartet nur auf die Freigabe.</b> Probieren Sie es.</>,
    warum: "Die Hürde ist nicht das Recht – die Hürde war immer der Aufwand. FIAON senkt ihn auf einen Knopf." },
  { ziel: "kb-finanzen", ueber: "Station 7 · Die Finanzen", titel: "Kontoanbindung: Die Haushaltsrechnung, die eine Bank sehen will.",
    text: <>Statt Auszüge zu fotografieren, ist das Konto verbunden. FIAON erkennt Gehalt, Fixkosten, Spielraum – <b>525 € im Monat</b> – und warnt vor Rücklastschriften, bevor sie zum Eintrag werden.</>,
    warum: "Frühwarnung verhindert neue Einträge. Und dieselben Zahlen sind später die Vorqualifizierung für Karte und Finanzierung – ohne eine Abfrage, die den Wert senkt." },
  { ziel: "kb-einigung", ueber: "Station 8 · Die Einigung", titel: "Mit dem Gläubiger einigen – aus dem Bereich heraus.",
    text: <>Nicht jeder Eintrag ist angreifbar. Für berechtigte Forderungen verhandelt FIAON <b>Ratenvereinbarungen und Vergleiche</b> mit Vorlagen, Zahlungsplan und Erinnerungen – und hält am Ende den Erledigungsvermerk nach.</>,
    warum: "Viele Kunden brauchen die Einigung mehr als die Löschung. Wer beides aus einer Akte bedient, ist für den Kunden die einzige Adresse." },
  { ziel: "kb-nachrichten", ueber: "Station 9 · Der Mensch", titel: "Ein Mensch, der die Akte kennt.",
    text: <>Jede Frage landet bei der Ansprechpartnerin, die den Fall kennt – im Bereich und <b>per WhatsApp</b>. Systemmeldungen und Gespräch in einem Verlauf, nachlesbar, auch Monate später.</>,
    warum: "Vertrauen entsteht nicht durch Software, sondern durch eine Person mit Namen. FIAON skaliert sie, statt sie wegzurationalisieren." },
  { ziel: "kb-tresor", ueber: "Station 10 · Der Tresor", titel: "Jedes Dokument, jede Antwort – an einem Ort.",
    text: <>Auskunft, Datenkopie, Rückscheine, Antworten der Gegenseite, Verträge: alles in der Akte, <b>verschlüsselt auf Servern in der EU</b>. Eine Mahnung wird fotografiert, erkannt und dem Eintrag zugeordnet.</>,
    warum: "Wer seine Unterlagen bei FIAON hat, wechselt nicht. Und wer nach Jahren nachweisen muss, was wann geschah, kann es." },
  { ziel: "kb-zugang", ueber: "Station 11 · Die Tür", titel: "Konto, Karte, Finanzierung – die Tür, wegen der er kam.",
    text: <>Das Girokonto ist eröffnet, die Karte hat einen Termin, die Finanzierung wartet auf den passenden Wert. <b>Vorqualifiziert aus FIAON-Daten</b>, ohne Abfrage, die den Score drückt. Ein Klick, Antrag vorausgefüllt.</>,
    warum: "Hier verdient FIAON das zweite Mal – an der Provision – und der Kunde bekommt genau das, weswegen er kam. Niemand geht leer aus." },
  { ziel: "kb-simulator", ueber: "Station 12 · Der Simulator", titel: "Was passiert, wenn …? Der Kunde rechnet selbst.",
    text: <>Eintrag löschen lassen, Kredit tilgen, eine Kreditanfrage vermeiden – der Simulator zeigt die Wirkung auf Wert und Karten-Readiness. <b>Gelernt aus echten Akten, nicht geraten.</b> Schalten Sie die Hebel um.</>,
    warum: "Wer versteht, welcher Schritt wie viel bringt, tut ihn. Der Simulator macht aus Ratlosigkeit einen Plan – und aus dem Plan eine Rate, die sich lohnt." },
  { ziel: "kb-wissen", ueber: "Station 13 · Der Burggraben", titel: "Was FIAON aus tausend Akten weiß.",
    text: <>Welche Gläubiger löschen schnell, welche Formulierung wirkt, wie lange eine Auskunftei braucht: <b>anonymisiertes Wissen aus allen Akten</b> fließt in jede Einschätzung zurück. Der Kunde sieht, worauf seine Erfolgsaussicht beruht.</>,
    warum: "Das ist die Investoren-Geschichte: Jede Akte macht die nächste besser. Dieses Wissen hat keine Anwaltskanzlei, keine Score-App – und es wächst mit jedem Kunden." },
  { ziel: "kb-abo", ueber: "Station 14 · Warum das trägt", titel: "Zwölf Raten, die sich jeden Monat selbst erklären.",
    text: <>59,99 € im Monat per Lastschrift – und in jedem Monat steht in der Akte, <b>was dafür passiert ist</b>: ein Brief, eine Frist, ein Abgleich, ein Punkt mehr. Nach der zwölften Rate fragt FIAON, ob er bleibt. Die Kurve beantwortet das.</>,
    warum: "Das ist das Modell: planbare Einnahmen, messbarer Nutzen, eine Akte, die wächst. Einsicht, Aktion, Zugang – für 100 Millionen Menschen im DACH-Raum." },
  { ziel: "kb-stufen", ueber: "Station 15 · Der Plan", titel: "Drei Stufen, zehn Funktionen, zwölf Monate.",
    text: <>Alles, was Sie gesehen haben, ist geplant und priorisiert: <b>Stufe 1 löst das Versprechen ein</b> (Einträge, Schreiben, Readiness), Stufe 2 bringt jeden Monat Bewegung (Monitoring, Kontoanbindung, Einigung, WhatsApp), Stufe 3 ist das Unicorn-Stück (Partner, Simulator, Datenvorsprung).</>,
    warum: "Ein Plan, der in der Reihenfolge des Kundennutzens gebaut wird – nicht in der Reihenfolge dessen, was am schnellsten glänzt. Darum ist FIAON unvermeidbar." },
];

// ── Bausteine ───────────────────────────────────────────────────────────────
function Mitgliedskarte() {
  const ref = useRef<HTMLDivElement>(null);
  const bewegen = (e: React.MouseEvent) => {
    const k = ref.current; if (!k) return;
    const b = k.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    k.classList.add("aktiv");
    k.style.setProperty("--rx", `${(y / b.height - .5) * -12}deg`); k.style.setProperty("--ry", `${(x / b.width - .5) * 12}deg`);
    k.style.setProperty("--mx", `${x / b.width * 100}%`); k.style.setProperty("--my", `${y / b.height * 100}%`);
  };
  const verlassen = () => { const k = ref.current; if (!k) return; k.classList.remove("aktiv"); k.style.setProperty("--rx", "0deg"); k.style.setProperty("--ry", "0deg"); };
  return (
    <div className="mb-karte-buehne kb-karte">
      <div ref={ref} className="mb-kk" style={{ background: "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)" }} onMouseMove={bewegen} onMouseLeave={verlassen}>
        <div className="mb-kk-licht" /><div className="mb-kk-streifen" />
        <div className="mb-kk-innen">
          <div className="mb-kk-kopf"><span className="w">FIAON</span><span className="p">Pro</span></div>
          <div className="mb-chip" />
          <div className="mb-kk-rahmen"><small>Paket-Rahmen</small><b>{eur(KUNDE.rahmen)}</b></div>
          <div className="mb-kk-fuss"><span className="n">{KUNDE.vorname} {KUNDE.nachname}</span><span className="m">Mitgliedskarte</span></div>
        </div>
      </div>
      <div className="mb-kk-schatten" aria-hidden="true" />
    </div>
  );
}

/** Zählt sichtbar hoch, sobald das Element im Bild ist. */
function Zaehler({ bis, dauer = 1400, nach = "" }: { bis: number; dauer?: number; nach?: string }) {
  const [w, setW] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0, start = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const lauf = (t: number) => { if (!start) start = t; const p = Math.min(1, (t - start) / dauer); setW(Math.round(bis * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(lauf); };
      raf = requestAnimationFrame(lauf);
    }, { threshold: .4 });
    io.observe(el); return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [bis, dauer]);
  return <span ref={ref} className="zahl">{w}{nach}</span>;
}

function Ring({ prozent, groesse = 168 }: { prozent: number; groesse?: number }) {
  const r = (groesse - 14) / 2, u = 2 * Math.PI * r;
  return (
    <div className="kb-ring" style={{ width: groesse, height: groesse }}>
      <svg viewBox={`0 0 ${groesse} ${groesse}`} width={groesse} height={groesse}>
        <defs><linearGradient id="kbRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#288DFA" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient></defs>
        <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke="#E6ECF4" strokeWidth="10" />
        <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke="url(#kbRing)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={u} strokeDashoffset={u * (1 - prozent / 100)} transform={`rotate(-90 ${groesse / 2} ${groesse / 2})`} className="kb-ring-bogen" />
      </svg>
      <div className="kb-ring-mitte"><b><Zaehler bis={prozent} nach="%" /></b><small>bereit</small></div>
    </div>
  );
}

function Verlaufskurve() {
  const W = 640, H = 220, P = { l: 36, r: 20, o: 22, u: 34 };
  const min = 55, max = 90;
  const x = (i: number) => P.l + (i / (VERLAUF.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.o + (1 - (v - min) / (max - min)) * (H - P.o - P.u);
  const pts = VERLAUF.map((p, i) => [x(i), y(p.wert)] as const);
  const linie = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const flaeche = `${linie} L ${pts[pts.length - 1][0].toFixed(1)} ${H - P.u} L ${pts[0][0].toFixed(1)} ${H - P.u} Z`;
  return (
    <svg className="kb-kurve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bonitätsverlauf von 61 auf 84 Punkte">
      <defs>
        <linearGradient id="kbFl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563EB" stopOpacity=".22" /><stop offset="1" stopColor="#2563EB" stopOpacity="0" /></linearGradient>
        <linearGradient id="kbLi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#288DFA" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient>
      </defs>
      {[60, 70, 80, 90].map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#E6ECF4" /><text x={P.l - 8} y={y(v) + 4} textAnchor="end" className="kb-kurve-achse">{v}</text></g>)}
      <path d={flaeche} fill="url(#kbFl)" className="kb-kurve-flaeche" />
      <path d={linie} fill="none" stroke="url(#kbLi)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="kb-kurve-linie" />
      {VERLAUF.map((p, i) => (
        <g key={p.monat}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r={p.ereignis ? 6 : 4} fill="#fff" stroke="#2563EB" strokeWidth={p.ereignis ? 3 : 2} />
          <text x={pts[i][0]} y={H - 10} textAnchor="middle" className="kb-kurve-achse">{p.monat}</text>
          {p.ereignis && <text x={pts[i][0]} y={pts[i][1] - 14} textAnchor={i > 3 ? "end" : "middle"} className="kb-kurve-ereignis">{p.ereignis}</text>}
        </g>
      ))}
      <text x={pts[pts.length - 1][0] + 2} y={pts[pts.length - 1][1] + 5} textAnchor="end" className="kb-kurve-wert" dy="-22">84</text>
    </svg>
  );
}

function Kreis({ kategorien }: { kategorien: typeof FINANZEN.kategorien }) {
  const farben = ["#1D4ED8", "#2563EB", "#288DFA", "#60A5FA", "#93C5FD", "#C7D7F5"];
  const r = 54, u = 2 * Math.PI * r; let ab = 0;
  return (
    <svg viewBox="0 0 140 140" className="kb-kreis" aria-hidden="true">
      {kategorien.map((k, i) => { const l = u * k.anteil; const el = <circle key={k.name} cx="70" cy="70" r={r} fill="none" stroke={farben[i]} strokeWidth="18" strokeDasharray={`${l} ${u - l}`} strokeDashoffset={-ab} transform="rotate(-90 70 70)" />; ab += l; return el; })}
      <text x="70" y="66" textAnchor="middle" className="kb-kreis-zahl">{eur(FINANZEN.ausgaben)}</text>
      <text x="70" y="84" textAnchor="middle" className="kb-kreis-text">Ausgaben / Monat</text>
    </svg>
  );
}

function Simulator() {
  const [hebel, setHebel] = useState({ versandhaus: false, kredit: false, anfrage: false, konto: true });
  const wert = 84 + (hebel.versandhaus ? 6 : 0) + (hebel.kredit ? 3 : 0) - (hebel.anfrage ? 4 : 0) - (hebel.konto ? 0 : 2);
  const bereit = Math.max(0, Math.min(100, 72 + (hebel.versandhaus ? 18 : 0) + (hebel.kredit ? 7 : 0) - (hebel.anfrage ? 12 : 0) - (hebel.konto ? 0 : 9)));
  const monate = bereit >= 90 ? "jetzt" : bereit >= 80 ? "~1 Monat" : bereit >= 70 ? "~3 Monate" : bereit >= 60 ? "~5 Monate" : "> 6 Monate";
  const HEBEL = [
    { k: "versandhaus" as const, t: "Eintrag „Versandhaus“ wird gelöscht", s: "Widerspruch erfolgreich (Aussicht 78 %)", plus: "+6 Wert · +18 Readiness" },
    { k: "kredit" as const, t: "Ratenkredit vorzeitig getilgt", s: "Restschuld 4.800 € ausgeglichen", plus: "+3 Wert · +7 Readiness" },
    { k: "konto" as const, t: "Kontoanbindung bleibt aktiv", s: "Haushaltsrechnung bleibt belegbar", plus: "hält Readiness" },
    { k: "anfrage" as const, t: "Kreditanfrage bei einer anderen Bank", s: "Harte Abfrage – senkt den Wert für Monate", plus: "−4 Wert · −12 Readiness" },
  ];
  return (
    <div className="kb-simulator">
      <div className="kb-hebel">
        {HEBEL.map((h) => (
          <button key={h.k} type="button" className={`kb-hebel-zeile${hebel[h.k] ? " an" : ""}${h.k === "anfrage" ? " warn" : ""}`} onClick={() => setHebel((x) => ({ ...x, [h.k]: !x[h.k] }))} aria-pressed={hebel[h.k]}>
            <i className="schalter" />
            <div><b>{h.t}</b><span>{h.s}</span></div>
            <small className="zahl">{h.plus}</small>
          </button>
        ))}
      </div>
      <div className="kb-sim-ergebnis">
        <div className="kb-sim-wert"><small>Prognose Wert</small><b className="zahl">{wert}</b><span className={wert >= 84 ? "gut" : "warn"}>{wert >= 84 ? `+${wert - 84}` : `${wert - 84}`} zu heute</span></div>
        <div className="kb-sim-wert"><small>Karten-Readiness</small><b className="zahl">{bereit} %</b><span className={bereit >= 72 ? "gut" : "warn"}>Karte {monate}</span></div>
        <p className="kb-hinweis">Die Wirkung jedes Hebels stammt aus FIAON-Akten mit vergleichbarem Profil – nicht aus einer Formel der Auskunftei. Der Simulator ersetzt keine Auskunft, er zeigt, welcher Schritt sich lohnt.</p>
      </div>
    </div>
  );
}

function Pille({ ton, children }: { ton: "gut" | "frist" | "laeuft" | "still"; children: ReactNode }) {
  return <span className={`kb-pille ${ton}`}>{children}</span>;
}

function Abschnitt({ id, aktiv, titel, unter, kurz, kinder, breit = false }: { id: string; aktiv: boolean; titel: string; unter?: string; kurz?: ReactNode; kinder: ReactNode; breit?: boolean }) {
  return (
    <section id={id} className={`kb-abschnitt${aktiv ? " kb-aktiv" : ""}${breit ? " breit" : ""}`}>
      <header className="kb-abschnitt-kopf">
        <div>{FUNKTION[id] && <span className="kb-funktion">{FUNKTION[id]}</span>}<h2>{titel}</h2>{unter && <p>{unter}</p>}</div>
        {kurz && <div className="kb-abschnitt-kurz">{kurz}</div>}
      </header>
      {kinder}
    </section>
  );
}

// ── Die Seite ───────────────────────────────────────────────────────────────
export default function DemoKundenbereich() {
  const [modus, setModus] = useState<"intro" | "fuehrung" | "frei">("intro");
  const [station, setStation] = useState(0);
  const [freigegeben, setFreigegeben] = useState(false);
  const [nachricht, setNachricht] = useState("");
  const [chat, setChat] = useState(NACHRICHTEN);
  const aktiv = modus === "fuehrung" ? STATIONEN[station].ziel : null;
  const s = STATIONEN[station];

  // Zur Station rollen — die App scrollt in #root, scrollIntoView trifft trotzdem.
  useEffect(() => {
    if (modus !== "fuehrung") return;
    const el = document.getElementById(s.ziel); if (!el) return;
    const t = window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: window.innerWidth < 900 ? "start" : "center" }), 60);
    return () => window.clearTimeout(t);
  }, [modus, station, s.ziel]);

  const weiter = useCallback(() => { if (station < STATIONEN.length - 1) setStation(station + 1); else setModus("frei"); }, [station]);
  const zurueck = useCallback(() => { if (station > 0) setStation(station - 1); }, [station]);
  useEffect(() => {
    if (modus !== "fuehrung") return;
    const h = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "Enter") weiter(); else if (e.key === "ArrowLeft") zurueck(); else if (e.key === "Escape") setModus("frei"); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [modus, weiter, zurueck]);

  const senden = () => {
    const t = nachricht.trim(); if (!t) return;
    setChat((c) => [...c, { von: "kunde", zeit: "Gerade eben", text: t }]); setNachricht("");
    window.setTimeout(() => setChat((c) => [...c, { von: "viktoria", zeit: "Gerade eben", text: "Danke, ich schaue mir das an und melde mich noch heute – im Demo-Konto natürlich nur zur Ansicht." }]), 1200);
  };

  const meilensteine = useMemo(() => [
    { t: "Auskunft beschafft und ausgewertet", ok: true }, { t: "Eintrag Mobilfunk gelöscht (+8 Punkte)", ok: true },
    { t: "Kontoanbindung aktiv, Haushaltsrechnung positiv", ok: true }, { t: "Girokonto eröffnet", ok: true },
    { t: "Eintrag Versandhaus – Widerspruch läuft (Frist 31.08.)", ok: false }, { t: "Wert 90 erreicht → Karte beantragen", ok: false },
  ], []);

  return (
    <div className={`mb kb${modus === "fuehrung" ? " kb-praesentation" : ""}`}>
      <div className="mb-lichter" aria-hidden="true"><div className="mb-licht a" /><div className="mb-licht b" /></div>

      {/* ── Intro: der Vorhang ── */}
      {modus === "intro" && (
        <div className="kb-intro" role="dialog" aria-label="Präsentation starten">
          <div className="kb-intro-innen">
            <div className="kb-intro-karte"><Mitgliedskarte /></div>
            <p className="kb-intro-ueber">Demo · Platzhalterdaten · kein Kunde, keine Datenbank</p>
            <h1>Der Kundenbereich, <span>wie er gemeint ist.</span></h1>
            <p className="kb-intro-text">Zwölf Stationen, ein Kunde nach vier Monaten. Wir führen Sie durch jeden Bereich und erklären, warum FIAON das Problem löst – und warum der Kunde bleibt.</p>
            <div className="kb-intro-knoepfe">
              <button type="button" className="mb-knopf" onClick={() => { setStation(0); setModus("fuehrung"); }}>Präsentation starten</button>
              <button type="button" className="mb-knopf still" onClick={() => setModus("frei")}>Frei erkunden</button>
            </div>
            <p className="kb-intro-leise">Pfeiltasten ← → führen durch die Stationen · Esc beendet die Führung</p>
          </div>
        </div>
      )}

      {/* ── Kopfzeile ── */}
      <header className="mb-kopf">
        <div className="mb-kopf-innen">
          <a href="/" className="mb-wort" style={{ color: "var(--blau-tief)" }}>FIAON</a>
          <span className="mb-bereich-marke">Mitgliedsbereich · Demo</span>
          <div className="mb-kopf-rechts">
            {modus !== "fuehrung" && <button type="button" className="kb-kopf-knopf" onClick={() => { setStation(0); setModus("fuehrung"); }}>Führung starten</button>}
            <div className="mb-kopf-name">{KUNDE.vorname} {KUNDE.nachname}<small>{KUNDE.paket} · Mitglied seit {KUNDE.seit}</small></div>
            <div className="mb-gesicht">MM</div>
          </div>
        </div>
      </header>

      <main className="kb-rahmen">
        {/* 1 · Ankunft */}
        <section id="kb-kopf" className={`kb-buehne${aktiv === "kb-kopf" ? " kb-aktiv" : ""}`}>
          <div className="kb-buehne-text">
            <p className="kb-ueber">Seit Ihrem letzten Besuch</p>
            <h1>Guten Tag, {KUNDE.vorname}. <span>Drei Dinge haben sich getan.</span></h1>
            <ul className="kb-neu">
              <li><Pille ton="gut">Antwort</Pille><span>Rückschein zum Widerspruch ist eingegangen – die Frist läuft bis 31.08.</span></li>
              <li><Pille ton="gut">Abgleich</Pille><span>Monatlicher Abgleich: keine neuen Einträge, Wert 84 (+5).</span></li>
              <li><Pille ton="frist">Freigabe</Pille><span>Ein Schreiben wartet auf Ihre Freigabe – vorbereitet für den 01.09.</span></li>
            </ul>
            <div className="kb-buehne-zeile">
              <div><small>Ihre Ansprechpartnerin</small><b>{KUNDE.betreuerin}</b></div>
              <div><small>Nächster Schritt</small><b>Frist 31.08. abwarten</b></div>
              <div><small>Referenz</small><b className="zahl">{KUNDE.ref}</b></div>
            </div>
          </div>
          <Mitgliedskarte />
        </section>

        <div className="kb-raster">
          {/* 2 · Ziel */}
          <Abschnitt id="kb-ziel" aktiv={aktiv === "kb-ziel"} titel="Mein Ziel: Kreditkarte bis 5.000 €" unter="Karten-Readiness – berechnet aus Einträgen, Einkommen und Kontoverhalten."
            kurz={<Pille ton="laeuft">in ~3 Monaten realistisch</Pille>}
            kinder={
              <div className="kb-ziel">
                <Ring prozent={72} />
                <div className="kb-ziel-liste">
                  {meilensteine.map((m) => <div key={m.t} className={`kb-meilenstein${m.ok ? " ok" : ""}`}><i /><span>{m.t}</span></div>)}
                  <p className="kb-hinweis">Was noch fehlt: Der Eintrag „Versandhaus“ muss fallen (Aussicht 78 %) – dann liegt der Wert über der Schwelle des Kartenpartners.</p>
                </div>
              </div>
            } />

          {/* 3 · Verlauf */}
          <Abschnitt id="kb-verlauf" aktiv={aktiv === "kb-verlauf"} titel="Bonitätsverlauf & Monitoring" unter="Monatlicher Abgleich mit der Auskunftei – neue Einträge und Anfragen werden gemeldet, bevor sie zum Problem werden."
            kurz={<><b className="kb-gross zahl">84</b><Pille ton="gut">+23 seit März</Pille></>}
            kinder={
              <>
                <Verlaufskurve />
                <div className="kb-zeilen">
                  <div className="kb-zeile"><span>Letzter Abgleich</span><b>Heute, 08:15 · keine neuen Einträge</b></div>
                  <div className="kb-zeile"><span>Nächster Abgleich</span><b>01.09.2026 · automatisch</b></div>
                  <div className="kb-zeile"><span>Warnungen</span><b>Keine · Rücklastschriften 0 · Anfragen 0</b></div>
                </div>
              </>
            } />

          {/* 4 · Einträge */}
          <Abschnitt id="kb-eintraege" aktiv={aktiv === "kb-eintraege"} titel="Meine Einträge" unter="Jeder Eintrag Ihrer Auskunft – bewertet, erklärt, mit nächstem Schritt. Geprüft von Ihrer Ansprechpartnerin." breit
            kurz={<><Pille ton="gut">1 gelöscht</Pille><Pille ton="frist">1 läuft</Pille><Pille ton="still">1 berechtigt</Pille></>}
            kinder={
              <div className="kb-eintraege">
                {EINTRAEGE.map((e) => (
                  <article key={e.id} className={`kb-eintrag ${e.status}`}>
                    <div className="kb-eintrag-kopf">
                      <div><h3>{e.glaeubiger}</h3><p>{e.art} · gemeldet {e.datum}</p></div>
                      <div className="kb-eintrag-rechts"><b className="zahl">{eur(e.betrag)}</b><Pille ton={e.status === "geloescht" ? "gut" : e.status === "laeuft" ? "frist" : "still"}>{e.stempel}</Pille></div>
                    </div>
                    <div className="kb-eintrag-koerper">
                      <div><small>FIAON-Einschätzung</small><p>{e.einschaetzung}</p></div>
                      <div><small>Nächster Schritt</small><p>{e.schritt}</p></div>
                    </div>
                    {e.aussicht > 0 && e.status !== "geloescht" && <div className="kb-aussicht"><span>Erfolgsaussicht</span><i><b style={{ width: `${e.aussicht}%` }} /></i><span className="zahl">{e.aussicht} %</span></div>}
                  </article>
                ))}
              </div>
            } />

          {/* 5 · Schreiben & Fristen */}
          <Abschnitt id="kb-schreiben" aktiv={aktiv === "kb-schreiben"} titel="Meine Schreiben & Fristen" unter="Versendet per Einschreiben, Antwort erfasst, Frist gehalten – jede Stufe nachvollziehbar."
            kurz={<Pille ton="frist">1 Frist läuft · 8 Tage</Pille>}
            kinder={
              <ol className="kb-zeitleiste">
                {SCHREIBEN.map((b) => (
                  <li key={b.titel} className={b.ton}>
                    <time className="zahl">{b.datum}</time>
                    <div><h3>{b.titel}</h3><p>{b.an} · {b.weg}</p><Pille ton={b.ton}>{b.stand}</Pille></div>
                  </li>
                ))}
              </ol>
            } />

          {/* 6 · Freigabe */}
          <Abschnitt id="kb-freigabe" aktiv={aktiv === "kb-freigabe"} titel="Wartet auf Ihre Freigabe" unter="Vorbereitet von FIAON, anwaltlich geprüfte Vorlage – Sie entscheiden mit einem Klick."
            kinder={
              <div className={`kb-freigabe${freigegeben ? " fertig" : ""}`}>
                <div className="kb-brief">
                  <small>Entwurf · Vorlage 2026-07 · geprüft</small>
                  <h3>Beschwerde bei der Datenschutzbehörde</h3>
                  <p>Betrifft: Eintrag „Versandhaus“ (189 €). Falls bis 31.08.2026 keine Antwort des Inkassounternehmens eingeht, wird der Eintrag als nicht belegt gerügt und die Löschung nach Art. 17 DSGVO verlangt.</p>
                  <div className="kb-brief-zeilen"><span>Versand: 01.09.2026 · Einschreiben</span><span>Frist danach: 4 Wochen</span></div>
                </div>
                <div className="kb-freigabe-seite">
                  {!freigegeben ? (
                    <>
                      <p>Sie müssen nichts formulieren, nichts drucken, nichts versenden. Ein Klick – FIAON übernimmt Versand, Frist und Antwort.</p>
                      <button type="button" className="mb-knopf kb-puls" onClick={() => setFreigegeben(true)}>Schreiben freigeben</button>
                      <button type="button" className="mb-knopf still">Zuerst Rückfrage stellen</button>
                    </>
                  ) : (
                    <>
                      <div className="kb-haken"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg></div>
                      <p><b>Freigegeben.</b> Versand am 01.09., sofern keine Antwort eingeht. Die Frist erscheint in Ihrer Zeitleiste; Sie erhalten eine Nachricht, sobald sich etwas tut.</p>
                      <button type="button" className="mb-knopf still" onClick={() => setFreigegeben(false)}>Noch einmal ansehen</button>
                    </>
                  )}
                </div>
              </div>
            } />

          {/* 7 · Finanzen */}
          <Abschnitt id="kb-finanzen" aktiv={aktiv === "kb-finanzen"} titel="Meine Finanzen" unter="Konto verbunden – Haushaltsrechnung live, Frühwarnung vor Rücklastschriften." breit
            kurz={<><Pille ton="gut">Konto verbunden</Pille><Pille ton="still">Demo-Bank · seit 03.08.</Pille></>}
            kinder={
              <div className="kb-finanzen">
                <div className="kb-kennzahlen">
                  <div><small>Einnahmen</small><b className="zahl">{eur(FINANZEN.einnahmen)}</b><span>Gehalt, pünktlich am 28.</span></div>
                  <div><small>Ausgaben</small><b className="zahl">{eur(FINANZEN.ausgaben)}</b><span>6 Fixkosten erkannt</span></div>
                  <div className="hervor"><small>Spielraum</small><b className="zahl">{eur(FINANZEN.spielraum)}</b><span>trägt eine Karte mit kleinem Rahmen</span></div>
                  <div><small>Frühwarnung</small><b>Keine</b><span>0 Rücklastschriften · kein Dispo</span></div>
                </div>
                <div className="kb-finanzen-unten">
                  <Kreis kategorien={FINANZEN.kategorien} />
                  <div className="kb-kategorien">
                    {FINANZEN.kategorien.map((k) => <div key={k.name} className="kb-kategorie"><span>{k.name}</span><i><b style={{ width: `${k.anteil * 100}%` }} /></i><span className="zahl">{eur(k.betrag)}</span></div>)}
                  </div>
                </div>
                <p className="kb-hinweis">Was das für Sie heißt: Stabiles Einkommen, keine Auffälligkeiten – genau das Bild, das ein Kartenpartner sehen will. FIAON nutzt es für die Vorqualifizierung, ohne dass eine Abfrage Ihren Wert senkt.</p>
              </div>
            } />

          {/* 8 · Einigung */}
          <Abschnitt id="kb-einigung" aktiv={aktiv === "kb-einigung"} titel="Einigung mit Gläubigern" unter="Für berechtigte Forderungen: Ratenvereinbarung oder Vergleich – verhandelt über FIAON-Vorlagen, Zahlungsplan mit Erinnerung."
            kurz={<Pille ton="gut">1 Vereinbarung aktiv</Pille>}
            kinder={
              <div className="kb-einigung">
                <div className="kb-einigung-kopf"><div><h3>Versandhaus · Restforderung 189 €</h3><p>Parallel zum Widerspruch angeboten: 3 Raten zu 63 €. Wird der Eintrag gelöscht, entfällt die Vereinbarung.</p></div><b className="zahl">2 / 3</b></div>
                <div className="kb-raten">
                  {[["15.07.", "bezahlt"], ["15.08.", "bezahlt"], ["15.09.", "offen"]].map(([d, st]) => <div key={d} className={`kb-rate ${st}`}><span className="zahl">{d}</span><b className="zahl">63 €</b><small>{st}</small></div>)}
                </div>
                <div className="kb-zeile"><span>Erledigungsvermerk</span><b>Wird nach der letzten Rate automatisch eingefordert</b></div>
              </div>
            } />

          {/* 9 · Nachrichten */}
          <Abschnitt id="kb-nachrichten" aktiv={aktiv === "kb-nachrichten"} titel="Nachrichten" unter="Ihre Ansprechpartnerin kennt die Akte. Im Bereich und per WhatsApp – ein Verlauf."
            kurz={<><Pille ton="gut">WhatsApp verbunden</Pille></>}
            kinder={
              <div className="kb-chat">
                <div className="kb-chat-verlauf">
                  {chat.map((n, i) => (
                    <div key={i} className={`kb-blase ${n.von}`}>
                      {n.von === "viktoria" && <span className="wer">VR</span>}
                      <div><p>{n.text}</p><time>{n.von === "viktoria" ? `${KUNDE.betreuerin} · ` : n.von === "system" ? "FIAON · " : ""}{n.zeit}</time></div>
                    </div>
                  ))}
                </div>
                <form className="kb-chat-eingabe" onSubmit={(e) => { e.preventDefault(); senden(); }}>
                  <input value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder="Nachricht an Viktoria Reichert …" aria-label="Nachricht" />
                  <button type="submit" className="mb-knopf">Senden</button>
                </form>
              </div>
            } />

          {/* 10 · Tresor */}
          <Abschnitt id="kb-tresor" aktiv={aktiv === "kb-tresor"} titel="Unterlagen & Tresor" unter="Alles zur Akte, verschlüsselt in der EU. Ein Foto genügt – FIAON erkennt das Dokument und ordnet es zu."
            kurz={<Pille ton="still">9 Dokumente</Pille>}
            kinder={
              <div className="kb-tresor">
                {[
                  ["Bonitätsauskunft", "03.06.2026 · PDF · ausgewertet"], ["Datenkopie Art. 15", "03.06.2026 · PDF"], ["Rückschein Widerspruch", "14.08.2026 · Foto · erkannt"],
                  ["Antwort Auskunftei – Löschung", "02.06.2026 · PDF"], ["Kontoauszüge Mai–Juli", "3 Dateien · ausgewertet"], ["Ausweis", "geprüft 20.04.2026"],
                  ["Vertrag FIAON Pro", "20.04.2026 · PDF"], ["Ratenvereinbarung Versandhaus", "12.07.2026 · PDF"], ["Mahnung (Foto)", "29.06.2026 · Eintrag 2 zugeordnet"],
                ].map(([t, u]) => <div key={t} className="kb-dokument"><i /><div><b>{t}</b><span>{u}</span></div></div>)}
                <button type="button" className="kb-dokument hochladen"><i /><div><b>Dokument hinzufügen</b><span>Foto oder PDF – wird automatisch zugeordnet</span></div></button>
              </div>
            } />

          {/* 11 · Zugang */}
          <Abschnitt id="kb-zugang" aktiv={aktiv === "kb-zugang"} titel="Meine Vorteile: Konto, Karte, Finanzierung" unter="Die Tür. Vorqualifiziert aus Ihren FIAON-Daten – ohne Abfrage, die den Wert senkt." breit
            kinder={
              <div className="kb-zugang">
                <div className="kb-tuer offen"><small>Schritt 1 · erledigt</small><h3>Girokonto</h3><p>Eröffnet am 12.05.2026, kostenlos, unabhängig von der Bonität. Spart rund 60 € im Jahr.</p><Pille ton="gut">aktiv</Pille></div>
                <div className="kb-tuer bald"><small>Schritt 2 · in ~3 Monaten</small><h3>Kreditkarte bis 5.000 €</h3><p>Vorqualifiziert: Einkommen und Haushaltsrechnung passen. Es fehlt nur noch der Wert über der Schwelle des Partners.</p><Pille ton="frist">Readiness 72 %</Pille></div>
                <div className="kb-tuer spaeter"><small>Schritt 3 · später</small><h3>Finanzierung</h3><p>Für Auto, Umzug oder Umschuldung – sobald der Wert über mehrere Monate stabil ist. Antrag aus der Akte heraus, vorausgefüllt.</p><Pille ton="still">ab Wert 88</Pille></div>
              </div>
            } />

          {/* 12 · Simulator */}
          <Abschnitt id="kb-simulator" aktiv={aktiv === "kb-simulator"} titel="Score-Simulator: Was passiert, wenn …" unter="Schalten Sie die Hebel um – der Bereich zeigt die Wirkung auf Wert und Karten-Readiness, gelernt aus vergleichbaren Akten." breit
            kinder={<Simulator />} />

          {/* 13 · Wissen */}
          <Abschnitt id="kb-wissen" aktiv={aktiv === "kb-wissen"} titel="Worauf Ihre Erfolgsaussicht beruht" unter="Anonymisiertes Wissen aus allen FIAON-Akten – es fließt in jede Einschätzung zurück und wächst mit jedem Kunden." breit
            kurz={<Pille ton="still">aus 6.589 Akten · anonymisiert</Pille>}
            kinder={
              <div className="kb-wissen">
                {[
                  { z: 81, n: "%", t: "Löschquote", s: "bezahlte, nicht gelöschte Mobilfunk-Einträge nach Löschantrag Art. 17 – Ø 19 Tage bis zur Antwort" },
                  { z: 74, n: "%", t: "Inkasso ohne Mahnung", s: "Einträge, die ohne nachweisbare Mahnungen gemeldet wurden, werden nach Widerspruch entfernt" },
                  { z: 2, n: ",3×", t: "Formulierung", s: "Vorlage B (Fristsetzung mit Behördenhinweis) wirkt 2,3-mal häufiger als der Standardbrief" },
                  { z: 23, n: " Tage", t: "Reaktionszeit", s: "mittlere Zeit bis zur Antwort einer Auskunftei – FIAON setzt die Frist auf 30 und mahnt am 31." },
                ].map((w) => <div key={w.t} className="kb-wissen-karte"><b><Zaehler bis={w.z} nach={w.n} /></b><h3>{w.t}</h3><p>{w.s}</p></div>)}
                <p className="kb-hinweis breit">Für Max Mustermann heißt das: Seine Aussicht von 78 % beim Eintrag „Versandhaus“ ist kein Bauchgefühl, sondern der Durchschnitt von Akten mit derselben Konstellation – Inkasso, keine Mahnung, Forderung unter 500 €.</p>
              </div>
            } />

          {/* 12 · Abo */}
          <Abschnitt id="kb-abo" aktiv={aktiv === "kb-abo"} titel="Abo & Zahlungen" unter="Zwölf Raten per SEPA-Lastschrift. In jedem Monat steht hier, was dafür passiert ist."
            kurz={<Pille ton="gut">4 von 12 bezahlt</Pille>}
            kinder={
              <div className="kb-abo">
                <div className="kb-abo-balken">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 4 ? "ok" : ""} />)}</div>
                <div className="kb-zeilen">
                  <div className="kb-zeile"><span>Nächste Rate</span><b className="zahl">23.09.2026 · 59,99 €</b></div>
                  <div className="kb-zeile"><span>Lastschrift</span><b>Mandat aktiv · angekündigt 5 Tage vorher</b></div>
                  <div className="kb-zeile"><span>Was im August passiert ist</span><b>1 Schreiben versendet · 1 Abgleich · Wert +5 · 1 Vereinbarung bedient</b></div>
                  <div className="kb-zeile"><span>Nach der zwölften Rate</span><b>FIAON fragt, ob Sie bleiben – die Kurve antwortet.</b></div>
                </div>
              </div>
            } />
        </div>

        <section id="kb-stufen" className={`kb-stufen${aktiv === "kb-stufen" ? " kb-aktiv" : ""}`}>
          <header className="kb-abschnitt-kopf"><div><span className="kb-funktion">Der Plan</span><h2>Drei Stufen, zehn Funktionen</h2><p>In der Reihenfolge des Kundennutzens gebaut. Jede Funktion hat in diesem Bereich ihren Ort – klicken Sie auf eine, um hinzuspringen.</p></div></header>
          <div className="kb-stufen-raster">
            {STUFEN.map((st) => (
              <div key={st.nr} className={`kb-stufe s${st.nr}`}>
                <div className="kb-stufe-kopf"><span className="zahl">Stufe {st.nr}</span><h3>{st.titel}</h3><small>{st.zeit}</small></div>
                <ol>{st.funktionen.map((f) => <li key={f.nr}><a href={`#${f.ziel}`} onClick={(e) => { e.preventDefault(); document.getElementById(f.ziel)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><span className="zahl">{f.nr}</span><span>{f.name}</span></a></li>)}</ol>
              </div>
            ))}
          </div>
        </section>

        <footer className="kb-fuss">
          <div>
            <p className="kb-ueber">Das ist der Zielzustand</p>
            <h2>So sieht FIAON aus, <span>wenn alles gebaut ist.</span></h2>
            <p>Alle Namen und Zahlen sind erfunden. Der heute gebaute Bereich – Fahrplan, Auskunft, Finanzauswertung, Abo – läuft unter <a href="/demo/produkt">/demo/produkt</a>; Stufe 1 entsteht in den nächsten sechs bis acht Wochen.</p>
          </div>
          <div className="kb-fuss-knoepfe">
            <a href="/investoren#anfrage" className="mb-knopf">Datenraum anfragen</a>
            <a href="/demo" className="mb-knopf still">Zurück zur Demo-Übersicht</a>
            <button type="button" className="mb-knopf still" onClick={() => { setStation(0); setModus("fuehrung"); }}>Führung noch einmal</button>
          </div>
        </footer>
      </main>

      {/* ── Die Führung ── */}
      {modus === "fuehrung" && (
        <aside className="kb-fuehrung" role="dialog" aria-label={s.titel}>
          <div className="kb-fuehrung-kopf">
            <span className="kb-fuehrung-ueber">{s.ueber}</span>
            <button type="button" className="kb-fuehrung-zu" onClick={() => setModus("frei")} aria-label="Führung beenden">Frei erkunden</button>
          </div>
          <div className="kb-fuehrung-balken" aria-hidden="true">{STATIONEN.map((_, i) => <i key={i} className={i <= station ? "ok" : ""} onClick={() => setStation(i)} />)}</div>
          <div key={station} className="kb-fuehrung-text">
            <h3>{s.titel}</h3>
            <p>{s.text}</p>
            <p className="kb-fuehrung-warum"><b>Warum das zählt:</b> {s.warum}</p>
          </div>
          <div className="kb-fuehrung-knoepfe">
            <button type="button" className="mb-knopf still" onClick={zurueck} disabled={station === 0}>Zurück</button>
            <span className="zahl">{station + 1} / {STATIONEN.length}</span>
            <button type="button" className="mb-knopf" onClick={weiter}>{station === STATIONEN.length - 1 ? "Fertig" : "Weiter"}</button>
          </div>
        </aside>
      )}
      {modus === "frei" && <a className="mb-demo-band" href="/demo">Demo-Konto mit Platzhalterdaten<span>Zurück zur Demo-Übersicht</span></a>}
    </div>
  );
}
