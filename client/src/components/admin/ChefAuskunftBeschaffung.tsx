// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/auskunft-beschaffung — DER ARBEITSPLATZ DER BESCHAFFUNG (25.09.2026, E-241)
//
// Justin: „Ich kümmere mich heute um die API, bis dahin kaufen wir sie selbst."
// Jede bezahlte Bonitätsauskunft wird hier ein Auftrag. Die Karte zeigt alles,
// was man zum Bestellen braucht — Name, Geburtsdatum, Anschrift samt
// Voranschrift, Land, Auskunfteien mit Anschrift, bezahlt am, fällig ab und ob
// eine Einwilligung dokumentiert ist —, jedes Feld mit Kopierknopf. Wer die
// Auskunft beschafft hat, lädt das PDF hoch: Die Akte bekommt sie als
// Auskunft-Dokument, die Analyse startet, der Kunde bekommt „Ihre Auskunft ist
// da". Fehlt die Einwilligung, schickt „Auftragsbestätigung senden" den Link
// zur Bestätigung des Beschaffungsauftrags (25.09.2026, E-241 — vorher der
// Link zur Vollmacht auf /app/unterschrift: Die deckt nur die kostenlose
// Datenkopie, nicht den Kauf). Der Rückstand (bezahlt, nie geliefert) steht von
// selbst hier — ohne Mail an die Kunden.
//
// E-252 (28.09.2026) — Endfassung E-250, von Justin freigegeben. Dieselben
// Aufträge und Taten, neu geordnet:
//   · Statuszeile mit der Lieferweg-Wahl — die EINZIGE Stelle für den Wert
//     (vorher zusätzlich „Liefermodus" im Verkauf; derselbe Schalter). Die
//     Rückfrage steht im Fluss darunter, wortgleich.
//   · Links WEN: eine Filterliste statt sechs Kacheln und sechs Reitern (es
//     waren dieselben Zahlen), Suche, die Namen, die Regeln im Aufklapper.
//   · Rechts das GLAS: der gewählte Auftrag (Inhalt unverändert). Am Handy
//     steht die Liste zuerst; Antippen rollt zum Auftrag.
//   · Meldungen am Auslöser statt fest unten. /chef/s/auskunft-beschaffung
//     zeigt dieselbe Komponente als eigene Seite (ohne Lage des Steuerpults).
//
// Server: server/routes/fiaon-chef-auskunft-beschaffung.ts · Regeln:
// server/lib/fiaon-auskunft-lieferung.ts (Abschnitt 5) · API: fiaon-auskunft-quelle.ts
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { API, seit, zahl, eur, Geruest, Fehlermeldung, useDaten, ruhig } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { useMaraLage, useMaraRundgang, useMeldung, Meldung, InfoKnopf, type MeldungStand } from "./mara-lage";
import "@/styles/office-rundgang.css";
// E-252: Die Bausteine des Steuerpults (.mara-*) — auch auf der eigenen Seite, deshalb hier selbst geladen.
import "@/styles/chef-mara.css";
import "@/styles/chef-auskunft-beschaffung.css";

type Modus = "einkauf" | "vollmacht" | "api";
type Status = "offen" | "in_arbeit" | "hochgeladen" | "fertig" | "problem";
interface Stelle { key: string; kurz: string; name: string; anschrift: string | null; geliefert: boolean }
interface Auftrag {
  id: number; ref: string; personId: number; land: "DE" | "AT" | "CH"; art: "privat" | "firma"; status: Status;
  faelligAb: string; faellig: boolean; quelle: string; modus: string;
  bearbeiter: string | null; uebernommenAm: string | null; notiz: string | null;
  geliefert: string[]; letzteLieferung: string[]; hochgeladenAm: string | null; hochgeladenVon: string | null;
  mailStatus: string | null; mailAm: string | null; vollmachtLinkAm: string | null; vollmachtLinkAnzahl: number;
  apiVersuchAm: string | null; apiFehler: string | null; fertigAm: string | null; angelegtAm: string;
  bestellung: { betragCents: number | null; bezahltAm: string | null; bestelltAm: string | null; verwendungszweck: string | null; paket: string | null; zahlStatus: string | null; bezahlt: boolean };
  kunde: {
    name: string; vorname: string; nachname: string; geburtsdatum: string | null; strasse: string | null; plz: string | null; ort: string | null;
    voranschrift: { strasse: string | null; plz: string | null; ort: string | null; land: string | null } | null;
    email: string | null; telefon: string | null; firma: { name: string | null; rechtsform: string | null } | null;
  };
  stellen: Stelle[];
  einwilligung: { ja: boolean; quelle: string | null; text: string };
  dokumentDa: boolean; vorgaengeLaufend: number; anschriftFehlt: boolean; betreuer: string | null;
}
/** E-IT-D (08.10.2026, 4a): Sammelknopf, Wache, benannte Verantwortung (beschaffungSammelStand). */
interface Sammel {
  ohneEinwilligung: number; linkJetzt: number; liegtUeberFrist: number; anrufFaellig: number; datenkopie: number; nochNichtDatenkopie: number;
  verantwortlich: { id: number; name: string } | null; auswahl: { id: number; name: string; rolle: string }[];
}
interface Stand {
  stand: string; modus: Modus; apiAngebunden: boolean; unterschriftAn: boolean; pdfMaxMb: number; rueckstandNeu: number;
  sammel?: Sammel;
  zahlen: { jetzt: number; einwilligungFehlt: number; wartet: number; mailFehlt: number; problem: number; offen: number; fertig30: number };
  auftraege: Auftrag[];
}

