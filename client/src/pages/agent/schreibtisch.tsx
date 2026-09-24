// ═══════════════════════════════════════════════════════════════════════════
// /agent/start — Raum 1: Der Schreibtisch (23.08.2026)
//
// Was heute zählt, in Reihenfolge: Termine, Rückrufe, offene Aufgaben,
// Kasse. Keine Listen mit zwanzig Spalten – Karten, ein Klick (anrufen,
// Akte). Daten: /agent/start (Verdienst, Kundenzahlen, Zusagen),
// /agent/termine, /agent/tickets/zaehler. Telefon: Ereignis `fiaon-anrufen`.
// Die bisherige Startseite bleibt unter /agent/start-alt erreichbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Phone, ArrowRight, Calendar, PhoneCall, ListChecks, Wallet, Sparkles } from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { useAcademyFortschritt } from "./academy/fortschritt";
import "@/styles/office-schreibtisch.css";
import "@/styles/office-termintreue.css";
import { terminArtAusQuelle } from "@shared/fiaon-termin-art";
import { maraMarke, MARA_NEU_STUNDEN } from "@shared/fiaon-mara-marke";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const heuteIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
// 17.09.2026 (E-188): Ein Erstgespräch zu FIAON Global hängt an einem
// Firmenkontakt ohne Antrag — seine „Akte" ist das Firmen-Cockpit. Die
// Vertriebsakte zeigt nur eigene Kunden und bliebe für ihn leer.
const terminZiel = (t: any) => {
  const pid = t.personId ?? t.person_id;
  return t.quelle === "global" ? `/agent/firmen?person=${pid}` : `/agent/kunden?person=${pid}`;
};
const anrufen = (nummer: string | null | undefined, personId: number | null, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } })); };

// ═══════════════════════════════════════════════════════════════════════════
// NEU VON MARA (24.09.2026, E-236)
//
// Justin: „im jeweiligen Dashboard anzeigen lassen, dass ein neuer Termin über
// Mara gebucht wurde". Mara trägt Rückrufe selbst beim Betreuer ein
// (herkunft mara_whatsapp/mara_mail) oder der Kunde bucht über ihren Link
// (mara_whatsapp_link). Ohne Hinweis stand so ein Termin still in der Liste —
// der Mitarbeiter hat ihn nie angelegt und wusste nicht, dass der Kunde wartet.
//
// Der Block zeigt jeden Mara-Termin, der in den letzten 72 Stunden
// eingetragen wurde und noch bevorsteht. „Gesehen" blendet ihn für DIESES
// Gerät aus (localStorage, reine Bequemlichkeit — der Termin selbst steht
// weiter im Kalender und in den Listen darunter, mit Marke).
// ═══════════════════════════════════════════════════════════════════════════
const MARA_GESEHEN_KEY = "fiaon-mara-termine-gesehen";
function maraGesehenLesen(): number[] {
  try { const v = JSON.parse(localStorage.getItem(MARA_GESEHEN_KEY) || "[]"); return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []; }
  catch { return []; }
}
function maraGesehenSchreiben(ids: number[]) {
  // Nur die letzten 200 — die Liste soll nicht endlos wachsen.
  try { localStorage.setItem(MARA_GESEHEN_KEY, JSON.stringify(ids.slice(-200))); } catch { /* gesperrt: dann eben erneut sichtbar */ }
}
/** Die Aufschrift „von Mara" neben der Terminart — dieselbe wie im Kalender. */
function MaraHinweis({ herkunft }: { herkunft?: string | null }) {
  const m = maraMarke(herkunft);
  if (!m) return null;
  return <span className="st-mara" title={m.titel}>{m.text}<span className="sr-only"> – {m.titel}</span></span>;
}

export default function AgentSchreibtischPage() { return <AgentShell><SchreibtischInnen /></AgentShell>; }

function SchreibtischInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Dashboard"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState<any>(null);
  const [termine, setTermine] = useState<any[]>([]);
  const [anliegen, setAnliegen] = useState<number>(0);
  const [aufgabenOffen, setAufgabenOffen] = useState<number>(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = () => {
    // ── 24.08.2026: DIE KACHEL HIESS „AUFGABEN & ANLIEGEN" UND ZÄHLTE NUR
    // ANLIEGEN ────────────────────────────────────────────────────────────
    // VORHER holte diese Seite ausschließlich /agent/tickets/zaehler — das
    // sind die Kunden-ANLIEGEN — und schrieb die Zahl unter die Beschriftung
    // „Aufgaben & Anliegen", verlinkt auf /agent/aufgaben.
    // GEMESSEN bei Daniel Stripling (Konto 8): 22 offene Aufgaben und 1
    // offenes Anliegen. Die Kachel zeigte 1 und schickte ihn auf eine Seite
    // mit 22 Zeilen.
    // NACHHER kommen beide Zahlen aus denselben Quellen wie die Marken in der
    // Leiste (/agent/vermerke/zahlen und /agent/tickets/zaehler) und stehen
    // getrennt beschriftet nebeneinander.
    Promise.all([
      api("/agent/start"), api("/agent/termine"),
      api("/agent/tickets/zaehler"), api("/agent/vermerke/zahlen"),
    ]).then(([s, t, z, v]) => {
      if (s.ok) setStart(s.json); else setFehler(s.json?.error || "Das Dashboard konnte nicht geladen werden.");
      if (t.ok) setTermine(t.json.termine || []);
      if (z.ok) setAnliegen((z.json.meine || 0) + (z.json.pool || 0));
      if (v.ok) setAufgabenOffen((v.json.heute || 0) + (v.json.ueberfaellig || 0) + (v.json.auftraege || 0));
    }).catch(() => setFehler("Keine Verbindung."));
  };
  useEffect(() => { laden(); const i = setInterval(laden, 120_000); return () => clearInterval(i); }, []);

  const heute = heuteIso();
  const termineHeute = useMemo(() => termine.filter((t) => new Date(t.beginn).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) === heute).sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime()), [termine, heute]);
  const termineSpaeter = useMemo(() => termine.filter((t) => new Date(t.beginn).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) > heute), [termine, heute]);
  // ── 24.08.2026: „RÜCKRUFE" WAREN GAR KEINE RÜCKRUFE ───────────────────────
  // VORHER stand hier „const zusagen = start?.zusagen || []" — das ist die
  // Liste ALLER Kunden mit einem Zahlungs-Zusagedatum, ohne jede Zeitgrenze
  // (die Abfrage in /agent/start hat LIMIT 60). Die Seite schrieb darüber
  // „Heute … und N Rückrufe" und rendert jede Zeile als „Rückruf".
  // GEMESSEN bei Daniel Stripling (Konto 8) am 24.08.2026: 35 solcher Zeilen —
  // davon 0 mit Zusage auf heute, 30 in der Vergangenheit, 5 in der Zukunft.
  // Seine 9 ECHTEN Rückrufe (Gesprächsergebnis „rueckruf_termin", vom Server
  // als „rueckrufe" mitgeliefert) standen überhaupt nicht auf der Seite.
  // NACHHER: zwei getrennte, ehrlich beschriftete Mengen, beide auf „heute
  // oder früher fällig" begrenzt — nur das gehört auf einen Tagesplan.
  const zusagenFaellig: any[] = useMemo(
    () => ((start?.zusagen || []) as any[])
      .filter((z) => z.zusagedatum && String(z.zusagedatum).slice(0, 10) <= heute)
      .sort((a, b) => String(a.zusagedatum).localeCompare(String(b.zusagedatum))),
    [start, heute],
  );
  const rueckrufeFaellig: any[] = useMemo(
    () => ((start?.rueckrufe || []) as any[])
      .filter((r) => r.am && new Date(r.am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) <= heute),
    [start, heute],
  );
  const v = start?.verdienst || {}; const k = start?.kunden || {};
  const [mandate, setMandate] = useState<number | null>(null);
  useEffect(() => { api("/agent/vertrieb/mandate").then((r) => { if (r.ok) setMandate(Number(r.json.anzahl ?? r.json.mandate ?? 0)); }).catch(() => {}); }, []);
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setJetzt(new Date()), 1_000); return () => clearInterval(i); }, []); // Uhr live (Justin 23.08.)
  const datum = jetzt.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const uhrzeit = jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Berlin" });
  const naechster = termineHeute.find((t) => new Date(t.beginn).getTime() > Date.now() - 15 * 60000);
  // ── Neu von Mara (E-236) ─────────────────────────────────────────────────
  const [maraGesehen, setMaraGesehen] = useState<number[]>(() => maraGesehenLesen());
  const maraNeu = useMemo(() => termine
    .filter((t) => maraMarke(t.herkunft) && t.status === "gebucht" && t.gebuchtAm
      && Date.now() - new Date(t.gebuchtAm).getTime() < MARA_NEU_STUNDEN * 3_600_000
      && new Date(t.beginn).getTime() > Date.now() - 15 * 60000
      && !maraGesehen.includes(Number(t.id)))
    .sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime()), [termine, maraGesehen]);
  const maraAbhaken = (ids: number[]) => {
    const neu = Array.from(new Set([...maraGesehen, ...ids]));
    maraGesehenSchreiben(neu); setMaraGesehen(neu);
  };
  // Was heute wirklich auf dem Tisch liegt — dieselbe Menge, die „Jetzt dran"
  // darunter Zeile für Zeile zeigt. Die Überschrift darf nichts anderes zählen.
  const dranGesamt = termineHeute.length + rueckrufeFaellig.length + zusagenFaellig.length;

  // ── KONTO & KARTE: WER IST HEUTE BEREIT? (24.08.2026) ────────────────────
  // Justin: „Ja, in die Tagesliste bitte bei den Mitarbeitern, die die Kunden
  // betreuen." Bewusst eine EIGENE Gruppe unten in „Jetzt dran" und nicht
  // zwischen den Terminen: Ein Termin um 10:00 ist zeitgebunden, ein bereiter
  // Kunde nicht — er darf die Reihenfolge des Tages nicht durcheinanderbringen,
  // aber er darf auch nicht untergehen. Die Liste blendet aus, wem schon
  // geschickt wurde; ein zweiter Link wirkt wie eine Mahnung.
  const [karteBereit, setKarteBereit] = useState<any[]>([]);
  useEffect(() => {
    let an = true;
    api("/agent/karte/bereit/liste").then((r) => { if (an && r.ok) setKarteBereit(r.json.kunden || []); });
    return () => { an = false; };
  }, []);

  return (
    <div className="st">
      <section className="st-kopf">
        <div>
          <span className="st-pille">{datum} <i className="st-uhr">{uhrzeit}</i></span>
          {/* 24.08.2026: VORHER „Heute N Gespräche und M Rückrufe" — M war die
              Zahl der Zahlungszusagen ohne Zeitgrenze (bei Daniel 35, davon 0
              auf heute). NACHHER nennt die Zeile genau die Mengen, die
              darunter in „Jetzt dran" stehen, jede mit ihrem eigenen Namen. */}
          <h1>{dranGesamt ? <>Heute <span className="st-verlauf">{termineHeute.length} {termineHeute.length === 1 ? "Termin" : "Termine"}</span>{rueckrufeFaellig.length ? <>, {rueckrufeFaellig.length} {rueckrufeFaellig.length === 1 ? "Rückruf" : "Rückrufe"}</> : null}{zusagenFaellig.length ? <>, {zusagenFaellig.length} fällige {zusagenFaellig.length === 1 ? "Zahlungszusage" : "Zahlungszusagen"}</> : null}.</> : <>Ein ruhiger Tag – <span className="st-verlauf">Zeit für neue Kunden.</span></>}</h1>
          <p>{naechster ? <>Als Nächstes: <b>{uhr(naechster.beginn)} Uhr – {naechster.name}</b>. Die Akte liegt bereit.</> : "Alles, was heute zählt, steht hier in Reihenfolge. Ein Klick: anrufen oder Akte."}</p>
        </div>
        {/* Vorher: „Dein Tag"-Karte. Nachher (E-052): entfernt – die Zahlen leben im Wallet/Bestand. */}
      </section>

      {fehler && <p className="st-fehler">{fehler}</p>}

      {/* Vorher: 4 Kacheln (auch Rückrufe/heiße Kunden). Nachher (E-052): Termine heute · Aufgaben & Anliegen · Mein Bestand.
          24.08.2026: Aus einer Kachel „Aufgaben & Anliegen" mit NUR den
          Anliegen (Daniel: 1 statt 22 + 1) werden zwei getrennte Kacheln, jede
          mit ihrer eigenen Quelle und ihrem eigenen Ziel. */}
      <section className="st-kacheln">
        <Link href="/agent/kalender" className="st-kachel"><b>{termineHeute.length}</b><span>Termine heute</span></Link>
        <Link href="/agent/aufgaben" className="st-kachel"><b>{aufgabenOffen}</b><span>Aufgaben fällig</span></Link>
        <Link href="/agent/anliegen" className="st-kachel"><b>{anliegen}</b><span>Anliegen offen</span></Link>
        <Link href="/agent/bestand" className="st-kachel"><b>{mandate ?? "–"}</b><span>Mein Bestand</span></Link>
        {/* Nur zeigen, wenn es etwas zu zeigen gibt: Eine Kachel mit 0 lehrt
            den Blick, sie zu überspringen — und dann sieht man auch die 3
            nicht mehr. */}
        {karteBereit.length > 0 && (
          <Link href="/agent/bestand?filter=karte" className="st-kachel karte">
            <b>{karteBereit.length}</b><span>Bereit für Konto &amp; Karte</span>
          </Link>
        )}
      </section>

      {maraNeu.length > 0 && (
        <section className="st-mara-block" aria-label="Neue Termine von Mara">
          <div className="st-block-kopf">
            <b>Neu von Mara</b>
            <small>{maraNeu.length === 1 ? "Ein Termin" : `${maraNeu.length} Termine`} — von Mara für dich vereinbart oder über ihren Link gebucht. Der Kunde wartet auf deinen Anruf.</small>
          </div>
          {maraNeu.map((t) => {
            const m = maraMarke(t.herkunft)!;
            return (
              <div key={`m${t.id}`} className="st-zeile">
                <div className="st-zeit">
                  <b>{uhr(t.beginn)}</b>
                  <small>{new Date(t.beginn).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) === heute ? "heute" : new Date(t.beginn).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}</small>
                </div>
                <div className="st-wer">
                  <b>{t.name}</b>
                  <small>{m.titel}{t.gebuchtAm ? ` · eingetragen ${new Date(t.gebuchtAm).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Uhr` : ""}</small>
                  {t.notiz && <small className="st-notiz" title={t.notiz}>{t.notiz}</small>}
                </div>
                <div className="st-aktion">
                  <Link href={terminZiel(t)} className="st-knopf">Akte</Link>
                  <button type="button" className="st-knopf still" onClick={() => maraAbhaken([Number(t.id)])}
                          aria-label={`${t.name}: als gesehen markieren`}>Gesehen</button>
                </div>
              </div>
            );
          })}
          {maraNeu.length > 1 && (
            <button type="button" className="st-mara-alle" onClick={() => maraAbhaken(maraNeu.map((t) => Number(t.id)))}>Alle als gesehen markieren</button>
          )}
        </section>
      )}

      <section className="st-spalten">
        <div className="st-block">
          <div className="st-block-kopf"><b>Jetzt dran</b><small>{dranGesamt} heute fällig · Termine, dann Rückrufe, dann Zahlungszusagen</small></div>
          {dranGesamt === 0 && <p className="st-leer">Nichts Dringendes. Öffne die Pipeline und nimm dir die heißesten Kunden vor.</p>}
          {termineHeute.map((t) => (
            <div key={`t${t.id}`} className="st-zeile">
              <div className="st-zeit"><b>{uhr(t.beginn)}</b><small>{t.dauerMin || t.dauer_min || 15} min</small></div>
              {/* 24.08.2026: VORHER fiel die Anzeige auf den TECHNISCHEN Quellwert
                      zurück — auf dem Dashboard stand wörtlich „agent_manuell"
                      und „onboarding_call". NACHHER übersetzt derselbe Helfer
                      wie im Kalender in Klartext (Onboarding/Vertrieb/Rückruf/Zahlung). */}
              {/* 24.09.2026 (E-236): „von Mara" neben der Art, darunter die
                  Notiz (worum es geht) — sie stand auf dem Dashboard nirgends. */}
              <div className="st-wer"><b>{t.name}</b><small>{t.art || terminArtAusQuelle(t.quelle).text}{t.status === "verpasst" ? " · verpasst" : ""}<MaraHinweis herkunft={t.herkunft} /></small>{t.notiz && <small className="st-notiz" title={t.notiz}>{t.notiz}</small>}</div>
              <div className="st-aktion">
                <button type="button" className="st-knopf" onClick={() => anrufen(t.telefon ?? t.primary_phone, t.personId ?? t.person_id, t.name)} disabled={!(t.telefon ?? t.primary_phone)}><Phone size={15} /> Anrufen</button>
                <Link href={terminZiel(t)} className="st-knopf still">Akte</Link>
              </div>
            </div>
          ))}
          {/* Die ECHTEN Rückrufe: Gesprächsergebnis „Rückruf vereinbart", vom
              Server als „rueckrufe" geliefert. Sie standen bis zum 24.08.2026
              überhaupt nicht auf dieser Seite. */}
          {rueckrufeFaellig.map((r) => (
            <div key={`r${r.personId}`} className="st-zeile rueckruf">
              <div className="st-zeit"><b>Rückruf</b><small>{r.am ? new Date(r.am).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "fällig"}</small></div>
              <div className="st-wer"><b>{r.name}</b><small>{r.notiz || r.terminArtText || "Rückruf vereinbart"}</small></div>
              <div className="st-aktion">
                <button type="button" className="st-knopf" onClick={() => anrufen(r.telefon, r.personId, r.name)} disabled={!r.telefon}><Phone size={15} /> Anrufen</button>
                <Link href={`/agent/kunden?person=${r.personId}`} className="st-knopf still">Akte</Link>
              </div>
            </div>
          ))}
          {/* Die Zahlungszusagen — heute oder früher fällig. VORHER standen
              hier ALLE (bei Daniel 35, davon 5 in der Zukunft) unter der
              Beschriftung „Rückruf", und das Datum las „z.zusageAm": ein Feld,
              das „karte()" gar nicht liefert (es heißt „zusagedatum"). Jede
              Zeile zeigte deshalb wörtlich „fällig" statt eines Datums. */}
          {zusagenFaellig.map((z) => (
            <div key={`z${z.personId}`} className="st-zeile rueckruf">
              <div className="st-zeit"><b>Zusage</b><small>{z.zusagedatum ? new Date(z.zusagedatum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "fällig"}</small></div>
              <div className="st-wer"><b>{z.name}</b><small>{z.hinweis || z.produkt || "Zahlung zugesagt"}</small></div>
              <div className="st-aktion">
                <button type="button" className="st-knopf" onClick={() => anrufen(z.telefonWaehlbar, z.personId, z.name)} disabled={!z.telefonWaehlbar}><Phone size={15} /> Anrufen</button>
                <Link href={`/agent/kunden?person=${z.personId}`} className="st-knopf still">Akte</Link>
              </div>
            </div>
          ))}
          {/* ── Bereit für Konto & Karte ──────────────────────────────────
              Steht bewusst UNTER den zeitgebundenen Punkten: Wer heute seine
              zweite Rate bezahlt hat, soll heute den Anruf bekommen — aber
              erst, nachdem der 10-Uhr-Termin gelaufen ist. */}
          {karteBereit.length > 0 && (
            <>
              <div className="st-gruppe-titel">
                <b>Bereit für Konto &amp; Karte</b>
                <small>Alle Bedingungen erfüllt – ein Anruf, dann der Weg zum Girokonto</small>
              </div>
              {karteBereit.map((k: any) => (
                <div key={`kk${k.personId}`} className="st-zeile karte">
                  <div className="st-zeit"><b>Karte</b><small>bereit</small></div>
                  <div className="st-wer"><b>{k.name}</b><small>Antrag, Zahlungen und Unterlagen stehen</small></div>
                  <div className="st-aktion">
                    <Link href={`/agent/kunden?person=${k.personId}`} className="st-knopf">Akte öffnen</Link>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="st-block">
          {/* Vorher: „Die nächsten Tage" (5) + Pipeline-Stufen. Nachher (E-052): ALLE bevorstehenden Termine, scrollbar; Stufen weg. */}
          <div className="st-block-kopf"><b>Termine in den nächsten Tagen</b><small>{termineSpaeter.length} bevorstehend</small></div>
          {termineSpaeter.length === 0 && <p className="st-leer">Keine weiteren Termine gebucht. Schick deinen wartenden Kunden den Terminlink.</p>}
          <div className="st-blaettern">
          {termineSpaeter.map((t) => (
            <div key={`s${t.id}`} className="st-zeile klein">
              <div className="st-zeit"><b>{new Date(t.beginn).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}</b><small>{uhr(t.beginn)}</small></div>
              <div className="st-wer"><b>{t.name}</b><small>{t.art || terminArtAusQuelle(t.quelle).text}<MaraHinweis herkunft={t.herkunft} /></small>{t.notiz && <small className="st-notiz" title={t.notiz}>{t.notiz}</small>}</div>
              <Link href={terminZiel(t)} className="st-knopf still">Akte</Link>
            </div>
          ))}
          </div>
        </div>
      </section>

      {/* Vorher: Termintreue-Karte. Nachher (E-052): Termintreue sieht nur der Admin je Mitarbeiter (Chefbüro). */}

      <section className="st-schnell">
        <Link href="/agent/arbeitszeiten" className="st-schnell-karte"><b>Availability</b><span>Termine kommen nur in deinen Zeiten.</span></Link>
        <Link href="/agent/gehalt" className="st-schnell-karte"><b>Earnings</b><span>Was 5 Abschlüsse am Tag bringen.</span></Link>
        <AcademyKarte />
        <Link href="/agent/start-alt" className="st-schnell-karte still"><b>Bisherige Startseite</b><span>Übergangsweise weiter erreichbar.</span></Link>
      </section>
      {/* 24.08.2026 (Justin): Jeder Raum erklaert sich beim ersten
          Betreten selbst — danach jederzeit ueber den Knopf unten links. */}
      <Rundgang raum="dashboard" titel={RUNDGAENGE.dashboard.titel} schritte={RUNDGAENGE.dashboard.schritte} />
    </div>
  );
}

/**
 * Termintreue-Karte (E-044, Plan §16): Pünktlichkeit wird serverseitig
 * gemessen (fiaon_termin_treue, Lauf „termintreue-bewerten"). Hier sieht der
 * Mitarbeiter seine eigene Bilanz der letzten 30 Tage — und ab dem ersten
 * verpassten Termin einen ruhigen, aber unmissverständlichen Hinweis.
 */
function TermintreueKarte() {
  const [treue, setTreue] = useState<{ puenktlich: number; verspaetet: number; verpasst: number } | null>(null);
  useEffect(() => {
    api("/agent/termintreue").then((r) => { if (r.ok) setTreue(r.json); }).catch(() => {});
  }, []);
  if (!treue) return null;
  return (
    <section className="tt-karte">
      <div className="tt-karte-kopf"><b>Termintreue</b><small>letzte 30 Tage</small></div>
      <div className="tt-zahlen">
        <div className="tt-zahl gut"><b>{treue.puenktlich}</b><span>pünktlich</span></div>
        <div className="tt-zahl warn"><b>{treue.verspaetet}</b><span>verspätet</span></div>
        <div className="tt-zahl rot"><b>{treue.verpasst}</b><span>verpasst</span></div>
      </div>
      {treue.verpasst >= 1 && (
        <p className="tt-warnhinweis">Verpasste Termine werden der Leitung gemeldet – ab 5 endet die Zusammenarbeit.</p>
      )}
    </section>
  );
}

/** Academy-Kachel mit echtem Ausbildungsstand (E-040). */
function AcademyKarte() {
  const { stand } = useAcademyFortschritt();
  const p = stand?.prozent ?? null;
  return (
    <Link href="/agent/academy" className="st-schnell-karte">
      <b>Academy{stand?.zertifikat ? " · Zertifiziert" : p != null && p > 0 ? ` · ${p} %` : ""}</b>
      <span>{stand?.zertifikat ? "Zertifizierter Bonitätsmanager – 30 % Provision." : p != null && p > 0 ? "Deine Ausbildung läuft – mach weiter." : "Deine Ausbildung zum Bonitätsmanager."}</span>
    </Link>
  );
}
