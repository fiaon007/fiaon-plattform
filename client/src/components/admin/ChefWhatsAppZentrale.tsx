// ═══════════════════════════════════════════════════════════════════════════
// WhatsApp-Zentrale — Reiter in /chef/s/mara (23.09.2026, E-229)
//
// Justin: „Ich muss das manuell anstoßen können (ein Button wie: WhatsApp
// starten (50) und dann kann ich auswählen welche Kundengruppe und welche
// Vorlage). Oder eine Automatik, dass Mara jede Stunde von 07:40 bis 20:45
// Uhr 5 Kunden anschreibt."
//
//   · Kopf: läuft die Automatik, was erlaubt Meta heute noch.
//   · Versand von Hand: Gruppe → Vorlage → Anzahl → Vorschau → starten.
//   · Automatik: an/aus, Fenster, je Stunde, Gruppen in Reihenfolge.
//   · Was Mara getan hat (E-236): jede Handlung aus fiaon_mara_protokoll mit
//     dem Ergebnis der Nachprüfung — „Ich muss sehen, was Mara gemacht hat und
//     ob das alles stimmt und passt."
//   · Verlauf: jede Nachricht mit Zustellung und Antwort.
// Die Regeln stehen in server/lib/fiaon-wa-zentrale.ts und
// server/lib/fiaon-mara-termin.ts — hier wird nur gezeigt und ausgelöst.
//
// ── E-252 (28.09.2026): Endfassung E-250, von Justin freigegeben ──────────
// („Go, 1 ja, 2 ja, 3 ja"). Dieselben Routen, Schlüssel und Rückfragetexte —
// nur die Ordnung ist neu:
//   · Statuszeile statt Kopf (h1 entfällt, der Reiter trägt den Namen):
//     Automatik · Meta frei (+ (i) mit der Rechnung) · Qualität · Warten · Stand.
//   · Wirkung 7 Tage als Kette bis zum Geld; ohne Geld der nächste Schritt
//     (naechsteGruppe aus mara-lage.tsx — dieselbe Regel wie die Leiste oben).
//     Die Tageszahlen stehen leise darunter.
//   · Wen (matt, links): Gruppen mit Menschen oben, leere unter „Gerade
//     niemand dran" mit Pille und Grund. Wie (die EINE Glasfläche, .wz-start):
//     Vorlage, Anzahl, Vorschau, Start — und die Automatik mit allen sechs
//     Gruppen (auch „Auskunft fehlt", Justin 28.09.: ankreuzbar, aus wie heute).
//   · Keine nackte Null: „Niemand dran" statt „WhatsApp starten (0)", „leer" /
//     „ab 14:48" statt „0 dran", Worte statt 0 in den Tageszahlen.
//   · Die Lage kommt aus der Wurzel (useMaraDaten, lädt jede Minute neu).
//   · Protokoll: 5 Zeilen, dann „Alle n zeigen"; Verlauf: 12, dann je 12 mehr.
//   · Rückmeldung am Auslöser (useMeldung), keine feste Meldung, kein Atmen.
// Auf E-253 aufgesetzt (live seit b5bae0a8, 28.09.2026): Laufkarte mit fünf
// Zuständen, friert nie ein, „Wartet auf Meta" nur bis 60 s, danach „kein
// Lebenszeichen"; bis zu 500 je Versand (lage.laufHoechstens), Schnellwahl,
// Start-Rückfrage und Startmeldung wortgleich mit E-253.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { API, seit, zahl, Geruest, Fehlermeldung, useDaten, ruhig } from "./chef-teile";
import {
  useMaraDaten, useMaraLage, useMaraRundgang, useMeldung, Meldung, InfoKnopf, MARA_QUELLEN,
  naechsteGruppe, wannWieder, uhrBerlin, tagZeitBerlin, berlinTag, tagNur,
} from "./mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-mara.css";
import "@/styles/chef-wa-zentrale.css";

type Gruppe = "neu" | "ohne_antrag" | "abbrecher" | "zahlung_offen" | "rate_offen" | "auskunft_fehlt";
interface GruppeInfo {
  schluessel: Gruppe; titel: string; satz: string; vorlagen: string[]; standard: string; abstandTage: number; anzahl: number; mitEinwilligung?: number;
  wartend?: number; wiederAb?: string | null; letzterLead?: string | null;
  /** E-252: Bauplan § 9 — nennt der Server einmal selbst den Grund einer leeren Gruppe, gilt seiner. Bis dahin rechnet leerStand() ihn hier. */
  leerGrund?: string | null;
}
interface Vorlage { name: string; kopf: string; zweck: string; text: string; frei: boolean; bild: boolean; kopfBild: string | null; fuss: string }
interface Automatik {
  an: boolean; von: string; bis: string; jeStunde: number; gruppen: Gruppe[]; vorlagen: Partial<Record<Gruppe, string>>;
  geaendertVon?: string | null; geaendertAm?: string | null; dieseStunde: number;
}
/** E-253: der Stand eines Versands aus der Datenbank (fiaon_wa_lauf + fiaon_wa_aktion). */
type LaufZustand = "laeuft" | "unterbrochen" | "fertig" | "angehalten" | "verfallen";
interface Lauf {
  id: string; laeuft: boolean; zustand?: LaufZustand; quelle: string; gruppe: Gruppe; vorlage: string; gesamt: number; erledigt?: number;
  gesendet: number; uebersprungen: number; fehler: number; entfallen?: number; gruende: Record<string, number>;
  seit: string; bis: string | null; abgebrochen: boolean; anhaltenAm?: string | null; fortsetzungen?: number;
  unterbrochenAm?: string | null; schluss?: string | null; herzschlagS?: number; restS?: number;
  /** E-252, nur im Client: Der Server kannte diesen Lauf nicht mehr — zu sehen ist der letzte bekannte Stand. */
  ohneEndstand?: boolean;
}
interface Eintrag {
  id: number; personId: number | null; name: string; gruppe: Gruppe; vorlage: string; quelle: string; ok: boolean; grund: string | null;
  am: string; von: string | null; zustellung: string | null; geantwortet: boolean;
}
interface Lage {
  whatsappBereit: boolean;
  meta: { grenze: number; verbraucht: number; frei: number; stufe: string | null; qualitaet: string | null };
  wartend?: { anzahl: number; laengsteMin: number };
  gruppen: GruppeInfo[];
  stufenText: string;
  vorlagen: Vorlage[];
  automatik: Automatik;
  kette: { an: boolean; pausiert: boolean };
  tagsueber: boolean;
  heute: {
    gesendet: number; nicht: number; automatik: number; hand: number; vorlagenGesamt: number; maraAntworten: number; rein: number; menschenRein: number; fehler: number;
    /** E-252: Bauplan § 9 — kommt vielleicht vom Server. Bis dahin: gesendet − Automatik − von Hand (es gibt nur diese drei Quellen). */
    verkaufstakt?: number;
  };
  wirkung7: { menschen: number; geantwortet: number; antrag: number; gezahlt: number; gezahltCents?: number };
  lauf: Lauf | null;
  /** E-253: höchstens so viele je Versand (Server, LAUF_HOECHSTENS = 500). */
  laufHoechstens?: number;
  /** E-253: so viele Sekunden braucht eine Nachricht im Lauf (Server, LAUF_SEKUNDEN_JE_PERSON). */
  laufSekundenJePerson?: number;
  letzte: Eintrag[];
}
interface VorschauZeile { personId: number; name: string; tage: number; vorlage: string; letzteVorlageAm: string | null; betrag: string | null; referenz: string | null; faelligAm?: string | null; text: string | null; hinderung: string | null }

const GRUPPEN_KURZ: Record<Gruppe, string> = {
  neu: "Neue Leads", zahlung_offen: "Zahlung offen", abbrecher: "Abgebrochen", ohne_antrag: "Ohne Antrag", rate_offen: "Monatsrate",
  auskunft_fehlt: "Auskunft fehlt",
};
const QUALITAET: Record<string, { text: string; art: "gut" | "warn" | "krit" }> = {
  GREEN: { text: "Qualität grün", art: "gut" }, YELLOW: { text: "Qualität gelb", art: "warn" }, RED: { text: "Qualität rot", art: "krit" },
};
const ZUSTELLUNG: Record<string, string> = { gesendet: "gesendet", sent: "gesendet", delivered: "zugestellt", read: "gelesen", failed: "Fehler", fehler: "Fehler", offen: "unterwegs" };
/** E-253: Die Grenze je Versand, falls lage.laufHoechstens fehlt — wie der Server (LAUF_HOECHSTENS) und der E-253-Client. */
const LAUF_GRENZE_RUECKFALL = 500;
/** E-253: Sekunden je Nachricht im Lauf, solange der Server lage.laufSekundenJePerson nicht liefert. */
const SEKUNDEN_RUECKFALL = 1.7;
/** Meta-Stufen in Gesprächen je 24 Stunden — nur für die Rechnung im (i), die Grenze selbst rechnet der Server. */
const META_STUFE: Record<string, number> = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 100000 };
/** E-250: Verlauf in Zwölferschritten (der Server liefert bis zu 60). */
const VERLAUF_SCHRITT = 12;

const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
/** ≈ Nachrichten am Tag bei gleichmäßigem Takt. */
function amTag(a: Pick<Automatik, "von" | "bis" | "jeStunde"> | null): number {
  if (!a || !/^\d{2}:\d{2}$/.test(a.von) || !/^\d{2}:\d{2}$/.test(a.bis)) return 0;
  return Math.max(0, Math.round(((hhmm(a.bis) - hhmm(a.von)) / 60) * a.jeStunde));
}

