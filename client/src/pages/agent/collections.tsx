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
// Die Reihenfolge macht der Server. Erlass, Stundung, Kürzung, Storno gibt es
// hier nicht – nur „Härtefall an den Vorgesetzten".
//
// ── 24.08.2026 (Justin), ZWEI ÄNDERUNGEN AN EINEM TAG ─────────────────────
// 1. VORHER trug jede Kundenkarte fünf gleichrangige Knöpfe (Anrufen · Akte ·
//    Senden · Ergebnis festhalten · Kundenakte) — eine Knopf-Wüste, dieselbe
//    wie in der Pipeline vor dem Umbau. NACHHER sagt die Karte nur noch, wer
//    dran ist und warum, und trägt EINEN Knopf „Starten". Hausregel dahinter:
//    Eine Handlung wohnt an genau EINER Stelle — gehandelt wird in der Akte.
// 2. VORHER öffnete dieser Raum eine EIGENE, ärmere Akte (nur Lesen: Bank,
//    Raten, Gespräche, Mails). Justin: „Wenn ich da die Akte öffne, hat die
//    plötzlich eine ganz andere Ansicht … was ist, wenn der Kunde im Call
//    sagt: ‚ah, meine Adresse hat sich geändert!'" — dann ging genau das
//    nicht. NACHHER öffnet „Starten" DIESELBE Akte wie die Pipeline
//    (`Akte` aus pipeline.tsx): Reiter, Situations-Kopf, „Kunde bearbeiten"
//    mit allen Feldern, Termin buchen, Ergebnis festhalten — in EINEM Raum.
// ═══════════════════════════════════════════════════════════════════════════
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { Clock, X, ListChecks, Play } from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { ToastAnbieter } from "@/lib/fiaon-ui";
import { Akte, type Kunde } from "./pipeline";
import { ZusageTafel } from "./vertrieb-zusage";
// Die gemeinsame Akte bringt ihr eigenes Kleid mit — ohne diese Datei stünde
// sie in Collections ungestylt da. Die Klassen sind `pi-`, unsere `co-`:
// die beiden Blätter gehen sich nicht ins Gehege.
import "@/styles/office-pipeline.css";
import "@/styles/office-collections.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

// 24.08.2026 (Justin): Der Nenner ist die VERTRAGSLAUFZEIT (12 Raten), nicht
// die Zahl der bisher angelegten Ratenzeilen — die entstehen fortlaufend,
// immer nur die naechste faellige. Vorher stand bei einem Kunden im zweiten
// Monat „Rate 2 von 2", was wie ein Zweimonatsvertrag aussah.

interface Fall {
  rate_id: number; ref: string; rate_nr: number; betrag_cents: number; zahlungsreferenz: string; faellig_am: string;
  mahnstufe: number; erinnerungen: number; letzte_erinnerung_at: string | null; inkasso_wiedervorlage: string | null;
  inkasso_zusage_am: string | null; inkasso_versuche: number; eskaliert_am: string | null; person_id: number; name: string;
  email: string | null; phone: string | null; phone_country_code: string | null; paket: string | null;
  telefonAnzeige: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
  ueberfaellig: boolean; tage_ueberfaellig: number; anruf_pflicht: boolean; zusage_gebrochen: boolean; zusage_offen?: boolean;
  raten_bezahlt: number; raten_gesamt: number; letzter_bearbeiter: string | null; letztes_ergebnis: string | null;
  // 24.08.2026: Der Stand der Rate steht in /inkasso/liste — die gemeinsame
  // Akte (RatenBlock) zeigt ihn je Rate an, deshalb hier im Typ nachgetragen.
  status?: string | null;
  lastschrift_status?: string | null; lastschrift_grund?: string | null; lastschrift_am?: string | null; gc_mandate_status?: string | null;
}
interface Mensch {
  personId: number | null; name: string; email: string | null; phone: string | null; phoneCountryCode: string | null;
  telefonAnzeige: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
  raten: Fall[]; anzahl: number; summeCents: number; dringendste: Fall; bestellungen: number; zweitAbo: boolean; zyklusText?: string; anker?: string | null;
}
type Meldung = { art: "gut" | "schlecht"; text: string } | null;
type Frist = "ueberfaellig" | "heute" | "woche" | "alle" | "zusagen";

const eur = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
const datum = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" }) : "—";
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

