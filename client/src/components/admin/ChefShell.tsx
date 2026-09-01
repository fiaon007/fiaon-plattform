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
  Gem,
  LayoutDashboard, Landmark, Users, Handshake, Send, GraduationCap, FileText,
  Settings, Lock, Menu, X, LogOut, Search, ChevronRight, ListChecks, CreditCard,
  Receipt, Banknote, Copy, Wallet, TrendingUp, CalendarClock, Target, Map,
  PiggyBank, ScrollText, UserPlus, BookOpen, Sparkles, Activity, History, Scale,
  MailCheck, MessageSquare,
  Wrench, Table2, Receipt as ReceiptIcon, LibraryBig, Eye, RotateCcw,
} from "lucide-react";
import { seitenFuerRaum, chefPfad } from "./chef-seiten";
import "@/styles/chefbuero.css";
import "@/styles/chefbuero-seiten.css";

export type ChefStufe = "inhaber" | "geschaeftsfuehrung" | "leitung";
const RANG: Record<ChefStufe, number> = { inhaber: 3, geschaeftsfuehrung: 2, leitung: 1 };
export const STUFEN_NAME: Record<ChefStufe, string> = {
  inhaber: "Inhaber",
  geschaeftsfuehrung: "Geschäftsführung",
  leitung: "Leitung",
};

// ── DIE KACHELN LIEGEN NICHT MEHR HIER (27.08.2026) ────────────────────────
// Bis heute trug jeder Raum seine eigene Kachelliste mit `/admin/...`-Zielen.
// Damit gab es ZWEI Wahrheiten darüber, welche Seite es gibt: diese Liste und
// die Routen in App.tsx. Jetzt kommt beides aus `chef-seiten.tsx` — eine
// Kachel ohne Seite kann so nicht mehr entstehen, und keine Kachel führt aus
// dem Chefbüro heraus.
//
// `punkte` bleibt als leeres Feld erhalten, damit ältere Aufrufer nicht
// brechen; gefüllt wird es nicht mehr.
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
    punkte: [],
  },
  // ── DIE WERKSTATT (26.08.2026) ──────────────────────────────────────────
  // Kein Verzeichnis auf /admin-Seiten, sondern ein eigener Raum: Diese fünf
  // Werkzeuge waren als Endpunkte gebaut und hatten keine einzige Tür.
  {
    key: "werkzeuge", label: "Werkstatt", Icon: Wrench, mindest: "leitung",
    satz: "Frag die Zahlen, Wahrheits-Check, Maschinenraum, Sprung, Freigaben, Posteingang.",
    punkte: [],
  },
  // ── DIE RÜCKHOLUNG (02.09.2026, E-074) ──────────────────────────────────
  // 96.840 € offener Auftragswert in fünf Segmenten. Eigener Raum, weil hier
  // Geldstrecken GESCHALTET werden — das gehört nicht zwischen Leseseiten.
  {
    key: "rueckholung", label: "Rückholung", Icon: RotateCcw, mindest: "geschaeftsfuehrung",
    satz: "Offene Anträge zurückholen — fünf Segmente, Zustellbarkeit, Schalter, Wirkung.",
    punkte: [],
  },
  {
    key: "kundenliste", label: "Alle Kunden", Icon: Table2, mindest: "leitung",
    satz: "Der gesamte Bestand — eine Person, eine Zeile, mit Filtern und Suche.",
    punkte: [],
  },
  {
    key: "zahlungen", label: "Zahlungszentrale", Icon: ReceiptIcon, mindest: "geschaeftsfuehrung",
    satz: "Jeder Zahlungseingang mit allen Angaben — gegengeprüft gegen das Lagezimmer.",
    punkte: [],
  },
  // ── DAS REGISTER ────────────────────────────────────────────────────────
  // Die Antwort auf „kann man hier eigentlich alles?". Jede Fähigkeit der
  // Plattform mit Namen, Klartext und Direktverweis — auch die, die bisher
  // nur als Adresse mit Fragezeichen existierten.
  // ── BESUCHER (27.08.2026) ───────────────────────────────────────────────
  // Microsoft Clarity: Wer war da, und — wichtiger — wo hat es geklemmt.
  {
    key: "besucher", label: "Besucher", Icon: Eye, mindest: "leitung",
    satz: "Wut-Klicks, tote Klicks, Scrolltiefe — wo Besucher nicht weiterkommen.",
    punkte: [],
  },
  {
    key: "register", label: "Register", Icon: LibraryBig, mindest: "leitung",
    satz: "Jede Funktion der Plattform, durchsuchbar — auch die ohne eigene Kachel.",
    punkte: [],
  },
  {
    key: "geld", label: "Geld", Icon: Landmark, mindest: "geschaeftsfuehrung",
    satz: "Zahlungen, Verbuchung, Auszahlungen, Abrechnungen — alles Geld in einem Raum.",
    punkte: [],
  },
  {
    // 27.08.2026, Justins Auftrag: „Schau dir an was wir verdient haben, was
    // wir monatlich verdienen (jedes Paket = 12-Monats-Abo, Umsatz ×12) und
    // baue eine Unternehmensbewertung ein." Die eine Wahrheit über das Geld —
    // ersetzt inhaltlich die Stripe-Rechnung des alten Admin-Dashboards.
    key: "wert", label: "Verdienst & Wert", Icon: Gem, mindest: "geschaeftsfuehrung",
    satz: "Verdient, monatlich (MRR), Vertragsbestand ×12 und der Unternehmenswert.",
    punkte: [],
  },
  {
    key: "kunden", label: "Kunden", Icon: Users, mindest: "leitung",
    satz: "Jede Person genau einmal — Kunden, Termine, Leads, Dubletten, Fahrplan.",
    punkte: [],
  },
  {
    key: "team", label: "Team", Icon: Handshake, mindest: "leitung",
    satz: "Alles zu einem Menschen an einem Ort — Kennzahlen, Verträge, Skripte, Feedback.",
    punkte: [],
  },
  {
    key: "kommunikation", label: "Kommunikation", Icon: Send, mindest: "leitung",
    satz: "Mail-Zentrale, E-Mail-Events, Funktionen-Registry und der Team-Space.",
    punkte: [],
  },
  {
    key: "academy", label: "Academy", Icon: GraduationCap, mindest: "leitung",
    satz: "Einschulung, Prüfungen, Zertifikate — die Ausbildung des Teams.",
    punkte: [],
  },
  {
    key: "redaktion", label: "Redaktion", Icon: FileText, mindest: "leitung",
    satz: "Ratgeber-Redaktion — Entwürfe, Vorschau, Prüfstand, Veröffentlichung.",
    punkte: [],
  },
  {
    key: "system", label: "System", Icon: Settings, mindest: "geschaeftsfuehrung",
    satz: "Einstellungen, Diagnose, Audit, Changelog, Rechtstexte.",
    punkte: [],
  },
];

