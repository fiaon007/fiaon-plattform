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
// 26.09.2026 (E-244) — Justin: „Jeder, der die SCHUFA offen hat, braucht eine
// E-Mail mit Zahlungserinnerung." Dazu die Karte „Zahlungserinnerung" (An/Aus,
// je Tag, Dauer-Tage — jede Änderung im Protokoll der Steuerung; heute versandt,
// heute fällig) und in „Bestellt, nicht bezahlt" je Bestellung die Stufe mit
// Datum, die nächste Fälligkeit, der Grund, wenn keine Mail geht, und die Knöpfe
// „Stornieren" (mit Rückfrage) und „Mahnstopp". Archivierte und Tests stehen
// dort nicht mehr.
//
// E-252 (28.09.2026) — Endfassung E-250, von Justin freigegeben („Go, 1 ja,
// 2 ja, 3 ja"). Derselbe Inhalt, neu geordnet und ruhiger:
//   · Statuszeile mit EINEM Schalter (vorher Schalter, „Anhalten" und die Wahl
//     „Verkaufstakt" — dreimal derselbe Schlüssel auskunft_verkauf_an). An →
//     Rückfrage „Verkaufstakt einschalten?", aus → „Verkauf anhalten?"; beide
//     wortgleich, jetzt im Fluss unter der Statuszeile statt window.confirm.
//   · Heute-Trichter darunter, „Umsatz heute" nur noch einmal.
//   · Zwei Spalten: links WEN (Vorrat, Sperrgründe, „Wer als Nächstes" als
//     Aufklapper — die Vorschau lädt erst beim Öffnen), rechts das GLAS „Wie
//     verkauft wird": das Band als Glas-Kopf (.ak-scharf, kein eigenes Glas
//     mehr), die Rückfrage, Kreis, Tagesdeckel, Liefermodus als Klartext (die
//     Wahl steht nur noch in der Beschaffung), Vorlagen und Protokoll als
//     Aufklapper. ALLE_HINWEIS steht einmal.
//   · Darunter: „Bestellt, nicht bezahlt" mit Summe im Titel, der
//     Zahlungserinnerung darin (das Geld, das sie eintreibt) und 5 Zeilen, dann
//     „Alle n zeigen" (Justin: ja); „Bezahlt, noch nicht geliefert"; „Zahlen im
//     Detail" (je Tag / je Weg / je Segment; leere Folgetage = eine Zeile).
//   · Meldungen und Rückfragen am Auslöser statt Portal; Tabellen am Handy als
//     Zeilen statt Querrolle. Die Daten kommen aus der Lage des Steuerpults
//     (mara-lage.tsx) — dieselbe Instanz wie die Verkaufsleiste, jede Minute neu.
//
// Server: server/routes/fiaon-chef-auskunft.ts · Regeln: server/lib/fiaon-auskunft-verkauf.ts,
// Zahlungserinnerung: server/lib/fiaon-auskunft-erinnerung.ts
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type MouseEvent as KlickEreignis, type ReactNode } from "react";
import { API, seit, zahl, eur, eurKurz, datumZeit, Geruest, Fehlermeldung, ruhig } from "./chef-teile";
// Die Preise aus der EINEN Quelle — nie ein Literal (74 € stand an 139 Stellen, E-240).
import { auskunftPreisZeile } from "@shared/fiaon-auskunft";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  useMaraDaten, useMaraLage, useMaraRundgang, useMeldung, Meldung, InfoKnopf, MARA_QUELLEN,
  berlinTag, betragTextCents, type MaraLageWert,
} from "./mara-lage";
import "@/styles/office-rundgang.css";
import "@/styles/chef-mara.css";
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
/** E-244: die Zahlungserinnerung an offene Auskünfte (Standard an). */
interface ErinnerungEinst { an: boolean; proTag: number; dauerTage: number; hoechstensProTag: number; hoechstensDauerTage: number }
interface Einstellungen {
  an: boolean; kreis: Kreis; mailsProTag: number; waProTag: number; liefermodus: Liefermodus;
  hoechstensMails: number; hoechstensWa: number; apiAngebunden: boolean;
  erinnerung?: ErinnerungEinst;
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
  /** E-244: der Stand der Zahlungserinnerung dieser Bestellung. */
  erinnerung?: {
    stufe: number; stufeText: string; letzteAm: string | null; naechste: string | null; grund: string | null;
    stornieren: boolean; hinweis: string | null; aufgabeAm: string | null; mahnstopp: boolean;
    /** Gesamtdurchsicht 26.09.2026: „frage" = ohne Erklärung des Kunden — bekommt die Nachfrage statt der Zahlungserinnerung. */
    fassung?: "erinnerung" | "frage";
  };
}
/** E-244: die Karte „Zahlungserinnerung". */
interface ErinnerungKarte extends ErinnerungEinst {
  heuteVersandt: number; heuteFaellig: number; imTakt: number; jeLauf: number; stufenTage: number[]; aufgabeAbTagen: number;
  /** Gesamtdurchsicht 26.09.2026: offene Bestellungen ohne Erklärung des Kunden (Fassung „Frage"). */
  ohneErklaerung?: number;
  fenster: { ab: string; bis: string };
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
  erinnerung?: ErinnerungKarte;
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
/** E-252: Kurzform der Stufen für die Kopfzeile der Zahlen am Handy. */
const STUFE_KURZ: Record<Stufe, string> = { angeschrieben: "Anges.", geklickt: "Klick", bestellt: "Best.", bezahlt: "Bez.", geliefert: "Gel." };
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
/** E-243: der Stand einer Vorlage bei Meta in unseren Worten. E-252: Farbe als Pille (gut/warn/krit). */
const META_TEXT: Record<MetaStatus, { text: string; farbe: "gut" | "warn" | "krit" | "" }> = {
  freigegeben: { text: "bei Meta freigegeben", farbe: "gut" },
  eingereicht: { text: "eingereicht — Meta prüft", farbe: "warn" },
  abgelehnt: { text: "von Meta abgelehnt", farbe: "krit" },
  pausiert: { text: "von Meta pausiert", farbe: "krit" },
  fehlt: { text: "noch nicht eingereicht", farbe: "warn" },
  unbekannt: { text: "Stand bei Meta unbekannt", farbe: "" },
};
const LIEFER_TEXT: Record<Liefermodus, { name: string; satz: string }> = {
  einkauf: { name: "Einkauf", satz: "Bis die Schnittstelle steht, kaufen wir die Auskunft selbst ein — was zu kaufen ist, steht in der Beschaffung." },
  vollmacht: { name: "Vollmacht", satz: "Der Kunde unterschreibt die Vollmacht, wir fordern seine Datenkopien bei den Auskunfteien an." },
  api: { name: "Schnittstelle", satz: "Abruf über die Schnittstelle — erst wählen, wenn sie angebunden ist." },
};
/** Seit diesem Tag gibt es die Auskunft zu kaufen (E-240) — davor sind leere Tage kein Befund. */
const AUSKUNFT_SEIT = "2026-09-24";
/** E-252 (Justin, Entscheidung 3): „Bestellt, nicht bezahlt" zeigt erst 5 Zeilen, dann „Alle n zeigen". */
const OFFEN_ZEILEN = 5;
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const tagText = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${WOCHENTAG[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
};
const stichtagText = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
/** „2026-09-28" → „Mo 28.09." (E-244: die nächste Fälligkeit der Zahlungserinnerung). */
const naechsteText = (iso: string | null, heuteIso: string) => (!iso ? "—" : iso === heuteIso ? "heute" : tagText(iso));
/** „heute", „gestern", „vor 5 Tagen" — statt „vor 0 Tagen". */
const vorTagen = (n: number) => (n <= 0 ? "heute" : n === 1 ? "gestern" : `vor ${n} Tagen`);
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

/** Heute gegen einen Deckel — ein schmaler Balken; die Zahlen stehen im Satz darunter. */
function Verbrauch({ heute, deckel, einheit }: { heute: number; deckel: number; einheit: string }) {
  const anteil = deckel > 0 ? Math.min(100, (heute / deckel) * 100) : 0;
  return (
    <div className="ak-verbrauch" role="img" aria-label={`heute ${heute} von ${deckel} ${einheit}`}>
      <i style={{ width: `${anteil}%` }} />
    </div>
  );
}
/** „heute 196 von 500 · noch 304 frei" — dieselbe Rechnung für Mails, WhatsApp und Erinnerungen. */
const verbrauchText = (heute: number, deckel: number) => (heute
  ? `heute ${zahl(heute)} von ${zahl(deckel)} · noch ${zahl(Math.max(0, deckel - heute))} frei`
  : `heute noch keine · ${zahl(deckel)} frei`);

// ═══════════════════════════════════════════════════════════════════════════
// RÜCKFRAGE IM FLUSS (E-252)
// Statt window.confirm steht die Frage direkt unter dem Auslöser — der Text
// bleibt wortgleich (Zeilenumbrüche über white-space: pre-line). `ort` sagt,
// wo sie steht; es gibt immer höchstens eine offene Rückfrage.
// ═══════════════════════════════════════════════════════════════════════════
interface Frage { ort: string; text: string; ja: string; tat: () => void }

function Rueckfrage({ f, ort, onZu }: { f: Frage | null; ort: string; onZu: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const da = !!f && f.ort === ort;
  useEffect(() => {
    if (!da) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: ruhig() ? "auto" : "smooth" });
    try { el.focus({ preventScroll: true }); } catch { /* nur hinrollen */ }
  }, [da, f]);
  if (!da || !f) return null;
  return (
    <div ref={ref} tabIndex={-1} className="mara-rueckfrage ak-frage" role="alertdialog" aria-label="Rückfrage">
      {f.text}
      <div className="mara-knoepfe">
        <button type="button" className="mara-knopf haupt klein" onClick={() => { onZu(); f.tat(); }}>{f.ja}</button>
        <button type="button" className="mara-knopf klein" onClick={onZu}>Abbrechen</button>
      </div>
    </div>
  );
}

/** Zu einer Stelle derselben Seite rollen — im Steuerpult über die Lage (wartet, bis das Ziel steht). */
function hinrollen(ml: MaraLageWert | null, selektor: string) {
  if (ml) { ml.zeigen(selektor, { block: "start" }); return; }
  document.querySelector(selektor)?.scrollIntoView({ block: "start", behavior: ruhig() ? "auto" : "smooth" });
}

/** Ein (i) mit dem Text darunter, im Fluss. */
function Info({ label, children, klasse = "" }: { label: string; children: ReactNode; klasse?: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <InfoKnopf offen={offen} onClick={() => setOffen((x) => !x)} label={label} />
      {offen && <span className={`mara-info ak-info ${klasse}`}>{children}</span>}
    </>
  );
}

export default function ChefAuskunft() {
  const ml = useMaraLage();
  const rg = useMaraRundgang();
  // E-252: dieselbe Instanz wie die Verkaufsleiste — lädt im Steuerpult jede Minute neu.
  const stand = useMaraDaten<Stand>("auskunft", MARA_QUELLEN.auskunft);
  const s = stand.daten;
  const { meldung, melden, zu } = useMeldung();
  const [frage, setFrage] = useState<Frage | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [mails, setMails] = useState<string>("");
  const [wa, setWa] = useState<string>("");
  // E-244: Zahlungserinnerung — je Tag und Dauer-Tage als Eingabe
  const [erTag, setErTag] = useState<string>("");
  const [erDauer, setErDauer] = useState<string>("");
  const [einstNeu, setEinstNeu] = useState<{ e: Einstellungen; p: ProtokollZeile[] } | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  // E-252: „Zahlen im Detail" — Voreinstellung „je Tag" (Befund 8: die Heute-Zahl steht schon oben).
  const [zeitraum, setZeitraum] = useState<"heute" | "summe">("summe");
  const [nach, setNach] = useState<"tag" | "weg" | "segment">("tag");
  const [alleOffen, setAlleOffen] = useState(false);
  const [alleRueck, setAlleRueck] = useState(false);
  const [alleProtokoll, setAlleProtokoll] = useState(false);
  const [taktOffen, setTaktOffen] = useState(false);
  // E-243: „Verkauf scharf stellen" — Rückfrage mit Zahlen, dann der Knopf; danach das Einreichen der Vorlagen.
  const [scharf, setScharf] = useState<ScharfDaten | null>(null);
  const [einreichen, setEinreichen] = useState<EinreichenStand | null>(null);
  const [vorlagenLive, setVorlagenLive] = useState<WaVorlage[] | null>(null);

  // Nach jedem Laden gilt der Stand des Servers — eine lokale Änderung davor ist dann darin enthalten.
  // E-252: Im Steuerpult lädt der Stand jede Minute neu; das ist hier gewollt (Server-Stand gewinnt).
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
  // Nur wenn sich der gespeicherte Wert ändert — das Neuladen jede Minute überschreibt keine halbe Eingabe.
  useEffect(() => { if (e) { setMails(String(e.mailsProTag)); setWa(String(e.waProTag)); } }, [e?.mailsProTag, e?.waProTag]);
  const er = e?.erinnerung ?? s?.erinnerung ?? null;
  useEffect(() => { if (er) { setErTag(String(er.proTag)); setErDauer(String(er.dauerTage)); } }, [er?.proTag, er?.dauerTage]);
  // E-252: „Wer als Nächstes" lädt erst beim Öffnen des Aufklappers (Bauplan § 5) — nicht mehr bei jedem
  // Laden des Stands (das wäre im Minutentakt jede Minute eine Abfrage mehr). Nur lesen.
  useEffect(() => { if (taktOffen && !vorschau) void vorschauLaden(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [taktOffen, vorschau]);

  const fragen = (f: Frage) => setFrage(f);
  const frageZu = () => setFrage(null);
  /** Wo die Rückmeldung einer Einstellung steht: am Auslöser. */
  const ortVon = (id: string) => (id === "schalter" ? "status" : id === "kreis" ? "kreis" : id.startsWith("er-") ? "erinnerung" : "steuer");

  const setzen = async (key: string, value: string, fertig: string, id: string) => {
    const ort = ortVon(id);
    setBeschaeftigt(id);
    try {
      const j = await senden("/chef/auskunft/einstellung", { key, value });
      setEinstNeu({ e: j.einstellungen, p: j.protokoll ?? [] });
      melden(j.geaendert === false ? "Unverändert — der Wert stand schon so." : fertig, ort);
      if (j.geaendert !== false) {
        // Gegenlesen 25.09.2026 (E-241): Kreis und Tagesdeckel ändern den Vorrat („Im Kreis", „Heute fällig")
        // und „Wer als Nächstes" — ohne neues Laden zeigte die Seite bis zum Neuladen die Zahlen des alten Kreises.
        if (id === "kreis" || id === "mails" || id === "wa" || id.startsWith("er-")) setVorschau(null);
        // E-252: nach JEDER Änderung neu laden (auch beim Schalter) — sonst zeigt die Verkaufsleiste bis zu 60 s den alten Stand.
        stand.neu();
      }
    } catch (err: any) { melden(err.message, ort, true); } finally { setBeschaeftigt(null); }
  };

  const fenster = s?.takt.fenster ?? { ab: "07:00", bis: "20:30" };
  // ── E-252: der EINE Schalter. An → Rückfrage „einschalten", aus → Rückfrage „anhalten" (beide wortgleich) ──
  const einschalten = () => {
    if (!s || !e) return;
    fragen({
      ort: "status", ja: "Ja, einschalten",
      text: `Verkaufstakt einschalten?\n\nAb dem nächsten Takt (alle 30 Minuten, Mo–So ${fenster.ab}–${fenster.bis}) bekommen bis zu ${e.mailsProTag} Menschen am Tag das Angebot per E-Mail`
        + ` und bis zu ${e.waProTag} per WhatsApp (nur mit Einwilligung und freigegebener Vorlage).\n\n`
        + (e.kreis === "alle"
          ? `Kreis „alle“: ${ALLE_HINWEIS}`
          : `Kreis „uwg“: nur wer nach dem ${stichtagText(s.takt.stichtag)} zum ersten Mal beantragt hat (§ 7 Abs. 3 UWG).`),
      tat: () => void setzen("auskunft_verkauf_an", "1", "Der Verkaufstakt läuft — der nächste Takt schreibt an, wer dran ist.", "schalter"),
    });
  };
  const anhalten = () => {
    if (!e?.an) return;
    fragen({
      ort: "status", ja: "Ja, anhalten",
      text: "Verkauf anhalten?\n\nAb sofort geht keine Angebots-Mail und keine WhatsApp mehr raus. Kreis und Tagesdeckel bleiben stehen — „Verkauf scharf stellen“ startet ihn wieder.",
      tat: () => void setzen("auskunft_verkauf_an", "0", "Der Verkauf ist angehalten. Es geht nichts mehr raus.", "schalter"),
    });
  };
  const kreisWaehlen = (k: Kreis) => {
    const tun = () => void setzen("auskunft_verkauf_kreis", k, k === "alle" ? "Kreis „alle“ — ab dem nächsten Takt." : "Kreis „uwg“ — nur § 7 Abs. 3 UWG.", "kreis");
    if (k !== "alle") { tun(); return; }
    fragen({ ort: "kreis", ja: "Ja, auf „alle“ stellen", text: `Kreis auf „alle“ stellen?\n\n${ALLE_HINWEIS}\n\nDie Änderung steht mit deinem Namen im Protokoll.`, tat: tun });
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
      window.setTimeout(() => document.querySelector(".ak-rueckfrage")?.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "nearest" }), 60);
    } catch (err: any) { melden(err.message, "scharf", true); } finally { setBeschaeftigt(null); }
  };
  const scharfStellen = async () => {
    setBeschaeftigt("scharf");
    try {
      const j = await senden("/chef/auskunft/scharf", {});
      setEinstNeu({ e: j.einstellungen, p: j.protokoll ?? [] });
      // Das Einreichen bei Meta läuft im Hintergrund — sein Stand sofort im Band, bis der neue Stand geladen ist.
      if (j.einreichen) setEinreichen(j.einreichen);
      setScharf(null);
      melden(j.geaendert?.length ? "Der Verkauf ist scharf — der nächste Takt schreibt an, wer dran ist." : "Alles stand schon so — der Verkauf ist scharf.", "scharf");
      setVorschau(null);
      stand.neu();
    } catch (err: any) { melden(err.message, "scharf", true); } finally { setBeschaeftigt(null); }
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
    } catch (err: any) { melden(err.message, "takt", true); } finally { setBeschaeftigt(null); }
  }
  // Integration 25.09.2026 (E-240): Die Lieferung des Rückstands von Hand starten — die Lieferung
  // selbst verweist in ihren Aufgaben hierher („… im Chefbüro unter Auskunft-Rückstand neu starten").
  const liefern = (r: Rueck, mail: boolean) => {
    // Integration 25.09.2026 (E-241): Der Satz folgt dem Lieferweg — im Einkauf (und bei „api") entsteht ein
    // Beschaffungsauftrag (/chef/s/auskunft-beschaffung), nur im Vollmacht-Weg Anfragen je Auskunftei.
    const einkauf = (e?.liefermodus ?? "einkauf") !== "vollmacht";
    fragen({
      ort: `rueck:${r.ref}`, ja: mail ? "Ja, Lieferung starten" : "Ja, ohne Mail starten",
      text: einkauf
        ? (mail
          ? `Lieferung für ${r.name} starten?\n\nEs entsteht ein Beschaffungsauftrag (${r.auskunfteien}) auf der Seite „Auskunft-Beschaffung“. Fehlt seine Einwilligung, bekommt der Kunde einmal per Mail den Link zur Auftragsbestätigung.`
          : `Lieferung für ${r.name} ohne Mail starten?\n\nEs entsteht ein Beschaffungsauftrag auf der Seite „Auskunft-Beschaffung“; fehlt seine Einwilligung, dort „Auftragsbestätigung senden“.`)
        : (mail
          ? `Lieferung für ${r.name} starten?\n\nEs entstehen die Anfragen an ${r.auskunfteien}, der Betreuer bekommt die Aufgabe, und der Kunde bekommt per Mail den Link zur Unterschrift (Vollmacht und Anfragen).`
          : `Lieferung für ${r.name} ohne Mail starten?\n\nEs entstehen die Anfragen und die Aufgabe; der Betreuer holt die Unterschrift im Gespräch.`),
      tat: () => void (async () => {
        setBeschaeftigt(`liefern:${r.ref}`);
        try {
          const j = await senden("/chef/auskunft/lieferung", { ref: r.ref, mail });
          melden(String(j.lieferung?.text || "Erledigt."), "rueckstand");
          stand.neu();
        } catch (err: any) { melden(err.message, "rueckstand", true); } finally { setBeschaeftigt(null); }
      })(),
    });
  };
  // ── E-244: Zahlungserinnerung ──────────────────────────────────────────
  const erinnerungSchalten = (an: boolean) => {
    fragen({
      ort: "erinnerung", ja: an ? "Ja, einschalten" : "Ja, ausschalten",
      text: an
        ? `Zahlungserinnerung einschalten?\n\nAb dem nächsten Lauf (alle 30 Minuten, Mo–So ${fenster.ab}–${fenster.bis}) bekommt jede offene Bonitätsauskunft ihre fällige Erinnerung — nie bei „Zahlung gemeldet“.`
        : "Zahlungserinnerung ausschalten?\n\nDann bekommt niemand mit offener Bonitätsauskunft mehr eine Erinnerung — auch nicht die fälligen von heute. Die Änderung steht mit deinem Namen im Protokoll.",
      tat: () => void setzen("auskunft_erinnerung_an", an ? "1" : "0",
        an ? "Die Zahlungserinnerung läuft." : "Die Zahlungserinnerung ist aus. Es geht keine mehr raus.", "er-an"),
    });
  };
  const stornieren = (o: Offen) => {
    fragen({
      ort: `offen:${o.ref}`, ja: "Ja, stornieren",
      text: `Bestellung von ${o.name} stornieren?\n\n${o.betrag ?? ""} · Verwendungszweck ${o.verwendungszweck ?? "—"}\n\nDie Bestellung wird storniert: keine Zahlungserinnerung mehr, kein neues Auskunft-Angebot, es entstehen keine Kosten. Der Kunde bekommt dazu KEINE automatische Mail — bitte ihm kurz antworten, wenn er darum gebeten hat.`,
      tat: () => void (async () => {
        setBeschaeftigt(`storno:${o.ref}`);
        try {
          await senden("/chef/auskunft/stornieren", { ref: o.ref });
          melden(`Storniert: ${o.name}.`, "offen");
          stand.neu();
        } catch (err: any) { melden(err.message, "offen", true); } finally { setBeschaeftigt(null); }
      })(),
    });
  };
  const mahnstopp = (o: Offen, an: boolean) => {
    const tun = async () => {
      setBeschaeftigt(`mahnstopp:${o.ref}`);
      try {
        await senden("/chef/auskunft/mahnstopp", { ref: o.ref, an });
        melden(an ? `Mahnstopp gesetzt: ${o.name}.` : `Mahnstopp aufgehoben: ${o.name} — die Erinnerung läuft wieder.`, "offen");
        stand.neu();
      } catch (err: any) { melden(err.message, "offen", true); } finally { setBeschaeftigt(null); }
    };
    if (!an) { void tun(); return; }
    fragen({
      ort: `offen:${o.ref}`, ja: "Ja, Mahnstopp",
      text: `Mahnstopp für ${o.name}?\n\nDann geht zu dieser Bestellung keine Zahlungserinnerung mehr raus. Die Bestellung bleibt offen — bezahlen kann der Kunde weiterhin.`,
      tat: () => void tun(),
    });
  };

  const kopieren = async (text: string) => {
    try { await navigator.clipboard.writeText(text); melden("Zahlungslink kopiert.", "offen"); } catch { melden("Kopieren ging nicht — bitte den Link öffnen und dort kopieren.", "offen", true); }
  };
  /** „In der Beschaffung ändern →" (zur Lieferweg-Wahl, hervorgehoben) / „Zur Beschaffung →": im Steuerpult die Ansicht wechseln, sonst die Adresse. */
  const zurBeschaffung = (ev: KlickEreignis, ziel: ".akb-modus" | ".akb-status") => {
    if (!ml) return;
    ev.preventDefault();
    ml.zeigen(ziel, { reiter: "auskunft", ansicht: "beschaffung", hervor: ziel === ".akb-modus" });
  };

  const t = s?.trichter;
  const heute = t?.heute.werte;
  const anteil = (n: number) => `${Math.min(100, s && s.ziel > 0 ? (n / s.ziel) * 100 : 0)}%`;
  const offenListe = s ? (alleOffen ? s.offen : s.offen.slice(0, OFFEN_ZEILEN)) : [];
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
  // E-252: je Tag — aufeinanderfolgende leere Tage werden EINE Zeile (reine Anzeige, die Tage kommen vom Server).
  const tageZeilen: { tag: string; bis: string | null; werte: Werte; umsatzCents: number; leer: boolean }[] = [];
  for (const d of t ? [...t.tage].reverse() : []) {
    const leer = STUFEN.every((st) => !d.werte[st]) && !d.umsatzCents;
    const letzte = tageZeilen[tageZeilen.length - 1];
    // Die Liste läuft rückwärts (heute zuerst): der ältere Tag wird der Anfang der Spanne.
    if (leer && letzte?.leer && tageZeilen.length > 1) { letzte.bis = letzte.bis ?? letzte.tag; letzte.tag = d.tag; }
    else tageZeilen.push({ ...d, bis: null, leer });
  }
  const vorlagenListe: WaVorlage[] = vorlagenLive ?? s?.vorlagen ?? (s?.vorlage ? [s.vorlage] : []);
  const istScharf = !!e && e.an && e.kreis === "alle";
  const vorlageFrei = (v: WaVorlage) => !!v.freigegeben || v.meta === "freigegeben";
  const freiZahl = vorlagenListe.filter(vorlageFrei).length;
  const vorlagenPunkt = freiZahl === vorlagenListe.length ? "gut"
    : vorlagenListe.some((v) => v.meta === "abgelehnt" || v.meta === "pausiert") ? "krit" : "warn";
  // Dieselbe Summe wie die Verkaufsleiste (betragTextCents aus mara-lage.tsx) — sonst stünden zwei Summen da.
  const offenCents = (s?.offen ?? []).reduce((n, o) => n + betragTextCents(o.betrag), 0);
  const gesperrtSumme = s ? Object.values(s.pool.gesperrt).reduce((a, n) => a + n, 0) : 0;
  const taktMarke = e?.an ? (s?.takt.sendezeit ? "Takt läuft" : "Takt läuft · Nachtruhe") : "Takt aus";
  const heuteIso = s ? berlinTag(new Date(s.stand)) : "";

  return (
    <div className="ak mara">
      <Rundgang raum="auskunft" titel="Auskunft-Verkauf" schritte={RUNDGAENGE.auskunft.schritte} {...rg} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && !s && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {/* Ein gescheitertes Nachladen: der alte Stand bleibt stehen, darüber eine leise Zeile. */}
      {stand.fehler && s && (
        <p className="ak-nachladen mara-still mara-klein">
          Neu laden ging nicht ({stand.fehler}) — es steht der letzte Stand.{" "}
          <button type="button" className="mara-knopf text" onClick={stand.neu}>Nochmal</button>
        </p>
      )}
      {s && t && heute && e && (
        <>
          {/* ── Statuszeile: der EINE Schalter ─────────────────────────── */}
          <div className="mara-status ak-status">
            <div className="st voll">
              <button type="button" className={`mara-schalter ak-schalter${e.an ? " an" : ""}`} aria-pressed={e.an} data-mara-schalter="auskunft"
                onClick={() => (e.an ? anhalten() : einschalten())} disabled={beschaeftigt === "schalter"}
                title={e.an ? "Verkauf anhalten (mit Rückfrage)" : "Verkaufstakt einschalten (mit Rückfrage)"}>
                <span className="bahn" aria-hidden="true" />
                <span>{e.an ? (s.takt.sendezeit ? "Verkauf läuft" : "Verkauf läuft · Nachtruhe") : "Verkauf aus"}</span>
              </button>
              <span className={`mara-pille ${istScharf ? "gut" : "warn"}`}>{istScharf ? "scharf" : "nicht scharf"}</span>
            </div>
            {vorlagenListe.length > 0 && (
              <div className="st voll" title="WhatsApp-Vorlagen bei Meta">
                <span className={`mara-punkt ${vorlagenPunkt}`} aria-hidden="true" />
                <span className="st-text">Vorlagen {zahl(freiZahl)} von {zahl(vorlagenListe.length)} bei Meta freigegeben</span>
              </div>
            )}
            <div className="st">
              {s.offen.length
                ? <span className="gross" title={`${eur(offenCents)} offen`}>{eurKurz(offenCents)}</span>
                : <span className="gross wort">nichts offen</span>}
              <div className="st-text">
                <div>
                  <button type="button" className="mara-knopf text" onClick={() => hinrollen(ml, ".ak-offen")}>
                    {s.offen.length ? `${zahl(s.offen.length)} bestellt, nicht bezahlt →` : "bestellt, nicht bezahlt →"}
                  </button>
                </div>
                {s.offen.length ? (er && <small>Zahlungserinnerung {er.an ? "läuft" : "aus"}</small>) : <small>keine Bestellung wartet</small>}
              </div>
            </div>
            <div className="st">
              {s.rueckstand.zeilen.length
                ? <span className="gross">{zahl(s.rueckstand.zeilen.length)}</span>
                : <span className="gross wort">keine</span>}
              <div className="st-text">
                <div>
                  <button type="button" className="mara-knopf text" onClick={() => hinrollen(ml, ".ak-rueckstand")}>bezahlt, nicht geliefert →</button>
                </div>
                <small>{s.rueckstand.zeilen.length ? "in der Beschaffung" : "jede bezahlte liegt in der Akte"}</small>
              </div>
            </div>
          </div>
          <Rueckfrage f={frage} ort="status" onZu={frageZu} />
          <Meldung m={meldung} ort="status" onZu={zu} />

          {/* ── Heute: der Trichter gegen das Ziel ─────────────────────── */}
          <section className="ak-heute" aria-label="Heute">
            <ol className="ak-stufen">
              {STUFEN.map((st) => (
                <li key={st} className={`ak-stufe ${st}`} title={STUFE_WAS[st]}>
                  <span className="mara-etikett">{STUFE_NAME[st]}</span>
                  {/* Keine nackte 0: ein leiser Strich wie in „Zahlen im Detail". */}
                  {heute[st] ? <b>{zahl(heute[st])}</b> : <b className="null" aria-label="0">–</b>}
                  {/* Befund 8: „Umsatz heute" steht nur noch hier. */}
                  <small>{st === "bezahlt" ? (t.heute.umsatzCents ? `${eur(t.heute.umsatzCents)} Umsatz heute` : "noch kein Umsatz heute") : STUFE_WAS[st]}</small>
                </li>
              ))}
            </ol>
            <div className="ak-ziel">
              <span className="mara-etikett">Heute · Ziel {zahl(s.ziel)} am Tag</span>
              <div className="ak-balken" role="img" aria-label={`${heute.bestellt} von ${s.ziel} bestellt, ${heute.bezahlt} bezahlt`}>
                {heute.bestellt > 0 && <i className="bestellt" style={{ width: anteil(heute.bestellt) }} />}
                {heute.bezahlt > 0 && <i className="bezahlt" style={{ width: anteil(heute.bezahlt) }} />}
              </div>
              <span className="ak-ziel-text">
                {heute.bestellt || heute.bezahlt ? (
                  <>
                    {zahl(heute.bestellt)} bestellt · {zahl(heute.bezahlt)} bezahlt ·{" "}
                    <span title="heute des Ziels bestellt">{Math.round((heute.bestellt / Math.max(1, s.ziel)) * 100)} %</span>
                  </>
                ) : "heute noch nichts bestellt"}
              </span>
            </div>
          </section>

          <div className="mara-spalten">
            {/* ── WEN: wer sie noch nicht hat, je Segment ──────────────── */}
            <section className="mara-wen ak-pool" aria-labelledby="ak-pool-titel">
              <div className="mara-wen-kopf ak-kopfzeile">
                <h2 id="ak-pool-titel">Wer sie noch nicht hat</h2>
                <Info label="Wer zählt">
                  {e.kreis === "alle" ? (
                    <>Keine Auskunft bestellt, bezahlt, hochgeladen oder ausgewertet · Kreis „alle“. Wer sich über den Abmeldelink oder mit „Stopp“ abmeldet, bekommt nie wieder ein Angebot. Der Kreis selbst steht in der Steuerung.</>
                  ) : (
                    <>Keine Auskunft bestellt, bezahlt, hochgeladen oder ausgewertet · Kreis „uwg“. Werbung per E-Mail oder WhatsApp an Bestandskunden ohne Einwilligung erlaubt § 7 Abs. 3 UWG nur, wenn
                    der Kunde schon bei der Angabe seiner Adresse auf sein Widerspruchsrecht hingewiesen wurde — im Antrag seit dem{" "}
                    {stichtagText(s.takt.stichtag)}. {zahl(s.pool.nurGezaehlt)} zahlende Kunden ohne Auskunft sind davor Kunde geworden und
                    werden in diesem Kreis nur gezählt; sie erreicht das Angebot im Kundenbereich, über ihren Betreuer und über Mara.</>
                  )}
                </Info>
              </div>
              <div className="ak-vier">
                <div><span className="mara-etikett">Im Kreis</span><b className="mara-akz-t">{s.pool.automatisch ? zahl(s.pool.automatisch) : <span className="wort">niemand</span>}</b><small>der Takt darf sie anschreiben</small></div>
                <div><span className="mara-etikett">Heute fällig</span><b>{s.pool.heuteFaellig ? zahl(s.pool.heuteFaellig) : <span className="wort">niemand</span>}</b><small>ein Schritt steht an (vor der Tagesrücksicht)</small></div>
                <div><span className="mara-etikett">Gesperrt</span><b>{gesperrtSumme ? zahl(gesperrtSumme) : <span className="wort">niemand</span>}</b><small>nie anschreiben — Gründe unten</small></div>
                <div><span className="mara-etikett">Leads ohne Person</span><b>{s.pool.leadsOhnePerson ? zahl(s.pool.leadsOhnePerson) : <span className="wort">keine</span>}</b><small>ohne Akte kein Kauflink</small></div>
              </div>
              <ul className="ak-segmente">
                {SEGMENTE.map((k) => {
                  const z = s.pool.segmente?.[k];
                  if (!z) return null;
                  return (
                    <li key={k} className="ak-segment">
                      <div className="ak-segment-kopf">
                        <span>{s.segmentText?.[k] ?? SEGMENT_NAME[k]}</span>
                        <b>{zahl(z.imKreis)}</b>
                        <span className="mara-still mara-klein">im Kreis · {zahl(z.heuteFaellig)} heute fällig</span>
                        <span className="mara-still mara-klein r">von {zahl(z.gesamt)}</span>
                      </div>
                      <details className="mara-klappe ak-einzeln">
                        <summary>Einzelheiten</summary>
                        <dl>
                          <div><dt>Ohne Auskunft</dt><dd>{zahl(z.gesamt)}</dd></div>
                          <div><dt>Erreichbar</dt><dd>{zahl(z.erreichbar)}</dd></div>
                          <div><dt>Im Kreis</dt><dd>{zahl(z.imKreis)}</dd></div>
                          <div><dt>Heute fällig</dt><dd>{zahl(z.heuteFaellig)}</dd></div>
                          {/* E-252 (28.09.2026): In der Reihe steht für eine leere Stufe ein Strich statt „0" — wie in „Zahlen im Detail". */}
                          <div><dt>Mail a · WA · b · c</dt><dd>{[z.stufen.a, z.stufen.wa, z.stufen.b, z.stufen.c].map((n) => (n ? zahl(n) : "–")).join(" · ")}</dd></div>
                          <div><dt>WhatsApp-Einw.</dt><dd>{zahl(z.mitWhatsAppEinwilligung)}</dd></div>
                          <div title="im Kreis, mit WhatsApp-Einwilligung und Handynummer"><dt>WA-fähig im Kreis</dt><dd>{zahl(z.imKreisMitWhatsApp ?? 0)}</dd></div>
                        </dl>
                      </details>
                    </li>
                  );
                })}
              </ul>
              {Object.values(s.pool.gesperrt).some((n) => n > 0) && (
                <details className="mara-klappe ak-gesperrt">
                  <summary>{zahl(gesperrtSumme)} gesperrt — {zahl(Object.values(s.pool.gesperrt).filter((n) => n > 0).length)} Gründe</summary>
                  <div className="ak-gruende" aria-label="Gesperrt je Grund">
                    {Object.entries(s.pool.gesperrt).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]).map(([g, n]) => (
                      <span key={g} className="mara-pille umbruch"><b>{zahl(n)}</b> {s.sperrgrundText?.[g] ?? g}</span>
                    ))}
                  </div>
                </details>
              )}

              {/* ── Wer als Nächstes (Aufklapper; lädt erst beim Öffnen) ─── */}
              <details className="mara-klappe ak-takt" onToggle={(ev) => setTaktOffen((ev.currentTarget as HTMLDetailsElement).open)}>
                <summary>Wer als Nächstes · {taktMarke}</summary>
                <p className="mara-still mara-klein">
                  Dieselbe Auswahl wie der Takt, ohne zu senden.{" "}
                  <Info label="Wie ausgewählt wird">
                    Dieselbe Auswahl wie der Takt im Kreis „{e.kreis}“, ohne zu senden — auch wenn er aus ist. Kauf, Upload, Werbesperre,
                    Abmeldung, „Stopp“, Kündigung, Storno oder Vertriebssperre beenden es sofort; wer gerade selbst geschrieben hat oder mit einem
                    Mitarbeiter sprach, wartet. Die WhatsApp geht zuerst an alle, die den Kauflink geöffnet und nicht bestellt haben, dann an Kunden,
                    Anträge, Abbrecher und Leads.
                  </Info>
                </p>
                <div className="mara-reihe ak-neu-laden">
                  <button type="button" className="mara-knopf klein" onClick={() => void vorschauLaden()} disabled={beschaeftigt === "vorschau"}>
                    {beschaeftigt === "vorschau" ? "Lädt …" : "Neu laden"}
                  </button>
                  <span className="mara-still mara-klein">
                    nur lesen — es geht nichts raus
                    {vorschau ? ` · heute noch frei: ${zahl(vorschau.restHeute.mails)} Mails, ${zahl(vorschau.restHeute.whatsapp)} WhatsApp` : ""}
                  </span>
                </div>
                <Meldung m={meldung} ort="takt" onZu={zu} />
                {vorschau && vorschau.waGrund && (
                  <p className="mara-hinweis warn ak-abstand"><span className="mara-punkt warn" aria-hidden="true" /><span>WhatsApp ruht: {vorschau.waGrund}</span></p>
                )}
                {vorschau && (
                  <div className="ak-naechste">
                    {([["whatsapp", "WhatsApp", vorschau.whatsapp], ["mails", "E-Mail", vorschau.mails]] as [string, string, VorschauZeile[]][]).map(([k, titel, liste]) => (
                      <div key={k}>
                        <div className="mara-etikett">{titel} · {k === "whatsapp" && vorschau.waGrund && liste.length === 0 ? "ruht" : `${zahl(liste.length)}${liste.length >= 30 ? "+" : ""}`}</div>
                        {liste.length === 0 ? (
                          <p className="mara-still mara-klein ak-leer">
                            {k === "whatsapp" && vorschau.waGrund ? "Ruht — siehe oben." : "Gerade ist niemand dran — alle im Kreis sind angeschrieben, warten auf den nächsten Schritt oder haben gerade eine andere Nachricht bekommen."}
                          </p>
                        ) : (
                          <ul>
                            {liste.slice(0, 12).map((z) => (
                              <li key={`${k}-${z.personId}`}>
                                <span>
                                  <a href={`/chef/s/akte?id=${z.personId}`}>{z.name}</a>
                                  <span className="mara-still"> · {(s.segmentText?.[z.segment] ?? z.segment).split(" · ")[0]} · {z.land}{z.art === "firma" ? " · Firma" : ""}</span>
                                </span>
                                <span className="ak-zahl-t">{z.preis}</span>
                                <small>
                                  {z.schritt ? <span className="mara-pille akz">{SCHRITT[z.schritt] ?? z.schritt}</span> : <span className="mara-still">wartet</span>}
                                  {z.klickAm ? <> <span className="mara-pille gut" title={`Kauflink geöffnet ${datumZeit(z.klickAm)}, nicht bestellt`}>Link geöffnet</span></> : null}
                                  {" "}{z.mail}
                                </small>
                              </li>
                            ))}
                          </ul>
                        )}
                        {liste.length > 12 && <p className="mara-still mara-klein ak-abstand">und {zahl(liste.length - 12)} weitere in dieser Reihe</p>}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mara-still mara-klein ak-abstand">
                  Wirkung 30 Tage: {zahl(s.wirkung30.angeschrieben)} per Mail angeschrieben · {zahl(s.wirkung30.bestellt)} danach bestellt · {zahl(s.wirkung30.bezahlt)} bezahlt · {zahl(s.wirkung30.whatsapp)} WhatsApp
                </p>
              </details>
            </section>

            {/* ── GLAS: wie verkauft wird — die EINE Glasfläche ────────── */}
            <section className="mara-glas ak-steuer" aria-labelledby="ak-scharf-titel">
              {/* E-243: das Band „Verkauf scharf stellen" ist jetzt der Kopf des Glases (kein eigenes Glas mehr). */}
              <div className={`ak-scharf${istScharf ? " an" : ""}`}>
                <div className="ak-scharf-text">
                  <span className="mara-etikett">Wie verkauft wird</span>
                  <h2 id="ak-scharf-titel">{istScharf ? "Der Verkauf ist scharf." : e.an ? "Der Verkauf läuft — aber nicht im Kreis „alle“." : "Der Verkauf ist nicht scharf."}</h2>
                  <p className="mara-still mara-klein">
                    {istScharf
                      ? `Kreis „alle“ · ${zahl(e.mailsProTag)} Mails und ${zahl(e.waProTag)} WhatsApp am Tag · Mo–So ${fenster.ab}–${fenster.bis} · Liefermodus ${LIEFER_TEXT[e.liefermodus].name}.`
                      : `Ein Klick stellt alles auf einmal: Takt an, Kreis „alle“, 500 Mails und 20 WhatsApp am Tag (Mo–So ${fenster.ab}–${fenster.bis}), Liefermodus Einkauf — und reicht die fehlenden WhatsApp-Vorlagen bei Meta ein. Vorher zeigt die Seite, wen das betrifft.`}
                  </p>
                </div>
                {/* „Anhalten" steht nicht mehr hier: derselbe Schlüssel wie der Schalter oben (auskunft_verkauf_an). */}
                <button type="button" className="mara-knopf haupt ak-scharf-knopf" onClick={() => void scharfFragen()}
                  disabled={beschaeftigt === "scharf-laden" || beschaeftigt === "scharf"}>
                  {beschaeftigt === "scharf-laden" ? "Zählt …" : istScharf ? "Erneut scharf stellen" : "Verkauf scharf stellen"}
                </button>
              </div>
              <div className="ak-marken" aria-label="WhatsApp-Vorlagen bei Meta">
                {vorlagenListe.map((v) => {
                  const m = META_TEXT[v.meta ?? (v.freigegeben ? "freigegeben" : "unbekannt")];
                  return <span key={v.name} className={`mara-pille umbruch ${m.farbe}`}>{v.name}: {m.text}</span>;
                })}
                {einreichenJetzt?.laeuft && <span className="mara-still">Einreichen bei Meta läuft …</span>}
                {einreichenJetzt && !einreichenJetzt.laeuft && einreichenJetzt.bis && (
                  <span className="mara-still">
                    Zuletzt eingereicht {datumZeit(einreichenJetzt.bis)}: {zahl(einreichenJetzt.eingereicht.length)} neu, {zahl(einreichenJetzt.schonDa)} schon da
                    {einreichenJetzt.fehler.length ? `, ${einreichenJetzt.fehler.length} mit Fehler (${einreichenJetzt.fehler.map((f) => `${f.name}: ${f.grund}`).join(" · ").slice(0, 240)})` : ""}
                  </span>
                )}
                {einreichenJetzt?.abbruch && <span className="mara-still">{einreichenJetzt.abbruch}</span>}
                {/* Gegenlesen 26.09.2026 (E-243): Justin hat den Takt am 26.09. um 15:09 über die alte Steuerung eingeschaltet —
                    das Band steht dann schon auf „scharf", die Vorlagen fehlen aber bei Meta. Das muss hier stehen. */}
                {istScharf && !einreichenJetzt?.laeuft && vorlagenListe.some((v) => v.meta === "fehlt") && (
                  <span className="mara-warn-t">Ohne eingereichte Vorlage keine WhatsApp — „Erneut scharf stellen“ reicht sie bei Meta ein.</span>
                )}
              </div>
              <p className="mara-still mara-klein ak-preise">
                alle 30 Minuten, Mo–So {fenster.ab}–{fenster.bis} · höchstens {s.takt.hoechstensBeruehrungen} Berührungen je Mensch ·
                Bonitätsauskunft mit Handlungsplan: privat {auskunftPreisZeile("privat")}; Firma {auskunftPreisZeile("firma")}
              </p>
              <Meldung m={meldung} ort="scharf" onZu={zu} />

              {scharf && (
                <section className="ak-rueckfrage" role="dialog" aria-modal="false" aria-labelledby="ak-rueckfrage-titel">
                  <h3 id="ak-rueckfrage-titel">Verkauf scharf stellen?</h3>
                  <p className="mara-still mara-klein">gezählt eben, im Kreis „alle“ — ohne Sperren, ohne wer die Auskunft schon hat</p>
                  <table className="ak-tabelle ak-block ak-rf-tabelle">
                    <thead>
                      <tr>
                        <th>Segment</th><th className="r">Im Kreis</th><th className="r">Heute fällig</th>
                        <th className="r" title="fällig und von keiner Tagesrücksicht aufgehalten">Mail heute möglich</th>
                        <th className="r" title="im Kreis, mit WhatsApp-Einwilligung und Handynummer">WhatsApp-fähig</th><th className="r">Gesperrt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scharf.segmente.map((z) => (
                        <tr key={z.segment}>
                          <td className="kopf" title={z.kurz}>{z.text}</td>
                          <td className="r" data-l="Im Kreis"><b>{zahl(z.imKreis)}</b></td>
                          <td className="r" data-l="Heute fällig">{zahl(z.heuteFaellig)}</td>
                          <td className="r" data-l="Mail heute möglich">{zahl(z.heuteMoeglich)}</td>
                          <td className="r" data-l="WhatsApp-fähig">{zahl(z.waFaehig)}</td>
                          <td className="r mara-still" data-l="Gesperrt">{zahl(z.gesperrt)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="kopf">Zusammen</td>
                        <td className="r" data-l="Im Kreis"><b>{zahl(scharf.summe.imKreis)}</b></td>
                        <td className="r" data-l="Heute fällig">{zahl(scharf.summe.heuteFaellig)}</td>
                        <td className="r" data-l="Mail heute möglich">{zahl(scharf.summe.heuteMoeglich)}</td>
                        <td className="r" data-l="WhatsApp-fähig">{zahl(scharf.summe.waFaehig)}</td>
                        <td className="r mara-still" data-l="Gesperrt">{zahl(scharf.summe.gesperrt)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <details className="mara-klappe">
                    <summary>Was „Mail heute möglich“ heißt</summary>
                    <p className="mara-still mara-klein">
                      „Mail heute möglich“: fällig und von keiner Tagesrücksicht aufgehalten (Unterlagen-Mail in den letzten 3 Tagen, andere
                      Werbemail in 20 Stunden, gerade selbst geschrieben …) — davon gehen heute höchstens {zahl(scharf.deckel?.mails ?? 500)} raus, der Rest an den
                      nächsten Tagen. Die WhatsApp folgt frühestens einen Tag nach der ersten Mail{scharf.summe.waHeute ? ` (heute schon möglich: ${zahl(scharf.summe.waHeute)})` : ""}.
                    </p>
                  </details>
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
                  <p className="ak-warnzeile"><b>Rechtlich:</b> {scharf.rechtssatz}</p>
                  <div className="mara-startreihe">
                    <button type="button" className="mara-knopf haupt" onClick={() => void scharfStellen()} disabled={beschaeftigt === "scharf"}>
                      {beschaeftigt === "scharf" ? "Stellt scharf …" : "Jetzt scharf stellen"}
                    </button>
                    <button type="button" className="mara-knopf" onClick={() => setScharf(null)} disabled={beschaeftigt === "scharf"}>Abbrechen</button>
                    <span className="mara-still mara-klein">Jede Änderung steht danach mit deinem Namen im Protokoll.</span>
                  </div>
                </section>
              )}

              <div className="mara-feldgitter">
                <div className="mara-feld breit">
                  <span className="mara-feld-titel">Kreis</span>
                  <Wahl label="Kreis" werte={["uwg", "alle"] as Kreis[]} wert={e.kreis} namen={{ uwg: KREIS_TEXT.uwg.name, alle: KREIS_TEXT.alle.name }}
                    gesperrt={beschaeftigt === "kreis"} onWahl={kreisWaehlen} />
                  <small>{KREIS_TEXT[e.kreis].satz}</small>
                  {/* Befund 10: ALLE_HINWEIS steht nur noch hier (und wortgleich in den Rückfragen). */}
                  {e.kreis === "alle" && <p className="ak-warnzeile"><b>Kreis „alle“.</b> {ALLE_HINWEIS}</p>}
                  <Rueckfrage f={frage} ort="kreis" onZu={frageZu} />
                  <Meldung m={meldung} ort="kreis" onZu={zu} />
                </div>
                <div className="mara-feld">
                  <label htmlFor="ak-mails">Mails je Tag</label>
                  <div className="mara-reihe">
                    <input id="ak-mails" className="mara-eingabe mara-eingabe-zahl" type="number" min={0} max={e.hoechstensMails} value={mails} inputMode="numeric"
                      onChange={(ev) => setMails(ev.target.value)} />
                    <button type="button" className="mara-knopf klein" disabled={beschaeftigt === "mails" || mails.trim() === String(e.mailsProTag)}
                      onClick={() => void setzen("auskunft_verkauf_mails_pro_tag", mails.trim(), `Mails je Tag: ${mails.trim()}.`, "mails")}>
                      {beschaeftigt === "mails" ? "Speichert …" : "Speichern"}
                    </button>
                  </div>
                  <Verbrauch heute={s.takt.heute.mails} deckel={e.mailsProTag} einheit="Mails" />
                  <small>{verbrauchText(s.takt.heute.mails, e.mailsProTag)} · 0 bis {zahl(e.hoechstensMails)}</small>
                </div>
                <div className="mara-feld">
                  <label htmlFor="ak-wa">WhatsApp je Tag</label>
                  <div className="mara-reihe">
                    <input id="ak-wa" className="mara-eingabe mara-eingabe-zahl" type="number" min={0} max={e.hoechstensWa} value={wa} inputMode="numeric"
                      onChange={(ev) => setWa(ev.target.value)} />
                    <button type="button" className="mara-knopf klein" disabled={beschaeftigt === "wa" || wa.trim() === String(e.waProTag)}
                      onClick={() => void setzen("auskunft_verkauf_wa_pro_tag", wa.trim(), `WhatsApp je Tag: ${wa.trim()}.`, "wa")}>
                      {beschaeftigt === "wa" ? "Speichert …" : "Speichern"}
                    </button>
                  </div>
                  <Verbrauch heute={s.takt.heute.whatsapp} deckel={e.waProTag} einheit="WhatsApp" />
                  {s.takt.whatsapp.moeglich
                    ? <small>{verbrauchText(s.takt.heute.whatsapp, e.waProTag)} · 0 bis {zahl(e.hoechstensWa)} · nur mit nachgewiesener Einwilligung</small>
                    : <small className="mara-warn-t">ruht: {s.takt.whatsapp.grund ?? "nicht möglich"}</small>}
                </div>
                <div className="mara-feld breit">
                  <span className="mara-feld-titel">Liefermodus</span>
                  {/* Befund 9: die Wahl steht nur noch in der Beschaffung (derselbe Wert SCHALTER_LIEFERMODUS). */}
                  <span className="ak-klartext">
                    <b>{LIEFER_TEXT[e.liefermodus].name}.</b> {LIEFER_TEXT[e.liefermodus].satz}
                    {" "}Schnittstelle: {e.apiAngebunden ? "angebunden." : "noch nicht angebunden."}
                    {e.liefermodus === "api" && !e.apiAngebunden ? " Bis dahin bleibt jede bezahlte Auskunft im Einkauf." : ""}
                    {" "}<a href="/chef/s/mara?reiter=auskunft&ansicht=beschaffung" onClick={(ev) => zurBeschaffung(ev, ".akb-modus")}>In der Beschaffung ändern →</a>
                  </span>
                </div>
              </div>
              <Meldung m={meldung} ort="steuer" onZu={zu} />

              {vorlagenListe.length > 0 && (
                <details className="mara-klappe ak-vorlagen">
                  <summary>
                    WhatsApp-Vorlagen ({zahl(vorlagenListe.length)}) — {freiZahl === vorlagenListe.length
                      ? (vorlagenListe.length === 2 ? "beide bei Meta freigegeben" : "alle bei Meta freigegeben")
                      : `${zahl(freiZahl)} von ${zahl(vorlagenListe.length)} freigegeben`}
                  </summary>
                  {vorlagenListe.map((v) => (
                    <div key={v.name} className="ak-vorlage" aria-label={`WhatsApp-Vorlage ${v.name}`}>
                      <div className="mara-kopfzeile">
                        <div>WhatsApp-Vorlage „{v.name}“{v.fuer ? <span className="mara-still mara-klein"> · für {v.fuer}</span> : null}</div>
                        {/* E-243: der Stand bei Meta — Text- und Bildfassung; freigegeben reicht eine von beiden */}
                        <span className="ak-vorlage-stand">
                          {v.freigegeben
                            ? <span className="mara-pille gut">bei Meta freigegeben</span>
                            : <span className={`mara-pille ${META_TEXT[v.meta ?? "unbekannt"].farbe || "warn"}`}>{v.meta && v.meta !== "unbekannt" ? META_TEXT[v.meta].text : v.entwurf ? "Entwurf — muss bei Meta freigegeben werden" : "wartet auf Meta"}</span>}
                          {v.metaBild && v.metaBild !== "unbekannt" && <span className="mara-still mara-klein">Bildfassung: {META_TEXT[v.metaBild].text}</span>}
                        </span>
                      </div>
                      {(v.meta === "abgelehnt" || v.metaBild === "abgelehnt") && (
                        <p className="mara-hinweis warn ak-abstand"><span className="mara-punkt warn" aria-hidden="true" /><span>Meta hat die Vorlage abgelehnt. Text in shared/fiaon-lead-texte.ts anpassen und im Lead-Motor „Einreichen“ drücken — der reicht sie mit dem neuen Text wieder ein.</span></p>
                      )}
                      <p className="mara-still mara-klein ak-abstand">
                        Kategorie {v.kategorie === "MARKETING" ? "Marketing (Werbung)" : v.kategorie}.
                        {v.freigegeben
                          ? " Der Takt schickt sie an Menschen mit nachgewiesener WhatsApp-Einwilligung, höchstens so viele am Tag wie oben eingestellt."
                          : " Bis Meta sie freigibt, geht keine einzige WhatsApp damit raus — der Takt schreibt diesem Segment dann nur per Mail."}
                      </p>
                      <div className="ak-blase"><b>{v.kopf}</b>{v.beispiel}<small>{v.fuss}</small></div>
                      <div className="ak-blase-knoepfe">{v.knoepfe.map((k) => <span key={k}>{k}</span>)}</div>
                    </div>
                  ))}
                </details>
              )}
              <details className="mara-klappe ak-protokoll">
                <summary>Protokoll der Steuerung{protokoll.length ? ` (${zahl(protokoll.length)})` : " · noch keine Änderung"}</summary>
                {protokoll.length === 0 ? <p className="mara-still mara-klein">Noch keine Änderung über diese Seite.</p> : (
                  <ol className="mara-liste">
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
                  <button type="button" className="mara-knopf klein ak-mehr" onClick={() => setAlleProtokoll(!alleProtokoll)}>{alleProtokoll ? "Weniger zeigen" : `Alle ${protokoll.length} zeigen`}</button>
                )}
              </details>
            </section>
          </div>

          <div className="mara-darunter">
            {/* ── Bestellt, nicht bezahlt — mit der Zahlungserinnerung, die dieses Geld eintreibt ── */}
            <section className="mara-karte ak-offen" aria-labelledby="ak-offen-titel">
              <div className="mara-kopfzeile">
                <div>
                  <h2 id="ak-offen-titel">
                    Bestellt, nicht bezahlt{s.offen.length ? <> ({zahl(s.offen.length)}) · {eur(offenCents)} offen</> : null}
                  </h2>
                  <p className="mara-still mara-klein">
                    ohne Archivierte und Tests{" "}
                    <Info label="Was die Liste zeigt">Ohne Archivierte und Tests. Der Zahlungslink führt auf die Zahlungsseite mit QR-Code und Bankdaten.</Info>
                  </p>
                </div>
              </div>

              {/* ── E-244: Zahlungserinnerung ─────────────────────────────── */}
              {er && (
                <div className="ak-erinnerung" aria-label="Zahlungserinnerung">
                  <div className="mara-kopfzeile">
                    <div>
                      <h3>Zahlungserinnerung</h3>
                      <p className="mara-still mara-klein">
                        an jede bestellte, nicht bezahlte Auskunft · alle 30 Minuten, Mo–So {s.erinnerung?.fenster.ab ?? fenster.ab}–{s.erinnerung?.fenster.bis ?? fenster.bis} · höchstens {zahl(s.erinnerung?.jeLauf ?? 10)} je Lauf
                      </p>
                    </div>
                    <button type="button" className={`mara-schalter klein${er.an ? " an" : ""}`} aria-pressed={er.an} aria-label="Zahlungserinnerung"
                      disabled={beschaeftigt === "er-an"} onClick={() => erinnerungSchalten(!er.an)}>
                      <span className="bahn" aria-hidden="true" /><span>{er.an ? "An" : "Aus"}</span>
                    </button>
                  </div>
                  <Rueckfrage f={frage} ort="erinnerung" onZu={frageZu} />
                  <div className="ak-summen" role="group" aria-label="Zahlungserinnerung heute">
                    <span title={`von höchstens ${zahl(er.proTag)} am Tag`}>{s.erinnerung?.heuteVersandt ? <><b>{zahl(s.erinnerung.heuteVersandt)}</b>heute versandt</> : "heute noch keine versandt"}</span>
                    <span title={er.an ? "gehen im Sendefenster raus" : "Erinnerung ist aus"}>{s.erinnerung?.heuteFaellig ? <><b className="mara-warn-t">{zahl(s.erinnerung.heuteFaellig)}</b>heute fällig</> : "heute keine fällig"}</span>
                    <span title="offene Bestellungen, die erinnert werden">{s.erinnerung?.imTakt ? <><b>{zahl(s.erinnerung.imTakt)}</b>im Takt</> : "keine im Takt"}</span>
                    <span title="ohne Erklärung des Kunden — bekommen die Nachfrage">{s.erinnerung?.ohneErklaerung ? <><b className="mara-warn-t">{zahl(s.erinnerung.ohneErklaerung)}</b>bestätigen lassen</> : <span className="mara-still">niemand muss bestätigen</span>}</span>
                  </div>
                  <details className="mara-klappe">
                    <summary>Takt der Erinnerung ändern</summary>
                    <div className="mara-feldgitter ak-er-felder">
                      <div className="mara-feld">
                        <label htmlFor="ak-er-tag">Erinnerungen je Tag</label>
                        <div className="mara-reihe">
                          <input id="ak-er-tag" className="mara-eingabe mara-eingabe-zahl" type="number" min={0} max={er.hoechstensProTag} value={erTag} inputMode="numeric"
                            onChange={(ev) => setErTag(ev.target.value)} />
                          <button type="button" className="mara-knopf klein" disabled={beschaeftigt === "er-tag" || erTag.trim() === String(er.proTag)}
                            onClick={() => void setzen("auskunft_erinnerung_pro_tag", erTag.trim(), `Zahlungserinnerungen je Tag: ${erTag.trim()}.`, "er-tag")}>
                            {beschaeftigt === "er-tag" ? "Speichert …" : "Speichern"}
                          </button>
                        </div>
                        <Verbrauch heute={s.erinnerung?.heuteVersandt ?? 0} deckel={er.proTag} einheit="Erinnerungen" />
                        <small>{verbrauchText(s.erinnerung?.heuteVersandt ?? 0, er.proTag)} · 0 bis {zahl(er.hoechstensProTag)}</small>
                      </div>
                      <div className="mara-feld">
                        <label htmlFor="ak-er-dauer">Danach alle … Tage</label>
                        <div className="mara-reihe">
                          <input id="ak-er-dauer" className="mara-eingabe mara-eingabe-zahl" type="number" min={0} max={er.hoechstensDauerTage} value={erDauer} inputMode="numeric"
                            aria-label="Dauerstufe alle … Tage" onChange={(ev) => setErDauer(ev.target.value)} />
                          <button type="button" className="mara-knopf klein" disabled={beschaeftigt === "er-dauer" || erDauer.trim() === String(er.dauerTage)}
                            onClick={() => void setzen("auskunft_erinnerung_dauer_tage", erDauer.trim(), erDauer.trim() === "0" ? "Nach Tag 18 keine weitere Erinnerung." : `Dauerstufe: alle ${erDauer.trim()} Tage.`, "er-dauer")}>
                            {beschaeftigt === "er-dauer" ? "Speichert …" : "Speichern"}
                          </button>
                        </div>
                        <small>Tag {(s.erinnerung?.stufenTage ?? [1, 4, 10, 18]).join(", ")} nach der Bestellung, danach {er.dauerTage > 0 ? `alle ${er.dauerTage} Tage` : "keine mehr"} · 0 = nach Tag 18 Schluss</small>
                      </div>
                    </div>
                  </details>
                  <p className="mara-still mara-klein ak-abstand">
                    {er.an ? "Läuft — Zahlungspost, die Werbesperre hält sie nicht auf; „Zahlung gemeldet“ bekommt nie eine." : "Aus — es geht keine Erinnerung raus."}{" "}
                    <Info label="Was in jeder Erinnerung steht" klasse="ak-er-satz">
                      Jede Mail nennt Betrag, Bankdaten, Verwendungszweck und den Knopf zur Zahlungsseite, dazu „Schon überwiesen? …“ und
                      „Sie möchten die Auskunft nicht mehr? …“. Die erste Erinnerung einer Bestellung ohne Belehrung in Textform trägt
                      Vertragsbestätigung und Widerrufsbelehrung. Bestellungen ohne Erklärung des Kunden (vom Betreuer oder von Mara angelegt, kein Klick auf
                      „zahlungspflichtig“) bekommen stattdessen die Nachfrage „möchten Sie sie noch?“ ohne Bankdaten, mit dem Knopf zum Bestätigen — Tag 1, 4, 10, 18,
                      danach höchstens zwei weitere. Legt ein Betreuer die Auskunft neu an, gehen keine Zahlungsdaten hinaus, sondern sofort die erste Nachfrage.
                      Bestätigt der Kunde, bekommt er gleich die Vertragsbestätigung mit Widerrufsbelehrung und Zahlungsdaten. Ab Tag {s.erinnerung?.aufgabeAbTagen ?? 30} und frühestens 7 Tage nach der letzten Mail bekommt der Betreuer einmal die Aufgabe „anrufen oder stornieren“.
                      Änderungen stehen im Protokoll der Steuerung.
                    </Info>
                  </p>
                  <Meldung m={meldung} ort="erinnerung" onZu={zu} />
                </div>
              )}

              {s.offen.length === 0 ? <p className="mara-still ak-leer">Keine offene Bestellung.</p> : (
                <table className="ak-tabelle ak-block ak-offen-tabelle">
                  <thead><tr><th>Kunde</th><th className="r">Betrag</th><th>Bestellt</th><th>Stand</th><th>Erinnerung</th><th>Betreuer</th><th className="r">Taten</th></tr></thead>
                  <tbody>
                    {offenListe.map((o) => {
                      const r = o.erinnerung;
                      const ohneErklaerung = o.status === "pending_payment" && r?.fassung === "frage";
                      return [
                        <tr key={o.ref}>
                          <td className="kopf">{o.personId ? <a href={`/chef/s/akte?id=${o.personId}`}>{o.name}</a> : o.name}<span className="mara-still"> · {o.land}{o.werbesperre ? " · Werbesperre" : ""}</span></td>
                          <td className="r ak-zahl-t" data-l="Betrag">{o.betrag ?? "—"}</td>
                          <td className="ak-nowrap" data-l="Bestellt">{seit(o.angelegt)}</td>
                          <td data-l="Stand">
                            {o.status === "claimed_paid" ? <span className="mara-pille warn">Zahlung gemeldet</span> : <span className="mara-pille">offen · {o.tage} T.</span>}
                            {ohneErklaerung && (
                              <span className="mara-pille warn ak-pille-neben" title="Ohne Erklärung des Kunden (kein Klick auf „zahlungspflichtig“, keine Wahl, kein Beschaffungsauftrag) — er bekommt die Nachfrage mit dem Knopf zum Bestätigen, keine Zahlungserinnerung. Bitte keine Zahlungsseite schicken, bevor er bestätigt hat.">bestätigen lassen</span>
                            )}
                          </td>
                          <td className="voll" data-l="Erinnerung"><div className="ak-er-zelle">
                            {r ? (
                              <>
                                <span>{r.stufe > 0 && r.letzteAm ? <>{r.stufeText} <span className="mara-still">· {datumZeit(r.letzteAm)}</span></> : <span className="mara-still">noch keine</span>}</span>
                                {r.grund
                                  ? <span className={`ak-er-grund${r.stornieren ? " storno" : ""}`}>{r.grund}</span>
                                  : <span className="mara-still">nächste: {naechsteText(r.naechste, heuteIso)}</span>}
                                {r.hinweis && <span className="ak-er-grund">{r.hinweis}</span>}
                                {r.aufgabeAm && <span className="mara-still">Aufgabe „anrufen oder stornieren“ seit {datumZeit(r.aufgabeAm)}</span>}
                              </>
                            ) : <span className="mara-still">—</span>}
                          </div></td>
                          <td className="mara-still" data-l="Betreuer">{o.betreuer ?? "—"}</td>
                          <td className="r voll" data-l="Taten"><div className="ak-taten">
                            {/* Gegenprüfung 26.09.2026: ohne Erklärung des Kunden keine Zahlungsseite — erst bestätigt er selbst (Knopf in der Nachfrage). */}
                            {ohneErklaerung ? (
                              <span className="mara-still mara-klein" title="Der Kunde hat diese Bestellung nicht selbst bestätigt. Er bekommt die Nachfrage mit dem Knopf „Bestellung ansehen und bestätigen“; danach Vertragsbestätigung und Zahlungsdaten.">Zahlungsseite erst nach Bestätigung</span>
                            ) : o.zahlungsseite ? (
                              <>
                                <a className="mara-knopf klein" href={o.zahlungsseite} target="_blank" rel="noreferrer">Zahlungsseite</a>
                                <button type="button" className="mara-knopf klein" onClick={() => void kopieren(o.zahlungsseite!)}>Link kopieren</button>
                              </>
                            ) : <span className="mara-still mara-klein">ohne Verwendungszweck</span>}
                            {o.status === "pending_payment" && (
                              <>
                                <button type="button" className={`mara-knopf klein${r?.stornieren ? " warn" : ""}`} disabled={beschaeftigt === `storno:${o.ref}`}
                                  title="Stornieren beendet Bestellung und Erinnerung (mit Rückfrage)."
                                  onClick={() => stornieren(o)}>{beschaeftigt === `storno:${o.ref}` ? "Storniert …" : "Stornieren"}</button>
                                <button type="button" className="mara-knopf klein" disabled={beschaeftigt === `mahnstopp:${o.ref}`}
                                  title={r?.mahnstopp ? "Die Erinnerung läuft wieder." : "Zu dieser Bestellung geht keine Zahlungserinnerung mehr raus (mit Rückfrage)."}
                                  onClick={() => mahnstopp(o, !r?.mahnstopp)}>{r?.mahnstopp ? "Mahnstopp aufheben" : "Mahnstopp"}</button>
                              </>
                            )}
                          </div></td>
                        </tr>,
                        frage?.ort === `offen:${o.ref}` ? (
                          <tr key={`${o.ref}-frage`} className="ak-frage-zeile"><td colSpan={7}><Rueckfrage f={frage} ort={`offen:${o.ref}`} onZu={frageZu} /></td></tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              )}
              {s.offen.length > OFFEN_ZEILEN && (
                <button type="button" className="mara-knopf klein ak-mehr" onClick={() => setAlleOffen(!alleOffen)}>{alleOffen ? "Weniger zeigen" : `Alle ${s.offen.length} zeigen`}</button>
              )}
              <Meldung m={meldung} ort="offen" onZu={zu} />
            </section>

            {/* ── Bezahlt, nicht geliefert ─────────────────────────────────── */}
            <section className="mara-karte ak-rueckstand" aria-labelledby="ak-rueck-titel">
              <div className="mara-kopfzeile">
                <div>
                  <h2 id="ak-rueck-titel">Bezahlt, noch nicht geliefert{s.rueckstand.zeilen.length ? ` (${zahl(s.rueckstand.zeilen.length)})` : ""}</h2>
                  <p className="mara-still mara-klein">kein Auskunft-Dokument in der Akte · die ältesten zuerst</p>
                </div>
                <a href="/chef/s/mara?reiter=auskunft&ansicht=beschaffung" onClick={(ev) => zurBeschaffung(ev, ".akb-status")}>Zur Beschaffung →</a>
              </div>
              {s.rueckstand.zeilen.length === 0 ? <p className="mara-still ak-leer">Kein Rückstand — jede bezahlte Auskunft liegt in der Akte.</p> : (
                <table className="ak-tabelle ak-block">
                  <thead><tr><th>Kunde</th><th>Bezahlt</th><th>Auskunfteien</th><th className="r">Anfragen</th><th>Betreuer</th><th className="r">Taten</th></tr></thead>
                  <tbody>
                    {rueckListe.map((r) => [
                      <tr key={r.ref}>
                        <td className="kopf"><a href={`/chef/s/akte?id=${r.personId}`}>{r.name}</a></td>
                        <td data-l="Bezahlt">{r.tageSeitKauf > 14 ? <span className="mara-pille warn">vor {r.tageSeitKauf} Tagen</span> : <span className="mara-still">{vorTagen(r.tageSeitKauf)}</span>}</td>
                        <td className="mara-still voll" data-l="Auskunfteien">{r.auskunfteien}</td>
                        <td className="r" data-l="Anfragen">{r.vorgaenge || "—"}</td>
                        <td className="mara-still" data-l="Betreuer">{r.betreuer ?? "—"}</td>
                        <td className="r voll" data-l="Taten"><div className="ak-taten">
                          {r.vorgaenge ? <span className="mara-still">läuft</span> : (
                            <>
                              <button type="button" className="mara-knopf klein" disabled={beschaeftigt === `liefern:${r.ref}`} onClick={() => liefern(r, true)}>
                                {beschaeftigt === `liefern:${r.ref}` ? "Startet …" : "Lieferung starten"}
                              </button>
                              <button type="button" className="mara-knopf klein" disabled={beschaeftigt === `liefern:${r.ref}`} onClick={() => liefern(r, false)}>ohne Mail</button>
                            </>
                          )}
                        </div></td>
                      </tr>,
                      frage?.ort === `rueck:${r.ref}` ? (
                        <tr key={`${r.ref}-frage`} className="ak-frage-zeile"><td colSpan={6}><Rueckfrage f={frage} ort={`rueck:${r.ref}`} onZu={frageZu} /></td></tr>
                      ) : null,
                    ])}
                  </tbody>
                </table>
              )}
              {s.rueckstand.zeilen.length > 12 && (
                <button type="button" className="mara-knopf klein ak-mehr" onClick={() => setAlleRueck(!alleRueck)}>{alleRueck ? "Weniger zeigen" : `Alle ${s.rueckstand.zeilen.length} zeigen`}</button>
              )}
              <Meldung m={meldung} ort="rueckstand" onZu={zu} />
            </section>

            {/* ── Zahlen im Detail: je Tag (Voreinstellung), je Weg, je Segment ──
                 (die Klassen .ak-trichter und .ak-verlauf bleiben als Ziel des Rundgangs) */}
            <section className="mara-karte ak-detail ak-trichter ak-verlauf" aria-labelledby="ak-detail-titel">
              <div className="mara-kopfzeile">
                <div>
                  <h2 id="ak-detail-titel">Zahlen im Detail</h2>
                  <p className="mara-still mara-klein">
                    {nach === "tag"
                      ? `${t.summe.werte.bestellt || t.summe.werte.bezahlt
                        ? `${zahl(t.summe.werte.bestellt)} bestellt · ${zahl(t.summe.werte.bezahlt)} bezahlt · ${eur(t.summe.umsatzCents)}`
                        : "noch nichts bestellt"} in 14 Tagen · Balken: bestellt und bezahlt gegen ${zahl(s.ziel)}`
                      : `Trichter ${zeitraum === "heute" ? "heute" : "der letzten 14 Tage"} ${nach === "weg" ? "je Weg" : "je Segment"}`}
                  </p>
                </div>
                <div className="ak-wahlen">
                  {nach !== "tag" && (
                    <Wahl klein label="Zeitraum" werte={["heute", "summe"] as ("heute" | "summe")[]} wert={zeitraum} namen={{ heute: "Heute", summe: "14 Tage" }} onWahl={setZeitraum} />
                  )}
                  <Wahl klein label="Aufschlüsseln nach" werte={["weg", "segment", "tag"] as ("weg" | "segment" | "tag")[]} wert={nach}
                    namen={{ weg: "je Weg", segment: "je Segment", tag: "je Tag" }} onWahl={setNach} />
                </div>
              </div>
              {nach === "tag" ? (
                <table className="ak-tabelle ak-block ak-kompakt ak-tage-tabelle">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      {STUFEN.map((st) => <th key={st} className="r"><span className="th-lang">{STUFE_NAME[st]}</span><span className="th-kurz">{STUFE_KURZ[st]}</span></th>)}
                      <th className="r">Umsatz</th>
                      <th className="ak-ziel-spalte">Ziel {zahl(s.ziel)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tageZeilen.map((d, i) => d.leer ? (
                      <tr key={d.tag} className="leer">
                        <td className="kopf">{d.bis ? `${tagText(d.tag)} – ${tagText(d.bis)}` : i === 0 ? "Heute" : tagText(d.tag)}</td>
                        <td className="voll ak-leer-tage" colSpan={7}>
                          nichts angeschrieben, nichts bestellt{(d.bis ?? d.tag) < AUSKUNFT_SEIT ? " — die Auskunft gibt es erst seit 24.09." : ""}
                        </td>
                      </tr>
                    ) : (
                      <tr key={d.tag} className={i === 0 ? "heute" : ""}>
                        <td className="kopf">{i === 0 ? <span className="mara-akz-t">Heute</span> : tagText(d.tag)}</td>
                        {STUFEN.map((st) => <td key={st} className={`r${d.werte[st] > 0 ? " voll-zahl" : ""}`} data-l={STUFE_NAME[st]}>{d.werte[st] ? zahl(d.werte[st]) : <span className="mara-still">–</span>}</td>)}
                        <td className="r ak-umsatz" data-l="Umsatz">{d.umsatzCents ? eur(d.umsatzCents) : <span className="mara-still">–</span>}</td>
                        <td className="ak-ziel-spalte" data-l={`Ziel ${s.ziel}`}>
                          <div className="ak-balken klein" role="img" aria-label={`${d.werte.bestellt} von ${s.ziel} bestellt, ${d.werte.bezahlt} bezahlt`}>
                            {d.werte.bestellt > 0 && <i className="bestellt" style={{ width: anteil(d.werte.bestellt) }} />}
                            {d.werte.bezahlt > 0 && <i className="bezahlt" style={{ width: anteil(d.werte.bezahlt) }} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="ak-tabelle ak-block ak-kompakt ak-trichter-tabelle">
                  <thead>
                    <tr>
                      <th>{nach === "weg" ? "Weg" : "Segment"}</th>
                      {STUFEN.map((st) => <th key={st} className="r"><span className="th-lang">{STUFE_NAME[st]}</span><span className="th-kurz">{STUFE_KURZ[st]}</span></th>)}
                      <th className="r">Umsatz</th>
                      {zeitraum === "summe" && <th className="r" title={quoteTitel}>Quote</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {/* E-252 (28.09.2026, Gegenprüfung): wie die je-Tag-Tabelle und der Entwurf — eine gemessene 0 ist „–",
                        „—" heißt weiter „auf diesem Weg nicht gemessen". Umsatz 0 ebenfalls „–". */}
                    {zeilen.map((z) => (
                      <tr key={z.schluessel}>
                        <td className="kopf">{nach === "weg" ? WEG_NAME[z.schluessel as Weg] ?? z.schluessel : SEGMENT_NAME[z.schluessel] ?? z.schluessel}</td>
                        {STUFEN.map((st) => (
                          <td key={st} className={`r${wert(z, st) > 0 ? " voll-zahl" : ""}`} data-l={STUFE_NAME[st]}>
                            {!gemessen(z, st) ? <span className="mara-still" title="Auf diesem Weg wird nicht angeschrieben.">—</span>
                              : wert(z, st) ? zahl(wert(z, st)) : <span className="mara-still">–</span>}
                          </td>
                        ))}
                        <td className="r ak-umsatz" data-l="Umsatz">
                          {(zeitraum === "heute" ? z.umsatzHeuteCents : z.umsatzSummeCents) ? eur(zeitraum === "heute" ? z.umsatzHeuteCents : z.umsatzSummeCents) : <span className="mara-still">–</span>}
                        </td>
                        {zeitraum === "summe" && <td className="r mara-still ak-quote" data-l="Quote" title={quoteTitel}>{gemessen(z, "angeschrieben") ? prozent(z.summe.bezahlt, z.summe.angeschrieben) : "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                  {gesamt && (
                    <tfoot>
                      <tr>
                        <td className="kopf">Gesamt</td>
                        {STUFEN.map((st) => <td key={st} className="r" data-l={STUFE_NAME[st]}>{gesamt.werte[st] ? zahl(gesamt.werte[st]) : <span className="mara-still">–</span>}</td>)}
                        <td className="r ak-umsatz" data-l="Umsatz">{gesamt.umsatz ? eur(gesamt.umsatz) : <span className="mara-still">–</span>}</td>
                        {zeitraum === "summe" && <td className="r ak-quote" data-l="Quote" title={quoteTitel}>{prozent(quoteZaehler, gesamt.werte.angeschrieben)}</td>}
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
              <p className="mara-still mara-klein ak-abstand">
                Jede Stufe zählt an dem Tag, an dem sie geschah.{" "}
                <Info label="Wie gezählt wird">
                  Jede Stufe zählt an dem Tag, an dem sie geschah — die Spalten sind nicht dieselben Menschen. „Geklickt“ = Kauflink
                  geöffnet; Vorschauen von WhatsApp und bekannten Mail-Prüfprogrammen sind herausgefiltert, ein Prüfprogramm, das sich als
                  Browser ausgibt, zählt mit. Das Segment gilt zum Zeitpunkt der Stufe. Ältere Bestellungen aus der Akte stehen unter
                  „Betreuer“. „Ohne Herkunft“: Bestellungen, bei denen niemand den Weg festhielt (vor dem 25.09.) oder deren
                  Kauflink-Klick nicht zuzuordnen war.
                </Info>
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
