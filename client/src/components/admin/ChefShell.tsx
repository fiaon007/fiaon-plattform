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
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Gem,
  LayoutDashboard, Landmark, Users, Handshake, Send, GraduationCap, FileText,
  Settings, Lock, Menu, X, LogOut, Search, ChevronRight, ListChecks, CreditCard,
  Receipt, Banknote, Copy, Wallet, TrendingUp, CalendarClock, Target, Map,
  PiggyBank, ScrollText, UserPlus, BookOpen, Sparkles, Activity, History, Scale,
  MailCheck, MessageSquare,
  Wrench, Table2, Receipt as ReceiptIcon, LibraryBig, Eye, RotateCcw, Globe2, Bot,
} from "lucide-react";
import { seitenFuerRaum, chefPfad, type ChefSeite } from "./chef-seiten";
import { KiPauseBand } from "./ChefKiPause";
import { WaPauseBand } from "./ChefWaPause";
// E-336: die Suche im Kopf (⌘K / Strg+K) — Seiten, Räume, Kunden.
import { ChefSuche } from "./ChefSuche";
import "@/styles/chefbuero.css";
import "@/styles/chefbuero-seiten.css";
// 08.10.2026 (Justin): Glas-Design — eine Schicht über allen Raum-Stilen, aktiv über .cb-glas (chefbuero-glas.css).
import "@/styles/chefbuero-glas.css";
// E-345: Apple-Bühne (Milchglas, Systemschrift, Sperrbildschirm-Startseite) — nur aktiv mit .cb-apple.
import "@/styles/chefbuero-apple.css";
// 22.10.2026 (Justin: „es passt auf keiner Seite") — die Handy-Schicht zuletzt: Raster mit Untergrenze, 16 px Rand, Muster ≤ 640 px.
import "@/styles/chefbuero-handy.css";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";

/** Glaskarten mit Zeiger-Licht — dieselbe Liste wie die Glaskarten-Regel in chefbuero-glas.css. */
const GLAS_LICHT_KARTEN = [
  ".lm-kopf", ".lm-alarm", ".lm-zeile", ".lm-vorlage", ".cm-takt", ".mara-glas", ".pm-tafel", ".pv-meldung", ".cr-stapel",
  ".cr-segment", ".so-insel", ".so-schalter", ".tk-suche", ".tk-email", ".tk-nb-fall", ".tk-ki-wunsch", ".tk-ki-text",
  ".tk-mail-text", ".tk-mail-anhang", ".tk-mail-fertig", ".tk-rueckrufe", ".tk-deine", ".tk-akte", ".tk-blatt", ".tk-meldung",
  ".cz-hero", ".cz-block", ".cz-karte", ".cb-kachel", ".cb-hinweis", ".cl-karte", ".cl-klemmer", ".cl-verlauf", ".cl-team",
  ".cl-tab-huelle", ".cl-fehler", ".cw-werkzeug", ".cw-meldung", ".cw-tabelle-rahmen", ".cw-pruefung", ".ck-suche", ".cw-stapel",
  ".cbes-aergerkarte", ".cb-rang", ".cb-gratulation", ".kip-karte", ".sv-gruppe",
].join(", ");

/** E-342 Kurzmodus: welche Elemente als ERKLÄRUNG gelten (nicht als Inhalt) — und wo nie gekürzt wird. */
const KURZ_ZIELE = [
  "header p", "[class*='-kopf'] p", "[class*='-kopf'] > small", "label small", "[class*='-feld'] small", "[class*='-hinweis'] p",
  "p.text-slate-500", "p.text-slate-400", "p.text-gray-500", "p.text-muted-foreground", "p.text-xs", "p.text-sm.text-slate-600",
].join(", ");
const KURZ_NIE = "[data-volltext], [role='dialog'], table, textarea, pre, blockquote, [contenteditable='true'], .cb-hinweis, .cbk-schleier, .cge-hilfe";
const KURZ_AB_ZEICHEN = 150;

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
  /** E-336: Unter welcher Überschrift der Raum im Menü steht (CHEF_GRUPPEN). */
  gruppe: ChefGruppe;
  punkte: ChefPunkt[];
}

