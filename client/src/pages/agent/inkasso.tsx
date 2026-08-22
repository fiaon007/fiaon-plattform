import { useCallback, useEffect, useState } from "react";
import { AgentShell } from "./shared";
import { FiaonEbene } from "@/components/FiaonEbene";
import { MarkeBrief, SendeMenue } from "@/components/SendeMenue";
import { MarkeFunke, MarkeHoerer, anrufStarten } from "@/components/Softphone";
import { ZusageTafel } from "./vertrieb-zusage";
import { AnrufPlayer } from "@/components/AnrufPlayer";

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
  // Aus `waehlbareNummer` — nie selbst zusammensetzen (siehe Begründung am Knopf).
  telefonAnzeige: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
  ueberfaellig: boolean; tage_ueberfaellig: number;
  anruf_pflicht: boolean; zusage_gebrochen: boolean;
  raten_bezahlt: number; raten_gesamt: number;
  letzter_bearbeiter: string | null; letztes_ergebnis: string | null;
  /** Lastschrift (GoCardless): eingereicht | eingezogen | fehlgeschlagen | abgebrochen | null */
  lastschrift_status?: string | null; lastschrift_grund?: string | null; lastschrift_am?: string | null;
  /** Mandat an der Person: active | pending_submission | cancelled | failed | expired | null */
  gc_mandate_status?: string | null;
}

/** Ein Satz zum Mandat — derselbe in Liste und Akte. */
function mandatText(status: unknown): string | null {
  const s = String(status ?? "");
  if (!s) return null;
  if (s === "active") return "Lastschrift aktiv — die nächste Rate wird automatisch eingezogen";
  if (s === "pending_submission" || s === "submitted") return "Lastschrift eingerichtet, Mandat wird noch bestätigt";
  if (s === "cancelled") return "Lastschrift-Mandat gekündigt — kein automatischer Einzug mehr";
  if (s === "failed") return "Lastschrift-Mandat fehlgeschlagen — Bank hat abgelehnt";
  if (s === "expired") return "Lastschrift-Mandat abgelaufen";
  return `Lastschrift: ${s}`;
}

/**
 * Ein MENSCH mit seinen Raten — nicht eine Rate.
 *
 * Team: „Zusner dreimal, Namen wiederholen sich beim Scrollen." Gemessen
 * waren es 213 Zeilen für 180 Menschen; Peter Zußner stand fünfmal da, weil
 * er zwei bezahlte Bestellungen mit je drei offenen Raten hat.
 *
 * Wer denselben Menschen fünfmal in der Liste hat, ruft ihn fünfmal an — oder
 * einmal, und die restlichen vier Zeilen bleiben als unerledigt stehen.
 */
