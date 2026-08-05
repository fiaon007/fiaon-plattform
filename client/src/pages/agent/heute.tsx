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

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { AgentShell } from "./shared";
import {
  Ebene, KURVE, Skelett, Tilt, ToastAnbieter, Zahl, ZeitAngabe,
  datum, eintritt, eur, useImBild, useReduzierteBewegung, useToast,
} from "@/lib/fiaon-ui";
import { LeerForm, ZeichenSchliessen, ZeichenSenden, ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";

// KEINE Icon-Bibliothek und KEINE Emojis. Symbole kommen aus `fiaon-zeichen`
// — fünf selbstgezeichnete SVG, alle nach denselben Regeln. Überall sonst
// steht Text. Farbe ist Information: Statuskante, Statuspunkt, Primäraktion.
// Nichts davon ist Dekoration.

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
  // Wählbare Nummer (mit Ländervorwahl) getrennt von der Anzeige: Eine Nummer
  // ohne Vorwahl soll man SEHEN, aber nicht wählen — sonst ruft das Telefon
  // eine Ortsnummer im eigenen Netz.
  telefonWaehlbar?: string | null;
  telefonHinweis?: string | null;
  stammdaten?: {
    strasse: string | null; plz: string | null; ort: string | null;
    land: string | null; geburtsdatum: string | null;
  } | null;
  zahlung?: {
    referenz: string | null; status: string | null; frist: string | null; ref: string | null;
  } | null;
  produkt: string | null; betrag: number | null;
  zusagedatum: string | null; wiedervorlage: string | null;
  nichtErreicht: number; rechnungVersandt: number; rechnungWarnung: string | null;
  gesperrt: boolean; seit: string | null;
  letzteAktivitaet: { am: string } | null;
};

/** Farbe je Dringlichkeit. Tier 1 rot, Tier 2 gelb, Tier 3 grau. */
function tierFarbe(tier: number) {
  return tier === 1 ? "var(--fi-tier1)" : tier === 2 ? "var(--fi-tier2)" : "var(--fi-tier3)";
}
/** Statusfläche: höchstens 3 % Deckkraft. Farbe informiert, sie färbt nicht. */
function tierFlaeche(tier: number) {
  return tier === 1 ? "var(--fi-flaeche-tier1)"
    : tier === 2 ? "var(--fi-flaeche-tier2)"
    : "var(--fi-flaeche-tier3)";
}

