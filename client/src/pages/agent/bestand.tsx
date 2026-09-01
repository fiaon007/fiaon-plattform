// ═══════════════════════════════════════════════════════════════════════════
// /agent/bestand — Der Portfolio-Raum: die mandatierten Kunden (24.08.2026)
// E-050 (Plan §19), Bezug „Plan §4/§11“.
//
// VORHER lebte der Bestand als zweiter Reiter in /agent/pipeline und mischte
// ALLE zugewiesenen Kunden (Leads, Rechnungen, Raten) mit dem 3D-Strom.
// NACHHER ist dieser Raum das PORTFOLIO: nur übernommene Mandate
// (fiaon_persons.mandat_seit, §16a), geliefert von GET /agent/vertrieb/bestand
// (je Mandat: Karte + Raten-Stand + SEPA + Monatsrate).
//
//   · Kopf, grafisch: Mandate x/500 mit Fortschrittsbogen (SVG-Ring) ·
//     „Dein Bestand zahlt dir X €/Monat“ (Σ Monatsraten × Provisionssatz aus
//     GET /agent/provision-satz) · Ratengesundheit als segmentierter Balken
//     (pünktlich grün · offen blau · überfällig rot) · SEPA-Quote.
//   · Kundenkarten im Raster: Name, Gesundheits-Ampel (läuft · Rate offen ·
//     überfällig seit X Tagen · kein SEPA), Monatsrate, nächster Termin bzw.
//     „lange kein Kontakt“ (> 14 Tage, gelb), Schnell-Aktionen Anrufen
//     (fiaon-anrufen) · Akte (?person= → DIESELBE Akte-Lade aus pipeline.tsx,
//     importiert, kein Duplikat) · Senden (SendeMenue ton="dunkel").
//   · Filter-Chips (Alle · Überfällig · Kein SEPA · Termin fällig · > 14 Tage
//     kein Kontakt), Suche, Sortierung (Gesundheit · Mandat seit · Rate).
//   · Ansicht „Strom“: der 3D-Kundenstrom aus pipeline.tsx (importiert) als
//     optionale zweite Ansicht über dieselbe Mandatsliste.
//   · Leerzustand motivierend mit Link in die Pipeline. Handytauglich.
// Wording: FIAON berät nicht — „begleitet“, „zeigt“, „sortiert“.
// ═══════════════════════════════════════════════════════════════════════════
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Phone, FileText, Search, Send, RefreshCw, X, Landmark } from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { ToastAnbieter, eur } from "@/lib/fiaon-ui";
import { Akte, Strom, type Kunde } from "./pipeline";
import "@/styles/office-pipeline.css";
import "@/styles/office-bestand.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

const MAX_MANDATE = 500;

interface Mandat {
  kunde: Kunde;
  raten: { bezahlt: number; offen: number; ueberfaellig: number; ueberfaelligSeitTagen: number | null; ruecklastschrift: boolean };
  sepaAktiv: boolean;
  monatsrateCents: number | null;
}

type Gesund = "ueberfaellig" | "kein_sepa" | "offen" | "laeuft";
// 24.08.2026: Die Rangfolge wurde nur noch von totem Code hinter einem return
// gelesen (Sortierung „Gesundheit", die es als Auswahl nicht mehr gibt). Sie
// bleibt als Dokumentation der Priorität stehen, die `gesundVon` abbildet.
// (Kein eslint-disable nötig: `void GESUND_RANG` unten markiert die Nutzung.
//  Die Regel @typescript-eslint/no-unused-vars ist in diesem Projekt gar nicht
//  eingerichtet — ein Stilllegen dafür ist selbst ein Fehler.)
const GESUND_RANG: Record<Gesund, number> = { ueberfaellig: 0, kein_sepa: 1, offen: 2, laeuft: 3 };
void GESUND_RANG;

/** Die EINE Ampel je Mandat — Priorität: überfällig → kein SEPA → offen → läuft. */
function gesundVon(m: Mandat): { art: Gesund; label: string; farbe: string } {
  if (m.raten.ueberfaellig > 0) {
    const t = m.raten.ueberfaelligSeitTagen;
    return {
      art: "ueberfaellig",
      label: m.raten.ruecklastschrift ? "Rücklastschrift" : `überfällig${t != null && t > 0 ? ` seit ${t} ${t === 1 ? "Tag" : "Tagen"}` : ""}`,
      farbe: "#f87171",
    };
  }
  if (!m.sepaAktiv) return { art: "kein_sepa", label: "kein SEPA", farbe: "#fbbf24" };
  if (m.raten.offen > 0) return { art: "offen", label: "Rate offen", farbe: "#60a5fa" };
  return { art: "laeuft", label: "läuft", farbe: "#34d399" };
}

