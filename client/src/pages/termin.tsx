import { useCallback, useEffect, useMemo, useState } from "react";
import { anrufHinweis, anrufHinweisKurz, ABSAGE_HINWEIS } from "@shared/fiaon-termin-text";
import { useRoute } from "wouter";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

// ═══════════════════════════════════════════════════════════════════════════
// /termin/:token — der Kunde sucht sich selbst eine Uhrzeit
//
// KEIN LOGIN. Der Link trägt ein signiertes Token (Muster der Rechnungs-Links),
// mehr braucht es nicht: Ein Kunde, der erst ein Konto anlegen muss, um einen
// Rückruf zu vereinbaren, vereinbart keinen Rückruf.
//
// WORTWAHL
// „Gespräch mit deinem persönlichen Ansprechpartner" — nirgends „Beratung",
// „Berater" oder „Finanzberatung". Das ist keine Kosmetik: Diese Begriffe sind
// erlaubnispflichtig belegt, und eine Terminseite ist der letzte Ort, an dem
// man sie versehentlich verwenden sollte.
//
// MOBIL ZUERST
// Der Link kommt per Mail oder WhatsApp, also wird er auf dem Telefon
// geöffnet. Die Zeitknöpfe sind deshalb mindestens 44 px hoch und liegen in
// einem Raster, das bei 380 px Breite noch drei Spalten trägt.
// ═══════════════════════════════════════════════════════════════════════════

interface Slot {
  beginn: string;
  datum: string;
  uhrzeit: string;
  agentId: number;
  agentVorname: string;
}

interface Auskunft {
  vorname: string | null;
  betreuer: { id: number; vorname: string } | null;
  slots: Slot[];
  slotMinuten: number;
  horizontTage: number;
  termin: {
    beginn: string; datumText: string; uhrzeit: string;
    agentVorname: string; stornoToken: string;
  } | null;
}

const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** „Montag, 12. August" — ausgeschrieben, weil die Seite Ruhe ausstrahlen soll. */
function tagUeberschrift(datumISO: string): string {
  const [y, m, d] = datumISO.split("-").map(Number);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const morgen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" })
    .format(new Date(Date.now() + 86_400_000));
  if (datumISO === heute) return "Heute";
  if (datumISO === morgen) return "Morgen";
  const datum = new Date(Date.UTC(y, m - 1, d));
  return `${WOCHENTAG[datum.getUTCDay()]}, ${d}. ${datum.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" })}`;
}

