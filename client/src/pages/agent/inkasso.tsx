import { useCallback, useEffect, useState } from "react";
import { AgentShell } from "./shared";
import { Gespraechsblatt } from "@/components/Gespraechsblatt";
import { MarkeBrief, SendeMenue } from "@/components/SendeMenue";
import { MarkeFunke, MarkeHoerer, anrufStarten } from "@/components/Softphone";
import { ZusageTafel } from "./vertrieb-zusage";

// ═══════════════════════════════════════════════════════════════════════════
// FORDERUNGSMANAGEMENT — eine Liste, von oben nach unten
//
// Die Reihenfolge macht der Server (fiaon-inkasso.ts). Hier gibt es bewusst
// KEINE Sortierumschaltung: Wer sich seine Liste selbst sortieren darf, arbeitet
// die bequemen Fälle zuerst — und die teuren bleiben liegen.
//
// WAS ES HIER NICHT GIBT: Erlass, Stundung, Kürzung, Storno. Nicht als
// gesperrter Knopf, sondern überhaupt nicht. Wer einen Nachlass braucht, geht
// über „Härtefall an den Vorgesetzten".
// ═══════════════════════════════════════════════════════════════════════════

interface Fall {
  rate_id: number; ref: string; rate_nr: number; betrag_cents: number;
  zahlungsreferenz: string; faellig_am: string; mahnstufe: number;
  erinnerungen: number; letzte_erinnerung_at: string | null;
  inkasso_wiedervorlage: string | null; inkasso_zusage_am: string | null;
  inkasso_versuche: number; eskaliert_am: string | null;
  person_id: number; name: string; email: string | null;
  phone: string | null; phone_country_code: string | null; paket: string | null;
  ueberfaellig: boolean; tage_ueberfaellig: number;
  anruf_pflicht: boolean; zusage_gebrochen: boolean;
  raten_bezahlt: number; raten_gesamt: number;
  letzter_bearbeiter: string | null; letztes_ergebnis: string | null;
}

