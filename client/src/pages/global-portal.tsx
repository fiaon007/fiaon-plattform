// ═══════════════════════════════════════════════════════════════════════════
// DAS GLOBAL-PORTAL — „Mein Auftrag" für Firmenkunden, neu (E-338, 12.10.2026)
//
// Justin: „Die Firmenkunden brauchen ein PERFEKTES Dashboard … für ihre
//          Verträge, Status zur LLC, Infomaterial, Vollmachten, Unterlagen,
//          Anfragen, einfach ALLES … der beste und hochwertigste Zugang der
//          gesamten Plattform … alles in Global CI, Global Stil, mit vielen und
//          HOCHWERTIGEN Animationen, alles perfekt clean — einfach WOW."
//
// Diese Seite zeigt business-auftrag.tsx, sobald der Server `portalNeu`
// meldet — für einen Kunden erst, wenn die Leitung es für IHN freischaltet,
// für die Leitung als Vorschau (`vorschau`). Alle Texte mit Gewicht kommen aus
// ihren Quellen und werden NICHT neu getextet:
//   · Garantie, Frist, Teile, Startgespräch → ANGEBOT_MEIN_AUFTRAG / Server
//   · Sofortstart vs. Widerrufsfrist (E-334) → GLOBAL_AUFTRAG_WOERTER
//   · Jahresbetreuung → GLOBAL_JAHRESBETREUUNG
//   · Fahrplan, Tresor, Kapital → shared/fiaon-global-mandat.ts
//
// Gestaltung (Justins Regeln): heller Papiergrund, die dunkle Navy-Bühne an
// GENAU einer Stelle, das Blau-Paar, Newsreader für die großen Zeilen, Inter
// sonst, dünn und luftig. Nichts klebt beim Scrollen. Bewegung nur, wo sie
// führt — und gar keine bei „Bewegung reduzieren".
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, Check, CheckCircle2, CircleDashed, Copy, Download, FileSignature, FileText, FolderLock, Inbox, Landmark, Loader2,
  Mail, MessageSquare, PenLine, Phone, Send, ShieldCheck, Sparkles, Upload, X, CalendarClock, Building2, Lock, ChevronDown,
  LayoutGrid, Compass, Scale, Calculator,
} from "lucide-react";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import WellenFeld from "@/components/site/WellenFeld";
import { GLOBAL_AGENT, GLOBAL_JAHRESBETREUUNG, globalPreisText } from "@shared/fiaon-global";
import { ANGEBOT_MEIN_AUFTRAG } from "@shared/fiaon-global-angebot";
import { GLOBAL_TRESOR, globalUsd, type GlobalTresorKategorie } from "@shared/fiaon-global-mandat";
// E-341: die Fachbereiche (Strategie & Wachstum, Recht & Verträge, Steuern & Pflichten) — erst beim Öffnen geladen.
const GlobalFach = lazy(() => import("./global-portal-fach"));
import "@/styles/global-rahmen.css";
import "@/styles/global-portal.css";

type T = Record<string, any>;

// ── Die Seiten des Portals (E-341): Adresse #<seite>, Zurück-Taste funktioniert. ──
export type PortalSeite = "uebersicht" | "fahrplan" | "tresor" | "post" | "anfragen" | "kapital" | "vertrag" | "strategie" | "recht" | "steuern";
const SEITEN: PortalSeite[] = ["uebersicht", "fahrplan", "tresor", "post", "anfragen", "kapital", "vertrag", "strategie", "recht", "steuern"];
const NAV_GRUPPEN: { key: "auftrag" | "fach"; seiten: { key: PortalSeite; Icon: any }[] }[] = [
  { key: "auftrag", seiten: [
    { key: "uebersicht", Icon: LayoutGrid }, { key: "fahrplan", Icon: Building2 }, { key: "tresor", Icon: FolderLock }, { key: "post", Icon: Inbox },
    { key: "anfragen", Icon: MessageSquare }, { key: "kapital", Icon: Landmark }, { key: "vertrag", Icon: ShieldCheck },
  ] },
  { key: "fach", seiten: [{ key: "strategie", Icon: Compass }, { key: "recht", Icon: Scale }, { key: "steuern", Icon: Calculator }] },
];
const KACHELN: { key: PortalSeite; Icon: any; fach?: boolean }[] = [
  { key: "strategie", Icon: Compass, fach: true }, { key: "recht", Icon: Scale, fach: true }, { key: "steuern", Icon: Calculator, fach: true },
  { key: "fahrplan", Icon: Building2 }, { key: "tresor", Icon: FolderLock }, { key: "post", Icon: Inbox },
  { key: "anfragen", Icon: MessageSquare }, { key: "kapital", Icon: Landmark }, { key: "vertrag", Icon: ShieldCheck },
];
const seiteAusHash = (): PortalSeite => {
  const h = (typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "") as PortalSeite;
  return SEITEN.includes(h) ? h : "uebersicht";
};

