import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "wouter";
import {
  CreditCard, Banknote, ChevronRight, Search, Landmark, HandCoins, Copy,
  Sparkles, AlertTriangle, RefreshCw, ArrowUpRight, ArrowDownRight, Users,
  CalendarClock, Megaphone, TrendingUp, Check, X,
} from "lucide-react";
import { ACCENT, ADMIN_NAV } from "@/components/admin/AdminShell";
import { Tip } from "@/components/admin/PageHelp";
import Cockpit from "@/components/admin/Cockpit";
import Detailfenster, { type ListenArt, type FensterReiter } from "@/components/admin/Detailfenster";
import RanglisteTeilen from "@/components/admin/RanglisteTeilen";

// ═══════════════════════════════════════════════════════════════════════════
// /admin — DIE LAGE IN EINEM BLICK
//
// Die Seite beantwortet in dieser Reihenfolge vier Fragen, weil in dieser
// Reihenfolge entschieden wird:
//   1. Was haben wir HEUTE verdient?            → Geldtafel (dunkel, ganz oben)
//   2. Was ist angekündigt, was ist zugesagt?   → vier Kennzahl-Kacheln
//   3. Was muss ich jetzt anfassen?             → „Was ist zu tun?"
//   4. Wer im Team bringt was?                  → Rangliste + Zusagen je Agent
// Danach erst Werkzeuge: Suche, KI-Cockpit, Seitenverzeichnis.
//
// Gestaltungsregel: EIN dunkles Element (das Geld), alles andere weiß mit
// Tiefe. Farbe nur als Kante. Wären die Kacheln bunt, hätte die eine Zahl,
// auf die es ankommt, keinen Vorrang mehr.
//
// Datenquellen: /admin/hub/lage (Umsatz, Provisionen, Ankündigungen, Zusagen)
// und /admin/hub/badges (Aufgaben + Warnungen). Zwei Abrufe, beide gecacht.
// ═══════════════════════════════════════════════════════════════════════════

// ── Datenform (Spiegel von computeLage in server/routes/fiaon-admin-hub.ts) ──
interface Betrag { anzahl: number; cents: number }
interface Zusage { gesamt: number; heuteFaellig: number; kuenftig: number; ueberfaellig: number; summeCents: number }
interface AgentLage {
  id: number; name: string; avatar: string | null;
  heuteCents: number; monatCents: number; gesamtCents: number;
  abschluesseMonat: number; abschluesseGesamt: number;
  zusagen: Zusage | null;
}
interface Lage {
  umsatz: { heute: Betrag; gestern: Betrag; monat: Betrag; gesamt: Betrag; verlauf: { tag: string; anzahl: number; cents: number }[] };
  provision: { heuteCents: number; monatCents: number; gesamtCents: number };
  agenten: AgentLage[];
  ankuendigungen: { heute: Betrag; gesamt: Betrag; alt: Betrag };
  zusagen: Zusage & { jeAgent: (Zusage & { name: string; agentId: number | null })[] };
  at: string;
}