// ═══════════════════════════════════════════════════════════════════════════
// LEERE GRUPPE: Zustand als Form statt nackter Null (E-249, E-250)
// Aus den Feldern, die der Server heute schon liefert: wartend/wiederAb
// (angeschrieben, Abstand läuft), letzterLead (Gruppe „neu"). Sonst ein
// neutraler Satz — bis der Server leerGrund liefert (Bauplan § 9).
// ═══════════════════════════════════════════════════════════════════════════
interface Leer {
  /** Pille statt Zahl: „leer" oder „wieder ab 14:48" */
  pille: string; ton: "" | "akz";
  /** der Grund, ein oder zwei Sätze */
  satz: string;
  /** gelber Zusatz („Seit 4 Tagen keiner.") */
  warn: string | null;
  /** für die Kurzzeile der Automatik: „leer" / „ab 14:48" */
  kurz: string;
  /** Gruppe „neu": der Weg zum Lead-Motor */
  leadMotor: boolean;
}
function leerStand(gr: GruppeInfo): Leer | null {
  if (gr.anzahl > 0) return null;
  if (gr.wartend && gr.wartend > 0) {
    const wann = wannWieder(gr.wiederAb);
    const kurzWann = wann.startsWith("heute ") ? wann.slice(6) : wann;
    const abstand = gr.abstandTage > 0 ? ` (Abstand ${gr.abstandTage} ${gr.abstandTage === 1 ? "Tag" : "Tage"} je Mensch)` : "";
    return {
      pille: wann === "jetzt" ? "gleich wieder dran" : `wieder ab ${kurzWann}`, ton: "akz",
      satz: `${zahl(gr.wartend)} schon angeschrieben — wieder dran ab ${wann}${abstand}.`, warn: null,
      kurz: wann === "jetzt" ? "gleich wieder" : `ab ${kurzWann}`, leadMotor: false,
    };
  }
  if (gr.leerGrund) return { pille: "leer", ton: "", satz: gr.leerGrund, warn: null, kurz: "leer", leadMotor: gr.schluessel === "neu" };
  if (gr.schluessel === "neu") {
    const am = gr.letzterLead ? new Date(gr.letzterLead) : null;
    const gueltig = am && !Number.isNaN(am.getTime());
    // E-252 (28.09.2026): Kalendertage in Berlin wie im Entwurf („24.09. … seit 4 Tagen" am 28.09.),
    // nicht volle 24-Stunden-Blöcke — ein Lead vom 24.09. abends hieß sonst „seit 3 Tagen".
    const tage = gueltig ? Math.round((Date.parse(berlinTag()) - Date.parse(berlinTag(am!))) / 86_400_000) : 0;
    return {
      pille: "leer", ton: "",
      // tagNur endet schon mit Punkt („24.09.") — kein zweiter dahinter.
      satz: `Kein Lead wartet auf seine erste Nachricht.${gueltig ? ` Letzter neuer Lead: ${tagNur(berlinTag(am!))}` : ""}`,
      warn: tage >= 2 ? `Seit ${tage} Tagen keiner.` : null, kurz: "leer", leadMotor: true,
    };
  }
  return { pille: "leer", ton: "", satz: "Gerade erfüllt niemand die Regel dieser Gruppe.", warn: null, kurz: "leer", leadMotor: false };
}
const leerText = (l: Leer) => (l.warn ? `${l.satz} ${l.warn}` : l.satz);

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

function vorlagenName(name: string, vorlagen: Vorlage[]): string {
  if (name === "stufen") return "Passende Erinnerung (nach Alter)";
  const v = vorlagen.find((x) => x.name === name);
  return v?.kopf || name.replace(/^fiaon_kk_/, "").replace(/_/g, " ");
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS MARA GETAN HAT (24.09.2026, E-236)
//
// Liest GET /chef/wa-zentrale/mara-protokoll?tage=3 — jede Handlung, die Mara
// auf WhatsApp selbst ausgeführt hat, neueste zuerst. Bei eingetragenen
// Terminen steht das Ergebnis des Prüftakts dabei („✓ Termin steht · ✗ …").
// „Jetzt nachprüfen" hängt &pruefen=1 an: Der Server prüft sofort und liefert
// den neuen Stand. Zeiten immer in Berliner Zeit — egal, wo der Rechner steht.
// E-252: Die Summen sind eine ruhige Zeile, „Prüfung rot" eine Pille; 5 Zeilen,
// dann „Alle n zeigen" (reine Anzeige).
// ═══════════════════════════════════════════════════════════════════════════
type MaraArt = "zeiten_angeboten" | "termin_gebucht" | "termin_verschoben" | "termin_nicht_moeglich" | "terminlink" | "uebergabe" | "rueckfall";
interface MaraZeile {
  id: number; am: string; art: MaraArt; ok: boolean; text: string; nummer: string | null; personId: number | null; kunde: string | null;
  terminId: number | null; pruefungOk: boolean | null; pruefung: string | null; pruefungAm: string | null;
}
interface MaraProtokollDaten {
  ok: boolean; tage: number;
  summe: { termine: number; links: number; nichtMoeglich: number; uebergaben: number; rueckfaelle: number; pruefungFehler: number };
  zeilen: MaraZeile[];
}
type MaraFilter = "alle" | "termine" | "uebergaben" | "probleme";

const MARA_TAGE = 3;
/** E-250: 5 Zeilen, dann „Alle n zeigen" (vorher 25). */
const MARA_SEITE = 5;
const MARA_ART: Record<MaraArt, { text: string; art: "" | "akz" | "warn" }> = {
  zeiten_angeboten: { text: "Zeiten angeboten", art: "" },
  termin_gebucht: { text: "Termin eingetragen", art: "akz" },
  termin_verschoben: { text: "Termin verschoben", art: "akz" },
  termin_nicht_moeglich: { text: "Nicht möglich", art: "warn" },
  terminlink: { text: "Terminlink", art: "" },
  uebergabe: { text: "Übergabe", art: "" },
  rueckfall: { text: "Rückfall", art: "warn" },
};
const MARA_FILTER: { schluessel: MaraFilter; text: string }[] = [
  { schluessel: "alle", text: "Alle" }, { schluessel: "termine", text: "Termine" },
  { schluessel: "uebergaben", text: "Übergaben" }, { schluessel: "probleme", text: "Probleme" },
];
const TERMIN_ARTEN: ReadonlySet<string> = new Set(["zeiten_angeboten", "termin_gebucht", "termin_verschoben", "termin_nicht_moeglich", "terminlink"]);
/** Ein eingetragener Termin — nur diese Zeilen prüft der Takt nach. */
const istBuchung = (z: MaraZeile) => z.art === "termin_gebucht" || z.art === "termin_verschoben";
/** Buchung mit ok=false: gespeicherte Zeit weicht ab — der Prüftakt sieht sie nie (er prüft nur ok-Zeilen). */
const istUnsauber = (z: MaraZeile) => istBuchung(z) && !z.ok;
/** Rot = Nachprüfung stimmt nicht ODER Buchung nicht sauber. Die Summe „Prüfung rot" zählt genau diese Zeilen. */
const istRot = (z: MaraZeile) => z.pruefungOk === false || istUnsauber(z);
const istProblem = (z: MaraZeile) => !z.ok || z.pruefungOk === false || z.art === "termin_nicht_moeglich" || z.art === "rueckfall";
const passt = (z: MaraZeile, f: MaraFilter) =>
  f === "alle" ? true : f === "termine" ? TERMIN_ARTEN.has(z.art) : f === "uebergaben" ? z.art === "uebergabe" : istProblem(z);

const BERLIN = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** TT.MM. HH:MM in Berliner Zeit — über formatToParts, nie über Zahl(format()). */
function berlinZeit(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  const t: Record<string, string> = {};
  for (const p of BERLIN.formatToParts(d)) t[p.type] = p.value;
  return `${t.day}.${t.month}. ${t.hour}:${t.minute}`;
}
/** Voller Zeitpunkt für den Titel — ebenfalls Berliner Zeit, damit Liste und Tooltip nie auseinanderlaufen. */
const berlinLang = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—"
    : `${d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} Uhr (Berliner Zeit)`;
};
const nummerZeigen = (n: string) => (n.startsWith("+") ? n : `+${n}`);

/** „✗ außerhalb der Arbeitszeit · ✓ Termin steht" → einzelne Punkte. */
function pruefPunkte(s: string | null): { ok: boolean; text: string }[] {
  if (!s) return [];
  return s.split(" · ").map((t) => t.trim()).filter(Boolean).map((t) =>
    t.startsWith("✗") ? { ok: false, text: t.replace(/^✗\s*/, "") } : { ok: true, text: t.replace(/^✓\s*/, "") });
}

function MaraPruefung({ z }: { z: MaraZeile }) {
  const punkte = pruefPunkte(z.pruefung);
  if (z.pruefungOk === null && punkte.length === 0) {
    return <p className="wz-mp-offen">Noch nicht nachgeprüft — „Jetzt nachprüfen“ prüft sofort.</p>;
  }
  return (
    <div className={`wz-mp-pruefung${z.pruefungOk === false ? " rot" : ""}`}>
      <span className="wz-mp-pruefung-titel">{z.pruefungOk === false ? "Nachprüfung: stimmt nicht" : "Nachprüfung: stimmt"}</span>
      {punkte.length ? (
        <ul aria-label="Ergebnis der Nachprüfung">
          {punkte.map((p, i) => (
            <li key={i} className={p.ok ? "gut" : "rot"}>
              <span aria-hidden="true">{p.ok ? "✓" : "✗"}</span>
              <span className="wz-sr">{p.ok ? "erfüllt: " : "nicht erfüllt: "}</span>
              {p.text}
            </li>
          ))}
        </ul>
      ) : null}
      {z.pruefungAm ? <span className="mara-still">geprüft {seit(z.pruefungAm)}</span> : null}
    </div>
  );
}

/** Eine Summe der letzten Tage — bei 0 ein Wort statt der Zahl. */
function Summe({ n, eins, mehr, titel, warn }: { n: number; eins: string; mehr: string; titel: string; warn?: boolean }) {
  return n > 0
    ? <span title={titel}><b className={warn ? "mara-warn-t" : undefined}>{zahl(n)}</b>{n === 1 ? eins : mehr}</span>
    : <span className="mara-still" title={titel}>{mehr}: keine</span>;
}

