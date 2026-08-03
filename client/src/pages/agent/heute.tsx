// ═══════════════════════════════════════════════════════════════════════════
// /agent/heute — der Arbeitstag eines Agenten
//
// Der Nachfolger der offenen Kartei. Der Unterschied ist nicht die Optik: In
// der Kartei suchte sich der Agent Akten aus einem gemeinsamen Bestand. Hier
// bekommt er seine Kunden zugewiesen, nach Dringlichkeit sortiert, und sieht zu
// jedem, WARUM er dort steht und was zu tun ist.
//
// ══ MOBILE FIRST, UND ZWAR ERNST ══════════════════════════════════════════
// Agenten telefonieren. Sie sitzen nicht am Schreibtisch, sie halten ein Handy.
// Deshalb: Telefonnummer als `tel:`-Link direkt auf der Karte, Aktionen als
// grosse Flächen mit einem Fingertipp, Detail als Vollbild statt als Dialog.
//
// ══ OPTIMISTIC UI MIT ECHTEM RÜCKWEG ══════════════════════════════════════
// Ein Tipp auf „Nicht erreicht" wirkt sofort — die Karte fliegt raus, bevor der
// Server geantwortet hat. Schlägt der Aufruf fehl, kommt sie zurück UND es gibt
// eine Meldung. Ein optimistisches UI ohne Rückweg ist eine Lüge: Der Agent
// glaubt, dokumentiert zu haben, und der Eintrag existiert nicht.
//
// ══ NULL SICHTBARKEIT FREMDER AGENTEN ═════════════════════════════════════
// Keine Zahl auf dieser Seite bezieht sich auf jemand anderen. Kein Name, keine
// Rangliste, kein Gesamtbestand. Der Server liefert das gar nicht — die
// Oberfläche muss nichts verstecken.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, ChevronDown,
  Clock, Info, Mail, Megaphone, PhoneCall, PhoneOff, Search, X,
} from "lucide-react";
import {
  Haken, Skelett, Tilt, ToastAnbieter, Zahl, ZeitAngabe,
  datum, eintritt, eur, useReduzierteBewegung, useToast,
} from "@/lib/fiaon-ui";