function kontaktTage(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function dtag(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function terminText(beginn: string): string {
  const d = new Date(beginn);
  const inBerlin = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const uhr = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const tag = inBerlin(d);
  if (tag === inBerlin(new Date())) return `Heute ${uhr}`;
  if (tag === inBerlin(new Date(Date.now() + 86_400_000))) return `Morgen ${uhr}`;
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" }) + ` ${uhr}`;
}
const anrufen = (nummer: string | null | undefined, personId: number, name: string) => {
  if (!nummer) return;
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } }));
};
// 24.08.2026 (Justin: „warum steht da 1 von 2 Raten bezahlt — der Kunde
// bezahlt ja 12 Monate?"): VORHER zählte die Anzeige die ANGELEGTEN
// Ratenzeilen. Die entstehen aber fortlaufend, immer nur die nächste fällige
// (server/lib/fiaon-abo-pflicht.ts) — bei einem Kunden im zweiten Monat gibt
// es also genau zwei Zeilen, und die Karte behauptete „von 2". GEMESSEN am
// 24.08.2026: 239 von 379 Bestellungen haben zwei Zeilen, keine einzige hat
// zwölf. NACHHER steht die LAUFZEIT des Vertrags im Nenner — dieselbe Zahl,
// mit der überall der Vertragswert gerechnet wird (Preis × 12).
const VERTRAGSRATEN = 12;
const euro0 = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// 24.08.2026 (Justin): VORHER fünf Filter, darunter „Kein SEPA" und
// „> 14 Tage kein Kontakt" — NACHHER nur noch drei, und die müssen ALLE
// tun, was draufsteht. Der SEPA-Zustand wandert auf die Kundenkarte, wo er
// mit einem Klick änderbar ist statt nur gezählt zu werden.
const FILTER: { key: string; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "termin_faellig", label: "Termin fällig" },
  // NEU 24.08.2026 (Justin): „es MUSS vermerkt werden, wenn alle Bedingungen
  // bei einem Kunden erfüllt sind, muss es der Mitarbeiter ja auch sehen!"
  // Ein eigener Filter, damit man die wenigen Bereiten nicht in 500 Karten
  // suchen muss.
  { key: "karte", label: "Bereit für Konto & Karte" },
  // P17 (Team-Feedback 28.08.): Der Bestand nach Bearbeitungsstand — damit
  // aus der Liste direkt eine Anrufliste wird, ohne jeden Kunden zu öffnen.
  { key: "bezahlt_onb_offen", label: "Bezahlt · Startgespräch offen" },
  { key: "bezahlt_onb_da", label: "Bezahlt · Startgespräch erledigt" },
  { key: "nicht_bezahlt", label: "Nicht bezahlt" },
  { key: "giro_beantragt", label: "Girokonto beantragt" },
  { key: "giro_moeglich", label: "Girokonto möglich, nicht beantragt" },
];
// „Gesundheit" ist als Sortierung entfallen (Justin) — sie sortierte nach
// einer Ampel, die es in dieser Form nicht mehr gibt.
const SORT: { key: string; label: string }[] = [
  { key: "mandat", label: "Mandat seit" },
  { key: "rate", label: "Nach Rate" },
];

export default function AgentBestandPage() {
  return <AgentShell><ToastAnbieter ton="dunkel"><BestandInnen /></ToastAnbieter></AgentShell>;
}

function BestandInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Portfolio"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [mandate, setMandate] = useState<Mandat[]>([]);
  // P7 (01.09.2026): zugewiesene Kunden OHNE Mandat, mit denen schon
  // gearbeitet wurde — sichtbar, damit ein Rückruf immer zuordenbar ist.
  const [inArbeit, setInArbeit] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [satz, setSatz] = useState(0.25);
  const [filter, setFilter] = useState("alle");
  // 24.08.2026: VORHER stand der Anfangswert auf „gesundheit" — eine Option,
  // die es in SORT gar nicht mehr gibt. Das Auswahlfeld zeigte deshalb beim
  // Öffnen „Mandat seit" an, obwohl der Zustand etwas anderes hieß: Anzeige
  // und Wirklichkeit auseinander. NACHHER steht dort der Wert, nach dem auch
  // wirklich sortiert wird.
  const [sort, setSort] = useState("mandat");
  const [suche, setSuche] = useState("");
  const [ansicht, setAnsicht] = useState<"karten" | "strom">("karten");
  const [aktiv, setAktiv] = useState(0);
  const [offen, setOffen] = useState<number | null>(null);
  const [fremd, setFremd] = useState<Kunde | null>(null);
  const [sendeAn, setSendeAn] = useState<number | null>(null);
  // 24.08.2026: Läuft gerade eine SEPA-Anfrage? (Person-ID, sonst null)
  const [sepaLaeuft, setSepaLaeuft] = useState<number | null>(null);
  const [sepaMeldung, setSepaMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const handy = useMedia("(max-width: 700px)");
  const ruhig = useMedia("(prefers-reduced-motion: reduce)");

  /** Bittet den Kunden per Mail, die Lastschrift für die Folgeraten
   *  einzurichten. Kein Automatiklauf — immer ein bewusster Klick. */
  const sepaBitten = async (personId: number, name: string) => {
    setSepaLaeuft(personId); setSepaMeldung(null);
    const r = await api(`/agent/versand/${personId}/sepa_einrichten`, { method: "POST", body: JSON.stringify({}) });
    setSepaLaeuft(null);
    setSepaMeldung(r.ok
      ? { art: "gut", text: `${name} hat die Bitte bekommen, die Lastschrift im Kundenbereich einzurichten.` }
      : { art: "schlecht", text: r.json?.error || "Die Anfrage konnte nicht gesendet werden." });
  };

  const laden = useCallback(async (leise = false) => {
    if (!leise) setLaedt(true);
    const r = await api("/agent/vertrieb/bestand");
    if (r.ok) { setMandate(r.json.mandate || []); setInArbeit(r.json.inArbeit || []); setFehler(null); }
    else setFehler(r.json?.error || "Das Portfolio konnte nicht geladen werden.");
    setLaedt(false);
  }, []);
  useEffect(() => {
    void laden();
    api("/agent/provision-satz").then((r) => { if (r.ok && r.json?.satz) setSatz(Number(r.json.satz)); }).catch(() => {});
    const p = new URLSearchParams(window.location.search);
    const person = p.get("person");
    if (person && Number(person) > 0) setOffen(Number(person));
  }, [laden]);
  // Ergebnisse aus dem Softphone o. Ä. füllen still nach — kein Neuladen.
  useEffect(() => {
    const h = () => void laden(true);
    window.addEventListener("fiaon-ergebnis", h);
    return () => window.removeEventListener("fiaon-ergebnis", h);
  }, [laden]);

  // ── Kopf-Zahlen ─────────────────────────────────────────────────────────
  const kopf = useMemo(() => {
    const rate = mandate.reduce((s, m) => s + (m.monatsrateCents ?? 0), 0);
    const bez = mandate.reduce((s, m) => s + m.raten.bezahlt, 0);
    const off = mandate.reduce((s, m) => s + m.raten.offen, 0);
    const ueb = mandate.reduce((s, m) => s + m.raten.ueberfaellig, 0);
    const sepa = mandate.filter((m) => m.sepaAktiv).length;
    // ── 24.08.2026: NICHT JEDE ZAHL IN DIESER SUMME IST EINE MONATSRATE ────
    // Der Server (GET /agent/vertrieb/bestand) nimmt als `monatsrateCents` den
    // echten Ratenbetrag — und wenn zu einem Mandat noch KEINE Rate angelegt
    // ist, ersatzweise den offenen Bestellbetrag (amount_due), also den
    // Paketpreis. GEMESSEN am 24.08.2026: bei Nikita Boychenko (Konto 13) 27
    // von 125 Mandaten ohne eine einzige Rate, bei Justins Testkonto 2 von 4.
    // Die Zahl bleibt der beste bekannte Wert — aber der Satz darunter darf
    // nicht behaupten, es seien lauter Monatsraten.
    const ohneRate = mandate.filter((m) => (m.raten.bezahlt + m.raten.offen + m.raten.ueberfaellig) === 0).length;
    return {
      monatlichCents: Math.round(rate * satz),
      bez, off, ueb, ratenGesamt: bez + off + ueb, ohneRate,
      sepaQuote: mandate.length ? Math.round((sepa / mandate.length) * 100) : 0,
    };
  }, [mandate, satz]);

  // ── Wer ist bereit für Konto & Karte? ────────────────────────────────────
  // Als MENGE geladen, nicht je Karte einzeln: Der Bestand zeigt bis zu 500
  // Kunden, und 500 Einzelabfragen wären eine halbe Sekunde Wartezeit für
  // einen Hinweis. Der Server rechnet alle drei Bedingungen in einer Abfrage.
  const [kartenBereit, setKartenBereit] = useState<Set<number>>(new Set());
  useEffect(() => {
    let an = true;
    api("/agent/karte/bereit/liste").then((r) => {
      if (an && r.ok) setKartenBereit(new Set((r.json.kunden || []).map((k: any) => Number(k.personId))));
    });
    return () => { an = false; };
  }, []);

  // ── Filter, Suche, Sortierung ───────────────────────────────────────────
  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const f = mandate.filter((m) => {
      const g = gesundVon(m);
      if (filter === "ueberfaellig" && g.art !== "ueberfaellig") return false;

      // „Termin fällig“ = es steht KEIN kommender Termin — einer gehört gebucht.
      // 24.08.2026: VORHER blendete „Termin fällig" alle Kunden aus, die einen
      // Termin HABEN — es zeigte also das Gegenteil seines Namens. NACHHER
      // heißt fällig, was fällig heißt: Ein gebuchter Termin, dessen Zeitpunkt
      // heute erreicht oder schon vorbei ist.
      // 24.08.2026, zweiter Anlauf: VORHER prüfte der Filter `terminAm` — das
      // Feld liefert aber NUR Termine in der Zukunft (t.beginn > NOW()), ein
      // fälliger Termin liegt per Definition dahinter. Der Filter konnte also
      // nie etwas finden. NACHHER liest er `terminFaelligAm` (erreicht oder
      // überschritten, noch nicht erledigt) UND lässt zusätzlich Termine gelten,
      // die heute noch anstehen — beides ist „heute dran".
      if (filter === "termin_faellig") {
        const faellig = m.kunde.terminFaelligAm ? new Date(m.kunde.terminFaelligAm).getTime() : null;
        const kommt = m.kunde.terminAm ? new Date(m.kunde.terminAm).getTime() : null;
        const tagesende = new Date(); tagesende.setHours(23, 59, 59, 999);
        const heuteNoch = kommt != null && kommt <= tagesende.getTime();
        if (faellig == null && !heuteNoch) return false;
      }
      if (filter === "karte" && !kartenBereit.has(Number(m.kunde.personId))) return false;
      // P17: Bearbeitungsstand-Filter — die Felder kommen vom Server.
      if (filter === "bezahlt_onb_offen" && !((m as any).bezahlt && !(m as any).onboardingErledigt)) return false;
      if (filter === "bezahlt_onb_da" && !((m as any).bezahlt && (m as any).onboardingErledigt)) return false;
      if (filter === "nicht_bezahlt" && (m as any).bezahlt) return false;
      if (filter === "giro_beantragt" && !(m.kunde as any).karte?.status) return false;
      if (filter === "giro_moeglich" && !(kartenBereit.has(Number(m.kunde.personId)) && !(m.kunde as any).karte?.status)) return false;
      if (q && !(`${m.kunde.name} ${m.kunde.email ?? ""} ${m.kunde.telefon ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
    return [...f].sort((a, b) => {
      if (sort === "rate") return (b.monatsrateCents ?? 0) - (a.monatsrateCents ?? 0);
      if (sort === "mandat") return new Date(b.kunde.mandatSeit ?? 0).getTime() - new Date(a.kunde.mandatSeit ?? 0).getTime();
      // Ohne Wahl: das jüngste Mandat zuerst.
      // 24.08.2026: Darunter standen noch drei Zeilen Sortierung nach der
      // alten Gesundheits-Ampel — hinter einem return, also toter Code, der
      // beim Lesen so aussah, als tue er etwas. Entfernt.
      return new Date(b.kunde.mandatSeit ?? 0).getTime() - new Date(a.kunde.mandatSeit ?? 0).getTime();
    });
    // `kartenBereit` gehört in die Abhängigkeiten: Die Menge kommt erst nach
    // dem ersten Aufbau vom Server. Ohne sie bliebe der Filter „Bereit für
    // Konto & Karte" beim ersten Klick leer, bis irgendetwas anderes die
    // Liste neu rechnet.
  }, [mandate, filter, suche, sort, kartenBereit]);
  useEffect(() => { if (aktiv > sichtbar.length - 1) setAktiv(Math.max(0, sichtbar.length - 1)); }, [sichtbar.length, aktiv]);

  // ── Akte (?person=) — DIESELBE Lade wie in der Pipeline ─────────────────
  const oeffnen = (id: number | null) => {
    setOffen(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("person", String(id)); else u.searchParams.delete("person");
    window.history.replaceState(null, "", u.toString());
  };
  useEffect(() => {
    const r = document.getElementById("root");
    if (r) r.style.overflow = offen ? "hidden" : "";
    document.body.style.overflow = offen ? "hidden" : "";
    return () => { if (r) r.style.overflow = ""; document.body.style.overflow = ""; };
  }, [offen]);

  // ── AUS DEM TELEFON IN DIE AKTE (24.08.2026) ─────────────────────────────
  // Justin: „Je nachdem, was man klickt, kommt man in die Akte."
  // Das Softphone meldet nach dem Dokumentieren, welchen Menschen es weiter
  // bearbeitet sehen will. Bewusst über ein Ereignis und NICHT über einen
  // Seitenwechsel: Ein voller Wechsel würde die Twilio-Verbindung abbauen —
  // und damit auch den nächsten Anruf.
  useEffect(() => {
    const auf = (e: Event) => {
      const id = Number((e as CustomEvent).detail?.personId);
      if (Number.isFinite(id) && id > 0) oeffnen(id);
    };
    window.addEventListener("fiaon-akte-oeffnen", auf as EventListener);
    return () => window.removeEventListener("fiaon-akte-oeffnen", auf as EventListener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!offen || laedt) { setFremd(null); return; }
    if (mandate.some((m) => m.kunde.personId === offen)) { setFremd(null); return; }
    let an = true;
    api(`/agent/crm/kunden/${offen}`).then((r) => { if (an) setFremd(r.ok && r.json?.kunde ? r.json.kunde : null); });
    return () => { an = false; };
  }, [offen, laedt, mandate]);
  const geoeffnet = useMemo(
    () => mandate.find((m) => m.kunde.personId === offen)?.kunde || fremd || null,
    [mandate, offen, fremd],
  );
  const ersetzen = (k: Kunde) => {
    setMandate((l) => l.map((m) => (m.kunde.personId === k.personId ? { ...m, kunde: { ...m.kunde, ...k } } : m)));
    setFremd((f) => (f && f.personId === k.personId ? k : f));
  };

  const anzahl = mandate.length;
  const bogen = Math.min(1, anzahl / MAX_MANDATE);
  const umfang = 2 * Math.PI * 52;

  return (
    <div className="be">
      {/* ── Kopf: das Portfolio in vier Zahlen ── */}
      <section className="be-kopf">
        <div className="be-ring-karte">
          <svg viewBox="0 0 120 120" className="be-ring" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#beVerlauf)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${umfang * bogen} ${umfang}`} transform="rotate(-90 60 60)" />
            <defs><linearGradient id="beVerlauf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#93c5fd" /><stop offset="1" stopColor="#2563eb" />
            </linearGradient></defs>
          </svg>
          <div className="be-ring-zahl">
            <b>{laedt ? "–" : anzahl}</b>
            <em>/ {MAX_MANDATE}</em>
            <small>Mandate</small>
          </div>
        </div>
        <div className="be-kopf-zahlen">
          <div className="be-zahl hervor">
            <small>Dein Bestand zahlt dir</small>
            <b>{laedt ? "–" : euro0(kopf.monatlichCents)}<em> / Monat</em></b>
            <span>Summe der Monatsraten × {Math.round(satz * 100)} % Provision je bankbestätigter Rate{kopf.ohneRate > 0 ? ` · bei ${kopf.ohneRate} ${kopf.ohneRate === 1 ? "Mandat" : "Mandaten"} steht noch keine Rate — dort ist der Bestellbetrag gerechnet` : ""}</span>
          </div>
          {/* 24.08.2026 (Justin): Die Kacheln „Ratengesundheit" (pünktlich /
              offen / überfällig) und „SEPA-Quote" sind entfallen. Beides waren
              Zahlen zum Anschauen; was fehlt, steht jetzt dort, wo man es
              ändern kann — auf der Kundenkarte. */}
        </div>
      </section>

      {fehler && <p className="pi-fehler">{fehler}</p>}
      {sepaMeldung && (
        <p className={`pi-meldung ${sepaMeldung.art === "gut" ? "gut" : "schlecht"}`}>
          {sepaMeldung.text}
          <button type="button" className="pi-link" style={{ marginLeft: 8 }} onClick={() => setSepaMeldung(null)}>ausblenden</button>
        </p>
      )}

      {/* ── Filter, Suche, Sortierung, Ansicht ── */}
      <section className="be-leiste">
        <span className="be-chips">
          {FILTER.map((f) => (
            <button key={f.key} type="button" className={`pi-legende-chip${filter === f.key ? " an" : ""}`}
                    onClick={() => setFilter(filter === f.key ? "alle" : f.key)}>{f.label}</button>
          ))}
        </span>
        <label className="pi-suche be-suche">
          <Search size={15} strokeWidth={1.75} />
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Nummer" />
          {suche && <button type="button" className="pi-link" onClick={() => setSuche("")} aria-label="Suche leeren"><X size={14} /></button>}
        </label>
        <label className="pi-feld">Sortierung
          <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORT.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </label>
        <label className="pi-feld">Ansicht
          <select value={ansicht} onChange={(e) => setAnsicht(e.target.value as "karten" | "strom")}>
            <option value="karten">Karten</option><option value="strom">Strom</option>
          </select>
        </label>
        <button type="button" className="pi-knopf still klein" onClick={() => void laden()} title="Neu laden"><RefreshCw size={14} strokeWidth={1.75} /></button>
      </section>

      {/* ── Inhalt ── */}
      {laedt ? (
        <div className="pi-laedt">Lade dein Portfolio …</div>
      ) : anzahl === 0 ? (
        <div className="pi-fokus-karte">
          <span className="pi-pille">Portfolio</span>
          <h1>Dein Bestand entsteht mit deinem ersten Mandat.</h1>
          <p className="pi-fokus-warum">Jedes angenommene Mandat zahlt 12 Raten — und {Math.round(satz * 100)} % jeder bankbestätigten Rate gehören dir. Hol dir das erste in der Pipeline.</p>
          <div><Link href="/agent/pipeline" className="pi-knopf gross">Zur Pipeline</Link></div>
        </div>
      ) : sichtbar.length === 0 ? (
        <div className="pi-laedt">Kein Mandat passt zu diesem Filter — setz ihn auf „Alle“ zurück.</div>
      ) : ansicht === "strom" ? (
        <Strom liste={sichtbar.map((m) => m.kunde)} aktiv={aktiv} setAktiv={setAktiv} erledigt={new Set()}
               onAkte={(id) => oeffnen(id)} flach={handy || ruhig} ruhig={ruhig} laedt={false} />
      ) : (
        <section className="be-raster">
          {sichtbar.map((m) => {
            const g = gesundVon(m);
            const t = kontaktTage(m.kunde.letzterKontakt);
            const stille = t != null && t > 14;
            return (
              <article key={m.kunde.personId} className="be-karte" style={{ ["--hitze" as string]: g.farbe }}>
                <button type="button" className="be-karte-kern" onClick={() => oeffnen(m.kunde.personId)} title="Akte öffnen">
                  <span className="be-karte-kopf">
                    <i className="pi-glut" />
                    <small style={{ color: g.farbe }}>{g.label}</small>
                    {m.kunde.mandatSeit && <em>Mandat seit {dtag(m.kunde.mandatSeit)}</em>}
                  </span>
                  <b>{m.kunde.name}</b>
                  <span className="be-karte-zeile">
                    {m.monatsrateCents ? `${eur(m.monatsrateCents)} / Monat` : "Rate folgt mit der Aktivierung"}
                    {" · "}{m.raten.bezahlt} von {VERTRAGSRATEN} Raten bezahlt
                  </span>
                  <span className={`be-karte-fuss${stille && !m.kunde.terminAm ? " warn" : ""}`}>
                    {m.kunde.terminAm ? `Termin ${terminText(m.kunde.terminAm)}`
                      : stille ? `lange kein Kontakt — ${t} Tage`
                      : t != null ? `letzter Kontakt vor ${t === 0 ? "heute" : `${t} ${t === 1 ? "Tag" : "Tagen"}`}`
                      : "noch kein Kontakt"}
                  </span>
                </button>
                {/* 24.08.2026 (Justin): „Es MUSS vermerkt werden — wenn alle
                    Bedingungen bei einem Kunden erfüllt sind, muss es der
                    Mitarbeiter ja auch sehen!" Der Hinweis führt in die Akte,
                    nicht direkt zum Versand: Vor dem Link steht ein Anruf, in
                    dem der Ablauf erklärt wird. Wer den Weg wortlos zuschickt,
                    bekommt einen Kunden, der beim Video-Ident abbricht. */}
                {kartenBereit.has(Number(m.kunde.personId)) && (
                  <button type="button" className="be-karte-bereit" onClick={() => oeffnen(m.kunde.personId)}>
                    <b>Bereit für Konto &amp; Karte</b>
                    <span>Alle drei Bedingungen erfüllt – anrufen und den Weg zum Girokonto erklären.</span>
                  </button>
                )}
                {/* 24.08.2026 (Justin): VORHER war „kein SEPA" nur eine Ampel-
                    Beschriftung — ein Zustand ohne Weg. NACHHER steht auf der
                    Karte, was zu tun ist, und ein Klick schickt dem Kunden die
                    Bitte, die Lastschrift im Kundenbereich einzurichten. */}
                {!m.sepaAktiv && (
                  <button type="button" className="be-sepa" disabled={sepaLaeuft === m.kunde.personId}
                          onClick={() => void sepaBitten(m.kunde.personId, m.kunde.name)}
                          title="Schickt dem Kunden die Bitte, die Lastschrift für die Folgeraten einzurichten.">
                    <Landmark size={13} strokeWidth={1.75} />
                    {sepaLaeuft === m.kunde.personId ? "Sende …" : "Lastschrift nicht eingerichtet — jetzt anfragen"}
                  </button>
                )}
                <span className="be-karte-tun">
                  <button type="button" className="pi-knopf klein" disabled={!m.kunde.telefonWaehlbar}
                          onClick={() => anrufen(m.kunde.telefonWaehlbar, m.kunde.personId, m.kunde.name)}
                          title={m.kunde.telefonWaehlbar ?? "nicht anrufbar"}><Phone size={13} strokeWidth={1.75} /></button>
                  <button type="button" className="pi-knopf still klein" onClick={() => oeffnen(m.kunde.personId)} title="Akte"><FileText size={13} strokeWidth={1.75} /></button>
                  <button type="button" className="pi-knopf still klein" onClick={() => setSendeAn(m.kunde.personId)} title="E-Mail senden"><Send size={13} strokeWidth={1.75} /></button>
                </span>
              </article>
            );
          })}
        </section>
      )}
      {!laedt && anzahl > 0 && (
        <p className="pi-fussnote">Gearbeitet wird in der <Link href="/agent/pipeline">Pipeline</Link> — hier begleitest du deine Mandate: Raten im Blick, Termine gesetzt, Kontakt gehalten.</p>
      )}

      {/* ── „IN BETREUUNG — NOCH KEIN MANDAT" (P7, 01.09.2026) ─────────────
          Angenommene Kunden verschwinden nach „Nicht erreicht" bewusst aus der
          Arbeitsliste (Wiedervorlage) — aber sie dürfen nicht UNSICHTBAR sein.
          Hier bleibt jeder auffindbar, auch die Ruhenden; die Akte öffnet über
          denselben Weg wie bei den Mandaten. */}
      {!laedt && inArbeit.length > 0 && (
        <>
          <div style={{ marginTop: 28, marginBottom: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <b style={{ font: "500 15px/1.2 'Inter', sans-serif" }}>In Betreuung — noch kein Mandat ({inArbeit.length})</b>
            <small style={{ opacity: 0.65 }}>Angenommen und dran — „Nicht erreicht" nimmt sie nur aus der Tagesliste, nicht aus deinem Bestand.</small>
          </div>
          <section className="be-raster">
            {inArbeit.map((e: any) => {
              const wv = e.wiedervorlage ? new Date(e.wiedervorlage) : null;
              const le = e.letzterEintrag ? new Date(e.letzterEintrag) : null;
              return (
                <article key={e.kunde.personId} className="be-karte" style={{ ["--hitze" as string]: "var(--fi-text-still)" }}>
                  <button type="button" className="be-karte-kern" onClick={() => oeffnen(e.kunde.personId)} title="Akte öffnen">
                    <span className="be-karte-kopf"><small>in Betreuung</small></span>
                    <b>{e.kunde.name}</b>
                    <span className="be-karte-zeile">
                      {le ? `letzter Eintrag ${le.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}` : "noch kein Eintrag"}
                      {wv ? ` · Wiedervorlage ${wv.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}` : ""}
                    </span>
                  </button>
                  <span className="be-karte-tun">
                    <button type="button" className="pi-knopf klein" disabled={!e.kunde.telefonWaehlbar}
                            onClick={() => anrufen(e.kunde.telefonWaehlbar, e.kunde.personId, e.kunde.name)}
                            title={e.kunde.telefonWaehlbar ?? "nicht anrufbar"}><Phone size={13} strokeWidth={1.75} /></button>
                    <button type="button" className="pi-knopf still klein" onClick={() => oeffnen(e.kunde.personId)} title="Akte"><FileText size={13} strokeWidth={1.75} /></button>
                  </span>
                </article>
              );
            })}
          </section>
        </>
      )}

      {/* ── Senden: dieselbe Komponente wie in der Akte, dunkle Fassung ── */}
      {sendeAn != null && <SendeSchnell personId={sendeAn} onZu={() => setSendeAn(null)} onGesendet={() => void laden(true)} />}

      {/* ── Akte: importiert aus pipeline.tsx — EINE Lade, kein Duplikat.
          Portal an body: sonst malt der Office-Kopf über den Akte-Kopf. ── */}
      {offen && createPortal(
        <>
          <div className="pi-lade-hintergrund" onClick={() => oeffnen(null)} aria-hidden="true" />
          {geoeffnet ? (
            <Akte key={geoeffnet.personId} k={geoeffnet} onZu={() => oeffnen(null)}
                  onWeg={() => { setMandate((l) => l.filter((m) => m.kunde.personId !== geoeffnet.personId)); oeffnen(null); void laden(true); }}
                  onNeu={ersetzen}
                  onErledigt={() => {}}
                  onZaehler={() => void laden(true)} />
          ) : (
            <aside className="pi-lade" role="dialog" aria-modal="true">
              <div className="pi-lade-fest"><div className="pi-lade-kopf"><span /><h2>{laedt ? "Lade …" : "Akte nicht gefunden"}</h2>
                <button type="button" className="pi-lade-zu" onClick={() => oeffnen(null)} aria-label="Schließen"><X size={18} /></button></div></div>
              {!laedt && <div className="pi-lade-koerper"><p className="pi-fussnote">Dieser Kunde gehört nicht zu deinem Bestand oder die Kennung stimmt nicht.</p></div>}
            </aside>
          )}
        </>, document.body)
      }
      {/* 24.08.2026 (Justin): Jeder Raum erklaert sich beim ersten
          Betreten selbst — danach jederzeit ueber den Knopf unten links. */}
      <Rundgang raum="bestand" titel={RUNDGAENGE.bestand.titel} schritte={RUNDGAENGE.bestand.schritte} />
    </div>
  );
}

/** Kleiner Media-Haken — wie in pipeline.tsx, bewusst lokal (drei Zeilen). */
function useMedia(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, [q]);
  return m;
}

/** Senden-Schnellzugriff einer Kundenkarte — lazy geladen, dunkle Fassung. */
function SendeSchnell({ personId, onZu, onGesendet }: { personId: number; onZu: () => void; onGesendet: () => void }) {
  const [Menue, setMenue] = useState<null | typeof import("@/components/SendeMenue").SendeMenue>(null);
  useEffect(() => {
    let an = true;
    import("@/components/SendeMenue").then((m) => { if (an) setMenue(() => m.SendeMenue); });
    return () => { an = false; };
  }, []);
  if (!Menue) return null;
  return <Menue personId={personId} offen onSchliessen={onZu} onGesendet={onGesendet} ton="dunkel" />;
}
