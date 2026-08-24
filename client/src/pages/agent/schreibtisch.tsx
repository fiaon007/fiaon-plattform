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

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const heuteIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const anrufen = (nummer: string | null | undefined, personId: number | null, name: string) => { if (!nummer) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } })); };

export default function AgentSchreibtischPage() { return <AgentShell><SchreibtischInnen /></AgentShell>; }

function SchreibtischInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Dashboard"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState<any>(null);
  const [termine, setTermine] = useState<any[]>([]);
  const [aufgaben, setAufgaben] = useState<number>(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = () => {
    Promise.all([api("/agent/start"), api("/agent/termine"), api("/agent/tickets/zaehler")]).then(([s, t, z]) => {
      if (s.ok) setStart(s.json); else setFehler(s.json?.error || "Das Dashboard konnte nicht geladen werden.");
      if (t.ok) setTermine(t.json.termine || []);
      if (z.ok) setAufgaben((z.json.meine || 0) + (z.json.pool || 0));
    }).catch(() => setFehler("Keine Verbindung."));
  };
  useEffect(() => { laden(); const i = setInterval(laden, 120_000); return () => clearInterval(i); }, []);

  const heute = heuteIso();
  const termineHeute = useMemo(() => termine.filter((t) => new Date(t.beginn).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) === heute).sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime()), [termine, heute]);
  const termineSpaeter = useMemo(() => termine.filter((t) => new Date(t.beginn).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) > heute), [termine, heute]);
  const zusagen: any[] = start?.zusagen || [];
  const v = start?.verdienst || {}; const k = start?.kunden || {};
  const [mandate, setMandate] = useState<number | null>(null);
  useEffect(() => { api("/agent/vertrieb/mandate").then((r) => { if (r.ok) setMandate(Number(r.json.anzahl ?? r.json.mandate ?? 0)); }).catch(() => {}); }, []);
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setJetzt(new Date()), 1_000); return () => clearInterval(i); }, []); // Uhr live (Justin 23.08.)
  const datum = jetzt.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const uhrzeit = jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Berlin" });
  const naechster = termineHeute.find((t) => new Date(t.beginn).getTime() > Date.now() - 15 * 60000);

  return (
    <div className="st">
      <section className="st-kopf">
        <div>
          <span className="st-pille">{datum} <i className="st-uhr">{uhrzeit}</i></span>
          <h1>{termineHeute.length ? <>Heute <span className="st-verlauf">{termineHeute.length} {termineHeute.length === 1 ? "Gespräch" : "Gespräche"}</span>{zusagen.length ? <> und {zusagen.length} Rückrufe.</> : "."}</> : zusagen.length ? <>Heute <span className="st-verlauf">{zusagen.length} Rückrufe</span>.</> : <>Ein ruhiger Tag – <span className="st-verlauf">Zeit für neue Kunden.</span></>}</h1>
          <p>{naechster ? <>Als Nächstes: <b>{uhr(naechster.beginn)} Uhr – {naechster.name}</b>. Die Akte liegt bereit.</> : "Alles, was heute zählt, steht hier in Reihenfolge. Ein Klick: anrufen oder Akte."}</p>
        </div>
        {/* Vorher: „Dein Tag"-Karte. Nachher (E-052): entfernt – die Zahlen leben im Wallet/Bestand. */}
      </section>

      {fehler && <p className="st-fehler">{fehler}</p>}

      {/* Vorher: 4 Kacheln (auch Rückrufe/heiße Kunden). Nachher (E-052): Termine heute · Aufgaben & Anliegen · Mein Bestand. */}
      <section className="st-kacheln drei">
        <Link href="/agent/kalender" className="st-kachel"><b>{termineHeute.length}</b><span>Termine heute</span></Link>
        <Link href="/agent/aufgaben" className="st-kachel"><b>{aufgaben}</b><span>Aufgaben &amp; Anliegen</span></Link>
        <Link href="/agent/bestand" className="st-kachel"><b>{mandate ?? "–"}</b><span>Mein Bestand</span></Link>
      </section>

      <section className="st-spalten">
        <div className="st-block">
          <div className="st-block-kopf"><b>Jetzt dran</b><small>Termine heute, dann Rückrufe</small></div>
          {termineHeute.length === 0 && zusagen.length === 0 && <p className="st-leer">Nichts Dringendes. Öffne die Pipeline und nimm dir die heißesten Kunden vor.</p>}
          {termineHeute.map((t) => (
            <div key={`t${t.id}`} className="st-zeile">
              <div className="st-zeit"><b>{uhr(t.beginn)}</b><small>{t.dauerMin || t.dauer_min || 15} min</small></div>
              {/* 24.08.2026: VORHER fiel die Anzeige auf den TECHNISCHEN Quellwert
                      zurück — auf dem Dashboard stand wörtlich „agent_manuell"
                      und „onboarding_call". NACHHER übersetzt derselbe Helfer
                      wie im Kalender in Klartext (Onboarding/Vertrieb/Rückruf/Zahlung). */}
              <div className="st-wer"><b>{t.name}</b><small>{t.art || terminArtAusQuelle(t.quelle).text}{t.status === "verpasst" ? " · verpasst" : ""}</small></div>
              <div className="st-aktion">
                <button type="button" className="st-knopf" onClick={() => anrufen(t.telefon ?? t.primary_phone, t.personId ?? t.person_id, t.name)} disabled={!(t.telefon ?? t.primary_phone)}><Phone size={15} /> Anrufen</button>
                <Link href={`/agent/kunden?person=${t.personId ?? t.person_id}`} className="st-knopf still">Akte</Link>
              </div>
            </div>
          ))}
          {zusagen.map((z) => (
            <div key={`z${z.personId}`} className="st-zeile rueckruf">
              <div className="st-zeit"><b>Rückruf</b><small>{z.zusageAm ? new Date(z.zusageAm).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "fällig"}</small></div>
              <div className="st-wer"><b>{z.name}</b><small>{z.hinweis || z.paket || ""}</small></div>
              <div className="st-aktion">
                <button type="button" className="st-knopf" onClick={() => anrufen(z.telefonWaehlbar, z.personId, z.name)} disabled={!z.telefonWaehlbar}><Phone size={15} /> Anrufen</button>
                <Link href={`/agent/kunden?person=${z.personId}`} className="st-knopf still">Akte</Link>
              </div>
            </div>
          ))}
        </div>
        <div className="st-block">
          {/* Vorher: „Die nächsten Tage" (5) + Pipeline-Stufen. Nachher (E-052): ALLE bevorstehenden Termine, scrollbar; Stufen weg. */}
          <div className="st-block-kopf"><b>Termine in den nächsten Tagen</b><small>{termineSpaeter.length} bevorstehend</small></div>
          {termineSpaeter.length === 0 && <p className="st-leer">Keine weiteren Termine gebucht. Schick deinen wartenden Kunden den Terminlink.</p>}
          <div className="st-blaettern">
          {termineSpaeter.map((t) => (
            <div key={`s${t.id}`} className="st-zeile klein">
              <div className="st-zeit"><b>{new Date(t.beginn).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}</b><small>{uhr(t.beginn)}</small></div>
              <div className="st-wer"><b>{t.name}</b><small>{t.art || terminArtAusQuelle(t.quelle).text}</small></div>
              <Link href={`/agent/kunden?person=${t.personId ?? t.person_id}`} className="st-knopf still">Akte</Link>
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
