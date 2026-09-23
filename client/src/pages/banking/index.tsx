// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — /buchhaltung und /banking (E-228, 23.09.2026)
//
// Justin: „Das ist das FIAON Banking. Das muss EXTREM sicher aussehen, sehr
// hochwertig — Bank System eben. Es muss ein vollwertiges Banksystem für die
// Buchhaltung sein."
//
// Die Hülle: matte Navy-Leiste links (startet eingeklappt, Justins Regel),
// heller Arbeitsraum, genau ein Navy-Glas (die Kontoplatte auf der Übersicht).
// Oben rechts steht die Sitzung — mit ihrer Restzeit. Nach 10 Minuten ohne
// Eingabe meldet die Seite ab; der Server beendet die Sitzung spätestens nach
// 15 Minuten Stille von sich aus.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/banking.css";
import { ruf, SITZUNG_WEG, type Ich, type Lage } from "./api";
import { tag, uhr } from "./format";
import { Laden, Meldung, Zeichen } from "./ui";
import Anmeldung from "./anmeldung";
import Uebersicht, { type Reiter } from "./uebersicht";
import Umsaetze from "./umsaetze";
import Ueberweisung, { Dauerauftraege } from "./ueberweisung";
import Auftraege from "./auftraege";
import Auszahlungen from "./auszahlungen";
import Auszuege from "./auszuege";
import { EmpfaengerSeite, KontostandSeite, SicherheitSeite } from "./verwaltung";

const LEERLAUF_S = 10 * 60;
const MENUE_KEY = "fiaon-banking-menue";

const REITER: { r: Reiter; t: string; z: string; titel: string; satz: string; nurInhaber?: boolean }[] = [
  { r: "start", t: "Übersicht", z: "start", titel: "Übersicht", satz: "Konten, Kontostand und was heute zu tun ist." },
  { r: "umsaetze", t: "Umsätze", z: "umsatz", titel: "Umsätze", satz: "Jede Bewegung auf beiden Konten — mit ihrer Herkunft." },
  { r: "ueberweisung", t: "Überweisung", z: "senden", titel: "Neue Überweisung", satz: "Erfassen, prüfen, freigeben — jede Zahlung trägt zwei Namen." },
  { r: "auftraege", t: "Aufträge", z: "auftraege", titel: "Aufträge und Freigaben", satz: "Alle Zahlungsaufträge mit dem jeweils nächsten Schritt." },
  { r: "auszahlungen", t: "Auszahlungen", z: "team", titel: "Auszahlungen an Mitarbeiter", satz: "Provision und Gehalt — mit Abrechnung und Beleg." },
  { r: "dauer", t: "Daueraufträge", z: "wiederholen", titel: "Daueraufträge", satz: "Wiederkehrende Zahlungen, die sich selbst zur Freigabe vorlegen." },
  { r: "auszuege", t: "Auszüge", z: "dokument", titel: "Auszüge und Dokumente", satz: "Monatsauszüge, CSV für die Steuerberatung, alle Papiere." },
  { r: "empfaenger", t: "Empfänger", z: "kartei", titel: "Empfänger-Kartei", satz: "Wer schon bezahlt wurde — für das nächste Mal in Sekunden." },
  { r: "sicherheit", t: "Sicherheit", z: "schild", titel: "Sicherheit", satz: "Sitzungen, Zugänge und das vollständige Protokoll." },
  { r: "kontostand", t: "Kontostand", z: "waage", titel: "Kontostand bewegen", satz: "Anfangsbestand, Einlagen, Korrekturen und Bankabgleich.", nurInhaber: true },
];

function reiterAusAdresse(): Reiter {
  const r = new URLSearchParams(window.location.search).get("reiter") as Reiter | null;
  return r && REITER.some((x) => x.r === r) ? r : "start";
}

export default function BankingPage() {
  const [ich, setIch] = useState<Ich | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [letzte, setLetzte] = useState<{ am: string; geraet: string } | null>(null);

  useEffect(() => {
    document.title = "FIAON Banking";
    document.documentElement.style.colorScheme = "light";
    ruf<{ angemeldet: boolean; ich?: Ich; letzteAnmeldung?: { am: string; geraet: string } | null }>("/buchhaltung/status")
      .then((j) => { if (j.angemeldet && j.ich) { setIch(j.ich); setLetzte(j.letzteAnmeldung ?? null); } })
      .catch(() => { /* nicht angemeldet */ })
      .finally(() => setGeprueft(true));
    const weg = () => { setIch(null); setHinweis("Die Sitzung ist beendet. Bitte neu anmelden."); };
    window.addEventListener(SITZUNG_WEG, weg);
    return () => window.removeEventListener(SITZUNG_WEG, weg);
  }, []);

  const abmelden = useCallback(async (grund?: string) => {
    await fetch("/api/fiaon/buchhaltung/abmelden", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grund: grund ?? "Abgemeldet" }),
    }).catch(() => null);
    setIch(null);
    setHinweis(grund === "Untätigkeit" ? "Aus Sicherheitsgründen abgemeldet — nach 10 Minuten ohne Eingabe." : "Abgemeldet.");
  }, []);

  if (!geprueft) return <div data-fiaon-banking className="bk-nacht" />;
  if (!ich) {
    return (
      <div data-fiaon-banking className="bk-nacht">
        <Anmeldung hinweis={hinweis} fertig={(i) => {
          setHinweis(null); setIch(i);
          ruf<{ letzteAnmeldung?: { am: string; geraet: string } | null }>("/buchhaltung/status").then((j) => setLetzte(j.letzteAnmeldung ?? null)).catch(() => null);
        }} />
      </div>
    );
  }
  return <App ich={ich} letzte={letzte} abmelden={abmelden} />;
}