// 24.08.2026 (Justin, Auftrag 2): VORHER stand hier nur die Hülle. NACHHER
// liegt ein ToastAnbieter darin — die gemeinsame Akte meldet über Toasts
// („Gespeichert", „Termin gebucht"). Ohne Anbieter liefe jede Rückmeldung
// der Akte in den leeren Standardwert und der Mitarbeiter sähe nichts.
export default function AgentCollectionsPage() {
  return <AgentShell><ToastAnbieter ton="dunkel"><CollectionsInnen /></ToastAnbieter></AgentShell>;
}

// ── Die Raten-Felder eines Menschen, wie die gemeinsame Akte sie erwartet ──
// Dieselbe Übersetzung wie in pipeline.tsx (dort aus /inkasso/liste in die
// Kundenkarte gemischt). Sie ist der Schlüssel dafür, dass die Akte den Zweig
// „Rate überfällig" kennt: Ohne `istRate`/`rateListe` fiele sie zurück auf
// „Lead" und die raten-spezifischen Ergebnisse (Zahlt Rate am … · 1 Monat
// ausgesetzt · Nicht erreicht · Kein Kontakt mehr möglich) verschwänden.
function ratenFelder(m: Mensch): Partial<Kunde> {
  const d = m.dringendste ?? m.raten?.[0];
  return {
    istRate: true,
    rateCents: d?.betrag_cents != null ? Number(d.betrag_cents) : null,
    rateNr: d?.rate_nr != null ? Number(d.rate_nr) : null,
    rateFaelligAm: d?.faellig_am ?? null,
    rateAnzahl: Number(m.anzahl || m.raten?.length || 1),
    rateSummeCents: Number(m.summeCents || 0),
    rateListe: (m.raten || []).map((x) => ({
      id: Number(x.rate_id), rateNr: Number(x.rate_nr),
      betragCents: Number(x.betrag_cents || 0), faelligAm: x.faellig_am ?? null,
      status: String(x.status || "offen"),
      lastschriftStatus: x.lastschrift_status ?? null,
      lastschriftGrund: x.lastschrift_grund ?? null,
      sepaEingerichtet: String(x.gc_mandate_status || "") === "active",
    })),
  };
}

function CollectionsInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Collections"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [zugang, setZugang] = useState<"pruefe" | "offen" | "kein" | "frei">("pruefe");
  const [reiter, setReiter] = useState<"liste" | "stunden">(() => (new URLSearchParams(window.location.search).get("tab") === "stunden" ? "stunden" : "liste"));
  const [frist, setFrist] = useState<Frist>("ueberfaellig");
  // Die Erklärung ist beim ersten Öffnen zu — sie wird einmal gelesen.
  const [erklaerungAuf, setErklaerungAuf] = useState(false);
  const [aufgeklappt, setAufgeklappt] = useState<string[]>([]);
  const [meldung, setMeldung] = useState<Meldung>(null);
  // ── Die EINE Akte (Justin 24.08., Auftrag 2) ────────────────────────────
  // `offen` ist die personId, deren Akte gerade auf ist; `akteKunde` der
  // geladene Kunde, wie die gemeinsame Akte ihn braucht.
  const [offen, setOffen] = useState<number | null>(null);
  const [akteKunde, setAkteKunde] = useState<Kunde | null>(null);
  const [akteLaedt, setAkteLaedt] = useState(false);

  // P15 (01.09.2026): Kundensuche — 280 ms entprellt, gleiche Taktung wie in
  // der Kundenliste. Bei aktiver Suche hebt der Server die Wiedervorlage-
  // Ausblendung auf, damit auch Kunden mit offener Zusage findbar sind.
  const [suche, setSuche] = useState("");
  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await fetch(`/api/fiaon/inkasso/liste?frist=${frist}${suche.trim() ? `&q=${encodeURIComponent(suche.trim())}` : ""}`, { credentials: "include" }).catch(() => null);
    if (r?.status === 404) { setZugang("kein"); setLaedt(false); return; }
    const j = await r?.json().catch(() => null);
    if (j?.zusageOffen) { setZugang("offen"); setLaedt(false); return; }
    if (j?.ok) { setDaten(j); setZugang("frei"); } else if (!r) setMeldung({ art: "schlecht", text: "Keine Verbindung." });
    setLaedt(false);
  }, [frist, suche]);
  useEffect(() => { const t = setTimeout(() => void laden(), suche ? 280 : 0); return () => clearTimeout(t); }, [laden, suche]);

  // ── Akte öffnen/schließen ───────────────────────────────────────────────
  // Wie in bestand.tsx: Solange die Akte offen ist, steht die Seite darunter
  // still (sonst scrollt der Hintergrund mit und man verliert die Zeile).
  const oeffnen = (id: number | null) => { setOffen(id); if (id == null) setAkteKunde(null); };
  useEffect(() => {
    const r = document.getElementById("root");
    if (r) r.style.overflow = offen != null ? "hidden" : "";
    document.body.style.overflow = offen != null ? "hidden" : "";
    return () => { if (r) r.style.overflow = ""; document.body.style.overflow = ""; };
  }, [offen]);
  /** Der Mensch aus der Arbeitsliste zu einer personId. Die Liste führt die
   *  Kennung an zwei Stellen (Kopf und Rate) — beide gelten. */
  const menschZu = (id: number | null): Mensch | undefined => id == null ? undefined
    : ((daten?.personen ?? []) as Mensch[]).find((x) => (x.personId ?? x.dringendste?.person_id) === id);
  // Der Kunde für die gemeinsame Akte: Stammdaten aus dem CRM, die offenen
  // Raten aus der Liste, die dieser Raum ohnehin schon geladen hat.
  useEffect(() => {
    if (offen == null) { setAkteKunde(null); return; }
    let an = true;
    setAkteLaedt(true);
    void api(`/agent/crm/kunden/${offen}`).then((r) => {
      if (!an) return;
      setAkteLaedt(false);
      if (!r.ok || !r.json?.kunde) { setAkteKunde(null); return; }
      const m = menschZu(offen);
      setAkteKunde(m ? { ...r.json.kunde, ...ratenFelder(m) } : r.json.kunde);
    });
    return () => { an = false; };
  }, [offen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Speichert die Akte etwas (z. B. die geänderte Adresse), lädt sie den
  // Kunden neu — die Raten-Felder müssen dabei erhalten bleiben, sonst
  // verschwindet der Zweig „Rate überfällig" mitten im Gespräch.
  const ersetzen = (neu: Kunde) => {
    const m = menschZu(neu.personId);
    setAkteKunde(m ? { ...neu, ...ratenFelder(m) } : neu);
  };

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
  // P16 (01.09.2026): „Zusagen offen" als viertes Fenster — eine Zusage ist
  // eine Stufe (Zahlung ausstehend), kein Verschwinden aus dem Bereich.
  const FENSTER: [Frist, string, number, string][] = [["ueberfaellig", "Überfällig", daten?.fenster?.ueberfaellig ?? 0, "rot"], ["heute", "Heute fällig", daten?.fenster?.heute ?? 0, "gelb"], ["woche", "Nächste 7 Tage", daten?.fenster?.woche ?? 0, "blau"], ["zusagen", "Zusagen offen", daten?.fenster?.zusagen ?? 0, "gruen"]];
  // 24.08.2026 (Justin): „Alle drei" ist raus — drei Zeitfenster reichen; der
  // vierte Reiter war nur die Summe der anderen drei und stiftete Verwirrung.
  // Der Wert „alle" bleibt serverseitig gültig (Altlinks brechen nicht).
  // 24.08.2026 (Justin, Auftrag 1): VORHER entschied `darfPipeline`, ob die
  // Karte zusätzlich den Knopf „Kundenakte" (Sprung nach /agent/kunden) trug.
  // NACHHER gibt es diesen zweiten Weg nicht mehr — „Starten" öffnet dieselbe
  // Akte direkt hier, ohne Raumwechsel. Damit fällt auch die Rollenabfrage weg.

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
              {/* 24.08.2026 (Justin, Auftrag 1): VORHER „ein Klick: anrufen,
                  Akte, senden, Ergebnis" — das waren vier Klicks und vier
                  Knöpfe. NACHHER beschreibt der Satz den Weg, den es wirklich
                  gibt: eine Karte je Mensch, ein Knopf, die Akte. */}
              <p>Von oben nach unten. Die Reihenfolge macht das System – der dringendste Fall steht zuerst. Eine Karte je Mensch, ein Knopf: „Starten“ öffnet die Akte, und dort passiert alles – anrufen, Daten ändern, Termin, Ergebnis.</p>
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
          {/* P15: die Suche — Name, Telefon (formatfrei), E-Mail oder Referenz. */}
          <input className="co-suche" value={suche} onChange={(e) => setSuche(e.target.value)}
                 placeholder="Kunden suchen — Name, Telefon, E-Mail oder Referenz"
                 style={{ width: "100%", margin: "10px 0", padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,.35)", background: "rgba(15,23,42,.35)", color: "inherit", font: "inherit" }} />
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
            <p className="co-leer karte">{frist === "ueberfaellig" ? "Keine überfällige Rate. Das ist die beste Nachricht des Tages – schau in „Heute fällig“ oder „Nächste 7 Tage“, was ansteht." : frist === "heute" ? "Heute wird keine Rate fällig." : frist === "woche" ? "In den nächsten sieben Tagen wird keine Rate fällig." : frist === "zusagen" ? "Keine offene Zusage — niemand hat gerade ein Zahlungsdatum genannt, auf das gewartet wird." : "Nichts offen. Alle fälligen Raten sind bearbeitet oder haben eine Wiedervorlage in der Zukunft."}</p>
          )}
          <div className="co-liste">
            {menschen.map((m, i) => {
              const f = m.dringendste; const stufe = STUFE[Math.min(5, Number(f.mahnstufe))] ?? STUFE[0];
              const schluessel = m.personId != null ? `p:${m.personId}` : `ref:${f.ref}`; const ratenAuf = aufgeklappt.includes(schluessel);
              // Der Mensch hinter der Rate — die Akte hängt an der Person.
              const personId: number | null = m.personId ?? (f.person_id != null ? Number(f.person_id) : null);
              return (
                <article key={schluessel} className="co-karte" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  {(f.anruf_pflicht || f.zusage_gebrochen) && <p className={`co-band ${f.anruf_pflicht ? "rot" : "gelb"}`}>{f.anruf_pflicht ? "Anruf-Pflicht — der automatische Versand ist zu Ende" : `Zusage gebrochen — zugesagt war der ${datum(f.inkasso_zusage_am)}`}</p>}
                  {/* P16: Zusage offen — der Kunde hat ein Datum genannt, das noch vor uns liegt. */}
                  {f.zusage_offen && !f.zusage_gebrochen && <p className="co-band gut">{`Zusage — zahlt am ${datum(f.inkasso_zusage_am)}, Zahlung ausstehend`}</p>}
                  {f.lastschrift_status === "fehlgeschlagen" && <p className="co-band rot">Lastschrift geplatzt{f.lastschrift_am ? ` am ${datum(f.lastschrift_am)}` : ""}{f.lastschrift_grund ? ` — ${f.lastschrift_grund}` : ""}</p>}
                  {f.lastschrift_status !== "fehlgeschlagen" && mandatText(f.gc_mandate_status) && <p className={`co-band ${f.gc_mandate_status === "active" ? "gut" : "gelb"}`}>{mandatText(f.gc_mandate_status)}</p>}
                  {/* E-047/§18 Nr. 9: VORHER fehlte der Fall „gar kein Mandat“ (mandatText → null, kein Band). */}
                  {f.lastschrift_status !== "fehlgeschlagen" && !f.gc_mandate_status && <p className="co-band gelb">Kein SEPA eingerichtet – bitte den Kunden im Gespräch, die Lastschrift im Kundenbereich einzurichten.</p>}
                  {m.zweitAbo && <p className="co-band gelb">Zweites Abo — {m.bestellungen} Bestellungen laufen parallel. Vor dem Mahnen klären.</p>}
                  <div className="co-karte-kopf">
                    <div><span className="name">{m.name}</span><span className="unter">{m.anzahl === 1 ? `Rate ${f.rate_nr} von 12 · ${f.paket || "—"} · ${f.raten_bezahlt} bezahlt` : `${m.anzahl} offene Raten · ${f.paket || "—"} · ${f.raten_bezahlt} bezahlt`}</span></div>
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
                      <button type="button" className="co-klapp" onClick={() => setAufgeklappt((l) => l.includes(schluessel) ? l.filter((x) => x !== schluessel) : [...l, schluessel])}>{ratenAuf ? "Raten zuklappen" : `Alle ${m.anzahl} Raten zeigen (${eur(m.summeCents)})`}</button>
                      {ratenAuf && <div className="co-raten">{m.raten.map((r) => (
                        <div key={r.rate_id} className={`co-rate${r.rate_id === f.rate_id ? " jetzt" : ""}`}>
                          <b>Rate {r.rate_nr}</b><span className="betrag">{eur(r.betrag_cents)}</span>
                          <span>{r.ueberfaellig ? `seit ${r.tage_ueberfaellig} ${Number(r.tage_ueberfaellig) === 1 ? "Tag" : "Tagen"} offen` : `fällig ${datum(r.faellig_am)}`}</span>
                          {/* 24.08.2026 (Justin): VORHER stand hier je Rate ein
                              zweiter „Ergebnis"-Knopf. NACHHER ist die Liste
                              reine Auskunft — gebucht wird jede einzelne Rate
                              in der Akte („Rate überfällig – zurückholen":
                              Erinnerung senden · Ergebnis buchen). */}
                          <span className="co-mono">{r.zahlungsreferenz}</span>{m.zweitAbo && <span className="co-mono">{r.ref}</span>}
                        </div>
                      ))}</div>}
                    </>
                  )}
                  {/* ── EIN Knopf statt fünf (Justin 24.08.) ────────────────
                      VORHER: Anrufen · Akte · Senden · Ergebnis festhalten ·
                      Kundenakte — fünf gleichrangige Wege, und der Mitarbeiter
                      musste vor dem Anruf entscheiden, welcher der richtige
                      ist. NACHHER: „Starten" öffnet die Akte; dort steht
                      alles, was hier stand, an der passenderen Stelle
                      (Anrufen im Situations-Kopf, Senden und Termin im
                      „Mehr"-Menü, Ergebnis im Abschluss). Genau dasselbe
                      Muster wie ArbeitsFokus in der Pipeline. */}
                  <div className="co-tun">
                    <button type="button" className="pi-knopf riesig pi-starten"
                            disabled={personId == null}
                            title={personId == null ? "Zu dieser Rate ist kein Kunde hinterlegt." : undefined}
                            onClick={() => oeffnen(personId)}>
                      <Play size={19} strokeWidth={2} /> Starten
                    </button>
                    <span className="pi-starten-neben">Öffnet die Akte: anrufen, Schritt erledigen, Ergebnis festhalten.</span>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* ── DIE EINE AKTE ────────────────────────────────────────────────
          Portal an document.body ist Pflicht, nicht Geschmack: Die Seite
          liegt in `.of-grund` (z-index 1), der Office-Kopf trägt z-index 30 —
          im Stapel-Kontext der Seite malte der Kopf IMMER über den Akte-Kopf
          („oben abgeschnitten"). Pipeline und Bestand machen es genauso. */}
      {offen != null && createPortal(
        <>
          <div className="pi-lade-hintergrund" onClick={() => oeffnen(null)} aria-hidden="true" />
          {akteKunde ? (
            <Akte key={akteKunde.personId} k={akteKunde} onZu={() => oeffnen(null)}
                  onWeg={() => { oeffnen(null); void laden(); }}
                  onNeu={ersetzen}
                  onErledigt={() => {}}
                  onZaehler={() => void laden()} />
          ) : (
            <aside className="pi-lade" role="dialog" aria-modal="true">
              <div className="pi-lade-fest"><div className="pi-lade-kopf"><span /><h2>{akteLaedt ? "Lade …" : "Akte nicht gefunden"}</h2>
                <button type="button" className="pi-lade-zu" onClick={() => oeffnen(null)} aria-label="Schließen"><X size={18} /></button></div></div>
              {!akteLaedt && <div className="pi-lade-koerper"><p className="pi-fussnote">Diese Akte lässt sich mit deinem Zugang nicht öffnen. Melde dich beim Vorgesetzten – wir schauen uns den Fall gemeinsam an.</p></div>}
            </aside>
          )}
        </>, document.body)
      }
      {/* 24.08.2026: Rundgang je Raum (E-063). */}
      <Rundgang raum="collections" titel={RUNDGAENGE.collections.titel} schritte={RUNDGAENGE.collections.schritte} />
    </div>
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


// ── 24.08.2026 (Justin, Auftrag 2): HIER STAND EINE ZWEITE AKTE ───────────
// VORHER lebten an dieser Stelle drei Bausteine, die es nur in Collections
// gab: `Dialog` (Glas-Dialog), `ErgebnisDialog` (Ergebnis festhalten) und
// eine eigene, ärmere `Akte` (Bank, Raten, Gespräche, Mails — alles nur zum
// Lesen). Justin: „Wenn ich da die Akte öffne, hat die plötzlich eine ganz
// andere Ansicht — die Akte selbst soll bitte einheitlich sein.“ Eine
// Adressänderung im Gespräch war hier nicht möglich.
// NACHHER: ersatzlos entfernt. Collections öffnet die gemeinsame `Akte` aus
// pipeline.tsx (oben importiert) — dieselbe Ansicht wie Pipeline und
// Bestand, mit „Kunde bearbeiten“, Termin, Ergebnis. Die raten-eigenen
// Ergebnisse gehen dabei nicht verloren: Die Akte kennt den Zweig
// `sitArt === "rate_ueberfaellig"` und bekommt über `ratenFelder` die
// offenen Raten mitgeliefert.
