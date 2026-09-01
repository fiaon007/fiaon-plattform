// ═══════════════════════════════════════════════════════════════════════════
// OfficeShell — das digitale FIAON-Büro (23.08.2026, Justin: „High-End 3D
// Office und Arbeitsbereich, cinematisch, damit sich jeder wohlfühlt").
//
// Rahmen für alle Mitarbeiterseiten: Higgsfield-Bühne je Raum, Glas-Leiste
// mit den Räumen (Rechner links, Handy als Schublade), Kopfzeile mit Präsenz
// und Kasse, Inhalt auf einer hellen Glasfläche (bestehende Seiten laufen
// unverändert darin). Räume, die ihre eigene dunkle Bühne wollen, setzen
// `useOffice().dunkel(true)`.
// Plan: 01_Plattform/MITARBEITER_OFFICE_PLAN_2026-08-23.md §4
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, BookUser, Users, Phone, Megaphone, Wallet, Calculator, GraduationCap, ListChecks, Mail, Calendar, Inbox, Landmark, MoreHorizontal, Clock, Wrench, Handshake, Boxes, LogOut, ChevronLeft, ChevronRight, X, Menu, Compass, Building2 } from "lucide-react";
import { Einfuehrung } from "@/components/agent/Einfuehrung";
import "@/styles/office.css";

export interface Raum { href: string; label: string; Icon: any; match: string[]; szene: string; gruppe: "arbeit" | "team" | "ich" | "mehr"; nurRolle?: string; nichtRolle?: string[]; badge?: string }

/** Das Zeichen des Copilot — selbst gezeichnet (AGENTS.md: keine neuen
 *  Bibliotheks-Icons), 1,5-px-Strich, currentColor, Bauform wie lucide. */
function CopilotZeichen({ size = 18, ...rest }: { size?: number } & Record<string, unknown>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3" />
      <path d="M18.4 5.6a9 9 0 0 1 0 12.8M5.6 18.4a9 9 0 0 1 0-12.8" />
    </svg>
  );
}

/** Die Räume des Büros. Reihenfolge = Leiste. Szene = Higgsfield-Bühne (client/public/office/).
 *  Namen auf Englisch (Justin 23.08.: „Schreibtisch, Kundenbuch … hört sich nicht nach internationalem Unicorn an") – Inhalte bleiben Deutsch. */