// ═══════════════════════════════════════════════════════════════════════════
function App({ ich, letzte, abmelden }: { ich: Ich; letzte: { am: string; geraet: string } | null; abmelden: (grund?: string) => Promise<void> }) {
  const [reiter, setReiter] = useState<Reiter>(reiterAusAdresse);
  const [lage, setLage] = useState<Lage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [breit, setBreit] = useState(() => { try { return localStorage.getItem(MENUE_KEY) === "breit"; } catch { return false; } });
  const [handyMenue, setHandyMenue] = useState(false);
  const [rest, setRest] = useState(LEERLAUF_S);
  const [willkommen, setWillkommen] = useState(true);
  const zuletzt = useRef(Date.now());
  const letztesZeichen = useRef(Date.now());

  const laden = useCallback(async () => {
    try { setLage(await ruf<Lage>("/buchhaltung/lage")); setFehler(null); }
    catch (e: any) { setFehler(e.message); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // ── Untätigkeit ─────────────────────────────────────────────────────────
  useEffect(() => {
    const aktiv = () => {
      zuletzt.current = Date.now();
      if (Date.now() - letztesZeichen.current > 120_000) {
        letztesZeichen.current = Date.now();
        void ruf("/buchhaltung/lebenszeichen", { body: {} }).catch(() => null);
      }
    };
    const ereignisse = ["mousedown", "keydown", "wheel", "touchstart", "mousemove"] as const;
    ereignisse.forEach((e) => window.addEventListener(e, aktiv, { passive: true }));
    const takt = setInterval(() => {
      const r = Math.max(0, LEERLAUF_S - Math.floor((Date.now() - zuletzt.current) / 1000));
      setRest(r);
      if (r === 0) void abmelden("Untätigkeit");
    }, 1000);
    return () => { ereignisse.forEach((e) => window.removeEventListener(e, aktiv)); clearInterval(takt); };
  }, [abmelden]);

  const gehe = useCallback((r: Reiter) => {
    setReiter(r); setHandyMenue(false);
    const u = new URL(window.location.href);
    if (r === "start") u.searchParams.delete("reiter"); else u.searchParams.set("reiter", r);
    window.history.replaceState(null, "", u.toString());
    window.scrollTo({ top: 0 });
  }, []);

  const menueUmschalten = () => {
    setBreit((b) => { const n = !b; try { localStorage.setItem(MENUE_KEY, n ? "breit" : "schmal"); } catch { /* ohne Speicher */ } return n; });
  };

  const sichtbar = REITER.filter((x) => !x.nurInhaber || ich.rolle === "inhaber");
  const aktuell = REITER.find((x) => x.r === reiter) ?? REITER[0];
  const badge = (r: Reiter): number => {
    if (!lage) return 0;
    if (r === "auftraege") {
      return ich.rolle === "inhaber"
        ? lage.auftraege.filter((a) => a.status === "eingereicht" || a.status === "freigegeben").length
        : lage.auftraege.filter((a) => a.status === "entwurf" && a.erstelltVon === ich.email).length;
    }
    if (r === "auszahlungen") return lage.auszahlungOffen.ohneAuftrag;
    return 0;
  };
  const min = Math.floor(rest / 60), sek = String(rest % 60).padStart(2, "0");

  return (
    <div data-fiaon-banking className={`bk-app${breit ? " bk-breit" : ""}`}>
      <aside className={`bk-leiste${handyMenue ? " offen" : ""}`} aria-label="Banking">
        <div className="bk-leiste-marke">
          <span className="bk-monogramm" aria-hidden="true">F</span>
          <span className="bk-leiste-wort">FIAON<small>Banking</small></span>
        </div>
        <nav>
          {sichtbar.map((x) => {
            const n = badge(x.r);
            return (
              <button key={x.r} type="button" className={`bk-nav${reiter === x.r ? " aktiv" : ""}`} onClick={() => gehe(x.r)}
                title={breit ? undefined : x.t} aria-current={reiter === x.r ? "page" : undefined}>
                <Zeichen n={x.z} g={19} />
                <span className="bk-nav-t">{x.t}</span>
                {n ? <span className="bk-nav-zahl" aria-label={`${n} offen`}>{n}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="bk-leiste-fuss">
          <div className="bk-leiste-person" title={`${ich.name} · ${ich.titel}`}>
            <span className="bk-leiste-initial">{ich.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
            <span className="bk-nav-t"><strong>{ich.name}</strong><em>{ich.titel}</em></span>
          </div>
          <button type="button" className="bk-nav" onClick={() => void abmelden()} title={breit ? undefined : "Abmelden"}>
            <Zeichen n="abmelden" g={19} /><span className="bk-nav-t">Abmelden</span>
          </button>
          <button type="button" className="bk-nav bk-einklapp" onClick={menueUmschalten} aria-label={breit ? "Menü einklappen" : "Menü ausklappen"}>
            <Zeichen n={breit ? "links" : "rechts"} g={17} /><span className="bk-nav-t">Einklappen</span>
          </button>
        </div>
      </aside>
      {handyMenue ? <div className="bk-handy-schleier" onClick={() => setHandyMenue(false)} /> : null}

      <main className="bk-haupt">
        <header className="bk-kopfleiste">
          <button type="button" className="bk-handy-menue" aria-label="Menü" onClick={() => setHandyMenue((m) => !m)}><Zeichen n="menue" /></button>
          <div className="bk-kopf-titel">
            <span className="bk-kopf-braue">FIAON LTD · Banking</span>
            <h1>{aktuell.titel}</h1>
          </div>
          <div className={`bk-sitzung${rest <= 60 ? " knapp" : ""}`} role="status" aria-live={rest <= 60 ? "assertive" : "off"}>
            <Zeichen n="schloss" g={14} />
            <span className="bk-sitzung-t">Gesicherte Sitzung</span>
            <span className="bk-sitzung-zeit" title="Automatische Abmeldung bei Untätigkeit">{min}:{sek}</span>
          </div>
        </header>
        <p className="bk-kopf-satz">{aktuell.satz}</p>

        {willkommen && letzte ? (
          <div className="bk-willkommen">
            <Zeichen n="info" g={15} />
            <span>Letzte Anmeldung: {tag(letzte.am)} um {uhr(letzte.am)} · {letzte.geraet}. Warst du das nicht? Unter „Sicherheit“ alle anderen Sitzungen beenden.</span>
            <button type="button" aria-label="Schließen" onClick={() => setWillkommen(false)}><Zeichen n="kreuz" g={13} /></button>
          </div>
        ) : null}

        {rest <= 60 ? (
          <Meldung art="warn">Aus Sicherheitsgründen endet die Sitzung in {rest} Sekunden. Eine Bewegung der Maus hält sie offen.</Meldung>
        ) : null}

        <div className="bk-raum">
          {fehler && !lage ? <Meldung art="fehler">{fehler}</Meldung> : null}
          {!lage ? <Laden zeilen={9} /> : (
            <>
              {reiter === "start" ? <Uebersicht lage={lage} onGehe={gehe} onNeu={() => void laden()} /> : null}
              {reiter === "umsaetze" ? <Umsaetze /> : null}
              {reiter === "ueberweisung" ? <Ueberweisung ich={ich} onFertig={() => void laden()} /> : null}
              {reiter === "auftraege" ? <Auftraege auftraege={lage.auftraege} ich={ich} onNeu={() => void laden()} onNeueUeberweisung={() => gehe("ueberweisung")} /> : null}
              {reiter === "auszahlungen" ? <Auszahlungen ich={ich} onZuAuftraegen={() => { void laden(); gehe("auftraege"); }} /> : null}
              {reiter === "dauer" ? <Dauerauftraege liste={lage.dauerauftraege} ich={ich} onNeu={() => void laden()} /> : null}
              {reiter === "auszuege" ? <Auszuege lage={lage} onNeu={() => void laden()} /> : null}
              {reiter === "empfaenger" ? <EmpfaengerSeite /> : null}
              {reiter === "sicherheit" ? <SicherheitSeite ich={ich} /> : null}
              {reiter === "kontostand" && ich.rolle === "inhaber" ? <KontostandSeite lage={lage} onNeu={() => void laden()} /> : null}
            </>
          )}
        </div>
        <footer className="bk-fuss">
          FIAON LTD · Company No. 17318250 · 128 City Road, London EC1V 2NX · Geschäftskonto bei {lage?.konten[0]?.institut ?? "Banking Circle S.A."} · Jede Handlung wird protokolliert.
        </footer>
      </main>
    </div>
  );
}
