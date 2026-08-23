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
import { LayoutDashboard, BookUser, Users, Phone, Megaphone, Wallet, Calculator, GraduationCap, ListChecks, Mail, Calendar, Inbox, Landmark, MoreHorizontal, Clock, LogOut, ChevronLeft, ChevronRight, X, Menu } from "lucide-react";
import "@/styles/office.css";

export interface Raum { href: string; label: string; Icon: any; match: string[]; szene: string; gruppe: "arbeit" | "team" | "ich" | "mehr"; nurRolle?: string; nichtRolle?: string[]; badge?: string }

/** Die Räume des Büros. Reihenfolge = Leiste. Szene = Higgsfield-Bühne (client/public/office/). */
export const RAEUME: Raum[] = [
  { href: "/agent/start", label: "Schreibtisch", Icon: LayoutDashboard, match: ["/agent/start", "/agent/heute", "/agent"], szene: "schreibtisch", gruppe: "arbeit" },
  { href: "/agent/kunden", label: "Kundenbuch", Icon: BookUser, match: ["/agent/kunden"], szene: "kundenbuch", gruppe: "arbeit", badge: "/agent/kunden" },
  { href: "/agent/kalender", label: "Termine", Icon: Calendar, match: ["/agent/kalender", "/agent/startgespraeche"], szene: "schreibtisch", gruppe: "arbeit" },
  { href: "/agent/aufgaben", label: "Aufgaben", Icon: ListChecks, match: ["/agent/aufgaben"], szene: "schreibtisch", gruppe: "arbeit", badge: "/agent/aufgaben" },
  { href: "/agent/mail-zentrale", label: "Post", Icon: Mail, match: ["/agent/mail-zentrale"], szene: "schreibtisch", gruppe: "arbeit", badge: "/agent/mail-zentrale" },
  { href: "/agent/anliegen", label: "Anliegen", Icon: Inbox, match: ["/agent/anliegen"], szene: "schreibtisch", gruppe: "arbeit", badge: "/agent/anliegen" },
  { href: "/agent/inkasso", label: "Forderungen", Icon: Landmark, match: ["/agent/inkasso"], szene: "kasse", gruppe: "arbeit", badge: "/agent/inkasso" },
  { href: "/agent/flur", label: "Flur", Icon: Users, match: ["/agent/flur", "/agent/space"], szene: "flur", gruppe: "team", badge: "/agent/space" },
  { href: "/agent/updates", label: "Schwarzes Brett", Icon: Megaphone, match: ["/agent/updates", "/agent/feedback"], szene: "flur", gruppe: "team", badge: "/agent/updates" },
  { href: "/agent/academy", label: "Akademie", Icon: GraduationCap, match: ["/agent/academy", "/agent/schulung", "/agent/skripte"], szene: "akademie", gruppe: "team" },
  { href: "/agent/verdienst", label: "Kasse", Icon: Wallet, match: ["/agent/verdienst", "/agent/auszahlung", "/agent/partner-programm", "/agent/leistung"], szene: "kasse", gruppe: "ich" },
  { href: "/agent/gehalt", label: "Gehaltsrechner", Icon: Calculator, match: ["/agent/gehalt"], szene: "kasse", gruppe: "ich" },
  { href: "/agent/arbeitszeiten", label: "Arbeitszeiten", Icon: Clock, match: ["/agent/arbeitszeiten"], szene: "schreibtisch", gruppe: "ich" },
  { href: "/agent/vertrieb", label: "Leitung", Icon: LayoutDashboard, match: ["/agent/vertrieb"], szene: "flur", gruppe: "mehr", nurRolle: "vertriebsleiter" },
  { href: "/agent/mehr", label: "Mehr", Icon: MoreHorizontal, match: ["/agent/mehr", "/agent/profil", "/agent/dokumente", "/agent/passwort"], szene: "schreibtisch", gruppe: "mehr" },
];
const GRUPPEN: Record<Raum["gruppe"], string> = { arbeit: "Arbeit", team: "Team", ich: "Ich", mehr: "" };

interface OfficeCtx { dunkel: (an: boolean) => void; titel: (t: string | null) => void; praesenz: Praesenz; setPraesenz: (p: Praesenz) => void }
type Praesenz = "da" | "pause" | "telefon" | "weg";
const Ctx = createContext<OfficeCtx>({ dunkel: () => {}, titel: () => {}, praesenz: "da", setPraesenz: () => {} });
export const useOffice = () => useContext(Ctx);

