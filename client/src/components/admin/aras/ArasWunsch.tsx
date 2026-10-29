// ═══════════════════════════════════════════════════════════════════════════
// KARTE „WEN ARAS ANRUFT“ (E-458, 29.10.2026) — oben im Reiter „Als Nächstes“
//
// Justin (29.10.2026): „ARAS telefoniert nur noch die Termine oder die Leute die einen Anruf wollen“ + „go Plan“ (Punkt 8) —
// und am Nachmittag: „ARAS darf JEDEN im System anrufen, braucht kein eigenes Kreuz“. Darum zwei Gruppen: wer eine Grundlage
// hat (Termin, Gesprächsbuchung, Ja) und die Kunden mit Vertrag (alle Vertragsarten wieder an, fiaon-aras-golive.ts jedenPruefen).
// Die Karte zeigt auf einen Blick: welche Gesprächsarten an sind (ein Klick schaltet), ob ARAS überhaupt wählt (Stufe),
// wer mit schriftlichem Ja auf einen Anruf wartet (und warum jemand nicht dran ist), welche Global-Gespräche eine
// Erinnerung bekommen und wie viele Rückrufe Mara „bei ARAS“ eingetragen hat. Daten: GET /chef/aras/wunsch.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { senden, useTakt } from "../ki-teile";
import { FrageKnopf, Hinweis, Karte, useHinweis } from "./aras-teile";

interface Lage {
  ok: boolean;
  bereit: { bereit: boolean; grund: string | null };
  stufe: number;
  an: { wunsch: boolean; erinnerung: boolean; termin: boolean; willkommen: boolean; stufe_a: boolean; rate: boolean; zusage: boolean; auftrag: boolean };
  wunsch: { personId: number; name: string; firma: boolean; quelle: string; am: string; versuche: number; grund: string | null }[];
  erinnerung: { terminId: number; personId: number; firma: string | null; wann: string; wer: string; fenster: string | null; geplant: boolean }[];
  zahlen: { wunschJetzt: number; wunschGesamt: number; erinnerungen: number; rueckrufeBeiAras: number };
}

/** Die Schalter der Karte — in Justins Worten, mit dem Satz, was sie tun. Oben wer eine Grundlage hat, unten die Vertragskunden. */
const SCHALTER: { key: keyof Lage["an"]; gruppe: "grundlage" | "vertrag"; text: string; satz: string; nachfragen?: boolean }[] = [
  { key: "termin", gruppe: "grundlage", text: "Termine bei ARAS", satz: "Rückrufe, die ein Kunde bei ARAS gebucht hat — auch die, die Mara „bei ARAS“ einträgt." },
  { key: "wunsch", gruppe: "grundlage", text: "Anruf-Wunsch", satz: "Wer schriftlich Ja zum Anruf gesagt hat (ein halbes Jahr lang). ARAS klärt das Anliegen und bucht einen Termin — sie verkauft nie." },
  { key: "erinnerung", gruppe: "grundlage", text: "Erinnerung vor Global-Gespräch", satz: "Kurz vor jedem gebuchten Erstgespräch eine Bestätigung — der Hinweis steht im Buchungsformular, ein eigenes Kreuz braucht es nicht." },
  { key: "willkommen", gruppe: "vertrag", text: "Willkommen nach Antrag", satz: "Neukunden nach der Unterschrift: Begrüßung, Kundenkonto, erste Rate.", nachfragen: true },
  { key: "stufe_a", gruppe: "vertrag", text: "Zahlung gemeldet", satz: "Wer sagt, er hat überwiesen: ARAS klärt Bank und Verwendungszweck, damit die Zahlung schnell zugeordnet wird." },
  { key: "rate", gruppe: "vertrag", text: "Rate offen", satz: "Kunden mit offener Rate: ARAS erinnert freundlich und hilft beim Bezahlen.", nachfragen: true },
  { key: "zusage", gruppe: "vertrag", text: "Zusage nachfassen", satz: "Wer eine Zahlung zugesagt hat: ARAS fragt freundlich nach — erst ab Stufe 2." },
  { key: "auftrag", gruppe: "vertrag", text: "Auftrag vom Team", satz: "Anrufe, die das Team in der Akte bestellt („ARAS anrufen lassen“)." },
];
const GRUPPEN = [
  { key: "grundlage", titel: "Mit Termin, Gesprächsbuchung oder Ja zum Anruf" },
  { key: "vertrag", titel: "Kunden mit Vertrag" },
] as const;