// ── DIE REIHENFOLGE FOLGT DEM TAG (24.08.2026) ────────────────────────────
// Justin: „Die Menüanreihung muss besser gemacht werden, also sinnvoller."
// VORHER: Dashboard · Pipeline · Bestand · Calendar · Onboarding · Tasks ·
//   Inbox · Tickets · Tools · Collections. Der Bestand stand zwischen Pipeline
//   und Kalender, „Tools" mitten zwischen den Kundenräumen, und Collections —
//   der Raum, in dem Geld zurückgeholt wird — ganz am Ende hinter allem.
// NACHHER folgt der Arbeitsblock dem Ablauf eines Tages:
//   1. Dashboard    Was steht heute an?
//   2. Pipeline     Die sechs, die jetzt angerufen werden.
//   3. Calendar     Die Termine, die daraus entstanden sind.
//   4. Onboarding   Die Startgespräche des Tages.
//   5. Bestand      Die Kunden, die schon da sind — gepflegt, nicht gejagt.
//   6. Collections  Das Geld, das fehlt.
// Danach erst der Schreibtisch-Teil (Inbox · Tasks · Tickets) und ganz zuletzt
// die Werkzeuge. Wer von oben nach unten geht, hat seinen Tag abgearbeitet.
export const RAEUME: Raum[] = [
  { href: "/agent/start", label: "Dashboard", Icon: LayoutDashboard, match: ["/agent/start", "/agent/heute", "/agent"], szene: "schreibtisch", gruppe: "arbeit" },
  { href: "/agent/pipeline", label: "Pipeline", Icon: BookUser, match: ["/agent/pipeline", "/agent/kunden"], szene: "kundenbuch", gruppe: "arbeit", badge: "/agent/kunden" },
  { href: "/agent/kalender", label: "Calendar", Icon: Calendar, match: ["/agent/kalender"], szene: "schreibtisch", gruppe: "arbeit" },
  { href: "/agent/onboarding", label: "Onboarding", Icon: Handshake, match: ["/agent/onboarding", "/agent/startgespraeche"], szene: "akademie", gruppe: "arbeit" },
  { href: "/agent/bestand", label: "Bestand", Icon: Boxes, match: ["/agent/bestand"], szene: "kundenbuch", gruppe: "arbeit" },
  // Firmenkunden (02.09.2026): die B2B-Jagdstrecke — Tagesliste, Leitfaden,
  // Ein-Klick-Ergebnisse. Eigener Topf neben dem Privatgeschäft.
  { href: "/agent/firmen", label: "Firmen", Icon: Building2, match: ["/agent/firmen"], szene: "kundenbuch", gruppe: "arbeit" },
  { href: "/agent/collections", label: "Collections", Icon: Landmark, match: ["/agent/collections", "/agent/inkasso"], szene: "kasse", gruppe: "arbeit" },
  // Der Schreibtisch-Teil: was hereinkommt und beantwortet werden will.
  // 24.08.2026: VORHER trug „Inbox" den Marken-Schlüssel /agent/mail-zentrale
  // und „Collections" den Schlüssel /agent/inkasso. Für BEIDE liefert
  // AgentShell keinen Zähler — GEMESSEN stand die Marke bei jedem Konto
  // dauerhaft auf 0 und sah damit aus wie „nichts offen", war aber „nicht
  // gezählt". NACHHER trägt nur eine Marke, wer wirklich gezählt wird.
  { href: "/agent/inbox", label: "Inbox", Icon: Mail, match: ["/agent/inbox", "/agent/mail-zentrale"], szene: "schreibtisch", gruppe: "arbeit" },
  { href: "/agent/aufgaben", label: "Tasks", Icon: ListChecks, match: ["/agent/aufgaben"], szene: "schreibtisch", gruppe: "arbeit", badge: "/agent/aufgaben" },
  { href: "/agent/anliegen", label: "Tickets", Icon: Inbox, match: ["/agent/anliegen"], szene: "schreibtisch", gruppe: "arbeit", badge: "/agent/anliegen" },
  { href: "/agent/tools", label: "Tools", Icon: Wrench, match: ["/agent/tools"], szene: "schreibtisch", gruppe: "arbeit" },
  // Der Copilot (30.08.2026): erledigt Aufträge über Werkzeuge — alles mit
  // Folgen wartet auf die Bestätigung des Menschen.
  { href: "/agent/assistent", label: "Copilot", Icon: CopilotZeichen, match: ["/agent/assistent"], szene: "schreibtisch", gruppe: "arbeit" },
  { href: "/agent/flur", label: "Team", Icon: Users, match: ["/agent/flur", "/agent/space"], szene: "flur", gruppe: "team", badge: "/agent/space" },
  { href: "/agent/updates", label: "Feed", Icon: Megaphone, match: ["/agent/updates", "/agent/feedback"], szene: "flur", gruppe: "team", badge: "/agent/updates" },
  { href: "/agent/academy", label: "Academy", Icon: GraduationCap, match: ["/agent/academy", "/agent/schulung", "/agent/skripte"], szene: "akademie", gruppe: "team" },
  { href: "/agent/gehalt", label: "Earnings", Icon: Calculator, match: ["/agent/gehalt"], szene: "kasse", gruppe: "ich" },
  { href: "/agent/wallet", label: "Wallet", Icon: Wallet, match: ["/agent/wallet", "/agent/verdienst", "/agent/auszahlung", "/agent/partner-programm", "/agent/leistung"], szene: "kasse", gruppe: "ich" },
  { href: "/agent/arbeitszeiten", label: "Availability", Icon: Clock, match: ["/agent/arbeitszeiten"], szene: "schreibtisch", gruppe: "ich" },
  { href: "/agent/vertrieb", label: "Management", Icon: LayoutDashboard, match: ["/agent/vertrieb"], szene: "flur", gruppe: "mehr", nurRolle: "vertriebsleiter" },
  { href: "/agent/more", label: "More", Icon: MoreHorizontal, match: ["/agent/more", "/agent/mehr", "/agent/profil", "/agent/dokumente", "/agent/passwort"], szene: "schreibtisch", gruppe: "mehr" },
];
const GRUPPEN: Record<Raum["gruppe"], string> = { arbeit: "Workspace", team: "Team", ich: "Me", mehr: "" };

