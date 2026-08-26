// ═══════════════════════════════════════════════════════════════════════════
// ChefShell — die dunkle AdminShell des Chefbüros (24.08.2026)
// Bezug: CHEFBUERO_PLAN_2026-08-24.md §2.3 (E-053), Scheibe 2 — Parallelbetrieb.
//
// Das Chefbüro ist das Spiegelbild des Office in Chef-Perspektive: dieselbe
// Formensprache (dunkles Glas, Inter, Blau, Bühne), aber EIGENE Klassen (.cb-,
// chefbuero.css) und EIGENE Routen /chef und /chef/<raum>. Die bestehende
// helle AdminShell bleibt unangetastet; jeder der 8 Räume zeigt ZUNÄCHST eine
// Glas-Kachelliste seiner Unterpunkte und verlinkt auf die BESTEHENDEN
// /admin/*-Seiten — nichts wird nachgebaut. Bühnenbild vorerst
// /office/schreibtisch.jpg als Platzhalter; eigene Szenen (Tresor, Kundenhalle,
// Teamdeck, Funkraum, Hörsaal, Redaktion, Maschinenraum) kommen später.
//
// Rechte (Plan §2.2): 'leitung' sieht die Räume Geld und System ausgegraut
// mit Schloss — die UI blendet aus, der Server erzwingt (spätere Scheibe).
// Justin wird geduzt, wie Mitarbeiter untereinander.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, Landmark, Users, Handshake, Send, GraduationCap, FileText,
  Settings, Lock, Menu, X, LogOut, Search, ChevronRight, ListChecks, CreditCard,
  Receipt, Banknote, Copy, Wallet, TrendingUp, CalendarClock, Target, Map,
  PiggyBank, ScrollText, UserPlus, BookOpen, Sparkles, Activity, History, Scale,
  MailCheck, MessageSquare,
} from "lucide-react";
import "@/styles/chefbuero.css";

export type ChefStufe = "inhaber" | "geschaeftsfuehrung" | "leitung";
const RANG: Record<ChefStufe, number> = { inhaber: 3, geschaeftsfuehrung: 2, leitung: 1 };
export const STUFEN_NAME: Record<ChefStufe, string> = {
  inhaber: "Inhaber",
  geschaeftsfuehrung: "Geschäftsführung",
  leitung: "Leitung",
};

export interface ChefPunkt { href: string; label: string; desc: string; Icon: any }
export interface ChefRaum {
  key: string; label: string; Icon: any; satz: string;
  /** Mindeststufe, um den Raum zu betreten (Plan §2.2: leitung sieht kein Geld/System). */
  mindest: ChefStufe;
  punkte: ChefPunkt[];
}