function eur(cent: unknown): string {
  return `${(Number(cent ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
}

function datum(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" });
}

/** Uhr — 20×20, 1,5 px. Für die Zeiterfassung. */
function MarkeUhr({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7.2" /><path d="M10 6.2V10l2.6 1.8" />
    </svg>
  );
}

const STUFE_TON: Record<number, { text: string; farbe: string }> = {
  0: { text: "noch nicht gemahnt", farbe: "#64748b" },
  1: { text: "Mahnstufe 1", farbe: "#1d4ed8" },
  2: { text: "Mahnstufe 2", farbe: "#b45309" },
  3: { text: "Mahnstufe 3 — Versand beendet", farbe: "#b91c1c" },
};

export default function AgentInkasso() {
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [zugang, setZugang] = useState<"pruefe" | "offen" | "kein" | "frei">("pruefe");
  const [reiter, setReiter] = useState<"liste" | "stunden">(
    () => (new URLSearchParams(window.location.search).get("tab") === "stunden" ? "stunden" : "liste"),
  );
  const [blatt, setBlatt] = useState<number | null>(null);
  // Das Sende-Menü gehört zur ZEILE, nicht zur Seite: Es zeigt den Stand genau
  // dieses Kunden, und zwei geöffnete Zeilen sollen sich nicht in die Quere
  // kommen.
  const [sendeMenue, setSendeMenue] = useState<number | null>(null);
  const [offenerFall, setOffenerFall] = useState<Fall | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  // Das Fristfenster. Vorgabe „überfällig": Wer die Seite öffnet, soll dort
  // anfangen, wo es brennt — nicht bei einer Rate, die in sechs Tagen fällig
  // wird.
  const [frist, setFrist] = useState<"ueberfaellig" | "heute" | "woche" | "alle">("ueberfaellig");

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await fetch(`/api/fiaon/inkasso/liste?frist=${frist}`, { credentials: "include" }).catch(() => null);
    if (r?.status === 404) { setZugang("kein"); setLaedt(false); return; }
    const j = await r?.json().catch(() => null);
    if (j?.zusageOffen) { setZugang("offen"); setLaedt(false); return; }
    if (j?.ok) { setDaten(j); setZugang("frei"); }
    setLaedt(false);
  }, [frist]);
  useEffect(() => { void laden(); }, [laden]);

  if (zugang === "pruefe" || laedt) {
    return <AgentShell><p className="py-16 text-center text-[13px] text-slate-400">Wird geladen …</p></AgentShell>;
  }
  if (zugang === "kein") {
    return (
      <AgentShell>
        <p className="py-16 text-center text-[14px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
          Diese Seite gibt es nicht.
        </p>
      </AgentShell>
    );
  }
  if (zugang === "offen") {
    // DIESELBE Tafel wie bei Vertrieb und Onboarding — nur mit anderem Pfad.
    // Eine eigene Fassung für diesen Bereich hieße: zwei Rechtsstrecken pflegen.
    return (
      <AgentShell>
        <ZusageTafel basis="/inkasso/zusage" onAngenommen={() => void laden()} />
      </AgentShell>
    );
  }

  const z = daten?.zahlen ?? {};
  const v = daten?.verdienst ?? {};
  const liste: Fall[] = daten?.liste ?? [];

  return (
    <AgentShell>
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-[21px] font-bold tracking-tight" style={{ color: "var(--fi-text)" }}>
            Forderungsmanagement
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fi-text-still)" }}>
            Von oben nach unten. Die Reihenfolge macht das System — der dringendste Fall steht zuerst.
          </p>
        </div>

        {meldung && (
          <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {/* ── Kennzahlen ──────────────────────────────────────────────────── */}
        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {[
            { t: "Heute fällig", w: eur(z.heute_cents), z: `${z.heute_anzahl ?? 0} Raten` },
            { t: "Überfällig", w: eur(z.ueberfaellig_cents), z: `${z.ueberfaellig_anzahl ?? 0} Raten` },
            { t: "Diesen Monat eingezogen", w: eur(z.eingezogen_monat_cents), z: `${z.eingezogen_monat_anzahl ?? 0} Raten` },
            {
              t: "Einzugsquote", w: z.quote != null ? `${z.quote} %` : "—",
              z: z.quote_nenner ? `von ${z.quote_nenner} fällig` : "keine Basis",
            },
            { t: "Aktive Zusagen", w: String(z.zusagen_aktiv ?? 0), z: `${z.zusagen_gebrochen ?? 0} gebrochen` },
          ].map((k) => (
            <div key={k.t} className="fi-karte p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: "var(--fi-text-still)" }}>{k.t}</p>
              <p className="text-[17px] font-bold tabular-nums leading-tight mt-0.5" style={{ color: "var(--fi-text)" }}>{k.w}</p>
              <p className="text-[10.5px]" style={{ color: "var(--fi-text-still)" }}>{k.z}</p>
            </div>
          ))}
        </div>

        {/* ── Verdienst ───────────────────────────────────────────────────── */}
        <div className="fi-karte p-4 mb-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--fi-text-still)" }}>
              Dein Verdienst diesen Monat
            </p>
            <p className="text-[20px] font-bold tabular-nums" style={{ color: "var(--fi-primaer)" }}>
              {eur(v.gesamtCents)}
            </p>
            <p className="text-[12px]" style={{ color: "var(--fi-text-still)" }}>
              {Math.floor(Number(v.bestaetigtMinuten ?? 0) / 60)} Std bestätigt ({eur(v.stundenCents)})
              {" · "}{v.praemienAnzahl ?? 0} eingezogene {Number(v.praemienAnzahl) === 1 ? "Rate" : "Raten"} ({eur(v.praemienCents)})
            </p>
          </div>
          {Number(v.offeneMinuten) > 0 && (
            <p className="text-[11.5px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>
              {Math.floor(Number(v.offeneMinuten) / 60)} Std {Number(v.offeneMinuten) % 60} Min warten noch auf die
              monatliche Bestätigung durch den Vorgesetzten.
            </p>
          )}
          {!v.verguetungBestaetigt && (
            <p className="text-[11.5px] mt-1.5 font-semibold" style={{ color: "#b45309" }}>
              Stundensatz und Prämie sind noch nicht vom Vorgesetzter bestätigt. Bis dahin werden
              keine Prämien gebucht — deine Arbeit wird aber vollständig festgehalten.
            </p>
          )}
        </div>

        {/* ── Reiter ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 mb-3">
          {([["liste", `Arbeitsliste (${liste.length})`], ["stunden", "Meine Zeiten"]] as const).map(([w, t]) => (
            <button key={w} type="button" onClick={() => setReiter(w)}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={reiter === w
                      ? { background: "var(--fi-primaer)", color: "#fff" }
                      : { background: "var(--fi-flaeche)", color: "var(--fi-text-still)" }}>
              {t}
            </button>
          ))}
        </div>

        {reiter === "stunden" && <Zeiten onMeldung={setMeldung} />}

        {/* ══════════════════════════════════════════════════════════════════
            DAS FRISTFENSTER

            ── DER ANLASS ────────────────────────────────────────────────────
            Der Vorgesetzte: „Die Mitarbeiter von Forderungsmanagement
            erhalten AUSSCHLIESSLICH die Kunden, deren Abo-Raten überfällig
            sind — nur diese! Aktuell haben sie irgendwelche anderen Kunden."

            Gemessen: 153 von 251 Raten im Sichtfeld waren erst SPÄTER als in
            sieben Tagen fällig. Eine Arbeitsliste, in der drei von fünf
            Zeilen nichts zu tun geben, wird überflogen — und dann übersieht
            man auch die zwei, bei denen es brennt.

            Die Zahl steht am Knopf: Ein Filter ohne Zahl ist eine Frage, mit
            Zahl eine Auskunft.
            ══════════════════════════════════════════════════════════════════ */}
        {reiter === "liste" && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
            {([
              ["ueberfaellig", "Überfällig", daten?.fenster?.ueberfaellig ?? 0, "#b91c1c"],
              ["heute", "Heute fällig", daten?.fenster?.heute ?? 0, "#b45309"],
              ["woche", "Nächste 7 Tage", daten?.fenster?.woche ?? 0, "#1d4ed8"],
              ["alle", "Alle drei", daten?.fenster?.alle ?? 0, "#475569"],
            ] as const).map(([w, t, n, farbe]) => (
              <button key={w} type="button" onClick={() => setFrist(w as any)}
                      className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold inline-flex items-center gap-2"
                      style={frist === w
                        ? { background: farbe, color: "#fff" }
                        : { background: "rgba(15,23,42,.04)", color: "#475569" }}>
                {t}
                <span className="tabular-nums font-bold"
                      style={{ opacity: frist === w ? .9 : .6 }}>{n}</span>
              </button>
            ))}
          </div>
        )}

        {reiter === "liste" && daten?.nurMeine && (
          <p className="mb-3 text-[11.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
            Du siehst deine zugeteilten Fälle. Weiter oben ist keine Rate mehr, die niemandem gehört.
          </p>
        )}

        {/* ── Arbeitsliste ────────────────────────────────────────────────── */}
        {reiter === "liste" && liste.length === 0 && (
          <p className="fi-karte p-8 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>
            {frist === "ueberfaellig"
              ? "Keine überfällige Rate. Das ist die beste Nachricht des Tages — schau in „Heute fällig“ oder „Nächste 7 Tage“, was ansteht."
              : frist === "heute"
                ? "Heute wird keine Rate fällig."
                : frist === "woche"
                  ? "In den nächsten sieben Tagen wird keine Rate fällig."
                  : "Nichts offen. Alle fälligen Raten sind bearbeitet oder haben eine Wiedervorlage in der Zukunft."}
          </p>
        )}

        {reiter === "liste" && liste.map((f, i) => {
          const stufe = STUFE_TON[Math.min(3, Number(f.mahnstufe))] ?? STUFE_TON[0];
          return (
            <div key={f.rate_id} className="fi-karte p-4 mb-2.5"
                 style={{ animation: `inkAuf 380ms cubic-bezier(.32,.72,0,1) ${Math.min(i, 8) * 40}ms both` }}>
              {/* Dringlichkeitsband — zuerst lesen, dann entscheiden. */}
              {(f.anruf_pflicht || f.zusage_gebrochen) && (
                <p className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5"
                   style={{ color: f.anruf_pflicht ? "#b91c1c" : "#b45309" }}>
                  {f.anruf_pflicht
                    ? "Anruf-Pflicht — der automatische Versand ist zu Ende"
                    : `Zusage gebrochen — zugesagt war der ${datum(f.inkasso_zusage_am)}`}
                </p>
              )}

              <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold" style={{ color: "var(--fi-text)" }}>{f.name}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                    Rate {f.rate_nr} von {f.raten_gesamt} · {f.paket || "—"}
                    {" · "}{f.raten_bezahlt} bezahlt
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[17px] font-bold tabular-nums" style={{ color: "var(--fi-text)" }}>
                    {eur(f.betrag_cents)}
                  </p>
                  <p className="text-[11px]" style={{ color: f.ueberfaellig ? "#b45309" : "var(--fi-text-still)" }}>
                    {f.ueberfaellig
                      ? `seit ${f.tage_ueberfaellig} ${Number(f.tage_ueberfaellig) === 1 ? "Tag" : "Tagen"} fällig`
                      : `fällig ${datum(f.faellig_am)}`}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
                   style={{ color: "var(--fi-text-still)" }}>
                <span className="font-semibold" style={{ color: stufe.farbe }}>{stufe.text}</span>
                <span>{f.erinnerungen} {f.erinnerungen === 1 ? "Erinnerung" : "Erinnerungen"}
                  {f.letzte_erinnerung_at && `, letzte ${datum(f.letzte_erinnerung_at)}`}</span>
                {/* Der Verwendungszweck der RATE — nicht der der Bestellung.
                    Am Telefon ist das die erste Frage. */}
                <span className="font-mono text-[11px]">{f.zahlungsreferenz}</span>
                {f.inkasso_versuche > 0 && <span>{f.inkasso_versuche} Anrufversuche</span>}
                {f.letzter_bearbeiter && <span>zuletzt: {f.letzter_bearbeiter}</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {f.phone && (
                  <button type="button"
                          onClick={() => anrufStarten(
                            `${f.phone_country_code || "+49"}${String(f.phone).replace(/^0/, "")}`,
                            f.person_id, f.name,
                          )}
                          className="fi-primaerknopf inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold">
                    <MarkeHoerer size={14} /> Anrufen
                  </button>
                )}
                <button type="button" onClick={() => setBlatt(f.person_id)}
                        className="fi-zweitknopf inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold">
                  <MarkeFunke size={13} /> Gesprächsblatt
                </button>
                {/* ══════════════════════════════════════════════════════════
                    DIE AKTIONEN, DIE GEFEHLT HABEN

                    Der Vorgesetzte: „Diese müssen die Kundenakte aufmachen
                    können, Funktionen durchführen können (E-Mails senden,
                    Zahlungen senden, Beitrag senden)."

                    Hier standen drei Knöpfe: Anrufen, Gesprächsblatt,
                    Ergebnis. Wer telefoniert und hört „schicken Sie mir die
                    Daten nochmal", konnte genau das nicht tun — er musste
                    einen Kollegen bitten.

                    Es sind DIESELBEN Bausteine wie im Vertrieb, nicht
                    nachgebaute: `SendeMenue` mit derselben Adresse, dieselbe
                    Kundenakte. Ein zweiter Weg zur selben Mail wäre ein
                    zweiter Weg, den man beim nächsten Textwechsel vergisst.
                    ══════════════════════════════════════════════════════════ */}
                <button type="button" onClick={() => setSendeMenue(f.person_id)}
                        className="fi-sendeknopf inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold">
                  <MarkeBrief size={13} /> Senden
                </button>
                <a href={`/admin/kunde/${f.person_id}`} target="_blank" rel="noopener"
                   className="fi-zweitknopf inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold">
                  Kundenakte
                </a>
                <button type="button" onClick={() => setOffenerFall(f)}
                        className="fi-zweitknopf px-3 py-2 text-[12px] font-semibold">
                  Ergebnis festhalten
                </button>
              </div>

              {sendeMenue === f.person_id && (
                <SendeMenue personId={f.person_id} offen
                            basis="/api/fiaon/agent/mail"
                            onSchliessen={() => setSendeMenue(null)}
                            onGesendet={() => { setSendeMenue(null); void laden(); }} />
              )}
            </div>
          );
        })}

        <style>{`
          @keyframes inkAuf { from { opacity: 0; transform: translateY(9px) } to { opacity: 1; transform: none } }
          @media (prefers-reduced-motion: reduce) { [style*="inkAuf"] { animation: none !important } }
        `}</style>
      </div>

      {blatt != null && (
        <Gespraechsblatt personId={blatt} offen onZu={() => setBlatt(null)} />
      )}
      {offenerFall && (
        <ErgebnisDialog fall={offenerFall} ergebnisse={daten?.ergebnisse ?? []}
                        onZu={() => setOffenerFall(null)}
                        onFertig={(t) => { setOffenerFall(null); setMeldung({ art: "gut", text: t }); void laden(); }} />
      )}
    </AgentShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERGEBNIS — vier Möglichkeiten, kein fünftes
// ═══════════════════════════════════════════════════════════════════════════

function ErgebnisDialog({
  fall, ergebnisse, onZu, onFertig,
}: {
  fall: Fall;
  ergebnisse: { art: string; label: string; braucht?: string; hinweis: string }[];
  onZu: () => void;
  onFertig: (text: string) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [datumWert, setDatumWert] = useState("");
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const e = ergebnisse.find((x) => x.art === gewaehlt);

  const senden = async () => {
    if (!gewaehlt) return;
    setBusy(true); setFehler(null);
    const r = await fetch(`/api/fiaon/inkasso/rate/${fall.rate_id}/ergebnis`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ergebnis: gewaehlt, zusageDatum: datumWert || null, notiz: notiz || null }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setFehler(j?.error || "Fehler."); return; }
    onFertig(j.meldung);
  };

  return (
    <>
      <div className="fixed inset-0 z-[380]" onClick={onZu} aria-hidden="true"
           style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(9px)", WebkitBackdropFilter: "blur(9px)" }} />
      <div className="fixed inset-0 z-[381] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Ergebnis festhalten"
             className="w-full flex flex-col overflow-hidden pointer-events-auto"
             style={{ maxWidth: 520, maxHeight: "90vh", background: "#fff", borderRadius: 22,
                      boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)" }}>
          <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.2em] text-slate-400">
              Rate {fall.rate_nr} · {eur(fall.betrag_cents)}
            </p>
            <h2 className="mt-0.5 text-[18px] font-bold tracking-tight text-slate-900 truncate">{fall.name}</h2>
            <p className="text-[11.5px] text-slate-400 font-mono">{fall.zahlungsreferenz}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
            {fehler && <p className="mb-3 text-[12.5px] font-semibold text-amber-700">{fehler}</p>}

            <div className="space-y-1.5">
              {ergebnisse.map((x) => (
                <button key={x.art} type="button" onClick={() => { setGewaehlt(x.art); setFehler(null); }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl"
                        style={gewaehlt === x.art
                          ? { background: "rgba(29,78,216,.07)", border: "1px solid rgba(29,78,216,.3)" }
                          : { background: "#f8fafc", border: "1px solid transparent" }}>
                  <span className="block text-[13px] font-bold text-slate-900">{x.label}</span>
                  <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">{x.hinweis}</span>
                </button>
              ))}
            </div>

            {e?.braucht === "datum" && (
              <div className="mt-3">
                <label className="block text-[11.5px] font-semibold text-slate-500 mb-1">
                  Welchen Tag hat er genannt?
                </label>
                <input type="date" value={datumWert} onChange={(ev) => setDatumWert(ev.target.value)}
                       className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px]" />
              </div>
            )}
            {e?.braucht === "notiz" && (
              <div className="mt-3">
                <label className="block text-[11.5px] font-semibold text-slate-500 mb-1">
                  Was hat der Kunde gesagt? (Pflicht — der Vorgesetzte entscheidet danach)
                </label>
                <textarea value={notiz} onChange={(ev) => setNotiz(ev.target.value)} rows={4}
                          placeholder="Zwei Sätze genügen. Wörtlich ist besser als zusammengefasst."
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] leading-relaxed resize-none" />
              </div>
            )}
            {e && e.braucht !== "notiz" && (
              <textarea value={notiz} onChange={(ev) => setNotiz(ev.target.value)} rows={2}
                        placeholder="Notiz (freiwillig)"
                        className="w-full mt-3 px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] resize-none" />
            )}

            <p className="mt-4 text-[11px] text-slate-400 leading-snug">
              Erlass, Stundung und Storno gibt es in diesem Bereich nicht. Wenn ein Kunde
              wirklich nicht zahlen kann, ist „Härtefall an den Vorgesetzten" die richtige Wahl —
              nicht mehr Druck.
            </p>
          </div>

          <div className="px-5 sm:px-7 py-4 shrink-0 flex items-center gap-2" style={{ borderTop: "1px solid #f1f5f9" }}>
            <button type="button" onClick={onZu} className="text-[13px] font-semibold text-slate-500">Abbrechen</button>
            <button type="button" onClick={() => void senden()} disabled={busy || !gewaehlt}
                    className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] disabled:opacity-30">
              {busy ? "…" : "Festhalten"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ZEITEN — erfassen, warten, bestätigt
// ═══════════════════════════════════════════════════════════════════════════

function Zeiten({ onMeldung }: { onMeldung: (m: { art: "gut" | "schlecht"; text: string }) => void }) {
  const [daten, setDaten] = useState<any>(null);
  const [form, setForm] = useState({ tag: new Date().toISOString().slice(0, 10), von: "", bis: "", notiz: "" });
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    const r = await fetch("/api/fiaon/inkasso/stunden", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setDaten(j);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const speichern = async () => {
    setBusy(true);
    const r = await fetch("/api/fiaon/inkasso/stunden", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    onMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
    if (j?.ok) { setForm((f) => ({ ...f, von: "", bis: "", notiz: "" })); void laden(); }
  };

  return (
    <div>
      <div className="fi-karte p-4 mb-3">
        <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2.5 inline-flex items-center gap-1.5"
           style={{ color: "var(--fi-text-still)" }}>
          <MarkeUhr size={14} /> Arbeitszeit erfassen
        </p>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          <input type="date" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                 aria-label="Tag" className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
          <input type="time" value={form.von} onChange={(e) => setForm((f) => ({ ...f, von: e.target.value }))}
                 aria-label="von" className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
          <input type="time" value={form.bis} onChange={(e) => setForm((f) => ({ ...f, bis: e.target.value }))}
                 aria-label="bis" className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
        </div>
        <input value={form.notiz} onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
               placeholder="Woran hast du gearbeitet? (freiwillig)"
               className="w-full mt-2 px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
        <button type="button" onClick={() => void speichern()} disabled={busy || !form.von || !form.bis}
                className="fi-primaerknopf mt-2.5 px-4 py-2.5 text-[13px] font-semibold disabled:opacity-30">
          {busy ? "…" : "Eintragen"}
        </button>
        <p className="text-[11px] mt-2 leading-snug" style={{ color: "var(--fi-text-still)" }}>
          Der Vorgesetzte bestätigt einmal im Monat. Bestätigte Zeiten lassen sich danach nicht
          mehr ändern — auch nicht von ihm. Das schützt deine Abrechnung.
        </p>
      </div>

      {(daten?.stunden ?? []).length === 0 && (
        <p className="fi-karte p-6 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>
          Noch keine Zeiten erfasst.
        </p>
      )}
      {(daten?.stunden ?? []).map((s: any) => (
        <div key={s.id} className="fi-karte px-4 py-2.5 mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--fi-text)" }}>
            {datum(s.tag)}
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: "var(--fi-text-still)" }}>
            {String(s.von).slice(0, 5)}–{String(s.bis).slice(0, 5)}
          </span>
          <span className="text-[12.5px] font-bold tabular-nums" style={{ color: "var(--fi-text)" }}>
            {Math.floor(s.minuten / 60)}:{String(s.minuten % 60).padStart(2, "0")}
          </span>
          {s.notiz && <span className="text-[11.5px] truncate" style={{ color: "var(--fi-text-still)" }}>{s.notiz}</span>}
          <span className="ml-auto text-[11.5px] font-semibold"
                style={{ color: s.bestaetigt_am ? "#047857" : "#b45309" }}>
            {s.bestaetigt_am ? "bestätigt" : "wartet"}
          </span>
          {!s.bestaetigt_am && (
            <button type="button"
                    onClick={async () => {
                      await fetch(`/api/fiaon/inkasso/stunden/${s.id}/entfernen`, {
                        method: "POST", credentials: "include",
                      }).catch(() => {});
                      void laden();
                    }}
                    className="text-[11.5px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              entfernen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