// E-252: „mailFehlt" ist neu als eigener Filter (vorher führte die Kachel „Mail fehlt" auf „Jetzt beschaffen").
type Reiter = "jetzt" | "vollmacht" | "wartet" | "mailFehlt" | "problem" | "fertig" | "alle";
/** Die Filterliste (vorher sechs Kacheln und sechs Reiter mit denselben Zahlen) — Zahl = was die Liste darunter zeigt. */
const FILTER: { key: Reiter; text: string; satz: string; ton: "akz" | "warn" | "krit" | "gut" | "" }[] = [
  { key: "jetzt", text: "Jetzt beschaffen", satz: "Einwilligung da, fällig", ton: "akz" },
  { key: "vollmacht", text: "Auftrag fehlt", satz: "erst bestätigen lassen, dann kaufen", ton: "warn" },
  { key: "wartet", text: "Wartet auf Frist", satz: "Widerrufsfrist läuft", ton: "" },
  { key: "mailFehlt", text: "Mail fehlt", satz: "hochgeladen, Kunde weiß es nicht", ton: "krit" },
  { key: "problem", text: "Problem", satz: "mit Notiz", ton: "krit" },
  { key: "fertig", text: "Fertig", satz: "letzte 30 Tage", ton: "gut" },
  { key: "alle", text: "Alle", satz: "jeder Auftrag, auch fertige", ton: "" },
];
const LAND: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const STATUS_TEXT: Record<Status, string> = { offen: "offen", in_arbeit: "in Arbeit", hochgeladen: "Mail fehlt", fertig: "fertig", problem: "Problem" };
const STATUS_TON: Record<Status, string> = { offen: "", in_arbeit: "akz", hochgeladen: "krit", fertig: "gut", problem: "krit" };
const MODUS_TEXT: Record<Modus, { name: string; satz: string }> = {
  einkauf: { name: "Einkauf", satz: "Nach der Zahlung entsteht hier ein Auftrag; ihr beschafft die Auskunft und ladet sie hoch." },
  vollmacht: { name: "Vollmacht", satz: "Der Weg vom 24.09.: je Auskunftei eine Anfrage, der Kunde unterschreibt, Versand per Post, Eingang im Vorgang." },
  api: { name: "API", satz: "Wie Einkauf, dazu der Abruf über die Schnittstelle. Ohne Anbindung oder bei einem Fehler bleibt der Auftrag im Einkauf." },
};
/** So viele Namen stehen zuerst in der Liste — danach „Weitere zeigen" (keine innere Rolle). */
const LISTE_SCHRITT = 15;

/** „2026-10-09" → „09.10.2026" */
const tagText = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const datumText = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "—");
const zeitText = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—");

// E-252 (28.09.2026, Gegenprüfung): Jeder Auftrag steht in genau einem Filter, und die Zahl ist die Länge der
// Liste. „Mail fehlt" (hochgeladen) steht nur noch dort — nicht zusätzlich unter „Jetzt beschaffen", wie es die
// Server-Zahl `zahlen.jetzt` auch nie gezählt hat. Einzige verbleibende Abweichung von `zahlen.jetzt`: Ein offener
// Auftrag, dessen Auskunft schon in der Akte liegt (dokumentDa), bleibt unter „Jetzt beschaffen" sichtbar — die
// Zeile sagt es („Auskunft liegt schon in der Akte"); der Server zählt ihn dort nicht.
function reiterVon(a: Auftrag): Exclude<Reiter, "alle"> {
  if (a.status === "fertig") return "fertig";
  if (a.status === "problem") return "problem";
  // Gegenlesen 25.09.2026 (E-241): nicht mehr bezahlt (erstattet, storniert) ist ein Problem, kein Einkauf.
  if (a.bestellung.bezahlt === false) return "problem";
  if (a.status === "hochgeladen") return "mailFehlt";
  if (!a.einwilligung.ja) return "vollmacht";
  if (!a.faellig) return "wartet";
  return "jetzt";
}
const imFilter = (a: Auftrag, f: Reiter) => f === "alle" || reiterVon(a) === f;

/** Eine Zeile unter dem Namen in der Liste — was an diesem Auftrag gerade zählt. */
function kurzStand(a: Auftrag): string {
  if (a.status === "fertig") return `fertig ${datumText(a.fertigAm)}`;
  const teile = [STATUS_TEXT[a.status]];
  if (a.bearbeiter) teile.push(a.bearbeiter);
  if (a.bestellung.bezahlt === false) teile.push("nicht mehr bezahlt");
  if (a.anschriftFehlt) teile.push("Anschrift fehlt");
  if (a.dokumentDa) teile.push("Auskunft liegt schon in der Akte");
  if (!a.einwilligung.ja) teile.push("Auftrag fehlt");
  else if (!a.faellig) teile.push(`fällig ab ${tagText(a.faelligAb)}`);
  return teile.join(" · ");
}

async function senden(pfad: string, body?: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

function anschrift(t: { strasse: string | null; plz: string | null; ort: string | null; land?: string | null } | null): string | null {
  if (!t) return null;
  const z = [t.strasse, [t.plz, t.ort].filter(Boolean).join(" "), t.land].filter((x) => String(x ?? "").trim());
  return z.length ? z.join(", ") : null;
}

/** E-252: Rückfrage im Fluss statt window.confirm (Text wortgleich) — hier nur für den Lieferweg. */
interface Frage { text: string; ja: string; tat: () => void }
function Rueckfrage({ f, onZu }: { f: Frage | null; onZu: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!f || !el) return;
    el.scrollIntoView({ block: "nearest", behavior: ruhig() ? "auto" : "smooth" });
    try { el.focus({ preventScroll: true }); } catch { /* nur hinrollen */ }
  }, [f]);
  if (!f) return null;
  return (
    <div ref={ref} tabIndex={-1} className="mara-rueckfrage akb-frage" role="alertdialog" aria-label="Rückfrage">
      {f.text}
      <div className="mara-knoepfe">
        <button type="button" className="mara-knopf haupt klein" onClick={() => { onZu(); f.tat(); }}>{f.ja}</button>
        <button type="button" className="mara-knopf klein" onClick={onZu}>Abbrechen</button>
      </div>
    </div>
  );
}

type Melden = (t: string, ort: string, fehler?: boolean) => void;
type Ausfuehren = (schluessel: string, tat: () => Promise<string | void>, ort: string) => Promise<void>;

