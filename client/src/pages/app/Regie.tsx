// ═══════════════════════════════════════════════════════════════════════════
// DIE REGIE — der Demo-Modus des Kundenbereichs (10.09.2026, E-172)
//
// Justin: „Setze es mir so zurück /app/demo/weg, dass wir direkt sehen, wie es
// der Kunde sieht, also starten bei 1! Und bitte in HIGH END Demo Modus, dass
// wir es uns im Detail ansehen können."
//
// ── DIE EINE REGEL DIESER DATEI ────────────────────────────────────────────
// Die Regie steuert die Vorführung, steht aber NIE auf der Bühne. Der
// Kundenbereich darunter bleibt Pixel für Pixel das, was ein echter Kunde
// sieht. Wer die Regie schließt, sieht den Bereich, als gäbe es sie nicht.
//
// ── DREI BAUREGELN, DIE AUS DER ENTWURFSRUNDE KAMEN ────────────────────────
// 1. MATERIAL: Die Regie ist MATTES Navy — kein backdrop-filter, kein Glanz,
//    kein Verlauf, kein FIAON-Blau. Das eine Navy-GLAS bleibt der Zielkarte auf
//    „Heute“ (Justins Regel „Navy-Glas an EINER Stelle“). Damit kann man die
//    Bedienung keine Sekunde mit dem Produkt verwechseln — die billigste und
//    wirksamste Fälschungssperre.
// 2. EINE ZÄHLUNG: Der Kundenbereich sagt „0 von 11 Schritten erledigt“. Die
//    Regie sagt deshalb NIE „1/11“, sondern nennt den Schritt beim Namen —
//    „Schritt 1“. Zwei Zählungen nebeneinander sind der erste Fehler, nach dem
//    in einer Vorführung gefragt wird.
// 3. EINE QUELLE: Jede Stufe ist ein echter Schnappschuss aus
//    `GET /kunde/FIAON-DEMO/bereich?stufe=n`, der durch dieselbe Funktion
//    `rahmenwegAus()` läuft wie bei einem echten Kunden. Kein Balken wird von
//    Hand gemalt, und in Heute/Weg/Geld/Brief steht kein einziges neues
//    `if (demo)`. Sonst führt die Demo etwas vor, das es nicht gibt.
//
// Die Stufe steht in der Adresse (`?stufe=3`), damit sie einen Neuladen
// überlebt und sich teilen lässt — so schickt man jemandem genau den Moment,
// über den man gerade spricht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { DEMO_STUFEN, DEMO_STUFEN_MAX, demoStand, type DemoStufe } from "@shared/fiaon-demo-stufen";
import type { Bereich } from "./typen";
import type { Rahmenweg } from "@shared/fiaon-rahmenweg";

/** Auf welchem Schirm sieht man diese Stufe am besten? Die Vorführung wandert danach. */
const SCHIRM: Record<number, string> = {
  1: "", 2: "geld", 3: "weg", 4: "weg", 5: "weg", 6: "weg",
  7: "weg", 8: "brief", 9: "geld", 10: "weg", 11: "weg", 12: "",
};

/** Wie lange steht die Vorführung auf einer Stufe? */
const TAKT_MS = 6000;

const WER_WORT: Record<string, string> = { kunde: "Kunde ist dran", fiaon: "FIAON ist dran", niemand: "Nichts offen" };