// ── DIE ORDNUNG DES MENÜS (E-336, 12.10.2026) ─────────────────────────────
// Justin: „Firmen-Radar ist unter Bereich Kunden im Menü zu finden (WTF,
//          sortiere das Menü mal richtig durch)."
// 15 Räume standen ohne Ordnung untereinander — „Kunden" neben „Alle Kunden",
// das Geld an drei Stellen, Mara unter „Kommunikation". Jetzt gehört jeder
// Raum zu genau einer Überschrift, und die Reihenfolge folgt dem Tag:
// Heute → Kunden → Vertrieb → Geld → Team → System. Die Adressen
// (/chef/<raum>, /chef/s/<seite>) bleiben unverändert — alte Links gehen weiter.
export type ChefGruppe = "heute" | "ki" | "kunden" | "global" | "vertrieb" | "geld" | "team" | "system";
export const CHEF_GRUPPEN: { key: ChefGruppe; label: string }[] = [
  { key: "heute", label: "Heute" },
  // E-409 (19.10.2026): Mara und Aras — Justin: „ein eigener Bereich (wie ein Labs) für ALLE KI-Mitarbeiter“.
  { key: "ki", label: "KI-Team" },
  { key: "kunden", label: "Kunden" },
  // E-338: Firmenkunden für sich — Justin: „so, dass sich das NICHT vermischt".
  { key: "global", label: "FIAON Global" },
  { key: "vertrieb", label: "Vertrieb" },
  { key: "geld", label: "Geld" },
  { key: "team", label: "Team" },
  { key: "system", label: "System" },
];

/** Die Räume des Chefbüros, in der Reihenfolge des Menüs. */
export const CHEF_RAEUME: ChefRaum[] = [
  // ── Heute ───────────────────────────────────────────────────────────────
  {
    key: "lage", label: "Lagezimmer", Icon: LayoutDashboard, mindest: "leitung", gruppe: "heute",
    satz: "Der Tag auf einen Blick.",
    punkte: [],
  },
  // ── DIE WERKSTATT (26.08.2026) ──────────────────────────────────────────
  // Kein Verzeichnis auf /admin-Seiten, sondern ein eigener Raum: Diese fünf
  // Werkzeuge waren als Endpunkte gebaut und hatten keine einzige Tür.
  {
    key: "werkzeuge", label: "Werkstatt", Icon: Wrench, mindest: "leitung", gruppe: "heute",
    satz: "Werkzeuge auf den echten Daten.",
    punkte: [],
  },
  // ── KI-Team (E-409, 19.10.2026) ─────────────────────────────────────────
  // Mara und Aras in einem Raum: Heute, Aras, Mara, Werkzeuge (Ampel), Qualität (Prüf-Mara), Einstellungen & Kasse.
  {
    key: "ki", label: "KI-Team", Icon: Bot, mindest: "leitung", gruppe: "ki",
    satz: "Mara und Aras — der Tag, die Schalter.",
    punkte: [],
  },
  // ── Kunden ──────────────────────────────────────────────────────────────
  {
    key: "kundenliste", label: "Alle Kunden", Icon: Table2, mindest: "leitung", gruppe: "kunden",
    satz: "Der ganze Bestand — eine Person, eine Zeile.",
    punkte: [],
  },
  {
    // E-336: hieß „Kunden" — direkt neben „Alle Kunden" war nicht zu erkennen, was der Unterschied ist.
    key: "kunden", label: "Betreuung", Icon: Users, mindest: "leitung", gruppe: "kunden",
    satz: "Die Arbeit am Kunden.",
    punkte: [],
  },
  // ── FIAON Global (E-338) ────────────────────────────────────────────────
  {
    key: "global", label: "Global-Mandate", Icon: Globe2, mindest: "leitung", gruppe: "global",
    satz: "Firmenkunden — Mandate, Angebote, Radar.",
    punkte: [],
  },
  // ── Vertrieb ────────────────────────────────────────────────────────────
  {
    // E-336: Alles, was NEUE Kunden bringt — vorher verteilt auf „Kunden" und „Kommunikation".
    key: "vertrieb", label: "Vertrieb", Icon: Target, mindest: "leitung", gruppe: "vertrieb",
    satz: "Neue Kunden gewinnen.",
    punkte: [],
  },
  // ── DIE RÜCKHOLUNG (02.09.2026, E-074) ──────────────────────────────────
  // 96.840 € offener Auftragswert in fünf Segmenten. Eigener Raum, weil hier
  // Geldstrecken GESCHALTET werden — das gehört nicht zwischen Leseseiten.
  {
    key: "rueckholung", label: "Rückholung", Icon: RotateCcw, mindest: "geschaeftsfuehrung", gruppe: "vertrieb",
    satz: "Offene Anträge zurückholen.",
    punkte: [],
  },
  {
    key: "kommunikation", label: "Kommunikation", Icon: Send, mindest: "leitung", gruppe: "vertrieb",
    satz: "Postfach, WhatsApp, Mails.",
    punkte: [],
  },
  // ── BESUCHER (27.08.2026) ───────────────────────────────────────────────
  // Microsoft Clarity: Wer war da, und — wichtiger — wo hat es geklemmt.
  // E-378 (15.10.2026): dazu die eigene Messung ohne Cookies — Herkunft, Kampagnen, Trichter bis zum Kauf.
  {
    key: "besucher", label: "Besucher", Icon: Eye, mindest: "leitung", gruppe: "vertrieb",
    satz: "Wer kommt — und was daraus wird.",
    punkte: [],
  },
  // ── Geld ────────────────────────────────────────────────────────────────
  {
    key: "geld", label: "Geld", Icon: Landmark, mindest: "geschaeftsfuehrung", gruppe: "geld",
    satz: "Alles Geld in einem Raum.",
    punkte: [],
  },
  {
    key: "zahlungen", label: "Zahlungszentrale", Icon: ReceiptIcon, mindest: "geschaeftsfuehrung", gruppe: "geld",
    satz: "Jeder Zahlungseingang, gegengeprüft.",
    punkte: [],
  },
  {
    // 27.08.2026, Justins Auftrag: „Schau dir an was wir verdient haben, was
    // wir monatlich verdienen (jedes Paket = 12-Monats-Abo, Umsatz ×12) und
    // baue eine Unternehmensbewertung ein." Die eine Wahrheit über das Geld —
    // ersetzt inhaltlich die Stripe-Rechnung des alten Admin-Dashboards.
    key: "wert", label: "Verdienst & Wert", Icon: Gem, mindest: "geschaeftsfuehrung", gruppe: "geld",
    satz: "Verdient, MRR und Unternehmenswert.",
    punkte: [],
  },
  // ── Team ────────────────────────────────────────────────────────────────
  {
    key: "team", label: "Team", Icon: Handshake, mindest: "leitung", gruppe: "team",
    satz: "Menschen, Verträge, Bewerbungen.",
    punkte: [],
  },
  {
    key: "academy", label: "Academy", Icon: GraduationCap, mindest: "leitung", gruppe: "team",
    satz: "Einschulung und Funktionen.",
    punkte: [],
  },
  {
    key: "redaktion", label: "Redaktion", Icon: FileText, mindest: "leitung", gruppe: "team",
    satz: "Ratgeber schreiben und veröffentlichen.",
    punkte: [],
  },
  // ── System ──────────────────────────────────────────────────────────────
  // ── DAS REGISTER ────────────────────────────────────────────────────────
  // Die Antwort auf „kann man hier eigentlich alles?". Jede Fähigkeit der
  // Plattform mit Namen, Klartext und Direktverweis.
  {
    key: "register", label: "Register", Icon: LibraryBig, mindest: "leitung", gruppe: "system",
    satz: "Jede Funktion, durchsuchbar.",
    punkte: [],
  },
  {
    key: "system", label: "System", Icon: Settings, mindest: "geschaeftsfuehrung", gruppe: "system",
    satz: "Einstellungen, Diagnose, Audit.",
    punkte: [],
  },
];

