// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara?reiter=auskunft — AUSKUNFT-VERKAUF (24.09.2026, E-240; seit 26.09.2026 Reiter „Bonitätsauskunft" im Mara-Steuerpult, E-243)
//
// Justin: Die Bonitätsauskunft soll „weggehen wie warme Semmeln", Ziel 150 am
// Tag. Die Seite sagt ehrlich, wo wir stehen: bestellt und bezahlt heute
// gegen das Ziel, die letzten 14 Tage, wer sie noch nicht hat, wer bestellt
// und nicht bezahlt hat, wer bezahlt hat und noch wartet. Dazu der Schalter
// des Verkaufstakts und die WhatsApp-Vorlage, die erst bei Meta freigegeben
// werden muss.
//
// 25.09.2026 (E-241) — Justin: „an ALLE, die keine Auskunft hinterlegt oder
// gekauft haben … jeden Tag 30 per WhatsApp und 500 Mails." Die Seite ist
// jetzt der Verkauf auf einen Blick und steuerbar:
//   · Heute als Trichter: angeschrieben → geklickt → bestellt → bezahlt → geliefert,
//     dazu Umsatz und das Ziel 150 als Balken;
//   · Steuerung: Schalter, Kreis (uwg/alle), Mails je Tag, WhatsApp je Tag,
//     Liefermodus — jede Änderung mit wer/wann/alt → neu im Protokoll darunter;
//   · der Trichter je Weg und je Segment (heute oder 14 Tage), die 14 Tage mit
//     Ziel-Balken, der Vorrat und „wer als Nächstes";
//   · der Zähler der Beschaffung (/chef/s/auskunft-beschaffung).
//
// 26.09.2026 (E-243) — Justin: „stelle mit sofortiger Wirkung den Verkauf der
// Bonitätsauskunft scharf". Oben ein Band mit EINEM Knopf „Verkauf scharf
// stellen" (Takt an, Kreis „alle", 500 Mails, 20 WhatsApp, Einkauf) und
// „Anhalten"; vor dem Scharfstellen eine Rückfrage mit den Zahlen (je Segment im
// Kreis, heute fällig, WhatsApp-fähig) und dem Rechtssatz. Dazu das Segment
// „Abbrecher", das Sendefenster Mo–So 07:00–20:30 und der Stand der
// WhatsApp-Vorlagen bei Meta (eingereicht, freigegeben, abgelehnt).
//
// Server: server/routes/fiaon-chef-auskunft.ts · Regeln: server/lib/fiaon-auskunft-verkauf.ts
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API, seit, zahl, eur, datumZeit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
// Die Preise aus der EINEN Quelle — nie ein Literal (74 € stand an 139 Stellen, E-240).
import { auskunftPreisZeile } from "@shared/fiaon-auskunft";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-auskunft.css";

type Land = "DE" | "AT" | "CH";
type Stufe = "angeschrieben" | "geklickt" | "bestellt" | "bezahlt" | "geliefert";
type Weg = "mail" | "whatsapp" | "mara" | "kundenbereich" | "oeffentlich" | "betreuer" | "unbekannt";
type Segment = "kunde" | "antrag" | "abbrecher" | "lead";
type Kreis = "uwg" | "alle";
type Liefermodus = "einkauf" | "vollmacht" | "api";
type Werte = Record<Stufe, number>;
interface TrichterZeile<K extends string> { schluessel: K; heute: Werte; summe: Werte; umsatzHeuteCents: number; umsatzSummeCents: number }
interface Trichter {
  stufen: Stufe[];
  tage: { tag: string; werte: Werte; umsatzCents: number }[];
  heute: { tag: string; werte: Werte; umsatzCents: number };
  summe: { werte: Werte; umsatzCents: number };
  jeWeg: TrichterZeile<Weg>[];
  jeSegment: TrichterZeile<Segment>[];
  anschreibendeWege: Weg[];
}
interface Einstellungen {
  an: boolean; kreis: Kreis; mailsProTag: number; waProTag: number; liefermodus: Liefermodus;
  hoechstensMails: number; hoechstensWa: number; apiAngebunden: boolean;
}
interface ProtokollZeile { zeit: string; schluessel: string; text: string; wer: string }
/** Ein Segment im Vorrat des Takts (poolZahlen, fiaon-auskunft-verkauf.ts). */
interface SegmentZahlen {
  segment: Segment; gesamt: number; erreichbar: number; imKreis: number; heuteFaellig: number;
  stufen: { a: number; wa: number; b: number; c: number };
  mitWhatsAppEinwilligung: number; gesperrt: Record<string, number>; hatAuskunft: number;
  /** E-243: im Kreis und WhatsApp-fähig (Einwilligung, Handy). */
  imKreisMitWhatsApp?: number;
}
interface Pool {
  // E-240 (Segment A)
  gesamt: number; werbesperre: number; widerspruch: number; nichtZustellbar: number; nachStichtag: number;
  automatisch: number; nurGezaehlt: number; mitWhatsAppEinwilligung: number; schonAngeschrieben: number;
  // E-241
  kreis: Kreis; segmente: Record<Segment, SegmentZahlen>; gesperrt: Record<string, number>; leadsOhnePerson: number; heuteFaellig: number;
}
interface Offen {
  ref: string; personId: number | null; name: string; status: string; gemeldetAm: string | null; betrag: string | null;
  angelegt: string; tage: number; land: Land; betreuer: string | null; werbesperre: boolean;
  zahlungsseite: string | null; verwendungszweck: string | null;
}
interface Rueck { personId: number; ref: string; name: string; land: string; auskunfteien: string; gekauftAm: string; tageSeitKauf: number; betreuer: string | null; vorgaenge: number }
interface Stand {
  stand: string;
  ziel: number;
  trichter: Trichter;
  pool: Pool;
  segmentText: Record<Segment, string>;
  sperrgrundText: Record<string, string>;
  einstellungen: Einstellungen;
  protokoll: ProtokollZeile[];
  beschaffung: { offen: number; ueberfaellig: number; nichtEingelesen: number; ueberfaelligAbTagen: number; quelle: "beschaffung" | "rueckstand" };
  offen: Offen[];
  rueckstand: { zeilen: Rueck[]; quelle: "lieferung" | "eigen" };
  takt: {
    an: boolean; mailsProTag: number; waProTag: number;
    heute: { mails: number; whatsapp: number; gesamt: number };
    sendezeit: boolean; stichtag: string; hoechstensBeruehrungen: number;
    whatsapp: { moeglich: boolean; grund: string | null };
    /** E-243: das Sendefenster Mo–So. */
    fenster?: { ab: string; bis: string };
  };
  wirkung30: { angeschrieben: number; bestellt: number; bezahlt: number; whatsapp: number };
  vorlage: WaVorlage | null;
  /** Integration 25.09.2026 (E-241): beide Vorlagen des Takts — Kunden (A) und Anträge/Leads (B, C). */
  vorlagen?: WaVorlage[];
  /** E-243: das Einreichen der fehlenden Vorlagen (Knopf „Verkauf scharf stellen"). */
  einreichen?: EinreichenStand;
}
type MetaStatus = "freigegeben" | "eingereicht" | "abgelehnt" | "pausiert" | "fehlt" | "unbekannt";
interface WaVorlage {
  name: string; fuer?: string; kopf: string; fuss: string; kategorie: string; text: string; beispiel: string;
  knoepfe: string[]; entwurf: boolean; freigegeben: boolean | null;
  /** E-243: der Stand bei Meta — Textfassung und (falls es sie gibt) Bildfassung. */
  meta?: MetaStatus; metaBild?: MetaStatus | null;
}
interface EinreichenStand {
  laeuft: boolean; seit: string | null; bis: string | null; eingereicht: string[]; schonDa: number;
  fehler: { name: string; grund: string }[]; abbruch: string | null;
}
/** Die Rückfrage vor „Verkauf scharf stellen" (GET /chef/auskunft/scharf) — immer im Kreis „alle". */
interface ScharfDaten {
  segmente: {
    segment: Segment; text: string; kurz: string; imKreis: number; heuteFaellig: number; heuteMoeglich: number; waHeute: number; waFaehig: number; gesperrt: number;
  }[];
  summe: { imKreis: number; heuteFaellig: number; heuteMoeglich: number; waHeute: number; waFaehig: number; gesperrt: number };
  deckel: { mails: number; whatsapp: number };
  gesperrt: Record<string, number>; sperrgrundText: Record<string, string>;
  fenster: { ab: string; bis: string }; rechtssatz: string;
  whatsapp: { moeglich: boolean; grund: string | null };
  vorlagen: WaVorlage[]; einreichen: EinreichenStand;
}
interface VorschauZeile {
  personId: number; name: string; land: Land; art: "privat" | "firma"; segment: Segment; schritt: string | null;
  fassung: string | null; preis: string; mail: string; kundeSeit: string | null; aktivAm: string | null; ersteMailAm: string | null;
  /** E-243: Kauflink geöffnet, nicht bestellt — deshalb vorn in der WhatsApp-Reihe. */
  klickAm?: string | null;
}
interface Vorschau { whatsapp: VorschauZeile[]; mails: VorschauZeile[]; waGrund: string | null; restHeute: { mails: number; whatsapp: number } }