// ── Wörter des neuen Portals (DE/EN). Alles mit Gewicht kommt aus `t` (GLOBAL_AUFTRAG_WOERTER). ──
const W = {
  de: {
    morgen: "Guten Morgen", tag: "Guten Tag", abend: "Guten Abend",
    navTitel: "Bereiche Ihres Portals", nav: { auftrag: "Ihr Auftrag", fach: "Fachbereiche" } as Record<string, string>,
    seiten: { uebersicht: "Übersicht", fahrplan: "Fahrplan & Gesellschaft", tresor: "Tresor", post: "Post", anfragen: "Anfragen", kapital: "Banken & Kapital", vertrag: "Vertrag & Zahlung", strategie: "Strategie & Wachstum", recht: "Recht & Verträge", steuern: "Steuern & Pflichten" } as Record<string, string>,
    // Leer = die Seite trägt ihren einen Satz im Abschnitt darunter (keine Doppelung).
    seitenSatz: {
      fahrplan: "",
      tresor: "",
      post: "",
      anfragen: "",
      kapital: "",
      vertrag: "Auftrag, Zahlungsplan und Rechnungen.",
      strategie: "Sparring, Rechner und Wissen für Wachstum und Kapital.",
      recht: "Vorlagen, Wissen und Antworten rund um Ihre Gesellschaft.",
      steuern: "Fristen, Formulare und Antworten auf Steuerfragen.",
    } as Record<string, string>,
    alleBereiche: "Alles für Ihre Gesellschaft",
    meinAuftrag: "Mein Auftrag", ihreGesellschaft: "Ihre Gesellschaft", inGruendung: "in Gründung", gesellschaftOhneName: "Ihre US-Gesellschaft",
    schritte: (a: number, b: number) => `${a} von ${b} Schritten`, fortschritt: "Fortschritt", naechster: "Ihr nächster Schritt", naechsterLeer: "Wir melden uns mit dem nächsten Schritt.",
    sprung: { tun: "Für Sie", fahrplan: "Fahrplan", tresor: "Tresor", post: "Post", anfragen: "Anfragen", kapital: "Banken & Kapital", fristen: "Pflichten", auftrag: "Vertrag" },
    tunTitel: "Für Sie zu tun", tunLeer: "Alles erledigt — wir sind am Zug.",
    unterschriftTitel: (x: string) => `Bitte unterschreiben: ${x}`, unterschriftText: "Direkt hier, ohne Ausdrucken.", unterschreiben: "Jetzt unterschreiben",
    antwortTitel: (n: string) => `Neue Antwort von ${n}`, antwortText: "Zu Ihrer Anfrage.", lesen: "Antwort lesen",
    postTitel: (n: number) => n === 1 ? "Ein neuer Brief" : `${n} neue Briefe`, postText: "Für Sie eingescannt.", oeffnen: "Öffnen",
    unterlagenTitel: (n: number) => n === 1 ? "Eine Unterlage fehlt noch" : `${n} Unterlagen fehlen noch`, unterlagenText: "Bitte im Tresor hochladen.", zumTresor: "Zum Tresor",
    termin: "Ihr Startgespräch",
    fahrplanTitel: "Ihr Fahrplan", fahrplanLead: "Alle Schritte zu Gesellschaft, Konto und Kapital — mit Datum, sobald erledigt.",
    stand: { offen: "offen", in_arbeit: "in Arbeit", erledigt: "erledigt" } as Record<string, string>,
    etappeStand: { fertig: "abgeschlossen", jetzt: "aktuell", arbeit: "in Arbeit", offen: "folgt" } as Record<string, string>,
    tresorTitel: "Ihr Tresor", tresorLead: "Alle Dokumente vertraulich an einem Ort — unterschreiben direkt hier.", alle: "Alle",
    nachweise: "Nachweise und Sicherheiten", vertragRechnungen: "Vertrag und Rechnungen", neu: "Neu", leerMappe: "Noch leer.",
    hochladenTitel: "Unterlage hochladen", hochladenFeld: "Datei hierher ziehen oder auswählen", hochladenKlein: "PDF, JPG, PNG oder HEIC · bis 15 MB", art: "Was laden Sie hoch?", hochladen: "Hochladen", laedt: "Wird hochgeladen …",
    unterschrieben: (d: string) => `unterschrieben am ${d}`, wartet: "wartet auf Ihre Unterschrift",
    postFachTitel: "Ihr Briefkasten", postLead: GLOBAL_AGENT.de.post as string, postLeer: "Noch keine Post — neue Briefe erscheinen hier.", absender: "Absender", eingang: "Eingang",
    anfragenTitel: "Ihre Anfragen", anfragenLead: (n: string) => `Schreiben Sie ${n} — die Antwort lesen Sie hier.`, anfragenLeer: "Noch keine Anfrage.", sie: "Sie", platzhalter: "Ihre Nachricht …", senden: "Senden", sendet: "Wird gesendet …",
    kapitalTitel: "Banken & Kapital", kapitalLead: "Konto, Firmenkarten und Kreditrahmen — mit dem Stand jedes Antrags.", kapitalLeer: "Noch kein Antrag — jeder Schritt erscheint hier.", zugesagt: "Zugesagt und aktiv", beantragt: (d: string) => `beantragt ${d}`,
    fristenNachZahlung: "Der Kalender startet mit Ihrem Zahlungseingang.",
    fristenTitel: "Pflichten & Fristen", fristenLead: "Was wann fällig ist — wir erinnern Sie dreißig und sieben Tage vorher.", inTagen: (n: number) => n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`, ueber: (n: number) => `seit ${n} ${n === 1 ? "Tag" : "Tagen"} fällig`,
    verlaufTitel: "Was bisher geschah", alleZeigen: "Alle anzeigen", weniger: "Weniger zeigen",
    gesellschaftLeer: "Die Angaben folgen mit der Eintragung.",
    kontaktTitel: "Ihr Ansprechpartner", schreiben: "Nachricht schreiben", gesellschaftTitel: "Ihre US-Gesellschaft", auftragTitel: "Ihr Auftrag", kopiert: "Kopiert",
    felder: { name: "Name", form: "Rechtsform", bundesstaat: "Bundesstaat", gegruendet: "Eingetragen am", aktenzeichen: "Registernummer", ein: "EIN", registeredAgent: "Registered Agent", usAdresse: "US-Adresse", usTelefon: "US-Telefon", itin: "ITIN" },
    itin: { offen: "noch offen", beantragt: "beantragt", vorhanden: "erteilt" } as Record<string, string>,
    sicher: "Ihr persönlicher Zugang · verschlüsselt", vorschau: (n: string) => `Vorschau — so sieht ${n} das Portal. Nichts gilt als gelesen; handeln kann nur der Kunde.`,
    modalTitel: "Dokument unterschreiben", modalLesen: "In neuem Fenster öffnen", modalName: "Ihr vollständiger Name", modalZeichnen: "Unterschrift — mit Finger, Stift oder Maus", modalLoeschen: "Neu zeichnen",
    modalZustimmung: "Ich habe das Dokument gelesen und unterschreibe es elektronisch.", modalKnopf: "Verbindlich unterschreiben", modalLaeuft: "Wird unterschrieben …", modalFertig: "Unterschrieben",
    modalFertigText: "Liegt in Ihrem Tresor — Ihr Ansprechpartner ist informiert.", schliessen: "Schließen",
    fusszeile: "FIAON Global · Vertraulich. Ihr persönlicher Link gilt ein Jahr und verlängert sich bei jedem Öffnen.",
  },
  en: {
    morgen: "Good morning", tag: "Good afternoon", abend: "Good evening",
    navTitel: "Areas of your portal", nav: { auftrag: "Your order", fach: "Expert areas" } as Record<string, string>,
    seiten: { uebersicht: "Overview", fahrplan: "Roadmap & company", tresor: "Vault", post: "Mail", anfragen: "Requests", kapital: "Banking & capital", vertrag: "Contract & payment", strategie: "Strategy & growth", recht: "Law & contracts", steuern: "Tax & compliance" } as Record<string, string>,
    seitenSatz: {
      fahrplan: "",
      tresor: "",
      post: "",
      anfragen: "",
      kapital: "",
      vertrag: "Order, payment plan and invoices.",
      strategie: "Sparring, calculators and know-how for growth and capital.",
      recht: "Templates, know-how and answers about your company.",
      steuern: "Deadlines, forms and answers to tax questions.",
    } as Record<string, string>,
    alleBereiche: "Everything for your company",
    meinAuftrag: "My order", ihreGesellschaft: "Your company", inGruendung: "being formed", gesellschaftOhneName: "Your US company",
    schritte: (a: number, b: number) => `${a} of ${b} steps`, fortschritt: "Progress", naechster: "Your next step", naechsterLeer: "We will be in touch with the next step.",
    sprung: { tun: "For you", fahrplan: "Roadmap", tresor: "Vault", post: "Mail", anfragen: "Requests", kapital: "Banking & capital", fristen: "Compliance", auftrag: "Contract" },
    tunTitel: "For you to do", tunLeer: "All done — the next move is ours.",
    unterschriftTitel: (x: string) => `Please sign: ${x}`, unterschriftText: "Right here, no printing needed.", unterschreiben: "Sign now",
    antwortTitel: (n: string) => `New reply from ${n}`, antwortText: "On your request.", lesen: "Read the reply",
    postTitel: (n: number) => n === 1 ? "One new letter" : `${n} new letters`, postText: "Scanned for you.", oeffnen: "Open",
    unterlagenTitel: (n: number) => n === 1 ? "One document is still missing" : `${n} documents are still missing`, unterlagenText: "Please upload to your vault.", zumTresor: "Go to the vault",
    termin: "Your kick-off call",
    fahrplanTitel: "Your roadmap", fahrplanLead: "Every step to company, account and capital — dated once done.",
    stand: { offen: "open", in_arbeit: "in progress", erledigt: "done" } as Record<string, string>,
    etappeStand: { fertig: "completed", jetzt: "current", arbeit: "in progress", offen: "upcoming" } as Record<string, string>,
    tresorTitel: "Your vault", tresorLead: "Every document, confidential and in one place — sign right here.", alle: "All",
    nachweise: "Evidence and collateral", vertragRechnungen: "Contract and invoices", neu: "New", leerMappe: "Empty for now.",
    hochladenTitel: "Upload a document", hochladenFeld: "Drop a file here or choose one", hochladenKlein: "PDF, JPG, PNG or HEIC · max. 15 MB", art: "What are you uploading?", hochladen: "Upload", laedt: "Uploading …",
    unterschrieben: (d: string) => `signed on ${d}`, wartet: "awaiting your signature",
    postFachTitel: "Your mailbox", postLead: GLOBAL_AGENT.en.post as string, postLeer: "No mail yet — new letters appear here.", absender: "Sender", eingang: "Received",
    anfragenTitel: "Your requests", anfragenLead: (n: string) => `Write to ${n} — you read the reply here.`, anfragenLeer: "No requests yet.", sie: "You", platzhalter: "Your message …", senden: "Send", sendet: "Sending …",
    kapitalTitel: "Banking & capital", kapitalLead: "Account, business cards and credit lines — with the status of every application.", kapitalLeer: "No application yet — every step appears here.", zugesagt: "Approved and active", beantragt: (d: string) => `applied for ${d}`,
    fristenNachZahlung: "The calendar starts once your payment has arrived.",
    fristenTitel: "Compliance & deadlines", fristenLead: "What is due when — we remind you thirty and seven days ahead.", inTagen: (n: number) => n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`, ueber: (n: number) => `due ${n} ${n === 1 ? "day" : "days"} ago`,
    verlaufTitel: "What has happened so far", alleZeigen: "Show all", weniger: "Show less",
    gesellschaftLeer: "The details follow with registration.",
    kontaktTitel: "Your contact", schreiben: "Write a message", gesellschaftTitel: "Your US company", auftragTitel: "Your order", kopiert: "Copied",
    felder: { name: "Name", form: "Legal form", bundesstaat: "State", gegruendet: "Registered on", aktenzeichen: "Register number", ein: "EIN", registeredAgent: "Registered agent", usAdresse: "US address", usTelefon: "US phone", itin: "ITIN" },
    itin: { offen: "still open", beantragt: "applied for", vorhanden: "issued" } as Record<string, string>,
    sicher: "Your personal access · encrypted", vorschau: (n: string) => `Preview — this is how ${n} sees the portal. Nothing is marked as read; only the client can act.`,
    modalTitel: "Sign the document", modalLesen: "Open in a new window", modalName: "Your full name", modalZeichnen: "Signature — finger, pen or mouse", modalLoeschen: "Draw again",
    modalZustimmung: "I have read the document and sign it electronically.", modalKnopf: "Sign with binding effect", modalLaeuft: "Signing …", modalFertig: "Signed",
    modalFertigText: "Now in your vault — your contact has been informed.", schliessen: "Close",
    fusszeile: "FIAON Global · Confidential. Your personal link is valid for one year and renews each time you open it.",
  },
};