/** Darf diese Stufe den Raum betreten? */
export function raumErlaubt(raum: ChefRaum, stufe: ChefStufe): boolean {
  return RANG[stufe] >= RANG[raum.mindest];
}

/** E-342: die Seiten eines Raums, die diese Stufe öffnen darf — ohne reine Suchziele (Kundenakte). */
function raumSeitenFuer(raumKey: string, darf: (m?: ChefStufe) => boolean): ChefSeite[] {
  return seitenFuerRaum(raumKey).filter((s) => !s.ohneKachel && darf(s.mindest));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WEGELEISTE (E-342, 12.10.2026)
//
// Justin: „wie finde ich zu /chef/s/firmen-radar? … ich brauche für alles eine
//          Verlinkung, dass wirklich jede Seite auch genutzt wird — man muss so
//          ‚geführt werden'."
// Über jeder Seite stehen alle Seiten ihres Raums als Reiter (der Raum selbst
// zuerst), unter jeder Seite „Weiter: …" zur nächsten. Das Menü ist meist
// eingeklappt — die Leiste ist der Weg, der immer sichtbar ist.
// ═══════════════════════════════════════════════════════════════════════════
export function RaumWege({ raum, stufe, aktivSlug }: { raum: ChefRaum; stufe: ChefStufe; aktivSlug: string | null }) {
  const seiten = raumSeitenFuer(raum.key, (m) => !m || RANG[stufe] >= RANG[m]);
  if (!seiten.length) return null;
  return (
    <nav className="cb-wege" aria-label={`Seiten im Raum ${raum.label}`}>
      <Link href={`/chef/${raum.key}`} className={`cb-weg raum${aktivSlug ? "" : " an"}`} aria-current={aktivSlug ? undefined : "page"}>
        <raum.Icon size={14} strokeWidth={1.75} />{raum.label}
      </Link>
      {seiten.map((x) => (
        <Link key={x.slug} href={chefPfad(x)} className={`cb-weg${aktivSlug === x.slug ? " an" : ""}`} aria-current={aktivSlug === x.slug ? "page" : undefined}>
          {x.kurz ?? x.label}
        </Link>
      ))}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE APPLE-BÜHNE (E-345, 13.10.2026) — Vorschau
//
// Justin: „schau dir das Apple-Design an (Sperrbildschirm) — genau so will ich es vom Glaseffekt,
//          und finde ein besseres Hintergrundvideo, das im Loop läuft und transparent hinten liegt."
// Drei Bühnen (Higgsfield, Archiv 08_Medien_Higgsfield/2026-10-13_Chefbuero_Apple_Hintergrund):
// alpen · erde · glas. Wählbar über ?buehne=<name> (gemerkt im Browser), ?buehne=aus = bisheriges Kristall.
// Mit Bühne trägt die Hülle die Klasse .cb-apple (chefbuero-apple.css): Milchglas, Systemschrift, Startseite
// wie der Sperrbildschirm. Der Film pausiert im Hintergrund-Tab; ruhige Seiten und „Bewegung reduzieren“
// bekommen das Standbild (E-252: kein Dauerfilm unter dem Glas der Steuerpulte).
// ═══════════════════════════════════════════════════════════════════════════
export const CHEF_BUEHNEN = ["alpen", "erde", "glas"] as const;
export type ChefBuehne = typeof CHEF_BUEHNEN[number];
/** E-346 (13.10.2026): Justin hat gewählt — „Die Alpen gefallen mir am besten". Alpen ist die Bühne für alle. */
export const STANDARD_BUEHNE: ChefBuehne = "alpen";
function buehneWaehlen(): ChefBuehne | null {
  try {
    const q = new URLSearchParams(window.location.search).get("buehne");
    if (q === "aus") { window.localStorage.setItem("chef-buehne-2", "aus"); return null; }
    if (q && (CHEF_BUEHNEN as readonly string[]).includes(q)) { window.localStorage.setItem("chef-buehne-2", q); return q as ChefBuehne; }
    const m = window.localStorage.getItem("chef-buehne-2");
    if (m === "aus") return null;
    return m && (CHEF_BUEHNEN as readonly string[]).includes(m) ? (m as ChefBuehne) : STANDARD_BUEHNE;
  } catch { return STANDARD_BUEHNE; }
}

export function ChefShell({ stufe, name, titel, raumKey, onAbmelden, children, ruhigeHuelle = false, vollflaeche = false, stillerGrund = false, seiteSlug = null, volltext = false }: {
  stufe: ChefStufe; name: string | null; raumKey: string;
  /** E-342: die offene Seite (/chef/s/<slug>) — markiert ihren Unterpunkt im Menü. */
  seiteSlug?: string | null;
  /** E-342: Auf dieser Seite ist langer Text Inhalt (Chats, Mails) — der Kurzmodus kürzt nichts. */
  volltext?: boolean;
  onAbmelden: () => void; children: ReactNode;
  /** Anzeigetitel der Person (admin_titel) — ersetzt im Kopf den Stufennamen. */
  titel?: string | null;
  /**
   * E-252 (28.09.2026): Die offene Seite trägt `ruhig` (chef-seiten.tsx) —
   * Kopf und Raumleiste kleben nicht und sind matt (Klasse `cb-ruhig`,
   * chefbuero.css), und der Grund ist ein stehender Navy-Verlauf statt des
   * Films. Justin: „Der Grund hinter dem Glas ist statisch" — eine
   * Dauer-Animation unter backdrop-filter lässt den Lüfter laufen.
   * Alle anderen Seiten bleiben, wie sie sind.
   */
  ruhigeHuelle?: boolean;
  /** E-IT-H (08.10.2026): Die offene Seite füllt das Fenster (Klasse `cb-voll`, chefbuero.css) — heute nur /chef/s/whatsapp. */
  vollflaeche?: boolean;
  /**
   * Aras-Cockpit (20.10.2026, Justin: „UI VIEL übersichtlicher, cleaner“): Hinter dieser Seite liegt KEIN Bild (kein
   * Alpen-Foto, kein Film), nur ein ruhiger Navy-Verlauf (Klasse `cb-still`, Ende von chefbuero-apple.css) — Daten
   * vor einem großen Foto lesen sich schlecht. Gilt nur für Seiten mit `stillerGrund` (chef-seiten.tsx), heute /chef/s/aras.
   */
  stillerGrund?: boolean;
}) {
  const [menueOffen, setMenueOffen] = useState(false);
  useEffect(() => { setMenueOffen(false); }, [raumKey]);
  // E-345: die gewählte Bühne (Vorschau) — und der Film ruht, solange der Tab nicht sichtbar ist.
  const [buehne] = useState<ChefBuehne | null>(() => buehneWaehlen());
  useEffect(() => {
    if (!buehne) return;
    const umschalten = () => {
      const v = document.querySelector<HTMLVideoElement>(".cb-buehne video");
      if (!v) return;
      if (document.hidden) v.pause(); else void v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", umschalten);
    return () => document.removeEventListener("visibilitychange", umschalten);
  }, [buehne]);
  // ── ⌘K / Strg+K (E-336) ─────────────────────────────────────────────────
  // Öffnet die Suche von jeder Chefbüro-Seite aus; ein zweites ⌘K schließt sie.
  const [sucheOffen, setSucheOffen] = useState(false);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSucheOffen((v) => !v);
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  const istMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const darf = useCallback((mindest?: ChefStufe) => !mindest || RANG[stufe] >= RANG[mindest], [stufe]);
  // ── DAS MENÜ IST EINGEKLAPPT, WENN MAN DIE SEITE ÖFFNET (04.09.2026) ─────
  // Justin: „das Menü soll sich einklappen wenn man die Seite öffnet — mehr
  // Platz, cleaner." Schmal heißt: 60 Pixel, nur die Icons, Name als Tooltip.
  // Wer es aufklappt, behält das für seine Sitzung (localStorage); die Vorgabe
  // beim ersten Öffnen ist eingeklappt.
  const [schmal, setSchmal] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem("chef-menue-schmal"); return v === null ? true : v === "1"; }
    catch { return true; }
  });
  const schmalSetzen = (v: boolean) => {
    setSchmal(v);
    try { window.localStorage.setItem("chef-menue-schmal", v ? "1" : "0"); } catch { /* egal */ }
  };
  // E-346: Die Markierung des offenen Raums ist EINE Glaspille, die zum aktiven Punkt gleitet (Apple-Stil).
  const leisteRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const l = leisteRef.current;
    if (!l) return;
    const setzen = () => {
      const an = l.querySelector<HTMLElement>(".cb-unterpunkt.an") ?? l.querySelector<HTMLElement>(".cb-punkt.an");
      if (!an || an.offsetParent === null) { l.style.setProperty("--an-sicht", "0"); return; }
      const lr = l.getBoundingClientRect(), ar = an.getBoundingClientRect();
      l.style.setProperty("--an-top", `${Math.round(ar.top - lr.top + l.scrollTop)}px`);
      l.style.setProperty("--an-left", `${Math.round(ar.left - lr.left + l.scrollLeft)}px`);
      l.style.setProperty("--an-w", `${Math.round(ar.width)}px`);
      l.style.setProperty("--an-h", `${Math.round(ar.height)}px`);
      l.style.setProperty("--an-sicht", "1");
    };
    setzen();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(setzen) : null;
    ro?.observe(l);
    const t = window.setTimeout(setzen, 520); // nach dem Ein-/Ausklappen des Menüs
    return () => { ro?.disconnect(); window.clearTimeout(t); };
  }, [raumKey, seiteSlug, schmal]);
  // Wer Bewegung abgestellt hat, bekommt ein Standbild statt des Films.
  const ruhig = typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // 08.10.2026 Glas-Design: Ein leiser Lichtfleck folgt dem Zeiger über die Glaskarte darunter (--mx/--my, chefbuero-glas.css).
  // Nur mit Maus und nur, wenn Bewegung erlaubt ist; ein Hörer, höchstens einmal je Bild.
  useEffect(() => {
    if (ruhig || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let karte: HTMLElement | null = null;
    let ziel: Element | null = null;
    let bild = 0, x = 0, y = 0;
    const loesen = () => { karte?.style.removeProperty("--mx"); karte?.style.removeProperty("--my"); };
    const zeichnen = () => {
      bild = 0;
      const neu = (ziel?.closest?.(GLAS_LICHT_KARTEN) as HTMLElement | null) ?? null;
      if (karte !== neu) loesen();
      karte = neu;
      if (!karte) return;
      const r = karte.getBoundingClientRect();
      karte.style.setProperty("--mx", `${Math.round(x - r.left)}px`);
      karte.style.setProperty("--my", `${Math.round(y - r.top)}px`);
    };
    const bewegt = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY; ziel = e.target as Element;
      if (!bild) bild = requestAnimationFrame(zeichnen);
    };
    document.addEventListener("pointermove", bewegt, { passive: true });
    return () => { document.removeEventListener("pointermove", bewegt); if (bild) cancelAnimationFrame(bild); loesen(); };
  }, [ruhig]);
  // ── DER KURZMODUS (E-342, 12.10.2026) ────────────────────────────────────
  // Justin: „überall viel zu viel Text — mach das besser, auf jeder Seite, in jeder Ansicht."
  // Lange ERKLÄRUNGEN (Absätze unter Überschriften, Hinweise unter Feldern, leise Grautexte der alten
  // Admin-Seiten) zeigen zwei Zeilen; ein Klick klappt sie auf. Inhalt (Chats, Mails, Notizen, Tabellen,
  // Dialoge) bleibt ganz — Seiten mit `volltext` (chef-seiten.tsx) und [data-volltext] sind ausgenommen.
  useEffect(() => {
    if (volltext) return;
    const wurzel = document.querySelector(".cb-inhalt");
    if (!wurzel) return;
    const geprueft = new WeakSet<Element>();
    let takt = 0;
    const kuerzen = () => {
      takt = 0;
      wurzel.querySelectorAll(KURZ_ZIELE).forEach((el) => {
        if (geprueft.has(el)) return;
        geprueft.add(el);
        if (el.closest(KURZ_NIE)) return;
        if ((el.textContent || "").trim().length < KURZ_AB_ZEICHEN) return;
        const d = getComputedStyle(el).display;
        if (d !== "block" && d !== "inline" && d !== "inline-block") return;
        el.classList.add("cb-kurz");
        el.setAttribute("title", "Klicken: ganzer Text");
      });
    };
    const beobachter = new MutationObserver(() => { if (!takt) takt = window.setTimeout(kuerzen, 180); });
    beobachter.observe(wurzel, { childList: true, subtree: true });
    kuerzen();
    const klick = (e: Event) => {
      const t = e.target as Element | null;
      if (!t || t.closest("a, button, input, select, textarea, label input")) return;
      const k = t.closest(".cb-kurz");
      if (!k) return;
      k.classList.toggle("cb-kurz-auf");
      k.setAttribute("title", k.classList.contains("cb-kurz-auf") ? "Klicken: kürzer" : "Klicken: ganzer Text");
    };
    wurzel.addEventListener("click", klick);
    return () => {
      beobachter.disconnect(); wurzel.removeEventListener("click", klick); if (takt) clearTimeout(takt);
      wurzel.querySelectorAll(".cb-kurz").forEach((el) => { el.classList.remove("cb-kurz", "cb-kurz-auf"); el.removeAttribute("title"); });
    };
  }, [volltext, raumKey, seiteSlug]);
  // ── ROLLRAHMEN SIND SICHTBAR (22.10.2026, Chefbüro am Handy) ─────────────
  // Eine breite Tabelle rollt am Telefon in ihrem Rahmen — aber man sah nicht, DASS dort mehr steht: Die Spalten
  // „Stand“, „Zuständig“ … lagen unsichtbar rechts. Jeder Rahmen, der gerade seitlich rollen kann, trägt
  // data-rollt="rechts" | "links" | "beide"; chefbuero-handy.css blendet die Kante dort weich aus.
  useEffect(() => {
    const wurzel = document.querySelector(".cb-inhalt");
    if (!wurzel) return;
    const KANDIDATEN = "[class*='overflow-x-auto'], [class*='overflow-auto'], [class*='overflow-x-scroll'], .cm-tab-halter, .cl-tab-huelle, .cw-tabelle-rahmen, [data-rollrahmen]";
    const beobachtet = new WeakSet<Element>();
    const markieren = (el: HTMLElement) => {
      const ox = getComputedStyle(el).overflowX;
      const rollt = (ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2;
      if (!rollt) { if (el.hasAttribute("data-rollt")) el.removeAttribute("data-rollt"); return; }
      const links = el.scrollLeft > 2;
      const rechts = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      const wert = links && rechts ? "beide" : rechts ? "rechts" : links ? "links" : "";
      if (el.getAttribute("data-rollt") !== wert) el.setAttribute("data-rollt", wert);
      if (!beobachtet.has(el)) {
        beobachtet.add(el);
        let bild = 0;
        el.addEventListener("scroll", () => { if (!bild) bild = requestAnimationFrame(() => { bild = 0; markieren(el); }); }, { passive: true });
      }
    };
    let takt = 0;
    const pruefen = () => {
      takt = 0;
      const kandidaten = new Set<HTMLElement>(Array.from(wurzel.querySelectorAll<HTMLElement>(KANDIDATEN)));
      wurzel.querySelectorAll("table").forEach((t) => {
        if (t.parentElement) kandidaten.add(t.parentElement);
        if (t.parentElement?.parentElement) kandidaten.add(t.parentElement.parentElement);
      });
      kandidaten.forEach(markieren);
    };
    const spaeter = () => { if (!takt) takt = window.setTimeout(pruefen, 250); };
    const beobachter = new MutationObserver(spaeter);
    beobachter.observe(wurzel, { childList: true, subtree: true });
    window.addEventListener("resize", spaeter);
    pruefen();
    return () => { beobachter.disconnect(); window.removeEventListener("resize", spaeter); if (takt) clearTimeout(takt); };
  }, [raumKey, seiteSlug]);
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
    // E-342: Die Seiten des offenen Raums stehen darunter — im aufgeklappten Menü und in der Schublade.
    // Ein Raum, der allein unter seiner Überschrift steht (FIAON Global), zeigt sie immer.
    const unter = raumSeitenFuer(r.key, darf);
    const allein = CHEF_RAEUME.filter((x) => x.gruppe === r.gruppe).length === 1;
    const offen = unter.length > 0 && (inSchublade || !schmal) && (aktiv.key === r.key || allein);
    return (
      <>
        <Link href={`/chef/${r.key}`} className={`cb-punkt${aktiv.key === r.key && (!seiteSlug || !offen) ? " an" : ""}${aktiv.key === r.key ? " offen" : ""}`} title={r.label} onClick={() => inSchublade && setMenueOffen(false)}>
          <i><r.Icon size={18} strokeWidth={1.75} /></i>
          <span>{r.label}</span>
        </Link>
        {offen && (
          <div className="cb-unter">
            {unter.map((x, i) => (
              <Link key={x.slug} href={chefPfad(x)} className={`cb-unterpunkt${seiteSlug === x.slug ? " an" : ""}`} style={{ ["--i" as any]: i }} onClick={() => inSchublade && setMenueOffen(false)}>
                {x.kurz ?? x.label}
              </Link>
            ))}
          </div>
        )}
      </>
    );
  };
  // E-336: Das Menü steht in Gruppen (CHEF_GRUPPEN) — eingeklappt trennt eine feine Linie statt der Überschrift.
  const Liste = ({ inSchublade = false }: { inSchublade?: boolean }) => (
    <>
      {CHEF_GRUPPEN.map((g) => {
        const raeume = CHEF_RAEUME.filter((r) => r.gruppe === g.key);
        if (!raeume.length) return null;
        return (
          <div key={g.key} className="cb-leiste-gruppe" role="group" aria-label={g.label}>
            <div className="cb-leiste-titel">{g.label}</div>
            {raeume.map((r) => <Punkt key={r.key} r={r} inSchublade={inSchublade} />)}
          </div>
        );
      })}
    </>
  );

  return (
    <div className={`cb cb-glas${buehne ? ` cb-apple cb-buehne-${buehne}${raumKey === "lage" && !seiteSlug ? " cb-start" : ""}` : ""}${schmal ? " cb-schmal" : ""}${ruhigeHuelle ? " cb-ruhig" : ""}${vollflaeche ? " cb-voll" : ""}${stillerGrund ? " cb-still" : ""}`}>
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
        {/* E-345: Apple-Bühne — Film im Loop; ruhige Seiten und „Bewegung reduzieren“ sehen das Standbild. */}
        {stillerGrund ? null : buehne ? (
          (ruhigeHuelle || vollflaeche || ruhig)
            ? <img src={`/film/chef-${buehne}.jpg`} alt="" decoding="async" />
            : <video key={buehne} src={`/film/chef-${buehne}.mp4`} poster={`/film/chef-${buehne}.jpg`}
                     autoPlay muted loop playsInline preload="auto" />
        ) : /* E-252: Auf einer ruhigen Seite gibt es weder Film noch Standbild — der Navy-Verlauf kommt aus chefbuero.css. */
        ruhigeHuelle ? null : ruhig ? (
          <img src="/film/chef-buehne.jpg" alt="" decoding="async" />
        ) : (
          <video src="/film/chef-buehne.mp4" poster="/film/chef-buehne.jpg"
                 autoPlay muted loop playsInline preload="metadata" />
        )}
        <div className="cb-schleier" />
      </div>

      <header className="cb-kopf">
        <button type="button" className="cb-burger" aria-label="Räume öffnen" onClick={() => setMenueOffen(true)}><Menu size={20} /></button>
        <Link href="/chef" className="cb-wort"><FiaonWortmarke /></Link>
        <span className="cb-marke">Chefbüro</span>
        <div className="cb-kopf-titel">
          <b>{aktiv.label}</b>
          <small>{vorname ? `${gruss}, ${vorname}.` : `${gruss}.`}</small>
        </div>
        <div className="cb-kopf-rechts">
          <button type="button" className="cb-suche" onClick={() => setSucheOffen(true)}
                  title={`Seiten, Räume und Kunden suchen (${istMac ? "⌘K" : "Strg+K"})`} aria-keyshortcuts="Meta+K Control+K">
            <Search size={14} strokeWidth={1.75} />
            <span>Suchen …</span>
            <kbd>{istMac ? "⌘K" : "Strg K"}</kbd>
          </button>
          <button type="button" className="cb-rund cb-suche-rund" onClick={() => setSucheOffen(true)} aria-label="Suchen">
            <Search size={16} strokeWidth={1.75} />
          </button>
          <span className="cb-stufe" title={`Angemeldet als ${titel || STUFEN_NAME[stufe]} (Stufe ${STUFEN_NAME[stufe]})`}>
            <span className="punkt" />{titel || STUFEN_NAME[stufe]}
          </span>
          <button type="button" className="cb-rund" title="Abmelden" onClick={onAbmelden}><LogOut size={15} /></button>
        </div>
      </header>

      <div className="cb-grund">
        <aside className="cb-leiste" aria-label="Räume" ref={leisteRef}>
          <span className="cb-leiste-licht" aria-hidden="true" />
          <Liste />
          <button type="button" className="cb-klapp" onClick={() => schmalSetzen(!schmal)}
                  title={schmal ? "Menü ausklappen" : "Menü einklappen"} aria-expanded={!schmal}>
            <i><ChevronRight size={16} strokeWidth={2} style={{ transform: schmal ? "none" : "rotate(180deg)" }} /></i>
            <span>{schmal ? "Ausklappen" : "Einklappen"}</span>
          </button>
        </aside>
        <main className="cb-inhalt">
          {/* E-246: Die KI-Pause steht auf JEDER Chefbüro-Seite oben — nur solange sie gilt. */}
          <KiPauseBand inhaber={stufe === "inhaber"} />
          {/* E-261: Die WhatsApp-Pause ebenso (z. B. Meta kann nicht abbuchen, #131042) — nur solange sie gilt. */}
          <WaPauseBand inhaber={stufe === "inhaber"} />
          {/* E-346: Jeder Seitenwechsel blendet weich ein (Apple-Stil) — die Szene trägt die Adresse als Schlüssel. */}
          <div className="cb-szene" key={`${raumKey}/${seiteSlug ?? ""}`}>{children}</div>
        </main>
      </div>

      <div className={`cb-schublade-hintergrund${menueOffen ? " offen" : ""}`} onClick={() => setMenueOffen(false)} aria-hidden="true" />
      <aside className={`cb-schublade${menueOffen ? " offen" : ""}`} aria-label="Räume" aria-hidden={!menueOffen}>
        <div className="cb-schublade-kopf">
          <span className="cb-wort"><FiaonWortmarke /></span>
          <span className="cb-marke">Chefbüro</span>
          <button type="button" className="cb-rund" onClick={() => setMenueOffen(false)} aria-label="Schließen"><X size={18} /></button>
        </div>
        <nav className="cb-schublade-liste"><Liste inSchublade /></nav>
        <div className="cb-schublade-fuss">
          <button type="button" onClick={onAbmelden}><LogOut size={17} /><span>Abmelden</span></button>
        </div>
      </aside>

      <ChefSuche offen={sucheOffen} schliessen={() => setSucheOffen(false)} raeume={CHEF_RAEUME} darf={darf} />
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
export function ChefSeitenRahmen({ seite, raum, stufe, children }: {
  seite: { slug?: string; label: string; satz: string; raum: string; eigenesDesign?: boolean };
  raum: ChefRaum | undefined;
  stufe: ChefStufe;
  children: ReactNode;
}) {
  // ── WARUM HIER KEINE GROSSE ÜBERSCHRIFT STEHT ───────────────────────────
  // Der erste Entwurf setzte Name und Satz der Seite als Titel darüber. Im
  // Browser stand daraufhin „Kunden-Zentrale" zweimal untereinander: einmal
  // von mir, einmal von der Seite selbst. Fast jede übernommene Seite bringt
  // ihre eigene Überschrift mit — also bleibt hier nur der Weg zurück und
  // eine leise Zeile, die sagt, wo man ist.
  // E-342: Statt „zurück + Ort" die Wegeleiste des Raums; unten „Weiter" zur nächsten Seite des Raums.
  const geschwister = raum ? raumSeitenFuer(raum.key, (m) => !m || RANG[stufe] >= RANG[m]) : [];
  const i = geschwister.findIndex((x) => x.slug === seite.slug);
  const weiter = i >= 0 ? geschwister[i + 1] : undefined;
  return (
    <div className="cbs-huelle">
      <div className="cbs-kopf schlank">
        {raum && geschwister.length ? <RaumWege raum={raum} stufe={stufe} aktivSlug={seite.slug ?? null} /> : raum && (
          <Link href={`/chef/${raum.key}`} className="cbs-zurueck">
            <ChevronRight size={15} strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
            {raum.label}
          </Link>
        )}
      </div>
      {/* E-201: Seiten mit eigenem Chefbüro-Design laufen ohne die Hell→Dunkel-Übersetzung. */}
      <div className={seite.eigenesDesign ? "cbs-eigen" : "cbs"}>{children}</div>
      {raum && i >= 0 && (
        <nav className="cb-weiter" aria-label="Nächste Seite">
          {weiter ? (
            <Link href={chefPfad(weiter)} className="cb-weiter-link">
              <small>Weiter in {raum.label}</small>
              <b>{weiter.kurz ?? weiter.label}</b>
              <span>{weiter.satz}</span>
              <ChevronRight size={18} strokeWidth={1.75} />
            </Link>
          ) : (
            <Link href={`/chef/${raum.key}`} className="cb-weiter-link">
              <small>Alles gesehen</small>
              <b>Zurück zu {raum.label}</b>
              <span>{raum.satz}</span>
              <ChevronRight size={18} strokeWidth={1.75} />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
