// ═══════════════════════════════════════════════════════════════════════════
// /admin/verbuchung — Zahlungen prüfen und verbuchen
//
// Vier Sachverhalte, vier Tabs. Der Unterschied ist nicht kosmetisch:
//   1 Verbuchen              Geld da, Bestellung offen → echte Buchung
//   2 Zuordnung korrigieren  Geld gehört zur bereits bezahlten Bestellung
//                            desselben Produkts → NICHT buchen, nur verknüpfen
//   3 Fälschlich stillgelegt Vom alten Dubletten-Fehler getötete Bestellungen
//   4 Ohne Zuordnung         Eingänge, die niemandem gehören
//
// Jede Zeile hat eine aufklappbare Vorschau: Vor dem Klick steht da, welcher
// Statuswechsel passiert, welche Geschwister stillgelegt werden, ob eine Mail
// rausgeht und wer die Provision bekommt. Die Vorschau kommt vom Server und
// benutzt für die Provisionsfrage dieselbe Funktion wie die echte Buchung.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, ChevronDown, HelpCircle, Link2,
  RefreshCw, RotateCcw, Search, Wallet,
} from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";
import {
  HaltenZumBestaetigen, Haken, Skelett, Tilt, ToastAnbieter, Zahl,
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

type TabKey = "verbuchen" | "zuordnung" | "stillgelegt" | "ohneZuordnung";
type ZeilenStatus = "ruhe" | "laeuft" | "erfolg" | "fehler";

const TABS: { key: TabKey; label: string; hinweis: string; ikon: typeof Wallet }[] = [
  { key: "verbuchen", label: "Verbuchen", hinweis: "Geld eingegangen, Bestellung noch offen", ikon: Wallet },
  { key: "zuordnung", label: "Zuordnung korrigieren", hinweis: "Geld liegt auf der falschen Bestellung", ikon: ArrowLeftRight },
  { key: "stillgelegt", label: "Fälschlich stillgelegt", hinweis: "Vom alten Dubletten-Fehler getötet", ikon: RotateCcw },
  { key: "ohneZuordnung", label: "Ohne Zuordnung", hinweis: "Eingang ohne erkennbaren Kunden", ikon: HelpCircle },
];

// ═══════════════════════════════════════════════════════════════════════════
function Seite() {
  const { zeige } = useToast();
  const reduziert = useReduzierteBewegung();
  const [laedt, setLaedt] = useState(true);
  const [daten, setDaten] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>("verbuchen");
  const [zeilenStatus, setZeilenStatus] = useState<Record<string, ZeilenStatus>>({});
  const [fehlerText, setFehlerText] = useState<Record<string, string>>({});
  const [erledigt, setErledigt] = useState<Record<string, boolean>>({});
  const [stapelLaeuft, setStapelLaeuft] = useState(false);
  const [stapelIndex, setStapelIndex] = useState(0);

  const lade = useCallback(async (leise = false) => {
    if (!leise) setLaedt(true);
    const r = await apiF("/admin/verbuchung/uebersicht");
    if (r.ok) setDaten(r.json.tabs);
    else zeige("fehler", "Laden fehlgeschlagen", r.json?.error || "Bitte erneut versuchen.");
    setLaedt(false);
  }, [zeige]);

  useEffect(() => { lade(); }, [lade]);

  const setStatus = (id: string, s: ZeilenStatus, text = "") => {
    setZeilenStatus((v) => ({ ...v, [id]: s }));
    if (text) setFehlerText((v) => ({ ...v, [id]: text }));
  };

  // ── Eine Buchung ─────────────────────────────────────────────────────────
  const buche = useCallback(async (zeile: any, syncAmount = false): Promise<boolean> => {
    const id = `v${zeile.id}`;
    setStatus(id, "laeuft");
    const r = await apiF(`/admin/verbuchung/${zeile.id}/buchen`, {
      method: "POST", body: JSON.stringify({ syncAmount }),
    });
    if (r.ok) {
      setStatus(id, "erfolg");
      // Der Erfolgszustand darf man sehen, bevor die Zeile geht.
      setTimeout(() => setErledigt((v) => ({ ...v, [id]: true })), 900);
      zeige("erfolg", `${zeile.kundenname || zeile.ref} verbucht`, `${eur(zeile.eingangCents)} — Konto freigeschaltet.`);
      return true;
    }
    setStatus(id, "fehler", r.json?.error || "Buchung fehlgeschlagen");
    zeige("fehler", "Buchung fehlgeschlagen", r.json?.error || "Unbekannter Fehler");
    return false;
  }, [zeige]);

  // ── Stapel: sequenziell, sichtbar, Zeile für Zeile ───────────────────────
  const alleBuchen = useCallback(async () => {
    const zeilen = (daten?.verbuchen?.zeilen || []).filter((z: any) => !erledigt[`v${z.id}`]);
    setStapelLaeuft(true);
    let ok = 0;
    for (let i = 0; i < zeilen.length; i++) {
      setStapelIndex(i + 1);
      // Abweichende Beträge werden im Stapel NICHT stillschweigend angeglichen.
      const erfolg = await buche(zeilen[i], false);
      if (erfolg) ok++;
      await new Promise((r) => setTimeout(r, reduziert ? 60 : 320));
    }
    setStapelLaeuft(false);
    setStapelIndex(0);
    zeige(ok === zeilen.length ? "erfolg" : "info", `${ok} von ${zeilen.length} verbucht`,
      ok === zeilen.length ? "Alle Zahlungen sind verbucht." : "Nicht alle Zeilen konnten verbucht werden — siehe rote Zeilen.");
    lade(true);
  }, [daten, erledigt, buche, reduziert, zeige, lade]);

  // ── Zuordnung korrigieren ────────────────────────────────────────────────
  const korrigiere = useCallback(async (zeile: any) => {
    const id = `z${zeile.id}`;
    setStatus(id, "laeuft");
    const r = await apiF(`/admin/verbuchung/${zeile.id}/zuordnung-korrigieren`, {
      method: "POST", body: JSON.stringify({ zielRef: zeile.zielRef }),
    });
    if (r.ok) {
      setStatus(id, "erfolg");
      setTimeout(() => setErledigt((v) => ({ ...v, [id]: true })), 900);
      zeige("erfolg", "Zuordnung korrigiert", `Eingang gehört jetzt zu ${zeile.zielRef}. Keine Buchung ausgelöst.`);
    } else {
      setStatus(id, "fehler", r.json?.error || "Korrektur fehlgeschlagen");
      zeige("fehler", "Korrektur fehlgeschlagen", r.json?.error || "Unbekannter Fehler");
    }
  }, [zeige]);

  // ── Reaktivieren ─────────────────────────────────────────────────────────
  const reaktiviere = useCallback(async (zeile: any) => {
    const id = `s${zeile.ref}`;
    setStatus(id, "laeuft");
    const r = await apiF("/admin/verbuchung/reaktivieren", {
      method: "POST", body: JSON.stringify({ ref: zeile.ref }),
    });
    if (r.ok) {
      setStatus(id, "erfolg");
      setTimeout(() => setErledigt((v) => ({ ...v, [id]: true })), 900);
      zeige("erfolg", "Bestellung reaktiviert",
        `${zeile.produkt || zeile.ref} steht wieder offen. Kein Mailversand — die Ansprache übernimmt der Agent.`);
    } else {
      setStatus(id, "fehler", r.json?.error || "Reaktivierung fehlgeschlagen");
      zeige("fehler", "Reaktivierung fehlgeschlagen", r.json?.error || "Unbekannter Fehler");
    }
  }, [zeige]);

  const aktiv = daten?.[tab];
  const offeneBuchungen = useMemo(
    () => (daten?.verbuchen?.zeilen || []).filter((z: any) => !erledigt[`v${z.id}`]).length,
    [daten, erledigt],
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--fi-seite)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8">

        {/* ── Kopf ─────────────────────────────────────────────────────── */}
        <motion.div {...eintritt(reduziert)}>
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight">
            <span className="fi-gradient-text">Verbuchung</span>
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
            Nur die Eingänge, bei denen etwas zu entscheiden ist. Jede Zeile zeigt vor dem Klick, was passiert.
          </p>
        </motion.div>

        <div className="mt-4">
          <PageIntro
            id="verbuchung"
            title="Verbuchung"
            subtitle="Hier entscheidest du über jeden Zahlungseingang, bei dem etwas unklar ist — mit Vorschau vor dem Klick."
            steps={[
              "Tab „Verbuchen“: Geld ist da, die Bestellung ist offen. Ein Klick geht denselben Weg wie der Admin-Button „bezahlt“ — Freischaltung, Bestätigungsmail, Provisionsprüfung.",
              "Tab „Zuordnung korrigieren“: Das Geld gehört zu einer längst bezahlten Bestellung desselben Produkts. Hier wird bewusst NICHT gebucht, nur die Bank-Zuordnung berichtigt.",
              "Tab „Fälschlich stillgelegt“: Bestellungen, die der alte Dubletten-Fehler getötet hat, obwohl ein anderes Produkt bezahlt wurde. Reaktivieren schickt keine Mail — die Ansprache übernimmt der Agent.",
              "Tab „Ohne Zuordnung“: Eingänge ohne erkennbaren Kunden. Nach der Zuordnung erscheinen sie im ersten Tab.",
              "Aufklappen mit „Was passiert beim Verbuchen?“ zeigt Statuswechsel, betroffene Geschwister-Bestellungen, Mailversand und Provisionsempfänger.",
            ]}
          />
        </div>

        {/* ── Kennzahlen ───────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {laedt
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-2xl bg-white border" style={{ borderColor: "var(--fi-linie)" }}>
                  <div className="flex items-center gap-2"><Skelett h={28} w={28} /><Skelett h={11} w="52%" /></div>
                  <div className="mt-3"><Skelett h={30} w="45%" /></div>
                  <div className="mt-2"><Skelett h={10} w="80%" /></div>
                </div>
              ))
            : [
                { key: "verbuchen" as TabKey, titel: "Zu verbuchen", ikon: Wallet, wert: daten?.verbuchen?.anzahl || 0, unter: eur(daten?.verbuchen?.summeCents || 0), farbe: "var(--fi-primaer)", tint: "var(--fi-tint)" },
                { key: "zuordnung" as TabKey, titel: "Zuordnung korrigieren", ikon: ArrowLeftRight, wert: daten?.zuordnung?.anzahl || 0, unter: eur(daten?.zuordnung?.summeCents || 0), farbe: "var(--fi-warnung)", tint: "var(--fi-warnung-tint)" },
                { key: "stillgelegt" as TabKey, titel: "Reaktivierbar", ikon: RotateCcw, wert: daten?.stillgelegt?.reaktivierbar || 0, unter: `von ${daten?.stillgelegt?.anzahl || 0} stillgelegten`, farbe: "var(--fi-erfolg)", tint: "var(--fi-erfolg-tint)" },
                { key: "ohneZuordnung" as TabKey, titel: "Ohne Zuordnung", ikon: HelpCircle, wert: daten?.ohneZuordnung?.anzahl || 0, unter: eur(daten?.ohneZuordnung?.summeCents || 0), farbe: "var(--fi-tier3)", tint: "#f1f5f9" },
              ].map((k, i) => (
                <motion.div key={k.titel} {...eintritt(reduziert, i, 60)}>
                  {/* Die Kachel führt in ihren Tab — die Zahl ohne den Weg dorthin
                      wäre eine Sackgasse. */}
                  <Tilt className="h-full rounded-2xl bg-white border overflow-hidden"
                        style={{ borderColor: "var(--fi-linie)" }}>
                    <button onClick={() => setTab(k.key)}
                            className="w-full text-left p-4 focus-visible:outline-none focus-visible:ring-2
                                       focus-visible:ring-[var(--fi-border-aktiv)] rounded-2xl">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: k.tint }}>
                          <k.ikon size={15} style={{ color: k.farbe }} />
                        </span>
                        <p className="text-[11px] font-bold uppercase tracking-wide leading-tight" style={{ color: "var(--fi-text-still)" }}>
                          {k.titel}
                        </p>
                      </div>
                      <p className="mt-2.5 text-[30px] font-bold leading-none tracking-tight" style={{ color: k.farbe }}>
                        <Zahl wert={k.wert} />
                      </p>
                      <p className="mt-1.5 text-[12px] fi-zahl" style={{ color: "var(--fi-text-leise)" }}>{k.unter}</p>
                    </button>
                  </Tilt>
                </motion.div>
              ))}
        </div>

        {/* ── Tabs mit gleitendem Indikator ────────────────────────────── */}
        <div className="mt-7 border-b flex gap-1 overflow-x-auto" style={{ borderColor: "var(--fi-linie)" }}>
          {TABS.map((t) => {
            const anzahl = daten?.[t.key]?.anzahl ?? 0;
            const ist = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                title={t.hinweis}
                className="relative px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150
                           inline-flex items-center gap-1.5
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-border-aktiv)] rounded-t-lg"
                style={{ color: ist ? "var(--fi-primaer)" : "var(--fi-text-leise)" }}
              >
                <t.ikon size={14} className="shrink-0" />
                {t.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold fi-zahl"
                      style={{ background: ist ? "var(--fi-tint)" : "#f1f5f9", color: ist ? "var(--fi-primaer)" : "var(--fi-text-still)" }}>
                  {anzahl}
                </span>
                {ist && (
                  <motion.div
                    layoutId="verbuchung-tab-indikator"
                    className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full"
                    style={{ background: "var(--fi-primaer)" }}
                    transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Stapel-Aktion nur im Buchungs-Tab ────────────────────────── */}
        {tab === "verbuchen" && !laedt && offeneBuchungen > 0 && (
          <motion.div {...eintritt(reduziert)}
            className="mt-4 sticky top-3 z-30 rounded-2xl bg-white/95 backdrop-blur border overflow-hidden"
            style={{ borderColor: "var(--fi-linie)", boxShadow: "var(--fi-schatten-ruhe)" }}>
            <div className="p-3.5 flex flex-wrap items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--fi-tint)" }}>
                <Wallet size={16} style={{ color: "var(--fi-primaer)" }} />
              </span>
              <p className="text-[13px] flex-1 min-w-[240px] leading-snug" style={{ color: "var(--fi-text)" }}>
                <span className="font-bold fi-zahl">{offeneBuchungen} Zahlungen</span> bereit ·{" "}
                <span className="fi-zahl">{eur(daten?.verbuchen?.summeCents || 0)}</span>
                <span className="block text-[12px]" style={{ color: "var(--fi-text-leise)" }}>
                  {stapelLaeuft
                    ? `Buche ${stapelIndex} von ${offeneBuchungen} — Zeile für Zeile, damit jeder Fehler sichtbar bleibt.`
                    : "Jede Buchung löst Freischaltung, Bestätigungsmail und Provisionsprüfung aus."}
                </span>
              </p>
              <HaltenZumBestaetigen
                label="Alle bestätigen (3 s halten)"
                laufendLabel="Halten …"
                disabled={stapelLaeuft}
                onFertig={alleBuchen}
              />
            </div>
            {/* Fortschritt nur während des Laufs — sonst eine Linie ohne Aussage. */}
            {stapelLaeuft && (
              <div className="h-[3px]" style={{ background: "var(--fi-linie)" }}>
                <div className="h-full origin-left transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                     style={{
                       background: "linear-gradient(90deg, var(--fi-primaer), var(--fi-gradient-hell))",
                       width: "100%",
                       transform: `scaleX(${offeneBuchungen > 0 ? stapelIndex / offeneBuchungen : 0})`,
                     }} />
              </div>
            )}
          </motion.div>
        )}

        {/* ── Inhalt ───────────────────────────────────────────────────── */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={reduziert ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduziert ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduziert ? 0.15 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {laedt ? (
                <ListenSkelett />
              ) : !aktiv || aktiv.zeilen.length === 0 ? (
                <LeerZustand tab={tab} />
              ) : (
                <div className="space-y-2.5">
                  {aktiv.zeilen.map((z: any, i: number) => {
                    const id =
                      tab === "verbuchen" ? `v${z.id}` :
                      tab === "zuordnung" ? `z${z.id}` :
                      tab === "stillgelegt" ? `s${z.ref}` : `o${z.id}`;
                    if (erledigt[id]) return null;
                    return (
                      <motion.div key={id} {...eintritt(reduziert, Math.min(i, 12), 30)}>
                        {tab === "verbuchen" && (
                          <BuchungsZeile zeile={z} status={zeilenStatus[id] || "ruhe"} fehler={fehlerText[id]}
                                         onBuchen={(sync) => buche(z, sync)} />
                        )}
                        {tab === "zuordnung" && (
                          <KorrekturZeile zeile={z} status={zeilenStatus[id] || "ruhe"} fehler={fehlerText[id]}
                                          onKorrigieren={() => korrigiere(z)} />
                        )}
                        {tab === "stillgelegt" && (
                          <StillgelegtZeile zeile={z} status={zeilenStatus[id] || "ruhe"} fehler={fehlerText[id]}
                                            onReaktivieren={() => reaktiviere(z)} />
                        )}
                        {tab === "ohneZuordnung" && (
                          <OhneZuordnungZeile zeile={z} onZugeordnet={() => lade(true)} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={() => lade()} disabled={laedt}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-[12px] font-semibold
                             transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
                  style={{ borderColor: "var(--fi-linie)", color: "var(--fi-text-leise)" }}>
            <RefreshCw size={13} className={laedt ? "animate-spin" : ""} /> Neu laden
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Zeilenrahmen mit Zustandsfarbe, Erfolgs-Puls und Fehler-Shake
// ═══════════════════════════════════════════════════════════════════════════
function Rahmen({
  status, fehler, akzent = "var(--fi-linie)", children,
}: { status: ZeilenStatus; fehler?: string; akzent?: string; children: React.ReactNode }) {
  // Die Akzentkante folgt dem Zustand, sobald es einen gibt — Erfolg und Fehler
  // sind wichtiger als die Art der Entscheidung.
  const kante =
    status === "fehler" ? "var(--fi-fehler)" :
    status === "erfolg" ? "var(--fi-erfolg)" : akzent;
  return (
    <div
      className={`group relative rounded-2xl bg-white border overflow-hidden
                  transition-[border-color,box-shadow] duration-200
                  ${status === "erfolg" ? "fi-puls-erfolg" : ""} ${status === "fehler" ? "fi-shake" : ""}`}
      style={{
        borderColor:
          status === "fehler" ? "var(--fi-fehler)" :
          status === "erfolg" ? "var(--fi-erfolg)" : "var(--fi-linie)",
        boxShadow: "var(--fi-schatten-ruhe)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--fi-schatten-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--fi-schatten-ruhe)"; }}
    >
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: kante }} />
      {children}
      <AnimatePresence>
        {status === "fehler" && fehler && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-2.5 text-[12px] font-semibold flex items-center gap-2"
            style={{ background: "var(--fi-fehler-tint)", color: "var(--fi-fehler)" }}
          >
            <AlertTriangle size={13} /> {fehler}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Etikett({ text, farbe, tint, titel }: { text: string; farbe: string; tint: string; titel?: string }) {
  return (
    <span title={titel}
          className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
          style={{ background: tint, color: farbe }}>
      {text}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — echte Buchung, mit aufklappbarer Vorschau
// ═══════════════════════════════════════════════════════════════════════════
function BuchungsZeile({
  zeile, status, fehler, onBuchen,
}: { zeile: any; status: ZeilenStatus; fehler?: string; onBuchen: (sync: boolean) => void }) {
  const [offen, setOffen] = useState(false);
  const [vorschau, setVorschau] = useState<any>(null);
  const [ladeVorschau, setLadeVorschau] = useState(false);
  const geholt = useRef(false);

  useEffect(() => {
    if (!offen || geholt.current) return;
    geholt.current = true;
    setLadeVorschau(true);
    apiF(`/admin/verbuchung/vorschau/${zeile.id}`).then((r) => {
      if (r.ok) setVorschau(r.json.vorschau);
      setLadeVorschau(false);
    });
  }, [offen, zeile.id]);

  return (
    <Rahmen status={status} fehler={fehler} akzent="var(--fi-primaer)">
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-bold" style={{ color: "var(--fi-text)" }}>
                {zeile.kundenname || "Ohne Namen"}
              </p>
              {zeile.nachFristablauf && (
                <Etikett text="nach Fristablauf gezahlt" farbe="var(--fi-warnung)" tint="var(--fi-warnung-tint)"
                         titel="Die Zahlungsfrist war abgelaufen, das Geld kam trotzdem." />
              )}
              {!zeile.betragOk && (
                <Etikett text={`Betrag weicht ab: ${eur(zeile.eingangCents)} erhalten`} farbe="var(--fi-fehler)"
                         tint="var(--fi-fehler-tint)" titel={`Sollbetrag: ${eur(zeile.sollCents)}`} />
              )}
              {zeile.einzahlerWeichtAb && (
                <Etikett text="Einzahler weicht ab" farbe="var(--fi-tier3)" tint="#f1f5f9"
                         titel={`Überweisung von: ${zeile.einzahler} — evtl. Zahlung durch Dritte.`} />
              )}
              {zeile.phantomSuperseded && (
                <Etikett text="stillgelegt durch Phantom-Zeiger" farbe="var(--fi-fehler)" tint="var(--fi-fehler-tint)"
                         titel={`superseded_by zeigt auf „${zeile.phantomZeiger}“ — diese Bestellung existiert nicht. Es gibt keine überlebende Bestellung, deshalb wird auf diese hier gebucht.`} />
              )}
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--fi-text-leise)" }}>
              {zeile.produkt || "Produkt unbekannt"} · {zeile.zahlungsreferenz || zeile.ref}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--fi-text-still)" }}>
              Eingang {datum(zeile.gebuchtAm)} · Einzahler {zeile.einzahler || "—"} · Status {zeile.bestellstatus}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[17px] font-bold fi-zahl" style={{ color: "var(--fi-text)" }}>{eur(zeile.eingangCents)}</p>
            {zeile.sollCents != null && zeile.sollCents !== zeile.eingangCents && (
              <p className="text-[11px] fi-zahl" style={{ color: "var(--fi-text-still)" }}>Soll {eur(zeile.sollCents)}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === "erfolg" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold"
                    style={{ background: "var(--fi-erfolg-tint)", color: "var(--fi-erfolg)" }}>
                <Haken /> Verbucht
              </span>
            ) : (
              <button
                onClick={() => onBuchen(false)}
                disabled={status === "laeuft"}
                className="px-3.5 py-2 rounded-xl text-[12px] font-bold text-white transition-transform duration-150
                           hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-border-aktiv)] focus-visible:ring-offset-2"
                style={{ background: "linear-gradient(180deg, var(--fi-primaer), var(--fi-primaer-hover))" }}
              >
                {status === "laeuft" ? "Buche …" : "Verbuchen"}
              </button>
            )}
          </div>
        </div>

        <button onClick={() => setOffen((o) => !o)}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
                style={{ color: "var(--fi-primaer)" }}>
          <ChevronDown size={14} className="transition-transform duration-200" style={{ transform: offen ? "rotate(180deg)" : "none" }} />
          {offen ? "Vorschau schließen" : "Was passiert beim Verbuchen?"}
        </button>
      </div>

      {/* Höhenwechsel über grid-template-rows — kein height, kein Layout-Sprung */}
      <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
           style={{ gridTemplateRows: offen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            {ladeVorschau ? (
              <div className="p-3.5 rounded-xl space-y-2" style={{ background: "var(--fi-seite)" }}>
                <Skelett h={12} w="70%" /><Skelett h={12} w="55%" /><Skelett h={12} w="62%" />
              </div>
            ) : vorschau ? (
              <VorschauBlock vorschau={vorschau} onBuchenMitSync={() => onBuchen(true)}
                             zeigeSync={!zeile.betragOk} />
            ) : null}
          </div>
        </div>
      </div>
    </Rahmen>
  );
}

function VorschauBlock({
  vorschau, onBuchenMitSync, zeigeSync,
}: { vorschau: any; onBuchenMitSync: () => void; zeigeSync: boolean }) {
  return (
    <div className="p-3.5 rounded-xl text-[12px] space-y-2.5" style={{ background: "var(--fi-seite)" }}>
      <Punkt titel="Statuswechsel" text={vorschau.statuswechsel} />
      <Punkt
        titel="Bestätigungsmail"
        text={vorschau.mail.begruendung}
        ton={vorschau.mail.wirdGesendet ? "aktiv" : "still"}
      />
      <Punkt
        titel="Provision"
        text={vorschau.provision.wirdGebucht
          ? `Wird gebucht an ${vorschau.provision.agentName}. ${vorschau.provision.begruendung}`
          : vorschau.provision.begruendung}
        ton={vorschau.provision.wirdGebucht ? "aktiv" : "still"}
      />
      <Punkt
        titel="Andere Bestellungen"
        ton={vorschau.geschwisterStillgelegt.length > 0 ? "warnung" : "still"}
        text={
          vorschau.geschwisterStillgelegt.length === 0
            ? "Keine. Nach dem Produkt-Fix werden nur noch Bestellungen DESSELBEN Produkts stillgelegt."
            : `${vorschau.geschwisterStillgelegt.length} Bestellung(en) desselben Produkts werden stillgelegt: ` +
              vorschau.geschwisterStillgelegt.map((g: any) => `${g.ref} (${eur(g.sollCents)})`).join(", ")
        }
      />
      {zeigeSync && (
        <div className="pt-1.5 border-t" style={{ borderColor: "var(--fi-linie)" }}>
          <p className="mb-2" style={{ color: "var(--fi-text-leise)" }}>
            Der Eingang weicht vom Sollbetrag ab. Standardmäßig bleibt der Sollbetrag stehen und die Abweichung
            dokumentiert. Alternativ lässt sich der Sollbetrag auf den tatsächlichen Eingang setzen.
          </p>
          <button onClick={onBuchenMitSync}
                  className="px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-transform duration-150 active:scale-[0.97]"
                  style={{ borderColor: "var(--fi-warnung)", color: "var(--fi-warnung)", background: "var(--fi-warnung-tint)" }}>
            Verbuchen und Sollbetrag angleichen
          </button>
        </div>
      )}
    </div>
  );
}

function Punkt({ titel, text, ton = "still" }: { titel: string; text: string; ton?: "aktiv" | "still" | "warnung" }) {
  const farbe = ton === "aktiv" ? "var(--fi-primaer)" : ton === "warnung" ? "var(--fi-warnung)" : "var(--fi-text-still)";
  return (
    <div className="flex gap-2.5">
      <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: farbe }} />
      <p style={{ color: "var(--fi-text-leise)" }}>
        <span className="font-bold" style={{ color: "var(--fi-text)" }}>{titel}: </span>{text}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Zuordnung korrigieren
// ═══════════════════════════════════════════════════════════════════════════
function KorrekturZeile({
  zeile, status, fehler, onKorrigieren,
}: { zeile: any; status: ZeilenStatus; fehler?: string; onKorrigieren: () => void }) {
  return (
    <Rahmen status={status} fehler={fehler} akzent="var(--fi-warnung)">
      <div className="p-4 pl-5 flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold" style={{ color: "var(--fi-text)" }}>{zeile.kundenname || "Ohne Namen"}</p>
            <Etikett text="keine Buchung" farbe="var(--fi-warnung)" tint="var(--fi-warnung-tint)"
                     titel="Das Geld gehört zu einer bereits bezahlten Bestellung. Es wird nur die Verknüpfung korrigiert." />
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--fi-text-leise)" }}>{zeile.produkt}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-lg font-mono" style={{ background: "var(--fi-fehler-tint)", color: "var(--fi-fehler)" }}>
              Geld lag auf: {zeile.ref}
            </span>
            <ArrowRight size={13} style={{ color: "var(--fi-text-still)" }} />
            <span className="px-2 py-1 rounded-lg font-mono" style={{ background: "var(--fi-erfolg-tint)", color: "var(--fi-erfolg)" }}>
              gehört zu: {zeile.zielRef}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>{zeile.begruendung}</p>
        </div>

        <div className="text-right">
          <p className="text-[17px] font-bold fi-zahl" style={{ color: "var(--fi-text)" }}>{eur(zeile.eingangCents)}</p>
          <p className="text-[11px]" style={{ color: "var(--fi-text-still)" }}>{datum(zeile.gebuchtAm)}</p>
        </div>

        {status === "erfolg" ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--fi-erfolg-tint)", color: "var(--fi-erfolg)" }}>
            <Haken /> Korrigiert
          </span>
        ) : (
          <button onClick={onKorrigieren} disabled={status === "laeuft"}
                  className="px-3.5 py-2 rounded-xl border text-[12px] font-bold transition-transform duration-150
                             hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                  style={{ borderColor: "var(--fi-primaer)", color: "var(--fi-primaer)", background: "var(--fi-tint)" }}>
            {status === "laeuft" ? "Korrigiere …" : "Zuordnung korrigieren"}
          </button>
        )}
      </div>
    </Rahmen>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 3 — fälschlich stillgelegte Bestellungen
// ═══════════════════════════════════════════════════════════════════════════
function StillgelegtZeile({
  zeile, status, fehler, onReaktivieren,
}: { zeile: any; status: ZeilenStatus; fehler?: string; onReaktivieren: () => void }) {
  return (
    <Rahmen status={status} fehler={fehler}
            akzent={zeile.reaktivierbar ? "var(--fi-erfolg)" : "var(--fi-tier3)"}>
      <div className="p-4 pl-5 flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold" style={{ color: "var(--fi-text)" }}>{zeile.kundenname || "Ohne Namen"}</p>
            {zeile.klassifikation === "andere_kategorie" && (
              <Etikett text="andere Produktkategorie" farbe="var(--fi-fehler)" tint="var(--fi-fehler-tint)"
                       titel={`Stillgelegt, weil „${zeile.ausloeserProdukt}“ bezahlt wurde. Das ist eine andere Kategorie — Stufenpaket und Bonitätsauskunft schließen sich nicht aus. Die Stilllegung war ein Fehler.`} />
            )}
            {zeile.klassifikation === "phantom" && (
              <Etikett text="Phantom-Zeiger" farbe="var(--fi-fehler)" tint="var(--fi-fehler-tint)"
                       titel={`superseded_by zeigt auf „${zeile.phantomZeiger}“ — diese Bestellung existiert nicht.`} />
            )}
            {zeile.klassifikation === "gleiche_kategorie" && (
              <Etikett text="Stilllegung war richtig" farbe="var(--fi-tier3)" tint="#f1f5f9"
                       titel={`Es wurde dieselbe Kategorie bezahlt (${zeile.ausloeserProdukt}) — Dublette oder Stufen-Upgrade.`} />
            )}
            <Etikett text={zeile.kategorie} farbe="var(--fi-text-leise)" tint="#f1f5f9" />
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--fi-text-leise)" }}>
            {zeile.produkt} · {zeile.zahlungsreferenz || zeile.ref} · bestellt am {datum(zeile.angelegt)}
          </p>
          {zeile.bezahlteGeschwister.length > 0 && (
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--fi-text-still)" }}>
              Kunde hat bezahlt: {zeile.bezahlteGeschwister.map((g: any) => `${g.produkt} (${eur(g.sollCents)})`).join(" · ")}
            </p>
          )}
          {!zeile.reaktivierbar && zeile.grund && (
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>{zeile.grund}</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-[17px] font-bold fi-zahl" style={{ color: "var(--fi-text)" }}>{eur(zeile.sollCents)}</p>
          <p className="text-[11px]" style={{ color: "var(--fi-text-still)" }}>offener Umsatz</p>
        </div>

        {status === "erfolg" ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--fi-erfolg-tint)", color: "var(--fi-erfolg)" }}>
            <Haken /> Reaktiviert
          </span>
        ) : (
          <button onClick={onReaktivieren} disabled={status === "laeuft" || !zeile.reaktivierbar}
                  title={zeile.reaktivierbar
                    ? "Setzt auf offen zurück. Keine Mail — die Ansprache übernimmt der Agent."
                    : zeile.grund || "Diese Bestellung wird nicht reaktiviert."}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[12px] font-bold
                             transition-transform duration-150 hover:scale-[1.02] active:scale-[0.97]
                             disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--fi-erfolg)", color: "var(--fi-erfolg)", background: "var(--fi-erfolg-tint)" }}>
            <RotateCcw size={13} /> {status === "laeuft" ? "Reaktiviere …" : "Reaktivieren"}
          </button>
        )}
      </div>
    </Rahmen>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 4 — Eingang ohne Zuordnung, mit Personensuche
// ═══════════════════════════════════════════════════════════════════════════
function OhneZuordnungZeile({ zeile, onZugeordnet }: { zeile: any; onZugeordnet: () => void }) {
  const { zeige } = useToast();
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<any[]>([]);
  const [vorschlaege, setVorschlaege] = useState<any[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (!offen) return;
    apiF(`/admin/reconcile/${zeile.id}/suggestions`).then((r) => r.ok && setVorschlaege(r.json.data || []));
  }, [offen, zeile.id]);

  useEffect(() => {
    if (suche.trim().length < 2) { setTreffer([]); return; }
    const t = setTimeout(() => {
      apiF(`/admin/reconcile/search?q=${encodeURIComponent(suche.trim())}`).then((r) => r.ok && setTreffer(r.json.data || []));
    }, 250);
    return () => clearTimeout(t);
  }, [suche]);

  const ordneZu = async (ref: string) => {
    setLaeuft(true);
    const r = await apiF(`/admin/reconcile/${zeile.id}/assign`, { method: "POST", body: JSON.stringify({ ref }) });
    setLaeuft(false);
    if (r.ok) {
      zeige("erfolg", "Eingang zugeordnet", `Er erscheint jetzt im Tab „Verbuchen“ und kann dort gebucht werden.`);
      onZugeordnet();
    } else {
      zeige("fehler", "Zuordnung fehlgeschlagen", r.json?.error || "Unbekannter Fehler");
    }
  };

  return (
    <Rahmen status="ruhe" akzent="var(--fi-tier3)">
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[14px] font-bold" style={{ color: "var(--fi-text)" }}>
              {zeile.einzahler || "Ohne Absendername"}
            </p>
            <p className="mt-1 text-[12px] break-all" style={{ color: "var(--fi-text-leise)" }}>
              {zeile.verwendungszweck || "kein Verwendungszweck"}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--fi-text-still)" }}>
              {datum(zeile.gebuchtAm)} · {zeile.txnId}
              {zeile.erkannteReferenz && ` · erkannt: ${zeile.erkannteReferenz}`}
            </p>
          </div>
          <p className="text-[17px] font-bold fi-zahl" style={{ color: "var(--fi-text)" }}>{eur(zeile.eingangCents)}</p>
          <button onClick={() => setOffen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[12px] font-bold
                             transition-transform duration-150 hover:scale-[1.02] active:scale-[0.97]"
                  style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
            <Link2 size={13} /> {offen ? "Schließen" : "Kunde zuordnen"}
          </button>
        </div>
      </div>

      <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
           style={{ gridTemplateRows: offen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <div className="p-3.5 rounded-xl" style={{ background: "var(--fi-seite)" }}>
              {vorschlaege.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--fi-text-still)" }}>
                    Vorschläge — bitte prüfen, nichts wird automatisch gebucht
                  </p>
                  <div className="space-y-1">
                    {vorschlaege.map((v) => (
                      <button key={v.ref} onClick={() => ordneZu(v.ref)} disabled={laeuft}
                              className="w-full text-left px-2.5 py-2 rounded-lg bg-white border flex items-center gap-2
                                         transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                              style={{ borderColor: "var(--fi-linie)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold truncate" style={{ color: "var(--fi-text)" }}>{v.customer_name || "—"}</p>
                          <p className="text-[10px]" style={{ color: "var(--fi-text-still)" }}>
                            {v.payment_reference || v.ref} · {v.payment_status} · {eur(Math.round(Number(v.amount_due || 0) * 100))}
                          </p>
                        </div>
                        <Etikett text={v.confidence === "hoch" ? "hoch" : "mittel"}
                                 farbe={v.confidence === "hoch" ? "var(--fi-erfolg)" : "var(--fi-warnung)"}
                                 tint={v.confidence === "hoch" ? "var(--fi-erfolg-tint)" : "var(--fi-warnung-tint)"}
                                 titel={v.confidenceLabel} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border" style={{ borderColor: "var(--fi-linie)" }}>
                <Search size={14} style={{ color: "var(--fi-text-still)" }} />
                <input value={suche} onChange={(e) => setSuche(e.target.value)}
                       placeholder="Name, E-Mail oder Referenz …"
                       className="flex-1 text-[12px] outline-none bg-transparent" />
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto fi-scroll-schatten space-y-1">
                {suche.trim().length < 2 && (
                  <p className="text-[11px] py-2 text-center" style={{ color: "var(--fi-text-still)" }}>
                    Mindestens zwei Zeichen eingeben.
                  </p>
                )}
                {treffer.map((t) => (
                  <button key={t.ref} onClick={() => ordneZu(t.ref)} disabled={laeuft}
                          className="w-full text-left px-2.5 py-2 rounded-lg bg-white border flex items-center gap-2
                                     transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                          style={{ borderColor: "var(--fi-linie)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold truncate" style={{ color: "var(--fi-text)" }}>{t.customer_name || "—"}</p>
                      <p className="text-[10px]" style={{ color: "var(--fi-text-still)" }}>
                        {t.ref} · {t.payment_status} · {eur(Math.round(Number(t.amount_due || 0) * 100))}
                      </p>
                    </div>
                    <ArrowRight size={13} style={{ color: "var(--fi-text-still)" }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Rahmen>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Skeleton und Leerzustände
// ═══════════════════════════════════════════════════════════════════════════
function ListenSkelett() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 rounded-2xl bg-white border" style={{ borderColor: "var(--fi-linie)" }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <Skelett h={15} w="42%" />
              <Skelett h={11} w="58%" />
              <Skelett h={10} w="70%" />
            </div>
            <div className="space-y-2 text-right">
              <Skelett h={18} w={84} />
              <Skelett h={10} w={64} />
            </div>
            <Skelett h={36} w={104} />
          </div>
          <div className="mt-3"><Skelett h={11} w={188} /></div>
        </div>
      ))}
    </div>
  );
}

function LeerZustand({ tab }: { tab: TabKey }) {
  const reduziert = useReduzierteBewegung();
  const texte: Record<TabKey, { titel: string; text: string }> = {
    verbuchen: { titel: "Alles verbucht", text: "Es liegt kein Zahlungseingang mehr offen. Sauber." },
    zuordnung: { titel: "Keine Korrekturen offen", text: "Jeder Eingang hängt an der richtigen Bestellung." },
    stillgelegt: { titel: "Nichts fälschlich stillgelegt", text: "Der Produkt-Fix greift — es liegt keine getötete Bestellung mehr herum." },
    ohneZuordnung: { titel: "Jeder Eingang hat einen Kunden", text: "Es gibt keinen unzugeordneten Zahlungseingang." },
  };
  const t = texte[tab];
  return (
    <motion.div
      initial={reduziert ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduziert ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="py-14 text-center rounded-2xl bg-white border"
      style={{ borderColor: "var(--fi-linie)" }}
    >
      <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--fi-erfolg-tint)" }}>
        <Haken groesse={24} />
      </div>
      <p className="mt-3 text-[15px] font-bold" style={{ color: "var(--fi-text)" }}>{t.titel}</p>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--fi-text-leise)" }}>{t.text}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function AdminVerbuchung() {
  return (
    <ToastAnbieter>
      <Seite />
    </ToastAnbieter>
  );
}