interface OfficeCtx { dunkel: (an: boolean) => void; titel: (t: string | null) => void; praesenz: Praesenz; setPraesenz: (p: Praesenz) => void }
type Praesenz = "da" | "pause" | "telefon" | "weg";
const Ctx = createContext<OfficeCtx>({ dunkel: () => {}, titel: () => {}, praesenz: "da", setPraesenz: () => {} });
export const useOffice = () => useContext(Ctx);

// ═══════════════════════════════════════════════════════════════════════════
// DIE BÜHNE — Bild oder Film
//
// Justin, 24.08.2026: „Der Hintergrund ist aktuell ein Bild, mach daraus ein
// Video, dass es cinematischer ist."
//
// VORHER: ein festes <img> je Raum. NACHHER: Liegt zum Raum ein Film
// (/office/<raum>.mp4), läuft er stumm in Schleife; sonst bleibt es beim Bild.
// Drei Dinge sind dabei absichtlich so gebaut:
//
//  1. Das Bild bleibt IMMER darunter liegen und ist das `poster` des Films.
//     Der Raum ist damit in dem Moment da, in dem die Seite da ist — ein Film
//     lädt Sekunden, eine Kachel „lädt noch" hinter der Arbeitsfläche wäre
//     schlechter als das Standbild.
//  2. Scheitert der Film (kein Netz, altes Gerät, Codec), fällt die Bühne
//     still auf das Bild zurück. Ein schwarzer Hintergrund wäre der teuerste
//     Fehler an dieser Stelle, weil die halbe Oberfläche darauf sitzt.
//  3. Wer „weniger Bewegung" eingestellt hat, bekommt das Standbild. Ein
//     dauerlaufender Film hinter dem Arbeitsplatz ist genau der Fall, für den
//     es diese Einstellung gibt.
// ═══════════════════════════════════════════════════════════════════════════
const FILM_RAEUME = new Set(["schreibtisch"]);