/** Darf diese Stufe den Raum betreten? */
export function raumErlaubt(raum: ChefRaum, stufe: ChefStufe): boolean {
  return RANG[stufe] >= RANG[raum.mindest];
}

export function ChefShell({ stufe, name, titel, raumKey, onAbmelden, children }: {
  stufe: ChefStufe; name: string | null; raumKey: string;
  onAbmelden: () => void; children: ReactNode;
  /** Anzeigetitel der Person (admin_titel) — ersetzt im Kopf den Stufennamen. */
  titel?: string | null;
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
          <span className="cb-stufe" title={`Angemeldet als ${titel || STUFEN_NAME[stufe]} (Stufe ${STUFEN_NAME[stufe]})`}>
            <span className="punkt" />{titel || STUFEN_NAME[stufe]}
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
// ═══════════════════════════════════════════════════════════════════════════
// EIN RAUM (27.08.2026 neu gefasst)
//
// Justin: „JEDE Seite soll dort laufen, nicht aufs alte Admin Dashboard
//          verlinken!"
//
// Die Kacheln führten bisher nach `/admin/...` — wer im Chefbüro klickte,
// landete in der alten hellen Oberfläche. Jetzt führen sie nach
// `/chef/s/<slug>`, und dieselbe Seite läuft im Chefbüro, in dessen Sprache.
//
// Die Liste kommt aus `chef-seiten.tsx`, damit Kachel und Seite dieselbe
// Quelle haben. Eine Kachel, deren Ziel es nicht gibt, kann so nicht
// entstehen.
// ═══════════════════════════════════════════════════════════════════════════
export function ChefRaumSeite({ raum, stufe }: { raum: ChefRaum; stufe: ChefStufe }) {
  const seiten = seitenFuerRaum(raum.key)
    .filter((s) => !s.mindest || RANG[stufe] >= RANG[s.mindest]);
  return (
    <div>
      <div className="cb-raum-kopf">
        <span className="cb-pille">Chefbüro · {raum.label}</span>
        <h1><span className="cb-verlauf">{raum.label}</span></h1>
        <p>{raum.satz}</p>
      </div>
      <div className="cb-kacheln">
        {seiten.map((s, i) => (
          <Link key={s.slug} href={chefPfad(s)} className="cb-kachel"
                style={{ animationDelay: `${i * 45}ms` }}>
            <i><raum.Icon size={19} strokeWidth={1.75} /></i>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b>{s.label}</b>
              <small>{s.satz}</small>
            </span>
            <ChevronRight className="pfeil" size={16} strokeWidth={1.75} />
          </Link>
        ))}
      </div>
      {seiten.length === 0 && (
        <p className="cb-fehler">Für diesen Raum ist noch keine Seite hinterlegt.</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE SEITE IM CHEFBÜRO
//
// Der Rahmen um eine übernommene Admin-Seite: Kopfzeile mit Raum und Namen,
// ein Weg zurück, und die Klasse `cbs`, an der die dunkle Schicht hängt
// (chefbuero-seiten.css). Ohne diese Klasse wäre die Seite weiß auf schwarz —
// mit ihr sieht sie aus, als wäre sie für das Chefbüro gebaut worden.
// ═══════════════════════════════════════════════════════════════════════════
export function ChefSeitenRahmen({ seite, raum, children }: {
  seite: { label: string; satz: string; raum: string };
  raum: ChefRaum | undefined;
  children: ReactNode;
}) {
  // ── WARUM HIER KEINE GROSSE ÜBERSCHRIFT STEHT ───────────────────────────
  // Der erste Entwurf setzte Name und Satz der Seite als Titel darüber. Im
  // Browser stand daraufhin „Kunden-Zentrale" zweimal untereinander: einmal
  // von mir, einmal von der Seite selbst. Fast jede übernommene Seite bringt
  // ihre eigene Überschrift mit — also bleibt hier nur der Weg zurück und
  // eine leise Zeile, die sagt, wo man ist.
  return (
    <div className="cbs-huelle">
      <div className="cbs-kopf schlank">
        {raum && (
          <Link href={`/chef/${raum.key}`} className="cbs-zurueck">
            <ChevronRight size={15} strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
            {raum.label}
          </Link>
        )}
        <span className="cbs-ort">Chefbüro · {raum?.label ?? "Seite"} · {seite.label}</span>
      </div>
      <div className="cbs">{children}</div>
    </div>
  );
}
