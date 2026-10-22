// ═══════════════════════════════════════════════════════════════════════════
// „JA ZUM ANRUF“ IN DER KARTE „ARAS“ (E-408 Scheibe 3, 22.10.2026)
//
// Eine Zeile, was gilt — „Ja zum Anruf: seit 22.10. (WhatsApp)“ · „… · Widerrufen am …“ · „Noch kein Ja zum Anruf“ —
// und drei Knöpfe:
//   · Ja zum Anruf eintragen   Dialog mit der Pflicht-Bestätigung (JA_AKTE_BESTAETIGUNG); ohne Häkchen bleibt
//                              „Eintragen“ grau, und der Server nimmt nur ein echtes true an.
//   · Mara fragt nach dem Ja   nur, wenn das WhatsApp-Fenster offen ist — sonst steht der Grund als Text daneben.
//   · Ja widerrufen            mit einer Rückfrage.
// Server: server/routes/fiaon-ja-zum-anruf.ts · Regeln: server/lib/fiaon-ja-zum-anruf.ts · Sätze: shared/fiaon-ja-zum-anruf.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { api } from "@/pages/agent/shared";
import { JA_AKTE_BESTAETIGUNG } from "@shared/fiaon-ja-zum-anruf";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;
interface Lage {
  ok: boolean;
  aktuell: { id: number; art: string; seit: string; von: string | null; widerrufenAm: string | null } | null;
  gueltig: boolean;
  zeile: string;
  frage: { darf: boolean; grund: string | null; wiederAb: string | null; zuletzt: string | null };
  gespraech: { id: number; beginn: string; laeuft: boolean } | null;
}

const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

export function ArasJaZumAnruf({ personId, melden }: { personId: number; melden: Melden }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [rueckfrage, setRueckfrage] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLadeFehler(null);
    const r = await Promise.race([
      api(`/agent/kunden/${personId}/aras/ja`),
      new Promise<{ ok: false; json: null }>((ok) => setTimeout(() => ok({ ok: false, json: null }), 15_000)),
    ]);
    if (r.ok && r.json?.zeile) setLage(r.json);
    else setLadeFehler(r.json?.error ?? "„Ja zum Anruf“ ließ sich nicht laden.");
  }, [personId]);
  useEffect(() => { setLage(null); setDialog(false); setBestaetigt(false); setRueckfrage(false); setFehler(null); void laden(); }, [laden]);

  async function tun(name: string, pfad: string, body: unknown, titel: string, danach?: () => void) {
    setLaeuft(name); setFehler(null);
    const r = await api(pfad, { method: "POST", body: JSON.stringify(body ?? {}) });
    setLaeuft(null);
    if (!r.ok) {
      // Der Grund bleibt stehen (nicht nur ein Kurzhinweis) — der Mitarbeiter hört dem Kunden gerade zu.
      setFehler(r.json?.error ?? "Hat nicht geklappt — bitte noch einmal.");
      return;
    }
    melden("gut", titel, r.json?.meldung);
    danach?.();
    await laden();
  }

  if (!lage) {
    return (
      <div className="ak-block ak-ja" data-fiaon="aras-ja">
        <h4>Ja zum Anruf</h4>
        {ladeFehler
          ? <p className="ak-grund">{ladeFehler} <button type="button" className="ak-link" onClick={() => void laden()}>Neu laden</button></p>
          : <p className="ak-still">lädt …</p>}
      </div>
    );
  }

  const l = lage;
  return (
    <div className="ak-block ak-ja" data-fiaon="aras-ja">
      <h4>Ja zum Anruf</h4>
      <p className={`ak-ja-zeile${l.gueltig ? " gilt" : ""}`} data-fiaon="aras-ja-zeile">{l.zeile}</p>

      {!l.gueltig && !dialog && (
        <>
          <div className="ak-tun">
            <button type="button" className="pi-knopf klein" disabled={!!laeuft}
                    onClick={() => { setDialog(true); setBestaetigt(false); setFehler(null); }}>Ja zum Anruf eintragen</button>
            <button type="button" className="pi-knopf klein still" disabled={!l.frage.darf || !!laeuft}
                    onClick={() => void tun("frage", `/agent/kunden/${personId}/aras/ja/mara-fragt`, {}, "Mara hat gefragt")}>
              {laeuft === "frage" ? "Mara fragt …" : "Mara fragt nach dem Ja"}</button>
          </div>
          {!l.frage.darf && l.frage.grund && <small className="ak-still ak-ja-warum" data-fiaon="aras-ja-warum">{l.frage.grund}</small>}
        </>
      )}

      {dialog && (
        <div className="ak-maske" role="dialog" aria-label="Ja zum Anruf eintragen" data-fiaon="aras-ja-dialog">
          <label className="ak-haken">
            <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} /> {JA_AKTE_BESTAETIGUNG}
          </label>
          <small className="ak-still">
            {l.gespraech ? `Beleg: dein Gespräch ${l.gespraech.laeuft ? "läuft gerade" : `von ${uhr(l.gespraech.beginn)} Uhr`}.` : "Gespeichert mit deinem Namen und der Uhrzeit."}
          </small>
          <div className="ak-tun">
            <button type="button" className="pi-knopf" disabled={!bestaetigt || laeuft === "eintragen"}
                    onClick={() => void tun("eintragen", `/agent/kunden/${personId}/aras/ja/eintragen`, { bestaetigt: true }, "Ja zum Anruf eingetragen", () => setDialog(false))}>
              {laeuft === "eintragen" ? "Speichert …" : "Eintragen"}</button>
            <button type="button" className="pi-knopf still" onClick={() => { setDialog(false); setFehler(null); }}>Abbrechen</button>
          </div>
        </div>
      )}

      {l.gueltig && (
        rueckfrage ? (
          <div className="ak-tun">
            <span className="ak-still">Wirklich widerrufen? Dann ruft FIAON ihn ohne neues Ja nicht mehr an.</span>
            <button type="button" className="pi-knopf klein still" disabled={laeuft === "widerruf"}
                    onClick={() => void tun("widerruf", `/agent/kunden/${personId}/aras/ja/widerrufen`, {}, "Ja widerrufen", () => setRueckfrage(false))}>
              {laeuft === "widerruf" ? "Widerruft …" : "Ja, widerrufen"}</button>
            <button type="button" className="pi-link" onClick={() => setRueckfrage(false)}>Abbrechen</button>
          </div>
        ) : (
          <div className="ak-tun">
            <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={() => { setRueckfrage(true); setFehler(null); }}>Ja widerrufen</button>
          </div>
        )
      )}

      {fehler && <p className="ak-grund" data-fiaon="aras-ja-fehler">{fehler}</p>}
    </div>
  );
}
