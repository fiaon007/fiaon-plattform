// ═══════════════════════════════════════════════════════════════════════════
// /agent — Mitarbeiter-Anmeldung, Neubau (23.08.2026, Justin: „Start Mitarbeiter-
// Umbau — wir starten beim Login, VIEL besser, moderner, mehrere Sektionen,
// hochwertigstes Design, Higgsfield für 3D.")
//
// Eigene dunkle Bühne (kein GlassNav, keine Website-Fußzeile): Cockpit-Bild
// (Higgsfield, 08_Medien_Higgsfield/Bilder_Website/cockpit-mitarbeiter.png),
// NeuralSphere, Glas-Formular. Darunter: Was dich erwartet · Dein Tag ·
// Kennzahlen · Regeln · Zugang. Gleiche API wie bisher (/agent/login,
// /agent/forgot-password). Du-Form — intern.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { Phone, Users, FileText, ClipboardList, BookOpen, Headset, ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import { api } from "./shared";
import "@/styles/agent-anmeldung.css";

const BEREICHE = [
  { Icon: Phone, titel: "Vertrieb", text: "Leads, Rückrufe, Gesprächsleitfaden und Abschluss in einem Bildschirm. Jeder Anruf läuft über das Softphone im Browser – mit Aufzeichnung." },
  { Icon: Users, titel: "Onboarding", text: "Startgespräche mit fester Agenda, Unterlagen-Status, Freischaltung. Du siehst, was der Kunde sieht – und schaltest frei, wenn alles da ist." },
  { Icon: FileText, titel: "Forderungsmanagement", text: "Schreiben an Gläubiger und Auskunfteien, Fristen, Antworten. Vorbereitet von der Plattform, freigegeben vom Kunden, versendet von dir." },
  { Icon: ClipboardList, titel: "Aufgaben", text: "Übergaben aus der Geschäftsführung landen in deiner Liste – mit Frist, Kontext und Rückkanal. Nichts geht in Chats verloren." },
  { Icon: Headset, titel: "Telefon & Termine", text: "Eingehende Anrufe werden dir zugeordnet, Termine erinnern dich von selbst, verpasste Gespräche tauchen als Rückruf wieder auf." },
  { Icon: BookOpen, titel: "Wissen & Updates", text: "Jede Neuerung der Plattform steht im Update-Protokoll – kurz, mit Bildern, nach Bereich sortiert. Du musst nichts erraten." },
];
const TAG = [
  ["Anmelden", "Dein Cockpit zeigt Rückrufe, Termine und offene Aufgaben des Tages – sortiert nach Dringlichkeit."],
  ["Arbeiten", "Anrufen, Startgespräche führen, Schreiben versenden – alles aus der Kundenakte heraus, mit Verlauf."],
  ["Verbuchen", "Abschlüsse und Freischaltungen werden sofort gebucht; deine Provision siehst du in Echtzeit."],
  ["Übergeben", "Was nicht in deinen Bereich gehört, gibst du weiter – mit einem Klick, nachvollziehbar für alle."],
];