export function Regie({ stufe, setzeStufe, b, rw, schirmWechsel }: {
  stufe: number;
  setzeStufe: (n: number) => void;
  b: Bereich | null;
  rw: Rahmenweg | null;
  /** Bringt die Ansicht auf den Schirm, auf dem die Stufe zu sehen ist. */
  schirmWechsel: (schirm: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);
  const st = demoStand(stufe);
  const vorher = demoStand(Math.max(1, stufe - 1));
  const jetzt = DEMO_STUFEN.find((x) => x.nr === stufe) ?? DEMO_STUFEN[0];
  const erledigt = Math.max(0, Math.min(11, stufe - 1));

  // ── DIE BÜHNE AM RECHNER ────────────────────────────────────────────────
  // Ab 1100 px steht der Kundenbereich in einem Telefongehäuse in der Mitte und
  // die Regie als feste Schiene daneben — kein Pixel liegt dann über der
  // Kundenansicht. Die Klasse hängt an <html>, damit app.css die Spalte
  // umbauen kann, ohne dass eine Kundenseite davon weiß.
  useEffect(() => {
    document.documentElement.classList.add("ap-regie-an");
    return () => { document.documentElement.classList.remove("ap-regie-an"); };
  }, []);

  // ── DIE VORFÜHRUNG ──────────────────────────────────────────────────────
  // Sie hält an, sobald jemand eingreift. Ein Takt, der im Hintergrund
  // weiterläuft und die Adresse ändert, wäre ein Gespenst.
  const anhalten = () => {
    if (uhr.current) { clearInterval(uhr.current); uhr.current = null; }
    setLaeuft(false);
  };
  useEffect(() => () => { if (uhr.current) clearInterval(uhr.current); }, []);

  const vorfuehren = () => {
    if (laeuft) { anhalten(); return; }
    setLaeuft(true);
    let n = stufe >= DEMO_STUFEN_MAX ? 1 : stufe;
    const zeigen = (x: number) => { setzeStufe(x); schirmWechsel(SCHIRM[x] ?? ""); };
    zeigen(n);
    uhr.current = setInterval(() => {
      n += 1;
      if (n > DEMO_STUFEN_MAX) { anhalten(); return; }
      zeigen(n);
    }, TAKT_MS);
  };

  const waehlen = (n: number) => { anhalten(); setzeStufe(n); };
  const zurueck = () => waehlen(Math.max(1, stufe - 1));
  const weiter = () => waehlen(Math.min(DEMO_STUFEN_MAX, stufe + 1));

  // Pfeiltasten und Leertaste — nur am Rechner sinnvoll, stören am Handy nicht.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const z = e.target as HTMLElement | null;
      if (z && /^(INPUT|TEXTAREA|SELECT)$/.test(z.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); weiter(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); zurueck(); }
      else if (e.key === "Escape" && offen) setOffen(false);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  // ── WAS SICH AUF WELCHEM SCHIRM ÄNDERT ──────────────────────────────────
  // Die Antwort auf die Frage, die man bei jedem Sprung sonst selbst stellen
  // müsste: Wo sehe ich das jetzt? „Unverändert“ steht ausdrücklich da —
  // sonst sucht man auf einem Schirm nach einer Änderung, die es nicht gibt.
  const jeSchirm: { name: string; schirm: string; text: string; neu: boolean }[] = [
    { name: "Heute", schirm: "", neu: true,
      text: rw ? `${rw.erledigt} von ${rw.gesamt} Schritten · ${rw.lage === "kunde_dran" ? "Sie sind dran" : rw.lage === "fiaon_dran" ? "Liegt bei FIAON" : "nichts offen"}` : "–" },
    { name: "Weg", schirm: "weg", neu: true,
      text: stufe > 11 ? "alle elf Schritte abgehakt" : `Schritt ${stufe} ist dran${erledigt ? `, ${erledigt} abgehakt` : ", noch nichts abgehakt"}` },
    { name: "Brief", schirm: "brief", neu: st.schreiben !== vorher.schreiben || st.analyse !== vorher.analyse,
      text: st.rate2 ? "ein Schreiben unterwegs, ein Brief eingegangen" : st.schreiben ? "erstes Schreiben versandt, wartet auf Antwort" : st.analyse ? "der erste Antrag entsteht" : "noch kein Schreiben" },
    { name: "Geld", schirm: "geld", neu: st.bezahlt !== vorher.bezahlt || st.rate2 !== vorher.rate2,
      text: b ? `${b.abo.bezahlt} von ${b.abo.raten.length} Raten bezahlt${b.abo.naechste ? ` · nächste am ${b.abo.naechste.faelligAm}` : ""}` : "–" },
    { name: "Mehr", schirm: "mehr", neu: st.startgespraech !== vorher.startgespraech,
      text: st.startgespraech ? "Startgespräch steht im Terminverlauf" : "noch kein Termin" },
  ];

  // ── WORAUS DIESER STAND ENTSTEHT ────────────────────────────────────────
  // Feld für Feld. Wer einen Fehler sucht, sieht hier sofort, ob die Daten mit
  // der Stufe gewandert sind.
  const daten: { feld: string; wert: string }[] = b ? [
    { feld: "Kunde seit", wert: b.kunde.kundeSeit ?? "–" },
    { feld: "Erste Zahlung", wert: b.stufe.bezahlt ? "eingegangen" : "offen" },
    { feld: "Startgespräch", wert: b.onboardingGelaufen ? "geführt" : "offen" },
    { feld: "Unterlagen", wert: b.unterlagen.ausweis && b.unterlagen.kontoauszug ? "geprüft" : "offen" },
    { feld: "Auskunft", wert: b.bonitaet?.geprueft ? "geprüft und erklärt" : b.bonitaet?.hatDokument ? "liegt vor" : "offen" },
    { feld: "Girokonto", wert: b.konto?.eroeffnet ? "eröffnet" : "offen" },
    { feld: "Konto und Karte", wert: b.karte?.verschickt ? "Weg verschickt" : "offen" },
    { feld: "Finanzauswertung", wert: b.finanzen ? "liegt vor" : "gibt es noch nicht" },
  ] : [];

  const inhalt = (
    <>
      <header className="ap-regie-kopf">
        <div>
          <div className="ap-regie-marke">Regie</div>
          <div className="ap-regie-wer">
            {b ? `${b.kunde.vorname} ${b.kunde.nachname} · Kunde seit ${b.kunde.kundeSeit ?? "heute"} · ${b.paket.name}` : "Beispielkonto"}
          </div>
        </div>
        <button type="button" className="ap-regie-zu" onClick={() => setOffen(false)} aria-label="Regie schließen">✕</button>
      </header>

      <p className="ap-regie-satz">Sie sehen den Kundenbereich genau so, wie der Kunde ihn auf dieser Stufe sieht. Nichts hier gehört zum Produkt.</p>

      <div className="ap-regie-steuer">
        <button type="button" className="ap-regie-pfeil" onClick={zurueck} disabled={stufe <= 1} aria-label="Schritt zurück">‹</button>
        <div className="ap-regie-stand">
          <b>{jetzt.nr <= 11 ? `Schritt ${jetzt.nr}` : "Alles erledigt"}</b>
          <span>{jetzt.titel}</span>
        </div>
        <button type="button" className="ap-regie-pfeil" onClick={weiter} disabled={stufe >= DEMO_STUFEN_MAX} aria-label="Nächster Schritt">›</button>
      </div>

      <button type="button" className={`ap-regie-film${laeuft ? " an" : ""}`} onClick={vorfuehren}>
        <b>{laeuft ? "Vorführung anhalten" : "Vorführung starten"}</b>
        <i>{laeuft ? "läuft — sechs Sekunden je Schritt" : "der ganze Weg von allein, Schirm für Schirm"}</i>
      </button>

      <div className="ap-regie-block">
        <h3>Was der Kunde jetzt sieht</h3>
        <p className="ap-regie-was">{jetzt.was}</p>
      </div>

      <div className="ap-regie-block">
        <h3>Stufe wählen</h3>
        <ol className="ap-regie-liste">
          {DEMO_STUFEN.map((s: DemoStufe) => {
            const fertig = s.nr < stufe;
            const hier = s.nr === stufe;
            return (
              <li key={s.nr}>
                <button type="button" className={`ap-regie-zeile${hier ? " hier" : ""}${fertig ? " fertig" : ""}`} onClick={() => waehlen(s.nr)} aria-current={hier ? "step" : undefined}>
                  <span className="ap-regie-nr">{fertig ? "✓" : s.nr <= 11 ? s.nr : "★"}</span>
                  <span className="ap-regie-titel">{s.titel}</span>
                  <span className="ap-regie-marke-wer">{WER_WORT[s.wer]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="ap-regie-block">
        <h3>Was sich damit ändert</h3>
        <ul className="ap-regie-schirme">
          {jeSchirm.map((z) => (
            <li key={z.name} className={z.neu ? "" : "still"}>
              <button type="button" onClick={() => { anhalten(); schirmWechsel(z.schirm); setOffen(false); }}>
                <b>{z.name}</b>
                <span>{z.neu ? z.text : "unverändert"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ap-regie-block">
        <h3>Woraus dieser Stand entsteht</h3>
        <ul className="ap-regie-daten">
          {daten.map((d) => (
            <li key={d.feld}><b>{d.feld}</b><span>{d.wert}</span></li>
          ))}
        </ul>
        <p className="ap-regie-fuss">Feste Vorführdaten aus einer Quelle. Max Mustermann ist kein Kunde, und in der Demo wird nichts geändert.</p>
      </div>
    </>
  );

  return (
    <>
      {/* Der Griff. Ruhig, immer sichtbar, weit über beiden Fußleisten — er
          darf nie über dem Knopf liegen, den der Kunde drücken soll. */}
      <button
        type="button"
        className={`ap-regie-griff${offen ? " auf" : ""}${laeuft ? " laeuft" : ""}`}
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
      >
        <span className="ap-regie-griff-wort">Regie</span>
        <span className="ap-regie-griff-schritt">{stufe <= 11 ? `Schritt ${stufe}` : "Fertig"}</span>
      </button>

      {/* Handy: Blatt von unten. Rechner ab 1100 px: feste Schiene neben der
          Bühne (app.css entscheidet, diese Datei rendert nur einmal). */}
      {offen && <div className="ap-regie-schleier" onClick={() => setOffen(false)} aria-hidden="true" />}
      <aside className={`ap-regie${offen ? " auf" : ""}`} role="dialog" aria-label="Regie — Demo-Modus" aria-hidden={!offen}>
        {inhalt}
      </aside>
    </>
  );
}