function Buehne({ szene }: { szene: string }) {
  const [filmAus, setFilmAus] = useState(false);
  const wenigerBewegung = useMemo(() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }, []);
  const mitFilm = FILM_RAEUME.has(szene) && !filmAus && !wenigerBewegung;
  // Beim Raumwechsel wieder von vorn: Ein Fehler im einen Raum darf den Film
  // im nächsten nicht dauerhaft abschalten.
  useEffect(() => { setFilmAus(false); }, [szene]);
  return (
    <div className={`of-buehne${mitFilm ? " mit-film" : ""}`} aria-hidden="true">
      <img src={`/office/${szene}.jpg`} alt="" decoding="async" />
      {mitFilm && (
        <video
          key={szene}
          className="of-film"
          src={`/office/${szene}.mp4`}
          poster={`/office/${szene}.jpg`}
          autoPlay muted loop playsInline preload="auto"
          onError={() => setFilmAus(true)}
        />
      )}
      <div className="of-schleier" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BEGRÜSSUNG IN DER KOPFZEILE
//
// Justin, 24.08.2026: „Mach daraus ‚Guten Tag, Justin. Es ist 00:00 Uhr, das
// Wetter an deinem heutigen Standort ist stürmisch. Wir wünschen dir einen
// erfolgreichen Tag!' ANIMIERT, mit Farbverlauf, dass es so glänzend wirkt —
// und perfekt formatiert auf PC und Handy."
//
// VORHER stand hier nur „Guten Tag, Justin."
//
// Drei Entscheidungen, die den Satz alltagstauglich machen:
//
//  1. DER SATZ WÄCHST MIT DEM PLATZ. Am Rechner steht er ganz da. Am Telefon
//     wäre er drei Zeilen lang und würde die Kopfzeile sprengen — dort bleiben
//     Gruß, Uhrzeit und Wetterzeichen. Weggelassen wird von hinten, also
//     zuerst der Wunsch, dann der Wetter-Halbsatz. Nie der Name.
//  2. DAS WETTER DARF FEHLEN. Antwortet der Dienst nicht, steht der Satz ohne
//     Wetter da. Ein „—" oder eine Fehlermeldung in der Begrüßung wäre der
//     unfreundlichste denkbare Empfang.
//  3. DIE UHR LÄUFT, ABER LEISE. Einmal je Minute, nicht je Sekunde: Eine
//     Sekundenanzeige in der Kopfzeile zieht den Blick den ganzen Tag lang auf
//     sich, ohne dass jemand etwas davon hat.
// ═══════════════════════════════════════════════════════════════════════════
function Begruessung({ gruss, vorname, imKopf }: { gruss: string; vorname: string; imKopf?: boolean }) {
  const [uhr, setUhr] = useState(() => new Date());
  const [wetter, setWetter] = useState<{ wort: string; zeichen: string; grad: number | null } | null>(null);

  useEffect(() => {
    // Auf die volle Minute einschwenken, damit der Sprung mit der echten Uhr
    // zusammenfällt und nicht 40 Sekunden daneben liegt.
    const bisMinute = 60_000 - (Date.now() % 60_000);
    let takt: number | undefined;
    const start = window.setTimeout(() => {
      setUhr(new Date());
      takt = window.setInterval(() => setUhr(new Date()), 60_000);
    }, bisMinute);
    return () => { window.clearTimeout(start); if (takt) window.clearInterval(takt); };
  }, []);

  useEffect(() => {
    let tz = "Europe/Berlin";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch { /* Standard bleibt */ }
    let an = true;
    const holen = () => fetch(`/api/fiaon/agent/wetter?tz=${encodeURIComponent(tz)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (an && j?.ok && j.wetter) setWetter(j.wetter); })
      .catch(() => { /* ohne Wetter ist auch gut */ });
    holen();
    const i = window.setInterval(holen, 30 * 60_000);
    return () => { an = false; window.clearInterval(i); };
  }, []);

  const zeit = uhr.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

  return (
    <div className={`of-gruss-huelle${imKopf ? " im-kopf" : ""}`}>
      <b className="of-gruss">
        <span className="of-gruss-name">{gruss}, {vorname}.</span>
        <span className="of-gruss-zeit"> Es ist {zeit} Uhr{wetter ? "," : "."}</span>
        {wetter && (
          <span className="of-gruss-wetter">
            {" "}das Wetter an deinem heutigen Standort ist {wetter.wort}
            {wetter.grad != null ? ` bei ${wetter.grad} °C` : ""}.
            <span className="of-gruss-zeichen" aria-hidden="true"> {wetter.zeichen}</span>
          </span>
        )}
        {/* `{" "}` ausdrücklich statt eines Leerzeichens im Text: Wird der
            Wunsch am Handy ausgeblendet (display:none), verschwände ein
            Leerzeichen aus dem Textknoten mit — so bleibt der Abstand vor dem
            Satz in jedem Fall richtig. */}
        <span className="of-gruss-wunsch">{" "}Wir wünschen dir einen erfolgreichen Tag!</span>
      </b>
    </div>
  );
}

export function OfficeShell({ children, agent, rolle, zaehler, onRefresh, logout, banner }: {
  children: ReactNode; agent: { name: string; avatar?: string | null; email?: string; rolle?: string }; rolle: string;
  zaehler: Record<string, number>; onRefresh?: () => void; logout: (e: React.MouseEvent) => void; banner?: ReactNode;
}) {
  const [location] = useLocation();
  const [dunkel, setDunkel] = useState(false);
  const [titel, setTitel] = useState<string | null>(null);
  const [eingeklappt, setEingeklappt] = useState(() => { try { return localStorage.getItem("fiaon_office_leiste") === "zu"; } catch { return false; } });
  const [menueOffen, setMenueOffen] = useState(false);
  const [praesenz, setPraesenz] = useState<Praesenz>(() => { try { const p = sessionStorage.getItem("fiaon_praesenz"); return p === "pause" ? "pause" : "da"; } catch { return "da"; } });
  useEffect(() => { try { localStorage.setItem("fiaon_office_leiste", eingeklappt ? "zu" : "auf"); } catch { /* egal */ } }, [eingeklappt]);
  useEffect(() => { try { sessionStorage.setItem("fiaon_praesenz", praesenz); } catch { /* egal */ } fetch("/api/fiaon/agent/praesenz", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: praesenz }) }).catch(() => {}); const i = setInterval(() => fetch("/api/fiaon/agent/praesenz", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: praesenz }) }).catch(() => {}), 10 * 60_000); return () => clearInterval(i); }, [praesenz]);
  // Arbeitszeiten-Pflicht (E-039): Ohne Wochenplan erinnert das Office alle 5 Minuten – zentriert, Hintergrund verschwommen.
  const [planFehlt, setPlanFehlt] = useState(false);
  const [erinnerung, setErinnerung] = useState(false);
  const naechsteErinnerung = useRef<number>(0);
  const planPruefen = () => fetch("/api/fiaon/agent/arbeitszeiten", { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.ok) setPlanFehlt(!j.vollstaendig); }).catch(() => {});
  useEffect(() => { planPruefen(); }, [location]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!planFehlt) { setErinnerung(false); return; }
    const tick = () => { if (location.startsWith("/agent/arbeitszeiten")) return; if (Date.now() >= naechsteErinnerung.current) setErinnerung(true); };
    tick(); const i = setInterval(tick, 15_000); return () => clearInterval(i);
  }, [planFehlt, location]);
  const spaeter = () => { naechsteErinnerung.current = Date.now() + 5 * 60_000; setErinnerung(false); };

  // Inaktivität (Justin 23.08.): 4 Minuten ohne Maus/Tastatur/Touch → „Bist du noch da?“ mit 60 s Countdown, sonst Pause.
  const INAKTIV_NACH = (import.meta.env.DEV && Number(sessionStorage.getItem("fiaon_inaktiv_ms"))) || 4 * 60_000, COUNTDOWN = 60; // DEV: sessionStorage.fiaon_inaktiv_ms zum Testen
  const letzteAktivitaet = useRef(Date.now());
  const [nochDa, setNochDa] = useState(false);
  const [rest, setRest] = useState(COUNTDOWN);
  useEffect(() => {
    const bewegt = () => { letzteAktivitaet.current = Date.now(); };
    const ev: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    ev.forEach((e) => window.addEventListener(e, bewegt, { passive: true }));
    return () => ev.forEach((e) => window.removeEventListener(e, bewegt));
  }, []);
  useEffect(() => {
    if (praesenz !== "da") { setNochDa(false); return; }
    const i = setInterval(() => { if (!nochDa && Date.now() - letzteAktivitaet.current >= INAKTIV_NACH) { setRest(COUNTDOWN); setNochDa(true); } }, 5_000);
    return () => clearInterval(i);
  }, [praesenz, nochDa]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!nochDa) return;
    const i = setInterval(() => setRest((r) => { if (r <= 1) { clearInterval(i); setNochDa(false); setPraesenz("pause"); return 0; } return r - 1; }), 1_000);
    return () => clearInterval(i);
  }, [nochDa]);
  const binDa = () => { letzteAktivitaet.current = Date.now(); setNochDa(false); setPraesenz("da"); };
  const inPause = () => { setNochDa(false); setPraesenz("pause"); };
  const vorherigerOrt = useRef(location);
  useEffect(() => { if (vorherigerOrt.current === location) return; vorherigerOrt.current = location; setMenueOffen(false); setDunkel(false); setTitel(null); }, [location]);
  useEffect(() => { const r = document.getElementById("root"); if (r) r.style.overflow = menueOffen ? "hidden" : ""; return () => { if (r) r.style.overflow = ""; }; }, [menueOffen]);

  const sichtbar = RAEUME.filter((r) => (!r.nurRolle || r.nurRolle === rolle) && !(r.nichtRolle ?? []).includes(rolle));
  const aktiv = useMemo(() => sichtbar.find((r) => r.match.some((m) => m === "/agent" ? location === "/agent" : location === m || location.startsWith(m + "/") || location.startsWith(m + "?"))) ?? sichtbar[0], [location, sichtbar]);
  const szene = aktiv?.szene ?? "schreibtisch";
  const initialen = String(agent.name || "?").split(/\s+/).map((t) => t[0]).join("").slice(0, 2).toUpperCase();
  const vorname = String(agent.name || "").split(" ")[0];
  const stunde = new Date().getHours(); const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";
  const ctx: OfficeCtx = { dunkel: setDunkel, titel: setTitel, praesenz, setPraesenz };

  const Punkt = ({ r, inSchublade = false }: { r: Raum; inSchublade?: boolean }) => {
    const an = aktiv?.href === r.href; const b = r.badge ? zaehler[r.badge] || 0 : 0;
    return (
      <Link href={r.href} className={`of-punkt${an ? " an" : ""}`} title={r.label} onClick={() => inSchublade && setMenueOffen(false)}>
        <i><r.Icon size={18} strokeWidth={1.75} /></i><span>{r.label}</span>{b > 0 && <em>{b}</em>}
      </Link>
    );
  };
  const Liste = ({ inSchublade = false }: { inSchublade?: boolean }) => (
    <>{(["arbeit", "team", "ich", "mehr"] as Raum["gruppe"][]).map((g) => { const l = sichtbar.filter((r) => r.gruppe === g); if (!l.length) return null; return (
      <div key={g} className="of-gruppe">{GRUPPEN[g] && <div className="of-gruppe-titel">{GRUPPEN[g]}</div>}{l.map((r) => <Punkt key={r.href} r={r} inSchublade={inSchublade} />)}</div>); })}</>
  );
  // Nur zwei Zustände, die man selbst wählt: Online oder Pause. Wer abgemeldet ist, ist offline – das muss niemand einstellen.
  const PRAESENZ: Record<Praesenz, [string, string]> = { da: ["Online", "#34d399"], telefon: ["Online", "#34d399"], pause: ["Pause", "#fbbf24"], weg: ["Offline", "#94a3b8"] };
  const WAEHLBAR: Praesenz[] = ["da", "pause"];

  return (
    <Ctx.Provider value={ctx}>
      <div className={`of szene-${szene}${dunkel ? " dunkel" : ""}${eingeklappt ? " zu" : ""}`}>
        <Buehne szene={szene} />
        {banner}
        <header className="of-kopf">
          <button type="button" className="of-burger" aria-label="Räume öffnen" onClick={() => setMenueOffen(true)}><Menu size={20} /></button>
          <Link href="/agent/start" className="of-wort">FIAON</Link><span className="of-marke">Office</span>
          {/* 24.08.2026 (Justin: „das ‚More' löschen"): VORHER stand hier der
              Raumname — derselbe, der in der Leiste links ohnehin blau
              hervorgehoben ist. Bei „More" las er sich zudem wie ein
              abgeschnittenes Wort. NACHHER steht hier gar nichts mehr; wo man
              ist, sagt die Leiste, und die Begrüßung hat ihre eigene Zeile
              unter dem Kopf (siehe unten). */}
          {/* 24.08.2026, dritter Anlauf (Justin: „Das soll dezent in der obigen
              Leiste stehen, rechts neben dem OFFICE, in dem gleichen STIL wie
              ‚OFFICE'"): Die Begrüßung steht wieder in der Kopfzeile — aber in
              der Sprache der OFFICE-Pille: dieselbe Größe, dasselbe Gewicht,
              dieselbe Sperrung, dieselbe blaue Farbe. Nur nicht in Versalien:
              Ein ganzer Satz in Großbuchstaben wäre doppelt so breit und
              schlecht zu lesen. Sie steht in der Kopfzeile nur, solange dort
              Platz ist (ab 1100 px); darunter rutscht sie in ihre eigene
              ruhige Zeile — abgeschnitten wird sie nie. */}
          <Begruessung gruss={gruss} vorname={vorname} imKopf />
          <div className="of-kopf-rechts">
            <div className="of-praesenz" title="Präsenz">
              <span className="punkt" style={{ background: PRAESENZ[praesenz][1] }} />
              <select value={praesenz} onChange={(e) => setPraesenz(e.target.value as Praesenz)} aria-label="Präsenz">{WAEHLBAR.map((k) => <option key={k} value={k}>{PRAESENZ[k][0]}</option>)}</select>
            </div>
            {onRefresh && <button type="button" className="of-rund aktualisieren" title="Aktualisieren" onClick={onRefresh}>↻</button>}
            <Link href="/agent/more/profil" className="of-gesicht" title={agent.name}>{agent.avatar ? <img src={agent.avatar} alt="" /> : initialen}</Link>
            <button type="button" className="of-rund" title="Abmelden" onClick={logout}><LogOut size={15} /></button>
          </div>
        </header>

        {/* ── DIE BEGRÜSSUNG, ZWEITER ANLAUF (24.08.2026) ───────────────────
            Justin: „ist abgeschnitten und kann man nicht lesen … das gehört
            viel dezenter und animiert."
            VORHER stand der Satz IN der Kopfzeile und stritt dort mit Logo,
            Präsenz, Profilbild und Abmelden um die Breite — der Rest wurde mit
            Auslassungspunkten abgeschnitten. Ein Satz, den man nicht zu Ende
            lesen kann, ist schlechter als keiner.
            NACHHER hat er eine eigene schmale Zeile UNTER dem Kopf, über die
            volle Breite. Dort konkurriert er mit nichts, ist kleiner und
            leiser gesetzt (dezent, wie gewünscht) und der Glanz läuft ruhig
            hindurch. Am Handy darf er über zwei Zeilen gehen. */}
        {/* Dieselbe Begrüßung noch einmal — sie zeigt sich nur dann, wenn in
            der Kopfzeile kein Platz mehr ist (CSS entscheidet, nicht JS: So
            wechselt sie beim Verkleinern des Fensters ohne Sprung). */}
        <div className="of-grusszeile">
          <Begruessung gruss={gruss} vorname={vorname} />
        </div>

        <div className="of-grund">
          <aside className="of-leiste" aria-label="Räume">
            <button type="button" className="of-klapp" onClick={() => setEingeklappt(!eingeklappt)} title={eingeklappt ? "Leiste ausklappen" : "Leiste einklappen"}>{eingeklappt ? <ChevronRight size={18} /> : <><ChevronLeft size={16} /><span>Einklappen</span></>}</button>
            <Liste />
          </aside>
          <main className={`of-inhalt${dunkel ? " dunkel" : ""}`}>{dunkel ? children : <div className="of-flaeche">{children}</div>}</main>
        </div>

        {erinnerung && !location.startsWith("/agent/arbeitszeiten") && (
          <div className="of-modal-hintergrund" role="dialog" aria-modal="true" aria-labelledby="of-erinnerung-titel">
            <div className="of-modal">
              <span className="of-modal-pille">Availability · Pflicht</span>
              <h2 id="of-erinnerung-titel">Deine Verfügbarkeit fehlt noch.</h2>
              <p>Termine und Leads kommen nur in Zeiten, die in deinem Wochenplan stehen – mindestens 15 Stunden. Solange er fehlt, bekommst du keine Kunden zugeteilt.</p>
              <div className="of-modal-knoepfe">
                <Link href="/agent/arbeitszeiten" className="of-modal-knopf" onClick={() => setErinnerung(false)}>Jetzt eintragen</Link>
                <button type="button" className="of-modal-knopf still" onClick={spaeter}>In 5 Minuten erinnern</button>
              </div>
            </div>
          </div>
        )}
        {nochDa && (
          <div className="of-modal-hintergrund" role="dialog" aria-modal="true" aria-labelledby="of-nochda-titel">
            <div className="of-modal">
              <span className="of-modal-pille blau">Status</span>
              <h2 id="of-nochda-titel">Bist du noch da?</h2>
              <p>Seit ein paar Minuten kommt nichts von dir. Ohne Antwort stellen wir dich auf Pause – dann bekommst du keine Anrufe und keine neuen Kunden.</p>
              <div className="of-ring" aria-live="polite" aria-label={`${rest} Sekunden`}>
                <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="spur" cx="50" cy="50" r="46" /><circle className="lauf" cx="50" cy="50" r="46" style={{ strokeDashoffset: 289 * (1 - rest / COUNTDOWN) }} /></svg>
                <div className="of-ring-innen"><b>{rest}</b><small>Sek.</small></div>
              </div>
              <div className="of-modal-knoepfe">
                <button type="button" className="of-modal-knopf" onClick={binDa}>Ich bin da</button>
                <button type="button" className="of-modal-knopf still" onClick={inPause}>Pause machen</button>
              </div>
            </div>
          </div>
        )}
        <div className={`of-schublade-hintergrund${menueOffen ? " offen" : ""}`} onClick={() => setMenueOffen(false)} aria-hidden="true" />
        <aside className={`of-schublade${menueOffen ? " offen" : ""}`} aria-label="Räume" aria-hidden={!menueOffen}>
          <div className="of-schublade-kopf"><span className="of-wort">FIAON</span><span className="of-marke">Office</span><button type="button" className="of-rund" onClick={() => setMenueOffen(false)} aria-label="Schließen"><X size={18} /></button></div>
          <div className="of-schublade-nutzer"><span className="of-gesicht">{agent.avatar ? <img src={agent.avatar} alt="" /> : initialen}</span><div><b>{agent.name}</b><small>{PRAESENZ[praesenz][0]}</small></div></div>
          <nav className="of-schublade-liste"><Liste inSchublade /></nav>
          <div className="of-schublade-fuss"><button type="button" onClick={() => { setMenueOffen(false); window.dispatchEvent(new CustomEvent("fiaon-einfuehrung-starten")); }}><Compass size={17} /><span>Einführung</span></button><button type="button" onClick={logout}><LogOut size={17} /><span>Abmelden</span></button></div>
        </aside>
        <Einfuehrung rolle={rolle} />
      </div>
    </Ctx.Provider>
  );
}