export default function Anmeldung({ onLogin }: { onLogin: (a: { name: string; email: string }) => void }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [vergessen, setVergessen] = useState(false);
  const [umbau, setUmbau] = useState(false);
  const [umbauName, setUmbauName] = useState("");
  const [uhr, setUhr] = useState(() => new Date());
  useEffect(() => { if (!umbau) return; const i = setInterval(() => setUhr(new Date()), 1000); return () => clearInterval(i); }, [umbau]);
  const formular = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = "Mitarbeiter-Anmeldung · FIAON"; }, []);

  const anmelden = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true); setFehler(null);
    const r = await api("/agent/login", { method: "POST", body: JSON.stringify(form) });
    setLaeuft(false);
    if (r.ok) { onLogin(r.json.agent); window.location.reload(); }
    else if (r.json?.umbau) { setUmbauName(String(r.json?.vorname || "")); setUmbau(true); }
    else setFehler(r.json?.error || "Anmeldung fehlgeschlagen – bitte E-Mail und Passwort prüfen.");
  };
  const zuruecksetzen = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true);
    const r = await api("/agent/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email }) });
    setLaeuft(false);
    setInfo(r.json?.message || "Falls ein Konto existiert, ist eine E-Mail mit dem Link unterwegs.");
  };
  const zumFormular = () => formular.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  if (umbau) return (
    <div className="aa aa-umbau">
      <div className="aa-bild" aria-hidden="true"><img src="/office/flur.jpg" alt="" decoding="async" /><div className="aa-schleier" /></div>
      <header className="aa-kopf"><a href="/" className="aa-wort">FIAON</a><span className="aa-marke">Mitarbeiterbereich</span></header>
      <section className="aa-umbau-buehne">
        <div className="aa-kugel" aria-hidden="true"><NeuralSphere variant="calm" className="absolute inset-0" /></div>
        <span className="aa-pille">Großes Update · {uhr.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} Uhr</span>
        <h1>{umbauName ? <>Wir bauen gerade für dich um, <span className="aa-verlauf">{umbauName}.</span></> : <>Wir bauen gerade <span className="aa-verlauf">euer neues Büro.</span></>}</h1>
        <p>Das FIAON-Office wird komplett neu – cinematisch, schneller, mit eigenem Schreibtisch, Kundenbuch, Kasse und Gehaltsrechner. Dein Zugang wird freigeschaltet, sobald dein Raum fertig ist. Seid gespannt.</p>
        <div className="aa-umbau-punkte">{["Ein Betreuer, ein Kunde", "Provision auf jede bezahlte Rate", "Termine in deinen Arbeitszeiten", "Neues Telefon"].map((p) => <span key={p}>{p}</span>)}</div>
        <button type="button" className="aa-leise" onClick={() => setUmbau(false)}>Zurück</button>
      </section>
    </div>
  );

  return (
    <div className="aa">
      <div className="aa-bild" aria-hidden="true"><img src="/kino/cockpit.jpg" alt="" decoding="async" fetchPriority="high" /><div className="aa-schleier" /></div>

      <header className="aa-kopf">
        <a href="/" className="aa-wort">FIAON</a>
        <span className="aa-marke">Mitarbeiterbereich</span>
        <nav className="aa-kopf-links"><a href="/karriere">Zugang beantragen</a><a href="/">Zur Website</a></nav>
      </header>

      <section className="aa-hero">
        <div className="aa-hero-text">
          <span className="aa-pille">Nur für autorisierte Mitarbeiter</span>
          <h1>Dein <span className="aa-verlauf">Cockpit.</span></h1>
          <p>Leads, Startgespräche, Schreiben, Telefon, Aufgaben – alles an einem Ort, so gebaut, dass du den Kunden siehst und nicht die Software.</p>
          <div className="aa-punkte">{["Softphone im Browser", "Akte mit Verlauf", "Provision in Echtzeit", "Aufgaben mit Frist"].map((p) => <span key={p}>{p}</span>)}</div>
        </div>

        <div className="aa-form-huelle" ref={formular}>
          <div className="aa-kugel" aria-hidden="true"><NeuralSphere variant="calm" className="absolute inset-0" /></div>
          <div className="aa-form">
            <div className="aa-form-kopf">
              <b>{vergessen ? "Passwort zurücksetzen" : "Anmelden"}</b>
              <small>{vergessen ? "Wir schicken dir einen Link an deine Login-E-Mail." : "Mit deiner FIAON-Login-E-Mail."}</small>
            </div>
            {vergessen ? (
              <form onSubmit={zuruecksetzen}>
                <label><span>Login-E-Mail</span><input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vorname@fiaon.com" /></label>
                {info && <p className="aa-info">{info}</p>}
                <button type="submit" className="aa-knopf" disabled={laeuft || !form.email}>{laeuft ? "Sende …" : "Link anfordern"}<ArrowRight size={16} /></button>
                <button type="button" className="aa-leise" onClick={() => { setVergessen(false); setInfo(null); }}>Zurück zur Anmeldung</button>
              </form>
            ) : (
              <form onSubmit={anmelden}>
                <label><span>E-Mail</span><input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vorname@fiaon.com" autoFocus /></label>
                <label><span>Passwort</span>
                  <div className="aa-pw"><input type={zeigen ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" /><button type="button" onClick={() => setZeigen(!zeigen)} aria-label={zeigen ? "Passwort verbergen" : "Passwort anzeigen"}>{zeigen ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                </label>
                {fehler && <p className="aa-fehler">{fehler}</p>}
                <button type="submit" className="aa-knopf" disabled={laeuft || !form.email || !form.password}>{laeuft ? "Anmelden …" : "Anmelden"}<ArrowRight size={16} /></button>
                <button type="button" className="aa-leise" onClick={() => { setVergessen(true); setFehler(null); }}>Passwort vergessen?</button>
              </form>
            )}
            <div className="aa-form-fuss"><ShieldCheck size={14} /> Persönlicher Zugang · Sitzungen werden protokolliert</div>
          </div>
        </div>
      </section>

      <section className="aa-block">
        <div className="aa-rahmen">
          <span className="aa-pille">Was dich erwartet</span>
          <h2>Ein Cockpit, <span className="aa-verlauf">sechs Räume.</span></h2>
          <div className="aa-raster">
            {BEREICHE.map((b, i) => <div key={b.titel} className="aa-karte" style={{ animationDelay: `${i * 60}ms` }}><span className="aa-symbol"><b.Icon size={20} strokeWidth={1.75} /></span><h3>{b.titel}</h3><p>{b.text}</p></div>)}
          </div>
        </div>
      </section>

      <section className="aa-block licht">
        <div className="aa-rahmen">
          <span className="aa-pille">Dein Tag</span>
          <h2>Vier Schritte, <span className="aa-verlauf">kein Chaos.</span></h2>
          <ol className="aa-schritte">{TAG.map(([t, x], i) => <li key={t}><span>{i + 1}</span><div><b>{t}</b><p>{x}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="aa-block">
        <div className="aa-rahmen">
          <div className="aa-zahlen">
            {[["7", "Bereiche – Vertrieb bis Finanzen"], ["3", "Länder: DE · AT · CH"], ["1", "fester Ansprechpartner je Kunde"], ["0", "Excel-Listen, die jemand pflegen muss"]].map(([w, l]) => <div key={l}><b>{w}</b><small>{l}</small></div>)}
          </div>
        </div>
      </section>

      <section className="aa-block licht">
        <div className="aa-rahmen">
          <span className="aa-pille">Regeln</span>
          <h2>Was hier <span className="aa-verlauf">gilt.</span></h2>
          <div className="aa-regeln">
            {[["Persönlicher Zugang", "Dein Login ist deiner. Kein Teilen, kein gemeinsames Konto – jede Aktion trägt deinen Namen."],
              ["Kundendaten bleiben hier", "Nichts in WhatsApp, nichts in privaten Notizen. Alles, was zum Kunden gehört, steht in seiner Akte."],
              ["Worte, die wir nicht benutzen", "Keine „Garantie“, keine „Beratung“, kein „Score verbessern“. Wir beschaffen, erklären, übernehmen, versenden."],
              ["Der Kunde wird gesiezt", "In jedem Gespräch, in jeder Nachricht. Das Portal spricht dich mit Du an – der Kunde dich nicht."]].map(([t, x]) => <div key={t} className="aa-regel"><b>{t}</b><p>{x}</p></div>)}
          </div>
        </div>
      </section>

      <section className="aa-block">
        <div className="aa-rahmen aa-abschluss">
          <h2>Bereit? <span className="aa-verlauf">Dann rein.</span></h2>
          <p>Noch keinen Zugang? Fest oder frei, remote in DACH – auf der Karriereseite dauert die Bewerbung drei Minuten.</p>
          <div className="aa-knoepfe"><button type="button" className="aa-knopf" onClick={zumFormular}>Zum Login<ArrowRight size={16} /></button><a className="aa-knopf still" href="/karriere">Zugang beantragen</a></div>
        </div>
      </section>

      <footer className="aa-fuss">FIAON LTD · Mitarbeiterbereich · Probleme beim Anmelden? <a href="mailto:support@fiaon.com">support@fiaon.com</a></footer>
    </div>
  );
}
