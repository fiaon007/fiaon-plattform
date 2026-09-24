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
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { API, seit, zahl, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-wa-zentrale.css";

type Gruppe = "neu" | "ohne_antrag" | "abbrecher" | "zahlung_offen" | "rate_offen";
interface GruppeInfo { schluessel: Gruppe; titel: string; satz: string; vorlagen: string[]; standard: string; abstandTage: number; anzahl: number; mitEinwilligung?: number }
interface Vorlage { name: string; kopf: string; zweck: string; text: string; frei: boolean; bild: boolean; kopfBild: string | null; fuss: string }
interface Automatik {
  an: boolean; von: string; bis: string; jeStunde: number; gruppen: Gruppe[]; vorlagen: Partial<Record<Gruppe, string>>;
  geaendertVon?: string | null; geaendertAm?: string | null; dieseStunde: number;
}
interface Lauf {
  id: string; laeuft: boolean; quelle: string; gruppe: Gruppe; vorlage: string; gesamt: number; gesendet: number;
  uebersprungen: number; fehler: number; gruende: Record<string, number>; seit: string; bis: string | null; abgebrochen: boolean;
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
  heute: { gesendet: number; nicht: number; automatik: number; hand: number; vorlagenGesamt: number; maraAntworten: number; rein: number; menschenRein: number; fehler: number };
  wirkung7: { menschen: number; geantwortet: number; antrag: number; gezahlt: number };
  lauf: Lauf | null;
  letzte: Eintrag[];
}
interface VorschauZeile { personId: number; name: string; tage: number; vorlage: string; letzteVorlageAm: string | null; betrag: string | null; referenz: string | null; faelligAm?: string | null; text: string | null; hinderung: string | null }

const GRUPPEN_KURZ: Record<Gruppe, string> = {
  neu: "Neue Leads", zahlung_offen: "Zahlung offen", abbrecher: "Abgebrochen", ohne_antrag: "Ohne Antrag", rate_offen: "Monatsrate",
};
const QUALITAET: Record<string, { text: string; art: "gut" | "warn" | "rot" }> = {
  GREEN: { text: "Qualität grün", art: "gut" }, YELLOW: { text: "Qualität gelb", art: "warn" }, RED: { text: "Qualität rot", art: "rot" },
};
const ZUSTELLUNG: Record<string, string> = { gesendet: "gesendet", sent: "gesendet", delivered: "zugestellt", read: "gelesen", failed: "Fehler", fehler: "Fehler", offen: "unterwegs" };
const zeit = (s: string) => new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

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
const MARA_SEITE = 25;
const MARA_ART: Record<MaraArt, { text: string; art: "" | "blau" | "warn" }> = {
  zeiten_angeboten: { text: "Zeiten angeboten", art: "" },
  termin_gebucht: { text: "Termin eingetragen", art: "blau" },
  termin_verschoben: { text: "Termin verschoben", art: "blau" },
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
      {z.pruefungAm ? <span className="wz-still">geprüft {seit(z.pruefungAm)}</span> : null}
    </div>
  );
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
  useEffect(() => {
    if (!hinweis) return;
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
    <section className="wz-karte wz-mara" aria-labelledby="wz-mara-titel">
      <div className="wz-karte-kopf">
        <div className="wz-mp-titel">
          <h2 id="wz-mara-titel">Was Mara getan hat</h2>
          <span className="wz-still">Letzte {MARA_TAGE} Tage · jeder eingetragene Termin wird nachgeprüft</span>
        </div>
        <button type="button" className="wz-knopf klein still" onClick={() => void nachpruefen()} disabled={prueft || !p}>
          {prueft ? "Prüft …" : "Jetzt nachprüfen"}
        </button>
      </div>

      {hinweis ? <div className={`wz-meldung ${hinweis.art}`} role="status">{hinweis.text}</div> : null}
      {prot.laedt && !p ? <Geruest zeilen={4} /> : null}
      {prot.fehler && !p ? <Fehlermeldung text={prot.fehler} erneut={prot.neu} /> : null}
      {prot.fehler && p ? <p className="wz-still" role="status">Neu laden hat nicht geklappt — zu sehen ist der letzte Stand.</p> : null}

      {p && s ? (
        <>
          <div className="wz-zahlen wz-mp-summe" role="group" aria-label={`Summen der letzten ${MARA_TAGE} Tage`}>
            <div><span>Termine eingetragen</span><b>{zahl(s.termine)}</b><em>gebucht oder verschoben</em></div>
            <div><span>Terminlinks</span><b>{zahl(s.links)}</b><em>persönlich geschickt</em></div>
            <div className={s.nichtMoeglich ? "warn" : ""}><span>Nicht möglich</span><b>{zahl(s.nichtMoeglich)}</b><em>kein Termin eingetragen</em></div>
            <div><span>Übergaben</span><b>{zahl(s.uebergaben)}</b><em>an einen Menschen</em></div>
            <div className={s.rueckfaelle ? "warn" : ""}><span>Rückfälle</span><b>{zahl(s.rueckfaelle)}</b><em>Ersatzsatz statt Antwort</em></div>
            <div className={rotZahl ? "rot" : "gut"}><span>Prüfung rot</span><b>{zahl(rotZahl)}</b><em>{rotZahl ? "Termine stimmen nicht" : "alles stimmt"}</em></div>
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
                    {f.text}<em>{zahl(anzahl[f.schluessel])}</em>
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
                              {z.kunde && z.nummer ? <span className="wz-still"> · {nummerZeigen(z.nummer)}</span> : null}
                            </span>
                            <span className={`wz-marke${art.art ? ` ${art.art}` : ""}`}>{art.text}</span>
                            {!z.ok && istBuchung(z) ? <span className="wz-marke rot">nicht sauber</span> : null}
                            {z.terminId != null ? <span className="wz-still">Termin #{z.terminId}</span> : null}
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
                <button type="button" className="wz-knopf klein still wz-mp-mehr" onClick={() => setAlleZeigen(true)}>
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

export default function ChefWhatsAppZentrale() {
  const lage = useDaten<Lage>("/chef/wa-zentrale/lage");
  const d = lage.daten;
  const [gruppe, setGruppe] = useState<Gruppe>("neu");
  const [vorlage, setVorlage] = useState<string>("fiaon_kk_anfrage");
  const [anzahl, setAnzahl] = useState<number>(50);
  const [vorschau, setVorschau] = useState<VorschauZeile[] | null>(null);
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: "gut" | "fehler" } | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [auto, setAuto] = useState<Automatik | null>(null);

  const melden = (text: string, art: "gut" | "fehler" = "gut") => { setMeldung({ text, art }); window.setTimeout(() => setMeldung(null), 7000); };

  // Beim Laden: laufender Versand und die gespeicherte Automatik übernehmen.
  useEffect(() => {
    if (!d) return;
    setLauf(d.lauf);
    setAuto((alt) => alt ?? d.automatik);
  }, [d]);

  // Die Vorlage folgt der Gruppe.
  const g = d?.gruppen.find((x) => x.schluessel === gruppe);
  useEffect(() => {
    if (g && !g.vorlagen.includes(vorlage)) setVorlage(g.standard);
    setVorschau(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruppe, g?.standard]);
  useEffect(() => { setVorschau(null); }, [vorlage]);

  // Solange ein Versand läuft: alle 2 Sekunden der Stand, am Ende die Lage neu.
  useEffect(() => {
    if (!lauf?.laeuft) return;
    const t = window.setInterval(async () => {
      const r = await fetch(`${API}/chef/wa-zentrale/lauf`, { credentials: "include" }).then((x) => x.json()).catch(() => null);
      if (r?.lauf) {
        setLauf(r.lauf);
        if (!r.lauf.laeuft) { lage.neu(); window.clearInterval(t); }
      }
    }, 2000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lauf?.laeuft, lauf?.id]);

  const hoechstens = d ? Math.max(0, Math.min(200, g?.anzahl ?? 0, d.meta.frei)) : 0;
  const menge = Math.max(0, Math.min(anzahl, hoechstens));
  const gewaehlt = d?.vorlagen.find((v) => v.name === vorlage);
  const vorlageFrei = vorlage === "stufen" || !!gewaehlt?.frei;
  const sperre = !d ? "Lädt …"
    : !d.whatsappBereit ? "WhatsApp ist auf dem Server nicht eingerichtet."
    : !d.tagsueber ? "Zwischen 21:00 und 07:00 schreiben wir niemanden an."
    : d.meta.qualitaet === "RED" ? "Meta bewertet die Nummer mit Rot — Massenversand gesperrt."
    : d.meta.frei <= 0 ? "Das Tageslimit von Meta ist ausgeschöpft."
    : !vorlageFrei ? "Diese Vorlage ist bei Meta noch nicht freigegeben."
    : lauf?.laeuft ? "Es läuft schon ein Versand."
    : menge <= 0 ? "In dieser Gruppe ist gerade niemand dran."
    : null;

  const vorschauLaden = async () => {
    setBeschaeftigt("vorschau");
    try {
      const r = await fetch(`${API}/chef/wa-zentrale/vorschau?gruppe=${gruppe}&vorlage=${encodeURIComponent(vorlage)}&anzahl=5`, { credentials: "include" });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Die Vorschau ließ sich nicht laden.");
      setVorschau(j.empfaenger);
    } catch (e: any) { melden(e.message, "fehler"); } finally { setBeschaeftigt(null); }
  };

  const starten = async () => {
    if (!d || sperre) return;
    const satz = `Mara schreibt jetzt bis zu ${menge} Menschen aus „${g?.titel}“ an — Vorlage „${vorlagenName(vorlage, d.vorlagen)}“. `
      + "Eine Nachricht nach der anderen, jederzeit anhaltbar. Starten?";
    if (!window.confirm(satz)) return;
    setBeschaeftigt("start");
    try {
      const j = await senden("/chef/wa-zentrale/start", { gruppe, vorlage, anzahl: menge });
      setLauf(j.lauf); setVorschau(null);
      melden(`Versand gestartet: bis zu ${menge} Nachrichten.`);
    } catch (e: any) { melden(e.message, "fehler"); } finally { setBeschaeftigt(null); }
  };

  const anhalten = async () => {
    try { await senden("/chef/wa-zentrale/stopp", {}); melden("Der Versand hält nach der aktuellen Nachricht an."); } catch (e: any) { melden(e.message, "fehler"); }
  };

  const automatikSpeichern = async (neu: Partial<Automatik>, satz: string) => {
    if (!auto) return;
    setBeschaeftigt("automatik");
    try {
      const j = await senden("/chef/wa-zentrale/automatik", { ...auto, ...neu });
      setAuto({ ...j.automatik, dieseStunde: auto.dieseStunde });
      melden(satz); lage.neu();
    } catch (e: any) { melden(e.message, "fehler"); } finally { setBeschaeftigt(null); }
  };

  const proTag = useMemo(() => {
    if (!auto || !/^\d{2}:\d{2}$/.test(auto.von) || !/^\d{2}:\d{2}$/.test(auto.bis)) return 0;
    return Math.max(0, Math.round(((hhmm(auto.bis) - hhmm(auto.von)) / 60) * auto.jeStunde));
  }, [auto]);
  const autoGeaendert = !!(auto && d && JSON.stringify({ ...auto, dieseStunde: 0, geaendertAm: null, geaendertVon: null })
    !== JSON.stringify({ ...d.automatik, dieseStunde: 0, geaendertAm: null, geaendertVon: null }));

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
    <div className="wz">
      <Rundgang raum="wa-zentrale" titel="WhatsApp-Zentrale" schritte={RUNDGAENGE.waZentrale.schritte} />
      {lage.laedt && !d && <Geruest zeilen={8} />}
      {lage.fehler && <Fehlermeldung text={lage.fehler} erneut={lage.neu} />}
      {d && auto && (
        <>
          <header className="wz-kopf">
            <div className="wz-wer">
              <span className={`wz-punkt${d.automatik.an ? " an" : ""}`} aria-hidden="true" />
              <div>
                <h1>WhatsApp-Zentrale</h1>
                <p>
                  {d.automatik.an
                    ? `Automatik läuft: ${d.automatik.jeStunde} je Stunde, ${d.automatik.von}–${d.automatik.bis} · diese Stunde ${d.automatik.dieseStunde} von ${d.automatik.jeStunde}.`
                    : "Automatik aus. Versände startest du unten von Hand."}
                  {" "}Antworten übernimmt Mara im WhatsApp-Raum.
                </p>
              </div>
            </div>
            <div className="wz-meta" title="Meta erlaubt je Nummer nur eine bestimmte Zahl neuer Gespräche in 24 Stunden.">
              <span className="wz-meta-zahl"><b>{zahl(d.meta.frei)}</b> frei heute</span>
              <span className="wz-still">{zahl(d.meta.verbraucht)} von {zahl(d.meta.grenze)} in 24 h{d.meta.stufe ? ` · ${d.meta.stufe.replace("TIER_", "Stufe ")}` : ""}</span>
              {q ? <span className={`wz-marke ${q.art}`}>{q.text}</span> : null}
            </div>
          </header>

          {d.wartend && d.wartend.anzahl > 0 ? (
            <div className="wz-hinweis gelb">
              {d.wartend.anzahl === 1 ? "1 Kunde wartet" : `${zahl(d.wartend.anzahl)} Kunden warten`} seit über 2 Minuten auf eine Antwort (längstens {zahl(d.wartend.laengsteMin)} Min.).
              {" "}Mara holt jede Minute nach — nachts nur Frisches, Älteres ab 7 Uhr. <a href="/chef/s/whatsapp">Zum WhatsApp-Raum</a>
            </div>
          ) : null}
          {!d.whatsappBereit ? <div className="wz-hinweis rot">WhatsApp ist auf dem Server nicht eingerichtet — es kann nichts gesendet werden.</div> : null}
          {q?.art === "warn" ? <div className="wz-hinweis gelb">Meta bewertet die Nummer mit Gelb. Lieber kleinere Mengen senden, bis sie wieder grün ist.</div> : null}
          {d.kette.pausiert ? <div className="wz-hinweis">Die alte Stundenkette pausiert, solange die Automatik läuft. Die Sofort-Begrüßung neuer Leads läuft weiter.</div> : null}

          <section className="wz-zahlen" aria-label="Heute">
            <div><span>Heute gesendet</span><b>{zahl(d.heute.gesendet)}</b><em>{zahl(d.heute.hand)} von Hand · {zahl(d.heute.automatik)} Automatik</em></div>
            <div><span>Vorlagen gesamt heute</span><b>{zahl(d.heute.vorlagenGesamt)}</b><em>mit Begrüßung und Kette</em></div>
            <div><span>Eingegangen heute</span><b>{zahl(d.heute.rein)}</b><em>{d.heute.menschenRein ? `von ${zahl(d.heute.menschenRein)} ${d.heute.menschenRein === 1 ? "Mensch" : "Menschen"}` : "Nachrichten an uns"}</em></div>
            <div><span>Mara hat geantwortet</span><b>{zahl(d.heute.maraAntworten)}</b><em>freie Nachrichten heute</em></div>
            <div><span>Wirkung 7 Tage</span><b>{zahl(d.wirkung7.geantwortet)}</b><em>Antworten von {zahl(d.wirkung7.menschen)} · {zahl(d.wirkung7.antrag)} Anträge · {zahl(d.wirkung7.gezahlt)} gezahlt</em></div>
          </section>

          {meldung ? <div className={`wz-meldung ${meldung.art}`} role="status">{meldung.text}</div> : null}

          {/* ── Versand von Hand ─────────────────────────────────────────── */}
          <section className="wz-karte wz-start">
            <div className="wz-karte-kopf">
              <h2>Versand starten</h2>
              <span className="wz-still">Eine Nachricht nach der anderen, jederzeit anhaltbar.</span>
            </div>

            <div className="wz-gruppen" role="radiogroup" aria-label="Kundengruppe">
              {d.gruppen.map((gr) => (
                <button key={gr.schluessel} type="button" role="radio" aria-checked={gruppe === gr.schluessel}
                  className={`wz-gruppe${gruppe === gr.schluessel ? " aktiv" : ""}`} onClick={() => setGruppe(gr.schluessel)}>
                  <span className="wz-gruppe-zahl">{zahl(gr.anzahl)}</span>
                  <span className="wz-gruppe-titel">{gr.titel}</span>
                  <span className="wz-gruppe-satz">{gr.satz}</span>
                  {gr.mitEinwilligung != null && gr.anzahl > 0 ? (
                    <span className="wz-gruppe-einw" title="Nachweislich eingewilligt: Meta-Formular mit WhatsApp-Hinweis oder hat uns selbst auf WhatsApp geschrieben. Der Antrag auf der Website fragt nicht nach WhatsApp.">
                      davon {zahl(gr.mitEinwilligung)} mit Einwilligung
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="wz-wahl">
              <label className="wz-feld">
                <span>Vorlage</span>
                <select value={vorlage} onChange={(e) => setVorlage(e.target.value)}>
                  {(g?.vorlagen ?? []).map((n) => {
                    const v = d.vorlagen.find((x) => x.name === n);
                    const frei = n === "stufen" || !!v?.frei;
                    return <option key={n} value={n}>{vorlagenName(n, d.vorlagen)}{frei ? (v?.bild ? " · mit Bild" : "") : " · wartet auf Meta"}</option>;
                  })}
                </select>
                <small>{vorlage === "stufen" ? d.stufenText : gewaehlt?.zweck}</small>
              </label>
              <label className="wz-feld wz-feld-zahl">
                <span>Anzahl</span>
                <input type="number" min={1} max={Math.max(1, hoechstens)} value={anzahl}
                  onChange={(e) => setAnzahl(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
                <small>höchstens {zahl(hoechstens)}</small>
              </label>
              <div className="wz-knoepfe">
                <button type="button" className="wz-knopf still" onClick={() => void vorschauLaden()} disabled={beschaeftigt !== null || !g?.anzahl}>
                  {beschaeftigt === "vorschau" ? "Lädt …" : "Vorschau"}
                </button>
                <button type="button" className="wz-knopf haupt" onClick={() => void starten()} disabled={!!sperre || beschaeftigt !== null} title={sperre ?? undefined}>
                  {beschaeftigt === "start" ? "Startet …" : `WhatsApp starten (${zahl(menge)})`}
                </button>
              </div>
            </div>
            {sperre && !lauf?.laeuft ? <p className="wz-sperre">{sperre}</p> : null}

            {vorschau ? (
              <div className="wz-vorschau">
                {vorschau.length === 0 ? <p className="wz-still">Niemand in dieser Gruppe ist gerade dran.</p> : vorschau.map((z) => {
                  const v = d.vorlagen.find((x) => x.name === z.vorlage);
                  return (
                    <div key={z.personId} className="wz-vorschau-zeile">
                      <div className="wz-vorschau-wer">
                        <a href={`/chef/s/akte?id=${z.personId}`}>{z.name}</a>
                        <span className="wz-still">Tag {z.tage}{z.letzteVorlageAm ? ` · letzte Vorlage ${seit(z.letzteVorlageAm)}` : " · noch nie angeschrieben"}</span>
                        {vorlage === "stufen" ? <span className="wz-marke">{vorlagenName(z.vorlage, d.vorlagen)}</span> : null}
                      </div>
                      {z.hinderung ? <p className="wz-sperre">Wird übersprungen: {z.hinderung}</p> : z.text ? <Blase v={v} text={z.text} /> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {lauf ? (
              <div className={`wz-lauf${lauf.laeuft ? " laeuft" : ""}`}>
                <div className="wz-lauf-kopf">
                  <strong>{lauf.laeuft ? "Versand läuft" : lauf.abgebrochen ? "Versand angehalten" : "Letzter Versand fertig"}</strong>
                  <span className="wz-still">{GRUPPEN_KURZ[lauf.gruppe] ?? lauf.gruppe} · {vorlagenName(lauf.vorlage, d.vorlagen)} · {lauf.quelle === "hand" ? "von Hand" : "Automatik"} · {zeit(lauf.seit)}</span>
                  {lauf.laeuft ? <button type="button" className="wz-knopf klein" onClick={() => void anhalten()}>Anhalten</button> : null}
                </div>
                <div className="wz-balken" aria-hidden="true">
                  <i className="gut" style={{ width: `${lauf.gesamt ? (lauf.gesendet / lauf.gesamt) * 100 : 0}%` }} />
                  <i className="still" style={{ width: `${lauf.gesamt ? ((lauf.uebersprungen + lauf.fehler) / lauf.gesamt) * 100 : 0}%` }} />
                </div>
                <p className="wz-lauf-zahlen">
                  <b>{zahl(lauf.gesendet)}</b> gesendet · {zahl(lauf.uebersprungen)} übersprungen{lauf.fehler ? ` · ${zahl(lauf.fehler)} Fehler` : ""} · von {zahl(lauf.gesamt)}
                </p>
                {Object.keys(lauf.gruende).length ? (
                  <ul className="wz-gruende">
                    {Object.entries(lauf.gruende).sort((a, b) => b[1] - a[1]).map(([grund, n]) => <li key={grund}><span>{grund}</span><b>{n}</b></li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* ── Automatik ────────────────────────────────────────────────── */}
          <section className="wz-karte wz-automatik">
            <div className="wz-karte-kopf">
              <h2>Automatik</h2>
              <button type="button" className={`wz-schalter${d.automatik.an ? " an" : ""}`} disabled={beschaeftigt !== null}
                onClick={() => void automatikSpeichern({ an: !d.automatik.an }, d.automatik.an ? "Automatik aus. Die alte Stundenkette läuft wieder." : "Automatik an. Mara schreibt im eingestellten Takt.")}
                aria-pressed={d.automatik.an}>
                <span className="wz-schalter-knopf" aria-hidden="true" />
                <span>{d.automatik.an ? "Läuft" : "Aus"}</span>
              </button>
            </div>
            <div className="wz-takt">
              <label className="wz-feld"><span>Von</span><input type="time" value={auto.von} min="07:00" max="21:00" onChange={(e) => setAuto({ ...auto, von: e.target.value })} /></label>
              <label className="wz-feld"><span>Bis</span><input type="time" value={auto.bis} min="07:00" max="21:00" onChange={(e) => setAuto({ ...auto, bis: e.target.value })} /></label>
              <label className="wz-feld wz-feld-zahl"><span>Je Stunde</span><input type="number" min={1} max={30} value={auto.jeStunde} onChange={(e) => setAuto({ ...auto, jeStunde: Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 1))) })} /></label>
              <p className="wz-takt-satz">≈ <b>{zahl(proTag)}</b> Nachrichten am Tag, gleichmäßig über jede Stunde verteilt.</p>
            </div>
            <ol className="wz-reihe">
              {(["neu", "zahlung_offen", "abbrecher", "ohne_antrag", "rate_offen"] as Gruppe[])
                .sort((a, b) => {
                  const ia = auto.gruppen.indexOf(a), ib = auto.gruppen.indexOf(b);
                  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                })
                .map((gr) => {
                  const info = d.gruppen.find((x) => x.schluessel === gr)!;
                  const dabei = auto.gruppen.includes(gr);
                  const v = auto.vorlagen[gr] ?? info.standard;
                  return (
                    <li key={gr} className={dabei ? "" : "aus"}>
                      <label className="wz-haken">
                        <input type="checkbox" checked={dabei} onChange={() => gruppeUmschalten(gr)} />
                        <span>{info.titel}</span>
                        <em>{zahl(info.anzahl)} dran</em>
                      </label>
                      <select value={v} disabled={!dabei} onChange={(e) => setAuto({ ...auto, vorlagen: { ...auto.vorlagen, [gr]: e.target.value } })} aria-label={`Vorlage für ${info.titel}`}>
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
              <span className="wz-still">
                Reihenfolge = Vorrang: Ist die erste Gruppe leer, kommt die nächste dran.
                {d.automatik.geaendertAm ? ` Zuletzt geändert ${seit(d.automatik.geaendertAm)}${d.automatik.geaendertVon ? ` von ${d.automatik.geaendertVon}` : ""}.` : ""}
              </span>
              <button type="button" className="wz-knopf haupt" disabled={!autoGeaendert || beschaeftigt !== null}
                onClick={() => void automatikSpeichern({}, "Automatik gespeichert.")}>
                {beschaeftigt === "automatik" ? "Speichert …" : "Einstellungen speichern"}
              </button>
            </div>
          </section>

          {/* ── Was Mara getan hat (E-236) ───────────────────────────────── */}
          <MaraProtokoll />

          {/* ── Verlauf ──────────────────────────────────────────────────── */}
          <section className="wz-karte wz-verlauf">
            <div className="wz-karte-kopf">
              <h2>Verlauf</h2>
              <a className="wz-link" href="/chef/s/whatsapp">Zum WhatsApp-Raum</a>
            </div>
            {d.letzte.length === 0 ? <p className="wz-still">Noch keine Nachricht aus der Zentrale.</p> : (
              <div className="wz-tabelle-rolle">
                <table className="wz-tabelle">
                  <thead><tr><th>Zeit</th><th>Mensch</th><th>Gruppe</th><th>Vorlage</th><th>Weg</th><th>Stand</th></tr></thead>
                  <tbody>
                    {d.letzte.map((e) => (
                      <tr key={e.id} className={e.ok ? "" : "nicht"}>
                        <td className="wz-zeit">{zeit(e.am)}</td>
                        <td>{e.personId ? <a href={`/chef/s/akte?id=${e.personId}`}>{e.name}</a> : e.name}</td>
                        <td>{GRUPPEN_KURZ[e.gruppe] ?? e.gruppe}</td>
                        <td>{vorlagenName(e.vorlage, d.vorlagen)}</td>
                        <td className="wz-still">{e.quelle === "hand" ? "von Hand" : "Automatik"}</td>
                        <td>
                          {!e.ok ? <span className="wz-marke warn" title={e.grund ?? ""}>übersprungen · {e.grund}</span>
                            : e.geantwortet ? <span className="wz-marke gut">geantwortet</span>
                            : <span className="wz-marke">{ZUSTELLUNG[e.zustellung ?? ""] ?? e.zustellung ?? "gesendet"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
