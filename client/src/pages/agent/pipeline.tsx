// ═══════════════════════════════════════════════════════════════════════════
// /agent/pipeline — Raum 2: Die Pipeline (23.08.2026, Plan §4/§11)
//
// Neubau der Arbeitsliste aus kunden-neu.tsx auf der dunklen Office-Bühne:
//   · Überblick nach Stufen A (Zahlung gemeldet) · B (Antrag fertig) · C (Lead)
//     · ✓ (bezahlt) mit großen Zahlen — dieselben Zähler wie bisher
//     (/agent/kunden/liste → vorrat, zaehler).
//   · Suche, Filter (Stufe, Land, letzter Kontakt, Rückruf fällig) und die
//     bisherigen Server-Ansichten als Chips.
//   · Kundenkarten: Name, Paket, Stufe, letzter Kontakt, nächster Schritt,
//     Anrufen / Akte / Notiz.
//   · Die AKTE als seitliche Glas-Lade (?person=ID) — alle Aktionen der alten
//     Seite, dieselben Endpunkte (Ergebnis, Notiz, Zahlungsdaten, Beleg,
//     Produkt, Buchungen wegräumen, Stammdaten, E-Mails/Versand, SCHUFA- und
//     Paketbuchungen, Zustimmungs-Link, Nummer-Land, Testeintrag).
// Reihenfolge der Liste kommt weiter vom Server (fiaon-agent-start.ts) und
// bleibt stehen, bis der Mitarbeiter bewusst neu ordnet.
// Die bisherige Seite bleibt als /agent/kunden-alt erreichbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, Search, X, Plus, Copy, Send, Mail, FileText, StickyNote, RefreshCw, Check, ExternalLink } from "lucide-react";
import { AgentShell, api, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import { ToastAnbieter, useToast, eur } from "@/lib/fiaon-ui";
import { STUFEN, statusAusTierGrund, type Stufe } from "@shared/fiaon-kundenstatus";
import { ERGEBNIS_TEXT } from "@shared/fiaon-kontakt-ergebnis-liste";
import { ProduktDialog } from "@/components/agent/ProduktDialog";
import { KundeAnlegen } from "@/components/agent/KundeAnlegen";
import { SendeMenue } from "@/components/SendeMenue";
import { Gespraechsblatt } from "@/components/Gespraechsblatt";
import { RechnungBestaetigung } from "@/components/agent/RechnungBestaetigung";
import { ErgebnisWahl, type ErgebnisAusgang } from "@/components/agent/ErgebnisWahl";
import "@/styles/office-pipeline.css";

// ── Der Kunde, wie ihn /agent/kunden/liste und /agent/crm/kunden/:id liefern ──
interface Kunde {
  karte?: { status: string | null; text: string | null; am: string | null } | null;
  personId: number;
  name: string;
  termin?: { beginn: string; status: string | null; dauerMin: number | null; erledigt: boolean; art: string } | null;
  telefon: string | null;
  telefonWaehlbar: string | null;
  telefonHinweis: string | null;
  nummerOhneLand?: boolean;
  sendeGrund?: string | null;
  fehlendeFelder?: string | null;
  zustimmungFehlt?: string | null;
  sendeMoeglich?: boolean;
  sendeText?: string | null;
  sendeTat?: string | null;
  nummerRoh?: string | null;
  landVorschlag?: { land: string | null; grund: string };
  email: string | null;
  tier: number;
  tierGrund: string;
  titel: string;
  hinweis: string;
  produkt: string | null;
  buchungen?: {
    ref: string; art: "paket" | "bonitaet" | "sonstiges"; bezeichnung: string;
    betragCents: number | null; zahlungText: string; bezahlt: boolean; offen: boolean;
    gestelltAm: string | null; faelligAm: string | null;
    verwendungszweck: string | null; erledigt: boolean;
  }[];
  betrag: number | null;
  zusagedatum: string | null;
  wiedervorlage: string | null;
  rueckrufAm: string | null;
  nichtErreicht: number;
  rechnungVersandt: number;
  stufe: Stufe | null;
  ruhtSeit: string | null;
  terminlinkMailAm: string | null;
  terminAm: string | null;
  terminLink: string;
  gesperrt: boolean;
  betreutSeit: string | null;
  letzterKontakt: string | null;
  letztesErgebnis: string | null;
  stammdaten: { strasse: string | null; plz: string | null; ort: string | null; land: string | null; geburtsdatum: string | null } | null;
  zahlung: { referenz: string | null; status: string | null; ref: string | null; empfaenger?: string | null; iban?: string | null; bic?: string | null; klartext?: string | null } | null;
}

type Zaehler = Record<string, number>;

/** Die Server-Ansichten — unverändert aus der alten Seite (Schlüssel = Filter des Servers). */
const ANSICHTEN: { key: string; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "zusage_heute", label: "Zusage heute" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "rueckruf", label: "Rückruf" },
  { key: "tier1", label: "Zahlung gemeldet" },
  { key: "rechnung_stellen", label: "Rechnung stellen" },
  { key: "rechnung_offen", label: "Rechnung offen" },
  { key: "frist_abgelaufen", label: "Frist abgelaufen" },
  { key: "antrag_offen", label: "Antrag offen" },
  { key: "leads", label: "Leads" },
  { key: "nicht_erreicht", label: "Nicht erreicht" },
  { key: "ruhend", label: "Ruhend" },
  { key: "wartend", label: "Wartend (Kunde)" },
  { key: "bezahlt", label: "Bezahlt (Bestand)" },
  { key: "gesperrt", label: "Gesperrt" },
  { key: "nummer_ohne_land", label: "Nummer nicht wählbar" },
];
const SORT: { key: string; label: string }[] = [
  { key: "arbeit", label: "Arbeitsreihenfolge" },
  { key: "neu", label: "Zuletzt hinzugefügt" },
  { key: "betrag", label: "Nach Betrag" },
  { key: "name", label: "Nach Name" },
];
const LAND_NAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", IT: "Italien", RO: "Rumänien", SK: "Slowakei" };