export default function ArasWunsch({ verbunden, onReiter }: { verbunden: boolean; onReiter: (r: "probe" | "einstellungen") => void }) {
  const { daten, fehler, neu } = useTakt<Lage>(verbunden ? "/chef/aras/wunsch" : null, 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [alle, setAlle] = useState(false);
  const hinweis = useHinweis();
  if (!verbunden) return null;
  if (!daten) return <Karte titel="Wen ARAS anruft" satz={fehler ?? "lädt …"}><div className="ar-zeile-lade" /></Karte>;

  const schalten = async (key: string, an: boolean, text: string) => {
    setBusy(key);
    try { await senden("/chef/aras/spielart", { spielart: key, an }); hinweis.gut(`${text}: ${an ? "an" : "aus"}.`); neu(); }
    catch (e) { hinweis.rot(`${text}: ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const wartende = daten.wunsch.filter((w) => !w.grund || w.grund === "wartet schon auf den Anruf");
  const andere = daten.wunsch.filter((w) => !wartende.includes(w));
  const liste = alle ? daten.wunsch : wartende;

  return (
    <Karte data="aras-wunsch" klasse="ar-wunsch" titel="Wen ARAS anruft"
      satz="Alle, bei denen ARAS anrufen darf: Kunden mit Vertrag, gebuchte Termine und Gespräche, jedes Ja zum Anruf (Justin 29.10.2026). Ein Klick schaltet eine Gesprächsart an oder aus."
      rechts={<span className={`ar-marke ${daten.stufe === 0 ? "warn" : "gut"}`}>{daten.stufe === 0 ? "Stufe 0 — ruft noch niemanden an" : `Stufe ${daten.stufe} — ARAS wählt`}</span>}>
      <Hinweis h={hinweis.h} onWeg={hinweis.weg} />
      {daten.stufe === 0 ? (
        <p className="ar-wunsch-stufe">
          ARAS ruft gerade niemanden an. Erst wenn du die Ausbaustufe auf 1 stellst, wählt sie — und dann nur die Gesprächsarten, die hier an sind.{" "}
          <button type="button" className="ar-knopf-text" onClick={() => onReiter("einstellungen")}>Zur Ausbaustufe</button>
        </p>
      ) : null}

      {GRUPPEN.map((gr) => (
        <div key={gr.key} className="ar-wunsch-block">
          <h3>{gr.titel}</h3>
          <div className="ar-wunsch-schalter" role="group" aria-label={gr.titel}>
            {SCHALTER.filter((s) => s.gruppe === gr.key).map((s) => {
              const an = !!daten.an[s.key];
              const knopf = s.nachfragen && !an
                ? <FrageKnopf frage={`${s.text} wieder an?`} ja="Ja, an" onJa={() => schalten(s.key, true, s.text)} disabled={busy === s.key} data={`spielart-${s.key}`}>aus</FrageKnopf>
                : <button type="button" className={`ar-knopf klein${an ? " an" : ""}`} aria-pressed={an} disabled={busy === s.key} data-ar={`spielart-${s.key}`} onClick={() => schalten(s.key, !an, s.text)}>{an ? "an" : "aus"}</button>;
              return (
                <div key={s.key} className="ar-wunsch-zeile">
                  <div><b>{s.text}</b><small>{s.satz}</small></div>
                  {knopf}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="ar-wunsch-block" data-ap="aras-wunsch-liste">
        <h3>Anruf-Wunsch <span className="ar-leise">— {wartende.length} {wartende.length === 1 ? "Mensch wartet" : "Menschen warten"} auf einen Anruf{andere.length ? `, ${andere.length} nicht (Grund daneben)` : ""}</span></h3>
        {liste.length ? (
          <div className="ar-tabelle-rahmen">
            <table className="ar-tabelle">
              <thead><tr><th>Wer</th><th>Ja zum Anruf</th><th>am</th><th className="zahl">Versuche</th><th>Stand</th></tr></thead>
              <tbody>
                {liste.map((w) => (
                  <tr key={w.personId}>
                    <td>{w.name}{w.firma ? <span className="ar-marke leise">Firma</span> : null}</td>
                    <td>{w.quelle}</td>
                    <td>{w.am}</td>
                    <td className="zahl">{w.versuche}</td>
                    <td>{w.grund ? <span className={w.grund === "wartet schon auf den Anruf" ? "" : "ar-leise"}>{w.grund}</span> : <span className="ar-marke gut">bereit</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="ar-leise">Gerade wartet niemand mit schriftlichem Ja auf einen Anruf.</p>}
        {andere.length ? <button type="button" className="ar-knopf-text" onClick={() => setAlle(!alle)}>{alle ? "Nur die Wartenden zeigen" : `Auch die ${andere.length} ohne Anruf zeigen`}</button> : null}
      </div>

      <div className="ar-wunsch-block">
        <h3>Erinnerung vor Global-Gesprächen <span className="ar-leise">— nächste 40 Stunden</span></h3>
        {daten.erinnerung.length ? (
          <ul className="ar-wunsch-erinnerung">
            {daten.erinnerung.map((e) => (
              <li key={e.terminId}><b>{e.wann}</b> mit {e.wer}{e.firma ? ` · ${e.firma}` : ""} — {e.fenster ? `ARAS ruft ${e.fenster} an` : "kein Anrufzeitpunkt (Sonntag/Feiertag) — es erinnern nur die Mails"}{e.geplant ? <span className="ar-marke gut">eingeplant</span> : null}</li>
            ))}
          </ul>
        ) : <p className="ar-leise">Kein gebuchtes Global-Gespräch in den nächsten 40 Stunden.</p>}
      </div>

      <div className="ar-wunsch-block">
        <h3>Rückrufe bei ARAS <span className="ar-leise">— von Mara eingetragen (WhatsApp, Mail)</span></h3>
        <p className="ar-leise">
          {daten.bereit.bereit
            ? `Mara bietet Kunden, die angerufen werden wollen, ARAS mit Zeitfenster an. Offen: ${daten.zahlen.rueckrufeBeiAras}.`
            : `Mara bietet ARAS erst an, wenn ARAS Rückrufe annimmt (gerade: ${daten.bereit.grund ?? "nein"}) — bis dahin bucht sie wie bisher beim Betreuer.`}
        </p>
      </div>

      <p className="ar-wunsch-probe">
        Ausprobieren ohne Kunden: im Reiter „Probe“ die Gesprächsart „Anruf-Wunsch“ oder „Erinnerung vor Gespräch“ wählen — ARAS ruft nur deine Nummer an.{" "}
        <button type="button" className="ar-knopf klein" onClick={() => onReiter("probe")}>Zur Probe</button>
      </p>
    </Karte>
  );
}
