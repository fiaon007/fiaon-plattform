/**
 * ═══════════════════════════════════════════════════════════════════
 * KONTAKT-ERGEBNIS IN ZWEI EBENEN
 * ═══════════════════════════════════════════════════════════════════
 *
 * Vorher standen sieben gleichwertige Knöpfe nebeneinander — eine Wand, bei
 * der jede Option gleich wichtig aussah und der Agent jedes Mal neu lesen
 * musste. Tatsächlich gibt es aber nur EINE erste Frage: Hast du die Person
 * erreicht oder nicht? Alles Weitere hängt daran.
 *
 * Ebene 1: zwei große Schaltflächen.
 * Ebene 2: die passenden Feinheiten, gestaffelt eingeblendet.
 *
 * WICHTIG — das hier ist ein reiner Oberflächen-Umbau. Die Ergebnis-Codes
 * (`erreicht_zahlt_gleich`, `nicht_erreicht`, `nummer_falsch` …) bleiben
 * unverändert; sie hängen an der Provisionslogik und an der Event-Registry.
 * Diese Datei ordnet sie nur neu an und benennt sie verständlicher.
 *
 * Lead und Kunde haben UNTERSCHIEDLICHE Codes (ein Lead kann nichts zahlen,
 * er hat noch keinen Antrag). Deshalb ist die Zuordnung ein Parameter und
 * steht nicht fest verdrahtet in der Komponente.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PhoneCall, PhoneOff, ChevronLeft, Mail, X } from "lucide-react";

export interface ErgebnisOption {
  /** UNVERÄNDERTER Ergebnis-Code. Nie umbenennen — Provision und Events hängen daran. */
  code: string;
  label: string;
  /** Kurze Erklärung unter dem Label. */
  hinweis?: string;
  /** Löst einen E-Mail-Versand aus → wird vor dem Bestätigen im Klartext angesagt. */
  mail?: string;
}

export interface ErgebnisGruppe {
  erreicht: ErgebnisOption[];
  nichtErreicht: ErgebnisOption[];
}

interface Props {
  gruppen: ErgebnisGruppe;
  disabled?: boolean;
  /** Wird mit dem gewählten Code aufgerufen — öffnet den bestehenden Bestätigungsdialog. */
  onWaehle: (code: string) => void;
  /**
   * Sonderfall „Braucht die Zahlungsdaten erneut": Das ist KEIN Kontakt-Ergebnis,
   * sondern nur ein Mailversand. Bewusst so entschieden — es entsteht dadurch
   * kein Provisionsanspruch und die Akte bleibt offen.
   */
  zahlungsdaten?: { onSend: () => void; gesperrtSek?: number };
}

const FEDER = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };

export function KontaktErgebnis({ gruppen, disabled, onWaehle, zahlungsdaten }: Props) {
  const [ebene, setEbene] = useState<null | "erreicht" | "nicht">(null);
  const reduced = useReducedMotion();
  const [mobil, setMobil] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const set = () => setMobil(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // Zurück-Taste schließt zuerst die zweite Ebene, statt die Seite zu verlassen.
  useEffect(() => {
    if (!ebene) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEbene(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [ebene]);

  const optionen = ebene === "erreicht" ? gruppen.erreicht : ebene === "nicht" ? gruppen.nichtErreicht : [];

  const waehle = (code: string) => { setEbene(null); onWaehle(code); };

  // ── Ebene 2 als Liste (in beiden Darstellungen identisch) ─────────────
  const liste = (
    <div className="grid gap-2">
      {optionen.map((o, i) => (
        <motion.button
          key={o.code}
          type="button"
          disabled={disabled}
          onClick={() => waehle(o.code)}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { ...FEDER, delay: i * 0.035 }}
          className="group w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3
                     hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.99]
                     disabled:opacity-50 disabled:pointer-events-none
                     transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          style={{ minHeight: 56 }}
        >
          <span className="block text-[14px] font-semibold text-slate-800">{o.label}</span>
          {o.hinweis && <span className="block text-[12px] text-slate-500 mt-0.5 leading-snug">{o.hinweis}</span>}
          {o.mail && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11.5px] text-amber-900">
              <Mail size={12} strokeWidth={2} />
              {o.mail}
            </span>
          )}
        </motion.button>
      ))}

      {/* Sonderfall Zahlungsdaten — nur unter „Erreicht", nur bei Kunden. */}
      {ebene === "erreicht" && zahlungsdaten && (
        <motion.button
          type="button"
          disabled={disabled || !!zahlungsdaten.gesperrtSek}
          onClick={() => { setEbene(null); zahlungsdaten.onSend(); }}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { ...FEDER, delay: optionen.length * 0.035 }}
          className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3
                     hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.99]
                     disabled:opacity-50 disabled:pointer-events-none
                     transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          style={{ minHeight: 56 }}
        >
          <span className="block text-[14px] font-semibold text-slate-800">
            Braucht die Zahlungsdaten erneut
          </span>
          <span className="block text-[12px] text-slate-500 mt-0.5 leading-snug">
            {zahlungsdaten.gesperrtSek
              ? `Erst in ${zahlungsdaten.gesperrtSek} s wieder möglich (Schutz vor Doppelversand).`
              : "Kein Kontakt-Ergebnis — die Akte bleibt offen. Dokumentiere danach zusätzlich, wie das Gespräch ausging."}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11.5px] text-amber-900">
            <Mail size={12} strokeWidth={2} />
            Der Kunde erhält die Zahlungsdaten per E-Mail.
          </span>
        </motion.button>
      )}
    </div>
  );

  return (
    <div>
      {/* ── EBENE 1 ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <HauptKnopf
          aktiv={ebene === "erreicht"}
          disabled={disabled}
          ton="gut"
          icon={<PhoneCall size={20} strokeWidth={2} />}
          label="Erreicht"
          onClick={() => setEbene((e) => (e === "erreicht" ? null : "erreicht"))}
        />
        <HauptKnopf
          aktiv={ebene === "nicht"}
          disabled={disabled}
          ton="neutral"
          icon={<PhoneOff size={20} strokeWidth={2} />}
          label="Nicht erreicht"
          onClick={() => setEbene((e) => (e === "nicht" ? null : "nicht"))}
        />
      </div>

      {/* ── EBENE 2 · Desktop: aufklappen ───────────────────────────────── */}
      {!mobil && (
        <AnimatePresence initial={false}>
          {ebene && (
            <motion.div
              key={ebene}
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-3">{liste}</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── EBENE 2 · Handy: Bottom-Sheet, einhändig erreichbar ─────────── */}
      {mobil && (
        <AnimatePresence>
          {ebene && (
            <>
              <motion.div
                className="fixed inset-0 bg-slate-900/40 z-[60]"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setEbene(null)}
              />
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl bg-white shadow-2xl
                           max-h-[85vh] overflow-y-auto"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                initial={reduced ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={reduced ? { opacity: 0 } : { y: "100%" }}
                transition={reduced ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                role="dialog"
                aria-modal="true"
                aria-label={ebene === "erreicht" ? "Erreicht — was ist passiert?" : "Nicht erreicht — was ist passiert?"}
              >
                <div className="sticky top-0 bg-white/95 backdrop-blur px-4 pt-3 pb-2.5 border-b border-slate-100">
                  <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300" />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEbene(null)}
                      className="inline-flex items-center gap-1 text-[13px] text-slate-500 -ml-1 px-1 py-1"
                      style={{ minHeight: 44 }}
                    >
                      <ChevronLeft size={16} strokeWidth={2} /> Zurück
                    </button>
                    <span className="text-[13px] font-semibold text-slate-800">
                      {ebene === "erreicht" ? "Erreicht" : "Nicht erreicht"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEbene(null)}
                      aria-label="Schließen"
                      className="text-slate-400 px-1 py-1"
                      style={{ minHeight: 44, minWidth: 44 }}
                    >
                      <X size={18} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3">{liste}</div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/** Die beiden großen Hauptknöpfe — bewusst die einzigen mit echter Tiefe. */
function HauptKnopf({
  aktiv, disabled, ton, icon, label, onClick,
}: {
  aktiv: boolean; disabled?: boolean; ton: "gut" | "neutral";
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  const basis = ton === "gut"
    ? "border-blue-200 bg-gradient-to-b from-white to-blue-50/70 text-blue-900 hover:border-blue-400"
    : "border-slate-200 bg-gradient-to-b from-white to-slate-50 text-slate-700 hover:border-slate-400";
  const aktivCls = ton === "gut"
    ? "border-blue-500 ring-2 ring-blue-500/20 from-blue-50 to-blue-100/70"
    : "border-slate-500 ring-2 ring-slate-500/15 from-slate-50 to-slate-100";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={aktiv}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border
                  px-4 py-4 font-semibold transition-all active:scale-[0.98]
                  disabled:opacity-50 disabled:pointer-events-none
                  shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-4px_rgba(15,23,42,0.10)]
                  hover:shadow-[0_2px_4px_rgba(15,23,42,0.08),0_8px_20px_-6px_rgba(15,23,42,0.16)]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
                  ${basis} ${aktiv ? aktivCls : ""}`}
      style={{ minHeight: 88 }}
    >
      {icon}
      <span className="text-[14px] tracking-tight">{label}</span>
    </button>
  );
}

// ── Zuordnungen: Codes UNVERÄNDERT, nur Reihenfolge und Klartext neu ──────

/** Kunde (hat einen Antrag → kann zahlen). */
export const KUNDE_GRUPPEN: ErgebnisGruppe = {
  erreicht: [
    { code: "erreicht_zahlt_gleich", label: "Zahlt sofort", hinweis: "Der Kunde überweist direkt im Anschluss." },
    { code: "erreicht_zahlt_am", label: "Zahlt später am …", hinweis: "Mit Datum der Zusage (deutsche Zeit)." },
    { code: "erreicht_abgelehnt", label: "Abgelehnt", hinweis: "Kein Interesse mehr — bleibt dokumentiert sichtbar." },
  ],
  nichtErreicht: [
    { code: "nicht_erreicht", label: "Niemand ist rangegangen", hinweis: "Erneuter Versuch in rund vier Stunden." },
    { code: "mailbox", label: "Mailbox besprochen", hinweis: "Nachricht hinterlassen." },
    { code: "rueckruf_termin", label: "Rückruf vereinbart am …", hinweis: "Mit Datum und Uhrzeit (deutsche Zeit)." },
    {
      code: "nummer_falsch", label: "Nummer falsch",
      hinweis: "Die Nummer stimmt nicht oder gehört jemand anderem.",
      mail: "Der Kunde erhält eine E-Mail zur Nummern-Korrektur (max. 1×/Tag).",
    },
  ],
};

/** Lead (noch kein Antrag → kann nichts zahlen). */
export const LEAD_GRUPPEN: ErgebnisGruppe = {
  erreicht: [
    { code: "erreicht_interesse", label: "Interesse", hinweis: "Bleibt in der Betreuung." },
    { code: "erreicht_kein_interesse", label: "Kein Interesse", hinweis: "Verlässt die Warteschlange, bleibt gespeichert." },
  ],
  nichtErreicht: [
    { code: "nicht_erreicht", label: "Niemand ist rangegangen", hinweis: "Erneuter Versuch in rund vier Stunden." },
    { code: "mailbox", label: "Mailbox besprochen", hinweis: "Nachricht hinterlassen." },
    { code: "rueckruf_termin", label: "Rückruf vereinbart am …", hinweis: "Mit Datum und Uhrzeit (deutsche Zeit)." },
    {
      code: "nummer_falsch", label: "Nummer falsch",
      hinweis: "Die Nummer stimmt nicht oder gehört jemand anderem.",
      mail: "Der Interessent erhält eine E-Mail zur Nummern-Korrektur (max. 1×/Tag).",
    },
  ],
};