const ruhig = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Elemente mit `gp-auftauchen` erscheinen, wenn sie in den Blick kommen — einmal, dann Ruhe. */
function useAuftauchen(abh: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".gp-auftauchen:not(.gp-da)"));
    if (ruhig() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("gp-da")); return; }
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) if (e.isIntersecting) { (e.target as HTMLElement).classList.add("gp-da"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [abh]);
}

function Zaehler({ ziel, dauer = 1400 }: { ziel: number; dauer?: number }) {
  const [w, setW] = useState(ruhig() ? ziel : 0);
  useEffect(() => {
    if (ruhig()) { setW(ziel); return; }
    let raf = 0; const start = performance.now();
    const lauf = (jetzt: number) => {
      const p = Math.min(1, (jetzt - start) / dauer);
      setW(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
  }, [ziel, dauer]);
  return <>{w}</>;
}

// ── Unterschriftsfeld ────────────────────────────────────────────────────────
function Zeichenfeld({ onAenderung, leeren }: { onAenderung: (leer: boolean) => void; leeren: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const letzter = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0c1a2e"; ctx.lineWidth = 2.2;
    ctx.clearRect(0, 0, c.width, c.height);
    onAenderung(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leeren]);
  const punkt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return (
    <canvas ref={ref} className="gp-zeichenfeld" aria-label="Unterschriftsfeld"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); zeichnet.current = true; letzter.current = punkt(e); }}
      onPointerMove={(e) => {
        if (!zeichnet.current || !letzter.current) return;
        const ctx = e.currentTarget.getContext("2d")!; const p = punkt(e); const l = letzter.current;
        ctx.beginPath(); ctx.moveTo(l.x, l.y);
        ctx.quadraticCurveTo(l.x, l.y, (l.x + p.x) / 2, (l.y + p.y) / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
        letzter.current = p; onAenderung(false);
      }}
      onPointerUp={() => { zeichnet.current = false; letzter.current = null; }}
      onPointerCancel={() => { zeichnet.current = false; letzter.current = null; }} />
  );
}