const SCHRITT: Record<string, string> = { mail1: "Mail a", whatsapp: "WhatsApp", mail2: "Mail b", mail3: "Mail c" };
const STUFEN: Stufe[] = ["angeschrieben", "geklickt", "bestellt", "bezahlt", "geliefert"];
const STUFE_NAME: Record<Stufe, string> = { angeschrieben: "Angeschrieben", geklickt: "Geklickt", bestellt: "Bestellt", bezahlt: "Bezahlt", geliefert: "Geliefert" };
const STUFE_WAS: Record<Stufe, string> = {
  angeschrieben: "Menschen mit Angebot", geklickt: "Kauflink geöffnet", bestellt: "Bestellungen",
  bezahlt: "Zahlungen eingegangen", geliefert: "Auskunft in der Akte",
};
const WEG_NAME: Record<Weg, string> = {
  mail: "E-Mail", whatsapp: "WhatsApp", mara: "Mara", kundenbereich: "Kundenbereich",
  oeffentlich: "Öffentliche Seite", betreuer: "Betreuer", unbekannt: "Ohne Herkunft",
};
/** Die fünf Wege aus Justins Auftrag stehen immer da; Betreuer und „ohne Herkunft" nur, wenn etwas darin ist. */
const WEG_IMMER: Weg[] = ["mail", "whatsapp", "mara", "kundenbereich", "oeffentlich"];
/** Im Trichter gilt das Segment zum Zeitpunkt der Stufe (Server: SEGMENT_ZUM_ZEITPUNKT_SQL). */
const SEGMENT_NAME: Record<string, string> = {
  kunde: "A · Kunde (Paket bezahlt)", antrag: "B · Antrag ohne Zahlung", abbrecher: "Abbrecher · Antrag begonnen", lead: "C · Lead ohne Antrag",
};
const SEGMENTE: Segment[] = ["kunde", "antrag", "abbrecher", "lead"];
const KREIS_TEXT: Record<Kreis, { name: string; satz: string }> = {
  uwg: { name: "Nur § 7 Abs. 3 UWG", satz: "Nur wer seit dem Widerspruchs-Hinweis im Antrag zum ersten Mal beantragt hat." },
  // E-243: Justins Zielgruppe — jeder mit E-Mail, ohne Stornierte und ohne wer die Auskunft schon hat.
  alle: { name: "Alle ohne Auskunft", satz: "Kunden, Anträge, Abbrecher und Leads mit E-Mail — ohne Stornierte, Gekündigte und wer die Auskunft schon hat oder bestellt hat." },
};
/** Justins Entscheidung vom 25./26.09.2026 — wörtlich so auf der Seite (Aufträge E-241, E-243). */
const ALLE_HINWEIS = "Werbe-Mails auch an Kunden vor dem 02.09. und an Anträge, Abbrecher und Leads ohne Einwilligung — Justins Entscheidung vom 25./26.09.; Werbesperre, Abmeldung und Vertriebssperre gelten immer.";
/** E-243: der Stand einer Vorlage bei Meta in unseren Worten. */
const META_TEXT: Record<MetaStatus, { text: string; farbe: "gruen" | "gelb" | "rot" | "" }> = {
  freigegeben: { text: "bei Meta freigegeben", farbe: "gruen" },
  eingereicht: { text: "eingereicht — Meta prüft", farbe: "gelb" },
  abgelehnt: { text: "von Meta abgelehnt", farbe: "rot" },
  pausiert: { text: "von Meta pausiert", farbe: "rot" },
  fehlt: { text: "noch nicht eingereicht", farbe: "gelb" },
  unbekannt: { text: "Stand bei Meta unbekannt", farbe: "" },
};
const LIEFER_TEXT: Record<Liefermodus, { name: string; satz: string }> = {
  einkauf: { name: "Einkauf", satz: "Bis die Schnittstelle steht, kaufen wir die Auskunft selbst ein — was zu kaufen ist, steht in der Beschaffung." },
  vollmacht: { name: "Vollmacht", satz: "Der Kunde unterschreibt die Vollmacht, wir fordern seine Datenkopien bei den Auskunfteien an." },
  api: { name: "Schnittstelle", satz: "Abruf über die Schnittstelle — erst wählen, wenn sie angebunden ist." },
};
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const tagText = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${WOCHENTAG[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
};
const stichtagText = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const prozent = (teil: number, ganz: number) => (ganz > 0 ? `${(Math.round((teil / ganz) * 1000) / 10).toLocaleString("de-DE")} %` : "—");

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

/** Ein Wahlschalter aus zwei oder drei Knöpfen — die gewählte Möglichkeit ist gefüllt. */
function Wahl<T extends string>({ werte, wert, namen, onWahl, gesperrt, klein, label }: {
  werte: T[]; wert: T; namen: Record<string, string>; onWahl: (v: T) => void; gesperrt?: boolean; klein?: boolean; label: string;
}) {
  return (
    <div className={`ak-wahl${klein ? " klein" : ""}`} role="radiogroup" aria-label={label}>
      {werte.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={v === wert} className={v === wert ? "an" : ""}
          disabled={gesperrt} onClick={() => { if (v !== wert) onWahl(v); }}>
          {namen[v] ?? v}
        </button>
      ))}
    </div>
  );
}

/** Heute gegen einen Deckel — ein schmaler Balken, Zahl daneben. */
function Verbrauch({ heute, deckel, einheit }: { heute: number; deckel: number; einheit: string }) {
  const anteil = deckel > 0 ? Math.min(100, (heute / deckel) * 100) : 0;
  return (
    <div className="ak-verbrauch" aria-label={`heute ${heute} von ${deckel} ${einheit}`}>
      <div className="ak-verbrauch-balken"><i style={{ width: `${anteil}%` }} /></div>
      <span>heute {zahl(heute)} / {zahl(deckel)} {einheit}</span>
    </div>
  );
}