function MaraProtokoll() {
  const prot = useDaten<MaraProtokollDaten>(`/chef/wa-zentrale/mara-protokoll?tage=${MARA_TAGE}`);
  const p = prot.daten;
  const [filter, setFilter] = useState<MaraFilter>("alle");
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [prueft, setPrueft] = useState(false);
  const [hinweis, setHinweis] = useState<{ text: string; art: "gut" | "fehler" } | null>(null);

  // Mara arbeitet rund um die Uhr: jede Minute still nachladen, solange die Seite sichtbar ist.
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === "visible") prot.neu(); }, 60_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setAlleZeigen(false); }, [filter]);
  // E-252: Ein gutes Ergebnis geht nach 12 s; ein Fehler bleibt stehen, bis man ihn schließt.
  useEffect(() => {
    if (!hinweis || hinweis.art === "fehler") return;
    const t = window.setTimeout(() => setHinweis(null), 12_000);
    return () => window.clearTimeout(t);
  }, [hinweis]);

  const nachpruefen = async () => {
    setPrueft(true); setHinweis(null);
    try {
      const r = await fetch(`${API}/chef/wa-zentrale/mara-protokoll?tage=${MARA_TAGE}&pruefen=1`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Die Nachprüfung hat nicht geklappt.");
      const neueZeilen: MaraZeile[] = Array.isArray(j.zeilen) ? j.zeilen : [];
      const rot = Number(j.summe?.pruefungFehler || 0);
      const unsauber = neueZeilen.filter(istUnsauber).length;
      const termine = Number(j.summe?.termine || 0);
      const teile: string[] = [];
      if (rot) teile.push(`${rot === 1 ? "1 Termin stimmt" : `${zahl(rot)} Termine stimmen`} nicht — als dringende Aufgabe an die Leitung gemeldet`);
      if (unsauber) teile.push(`${unsauber === 1 ? "1 Buchung ist" : `${zahl(unsauber)} Buchungen sind`} nicht sauber gespeichert — bitte im Kalender ansehen`);
      setHinweis(teile.length
        ? { art: "fehler", text: `Nachgeprüft: ${teile.join("; ")}. Rot markiert.` }
        : { art: "gut", text: termine ? `Nachgeprüft: ${termine === 1 ? "Der eine Mara-Termin stimmt" : `Alle ${zahl(termine)} Mara-Termine stimmen`}.` : `Nachgeprüft: In den letzten ${MARA_TAGE} Tagen hat Mara keinen Termin eingetragen.` });
      prot.neu();
    } catch (e: any) { setHinweis({ art: "fehler", text: e?.message || "Die Nachprüfung hat nicht geklappt." }); } finally { setPrueft(false); }
  };

  const zeilen = p?.zeilen ?? [];
  const anzahl: Record<MaraFilter, number> = {
    alle: zeilen.length,
    termine: zeilen.filter((z) => passt(z, "termine")).length,
    uebergaben: zeilen.filter((z) => passt(z, "uebergaben")).length,
    probleme: zeilen.filter((z) => passt(z, "probleme")).length,
  };
  const gefiltert = zeilen.filter((z) => passt(z, filter));
  const sichtbar = alleZeigen ? gefiltert : gefiltert.slice(0, MARA_SEITE);
  const s = p?.summe;
  // Server zählt nur pruefung_ok=false; nicht sauber gespeicherte Buchungen kommen dazu — sonst stünde „alles stimmt" neben einer roten Zeile.
  const rotZahl = s ? Math.max(s.pruefungFehler, zeilen.filter(istRot).length) : 0;

  return (
    <section className="mara-karte wz-karte wz-mara" aria-labelledby="wz-mara-titel">
      <div className="mara-kopfzeile">
        <div>
          <h2 id="wz-mara-titel">Was Mara getan hat</h2>
          <p className="mara-still mara-klein">Letzte {MARA_TAGE} Tage · jeder eingetragene Termin wird nachgeprüft</p>
        </div>
        <button type="button" className="mara-knopf klein" onClick={() => void nachpruefen()} disabled={prueft || !p}>
          {prueft ? "Prüft …" : "Jetzt nachprüfen"}
        </button>
      </div>

      {hinweis ? (
        <p className={`mara-meldung${hinweis.art === "fehler" ? " fehler" : ""}`} role={hinweis.art === "fehler" ? "alert" : "status"}>
          <span>{hinweis.text}</span>
          {hinweis.art === "fehler" ? <button type="button" className="mara-knopf text" onClick={() => setHinweis(null)}>Schließen</button> : null}
        </p>
      ) : null}
      {prot.laedt && !p ? <Geruest zeilen={4} /> : null}
      {prot.fehler && !p ? <Fehlermeldung text={prot.fehler} erneut={prot.neu} /> : null}
      {prot.fehler && p ? <p className="mara-still mara-klein" role="status">Neu laden hat nicht geklappt — zu sehen ist der letzte Stand.</p> : null}

      {p && s ? (
        <>
          <div className="wz-summen" role="group" aria-label={`Summen der letzten ${MARA_TAGE} Tage`}>
            <Summe n={s.termine} eins="Termin eingetragen" mehr="Termine eingetragen" titel="gebucht oder verschoben" />
            <Summe n={s.links} eins="Terminlink" mehr="Terminlinks" titel="persönlich geschickt" />
            <Summe n={s.nichtMoeglich} eins="nicht möglich" mehr="nicht möglich" titel="kein Termin eingetragen" warn />
            <Summe n={s.uebergaben} eins="Übergabe" mehr="Übergaben" titel="an einen Menschen" />
            <Summe n={s.rueckfaelle} eins="Rückfall" mehr="Rückfälle" titel="Ersatzsatz statt Antwort" warn />
            {rotZahl
              ? <span className="mara-pille krit" title="Nachprüfung stimmt nicht oder Buchung nicht sauber">{zahl(rotZahl)} Prüfung rot</span>
              : <span className="mara-pille gut" title="Prüfung rot: keine — alles stimmt">Prüfung: alles stimmt</span>}
          </div>

          {zeilen.length === 0 ? (
            <p className="wz-mp-leer">Mara hat in den letzten {MARA_TAGE} Tagen noch nichts eingetragen.</p>
          ) : (
            <>
              <div className="wz-mp-filter" role="group" aria-label="Filter">
                {MARA_FILTER.map((f) => (
                  <button key={f.schluessel} type="button" aria-pressed={filter === f.schluessel}
                    className={`${filter === f.schluessel ? "aktiv" : ""}${f.schluessel === "probleme" && anzahl.probleme > 0 ? " rot" : ""}`}
                    onClick={() => setFilter(f.schluessel)}>
                    {f.text}{anzahl[f.schluessel] ? <em>{zahl(anzahl[f.schluessel])}</em> : null}
                  </button>
                ))}
              </div>

              {gefiltert.length === 0 ? (
                <p className="wz-mp-leer">
                  {filter === "probleme" ? `Keine Probleme in den letzten ${MARA_TAGE} Tagen.` : filter === "uebergaben" ? "Keine Übergaben in diesem Zeitraum." : "Keine Termine in diesem Zeitraum."}
                </p>
              ) : (
                <ol className="wz-mp-liste">
                  {sichtbar.map((z) => {
                    const art = MARA_ART[z.art] ?? { text: String(z.art), art: "" as const };
                    const rot = istRot(z);
                    const warn = !rot && istProblem(z);
                    const wer = z.kunde || (z.nummer ? nummerZeigen(z.nummer) : "Unbekannt");
                    const zeigePruefung = (istBuchung(z) && z.ok && z.terminId != null) || z.pruefung != null;
                    return (
                      <li key={z.id} className={`wz-mp-zeile${rot ? " rot" : warn ? " warn" : ""}`}>
                        <time className="wz-mp-zeit" dateTime={z.am} title={berlinLang(z.am)}>{berlinZeit(z.am)}</time>
                        <div className="wz-mp-inhalt">
                          <div className="wz-mp-kopf">
                            <span className="wz-mp-kunde">
                              {z.personId ? <a href={`/chef/s/akte?id=${z.personId}`}>{wer}</a> : wer}
                              {z.kunde && z.nummer ? <span className="mara-still"> · {nummerZeigen(z.nummer)}</span> : null}
                            </span>
                            <span className={`mara-pille${art.art ? ` ${art.art}` : ""}`}>{art.text}</span>
                            {!z.ok && istBuchung(z) ? <span className="mara-pille krit">nicht sauber</span> : null}
                            {z.terminId != null ? <span className="mara-still mara-klein">Termin #{z.terminId}</span> : null}
                          </div>
                          <p className="wz-mp-text">{z.text}</p>
                          {zeigePruefung ? <MaraPruefung z={z} /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {!alleZeigen && gefiltert.length > MARA_SEITE ? (
                <button type="button" className="mara-knopf klein mara-mehr" onClick={() => setAlleZeigen(true)}>
                  Alle {zahl(gefiltert.length)} zeigen
                </button>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

/** Eine Nachricht so, wie sie im Handy aussieht — Kopfbild, Text, Fuß. */
function Blase({ v, text }: { v: Vorlage | undefined; text: string }) {
  return (
    <div className="wz-blase">
      {v?.bild && v.kopfBild
        ? <img src={`/wa/fiaon-${v.kopfBild}.png`} alt="" className="wz-blase-bild" />
        : v?.kopf ? <strong className="wz-blase-kopf">{v.kopf}</strong> : null}
      <p>{text}</p>
      {v?.fuss ? <small>{v.fuss}</small> : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAUFKARTE (E-253 übernommen, E-252 gestaltet)
//
// E-253 (Justin 28.09.: „Das steht seit 5 Minuten. Warum?"): Die Karte kennt
// fünf Zustände, jeder mit eigenem Satz statt einer eingefrorenen Zahl —
// läuft · kurz unterbrochen (Neustart, geht von selbst weiter) · fertig ·
// angehalten · Tageswechsel. Die Felder (zustand, erledigt, entfallen,
// anhaltenAm, fortsetzungen, schluss, herzschlagS, restS) liefert der Server
// (E-253); fehlen sie, gilt laeuft/abgebrochen.
// E-252: matt im Glas, kein Pulsen, kein Lichtstreif (keine Dauer-Animation).
// Kennt der Server den Lauf nicht (nur Läufe von vor E-253, ohneEndstand),
// steht der letzte bekannte Stand da: „fertig", wenn alles erledigt war,
// sonst „unterbrochen".
// ═══════════════════════════════════════════════════════════════════════════
const LAUF_TITEL: Record<LaufZustand, string> = {
  laeuft: "Versand läuft",
  unterbrochen: "Kurz unterbrochen — geht gleich weiter",
  fertig: "Versand fertig",
  angehalten: "Versand angehalten",
  verfallen: "Versand beendet",
};
function laufZustand(l: Lauf): LaufZustand {
  return l.zustand ?? (l.laeuft ? "laeuft" : l.abgebrochen ? "angehalten" : "fertig");
}
const laufErledigt = (l: Lauf) => Math.min(Math.max(0, l.gesamt), l.erledigt ?? l.gesendet + l.uebersprungen + l.fehler + (l.entfallen ?? 0));

/** „14 Sek.", „3 Min.", „1 Std. 5 Min." — für Restzeit und Dauer eines Versands (E-253). */
function dauerText(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden));
  if (s < 60) return `${Math.max(1, s)} Sek.`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} Min.`;
  return `${Math.floor(min / 60)} Std.${min % 60 ? ` ${min % 60} Min.` : ""}`;
}
/** Uhrzeit mit Sekunden in Berlin (E-253) — als Text, nie als Zahl. */
const uhrzeit = (s: string | number) => new Date(s).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

function LaufKarte({ lauf, vorlagen, sekundenJePerson, hinweis, verbindung, onAnhalten, onAktualisieren, anhaltenLaeuft }: {
  lauf: Lauf; vorlagen: Vorlage[]; sekundenJePerson: number;
  /** der Stand ist auf dem Server nicht (mehr) zu finden, oder das Abfragen hat aufgehört */
  hinweis: string | null;
  /** keine Verbindung seit … (Uhrzeit des letzten Stands) */
  verbindung: string | null;
  onAnhalten: () => void; onAktualisieren: () => void; anhaltenLaeuft: boolean;
}) {
  const z = laufZustand(lauf);
  // Ein Server-„unterbrochen" läuft weiter (laeuft = true). Ohne Server steht der Lauf — dann kein „geht gleich weiter".
  const titel = z === "unterbrochen" && !lauf.laeuft ? "Versand unterbrochen" : LAUF_TITEL[z];
  const ton = z === "laeuft" ? "akz" : z === "unterbrochen" ? "warn" : z === "fertig" ? "gut" : "";
  const gesamt = Math.max(0, lauf.gesamt);
  const entfallen = lauf.entfallen ?? 0;
  const erledigt = laufErledigt(lauf);
  const offen = Math.max(0, gesamt - erledigt);
  const anteil = (n: number) => `${gesamt ? Math.min(100, (n / gesamt) * 100) : 0}%`;
  // E-253 (Nachtrag nach der Gegenprüfung): Bis etwa 60 s ohne Lebenszeichen wartet der Server auf Meta.
  // Darüber kann er auch weg sein (Absturz, Deploy ohne SIGTERM) — dann nie „Wartet auf Meta" behaupten.
  const herzschlag = lauf.herzschlagS ?? 0;
  const stillstand = z === "laeuft" && herzschlag > 20;
  const dauer = lauf.bis ? (new Date(lauf.bis).getTime() - new Date(lauf.seit).getTime()) / 1000 : 0;
  const saetze: { text: string; art?: "warn" | "gut" | "akz" }[] = [];
  if (z === "unterbrochen" && lauf.laeuft) {
    saetze.push({ art: "warn", text: "Der Server wurde gerade neu gestartet. Der Versand steht in der Datenbank und geht spätestens in einer Minute von selbst weiter — durch den Neustart bekommt niemand eine zweite Nachricht." });
  }
  if (z === "laeuft" && lauf.anhaltenAm) saetze.push({ art: "warn", text: "Hält nach der aktuellen Nachricht an." });
  else if (stillstand && herzschlag <= 60) saetze.push({ art: "akz", text: `Wartet auf Meta — die letzte Antwort kam vor ${dauerText(herzschlag)}.` });
  else if (stillstand) {
    saetze.push({ art: "warn", text: `Seit ${dauerText(herzschlag)} kein Lebenszeichen vom Server. Hängt nur Meta, geht es danach von selbst weiter; ist der Server weg, übernimmt ein neuer spätestens nach drei Minuten — durch die Übernahme bekommt niemand eine zweite Nachricht.` });
  }
  if ((lauf.fortsetzungen ?? 0) > 0 && z !== "unterbrochen") {
    saetze.push({ art: "gut", text: `Nach ${lauf.fortsetzungen === 1 ? "einem Neustart" : `${lauf.fortsetzungen} Neustarts`} des Servers fortgesetzt — durch den Neustart wurde niemand doppelt angeschrieben.` });
  }
  if (entfallen > 0) {
    saetze.push({ text: `${zahl(entfallen)} ${entfallen === 1 ? "war" : "waren"} inzwischen nicht mehr dran (geantwortet, bezahlt oder heute schon angeschrieben) — nicht angeschrieben.` });
  }
  if (lauf.schluss) saetze.push({ art: z === "fertig" || z === "verfallen" ? "warn" : undefined, text: lauf.schluss });
  if (z === "angehalten" && offen > 0) saetze.push({ text: `${zahl(offen)} aus dem Plan wurden nicht mehr angeschrieben.` });
  const gruende = Object.entries(lauf.gruende ?? {}).sort((a, b) => b[1] - a[1]);
  const gruendeSumme = gruende.reduce((a, [, n]) => a + n, 0);

  return (
    <section className={`wz-lauf z-${z}`} aria-label="Stand des Versands" aria-live="polite">
      <div className="wz-lauf-kopf">
        <span className="wz-lauf-marke"><span className={`mara-punkt${ton ? ` ${ton}` : ""}`} aria-hidden="true" />{titel}</span>
        <span className="mara-still mara-klein">
          {GRUPPEN_KURZ[lauf.gruppe] ?? lauf.gruppe} · {vorlagenName(lauf.vorlage, vorlagen)} · {lauf.quelle === "hand" ? "von Hand" : "Automatik"} · {tagZeitBerlin(lauf.seit)}
        </span>
        {lauf.laeuft && !lauf.anhaltenAm ? (
          <button type="button" className="mara-knopf klein" onClick={onAnhalten} disabled={anhaltenLaeuft}>
            {anhaltenLaeuft ? "Hält an …" : "Anhalten"}
          </button>
        ) : null}
      </div>

      <div className="wz-lauf-mitte">
        <div className="wz-lauf-gross">
          {lauf.gesendet ? <b>{zahl(lauf.gesendet)}</b> : <b className="wort">noch keine</b>}
          <span>von {zahl(gesamt)} gesendet</span>
        </div>
        <dl className="wz-lauf-kennzahlen">
          <div><dt>Übersprungen</dt><dd>{lauf.uebersprungen ? zahl(lauf.uebersprungen) : "keiner"}</dd></div>
          {lauf.fehler ? <div className="rot"><dt>Fehler</dt><dd>{zahl(lauf.fehler)}</dd></div> : null}
          {entfallen ? <div><dt>Entfallen</dt><dd>{zahl(entfallen)}</dd></div> : null}
          {lauf.laeuft ? <div><dt>Offen</dt><dd>{offen ? zahl(offen) : "keiner"}</dd></div> : null}
          <div>
            <dt>{lauf.laeuft ? "Noch etwa" : "Dauer"}</dt>
            <dd>{lauf.laeuft ? (offen ? dauerText(lauf.restS ?? offen * sekundenJePerson) : "—") : lauf.bis ? dauerText(dauer) : "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="wz-balken" role="progressbar" aria-label="Fortschritt des Versands"
        aria-valuemin={0} aria-valuemax={gesamt || 1} aria-valuenow={erledigt} aria-valuetext={`${zahl(erledigt)} von ${zahl(gesamt)} erledigt`}>
        <i className="gut" style={{ width: anteil(lauf.gesendet) }} />
        <i className="still" style={{ width: anteil(lauf.uebersprungen + lauf.fehler) }} />
        <i className="weg" style={{ width: anteil(entfallen) }} />
      </div>
      <div className="wz-lauf-legende" aria-hidden="true">
        <span><i className="gut" />gesendet</span>
        <span><i className="still" />übersprungen</span>
        {entfallen ? <span><i className="weg" />entfallen</span> : null}
        <span className="wz-lauf-erledigt">{erledigt ? `${zahl(erledigt)} von ${zahl(gesamt)} erledigt` : "noch nichts erledigt"}</span>
      </div>

      {saetze.map((x, i) => <p key={i} className={`wz-lauf-satz${x.art ? ` ${x.art}` : ""}`}>{x.text}</p>)}
      {verbindung ? <p className="wz-lauf-satz warn" role="status">Keine Verbindung zum Server — zu sehen ist der Stand von {verbindung}. Es wird weiter versucht.</p> : null}
      {hinweis ? (
        <p className="wz-lauf-satz warn" role="status">
          {hinweis} <button type="button" className="mara-knopf text" onClick={onAktualisieren}>Stand holen</button>
        </p>
      ) : null}

      {gruende.length ? (
        <details className="mara-klappe wz-gruende-auf" open={gruende.length <= 3}>
          <summary>Warum übersprungen · {zahl(gruendeSumme)}</summary>
          <ul className="wz-gruende">
            {gruende.map(([grund, n]) => <li key={grund}><span>{grund}</span><b>{zahl(n)}</b></li>)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Eine Tageszahl in der leisen Zeile — bei 0 ein Wort. */
function Heute({ n, text, leer, unter, voll }: { n: number; text: string; leer: string; unter?: string | null; voll?: boolean }) {
  return (
    <span className={`w${voll ? " voll" : ""}`}>
      {n > 0 ? <span><b>{zahl(n)}</b>{text}</span> : <span>{leer}</span>}
      {n > 0 && unter ? <em>{unter}</em> : null}
    </span>
  );
}

export default function ChefWhatsAppZentrale() {
  const ml = useMaraLage();
  // E-252: die Lage der Wurzel (lädt jede Minute neu, nur bei sichtbarem Tab) — außerhalb des Steuerpults eine eigene.
  const lage = useMaraDaten<Lage>("lage", MARA_QUELLEN.lage);
  const rg = useMaraRundgang();
  const { meldung, melden, zu } = useMeldung();
  const d = lage.daten;
  const [gruppe, setGruppe] = useState<Gruppe>("neu");
  const [vorlage, setVorlage] = useState<string>("fiaon_kk_anfrage");
  const [anzahl, setAnzahl] = useState<number>(50);
  const [vorschau, setVorschau] = useState<VorschauZeile[] | null>(null);
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [auto, setAuto] = useState<Automatik | null>(null);
  // E-253: was die Laufkarte über die Verbindung weiß — nie wieder eine eingefrorene Zahl ohne Satz.
  const [laufHinweis, setLaufHinweis] = useState<string | null>(null);
  const [laufVerbindung, setLaufVerbindung] = useState<string | null>(null);
  const [abfrageRunde, setAbfrageRunde] = useState(0);
  const [haeltAn, setHaeltAn] = useState(false);
  const [infMeta, setInfMeta] = useState(false);
  const [infSatz, setInfSatz] = useState(false);
  const [infEinw, setInfEinw] = useState(false);
  const [verlaufZeilen, setVerlaufZeilen] = useState(VERLAUF_SCHRITT);
  const laufFesthalten = useRef(false);
  const autoServer = useRef<string | null>(null);
  // Der zuletzt gezeigte Lauf — für den Abfrage-Takt, der in einer alten Closure läuft.
  const laufRef = useRef<Lauf | null>(null);
  laufRef.current = lauf;

  /** Einen Laufstand übernehmen — ein vorgemerktes „hält an" bleibt, falls ein Stand das Feld nicht mitbringt. */
  const laufUebernehmen = (neu: Lauf) => setLauf((alt) => (
    alt && alt.id === neu.id && alt.anhaltenAm && !("anhaltenAm" in neu) ? { ...neu, anhaltenAm: alt.anhaltenAm } : neu));

  // Beim Laden: laufender (oder zuletzt gelaufener) Versand und die gespeicherte Automatik übernehmen.
  // E-253: Kennt der Server einen Lauf nicht (mehr), bleibt die Karte mit ihrem Hinweis stehen,
  // statt beim Neuladen der Lage wortlos zu verschwinden.
  // E-252: Die Lage kommt jetzt jede Minute neu. Die Automatik folgt dem Server nur, solange hier
  // nichts ungespeichert geändert ist — sonst bliebe ein fremder Stand stehen oder eine Eingabe ginge verloren.
  const autoSchluessel = (a: Automatik) => JSON.stringify({ ...a, dieseStunde: 0, geaendertAm: null, geaendertVon: null });
  // E-252: Sagt die Lage „kein Lauf", während hier einer läuft, entscheidet die Laufabfrage (2 s) —
  // die Karte verschwindet nie wortlos, sie endet mit „fertig" oder „unterbrochen".
  useEffect(() => {
    if (!d) return;
    if (d.lauf) { laufUebernehmen(d.lauf); laufFesthalten.current = false; }
    else if (!laufFesthalten.current && !laufRef.current?.laeuft) setLauf(null);
    const vorher = autoServer.current;
    setAuto((alt) => (!alt || (vorher !== null && autoSchluessel(alt) === vorher) ? d.automatik : alt));
    autoServer.current = autoSchluessel(d.automatik);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // E-249 (28.09.2026): Die Seite öffnet mit einer Gruppe, in der wirklich jemand dran ist —
  // nicht mit „Neue Leads", wenn dort 0 steht. Eine Wahl von Hand bleibt.
  const vonHand = useRef(false);
  useEffect(() => {
    if (!d || vonHand.current) return;
    const jetzt = d.gruppen.find((x) => x.schluessel === gruppe);
    if (jetzt && jetzt.anzahl > 0) return;
    const erste = d.gruppen.find((x) => x.anzahl > 0);
    if (erste) setGruppe(erste.schluessel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // E-252: Wunsch aus der Verkaufsleiste („„Erste Zahlung offen" ab 14:48 wieder dran →") — diese Gruppe wählen.
  useEffect(() => {
    const w = ml?.gruppeWunsch;
    if (w) { vonHand.current = true; setGruppe(w.gruppe as Gruppe); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ml?.gruppeWunsch?.nr]);

  // Die Vorlage folgt der Gruppe.
  const g = d?.gruppen.find((x) => x.schluessel === gruppe);
  useEffect(() => {
    if (g && !g.vorlagen.includes(vorlage)) setVorlage(g.standard);
    setVorschau(null); setInfSatz(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruppe, g?.standard]);
  useEffect(() => { setVorschau(null); }, [vorlage]);

  const sekundenJePerson = d?.laufSekundenJePerson ?? SEKUNDEN_RUECKFALL;

  // Ein neuer Lauf beginnt ohne alte Sätze.
  const laufId = lauf?.id ?? null;
  useEffect(() => { setLaufHinweis(null); setLaufVerbindung(null); }, [laufId]);

  // Solange ein Versand läuft: alle 2 Sekunden der Stand GENAU DIESES Laufs, am Ende die Lage neu.
  // E-253 (28.09.2026): Bis dahin übernahm die Seite nur „if (r?.lauf)" — antwortete nach einem Deploy der
  // neue Server „kein Lauf", blieb sie für immer auf dem letzten Stand und fragte endlos weiter. Jetzt:
  //   · Gefragt wird nach …/lauf?id= — jede Instanz liest ihn aus der Datenbank.
  //   · Kommt kein oder ein anderer Lauf zurück (nur Läufe von vor E-253): Abfragen beenden, Lage neu
  //     holen (Endstand, Verlauf), und die Karte sagt es — „fertig", wenn alles erledigt war, sonst
  //     „unterbrochen" (E-252). Der Hinweis ist wortgleich mit E-253.
  //   · 15 Fehlversuche in Folge (30 s): „Keine Verbindung — Stand von …", es wird weiter versucht.
  //   · Spätestens nach der doppelten geplanten Dauer (mindestens 20 Minuten) hört das Abfragen auf —
  //     „Stand holen" fragt von Hand.
  useEffect(() => {
    if (!lauf?.laeuft) return;
    const id = lauf.id;
    let fehl = 0;
    let aus = false;
    let letzterStand = Date.now();
    const frist = Date.now() + Math.max(20 * 60_000, (lauf.gesamt || 0) * sekundenJePerson * 1000 * 2 + 5 * 60_000);
    const t = window.setInterval(async () => {
      if (aus) return;
      if (Date.now() > frist) {
        aus = true; window.clearInterval(t);
        setLaufHinweis(`Der Stand wird nicht mehr von selbst abgefragt (zuletzt ${uhrzeit(letzterStand)}).`);
        return;
      }
      try {
        const r = await fetch(`${API}/chef/wa-zentrale/lauf?id=${encodeURIComponent(id)}`, { credentials: "include" });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error("Stand nicht lesbar");
        if (aus) return;
        fehl = 0; letzterStand = Date.now(); setLaufVerbindung(null);
        if (j.lauf && j.lauf.id === id) {
          laufUebernehmen(j.lauf);
          if (!j.lauf.laeuft) { aus = true; window.clearInterval(t); lage.neu(); }
        } else {
          aus = true; window.clearInterval(t);
          laufFesthalten.current = true;
          const bekannt = laufRef.current;
          const fertig = !!bekannt && bekannt.id === id && bekannt.gesamt > 0 && laufErledigt(bekannt) >= bekannt.gesamt;
          setLauf((alt) => (alt && alt.id === id ? { ...alt, laeuft: false, zustand: fertig ? "fertig" : "unterbrochen", ohneEndstand: true } : alt));
          setLaufHinweis("Der Stand dieses Versands ist auf dem Server nicht mehr abrufbar (er wurde vor dem Umbau gestartet). Was rausging, steht unten im Verlauf.");
          lage.neu();
        }
      } catch {
        fehl++;
        if (fehl >= 15) setLaufVerbindung(uhrzeit(letzterStand));
      }
    }, 2000);
    return () => { aus = true; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lauf?.laeuft, lauf?.id, abfrageRunde]);

  /** „Stand holen": einmal fragen und — läuft er noch — das Abfragen neu beginnen (E-253). */
  const laufAktualisieren = async () => {
    try {
      const r = await fetch(`${API}/chef/wa-zentrale/lauf${lauf ? `?id=${encodeURIComponent(lauf.id)}` : ""}`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Der Stand ließ sich nicht lesen.");
      if (j.lauf) { setLaufHinweis(null); laufFesthalten.current = false; laufUebernehmen(j.lauf); setAbfrageRunde((n) => n + 1); } else { lage.neu(); }
    } catch (e: any) { setLaufHinweis(e?.message || "Der Stand ließ sich nicht lesen."); }
  };

  // ── Wie viele dürfen raus: das Kleinste aus Grenze je Versand, Gruppe, Meta frei — und WARUM ──
  // E-253: Die Grenze je Versand kommt vom Server (laufHoechstens, 500) — nie mehr, als Meta heute noch erlaubt.
  const grenzeJeVersand = d?.laufHoechstens ?? LAUF_GRENZE_RUECKFALL;
  const leer = g ? leerStand(g) : null;
  const knapp = d && g
    ? [
      { n: grenzeJeVersand, warum: "Grenze je Versand" },
      { n: g.anzahl, warum: "so viele sind in der Gruppe dran" },
      { n: d.meta.frei, warum: "so viel gibt Meta heute noch frei" },
    ].reduce((a, b) => (b.n < a.n ? b : a))
    : null;
  const hoechstens = knapp ? Math.max(0, knapp.n) : 0;
  const menge = Math.max(0, Math.min(anzahl, hoechstens));
  const gewaehlt = d?.vorlagen.find((v) => v.name === vorlage);
  const vorlageFrei = vorlage === "stufen" || !!gewaehlt?.frei;
  // "" heißt: niemand dran — kein Fehler, der Knopf sagt „Niemand dran" und bietet eine andere Gruppe an.
  const sperre: string | null = !d ? "Lädt …"
    : !d.whatsappBereit ? "WhatsApp ist auf dem Server nicht eingerichtet."
    : !d.tagsueber ? "Zwischen 21:00 und 07:00 schreiben wir niemanden an."
    : d.meta.qualitaet === "RED" ? "Meta bewertet die Nummer mit Rot — Massenversand gesperrt."
    : d.meta.frei <= 0 ? "Das Tageslimit von Meta ist ausgeschöpft."
    : !vorlageFrei ? "Diese Vorlage ist bei Meta noch nicht freigegeben."
    : lauf?.laeuft ? (laufZustand(lauf) === "unterbrochen" ? "Ein Versand wurde durch einen Neustart unterbrochen und geht gleich von selbst weiter." : "Es läuft schon ein Versand.")
    : menge <= 0 ? (leer ? "" : "In dieser Gruppe ist gerade niemand dran.")
    : null;
  const beste = d ? [...d.gruppen].filter((x) => x.anzahl > 0).sort((a, b) => b.anzahl - a.anzahl)[0] : undefined;

  const hinrollen = (sel: string) => {
    if (ml) { ml.zeigen(sel, { block: "start" }); return; }
    (document.querySelector(sel) as HTMLElement | null)?.scrollIntoView({ block: "start", behavior: ruhig() ? "auto" : "smooth" });
  };
  const schmal = () => { try { return window.matchMedia("(max-width: 980px)").matches; } catch { return false; } };
  const waehlen = (s: Gruppe, rollen: boolean) => {
    vonHand.current = true; setGruppe(s);
    if (rollen) hinrollen(".wz-start");
  };

  const vorschauLaden = async () => {
    setBeschaeftigt("vorschau");
    try {
      const r = await fetch(`${API}/chef/wa-zentrale/vorschau?gruppe=${gruppe}&vorlage=${encodeURIComponent(vorlage)}&anzahl=5`, { credentials: "include" });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Die Vorschau ließ sich nicht laden.");
      setVorschau(j.empfaenger);
    } catch (e: any) { melden(e.message, "start", true); } finally { setBeschaeftigt(null); }
  };

  const starten = async () => {
    if (!d || sperre !== null) return;
    // E-253: Rückfragetext wortgleich mit dem Live-Stand b5bae0a8 (Dauer, Neustart).
    const satz = `Mara schreibt jetzt bis zu ${zahl(menge)} Menschen aus „${g?.titel}“ an — Vorlage „${vorlagenName(vorlage, d.vorlagen)}“. `
      + `Eine Nachricht nach der anderen, Dauer etwa ${dauerText(menge * sekundenJePerson)}, jederzeit anhaltbar. `
      + "Auch ein Neustart des Servers unterbricht nur kurz. Starten?";
    if (!window.confirm(satz)) return;
    setBeschaeftigt("start");
    try {
      const j = await senden("/chef/wa-zentrale/start", { gruppe, vorlage, anzahl: menge });
      setLaufHinweis(null); setLaufVerbindung(null); laufFesthalten.current = false;
      setLauf(j.lauf); setVorschau(null);
      melden(`Versand gestartet: ${zahl(j.lauf?.gesamt ?? menge)} Nachrichten geplant.`, "start");
    } catch (e: any) { melden(e.message, "start", true); } finally { setBeschaeftigt(null); lage.neu(); }
  };

  // E-253: Der Server sagt, ob es etwas anzuhalten gab — kein „hält an", wenn nichts läuft.
  const anhalten = async () => {
    setHaeltAn(true);
    try {
      const j = await senden("/chef/wa-zentrale/stopp", {});
      if (j.angehalten) {
        melden(j.zustand === "angehalten" ? "Der Versand ist angehalten." : "Der Versand hält nach der aktuellen Nachricht an.", "lauf");
        setLauf((l) => (l ? { ...l, anhaltenAm: new Date().toISOString() } : l));
        if (j.zustand === "angehalten") void laufAktualisieren();
      } else {
        melden("Es läuft gerade kein Versand — es gab nichts anzuhalten.", "lauf", true);
        void laufAktualisieren();
      }
    } catch (e: any) { melden(e.message, "lauf", true); } finally { setHaeltAn(false); }
  };

  const automatikSpeichern = async (neu: Partial<Automatik>, satz: string) => {
    if (!auto) return;
    setBeschaeftigt("automatik");
    try {
      const j = await senden("/chef/wa-zentrale/automatik", { ...auto, ...neu });
      setAuto({ ...j.automatik, dieseStunde: auto.dieseStunde });
      melden(satz, "automatik"); lage.neu();
    } catch (e: any) { melden(e.message, "automatik", true); } finally { setBeschaeftigt(null); }
  };

  const proTag = useMemo(() => amTag(auto), [auto]);
  const autoGeaendert = !!(auto && d && autoSchluessel(auto) !== autoSchluessel(d.automatik));

  const gruppeVerschieben = (gr: Gruppe, richtung: -1 | 1) => {
    if (!auto) return;
    const liste = [...auto.gruppen];
    const i = liste.indexOf(gr);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
    setAuto({ ...auto, gruppen: liste });
  };
  const gruppeUmschalten = (gr: Gruppe) => {
    if (!auto) return;
    setAuto({ ...auto, gruppen: auto.gruppen.includes(gr) ? auto.gruppen.filter((x) => x !== gr) : [...auto.gruppen, gr] });
  };

  const q = d?.meta.qualitaet ? QUALITAET[d.meta.qualitaet] : null;

  return (
    <div className={`wz${ml ? "" : " mara"}`}>
      <Rundgang raum="wa-zentrale" titel="WhatsApp-Zentrale" schritte={RUNDGAENGE.waZentrale.schritte} {...rg} />
      {lage.laedt && !d && <Geruest zeilen={8} />}
      {lage.fehler && !d && <Fehlermeldung text={lage.fehler} erneut={lage.neu} />}
      {d && auto && (() => {
        const a = d.automatik;
        const frei = d.meta.frei;
        const stufe = d.meta.stufe ? d.meta.stufe.replace("TIER_", "Stufe ") : null;
        const stufeZahl = d.meta.stufe ? META_STUFE[d.meta.stufe] : undefined;
        const wartend = d.wartend?.anzahl ?? 0;
        const w7 = d.wirkung7;
        const naechste = w7.gezahlt ? null : naechsteGruppe(d);
        const naechsteInfo = naechste ? d.gruppen.find((x) => x.schluessel === naechste.schluessel) : undefined;
        const naechsteAuto = !!naechste && a.an && a.gruppen.includes(naechste.schluessel as Gruppe);
        const h = d.heute;
        // Bauplan § 9, Rückfall ohne Server: Es gibt nur drei Quellen (hand, automatik, verkaufstakt).
        const takt = h.verkaufstakt ?? Math.max(0, h.gesendet - h.automatik - h.hand);
        const gesendetWege = [
          h.automatik ? `${zahl(h.automatik)} Automatik` : null,
          takt ? `${zahl(takt)} Auskunft-Takt` : null,
          h.hand ? `${zahl(h.hand)} von Hand` : "keine von Hand",
        ].filter(Boolean).join(" · ");
        const voll = d.gruppen.filter((x) => x.anzahl > 0);
        const leere = d.gruppen.filter((x) => x.anzahl <= 0);
        const verlauf = d.letzte.slice(0, verlaufZeilen);
        // Langer Gruppensatz (z. B. „Auskunft fehlt", 95 Wörter): der Anfang hier, der ganze Satz hinter (i). Ohne Lookbehind (ältere iPhones).
        const kurzSatz = g && g.satz.length > 160 ? `${(g.satz.split(/\.\s/)[0] ?? g.satz).slice(0, 120).replace(/\s\S*$/, "")} …` : null;

        const gruppeZeile = (gr: GruppeInfo) => {
          const an = gruppe === gr.schluessel;
          const l = leerStand(gr);
          const auswahl = () => waehlen(gr.schluessel, schmal());
          if (l) {
            return (
              <button key={gr.schluessel} type="button" role="radio" aria-checked={an} className={`wz-gruppe leer${an ? " aktiv" : ""}`} onClick={auswahl}>
                <span className="wz-gruppe-titel">{gr.titel}</span>
                <span className={`mara-pille${l.ton ? ` ${l.ton}` : ""}`}>{l.pille}</span>
                <span className="wz-gruppe-leer">{l.satz}{l.warn ? <> <span className="mara-warn-t">{l.warn}</span></> : null}</span>
              </button>
            );
          }
          const einw = gr.mitEinwilligung;
          const anteil = einw != null && gr.anzahl > 0 ? Math.round((einw / gr.anzahl) * 100) : 0;
          return (
            <button key={gr.schluessel} type="button" role="radio" aria-checked={an} className={`wz-gruppe${an ? " aktiv" : ""}`} onClick={auswahl}>
              <span className="wz-gruppe-titel">{gr.titel}</span>
              <span className="wz-gruppe-zahl">{zahl(gr.anzahl)}</span>
              {einw != null ? (
                <>
                  <span className="wz-gruppe-streifen" aria-hidden="true"><i style={{ width: `${anteil}%` }} /></span>
                  <span className="wz-gruppe-einw" title="Nachweislich eingewilligt: Meta-Formular mit WhatsApp-Hinweis oder hat uns selbst auf WhatsApp geschrieben. Der Antrag auf der Website fragt nicht nach WhatsApp.">
                    {einw ? `${zahl(einw)} mit Einwilligung · ${anteil} %` : "noch niemand mit Einwilligung"}
                  </span>
                </>
              ) : null}
            </button>
          );
        };

        return (
          <>
            {/* ── Status: eine dünne Zeile ─────────────────────────────────── */}
            <div className="mara-status wz-status" aria-label="Zustand der WhatsApp-Zentrale">
              <div className="st voll">
                <span className={`mara-punkt${a.an ? " gut" : ""}`} aria-hidden="true" />
                <div className="st-text">
                  <div>{a.an ? "Automatik läuft" : "Automatik aus"}</div>
                  <small>
                    {a.an
                      ? `${a.jeStunde} je Stunde · ${a.von}–${a.bis} · diese Stunde ${a.dieseStunde ? `${a.dieseStunde} von ${a.jeStunde}` : `noch keine von ${a.jeStunde}`}`
                      : "Versände startest du unten von Hand."}
                  </small>
                </div>
              </div>
              <div className="st voll wz-meta" title="Meta erlaubt je Nummer nur eine bestimmte Zahl neuer Gespräche in 24 Stunden.">
                {frei > 0 ? <span className="gross">{zahl(frei)}</span> : null}
                <div className="st-text">
                  <div>
                    {frei > 0 ? "frei heute" : <span className="mara-pille warn">Meta: heute nichts mehr frei</span>}
                    {stufe ? <> · <span className="mara-akz-t">Meta {stufe}</span></> : null}
                  </div>
                  <small>{d.meta.verbraucht ? `${zahl(d.meta.verbraucht)} von ${zahl(d.meta.grenze)} in 24 h` : `noch nichts von ${zahl(d.meta.grenze)} in 24 h verbraucht`}</small>
                </div>
                <InfoKnopf offen={infMeta} onClick={() => setInfMeta((x) => !x)} label="Wie Meta zählt" />
              </div>
              {q ? (
                <div className="st">
                  <span className={`mara-punkt ${q.art}`} aria-hidden="true" /><span className="st-text">{q.text}</span>
                </div>
              ) : null}
              <div className="st">
                <span className={`mara-punkt${wartend ? " warn" : ""}`} aria-hidden="true" />
                <span className="st-text">{wartend ? (wartend === 1 ? "1 Kunde wartet" : `${zahl(wartend)} Kunden warten`) : "Niemand wartet"}</span>
              </div>
              <div className="st rechts">
                <span className="mara-still mara-klein" title="lädt jede Minute neu, solange der Tab offen ist">
                  {lage.geladenAm ? `Stand ${uhrBerlin(lage.geladenAm)} · ` : ""}lädt jede Minute neu · <a href="/chef/s/whatsapp">WhatsApp-Raum →</a>
                  {lage.fehler ? <> · <button type="button" className="mara-knopf text" onClick={lage.neu}>Neu laden gescheitert — nochmal</button></> : null}
                </span>
              </div>
            </div>
            {infMeta ? (
              <div className="mara-info">
                <b>Frei heute</b> = Grenze minus Verbrauch der letzten 24 Stunden. Die Grenze ist 80 % der Meta-Stufe
                {stufeZahl ? `: ${stufe} (${zahl(stufeZahl)} Gespräche) → ${zahl(d.meta.grenze)}.` : "."}
                {" "}{d.meta.verbraucht
                  ? `${zahl(d.meta.verbraucht)} sind verbraucht, also ${frei > 0 ? `${zahl(frei)} frei` : "heute nichts mehr frei"}.`
                  : `Verbraucht ist noch nichts, also ${zahl(frei)} frei.`}
                {" "}Erkennt der Server keine Stufe, rechnet er mit 250 → Grenze 200. Ist nichts mehr frei, sperrt der Start mit genau diesem Grund.
                {" "}Antworten übernimmt Mara im WhatsApp-Raum.
              </div>
            ) : null}

            {wartend > 0 || !d.whatsappBereit || q?.art === "warn" || d.kette.pausiert ? (
              <div className="mara-hinweise">
                {wartend > 0 ? (
                  <p className="mara-hinweis warn">
                    <span className="mara-punkt warn" aria-hidden="true" />
                    <span>
                      {wartend === 1 ? "1 Kunde wartet" : `${zahl(wartend)} Kunden warten`} seit über 2 Minuten auf eine Antwort (längstens {zahl(d.wartend?.laengsteMin ?? 0)} Min.).
                      {" "}Mara holt jede Minute nach — nachts nur Frisches, Älteres ab 7 Uhr. <a href="/chef/s/whatsapp">Zum WhatsApp-Raum</a>
                    </span>
                  </p>
                ) : null}
                {!d.whatsappBereit ? (
                  <p className="mara-hinweis krit"><span className="mara-punkt krit" aria-hidden="true" /><span>WhatsApp ist auf dem Server nicht eingerichtet — es kann nichts gesendet werden.</span></p>
                ) : null}
                {q?.art === "warn" ? (
                  <p className="mara-hinweis warn"><span className="mara-punkt warn" aria-hidden="true" /><span>Meta bewertet die Nummer mit Gelb. Lieber kleinere Mengen senden, bis sie wieder grün ist.</span></p>
                ) : null}
                {d.kette.pausiert ? (
                  <p className="mara-hinweis"><span className="mara-punkt" aria-hidden="true" /><span>Die alte Stundenkette pausiert, solange die Automatik läuft. Die Sofort-Begrüßung neuer Leads läuft weiter.</span></p>
                ) : null}
              </div>
            ) : null}

            {/* ── Wirkung 7 Tage: die Kette bis zum Geld ─────────────────────── */}
            <div className="mara-kette wz-kette" aria-label="Wirkung 7 Tage"
              title="Menschen, die in 7 Tagen eine Vorlage aus der Zentrale bekamen. „Geld gebucht“ = gebuchte Zahlung höchstens 14 Tage danach (wie /chef/zahlen), nicht gemeldet — zeitliche Folge, kein Beweis.">
              <span className="mara-etikett">Wirkung 7 Tage</span>
              {w7.menschen ? <span><b>{zahl(w7.menschen)}</b>angeschrieben</span> : <span>noch niemand angeschrieben</span>}
              <span className="pfeil" aria-hidden="true">→</span>
              {w7.geantwortet ? <span><b className="akz">{zahl(w7.geantwortet)}</b>{w7.geantwortet === 1 ? "Antwort" : "Antworten"}</span> : <span>noch keine Antwort</span>}
              <span className="pfeil" aria-hidden="true">→</span>
              {w7.antrag ? <span><b>{zahl(w7.antrag)}</b>{w7.antrag === 1 ? "Antrag" : "Anträge"}</span> : <span>noch kein Antrag</span>}
              <span className="pfeil" aria-hidden="true">→</span>
              {w7.gezahlt ? (
                <>
                  <span><b>{zahl(w7.gezahlt)}</b>mit Geld gebucht</span>
                  {w7.gezahltCents ? <span className="mara-leise"><b>{(w7.gezahltCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b></span> : null}
                </>
              ) : <span className="mara-pille warn">noch kein Geld gebucht</span>}
              {naechste && naechsteInfo ? (
                <span className="weiter mara-klein">
                  <button type="button" className="mara-knopf text" onClick={() => waehlen(naechsteInfo.schluessel, true)}>
                    {naechste.anzahl > 0
                      ? `„${naechste.titel}“ · ${zahl(naechste.anzahl)} dran — ${naechsteAuto ? "die Automatik nimmt sie zuerst" : "jetzt von Hand starten"} →`
                      : `„${naechste.titel}“ ist ab ${wannWieder(naechste.wiederAb)} wieder dran${naechsteAuto ? " — die Automatik nimmt sie zuerst" : ""} →`}
                  </button>
                </span>
              ) : null}
            </div>
            <div className="mara-heute wz-heute" aria-label="Heute">
              <span className="mara-etikett">Heute</span>
              <Heute voll n={h.gesendet} text="gesendet" leer="noch nichts gesendet" unter={gesendetWege} />
              <Heute n={h.vorlagenGesamt} text="Vorlagen gesamt" leer="noch keine Vorlage" unter="mit Begrüßung und Kette" />
              <Heute n={h.rein} text="eingegangen" leer="nichts eingegangen"
                unter={h.menschenRein ? `von ${zahl(h.menschenRein)} ${h.menschenRein === 1 ? "Mensch" : "Menschen"}` : "Nachrichten an uns"} />
              <Heute n={h.maraAntworten} text="Mara hat geantwortet" leer="Mara hat noch nicht geantwortet" unter="freie Nachrichten" />
            </div>

            <div className="mara-spalten wz-spalten">
              {/* ── WEN ───────────────────────────────────────────────────── */}
              <section className="mara-wen wz-wen" aria-labelledby="wz-wen-titel">
                <div className="mara-wen-kopf wz-wen-kopf">
                  <h2 id="wz-wen-titel">Wen anschreiben</h2>
                  <span className="mara-still mara-klein">{d.gruppen.length} Gruppen</span>
                </div>
                <div className="wz-gruppen" role="radiogroup" aria-label="Kundengruppe">
                  {voll.map(gruppeZeile)}
                  {leere.length ? <div className="mara-zwischen">Gerade niemand dran · {leere.length}</div> : null}
                  {leere.map(gruppeZeile)}
                </div>
                <p className="mara-still mara-klein wz-einw-fuss">
                  Streifen = Anteil mit nachgewiesener WhatsApp-Einwilligung.{" "}
                  <InfoKnopf offen={infEinw} onClick={() => setInfEinw((x) => !x)} label="Was Einwilligung heißt" />
                </p>
                {infEinw ? (
                  <div className="mara-info">Nachweislich eingewilligt: Meta-Formular mit WhatsApp-Hinweis oder hat uns selbst auf WhatsApp geschrieben. Der Antrag auf der Website fragt nicht nach WhatsApp.</div>
                ) : null}
              </section>

              {/* ── WIE: die eine Glasfläche ────────────────────────────────── */}
              <section className="mara-glas wz-start" aria-labelledby="wz-wie-titel">
                <div className="mara-kopfzeile">
                  <div>
                    <span className="mara-etikett" id="wz-wie-titel">Versand starten</span>{" "}
                    <span className="mara-still mara-klein">· eine Nachricht nach der anderen, jederzeit anhaltbar</span>
                  </div>
                  <button type="button" className="mara-knopf klein wz-nur-schmal" onClick={() => hinrollen(".wz-wen")}>Gruppe wechseln ↓</button>
                </div>

                {g ? (
                  <>
                    <div className="wz-an-zeile">
                      <div className="wz-an-was">
                        <h2 className="wz-an-titel">{g.titel}</h2>
                        <p className="mara-still mara-klein">
                          {leer ? (
                            <>
                              {leer.satz}{leer.warn ? <> <span className="mara-warn-t">{leer.warn}</span></> : null}
                              {leer.leadMotor ? <> <a href="/chef/s/lead-motor">Lead-Motor ansehen →</a></> : null}
                              {/* E-252 (28.09.2026, Gegenprüfung): Auch leer oder in der Wartezeit bleibt die Regel der Gruppe lesbar —
                                  bei „Auskunft fehlt" mit Rechtsbezug (§ 7 Abs. 3 UWG, einmal je Mensch). */}
                              {" "}<InfoKnopf offen={infSatz} onClick={() => setInfSatz((x) => !x)} label="Wer genau" />
                            </>
                          ) : kurzSatz ? (
                            <>{kurzSatz}{" "}<InfoKnopf offen={infSatz} onClick={() => setInfSatz((x) => !x)} label="Wer genau" /></>
                          ) : g.satz}
                        </p>
                      </div>
                      <div className="wz-an-zahl">
                        {leer ? <span className={`mara-pille${leer.ton ? ` ${leer.ton}` : ""}`}>{leer.pille}</span> : <>{zahl(g.anzahl)}<small>dran</small></>}
                      </div>
                    </div>
                    {infSatz && (kurzSatz || leer) ? <div className="mara-info"><b>Wer genau:</b> {g.satz}</div> : null}

                    <div className={`wz-form${leer ? " ohne-anzahl" : ""}`}>
                      <div className="mara-feld">
                        <label htmlFor="wz-vorlage">Vorlage</label>
                        <select id="wz-vorlage" className="mara-eingabe" value={vorlage} onChange={(e) => setVorlage(e.target.value)}>
                          {g.vorlagen.map((n) => {
                            const v = d.vorlagen.find((x) => x.name === n);
                            const vFrei = n === "stufen" || !!v?.frei;
                            return <option key={n} value={n}>{vorlagenName(n, d.vorlagen)}{vFrei ? (v?.bild ? " · mit Bild" : "") : " · wartet auf Meta"}</option>;
                          })}
                        </select>
                        <small>{vorlage === "stufen" ? d.stufenText : gewaehlt?.zweck}</small>
                      </div>
                      {!leer ? (
                        <div className="mara-feld wz-anzahl">
                          <label htmlFor="wz-anzahl">Anzahl</label>
                          <input id="wz-anzahl" className="mara-eingabe mara-eingabe-zahl" type="number" min={1} max={Math.max(1, hoechstens)} value={anzahl}
                            onChange={(e) => setAnzahl(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
                          <small>
                            {hoechstens > 0 && knapp ? `höchstens ${zahl(hoechstens)} — ${knapp.warum}` : "heute nichts mehr frei"}
                            {menge > 0 ? ` · ≈ ${dauerText(menge * sekundenJePerson)}` : ""}
                          </small>
                        </div>
                      ) : null}
                    </div>
                    {/* E-253 (live seit b5bae0a8): schnelle Mengen — bis 500, nie mehr, als die Gruppe und Meta heute hergeben.
                        E-252: als kleine Knöpfe im Glas, der gewählte trägt „an". */}
                    {!leer && hoechstens > 1 && sperre === null ? (
                      <div className="wz-mengen" role="group" aria-label="Anzahl schnell wählen">
                        <span className="mara-still mara-klein">Schnell wählen</span>
                        {[25, 50, 100, 250, 500].filter((n) => n < hoechstens).map((n) => (
                          <button key={n} type="button" className={`mara-knopf klein${menge === n ? " an" : ""}`} aria-pressed={menge === n} onClick={() => setAnzahl(n)}>{zahl(n)}</button>
                        ))}
                        <button type="button" className={`mara-knopf klein${menge === hoechstens ? " an" : ""}`} aria-pressed={menge === hoechstens} onClick={() => setAnzahl(hoechstens)}>alle {zahl(hoechstens)}</button>
                      </div>
                    ) : null}

                    <div className="mara-startreihe">
                      <button type="button" className="mara-knopf" onClick={() => void vorschauLaden()} disabled={beschaeftigt !== null || !g.anzahl}>
                        {beschaeftigt === "vorschau" ? "Lädt …" : "Vorschau"}
                      </button>
                      <button type="button" className="mara-knopf haupt" onClick={() => void starten()} disabled={sperre !== null || beschaeftigt !== null}
                        title={sperre || (leer ? leerText(leer) : undefined)}>
                        {beschaeftigt === "start" ? "Startet …" : sperre === null ? `WhatsApp starten (${zahl(menge)})` : sperre === "" ? "Niemand dran" : "Gesperrt"}
                      </button>
                      {!leer && frei > 0 ? (
                        <span className="mara-still mara-klein">Kleinstes aus: {zahl(grenzeJeVersand)} je Versand · {zahl(g.anzahl)} in der Gruppe · {zahl(frei)} bei Meta frei</span>
                      ) : null}
                    </div>
                    {sperre && !lauf?.laeuft ? <p className="wz-sperre"><span className="mara-punkt warn" aria-hidden="true" /><span>{sperre}</span></p> : null}
                    {sperre === "" && beste ? (
                      <p className="wz-sperre">
                        <button type="button" className="mara-knopf text" onClick={() => waehlen(beste.schluessel, false)}>
                          Stattdessen {beste.titel} ({zahl(beste.anzahl)}) wählen →
                        </button>
                      </p>
                    ) : null}
                    <Meldung m={meldung} ort="start" onZu={zu} />

                    {vorschau ? (
                      <div className="wz-vorschau">
                        <span className="mara-etikett">{vorschau.length ? `Vorschau · die nächsten ${zahl(vorschau.length)}` : "Vorschau"}</span>
                        {vorschau.length === 0 ? <p className="mara-still mara-klein">Niemand in dieser Gruppe ist gerade dran.</p> : vorschau.map((z) => {
                          const v = d.vorlagen.find((x) => x.name === z.vorlage);
                          return (
                            <div key={z.personId} className="wz-vorschau-zeile">
                              <div className="wz-vorschau-wer">
                                <a href={`/chef/s/akte?id=${z.personId}`}>{z.name}</a>
                                <span className="mara-still mara-klein">Tag {z.tage}{z.letzteVorlageAm ? ` · letzte Vorlage ${seit(z.letzteVorlageAm)}` : " · noch nie angeschrieben"}</span>
                                {vorlage === "stufen" ? <span><span className="mara-pille akz">{vorlagenName(z.vorlage, d.vorlagen)}</span></span> : null}
                              </div>
                              {z.hinderung
                                ? <p className="wz-sperre"><span className="mara-punkt warn" aria-hidden="true" /><span>Wird übersprungen: {z.hinderung}</span></p>
                                : z.text ? <Blase v={v} text={z.text} /> : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {lauf ? (
                  <LaufKarte lauf={lauf} vorlagen={d.vorlagen} sekundenJePerson={sekundenJePerson} hinweis={laufHinweis} verbindung={laufVerbindung}
                    onAnhalten={() => void anhalten()} onAktualisieren={() => void laufAktualisieren()} anhaltenLaeuft={haeltAn} />
                ) : null}
                <Meldung m={meldung} ort="lauf" onZu={zu} />

                {/* ── Automatik: derselbe Glasblock, zweiter Abschnitt ────────── */}
                <div className="mara-abschnitt wz-automatik">
                  <div className="wz-auto-kopf">
                    <h3>Automatik</h3>
                    <button type="button" className={`mara-schalter wz-schalter${a.an ? " an" : ""}`} data-mara-schalter="whatsapp" disabled={beschaeftigt !== null}
                      onClick={() => void automatikSpeichern({ an: !a.an }, a.an ? "Automatik aus. Die alte Stundenkette läuft wieder." : "Automatik an. Mara schreibt im eingestellten Takt.")}
                      aria-pressed={a.an}>
                      <span className="bahn" aria-hidden="true" />
                      <span>{a.an ? "Läuft" : "Aus"}</span>
                    </button>
                  </div>
                  <Meldung m={meldung} ort="automatik" onZu={zu} />
                  <p className="wz-auto-kurz" title="Reihenfolge = Vorrang: Ist die erste Gruppe leer, kommt die nächste dran.">
                    {a.jeStunde} je Stunde · {a.von}–{a.bis} · ≈ {zahl(amTag(a))} am Tag
                    {autoGeaendert ? <> · <span className="mara-warn-t">Änderungen nicht gespeichert</span></> : null}
                    <br />
                    <span className="mara-still">Vorrang:</span>{" "}
                    {a.gruppen.length ? a.gruppen.map((s, i) => {
                      const gi = d.gruppen.find((x) => x.schluessel === s);
                      if (!gi) return null;
                      const l = leerStand(gi);
                      // Umbruch nur zwischen den Gruppen, nie mitten in „Zahlung offen ab 14:48".
                      return (
                        <Fragment key={s}>
                          {i > 0 ? <> <span className="mara-still" aria-hidden="true">→</span> </> : null}
                          <span className="wz-vorrang">{GRUPPEN_KURZ[s] ?? gi.titel} <span className={l ? "mara-still" : undefined}>{l ? l.kurz : zahl(gi.anzahl)}</span></span>
                        </Fragment>
                      );
                    }) : <span className="mara-still">keine Gruppe gewählt</span>}
                  </p>
                  <details className="mara-klappe wz-auto-klappe" open={autoGeaendert || undefined}>
                    <summary>Takt und Reihenfolge ändern</summary>
                    <div className="wz-takt">
                      <div className="mara-feld"><label htmlFor="wz-von">Von</label><input id="wz-von" className="mara-eingabe" type="time" value={auto.von} min="07:00" max="21:00" onChange={(e) => setAuto({ ...auto, von: e.target.value })} /></div>
                      <div className="mara-feld"><label htmlFor="wz-bis">Bis</label><input id="wz-bis" className="mara-eingabe" type="time" value={auto.bis} min="07:00" max="21:00" onChange={(e) => setAuto({ ...auto, bis: e.target.value })} /></div>
                      <div className="mara-feld"><label htmlFor="wz-je">Je Stunde</label><input id="wz-je" className="mara-eingabe mara-eingabe-zahl" type="number" min={1} max={30} value={auto.jeStunde} onChange={(e) => setAuto({ ...auto, jeStunde: Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 1))) })} /></div>
                      <p className="wz-takt-satz">≈ <b>{zahl(proTag)}</b> Nachrichten am Tag, gleichmäßig über jede Stunde verteilt.</p>
                    </div>
                    {/* E-252: alle Gruppen des Servers (GRUPPEN_REIHE, lage.gruppen) — auch „Auskunft fehlt"; angekreuzt ist nur, was gespeichert ist. */}
                    <ol className="wz-reihe">
                      {d.gruppen.map((x) => x.schluessel)
                        .sort((x, y) => {
                          const ix = auto.gruppen.indexOf(x), iy = auto.gruppen.indexOf(y);
                          return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
                        })
                        .map((gr) => {
                          const info = d.gruppen.find((x) => x.schluessel === gr)!;
                          const dabei = auto.gruppen.includes(gr);
                          const v = auto.vorlagen[gr] ?? info.standard;
                          const l = leerStand(info);
                          return (
                            <li key={gr} className={dabei ? "" : "aus"}>
                              <label className="wz-haken">
                                <input type="checkbox" checked={dabei} onChange={() => gruppeUmschalten(gr)} />
                                <span>{info.titel}</span>
                                <em>{l ? l.kurz : `${zahl(info.anzahl)} dran`}</em>
                                {gr === "auskunft_fehlt" ? (
                                  <em title="Diese Gruppe schreibt sonst nur der Auskunft-Takt an (die Menge je Tag steht im Reiter Bonitätsauskunft). Wer die Vorlage einmal bekam, bekommt sie nie wieder — egal über welchen Weg. Die Vorlage folgt dem Segment: Kunden fiaon_kk_auskunft, Anträge, Abbrecher und Leads fiaon_kk_auskunft_lead.">
                                    · sonst nur Auskunft-Takt
                                  </em>
                                ) : null}
                              </label>
                              <select className="mara-eingabe" value={v} disabled={!dabei} onChange={(e) => setAuto({ ...auto, vorlagen: { ...auto.vorlagen, [gr]: e.target.value } })} aria-label={`Vorlage für ${info.titel}`}>
                                {info.vorlagen.map((n) => {
                                  const vv = d.vorlagen.find((x) => x.name === n);
                                  return <option key={n} value={n}>{vorlagenName(n, d.vorlagen)}{n !== "stufen" && !vv?.frei ? " · wartet auf Meta" : ""}</option>;
                                })}
                              </select>
                              {dabei ? (
                                <span className="wz-pfeile">
                                  <button type="button" onClick={() => gruppeVerschieben(gr, -1)} aria-label="Nach oben" disabled={auto.gruppen.indexOf(gr) === 0}>↑</button>
                                  <button type="button" onClick={() => gruppeVerschieben(gr, 1)} aria-label="Nach unten" disabled={auto.gruppen.indexOf(gr) === auto.gruppen.length - 1}>↓</button>
                                </span>
                              ) : <span className="wz-pfeile" />}
                            </li>
                          );
                        })}
                    </ol>
                    <div className="wz-automatik-fuss">
                      <span className="mara-still mara-klein">
                        Reihenfolge = Vorrang: Ist die erste Gruppe leer, kommt die nächste dran.
                        {a.geaendertAm ? ` Zuletzt geändert ${seit(a.geaendertAm)}${a.geaendertVon ? ` von ${a.geaendertVon}` : ""}.` : ""}
                      </span>
                      <button type="button" className="mara-knopf haupt" disabled={!autoGeaendert || beschaeftigt !== null}
                        onClick={() => void automatikSpeichern({}, "Automatik gespeichert.")}>
                        {beschaeftigt === "automatik" ? "Speichert …" : "Einstellungen speichern"}
                      </button>
                    </div>
                  </details>
                </div>
              </section>
            </div>

            {/* ── Darunter: Was Mara getan hat, Verlauf ──────────────────────── */}
            <div className="mara-darunter wz-darunter">
              <MaraProtokoll />

              <section className="mara-karte wz-karte wz-verlauf" aria-labelledby="wz-verlauf-titel">
                <div className="mara-kopfzeile">
                  <div>
                    <h2 id="wz-verlauf-titel">Verlauf</h2>
                    <p className="mara-still mara-klein">{d.letzte.length ? `Die letzten ${zahl(d.letzte.length)} Vorlagen · Stand mit Grund` : "Jede Vorlage aus der Zentrale mit Stand und Weg"}</p>
                  </div>
                  <a className="wz-link" href="/chef/s/whatsapp">Zum WhatsApp-Raum</a>
                </div>
                {d.letzte.length === 0 ? <p className="wz-mp-leer">Noch keine Nachricht aus der Zentrale.</p> : (
                  <>
                    <table className="wz-verlauf-tabelle">
                      <thead><tr><th>Zeit</th><th>Mensch</th><th>Gruppe</th><th>Vorlage</th><th>Weg</th><th>Stand</th></tr></thead>
                      <tbody>
                        {verlauf.map((e) => {
                          const fehlerZeile = !e.ok && /^Fehler/i.test(e.grund ?? "");
                          const zustellung = ZUSTELLUNG[e.zustellung ?? ""] ?? e.zustellung ?? "gesendet";
                          return (
                            <tr key={e.id} className={e.ok ? "" : "nicht"}>
                              <td className="c-zeit" data-l="Zeit">{tagZeitBerlin(e.am)}</td>
                              <td className="c-mensch" data-l="Mensch">{e.personId ? <a href={`/chef/s/akte?id=${e.personId}`}>{e.name}</a> : e.name}</td>
                              <td className="c-gruppe" data-l="Gruppe">{GRUPPEN_KURZ[e.gruppe] ?? e.gruppe}</td>
                              <td className="c-vorlage" data-l="Vorlage">{vorlagenName(e.vorlage, d.vorlagen)}</td>
                              <td className="c-weg" data-l="Weg">{e.quelle === "verkaufstakt" ? "Auskunft-Takt" : e.quelle === "hand" ? "von Hand" : "Automatik"}</td>
                              <td className="c-stand" data-l="Stand">
                                {!e.ok ? <span className={`mara-pille umbruch ${fehlerZeile ? "krit" : "warn"}`} title={e.grund ?? ""}>übersprungen · {e.grund}</span>
                                  : e.geantwortet ? <span className="mara-pille gut">geantwortet</span>
                                  : <span className={`mara-pille${zustellung === "Fehler" ? " krit" : ""}`}>{zustellung}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mara-mehr-zeile">
                      {d.letzte.length > verlaufZeilen ? (
                        <button type="button" className="mara-knopf klein" onClick={() => setVerlaufZeilen((n) => n + VERLAUF_SCHRITT)}>
                          Weitere {zahl(Math.min(VERLAUF_SCHRITT, d.letzte.length - verlaufZeilen))} zeigen
                        </button>
                      ) : null}
                      <span className="mara-still mara-klein">{zahl(Math.min(verlaufZeilen, d.letzte.length))} von {zahl(d.letzte.length)}</span>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        );
      })()}
    </div>
  );
}
