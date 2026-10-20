// ═══════════════════════════════════════════════════════════════════════════
// REITER „EINSTELLUNGEN“ (Cockpit, 20.10.2026) — die übrigen Aras-Schalter, in vier ruhigen Gruppen
// Vorher: 27 Schalter untereinander in einer Karte, dazu doppelt Dialekt/Hintergrund/Zuhören (stehen im Reiter „Probe“)
// und Leerlauf (steht oben in der Statusleiste). Jetzt: An und aus · Wen und wann · Was Aras sagt · Technik (zu).
// Jeder Schalter speichert wie bisher über seinen Setzer (Register shared/fiaon-ki-schalter.ts), folgenreiche fragen nach.
// Ein Schalter, den der Kern neu meldet und der in keiner Gruppe steht, erscheint unter „Weitere“ — nichts geht verloren.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { setzerKoerper, type RegisterEintrag } from "@shared/fiaon-ki-schalter";
import { useTakt, senden, NichtVerbunden } from "../ki-teile";
import { Feld } from "../ChefKiEinstellungen";
import { COCKPIT_SCHLUESSEL, PROBE_SCHLUESSEL } from "./aras-texte";
import { Hinweis, Karte, Leer, useHinweis } from "./aras-teile";

const GRUPPEN: { titel: string; satz: string; schluessel: string[]; zu?: boolean }[] = [
  { titel: "An und aus", satz: "Ob Aras Kunden anruft — und wie weit er schon darf.", schluessel: ["aras_an", "aras_stufe", "aras_stufe_auto"] },
  { titel: "Wen und wann", satz: "Gesprächsarten, Zeiten, Mengen und wie oft je Person.", schluessel: ["aras_spielarten", "aras_fenster", "aras_raten_takte", "aras_je_person_tag", "aras_je_person_woche", "aras_versuche_ende", "aras_parallel", "aras_je_stunde", "aras_lernen_an"] },
  { titel: "Was Aras sagt", satz: "Name, erster Satz, Aufnahme-Frage, Mailbox und Übergabe.", schluessel: ["aras_name", "aras_nachname", "aras_ki_hinweis_satz", "aras_aufnahme_frage", "aras_mailbox_nachricht", "aras_eingehend_modus", "aras_uebergabe"] },
  { titel: "Technik", satz: "Selten nötig: Anbieter, Modelle, Absendernummern.", zu: true, schluessel: ["aras_adapter", "aras_delegation", "aras_modell_stimme", "aras_modell_gehirn", "aras_stimme_beschreibung", "aras_caller_id_at", "aras_caller_id_ch"] },
];

interface Daten { ok: boolean; register: any[]; werte: Record<string, string>; gesetzt: Record<string, boolean> }

export default function ArasEinstellungen({ verbunden, fokus }: { verbunden: boolean; fokus?: string | null }) {
  const { daten, fehler, neu } = useTakt<Daten>(verbunden ? "/chef/ki/einstellungen" : null, 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [technikAuf, setTechnikAuf] = useState(false);
  const hinweis = useHinweis();
  useEffect(() => {
    if (!fokus || !daten) return;
    const el = document.querySelector<HTMLElement>(`[data-ki-schalter="${fokus}"]`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("ar-hervor"); window.setTimeout(() => el.classList.remove("ar-hervor"), 2400); }
  }, [fokus, daten]);
  if (!verbunden) return <NichtVerbunden />;
  if (fehler && !daten) return <Leer titel="Die Einstellungen ließen sich nicht laden.">{fehler} <button type="button" className="ar-knopf-text" onClick={neu}>Nochmal</button></Leer>;
  if (!daten) return <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div>;
  const aras = (daten.register ?? []).filter((e) => e.dienst === "aras" && !PROBE_SCHLUESSEL.includes(e.schluessel) && !COCKPIT_SCHLUESSEL.includes(e.schluessel));
  const bekannt = new Set(GRUPPEN.flatMap((g) => g.schluessel));
  const weitere = aras.filter((e) => !bekannt.has(e.schluessel));
  const speichern = async (e: any, w: string) => {
    setBusy(e.schluessel);
    try { await senden(e.setzer.route, setzerKoerper(e as RegisterEintrag, w)); hinweis.gut(`${e.label}: gespeichert.`); neu(); }
    catch (err) { hinweis.rot(`${e.label}: ${(err as Error).message}`); } finally { setBusy(null); }
  };
  const felder = (liste: any[]) => liste.map((e) => <Feld key={e.schluessel} e={e} wert={daten.werte[e.schluessel]} gesetzt={!!daten.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />);
  const gruppe = (schluessel: string[]) => schluessel.map((k) => aras.find((e) => e.schluessel === k)).filter(Boolean);
  return (
    <div className="ar-reiter-inhalt ar-einstellungen" data-ki="aras-einstellungen">
      <p className="ar-leise">Ton, Stimme, deine Nummer und den Tagesdeckel stellst du im Reiter „Probe“ ein, Leerlauf und Not-Aus oben. Vorgabe und Grenze stehen im Tooltip.</p>
      <Hinweis h={hinweis.h} onWeg={hinweis.weg} />
      {GRUPPEN.map((g) => {
        const liste = gruppe(g.schluessel);
        if (!liste.length) return null;
        if (g.zu) {
          return (
            <Karte key={g.titel} titel={g.titel} satz={g.satz} rechts={<button type="button" className="ar-knopf klein" aria-expanded={technikAuf} onClick={() => setTechnikAuf(!technikAuf)}>{technikAuf ? "Zuklappen" : "Aufklappen"}</button>}>
              {technikAuf ? <div className="ar-felder">{felder(liste)}</div> : null}
            </Karte>
          );
        }
        return <Karte key={g.titel} titel={g.titel} satz={g.satz}><div className="ar-felder">{felder(liste)}</div></Karte>;
      })}
      {weitere.length ? <Karte titel="Weitere" satz="Neue Schalter des Telefon-Kerns."><div className="ar-felder">{felder(weitere)}</div></Karte> : null}
    </div>
  );
}