export default function TerminPage() {
  const [, params] = useRoute("/termin/:token");
  const token = params?.token || "";

  const [daten, setDaten] = useState<Auskunft | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [gewaehlt, setGewaehlt] = useState<Slot | null>(null);
  const [bucht, setBucht] = useState(false);
  const [fertig, setFertig] = useState<{ datumText: string; uhrzeit: string; agentVorname: string } | null>(null);
  /**
   * Wie viele Tage auf einmal. Vierzehn Tage à 27 Zeiten sind fast 400 Knöpfe —
   * auf dem Telefon scrollt daran niemand vorbei. Die ersten drei Tage
   * beantworten die Frage „geht es diese Woche?" fast immer.
   */
  const [tageOffen, setTageOffen] = useState(3);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await fetch(`/api/fiaon/termin/${encodeURIComponent(token)}`).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok || !json?.ok) {
      setFehler(json?.hinweis || json?.error || "Dieser Link ist leider nicht mehr gültig.");
      setLaedt(false);
      return;
    }
    setDaten(json);
    setLaedt(false);
  }, [token]);

  useEffect(() => { void laden(); }, [laden]);

  /** Slots nach Tag gruppieren — eine flache Liste mit 300 Knöpfen ist unlesbar. */
  const tage = useMemo(() => {
    if (!daten) return [];
    const map = new Map<string, Slot[]>();
    for (const s of daten.slots) {
      const liste = map.get(s.datum) || [];
      liste.push(s);
      map.set(s.datum, liste);
    }
    return Array.from(map.entries()).map(([datum, slots]) => ({ datum, slots }));
  }, [daten]);

  const buchen = async () => {
    if (!gewaehlt) return;
    setBucht(true);
    const res = await fetch(`/api/fiaon/termin/${encodeURIComponent(token)}/buchen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beginn: gewaehlt.beginn, agentId: gewaehlt.agentId }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBucht(false);
    if (!json?.ok) {
      setFehler(json?.error || "Der Termin konnte nicht gebucht werden. Bitte versuch es erneut.");
      setGewaehlt(null);
      void laden();
      return;
    }
    setFertig(json.termin);
  };

  const absagen = async (stornoToken: string) => {
    const res = await fetch(`/api/fiaon/termin/absagen/${encodeURIComponent(stornoToken)}`, { method: "POST" })
      .catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.ok) { setFertig(null); setGewaehlt(null); void laden(); }
    else setFehler(json?.error || "Die Absage hat nicht geklappt.");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlassNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">

        {laedt && (
          <div className="text-center py-16">
            <p className="text-[14px] text-slate-500">Freie Zeiten werden geladen …</p>
          </div>
        )}

        {/* ── Nach der Buchung ─────────────────────────────────────────────── */}
        {!laedt && fertig && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Termin steht</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
              <b className="text-slate-900">{fertig.datumText} um {fertig.uhrzeit} Uhr</b>.
              {" "}Du bekommst gleich eine Bestätigung per E-Mail.
            </p>
            {/* ── DER ANRUF-SATZ, HERVORGEHOBEN ────────────────────────────
                Er stand vorher mitten im Absatz („… ruft dich an. Du bekommst
                gleich …") — dort liest ihn niemand, der die Seite überfliegt.
                Wer einen Link erwartet, sucht nach einem Link und übersieht
                Fließtext. Deshalb steht der Satz jetzt allein, in einem Rahmen,
                mit dem Telefon-Zeichen davor. */}
            <div className="mt-4 mx-auto max-w-md flex items-start gap-2.5 text-left px-4 py-3 rounded-xl"
                 style={{ background: "rgba(29,78,216,.05)", boxShadow: "inset 0 0 0 1px rgba(29,78,216,.16)" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#1d4ed8" strokeWidth={1.5}
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                   style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
              </svg>
              <span className="text-[13.5px] leading-relaxed" style={{ color: "#1e3a8a" }}>
                <b>{anrufHinweis(fertig.agentVorname)}</b>
                <br />
                <span style={{ color: "rgba(30,58,138,.72)" }}>{ABSAGE_HINWEIS}</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Es gibt schon einen Termin ───────────────────────────────────── */}
        {!laedt && !fertig && daten?.termin && (
          <div className="py-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Dein Termin</h1>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                <b className="text-slate-900">{daten.termin.datumText} um {daten.termin.uhrzeit} Uhr</b> mit {daten.termin.agentVorname}.
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-center">
              <p className="text-[13px] text-slate-600 mb-3">
                Passt die Zeit nicht mehr? Sag ab und wähl direkt eine neue.
              </p>
              <button type="button" onClick={() => void absagen(daten.termin!.stornoToken)}
                      className="px-4 py-2.5 rounded-xl text-[13px] font-bold border border-slate-300 bg-white hover:bg-slate-50"
                      style={{ minHeight: 44 }}>
                Termin absagen und neu wählen
              </button>
            </div>
          </div>
        )}

        {/* ── Fehler ───────────────────────────────────────────────────────── */}
        {!laedt && fehler && !daten?.termin && !fertig && (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold tracking-tight mb-3">Das hat nicht geklappt</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">{fehler}</p>
          </div>
        )}

        {/* ── Die Auswahl ──────────────────────────────────────────────────── */}
        {!laedt && daten && !daten.termin && !fertig && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 leading-tight">
                {daten.vorname ? `${daten.vorname}, wann passt es dir?` : "Wann passt es dir?"}
              </h1>
              <p className="text-[14px] text-slate-500 leading-relaxed">
                Wähl eine Zeit für ein {daten.slotMinuten}-minütiges Gespräch mit
                {" "}{daten.betreuer
                  ? <b className="text-slate-900">{daten.betreuer.vorname}, deinem persönlichen Ansprechpartner</b>
                  : <b className="text-slate-900">deinem persönlichen Ansprechpartner</b>}.
              </p>
              {/* ── DER ANRUF-SATZ, VOR DER WAHL ─────────────────────────────
                  Hier stand „Wir rufen dich zur gewählten Zeit an." am Ende des
                  Absatzes. Richtig, aber zu leise: Wer einen Link erwartet,
                  liest den Absatz nicht bis zum Punkt, sondern sucht nach einer
                  Adresse. Der Satz steht jetzt in einer eigenen Zeile, mit dem
                  Telefon-Zeichen — und er nennt ausdrücklich „halte dein
                  Telefon bereit", weil das die Handlung ist, die zählt. */}
              <p className="mt-3 flex items-start justify-center gap-2 text-[13px] font-semibold"
                 style={{ color: "#1e3a8a" }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                     strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                     style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M6.2 3.6c.7 0 1.3.5 1.5 1.2l.5 2a1.6 1.6 0 0 1-.5 1.6l-.9.8a9 9 0 0 0 4 4l.8-.9a1.6 1.6 0 0 1 1.6-.5l2 .5c.7.2 1.2.8 1.2 1.5v1.7c0 .9-.8 1.6-1.7 1.5C8.3 16.7 3.3 11.7 2.7 5.3c-.1-.9.6-1.7 1.5-1.7h2Z" />
                </svg>
                <span>{anrufHinweis(daten.betreuer?.vorname)}</span>
              </p>
            </div>

            {tage.length === 0 && (
              <div className="p-6 rounded-2xl border border-slate-200 text-center">
                <p className="text-[14px] font-semibold text-slate-900">Gerade sind keine Zeiten frei.</p>
                <p className="text-[13px] text-slate-500 mt-1.5">
                  Dein Ansprechpartner meldet sich in den nächsten Tagen bei dir.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {tage.slice(0, tageOffen).map(({ datum, slots }) => (
                <div key={datum}>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    {tagUeberschrift(datum)}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => {
                      const an = gewaehlt?.beginn === s.beginn && gewaehlt?.agentId === s.agentId;
                      return (
                        <button key={`${s.agentId}-${s.beginn}`} type="button"
                                onClick={() => setGewaehlt(an ? null : s)}
                                className={`rounded-xl text-[14px] font-semibold transition-all ${
                                  an ? "bg-[#1d4ed8] text-white border border-[#1d4ed8]"
                                     : "bg-white text-slate-900 border border-slate-200 hover:border-slate-400"
                                }`}
                                style={{ minHeight: 46 }}>
                          {s.uhrzeit}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {tage.length > tageOffen && (
              <button type="button" onClick={() => setTageOffen((n) => n + 4)}
                      className="w-full mt-5 rounded-xl text-[13.5px] font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50"
                      style={{ minHeight: 46 }}>
                Weitere Tage anzeigen ({tage.length - tageOffen} noch)
              </button>
            )}

            {gewaehlt && (
              <div className="sticky bottom-4 mt-8">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <p className="text-[13px] text-slate-600 mb-3">
                    <b className="text-slate-900">{tagUeberschrift(gewaehlt.datum)}, {gewaehlt.uhrzeit} Uhr</b>
                    {" "}— {anrufHinweisKurz(gewaehlt.agentVorname)}
                  </p>
                  <button type="button" onClick={() => void buchen()} disabled={bucht}
                          className="w-full rounded-xl text-[15px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-60"
                          style={{ minHeight: 50 }}>
                    {bucht ? "Wird gebucht …" : "Termin verbindlich wählen"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <PremiumFooter />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// /termin/absagen/:stornoToken — der Link aus der Bestätigungsmail
// ═══════════════════════════════════════════════════════════════════════════
export function TerminAbsagenPage() {
  const [, params] = useRoute("/termin/absagen/:stornoToken");
  const token = params?.stornoToken || "";
  const [stand, setStand] = useState<"frage" | "laeuft" | "weg" | "fehler">("frage");
  const [neuBuchen, setNeuBuchen] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");

  const absagen = async () => {
    setStand("laeuft");
    const res = await fetch(`/api/fiaon/termin/absagen/${encodeURIComponent(token)}`, { method: "POST" })
      .catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.ok) { setNeuBuchen(json.neuBuchen || null); setStand("weg"); }
    else { setFehler(json?.error || "Die Absage hat nicht geklappt."); setStand("fehler"); }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlassNav />
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16 text-center">
        {stand === "weg" ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Termin abgesagt</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed">
              Die Zeit ist wieder frei. Wenn du möchtest, wähl gleich eine neue.
            </p>
            {neuBuchen && (
              <a href={neuBuchen}
                 className="inline-block mt-6 px-5 py-3 rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af]"
                 style={{ minHeight: 46 }}>
                Neuen Termin wählen
              </a>
            )}
          </>
        ) : stand === "fehler" ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Das hat nicht geklappt</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed">{fehler}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Termin absagen?</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
              Dein Ansprechpartner ruft dich dann nicht an. Du kannst danach jederzeit eine neue Zeit wählen.
            </p>
            <button type="button" onClick={() => void absagen()} disabled={stand === "laeuft"}
                    className="px-5 py-3 rounded-xl text-[14px] font-bold border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60"
                    style={{ minHeight: 46 }}>
              {stand === "laeuft" ? "Wird abgesagt …" : "Ja, Termin absagen"}
            </button>
          </>
        )}
      </div>
      <PremiumFooter />
    </div>
  );
}