export function OfficeShell({ children, agent, rolle, zaehler, onRefresh, logout, banner }: {
  children: ReactNode; agent: { name: string; avatar?: string | null; email?: string; rolle?: string }; rolle: string;
  zaehler: Record<string, number>; onRefresh?: () => void; logout: (e: React.MouseEvent) => void; banner?: ReactNode;
}) {
  const [location] = useLocation();
  const [dunkel, setDunkel] = useState(false);
  const [titel, setTitel] = useState<string | null>(null);
  const [eingeklappt, setEingeklappt] = useState(() => { try { return localStorage.getItem("fiaon_office_leiste") === "zu"; } catch { return false; } });
  const [menueOffen, setMenueOffen] = useState(false);
  const [praesenz, setPraesenz] = useState<Praesenz>(() => { try { return (sessionStorage.getItem("fiaon_praesenz") as Praesenz) || "da"; } catch { return "da"; } });
  useEffect(() => { try { localStorage.setItem("fiaon_office_leiste", eingeklappt ? "zu" : "auf"); } catch { /* egal */ } }, [eingeklappt]);
  useEffect(() => { try { sessionStorage.setItem("fiaon_praesenz", praesenz); } catch { /* egal */ } fetch("/api/fiaon/agent/praesenz", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: praesenz }) }).catch(() => {}); const i = setInterval(() => fetch("/api/fiaon/agent/praesenz", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: praesenz }) }).catch(() => {}), 10 * 60_000); return () => clearInterval(i); }, [praesenz]);
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
  const PRAESENZ: Record<Praesenz, [string, string]> = { da: ["Da", "#34d399"], telefon: ["Telefoniere", "#60a5fa"], pause: ["Pause", "#fbbf24"], weg: ["Weg", "#94a3b8"] };

  return (
    <Ctx.Provider value={ctx}>
      <div className={`of szene-${szene}${dunkel ? " dunkel" : ""}${eingeklappt ? " zu" : ""}`}>
        <div className="of-buehne" aria-hidden="true"><img src={`/office/${szene}.jpg`} alt="" decoding="async" /><div className="of-schleier" /></div>
        {banner}
        <header className="of-kopf">
          <button type="button" className="of-burger" aria-label="Räume öffnen" onClick={() => setMenueOffen(true)}><Menu size={20} /></button>
          <Link href="/agent/start" className="of-wort">FIAON</Link><span className="of-marke">Office</span>
          <div className="of-kopf-titel"><b>{titel ?? aktiv?.label ?? "Office"}</b><small>{gruss}, {vorname}.</small></div>
          <div className="of-kopf-rechts">
            <div className="of-praesenz" title="Präsenz">
              <span className="punkt" style={{ background: PRAESENZ[praesenz][1] }} />
              <select value={praesenz} onChange={(e) => setPraesenz(e.target.value as Praesenz)} aria-label="Präsenz">{(Object.keys(PRAESENZ) as Praesenz[]).map((k) => <option key={k} value={k}>{PRAESENZ[k][0]}</option>)}</select>
            </div>
            {onRefresh && <button type="button" className="of-rund" title="Aktualisieren" onClick={onRefresh}>↻</button>}
            <Link href="/agent/profil" className="of-gesicht" title={agent.name}>{agent.avatar ? <img src={agent.avatar} alt="" /> : initialen}</Link>
            <button type="button" className="of-rund" title="Abmelden" onClick={logout}><LogOut size={15} /></button>
          </div>
        </header>

        <div className="of-grund">
          <aside className="of-leiste" aria-label="Räume">
            <button type="button" className="of-klapp" onClick={() => setEingeklappt(!eingeklappt)} title={eingeklappt ? "Leiste ausklappen" : "Leiste einklappen"}>{eingeklappt ? <ChevronRight size={18} /> : <><ChevronLeft size={16} /><span>Einklappen</span></>}</button>
            <Liste />
          </aside>
          <main className={`of-inhalt${dunkel ? " dunkel" : ""}`}>{dunkel ? children : <div className="of-flaeche">{children}</div>}</main>
        </div>

        <div className={`of-schublade-hintergrund${menueOffen ? " offen" : ""}`} onClick={() => setMenueOffen(false)} aria-hidden="true" />
        <aside className={`of-schublade${menueOffen ? " offen" : ""}`} aria-label="Räume" aria-hidden={!menueOffen}>
          <div className="of-schublade-kopf"><span className="of-wort">FIAON</span><span className="of-marke">Office</span><button type="button" className="of-rund" onClick={() => setMenueOffen(false)} aria-label="Schließen"><X size={18} /></button></div>
          <div className="of-schublade-nutzer"><span className="of-gesicht">{agent.avatar ? <img src={agent.avatar} alt="" /> : initialen}</span><div><b>{agent.name}</b><small>{PRAESENZ[praesenz][0]}</small></div></div>
          <nav className="of-schublade-liste"><Liste inSchublade /></nav>
          <div className="of-schublade-fuss"><button type="button" onClick={logout}><LogOut size={17} /><span>Abmelden</span></button></div>
        </aside>
      </div>
    </Ctx.Provider>
  );
}