// ───────────────────────────────────────────────────────────────────────────
async function apiF(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

type Kunde = {
  personId: number; name: string; telefon: string | null; email: string | null;
  tier: number; tierGrund: string; titel: string; hinweis: string;
  zusagedatum: string | null; wiedervorlage: string | null;
  nichtErreicht: number; rechnungVersandt: number; rechnungWarnung: string | null;
  gesperrt: boolean; seit: string | null;
  letzteAktivitaet: { am: string } | null;
};

/** Farbe je Dringlichkeit. Tier 1 rot, Tier 2 gelb, Tier 3 grau. */
function tierFarbe(tier: number) {
  return tier === 1 ? "var(--fi-tier1)" : tier === 2 ? "var(--fi-tier2)" : "var(--fi-tier3)";
}
function tierTint(tier: number) {
  return tier === 1 ? "#fef2f2" : tier === 2 ? "var(--fi-warnung-tint)" : "#f1f5f9";
}

/** Tage zwischen heute und einem Datum in der Vergangenheit. */
function tageSeit(wert: string | null): number {
  if (!wert) return 0;
  const d = new Date(wert);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

// ═══════════════════════════════════════════════════════════════════════════
function Seite() {
  const { zeige } = useToast();
  const reduziert = useReduzierteBewegung();
  const [laedt, setLaedt] = useState(true);
  const [zahlen, setZahlen] = useState<any>(null);
  const [vorname, setVorname] = useState("");
  const [eskalationTage, setEskalationTage] = useState(7);

  const [heute, setHeute] = useState<Kunde[]>([]);
  const [ohneDatum, setOhneDatum] = useState<Kunde[]>([]);
  const [ueberfaellig, setUeberfaellig] = useState<Kunde[]>([]);

  const [tab, setTab] = useState<1 | 2 | 3>(1);
  const [liste, setListe] = useState<Kunde[]>([]);
  const [listeLaedt, setListeLaedt] = useState(false);
  const [suche, setSuche] = useState("");
  const [grundFilter, setGrundFilter] = useState<string>("");

  const [detail, setDetail] = useState<number | null>(null);

  // ── Laden ────────────────────────────────────────────────────────────────
  const ladeKopf = useCallback(async () => {
    const [d, h, o, u] = await Promise.all([
      apiF("/agent/crm/dashboard"),
      apiF("/agent/crm/kunden?state=heute"),
      apiF("/agent/crm/kunden?state=ohne_datum"),
      apiF("/agent/crm/kunden?state=ueberfaellig"),
    ]);
    if (d.ok) {
      setZahlen(d.json.zahlen);
      setVorname(d.json.agent?.vorname || "");
      setEskalationTage(d.json.eskalationNachTagen ?? 7);
    }
    if (h.ok) setHeute(h.json.kunden);
    if (o.ok) setOhneDatum(o.json.kunden);
    if (u.ok) setUeberfaellig(u.json.kunden);
    setLaedt(false);
  }, []);

  useEffect(() => { ladeKopf(); }, [ladeKopf]);

  const ladeListe = useCallback(async () => {
    setListeLaedt(true);
    const p = new URLSearchParams({ tier: String(tab) });
    if (suche.trim().length >= 2) p.set("q", suche.trim());
    if (grundFilter) p.set("reason", grundFilter);
    const r = await apiF(`/agent/crm/kunden?${p}`);
    if (r.ok) setListe(r.json.kunden);
    setListeLaedt(false);
  }, [tab, suche, grundFilter]);

  useEffect(() => {
    const t = setTimeout(ladeListe, suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [ladeListe, suche]);

  // ── Aktion mit optimistischer Anzeige und echtem Rückweg ─────────────────
  const handle = useCallback(async (
    kunde: Kunde,
    pfad: string,
    body: any,
    erfolgstext: string,
  ) => {
    // Sofort aus allen Abschnitten entfernen — die Karte ist erledigt.
    const zurueck = { heute, ohneDatum, ueberfaellig, liste };
    const raus = (l: Kunde[]) => l.filter((k) => k.personId !== kunde.personId);
    setHeute(raus); setOhneDatum(raus); setUeberfaellig(raus); setListe(raus);

    const r = await apiF(`/agent/crm/kunden/${kunde.personId}${pfad}`, {
      method: "POST", body: JSON.stringify(body),
    });

    if (r.ok) {
      zeige("erfolg", erfolgstext, kunde.name);
      // Zahlen neu holen, aber ohne Ladezustand — die Seite darf nicht blinken.
      apiF("/agent/crm/dashboard").then((d) => d.ok && setZahlen(d.json.zahlen));
    } else {
      // Rückweg: Die Karten kommen zurück, und der Agent erfährt warum.
      setHeute(zurueck.heute); setOhneDatum(zurueck.ohneDatum);
      setUeberfaellig(zurueck.ueberfaellig); setListe(zurueck.liste);
      zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen.");
    }
  }, [heute, ohneDatum, ueberfaellig, liste, zeige]);

  const gruende = useMemo(() => {
    const s = new Set<string>();
    for (const k of liste) s.add(k.tierGrund);
    // Array.from statt Spread: Das Übersetzungsziel des Projekts erlaubt kein
    // direktes Iterieren über ein Set.
    return Array.from(s).sort();
  }, [liste]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--fi-seite)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="max-w-[720px] mx-auto px-4 pt-6">

        {/* ── 1 · Begrüßung + Kennzahlen ──────────────────────────────── */}
        <motion.div {...eintritt(reduziert)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
                <span className="fi-gradient-text">
                  {laedt ? "Guten Tag" : `Guten Tag${vorname ? `, ${vorname}` : ""}`}
                </span>
              </h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
                {laedt ? "Lade deinen Tag …"
                  : zahlen?.heuteFaellig > 0
                    ? `${zahlen.heuteFaellig} Kunden warten heute auf deinen Anruf.`
                    : "Heute steht nichts Fälliges an. Sieh dir unten deine Listen an."}
              </p>
            </div>
            <Link href="/agent/updates"
                  className="shrink-0 relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-white text-[12px] font-semibold
                             transition-transform duration-150 active:scale-[0.96]"
                  style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
              <Megaphone size={13} /> Neuigkeiten
            </Link>
          </div>
        </motion.div>

        {/* Stat-Row — waagrecht scrollbar auf schmalen Geräten */}
        <div className="mt-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2.5 min-w-max pb-1">
            {laedt
              ? [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-[124px] p-3 rounded-2xl bg-white border shrink-0" style={{ borderColor: "var(--fi-linie)" }}>
                    <Skelett h={10} w="70%" />
                    <div className="mt-2.5"><Skelett h={24} w="45%" /></div>
                  </div>
                ))
              : [
                  { titel: "Heute fällig", wert: zahlen?.heuteFaellig ?? 0, farbe: "var(--fi-tier1)" },
                  { titel: "Zahlung gemeldet", wert: zahlen?.ohneDatum ?? 0, farbe: "var(--fi-warnung)" },
                  { titel: "Überfällig", wert: zahlen?.ueberfaellig ?? 0, farbe: "var(--fi-fehler)" },
                  { titel: "Liegengeblieben", wert: zahlen?.eskalation ?? 0, farbe: "var(--fi-tier3)" },
                  { titel: "Abschlüsse 30 Tg.", wert: zahlen?.abschluesse30Tage ?? 0, farbe: "var(--fi-erfolg)", suffix: "" },
                ].map((k, i) => (
                  <motion.div key={k.titel} {...eintritt(reduziert, i, 50)} className="shrink-0">
                    <Tilt className="w-[124px] p-3 rounded-2xl bg-white border" style={{ borderColor: "var(--fi-linie)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide leading-tight" style={{ color: "var(--fi-text-still)" }}>
                        {k.titel}
                      </p>
                      <p className="mt-1.5 text-[24px] font-bold leading-none" style={{ color: k.farbe }}>
                        <Zahl wert={k.wert} />
                      </p>
                    </Tilt>
                  </motion.div>
                ))}
          </div>
        </div>

        {zahlen?.neuHeute > 0 && (
          <motion.div {...eintritt(reduziert)}
            className="mt-3 p-3 rounded-2xl border flex items-center gap-2.5"
            style={{ background: "var(--fi-tint)", borderColor: "var(--fi-border-aktiv)" }}>
            <CheckCircle2 size={16} style={{ color: "var(--fi-primaer)" }} />
            <p className="text-[12.5px]" style={{ color: "var(--fi-text)" }}>
              <span className="font-bold">{zahlen.neuHeute} neue Kunden</span> sind heute zu dir gekommen.
            </p>
          </motion.div>
        )}

        {/* ── 2 · HERO: Heute fällig ──────────────────────────────────── */}
        <Abschnitt
          titel="Heute fällig"
          ikon={PhoneCall}
          farbe="var(--fi-tier1)"
          anzahl={heute.length}
          laedt={laedt}
          leer="Kein Kunde ist heute fällig. Gut gearbeitet."
          hero
        >
          <AnimatePresence mode="popLayout">
            {heute.map((k, i) => (
              <KundenKarte key={k.personId} kunde={k} index={i} hero
                           onAktion={handle} onDetail={() => setDetail(k.personId)} />
            ))}
          </AnimatePresence>
        </Abschnitt>

        {/* ── 3 · Zahlung gemeldet, Geld fehlt ────────────────────────── */}
        <Abschnitt
          titel="Zahlung gemeldet, Geld fehlt"
          ikon={AlertTriangle}
          farbe="var(--fi-warnung)"
          anzahl={ohneDatum.length}
          laedt={laedt}
          leer="Keine offenen Prüffälle."
          erklaerung="Diese Kunden haben selbst angegeben, bezahlt zu haben — das Geld ist aber nicht angekommen. Prüfen und freundlich nachfassen. Ein Zahlungsdatum ist hier optional."
        >
          <AnimatePresence mode="popLayout">
            {ohneDatum.map((k, i) => (
              <KundenKarte key={k.personId} kunde={k} index={i}
                           onAktion={handle} onDetail={() => setDetail(k.personId)} />
            ))}
          </AnimatePresence>
        </Abschnitt>

        {/* ── 4 · Überfällig ─────────────────────────────────────────── */}
        <Abschnitt
          titel="Überfällig"
          ikon={CalendarClock}
          farbe="var(--fi-fehler)"
          anzahl={ueberfaellig.length}
          laedt={laedt}
          leer="Keine überfällige Zusage."
          erklaerung={`Das zugesagte Zahlungsdatum ist verstrichen. Bleibt ein Kunde länger als ${eskalationTage} Tage ohne dokumentierten Kontakt, wird er als liegengeblieben markiert.`}
        >
          <AnimatePresence mode="popLayout">
            {ueberfaellig.map((k, i) => (
              <KundenKarte key={k.personId} kunde={k} index={i} zeigeVerzug
                           onAktion={handle} onDetail={() => setDetail(k.personId)} />
            ))}
          </AnimatePresence>
        </Abschnitt>

        {/* ── 5 · Alle Kunden, nach Priorität ────────────────────────── */}
        <div className="mt-8">
          <h2 className="text-[15px] font-bold" style={{ color: "var(--fi-text)" }}>Alle meine Kunden</h2>

          <div className="mt-3 flex gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--fi-linie)" }}>
            {([1, 2, 3] as const).map((t) => {
              const anzahl = t === 1 ? zahlen?.tier1 : t === 2 ? zahlen?.tier2 : zahlen?.tier3;
              const ist = tab === t;
              return (
                <button key={t} onClick={() => { setTab(t); setGrundFilter(""); }}
                        className="relative px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-border-aktiv)] rounded-t-lg"
                        style={{ color: ist ? tierFarbe(t) : "var(--fi-text-leise)" }}>
                  Priorität {t}
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold fi-zahl"
                        style={{ background: ist ? tierTint(t) : "#f1f5f9", color: ist ? tierFarbe(t) : "var(--fi-text-still)" }}>
                    {anzahl ?? 0}
                  </span>
                  {ist && (
                    <motion.div layoutId="agent-tier-indikator"
                      className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full"
                      style={{ background: tierFarbe(t) }}
                      transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 32 }} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border flex-1 min-w-[200px]"
                 style={{ borderColor: "var(--fi-linie)" }}>
              <Search size={14} style={{ color: "var(--fi-text-still)" }} />
              <input value={suche} onChange={(e) => setSuche(e.target.value)}
                     placeholder="Name, E-Mail oder Telefon …"
                     className="flex-1 text-[13px] outline-none bg-transparent" />
              {suche && (
                <button onClick={() => setSuche("")} aria-label="Suche löschen">
                  <X size={13} style={{ color: "var(--fi-text-still)" }} />
                </button>
              )}
            </div>
            {gruende.length > 1 && (
              <select value={grundFilter} onChange={(e) => setGrundFilter(e.target.value)}
                      className="px-2.5 py-2 rounded-xl bg-white border text-[12.5px] outline-none"
                      style={{ borderColor: "var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                <option value="">Alle Gründe</option>
                {gruende.map((g) => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
              </select>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            {listeLaedt ? (
              [0, 1, 2, 3].map((i) => <KartenSkelett key={i} />)
            ) : liste.length === 0 ? (
              <LeerHinweis text={suche ? "Keine Treffer." : "Keine Kunden in dieser Priorität."} />
            ) : (
              <AnimatePresence mode="popLayout">
                {liste.map((k, i) => (
                  <KundenKarte key={k.personId} kunde={k} index={i}
                               zeigeRechnung={k.tier === 2}
                               onAktion={handle} onDetail={() => setDetail(k.personId)} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* ── 6 · Detail als Slide-over / Vollbild ────────────────────────── */}
      <AnimatePresence>
        {detail !== null && (
          <KundenDetail personId={detail} onSchliessen={() => setDetail(null)}
                        onGeaendert={() => { ladeKopf(); ladeListe(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Abschnitt mit Kopf, Zähler und aufklappbarer Erklärung
// ═══════════════════════════════════════════════════════════════════════════
function Abschnitt({
  titel, ikon: Ikon, farbe, anzahl, laedt, leer, erklaerung, hero, children,
}: {
  titel: string; ikon: any; farbe: string; anzahl: number; laedt: boolean;
  leer: string; erklaerung?: string; hero?: boolean; children: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const reduziert = useReduzierteBewegung();

  return (
    <motion.section {...eintritt(reduziert)} className={hero ? "mt-6" : "mt-7"}>
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${farbe}14` }}>
          <Ikon size={15} style={{ color: farbe }} />
        </span>
        <h2 className={`font-bold ${hero ? "text-[17px]" : "text-[15px]"}`} style={{ color: "var(--fi-text)" }}>
          {titel}
        </h2>
        {!laedt && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold fi-zahl"
                style={{ background: `${farbe}14`, color: farbe }}>
            {anzahl}
          </span>
        )}
        {erklaerung && (
          <button onClick={() => setOffen((o) => !o)} aria-label="Erklärung"
                  className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100">
            <Info size={14} style={{ color: "var(--fi-text-still)" }} />
          </button>
        )}
      </div>

      {erklaerung && (
        <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
             style={{ gridTemplateRows: offen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <p className="mt-2 p-3 rounded-xl text-[12.5px] leading-relaxed"
               style={{ background: "#fff", color: "var(--fi-text-leise)", border: "1px solid var(--fi-linie)" }}>
              {erklaerung}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {laedt ? [0, 1].map((i) => <KartenSkelett key={i} />)
          : anzahl === 0 ? <LeerHinweis text={leer} />
          : children}
      </div>
    </motion.section>
  );
}

function LeerHinweis({ text }: { text: string }) {
  return (
    <div className="py-7 text-center rounded-2xl bg-white border" style={{ borderColor: "var(--fi-linie)" }}>
      <div className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center" style={{ background: "var(--fi-erfolg-tint)" }}>
        <Haken groesse={18} />
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--fi-text-leise)" }}>{text}</p>
    </div>
  );
}

/** Geometrie exakt wie die echte Karte — sonst springt das Layout beim Laden. */
function KartenSkelett() {
  return (
    <div className="p-4 rounded-2xl bg-white border" style={{ borderColor: "var(--fi-linie)" }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <Skelett h={15} w="52%" />
          <Skelett h={11} w="38%" />
        </div>
        <Skelett h={22} w={78} />
      </div>
      <div className="mt-3 flex gap-2">
        <Skelett h={38} w="25%" /><Skelett h={38} w="25%" />
        <Skelett h={38} w="25%" /><Skelett h={38} w="25%" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Kundenkarte — Telefon, Grund, Handlungshinweis, Aktionen
// ═══════════════════════════════════════════════════════════════════════════
function KundenKarte({
  kunde, index, hero, zeigeVerzug, zeigeRechnung, onAktion, onDetail,
}: {
  kunde: Kunde; index: number; hero?: boolean; zeigeVerzug?: boolean; zeigeRechnung?: boolean;
  onAktion: (k: Kunde, pfad: string, body: any, text: string) => Promise<void>;
  onDetail: () => void;
}) {
  const reduziert = useReduzierteBewegung();
  const { zeige } = useToast();
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [datumOffen, setDatumOffen] = useState(false);
  const [datumWert, setDatumWert] = useState("");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehlerShake, setFehlerShake] = useState(false);
  const [blitz, setBlitz] = useState<string | null>(null);

  const verzug = zeigeVerzug ? tageSeit(kunde.zusagedatum) : 0;

  const fuehreAus = async (art: string, pfad: string, body: any, text: string, blitzFarbe: string) => {
    setLaeuft(art);
    setBlitz(blitzFarbe);
    await onAktion(kunde, pfad, body, text);
    setLaeuft(null);
  };

  const rechnungSenden = async () => {
    setLaeuft("rechnung");
    const r = await apiF(`/agent/crm/kunden/${kunde.personId}/rechnung`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    if (r.ok) {
      zeige(r.json.warnung ? "info" : "erfolg", "Zahlungsdetails versandt",
        r.json.warnung || `An ${r.json.versandtAn}`);
    } else {
      setFehlerShake(true);
      setTimeout(() => setFehlerShake(false), 320);
      zeige("fehler", "Nicht versandt", r.json?.error || "Bitte erneut versuchen.");
    }
  };

  return (
    <motion.div
      layout={!reduziert}
      {...eintritt(reduziert, Math.min(index, 10), 35)}
      exit={reduziert
        ? { opacity: 0 }
        : { opacity: 0, x: 40, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
      className={`relative rounded-2xl bg-white border overflow-hidden ${fehlerShake ? "fi-shake" : ""}`}
      style={{ borderColor: "var(--fi-linie)", boxShadow: "var(--fi-schatten-ruhe)" }}
    >
      {/* Erfolgs-Blitz: die Karte färbt sich kurz, bevor sie hinausgleitet */}
      <AnimatePresence>
        {blitz && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{ background: blitz }} />
        )}
      </AnimatePresence>

      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: tierFarbe(kunde.tier) }} />

      <div className="p-4 pl-5">
        <div className="flex items-start gap-3">
          <button onClick={onDetail} className="flex-1 min-w-0 text-left">
            <p className={`font-bold truncate ${hero ? "text-[16px]" : "text-[14.5px]"}`} style={{ color: "var(--fi-text)" }}>
              {kunde.name || "Ohne Namen"}
            </p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: tierTint(kunde.tier), color: tierFarbe(kunde.tier) }}>
                {kunde.titel}
              </span>
              {kunde.zusagedatum && (
                <span className="text-[11px] fi-zahl" style={{ color: verzug > 0 ? "var(--fi-fehler)" : "var(--fi-text-still)" }}>
                  {verzug > 0 ? `${verzug} Tg. überfällig` : `zahlt am ${datum(kunde.zusagedatum)}`}
                </span>
              )}
              {kunde.nichtErreicht > 0 && (
                <span className="text-[11px]" style={{ color: "var(--fi-text-still)" }}>
                  {kunde.nichtErreicht}× nicht erreicht
                </span>
              )}
            </div>
          </button>

          {/* Telefon als grosse Tippfläche — das Wichtigste auf der Karte */}
          {kunde.telefon ? (
            <a href={`tel:${kunde.telefon.replace(/\s/g, "")}`}
               className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold text-white
                          transition-transform duration-150 active:scale-[0.95]"
               style={{ background: "linear-gradient(180deg, var(--fi-erfolg), #047857)" }}>
              <PhoneCall size={14} /> Anrufen
            </a>
          ) : (
            <span className="shrink-0 px-2.5 py-2 rounded-xl text-[11px] font-semibold"
                  style={{ background: "#f1f5f9", color: "var(--fi-text-still)" }}>
              keine Nummer
            </span>
          )}
        </div>

        {/* Handlungshinweis, aufklappbar */}
        <button onClick={() => setHinweisOffen((o) => !o)}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: "var(--fi-primaer)" }}>
          <ChevronDown size={13} className="transition-transform duration-200"
                       style={{ transform: hinweisOffen ? "rotate(180deg)" : "none" }} />
          {hinweisOffen ? "Hinweis schließen" : "Was ist hier zu tun?"}
        </button>
        <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
             style={{ gridTemplateRows: hinweisOffen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <p className="mt-2 p-3 rounded-xl text-[12.5px] leading-relaxed"
               style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
              {kunde.hinweis}
            </p>
          </div>
        </div>

        {/* One-Tap-Aktionen */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Aktion label="Erreicht" ikon={CheckCircle2} farbe="var(--fi-erfolg)"
                  laeuft={laeuft === "erreicht"} disabled={!!laeuft}
                  onClick={() => fuehreAus("erreicht", "/aktivitaet", { art: "erreicht" },
                    "Als erreicht dokumentiert", "var(--fi-erfolg-tint)")} />
          <Aktion label="Nicht erreicht" ikon={PhoneOff} farbe="var(--fi-warnung)"
                  laeuft={laeuft === "nicht"} disabled={!!laeuft}
                  onClick={() => fuehreAus("nicht", "/aktivitaet", { art: "nicht_erreicht" },
                    "Nicht erreicht — morgen erneut", "var(--fi-warnung-tint)")} />
          <Aktion label="Zahlt am …" ikon={CalendarClock} farbe="var(--fi-primaer)"
                  laeuft={laeuft === "zusage"} disabled={!!laeuft}
                  onClick={() => setDatumOffen((o) => !o)} />
          <Aktion label="Blockiert" ikon={Ban} farbe="var(--fi-fehler)"
                  laeuft={laeuft === "blockiert"} disabled={!!laeuft}
                  onClick={() => fuehreAus("blockiert", "/aktivitaet", { art: "blockiert" },
                    "Kunde will nicht kontaktiert werden", "var(--fi-fehler-tint)")} />
        </div>

        {/* Datumsfeld für die Zusage */}
        <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
             style={{ gridTemplateRows: datumOffen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="mt-2.5 p-3 rounded-xl flex flex-wrap items-center gap-2" style={{ background: "var(--fi-seite)" }}>
              <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>
                Zahlt am
              </label>
              <input type="date" value={datumWert} onChange={(e) => setDatumWert(e.target.value)}
                     min={new Date().toISOString().slice(0, 10)}
                     className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                     style={{ borderColor: "var(--fi-linie)" }} />
              <button
                disabled={!datumWert || !!laeuft}
                onClick={() => fuehreAus("zusage", "/zusage", { datum: datumWert },
                  `Zusage für ${datum(datumWert)} notiert`, "var(--fi-tint)")}
                className="px-3 py-2 rounded-lg text-[12px] font-bold text-white transition-transform duration-150
                           active:scale-[0.96] disabled:opacity-40"
                style={{ background: "var(--fi-primaer)" }}>
                Speichern
              </button>
            </div>
          </div>
        </div>

        {/* Zahlungsdetails senden — nur auf Tier-2-Karten */}
        {zeigeRechnung && (
          <div className="mt-2.5 pt-2.5 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "var(--fi-linie)" }}>
            <button onClick={rechnungSenden} disabled={!!laeuft}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-bold
                               transition-transform duration-150 active:scale-[0.96] disabled:opacity-50"
                    style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
              <Mail size={13} /> {laeuft === "rechnung" ? "Sende …" : "Zahlungsdetails senden"}
            </button>
            {kunde.rechnungVersandt > 0 && (
              <span className="text-[11px] fi-zahl"
                    style={{ color: kunde.rechnungWarnung ? "var(--fi-fehler)" : "var(--fi-text-still)" }}>
                {kunde.rechnungVersandt}× versandt
              </span>
            )}
            {kunde.rechnungWarnung && (
              <p className="text-[11px] w-full leading-relaxed" style={{ color: "var(--fi-fehler)" }}>
                {kunde.rechnungWarnung}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Aktion({
  label, ikon: Ikon, farbe, onClick, laeuft, disabled,
}: { label: string; ikon: any; farbe: string; onClick: () => void; laeuft: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[11.5px] font-bold
                       transition-transform duration-150 active:scale-[0.95] disabled:opacity-40
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-border-aktiv)]"
            style={{ borderColor: "var(--fi-linie)", color: farbe }}>
      {laeuft ? <Clock size={15} className="animate-spin" /> : <Ikon size={15} />}
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Detail — mobil Vollbild, auf breiten Geräten Slide-over von rechts
// ═══════════════════════════════════════════════════════════════════════════
function KundenDetail({
  personId, onSchliessen, onGeaendert,
}: { personId: number; onSchliessen: () => void; onGeaendert: () => void }) {
  const reduziert = useReduzierteBewegung();
  const { zeige } = useToast();
  const [daten, setDaten] = useState<any>(null);
  const [notiz, setNotiz] = useState("");
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    apiF(`/agent/crm/kunden/${personId}`).then((r) => {
      if (r.ok) setDaten(r.json);
      else {
        zeige("fehler", "Kunde nicht gefunden", "Er gehört möglicherweise nicht mehr zu dir.");
        onSchliessen();
      }
    });
  }, [personId, zeige, onSchliessen]);

  // Escape schließt — auf dem Desktop die erwartete Geste.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onSchliessen(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onSchliessen]);

  const notizSpeichern = async () => {
    if (!notiz.trim()) return;
    setSpeichert(true);
    const r = await apiF(`/agent/crm/kunden/${personId}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art: "notiz", notiz: notiz.trim() }),
    });
    setSpeichert(false);
    if (r.ok) {
      setNotiz("");
      zeige("erfolg", "Notiz gespeichert");
      apiF(`/agent/crm/kunden/${personId}`).then((x) => x.ok && setDaten(x.json));
      onGeaendert();
    } else {
      zeige("fehler", "Nicht gespeichert", r.json?.error);
    }
  };

  const k = daten?.kunde;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-slate-900/40"
        onClick={onSchliessen}
      />
      <motion.div
        initial={reduziert ? { opacity: 0 } : { x: "100%" }}
        animate={reduziert ? { opacity: 1 } : { x: 0 }}
        exit={reduziert ? { opacity: 0 } : { x: "100%" }}
        transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 36 }}
        className="relative w-full sm:max-w-[520px] h-full bg-white overflow-y-auto"
        style={{ boxShadow: "-8px 0 32px rgba(15,23,42,0.12)" }}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3"
             style={{ borderColor: "var(--fi-linie)" }}>
          <button onClick={onSchliessen} aria-label="Zurück"
                  className="w-9 h-9 rounded-xl border flex items-center justify-center transition-transform active:scale-[0.94]"
                  style={{ borderColor: "var(--fi-linie)" }}>
            <ArrowLeft size={16} style={{ color: "var(--fi-text-leise)" }} />
          </button>
          <p className="text-[15px] font-bold truncate flex-1" style={{ color: "var(--fi-text)" }}>
            {k?.name ?? "Lade …"}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {!daten ? (
            <>
              <Skelett h={18} w="60%" /><Skelett h={12} w="40%" />
              <div className="pt-3 space-y-2"><Skelett h={54} /><Skelett h={54} /><Skelett h={54} /></div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                      style={{ background: tierTint(k.tier), color: tierFarbe(k.tier) }}>
                  {k.titel}
                </span>
                {k.gesperrt && (
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                        style={{ background: "var(--fi-fehler-tint)", color: "var(--fi-fehler)" }}>
                    blockiert
                  </span>
                )}
              </div>
              <p className="text-[12.5px] leading-relaxed p-3 rounded-xl"
                 style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
                {k.hinweis}
              </p>

              <div className="flex gap-2">
                {k.telefon && (
                  <a href={`tel:${k.telefon.replace(/\s/g, "")}`}
                     className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold text-white"
                     style={{ background: "linear-gradient(180deg, var(--fi-erfolg), #047857)" }}>
                    <PhoneCall size={14} /> {k.telefon}
                  </a>
                )}
                {k.email && (
                  <a href={`mailto:${k.email}`}
                     className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-[13px] font-bold"
                     style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
                    <Mail size={14} />
                  </a>
                )}
              </div>

              {/* Bestellungen */}
              {daten.bestellungen.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--fi-text-still)" }}>
                    Bestellungen
                  </p>
                  <div className="space-y-1.5">
                    {daten.bestellungen.map((b: any) => (
                      <div key={b.ref} className="p-2.5 rounded-xl border flex items-center gap-2" style={{ borderColor: "var(--fi-linie)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--fi-text)" }}>
                            {b.produkt ?? "Produkt unbekannt"}
                          </p>
                          <p className="text-[10.5px]" style={{ color: "var(--fi-text-still)" }}>
                            {b.zahlungsreferenz ?? b.ref} · {b.status}
                          </p>
                        </div>
                        <span className="text-[12.5px] font-bold fi-zahl" style={{ color: "var(--fi-text)" }}>
                          {eur(b.betragCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notiz */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--fi-text-still)" }}>
                  Notiz hinzufügen
                </p>
                <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={3}
                          placeholder="Was wurde besprochen?"
                          className="w-full p-3 rounded-xl border text-[13px] outline-none resize-none"
                          style={{ borderColor: "var(--fi-linie)" }} />
                <button onClick={notizSpeichern} disabled={!notiz.trim() || speichert}
                        className="mt-2 px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white
                                   transition-transform duration-150 active:scale-[0.96] disabled:opacity-40"
                        style={{ background: "var(--fi-primaer)" }}>
                  {speichert ? "Speichere …" : "Notiz speichern"}
                </button>
              </div>

              {/* Timeline über ALLE Antragszeilen der Person */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--fi-text-still)" }}>
                  Verlauf
                </p>
                {daten.verlauf.length === 0 ? (
                  <p className="text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>
                    Noch kein dokumentierter Kontakt.
                  </p>
                ) : (
                  <div className="relative pl-4">
                    <span aria-hidden="true" className="absolute left-[3px] top-1 bottom-1 w-[1.5px]"
                          style={{ background: "var(--fi-linie)" }} />
                    <div className="space-y-3">
                      {daten.verlauf.map((v: any, i: number) => (
                        <motion.div key={v.id} {...eintritt(reduziert, Math.min(i, 8), 25)} className="relative">
                          <span aria-hidden="true" className="absolute -left-4 top-1.5 w-[7px] h-[7px] rounded-full"
                                style={{ background: v.art === "system" ? "var(--fi-tier3)" : "var(--fi-primaer)" }} />
                          <p className="text-[12px] font-semibold" style={{ color: "var(--fi-text)" }}>
                            {v.ergebnis ? String(v.ergebnis).replace(/_/g, " ") : v.art === "system" ? "System" : "Notiz"}
                            {v.zusagedatum && ` · zahlt am ${datum(v.zusagedatum)}`}
                          </p>
                          {v.notiz && (
                            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                              {v.notiz}
                            </p>
                          )}
                          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--fi-text-still)" }}>
                            <ZeitAngabe wert={v.am} />{v.von ? ` · ${v.von}` : ""}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function AgentHeute() {
  return (
    <ToastAnbieter>
      <Seite />
    </ToastAnbieter>
  );
}
