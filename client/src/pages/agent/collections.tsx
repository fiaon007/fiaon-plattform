// ═══════════════════════════════════════════════════════════════════════════
// /agent/collections — Raum „Collections" (23.08.2026, Plan §4/§11)
//
// Forderungen & Zahlungen (Diana, Back-Office) – nativ auf der dunklen
// Office-Bühne, alle Funktionen von inkasso.tsx 1:1:
//   GET  /inkasso/liste?frist=        Arbeitsliste (eine Karte je Mensch), Kennzahlen,
//                                     Verdienst, Fristfenster, Ergebnis-Katalog
//   GET  /inkasso/zusage · POST       Zugangs-Zusage (ZusageTafel, unverändert)
//   GET  /inkasso/rate/:id            Akte (Bank, Kunde, Raten, Gespräche, Mails, Verlauf)
//   POST /inkasso/rate/:id/ergebnis   Ergebnis festhalten (Zusage-Datum, Notiz, Härtefall)
//   POST /inkasso/rate/:id/erinnerung Rechnung/Erinnerung jetzt schicken
//   GET/POST /inkasso/stunden · POST /inkasso/stunden/:id/entfernen  Meine Zeiten
//   Senden → SendeMenue (/api/fiaon/agent/mail), Anrufen → Ereignis `fiaon-anrufen`
// Die Reihenfolge macht der Server. Erlass, Stundung, Kürzung, Storno gibt es
// hier nicht – nur „Härtefall an den Vorgesetzten".
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Phone, FolderOpen, Mail, ClipboardCheck, Clock, X, Landmark, ListChecks } from "lucide-react";
import { AgentShell, useAgentInfo } from "./shared";
import { useOffice } from "./OfficeShell";
import { SendeMenue } from "@/components/SendeMenue";
import { AnrufPlayer } from "@/components/AnrufPlayer";
import { ZusageTafel } from "./vertrieb-zusage";
import "@/styles/office-collections.css";

interface Fall {
  rate_id: number; ref: string; rate_nr: number; betrag_cents: number; zahlungsreferenz: string; faellig_am: string;
  mahnstufe: number; erinnerungen: number; letzte_erinnerung_at: string | null; inkasso_wiedervorlage: string | null;
  inkasso_zusage_am: string | null; inkasso_versuche: number; eskaliert_am: string | null; person_id: number; name: string;
  email: string | null; phone: string | null; phone_country_code: string | null; paket: string | null;
  telefonAnzeige: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
  ueberfaellig: boolean; tage_ueberfaellig: number; anruf_pflicht: boolean; zusage_gebrochen: boolean;
  raten_bezahlt: number; raten_gesamt: number; letzter_bearbeiter: string | null; letztes_ergebnis: string | null;
  lastschrift_status?: string | null; lastschrift_grund?: string | null; lastschrift_am?: string | null; gc_mandate_status?: string | null;
}
interface Mensch {
  personId: number | null; name: string; email: string | null; phone: string | null; phoneCountryCode: string | null;
  telefonAnzeige: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
  raten: Fall[]; anzahl: number; summeCents: number; dringendste: Fall; bestellungen: number; zweitAbo: boolean; zyklusText?: string; anker?: string | null;
}
type Meldung = { art: "gut" | "schlecht"; text: string } | null;
type Frist = "ueberfaellig" | "heute" | "woche" | "alle";

const eur = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
const datum = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" }) : "—";
const zeit = (v: string | null | undefined) => v ? new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—";
const anrufen = (nummer: string, personId: number | null, name: string, rateId: number | null) => window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name, rateId } }));
const STUFE: Record<number, [string, string]> = { 0: ["noch nicht gemahnt", "#9ca3af"], 1: ["Mahnstufe 1", "#93c5fd"], 2: ["Mahnstufe 2", "#93c5fd"], 3: ["Mahnstufe 3", "#fde68a"], 4: ["Mahnstufe 4", "#fde68a"], 5: ["Mahnstufe 5 — Versand beendet", "#fca5a5"] };
function mandatText(status: unknown): string | null {
  const s = String(status ?? ""); if (!s) return null;
  if (s === "active") return "Lastschrift aktiv — die nächste Rate wird automatisch eingezogen";
  if (s === "pending_submission" || s === "submitted") return "Lastschrift eingerichtet, Mandat wird noch bestätigt";
  if (s === "cancelled") return "Lastschrift-Mandat gekündigt — kein automatischer Einzug mehr";
  if (s === "failed") return "Lastschrift-Mandat fehlgeschlagen — Bank hat abgelehnt";
  if (s === "expired") return "Lastschrift-Mandat abgelaufen";
  return `Lastschrift: ${s}`;
}

export default function AgentCollectionsPage() { return <AgentShell><CollectionsInnen /></AgentShell>; }

function CollectionsInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Collections"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { agent } = useAgentInfo();
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [zugang, setZugang] = useState<"pruefe" | "offen" | "kein" | "frei">("pruefe");
  const [reiter, setReiter] = useState<"liste" | "stunden">(() => (new URLSearchParams(window.location.search).get("tab") === "stunden" ? "stunden" : "liste"));
  const [frist, setFrist] = useState<Frist>("ueberfaellig");
  // Die Erklärung ist beim ersten Öffnen zu — sie wird einmal gelesen.
  const [erklaerungAuf, setErklaerungAuf] = useState(false);
  const [sendeMenue, setSendeMenue] = useState<number | null>(null);
  const [ergebnisFall, setErgebnisFall] = useState<Fall | null>(null);
  const [akte, setAkte] = useState<Fall | null>(null);
  const [aufgeklappt, setAufgeklappt] = useState<string[]>([]);
  const [meldung, setMeldung] = useState<Meldung>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await fetch(`/api/fiaon/inkasso/liste?frist=${frist}`, { credentials: "include" }).catch(() => null);
    if (r?.status === 404) { setZugang("kein"); setLaedt(false); return; }
    const j = await r?.json().catch(() => null);
    if (j?.zusageOffen) { setZugang("offen"); setLaedt(false); return; }
    if (j?.ok) { setDaten(j); setZugang("frei"); } else if (!r) setMeldung({ art: "schlecht", text: "Keine Verbindung." });
    setLaedt(false);
  }, [frist]);
  useEffect(() => { void laden(); }, [laden]);

  if (zugang === "pruefe" || (laedt && !daten)) return <div className="co"><p className="co-laedt" style={{ padding: "40px 0", textAlign: "center" }}>Lade …</p></div>;
  if (zugang === "kein") return <div className="co"><p className="co-leer karte" style={{ marginTop: 40 }}>Dieser Raum ist für Forderungen & Zahlungen reserviert. Dein Konto hat hier keinen Zugang.</p></div>;
  if (zugang === "offen") return <div className="co"><ZusageTafel basis="/inkasso/zusage" ton="dunkel" onAngenommen={() => void laden()} /></div>;

  const liste: Fall[] = daten?.liste ?? []; const menschen: Mensch[] = daten?.personen ?? [];
  // ── E-047/§18 Nr. 8: KEIN WIDERSPRUCH KOPF/LISTE ────────────────────────
  // VORHER kamen die Kopfzahlen immer aus den globalen Kennzahlen — für einen
  // Bonitätsmanager (Antwort `beschraenkt: true`, nur eigene Kunden) sagte der
  // Kopf „Nichts überfällig“, während die Liste 2 Überfällige zeigte.
  // NACHHER: Im beschränkten Zugriff werden die Kopfzahlen aus der EIGENEN
  // Liste gerechnet; Dianas globale Kennzahlen bleiben für die volle Sicht.
  const beschraenkt = !!daten?.beschraenkt;
  const eigene = {
    ueberfaellig_anzahl: liste.filter((f: any) => f.ueberfaellig).length,
    ueberfaellig_cents: liste.filter((f: any) => f.ueberfaellig).reduce((sum: number, f: any) => sum + Number(f.betrag_cents || 0), 0),
    heute_anzahl: liste.filter((f: any) => !f.ueberfaellig && String(f.faellig_am ?? "").slice(0, 10) === new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })).length,
    heute_cents: liste.filter((f: any) => !f.ueberfaellig && String(f.faellig_am ?? "").slice(0, 10) === new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })).reduce((sum: number, f: any) => sum + Number(f.betrag_cents || 0), 0),
  };
  const z = beschraenkt ? { ...eigene } as any : (daten?.zahlen ?? {});
  const v = daten?.verdienst ?? {};
  const FENSTER: [Frist, string, number, string][] = [["ueberfaellig", "Überfällig", daten?.fenster?.ueberfaellig ?? 0, "rot"], ["heute", "Heute fällig", daten?.fenster?.heute ?? 0, "gelb"], ["woche", "Nächste 7 Tage", daten?.fenster?.woche ?? 0, "blau"]];
  // 24.08.2026 (Justin): „Alle drei" ist raus — drei Zeitfenster reichen; der
  // vierte Reiter war nur die Summe der anderen drei und stiftete Verwirrung.
  // Der Wert „alle" bleibt serverseitig gültig (Altlinks brechen nicht).
  const darfPipeline = agent?.rolle !== "inkasso";

  return (
    <div className="co">
      <section className="co-kopf">
        <div>
          <span className="co-pille">Collections · Forderungen &amp; Zahlungen</span>
          <h1>{Number(z.ueberfaellig_anzahl) > 0 ? <><span className="co-verlauf">{z.ueberfaellig_anzahl} {Number(z.ueberfaellig_anzahl) === 1 ? "Rate" : "Raten"}</span> überfällig – {eur(z.ueberfaellig_cents)}.</> : <>Nichts überfällig – <span className="co-verlauf">gut gemacht.</span></>}</h1>
          {/* 24.08.2026 (Justin): VORHER stand die Erklärung dauerhaft im Kopf
              und kostete jeden Tag drei Zeilen Platz, obwohl man sie einmal
              liest. NACHHER als Aufklapper — beim ersten Mal da, danach zu. */}
          <button type="button" className="co-klapp" style={{ marginTop: 6 }}
                  onClick={() => setErklaerungAuf((v) => !v)} aria-expanded={erklaerungAuf}>
            {erklaerungAuf ? "Erklärung schließen" : "Wie diese Liste funktioniert"}
          </button>
          {erklaerungAuf && (
            <div className="co-erklaerung">
              <p>Von oben nach unten. Die Reihenfolge macht das System – der dringendste Fall steht zuerst. Eine Karte je Mensch, ein Klick: anrufen, Akte, senden, Ergebnis.</p>
              <p>Zahlungen bestätigt der Admin von Hand – bis dahin gilt eine Rate als offen.</p>
              {beschraenkt
                ? <p>Du siehst ausschließlich die offenen Raten <b>deiner eigenen Kunden</b>.</p>
                : <p>Ganz oben stehen die Raten, die dir zugeteilt sind. Darunter die, für die noch keine Inkasso-Zuteilung besteht – einen Betreuer haben diese Kunden trotzdem.</p>}
            </div>
          )}
        </div>
        {/* E-047: VORHER stand hier für ALLE der Stundensatz-/Prämien-Block —
            das ist Dianas Vergütungsmodell. NACHHER sehen Bonitätsmanager
            (beschraenkt) stattdessen den 50 %-Hinweis. */}
        {/* 24.08.2026 (Justin): VORHER stand hier für Bonitätsmanager dauerhaft
            „Dein Anteil 50 %". Das ist falsch aufgehängt — die 50 % gelten NUR
            für reaktivierte Raten aus dem ALTBESTAND (E-042a), nicht für die
            Liste als solche. Ein Satz, der immer da steht, wird als Regel für
            alles gelesen. NACHHER: ersatzlos raus. */}
        {beschraenkt ? null : (
        <div className="co-verdienst">
          <small>Dein Verdienst diesen Monat</small>
          <b>{eur(v.gesamtCents)}</b>
          <span>{Math.floor(Number(v.bestaetigtMinuten ?? 0) / 60)} Std bestätigt ({eur(v.stundenCents)}) · {v.praemienAnzahl ?? 0} eingezogene {Number(v.praemienAnzahl) === 1 ? "Rate" : "Raten"} ({eur(v.praemienCents)})</span>
          {Number(v.offeneMinuten) > 0 && <span>{Math.floor(Number(v.offeneMinuten) / 60)} Std {Number(v.offeneMinuten) % 60} Min warten noch auf die monatliche Bestätigung.</span>}
          {!v.verguetungBestaetigt && <span className="warn">Stundensatz und Prämie sind noch nicht bestätigt. Bis dahin werden keine Prämien gebucht – deine Arbeit wird aber vollständig festgehalten.</span>}
        </div>
        )}
      </section>

      {meldung && <p className={`co-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text} <button type="button" className="co-klapp" style={{ marginTop: 0, marginLeft: 8 }} onClick={() => setMeldung(null)}>ausblenden</button></p>}

      <section className="co-kacheln">
        {/* 24.08.2026 (Justin): Die Kachel „Heute fällig (deine Kunden)" ist
            raus — dieselbe Zahl steht direkt darunter als Filter-Reiter. */}
        {(beschraenkt ? [
          ["Überfällig (deine Kunden)", eur(z.ueberfaellig_cents), `${z.ueberfaellig_anzahl ?? 0} Raten`, "rot"],
        ] : [
          ["Heute fällig", eur(z.heute_cents), `${z.heute_anzahl ?? 0} Raten`, ""],
          ["Überfällig", eur(z.ueberfaellig_cents), `${z.ueberfaellig_anzahl ?? 0} Raten`, "rot"],
          ["Eingezogen (war überfällig)", eur(z.eingezogen_monat_cents), `${z.eingezogen_monat_anzahl ?? 0} ${(z.eingezogen_monat_anzahl ?? 0) === 1 ? "Rate" : "Raten"} · diesen Monat`, "gut"],
          ["Pünktlich eingegangen", eur(z.puenktlich_monat_cents ?? 0), `${z.puenktlich_monat_anzahl ?? 0} Raten · ohne Nachfassen`, ""],
          ["Einzugsquote", z.quote != null ? `${z.quote} %` : "—", z.quote_nenner ? `von ${z.quote_nenner} fällig` : "keine Basis", ""],
          ["Aktive Zusagen", String(z.zusagen_aktiv ?? 0), `${z.zusagen_gebrochen ?? 0} gebrochen`, ""],
        ]).map(([t, w, u, k], i) => <div key={t} className={`co-kachel ${k}`} style={{ animationDelay: `${i * 50}ms` }}><small>{t}</small><b>{w}</b><span>{u}</span></div>)}
      </section>

      {/* 24.08.2026 (Justin): „Arbeitsliste (2)" weg. Der Reiter war für den
          Bonitätsmanager der EINZIGE — ein Reiter, der nichts umschaltet, ist
          nur ein Etikett. Für Diana und die Leitung, die zusätzlich „Meine
          Zeiten" haben, bleibt die Umschaltung erhalten. */}
      {!beschraenkt && (
        <nav className="co-reiter" aria-label="Bereiche">
          <button type="button" className={reiter === "liste" ? "an" : ""} onClick={() => setReiter("liste")}><ListChecks size={16} strokeWidth={1.75} />Arbeitsliste ({liste.length})</button>
          <button type="button" className={reiter === "stunden" ? "an" : ""} onClick={() => setReiter("stunden")}><Clock size={16} strokeWidth={1.75} />Meine Zeiten</button>
        </nav>
      )}

      {reiter === "stunden" && <Zeiten onMeldung={setMeldung} />}

      {reiter === "liste" && (
        <>
          <div className="co-fenster">{FENSTER.map(([w, t, n, f]) => <button key={w} type="button" className={frist === w ? `an ${f}` : ""} onClick={() => setFrist(w)}>{t}<em>{n}</em></button>)}</div>
          {/* 24.08.2026 (Justin: „Es darf niemanden geben, der niemandem gehört
              — siehst du den Fehler?"). VORHER stand hier IMMER der Satz
              „… und darunter alles, was noch niemandem gehört". Er war an
              beiden Stellen falsch: Der Bonitätsmanager sieht ohnehin nur
              seine eigenen Kunden, und die vermeintlich herrenlosen Raten
              haben sehr wohl einen Betreuer — offen ist bei ihnen nur die
              gesonderte Inkasso-Zuteilung (gemessen: 249 von 250).
              NACHHER bleibt hier nur die Mengenangabe; die Erklärung wohnt im
              Aufklapper oben. */}
          {menschen.length > 0 && <p className="co-hinweis">{menschen.length} {menschen.length === 1 ? "Mensch" : "Menschen"} · {liste.length} {liste.length === 1 ? "offene Rate" : "offene Raten"}{laedt ? " · aktualisiere …" : ""}</p>}
          {liste.length === 0 && !laedt && (
            <p className="co-leer karte">{frist === "ueberfaellig" ? "Keine überfällige Rate. Das ist die beste Nachricht des Tages – schau in „Heute fällig“ oder „Nächste 7 Tage“, was ansteht." : frist === "heute" ? "Heute wird keine Rate fällig." : frist === "woche" ? "In den nächsten sieben Tagen wird keine Rate fällig." : "Nichts offen. Alle fälligen Raten sind bearbeitet oder haben eine Wiedervorlage in der Zukunft."}</p>
          )}
          <div className="co-liste">
            {menschen.map((m, i) => {
              const f = m.dringendste; const stufe = STUFE[Math.min(5, Number(f.mahnstufe))] ?? STUFE[0];
              const schluessel = m.personId != null ? `p:${m.personId}` : `ref:${f.ref}`; const offen = aufgeklappt.includes(schluessel);
              return (
                <article key={schluessel} className="co-karte" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  {(f.anruf_pflicht || f.zusage_gebrochen) && <p className={`co-band ${f.anruf_pflicht ? "rot" : "gelb"}`}>{f.anruf_pflicht ? "Anruf-Pflicht — der automatische Versand ist zu Ende" : `Zusage gebrochen — zugesagt war der ${datum(f.inkasso_zusage_am)}`}</p>}
                  {f.lastschrift_status === "fehlgeschlagen" && <p className="co-band rot">Lastschrift geplatzt{f.lastschrift_am ? ` am ${datum(f.lastschrift_am)}` : ""}{f.lastschrift_grund ? ` — ${f.lastschrift_grund}` : ""}</p>}
                  {f.lastschrift_status !== "fehlgeschlagen" && mandatText(f.gc_mandate_status) && <p className={`co-band ${f.gc_mandate_status === "active" ? "gut" : "gelb"}`}>{mandatText(f.gc_mandate_status)}</p>}
                  {/* E-047/§18 Nr. 9: VORHER fehlte der Fall „gar kein Mandat“ (mandatText → null, kein Band). */}
                  {f.lastschrift_status !== "fehlgeschlagen" && !f.gc_mandate_status && <p className="co-band gelb">Kein SEPA eingerichtet – bitte den Kunden im Gespräch, die Lastschrift im Kundenbereich einzurichten.</p>}
                  {m.zweitAbo && <p className="co-band gelb">Zweites Abo — {m.bestellungen} Bestellungen laufen parallel. Vor dem Mahnen klären.</p>}
                  <div className="co-karte-kopf">
                    <div><span className="name">{m.name}</span><span className="unter">{m.anzahl === 1 ? `Rate ${f.rate_nr} von ${f.raten_gesamt} · ${f.paket || "—"} · ${f.raten_bezahlt} bezahlt` : `${m.anzahl} offene Raten · ${f.paket || "—"} · ${f.raten_bezahlt} bezahlt`}</span></div>
                    <div className="geld"><b>{eur(m.summeCents)}</b><small className={f.ueberfaellig ? "rot" : ""}>{f.ueberfaellig ? `seit ${f.tage_ueberfaellig} ${Number(f.tage_ueberfaellig) === 1 ? "Tag" : "Tagen"} fällig` : `fällig ${datum(f.faellig_am)}`}</small></div>
                  </div>
                  <div className="co-meta">
                    <span className="stufe" style={{ color: stufe[1] }}>{stufe[0]}</span>
                    <span>{f.erinnerungen} {f.erinnerungen === 1 ? "Erinnerung" : "Erinnerungen"}{f.letzte_erinnerung_at && `, letzte ${datum(f.letzte_erinnerung_at)}`}</span>
                    <span className="co-mono">{f.zahlungsreferenz}</span>
                    {f.inkasso_versuche > 0 && <span>{f.inkasso_versuche} Anrufversuche</span>}
                    {f.letzter_bearbeiter && <span>zuletzt: {f.letzter_bearbeiter}</span>}
                  </div>
                  {m.zyklusText && <p className="co-zyklus">{m.zyklusText}</p>}
                  {m.anzahl > 1 && (
                    <>
                      <button type="button" className="co-klapp" onClick={() => setAufgeklappt((l) => l.includes(schluessel) ? l.filter((x) => x !== schluessel) : [...l, schluessel])}>{offen ? "Raten zuklappen" : `Alle ${m.anzahl} Raten zeigen (${eur(m.summeCents)})`}</button>
                      {offen && <div className="co-raten">{m.raten.map((r) => (
                        <div key={r.rate_id} className={`co-rate${r.rate_id === f.rate_id ? " jetzt" : ""}`}>
                          <b>Rate {r.rate_nr}</b><span className="betrag">{eur(r.betrag_cents)}</span>
                          <span>{r.ueberfaellig ? `seit ${r.tage_ueberfaellig} ${Number(r.tage_ueberfaellig) === 1 ? "Tag" : "Tagen"} offen` : `fällig ${datum(r.faellig_am)}`}</span>
                          <span className="co-mono">{r.zahlungsreferenz}</span>{m.zweitAbo && <span className="co-mono">{r.ref}</span>}
                          <button type="button" className="co-knopf still klein" onClick={() => setErgebnisFall(r)}>Ergebnis</button>
                        </div>
                      ))}</div>}
                    </>
                  )}
                  <div className="co-tun">
                    {f.telefonWaehlbar ? <button type="button" className="co-knopf" onClick={() => anrufen(f.telefonWaehlbar!, f.person_id, f.name, f.rate_id)}><Phone size={15} strokeWidth={1.75} /> Anrufen</button>
                      : f.telefonHinweis && <span className="co-nummer-hinweis">{f.telefonAnzeige ? `${f.telefonAnzeige} — ` : ""}{f.telefonHinweis}</span>}
                    <button type="button" className="co-knopf still" onClick={() => setAkte(f)}><FolderOpen size={15} strokeWidth={1.75} /> Akte</button>
                    <button type="button" className="co-knopf still" onClick={() => setSendeMenue(f.person_id)}><Mail size={15} strokeWidth={1.75} /> Senden</button>
                    <button type="button" className="co-knopf still" onClick={() => setErgebnisFall(f)}><ClipboardCheck size={15} strokeWidth={1.75} /> Ergebnis festhalten</button>
                    {darfPipeline && <Link href={`/agent/kunden?person=${f.person_id}`} className="co-knopf still">Kundenakte</Link>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {sendeMenue != null && <SendeMenue personId={sendeMenue} offen basis="/api/fiaon/agent/mail" onSchliessen={() => setSendeMenue(null)} onGesendet={() => { setSendeMenue(null); void laden(); }} />}
      {akte && <Akte fall={akte} onZu={() => setAkte(null)} onGeaendert={() => void laden()} />}
      {ergebnisFall && <ErgebnisDialog fall={ergebnisFall} ergebnisse={daten?.ergebnisse ?? []} onZu={() => setErgebnisFall(null)} onFertig={(t) => { setErgebnisFall(null); setMeldung({ art: "gut", text: t }); void laden(); }} />}
    </div>
  );
}

// ── Glas-Dialog (zentriert, am Handy als Blatt von unten) ──────────────────
function Dialog({ ueber, titel, unter, breite = 540, onZu, fuss, children }: { ueber: string; titel: string; unter?: ReactNode; breite?: number; onZu: () => void; fuss?: ReactNode; children: ReactNode }) {
  const zuRef = useRef(onZu); zuRef.current = onZu;
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") zuRef.current(); };
    window.addEventListener("keydown", zu); const r = document.getElementById("root"); const vorher = r?.style.overflow ?? ""; if (r) r.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", zu); if (r) r.style.overflow = vorher; };
  }, []);
  return (
    <div className="co-dialog-hintergrund" onClick={onZu} role="presentation">
      <div className="co-dialog" role="dialog" aria-modal="true" aria-label={titel} style={{ ["--co-breite" as any]: `${breite}px` }} onClick={(e) => e.stopPropagation()}>
        <div className="co-dialog-kopf"><div><span className="ueber">{ueber}</span><h2>{titel}</h2>{unter && <span className="unter">{unter}</span>}</div><button type="button" className="co-dialog-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button></div>
        <div className="co-dialog-inhalt">{children}</div>
        {fuss && <div className="co-dialog-fuss">{fuss}</div>}
      </div>
    </div>
  );
}

// ── Ergebnis festhalten — die Möglichkeiten kommen vom Server ───────────────
function ErgebnisDialog({ fall, ergebnisse, onZu, onFertig }: { fall: Fall; ergebnisse: { art: string; label: string; braucht?: string; hinweis: string }[]; onZu: () => void; onFertig: (text: string) => void }) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [datumWert, setDatumWert] = useState("");
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const e = ergebnisse.find((x) => x.art === gewaehlt);
  const senden = async () => {
    if (!gewaehlt) return; setBusy(true); setFehler(null);
    const r = await fetch(`/api/fiaon/inkasso/rate/${fall.rate_id}/ergebnis`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ergebnis: gewaehlt, zusageDatum: datumWert || null, notiz: notiz || null }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(false);
    if (!j?.ok) { setFehler(j?.error || "Fehler."); return; }
    onFertig(j.meldung);
  };
  return (
    <Dialog ueber={`Rate ${fall.rate_nr} · ${eur(fall.betrag_cents)}`} titel={fall.name} unter={<span className="co-mono">{fall.zahlungsreferenz}</span>} onZu={onZu}
      fuss={<><button type="button" className="co-knopf still" onClick={onZu}>Abbrechen</button><button type="button" className="co-knopf" disabled={busy || !gewaehlt} onClick={() => void senden()}>{busy ? "…" : "Festhalten"}</button></>}>
      {fehler && <p className="co-fehler" style={{ marginBottom: 12 }}>{fehler}</p>}
      <div className="co-wahl">{ergebnisse.map((x) => <button key={x.art} type="button" className={gewaehlt === x.art ? "an" : ""} onClick={() => { setGewaehlt(x.art); setFehler(null); }}><b>{x.label}</b><span>{x.hinweis}</span></button>)}</div>
      {e?.braucht === "datum" && <><label className="co-label" htmlFor="co-zusage-datum">Welchen Tag hat der Kunde genannt?</label><input id="co-zusage-datum" type="date" className="co-feld" value={datumWert} onChange={(ev) => setDatumWert(ev.target.value)} /></>}
      {e?.braucht === "notiz" && <><label className="co-label" htmlFor="co-notiz">Was hat der Kunde gesagt? (Pflicht – der Vorgesetzte entscheidet danach)</label><textarea id="co-notiz" className="co-feld" rows={4} value={notiz} onChange={(ev) => setNotiz(ev.target.value)} placeholder="Zwei Sätze genügen. Wörtlich ist besser als zusammengefasst." /></>}
      {e && e.braucht !== "notiz" && <textarea className="co-feld" rows={2} style={{ marginTop: 12 }} value={notiz} onChange={(ev) => setNotiz(ev.target.value)} placeholder="Notiz (freiwillig)" />}
      <p className="co-hinweis">Erlass, Stundung und Storno gibt es in diesem Bereich nicht. Wenn ein Kunde wirklich nicht zahlen kann, ist „Härtefall an den Vorgesetzten" die richtige Wahl – nicht mehr Druck.</p>
    </Dialog>
  );
}

// ── Meine Zeiten — erfassen, warten, bestätigt ─────────────────────────────
function Zeiten({ onMeldung }: { onMeldung: (m: Meldung) => void }) {
  const [daten, setDaten] = useState<any>(null);
  const [form, setForm] = useState({ tag: new Date().toISOString().slice(0, 10), von: "", bis: "", notiz: "" });
  const [busy, setBusy] = useState(false);
  const laden = useCallback(async () => { const r = await fetch("/api/fiaon/inkasso/stunden", { credentials: "include" }).catch(() => null); const j = await r?.json().catch(() => null); if (j?.ok) setDaten(j); }, []);
  useEffect(() => { void laden(); }, [laden]);
  const speichern = async () => {
    setBusy(true);
    const r = await fetch("/api/fiaon/inkasso/stunden", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(false);
    onMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
    if (j?.ok) { setForm((f) => ({ ...f, von: "", bis: "", notiz: "" })); void laden(); }
  };
  const entfernen = async (id: number) => { await fetch(`/api/fiaon/inkasso/stunden/${id}/entfernen`, { method: "POST", credentials: "include" }).catch(() => {}); void laden(); };
  const stunden: any[] = daten?.stunden ?? [];
  return (
    <>
      <section className="co-block-karte">
        <div className="titel"><Clock size={16} strokeWidth={1.75} /> Arbeitszeit erfassen</div>
        <div className="co-zeiten-form">
          <input type="date" className="co-feld" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} aria-label="Tag" />
          <input type="time" className="co-feld" value={form.von} onChange={(e) => setForm((f) => ({ ...f, von: e.target.value }))} aria-label="von" />
          <input type="time" className="co-feld" value={form.bis} onChange={(e) => setForm((f) => ({ ...f, bis: e.target.value }))} aria-label="bis" />
        </div>
        <input className="co-feld" style={{ marginTop: 8 }} value={form.notiz} onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))} placeholder="Woran hast du gearbeitet? (freiwillig)" />
        <div className="co-tun"><button type="button" className="co-knopf" disabled={busy || !form.von || !form.bis} onClick={() => void speichern()}>{busy ? "…" : "Eintragen"}</button></div>
        <p className="co-hinweis" style={{ marginTop: 12 }}>Der Vorgesetzte bestätigt einmal im Monat. Bestätigte Zeiten lassen sich danach nicht mehr ändern – auch nicht von ihm. Das schützt deine Abrechnung.</p>
      </section>
      {daten && stunden.length === 0 && <p className="co-leer karte">Noch keine Zeiten erfasst.</p>}
      <div className="co-liste" style={{ gap: 6 }}>
        {stunden.map((s) => (
          <div key={s.id} className="co-zeit-zeile">
            <b>{datum(s.tag)}</b><span>{String(s.von).slice(0, 5)}–{String(s.bis).slice(0, 5)}</span><b>{Math.floor(s.minuten / 60)}:{String(s.minuten % 60).padStart(2, "0")}</b>
            {s.notiz && <span>{s.notiz}</span>}
            <span className={`stand ${s.bestaetigt_am ? "gut" : "warten"}`}>{s.bestaetigt_am ? "bestätigt" : "wartet"}</span>
            {!s.bestaetigt_am && <button type="button" className="entfernen" onClick={() => void entfernen(s.id)}>entfernen</button>}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Die Akte — alles für das Gespräch, in einem Blick. Tatsachen, keine Deutung ─
const ERG_TEXT: Record<string, string> = { erreicht_zahlt_gleich: "zahlt sofort", erreicht_zahlt_am: "zahlt zum Termin", erreicht_abgelehnt: "abgelehnt", nicht_erreicht: "nicht erreicht", mailbox: "Mailbox besprochen", rueckruf_termin: "Rückruf vereinbart", nummer_falsch: "falsche Nummer", nummer_blockiert: "Nummer blockiert", notiz: "Notiz", zusage: "Zahlung zugesagt", zusage_gebrochen: "Zusage gebrochen" };
const ZUGANG_TEXT: Record<string, string> = { active: "freigeschaltet", pending: "noch nicht freigeschaltet", suspended: "gesperrt", cancelled: "gekündigt", invited: "eingeladen, noch nicht angemeldet" };
const BONITAET_TEXT: Record<string, string> = { pending: "beauftragt, läuft noch", ordered: "angefordert", received: "liegt vor", optimizing: "wird optimiert", done: "abgeschlossen", none: "nicht beauftragt", failed: "gescheitert — nachfassen" };
const MAIL_TEXT: Record<string, string> = { abo_payment_reminder: "Zahlungserinnerung (Rate)", payment_reminder: "Zahlungserinnerung (Erstzahlung)", payment_details: "Zahlungsdaten", payment_confirmed: "Zahlung bestätigt", welcome: "Willkommen", followup_48h: "Nachfassen nach 48 Std" };

function Akte({ fall, onZu, onGeaendert }: { fall: Fall; onZu: () => void; onGeaendert: () => void }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [player, setPlayer] = useState<number | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/inkasso/rate/${fall.rate_id}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setD(j); else setFehler(j?.error || "Die Akte konnte nicht geladen werden. Bitte noch einmal öffnen.");
  }, [fall.rate_id]);
  useEffect(() => { void laden(); }, [laden]);
  const k = d?.kunde;
  const erinnerung = async () => {
    setBusy(true); setMeldung(null);
    const r = await fetch(`/api/fiaon/inkasso/rate/${fall.rate_id}/erinnerung`, { method: "POST", credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(false);
    setMeldung(j?.ok ? { art: "gut", text: j.meldung } : { art: "schlecht", text: j?.error || "Die Mail ging nicht raus." });
    // Die Meldung muss stehen bleiben: Liste erst nach vier Sekunden neu laden.
    if (j?.ok) { void laden(); window.setTimeout(() => onGeaendert(), 4000); }
  };
  const tageOffen = Number(fall.tage_ueberfaellig ?? k?.tage_offen ?? Math.max(0, Math.floor((Date.now() - new Date(fall.faellig_am).getTime()) / 86_400_000)));
  const nummer: string | null = fall.telefonWaehlbar ?? k?.telefonWaehlbar ?? null;
  const nummerHinweis: string | null = nummer ? null : (fall.telefonHinweis ?? k?.telefonHinweis ?? null);
  const verlauf = [...(d?.arbeit ?? []).map((a: any) => ({ wann: a.created_at, wer: a.agent_name, was: `${ERG_TEXT[a.ergebnis] ?? a.ergebnis}${a.zusage_am ? ` · Zusage ${datum(a.zusage_am)}` : ""}${a.wiedervorlage ? ` · wieder ${datum(a.wiedervorlage)}` : ""}`, notiz: a.notiz })),
    ...(d?.kontakte ?? []).map((c: any) => ({ wann: c.created_at, wer: c.agent_name, was: c.outcome || c.type, notiz: c.note }))]
    .sort((a, b) => new Date(b.wann).getTime() - new Date(a.wann).getTime()).slice(0, 30);

  return (
    <Dialog ueber={`Rate ${fall.rate_nr} · ${eur(fall.betrag_cents)}`} titel={k?.name ?? fall.name} breite={760} onZu={onZu}>
      <div className="co-akte-kopf">
        <div><small>Offen seit</small><b className={tageOffen > 0 ? "rot" : ""}>{tageOffen} {tageOffen === 1 ? "Tag" : "Tagen"}</b><span>fällig war {datum(fall.faellig_am)}</span></div>
        <div><small>Diese Rate</small><b>{eur(fall.betrag_cents)}</b><span>Rate {fall.rate_nr}{k?.raten_gesamt ? ` von ${k.raten_gesamt}` : ""}</span></div>
        {Number(k?.offen_gesamt_cents) > Number(fall.betrag_cents) && <div><small>Gesamt überfällig</small><b className="gelb">{eur(k?.offen_gesamt_cents)}</b><span>mehrere Raten offen</span></div>}
        <div><small>Mahnstufe</small><b className={fall.mahnstufe >= 2 ? "rot" : ""}>{fall.mahnstufe}</b><span>{fall.erinnerungen} {fall.erinnerungen === 1 ? "Erinnerung" : "Erinnerungen"} raus</span></div>
        {(fall.lastschrift_status || k?.gc_mandate_status) && <div><small>Lastschrift</small><b className={fall.lastschrift_status === "fehlgeschlagen" ? "rot" : k?.gc_mandate_status === "active" ? "gut" : ""}>{fall.lastschrift_status === "fehlgeschlagen" ? "geplatzt" : fall.lastschrift_status === "eingereicht" ? "läuft" : k?.gc_mandate_status === "active" ? "aktiv" : k?.gc_mandate_status ? "inaktiv" : "—"}</b><span>{fall.lastschrift_status === "fehlgeschlagen" ? (fall.lastschrift_grund || "Einzug kam zurück") : (mandatText(k?.gc_mandate_status) || "kein Mandat")}</span></div>}
        {k && <div><small>Schon bezahlt</small><b className={Number(k.raten_bezahlt) > 0 ? "gut" : ""}>{k.raten_bezahlt}</b><span>{Number(k.raten_bezahlt) > 0 ? "zahlt sonst zuverlässig" : "noch keine Rate"}</span></div>}
      </div>
      <div className="co-akte-tun">
        {nummer && <button type="button" className="co-knopf" onClick={() => anrufen(nummer, fall.person_id, fall.name, fall.rate_id)}><Phone size={15} strokeWidth={1.75} /> Anrufen · {nummer}</button>}
        {!nummer && nummerHinweis && <span className="co-nummer-hinweis">{nummerHinweis}</span>}
        <button type="button" className="co-knopf still" disabled={busy} onClick={() => void erinnerung()}><Mail size={15} strokeWidth={1.75} /> {busy ? "Geht raus …" : "Rechnung jetzt schicken"}</button>
        {!fall.email && d && !k?.bestell_email && !k?.primary_email && <span className="co-hinweis" style={{ color: "#fde68a" }}>Keine E-Mail hinterlegt – Bankdaten am Telefon durchgeben.</span>}
      </div>
      {meldung && <p className={`co-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`} style={{ marginTop: 12 }}>{meldung.text}</p>}
      {fehler && <p className="co-fehler" style={{ marginTop: 12 }}>{fehler}</p>}
      {!d && !fehler && <p className="co-laedt" style={{ marginTop: 14 }}>Kundendaten, Raten und Verlauf werden geladen …</p>}
      {d && (
        <>
          <details className="co-block"><summary><Landmark size={13} strokeWidth={1.75} style={{ verticalAlign: -2, marginRight: 6 }} />Bankdaten zum Vorlesen</summary>
            <div className="co-daten">{([["Empfänger", d.bank?.empfaenger], ["IBAN", d.bank?.iban], ["BIC", d.bank?.bic], ["Verwendungszweck", d.bank?.verwendungszweck]] as const).map(([t, w]) => <div key={t}><small className="marke">{t}</small><p className="co-mono">{w ?? "—"}</p></div>)}</div>
            <p className="co-hinweis" style={{ marginTop: 10 }}>Der Verwendungszweck ist wichtig: Ohne ihn lässt sich die Überweisung nicht dieser Rate zuordnen, und die Mahnung läuft weiter.</p>
          </details>
          <div className="co-block"><p className="titel">Kunde</p>
            <div className="co-daten">{([["Name", k?.name], ["Paket", k?.pack_name], ["Kunde seit", datum(k?.kunde_seit)], ["E-Mail", k?.bestell_email || k?.primary_email], ["Telefon", nummer], ["Adresse", [k?.strasse, [k?.plz, k?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")], ["Zugang", ZUGANG_TEXT[String(k?.account_status ?? "")] ?? k?.account_status], ["Bonität", BONITAET_TEXT[String(k?.schufa_status ?? "")] ?? k?.schufa_status]] as const).filter(([, w]) => w).map(([t, w]) => <div key={t}><small className="marke">{t}</small><p>{w}</p></div>)}</div>
          </div>
          <div className="co-block"><p className="titel">Alle Raten</p>
            <div className="co-akte-raten">{(d.raten ?? []).map((r: any) => { const stand = r.status === "bezahlt" ? "bezahlt" : new Date(r.faellig_am) < new Date() ? "ueberfaellig" : "offen"; return (
              <div key={r.rate_nr} className={`co-akte-rate ${stand}${r.rate_nr === fall.rate_nr ? " jetzt" : ""}`}><span className="nr">{r.rate_nr}</span><b style={{ color: "#fff", fontWeight: 500 }}>{eur(r.betrag_cents)}</b><span style={{ color: "#9ca3af", fontSize: 11.5 }}>{datum(r.faellig_am)}</span><span className="stand">{stand === "bezahlt" ? `bezahlt ${datum(r.bezahlt_am)}` : stand === "ueberfaellig" ? "überfällig" : "kommt noch"}</span></div>
            ); })}</div>
          </div>
          <div className="co-block"><p className="titel">Gespräche {(d.gespraeche ?? []).length > 0 && `(${d.gespraeche.length})`}</p>
            {(d.gespraeche ?? []).length === 0 && <p className="co-leer">Mit diesem Kunden wurde über die Plattform noch nicht telefoniert.</p>}
            {(d.gespraeche ?? []).map((g: any) => (
              <div key={g.id} className="co-zeile">
                <div className="co-zeile-kopf"><span className="zeit">{zeit(g.beginn)}</span>{g.dauer_sek != null && <b>{Math.floor(g.dauer_sek / 60)}:{String(g.dauer_sek % 60).padStart(2, "0")}</b>}{g.agent && <span className="wer">{g.agent}</span>}{g.ergebnis && <span className="erg">{ERG_TEXT[g.ergebnis] ?? g.ergebnis}</span>}{g.hat_aufnahme && !g.ohne_aufzeichnung_am && <button type="button" className="hoeren" onClick={() => setPlayer(player === g.id ? null : g.id)}>{player === g.id ? "zu" : "anhören"}</button>}</div>
                {g.zusammenfassung && <p className="co-fass">{g.zusammenfassung}</p>}
                {player === g.id && <AnrufPlayer anrufId={g.id} ton="dunkel" kennzeichen="anruf-player-collections" />}
              </div>
            ))}
          </div>
          <div className="co-block"><p className="titel">Verschickte Mails</p>
            {(d.mails ?? []).length === 0 && <p className="co-leer">Noch keine Mail an diesen Kunden.</p>}
            {(d.mails ?? []).map((m: any, i: number) => <div key={i} className="co-zeile"><div className="co-zeile-kopf"><span className="zeit">{zeit(m.gesendet_am)}</span><span className="erg">{MAIL_TEXT[m.event] ?? m.event}</span>{!m.ok && <span className="fehl">nicht angekommen: {m.grund}</span>}</div></div>)}
          </div>
          <div className="co-block"><p className="titel">Verlauf</p>
            {verlauf.length === 0 && <p className="co-leer">Noch kein Eintrag.</p>}
            {verlauf.map((e: any, i: number) => <div key={i} className="co-zeile"><div className="co-zeile-kopf"><span className="zeit">{zeit(e.wann)}</span>{e.wer && <span className="wer">{e.wer}</span>}<span className="erg">{e.was}</span></div>{e.notiz && <p className="co-fass">{e.notiz}</p>}</div>)}
          </div>
        </>
      )}
    </Dialog>
  );
}