// ── Zahlen ───────────────────────────────────────────────────────────────────
const eur = (cents: number) =>
  `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
/** Ohne Nachkommastellen — für Balken-Beschriftungen und enge Kacheln. */
const eurGlatt = (cents: number) =>
  `${Math.round(cents / 100).toLocaleString("de-DE")} €`;

function tagKurz(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

/** Veränderung gegenüber gestern in Prozent — null, wenn gestern 0 war (dann ist
 *  jede Prozentangabe eine Lüge: „+∞ %" hilft niemandem). */
function veraenderung(heute: number, gestern: number): number | null {
  if (gestern <= 0) return null;
  return Math.round(((heute - gestern) / gestern) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geldtafel — die eine Zahl, auf die es ankommt
// ═══════════════════════════════════════════════════════════════════════════
function Geldtafel({ lage, onZeigen }: { lage: Lage | null; onZeigen: (art: ListenArt) => void }) {
  if (!lage) {
    return <div className="a3-hero h-[232px] sm:h-[212px] mb-4 opacity-60" aria-busy="true" />;
  }
  const { umsatz, provision } = lage;
  const netto = umsatz.heute.cents - provision.heuteCents;
  const diff = veraenderung(umsatz.heute.cents, umsatz.gestern.cents);
  const maxTag = Math.max(1, ...umsatz.verlauf.map((v) => v.cents));

  // Hauptbetrag getrennt setzen: die Cents kleiner, damit die Euro-Zahl auf
  // einen Blick lesbar bleibt und der Betrag trotzdem exakt dasteht.
  const [ganz, rest] = eur(umsatz.heute.cents).replace(" €", "").split(",");

  return (
    <div className="a3-buehne mb-4">
      <section className="a3-hero p-5 sm:p-7">
        <div className="a3-hero-inhalt">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/45">
                Heute eingenommen
              </p>
              <p className="mt-1.5 font-bold tracking-[-.03em] leading-none a3-zahl">
                <span className="text-[42px] sm:text-[56px]">{ganz}</span>
                <span className="text-[22px] sm:text-[28px] text-white/55">,{rest} €</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                {/* Auch die Tafel ist eine Frage wert: WER hat heute bezahlt? */}
                <button type="button" onClick={() => onZeigen("bezahlt-heute")}
                  className="text-white/70 hover:text-white underline decoration-white/25 hover:decoration-white/70 underline-offset-2 transition-colors">
                  {umsatz.heute.anzahl} {umsatz.heute.anzahl === 1 ? "bestätigte Zahlung" : "bestätigte Zahlungen"} — wer?
                </button>
                {diff !== null && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: diff >= 0 ? "rgba(52,211,153,.16)" : "rgba(248,113,113,.16)",
                      color: diff >= 0 ? "#6ee7b7" : "#fca5a5",
                    }}
                  >
                    {diff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {diff > 0 ? "+" : ""}{diff} % zu gestern
                  </span>
                )}
                {diff === null && umsatz.gestern.cents === 0 && (
                  <span className="text-white/40">gestern kein Eingang</span>
                )}
              </div>
            </div>

            {/* 14-Tage-Verlauf: erst die Reihe sagt, ob heute gut oder schwach
                ist. Heute ist hell hervorgehoben, damit man den Bezugspunkt hat. */}
            <div className="w-full sm:w-auto">
              <div className="flex items-end gap-[3px] h-[62px]" role="img" aria-label="Umsatz der letzten 14 Tage">
                {umsatz.verlauf.map((v, i) => {
                  const heute = i === umsatz.verlauf.length - 1;
                  const hoehe = Math.max(3, Math.round((v.cents / maxTag) * 62));
                  return (
                    <span
                      key={v.tag}
                      title={`${tagKurz(v.tag)}: ${eur(v.cents)} (${v.anzahl})`}
                      className="w-[9px] sm:w-[11px] rounded-t-[3px] transition-[height] duration-500"
                      style={{
                        height: hoehe,
                        background: heute
                          ? "linear-gradient(180deg,#93c5fd,#3b82f6)"
                          : "linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,.13))",
                        boxShadow: heute ? "0 0 14px rgba(59,130,246,.65)" : "none",
                      }}
                    />
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10.5px] text-white/35 text-right">
                {tagKurz(umsatz.verlauf[0]?.tag || "")} – heute
              </p>
            </div>
          </div>

          {/* Drei Zahlen, die den Betrag darüber erklären: was ans Team geht,
              was bei uns bleibt, wo der Monat steht. */}
          <div className="mt-5 pt-4 grid grid-cols-3 gap-3" style={{ borderTop: "1px solid rgba(255,255,255,.10)" }}>
            {[
              { label: "Provision Team", wert: eur(provision.heuteCents), hilfe: "Was aus dem heutigen Umsatz an die Agenten gebucht wurde (Eigenabschlüsse, Team-Anteile, Boni; Stornos abgezogen)." },
              { label: "Bleibt bei uns", wert: eur(netto), hilfe: "Umsatz heute minus heute gebuchte Provisionen. Ohne Steuern und laufende Kosten — das ist der Rohüberschuss aus dem Tagesgeschäft." },
              { label: `Monat (${umsatz.monat.anzahl})`, wert: eur(umsatz.monat.cents), hilfe: "Bestätigte Zahlungen seit dem 1. des Monats, Berliner Zeit." },
            ].map((k) => (
              <div key={k.label} className="min-w-0">
                {/* Umbrechen statt abschneiden: „PROVISION T…" ist keine
                    Beschriftung, sondern ein Rätsel. */}
                <p className="text-[9.5px] sm:text-[10.5px] font-semibold uppercase tracking-[.08em] sm:tracking-[.12em] text-white/40 leading-tight">
                  {k.label}
                </p>
                <p className="mt-1 text-[14px] sm:text-[17px] font-bold a3-zahl leading-tight" title={k.hilfe}>
                  {k.wert}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Kennzahl-Kachel
// ═══════════════════════════════════════════════════════════════════════════
function Kachel({ onClick, label, wert, unter, ton, hilfe, icon: Icon, i }: {
  /** Kacheln navigieren NICHT weg: sie öffnen die Namen hinter der Zahl auf
   *  derselben Seite. Wegnavigieren hieß bisher: Kontext verlieren und
   *  anschließend den Weg zurück suchen. */
  onClick: () => void;
  label: string; wert: string; unter?: string;
  ton?: "geld" | "warnung" | "offen"; hilfe: string; icon: typeof CreditCard; i: number;
}) {
  return (
    <button type="button" onClick={onClick} className="a3-kachel a3-auf p-4 pl-[18px] text-left w-full"
      data-ton={ton} style={{ ["--i" as any]: i }}>
      {/* Beschriftung darf zweizeilig werden — auf 380px passt „Zusagen heute
          fällig" nicht in eine Zeile, und abgeschnitten ist sie wertlos. */}
      <span className="flex items-start gap-1.5">
        <Icon size={13} className="text-slate-400 shrink-0 mt-[1px]" />
        <span className="flex-1 min-w-0 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[.07em] text-slate-500 leading-tight">{label}</span>
        <Tip text={hilfe} />
      </span>
      <span className="block mt-2 text-[24px] sm:text-[27px] font-bold text-slate-900 tracking-[-.02em] leading-none a3-zahl">
        {wert}
      </span>
      {unter && <span className="block mt-1.5 text-[12px] text-slate-500 leading-snug">{unter}</span>}
      <span className="block mt-2 text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: ACCENT }}>
        Wer? <ChevronRight size={11} />
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// „Was ist zu tun?" — eine Liste, nach Dringlichkeit, jede Zeile mit Ausgang
// ═══════════════════════════════════════════════════════════════════════════
interface Aufgabe {
  href: string; anzahl: number | null; titel: string; erklaerung: string;
  aktion: string; stufe: "dringend" | "offen" | "ruhig"; icon: typeof CreditCard;
}

function AufgabenTafel({ aufgaben, geladen }: { aufgaben: Aufgabe[]; geladen: boolean }) {
  const kante = { dringend: "#dc2626", offen: "#d97706", ruhig: "#64748b" } as const;
  // Einklappbar mit gemerktem Zustand: Wer die Liste kennt, will darunter
  // schneller an Rangliste und Zahlen — muss sie aber jederzeit aufziehen
  // können. Der dringende Zähler bleibt im Kopf sichtbar, auch zugeklappt.
  const KEY = "fiaon-admin-aufgaben-offen";
  const [offen, setOffen] = useState(true);
  useEffect(() => {
    try { setOffen(localStorage.getItem(KEY) !== "zu"); } catch { /* gesperrt */ }
  }, []);
  const um = () => setOffen((v) => {
    const n = !v;
    try { localStorage.setItem(KEY, n ? "offen" : "zu"); } catch { /* gesperrt */ }
    return n;
  });
  const dringend = aufgaben.filter((a) => a.stufe === "dringend").length;

  return (
    <section className="a3-tafel mb-4">
      <header className="a3-tafel-kopf">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
          <Check size={15} strokeWidth={2.2} />
        </span>
        <button type="button" onClick={um} className="flex items-center gap-2 text-left min-w-0 flex-1">
          <h2 className="text-[14px] font-bold text-slate-900">Was ist zu tun?</h2>
          <ChevronRight size={14} className={`text-slate-400 transition-transform ${offen ? "rotate-90" : ""}`} />
        </button>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {dringend > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold"
              style={{ background: "rgba(220,38,38,.08)", color: "#dc2626" }}>
              {dringend} dringend
            </span>
          )}
          <span className="text-[11.5px] font-semibold text-slate-400 a3-zahl">
            {geladen ? `${aufgaben.length} ${aufgaben.length === 1 ? "Punkt" : "Punkte"}` : "…"}
          </span>
        </span>
      </header>

      {!offen && (
        <button type="button" onClick={um} className="w-full px-[18px] py-2.5 text-left text-[12px] text-slate-400 hover:text-slate-600">
          {geladen && aufgaben.length > 0 ? "Liste anzeigen" : geladen ? "Nichts offen — Liste anzeigen" : "…"}
        </button>
      )}

      {offen && !geladen && <p className="px-[18px] py-6 text-[13px] text-slate-400">Wird geprüft …</p>}

      {offen && geladen && aufgaben.length === 0 && (
        <div className="px-[18px] py-8 text-center">
          <span className="inline-flex w-11 h-11 rounded-full items-center justify-center mb-2.5"
            style={{ background: "var(--fi-flaeche-erfolg,#ecfdf5)", color: "#059669" }}>
            <Check size={20} strokeWidth={2.4} />
          </span>
          <p className="text-[13.5px] font-bold text-slate-800">Nichts liegen geblieben.</p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Keine offenen Zahlungen, keine unverbuchten Eingänge, keine Warnungen.
          </p>
        </div>
      )}

      {offen && aufgaben.map((a, i) => (
        <Link
          key={`${a.href}-${a.titel}`}
          href={a.href}
          className="group flex items-start gap-3 px-[18px] py-3.5 hover:bg-slate-50/80 transition-colors a3-auf"
          style={{ ["--i" as any]: i, boxShadow: "inset 0 -1px 0 rgba(226,232,240,.75)", borderLeft: `3px solid ${kante[a.stufe]}` }}
        >
          {a.anzahl !== null ? (
            <span className="shrink-0 min-w-[30px] h-[26px] px-1.5 rounded-lg flex items-center justify-center text-[13px] font-bold a3-zahl"
              style={{ background: "#f1f5f9", color: "#334155", boxShadow: "inset 0 1px 0 #fff, 0 1px 2px rgba(15,23,42,.10)" }}>
              {a.anzahl}
            </span>
          ) : (
            <span className="shrink-0 w-[26px] h-[26px] rounded-lg flex items-center justify-center"
              style={{ background: "#fef2f2", color: kante[a.stufe] }}>
              <AlertTriangle size={13} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-slate-900 leading-snug">{a.titel}</span>
            <span className="block text-[12px] text-slate-500 leading-snug mt-0.5">{a.erklaerung}</span>
          </span>
          <span className="shrink-0 hidden sm:inline-flex items-center gap-1 mt-0.5 text-[12px] font-semibold"
            style={{ color: ACCENT }}>
            {a.aktion} <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      ))}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Team-Rangliste — bester zuerst, mit Balken statt Diagramm
// ═══════════════════════════════════════════════════════════════════════════
type Zeitraum = "heute" | "monat" | "gesamt";

function Rangliste({ agenten }: { agenten: AgentLage[] }) {
  const [zeit, setZeit] = useState<Zeitraum>("monat");
  const feld = zeit === "heute" ? "heuteCents" : zeit === "monat" ? "monatCents" : "gesamtCents";

  // Nach dem gewählten Zeitraum neu ordnen — sonst zeigt „Heute" die Reihenfolge
  // des Monats und die Rangzahl lügt.
  const liste = useMemo(
    () => [...agenten].sort((a, b) => (b as any)[feld] - (a as any)[feld]),
    [agenten, feld],
  );
  const max = Math.max(1, ...liste.map((a) => (a as any)[feld] as number));
  const summe = liste.reduce((s, a) => s + ((a as any)[feld] as number), 0);

  return (
    <section className="a3-tafel mb-4">
      <header className="a3-tafel-kopf">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
          <Users size={15} />
        </span>
        <h2 className="text-[14px] font-bold text-slate-900">Was die Agenten verdient haben</h2>
        <Tip text="Gebuchte Provision — genau die Summe, die auch die Team-Übersicht zeigt: bestätigt + in Auszahlung + ausgezahlt. Stornierte Buchungen zählen nicht, Rückbuchungen mindern den Betrag. Enthalten sind Eigenabschlüsse, Anteile aus dem eigenen Team, Boni und manuelle Buchungen. Der Zeitpunkt ist der Tag der BUCHUNG (Berliner Zeit) — eine nachgebuchte Altzahlung erscheint also am Tag des Nachbuchens. Testkonten sind ausgeblendet." />
        {/* Teilen zuerst: das ist die Handlung, die man hier ausführen will. */}
        <span className="ml-auto shrink-0"><RanglisteTeilen /></span>
        {/* Umschalter: Tag / Monat / Gesamt. Segment-Optik, damit klar ist, dass
            genau eine der drei Angaben gerade gilt. */}
        <div className="flex rounded-lg p-0.5 shrink-0" style={{ background: "#eef2f7", boxShadow: "inset 0 1px 2px rgba(15,23,42,.07)" }}>
          {(["heute", "monat", "gesamt"] as Zeitraum[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZeit(z)}
              className="px-2.5 py-1 rounded-[6px] text-[11.5px] font-semibold capitalize transition-all"
              style={zeit === z
                ? { background: "#fff", color: "#0f172a", boxShadow: "0 1px 2px rgba(15,23,42,.14)" }
                : { color: "#64748b" }}
            >
              {z}
            </button>
          ))}
        </div>
      </header>

      {liste.length === 0 && (
        <p className="px-[18px] py-6 text-[13px] text-slate-400">Keine aktiven Agenten.</p>
      )}

      {liste.map((a, i) => {
        const wert = (a as any)[feld] as number;
        const abschluesse = zeit === "gesamt" ? a.abschluesseGesamt : zeit === "monat" ? a.abschluesseMonat : null;
        return (
          <div
            key={a.id}
            className="px-[18px] py-3 a3-auf"
            style={{ ["--i" as any]: i, boxShadow: "inset 0 -1px 0 rgba(226,232,240,.75)" }}
          >
            <div className="flex items-center gap-3">
              <span className="a3-rang shrink-0" data-platz={i + 1}>{i + 1}</span>
              <Link
                href={`/admin/leistung?agent=${a.id}`}
                className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-900 truncate hover:underline decoration-slate-300"
              >
                {a.name}
              </Link>
              <span className="shrink-0 text-[14px] font-bold text-slate-900 a3-zahl">{eur(wert)}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="a3-balken flex-1" data-ton={wert === 0 ? "hell" : undefined}>
                <span style={{ width: `${Math.round((wert / max) * 100)}%` }} />
              </span>
              <span className="shrink-0 text-[11px] text-slate-400 a3-zahl text-right whitespace-nowrap">
                {abschluesse !== null && `${abschluesse} Abschl. · `}
                {summe > 0 ? `${Math.round((wert / summe) * 100)} %` : "—"}
              </span>
            </div>
          </div>
        );
      })}

      {liste.length > 0 && (
        <div className="px-[18px] py-2.5 flex items-center justify-between text-[12px]" style={{ background: "#fbfcfe" }}>
          <span className="text-slate-500">
            Team gesamt · {zeit === "heute" ? "heute" : zeit === "monat" ? "diesen Monat" : "seit Beginn"}
          </span>
          <span className="font-bold text-slate-900 a3-zahl">{eur(summe)}</span>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Zahlungszusagen — „Kunde zahlt am …", aufgenommen vom Agenten
// ═══════════════════════════════════════════════════════════════════════════
function Zusagen({ lage, onZeigen }: { lage: Lage; onZeigen: (art: ListenArt) => void }) {
  const z = lage.zusagen;
  if (z.gesamt === 0) {
    return null;
  }
  return (
    <section className="a3-tafel mb-4">
      <header className="a3-tafel-kopf">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
          <CalendarClock size={15} />
        </span>
        <h2 className="text-[14px] font-bold text-slate-900">Zahlungszusagen der Agenten</h2>
        <Tip text={'Termine, die ein Agent im Gespräch aufgenommen hat („Kunde zahlt am …"). Pro Kunde zählt nur die jüngste Zusage; bereits bezahlte oder stornierte Bestellungen sind heraus. Überfällig heißt: Termin verstrichen, Geld nicht da.'} />
        <span className="ml-auto text-[11.5px] font-semibold text-slate-400 a3-zahl">{eur(z.summeCents)} offen</span>
      </header>

      {/* Jede der drei Zahlen führt in die dazugehörige Namensliste. */}
      <div className="grid grid-cols-3" style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.75)" }}>
        {([
          { label: "Heute fällig", wert: z.heuteFaellig, farbe: "#1d4ed8", art: "zusagen-heute" as ListenArt },
          { label: "Später", wert: z.kuenftig, farbe: "#64748b", art: "zusagen-alle" as ListenArt },
          { label: "Überfällig", wert: z.ueberfaellig, farbe: "#dc2626", art: "zusagen-ueberfaellig" as ListenArt },
        ]).map((s) => (
          <button key={s.label} type="button" onClick={() => onZeigen(s.art)}
            className="px-[18px] py-3 text-center hover:bg-slate-50/80 transition-colors"
            style={{ boxShadow: "inset -1px 0 0 rgba(226,232,240,.75)" }}>
            <p className="text-[22px] font-bold a3-zahl leading-none" style={{ color: s.farbe }}>{s.wert}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-400 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {z.jeAgent.map((a, i) => (
        <div key={`${a.name}-${i}`} className="px-[18px] py-2.5 flex items-center gap-3 a3-auf"
          style={{ ["--i" as any]: i, boxShadow: "inset 0 -1px 0 rgba(226,232,240,.75)" }}>
          <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-800 truncate">{a.name}</span>
          <span className="shrink-0 flex items-center gap-1.5 text-[11.5px] font-semibold a3-zahl">
            {a.heuteFaellig > 0 && (
              <span className="px-1.5 py-0.5 rounded-md" style={{ background: "rgba(29,78,216,.08)", color: "#1d4ed8" }}>
                {a.heuteFaellig} heute
              </span>
            )}
            {a.kuenftig > 0 && (
              <span className="px-1.5 py-0.5 rounded-md" style={{ background: "#f1f5f9", color: "#475569" }}>
                {a.kuenftig} später
              </span>
            )}
            {a.ueberfaellig > 0 && (
              <span className="px-1.5 py-0.5 rounded-md" style={{ background: "rgba(220,38,38,.08)", color: "#dc2626" }}>
                {a.ueberfaellig} überfällig
              </span>
            )}
          </span>
          <span className="shrink-0 w-[76px] text-right text-[12px] text-slate-500 a3-zahl">{eurGlatt(a.summeCents)}</span>
        </div>
      ))}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Suche — findet Kunden UND Seiten. Zwei Suchfelder für zwei Dinge wären ein
// Rätsel; hier ist ein Feld die Antwort auf „wo war das nur?".
// ═══════════════════════════════════════════════════════════════════════════
const ALLE_SEITEN = ADMIN_NAV.flatMap((g) =>
  g.items.map((it) => ({ ...it, gruppe: g.title || "Start" })),
);

function Suche() {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [offen, setOffen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const huelle = useRef<HTMLDivElement>(null);

  const seiten = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return ALLE_SEITEN.filter((p) =>
      p.label.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s) || p.gruppe.toLowerCase().includes(s),
    ).slice(0, 4);
  }, [q]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setTreffer([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/fiaon/admin/search?q=${encodeURIComponent(q.trim())}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        setTreffer(res.ok && json?.ok ? json.results : []);
      } finally { setBusy(false); }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  // Klick daneben schließt die Liste — sonst bleibt sie über dem Inhalt kleben.
  useEffect(() => {
    const zu = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, []);

  const zeigen = offen && q.trim().length >= 2;

  return (
    <div className="relative mb-4" ref={huelle}>
      <div
        className="flex items-center gap-2.5 px-4 bg-white rounded-2xl border transition-colors"
        style={{ borderColor: zeigen ? ACCENT : "var(--a3-linie,#e4e9f2)" }}
      >
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffen(true); }}
          onFocus={() => setOffen(true)}
          placeholder="Kunde oder Seite finden — Name, E-Mail, Telefon, Referenz …"
          className="w-full py-3.5 text-[14px] outline-none placeholder:text-slate-400 bg-transparent border-0 focus:ring-0"
          style={{ boxShadow: "none" }}
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setOffen(false); }} className="shrink-0 text-slate-300 hover:text-slate-500" aria-label="Suche leeren">
            <X size={15} />
          </button>
        )}
        <kbd className="hidden sm:block text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
      </div>

      {zeigen && (
        <div className="absolute inset-x-0 top-full mt-1.5 z-30 bg-white rounded-2xl border overflow-hidden max-h-[420px] overflow-y-auto"
          style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
          {seiten.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Seiten</p>
              {seiten.map((p) => (
                <Link key={p.path} href={p.path} onClick={() => setOffen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <span className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                    <p.icon size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-slate-800 truncate">{p.label}</span>
                    <span className="block text-[11px] text-slate-400 truncate">{p.gruppe}</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-300" />
                </Link>
              ))}
            </>
          )}

          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Kunden</p>
          {busy && <p className="px-4 pb-3 text-[12px] text-slate-400">Suche …</p>}
          {!busy && treffer.length === 0 && (
            <p className="px-4 pb-3 text-[12px] text-slate-400">
              Keine Treffer — Schreibweise prüfen oder mit der Referenz suchen (FIAON-…).
            </p>
          )}
          {treffer.map((r, i) => (
            <a key={i} href={r.url} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <span className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                {r.type === "agent" ? <Users size={13} /> : <CreditCard size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800 truncate">{r.label}</span>
                <span className="block text-[11px] text-slate-400 truncate">{r.sub}</span>
              </span>
              <ChevronRight size={14} className="text-slate-300" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Seitenverzeichnis — direkt aus ADMIN_NAV erzeugt. Dadurch KANN keine Seite
// fehlen: wer einen Menüpunkt anlegt, hat ihn hier automatisch mit.
// ═══════════════════════════════════════════════════════════════════════════
function Bereiche({ badges }: { badges: Record<string, number> }) {
  const [filter, setFilter] = useState("");
  const s = filter.trim().toLowerCase();

  const gruppen = ADMIN_NAV
    .map((g) => ({
      titel: g.title,
      items: g.items.filter((it) =>
        it.path !== "/admin" &&
        (s.length === 0 || it.label.toLowerCase().includes(s) || it.desc.toLowerCase().includes(s)),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const anzahl = gruppen.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="a3-tafel">
      <header className="a3-tafel-kopf">
        <h2 className="text-[14px] font-bold text-slate-900">Alle Bereiche</h2>
        <span className="text-[11.5px] text-slate-400 a3-zahl">{anzahl} Seiten</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filtern …"
          className="ml-auto w-[130px] sm:w-[190px] px-3 py-1.5 rounded-lg border text-[12px] outline-none bg-white"
          style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
        />
      </header>

      <div className="p-3.5 sm:p-4 space-y-5">
        {gruppen.map((g) => (
          <div key={g.titel || "start"}>
            {g.titel && (
              <p className="px-1 pb-2 text-[10.5px] font-bold uppercase tracking-[.13em] text-slate-400">{g.titel}</p>
            )}
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((it, i) => {
                const zahl = it.badgeKey ? badges[it.badgeKey] || 0 : 0;
                return (
                  <Link key={it.path} href={it.path} className="a3-kachel a3-auf p-3.5 flex items-start gap-3"
                    style={{ ["--i" as any]: Math.min(i, 8) }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(180deg,#fff,#f1f5f9)", color: "#475569", boxShadow: "inset 0 1px 0 #fff, 0 1px 3px rgba(15,23,42,.12)" }}>
                      <it.icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-900 truncate">{it.label}</span>
                        {zahl > 0 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white a3-zahl"
                            style={{ background: ACCENT }}>
                            {zahl > 99 ? "99+" : zahl}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{it.desc}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {anzahl === 0 && <p className="text-[13px] text-slate-400 px-1">Kein Bereich passt zu „{filter}".</p>}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Anleitung — bewusst am ENDE und zugeklappt.
//
// Vorher stand die Erklärung ganz oben und war aufgeklappt: auf dem Handy war
// damit der komplette erste Bildschirm Hilfetext, und der Tagesumsatz — der
// Grund, diese Seite zu öffnen — lag unter der Falte. Hilfe gehört dorthin, wo
// man sie sucht, nicht vor das, was man täglich braucht.
// ═══════════════════════════════════════════════════════════════════════════
function Anleitung() {
  const KEY = "fiaon-help-dashboard-v2";
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    try { setOffen(localStorage.getItem(KEY) === "open"); } catch { /* gesperrt */ }
  }, []);
  const um = () => setOffen((v) => {
    const n = !v;
    try { localStorage.setItem(KEY, n ? "open" : "closed"); } catch { /* gesperrt */ }
    return n;
  });

  const schritte = [
    "Die dunkle Tafel oben: was heute wirklich eingegangen ist — mit Vergleich zu gestern und den letzten 14 Tagen als Balken. „Bleibt bei uns“ ist der Umsatz minus der heute gebuchten Team-Provision.",
    "Die vier Kacheln zeigen Geld, das noch NICHT da ist: angekündigte Zahlungen (der Kunde sagt, er habe überwiesen) und Zusagen (der Agent hat einen Termin aufgenommen). Deshalb stehen sie getrennt vom Umsatz.",
    "„Was ist zu tun?“: jede Zeile eine Aufgabe mit direktem Ausgang. Rote Kante heißt: kostet Geld, wenn es liegen bleibt. Leere Liste heißt: nichts offen.",
    "Die Rangliste zeigt die gebuchten Provisionen je Agent — umschaltbar auf Heute, Monat, Gesamt. Die Reihenfolge folgt der Auswahl, damit Platz 1 immer stimmt.",
    "Zahlen mit ⓘ erklären sich per Klick. Alle Tagesgrenzen sind Berliner Zeit, nicht UTC.",
    "Ganz unten ist jede Seite der Verwaltung verzeichnet — mit Filter. Das Suchfeld findet Kunden UND Seiten, jederzeit auch mit ⌘K.",
  ];

  return (
    <div className="mt-4 rounded-xl border bg-white overflow-hidden" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
      <button type="button" onClick={um} className="w-full px-4 py-2.5 flex items-center gap-2 text-left">
        <span className="text-[12.5px] font-semibold text-slate-600 flex-1">Wie liest du diese Seite?</span>
        <ChevronRight size={14} className={`text-slate-400 transition-transform ${offen ? "rotate-90" : ""}`} />
      </button>
      {offen && (
        <ol className="px-4 pb-3.5 space-y-1.5" style={{ boxShadow: "inset 0 1px 0 rgba(226,232,240,.8)" }}>
          {schritte.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[12.5px] text-slate-600 leading-relaxed first:pt-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10.5px] font-bold flex items-center justify-center mt-[1px]">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Welche Sichten gehören zu welcher Kachel — an EINER Stelle, damit Kachel,
// Fenstertitel und Erklärung nicht auseinanderlaufen können.
// ═══════════════════════════════════════════════════════════════════════════
const FENSTER: Record<string, {
  reiter: FensterReiter[]; titel: string; hinweis: string; alleLink: string; alleLabel: string;
}> = {
  angekuendigt: {
    reiter: [
      { art: "angekuendigt-heute", label: "Heute" },
      { art: "angekuendigt-alle", label: "Alle" },
      { art: "angekuendigt-alt", label: "Älter als 7 Tage" },
    ],
    titel: "Wer hat eine Zahlung angekündigt?",
    hinweis: "Diese Kunden haben gemeldet, dass sie überwiesen haben — bestätigt ist noch keiner. Ältester zuerst.",
    alleLink: "/admin/zahlungen?status=claimed_paid",
    alleLabel: "In der Zahlungszentrale freischalten",
  },
  zusagen: {
    reiter: [
      { art: "zusagen-heute", label: "Heute fällig" },
      { art: "zusagen-ueberfaellig", label: "Überfällig" },
      { art: "zusagen-alle", label: "Alle" },
    ],
    titel: "Wer hat zugesagt zu zahlen?",
    hinweis: "Termine, die Agenten im Gespräch aufgenommen haben. Pro Kunde die jüngste Zusage; bezahlte sind heraus.",
    alleLink: "/admin/kunden",
    alleLabel: "Alle Kunden durchsehen",
  },
  bezahlt: {
    reiter: [
      { art: "bezahlt-heute", label: "Heute" },
      { art: "bezahlt-monat", label: "Dieser Monat" },
    ],
    titel: "Wer hat bezahlt?",
    hinweis: "Bestätigte Zahlungen — das ist der Umsatz, der oben in der Tafel steht.",
    alleLink: "/admin/verbuchungen",
    alleLabel: "Tagesfinanzen öffnen",
  },
};

function fensterFuer(art: ListenArt) {
  const gruppe = art.startsWith("angekuendigt") ? "angekuendigt" : art.startsWith("zusagen") ? "zusagen" : "bezahlt";
  return { ...FENSTER[gruppe], start: art };
}

// ═══════════════════════════════════════════════════════════════════════════
// Seite
// ═══════════════════════════════════════════════════════════════════════════
export default function AdminHubPage() {
  const [lage, setLage] = useState<Lage | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [warn, setWarn] = useState<any>(null);
  const [geladen, setGeladen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [stand, setStand] = useState<Date | null>(null);
  // Welche Detailliste liegt gerade über der Seite? null = keine.
  const [fenster, setFenster] = useState<ListenArt | null>(null);

  const holen = useCallback(async () => {
    setLaedt(true);
    try {
      const [l, b] = await Promise.all([
        fetch("/api/fiaon/admin/hub/lage", { credentials: "include" }).then((r) => r.json()).catch(() => null),
        fetch("/api/fiaon/admin/hub/badges", { credentials: "include" }).then((r) => r.json()).catch(() => null),
      ]);
      if (l?.ok) setLage(l);
      if (b?.ok) { setBadges(b.badges || {}); setWarn(b.warn || null); }
      setStand(new Date());
      setGeladen(true);
    } finally { setLaedt(false); }
  }, []);

  useEffect(() => { void holen(); }, [holen]);

  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";

  // ── Aufgaben: Warnungen zuerst (die kosten Geld), dann Zähler ──────────────
  const aufgaben = useMemo<Aufgabe[]>(() => {
    const liste: Aufgabe[] = [];

    if ((warn?.paymentConfirmBacklog || 0) > 0) {
      liste.push({
        href: "/admin/zahlungen?status=claimed_paid", anzahl: warn.paymentConfirmBacklog,
        titel: "Kunden warten seit über 7 Tagen auf die Bestätigung ihrer Zahlung",
        erklaerung: `Sie haben „Ich habe überwiesen" gemeldet${warn.paymentConfirmOldestDays ? ` (ältester Fall: vor ${warn.paymentConfirmOldestDays} Tagen)` : ""}. Hier liegt sehr wahrscheinlich Umsatz, der noch nicht verbucht ist.`,
        aktion: "prüfen", stufe: "dringend", icon: CreditCard,
      });
    }
    if ((badges.kontoabgleich || 0) > 0) {
      liste.push({
        href: "/admin/kontoabgleich", anzahl: badges.kontoabgleich,
        titel: "Bank-Eingänge ohne Zuordnung",
        erklaerung: "Geld ist auf dem Konto, aber keinem Kunden zugeordnet — bis dahin gilt der Kunde als unbezahlt.",
        aktion: "abgleichen", stufe: "dringend", icon: Landmark,
      });
    }
    if ((warn?.bankMatchedUnapplied || 0) > 0) {
      liste.push({
        href: "/admin/verbuchung", anzahl: warn.bankMatchedUnapplied,
        titel: "Zugeordnete Eingänge noch nicht verbucht",
        erklaerung: "Zuordnung steht, die Buchung fehlt. Erst mit ihr wird der Kunde freigeschaltet und die Provision fällig.",
        aktion: "verbuchen", stufe: "dringend", icon: HandCoins,
      });
    }
    if ((badges.zahlungen || 0) > 0) {
      liste.push({
        href: "/admin/zahlungen", anzahl: badges.zahlungen,
        titel: "Angekündigte Zahlungen warten auf Freischaltung",
        erklaerung: "Der Kunde hat die Überweisung gemeldet. Nach Prüfung des Eingangs freischalten.",
        aktion: "öffnen", stufe: "offen", icon: Megaphone,
      });
    }
    if ((badges.auszahlungen || 0) > 0) {
      liste.push({
        href: "/admin/zahlungen#auszahlungen", anzahl: badges.auszahlungen,
        titel: "Auszahlungen vom Team angefragt",
        erklaerung: "Agenten haben ihre Provision angefordert und warten auf die Freigabe.",
        aktion: "prüfen", stufe: "offen", icon: Banknote,
      });
    }
    if ((badges.nachbuchung || 0) > 0) {
      liste.push({
        href: "/admin/nachbuchung", anzahl: badges.nachbuchung,
        titel: "Bezahlte Bestellungen ohne Provision",
        erklaerung: "Der Kunde hat gezahlt, der Agent hat nichts bekommen — nachbuchen, bevor es auffällt.",
        aktion: "nachbuchen", stufe: "offen", icon: HandCoins,
      });
    }
    if ((badges.dubletten || 0) > 0) {
      liste.push({
        href: "/admin/dubletten", anzahl: badges.dubletten,
        titel: "Dubletten mit offenen Bestellungen",
        erklaerung: "Dieselbe Person mehrfach angelegt. Zusammenführen füllt fehlende Felder und ist umkehrbar.",
        aktion: "zusammenführen", stufe: "offen", icon: Copy,
      });
    }
    if ((badges.kuendigungen || 0) > 0) {
      liste.push({
        href: "/admin/kuendigungen", anzahl: badges.kuendigungen,
        titel: "Kündigungen offen",
        erklaerung: "Eingegangene Kündigungsanträge sind noch nicht bestätigt oder abgelehnt.",
        aktion: "bearbeiten", stufe: "offen", icon: X,
      });
    }
    if ((badges.feedback || 0) > 0) {
      liste.push({
        href: "/admin/agent-portal", anzahl: badges.feedback,
        titel: "Rückmeldungen vom Team warten auf Antwort",
        erklaerung: "Im Ticket-Verlauf steht der letzte Beitrag beim Agenten — er wartet auf dich.",
        aktion: "ansehen", stufe: "ruhig", icon: Sparkles,
      });
    }
    if ((warn?.criticalDiagnostics || 0) > 0) {
      liste.push({
        href: "/admin/diagnose", anzahl: warn.criticalDiagnostics,
        titel: "Kritische System-Ereignisse in den letzten 24 Stunden",
        erklaerung: "Zum Beispiel fehlgeschlagene E-Mails oder ausgefallener Lead-Eingang. Die Diagnose nennt Ursache und Reihenfolge.",
        aktion: "Diagnose", stufe: "dringend", icon: AlertTriangle,
      });
    }
    if (warn?.leadIntakeHours != null && warn.leadIntakeHours >= 24) {
      liste.push({
        href: "/admin/events", anzahl: null,
        titel: `Seit ${warn.leadIntakeHours} Stunden kein Lead-Eingang`,
        erklaerung: "Normalerweise kommen laufend Leads über Make. Prüfen, ob das Szenario läuft und der Webhook erreichbar ist.",
        aktion: "prüfen", stufe: "dringend", icon: AlertTriangle,
      });
    }
    if (warn?.followupPaused) {
      liste.push({
        href: "/admin/leads", anzahl: null,
        titel: "Nachfass-Automatik ist pausiert",
        erklaerung: "Interessenten bekommen derzeit KEINE automatischen Erinnerungen. Wenn das nicht gewollt ist, wieder einschalten.",
        aktion: "Einstellungen", stufe: "offen", icon: AlertTriangle,
      });
    }
    if ((warn?.blockedAkten || 0) > 0) {
      liste.push({
        href: "/admin/leads", anzahl: warn.blockedAkten,
        titel: `Offene Lead-Akten ohne Ergebnis${warn.blockedAktenAgent ? ` (u. a. bei ${warn.blockedAktenAgent})` : ""}`,
        erklaerung: "Ein Agent hat die Akte übernommen, aber nichts dokumentiert. Die Auto-Freigabe löst das selbst — man kann auch sofort freigeben.",
        aktion: "Leads öffnen", stufe: "ruhig", icon: AlertTriangle,
      });
    }
    return liste;
  }, [badges, warn]);

  const a = lage?.ankuendigungen;
  const z = lage?.zusagen;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Kopf: Begrüßung, Stand der Zahlen, Aktualisieren */}
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold text-slate-900 tracking-[-.02em]">{gruss}.</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            {stand && ` · Stand ${stand.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void holen()}
          disabled={laedt}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border text-[12.5px] font-semibold text-slate-600 disabled:opacity-50"
          style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
        >
          <RefreshCw size={13} className={laedt ? "animate-spin" : ""} /> Aktualisieren
        </button>
      </div>

      {/* 1. Geld */}
      <Geldtafel lage={lage} onZeigen={setFenster} />

      {/* 2. Angekündigt und zugesagt — Geld, das noch nicht da ist */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <Kachel
          i={0} onClick={() => setFenster("angekuendigt-heute")} icon={Megaphone}
          label="Heute angekündigt"
          wert={a ? String(a.heute.anzahl) : "—"}
          unter={a ? `${eurGlatt(a.heute.cents)} · Kunden melden Überweisung` : undefined}
          ton="offen"
          hilfe={'Kunden, die HEUTE gemeldet haben, dass sie überwiesen haben (Status „Zahlung angekündigt"). Noch kein Umsatz — erst nach Prüfung des Eingangs.'}
        />
        <Kachel
          i={1} onClick={() => setFenster("angekuendigt-alle")} icon={CreditCard}
          label="Angekündigt insgesamt"
          wert={a ? String(a.gesamt.anzahl) : "—"}
          unter={a ? `${eurGlatt(a.gesamt.cents)} offen${a.alt.anzahl > 0 ? ` · ${a.alt.anzahl} älter als 7 Tage` : ""}` : undefined}
          ton={a && a.alt.anzahl > 0 ? "warnung" : "offen"}
          hilfe="Alle noch nicht bestätigten Zahlungsankündigungen. Was älter als 7 Tage ist, ist verdächtig: entweder ist das Geld da und nicht verbucht, oder der Kunde hat nie überwiesen."
        />
        <Kachel
          i={2} onClick={() => setFenster("zusagen-heute")} icon={CalendarClock}
          label="Zusagen heute fällig"
          wert={z ? String(z.heuteFaellig) : "—"}
          unter={z ? `${z.ueberfaellig} überfällig · ${eurGlatt(z.summeCents)} Volumen` : undefined}
          ton={z && z.ueberfaellig > 0 ? "warnung" : undefined}
          hilfe={'Termine, die Agenten im Gespräch aufgenommen haben („Kunde zahlt am …"). Heute fällig heißt: heute muss das Geld kommen oder nachgefasst werden.'}
        />
        <Kachel
          i={3} onClick={() => setFenster("bezahlt-monat")} icon={TrendingUp}
          label="Monat bisher"
          wert={lage ? eurGlatt(lage.umsatz.monat.cents) : "—"}
          unter={lage ? `${lage.umsatz.monat.anzahl} Zahlungen · Provision ${eurGlatt(lage.provision.monatCents)}` : undefined}
          ton="geld"
          hilfe="Bestätigte Zahlungen seit dem 1. des Monats, dazu die im selben Zeitraum gebuchten Team-Provisionen."
        />
      </div>

      {/* 3. Arbeit */}
      <AufgabenTafel aufgaben={aufgaben} geladen={geladen} />

      {/* 4. Team */}
      {lage && <Rangliste agenten={lage.agenten} />}
      {lage && <Zusagen lage={lage} onZeigen={setFenster} />}

      {/* Werkzeuge */}
      <Suche />
      <div className="mb-4">
        <Cockpit />
      </div>
      <Bereiche badges={badges} />
      <Anleitung />

      {/* Die Detailliste zur angeklickten Kachel — über der Seite, nicht statt ihr. */}
      {fenster && <Detailfenster {...fensterFuer(fenster)} onClose={() => setFenster(null)} />}
    </div>
  );
}