export default function ChefAuskunft() {
  const stand = useDaten<Stand>("/chef/auskunft");
  const s = stand.daten;
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [mails, setMails] = useState<string>("");
  const [wa, setWa] = useState<string>("");
  const [einstNeu, setEinstNeu] = useState<{ e: Einstellungen; p: ProtokollZeile[] } | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [zeitraum, setZeitraum] = useState<"heute" | "summe">("heute");
  const [nach, setNach] = useState<"weg" | "segment">("weg");
  const [alleOffen, setAlleOffen] = useState(false);
  const [alleRueck, setAlleRueck] = useState(false);
  const [alleProtokoll, setAlleProtokoll] = useState(false);
  // E-243: „Verkauf scharf stellen" — Rückfrage mit Zahlen, dann der Knopf; danach das Einreichen der Vorlagen.
  const [scharf, setScharf] = useState<ScharfDaten | null>(null);
  const [einreichen, setEinreichen] = useState<EinreichenStand | null>(null);
  const [vorlagenLive, setVorlagenLive] = useState<WaVorlage[] | null>(null);

  // Nach jedem Laden gilt der Stand des Servers — eine lokale Änderung davor ist dann darin enthalten.
  useEffect(() => { setEinstNeu(null); setEinreichen(null); setVorlagenLive(null); }, [s]);
  const einreichenJetzt = einreichen ?? s?.einreichen ?? null;
  // Solange das Einreichen läuft, alle 4 Sekunden nachfragen (höchstens drei Minuten) — Meta braucht je Vorlage Sekunden.
  useEffect(() => {
    if (!einreichenJetzt?.laeuft) return;
    let runden = 0;
    const t = window.setInterval(async () => {
      runden++;
      try {
        const r = await fetch(`${API}/chef/auskunft/vorlagen`, { credentials: "include" });
        const j = await r.json().catch(() => null);
        if (j?.ok) { setVorlagenLive(j.vorlagen ?? null); setEinreichen(j.einreichen ?? null); }
      } catch { /* nächste Runde */ }
      if (runden >= 45) window.clearInterval(t);
    }, 4000);
    return () => window.clearInterval(t);
  }, [einreichenJetzt?.laeuft]);
  const e = einstNeu?.e ?? s?.einstellungen ?? null;
  const protokoll = einstNeu?.p ?? s?.protokoll ?? [];
  useEffect(() => { if (e) { setMails(String(e.mailsProTag)); setWa(String(e.waProTag)); } }, [e?.mailsProTag, e?.waProTag]);
  // „Wer als Nächstes" lädt einmal von selbst, sobald der Stand da ist — nur lesen.
  useEffect(() => { if (s && !vorschau) void vorschauLaden(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [s]);

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 7000); };

  const setzen = async (key: string, value: string, fertig: string, id: string) => {
    setBeschaeftigt(id);
    try {
      const j = await senden("/chef/auskunft/einstellung", { key, value });
      setEinstNeu({ e: j.einstellungen, p: j.protokoll ?? [] });
      melden(j.geaendert === false ? "Unverändert — der Wert stand schon so." : fertig);
      // Gegenlesen 25.09.2026 (E-241): Kreis und Tagesdeckel ändern den Vorrat („Im Kreis", „Heute fällig")
      // und „Wer als Nächstes" — ohne neues Laden zeigte die Seite bis zum Neuladen die Zahlen des alten Kreises.
      if (j.geaendert !== false && (id === "kreis" || id === "mails" || id === "wa")) {
        setVorschau(null);
        stand.neu();
      }
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };

  const fenster = s?.takt.fenster ?? { ab: "07:00", bis: "20:30" };
  const schalten = (an: boolean) => {
    if (!s || !e) return;
    if (an && !window.confirm(
      `Verkaufstakt einschalten?\n\nAb dem nächsten Takt (alle 30 Minuten, Mo–So ${fenster.ab}–${fenster.bis}) bekommen bis zu ${e.mailsProTag} Menschen am Tag das Angebot per E-Mail`
      + ` und bis zu ${e.waProTag} per WhatsApp (nur mit Einwilligung und freigegebener Vorlage).\n\n`
      + (e.kreis === "alle"
        ? `Kreis „alle“: ${ALLE_HINWEIS}`
        : `Kreis „uwg“: nur wer nach dem ${stichtagText(s.takt.stichtag)} zum ersten Mal beantragt hat (§ 7 Abs. 3 UWG).`))) return;
    void setzen("auskunft_verkauf_an", an ? "1" : "0",
      an ? "Der Verkaufstakt läuft — der nächste Takt schreibt an, wer dran ist." : "Der Verkaufstakt ist aus. Es geht nichts mehr raus.", "schalter");
  };
  const kreisWaehlen = (k: Kreis) => {
    if (k === "alle" && !window.confirm(`Kreis auf „alle“ stellen?\n\n${ALLE_HINWEIS}\n\nDie Änderung steht mit deinem Namen im Protokoll.`)) return;
    void setzen("auskunft_verkauf_kreis", k, k === "alle" ? "Kreis „alle“ — ab dem nächsten Takt." : "Kreis „uwg“ — nur § 7 Abs. 3 UWG.", "kreis");
  };
  // ── E-243: Verkauf scharf stellen ──────────────────────────────────────
  /** Erst die Zahlen holen (Kreis „alle"), dann fragt die Seite — nichts wird dabei geändert. */
  const scharfFragen = async () => {
    setBeschaeftigt("scharf-laden");
    try {
      const r = await fetch(`${API}/chef/auskunft/scharf`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Die Zahlen für die Rückfrage ließen sich nicht laden.");
      setScharf(j as ScharfDaten);
      window.setTimeout(() => document.querySelector(".ak-rueckfrage")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const scharfStellen = async () => {
    setBeschaeftigt("scharf");
    try {
      const j = await senden("/chef/auskunft/scharf", {});
      setEinstNeu({ e: j.einstellungen, p: j.protokoll ?? [] });
      // Das Einreichen bei Meta läuft im Hintergrund — sein Stand sofort im Band, bis der neue Stand geladen ist.
      if (j.einreichen) setEinreichen(j.einreichen);
      setScharf(null);
      melden(j.geaendert?.length ? "Der Verkauf ist scharf — der nächste Takt schreibt an, wer dran ist." : "Alles stand schon so — der Verkauf ist scharf.");
      setVorschau(null);
      stand.neu();
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const anhalten = () => {
    if (!e?.an) return;
    if (!window.confirm("Verkauf anhalten?\n\nAb sofort geht keine Angebots-Mail und keine WhatsApp mehr raus. Kreis und Tagesdeckel bleiben stehen — „Verkauf scharf stellen“ startet ihn wieder.")) return;
    void setzen("auskunft_verkauf_an", "0", "Der Verkauf ist angehalten. Es geht nichts mehr raus.", "schalter");
  };

  const liefermodusWaehlen = (m: Liefermodus) => {
    if (m === "api" && e && !e.apiAngebunden && !window.confirm("Liefermodus „Schnittstelle“ wählen?\n\nDie Schnittstelle ist noch nicht angebunden — bis dahin bleibt jede bezahlte Auskunft im Einkauf.")) return;
    void setzen("auskunft_liefermodus", m, `Liefermodus: ${LIEFER_TEXT[m].name}.`, "liefer");
  };

  async function vorschauLaden() {
    setBeschaeftigt("vorschau");
    try {
      const r = await fetch(`${API}/chef/auskunft/vorschau`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Die Vorschau ließ sich nicht laden.");
      setVorschau({
        whatsapp: j.whatsapp ?? [], mails: j.mails ?? [], waGrund: j.waGrund ?? null,
        restHeute: { mails: Number(j.restHeute?.mails || 0), whatsapp: Number(j.restHeute?.whatsapp || 0) },
      });
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  }
  // Integration 25.09.2026 (E-240): Die Lieferung des Rückstands von Hand starten — die Lieferung
  // selbst verweist in ihren Aufgaben hierher („… im Chefbüro unter Auskunft-Rückstand neu starten").
  const liefern = async (r: Rueck, mail: boolean) => {
    // Integration 25.09.2026 (E-241): Der Satz folgt dem Lieferweg — im Einkauf (und bei „api") entsteht ein
    // Beschaffungsauftrag (/chef/s/auskunft-beschaffung), nur im Vollmacht-Weg Anfragen je Auskunftei.
    const einkauf = (e?.liefermodus ?? "einkauf") !== "vollmacht";
    if (!window.confirm(einkauf
      ? (mail
        ? `Lieferung für ${r.name} starten?\n\nEs entsteht ein Beschaffungsauftrag (${r.auskunfteien}) auf der Seite „Auskunft-Beschaffung“. Fehlt seine Einwilligung, bekommt der Kunde einmal per Mail den Link zur Auftragsbestätigung.`
        : `Lieferung für ${r.name} ohne Mail starten?\n\nEs entsteht ein Beschaffungsauftrag auf der Seite „Auskunft-Beschaffung“; fehlt seine Einwilligung, dort „Auftragsbestätigung senden“.`)
      : (mail
        ? `Lieferung für ${r.name} starten?\n\nEs entstehen die Anfragen an ${r.auskunfteien}, der Betreuer bekommt die Aufgabe, und der Kunde bekommt per Mail den Link zur Unterschrift (Vollmacht und Anfragen).`
        : `Lieferung für ${r.name} ohne Mail starten?\n\nEs entstehen die Anfragen und die Aufgabe; der Betreuer holt die Unterschrift im Gespräch.`))) return;
    setBeschaeftigt(`liefern:${r.ref}`);
    try {
      const j = await senden("/chef/auskunft/lieferung", { ref: r.ref, mail });
      melden(String(j.lieferung?.text || "Erledigt."));
      stand.neu();
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const kopieren = async (text: string) => {
    try { await navigator.clipboard.writeText(text); melden("Zahlungslink kopiert."); } catch { melden("Kopieren ging nicht — bitte den Link öffnen und dort kopieren."); }
  };

  const t = s?.trichter;
  const heute = t?.heute.werte;
  const anteil = (n: number) => `${Math.min(100, s && s.ziel > 0 ? (n / s.ziel) * 100 : 0)}%`;
  const offenListe = s ? (alleOffen ? s.offen : s.offen.slice(0, 12)) : [];
  const rueckListe = s ? (alleRueck ? s.rueckstand.zeilen : s.rueckstand.zeilen.slice(0, 12)) : [];
  const protokollListe = alleProtokoll ? protokoll : protokoll.slice(0, 5);
  const zeilen: TrichterZeile<string>[] = !t ? [] : nach === "weg"
    ? t.jeWeg.filter((z) => WEG_IMMER.includes(z.schluessel) || STUFEN.some((st) => z.summe[st] > 0))
    : t.jeSegment;
  const wert = (z: TrichterZeile<string>, st: Stufe) => (zeitraum === "heute" ? z.heute[st] : z.summe[st]);
  const gemessen = (z: TrichterZeile<string>, st: Stufe) =>
    nach === "segment" || (st !== "angeschrieben" && st !== "geklickt") || (t?.anschreibendeWege ?? []).includes(z.schluessel as Weg);
  const gesamt = t ? (zeitraum === "heute" ? { werte: t.heute.werte, umsatz: t.heute.umsatzCents } : { werte: t.summe.werte, umsatz: t.summe.umsatzCents }) : null;
  // Gegenlesen 25.09.2026 (E-241): Die Quote der Summenzeile rechnet wie die Zeilen darüber — je Weg nur
  // die Wege, die anschreiben (sonst hob eine Bestellung aus dem Kundenbereich die Quote der Mails).
  const quoteZaehler = !t ? 0 : nach === "weg"
    ? t.jeWeg.filter((z) => t.anschreibendeWege.includes(z.schluessel)).reduce((n, z) => n + z.summe.bezahlt, 0)
    : t.summe.werte.bezahlt;
  const quoteTitel = nach === "weg" ? "bezahlt je angeschrieben — nur Wege, die anschreiben" : "bezahlt (auf jedem Weg) je angeschrieben, im selben Segment";
  const tageNeu = t ? [...t.tage].reverse() : [];
  const vorlagenListe: WaVorlage[] = vorlagenLive ?? s?.vorlagen ?? (s?.vorlage ? [s.vorlage] : []);
  const istScharf = !!e && e.an && e.kreis === "alle";

  return (
    <div className="ak">
      <Rundgang raum="auskunft" titel="Auskunft-Verkauf" schritte={RUNDGAENGE.auskunft.schritte} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && t && heute && e && (
        <>
          <header className="ak-kopf">
            <div>
              <h1>Auskunft-Verkauf</h1>
              <p>
                Bonitätsauskunft mit Handlungsplan — privat {auskunftPreisZeile("privat")}; Firma {auskunftPreisZeile("firma")}.
                Stand {seit(s.stand)}.
              </p>
            </div>
            <div className="ak-kopf-rechts">
              <a className="ak-beschaffung" href="/chef/s/mara?reiter=auskunft&ansicht=beschaffung"
                aria-label={`Beschaffung: ${s.beschaffung.offen} offen, ${s.beschaffung.ueberfaellig} überfällig (länger als ${s.beschaffung.ueberfaelligAbTagen} Tage)`}>
                <span className="ak-beschaffung-titel">Beschaffung</span>
                <span><b>{zahl(s.beschaffung.offen)}</b> offen</span>
                <span className={s.beschaffung.ueberfaellig > 0 ? "rot" : ""}><b>{zahl(s.beschaffung.ueberfaellig)}</b> überfällig</span>
                {s.beschaffung.nichtEingelesen > 0 && <span><b>+{zahl(s.beschaffung.nichtEingelesen)}</b> zum Einlesen</span>}
              </a>
              <button type="button" className={`ak-schalter${e.an ? " an" : ""}`} aria-pressed={e.an}
                onClick={() => schalten(!e.an)} disabled={beschaeftigt === "schalter"}>
                <span aria-hidden="true" />{e.an ? (s.takt.sendezeit ? "Verkauf läuft" : "Verkauf läuft · Nachtruhe") : "Verkauf aus"}
              </button>
            </div>
          </header>

          {/* ── E-243: Verkauf scharf stellen ─────────────────────────── */}
          <section className={`ak-scharf${istScharf ? " an" : ""}`} aria-label="Verkauf scharf stellen">
            <div className="ak-scharf-text">
              <h2>{istScharf ? "Der Verkauf ist scharf." : e.an ? "Der Verkauf läuft — aber nicht im Kreis „alle“." : "Der Verkauf ist nicht scharf."}</h2>
              <p>
                {istScharf
                  ? `Kreis „alle“ · ${zahl(e.mailsProTag)} Mails und ${zahl(e.waProTag)} WhatsApp am Tag · Mo–So ${fenster.ab}–${fenster.bis} · Liefermodus ${LIEFER_TEXT[e.liefermodus].name}.`
                  : `Ein Klick stellt alles auf einmal: Takt an, Kreis „alle“, 500 Mails und 20 WhatsApp am Tag (Mo–So ${fenster.ab}–${fenster.bis}), Liefermodus Einkauf — und reicht die fehlenden WhatsApp-Vorlagen bei Meta ein. Vorher zeigt die Seite, wen das betrifft.`}
              </p>
              <div className="ak-scharf-vorlagen" aria-label="WhatsApp-Vorlagen bei Meta">
                {vorlagenListe.map((v) => {
                  const m = META_TEXT[v.meta ?? (v.freigegeben ? "freigegeben" : "unbekannt")];
                  return <span key={v.name} className={`ak-marke ${m.farbe}`}>{v.name}: {m.text}</span>;
                })}
                {einreichenJetzt?.laeuft && <span className="ak-still">Einreichen bei Meta läuft …</span>}
                {einreichenJetzt && !einreichenJetzt.laeuft && einreichenJetzt.bis && (
                  <span className="ak-still">
                    Zuletzt eingereicht {datumZeit(einreichenJetzt.bis)}: {zahl(einreichenJetzt.eingereicht.length)} neu, {zahl(einreichenJetzt.schonDa)} schon da
                    {einreichenJetzt.fehler.length ? `, ${einreichenJetzt.fehler.length} mit Fehler (${einreichenJetzt.fehler.map((f) => `${f.name}: ${f.grund}`).join(" · ").slice(0, 240)})` : ""}
                  </span>
                )}
                {einreichenJetzt?.abbruch && <span className="ak-still">{einreichenJetzt.abbruch}</span>}
                {/* Gegenlesen 26.09.2026 (E-243): Justin hat den Takt am 26.09. um 15:09 über die alte Steuerung eingeschaltet —
                    das Band steht dann schon auf „scharf", die Vorlagen fehlen aber bei Meta. Das muss hier stehen. */}
                {istScharf && !einreichenJetzt?.laeuft && vorlagenListe.some((v) => v.meta === "fehlt") && (
                  <span className="ak-still">Ohne eingereichte Vorlage keine WhatsApp — „Erneut scharf stellen“ reicht sie bei Meta ein.</span>
                )}
              </div>
            </div>
            <div className="ak-scharf-knoepfe">
              <button type="button" className="ak-knopf voll" onClick={() => void scharfFragen()}
                disabled={beschaeftigt === "scharf-laden" || beschaeftigt === "scharf"}>
                {beschaeftigt === "scharf-laden" ? "Zählt …" : istScharf ? "Erneut scharf stellen" : "Verkauf scharf stellen"}
              </button>
              <button type="button" className="ak-knopf" onClick={anhalten} disabled={!e.an || beschaeftigt === "schalter"}>Anhalten</button>
            </div>
          </section>

          {scharf && (
            <section className="ak-karte ak-rueckfrage" role="dialog" aria-modal="false" aria-labelledby="ak-rueckfrage-titel">
              <div className="ak-karte-kopf">
                <h2 id="ak-rueckfrage-titel">Verkauf scharf stellen?</h2>
                <span className="ak-still">gezählt eben, im Kreis „alle“ — ohne Sperren, ohne wer die Auskunft schon hat</span>
              </div>
              <div className="ak-tabelle-huelle">
                <table className="ak-tabelle ak-rf-tabelle">
                  <thead>
                    <tr>
                      <th>Segment</th><th className="r">Im Kreis</th><th className="r ak-rf-breit">Heute fällig</th>
                      <th className="r" title="fällig und von keiner Tagesrücksicht aufgehalten">Mail heute möglich</th>
                      <th className="r" title="im Kreis, mit WhatsApp-Einwilligung und Handynummer">WhatsApp-fähig</th><th className="r ak-rf-breit">Gesperrt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scharf.segmente.map((z) => (
                      <tr key={z.segment}>
                        <td><span className="ak-rf-kurz">{z.kurz}</span><span className="ak-rf-lang">{z.text}</span></td>
                        <td className="r"><b>{zahl(z.imKreis)}</b></td>
                        <td className="r ak-rf-breit">{zahl(z.heuteFaellig)}</td>
                        <td className="r">{zahl(z.heuteMoeglich)}</td>
                        <td className="r">{zahl(z.waFaehig)}</td>
                        <td className="r ak-still ak-rf-breit">{zahl(z.gesperrt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Zusammen</td>
                      <td className="r"><b>{zahl(scharf.summe.imKreis)}</b></td>
                      <td className="r ak-rf-breit">{zahl(scharf.summe.heuteFaellig)}</td>
                      <td className="r">{zahl(scharf.summe.heuteMoeglich)}</td>
                      <td className="r">{zahl(scharf.summe.waFaehig)}</td>
                      <td className="r ak-still ak-rf-breit">{zahl(scharf.summe.gesperrt)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="ak-still">
                „Mail heute möglich“: fällig und von keiner Tagesrücksicht aufgehalten (Unterlagen-Mail in den letzten 3 Tagen, andere
                Werbemail in 20 Stunden, gerade selbst geschrieben …) — davon gehen heute höchstens {zahl(scharf.deckel?.mails ?? 500)} raus, der Rest an den
                nächsten Tagen. Die WhatsApp folgt frühestens einen Tag nach der ersten Mail{scharf.summe.waHeute ? ` (heute schon möglich: ${zahl(scharf.summe.waHeute)})` : ""}.
              </p>
              <ul className="ak-rueckfrage-liste">
                {/* Gegenlesen 26.09.2026 (E-243): die Deckel aus der Antwort des Servers (SCHARF_WERTE), nicht fest im Text. */}
                <li>Takt an, Kreis „alle“, bis zu <b>{zahl(scharf.deckel.mails)} Mails</b> und <b>{zahl(scharf.deckel.whatsapp)} WhatsApp</b> am Tag, Mo–So {scharf.fenster.ab}–{scharf.fenster.bis}, gleichmäßig über den Tag.</li>
                <li>Reihenfolge der Mails: Kunden, fertige Anträge, Abbrecher, Leads — je die frischesten zuerst. WhatsApp zuerst an alle, die den Kauflink geöffnet und nicht bestellt haben — frühestens einen Tag nach der ersten Mail, höchstens eine je Mensch.</li>
                {/* Gegenlesen 26.09.2026 (E-243): ehrlich sagen, dass „WhatsApp-fähig" nicht „bekommt eine WhatsApp" heißt. */}
                {scharf.summe.waFaehig > scharf.deckel.whatsapp * 14 && (
                  <li>
                    {zahl(scharf.deckel.whatsapp)} WhatsApp am Tag bei {zahl(scharf.summe.waFaehig)} WhatsApp-fähigen: Es dauert rund{" "}
                    {zahl(Math.ceil(scharf.summe.waFaehig / Math.max(1, scharf.deckel.whatsapp)))} Tage, bis jeder seine eine WhatsApp hatte — sie darf auch nach
                    der dritten Mail noch kommen. Die Rangfolge entscheidet, wer zuerst (Link geöffnet, dann Kunden, Anträge, Abbrecher, Leads).
                  </li>
                )}
                <li>Liefermodus Einkauf: Bis die Schnittstelle steht, kaufen wir jede bezahlte Auskunft selbst ein.</li>
                <li>
                  WhatsApp-Vorlagen: {scharf.vorlagen.map((v) => `${v.name} — ${META_TEXT[v.meta ?? "unbekannt"].text}`).join("; ")}.
                  {" "}{scharf.whatsapp.moeglich ? "" : "Bis Meta sie freigibt, schreibt der Takt nur per Mail. "}
                  {/* Gegenlesen 26.09.2026 (E-243): vorlagenEinreichen reicht JEDE fehlende Vorlage des Hauses ein, nicht nur diese zwei. */}
                  Der Knopf reicht jede noch fehlende WhatsApp-Vorlage bei Meta ein (Meta prüft Minuten bis Stunden); schon eingereichte und freigegebene bleiben unberührt.
                </li>
              </ul>
              <p className="ak-hinweis warn"><b>Rechtlich:</b> {scharf.rechtssatz}</p>
              <div className="ak-feld-zeile">
                <button type="button" className="ak-knopf voll" onClick={() => void scharfStellen()} disabled={beschaeftigt === "scharf"}>
                  {beschaeftigt === "scharf" ? "Stellt scharf …" : "Jetzt scharf stellen"}
                </button>
                <button type="button" className="ak-knopf" onClick={() => setScharf(null)} disabled={beschaeftigt === "scharf"}>Abbrechen</button>
                <span className="ak-still">Jede Änderung steht danach mit deinem Namen im Protokoll.</span>
              </div>
            </section>
          )}

          {/* ── Heute: der Trichter gegen das Ziel ─────────────────────── */}
          <section className="ak-heute" aria-label="Heute">
            <ol className="ak-stufen">
              {STUFEN.map((st) => (
                <li key={st} className={`ak-stufe ${st}`}>
                  <span>{STUFE_NAME[st]}</span>
                  <b>{zahl(heute[st])}</b>
                  <small>{st === "bezahlt" ? `${STUFE_WAS[st]} · ${eur(t.heute.umsatzCents)}` : STUFE_WAS[st]}</small>
                </li>
              ))}
            </ol>
            <div className="ak-ziel">
              <div className="ak-ziel-kopf">
                <span>Ziel {zahl(s.ziel)} am Tag</span>
                <b>{zahl(heute.bestellt)} bestellt · {zahl(heute.bezahlt)} bezahlt</b>
              </div>
              <div className="ak-balken" role="img" aria-label={`${heute.bestellt} von ${s.ziel} bestellt, ${heute.bezahlt} bezahlt`}>
                <i className="bestellt" style={{ width: anteil(heute.bestellt) }} />
                <i className="bezahlt" style={{ width: anteil(heute.bezahlt) }} />
              </div>
              <div className="ak-balken-legende">
                <em>bestellt</em><em className="bezahlt">bezahlt</em>
                <span>heute {Math.round((heute.bestellt / Math.max(1, s.ziel)) * 100)} % des Ziels bestellt · Umsatz heute {eur(t.heute.umsatzCents)}</span>
              </div>
            </div>
          </section>

          {/* ── Steuerung ──────────────────────────────────────────────── */}
          <section className="ak-karte ak-steuer" aria-label="Steuerung">
            <div className="ak-karte-kopf">
              <h2>Steuerung</h2>
              <span className="ak-still">
                alle 30 Minuten, Mo–So {fenster.ab}–{fenster.bis} · höchstens {s.takt.hoechstensBeruehrungen} Berührungen je Mensch
              </span>
            </div>
            <div className="ak-steuer-raster">
              <div className="ak-feld">
                <span className="ak-feld-name">Verkaufstakt</span>
                <Wahl label="Verkaufstakt" werte={["aus", "an"]} wert={e.an ? "an" : "aus"} namen={{ aus: "Aus", an: "An" }}
                  gesperrt={beschaeftigt === "schalter"} onWahl={(v) => schalten(v === "an")} />
                <small>{e.an ? (s.takt.sendezeit ? "Läuft — der nächste Takt schreibt an, wer dran ist." : `Läuft — Ruhe bis ${fenster.ab} Uhr.`) : "Aus — es geht nichts raus."}</small>
              </div>
              <div className="ak-feld">
                <span className="ak-feld-name">Kreis</span>
                <Wahl label="Kreis" werte={["uwg", "alle"] as Kreis[]} wert={e.kreis} namen={{ uwg: KREIS_TEXT.uwg.name, alle: KREIS_TEXT.alle.name }}
                  gesperrt={beschaeftigt === "kreis"} onWahl={kreisWaehlen} />
                <small>{KREIS_TEXT[e.kreis].satz}</small>
              </div>
              <div className="ak-feld">
                <span className="ak-feld-name">Mails je Tag</span>
                <div className="ak-feld-zeile">
                  <input type="number" min={0} max={e.hoechstensMails} value={mails} inputMode="numeric" aria-label="Mails je Tag"
                    onChange={(ev) => setMails(ev.target.value)} />
                  <button type="button" className="ak-knopf" disabled={beschaeftigt === "mails" || mails.trim() === String(e.mailsProTag)}
                    onClick={() => void setzen("auskunft_verkauf_mails_pro_tag", mails.trim(), `Mails je Tag: ${mails.trim()}.`, "mails")}>
                    {beschaeftigt === "mails" ? "Speichert …" : "Speichern"}
                  </button>
                </div>
                <Verbrauch heute={s.takt.heute.mails} deckel={e.mailsProTag} einheit="Mails" />
                <small>0 bis {zahl(e.hoechstensMails)}</small>
              </div>
              <div className="ak-feld">
                <span className="ak-feld-name">WhatsApp je Tag</span>
                <div className="ak-feld-zeile">
                  <input type="number" min={0} max={e.hoechstensWa} value={wa} inputMode="numeric" aria-label="WhatsApp je Tag"
                    onChange={(ev) => setWa(ev.target.value)} />
                  <button type="button" className="ak-knopf" disabled={beschaeftigt === "wa" || wa.trim() === String(e.waProTag)}
                    onClick={() => void setzen("auskunft_verkauf_wa_pro_tag", wa.trim(), `WhatsApp je Tag: ${wa.trim()}.`, "wa")}>
                    {beschaeftigt === "wa" ? "Speichert …" : "Speichern"}
                  </button>
                </div>
                <Verbrauch heute={s.takt.heute.whatsapp} deckel={e.waProTag} einheit="WhatsApp" />
                <small>{s.takt.whatsapp.moeglich ? `0 bis ${zahl(e.hoechstensWa)} · nur mit nachgewiesener Einwilligung` : `ruht: ${s.takt.whatsapp.grund ?? "nicht möglich"}`}</small>
              </div>
              <div className="ak-feld breit">
                <span className="ak-feld-name">Liefermodus</span>
                <Wahl label="Liefermodus" werte={["einkauf", "vollmacht", "api"] as Liefermodus[]} wert={e.liefermodus}
                  namen={{ einkauf: LIEFER_TEXT.einkauf.name, vollmacht: LIEFER_TEXT.vollmacht.name, api: LIEFER_TEXT.api.name }}
                  gesperrt={beschaeftigt === "liefer"} onWahl={liefermodusWaehlen} />
                <small>
                  {LIEFER_TEXT[e.liefermodus].satz}
                  {" "}Schnittstelle: {e.apiAngebunden ? "angebunden." : "noch nicht angebunden."}
                  {e.liefermodus === "api" && !e.apiAngebunden ? " Bis dahin bleibt jede bezahlte Auskunft im Einkauf." : ""}
                </small>
              </div>
            </div>
            {e.kreis === "alle" && <p className="ak-hinweis warn"><b>Kreis „alle“.</b> {ALLE_HINWEIS}</p>}
            <div className="ak-protokoll">
              <h3>Protokoll der Steuerung</h3>
              {protokoll.length === 0 ? <p className="ak-leer">Noch keine Änderung über diese Seite.</p> : (
                <ol>
                  {protokollListe.map((p, i) => (
                    <li key={`${p.zeit}-${i}`}>
                      <time dateTime={p.zeit}>{datumZeit(p.zeit)}</time>
                      <span className="ak-protokoll-wer">{p.wer}</span>
                      <span className="ak-protokoll-was">{p.text}</span>
                    </li>
                  ))}
                </ol>
              )}
              {protokoll.length > 5 && (
                <button type="button" className="ak-klein ak-mehr" onClick={() => setAlleProtokoll(!alleProtokoll)}>{alleProtokoll ? "Weniger zeigen" : `Alle ${protokoll.length} zeigen`}</button>
              )}
            </div>
          </section>

          {/* ── Der Trichter je Weg bzw. Segment ───────────────────────── */}
          <section className="ak-karte ak-trichter" aria-label="Trichter">
            <div className="ak-karte-kopf">
              <h2>Trichter {zeitraum === "heute" ? "heute" : "der letzten 14 Tage"}</h2>
              <div className="ak-wahlen">
                <Wahl klein label="Zeitraum" werte={["heute", "summe"] as ("heute" | "summe")[]} wert={zeitraum} namen={{ heute: "Heute", summe: "14 Tage" }} onWahl={setZeitraum} />
                <Wahl klein label="Aufschlüsseln nach" werte={["weg", "segment"] as ("weg" | "segment")[]} wert={nach} namen={{ weg: "je Weg", segment: "je Segment" }} onWahl={setNach} />
              </div>
            </div>
            <div className="ak-tabelle-huelle">
              <table className="ak-tabelle ak-trichter-tabelle">
                <thead>
                  <tr>
                    <th>{nach === "weg" ? "Weg" : "Segment"}</th>
                    {STUFEN.map((st) => <th key={st} className="r">{STUFE_NAME[st]}</th>)}
                    <th className="r">Umsatz</th>
                    {zeitraum === "summe" && <th className="r" title={quoteTitel}>Quote</th>}
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.schluessel}>
                      <td>{nach === "weg" ? WEG_NAME[z.schluessel as Weg] ?? z.schluessel : SEGMENT_NAME[z.schluessel] ?? z.schluessel}</td>
                      {STUFEN.map((st) => (
                        <td key={st} className={`r${wert(z, st) > 0 ? " voll" : ""}`}>{gemessen(z, st) ? zahl(wert(z, st)) : <span className="ak-still" title="Auf diesem Weg wird nicht angeschrieben.">—</span>}</td>
                      ))}
                      <td className="r">{eur(zeitraum === "heute" ? z.umsatzHeuteCents : z.umsatzSummeCents)}</td>
                      {zeitraum === "summe" && <td className="r ak-still">{gemessen(z, "angeschrieben") ? prozent(z.summe.bezahlt, z.summe.angeschrieben) : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
                {gesamt && (
                  <tfoot>
                    <tr>
                      <td>Gesamt</td>
                      {STUFEN.map((st) => <td key={st} className="r">{zahl(gesamt.werte[st])}</td>)}
                      <td className="r">{eur(gesamt.umsatz)}</td>
                      {zeitraum === "summe" && <td className="r">{prozent(quoteZaehler, gesamt.werte.angeschrieben)}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="ak-still ak-fuss">
              Jede Stufe zählt an dem Tag, an dem sie geschah — die Spalten sind nicht dieselben Menschen. „Geklickt“ = Kauflink
              geöffnet; Vorschauen von WhatsApp und bekannten Mail-Prüfprogrammen sind herausgefiltert, ein Prüfprogramm, das sich als
              Browser ausgibt, zählt mit. Das Segment gilt zum Zeitpunkt der Stufe. Ältere Bestellungen aus der Akte stehen unter
              „Betreuer“. „Ohne Herkunft“: Bestellungen, bei denen niemand den Weg festhielt (vor dem 25.09.) oder deren
              Kauflink-Klick nicht zuzuordnen war.
            </p>
          </section>

          {/* ── 14 Tage mit Ziel-Balken ──────────────────────────────────── */}
          <section className="ak-karte ak-verlauf" aria-label="Die letzten 14 Tage">
            <div className="ak-karte-kopf">
              <h2>Die letzten 14 Tage</h2>
              <span className="ak-still">
                {zahl(t.summe.werte.bestellt)} bestellt · {zahl(t.summe.werte.bezahlt)} bezahlt · {eur(t.summe.umsatzCents)} · Balken: bestellt und bezahlt gegen {zahl(s.ziel)}
              </span>
            </div>
            <div className="ak-tabelle-huelle">
              <table className="ak-tabelle ak-tage-tabelle">
                <thead>
                  <tr>
                    <th>Tag</th>
                    {STUFEN.map((st) => <th key={st} className="r">{STUFE_NAME[st]}</th>)}
                    <th className="r">Umsatz</th>
                    <th className="ak-ziel-spalte">Ziel {zahl(s.ziel)}</th>
                  </tr>
                </thead>
                <tbody>
                  {tageNeu.map((d, i) => (
                    <tr key={d.tag} className={i === 0 ? "heute" : ""}>
                      <td>{i === 0 ? "Heute" : tagText(d.tag)}</td>
                      {STUFEN.map((st) => <td key={st} className={`r${d.werte[st] > 0 ? " voll" : ""}`}>{d.werte[st] ? zahl(d.werte[st]) : <span className="ak-still">·</span>}</td>)}
                      <td className="r">{d.umsatzCents ? eur(d.umsatzCents) : <span className="ak-still">·</span>}</td>
                      <td className="ak-ziel-spalte">
                        <div className="ak-balken klein" role="img" aria-label={`${d.werte.bestellt} von ${s.ziel} bestellt, ${d.werte.bezahlt} bezahlt`}>
                          <i className="bestellt" style={{ width: anteil(d.werte.bestellt) }} />
                          <i className="bezahlt" style={{ width: anteil(d.werte.bezahlt) }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Der Vorrat: wer sie noch nicht hat, je Segment ─────────── */}
          <section className="ak-karte ak-pool" aria-label="Wer sie noch nicht hat">
            <div className="ak-karte-kopf">
              <h2>Wer sie noch nicht hat</h2>
              <span className="ak-still">keine Auskunft bestellt, bezahlt, hochgeladen oder ausgewertet · Kreis „{e.kreis}“</span>
            </div>
            <div className="ak-zahlen vier">
              <div className="ak-zahl"><span>Im Kreis</span><b className="blau">{zahl(s.pool.automatisch)}</b><small>der Takt darf sie anschreiben</small></div>
              <div className="ak-zahl"><span>Heute fällig</span><b>{zahl(s.pool.heuteFaellig)}</b><small>ein Schritt steht an (vor der Tagesrücksicht)</small></div>
              <div className="ak-zahl"><span>Gesperrt</span><b>{zahl(Object.values(s.pool.gesperrt).reduce((a, n) => a + n, 0))}</b><small>nie anschreiben — Gründe unten</small></div>
              <div className="ak-zahl"><span>Leads ohne Person</span><b>{zahl(s.pool.leadsOhnePerson)}</b><small>ohne Akte kein Kauflink</small></div>
            </div>
            <div className="ak-tabelle-huelle">
              <table className="ak-tabelle ak-vorrat-tabelle">
                <thead>
                  <tr>
                    <th>Segment</th><th className="r">Ohne Auskunft</th><th className="r">Erreichbar</th><th className="r">Im Kreis</th>
                    <th className="r">Heute fällig</th><th className="r">Mail a · WA · b · c</th><th className="r">WhatsApp-Einw.</th>
                    <th className="r" title="im Kreis, mit WhatsApp-Einwilligung und Handynummer">WA-fähig im Kreis</th>
                  </tr>
                </thead>
                <tbody>
                  {SEGMENTE.map((k) => {
                    const z = s.pool.segmente?.[k];
                    if (!z) return null;
                    return (
                      <tr key={k}>
                        <td>{s.segmentText?.[k] ?? SEGMENT_NAME[k]}</td>
                        <td className="r">{zahl(z.gesamt)}</td>
                        <td className="r">{zahl(z.erreichbar)}</td>
                        <td className={`r${z.imKreis > 0 ? " voll" : ""}`}>{zahl(z.imKreis)}</td>
                        <td className="r">{zahl(z.heuteFaellig)}</td>
                        <td className="r ak-still">{zahl(z.stufen.a)} · {zahl(z.stufen.wa)} · {zahl(z.stufen.b)} · {zahl(z.stufen.c)}</td>
                        <td className="r">{zahl(z.mitWhatsAppEinwilligung)}</td>
                        <td className="r">{zahl(z.imKreisMitWhatsApp ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {Object.values(s.pool.gesperrt).some((n) => n > 0) && (
              <div className="ak-gruende" aria-label="Gesperrt je Grund">
                {Object.entries(s.pool.gesperrt).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]).map(([g, n]) => (
                  <span key={g} className="ak-grund"><b>{zahl(n)}</b> {s.sperrgrundText?.[g] ?? g}</span>
                ))}
              </div>
            )}
            <p className="ak-hinweis">
              {e.kreis === "alle" ? (
                <><b>Kreis „alle“.</b> {ALLE_HINWEIS} Wer sich über den Abmeldelink oder mit „Stopp“ abmeldet, bekommt nie wieder ein Angebot.</>
              ) : (
                <><b>Kreis „uwg“.</b> Werbung per E-Mail oder WhatsApp an Bestandskunden ohne Einwilligung erlaubt § 7 Abs. 3 UWG nur, wenn
                der Kunde schon bei der Angabe seiner Adresse auf sein Widerspruchsrecht hingewiesen wurde — im Antrag seit dem{" "}
                {stichtagText(s.takt.stichtag)}. {zahl(s.pool.nurGezaehlt)} zahlende Kunden ohne Auskunft sind davor Kunde geworden und
                werden in diesem Kreis nur gezählt; sie erreicht das Angebot im Kundenbereich, über ihren Betreuer und über Mara.</>
              )}
            </p>
          </section>

          {/* ── Wer als Nächstes ─────────────────────────────────────────── */}
          <section className="ak-karte ak-takt" aria-label="Wer als Nächstes">
            <div className="ak-karte-kopf">
              <h2>Wer als Nächstes</h2>
              <span className={`ak-marke${e.an ? " gruen" : ""}`}>{e.an ? (s.takt.sendezeit ? "Takt läuft" : "Takt läuft · Nachtruhe") : "Takt aus"}</span>
            </div>
            <p className="ak-leise">
              Dieselbe Auswahl wie der Takt im Kreis „{e.kreis}“, ohne zu senden — auch wenn er aus ist. Kauf, Upload, Werbesperre,
              Abmeldung, „Stopp“, Kündigung, Storno oder Vertriebssperre beenden es sofort; wer gerade selbst geschrieben hat oder mit einem
              Mitarbeiter sprach, wartet. Die WhatsApp geht zuerst an alle, die den Kauflink geöffnet und nicht bestellt haben, dann an Kunden,
              Anträge, Abbrecher und Leads.
            </p>
            <div className="ak-feld-zeile">
              <button type="button" className="ak-knopf" onClick={() => void vorschauLaden()} disabled={beschaeftigt === "vorschau"}>
                {beschaeftigt === "vorschau" ? "Lädt …" : "Neu laden"}
              </button>
              <span className="ak-still">
                nur lesen — es geht nichts raus
                {vorschau ? ` · heute noch frei: ${zahl(vorschau.restHeute.mails)} Mails, ${zahl(vorschau.restHeute.whatsapp)} WhatsApp` : ""}
              </span>
            </div>
            {vorschau && vorschau.waGrund && <p className="ak-hinweis warn">WhatsApp ruht: {vorschau.waGrund}</p>}
            {vorschau && (
              <div className="ak-raster">
                {([["whatsapp", "WhatsApp", vorschau.whatsapp], ["mails", "E-Mail", vorschau.mails]] as [string, string, VorschauZeile[]][]).map(([k, titel, liste]) => (
                  <div key={k} className="ak-naechste">
                    <h3>{titel} · {zahl(liste.length)}{liste.length >= 30 ? "+" : ""}</h3>
                    {liste.length === 0 ? (
                      <p className="ak-leer">
                        {k === "whatsapp" && vorschau.waGrund ? "Ruht — siehe oben." : "Gerade ist niemand dran — alle im Kreis sind angeschrieben, warten auf den nächsten Schritt oder haben gerade eine andere Nachricht bekommen."}
                      </p>
                    ) : (
                      <div className="ak-tabelle-huelle">
                        <table className="ak-tabelle">
                          <thead><tr><th>Mensch</th><th>Schritt</th><th className="r">Preis</th><th>E-Mail</th></tr></thead>
                          <tbody>
                            {liste.slice(0, 12).map((z) => (
                              <tr key={`${k}-${z.personId}`}>
                                <td>
                                  <a href={`/chef/s/akte?id=${z.personId}`}>{z.name}</a>
                                  <span className="ak-still"> · {(s.segmentText?.[z.segment] ?? z.segment).split(" · ")[0]} · {z.land}{z.art === "firma" ? " · Firma" : ""}</span>
                                </td>
                                <td>
                                  {z.schritt ? <span className="ak-marke blau">{SCHRITT[z.schritt] ?? z.schritt}</span> : <span className="ak-still">wartet</span>}
                                  {z.klickAm ? <span className="ak-marke gruen" title={`Kauflink geöffnet ${datumZeit(z.klickAm)}, nicht bestellt`}> Link geöffnet</span> : null}
                                </td>
                                <td className="r">{z.preis}</td>
                                <td className="ak-still">{z.mail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {liste.length > 12 && <p className="ak-still">und {zahl(liste.length - 12)} weitere in dieser Reihe</p>}
                  </div>
                ))}
              </div>
            )}
            <p className="ak-still">
              Wirkung 30 Tage: {zahl(s.wirkung30.angeschrieben)} per Mail angeschrieben · {zahl(s.wirkung30.bestellt)} danach bestellt · {zahl(s.wirkung30.bezahlt)} bezahlt · {zahl(s.wirkung30.whatsapp)} WhatsApp
            </p>
          </section>

          {/* ── WhatsApp-Vorlagen (E-241: je Segment eine) ───────────────── */}
          {vorlagenListe.map((v) => (
            <section key={v.name} className="ak-karte ak-vorlage" aria-label={`WhatsApp-Vorlage ${v.name}`}>
              <div className="ak-karte-kopf">
                <h2>WhatsApp-Vorlage „{v.name}“{v.fuer ? <span className="ak-still"> · für {v.fuer}</span> : null}</h2>
                {/* E-243: der Stand bei Meta — Text- und Bildfassung; freigegeben reicht eine von beiden */}
                <span className="ak-vorlage-stand">
                  {v.freigegeben
                    ? <span className="ak-marke gruen">bei Meta freigegeben</span>
                    : <span className={`ak-marke ${META_TEXT[v.meta ?? "unbekannt"].farbe || "gelb"}`}>{v.meta && v.meta !== "unbekannt" ? META_TEXT[v.meta].text : v.entwurf ? "Entwurf — muss bei Meta freigegeben werden" : "wartet auf Meta"}</span>}
                  {v.metaBild && v.metaBild !== "unbekannt" && <span className="ak-still">Bildfassung: {META_TEXT[v.metaBild].text}</span>}
                </span>
              </div>
              {(v.meta === "abgelehnt" || v.metaBild === "abgelehnt") && (
                <p className="ak-hinweis warn">Meta hat die Vorlage abgelehnt. Text in shared/fiaon-lead-texte.ts anpassen und im Lead-Motor „Einreichen“ drücken — der reicht sie mit dem neuen Text wieder ein.</p>
              )}
              <p className="ak-leise">
                Kategorie {v.kategorie === "MARKETING" ? "Marketing (Werbung)" : v.kategorie}.
                {v.freigegeben
                  ? " Der Takt schickt sie an Menschen mit nachgewiesener WhatsApp-Einwilligung, höchstens so viele am Tag wie oben eingestellt."
                  : " Bis Meta sie freigibt, geht keine einzige WhatsApp damit raus — der Takt schreibt diesem Segment dann nur per Mail."}
              </p>
              <div className="ak-blase"><b>{v.kopf}</b>{v.beispiel}<small>{v.fuss}</small></div>
              <div className="ak-blase-knoepfe">{v.knoepfe.map((k) => <span key={k}>{k}</span>)}</div>
            </section>
          ))}

          {/* ── Bestellt, nicht bezahlt ──────────────────────────────────── */}
          <section className="ak-karte ak-offen" aria-label="Bestellt, nicht bezahlt">
            <div className="ak-karte-kopf">
              <h2>Bestellt, nicht bezahlt ({zahl(s.offen.length)})</h2>
              <span className="ak-still">der Zahlungslink führt auf die Zahlungsseite mit QR-Code und Bankdaten</span>
            </div>
            {s.offen.length === 0 ? <p className="ak-leer">Keine offene Bestellung.</p> : (
              <div className="ak-tabelle-huelle">
                <table className="ak-tabelle">
                  <thead><tr><th>Kunde</th><th className="r">Betrag</th><th>Bestellt</th><th>Stand</th><th>Betreuer</th><th /></tr></thead>
                  <tbody>
                    {offenListe.map((o) => (
                      <tr key={o.ref}>
                        <td>{o.personId ? <a href={`/chef/s/akte?id=${o.personId}`}>{o.name}</a> : o.name}<span className="ak-still"> · {o.land}{o.werbesperre ? " · Werbesperre" : ""}</span></td>
                        <td className="r"><b>{o.betrag ?? "—"}</b></td>
                        <td className="ak-still">{seit(o.angelegt)}</td>
                        <td>{o.status === "claimed_paid" ? <span className="ak-marke gelb">Zahlung gemeldet</span> : <span className="ak-marke">offen · {o.tage} T.</span>}</td>
                        <td className="ak-still">{o.betreuer ?? "—"}</td>
                        <td className="ak-tat">
                          {o.zahlungsseite ? (
                            <>
                              <a className="ak-klein" href={o.zahlungsseite} target="_blank" rel="noreferrer">Zahlungsseite</a>
                              <button type="button" className="ak-klein" onClick={() => void kopieren(o.zahlungsseite!)}>Link kopieren</button>
                            </>
                          ) : <span className="ak-still">ohne Verwendungszweck</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.offen.length > 12 && (
              <button type="button" className="ak-klein ak-mehr" onClick={() => setAlleOffen(!alleOffen)}>{alleOffen ? "Weniger zeigen" : `Alle ${s.offen.length} zeigen`}</button>
            )}
          </section>

          {/* ── Bezahlt, nicht geliefert ─────────────────────────────────── */}
          <section className="ak-karte ak-rueckstand" aria-label="Bezahlt, nicht geliefert">
            <div className="ak-karte-kopf">
              <h2>Bezahlt, noch nicht geliefert ({zahl(s.rueckstand.zeilen.length)})</h2>
              <a className="ak-klein" href="/chef/s/mara?reiter=auskunft&ansicht=beschaffung">Zur Beschaffung</a>
            </div>
            <p className="ak-still">kein Auskunft-Dokument in der Akte · die ältesten zuerst</p>
            {s.rueckstand.zeilen.length === 0 ? <p className="ak-leer">Kein Rückstand — jede bezahlte Auskunft liegt in der Akte.</p> : (
              <div className="ak-tabelle-huelle">
                <table className="ak-tabelle">
                  <thead><tr><th>Kunde</th><th>Bezahlt</th><th>Auskunfteien</th><th className="r">Anfragen</th><th>Betreuer</th><th /></tr></thead>
                  <tbody>
                    {rueckListe.map((r) => (
                      <tr key={r.ref}>
                        <td><a href={`/chef/s/akte?id=${r.personId}`}>{r.name}</a></td>
                        <td>{r.tageSeitKauf > 14 ? <span className="ak-marke gelb">vor {r.tageSeitKauf} Tagen</span> : <span className="ak-still">vor {r.tageSeitKauf} Tagen</span>}</td>
                        <td className="ak-still">{r.auskunfteien}</td>
                        <td className="r">{r.vorgaenge || "—"}</td>
                        <td className="ak-still">{r.betreuer ?? "—"}</td>
                        <td className="ak-tat">
                          {r.vorgaenge ? <span className="ak-still">läuft</span> : (
                            <>
                              <button type="button" className="ak-klein" disabled={beschaeftigt === `liefern:${r.ref}`} onClick={() => void liefern(r, true)}>
                                {beschaeftigt === `liefern:${r.ref}` ? "Startet …" : "Lieferung starten"}
                              </button>
                              <button type="button" className="ak-klein" disabled={beschaeftigt === `liefern:${r.ref}`} onClick={() => void liefern(r, false)}>ohne Mail</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.rueckstand.zeilen.length > 12 && (
              <button type="button" className="ak-klein ak-mehr" onClick={() => setAlleRueck(!alleRueck)}>{alleRueck ? "Weniger zeigen" : `Alle ${s.rueckstand.zeilen.length} zeigen`}</button>
            )}
          </section>
        </>
      )}
      {/* Portal an <body>: Die Chefbüro-Hülle animiert mit transform — ein fester Platz darin säße sonst mitten auf der Seite. */}
      {meldung && createPortal(<div className="ak-meldung" role="status">{meldung}</div>, document.body)}
    </div>
  );
}