// ── Helfer ────────────────────────────────────────────────────────────────
const anrufen = (nummer: string | null | undefined, personId: number, name: string) => {
  if (!nummer) return;
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } }));
};
function heuteIso(): string { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); }
function tagPlus(n: number): string { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function dtag(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function relativ(iso: string | null): { text: string; dringend: boolean } | null {
  if (!iso) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = Math.round((d.getTime() - heute.getTime()) / 86_400_000);
  if (t < 0) return { text: `seit ${Math.abs(t)} ${Math.abs(t) === 1 ? "Tag" : "Tagen"} überfällig`, dringend: true };
  if (t === 0) return { text: "heute", dringend: true };
  if (t === 1) return { text: "morgen", dringend: false };
  return { text: `in ${t} Tagen`, dringend: false };
}
function kontaktTage(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function wartezeit(iso: string | null): string {
  const t = kontaktTage(iso);
  if (t == null) return "noch kein Kontakt";
  if (t <= 0) return "heute kontaktiert";
  if (t === 1) return "gestern kontaktiert";
  return `seit ${t} Tagen kein Kontakt`;
}
function terminText(beginn: string): string {
  const d = new Date(beginn);
  const inBerlin = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const uhr = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const tag = inBerlin(d);
  if (tag === inBerlin(new Date())) return `Heute ${uhr}`;
  if (tag === inBerlin(new Date(Date.now() + 86_400_000))) return `Morgen ${uhr}`;
  if (tag === inBerlin(new Date(Date.now() - 86_400_000))) return `Gestern ${uhr}`;
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" }) + ` ${uhr}`;
}
function rueckrufFaellig(k: Kunde): boolean {
  if (k.rueckrufAm && new Date(k.rueckrufAm).getTime() <= Date.now()) return true;
  const z = relativ(k.zusagedatum);
  return !!z?.dringend;
}
async function inZwischenablage(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Rückfall */ }
  try {
    const feld = document.createElement("textarea");
    feld.value = text; feld.style.position = "fixed"; feld.style.opacity = "0";
    document.body.appendChild(feld); feld.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(feld);
    return ok;
  } catch { return false; }
}
const paketText = (k: Kunde): string => {
  const offen = (k.buchungen ?? []).filter((b) => !b.erledigt);
  if (offen.length) return offen.map((b) => `${b.bezeichnung}${b.betragCents != null ? ` ${eur(b.betragCents)}` : ""}${b.bezahlt ? " (bezahlt)" : ""}`).join(" · ");
  return k.produkt || "kein Paket";
};

export default function AgentPipelinePage() {
  return <AgentShell><ToastAnbieter><PipelineInnen /></ToastAnbieter></AgentShell>;
}

function PipelineInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Pipeline"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [liste, setListe] = useState<Kunde[]>([]);
  const [zaehler, setZaehler] = useState<Zaehler>({});
  const [vorrat, setVorrat] = useState<Record<string, number>>({});
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState("alle");
  const [sort, setSort] = useState("arbeit");
  const [suche, setSuche] = useState("");
  const [nurPerson, setNurPerson] = useState<number | null>(null);
  const [rolle, setRolle] = useState<string>("agent");
  const [naechsterTermin, setNaechsterTermin] = useState<string | null>(null);
  // Client-Filter auf der geladenen Liste
  const [stufe, setStufe] = useState<"alle" | "A" | "B" | "C">("alle");
  const [land, setLand] = useState("");
  const [kontakt, setKontakt] = useState<"alle" | "heute" | "3" | "7" | "nie">("alle");
  const [nurRueckruf, setNurRueckruf] = useState(false);
  const [anlageOffen, setAnlageOffen] = useState(false);
  // Die Akte
  const [offen, setOffen] = useState<number | null>(null);
  const [fremd, setFremd] = useState<Kunde | null>(null); // ?person=, der nicht in der Liste steht

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("filter");
    if (f && ANSICHTEN.some((x) => x.key === f)) setAnsicht(f);
    const person = p.get("person");
    if (person && Number(person) > 0) { setOffen(Number(person)); setNurPerson(Number(person)); }
  }, []);

  const laden = useCallback(async (leise = false, nurZaehler = false) => {
    if (!leise) setLaedt(true);
    const p = new URLSearchParams({ filter: ansicht, sort, limit: "500" });
    if (suche.trim()) p.set("q", suche.trim());
    if (nurPerson) p.set("person", String(nurPerson));
    const r = await api(`/agent/kunden/liste?${p.toString()}`);
    if (r.ok) {
      setFehler(null);
      if (!nurZaehler) { setListe(r.json.kunden); setErledigt(new Set()); }
      setZaehler({ ...(r.json.zaehler ?? {}), ...(r.json.zaehlerUeberschrieben ?? {}) });
      setVorrat(r.json.vorrat || {});
      setRolle(r.json.rolle ?? "agent");
      setNaechsterTermin(r.json.naechsterTermin ?? null);
    } else setFehler(r.json?.error || "Die Pipeline konnte nicht geladen werden.");
    setLaedt(false);
  }, [ansicht, sort, suche, nurPerson]);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.personId) setErledigt((v) => new Set(v).add(Number(d.personId)));
      void laden(true, true);
    };
    window.addEventListener("fiaon-ergebnis", h);
    return () => window.removeEventListener("fiaon-ergebnis", h);
  }, [laden]);
  useEffect(() => { const t = setTimeout(() => void laden(), suche ? 280 : 0); return () => clearTimeout(t); }, [laden, suche]);

  // ?person= → Akte öffnen; steht der Kunde nicht in der Liste, wird er einzeln geholt.
  useEffect(() => {
    if (!offen || laedt) { setFremd(null); return; }
    if (liste.some((k) => k.personId === offen)) { setFremd(null); return; }
    let aktiv = true;
    api(`/agent/crm/kunden/${offen}`).then((r) => { if (aktiv) setFremd(r.ok && r.json?.kunde ? r.json.kunde : null); });
    return () => { aktiv = false; };
  }, [offen, laedt, liste]);

  const oeffnen = (id: number | null) => {
    setOffen(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("person", String(id)); else u.searchParams.delete("person");
    window.history.replaceState(null, "", u.toString());
  };
  useEffect(() => {
    document.body.style.overflow = offen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [offen]);

  const entfernen = (personId: number) => {
    setListe((l) => l.filter((k) => k.personId !== personId));
    setErledigt((e) => { const n = new Set(e); n.delete(personId); return n; });
  };
  const ersetzen = (k: Kunde) => {
    setListe((l) => (l.some((x) => x.personId === k.personId) ? l.map((x) => (x.personId === k.personId ? k : x)) : l));
    setFremd((f) => (f && f.personId === k.personId ? k : f));
  };

  const laender = useMemo(() => Array.from(new Set(liste.map((k) => k.stammdaten?.land).filter(Boolean) as string[])).sort(), [liste]);
  const sichtbar = useMemo(() => liste.filter((k) => {
    if (stufe !== "alle" && k.stufe?.marke !== stufe) return false;
    if (land && k.stammdaten?.land !== land) return false;
    if (kontakt !== "alle") {
      const t = kontaktTage(k.letzterKontakt);
      if (kontakt === "nie" && t != null) return false;
      if (kontakt === "heute" && (t == null || t > 0)) return false;
      if (kontakt === "3" && (t == null || t < 3)) return false;
      if (kontakt === "7" && (t == null || t < 7)) return false;
    }
    if (nurRueckruf && !rueckrufFaellig(k)) return false;
    return true;
  }), [liste, stufe, land, kontakt, nurRueckruf]);

  const geoeffnet = useMemo(() => liste.find((k) => k.personId === offen) || fremd || null, [liste, offen, fremd]);
  const pflicht = (vorrat.A ?? 0) + (vorrat.B ?? 0);

  return (
    <div className="pi">
      <section className="pi-kopf">
        <div>
          <span className="pi-pille">Pipeline · {rolle === "onboarding" ? "Startgespräche" : "dein Bestand"}</span>
          <h1>
            {laedt ? <>Lade <span className="pi-verlauf">deine Kunden …</span></>
              : rolle === "onboarding" ? <><span className="pi-verlauf">{zaehler.alle ?? 0}</span> Startgespräche – heute zuerst.</>
              : pflicht > 0 ? <><span className="pi-verlauf">{pflicht}</span> in der Pflicht, dann die Leads.</>
              : (vorrat.C ?? 0) > 0 ? <>A und B sind leer – <span className="pi-verlauf">jetzt die Leads.</span></>
              : <>Nichts offen – <span className="pi-verlauf">Zeit für neue Kunden.</span></>}
          </h1>
          <p>Von oben nach unten. Die Reihenfolge steht und bleibt stehen, bis du neu ordnest. Ein Klick: anrufen, Akte oder Notiz.</p>
        </div>
        <div className="pi-kopf-knoepfe">
          <button type="button" className="pi-knopf" onClick={() => setAnlageOffen((v) => !v)}><Plus size={15} strokeWidth={1.75} /> Kunde anlegen</button>
          <button type="button" className="pi-knopf still" onClick={() => void laden()} title="Neu laden"><RefreshCw size={15} strokeWidth={1.75} /> Neu ordnen</button>
        </div>
      </section>

      {anlageOffen && (
        <div className="pi-hell">
          <KundeAnlegen offen={anlageOffen} aufKlappen={setAnlageOffen} fertig={() => { void laden(true); }} />
        </div>
      )}

      {fehler && <p className="pi-fehler">{fehler}</p>}

      <section className="pi-stufen">
        {([
          ["A", vorrat.A ?? 0, STUFEN.A.text, "heiß – hat „bezahlt“ gemeldet"],
          ["B", vorrat.B ?? 0, STUFEN.B.text, "Antrag fertig, Geld fehlt"],
          ["C", vorrat.C ?? 0, STUFEN.C.text, "erst, wenn A und B leer sind"],
        ] as [("A" | "B" | "C"), number, string, string][]).map(([m, n, t, u]) => (
          <button key={m} type="button" className={`pi-stufe-kachel${stufe === m && ansicht !== "bezahlt" ? " an" : ""}`}
                  onClick={() => { if (ansicht === "bezahlt") setAnsicht("alle"); setStufe(stufe === m ? "alle" : m); }}
                  style={{ opacity: n === 0 && stufe !== m ? .6 : 1 }}>
            <span className={`marke pi-marke-${m}`}>{m}</span>
            <b>{n}</b><span>{t}</span><small>{u}</small>
          </button>
        ))}
        <button type="button" className={`pi-stufe-kachel${ansicht === "bezahlt" ? " an" : ""}`}
                onClick={() => { setStufe("alle"); setAnsicht(ansicht === "bezahlt" ? "alle" : "bezahlt"); }}>
          <span className="marke pi-marke-OK"><Check size={16} strokeWidth={2.2} /></span>
          <b>{zaehler.bezahlt ?? 0}</b><span>Bezahlt · aktiv</span><small>kein Arbeitsvorrat, dein Bestand</small>
        </button>
      </section>

      <section className="pi-werkzeuge">
        <label className="pi-suche">
          <Search size={16} strokeWidth={1.75} />
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Nummer, Referenz" />
          {suche && <button type="button" className="pi-link" onClick={() => setSuche("")}>leeren</button>}
        </label>
        <div className="pi-filterzeile">
          <label className={`pi-feld${land ? " an" : ""}`}>Land
            <select value={land} onChange={(e) => setLand(e.target.value)}>
              <option value="">alle</option>
              {laender.map((l) => <option key={l} value={l}>{LAND_NAME[l] || l}</option>)}
            </select>
          </label>
          <label className={`pi-feld${kontakt !== "alle" ? " an" : ""}`}>Letzter Kontakt
            <select value={kontakt} onChange={(e) => setKontakt(e.target.value as typeof kontakt)}>
              <option value="alle">egal</option>
              <option value="heute">heute</option>
              <option value="3">3+ Tage her</option>
              <option value="7">7+ Tage her</option>
              <option value="nie">noch nie</option>
            </select>
          </label>
          <label className={`pi-feld pi-schalter${nurRueckruf ? " an" : ""}`}>
            <input type="checkbox" checked={nurRueckruf} onChange={(e) => setNurRueckruf(e.target.checked)} /> Rückruf / Zusage fällig
          </label>
          <label className="pi-feld">Sortierung
            <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORT.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
        </div>
        <div className="pi-chips">
          {ANSICHTEN.map((f) => {
            const n = zaehler[f.key] ?? 0;
            const an = ansicht === f.key;
            if (!an && n === 0 && f.key !== "alle") return null;
            return <button key={f.key} type="button" className={`pi-chip${an ? " an" : ""}`} onClick={() => setAnsicht(f.key)}>{f.label}<em>{n}</em></button>;
          })}
        </div>
      </section>

      {(zaehler.wartet ?? 0) > 0 && ansicht !== "nicht_erreicht" && (
        <button type="button" className="pi-hinweis" onClick={() => setAnsicht("nicht_erreicht")}>
          <span className="zahl">{zaehler.wartet}</span>
          <span><b>{zaehler.wartet === 1 ? "Einer wartet auf seinen Termin" : `${zaehler.wartet} warten auf ihren Termin`}</b>
            <small>Nicht erreicht – sie haben den Buchungslink und wählen selbst. Nicht erneut anrufen. Antippen, um sie zu sehen.</small></span>
        </button>
      )}
      {erledigt.size > 0 && (
        <button type="button" className="pi-hinweis blau" onClick={() => void laden()}>
          <span className="zahl">{erledigt.size}</span>
          <span><b>{erledigt.size === 1 ? "Ein Ergebnis gebucht" : `${erledigt.size} Ergebnisse gebucht`}</b>
            <small>Die Reihenfolge ist absichtlich stehen geblieben, damit du deine Zeile behältst. Hier tippen, um neu zu ordnen.</small></span>
        </button>
      )}

      <section className="pi-liste">
        {laedt && <div className="pi-laedt">Lade …</div>}
        {!laedt && sichtbar.length === 0 && (
          <div className="pi-leer">
            <b>{suche ? "Kein Treffer." : liste.length > 0 ? "Mit diesen Filtern ist nichts offen." : rolle === "onboarding"
              ? (naechsterTermin ? `Für jetzt nichts offen. Nächstes Startgespräch: ${new Date(naechsterTermin).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr.` : "Keine Startgespräche geplant.")
              : ansicht === "alle" ? "Dir ist gerade kein Kunde zugewiesen." : "In dieser Ansicht ist nichts offen."}</b>
            <p>{suche ? "Suche über Name, E-Mail, Telefonnummer oder Referenz." : liste.length > 0 ? "Nimm einen Filter zurück – die Kunden sind da." : ansicht === "alle" ? "Neue Kunden kommen automatisch dazu. Betreute Kunden bleiben bei dir." : "Wechsle auf „Alle“, um deinen gesamten Bestand zu sehen."}</p>
          </div>
        )}
        {!laedt && sichtbar.map((k) => (
          <KundenKarte key={k.personId} k={k} erledigt={erledigt.has(k.personId)} onAkte={() => oeffnen(k.personId)}
                       onNotiz={() => { setErledigt((e) => new Set(e).add(k.personId)); void laden(true, true); }} />
        ))}
      </section>
      {!laedt && liste.length > 0 && (
        <p className="pi-fussnote">Diese Liste ist dein Bestand. Kunden, die du dokumentiert hast, bleiben bei dir. Bezahlte Kunden stehen unter „Bezahlt · aktiv“.</p>
      )}

      {offen && (
        <>
          <div className="pi-lade-hintergrund" onClick={() => oeffnen(null)} aria-hidden="true" />
          {geoeffnet ? (
            <Akte key={geoeffnet.personId} k={geoeffnet} onZu={() => oeffnen(null)}
                  onWeg={() => { entfernen(geoeffnet.personId); oeffnen(null); }}
                  onNeu={ersetzen}
                  onErledigt={() => setErledigt((e) => new Set(e).add(geoeffnet.personId))}
                  onZaehler={() => void laden(true, true)} />
          ) : (
            <aside className="pi-lade" role="dialog" aria-modal="true">
              <div className="pi-lade-kopf"><span /><h2>{laedt ? "Lade …" : "Akte nicht gefunden"}</h2>
                <button type="button" className="pi-lade-zu" onClick={() => oeffnen(null)} aria-label="Schließen"><X size={18} /></button></div>
              {!laedt && <div className="pi-lade-koerper"><p className="pi-fussnote">Dieser Kunde gehört nicht zu deinem Bestand oder die Kennung stimmt nicht.</p></div>}
            </aside>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Kundenkarte in der Liste
// ═══════════════════════════════════════════════════════════════════════════
function KundenKarte({ k, erledigt, onAkte, onNotiz }: { k: Kunde; erledigt: boolean; onAkte: () => void; onNotiz: () => void }) {
  const { zeige } = useToast();
  const [notizOffen, setNotizOffen] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const zusage = relativ(k.zusagedatum);
  const rueckruf = k.rueckrufAm ? new Date(k.rueckrufAm) : null;
  const rueckrufJetzt = rueckruf ? rueckruf.getTime() <= Date.now() : false;
  const kante = zusage?.dringend || rueckrufJetzt ? "#dc2626" : k.tier === 1 ? "#dc2626" : k.tier === 2 ? "#d97706" : k.tier === 0 ? "#059669" : "rgba(255,255,255,.15)";
  const tage = kontaktTage(k.letzterKontakt);

  const notizSpeichern = async () => {
    if (notiz.trim().length < 2) return;
    setLaeuft(true);
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, { method: "POST", body: JSON.stringify({ art: "notiz", notiz: notiz.trim() }) });
    setLaeuft(false);
    if (r.ok) { setNotiz(""); setNotizOffen(false); setMeldung("Notiz gespeichert."); zeige("erfolg", "Notiz gespeichert", k.name); onNotiz(); setTimeout(() => setMeldung(null), 2500); }
    else { setMeldung(r.json?.error || "Nicht gespeichert."); }
  };

  return (
    <article className={`pi-karte${erledigt ? " erledigt" : ""}`} style={{ ["--pi-kante" as string]: kante }} data-fi-kunde={k.personId}>
      <div className="pi-karte-kopf">
        <span className={`pi-stufe pi-marke-${k.stufe?.marke ?? (k.tier === 0 ? "OK" : "C")}`} title={k.stufe ? `Stufe ${k.stufe.marke} – ${k.stufe.text}` : "Bezahlt"}>{k.stufe?.marke ?? <Check size={14} strokeWidth={2.2} />}</span>
        <button type="button" className="pi-karte-wer" onClick={onAkte}>
          <b>{k.name}</b>
          <small><i>{statusAusTierGrund(k.tierGrund).anzeige}</i> · {paketText(k)}</small>
        </button>
        <div className="pi-marken">
          {erledigt && <span className="pi-marke gut">Ergebnis gebucht</span>}
          {k.termin && <span className={`pi-marke${k.termin.erledigt ? " gut" : ""}`}>{terminText(k.termin.beginn)} · {k.termin.art}</span>}
          {!k.termin && k.terminAm && <span className="pi-marke">Termin {terminText(k.terminAm)}</span>}
          {zusage && <span className={`pi-marke${zusage.dringend ? " dringend" : ""}`}>Zusage {zusage.text}</span>}
          {rueckruf && <span className={`pi-marke${rueckrufJetzt ? " dringend" : " warn"}`}>Rückruf {rueckruf.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} {rueckruf.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>}
          {k.ruhtSeit && <span className="pi-marke still">ruht</span>}
          {k.gesperrt && <span className="pi-marke dringend">gesperrt</span>}
        </div>
      </div>
      <p className="pi-karte-schritt">{k.hinweis}</p>
      <div className="pi-karte-fuss">
        <small className={tage != null && tage >= 3 && k.tier !== 0 ? "warn" : ""}>
          {wartezeit(k.letzterKontakt)}{k.nichtErreicht > 0 && ` · ${k.nichtErreicht}× nicht erreicht`}{k.stammdaten?.land && ` · ${LAND_NAME[k.stammdaten.land] || k.stammdaten.land}`}
        </small>
        <div className="pi-knoepfe">
          <button type="button" className="pi-knopf" disabled={!k.telefonWaehlbar} onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name)} title={k.telefonWaehlbar ? k.telefonWaehlbar : (k.telefon ? "Ländervorwahl fehlt – in der Akte ergänzen" : "keine Nummer")}><Phone size={15} strokeWidth={1.75} /> Anrufen</button>
          <button type="button" className="pi-knopf still" onClick={onAkte}><FileText size={15} strokeWidth={1.75} /> Akte</button>
          <button type="button" className="pi-knopf still" onClick={() => setNotizOffen((v) => !v)}><StickyNote size={15} strokeWidth={1.75} /> Notiz</button>
        </div>
      </div>
      {notizOffen && (
        <div className="pi-schnellnotiz">
          <input className="pi-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Kurze Notiz zum Kunden" autoFocus
                 onKeyDown={(e) => { if (e.key === "Enter") void notizSpeichern(); }} />
          <button type="button" className="pi-knopf klein" disabled={laeuft || notiz.trim().length < 2} onClick={() => void notizSpeichern()}>{laeuft ? "…" : "Speichern"}</button>
        </div>
      )}
      {meldung && <p className="pi-fussnote">{meldung}</p>}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE — alle Aktionen der alten Kundenkarte, in der Glas-Lade
// ═══════════════════════════════════════════════════════════════════════════
function Akte({ k, onZu, onWeg, onNeu, onErledigt, onZaehler }: {
  k: Kunde; onZu: () => void; onWeg: () => void; onNeu: (k: Kunde) => void; onErledigt: () => void; onZaehler: () => void;
}) {
  const fragen = useFragen();
  const { zeige } = useToast();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht" | "info"; text: string } | null>(null);
  const melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => {
    setMeldung({ art, text: text ? `${titel} – ${text}` : titel });
    zeige(art === "gut" ? "erfolg" : art === "schlecht" ? "fehler" : "info", titel, text);
  };
  const [bearbeiten, setBearbeiten] = useState(false);
  const [mailNachtrag, setMailNachtrag] = useState("");
  const [produktOffen, setProduktOffen] = useState(false);
  const [datumWert] = useState(tagPlus(1));
  const [notiz, setNotiz] = useState("");
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [sendeMenue, setSendeMenue] = useState(false);
  const [blatt, setBlatt] = useState(false);
  const [linkKopiert, setLinkKopiert] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [testOffen, setTestOffen] = useState(false);
  const [testNotiz, setTestNotiz] = useState("");
  const [belegOffen, setBelegOffen] = useState(false);
  const [belegDatum, setBelegDatum] = useState("");
  const [belegNotiz, setBelegNotiz] = useState("");
  const [belegDatei, setBelegDatei] = useState<File | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [bestaetigen, setBestaetigen] = useState(false);
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);
  const notizFeld = useRef<HTMLInputElement | null>(null);

  const zusage = relativ(k.zusagedatum);
  const rueckruf = k.rueckrufAm ? new Date(k.rueckrufAm) : null;
  const rueckrufJetzt = rueckruf ? rueckruf.getTime() <= Date.now() : false;
  const termin = k.terminAm ? new Date(k.terminAm) : null;
  const status = statusAusTierGrund(k.tierGrund);

  useEffect(() => {
    // Escape schließt die Lade – aber nicht, solange ein Dialog darüber liegt.
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !bestaetigen && !sendeMenue && !blatt) onZu(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onZu, bestaetigen, sendeMenue, blatt]);

  const frisch = async () => {
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    if (r.ok && r.json?.kunde) onNeu(r.json.kunde);
    if (r.ok) setVerlauf(r.json.verlauf ?? []);
  };
  const verlaufNachladen = async () => {
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    if (r.ok) setVerlauf(r.json.verlauf ?? []);
  };
  useEffect(() => { void verlaufNachladen(); }, [k.personId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ergebnis / Notiz (POST /agent/crm/kunden/:id/aktivitaet) ───────────
  const ergebnis = async (art: string, zusatz: Record<string, unknown> = {}): Promise<ErgebnisAusgang> => {
    setLaeuft(art);
    const eigeneNotiz = typeof zusatz.notiz === "string" ? zusatz.notiz.trim() : "";
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art, ...zusatz, notiz: eigeneNotiz || notiz.trim() || undefined }),
    });
    setLaeuft(null);
    if (!r.ok) {
      const grund = r.json?.error || "Nicht gespeichert. Bitte erneut versuchen.";
      melden("schlecht", "Nicht gespeichert", grund);
      return { ok: false, fehler: grund };
    }
    melden(r.json.uebergabe && !r.json.uebergabe.ok ? "info" : "gut", r.json.meldung || "Gespeichert", k.name);
    setNotiz("");
    const VERABREDET = ["nicht_erreicht", "mailbox", "rueckruf_termin", "nummer_falsch", "nummer_blockiert"];
    if (art === "erreicht_abgelehnt" || r.json.uebergabe?.ok) onWeg();
    else if (VERABREDET.includes(art)) { onErledigt(); if (r.json.kunde) onNeu(r.json.kunde); }
    else if (r.json.kunde) { onNeu(r.json.kunde); onErledigt(); }
    else onErledigt();
    if (art === "notiz") await verlaufNachladen(); else void verlaufNachladen();
    onZaehler();
    return { ok: true };
  };

  // ── Zahlungsbeleg (POST …/zahlungsbeleg, multipart) ─────────────────────
  const belegHochladen = async () => {
    if (!belegDatei) { melden("schlecht", "Keine Datei gewählt", "Bitte das Foto oder PDF der Überweisung auswählen."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(belegDatum)) { melden("schlecht", "Datum fehlt", "Bitte das Überweisungsdatum laut Beleg angeben."); return; }
    setLaeuft("beleg");
    const daten = new FormData();
    daten.append("beleg", belegDatei); daten.append("datum", belegDatum);
    if (belegNotiz.trim()) daten.append("notiz", belegNotiz.trim());
    const antwort = await fetch(`/api/fiaon/agent/crm/kunden/${k.personId}/zahlungsbeleg`, { method: "POST", credentials: "include", body: daten }).then((r) => r.json()).catch(() => null);
    setLaeuft(null);
    if (antwort?.ok) { setBelegOffen(false); setBelegDatei(null); setBelegDatum(""); setBelegNotiz(""); melden("gut", "Beleg hinterlegt", antwort.meldung || "Er steht jetzt bei der Zahlungsprüfung."); }
    else melden("schlecht", "Nicht hinterlegt", antwort?.error || "Bitte erneut versuchen.");
  };

  const zahlungsdatenKopieren = async () => {
    const text = k.zahlung?.klartext; if (!text) return;
    if (await inZwischenablage(text)) { setKopiert(true); setTimeout(() => setKopiert(false), 2500); }
    else melden("schlecht", "Kopieren nicht möglich", "Bitte den Verwendungszweck von Hand übernehmen.");
  };
  const terminlinkKopieren = async () => {
    if (await inZwischenablage(k.terminLink)) { setLinkKopiert(true); setTimeout(() => setLinkKopiert(false), 2500); }
    else melden("schlecht", "Kopieren nicht möglich", "Bitte den Link von Hand übernehmen.");
  };

  // ── Buchungen wegräumen (POST /agent/buchungen/:ref/archivieren) ────────
  const umschalten = (ref: string) => setAuswahl((v) => { const n = new Set(v); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });
  const auswahlWegraeumen = async () => {
    const refs = Array.from(auswahl); if (refs.length === 0) return;
    const zeilen = (k.buchungen ?? []).filter((b) => refs.includes(b.ref));
    const summe = zeilen.reduce((s, b) => s + Number(b.betragCents ?? 0), 0);
    if (!(await fragen({
      titel: `${refs.length} ${refs.length === 1 ? "Buchung" : "Buchungen"} aus der Liste nehmen?`,
      text: `${zeilen.map((b) => `${b.bezeichnung}${b.betragCents != null ? ` (${eur(b.betragCents)})` : ""}`).join(", ")} — Summe ${eur(summe)}.`,
      folge: "Sie werden archiviert, nicht gelöscht — die Vertriebsleitung kann sie zurückholen. Bezahlte Buchungen und die letzte verbleibende bleiben in jedem Fall stehen.",
      ja: "Wegräumen",
    }))) return;
    setLaeuft("arch-auswahl");
    const geschafft: string[] = []; const geblieben: { ref: string; grund: string }[] = [];
    for (const ref of refs) {
      const r = await api(`/agent/buchungen/${encodeURIComponent(ref)}/archivieren`, { method: "POST", body: JSON.stringify({ grund: "doppelt" }) });
      if (r.ok) geschafft.push(ref); else geblieben.push({ ref, grund: r.json?.error || "unbekannter Grund" });
    }
    setLaeuft(null); setAuswahl(new Set());
    if (geblieben.length === 0) melden("gut", "Weggeräumt", `${geschafft.length} ${geschafft.length === 1 ? "Buchung" : "Buchungen"} archiviert.`);
    else melden(geschafft.length > 0 ? "info" : "schlecht", geschafft.length > 0 ? `${geschafft.length} weggeräumt, ${geblieben.length} blieben stehen` : "Keine weggeräumt", geblieben.map((g) => `${g.ref}: ${g.grund}`).join(" · ").slice(0, 400));
    await frisch(); onZaehler();
  };
  const buchungWegraeumen = async (b: { ref: string; bezeichnung: string; betragCents: number | null }) => {
    const betrag = b.betragCents != null ? eur(b.betragCents) : "ohne Betrag";
    if (!(await fragen({
      titel: `„${b.bezeichnung}“ (${betrag}) aus der Liste nehmen?`,
      text: "Der Kunde behält seine anderen Buchungen. Diese hier wird archiviert, nicht gelöscht — die Vertriebsleitung kann sie zurückholen.",
      folge: `Referenz: ${b.ref}`, ja: "Wegräumen",
    }))) return;
    setLaeuft(`arch-${b.ref}`);
    const r = await api(`/agent/buchungen/${encodeURIComponent(b.ref)}/archivieren`, { method: "POST", body: JSON.stringify({ grund: "doppelt" }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht möglich", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Buchung weggeräumt", r.json.meldung);
    await frisch(); onZaehler();
  };

  // ── E-Mail nachtragen (POST /agent/customers/:ref/stammdaten) ───────────
  const mailNachtragen = async () => {
    const wert = mailNachtrag.trim();
    const ref = (k.buchungen ?? []).find((b) => !b.erledigt)?.ref ?? (k.buchungen ?? [])[0]?.ref;
    if (!ref) { melden("schlecht", "Keine Bestellung", "Ohne Bestellung gibt es keine Akte, an der die Adresse hängt. Bitte erst ein Produkt anlegen."); return; }
    setLaeuft("mailnachtrag");
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`, { method: "POST", body: JSON.stringify({ email: wert }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "E-Mail gespeichert", `${wert} steht jetzt an der Akte. Der Zahlungsdaten-Knopf ist frei.`);
    setMailNachtrag(""); await frisch();
  };

  // ── Zahlungsdaten + Rechnung (POST …/rechnung) ───────────────────────────
  const zahlungsdaten = async (ref: string | null = null) => {
    setLaeuft("rechnung");
    const r = await api(`/agent/crm/kunden/${k.personId}/rechnung`, { method: "POST", body: JSON.stringify({ ref }) });
    setLaeuft(null);
    if (!r.ok) { const grund = r.json?.error || "Der Server hat den Versand abgelehnt, ohne einen Grund zu nennen."; setSendeFehler(grund); melden("schlecht", "Nicht versandt", grund); return; }
    setSendeFehler(null); setBestaetigen(false);
    melden(r.json.warnung ? "info" : "gut", r.json.warnung ? "Versandt, mit Hinweis" : "Rechnung und Zahlungsdaten gesendet",
      r.json.warnung || `An ${r.json.versandtAn} — mit Bankverbindung, Verwendungszweck und Rechnung.`);
    if (r.json.kunde) onNeu(r.json.kunde);
    await verlaufNachladen();
  };
  const nummerKorrektur = async () => {
    setLaeuft("nummer");
    const r = await api(`/agent/crm/kunden/${k.personId}/nummer-korrektur`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    if (r.ok) melden("gut", "Bitte um Nummer versandt", `An ${r.json.versandtAn} — mit Link zum Ändern.`);
    else melden("schlecht", "Nicht versandt", r.json?.error || "Bitte erneut versuchen.");
  };
  const testeintragMelden = async () => {
    const begruendung = testNotiz.trim();
    if (begruendung.length < 5) { melden("schlecht", "Bitte kurz begründen", "Ein Satz genügt: Woran erkennst du, dass das kein echter Kunde ist?"); return; }
    setLaeuft("test");
    const r = await api(`/agent/crm/kunden/${k.personId}/testeintrag-melden`, { method: "POST", body: JSON.stringify({ begruendung }) });
    setLaeuft(null);
    if (r.ok) { setTestOffen(false); setTestNotiz(""); melden("gut", "Gemeldet", r.json.meldung || "Die Vertriebsleitung prüft."); }
    else melden("schlecht", "Nicht gemeldet", r.json?.error || "Bitte erneut versuchen.");
  };

  // ── Sperrgrund für „Zahlungsdaten senden“ — vom Server ──────────────────
  const buchungen = k.buchungen ?? [];
  const sperre = k.sendeGrund
    ? (k.sendeMoeglich ? null : { grund: k.sendeText || "Senden ist gerade nicht möglich.", ziel: (k.sendeGrund === "keine_email" ? "stammdaten" : k.sendeGrund === "keine_bestellung" ? "produkt" : null) as "stammdaten" | "produkt" | null })
    : !k.email ? { grund: "Keine E-Mail-Adresse — ohne sie kann nichts rausgehen.", ziel: "stammdaten" as const }
    : buchungen.length === 0 ? { grund: "Keine Bestellung vorhanden — es gibt nichts zu bezahlen.", ziel: "produkt" as const } : null;
  const offeneBuchungen = buchungen.filter((b) => b.offen);
  const gemeldet = offeneBuchungen.filter((b) => b.zahlungText?.startsWith("Zahlung gemeldet"));

  return (
    <aside className="pi-lade" role="dialog" aria-modal="true" aria-label={`Akte ${k.name}`}>
      <div className="pi-lade-kopf">
        <span className={`pi-stufe pi-marke-${k.stufe?.marke ?? (k.tier === 0 ? "OK" : "C")}`} style={{ marginTop: 4 }}>{k.stufe?.marke ?? <Check size={14} strokeWidth={2.2} />}</span>
        <div>
          <h2>{k.name}</h2>
          <div className="status">
            <i style={{ color: k.tier === 1 ? "#fca5a5" : k.tier === 2 ? "#fcd34d" : k.tier === 0 ? "#6ee7b7" : "#cbd5e1" }}>{status.anzeige}</i>
            {k.stufe && <span>Stufe {k.stufe.marke} · {k.stufe.text}</span>}
            {termin && <span className="pi-marke">Termin {terminText(k.terminAm!)}</span>}
            {k.termin && !termin && <span className="pi-marke">{terminText(k.termin.beginn)} · {k.termin.art}</span>}
            {zusage && <span className={`pi-marke${zusage.dringend ? " dringend" : ""}`}>Zusage {zusage.text}</span>}
            {rueckruf && <span className={`pi-marke${rueckrufJetzt ? " dringend" : " warn"}`}>Rückruf {rueckruf.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} {rueckruf.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <button type="button" className="pi-lade-zu" onClick={onZu} aria-label="Akte schließen"><X size={18} strokeWidth={1.75} /></button>
      </div>

      <div className="pi-lade-koerper">
        {meldung && <p className={`pi-meldung ${meldung.art === "gut" ? "gut" : meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}

        {/* Nächster Schritt + Aktionen */}
        <div className="pi-block hervor">
          <div className="pi-block-kopf"><b>Nächster Schritt</b><small style={{ color: "#9ca3af", fontSize: 12 }}>{wartezeit(k.letzterKontakt)}</small></div>
          <p>{k.hinweis}</p>
          <div className="pi-reihe oben">
            {k.telefonWaehlbar ? (
              <button type="button" className="pi-knopf gross" onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name)}><Phone size={16} strokeWidth={1.75} /> Anrufen</button>
            ) : k.telefon ? (
              <NummerLandNachtragen k={k} onFertig={onNeu} />
            ) : (
              <span className="pi-sperre">keine Nummer</span>
            )}

            {!sperre ? (
              <span className="pi-stapel">
                <button type="button" className="pi-knopf gut gross" onClick={() => setBestaetigen(true)} disabled={!!laeuft} title={`Zahlungsdaten und Rechnung an ${k.email}`}>
                  <Send size={15} strokeWidth={1.75} /> {laeuft === "rechnung" ? "Sende …" : "Zahlungsdaten senden"}
                </button>
                <VertragsLuecke k={k} melden={melden} />
              </span>
            ) : (
              <span className="pi-stapel">
                <span className="pi-sperre"><Send size={14} strokeWidth={1.75} /> Zahlungsdaten: gesperrt</span>
                <span className="pi-luecke" style={{ color: "#fde68a" }}>{sperre.grund}</span>
                <VertragsLuecke k={k} melden={melden} />
                {sperre.ziel === "stammdaten" && (
                  <span className="pi-reihe">
                    <input className="pi-eingabe" value={mailNachtrag} onChange={(e) => setMailNachtrag(e.target.value)} placeholder="E-Mail nachtragen" type="email" inputMode="email" style={{ minWidth: 200 }} />
                    <button type="button" className="pi-knopf still" disabled={!!laeuft || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailNachtrag.trim())} onClick={() => void mailNachtragen()}>{laeuft === "mailnachtrag" ? "Speichert …" : "Speichern"}</button>
                  </span>
                )}
                {sperre.ziel === "produkt" && <button type="button" className="pi-knopf still" onClick={() => setProduktOffen(true)}>Produkt anlegen</button>}
              </span>
            )}
          </div>
          <div className="pi-reihe">
            <button type="button" className="pi-knopf still" onClick={() => setProduktOffen((v) => !v)} title="Ein Paket aus dem Katalog an diese Akte hängen. Ein offenes Paket wird dabei ersetzt.">
              {buchungen.some((b) => b.offen && b.art === "paket") ? "Produkt tauschen" : "Produkt hinzufügen"}
            </button>
            {k.email && <a href={`mailto:${k.email}`} className="pi-knopf still" title={`Öffnet dein eigenes Mailprogramm mit ${k.email}`}><Mail size={14} strokeWidth={1.75} /> eigenes Mailprogramm</a>}
            <button type="button" className="pi-knopf still" onClick={() => void nummerKorrektur()} disabled={!!laeuft || !k.email} title="Schickt dem Kunden einen Link, mit dem er seine Telefonnummer selbst korrigiert">
              {laeuft === "nummer" ? "Sende …" : "Nummer korrigieren lassen"}
            </button>
            <button type="button" className="pi-knopf still" onClick={() => setBlatt(true)}>Gesprächsblatt</button>
            <button type="button" className="pi-knopf still" onClick={() => setSendeMenue(true)}><Mail size={14} strokeWidth={1.75} /> E-Mail senden</button>
          </div>
          {produktOffen && (
            <div className="pi-hell">
              <ProduktDialog offen={produktOffen} personId={k.personId} buchungen={buchungen as any} aufKlappen={setProduktOffen}
                             fertig={async (m) => { melden("gut", "Produkt gespeichert", m); await frisch(); onZaehler(); }} />
            </div>
          )}
        </div>

        {/* Vorgeschichte */}
        {(k.nichtErreicht >= 2 || k.ruhtSeit) && (
          <div className={`pi-block ${k.ruhtSeit ? "still" : "warn"}`}>
            <div className="pi-block-kopf"><b>Vorgeschichte</b></div>
            <p className={k.ruhtSeit ? "leise" : "warn"}>
              {k.nichtErreicht}× nicht erreicht
              {k.letzterKontakt && `, zuletzt ${dtag(k.letzterKontakt)}`}
              {k.terminlinkMailAm && `, Terminlink versandt ${dtag(k.terminlinkMailAm)}`}
            </p>
            {k.ruhtSeit && <p className="leise">Ruht bis {k.wiedervorlage ? dtag(k.wiedervorlage) : "zur Wiedervorlage"}. Nicht anrufen — er hat den Terminlink und meldet sich selbst.</p>}
            {!k.email && (
              <div className="pi-reihe">
                <p className="leise">Keine E-Mail hinterlegt — es ging keine Mail raus.</p>
                <button type="button" className="pi-knopf still klein" onClick={() => void terminlinkKopieren()}><Copy size={13} strokeWidth={1.75} /> {linkKopiert ? "Kopiert" : "Terminlink für WhatsApp kopieren"}</button>
              </div>
            )}
          </div>
        )}

        {/* Zahlung: Verwendungszweck + Beleg */}
        {k.zahlung?.referenz && (
          <div className="pi-block">
            <div className="pi-zweck">
              <span><small>Verwendungszweck</small><b>{k.zahlung.referenz}</b></span>
              <button type="button" className="pi-knopf still klein" style={{ marginLeft: "auto" }} disabled={!k.zahlung.klartext} onClick={() => void zahlungsdatenKopieren()} title="Empfänger, IBAN, Betrag und Verwendungszweck als Text — fertig für WhatsApp">
                <Copy size={13} strokeWidth={1.75} /> {kopiert ? "Kopiert" : "Zahlungsdaten kopieren"}
              </button>
            </div>
            {kopiert && <p className="gut">Empfänger, IBAN, Betrag und Verwendungszweck liegen in der Zwischenablage.</p>}
            {!belegOffen ? (
              <button type="button" className="pi-link" onClick={() => setBelegOffen(true)}>Überweisungsbeleg hinterlegen</button>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <p className="leise">Foto oder PDF der Überweisung. Es erscheint bei der Zahlungsprüfung neben dem Bankeingang. Gebucht wird dadurch nichts.</p>
                <div className="pi-reihe">
                  <input type="file" accept="image/*,application/pdf" className="pi-eingabe" style={{ paddingTop: 8 }} onChange={(e) => setBelegDatei(e.target.files?.[0] ?? null)} />
                  <input type="date" className="pi-eingabe" style={{ flex: "0 0 160px" }} value={belegDatum} onChange={(e) => setBelegDatum(e.target.value)} max={new Date().toISOString().slice(0, 10)} title="Überweisungsdatum laut Beleg" />
                </div>
                <div className="pi-reihe">
                  <input className="pi-eingabe" value={belegNotiz} onChange={(e) => setBelegNotiz(e.target.value)} placeholder="Notiz (freiwillig)" />
                  <button type="button" className="pi-knopf klein" disabled={!belegDatei || !belegDatum || !!laeuft} onClick={() => void belegHochladen()}>{laeuft === "beleg" ? "Lädt …" : "Hinterlegen"}</button>
                  <button type="button" className="pi-link" onClick={() => { setBelegOffen(false); setBelegDatei(null); }}>Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ergebnis festhalten */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>Ergebnis festhalten</b>
            <small style={{ color: "#64748b", fontSize: 12 }}>
              {k.nichtErreicht > 0 && `${k.nichtErreicht}× nicht erreicht`}{k.nichtErreicht > 0 && k.rechnungVersandt > 0 && " · "}{k.rechnungVersandt > 0 && `${k.rechnungVersandt}× Zahlungsdaten`}
            </small>
          </div>
          <div className="pi-hell">
            <ErgebnisWahl onErgebnis={(art, zusatz) => ergebnis(art, zusatz)} laeuft={laeuft} kundeName={k.name} heute={heuteIso()} vorgabeDatum={datumWert} />
          </div>
        </div>

        {/* Buchungen */}
        {buchungen.length > 0 && (
          <div className="pi-block">
            <div className="pi-block-kopf"><b>Buchungen</b>
              {auswahl.size > 0 && (
                <>
                  <button type="button" className="pi-knopf warn klein" disabled={laeuft === "arch-auswahl"} onClick={() => void auswahlWegraeumen()}>{laeuft === "arch-auswahl" ? "Wird weggeräumt …" : `Auswahl wegräumen (${auswahl.size})`}</button>
                  <button type="button" className="pi-link" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</button>
                </>
              )}
            </div>
            {buchungen.map((b) => (
              <div key={b.ref} className={`pi-buchung${b.bezahlt ? " bezahlt" : b.erledigt ? " erledigt" : " offen"}`}>
                <b>{b.bezeichnung}</b>
                <span className={`art${b.art === "bonitaet" ? " zusatz" : ""}`}>{b.art === "bonitaet" ? "Zusatz" : "Paket"}</span>
                {b.betragCents != null && <span className="betrag">{eur(b.betragCents)}</span>}
                <span className="zustand">{b.zahlungText}</span>
                {!b.erledigt && <a href={`/api/fiaon/agent/customers/${encodeURIComponent(b.ref)}/invoice.pdf`} target="_blank" rel="noreferrer">Rechnung (PDF) <ExternalLink size={11} /></a>}
                <span className="rechts">gestellt {b.gestelltAm ? dtag(b.gestelltAm) : "—"}{b.faelligAm && !b.bezahlt && ` · fällig ${dtag(b.faelligAm)}`}</span>
                {b.art !== "bonitaet" && b.bezahlt && k.karte?.text && <span className="voll">Karte: {k.karte.text}{k.karte.am ? ` (seit ${dtag(k.karte.am)})` : ""}</span>}
                {b.verwendungszweck && !b.bezahlt && <span className="voll mono">Verwendungszweck: {b.verwendungszweck}</span>}
                {!b.bezahlt && !b.erledigt && buchungen.filter((x) => !x.erledigt).length > 1 && (
                  <span className="rechts" style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <label><input type="checkbox" checked={auswahl.has(b.ref)} onChange={() => umschalten(b.ref)} aria-label={`${b.bezeichnung} zum Wegräumen auswählen`} /> wählen</label>
                    <button type="button" className="pi-link" style={{ color: "#fcd34d" }} disabled={laeuft === `arch-${b.ref}` || laeuft === "arch-auswahl"} onClick={() => void buchungWegraeumen(b)}>{laeuft === `arch-${b.ref}` ? "…" : "Doppelt — wegräumen"}</button>
                  </span>
                )}
              </div>
            ))}
            {offeneBuchungen.length >= 2 && (
              <p className="leise" style={{ color: "#bfdbfe" }}>
                {gemeldet.length === 1
                  ? <>Der Kunde hat für <b style={{ color: "#fff" }}>{gemeldet[0].bezeichnung}</b> eine Zahlung gemeldet — sehr wahrscheinlich die gewollte Buchung. Die anderen kannst du wegräumen.</>
                  : <>{offeneBuchungen.length} offene Buchungen. Frag am Telefon, welche der Kunde will — die anderen räumst du hier weg.</>}
              </p>
            )}
            {offeneBuchungen.length > 0 && <p className="warn">Offen insgesamt: <b style={{ color: "#fff" }}>{eur(offeneBuchungen.reduce((s, b) => s + (b.betragCents ?? 0), 0))}</b></p>}
          </div>
        )}

        {/* Stammdaten */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>Stammdaten</b><button type="button" className="pi-link" onClick={() => setBearbeiten((v) => !v)}>{bearbeiten ? "Schließen" : "Kunde bearbeiten"}</button></div>
          {bearbeiten && <KundeBearbeiten k={k} melden={melden} onFertig={async () => { setBearbeiten(false); await frisch(); }} />}
          <dl className="pi-dl">
            {([
              ["Adresse", [k.stammdaten?.strasse, [k.stammdaten?.plz, k.stammdaten?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null],
              ["Land", k.stammdaten?.land ? (LAND_NAME[k.stammdaten.land] || k.stammdaten.land) : null],
              ["Geburtsdatum", k.stammdaten?.geburtsdatum ? dtag(String(k.stammdaten.geburtsdatum)) : null],
              ["E-Mail", k.email], ["Telefon", k.telefon],
              ["Verwendungszweck", k.zahlung?.referenz],
              ["Wiedervorlage", k.wiedervorlage ? dtag(k.wiedervorlage) : null],
              ["Betreut seit", k.betreutSeit ? dtag(k.betreutSeit) : null],
            ] as [string, string | null | undefined][]).map(([l, w]) => (
              <div key={l}><dt>{l}</dt><dd className={w ? "" : "fehlt"}>{w || "nicht hinterlegt"}</dd></div>
            ))}
          </dl>
        </div>

        {/* E-Mails / Versand */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>E-Mails</b>
            <button type="button" className="pi-knopf still klein" onClick={() => setBlatt(true)}>Gesprächsblatt</button>
            <button type="button" className="pi-knopf klein" onClick={() => setSendeMenue(true)}><Mail size={13} strokeWidth={1.75} /> E-Mail senden</button>
          </div>
          <Versandzentrum personId={k.personId} />
        </div>
        <SendeMenue personId={k.personId} offen={sendeMenue} onSchliessen={() => setSendeMenue(false)} onGesendet={onZaehler} />
        <Gespraechsblatt personId={k.personId} offen={blatt} onZu={() => setBlatt(false)} />

        {/* Verlauf + Notiz + Testeintrag */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>Verlauf</b><small style={{ color: "#64748b", fontSize: 12 }}>{wartezeit(k.letzterKontakt)}</small></div>
          {!verlauf && <p className="leise">Lade …</p>}
          {verlauf && verlauf.length === 0 && <p className="leise">Noch kein Eintrag.</p>}
          {verlauf && verlauf.length > 0 && (
            <ul className="pi-verlauf">
              {verlauf.map((v: any, i: number) => (
                <li key={v.id ?? i}>
                  <b>{new Date(v.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>
                  {" · "}<span>{v.von || v.agentName || v.agent || "System"}: {(ERGEBNIS_TEXT as Record<string, string>)[String(v.ergebnis)] || (v.art === "note" ? "Notiz" : v.art)}</span>
                  {v.notiz && <> — {v.notiz}</>}
                </li>
              ))}
            </ul>
          )}
          <div className="pi-reihe">
            <input ref={notizFeld} className="pi-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Notiz hinzufügen"
                   onKeyDown={(e) => { if (e.key === "Enter" && notiz.trim().length >= 2 && !laeuft) void ergebnis("notiz"); }} />
            <button type="button" className="pi-knopf klein" disabled={notiz.trim().length < 2 || !!laeuft} onClick={() => void ergebnis("notiz")}>{laeuft === "notiz" ? "…" : "Speichern"}</button>
          </div>
          {!testOffen ? (
            <button type="button" className="pi-link" style={{ color: "#64748b", justifySelf: "start" }} onClick={() => setTestOffen(true)}>Kein echter Kunde? Als Testeintrag melden</button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="leise">Die Vertriebsleitung prüft und legt die Bestellung ins Archiv, wenn es stimmt. Du entfernst hier nichts selbst — der Kunde bleibt bis zur Entscheidung in deiner Liste.</p>
              <div className="pi-reihe">
                <input className="pi-eingabe" value={testNotiz} onChange={(e) => setTestNotiz(e.target.value)} placeholder="Woran erkennst du das? (ein Satz)" />
                <button type="button" className="pi-knopf still klein" disabled={testNotiz.trim().length < 5 || !!laeuft} onClick={() => void testeintragMelden()}>{laeuft === "test" ? "Meldet …" : "Melden"}</button>
                <button type="button" className="pi-link" onClick={() => { setTestOffen(false); setTestNotiz(""); }}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {bestaetigen && (
        <RechnungBestaetigung personId={k.personId} kundeName={k.name} laeuft={laeuft === "rechnung"}
                              onAbbrechen={() => { setBestaetigen(false); setSendeFehler(null); }}
                              onSenden={(ref) => void zahlungsdaten(ref)} sendeFehler={sendeFehler} />
      )}
    </aside>
  );
}

// ── Vertragslücke: fehlende Felder + Zustimmungs-Link (POST …/zustimmungs-link) ──
function VertragsLuecke({ k, melden }: { k: Kunde; melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void }) {
  const [laeuft, setLaeuft] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  if (!k.fehlendeFelder) return null;
  const zustimmungen = (k.zustimmungFehlt || "").split(", ").filter(Boolean);
  const sachangaben = k.fehlendeFelder.split(", ").filter((f) => f.trim() && !zustimmungen.includes(f.trim()));
  const linkSenden = async () => {
    setLaeuft(true);
    const r = await api(`/agent/crm/kunden/${k.personId}/zustimmungs-link`, { method: "POST" });
    setLaeuft(false);
    if (!r.ok) { melden("schlecht", "Nicht möglich", r.json?.error || "Bitte erneut versuchen."); return; }
    setLink(r.json.link ?? null);
    melden(r.json.gesendet ? "gut" : "schlecht", r.json.gesendet ? "Link verschickt" : "Mail nicht zugestellt", r.json.meldung);
  };
  return (
    <span className="pi-stapel">
      <span className="pi-luecke">Für den Vertrag fehlen noch: {k.fehlendeFelder}</span>
      {sachangaben.length > 0 && <span className="pi-luecke">{sachangaben.join(", ")} kannst du am Telefon aufnehmen — über „Kunde bearbeiten“.</span>}
      {zustimmungen.length > 0 && (
        <>
          <button type="button" className="pi-link" style={{ justifySelf: "start", alignSelf: "flex-start" }} onClick={() => void linkSenden()} disabled={laeuft} title="Zustimmungen darf nur der Kunde selbst geben — dieser Link führt ihn hin.">
            {laeuft ? "Sende …" : "Zustimmungs-Link an den Kunden senden"}
          </button>
          {link && <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="pi-luecke-link" aria-label="Zustimmungs-Link zum Kopieren" />}
        </>
      )}
    </span>
  );
}

// ── Nummer ohne Land — Vorwahl ergänzen (POST …/nummer-land) ──────────────
function NummerLandNachtragen({ k, onFertig }: { k: Kunde; onFertig: (neu: Kunde) => void }) {
  const vorschlag = k.landVorschlag?.land ?? "";
  const [land, setLand] = useState(vorschlag);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const VORWAHL: Record<string, string> = { DE: "+49", AT: "+43", CH: "+41", IT: "+39", RO: "+40", SK: "+421" };
  const roh = String(k.nummerRoh ?? k.telefon ?? "").replace(/[\s()/.\-]/g, "");
  const wird = land && VORWAHL[land] && roh.startsWith("0") ? `${VORWAHL[land]}${roh.replace(/^0+/, "")}` : null;
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const r = await api(`/agent/crm/kunden/${k.personId}/nummer-land`, { method: "POST", body: JSON.stringify({ land }) });
    setLaeuft(false);
    if (r.ok) {
      setMeldung(r.json.meldung);
      const n = await api(`/agent/crm/kunden/${k.personId}`);
      if (n.ok && n.json?.kunde) onFertig(n.json.kunde);
    } else setFehler(r.json?.error || "Das hat nicht geklappt.");
  };
  if (meldung) return <span className="pi-marke gut" style={{ padding: "10px 14px" }}>{meldung}</span>;
  return (
    <span className="pi-nummer-land">
      <b>{k.telefon}</b>
      <small>Ländervorwahl fehlt — nicht anrufbar. Woher kommt der Kunde?</small>
      <span className="pi-reihe">
        <select className="pi-eingabe" style={{ minHeight: 36, flex: 1 }} value={land} onChange={(e) => { setLand(e.target.value); setFehler(null); }} aria-label="Land des Kunden">
          <option value="">— Land wählen —</option>
          {Object.entries(LAND_NAME).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <button type="button" className="pi-knopf klein" onClick={() => void speichern()} disabled={!land || laeuft}>{laeuft ? "…" : "Speichern"}</button>
      </span>
      {wird && <span className="vorschau">{k.nummerRoh ?? k.telefon} + {land} → <b>{wird}</b></span>}
      {vorschlag && <small className="grau">Vorschlag {vorschlag} ({k.landVorschlag?.grund}) — bitte prüfen, nicht raten.</small>}
      {!vorschlag && k.landVorschlag?.grund && <small className="grau">Kein Vorschlag: {k.landVorschlag.grund}.</small>}
      {fehler && <small className="rot">{fehler}</small>}
    </span>
  );
}

// ── Versandzentrum (GET/POST /agent/versand/:personId[/:art]) ─────────────
function Versandzentrum({ personId }: { personId: number }) {
  const fragen = useFragen();
  const { zeige } = useToast();
  const [daten, setDaten] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await api(`/agent/versand/${personId}`);
    setDaten(r.ok ? r.json : { fehler: r.json?.error || "Nicht ladbar." });
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  const senden = async (art: string, titel: string) => {
    if (!(await fragen({ titel: `„${titel}“ jetzt erneut an den Kunden schicken?`, ja: "Senden" }))) return;
    setBusy(art);
    const r = await api(`/agent/versand/${personId}/${art}`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null);
    if (r.json?.knoepfe) setDaten((d: any) => ({ ...d, knoepfe: r.json.knoepfe, historie: r.json.historie }));
    const text = r.json?.meldung || r.json?.error || "Bitte erneut versuchen.";
    setMeldung(`${r.ok ? "Verschickt" : "Nicht verschickt"} – ${text}`);
    zeige(r.ok ? "erfolg" : "info", r.ok ? "Verschickt" : "Nicht verschickt", text);
  };
  if (!daten) return <p className="leise">Lade …</p>;
  if (daten.fehler) return <p className="leise">{daten.fehler}</p>;
  return (
    <>
      {meldung && <p className="leise" style={{ color: "#dbeafe" }}>{meldung}</p>}
      <div className="pi-versand">
        {(daten.knoepfe || []).map((x: any) => (
          <button key={x.art} type="button" className="pi-knopf still klein" onClick={() => void senden(x.art, x.titel)} disabled={!x.erlaubt || busy === x.art} title={x.erlaubt ? x.zweck : (x.grund || "")}>
            {busy === x.art ? "…" : x.titel}{x.heute > 0 && <em style={{ fontStyle: "normal", opacity: .6 }}>{x.heute}/3</em>}
          </button>
        ))}
      </div>
      {(daten.knoepfe || []).some((x: any) => !x.erlaubt) && (
        <ul className="pi-versand-grund">{(daten.knoepfe || []).filter((x: any) => !x.erlaubt).map((x: any) => <li key={x.art}>{x.titel}: {x.grund}</li>)}</ul>
      )}
      <div className="pi-block-kopf"><b>Versandhistorie</b></div>
      {(daten.historie || []).length === 0 ? <p className="leise">Für diesen Kunden ist noch keine Mail protokolliert.</p> : (
        <div className="pi-historie">
          {(daten.historie || []).slice(0, 12).map((h: any) => (
            <div key={h.id}>
              <b>{h.titel}</b>
              <span className={h.status === "versandt" ? "ok" : "nein"}>{h.status === "versandt" ? "versandt" : h.status === "uebersprungen" ? "übersprungen" : "fehlgeschlagen"}</span>
              <span>{new Date(h.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} · {h.ausgeloestVon}</span>
              {h.grund && <small>{h.grund}</small>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Kunde bearbeiten (POST /agent/customers/:ref/stammdaten) ──────────────
function KundeBearbeiten({ k, melden, onFertig }: { k: Kunde; melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void; onFertig: () => Promise<void> }) {
  const [f, setF] = useState({
    firstName: (k.name || "").split(" ").slice(0, -1).join(" ") || k.name || "", lastName: (k.name || "").split(" ").slice(-1).join(""),
    phone: k.telefon || "", street: k.stammdaten?.strasse || "", zip: k.stammdaten?.plz || "", city: k.stammdaten?.ort || "",
  });
  const [busy, setBusy] = useState(false);
  const ref = k.zahlung?.ref || k.buchungen?.[0]?.ref || null;
  const speichern = async () => {
    if (!ref) { melden("schlecht", "Keine Bestellung", "Ohne Bestellung gibt es keine Akte, an der die Daten hängen."); return; }
    setBusy(true);
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`, { method: "POST", body: JSON.stringify(f) });
    setBusy(false);
    if (!r.ok) { melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Gespeichert", "Die Änderungen stehen mit altem und neuem Wert in der Akte.");
    await onFertig();
  };
  const feld = (key: keyof typeof f, label: string, breit = false) => (
    <label className={breit ? "breit" : ""}>{label}<input className="pi-eingabe" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></label>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="pi-form">
        {feld("firstName", "Vorname")}{feld("lastName", "Nachname")}
        {feld("phone", "Telefon", true)}{feld("street", "Straße", true)}
        {feld("zip", "PLZ")}{feld("city", "Ort")}
      </div>
      <div className="pi-reihe">
        <button type="button" className="pi-knopf klein" onClick={() => void speichern()} disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
        <span className="pi-luecke">Geburtsdatum und Land ändert die Vertriebsleitung.</span>
      </div>
    </div>
  );
}