/** Tage zwischen heute und einem Datum in der Vergangenheit. */
function tageSeit(wert: string | null): number {
  if (!wert) return 0;
  const d = new Date(wert);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/**
 * Zeitangabe in Worten: „heute“, „morgen“, „in 3 Tagen“, „seit 5 Tagen
 * überfällig“. Das genaue Datum steht im `title` der Zeile.
 *
 * Gerechnet wird auf KALENDERTAGE, nicht auf 24-Stunden-Blöcke: Eine Zusage für
 * heute Abend ist „heute“, auch wenn sie rechnerisch 0,4 Tage entfernt ist. Mit
 * Millisekunden-Differenzen hätte am Nachmittag „in 0 Tagen“ dort gestanden.
 */
function relativerTag(wert: string | null): string {
  if (!wert) return "";
  const d = new Date(wert);
  if (isNaN(d.getTime())) return "";
  const heute = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate());
  const tage = Math.round((a - b) / 86_400_000);
  if (tage === 0) return "zahlt heute";
  if (tage === 1) return "zahlt morgen";
  if (tage === -1) return "seit gestern überfällig";
  if (tage > 1) return `zahlt in ${tage} Tagen`;
  return `seit ${Math.abs(tage)} Tagen überfällig`;
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
  const [tourOffen, setTourOffen] = useState(false);
  const [istTestkonto, setIstTestkonto] = useState(false);

  // Die Tour öffnet sich EINMAL pro Agent. Der Status liegt am Agenten in der
  // Datenbank, nicht im localStorage — sonst käme sie auf jedem neuen Gerät
  // wieder, und genau am Handy wäre sie am störendsten.
  const tourWegklicken = useCallback(() => {
    setTourOffen(false);
    apiF("/agent/crm/tour-gesehen", { method: "POST" }).catch(() => {});
  }, []);

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
      if (!d.json.tourGesehen) setTourOffen(true);
      setIstTestkonto(!!d.json.istTestkonto);
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
      // Der Server sagt, WAS sein Klick bewirkt hat („Mailbox besprochen — in
      // zwei Tagen erneut"). Diese Regel steht an einer Stelle im Server; sie
      // hier nochmal zu formulieren würde irgendwann abweichen.
      zeige("erfolg", r.json?.meldung || erfolgstext, kunde.name);
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
    <div className="pb-10">
      {/* 1180px statt 720: Auf dem Schreibtisch stand die Seite als schmale
          Säule mitten im Nichts. Die Karten dürfen atmen. */}
      <div className="mx-auto" style={{ maxWidth: "var(--fi-breite-max)" }}>
        <Willkommen offen={tourOffen} onFertig={tourWegklicken} />

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
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <Link href="/agent/updates"
                    className="inline-flex items-center px-2.5 py-1.5 rounded-xl border bg-white text-[12px] font-semibold
                               transition-transform duration-150 active:scale-[0.96]"
                    style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
                Neuigkeiten
              </Link>
              <button onClick={() => setTourOffen(true)}
                      className="text-[11px] underline underline-offset-2"
                      style={{ color: "var(--fi-text-still)" }}>
                Wie funktioniert das?
              </button>
            </div>
          </div>
        </motion.div>

        {/* ══ Kennzahlen ═══════════════════════════════════════════════════
            RASTER statt waagrechter Rolle. Vorher lagen fünf Karten in einer
            scrollbaren Reihe — auf dem Handy ragte die fünfte rechts aus dem
            Bild und sah wie ein Anschnittfehler aus. Niemand scrollt eine
            Kennzahlenreihe seitwärts, wenn sie nicht sichtbar überläuft.

            2 Spalten auf dem Handy, 5 ab sm. `items-stretch` hält alle Karten
            auf gleicher Höhe, auch wenn ein Titel zweizeilig bricht. */}
        <div className="mt-6 fi-buehne grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-stretch">
          {laedt
            ? [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`fi-karte p-4 ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
                  <Skelett h={10} w="70%" />
                  <div className="mt-4"><Skelett h={30} w="45%" /></div>
                </div>
              ))
            : [
                { titel: "Heute fällig", wert: zahlen?.heuteFaellig ?? 0, farbe: "var(--fi-tier1)" },
                { titel: "Zahlung gemeldet", wert: zahlen?.ohneDatum ?? 0, farbe: "var(--fi-tier2)" },
                { titel: "Überfällig", wert: zahlen?.ueberfaellig ?? 0, farbe: "var(--fi-tier1)" },
                { titel: "Liegengeblieben", wert: zahlen?.eskalation ?? 0, farbe: "var(--fi-tier3)" },
                { titel: "Abschlüsse 30 Tg.", wert: zahlen?.abschluesse30Tage ?? 0, farbe: "var(--fi-erfolg)" },
              ].map((k, i) => (
                // 80ms Versatz: Die Zahlen zählen nacheinander hoch. Gleichzeitig
                // wirkt es wie ein Ruckeln, versetzt wie eine Bewegung.
                //
                // Die fünfte Karte liegt auf dem Handy in voller Breite unter dem
                // 2×2-Raster. Bei fünf Karten in zwei Spalten bliebe sonst eine
                // halbe Zeile leer — das sieht nach Fehler aus, nicht nach Raster.
                <motion.div key={k.titel} {...eintritt(reduziert, i, 80)}
                            className={`h-full ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
                  <Tilt tiefe className="fi-karte h-full p-4 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5">
                      {/* Statusfarbe als Punkt — die Fläche bleibt weiß. */}
                      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: k.farbe }} />
                      <span className="fi-stat-label leading-tight">{k.titel}</span>
                    </div>
                    <p className="fi-stat-zahl mt-4" style={{ color: "var(--fi-text)" }}>
                      <Zahl wert={k.wert} />
                    </p>
                  </Tilt>
                </motion.div>
              ))}
        </div>

        {zahlen?.neuHeute > 0 && (
          <motion.div {...eintritt(reduziert)}
            className="mt-3 p-3 rounded-2xl border flex items-center gap-2.5"
            style={{ background: "var(--fi-tint)", borderColor: "var(--fi-border-aktiv)" }}>
            <p className="text-[12.5px]" style={{ color: "var(--fi-text)" }}>
              <span className="font-bold">{zahlen.neuHeute} neue Kunden</span> sind heute zu dir gekommen.
            </p>
          </motion.div>
        )}

        {/* ── 2 · HERO: Heute fällig ──────────────────────────────────── */}
        <Abschnitt
          titel="Heute fällig"
          farbe="var(--fi-tier1)"
          anzahl={heute.length}
          laedt={laedt}
          leer="Kein Kunde ist heute fällig. Gut gearbeitet."
          erklaerung="Hier stehen die Kunden, die heute dran sind: Sie haben für heute Zahlung zugesagt, oder du hast sie selbst auf heute zurückgelegt. Arbeite diese Liste von oben nach unten ab — dann hast du den Tag erledigt."
          testkonto={istTestkonto}
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
              // Sprechende Namen statt „Priorität 1/2/3“. Eine Zahl sagt einem
              // neuen Agenten nichts — der Grund sagt ihm, was ihn erwartet.
              // KEINE Emojis: Die Kategorie trägt Text und einen Farbpunkt.
              // Ein Emoji hätte auf jedem Betriebssystem eine andere
              // Anmutung und hätte die Beschriftung zum Aufkleber gemacht.
              const name = t === 1 ? "Zahlung gemeldet"
                : t === 2 ? "Antrag & Rechnung"
                : "Neue Leads";
              return (
                <button key={t} onClick={() => { setTab(t); setGrundFilter(""); }}
                        className="relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold whitespace-nowrap
                                   transition-colors duration-[120ms]
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-primaer)] rounded-t-lg"
                        style={{ color: ist ? "var(--fi-text)" : "var(--fi-text-still)" }}>
                  {/* Farbe als Punkt, nicht als Füllfläche. */}
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: tierFarbe(t), opacity: ist ? 1 : 0.4 }} />
                  {name}
                  <span className="fi-zahl text-[12px] font-semibold"
                        style={{ color: ist ? "var(--fi-text-leise)" : "var(--fi-text-still)" }}>
                    {anzahl ?? 0}
                  </span>
                  {ist && (
                    <motion.div layoutId="agent-tier-indikator"
                      className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full"
                      style={{ background: "var(--fi-primaer)" }}
                      transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border flex-1 min-w-[200px]"
                 style={{ borderColor: "var(--fi-linie)" }}>
              <input value={suche} onChange={(e) => setSuche(e.target.value)}
                     placeholder="Suchen: Name, E-Mail oder Telefon …"
                     className="flex-1 text-[13px] outline-none bg-transparent" />
              {suche && (
                <button onClick={() => setSuche("")} className="text-[12px] font-semibold px-1"
                        style={{ color: "var(--fi-text-still)" }}>
                  zurücksetzen
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
              <LeerHinweis
                text={suche ? "Keine Treffer" : "Hier ist gerade nichts"}
                zusatz={suche
                  ? "Prüfe die Schreibweise oder setze die Suche zurück."
                  : "Aktuell sind dir in dieser Kategorie keine Kunden zugewiesen. Neue kommen automatisch dazu — wenn hier dauerhaft nichts steht, melde dich bei Justin."}
                testkonto={!suche && istTestkonto} />
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
  titel, farbe, anzahl, laedt, leer, erklaerung, hero, testkonto, children,
}: {
  titel: string; farbe: string; anzahl: number; laedt: boolean;
  leer: string; erklaerung?: string; hero?: boolean; testkonto?: boolean;
  children: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const reduziert = useReduzierteBewegung();
  const { ref, drin } = useImBild<HTMLElement>();

  return (
    // Scroll-Reveal über EINEN IntersectionObserver pro Abschnitt statt über
    // `whileInView` an jedem Element — bei 60 Karten wären das 60 Beobachter.
    <section
      ref={ref}
      className="transition-all"
      style={{
        marginTop: "var(--fi-raum-abschnitt)",
        opacity: drin ? 1 : 0,
        transform: drin || reduziert ? "none" : "translateY(20px)",
        transitionDuration: reduziert ? "150ms" : "var(--fi-ebene)",
        transitionTimingFunction: "var(--fi-kurve)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Statuskante als Balken. Wächst von OBEN nach unten — die Bewegung
            läuft in Leserichtung und führt das Auge auf den Titel. */}
        <span
          aria-hidden="true"
          className="w-[3px] rounded-full shrink-0"
          style={{
            background: farbe,
            height: 24,
            transformOrigin: "top",
            transform: drin || reduziert ? "scaleY(1)" : "scaleY(0)",
            transition: reduziert ? "none" : "transform 320ms var(--fi-kurve) 80ms",
          }}
        />
        <h2 className="fi-abschnitt-titel" style={{ color: "var(--fi-text)" }}>{titel}</h2>
        {!laedt && (
          <span className="fi-zahl text-[15px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
            {anzahl}
          </span>
        )}
        {erklaerung && (
          <button onClick={() => setOffen((o) => !o)}
                  aria-label={`Erklärung zu ${titel}`} aria-expanded={offen}
                  className="ml-auto w-8 h-8 rounded-[10px] flex items-center justify-center
                             transition-colors duration-[120ms] hover:bg-slate-50"
                  style={{ color: "var(--fi-text-still)" }}>
            <ZeichenWinkel size={16} richtung={offen ? "oben" : "unten"} />
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

      {/* Karten eng gruppiert (10px), Abschnitte weit getrennt (56px). Das
          Verhältnis macht die Gruppen lesbar, nicht die Linien. */}
      <div className="fi-buehne mt-4 flex flex-col" style={{ gap: "var(--fi-raum-karten)" }}>
        {laedt ? [0, 1].map((i) => <KartenSkelett key={i} />)
          : anzahl === 0 ? <LeerHinweis text={leer} testkonto={testkonto} />
          : children}
      </div>
    </section>
  );
}

function LeerHinweis({ text, zusatz, testkonto }: { text: string; zusatz?: string; testkonto?: boolean }) {
  const reduziert = useReduzierteBewegung();
  return (
    <motion.div className="fi-karte py-12 px-6 text-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: reduziert ? 0.15 : 0.4, ease: KURVE }}>
      {/* Eine Form, kein Bildchen: konzentrische Kreise bedeuten nichts
          Bestimmtes und können deshalb in keinem Zusammenhang falsch sein. */}
      <LeerForm size={88} />
      <p className="mt-5 text-[15px] font-semibold" style={{ color: "var(--fi-text)" }}>{text}</p>
      {zusatz && (
        <p className="mt-2 fi-fliesstext max-w-[420px] mx-auto" style={{ color: "var(--fi-text-leise)" }}>
          {zusatz}
        </p>
      )}
      {/* Ohne diesen Satz rätselt der Prüfende, ob das System kaputt ist.
          Testkonten sind in der Follow-up-Engine ausdrücklich von der
          Verteilung ausgenommen — die leere Liste ist hier das richtige
          Ergebnis, nicht ein Fehler. */}
      {testkonto && (
        <p className="mt-4 mx-auto max-w-[420px] px-4 py-3 rounded-[10px] text-[13px] leading-relaxed"
           style={{
             background: "var(--fi-flaeche-akzent)",
             border: "1px solid var(--fi-linie)",
             color: "var(--fi-text-leise)",
           }}>
          <span className="font-semibold" style={{ color: "var(--fi-text)" }}>Dies ist ein Testkonto.</span>{" "}
          Testkonten bekommen keine Kunden zugewiesen — deshalb ist hier nichts zu sehen. Das ist kein Fehler.
        </p>
      )}
    </motion.div>
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
  kunde, index, hero, zeigeVerzug, zeigeRechnung, onAktion, onDetail, onAktualisiert,
}: {
  kunde: Kunde; index: number; hero?: boolean; zeigeVerzug?: boolean; zeigeRechnung?: boolean;
  onAktion: (k: Kunde, pfad: string, body: any, text: string) => Promise<void>;
  onDetail: () => void;
  /** Nach einem Versand: Zähler auf der Karte neu holen. */
  onAktualisiert?: () => void;
}) {
  const reduziert = useReduzierteBewegung();
  const { zeige } = useToast();
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [datumOffen, setDatumOffen] = useState(false);
  const [datumWert, setDatumWert] = useState("");
  const [terminOffen, setTerminOffen] = useState(false);
  const [terminWert, setTerminWert] = useState("");
  const [terminZeit, setTerminZeit] = useState("10:00");
  const [stammOffen, setStammOffen] = useState(false);
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

  /**
   * Zahlungsdaten und Rechnung an den Kunden senden.
   *
   * Der Server wartet inzwischen die Antwort von Make ab und meldet einen
   * Fehlschlag als solchen. Deshalb steht hier keine Erfolgsmeldung „auf
   * Verdacht" mehr: Was der Agent liest, ist der tatsächliche Ausgang.
   */
  const zahlungsdatenSenden = async () => {
    setLaeuft("rechnung");
    const r = await apiF(`/agent/crm/kunden/${kunde.personId}/rechnung`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    if (r.ok) {
      zeige(r.json.warnung ? "info" : "erfolg", "Zahlungsdaten versandt",
        r.json.warnung || `An ${r.json.versandtAn} — mit Bankverbindung, Verwendungszweck und Rechnung.`);
      onAktualisiert?.();
    } else {
      setFehlerShake(true);
      setTimeout(() => setFehlerShake(false), 320);
      zeige("fehler", "Nicht versandt", r.json?.error || "Bitte erneut versuchen.");
    }
  };

  return (
    <motion.div
      layout={!reduziert}
      // Gestaffelt mit 40ms, aus translateY(16px) und scale(0.98) heraus. Die
      // Skalierung ist der Unterschied zwischen „etwas rutscht herein“ und
      // „etwas kommt auf mich zu“.
      initial={reduziert ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduziert
        ? { duration: 0.2 }
        : { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 10) * 0.04 }}
      // Beim Verlassen kollabiert die Höhe weich mit, damit die Liste nachrückt
      // statt zu springen — `layout` übernimmt die Verschiebung der Nachbarn.
      //
      // `pointerEvents: "none"` ist hier KEINE Kosmetik, sondern behebt den
      // Fehler, dass Kunden ungewollt weggebucht wurden.
      //
      // `AnimatePresence mode="popLayout"` setzt eine austretende Karte auf
      // `position: absolute`, damit die Nachbarn sofort nachrücken können. Für
      // die 280 ms ihrer Ausblendung schwebt sie damit ÜBER der Liste — und nahm
      // dort weiter Klicks an, während darunter längst die nächste Karte
      // hochgerutscht war. Wer zügig arbeitet, dokumentiert einen Kunden, klickt
      // sofort den nächsten Namen und trifft die verblassende Karte davor,
      // inzwischen auf Höhe ihrer Aktionsreihe. Dort liegen vier Knöpfe, die
      // Kunden wegbuchen; einer heisst „Nicht erreicht".
      //
      // Am PC fiel es zuerst auf, weil dort mit der Maus deutlich schneller
      // hintereinander geklickt wird als mit dem Daumen. Der Fehler steckte
      // aber in beiden Fassungen.
      exit={reduziert
        ? { opacity: 0, pointerEvents: "none" }
        : { opacity: 0, x: 40, height: 0, marginBottom: 0, pointerEvents: "none",
            transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      // KEIN `preserve-3d` und KEINE Ebenen-Staffelung mehr auf dieser Karte.
      //
      // Das war mein erster Verdacht für den weggebuchten Kunden und er war
      // FALSCH: Die Karte hat `overflow: hidden`, und das legt `preserve-3d`
      // laut Spezifikation flach — die drei `translateZ`-Ebenen hatten also
      // keinerlei Wirkung, weder sichtbar noch auf Klickflächen. Ein
      // Reproduktionsversuch hat das widerlegt, bevor die Behauptung stehen
      // blieb.
      //
      // Entfernt sind sie trotzdem, aus einem anderen guten Grund: Sie kosteten
      // drei GPU-Ebenen und einen Stapelkontext pro Karte, ohne irgendetwas zu
      // leisten. Tiefenstaffelung braucht eine Drehung, und diese Karte ist
      // kein `Tilt`. Damit das nicht wieder jemand versucht, wirkt `Ebene`
      // seither nur noch innerhalb eines drehenden `Tilt` (siehe fiaon-ui).
      className={`fi-karte relative overflow-hidden ${fehlerShake ? "fi-shake" : ""}`}
      // Haltepunkte für den Regressionstest. Bewusst eigene Attribute statt
      // CSS-Klassen: Klassen ändern sich mit der Gestaltung, und ein Test, der
      // an der Gestaltung hängt, wird bei der ersten Umgestaltung entweder rot
      // oder gelöscht.
      data-fi-karte={kunde.personId}
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

      {/* Statuskante: 3px, volle Kartenhöhe. Der einzige Ort, an dem die
          Statusfarbe als Fläche erscheint — und selbst hier ist es eine Kante. */}
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: tierFarbe(kunde.tier) }} />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
        {/* Name und Status. */}
        <div>
          <div className="flex items-start gap-3">
            {/* `type="button"` an JEDEM Knopf dieser Karte. Ohne die Angabe ist
                ein Knopf laut HTML ein Absende-Knopf; sobald irgendwann ein
                Formular über der Liste liegt, löst derselbe Klick zwei Dinge
                aus. Genau diese Fehlerklasse hat uns hier schon einmal einen
                weggebuchten Kunden gekostet. */}
            <button type="button" onClick={onDetail}
                    data-fi-name
                    className="flex-1 min-w-0 text-left rounded-[6px]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-primaer)]">
              <span className="fi-name block truncate" style={{ color: "var(--fi-text)" }}>
                {kunde.name || "Ohne Namen"}
              </span>
            </button>
            {/* Status als Umrandung mit 3-%-Füllung, nicht als farbige Pille.
                Eine volle Farbfläche neben dem Namen zieht mehr Aufmerksamkeit
                als der Name selbst — genau verkehrt herum. */}
            <span className="shrink-0 px-2 py-1 text-[11px] font-semibold"
                  style={{
                    borderRadius: "var(--fi-radius-badge)",
                    color: tierFarbe(kunde.tier),
                    background: tierFlaeche(kunde.tier),
                    border: `1px solid ${tierFarbe(kunde.tier)}33`,
                  }}>
              {kunde.titel}
            </span>
          </div>
        </div>

        {/* Metazeile: Betrag · Produkt · Zusage. */}
        <div>
          <p className="fi-meta mt-1.5 flex items-center flex-wrap">
            {kunde.betrag != null && <span className="fi-zahl font-semibold">{eur(kunde.betrag)}</span>}
            {kunde.produkt && (
              <span className={kunde.betrag != null ? "fi-punkt" : ""}>{kunde.produkt}</span>
            )}
            {/* Relativ, weil „in 2 Tagen“ sofort sagt, ob es dringend ist;
                „05.08.2026“ muss man erst ausrechnen. Das genaue Datum steht
                im Tooltip — beides gleichzeitig wäre Rauschen. */}
            {kunde.zusagedatum && (
              <span className={(kunde.betrag != null || kunde.produkt) ? "fi-punkt cursor-help" : "cursor-help"}
                    title={`Zusagedatum: ${datum(kunde.zusagedatum)}`}
                    style={{ color: verzug > 0 ? "var(--fi-tier1)" : undefined }}>
                {relativerTag(kunde.zusagedatum)}
              </span>
            )}
          </p>
        </div>

        {/* Handlungshinweis: einzeilig angerissen, per Klick aufklappend. */}
        <button type="button" onClick={() => setHinweisOffen((o) => !o)}
                aria-expanded={hinweisOffen}
                className="mt-3 w-full flex items-start gap-1.5 text-left text-[13px]
                           transition-colors duration-[120ms] group"
                style={{ color: "var(--fi-text-still)" }}>
          <ZeichenWinkel size={15} richtung={hinweisOffen ? "oben" : "unten"} className="shrink-0 mt-[1px]" />
          <span className={hinweisOffen ? "sr-only" : "truncate"}>{kunde.hinweis}</span>
          {hinweisOffen && <span>Hinweis schließen</span>}
        </button>
        <div className="grid"
             style={{
               gridTemplateRows: hinweisOffen ? "1fr" : "0fr",
               transition: "grid-template-rows var(--fi-element) var(--fi-kurve)",
             }}>
          <div className="overflow-hidden">
            <p className="mt-2 p-3 fi-fliesstext"
               style={{
                 background: "var(--fi-seite)",
                 borderRadius: "var(--fi-radius-knopf)",
                 color: "var(--fi-text-leise)",
               }}>
              {kunde.hinweis}
            </p>
          </div>
        </div>

        {/* Aktionen. EINE Primäraktion mit Blauverlauf, alles andere ruhige
            Umrandungsknöpfe. Vier gleichwertige Knöpfe wären vier Fragen; ein
            hervorgehobener ist eine Empfehlung.

            Die Reihe ist durch `mt-4` klar vom Namen getrennt — kein
            `translateZ` mehr, das sie darüber schieben könnte. */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* ── ANRUFEN (Meldung 04.08.2026) ─────────────────────────────────
                Vorher wurde `kunde.telefon` direkt in den tel:-Link geschrieben.
                Bei 2.058 von 4.521 Personen steht dort eine Nummer OHNE
                Ländervorwahl — das Telefon wählte dann eine Ortsnummer im
                eigenen Netz. Jetzt liefert der Server die wählbare Form
                (+49 …); fehlt die Vorwahl wirklich, wird die Nummer angezeigt,
                aber NICHT verlinkt, mit klarem Hinweis. Eine geratene Vorwahl
                würde einen fremden Menschen anrufen. */}
            {kunde.telefonWaehlbar ? (
              <a href={`tel:${kunde.telefonWaehlbar}`}
                 className="fi-primaerknopf inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white">
                <ZeichenTelefon size={16} />
                Anrufen
              </a>
            ) : kunde.telefon ? (
              <span className="inline-flex flex-col px-3 py-2 text-[12px] font-medium"
                    style={{
                      borderRadius: "var(--fi-radius-knopf)",
                      background: "var(--fi-flaeche-warnung, #fffbeb)",
                      color: "var(--fi-tier2)",
                      border: "1px solid var(--fi-tier2)",
                    }}>
                <span className="fi-zahl font-bold">{kunde.telefon}</span>
                <span className="text-[10.5px] leading-tight">Ländervorwahl fehlt — in der Akte ergänzen</span>
              </span>
            ) : (
              <span className="px-3 py-2.5 text-[12px] font-medium"
                    style={{
                      borderRadius: "var(--fi-radius-knopf)",
                      background: "var(--fi-seite)", color: "var(--fi-text-still)",
                      border: "1px solid var(--fi-linie)",
                    }}>
                keine Nummer
              </span>
            )}

            {/* ── ZAHLUNGSDATEN SENDEN (Meldung 05.08.2026) ────────────────────
                Vorher stand hier ein „E-Mail"-Knopf mit mailto: — er öffnete das
                Mailprogramm des Agenten. Daniel beschrieb es genau so: „wenn ich
                auf Email klicke werde ich zu meiner Email weitergeleitet".
                Gemeint war aber: Der Kunde soll die Zahlungsdaten von der
                Plattform bekommen, mit Bankverbindung, Verwendungszweck und
                Rechnung als Link.
                Jetzt löst der Knopf genau das aus (Event payment_details) und
                sagt hinterher, an WELCHE Adresse es ging. Das Mailprogramm
                bleibt als kleiner Zusatz erreichbar — beschriftet, damit es
                niemanden mehr überrascht. */}
            <button type="button" onClick={() => void zahlungsdatenSenden()}
                    disabled={!!laeuft || !kunde.email}
                    title={kunde.email
                      ? `Zahlungsdaten und Rechnung an ${kunde.email} senden`
                      : "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt"}
                    className="fi-sendeknopf inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold">
              <ZeichenSenden size={15} />
              {laeuft === "rechnung" ? "Sende …" : "Zahlungsdaten senden"}
            </button>

            {kunde.email && (
              <a href={`mailto:${kunde.email}`}
                 className="fi-zweitknopf inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium"
                 title={`Öffnet dein eigenes Mailprogramm mit ${kunde.email}`}>
                eigenes Mailprogramm
              </a>
            )}
          </div>
          {kunde.rechnungVersandt > 0 && (
            <p className="mt-1.5 text-[11.5px]"
               style={{ color: kunde.rechnungWarnung ? "var(--fi-fehler)" : "var(--fi-text-still)" }}>
              {kunde.rechnungWarnung || `Zahlungsdaten bereits ${kunde.rechnungVersandt}× versandt`}
            </p>
          )}

          {/* ── ERGEBNIS DOKUMENTIEREN ───────────────────────────────────────
              Vorher gab es hier vier Möglichkeiten. Es fehlten „Erreicht –
              abgelehnt", „Mailbox besprochen" und „Rückruf" — genau die drei
              Fälle, die im Telefonalltag am häufigsten übrig bleiben. Wer sie
              dokumentieren wollte, musste in „Meine Kunden" wechseln, und dort
              hatte das Ergebnis keine Wirkung auf diese Liste.
              Jetzt steht der vollständige Satz hier, in der Reihenfolge der
              Häufigkeit. */}
          <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[.06em]"
             style={{ color: "var(--fi-text-still)" }}>
            Ergebnis festhalten
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Aktion label="Zahlt sofort"
                    laeuft={laeuft === "sofort"} disabled={!!laeuft}
                    onClick={() => fuehreAus("sofort", "/aktivitaet", { art: "erreicht_zahlt_gleich" },
                      "Zahlt sofort", "var(--fi-erfolg)")} />
            <Aktion label="Zahlt am …"
                    laeuft={laeuft === "zusage"} disabled={!!laeuft}
                    onClick={() => { setTerminOffen(false); setDatumOffen((o) => !o); }} />
            <Aktion label="Nicht erreicht"
                    laeuft={laeuft === "nicht"} disabled={!!laeuft}
                    onClick={() => fuehreAus("nicht", "/aktivitaet", { art: "nicht_erreicht" },
                      "Nicht erreicht — morgen erneut", "var(--fi-tier2)")} />
            <Aktion label="Mailbox besprochen"
                    laeuft={laeuft === "mailbox"} disabled={!!laeuft}
                    onClick={() => fuehreAus("mailbox", "/aktivitaet", { art: "mailbox" },
                      "Mailbox besprochen", "var(--fi-tier2)")} />
            <Aktion label="Rückruf vereinbart"
                    laeuft={laeuft === "rueckruf"} disabled={!!laeuft}
                    onClick={() => { setDatumOffen(false); setTerminOffen((o) => !o); }} />
            <Aktion label="Erreicht – abgelehnt"
                    laeuft={laeuft === "abgelehnt"} disabled={!!laeuft}
                    onClick={() => fuehreAus("abgelehnt", "/aktivitaet", { art: "erreicht_abgelehnt" },
                      "Abgelehnt", "var(--fi-tier1)")} />
            <Aktion label="Falsche Nummer"
                    laeuft={laeuft === "nummer"} disabled={!!laeuft}
                    onClick={() => fuehreAus("nummer", "/aktivitaet", { art: "nummer_falsch" },
                      "Falsche Nummer notiert", "var(--fi-tier3)")} />

            {/* Zähler tertiär und rechts unten — nur wenn es etwas zu sagen
                gibt. „0× nicht erreicht" ist keine Information. */}
            {(kunde.nichtErreicht > 0 || kunde.rechnungVersandt > 0) && (
              <span className="ml-auto text-[12px] fi-zahl" style={{ color: "var(--fi-text-still)" }}>
                {kunde.nichtErreicht > 0 && `${kunde.nichtErreicht}× nicht erreicht`}
                {kunde.nichtErreicht > 0 && kunde.rechnungVersandt > 0 && " · "}
                {kunde.rechnungVersandt > 0 && `${kunde.rechnungVersandt}× Rechnung`}
              </span>
            )}
          </div>
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
                type="button"
                disabled={!datumWert || !!laeuft}
                onClick={() => fuehreAus("zusage", "/aktivitaet",
                  { art: "erreicht_zahlt_am", zusageDatum: datumWert },
                  `Zusage für ${datum(datumWert)} notiert`, "var(--fi-tint)")}
                className="px-3 py-2 rounded-lg text-[12px] font-bold text-white transition-transform duration-150
                           active:scale-[0.96] disabled:opacity-40"
                style={{ background: "var(--fi-primaer)" }}>
                Speichern
              </button>
            </div>
          </div>
        </div>

        {/* Terminfeld für den Rückruf. Eigenes Feld, nicht dasselbe wie die
            Zusage: Ein Rückruf ist keine Zahlungsvereinbarung, und beides
            gleichzeitig zu speichern hätte die Zusage überschrieben. */}
        <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
             style={{ gridTemplateRows: terminOffen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="mt-2.5 p-3 rounded-xl flex flex-wrap items-center gap-2" style={{ background: "var(--fi-seite)" }}>
              <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>
                Rückruf am
              </label>
              <input type="date" value={terminWert} onChange={(e) => setTerminWert(e.target.value)}
                     min={new Date().toISOString().slice(0, 10)}
                     className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                     style={{ borderColor: "var(--fi-linie)" }} />
              {/* Uhrzeit war der eigentliche Mangel: „Rückruf morgen" ist keine
                  Verabredung. Vorbelegt mit 10:00, damit ein Klick genügt, wenn
                  keine Zeit vereinbart wurde. */}
              <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>
                um
              </label>
              <input type="time" value={terminZeit} onChange={(e) => setTerminZeit(e.target.value)}
                     step={900}
                     className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                     style={{ borderColor: "var(--fi-linie)" }} />
              <button
                type="button"
                disabled={!terminWert || !!laeuft}
                onClick={() => fuehreAus("rueckruf", "/aktivitaet",
                  { art: "rueckruf_termin", terminDatum: terminWert, terminZeit },
                  `Rückruf am ${datum(terminWert)} um ${terminZeit} vorgemerkt`, "var(--fi-tint)")}
                className="px-3 py-2 rounded-lg text-[12px] font-bold text-white transition-transform duration-150
                           active:scale-[0.96] disabled:opacity-40"
                style={{ background: "var(--fi-primaer)" }}>
                Speichern
              </button>
            </div>
          </div>
        </div>

        {/* ── STAMMDATEN (Meldung 04.08.2026) ───────────────────────────────
            Sie fehlten hier vollständig. Der Agent musste den Kunden zusätzlich
            unter „Meine Kunden" suchen, nur um am Telefon die Adresse zu
            bestätigen oder die Zahlungsreferenz vorzulesen. Zugeklappt, weil sie
            nicht bei jedem Anruf gebraucht werden — aber EINEN Tipp entfernt. */}
        {(kunde.stammdaten || kunde.zahlung?.referenz) && (
          <div className="mt-2.5">
            <button type="button" onClick={() => setStammOffen((o) => !o)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: "var(--fi-primaer)" }}>
              {stammOffen ? "Stammdaten schließen" : "Stammdaten ansehen"}
            </button>
            <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                 style={{ gridTemplateRows: stammOffen ? "1fr" : "0fr" }}>
              <div className="overflow-hidden">
                <dl className="mt-2 p-3 rounded-xl text-[12.5px]" style={{ background: "var(--fi-seite)" }}>
                  {[
                    ["Adresse", [kunde.stammdaten?.strasse, [kunde.stammdaten?.plz, kunde.stammdaten?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null],
                    ["Land", kunde.stammdaten?.land || null],
                    ["Geburtsdatum", kunde.stammdaten?.geburtsdatum ? datum(String(kunde.stammdaten.geburtsdatum).slice(0, 10)) : null],
                    ["E-Mail", kunde.email],
                    ["Telefon", kunde.telefon],
                    ["Verwendungszweck", kunde.zahlung?.referenz || null],
                    ["Paket", kunde.produkt],
                  ].map(([label, wert]) => (
                    <div key={String(label)} className="flex items-start gap-2 py-1">
                      <dt className="w-[130px] shrink-0" style={{ color: "var(--fi-text-still)" }}>{label}</dt>
                      <dd className="min-w-0 flex-1 font-medium break-words"
                          style={{ color: wert ? "var(--fi-text)" : "var(--fi-text-still)" }}>
                        {wert || "nicht hinterlegt"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Der Versand-Knopf steht jetzt oben bei „Anrufen" — auf JEDER Karte.
            Vorher erschien er nur auf Tier-2-Karten: Wer gerade mit einem Kunden
            telefonierte, der „Zahlung angekündigt" war (Tier 1), hatte keine
            Möglichkeit, ihm die Bankdaten zu schicken. Genau dieser Fall kam im
            Team-Chat vor. */}
        {false && (
          <div className="mt-2.5 pt-2.5 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "var(--fi-linie)" }}>
            <button type="button" onClick={() => void zahlungsdatenSenden()} disabled={!!laeuft}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-bold
                               transition-transform duration-150 active:scale-[0.96] disabled:opacity-50"
                    style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
              {laeuft === "rechnung" ? "Sende …" : "Zahlungsdetails senden"}
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

/**
 * Sekundäraktion. Bewusst OHNE eigene Farbe: Vier verschiedenfarbige Knöpfe
 * nebeneinander sind eine Ampel ohne Bedeutung. Die Unterscheidung leistet der
 * Text; die Farbe bleibt der Statuskante und dem Primärknopf vorbehalten.
 *
 * Zustände stecken in `.fi-zweitknopf` — in CSS statt in Framer Motion, weil
 * Hover und Active zu den billigsten Dingen gehören, die der Browser selbst
 * kann, und pro Karte vier solcher Knöpfe existieren.
 */
function Aktion({
  label, onClick, laeuft, disabled,
}: { label: string; onClick: () => void; laeuft: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
            className="fi-zweitknopf px-3 py-2.5 text-[12.5px] font-medium
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-primaer)]">
      {laeuft ? "…" : label}
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
      {/* Backdrop mit eigenem Weichzeichner: Die Seite dahinter bleibt lesbar
          genug, um den Zusammenhang zu halten, und unscharf genug, um nicht
          mehr um Aufmerksamkeit zu konkurrieren. */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: KURVE }}
        className="absolute inset-0"
        style={{
          background: "var(--fi-backdrop)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={onSchliessen}
      />
      {/* 380ms herein, 280ms hinaus. Schliessen ist IMMER schneller: Der
          Benutzer hat sich schon entschieden und will das Ergebnis sehen,
          nicht die Bewegung. */}
      <motion.div
        initial={reduziert ? { opacity: 0 } : { x: "100%" }}
        animate={reduziert ? { opacity: 1 } : { x: 0 }}
        exit={reduziert
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { x: "100%", transition: { duration: 0.28, ease: KURVE } }}
        transition={reduziert ? { duration: 0.15 } : { duration: 0.38, ease: KURVE }}
        className="relative w-full sm:max-w-[560px] h-full overflow-y-auto"
        style={{
          background: "#fff",
          borderTopLeftRadius: "var(--fi-radius-ebene)",
          borderBottomLeftRadius: "var(--fi-radius-ebene)",
          boxShadow: "var(--fi-schatten-schwebend)",
        }}
      >
        <div className="fi-glas sticky top-0 z-10 px-4 sm:px-5 py-3 flex items-center gap-3">
          <button onClick={onSchliessen} aria-label="Schließen"
                  className="fi-zweitknopf w-9 h-9 flex items-center justify-center shrink-0">
            <ZeichenSchliessen size={17} />
          </button>
          <p className="fi-name truncate flex-1" style={{ color: "var(--fi-text)" }}>
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
              {/* Dieselben Badges wie auf der Karte — Umrandung statt Pille.
                  Karte und Detail dürfen nicht aussehen wie zwei Systeme. */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 text-[11px] font-semibold"
                      style={{
                        borderRadius: "var(--fi-radius-badge)",
                        color: tierFarbe(k.tier),
                        background: tierFlaeche(k.tier),
                        border: `1px solid ${tierFarbe(k.tier)}33`,
                      }}>
                  {k.titel}
                </span>
                {k.gesperrt && (
                  <span className="px-2 py-1 text-[11px] font-semibold"
                        style={{
                          borderRadius: "var(--fi-radius-badge)",
                          color: "var(--fi-tier1)",
                          background: "var(--fi-flaeche-tier1)",
                          border: "1px solid rgba(220,38,38,.2)",
                        }}>
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
                  <a href={`tel:${k.telefonWaehlbar || k.telefon.replace(/\s/g, "")}`}
                     className="flex-1 inline-flex items-center justify-center py-2.5 rounded-xl text-[13px] font-bold text-white"
                     style={{ background: "linear-gradient(180deg, var(--fi-erfolg), #047857)" }}>
                    Anrufen: {k.telefon}
                  </a>
                )}
                {k.email && (
                  <a href={`mailto:${k.email}`}
                     className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border text-[12.5px] font-bold"
                     style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
                    E-Mail
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
// Willkommens-Tour — einmal pro Agent, jederzeit erneut aufrufbar
//
// Vier Schritte, kein Zwang: jederzeit wegklickbar, und der Status liegt am
// Agenten in der Datenbank statt im localStorage. Wer sie übersprungen hat und
// später doch nachlesen will, findet oben rechts „Wie funktioniert das?".
// ═══════════════════════════════════════════════════════════════════════════
const SCHRITTE = [
  {
    titel: "Willkommen in deiner Kundenliste",
    text: "Du suchst keine Akten mehr aus einem gemeinsamen Bestand. Deine Kunden sind dir fest zugewiesen — niemand anders ruft sie an, und du siehst ausschließlich deine eigenen.",
  },
  {
    titel: "„Heute fällig“ ist deine Arbeitsliste",
    text: "Ganz oben stehen die Kunden, die heute dran sind: Sie haben für heute Zahlung zugesagt, oder du hast sie selbst auf heute zurückgelegt. Von oben nach unten durcharbeiten — dann ist der Tag erledigt.",
  },
  {
    titel: "Die drei Kategorien",
    text: "Zahlung gemeldet: Der Kunde sagt, er habe bezahlt, das Geld fehlt aber — höchste Dringlichkeit. Antrag & Rechnung: Rechnung offen oder Antrag unvollständig. Neue Leads: noch kein Antrag, erstes Gespräch. Die Farbpunkte an den Reitern zeigen dieselbe Reihenfolge: rot, gelb, grau.",
  },
  {
    titel: "Ein Tipp genügt",
    text: "„Anrufen“ wählt direkt. Danach dokumentierst du mit einem Tipp: Erreicht, Nicht erreicht, Zahlt am … oder Blockiert. Die Karte verschwindet dann aus der Liste. Weißt du nicht weiter, öffne auf der Karte „Was ist hier zu tun?“.",
  },
];

function Willkommen({ offen, onFertig }: { offen: boolean; onFertig: () => void }) {
  const [schritt, setSchritt] = useState(0);
  const reduziert = useReduzierteBewegung();

  // Bei JEDEM Öffnen zurück auf Schritt 1.
  //
  // Vorher blieb `schritt` erhalten, weil diese Komponente immer eingehängt ist
  // und bei `offen === false` nur `null` zurückgibt — `useState(0)` läuft dann
  // genau einmal im Leben der Seite. Wer die Tour einmal bis „Los geht's"
  // durchgeklickt hatte, bekam beim nächsten Klick auf „Wie funktioniert das?"
  // sofort wieder die LETZTE Seite zu sehen. Es sah aus, als öffne sich nichts
  // Neues, und die Erklärung war praktisch unerreichbar.
  //
  // Der Effekt hängt an `offen`, nicht an der Einhängung: Die Tour soll sich
  // immer öffnen, so oft der Agent will, und immer von vorn.
  useEffect(() => {
    if (offen) setSchritt(0);
  }, [offen]);

  if (!offen) return null;
  const s = SCHRITTE[schritt];
  const letzter = schritt === SCHRITTE.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-slate-900/50" onClick={onFertig} />
      <motion.div
        initial={reduziert ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 32 }}
        className="relative w-full sm:max-w-[440px] bg-white rounded-3xl p-5"
        style={{ boxShadow: "0 20px 60px rgba(15,23,42,0.25)" }}
      >
        <div className="flex items-center gap-1.5">
          {SCHRITTE.map((_, i) => (
            <span key={i} aria-hidden="true" className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: i === schritt ? 22 : 8,
                    background: i <= schritt ? "var(--fi-primaer)" : "var(--fi-linie)",
                  }} />
          ))}
          <button onClick={onFertig} className="ml-auto text-[12px] font-semibold"
                  style={{ color: "var(--fi-text-still)" }}>
            überspringen
          </button>
        </div>

        <h2 className="mt-4 text-[18px] font-bold leading-tight" style={{ color: "var(--fi-text)" }}>
          {s.titel}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
          {s.text}
        </p>

        <div className="mt-5 flex items-center gap-2">
          {schritt > 0 && (
            <button onClick={() => setSchritt((n) => n - 1)}
                    className="px-3.5 py-2.5 rounded-xl border text-[13px] font-semibold"
                    style={{ borderColor: "var(--fi-linie)", color: "var(--fi-text-leise)" }}>
              Zurück
            </button>
          )}
          <button onClick={() => (letzter ? onFertig() : setSchritt((n) => n + 1))}
                  className="flex-1 py-2.5 rounded-xl text-[13.5px] font-bold text-white
                             transition-transform duration-150 active:scale-[0.97]"
                  style={{ background: "var(--fi-primaer)" }}>
            {letzter ? "Los geht’s" : "Weiter"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// In der Portal-Shell: dieselbe Navigation wie auf allen anderen
// Agentenseiten. Vorher stand die Seite ohne Rahmen da — der Agent kam von hier
// nirgendwo hin.
export default function AgentHeute() {
  return (
    <AgentShell>
      <ToastAnbieter>
        <Seite />
      </ToastAnbieter>
    </AgentShell>
  );
}