export default function ChefAuskunftBeschaffung() {
  const ml = useMaraLage();
  const rg = useMaraRundgang();
  const stand = useDaten<Stand>("/chef/auskunft-beschaffung");
  const s = stand.daten;
  const [reiter, setReiter] = useState<Reiter>("jetzt");
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [menge, setMenge] = useState(LISTE_SCHRITT);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [frage, setFrage] = useState<Frage | null>(null);
  const [infoOffen, setInfoOffen] = useState(false);
  const { meldung, melden, zu } = useMeldung();
  const glasRef = useRef<HTMLElement>(null);

  const ausfuehren: Ausfuehren = async (schluessel, tat, ort) => {
    setBeschaeftigt(schluessel);
    try {
      const t = await tat();
      if (t) melden(t, ort);
      stand.neu();
      // E-252: Der Umschalter „Beschaffung · n offen" und der Liefermodus im Verkauf lesen /chef/auskunft — mitziehen.
      ml?.quellen.auskunft.neu();
    } catch (err: any) { melden(err?.message || "Das hat nicht geklappt.", ort, true); } finally { setBeschaeftigt(null); }
  };

  const zaehler = useMemo(() => {
    const z: Record<Reiter, number> = { jetzt: 0, vollmacht: 0, wartet: 0, mailFehlt: 0, problem: 0, fertig: 0, alle: 0 };
    for (const a of s?.auftraege ?? []) { z[reiterVon(a)]++; z.alle++; }
    return z;
  }, [s]);
  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (s?.auftraege ?? [])
      .filter((a) => imFilter(a, reiter))
      .filter((a) => !q || `${a.kunde.name} ${a.ref} ${a.kunde.email ?? ""} ${a.bestellung.verwendungszweck ?? ""}`.toLowerCase().includes(q));
  }, [s, reiter, suche]);
  // Der gewählte Auftrag bleibt im Glas, auch wenn er nach einer Tat den Filter verlässt (z. B. „Abschließen") —
  // sonst stünde die Rückmeldung plötzlich an einem anderen Kunden.
  const angezeigt = (gewaehlt != null ? s?.auftraege.find((a) => a.id === gewaehlt) : undefined) ?? liste[0] ?? null;

  const filterWaehlen = (f: Reiter) => { setReiter(f); setGewaehlt(null); setMenge(LISTE_SCHRITT); };
  const auftragWaehlen = (id: number) => {
    setGewaehlt(id);
    // Am Handy steht der Auftrag unter der Liste — Antippen rollt hin.
    if (window.matchMedia?.("(max-width: 980px)").matches) {
      window.requestAnimationFrame(() => glasRef.current?.scrollIntoView({ block: "start", behavior: ruhig() ? "auto" : "smooth" }));
    }
  };
  /** Taten einer Karte halten ihren Auftrag im Glas fest. */
  const karteAusfuehren = (id: number): Ausfuehren => (schluessel, tat, ort) => { setGewaehlt(id); return ausfuehren(schluessel, tat, ort); };

  const modusSetzen = (m: Modus) => {
    if (!s || m === s.modus) return;
    const warnung = m === "vollmacht"
      ? "Ab der nächsten Zahlung entstehen wieder Anfragen je Auskunftei (Unterschrift, Versand per Post) statt eines Beschaffungsauftrags. Bestehende Aufträge hier bleiben."
      : m === "api"
        ? `Ab der nächsten Zahlung wird mit bestätigtem Beschaffungsauftrag gleich über die API abgerufen.${s.apiAngebunden ? "" : " Die API ist noch NICHT angebunden — bis dahin bleibt jeder Auftrag im Einkauf von Hand."}`
        : "Ab der nächsten Zahlung entsteht hier ein Auftrag, und ihr beschafft die Auskunft selbst.";
    setFrage({
      text: `Lieferweg auf „${MODUS_TEXT[m].name}“ stellen?\n\n${warnung}`, ja: "Ja, umstellen",
      tat: () => void ausfuehren("modus", async () => { await senden("/chef/auskunft-beschaffung/modus", { modus: m }); return `Lieferweg: ${MODUS_TEXT[m].name}.`; }, "status"),
    });
  };

  const filterText = FILTER.find((f) => f.key === reiter)?.text ?? "";

  return (
    <div className="akb mara">
      {/* Gegenlesen 25.09.2026: raum nur Kleinbuchstaben und Bindestrich — der Server merkt ihn kleingeschrieben (fiaon-office-einfuehrung.ts). */}
      <Rundgang raum="auskunft-beschaffung" titel="Auskunft-Beschaffung" schritte={RUNDGAENGE.auskunftBeschaffung.schritte} {...rg} />
      {/* Als eigene Seite (/chef/s/auskunft-beschaffung) trägt sie ihren Namen selbst; im Steuerpult steht er im Umschalter. */}
      {!ml && <h1 className="akb-titel">Auskunft-Beschaffung</h1>}
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && !s && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {stand.fehler && s && (
        <p className="mara-still mara-klein">
          Neu laden ging nicht ({stand.fehler}) — es steht der letzte Stand.{" "}
          <button type="button" className="mara-knopf text" onClick={stand.neu}>Nochmal</button>
        </p>
      )}
      {s && (
        <>
          {/* ── Status: der Lieferweg — die EINZIGE Stelle für diesen Wert ── */}
          <div className="mara-status akb-status">
            <div className="st voll">
              <span className="mara-etikett">Lieferweg</span>
              <div className="akb-modus" role="radiogroup" aria-label="Lieferweg">
                {(["einkauf", "vollmacht", "api"] as Modus[]).map((m) => (
                  <button key={m} type="button" role="radio" className={s.modus === m ? "an" : ""} aria-checked={s.modus === m}
                    disabled={beschaeftigt === "modus"} onClick={() => modusSetzen(m)} title={MODUS_TEXT[m].satz}>
                    {MODUS_TEXT[m].name}
                  </button>
                ))}
              </div>
              <InfoKnopf offen={infoOffen} onClick={() => setInfoOffen((x) => !x)} label="Was der Lieferweg heißt" />
            </div>
            <div className="st">
              <span className={`mara-pille ${s.apiAngebunden ? "gut" : "warn"}`}>{s.apiAngebunden ? "API angebunden" : "API noch nicht angebunden"}</span>
              {/* E-241: Die Unterschrift in der App zählt nur noch im Vollmacht-Weg — die Auftragsbestätigung hängt nicht daran. */}
              {s.modus === "vollmacht" && (
                <span className={`mara-pille umbruch ${s.unterschriftAn ? "gut" : "krit"}`}>{s.unterschriftAn ? "Unterschrift in der App an" : "Unterschrift in der App aus — keine Vollmacht-Links"}</span>
              )}
            </div>
            {s.modus === "api" && (
              <div className="st">
                <button type="button" className="mara-knopf klein" disabled={beschaeftigt === "api"}
                  onClick={() => void ausfuehren("api", async () => {
                    const j = await senden("/chef/auskunft-beschaffung/api-abrufen");
                    return j.versucht ? `${j.geliefert} von ${j.versucht} über die API geliefert. ${(j.texte ?? []).slice(0, 2).join(" · ")}` : "Heute ist nichts mit bestätigtem Auftrag fällig.";
                  }, "status")}>
                  {beschaeftigt === "api" ? "Ruft ab …" : "Fällige über die API abrufen"}
                </button>
              </div>
            )}
            <div className="st rechts"><span className="mara-still mara-klein">Stand {seit(s.stand)} · gilt auch für den Verkauf</span></div>
          </div>
          {infoOffen && (
            <div className="mara-info">
              <b>Lieferweg {MODUS_TEXT[s.modus].name}:</b> {MODUS_TEXT[s.modus].satz} Bezahlte Bonitätsauskünfte beschaffen und hochladen — die Akte, die Analyse und die Mail an den Kunden folgen von selbst.
            </div>
          )}
          <Rueckfrage f={frage} onZu={() => setFrage(null)} />
          <Meldung m={meldung} ort="status" onZu={zu} />
          {s.rueckstandNeu > 0 && (
            <div className="mara-hinweise">
              <p className="mara-hinweis warn"><span className="mara-punkt warn" aria-hidden="true" /><span>{zahl(s.rueckstandNeu)} bezahlte Auskünfte aus dem Rückstand sind eben als Aufträge dazugekommen — die Kunden haben dafür keine Mail bekommen.</span></p>
            </div>
          )}

          {/* ── E-IT-D (08.10.2026, 4a): DEN RÜCKSTAND LIEFERN ────────────────────────────────────────
              Justin: „Rückstand über den Datenkopie-Weg liefern: Sammelknopf ‚Vollmacht/Auftragsbestätigung an
              alle offenen senden‘ über die bestehende Funktion; Liegezeit-Wache mit benannter Verantwortung." */}
          {s.sammel && (
            <div className="mara-hinweise akb-sammel" data-akb-sammel>
              <p className={`mara-hinweis ${s.sammel.ohneEinwilligung ? "warn" : ""}`}>
                <span className={`mara-punkt ${s.sammel.ohneEinwilligung ? "warn" : "gut"}`} aria-hidden="true" />
                <span>
                  <b>Rückstand liefern (Datenkopie-Weg):</b> {zahl(s.sammel.ohneEinwilligung)} bezahlte Aufträge warten auf die Auftragsbestätigung des Kunden
                  {" · "}{zahl(s.sammel.linkJetzt)} bekämen jetzt den Link{" · "}{zahl(s.sammel.liegtUeberFrist)} beschaffbar und über der Frist
                  {" · "}{zahl(s.sammel.anrufFaellig)} Anrufe fällig{s.sammel.datenkopie ? ` · ${zahl(s.sammel.datenkopie)} schon auf Datenkopie` : ""}.
                  {" "}Der Sammelknopf stellt alle offenen, bezahlten Aufträge auf den Datenkopie-Weg (FIAON fordert die Datenkopie nach Art. 15 DSGVO im Namen des Kunden an) und schickt jedem Kunden ohne Bestätigung die Mail „Bitte bestätigen Sie kurz Ihren Auftrag“ — ohne „kostenlos“, höchstens einmal in 72 Stunden je Auftrag.
                </span>
              </p>
              <div className="mara-knoepfe">
                <button type="button" className="mara-knopf haupt klein" disabled={(!s.sammel.linkJetzt && !s.sammel.nochNichtDatenkopie) || beschaeftigt === "sammel"}
                  onClick={() => setFrage({
                    text: `Auftragsbestätigung an ${s.sammel!.linkJetzt} Kunden senden?\n\nJeder bekommt eine Mail mit dem Knopf „Auftrag bestätigen“ (Datenkopie nach Art. 15 DSGVO, in seinem Namen angefordert). ${s.sammel!.nochNichtDatenkopie} offene Aufträge gehen dabei auf den Datenkopie-Weg (wer schon bestätigt hat, ohne Mail); Verlauf und Protokoll halten es fest.`,
                    ja: "Ja, an alle senden",
                    tat: () => void ausfuehren("sammel", async () => (await senden("/chef/auskunft-beschaffung/auftrag-links-alle")).text, "status"),
                  })}>
                  {beschaeftigt === "sammel" ? "Sendet …" : `Auftragsbestätigung an alle offenen senden (${zahl(s.sammel.linkJetzt)})`}
                </button>
                <button type="button" className="mara-knopf klein" disabled={beschaeftigt === "wache"}
                  onClick={() => void ausfuehren("wache", async () => (await senden("/chef/auskunft-beschaffung/wache")).text, "status")}>
                  {beschaeftigt === "wache" ? "Prüft …" : "Liegezeit-Wache jetzt prüfen"}
                </button>
                <label className="mara-klein" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  Verantwortlich:
                  <select className="mara-eingabe" style={{ minHeight: 32, width: "auto" }} value={s.sammel.verantwortlich?.id ?? ""} disabled={beschaeftigt === "verantwortlich"}
                    onChange={(e) => { const v = e.target.value; void ausfuehren("verantwortlich", async () => (await senden("/chef/auskunft-beschaffung/verantwortlich", { agentId: v ? Number(v) : null })).text, "status"); }}>
                    <option value="">Leitung (Betreiber-Brett)</option>
                    {s.sammel.auswahl.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              </div>
              <p className="mara-still mara-klein">Die Wache läuft alle sechs Stunden: beschaffbar und seit drei Werktagen fällig → Aufgabe an {s.sammel.verantwortlich?.name ?? "die Leitung"} (ab zehn Werktagen dringend); Link seit drei Werktagen unbestätigt → Anruf-Aufgabe an den Betreuer. Je Auftrag und Stufe genau eine Aufgabe.</p>
            </div>
          )}

          {/* Handy: erst die Liste (Antippen rollt zum Auftrag), dann das Glas — .wen-zuerst. */}
          <div className="mara-spalten wen-zuerst">
            <section className="mara-wen akb-wen" aria-labelledby="akb-wen-titel">
              <div className="mara-wen-kopf akb-wen-kopf">
                <h2 id="akb-wen-titel">Welche Aufträge</h2>
                <span className="mara-still mara-klein">{s.zahlen.offen ? `${zahl(s.zahlen.offen)} offen` : "nichts offen"}</span>
              </div>
              <div className="akb-zahlen" role="group" aria-label="Filter">
                {FILTER.map((f) => {
                  const n = zaehler[f.key];
                  const ton = n > 0 && f.ton ? ` mara-${f.ton}-t` : "";
                  return (
                    <button key={f.key} type="button" className={reiter === f.key ? "an" : ""} aria-pressed={reiter === f.key} onClick={() => filterWaehlen(f.key)}>
                      <span>{f.text}</span>
                      {n > 0 ? <b className={`akb-n${ton}`}>{zahl(n)}</b> : <b className="akb-n wort">keine</b>}
                      <small>{f.satz}</small>
                    </button>
                  );
                })}
              </div>
              <input type="search" className="mara-eingabe akb-suche" placeholder="Name, Bestellung, E-Mail" value={suche}
                onChange={(e) => { setSuche(e.target.value); setGewaehlt(null); }} aria-label="Suchen" />
              {liste.length === 0 ? (
                <p className="mara-still mara-klein akb-liste-leer">{reiter === "jetzt" ? "Gerade ist nichts zu beschaffen." : "Hier steht gerade nichts."}</p>
              ) : (
                <ul className="akb-auftraege" aria-label="Aufträge">
                  {liste.slice(0, menge).map((a) => {
                    const an = angezeigt?.id === a.id;
                    return (
                      <li key={a.id}>
                        <button type="button" className={an ? "an" : ""} aria-current={an ? "true" : undefined} onClick={() => auftragWaehlen(a.id)}>
                          <span className="akb-name">{a.kunde.name}</span>
                          <small>{kurzStand(a)}</small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {liste.length > menge && (
                <button type="button" className="mara-knopf klein akb-mehr" onClick={() => setMenge((m) => m + LISTE_SCHRITT)}>
                  Weitere {zahl(Math.min(LISTE_SCHRITT, liste.length - menge))} zeigen · {zahl(liste.length)} insgesamt
                </button>
              )}
              <details className="mara-klappe akb-regeln">
                <summary>Die Regeln der Beschaffung</summary>
                <ul>
                  <li><b>Kaufen nur mit Beschaffungsauftrag.</b> Er liegt vor, wenn der Kunde an der Kauftür (Bestellseite, Kauflink, Kaufkarte) den Auftrag angehakt oder ihn über den Link aus der Mail bestätigt hat. Nur er deckt den Kauf einer kostenpflichtigen Auskunft in seinem Namen.</li>
                  <li><b>Vollmacht zur Übermittlung</b> (älterer Haken der Bestellseite, unterschriebene Vollmacht mit „Selbstauskunft“): deckt nur die kostenlose Datenkopie — seine Anfrage übermitteln und die Antwort entgegennehmen, keinen Kauf. Für einen Kauf erst „Auftragsbestätigung senden“.</li>
                  <li><b>Fehlt die Einwilligung</b> (Betreuer, Mara, Altbestellung), schickt „Auftragsbestätigung senden“ den Link: Der Kunde sieht Bestellung und Leistung und bestätigt mit einem Haken. Danach springt der Auftrag von selbst auf „Jetzt beschaffen“.</li>
                  <li><b>Fällig ab:</b> Hat der Kunde den Beginn vor Ablauf der Widerrufsfrist nicht verlangt, erst ab dem Tag nach dem Fristende. Vorher nicht anfordern.</li>
                  <li><b>Hochladen:</b> nur PDF, bis {s.pdfMaxMb} MB je Datei, mehrere Dateien werden zu einer gebunden. Kommt eine Auskunftei später, einfach nachladen — sie wird angehängt. Sind alle schon gelieferten mit angehakt, ersetzt die neue Datei die alte (ohne zweite Mail).</li>
                  <li>Gegenüber dem Kunden: nie etwas zusagen, was die Auskunftei oder die Bank entscheidet. Die kostenlose Datenkopie steht ihm immer zu — wer fragt, bekommt die ehrliche Antwort.</li>
                </ul>
              </details>
            </section>

            {/* ── GLAS: der gewählte Auftrag — die EINE Glasfläche ────────── */}
            {/* E-252 (28.09.2026, Gegenprüfung): Nur im Steuerpult ist die Karte Glas. Die eigene Seite
                /chef/s/auskunft-beschaffung behält die Chefbüro-Hülle (Kopf, Leiste, Knopf sind dort schon Glas, dazu
                laufen Filme) — dort ist die Karte matt, sonst läge eine vierte Glasfläche über einem laufenden Film. */}
            <section ref={glasRef} className={`${ml ? "mara-glas" : "mara-karte"} akb-glas`} id="akb-karte" aria-label="Auftrag">
              {angezeigt ? (
                <AuftragKarte key={angezeigt.id} a={angezeigt} beschaeftigt={beschaeftigt} ausfuehren={karteAusfuehren(angezeigt.id)}
                  melden={melden} meldung={meldung} zu={zu} pdfMaxMb={s.pdfMaxMb} />
              ) : (
                <div className="akb-karte akb-karte-leer">
                  <h2>Kein Auftrag in „{filterText}“</h2>
                  <p className="mara-leise mara-klein">
                    {suche.trim() ? "Die Suche findet hier niemanden." : reiter === "jetzt" ? "Gerade ist nichts zu beschaffen." : "Hier steht gerade nichts."}
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Feld({ label, wert, melden }: { label: string; wert: string | null; melden: Melden }) {
  const kopieren = async () => {
    if (!wert) return;
    try { await navigator.clipboard.writeText(wert); melden(`${label} kopiert.`, "k-bestellen"); } catch { melden("Kopieren ging nicht — bitte markieren und kopieren.", "k-bestellen", true); }
  };
  return (
    <div className={`akb-feld${wert ? "" : " leer"}`}>
      <dt>{label}</dt>
      <dd>
        <span>{wert ?? "fehlt"}</span>
        {wert && <button type="button" className="mara-knopf klein akb-kopie" onClick={() => void kopieren()} aria-label={`${label} kopieren`}>kopieren</button>}
      </dd>
    </div>
  );
}

function AuftragKarte({ a, beschaeftigt, ausfuehren, melden, meldung, zu, pdfMaxMb }: {
  a: Auftrag; beschaeftigt: string | null; pdfMaxMb: number;
  ausfuehren: Ausfuehren; melden: Melden; meldung: MeldungStand; zu: () => void;
}) {
  const offenStellen = a.stellen.filter((st) => !st.geliefert);
  const [auswahl, setAuswahl] = useState<string[]>(offenStellen.map((st) => st.key));
  // Gegenlesen 25.09.2026 (E-241): Nach einer Lieferung steht die Auswahl wieder auf dem, was noch
  // fehlt — eine stehengebliebene Auswahl mit schon Geliefertem ersetzte sonst die frühere Datei.
  const geliefertSchluessel = a.geliefert.join(",");
  useEffect(() => { setAuswahl(a.stellen.filter((st) => !st.geliefert).map((st) => st.key)); }, [geliefertSchluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dateien, setDateien] = useState<File[]>([]);
  const [upload, setUpload] = useState(false);
  const fertig = a.status === "fertig";
  const k = a.kunde;
  const zumBestellen = [
    ["Name", k.name], ["Geburtsdatum", k.geburtsdatum], ["Anschrift", anschrift(k)],
    ...(k.voranschrift ? [["Voranschrift", anschrift(k.voranschrift)]] : []),
    ["E-Mail", k.email], ["Telefon", k.telefon],
    ...(k.firma ? [["Firma", k.firma.name], ["Rechtsform", k.firma.rechtsform]] : []),
  ] as [string, string | null][];
  const block = zumBestellen.filter(([, w]) => w).map(([l, w]) => `${l}: ${w}`).concat(`Land: ${LAND[a.land]}`).join("\n");
  const aktion = (was: string, frage?: string, ort = "k-fuss") => {
    let notiz = "";
    if (frage) {
      const eingabe = window.prompt(frage);
      if (eingabe === null) return;
      notiz = eingabe;
    }
    void ausfuehren(`${was}:${a.id}`, async () => (await senden(`/chef/auskunft-beschaffung/${a.id}/aktion`, { aktion: was, notiz })).text, ort);
  };
  const linkSenden = () => {
    const nochmal = !!a.vollmachtLinkAm;
    if (!window.confirm(nochmal
      ? `Den Link zur Auftragsbestätigung noch einmal an ${k.name} schicken?\n\nZuletzt am ${zeitText(a.vollmachtLinkAm)} (${a.vollmachtLinkAnzahl}× gesendet).`
      : `Den Link zur Auftragsbestätigung an ${k.name} schicken?\n\nDer Kunde bekommt eine Mail: Wir beschaffen seine Auskunft, dafür fehlt nur seine kurze Bestätigung des Auftrags (ein Klick, ein Haken).`)) return;
    void ausfuehren(`link:${a.id}`, async () => (await senden(`/chef/auskunft-beschaffung/${a.id}/auftrag-link`, { nochmal })).text, "k-oben");
  };
  // E-241: Der Knopf steht, solange kein Beschaffungsauftrag vermerkt ist — auch bei einer Vollmacht
  // zur Übermittlung (die deckt nur die kostenlose Datenkopie, keinen Kauf).
  const auftragDa = a.einwilligung.quelle === "auftrag";
  const hochladen = () => {
    if (!dateien.length) { melden("Bitte zuerst die PDF-Datei wählen.", "k-hochladen", true); return; }
    if (!auswahl.length) { melden("Bitte angeben, von welcher Auskunftei die Datei stammt.", "k-hochladen", true); return; }
    const zuGross = dateien.find((d) => d.size > pdfMaxMb * 1024 * 1024);
    if (zuGross) { melden(`„${zuGross.name}“ ist größer als ${pdfMaxMb} MB.`, "k-hochladen", true); return; }
    const namen = a.stellen.filter((st) => auswahl.includes(st.key)).map((st) => st.kurz).join(", ");
    if (!window.confirm(`${namen} für ${k.name} hochladen?\n\nDie Auskunft kommt in die Akte, die Analyse startet, und der Kunde bekommt die Mail „Ihre Auskunft ist da“.`)) return;
    void ausfuehren(`hoch:${a.id}`, async () => {
      const fd = new FormData();
      for (const d of dateien) fd.append("datei", d, d.name);
      fd.append("auskunfteien", auswahl.join(","));
      const r = await fetch(`${API}/chef/auskunft-beschaffung/${a.id}/hochladen`, { method: "POST", credentials: "include", body: fd });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Das Hochladen ist gescheitert.");
      setDateien([]); setUpload(false);
      return `${j.text}${j.hinweis ? ` ${j.hinweis}` : ""}`;
    }, "k-hochladen");
  };
  const bereitZumKaufen = a.einwilligung.ja && a.faellig && a.bestellung.bezahlt !== false;

  return (
    <article className={`akb-karte st-${a.status}`}>
      <div className="akb-karte-kopf">
        <div className="akb-wer">
          <h2><a href={`/chef/s/akte?id=${a.personId}`}>{k.name}</a></h2>
          <span className="mara-pille">{LAND[a.land]}</span>
          {a.art === "firma" && <span className="mara-pille akz">Firma</span>}
          {a.quelle === "rueckstand" && <span className="mara-pille warn">Rückstand</span>}
          {/* E-IT-D (4a): FIAON fordert die Datenkopie nach Art. 15 DSGVO im Namen des Kunden an. */}
          {a.modus === "datenkopie" && <span className="mara-pille akz" title="FIAON fordert die Datenkopie nach Art. 15 DSGVO im Namen des Kunden an — dafür genügt auch die Vollmacht zur Übermittlung.">Datenkopie</span>}
          <span className={`mara-pille ${STATUS_TON[a.status]}`}>{STATUS_TEXT[a.status]}</span>
        </div>
        <span className="mara-still mara-klein">
          bezahlt {datumText(a.bestellung.bezahltAm ?? a.angelegtAm)}{a.bestellung.betragCents != null ? ` · ${eur(a.bestellung.betragCents)}` : ""} · {a.ref}{a.betreuer ? ` · Betreuer ${a.betreuer}` : ""}
        </span>
      </div>

      <div className="akb-ampel">
        <div className={`akb-schritt ${a.einwilligung.ja ? "gut" : "halt"}`}>
          <span className="mara-etikett">Einwilligung</span>
          <b>{auftragDa ? "Auftrag liegt vor" : a.einwilligung.ja ? (a.modus === "datenkopie" ? "genügt (Datenkopie)" : "nur Datenkopie") : "fehlt"}</b>
          <small>{a.einwilligung.ja ? a.einwilligung.text : a.vollmachtLinkAm ? `Link gesendet ${zeitText(a.vollmachtLinkAm)}${a.vollmachtLinkAnzahl > 1 ? ` (${a.vollmachtLinkAnzahl}×)` : ""} — wartet auf Bestätigung` : "noch kein Link gesendet"}</small>
          {!auftragDa && !fertig && (
            <button type="button" className={`mara-knopf klein${a.einwilligung.ja ? "" : " haupt"}`} disabled={beschaeftigt === `link:${a.id}`} onClick={linkSenden}>
              {beschaeftigt === `link:${a.id}` ? "Sendet …" : a.vollmachtLinkAm ? "Link erneut senden" : "Auftragsbestätigung senden"}
            </button>
          )}
        </div>
        <div className={`akb-schritt ${a.faellig ? "gut" : "warte"}`}>
          <span className="mara-etikett">Fällig ab</span>
          <b>{a.faellig ? "heute" : tagText(a.faelligAb)}</b>
          <small>{a.faellig ? (a.einwilligung.ja ? "darf beschafft werden" : "sobald der Auftrag bestätigt ist") : "Beginn vor Ablauf der Widerrufsfrist nicht verlangt — vorher nicht anfordern"}</small>
        </div>
        <div className={`akb-schritt ${a.bearbeiter ? "gut" : ""}`}>
          <span className="mara-etikett">Wer beschafft</span>
          <b>{a.bearbeiter ?? "noch niemand"}</b>
          <small>{a.uebernommenAm ? `seit ${zeitText(a.uebernommenAm)}` : "übernehmen, damit niemand doppelt kauft"}</small>
          {!a.bearbeiter && !fertig && (
            <button type="button" className="mara-knopf klein" disabled={beschaeftigt === `uebernehmen:${a.id}`} onClick={() => aktion("uebernehmen", undefined, "k-oben")}>Übernehmen</button>
          )}
        </div>
      </div>
      <Meldung m={meldung} ort="k-oben" onZu={zu} />

      {(a.anschriftFehlt || a.dokumentDa || a.vorgaengeLaufend > 0 || a.apiFehler || a.bestellung.bezahlt === false) && !fertig && (
        <div className="mara-hinweise akb-warnungen">
          {a.bestellung.bezahlt === false && <p className="mara-hinweis krit"><span className="mara-punkt krit" aria-hidden="true" /><span>Die Bestellung steht nicht mehr auf bezahlt ({a.bestellung.zahlStatus ?? "unbekannt"}) — nicht beschaffen. Erst klären (Widerruf, Erstattung?), dann „Abschließen“ mit Grund.</span></p>}
          {a.anschriftFehlt && <p className="mara-hinweis krit"><span className="mara-punkt krit" aria-hidden="true" /><span>In der Akte fehlt die Anschrift — erst erfragen. Ohne sie ordnet keine Auskunftei zu.</span></p>}
          {a.dokumentDa && <p className="mara-hinweis warn"><span className="mara-punkt warn" aria-hidden="true" /><span>In der Akte liegt schon eine Auskunft (auf anderem Weg hochgeladen). Prüfen, dann „Abschließen“ — oder die gekaufte hier hochladen.</span></p>}
          {a.vorgaengeLaufend > 0 && <p className="mara-hinweis warn"><span className="mara-punkt warn" aria-hidden="true" /><span>{a.vorgaengeLaufend} Anfrage{a.vorgaengeLaufend === 1 ? "" : "n"} aus dem Vollmacht-Weg laufen noch (Vorgänge) — nicht doppelt beschaffen.</span></p>}
          {a.apiFehler && <p className="mara-hinweis warn"><span className="mara-punkt warn" aria-hidden="true" /><span>API: {a.apiFehler}{a.apiVersuchAm ? ` (${zeitText(a.apiVersuchAm)})` : ""}</span></p>}
        </div>
      )}

      <div className="akb-raster">
        <section aria-label="Zum Bestellen">
          <div className="akb-block-kopf">
            <span className="mara-etikett">Zum Bestellen</span>
            <button type="button" className="mara-knopf klein akb-kopie" onClick={() => void navigator.clipboard.writeText(block).then(() => melden("Alle Angaben kopiert.", "k-bestellen")).catch(() => melden("Kopieren ging nicht.", "k-bestellen", true))}>alles kopieren</button>
          </div>
          <dl className="akb-felder">
            {zumBestellen.map(([l, w]) => <Feld key={l} label={l} wert={w} melden={melden} />)}
          </dl>
          <Meldung m={meldung} ort="k-bestellen" onZu={zu} />
        </section>
        <section aria-label="Auskunfteien">
          <div className="akb-block-kopf"><span className="mara-etikett">Bei wem</span><span className="mara-still mara-klein">{LAND[a.land]}</span></div>
          <ul className="akb-stellen">
            {a.stellen.map((st) => (
              <li key={st.key} className={st.geliefert ? "da" : ""}>
                <b>{st.kurz}{st.geliefert ? " · geliefert" : ""}</b>
                <span>{st.name}{st.anschrift ? ` · ${st.anschrift}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {a.notiz && <pre className="akb-notiz">{a.notiz}</pre>}

      {!fertig && (
        <div className="akb-hochladen">
          {!upload ? (
            <button type="button" className={`mara-knopf${bereitZumKaufen ? " haupt" : ""}`} onClick={() => setUpload(true)}>PDF hochladen</button>
          ) : (
            <div className="akb-upload">
              {!bereitZumKaufen && (
                <p className="mara-hinweis warn">
                  <span className="mara-punkt warn" aria-hidden="true" />
                  <span>{a.bestellung.bezahlt === false ? "Nicht mehr bezahlt — nicht beschaffen." : !a.einwilligung.ja ? "Ohne Einwilligung nicht selbst beschaffen." : `Vor dem ${tagText(a.faelligAb)} nicht anfordern.`} Hochladen nur, was der Kunde selbst geschickt hat.</span>
                </p>
              )}
              <label className="akb-datei">
                <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => setDateien(Array.from(e.target.files ?? []))} />
                <span>{dateien.length ? dateien.map((d) => d.name).join(", ") : `PDF wählen (bis ${pdfMaxMb} MB, mehrere möglich)`}</span>
              </label>
              <fieldset className="akb-wahl">
                <legend>In der Datei steckt die Auskunft von</legend>
                {/* Gegenlesen 25.09.2026: auch schon Geliefertes wählbar — sind ALLE früheren angehakt,
                    ersetzt die neue Datei die alte (Ausweg bei einer geschützten früheren Datei). */}
                {a.stellen.map((st) => (
                  <label key={st.key}>
                    <input type="checkbox" checked={auswahl.includes(st.key)}
                      onChange={(e) => setAuswahl(e.target.checked ? [...auswahl, st.key] : auswahl.filter((x) => x !== st.key))} />
                    {st.kurz}{st.geliefert ? " (schon geliefert)" : ""}
                  </label>
                ))}
              </fieldset>
              <div className="mara-reihe">
                <button type="button" className="mara-knopf haupt" disabled={beschaeftigt === `hoch:${a.id}`} onClick={hochladen}>
                  {beschaeftigt === `hoch:${a.id}` ? "Lädt hoch …" : "Hochladen und Kunde benachrichtigen"}
                </button>
                <button type="button" className="mara-knopf klein" onClick={() => { setUpload(false); setDateien([]); }}>abbrechen</button>
              </div>
            </div>
          )}
          <Meldung m={meldung} ort="k-hochladen" onZu={zu} />
        </div>
      )}

      <div className="akb-fuss">
        <span className="mara-still mara-klein">
          {a.status === "fertig" ? `fertig ${zeitText(a.fertigAm)}` : `angelegt ${seit(a.angelegtAm)}`}
          {a.hochgeladenAm ? ` · hochgeladen ${zeitText(a.hochgeladenAm)}${a.hochgeladenVon ? ` von ${a.hochgeladenVon}` : ""}` : ""}
          {a.mailStatus === "gesendet" ? ` · Mail an den Kunden ${zeitText(a.mailAm)}` : ""}
        </span>
        {/* E-252: alle Taten stehen immer da; was gerade nicht passt, ist gesperrt und sagt im title, warum. */}
        <div className="akb-taten">
          <button type="button" className={`mara-knopf klein${a.status === "hochgeladen" ? " haupt" : ""}`}
            disabled={a.status !== "hochgeladen" || beschaeftigt === `mail:${a.id}`} title={a.status === "hochgeladen" ? undefined : "erst nach dem Hochladen"}
            onClick={() => void ausfuehren(`mail:${a.id}`, async () => (await senden(`/chef/auskunft-beschaffung/${a.id}/mail`)).text, "k-fuss")}>
            Mail erneut senden
          </button>
          <button type="button" className="mara-knopf klein" onClick={() => aktion("notiz", "Notiz zu diesem Auftrag:")}>Notiz</button>
          <button type="button" className="mara-knopf klein" disabled={fertig || a.status === "problem"}
            title={fertig ? "Der Auftrag ist fertig." : a.status === "problem" ? "Steht schon auf „Problem“." : undefined}
            onClick={() => aktion("problem", "Was ist das Problem? (z. B. Auskunftei verlangt Ausweiskopie)")}>Problem</button>
          <button type="button" className="mara-knopf klein" disabled={!(a.status === "problem" || fertig)}
            title={a.status === "problem" || fertig ? undefined : "nur bei fertigen Aufträgen oder bei einem Problem"}
            onClick={() => aktion("wieder_offen")}>Wieder öffnen</button>
          <button type="button" className="mara-knopf klein" disabled={fertig} title={fertig ? "Der Auftrag ist schon fertig." : undefined}
            onClick={() => aktion("abschliessen", "Ohne Upload abschließen — warum? (Der Kunde bekommt keine Mail.)")}>Abschließen</button>
        </div>
      </div>
      <Meldung m={meldung} ort="k-fuss" onZu={zu} />
    </article>
  );
}