/** Die 8 Räume (Plan §2.3). Jeder Unterpunkt = bestehende /admin-Seite. */
export const CHEF_RAEUME: ChefRaum[] = [
  {
    key: "lage", label: "Lagezimmer", Icon: LayoutDashboard, mindest: "leitung",
    satz: "Der Tag auf einen Blick — Aufgaben, Warnungen, deine Liste.",
    punkte: [
      { href: "/admin/dashboard", label: "Dashboard", desc: "Was ist zu tun? Aufgaben, Warnungen, Suche, Tageszahlen", Icon: LayoutDashboard },
      { href: "/admin/todo", label: "Meine Liste", desc: "Was nur du tun kannst — Make, Brevo, Konten, Entscheidungen", Icon: ListChecks },
      { href: "/admin/aufgaben", label: "Notizen & Aufgaben", desc: "An Personen festgehalten oder ans Team vergeben — mit Frist und Sichtbarkeit", Icon: ListChecks },
    ],
  },
  {
    key: "geld", label: "Geld", Icon: Landmark, mindest: "geschaeftsfuehrung",
    satz: "Zahlungen, Verbuchung, Auszahlungen, Abrechnungen — alles Geld in einem Raum.",
    punkte: [
      { href: "/admin/zahlungen", label: "Zahlungszentrale", desc: "Offene Zahlungen prüfen, freischalten, Timeline", Icon: CreditCard },
      { href: "/admin/verbuchung", label: "Zahlungen verbuchen", desc: "Vier Fälle, vier Reiter — mit Vorschau vor dem Klick", Icon: Receipt },
      { href: "/admin/kontoabgleich", label: "Kontoabgleich", desc: "Bank-Eingänge exakt mit Kunden abgleichen und verbuchen", Icon: Landmark },
      { href: "/admin/auszahlungen", label: "Auszahlungen", desc: "Provisions-Anforderungen der Mitarbeiter freigeben", Icon: Banknote },
      { href: "/admin/abrechnungen", label: "Abrechnungen", desc: "Provisionsabrechnungen einsehen, als PDF ansehen, versenden", Icon: FileText },
      { href: "/admin/verbuchungen", label: "Verbuchungen", desc: "Bestätigte Zahlungen: Umsatz, Provisionen, Netto", Icon: Wallet },
      { href: "/admin/buchhaltung", label: "Buchhaltung", desc: "Buchungsjournal und Ausbuchung (Ledger)", Icon: Landmark },
      { href: "/admin/rechnungen", label: "Rechnungen", desc: "Alle erzeugten Rechnungen durchsuchen und laden", Icon: FileText },
      { href: "/admin/finanzen", label: "Finanzen & Sales", desc: "Funnel, Umsatz, Marge, CAC, Kampagnen-Attribution", Icon: TrendingUp },
      { href: "/admin/investoren", label: "Investoren", desc: "Anfragen, Investments, Dokumente", Icon: PiggyBank },
    ],
  },
  {
    key: "kunden", label: "Kunden", Icon: Users, mindest: "leitung",
    satz: "Jede Person genau einmal — Kunden, Termine, Leads, Dubletten, Fahrplan.",
    punkte: [
      { href: "/admin/kunden", label: "Kunden-Zentrale", desc: "Leads, Kunden, Anträge, KYC, Kündigungen — Filter teilbar, Massenaktionen inbegriffen", Icon: Users },
      { href: "/admin/termine", label: "Termin-Zentrale", desc: "Alle Termine aller Mitarbeiter — und die bezahlten Kunden ohne Termin", Icon: CalendarClock },
      { href: "/admin/lead-automatik", label: "Lead-Automatik", desc: "Nachfass-Maschine: Sendefenster, Bulk-Versand, Verteilung, Import", Icon: Target },
      { href: "/admin/dubletten", label: "Dubletten", desc: "Mehrfach angelegte Personen erkennen und zusammenführen (umkehrbar)", Icon: Copy },
      { href: "/admin/fahrplan", label: "Fahrplan / Kundenprodukt", desc: "Upload-Review, KI-Analyse freigeben, Ziel-Freischaltung, Audit", Icon: Map },
    ],
  },
  {
    key: "team", label: "Team", Icon: Handshake, mindest: "leitung",
    satz: "Alles zu einem Menschen an einem Ort — Kennzahlen, Verträge, Skripte, Feedback.",
    punkte: [
      { href: "/admin/team", label: "Team-Zentrale", desc: "Kennzahlen, Provisionen, Nachbuchung, Protokolle und Nachrichten", Icon: Users },
      { href: "/admin/vertraege", label: "Onboarding & Verträge", desc: "Zustimmungs-/Vertragsstatus, Vorlagen, Vertragsvariablen, Nachweise", Icon: ScrollText },
      { href: "/admin/team?einladen=1", label: "Teammitglied anlegen", desc: "Neuen Mitarbeiter per E-Mail einladen", Icon: UserPlus },
      { href: "/admin/team#skripte", label: "Skripte & Leitfäden", desc: "Gesprächsvorlagen verwalten", Icon: BookOpen },
      { href: "/admin/agent-portal", label: "Team-Updates & Feedback", desc: "Portal-Updates posten, Feedback prüfen und belohnen", Icon: Sparkles },
    ],
  },
  {
    key: "kommunikation", label: "Kommunikation", Icon: Send, mindest: "leitung",
    satz: "Mail-Zentrale, E-Mail-Events, Funktionen-Registry und der Team-Space.",
    punkte: [
      { href: "/admin/mail-zentrale", label: "Mail-Zentrale", desc: "Freitext an Kunden und Gruppen — Bausteine, Vorschau, KI-Hilfe", Icon: Send },
      { href: "/admin/events", label: "E-Mail-Events", desc: "Make-Events testen, Diagnose, Verlauf — der Make-Status gehört hierher", Icon: MailCheck },
      { href: "/admin/funktionen", label: "Funktionen & Schulung", desc: "Alle Funktionen mit Klartext + Direktlink, Selbsttest, Schulungsmodus", Icon: GraduationCap },
      { href: "/admin/space", label: "Space", desc: "Der Feed des Teams — mitlesen, reagieren, anpinnen, moderieren", Icon: MessageSquare },
    ],
  },
  {
    key: "academy", label: "Academy", Icon: GraduationCap, mindest: "leitung",
    satz: "Einschulung, Prüfungen, Zertifikate — die Ausbildung des Teams.",
    punkte: [
      { href: "/admin/schulung", label: "FIAON Academy", desc: "Einschulung als Kapitel-Reise je Abteilung — mit Präsentationsmodus", Icon: GraduationCap },
    ],
  },
  {
    key: "redaktion", label: "Redaktion", Icon: FileText, mindest: "leitung",
    satz: "Ratgeber-Redaktion — Entwürfe, Vorschau, Prüfstand, Veröffentlichung.",
    punkte: [
      { href: "/admin/ratgeber", label: "Ratgeber-Redaktion", desc: "Entwürfe lesen, Vorschau, Prüfstand, veröffentlichen — täglich drei aus dem Themenplan", Icon: FileText },
    ],
  },
  {
    key: "system", label: "System", Icon: Settings, mindest: "geschaeftsfuehrung",
    satz: "Einstellungen, Diagnose, Audit, Changelog, Rechtstexte.",
    punkte: [
      { href: "/admin/einstellungen", label: "Einstellungen", desc: "Provisionssatz, Auszahlung, Reminder-Engine, Diagnose", Icon: Settings },
      { href: "/admin/diagnose", label: "System-Diagnose", desc: "Was klemmt gerade? Ereignis-Konsole, Rohdaten, KI-Auswertung", Icon: Activity },
      { href: "/admin/audit", label: "Audit-Log", desc: "Alle Mitarbeiter-Aktionen durchsuchbar — künftig auch das Admin-Log", Icon: ScrollText },
      { href: "/admin/changelog", label: "Was ist neu?", desc: "Alle Änderungen am System in Klartext", Icon: History },
      { href: "/admin/recht", label: "Rechtstexte-Status", desc: "LEGAL-Review-Stand (read-only)", Icon: Scale },
    ],
  },
];