function UnterschriftDialog({ dok, url, sendenUrl, s, gruss, onFertig, onZu, vorschau }: {
  dok: T; url: string; sendenUrl: string; s: "de" | "en"; gruss: string; onFertig: () => void; onZu: () => void; vorschau: boolean;
}) {
  const w = W[s];
  const [name, setName] = useState(gruss);
  const [leer, setLeer] = useState(true);
  const [ok, setOk] = useState(false);
  const [leeren, setLeeren] = useState(0);
  const [stand, setStand] = useState<"" | "laeuft" | "fertig">("");
  const [fehler, setFehler] = useState("");
  const feld = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape" && stand !== "laeuft") onZu(); };
    window.addEventListener("keydown", zu);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", zu); document.body.style.overflow = ""; };
  }, [onZu, stand]);
  const unterschreiben = async () => {
    const c = feld.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!c) return;
    setStand("laeuft"); setFehler("");
    try {
      const r = await fetch(sendenUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), bild: c.toDataURL("image/png"), zustimmung: ok }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setStand("fertig"); onFertig(); } else { setStand(""); setFehler(j.error || "—"); }
    } catch { setStand(""); setFehler(s === "en" ? "No connection — please try again." : "Keine Verbindung — bitte noch einmal."); }
  };
  return (
    <div className="gp-schleier" role="dialog" aria-modal="true" aria-label={w.modalTitel} onMouseDown={(e) => { if (e.target === e.currentTarget && stand !== "laeuft") onZu(); }}>
      <div className="gp-dialog">
        <button type="button" className="gp-dialog-zu" onClick={onZu} aria-label={w.schliessen} disabled={stand === "laeuft"}><X size={18} /></button>
        {stand === "fertig" ? (
          <div className="gp-fertig">
            <svg className="gp-haken-gross" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg>
            <h3>{w.modalFertig}</h3>
            <p>{w.modalFertigText}</p>
            <button type="button" className="gp-knopf" onClick={onZu}>{w.schliessen}</button>
          </div>
        ) : (
          <>
            <span className="gp-auge"><FileSignature size={14} /> {w.modalTitel}</span>
            <h3>{dok.titel || dok.artText}</h3>
            <div className="gp-dialog-pdf">
              <iframe src={url} title={dok.titel || dok.artText} />
              <a href={url} target="_blank" rel="noopener" className="gp-link"><FileText size={14} /> {w.modalLesen}</a>
            </div>
            <label className="gp-feldname">{w.modalName}
              <input className="gp-eingabe" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="gp-feldname">{w.modalZeichnen}
              <div ref={feld} className="gp-zeichen-rahmen">
                <Zeichenfeld onAenderung={setLeer} leeren={leeren} />
                <span className="gp-zeichen-linie" aria-hidden="true" />
                {!leer && <button type="button" className="gp-zeichen-neu" onClick={() => setLeeren((x) => x + 1)}>{w.modalLoeschen}</button>}
              </div>
            </div>
            <label className="gp-haken"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> <span>{w.modalZustimmung}</span></label>
            {fehler && <p className="gp-meldung schlecht" role="alert">{fehler}</p>}
            {vorschau && <p className="gp-meldung" role="note">{s === "en" ? "Preview — only the client signs here." : "Vorschau — hier unterschreibt nur der Kunde."}</p>}
            <button type="button" className="gp-knopf gross" disabled={vorschau || leer || !ok || name.trim().split(/\s+/).length < 2 || stand === "laeuft"} onClick={unterschreiben}>
              {stand === "laeuft" ? <><Loader2 size={16} className="gp-dreht" /> {w.modalLaeuft}</> : <><PenLine size={16} /> {w.modalKnopf}</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Das Portal ───────────────────────────────────────────────────────────────
export default function GlobalPortal({ a, gref, token, s, t, laden }: {
  a: T; gref: string; token: string; s: "de" | "en"; t: T; laden: () => Promise<void> | void;
}) {
  const w = W[s];
  const loc = s === "en" ? "en-GB" : "de-DE";
  const vorschau = !!a.vorschau;
  const basis = `/api/fiaon/global/mein-auftrag/${encodeURIComponent(gref)}`;
  const mitToken = (pfad: string) => `${basis}${pfad}?t=${encodeURIComponent(token)}${vorschau ? "&vorschau=1" : ""}`;
  const tag = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "";
  const tagKurz = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const zeit = (iso?: string | null) => iso ? new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const kb = (n?: number) => !n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString(loc, { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  // ── Seiten (E-341) ──
  const [seite, setSeite] = useState<PortalSeite>(seiteAusHash);
  useEffect(() => {
    const neu = () => setSeite(seiteAusHash());
    window.addEventListener("hashchange", neu);
    return () => window.removeEventListener("hashchange", neu);
  }, []);
  const geh = (ziel: PortalSeite | string) => {
    const z = (SEITEN.includes(ziel as PortalSeite) ? ziel : "uebersicht") as PortalSeite;
    if (window.location.hash !== `#${z}`) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${z}`);
    setSeite(z);
    window.scrollTo({ top: 0, behavior: ruhig() ? "auto" : "smooth" });
  };
  useAuftauchen(`${a.ref}:${seite}`);
  // Titel, „nicht indexieren" und Dokument-Scrollen (iOS blendet seine Leisten nur beim Scrollen des Dokuments aus).
  useEffect(() => {
    const vorher = document.title;
    document.title = `${w.meinAuftrag} · ${a.gesellschaft?.name || a.firma?.name || "FIAON Global"}`;
    const meta = document.createElement("meta"); meta.name = "robots"; meta.content = "noindex, nofollow"; document.head.appendChild(meta);
    document.documentElement.classList.add("fg-dokument");
    return () => { document.title = vorher; meta.remove(); document.documentElement.classList.remove("fg-dokument"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── abgeleitet ──
  const dz: Record<string, T> = a.dokumentZusatz ?? {};
  const doks: T[] = (a.dokumente ?? []).map((d: T) => ({ ...d, ...(dz[String(d.id)] ?? {}) }));
  const post = doks.filter((d) => d.art === "post");
  const tresorDoks = doks.filter((d) => d.art !== "post");
  const zuUnterschreiben = doks.filter((d) => d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben);
  const schritte: T[] = a.schritte ?? [];
  const sichtbareSchritte = schritte.filter((x) => x.status !== "entfaellt");
  const erledigt = sichtbareSchritte.filter((x) => x.status === "erledigt").length;
  const gesamt = Math.max(1, sichtbareSchritte.length);
  const prozent = Math.round((erledigt / gesamt) * 100);
  const nachrichten: T[] = a.nachrichten ?? [];
  const ungeleseneAntworten = nachrichten.filter((n) => n.von === "fiaon" && !n.gelesen);
  const postNeu = post.filter((d) => !d.gelesen);
  const darfHochladen = ["bezahlt", "gestartet", "abgeschlossen"].includes(a.status);
  const fehlend = darfHochladen ? (a.unterlagen ?? []).filter((u: T) => !u.vorhanden) : [];
  const ap = a.ansprechpartner as T | undefined;
  const apVorname = ap?.vorname || ap?.name?.split(" ")[0] || (s === "en" ? "your contact" : "Ihrem Ansprechpartner");
  const g = a.gesellschaft ?? {};
  const gp = a.gesellschaftPlus ?? {};
  const kapital: T[] = a.kapital ?? [];
  const zugesagtCents = kapital.filter((k) => (k.status === "zugesagt" || k.status === "aktiv") && ["karte", "kreditrahmen", "darlehen"].includes(k.art)).reduce((x, k) => x + Number(k.betragCents || 0), 0);
  const J = GLOBAL_JAHRESBETREUUNG[s];
  const stunde = new Date().getHours();
  const hallo = stunde < 11 ? w.morgen : stunde < 18 ? w.tag : w.abend;
  // „Herr Hildbrand" — mit Anrede und Nachname; fehlt die Anrede, der hinterlegte Name, sonst nur der Gruß.
  const name = a.gruss?.anrede && a.gruss?.nachname ? `${a.gruss.anrede} ${a.gruss.nachname}` : (a.gruss?.name ?? "");
  const vollerName = [a.gruss?.vorname, a.gruss?.nachname].filter(Boolean).join(" ") || a.gruss?.name || "";

  // ── Tresor-Mappen ──
  const [mappe, setMappe] = useState<string>("alle");
  const mappen = useMemo(() => {
    const m: { key: string; titel: string; zahl: number }[] = [];
    const vertragZahl = (a.vertragUrl ? 1 : 0) + (a.rechnungUrl ? 1 : 0) + ((a.angebot?.teile ?? []).filter((x: T) => x.rechnungUrl).length);
    if (vertragZahl) m.push({ key: "vertrag", titel: w.vertragRechnungen, zahl: vertragZahl });
    if ((a.angebotUnterlagen ?? []).length) m.push({ key: "nachweise", titel: w.nachweise, zahl: a.angebotUnterlagen.length });
    for (const k of GLOBAL_TRESOR) {
      if (k.kategorie === "vertrag" || k.kategorie === "post") continue;
      const n = tresorDoks.filter((d) => (d.kategorie ?? "sonstiges") === k.kategorie).length;
      if (n) m.push({ key: k.kategorie, titel: s === "en" ? k.titel.en : k.titel.de, zahl: n });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, s]);

  // ── Hochladen ──
  const [art, setArt] = useState("sonstiges");
  const [datei, setDatei] = useState<File | null>(null);
  const [zieht, setZieht] = useState(false);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [uploadMeldung, setUploadMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const hochladen = async () => {
    if (!datei) return;
    if (datei.size > 15 * 1024 * 1024) { setUploadMeldung({ gut: false, text: t.uploadZuGross }); return; }
    setLaedtHoch(true); setUploadMeldung(null);
    try {
      const fd = new FormData(); fd.append("art", art); fd.append("datei", datei);
      const r = await fetch(mitToken("/dokument"), { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setUploadMeldung({ gut: false, text: j.error || t.uploadFehler });
      else { setDatei(null); setUploadMeldung({ gut: true, text: s === "en" ? "Uploaded — now in your vault." : "Hochgeladen — liegt im Tresor." }); await laden(); }
    } catch { setUploadMeldung({ gut: false, text: t.uploadFehler }); }
    finally { setLaedtHoch(false); }
  };

  // ── Anfragen ──
  const [text, setText] = useState("");
  const [sendet, setSendet] = useState(false);
  const [nMeldung, setNMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const fadenRef = useRef<HTMLDivElement>(null);
  const senden = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSendet(true); setNMeldung(null);
    try {
      const r = await fetch(mitToken("/nachricht"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setText(""); setNMeldung({ gut: true, text: j.meldung || t.nachrichtOk }); await laden(); } else setNMeldung({ gut: false, text: j.error || t.nachrichtFehler });
    } catch { setNMeldung({ gut: false, text: t.nachrichtFehler }); }
    finally { setSendet(false); }
  };
  // Gelesen: sobald der Faden mit ungelesenen Antworten wirklich im Blick ist (nie in der Vorschau).
  useEffect(() => {
    if (vorschau || ungeleseneAntworten.length === 0 || !fadenRef.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { void fetch(mitToken("/gelesen"), { method: "POST" }); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(fadenRef.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ungeleseneAntworten.length, vorschau]);
  useEffect(() => { const f = fadenRef.current; if (f) f.scrollTop = f.scrollHeight; }, [nachrichten.length]);

  // ── Unterschrift ──
  const [dialog, setDialog] = useState<T | null>(null);
  const [kopiert, setKopiert] = useState("");
  const kopieren = async (wert: string, key: string) => { try { await navigator.clipboard.writeText(wert); setKopiert(key); setTimeout(() => setKopiert(""), 1600); } catch { /* egal */ } };
  const [verlaufAlle, setVerlaufAlle] = useState(false);
  const zu = (id: string) => geh(id.replace(/^gp-/, ""));

  // ── „Für Sie zu tun" ──
  const tun: { key: string; Icon: any; ton: string; titel: string; text: string; knopf?: string; aktion?: () => void; href?: string }[] = [];
  if (a.status === "offen" && a.zahlung?.zahlungsseite) tun.push({ key: "zahlung", Icon: Landmark, ton: "navy", titel: t.zahlungOffenTitel, text: t.zahlungOffenText, knopf: t.zurZahlung, href: a.zahlung.zahlungsseite });
  for (const d of zuUnterschreiben) tun.push({ key: `u${d.id}`, Icon: FileSignature, ton: "blau", titel: w.unterschriftTitel(d.titel || d.artText), text: w.unterschriftText, knopf: w.unterschreiben, aktion: () => setDialog(d) });
  if (ungeleseneAntworten.length) tun.push({ key: "antwort", Icon: MessageSquare, ton: "blau", titel: w.antwortTitel(ungeleseneAntworten[ungeleseneAntworten.length - 1].autor || apVorname), text: w.antwortText, knopf: w.lesen, aktion: () => zu("gp-anfragen") });
  if (postNeu.length) tun.push({ key: "post", Icon: Inbox, ton: "", titel: w.postTitel(postNeu.length), text: w.postText, knopf: w.oeffnen, aktion: () => zu("gp-post") });
  if (fehlend.length) tun.push({ key: "unterlagen", Icon: Upload, ton: "", titel: w.unterlagenTitel(fehlend.length), text: fehlend.map((u: T) => u.titel).join(" · "), knopf: w.zumTresor, aktion: () => zu("gp-tresor") });
  // Pflichtfristen der nächsten dreißig Tage gehören zu „Für Sie zu tun".
  const heuteIso = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  for (const f of (a.fristen ?? []) as T[]) {
    if (!f.erledigt && f.faelligAm >= heuteIso && f.faelligAm <= in30) {
      tun.push({ key: `f${f.id}`, Icon: CalendarClock, ton: "", titel: f.titel, text: s === "en" ? `Due on ${tag(f.faelligAm)}.` : `Fällig am ${tag(f.faelligAm)}.`, knopf: s === "en" ? "Compliance" : "Zu den Pflichten", aktion: () => geh("steuern") });
    }
  }
  const sg = a.angebot?.startgespraech;
  // Die Etappe kommt vom Server (sie steuert Mails). Für die Anzeige gilt zusätzlich der Fahrplan: Läuft in einer
  // „folgenden" Etappe schon etwas, steht sie auf „in Arbeit" — die Seite widerspricht sich nicht.
  const standAnzeige = (e: T): string => {
    if (e.stand !== "offen") return e.stand;
    const liste = sichtbareSchritte.filter((x) => x.etappe === e.nr);
    if (liste.length && liste.every((x) => x.status === "erledigt")) return "fertig";
    return liste.some((x) => x.status !== "offen") ? "arbeit" : "offen";
  };
  const hatAuftragsblock = !!(a.angebot || a.stichtag || a.widerruf);
  // E-407: Kapital-Angebot — die Summe der entstandenen Teile (Server), nicht die der künftigen.
  const preisText = a.angebot ? `${((a.angebot.summeCents ?? (a.angebot.teile as T[]).reduce((x, y) => x + y.betragCents, 0)) / 100).toLocaleString("de-DE")} €` : globalPreisText(a.paket, s);

  const kachelSatz = (k: PortalSeite): string => {
    const de = s !== "en";
    switch (k) {
      case "fahrplan": return de ? `${erledigt} von ${gesamt} Schritten erledigt` : `${erledigt} of ${gesamt} steps done`;
      case "tresor": return de ? `${tresorDoks.length + (a.angebotUnterlagen ?? []).length} Dokumente${zuUnterschreiben.length ? ` · ${zuUnterschreiben.length} zur Unterschrift` : ""}` : `${tresorDoks.length + (a.angebotUnterlagen ?? []).length} documents${zuUnterschreiben.length ? ` · ${zuUnterschreiben.length} to sign` : ""}`;
      case "post": return postNeu.length ? (de ? `${postNeu.length} ungelesen` : `${postNeu.length} unread`) : (de ? `${post.length} Briefe` : `${post.length} letters`);
      case "anfragen": return ungeleseneAntworten.length ? (de ? "Neue Antwort" : "New reply") : (de ? `${nachrichten.length} Nachrichten` : `${nachrichten.length} messages`);
      case "kapital": return zugesagtCents > 0 ? `${globalUsd(zugesagtCents, s)} ${de ? "zugesagt" : "approved"}` : (de ? `${kapital.length} Einträge` : `${kapital.length} entries`);
      case "vertrag": return a.status === "offen" ? (t.status?.[a.status] ?? a.status) : a.paketName;
      case "strategie": return de ? "KI-Sparring · Rechner · Bank-Exposé" : "AI sparring · calculators · bank profile";
      case "recht": return de ? "Vorlagen · Verzeichnis · Rechtsfragen" : "Templates · directory · legal questions";
      case "steuern": return de ? "Fristen · Formulare · Steuerfragen" : "Deadlines · forms · tax questions";
      default: return "";
    }
  };

  // ── Mappen-Inhalt ──
  const zeilenVertrag = () => (
    <>
      {a.vertragUrl && <DokZeile titel={t.vertragPdf} unter={t.vonFiaon} href={a.vertragUrl} Icon={ShieldCheck} />}
      {a.rechnungUrl && <DokZeile titel={t.rechnungPdf} unter={t.vonFiaon} href={a.rechnungUrl} Icon={FileText} />}
      {(a.angebot?.teile ?? []).filter((x: T) => x.rechnungUrl).map((x: T) => <DokZeile key={`r${x.nr}`} titel={`${ANGEBOT_MEIN_AUFTRAG.rechnung} · ${x.titel}`} unter={x.rechnungsnummer ?? ""} href={x.rechnungUrl} Icon={FileText} />)}
    </>
  );
  const zeilenNachweise = () => (a.angebotUnterlagen ?? []).map((u: T) => (
    <DokZeile key={`n${u.id}`} titel={u.titel} unter={[t.vonFiaon, u.mime === "application/pdf" ? "PDF" : (s === "en" ? "Image" : "Bild"), kb(u.groesse)].filter(Boolean).join(" · ")} href={u.url} Icon={ShieldCheck} />
  ));
  const zeilenDok = (liste: T[]) => liste.map((d) => (
    <DokZeile key={d.id} titel={d.titel || d.artText || d.name} Icon={d.unterschrift?.gefordert ? FileSignature : FileText}
      unter={[d.titel ? d.name : (d.artText ? d.name : ""), d.von === "kunde" ? t.vonIhnen : t.vonFiaon, tagKurz(d.am), kb(d.groesse)].filter(Boolean).join(" · ")}
      href={mitToken(`/dokument/${encodeURIComponent(String(d.id))}`)}
      marke={d.unterschrift?.gefordert ? (d.unterschrift.unterschrieben ? { text: w.unterschrieben(tagKurz(d.unterschrift.am)), ton: "gruen" } : { text: w.wartet, ton: "blau" }) : (d.von !== "kunde" && !d.gelesen ? { text: w.neu, ton: "blau" } : undefined)}
      aktion={d.unterschrift?.gefordert && !d.unterschrift.unterschrieben ? { text: w.unterschreiben, los: () => setDialog(d) } : undefined} />
  ));

  return (
    <div className="gp">
      {vorschau && <div className="gp-vorschau" role="note"><Sparkles size={14} /> {w.vorschau(vollerName || name || "der Kunde")}</div>}

      {/* ── Leiste ── */}
      <header className="gp-leiste">
        <a className="gp-logo" href={s === "en" ? "/en/business" : "/business"} aria-label="FIAON Global"><FiaonWortmarke variante="global" hoehe="22px" /></a>
        <span className="gp-leiste-trenner" aria-hidden="true" />
        <span className="gp-leiste-titel">{w.meinAuftrag}</span>
        <span className="gp-leiste-sicher"><Lock size={12} /> {w.sicher}</span>
        {ap && (
          <button type="button" className="gp-leiste-person" onClick={() => zu("gp-anfragen")} title={w.schreiben}>
            {ap.bild ? <img src={ap.bild} alt="" /> : <span>{(ap.vorname || ap.name || "F").slice(0, 1)}</span>}
            <b>{ap.name}</b>
          </button>
        )}
      </header>

      <div className="gp-app">
        {/* ── Navigation: zwei Gruppen, am Handy eine wischbare Leiste (klebt nicht über dem Inhalt) ── */}
        <nav className="gp-nav" aria-label={w.navTitel}>
          {NAV_GRUPPEN.map((gr) => (
            <div key={gr.key} className="gp-nav-gruppe">
              <span className="gp-nav-titel">{w.nav[gr.key]}</span>
              {gr.seiten.map((x) => {
                const zahl = x.key === "anfragen" ? ungeleseneAntworten.length : x.key === "post" ? postNeu.length : x.key === "tresor" ? zuUnterschreiben.length : 0;
                return (
                  <a key={x.key} href={`#${x.key}`} className={`gp-nav-punkt${seite === x.key ? " an" : ""}${gr.key === "fach" ? " fach" : ""}`} aria-current={seite === x.key ? "page" : undefined}
                     onClick={(e) => { e.preventDefault(); geh(x.key); }}>
                    <span className="gp-nav-icon"><x.Icon size={17} strokeWidth={1.6} /></span>
                    <span className="gp-nav-text">{w.seiten[x.key]}</span>
                    {zahl > 0 && <i>{zahl}</i>}
                  </a>
                );
              })}
            </div>
          ))}
          {ap && (
            <button type="button" className="gp-nav-person" onClick={() => geh("anfragen")}>
              {ap.bild ? <img src={ap.bild} alt="" /> : <span>{(ap.vorname || ap.name || "F").slice(0, 1)}</span>}
              <div><small>{w.kontaktTitel}</small><b>{ap.name}</b></div>
            </button>
          )}
        </nav>

        <div className="gp-seiteninhalt" key={seite}>
          {seite === "uebersicht" ? (
            <>
              {/* ── Die Bühne (die EINE dunkle Stelle) ── */}
      <section className="gp-buehne" aria-label={w.ihreGesellschaft}>
        <div className="gp-licht a" aria-hidden="true" /><div className="gp-licht b" aria-hidden="true" />
        <div className="gp-buehne-innen">
          <div className="gp-buehne-links">
            <p className="gp-gruss">{hallo}{name ? `, ${name}` : ""}.</p>
            <span className="gp-auge hell">{g.name ? w.ihreGesellschaft : (a.firma?.name || w.ihreGesellschaft)}</span>
            <h1 className="gp-llc">{g.name || w.gesellschaftOhneName}</h1>
            <p className="gp-llc-zeile">
              {[g.form, g.bundesstaat, g.gegruendetAm ? `${w.felder.gegruendet} ${tag(g.gegruendetAm)}` : w.inGruendung].filter(Boolean).join(" · ")}
            </p>
            <div className="gp-pillen">
              <span className={`gp-pille st-${a.status}`}>{t.status?.[a.status] ?? a.status}</span>
              <span className="gp-pille leise">{a.paketName}</span>
              <span className="gp-pille leise">{a.ref}</span>
            </div>
          </div>
          <div className="gp-buehne-rechts">
            <div className="gp-ring-karte">
              <svg className="gp-ring" viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="gpRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7fb6ff" /><stop offset="1" stopColor="#288dfa" /></linearGradient></defs>
                <circle cx="60" cy="60" r="52" className="gp-ring-grund" />
                <circle cx="60" cy="60" r="52" className="gp-ring-wert" style={{ ["--gp-p" as any]: prozent }} />
              </svg>
              <div className="gp-ring-mitte"><b><Zaehler ziel={prozent} />%</b><small>{w.fortschritt}</small></div>
              <p className="gp-ring-satz">{w.schritte(erledigt, gesamt)}</p>
            </div>
            <div className="gp-naechster">
              <span className="gp-auge hell"><ArrowRight size={12} /> {w.naechster}</span>
              <p>{a.naechsterSchritt?.text || w.naechsterLeer}</p>
              {a.naechsterSchritt?.bis && <small>{t.schrittBis(tag(a.naechsterSchritt.bis))}</small>}
            </div>
          </div>
        </div>
        <ol className="gp-etappen" aria-label={t.wegTitel}>
          {(a.etappen ?? []).map((e: T, i: number) => (
            <li key={e.nr} data-stand={standAnzeige(e)} style={{ ["--i" as any]: i }} aria-current={e.stand === "jetzt" ? "step" : undefined}>
              <span className="gp-etappe-punkt">{standAnzeige(e) === "fertig" ? <Check size={12} strokeWidth={3} /> : e.nr}</span>
              <b>{e.titel}</b>
              <small>{w.etappeStand[standAnzeige(e)]}</small>
            </li>
          ))}
        </ol>
        <WellenFeld unten className="gp-welle" />
      </section>


              <div className="gp-spalten">
                <main className="gp-haupt">
          {/* ── Für Sie zu tun ── */}
          <section id="gp-tun" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.tunTitel}</h2>
            {tun.length === 0 ? (
              <div className="gp-alles-gut"><CheckCircle2 size={22} /><p>{w.tunLeer}</p></div>
            ) : (
              <div className="gp-tun">
                {tun.map((x, i) => (
                  <div key={x.key} className={`gp-tun-karte ${x.ton}`} style={{ ["--i" as any]: i }}>
                    <span className="gp-tun-icon"><x.Icon size={18} strokeWidth={1.7} /></span>
                    <div><b>{x.titel}</b><p>{x.text}</p></div>
                    {x.href ? <a className="gp-knopf" href={x.href}>{x.knopf} <ArrowRight size={14} /></a>
                      : x.aktion ? <button type="button" className="gp-knopf" onClick={x.aktion}>{x.knopf} <ArrowRight size={14} /></button> : null}
                  </div>
                ))}
              </div>
            )}
            {sg && sg.zeile && (
              <div className="gp-termin">
                <CalendarClock size={18} strokeWidth={1.7} />
                <div><b>{sg.titel}: {sg.zeile}</b>{sg.wie && <small>{sg.wie}</small>}</div>
                <div className="gp-termin-wege">
                  {sg.kalenderUrl && <a className="gp-knopf leise" href={sg.kalenderUrl}>{sg.texte.kalender}</a>}
                  {sg.googleUrl && <a className="gp-knopf leise" href={sg.googleUrl} target="_blank" rel="noopener">{sg.texte.google}</a>}
                  {sg.verschiebenUrl && <a className="gp-knopf leise" href={sg.verschiebenUrl}>{sg.texte.verschieben}</a>}
                </div>
              </div>
            )}
            {sg && !sg.zeile && sg.satz && <p className="gp-leise">{sg.satz}</p>}
          </section>


                  <section className="gp-abschnitt gp-auftauchen">
                    <h2 className="gp-h2">{w.alleBereiche}</h2>
                    <div className="gp-kacheln">
                      {KACHELN.map((x, i) => (
                        <a key={x.key} href={`#${x.key}`} className={`gp-kachel${x.fach ? " fach" : ""}`} style={{ ["--i" as any]: i }} onClick={(e) => { e.preventDefault(); geh(x.key); }}>
                          <span className="gp-kachel-icon"><x.Icon size={20} strokeWidth={1.5} /></span>
                          <b>{w.seiten[x.key]}</b>
                          <small>{kachelSatz(x.key)}</small>
                          <ArrowRight size={16} className="gp-kachel-pfeil" />
                        </a>
                      ))}
                    </div>
                  </section>
          {/* ── Verlauf ── */}
          <section className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.verlaufTitel}</h2>
            {(a.verlauf ?? []).length === 0 ? <p className="gp-leise">{t.verlaufLeer}</p> : (
              <>
                <ol className="gp-verlauf">
                  {(a.verlauf as T[]).slice(0, verlaufAlle ? 200 : 6).map((v, i) => <li key={i}><time dateTime={v.am}>{tagKurz(v.am)}</time><span>{v.text}</span></li>)}
                </ol>
                {(a.verlauf as T[]).length > 6 && <button type="button" className="gp-link" onClick={() => setVerlaufAlle((x) => !x)}>{verlaufAlle ? w.weniger : w.alleZeigen} <ChevronDown size={14} style={{ transform: verlaufAlle ? "rotate(180deg)" : "none" }} /></button>}
              </>
            )}
          </section>
                </main>
                <aside className="gp-seite">
          <div className="gp-karte gp-auftauchen">
            <span className="gp-auge">{w.kontaktTitel}</span>
            {ap ? (
              <div className="gp-person">
                {ap.bild ? <img src={ap.bild} alt="" /> : <span className="gp-person-mono" aria-hidden="true">{(ap.vorname || ap.name || "F").slice(0, 1)}</span>}
                <div>
                  <b>{ap.name}</b>
                  {ap.email && <a href={`mailto:${ap.email}`}><Mail size={13} /> {ap.email}</a>}
                  {ap.telefon && <a href={`tel:${String(ap.telefon).replace(/\s/g, "")}`}><Phone size={13} /> {ap.telefon}</a>}
                </div>
              </div>
            ) : <p className="gp-leise">{t.seiteAnsprechLeer}</p>}
            <button type="button" className="gp-knopf leise breit" onClick={() => zu("gp-anfragen")}><MessageSquare size={15} /> {w.schreiben}</button>
          </div>

                </aside>
              </div>
            </>
          ) : (
            <>
              <header className="gp-seitenkopf">
                <span className="gp-auge">{g.name || a.firma?.name || w.meinAuftrag}</span>
                <h1>{w.seiten[seite]}</h1>
                {w.seitenSatz[seite] && <p>{w.seitenSatz[seite]}</p>}
              </header>
              {seite === "fahrplan" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
          {/* ── Fahrplan ── */}
          <section id="gp-fahrplan" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.fahrplanTitel}</h2>
            <p className="gp-lead">{w.fahrplanLead}</p>
            <div className="gp-fahrplan">
              {[1, 2, 3, 4].map((nr) => {
                const e = (a.etappen ?? []).find((x: T) => x.nr === nr);
                const liste = sichtbareSchritte.filter((x) => x.etappe === nr);
                if (!e || (!liste.length && !e.imPaket)) return null;
                const st = standAnzeige(e);
                return (
                  <div key={nr} className={`gp-kapitel ${st}${e.imPaket === false ? " ausserhalb" : ""}`}>
                    <div className="gp-kapitel-kopf">
                      <span className="gp-kapitel-nr">{st === "fertig" ? <Check size={15} strokeWidth={2.5} /> : nr}</span>
                      <div><b>{e.titel}</b><small>{w.etappeStand[st]}{e.stand === "jetzt" && e.seit ? ` · ${t.seit(tagKurz(e.seit))}` : ""}</small></div>
                    </div>
                    {e.text && <p className="gp-kapitel-text">{e.text}</p>}
                    <ul className="gp-schritte">
                      {liste.map((x, i) => (
                        <li key={x.schluessel} className={`gp-schritt ${x.status}`} style={{ ["--i" as any]: i }}>
                          <span className="gp-schritt-zeichen" aria-hidden="true">
                            {x.status === "erledigt" ? <svg className="gp-haken" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" /><path d="M7 12.5 l3.2 3.2 L17 9" /></svg>
                              : x.status === "in_arbeit" ? <span className="gp-puls" /> : <CircleDashed size={18} strokeWidth={1.4} />}
                          </span>
                          <div>
                            <b>{x.titel}</b>
                            <small>{w.stand[x.status] ?? x.status}{x.datum ? ` · ${tagKurz(x.datum)}` : ""}</small>
                            {x.hinweis ? <p className="gp-schritt-hinweis">{x.hinweis}</p> : <p className="gp-schritt-text">{x.text}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

                  </main>
                  <aside className="gp-seite">
          <div className="gp-karte gp-auftauchen">
            <span className="gp-auge">{w.gesellschaftTitel}</span>
            <dl className="gp-daten">
              <Zeile k={w.felder.name} v={g.name} />
              <Zeile k={w.felder.form} v={g.form} />
              <Zeile k={w.felder.bundesstaat} v={g.bundesstaat} />
              <Zeile k={w.felder.gegruendet} v={g.gegruendetAm ? tag(g.gegruendetAm) : null} />
              <Zeile k={w.felder.aktenzeichen} v={gp.aktenzeichen} kopie={() => kopieren(gp.aktenzeichen, "akz")} kopiert={kopiert === "akz"} w={w} />
              <Zeile k={w.felder.ein} v={gp.ein} kopie={() => kopieren(gp.ein, "ein")} kopiert={kopiert === "ein"} w={w} />
              <Zeile k={w.felder.registeredAgent} v={gp.registeredAgent} />
              <Zeile k={w.felder.usAdresse} v={gp.usAdresse} />
              <Zeile k={w.felder.usTelefon} v={gp.usTelefon} />
              <Zeile k={w.felder.itin} v={g.itinStand ? w.itin[g.itinStand] : null} />
            </dl>
            {!g.name && !gp.ein && <p className="gp-leise">{w.gesellschaftLeer}</p>}
            {gp.hinweis && <p className="gp-satz klein">{gp.hinweis}</p>}
          </div>

                  </aside>
                </div>
              )}
              {seite === "tresor" && <div className="gp-haupt">
          {/* ── Tresor ── */}
          <section id="gp-tresor" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2"><FolderLock size={20} strokeWidth={1.5} /> {w.tresorTitel}</h2>
            <p className="gp-lead">{w.tresorLead}</p>
            <div className="gp-mappen" role="tablist">
              <button type="button" role="tab" aria-selected={mappe === "alle"} className={mappe === "alle" ? "an" : ""} onClick={() => setMappe("alle")}>{w.alle}</button>
              {mappen.map((m) => (
                <button key={m.key} type="button" role="tab" aria-selected={mappe === m.key} className={mappe === m.key ? "an" : ""} onClick={() => setMappe(m.key)}>
                  {m.titel}<i>{m.zahl}</i>
                </button>
              ))}
            </div>
            <div className="gp-dokliste" key={mappe}>
              {(mappe === "alle" || mappe === "vertrag") && zeilenVertrag()}
              {(mappe === "alle" || mappe === "nachweise") && zeilenNachweise()}
              {zeilenDok(mappe === "alle" ? tresorDoks : tresorDoks.filter((d) => (d.kategorie ?? "sonstiges") === (mappe as GlobalTresorKategorie)))}
              {mappe !== "alle" && mappe !== "vertrag" && mappe !== "nachweise" && tresorDoks.filter((d) => (d.kategorie ?? "sonstiges") === mappe).length === 0 && <p className="gp-leise">{w.leerMappe}</p>}
            </div>

            {darfHochladen ? (
              <div className={`gp-ablage${zieht ? " zieht" : ""}`}
                   onDragOver={(e) => { e.preventDefault(); setZieht(true); }} onDragLeave={() => setZieht(false)}
                   onDrop={(e) => { e.preventDefault(); setZieht(false); const f = e.dataTransfer.files?.[0]; if (f) setDatei(f); }}>
                <b className="gp-ablage-titel">{w.hochladenTitel}</b>
                {fehlend.length > 0 && (
                  <ul className="gp-fehlt">
                    {fehlend.map((u: T) => (
                      <li key={u.art}><button type="button" className={art === u.art ? "an" : ""} onClick={() => setArt(u.art)}><CircleDashed size={14} /> {u.titel}</button></li>
                    ))}
                  </ul>
                )}
                <label className="gp-ablage-feld">
                  <Upload size={20} strokeWidth={1.5} />
                  <span>{datei ? <b>{datei.name}</b> : w.hochladenFeld}</span>
                  <small>{w.hochladenKlein}</small>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
                </label>
                <div className="gp-ablage-zeile">
                  <label className="gp-feldname">{w.art}
                    <select className="gp-eingabe" value={art} onChange={(e) => setArt(e.target.value)}>
                      {(a.dokumentArten ?? []).map((x: T) => <option key={x.art} value={x.art}>{x.titel}</option>)}
                    </select>
                  </label>
                  <button type="button" className="gp-knopf" disabled={!datei || laedtHoch || vorschau} onClick={hochladen}>
                    {laedtHoch ? <><Loader2 size={15} className="gp-dreht" /> {w.laedt}</> : <><Upload size={15} /> {w.hochladen}</>}
                  </button>
                </div>
                {uploadMeldung && <p className={`gp-meldung ${uploadMeldung.gut ? "gut" : "schlecht"}`} role="status">{uploadMeldung.text}</p>}
              </div>
            ) : (
              <p className="gp-leise gp-hinweis-zeile"><Lock size={13} /> {t.uploadGesperrt}</p>
            )}
          </section>

              </div>}
              {seite === "post" && <div className="gp-haupt">
          {/* ── Post ── */}
          <section id="gp-post" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2"><Inbox size={20} strokeWidth={1.5} /> {w.postFachTitel}</h2>
            <p className="gp-lead">{w.postLead}</p>
            {post.length === 0 ? <div className="gp-leer-karte"><Mail size={22} strokeWidth={1.3} /><p>{w.postLeer}</p></div> : (
              <div className="gp-briefe">
                {post.map((d) => (
                  <a key={d.id} className={`gp-brief${d.gelesen ? "" : " neu"}`} href={mitToken(`/dokument/${encodeURIComponent(String(d.id))}`)} target="_blank" rel="noopener" onClick={() => setTimeout(() => void laden(), 1200)}>
                    <span className="gp-brief-icon"><Mail size={18} strokeWidth={1.5} /></span>
                    <div><b>{d.post?.absender || d.titel || d.artText}</b><small>{w.eingang} {tag(d.post?.eingangAm || d.am)}</small></div>
                    {!d.gelesen && <span className="gp-marke blau">{w.neu}</span>}
                    <Download size={16} className="gp-brief-pfeil" />
                  </a>
                ))}
              </div>
            )}
          </section>

              </div>}
              {seite === "anfragen" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
          {/* ── Anfragen ── */}
          <section id="gp-anfragen" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2"><MessageSquare size={20} strokeWidth={1.5} /> {w.anfragenTitel}</h2>
            <p className="gp-lead">{w.anfragenLead(ap?.name || apVorname)}</p>
            <div className="gp-faden" ref={fadenRef}>
              {nachrichten.length === 0 && <p className="gp-leise">{w.anfragenLeer}</p>}
              {nachrichten.map((n) => (
                <div key={n.id} className={`gp-blase ${n.von}`}>
                  <p>{n.text}</p>
                  <small>{n.von === "kunde" ? w.sie : n.autor} · {zeit(n.am)}</small>
                </div>
              ))}
            </div>
            <form className="gp-schreiben" onSubmit={senden}>
              <textarea className="gp-eingabe" value={text} maxLength={2000} rows={3} placeholder={w.platzhalter} onChange={(e) => setText(e.target.value)} aria-label={w.anfragenTitel} />
              <button type="submit" className="gp-knopf" disabled={sendet || !text.trim() || vorschau}>
                {sendet ? <><Loader2 size={15} className="gp-dreht" /> {w.sendet}</> : <><Send size={15} /> {w.senden}</>}
              </button>
            </form>
            {nMeldung && <p className={`gp-meldung ${nMeldung.gut ? "gut" : "schlecht"}`} role="status">{nMeldung.text}</p>}
          </section>

                  </main>
                  <aside className="gp-seite">
          <div className="gp-karte gp-auftauchen">
            <span className="gp-auge">{w.kontaktTitel}</span>
            {ap ? (
              <div className="gp-person">
                {ap.bild ? <img src={ap.bild} alt="" /> : <span className="gp-person-mono" aria-hidden="true">{(ap.vorname || ap.name || "F").slice(0, 1)}</span>}
                <div>
                  <b>{ap.name}</b>
                  {ap.email && <a href={`mailto:${ap.email}`}><Mail size={13} /> {ap.email}</a>}
                  {ap.telefon && <a href={`tel:${String(ap.telefon).replace(/\s/g, "")}`}><Phone size={13} /> {ap.telefon}</a>}
                </div>
              </div>
            ) : <p className="gp-leise">{t.seiteAnsprechLeer}</p>}
            <button type="button" className="gp-knopf leise breit" onClick={() => zu("gp-anfragen")}><MessageSquare size={15} /> {w.schreiben}</button>
          </div>

                  </aside>
                </div>
              )}
              {seite === "kapital" && <div className="gp-haupt">
          {/* ── Banken & Kapital ── */}
          <section id="gp-kapital" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2"><Landmark size={20} strokeWidth={1.5} /> {w.kapitalTitel}</h2>
            <p className="gp-lead">{w.kapitalLead}</p>
            {zugesagtCents > 0 && <div className="gp-summe"><small>{w.zugesagt}</small><b>{globalUsd(zugesagtCents, s)}</b></div>}
            {kapital.length === 0 ? <div className="gp-leer-karte"><Building2 size={22} strokeWidth={1.3} /><p>{w.kapitalLeer}</p></div> : (
              <div className="gp-kapital">
                {kapital.map((k, i) => (
                  <div key={k.id} className={`gp-kapital-karte st-${k.status}`} style={{ ["--i" as any]: i }}>
                    <small>{k.artText}</small>
                    <b>{k.institut || k.artText}</b>
                    {k.produkt && <em>{k.produkt}</em>}
                    <div className="gp-kapital-fuss">
                      {k.betragCents != null && <strong>{globalUsd(k.betragCents, s)}</strong>}
                      <span className={`gp-marke st-${k.status}`}>{k.statusText}</span>
                    </div>
                    {(k.beantragtAm || k.hinweis) && <p>{[k.beantragtAm ? w.beantragt(tagKurz(k.beantragtAm)) : "", k.hinweis].filter(Boolean).join(" · ")}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

              </div>}
              {seite === "vertrag" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
          {/* ── Vertrag, Zahlungsplan, Garantie ── */}
          <section id="gp-vertrag" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2"><ShieldCheck size={20} strokeWidth={1.5} /> {a.angebot ? `${ANGEBOT_MEIN_AUFTRAG.titel} ${a.angebot.ref}` : w.auftragTitel}</h2>
            {a.angebot && (
              <>
                <ul className="gp-teile">
                  {(a.angebot.teile as T[]).map((x) => (
                    <li key={x.nr}>
                      <div><b>{x.titel}</b><small>{(x.betragCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €{x.hinweis ? ` — ${x.hinweis}` : x.nr === 2 && x.stand === "noch nicht fällig" ? ` — ${ANGEBOT_MEIN_AUFTRAG.teil2Hinweis}` : ""}</small></div>
                      <span className={`gp-marke ${x.stand === "bezahlt" ? "gruen" : "blau"}`}>{ANGEBOT_MEIN_AUFTRAG.stand[x.stand] ?? x.stand}</span>
                    </li>
                  ))}
                </ul>
                <p className="gp-satz">{a.angebot.garantieSatz ? a.angebot.garantieSatz : a.angebot.garantieErfuelltAm ? ANGEBOT_MEIN_AUFTRAG.garantieErfuellt(a.angebot.garantieErfuelltAm) : a.angebot.erstattungAusgeloest ? ANGEBOT_MEIN_AUFTRAG.erstattung : a.angebot.fristBeginn && a.angebot.fristEnde ? ANGEBOT_MEIN_AUFTRAG.frist(a.angebot.fristBeginn, a.angebot.fristEnde) : ANGEBOT_MEIN_AUFTRAG.fristNochNicht}</p>
              </>
            )}
            {a.stichtag && <p className="gp-satz">{t.stichtag}: <b>{tag(a.stichtag)}</b></p>}
            {/* E-334 (Fall Hildbrand): Sofortstart zeigt die Wahl des Kunden — nie die Widerrufsfrist als Behauptung. */}
            {a.widerruf && (a.widerruf.sofortBeginn ? (
              <p className="gp-satz" data-fiaon="mein-auftrag-start-sofort"><b>{t.startSofort}</b> {a.status === "offen" ? t.startSofortOffen : t.startSofortLaeuft}</p>
            ) : (
              <p className="gp-satz">{t.widerrufBis}: <b>{tag(a.widerruf.fristEnde)}</b>{(a.status === "offen" || a.status === "bezahlt") && <> · {t.startNachFrist(tag(a.widerruf.startAb))}</>}</p>
            ))}
            {!hatAuftragsblock && <p className="gp-satz">{a.paketName} · {a.ref}</p>}
          </section>

                  </main>
                  <aside className="gp-seite">
          <div className="gp-karte gp-auftauchen">
            <span className="gp-auge">{w.auftragTitel}</span>
            <p className="gp-paket">{a.paketName}</p>
            {preisText && !/^0\s?€$|^€\s?0$/.test(preisText.trim()) && <p className="gp-preis">{preisText}</p>}
            <dl className="gp-daten"><Zeile k={t.seiteReferenz} v={a.ref} /></dl>
            {/* E-407: Kapital-Angebot — Jahresbetreuung aus Ziffer 6 (verlängert sich, kündbar zum Jahresende), nicht der Paket-Satz. */}
            {a.angebot?.jahresZeile ? (
              <div className="gp-jahr"><b>{J.titel}</b><small>{a.angebot.jahresZeile}</small></div>
            ) : a.jahresbetreuung ? (
              <div className="gp-jahr"><b>{J.titel}</b><p>{J.gebucht}</p><small>{J.bedingungen}</small></div>
            ) : a.status !== "storniert" && <p className="gp-leise">{t.jahrSpaeter(J.titel, J.preisZeile)}</p>}
            <p className="gp-leise klein">{a.angebot ? (a.angebot.seiteHinweis ?? ANGEBOT_MEIN_AUFTRAG.seiteHinweis) : t.seiteHinweis}</p>
          </div>
                  </aside>
                </div>
              )}
              {(seite === "strategie" || seite === "recht" || seite === "steuern") && (
                <div className="gp-haupt">
                  {seite === "steuern" && (
          <section id="gp-fristen" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2"><CalendarClock size={20} strokeWidth={1.5} /> {w.fristenTitel}</h2>
            <p className="gp-lead">{w.fristenLead}</p>
            {(a.fristen ?? []).length === 0 ? <p className="gp-leise">{a.status === "offen" ? w.fristenNachZahlung : t.fristenLeer}</p> : (
              <ul className="gp-fristen">
                {(a.fristen as T[]).map((f) => {
                  const tage = Math.round((new Date(f.faelligAm + "T12:00:00").getTime() - new Date(new Date().toDateString()).getTime() - 12 * 3600_000) / 86_400_000);
                  return (
                    <li key={f.id} className={f.erledigt ? "erledigt" : tage < 0 ? "faellig" : tage <= 30 ? "bald" : ""}>
                      <span className="gp-frist-datum"><b>{new Date(f.faelligAm + "T12:00:00").toLocaleDateString(loc, { day: "2-digit" })}</b><small>{new Date(f.faelligAm + "T12:00:00").toLocaleDateString(loc, { month: "short", year: "numeric" })}</small></span>
                      <div><b>{f.titel}</b>{f.hinweis && <small>{f.hinweis}</small>}</div>
                      <span className="gp-marke">{f.erledigt ? t.erledigt : tage < 0 ? w.ueber(-tage) : w.inTagen(tage)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

                  )}
                  <Suspense fallback={<div className="gp-abschnitt"><Loader2 size={18} className="gp-dreht" /></div>}>
                    <GlobalFach bereich={seite} a={a} s={s} mitToken={mitToken} vorschau={vorschau} laden={laden} geh={geh} />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="gp-fuss"><Lock size={12} /> {w.fusszeile}</footer>

      {dialog && (
        <UnterschriftDialog dok={dialog} s={s} vorschau={vorschau} gruss={vollerName}
          url={mitToken(`/dokument/${encodeURIComponent(String(dialog.id))}`)}
          sendenUrl={mitToken(`/unterschrift/${encodeURIComponent(String(dialog.id))}`)}
          onFertig={() => void laden()} onZu={() => setDialog(null)} />
      )}
    </div>
  );
}

function DokZeile({ titel, unter, href, Icon, marke, aktion }: {
  titel: string; unter?: string; href: string; Icon: any; marke?: { text: string; ton: string }; aktion?: { text: string; los: () => void };
}) {
  return (
    <div className="gp-dok">
      <span className="gp-dok-icon"><Icon size={17} strokeWidth={1.6} /></span>
      <a className="gp-dok-text" href={href} target="_blank" rel="noopener"><b>{titel}</b>{unter && <small>{unter}</small>}</a>
      {marke && <span className={`gp-marke ${marke.ton}`}>{marke.text}</span>}
      {aktion ? <button type="button" className="gp-knopf klein" onClick={aktion.los}><PenLine size={13} /> {aktion.text}</button>
        : <a className="gp-dok-pfeil" href={href} target="_blank" rel="noopener" aria-label={titel}><ArrowRight size={16} /></a>}
    </div>
  );
}

function Zeile({ k, v, kopie, kopiert, w }: { k: string; v?: string | null; kopie?: () => void; kopiert?: boolean; w?: typeof W.de }) {
  if (!v) return null;
  return (
    <div className="gp-zeile">
      <dt>{k}</dt>
      <dd>
        <span>{v}</span>
        {kopie && <button type="button" className="gp-kopie" onClick={kopie} aria-label={`${k} kopieren`}>{kopiert ? <><Check size={12} /> {w?.kopiert}</> : <Copy size={12} />}</button>}
      </dd>
    </div>
  );
}