interface Mensch {
  personId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  telefonAnzeige: string | null;
  telefonWaehlbar: string | null;
  telefonHinweis: string | null;
  raten: Fall[];
  anzahl: number;
  summeCents: number;
  dringendste: Fall;
  bestellungen: number;
  zweitAbo: boolean;
  /** „Abo aktiv seit 05.07. · nächste Rate 05.09. · Rechnung geht automatisch raus" */
  zyklusText?: string;
  anker?: string | null;
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

// Fünf Stufen, wie MAHNSTUFEN in server/routes/fiaon-abo.ts (0, 3, 7, 14, 21
// Tage). Hier endete die Anzeige bei 3 mit „Versand beendet" — und danach
// kamen noch zwei Mahnungen. Die letzte Stufe ist die letzte Stufe.
const STUFE_TON: Record<number, { text: string; farbe: string }> = {
  0: { text: "noch nicht gemahnt", farbe: "#64748b" },
  1: { text: "Mahnstufe 1", farbe: "#1d4ed8" },
  2: { text: "Mahnstufe 2", farbe: "#1d4ed8" },
  3: { text: "Mahnstufe 3", farbe: "#b45309" },
  4: { text: "Mahnstufe 4", farbe: "#b45309" },
  5: { text: "Mahnstufe 5 — Versand beendet", farbe: "#b91c1c" },
};

export default function AgentInkasso() {
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [zugang, setZugang] = useState<"pruefe" | "offen" | "kein" | "frei">("pruefe");
  const [reiter, setReiter] = useState<"liste" | "stunden">(
    () => (new URLSearchParams(window.location.search).get("tab") === "stunden" ? "stunden" : "liste"),
  );
  // Das Sende-Menü gehört zur ZEILE, nicht zur Seite: Es zeigt den Stand genau
  // dieses Kunden, und zwei geöffnete Zeilen sollen sich nicht in die Quere
  // kommen.
  const [sendeMenue, setSendeMenue] = useState<number | null>(null);
  const [offenerFall, setOffenerFall] = useState<Fall | null>(null);
  // Die Akte: alles zu diesem Fall an einem Ort, für das Gespräch am Telefon.
  const [akte, setAkte] = useState<Fall | null>(null);
  // Welche Personenkarten sind aufgeklappt? Vorgabe: zu. Die dringendste Rate
  // steht ohnehin auf der Karte — wer mehr will, klappt auf.
  const [aufgeklappt, setAufgeklappt] = useState<string[]>([]);
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
  // Eine Karte je Mensch. Fehlt `personen` (alter Server), wird aus der
  // Ratenliste gruppiert — damit die Seite nie leer bleibt, nur weil eine
  // Antwort ein Feld weniger hat.
  const menschen: Mensch[] = daten?.personen ?? [];

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
            // ── EINGEZOGEN HEISST: WAR ÜBERFÄLLIG UND IST JETZT BEZAHLT ─────
            // Der Vorgesetzte: „Woher nimmst du ‚Diesen Monat eingezogen
            // 4.833,28 €, 74 Raten'? Wie kommst du auf das?"
            //
            // Die Zahl war jede bezahlte Rate des Monats — gemessen: alle 74
            // wurden PÜNKTLICH bezahlt, keine einzige durch Nachfassen. Eine
            // Leistungskennzahl, die fremde Leistung mitzählt, ist wertlos.
            //
            // Jetzt getrennt: „eingezogen" nur, was ohne Nachfassen nicht
            // gekommen wäre. Der pünktliche Eingang steht daneben — er ist
            // eine gute Nachricht, nur nicht die des Forderungsmanagements.
            { t: "Eingezogen (war überfällig)", w: eur(z.eingezogen_monat_cents),
              z: `${z.eingezogen_monat_anzahl ?? 0} ${(z.eingezogen_monat_anzahl ?? 0) === 1 ? "Rate" : "Raten"}` },
            { t: "Pünktlich eingegangen", w: eur(z.puenktlich_monat_cents ?? 0),
              z: `${z.puenktlich_monat_anzahl ?? 0} Raten · ohne Nachfassen` },
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
            Du siehst deine zugeteilten Fälle zuerst — und darunter alles, was noch niemandem gehört.
          </p>
        )}

        {/* ── Arbeitsliste ────────────────────────────────────────────────── */}
        {/* Die Zahl, die das Teamfeedback ausgelöst hat: Zeilen gegen
            Menschen. Wer sie sieht, weiß, dass die Liste gruppiert ist. */}
        {reiter === "liste" && menschen.length > 0 && (
          <p className="mb-2.5 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
            {menschen.length} {menschen.length === 1 ? "Mensch" : "Menschen"} · {liste.length}{" "}
            {liste.length === 1 ? "offene Rate" : "offene Raten"} · eine Karte je Mensch
          </p>
        )}

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

        {reiter === "liste" && menschen.map((m, i) => {
          // Die Karte zeigt die DRINGENDSTE Rate. Alles Weitere liegt darunter
          // und wird aufgeklappt — sichtbar, aber nicht im Weg.
          const f = m.dringendste;
          const stufe = STUFE_TON[Math.min(5, Number(f.mahnstufe))] ?? STUFE_TON[0];
          const schluessel = m.personId != null ? `p:${m.personId}` : `ref:${f.ref}`;
          const offenKarte = aufgeklappt.includes(schluessel);
          return (
            <div key={schluessel} className="fi-karte p-4 mb-2.5"
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
              {/* ── LASTSCHRIFT GEPLATZT (22.08.2026) ─────────────────────
                  Die Bank hat schon Nein gesagt. Das ist ein anderer erster
                  Satz als „Ihre Rate ist fällig": Der Kunde wollte zahlen,
                  die Abbuchung kam zurück — Kontodeckung, Widerspruch oder
                  ein gekündigtes Mandat. Der Grund steht daneben. */}
              {f.lastschrift_status === "fehlgeschlagen" && (
                <p className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#b91c1c" }}>
                  Lastschrift geplatzt{f.lastschrift_am ? ` am ${datum(f.lastschrift_am)}` : ""}
                  {f.lastschrift_grund ? ` — ${f.lastschrift_grund}` : ""}
                </p>
              )}
              {f.lastschrift_status !== "fehlgeschlagen" && mandatText(f.gc_mandate_status) && (
                <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-1.5"
                   style={{ color: f.gc_mandate_status === "active" ? "#047857" : "#b45309" }}>
                  {mandatText(f.gc_mandate_status)}
                </p>
              )}
              {/* ── ZWEITES ABO ────────────────────────────────────────────
                  Zwei Bestellungen mit offenen Raten heißt: Der Mensch zahlt
                  zweimal für dasselbe. Das ist keine Inkasso-Aufgabe — wer
                  hier mahnt, mahnt eine Doppelbelastung ein. Deshalb steht es
                  als Warnung oben und nicht als Fußnote. */}
              {m.zweitAbo && (
                <p className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5"
                   style={{ color: "#b45309" }}>
                  Zweites Abo — {m.bestellungen} Bestellungen laufen parallel. Vor dem Mahnen klären.
                </p>
              )}

              <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold" style={{ color: "var(--fi-text)" }}>{m.name}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                    {m.anzahl === 1
                      ? `Rate ${f.rate_nr} von ${f.raten_gesamt} · ${f.paket || "—"} · ${f.raten_bezahlt} bezahlt`
                      : `${m.anzahl} offene Raten · ${f.paket || "—"} · ${f.raten_bezahlt} bezahlt`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[17px] font-bold tabular-nums" style={{ color: "var(--fi-text)" }}>
                    {eur(m.summeCents)}
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

              {/* ── DER ABO-ZYKLUS IM KLARTEXT ──────────────────────────────
                  Am Telefon ist die erste Rückfrage des Kunden: „Wieso schon
                  wieder?" Wer diesen Satz vor sich hat, kann ihn beantworten,
                  ohne die Akte zu öffnen. Derselbe Wortlaut steht in der
                  Kundenakte und in der Zahlungszentrale — aus derselben
                  Funktion, damit niemand etwas anderes vorliest. */}
              {m.zyklusText && (
                <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                  {m.zyklusText}
                </p>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  DIE WEITEREN RATEN — AUFKLAPPBAR
                  Die Arbeit hängt weiter an der EINZELNEN Rate: „zahlt am 20."
                  muss sich auf Rate 3 beziehen, nicht auf den Menschen. Deshalb
                  hat jede Rate hier ihren eigenen Ergebnis-Knopf.
                  ══════════════════════════════════════════════════════════ */}
              {m.anzahl > 1 && (
                <div className="mt-2.5">
                  <button type="button"
                          onClick={() => setAufgeklappt((v) => (
                            v.includes(schluessel) ? v.filter((x) => x !== schluessel) : [...v, schluessel]
                          ))}
                          className="text-[11.5px] font-semibold underline underline-offset-2"
                          style={{ color: "var(--fi-text-still)" }}>
                    {offenKarte
                      ? "Raten zuklappen"
                      : `Alle ${m.anzahl} Raten zeigen (${eur(m.summeCents)})`}
                  </button>
                  {offenKarte && (
                    <ul className="mt-2 space-y-1.5">
                      {m.raten.map((r) => (
                        <li key={r.rate_id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pl-3 text-[11.5px]"
                            style={{
                              color: "var(--fi-text-still)",
                              borderLeft: `2px solid ${r.rate_id === f.rate_id ? "#b45309" : "var(--a3-linie,#e4e9f2)"}`,
                            }}>
                          <span className="font-semibold" style={{ color: "var(--fi-text)" }}>
                            Rate {r.rate_nr}
                          </span>
                          <span className="tabular-nums">{eur(r.betrag_cents)}</span>
                          <span>
                            {r.ueberfaellig
                              ? `seit ${r.tage_ueberfaellig} ${Number(r.tage_ueberfaellig) === 1 ? "Tag" : "Tagen"} offen`
                              : `fällig ${datum(r.faellig_am)}`}
                          </span>
                          <span className="fi-ak-mono text-[11px]">{r.zahlungsreferenz}</span>
                          {/* Verschiedene Bestellungen sichtbar machen — sonst
                              sieht ein Zweit-Abo aus wie eine lange Ratenkette. */}
                          {m.zweitAbo && <span className="fi-ak-mono text-[10.5px]">{r.ref}</span>}
                          <button type="button" onClick={() => setOffenerFall(r)}
                                  className="ml-auto fi-zweitknopf px-2.5 py-1 text-[11px] font-semibold">
                            Ergebnis
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {/* ── DIE NUMMER KOMMT FERTIG VOM SERVER (30.08.2026) ────────
                    Hier stand:
                      `${f.phone_country_code || "+49"}${String(f.phone).replace(/^0/, "")}`
                    Trug `phone` schon ein „+" (z. B. „+436642204641") und
                    danebenstand „+43", ergab das „+43+436642204641" — der
                    gemeldete Doppelpräfix. GEMESSEN: 21 Zeilen der Arbeitsliste.
                    Schlimmer noch: Der Rückfall „+49" hängte eine DEUTSCHE
                    Vorwahl an österreichische Nummern. Wer das doppelte Plus
                    entfernt hätte, wählte „+4943664…" — einen fremden Menschen.
                    `telefonWaehlbar` kommt aus `waehlbareNummer` (server/lib/
                    fiaon-telefon.ts), derselben Funktion wie im Vertrieb. Ist
                    die Nummer nicht wählbar, steht der Grund da statt eines
                    Knopfes, der ins Leere ruft. */}
                {f.telefonWaehlbar && (
                  <button type="button"
                          onClick={() => anrufStarten(f.telefonWaehlbar!, f.person_id, f.name, { rateId: f.rate_id })}
                          className="fi-primaerknopf inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold">
                    <MarkeHoerer size={14} /> Anrufen
                  </button>
                )}
                {!f.telefonWaehlbar && f.telefonHinweis && (
                  <span className="inline-flex items-center px-3 py-2 text-[12px] rounded-lg"
                        style={{ background: "rgba(180,83,9,.08)", color: "#92400e" }}>
                    {f.telefonAnzeige ? `${f.telefonAnzeige} — ` : ""}{f.telefonHinweis}
                  </span>
                )}
                {/* ── DIE AKTE, NICHT DAS GESPRÄCHSBLATT ────────────────────
                    Der Vorgesetzte: „Der Inkasso-Mitarbeiter muss den
                    Kundenverlauf sehen, alles ganz genau … der braucht keine
                    KI-Analyse."

                    Das Gesprächsblatt ist für den VERTRIEB gebaut: Es schlägt
                    nächste Schritte vor und deutet Signale. Wer wegen einer
                    offenen Rate anruft, braucht etwas anderes — seit wann sie
                    offen ist, was schon geschickt wurde, was zuletzt gesprochen
                    wurde. */}
                <button type="button" onClick={() => setAkte(f)}
                        className="fi-zweitknopf inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold">
                  <MarkeFunke size={13} /> Akte öffnen
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
                {/* ── KEIN LINK IN DEN VERWALTUNGSBEREICH ────────────────────
                    Hier stand `/admin/kunde/…`. Der Vorgesetzte: „Wenn man auf
                    Akte klickt, wird man auf /admin/kunde/3503 weitergeleitet,
                    da hat der Inkasso aber keinen Zugriff."

                    Er hat recht, und es war mein Fehler: Ein Knopf, der in
                    einen verschlossenen Bereich führt, ist schlimmer als kein
                    Knopf — er sieht wie eine Möglichkeit aus.

                    Erst zeigte hier das Gesprächsblatt — aber das ist für den
                    VERTRIEB gebaut: Es schlägt nächste Schritte vor und deutet
                    Signale. Wer wegen einer offenen Rate anruft, braucht
                    Tatsachen, keine Ratschläge. Deshalb jetzt eine eigene
                    Akte (siehe InkassoAkte weiter unten). */}
                <button type="button" onClick={() => setOffenerFall(f)}
                        className="fi-zweitknopf px-3 py-2 text-[12px] font-semibold">
                  Ergebnis festhalten
                </button>
              </div>

            </div>
          );
        })}

        <style>{`
          @keyframes inkAuf { from { opacity: 0; transform: translateY(9px) } to { opacity: 1; transform: none } }
          @media (prefers-reduced-motion: reduce) { [style*="inkAuf"] { animation: none !important } }
        `}</style>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DAS SENDE-MENÜ GEHÖRT HIERHER, NICHT IN DIE KARTE

          ── DER BEFUND (11.08.2026) ────────────────────────────────────────
          Der Vorgesetzte: „Es sieht schrecklich aus vom Design, es schneidet
          oben und unten alles ab."

          Gemessen: Die Bühne des Fensters war 147 px hoch statt
          bildschirmfüllend, und das Fenster darin 634 px — es ragte oben und
          unten heraus.

          Der Grund ist eine CSS-Eigenheit: Die Kundenkarte trägt eine
          Einblend-Animation mit `transform`. Ein `transform` auf einem
          Vorfahren macht aus `position: fixed` ein `position: absolute`
          relativ zu DIESEM Element. Die Bühne, die den ganzen Bildschirm
          bedecken sollte, bedeckte nur die Karte.

          Deshalb steht das Menü jetzt auf Seitenebene — außerhalb jeder
          Karte, jeder Animation, jedes Transforms. Genau wie die Akte.
          ══════════════════════════════════════════════════════════════════ */}
      {sendeMenue != null && (
        <SendeMenue personId={sendeMenue} offen
                    basis="/api/fiaon/agent/mail"
                    onSchliessen={() => setSendeMenue(null)}
                    onGesendet={() => { setSendeMenue(null); void laden(); }} />
      )}

      {akte && (
        <InkassoAkte fall={akte} onZu={() => setAkte(null)}
                     onGeaendert={() => void laden()}
                     onAnrufen={(nummer, name) => { void anrufStarten(nummer, akte.person_id, name, { rateId: akte.rate_id }); }} />
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

// ═══════════════════════════════════════════════════════════════════════════
// DIE INKASSO-AKTE — alles für das Gespräch, in einem Blick
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Der Vorgesetzte: „Der Inkasso-Mitarbeiter muss den Kundenverlauf sehen, alles
// ganz genau — der braucht keine KI-Analyse. Der muss alles einsehen können,
// was wichtig ist: ‚Ich rufe an, weil ihre Zahlung seit X Tagen fällig ist —
// dürfte ich Sie bitten, diese zu bezahlen, sonst ist das schlecht für Ihre
// SCHUFA, die wir gerade optimieren, das wäre ja schade.'"
//
// Der Satz gibt die Reihenfolge vor:
//
//   1. WER ist das (Name, Paket, seit wann Kunde)
//   2. WAS ist offen (Betrag, seit wie vielen Tagen)
//   3. WIE steht er da (bezahlte Raten, SCHUFA-Stand)
//   4. WAS wurde schon versucht (Mails, Gespräche, Ergebnisse)
//   5. WAS jetzt (anrufen, Rechnung schicken, Ergebnis festhalten)
//
// Keine Vorschläge, keine Deutung, keine KI. Ein Mensch, der zwanzig solcher
// Gespräche am Tag führt, weiß besser als jedes Modell, was er sagen muss —
// er braucht die Tatsachen, nicht Ratschläge.
// ═══════════════════════════════════════════════════════════════════════════

function InkassoAkte({
  fall, onZu, onGeaendert, onAnrufen,
}: {
  fall: Fall;
  onZu: () => void;
  onGeaendert: () => void;
  onAnrufen: (nummer: string, name: string) => void;
}) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [player, setPlayer] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/inkasso/rate/${fall.rate_id}`, { credentials: "include" })
      .catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setD(j);
    else setFehler(j?.error || "Die Akte konnte nicht geladen werden. Bitte noch einmal öffnen.");
  }, [fall.rate_id]);
  useEffect(() => { void laden(); }, [laden]);

  const k = d?.kunde;
  const eur = (c: any) => `${(Number(c || 0) / 100).toFixed(2).replace(".", ",")} €`;
  const tag = (x: any) => x ? new Date(x).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin",
  }) : "—";
  const zeit = (x: any) => x ? new Date(x).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
  }) : "—";

  const erinnerungSenden = async () => {
    setBusy(true); setMeldung(null);
    const r = await fetch(`/api/fiaon/inkasso/rate/${fall.rate_id}/erinnerung`, {
      method: "POST", credentials: "include",
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    setMeldung(j?.ok
      ? { art: "gut", text: j.meldung }
      : { art: "schlecht", text: j?.error || "Die Mail ging nicht raus." });
    // ── DIE MELDUNG MUSS STEHEN BLEIBEN ──────────────────────────────────
    // Erst rief das hier sofort `onGeaendert()` — das lädt die Arbeitsliste
    // neu, die Akte wird dabei neu aufgebaut, und die Erfolgsmeldung war
    // verschwunden, bevor jemand sie lesen konnte. Gemessen: nach zwei
    // Sekunden war nichts mehr da.
    //
    // Ein Mensch, der am Telefon sagt „die Rechnung ist unterwegs", muss sehen
    // dürfen, DASS sie unterwegs ist.
    if (j?.ok) {
      void laden();
      window.setTimeout(() => onGeaendert(), 4000);
    }
  };

  // ── BEIDES KOMMT AUS DEM LISTENEINTRAG ──────────────────────────────────
  // `tage_ueberfaellig` und die Nummer stehen schon in der Arbeitsliste. Sie
  // erst aus der Akte-Antwort zu holen hieße, zwei Sekunden auf etwas zu
  // warten, was man hat.
  const tageOffen = Number(
    fall.tage_ueberfaellig ?? k?.tage_offen
    ?? Math.max(0, Math.floor((Date.now() - new Date(fall.faellig_am).getTime()) / 86_400_000)),
  );
  // ── DIE WÄHLBARE NUMMER, NICHT SELBST GEBAUT (30.08.2026) ────────────────
  // Hier stand dieselbe Zusammensetzung wie oben in der Liste — und derselbe
  // „+49"-Rückfall. Zwei Stellen, ein Fehler: genau die Lage, die AGENTS.md
  // „zwei Fassungen derselben Regel" nennt. `telefonWaehlbar` kommt fertig
  // aus der Arbeitsliste; die Akte darf keine andere Nummer wählen als die
  // Zeile, aus der sie geöffnet wurde.
  const sofortNummer: string | null = fall.telefonWaehlbar ?? k?.telefonWaehlbar ?? null;
  const nummerHinweis: string | null = sofortNummer
    ? null
    : (fall.telefonHinweis ?? k?.telefonHinweis ?? null);

  return (
    <FiaonEbene
      offen onZu={onZu}
      titel={k?.name ?? fall.name}
      ueberschrift={`Rate ${fall.rate_nr} · ${eur(fall.betrag_cents)}`}
      breite={720}
      kinder={
        <div className="px-5 sm:px-7 py-4">
          <style>{AKTE_CSS}</style>

          {/* ══════════════════════════════════════════════════════════════
              WAS SCHON DA IST, WIRD SOFORT GEZEIGT

              ── DER BEFUND (11.08.2026) ────────────────────────────────────
              Die Akte stand bei „Wird geladen …" — und ich habe lange nach
              einem Fehler gesucht, der keiner war. Gemessen: Die Route
              brauchte 5.434 ms, weil zehn Abfragen als `await` INNERHALB des
              Antwort-Objekts standen und deshalb NACHEINANDER liefen.

              Parallel sind es 2.000 ms. Immer noch zwei Sekunden, in denen
              ein Mensch auf ein leeres Fenster starrt — obwohl Name, Betrag,
              Tage überfällig und Mahnstufe längst in der Liste standen, aus
              der er geklickt hat.

              Deshalb: Der Kopf kommt aus dem Listeneintrag und steht sofort.
              Nachgeladen wird nur, was es dort nicht gibt — Adresse, Raten,
              Gespräche, Mails, Verlauf. Ein Ladebalken für Daten, die man
              schon hat, ist eine selbstgemachte Wartezeit.
              ══════════════════════════════════════════════════════════════ */}
          <div className="fi-ak-kopf">
            <div>
              <p className="fi-ak-marke">Offen seit</p>
              <p className="fi-ak-gross">
                {tageOffen} {tageOffen === 1 ? "Tag" : "Tagen"}
              </p>
              <p className="fi-ak-klein">fällig war {tag(fall.faellig_am)}</p>
            </div>
            <div>
              <p className="fi-ak-marke">Diese Rate</p>
              <p className="fi-ak-gross">{eur(fall.betrag_cents)}</p>
              <p className="fi-ak-klein">
                Rate {fall.rate_nr}{k?.raten_gesamt ? ` von ${k.raten_gesamt}` : ""}
              </p>
            </div>
            {Number(k?.offen_gesamt_cents) > Number(fall.betrag_cents) && (
              <div>
                <p className="fi-ak-marke">Gesamt überfällig</p>
                <p className="fi-ak-gross" style={{ color: "#b45309" }}>
                  {eur(k?.offen_gesamt_cents)}
                </p>
                <p className="fi-ak-klein">mehrere Raten offen</p>
              </div>
            )}
            <div>
              <p className="fi-ak-marke">Mahnstufe</p>
              <p className="fi-ak-gross" style={{ color: fall.mahnstufe >= 2 ? "#b91c1c" : undefined }}>
                {fall.mahnstufe}
              </p>
              <p className="fi-ak-klein">
                {fall.erinnerungen} {fall.erinnerungen === 1 ? "Erinnerung" : "Erinnerungen"} raus
              </p>
            </div>
            {(fall.lastschrift_status || k?.gc_mandate_status) && (
              <div>
                <p className="fi-ak-marke">Lastschrift</p>
                <p className="fi-ak-gross" style={{ color: fall.lastschrift_status === "fehlgeschlagen" ? "#b91c1c" : k?.gc_mandate_status === "active" ? "#047857" : undefined }}>
                  {fall.lastschrift_status === "fehlgeschlagen" ? "geplatzt"
                    : fall.lastschrift_status === "eingereicht" ? "läuft"
                    : k?.gc_mandate_status === "active" ? "aktiv"
                    : k?.gc_mandate_status ? "inaktiv" : "—"}
                </p>
                <p className="fi-ak-klein">
                  {fall.lastschrift_status === "fehlgeschlagen"
                    ? (fall.lastschrift_grund || "Einzug kam zurück")
                    : (mandatText(k?.gc_mandate_status) || "kein Mandat")}
                </p>
              </div>
            )}
            {k && (
              <div>
                <p className="fi-ak-marke">Schon bezahlt</p>
                <p className="fi-ak-gross" style={{ color: Number(k.raten_bezahlt) > 0 ? "#047857" : undefined }}>
                  {k.raten_bezahlt}
                </p>
                <p className="fi-ak-klein">
                  {Number(k.raten_bezahlt) > 0 ? "zahlt sonst zuverlässig" : "noch keine Rate"}
                </p>
              </div>
            )}
          </div>

          {/* ── DIE AKTIONEN STEHEN AUCH SOFORT ───────────────────────────
              Anrufen und Rechnung schicken brauchen nur die Nummer und die
              Ratennummer — beides ist im Listeneintrag. Wer sofort anrufen
              will, soll nicht auf eine Adresse warten. */}
          <div className="fi-ak-tun">
            {sofortNummer && (
              <button type="button" onClick={() => onAnrufen(sofortNummer, fall.name)}
                      className="fi-primaerknopf inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold">
                Anrufen · {sofortNummer}
              </button>
            )}
            {/* Kein Knopf ohne wählbare Nummer — aber auch kein stummes Nichts.
                Der Grund steht als Text da (AGENTS.md: ein gesperrter Knopf
                ohne sichtbaren Grund ist ein Rätsel). */}
            {!sofortNummer && nummerHinweis && (
              <span className="inline-flex items-center px-3.5 py-2.5 text-[12.5px] rounded-lg"
                    style={{ background: "rgba(180,83,9,.08)", color: "#92400e" }}>
                {nummerHinweis}
              </span>
            )}
            <button type="button" onClick={() => void erinnerungSenden()} disabled={busy}
                    className="fi-zweitknopf px-3.5 py-2.5 text-[12.5px] font-semibold">
              {busy ? "Geht raus …" : "Rechnung jetzt schicken"}
            </button>
            {!fall.email && d && !k?.bestell_email && !k?.primary_email && (
              <span className="text-[11.5px]" style={{ color: "#b45309" }}>
                Keine E-Mail hinterlegt — Bankdaten am Telefon durchgeben.
              </span>
            )}
          </div>

          {meldung && (
            <p className="fi-ak-meldung" data-art={meldung.art}>{meldung.text}</p>
          )}
          {fehler && <p className="fi-ak-meldung" data-art="schlecht">{fehler}</p>}

          {/* Der Rest wird nachgeladen. Ein schmaler Hinweis statt eines
              leeren Fensters — man sieht, dass noch etwas kommt. */}
          {!d && !fehler && (
            <p className="fi-ak-laedt">Kundendaten, Raten und Verlauf werden geladen …</p>
          )}

          {d && (
            <>
              {/* ── 3. DIE BANKDATEN ZUM VORLESEN ─────────────────────────── */}
              <details className="fi-ak-block">
                <summary className="fi-ak-titel">Bankdaten zum Vorlesen</summary>
                <div className="fi-ak-bank">
                  {([
                    ["Empfänger", d.bank?.empfaenger],
                    ["IBAN", d.bank?.iban],
                    ["BIC", d.bank?.bic],
                    ["Verwendungszweck", d.bank?.verwendungszweck],
                  ] as const).map(([t, w]) => (
                    <div key={t}>
                      <p className="fi-ak-marke">{t}</p>
                      <p className="fi-ak-mono">{w ?? "—"}</p>
                    </div>
                  ))}
                </div>
                <p className="fi-ak-hinweis">
                  Der Verwendungszweck ist wichtig: Ohne ihn lässt sich die Überweisung nicht
                  dieser Rate zuordnen, und die Mahnung läuft weiter.
                </p>
              </details>

              {/* ── 4. WER IST DAS ───────────────────────────────────────── */}
              <div className="fi-ak-block">
                <p className="fi-ak-titel">Kunde</p>
                <div className="fi-ak-daten">
                  {([
                    ["Name", k?.name],
                    ["Paket", k?.pack_name],
                    ["Kunde seit", tag(k?.kunde_seit)],
                    ["E-Mail", k?.bestell_email || k?.primary_email],
                    ["Telefon", sofortNummer],
                    ["Adresse", [k?.strasse, [k?.plz, k?.ort].filter(Boolean).join(" ")]
                      .filter(Boolean).join(", ")],
                    // ── KEINE ROHWERTE ─────────────────────────────────────
                    // Im Schnappschuss stand „ZUGANG active" und „BONITÄT
                    // pending" — die englischen Werte aus der Spalte. Wer am
                    // Telefon sitzt, soll nicht raten müssen, was „pending"
                    // für diesen Kunden bedeutet.
                    ["Zugang", ZUGANG_TEXT[String(k?.account_status ?? "")] ?? k?.account_status],
                    ["Bonität", BONITAET_TEXT[String(k?.schufa_status ?? "")] ?? k?.schufa_status],
                  ] as const).filter(([, w]) => w).map(([t, w]) => (
                    <div key={t}>
                      <p className="fi-ak-marke">{t}</p>
                      <p className="fi-ak-wert">{w}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 5. ALLE RATEN ────────────────────────────────────────── */}
              <div className="fi-ak-block">
                <p className="fi-ak-titel">Alle Raten</p>
                <div className="fi-ak-raten">
                  {(d.raten ?? []).map((r: any) => (
                    <div key={r.rate_nr} className="fi-ak-rate"
                         data-jetzt={r.rate_nr === fall.rate_nr ? "1" : "0"}
                         data-stand={r.status === "bezahlt" ? "bezahlt"
                           : new Date(r.faellig_am) < new Date() ? "ueberfaellig" : "offen"}>
                      <span className="fi-ak-rate-nr">{r.rate_nr}</span>
                      <span className="fi-ak-rate-geld">{eur(r.betrag_cents)}</span>
                      <span className="fi-ak-rate-tag">{tag(r.faellig_am)}</span>
                      <span className="fi-ak-rate-stand">
                        {r.status === "bezahlt" ? `bezahlt ${tag(r.bezahlt_am)}`
                          : new Date(r.faellig_am) < new Date() ? "überfällig" : "kommt noch"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 6. JEDES GESPRÄCH ────────────────────────────────────── */}
              <div className="fi-ak-block">
                <p className="fi-ak-titel">
                  Gespräche {(d.gespraeche ?? []).length > 0 && `(${d.gespraeche.length})`}
                </p>
                {(d.gespraeche ?? []).length === 0 && (
                  <p className="fi-ak-leer">Mit diesem Kunden wurde über die Plattform noch nicht telefoniert.</p>
                )}
                {(d.gespraeche ?? []).map((g: any) => (
                  <div key={g.id} className="fi-ak-zeile">
                    <div className="fi-ak-zeile-kopf">
                      <span className="fi-ak-zeit">{zeit(g.beginn)}</span>
                      {g.dauer_sek != null && (
                        <span className="fi-ak-dauer">
                          {Math.floor(g.dauer_sek / 60)}:{String(g.dauer_sek % 60).padStart(2, "0")}
                        </span>
                      )}
                      {g.agent && <span className="fi-ak-wer">{g.agent}</span>}
                      {g.ergebnis && <span className="fi-ak-erg">{ERG_TEXT[g.ergebnis] ?? g.ergebnis}</span>}
                      {g.hat_aufnahme && !g.ohne_aufzeichnung_am && (
                        <button type="button" className="fi-ak-hoeren"
                                onClick={() => setPlayer(player === g.id ? null : g.id)}>
                          {player === g.id ? "zu" : "anhören"}
                        </button>
                      )}
                    </div>
                    {g.zusammenfassung && <p className="fi-ak-fass">{g.zusammenfassung}</p>}
                    {player === g.id && (
                      <AnrufPlayer anrufId={g.id} kennzeichen="anruf-player-inkasso" />
                    )}
                  </div>
                ))}
              </div>

              {/* ── 7. WAS SCHON RAUSGING ───────────────────────────────── */}
              <div className="fi-ak-block">
                <p className="fi-ak-titel">Verschickte Mails</p>
                {(d.mails ?? []).length === 0 && (
                  <p className="fi-ak-leer">Noch keine Mail an diesen Kunden.</p>
                )}
                {(d.mails ?? []).map((m: any, i: number) => (
                  <div key={i} className="fi-ak-zeile">
                    <div className="fi-ak-zeile-kopf">
                      <span className="fi-ak-zeit">{zeit(m.gesendet_am)}</span>
                      <span className="fi-ak-wer">{MAIL_TEXT[m.event] ?? m.event}</span>
                      {!m.ok && <span className="fi-ak-fehler">nicht angekommen: {m.grund}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── 8. DER VERLAUF ──────────────────────────────────────── */}
              <div className="fi-ak-block">
                <p className="fi-ak-titel">Verlauf</p>
                {[...(d.arbeit ?? []).map((a: any) => ({
                  wann: a.created_at, wer: a.agent_name,
                  was: `${ERG_TEXT[a.ergebnis] ?? a.ergebnis}`
                    + (a.zusage_am ? ` · Zusage ${tag(a.zusage_am)}` : "")
                    + (a.wiedervorlage ? ` · wieder ${tag(a.wiedervorlage)}` : ""),
                  notiz: a.notiz,
                })), ...(d.kontakte ?? []).map((c: any) => ({
                  wann: c.created_at, wer: c.agent_name,
                  was: c.outcome || c.type, notiz: c.note,
                }))]
                  .sort((a, b) => new Date(b.wann).getTime() - new Date(a.wann).getTime())
                  .slice(0, 30)
                  .map((e: any, i: number) => (
                    <div key={i} className="fi-ak-zeile">
                      <div className="fi-ak-zeile-kopf">
                        <span className="fi-ak-zeit">{zeit(e.wann)}</span>
                        {e.wer && <span className="fi-ak-wer">{e.wer}</span>}
                        <span className="fi-ak-erg">{e.was}</span>
                      </div>
                      {e.notiz && <p className="fi-ak-fass">{e.notiz}</p>}
                    </div>
                  ))}
                {(d.arbeit ?? []).length === 0 && (d.kontakte ?? []).length === 0 && (
                  <p className="fi-ak-leer">Noch kein Eintrag.</p>
                )}
              </div>
            </>
          )}
        </div>
      }
    />
  );
}

/** Ergebnisse in Klartext — kein Mensch soll Feldnamen lesen müssen. */
const ERG_TEXT: Record<string, string> = {
  erreicht_zahlt_gleich: "zahlt sofort",
  erreicht_zahlt_am: "zahlt zum Termin",
  erreicht_abgelehnt: "abgelehnt",
  nicht_erreicht: "nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "falsche Nummer",
  nummer_blockiert: "Nummer blockiert",
  notiz: "Notiz",
  zusage: "Zahlung zugesagt",
  zusage_gebrochen: "Zusage gebrochen",
};

/**
 * Die Zustände in Worten.
 *
 * Der Zugang ist wichtig fürs Gespräch: Wer keinen Zugang hat, fragt zu Recht,
 * wofür er zahlen soll. Und die Bonitätsoptimierung ist das Argument aus dem
 * Satz des Vorgesetzten — „schlecht für Ihre SCHUFA, die wir gerade
 * optimieren". Wer sie noch nicht laufen hat, darf das nicht behaupten.
 */
const ZUGANG_TEXT: Record<string, string> = {
  active: "freigeschaltet",
  pending: "noch nicht freigeschaltet",
  suspended: "gesperrt",
  cancelled: "gekündigt",
  invited: "eingeladen, noch nicht angemeldet",
};

const BONITAET_TEXT: Record<string, string> = {
  pending: "beauftragt, läuft noch",
  ordered: "angefordert",
  received: "liegt vor",
  optimizing: "wird optimiert",
  done: "abgeschlossen",
  none: "nicht beauftragt",
  failed: "gescheitert — nachfassen",
};

const MAIL_TEXT: Record<string, string> = {
  abo_payment_reminder: "Zahlungserinnerung (Rate)",
  payment_reminder: "Zahlungserinnerung (Erstzahlung)",
  payment_details: "Zahlungsdaten",
  payment_confirmed: "Zahlung bestätigt",
  welcome: "Willkommen",
  followup_48h: "Nachfassen nach 48 Std",
};

const AKTE_CSS = `
/* ── DIE AKTE ──────────────────────────────────────────────────────────────
   Ruhig und dicht: Wer telefoniert, überfliegt — er liest nicht. Deshalb
   kleine Beschriftungen, große Zahlen und klare Blöcke. */
.fi-ak-kopf {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  padding: 14px 16px; margin-bottom: 14px;
  border-radius: 16px;
  background: linear-gradient(150deg, rgba(37,99,235,.06), rgba(37,99,235,.02));
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.14);
}
.fi-ak-marke {
  font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--fi-text-still); margin-bottom: 2px;
}
.fi-ak-gross {
  font-size: 22px; font-weight: 700; line-height: 1.05;
  font-variant-numeric: tabular-nums; color: var(--fi-text);
}
.fi-ak-klein { font-size: 11px; color: var(--fi-text-still); margin-top: 2px; line-height: 1.35; }

.fi-ak-tun { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }

.fi-ak-meldung {
  padding: 10px 13px; border-radius: 12px; margin-bottom: 12px;
  font-size: 12.5px; line-height: 1.5;
}
.fi-ak-meldung[data-art="gut"] { background: rgba(5,150,105,.08); color: #047857; }
.fi-ak-meldung[data-art="schlecht"] { background: rgba(217,119,6,.08); color: #b45309; }

.fi-ak-block { padding-top: 13px; margin-top: 13px; border-top: 1px solid rgba(15,23,42,.07); }
.fi-ak-titel {
  font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--fi-text-still); margin-bottom: 8px; cursor: default;
}
details.fi-ak-block > summary { cursor: pointer; list-style: none; }
details.fi-ak-block > summary::-webkit-details-marker { display: none; }
details.fi-ak-block > summary::after { content: " ▾"; opacity: .5; }
details.fi-ak-block[open] > summary::after { content: " ▴"; }

.fi-ak-daten, .fi-ak-bank {
  display: grid; gap: 10px 16px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.fi-ak-wert { font-size: 13px; color: var(--fi-text); overflow-wrap: anywhere; line-height: 1.4; }
/* Der Verwendungszweck wird vorgelesen — eine Schrift mit gleichen Breiten
   verhindert, dass man 0 und O verwechselt. */
.fi-ak-mono {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 13px; font-weight: 600; color: var(--fi-text);
  overflow-wrap: anywhere; line-height: 1.4;
  user-select: all;
}
.fi-ak-hinweis { font-size: 11.5px; color: var(--fi-text-still); margin-top: 9px; line-height: 1.5; }

.fi-ak-raten { display: flex; flex-direction: column; gap: 1px; }
.fi-ak-rate {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  padding: 6px 9px; border-radius: 9px; font-size: 12.5px;
}
.fi-ak-rate[data-jetzt="1"] { background: rgba(37,99,235,.07); font-weight: 600; }
.fi-ak-rate-nr {
  width: 20px; height: 20px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px; font-size: 10.5px; font-weight: 700;
  background: rgba(15,23,42,.06); color: var(--fi-text-leise);
}
.fi-ak-rate[data-stand="bezahlt"] .fi-ak-rate-nr { background: rgba(5,150,105,.14); color: #047857; }
.fi-ak-rate[data-stand="ueberfaellig"] .fi-ak-rate-nr { background: rgba(185,28,28,.12); color: #b91c1c; }
.fi-ak-rate-geld { font-variant-numeric: tabular-nums; font-weight: 600; }
.fi-ak-rate-tag { font-variant-numeric: tabular-nums; color: var(--fi-text-still); font-size: 11.5px; }
.fi-ak-rate-stand { margin-left: auto; font-size: 11.5px; color: var(--fi-text-still); }
.fi-ak-rate[data-stand="bezahlt"] .fi-ak-rate-stand { color: #047857; }
.fi-ak-rate[data-stand="ueberfaellig"] .fi-ak-rate-stand { color: #b91c1c; font-weight: 600; }

.fi-ak-zeile { padding: 6px 0; border-bottom: 1px solid rgba(15,23,42,.045); }
.fi-ak-zeile:last-child { border-bottom: 0; }
.fi-ak-zeile-kopf { display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px; font-size: 12.5px; }
.fi-ak-zeit { font-variant-numeric: tabular-nums; color: var(--fi-text-still); font-size: 11.5px; }
.fi-ak-dauer { font-variant-numeric: tabular-nums; font-weight: 600; }
.fi-ak-wer { color: var(--fi-text-leise); }
.fi-ak-erg { font-weight: 600; color: var(--fi-text); }
.fi-ak-fehler { color: #b91c1c; font-size: 11.5px; }
.fi-ak-hoeren {
  margin-left: auto; border: 0; background: none; cursor: pointer;
  font-size: 11.5px; font-weight: 600; color: var(--fi-primaer);
}
.fi-ak-fass { font-size: 12.5px; color: var(--fi-text-leise); line-height: 1.5; margin-top: 3px; }
.fi-ak-audio { width: 100%; height: 32px; margin-top: 6px; }
.fi-ak-leer { font-size: 12.5px; color: var(--fi-text-still); }

@media (max-width: 639px) {
  .fi-ak-kopf { padding: 12px 13px; gap: 10px; }
  .fi-ak-gross { font-size: 19px; }
  .fi-ak-rate-stand { margin-left: 0; width: 100%; }
}
`;