/** Darf diese Stufe den Raum betreten? */
export function raumErlaubt(raum: ChefRaum, stufe: ChefStufe): boolean {
  return RANG[stufe] >= RANG[raum.mindest];
}

export function ChefShell({ stufe, name, raumKey, onAbmelden, children }: {
  stufe: ChefStufe; name: string | null; raumKey: string;
  onAbmelden: () => void; children: ReactNode;
}) {
  const [menueOffen, setMenueOffen] = useState(false);
  useEffect(() => { setMenueOffen(false); }, [raumKey]);
  // Wer Bewegung abgestellt hat, bekommt ein Standbild statt des Films.
  const ruhig = typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const vorname = String(name || "").split(" ")[0];
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";
  const aktiv = CHEF_RAEUME.find((r) => r.key === raumKey) ?? CHEF_RAEUME[0];

  const Punkt = ({ r, inSchublade = false }: { r: ChefRaum; inSchublade?: boolean }) => {
    const erlaubt = raumErlaubt(r, stufe);
    if (!erlaubt) {
      return (
        <div className="cb-punkt gesperrt" title={`${r.label} — nur ab Stufe ${STUFEN_NAME[r.mindest]}`} aria-disabled="true">
          <i><r.Icon size={18} strokeWidth={1.75} /></i>
          <span>{r.label}</span>
          <em className="schloss"><Lock size={14} strokeWidth={1.75} /></em>
        </div>
      );
    }
    return (
      <Link href={`/chef/${r.key}`} className={`cb-punkt${aktiv.key === r.key ? " an" : ""}`} title={r.label} onClick={() => inSchublade && setMenueOffen(false)}>
        <i><r.Icon size={18} strokeWidth={1.75} /></i>
        <span>{r.label}</span>
      </Link>
    );
  };
  const Liste = ({ inSchublade = false }: { inSchublade?: boolean }) => (
    <>
      <div className="cb-leiste-titel">Räume</div>
      {CHEF_RAEUME.map((r) => <Punkt key={r.key} r={r} inSchublade={inSchublade} />)}
    </>
  );

  return (
    <div className="cb">
      {/* ══════════════════════════════════════════════════════════════════
          DIE BÜHNE (26.08.2026)
          Eigener Film statt des Schreibtisch-Platzhalters: ein dunkler Raum
          mit einem weichen blauen Schein, kaum merklicher Bewegung. 152 KB —
          leicht genug für jeden Seitenaufruf.

          `poster` zeigt sofort ein Standbild, während der Film lädt; wer
          Bewegung abgestellt hat (prefers-reduced-motion), sieht NUR das
          Standbild. Ein Hintergrund darf niemandem schaden.
          ══════════════════════════════════════════════════════════════════ */}
      <div className="cb-buehne" aria-hidden="true">
        {ruhig ? (
          <img src="/film/chef-buehne.jpg" alt="" decoding="async" />
        ) : (
          <video src="/film/chef-buehne.mp4" poster="/film/chef-buehne.jpg"
                 autoPlay muted loop playsInline preload="metadata" />
        )}
        <div className="cb-schleier" />
      </div>

      <header className="cb-kopf">
        <button type="button" className="cb-burger" aria-label="Räume öffnen" onClick={() => setMenueOffen(true)}><Menu size={20} /></button>
        <Link href="/chef" className="cb-wort">FIAON</Link>
        <span className="cb-marke">Chefbüro</span>
        <div className="cb-kopf-titel">
          <b>{aktiv.label}</b>
          <small>{vorname ? `${gruss}, ${vorname}.` : `${gruss}.`}</small>
        </div>
        <div className="cb-kopf-rechts">
          <div className="cb-suche" title="Suche — ⌘K kommt in einer späteren Scheibe">
            <Search size={14} strokeWidth={1.75} />
            <span>Suchen …</span>
            <kbd>⌘K</kbd>
          </div>
          <span className="cb-stufe" title={`Angemeldet als ${STUFEN_NAME[stufe]}`}>
            <span className="punkt" />{STUFEN_NAME[stufe]}
          </span>
          <button type="button" className="cb-rund" title="Abmelden" onClick={onAbmelden}><LogOut size={15} /></button>
        </div>
      </header>

      <div className="cb-grund">
        <aside className="cb-leiste" aria-label="Räume"><Liste /></aside>
        <main className="cb-inhalt">{children}</main>
      </div>

      <div className={`cb-schublade-hintergrund${menueOffen ? " offen" : ""}`} onClick={() => setMenueOffen(false)} aria-hidden="true" />
      <aside className={`cb-schublade${menueOffen ? " offen" : ""}`} aria-label="Räume" aria-hidden={!menueOffen}>
        <div className="cb-schublade-kopf">
          <span className="cb-wort">FIAON</span>
          <span className="cb-marke">Chefbüro</span>
          <button type="button" className="cb-rund" onClick={() => setMenueOffen(false)} aria-label="Schließen"><X size={18} /></button>
        </div>
        <nav className="cb-schublade-liste"><Liste inSchublade /></nav>
        <div className="cb-schublade-fuss">
          <button type="button" onClick={onAbmelden}><LogOut size={17} /><span>Abmelden</span></button>
        </div>
      </aside>
    </div>
  );
}

/** Glas-Kachelliste eines Raums — verlinkt auf die BESTEHENDEN /admin-Seiten. */
export function ChefRaumSeite({ raum }: { raum: ChefRaum }) {
  return (
    <div>
      <div className="cb-raum-kopf">
        <span className="cb-pille">Chefbüro · {raum.label}</span>
        <h1><span className="cb-verlauf">{raum.label}</span></h1>
        <p>{raum.satz}</p>
      </div>
      <div className="cb-kacheln">
        {raum.punkte.map((p) => (
          <a key={p.href} href={p.href} className="cb-kachel">
            <i><p.Icon size={19} strokeWidth={1.75} /></i>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b>{p.label}</b>
              <small>{p.desc}</small>
            </span>
            <ChevronRight className="pfeil" size={16} strokeWidth={1.75} />
          </a>
        ))}
      </div>
    </div>
  );
}
