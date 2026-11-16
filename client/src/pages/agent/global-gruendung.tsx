// ═══════════════════════════════════════════════════════════════════════════
// /agent/global/:ref › REITER „GRÜNDUNG BESTELLEN“ (E-520, 17.11.2026)
//
// Justin: „Northwest-Bestellung am Zahlungstag automatisch als Aufgabe — überlege dir
// dafür was, sodass es ein Mitarbeiter auch wirklich umsetzen kann.“
//
// Der Auftrag „Gründung bestellen“ (Mail „Neuer Auftrag für dich“) führt genau hierher.
// Die Seite zeigt die Bestellung beim Registered Agent Schritt für Schritt — jedes Feld
// mit seinem Wert und einem Kopieren-Knopf (eine Quelle: shared/fiaon-global-
// arbeitsablauf.ts, dieselbe wie im Chefbüro). Fertig ist man erst mit der
// Bestellnummer: Sie setzt die Station „Gründung eingereicht“, schließt den Auftrag und
// löscht die Ampel. Ohne Nummer bleibt der Auftrag offen — und meldet sich am nächsten
// Werktag um 10 Uhr bei der Leitung.
//
// Der Mitarbeiter wird geduzt; ganz einfache Sätze.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Info } from "lucide-react";
import { api } from "./shared";
import { useToast } from "@/lib/fiaon-ui";
import { ABLAUF_LEERSTELLE } from "@shared/fiaon-global-arbeitsablauf";
import { GRUENDUNG_HAKEN, gruendungBestellnummer, type GruendungSchrittSicht } from "@shared/fiaon-global-gruendung-auftrag";

interface Sicht {
  faellig: boolean; bezahltAm: string | null; fastTrack: boolean; gesellschaft: string; bundesstaat: string;
  eingereichtAm: string | null; bestellnummer: string | null;
  auftrag: { id: number; offen: boolean; bei: string | null } | null;
  schritte: GruendungSchrittSicht[]; fehlend: string[];
  haken: Record<string, { am: string; von: string }>;
}

const tag = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
};

export default function GlobalGruendung({ basis, sichtbar, onStand, frisch }: {
  basis: string; sichtbar: boolean; onStand: (offen: boolean) => void; frisch: () => void;
}) {
  const { zeige } = useToast();
  const [sicht, setSicht] = useState<Sicht | null>(null);
  const [fehler, setFehler] = useState("");
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [nummer, setNummer] = useState("");
  const [laeuft, setLaeuft] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const r = await api(`${basis}/gruendung`);
      if (r.ok && r.json?.gruendung) { setSicht(r.json.gruendung as Sicht); setFehler(""); onStand(!!r.json.gruendung.faellig); return; }
      setFehler(String(r.json?.error || "Die Anleitung ließ sich nicht laden."));
    } catch { setFehler("Keine Verbindung zum Server."); }
  }, [basis]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void laden(); }, [laden]);

  const kopieren = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setKopiert(id); window.setTimeout(() => setKopiert((k) => (k === id ? null : k)), 1600); }
    catch { zeige("fehler", "Nicht kopiert", "Bitte den Wert von Hand markieren und kopieren."); }
  };

  const haken = async (schritt: string, erledigt: boolean) => {
    setLaeuft(schritt);
    try {
      const r = await api(`${basis}/gruendung/haken`, { method: "POST", body: JSON.stringify({ schritt, erledigt }) });
      if (!r.ok) zeige("fehler", "Nicht gespeichert", String(r.json?.error || "Bitte noch einmal."));
      await laden();
    } finally { setLaeuft(null); }
  };

  const nummerGut = gruendungBestellnummer(nummer);
  const bestellt = async () => {
    if (!nummerGut) return;
    setLaeuft("bestellt");
    try {
      const r = await api(`${basis}/gruendung/bestellt`, { method: "POST", body: JSON.stringify({ bestellnummer: nummerGut }) });
      if (!r.ok) { zeige("fehler", "Nicht gespeichert", String(r.json?.error || "Bitte noch einmal.")); return; }
      zeige("erfolg", "Bestellung eingetragen", String(r.json?.meldung || "Der Auftrag ist erledigt."));
      setNummer("");
      // Der Server schickt den neuen Stand gleich mit — die Seite zeigt ihn, ohne noch einmal zu fragen.
      if (r.json?.gruendung) { setSicht(r.json.gruendung as Sicht); onStand(false); } else await laden();
      frisch();
    } catch { zeige("fehler", "Nicht gespeichert", "Keine Verbindung zum Server. Es wurde nichts gespeichert."); }
    finally { setLaeuft(null); }
  };

  if (!sichtbar) return null;
  if (fehler && !sicht) return <div className="gl-ab"><h2>Gründung bestellen</h2><p className="gl-leise warn">{fehler}</p></div>;
  if (!sicht) return <div className="gl-ab"><h2>Gründung bestellen</h2><p className="gl-leise">Lade die Anleitung …</p></div>;

  const fertig = !!sicht.eingereichtAm;
  return (
    <div className="gl-ab gl-gr" data-fiaon="global-gruendung">
      <h2>Gründung bestellen</h2>

      {/* ── Wo wir stehen: ein Satz ─────────────────────────────────────────── */}
      {fertig ? (
        <p className="gl-gr-stand gruen"><Check size={15} aria-hidden="true" />
          <span>Bestellt und eingereicht am {tag(sicht.eingereichtAm)}{sicht.bestellnummer ? ` · Bestellnummer ${sicht.bestellnummer}` : ""}. Hier ist nichts mehr zu tun.</span></p>
      ) : !sicht.bezahltAm ? (
        <p className="gl-gr-stand"><Info size={15} aria-hidden="true" />
          <span>Noch nicht bezahlt. Bestellt wird erst nach dem Zahlungseingang — dann bekommst du den Auftrag von selbst.</span></p>
      ) : (
        <p className="gl-gr-stand blau"><Info size={15} aria-hidden="true" />
          <span>Bezahlt am {tag(sicht.bezahltAm)} — bitte <b>heute</b> bestellen. Dauer: etwa 10 Minuten.
            {sicht.fastTrack ? " Fast-Track ist gebucht: Diese Bestellung hat Vorrang." : ""}</span></p>
      )}

      {!fertig && sicht.fehlend.length > 0 && (
        <ul className="gl-wand" role="status">
          <li><b>Es fehlt noch etwas für die Bestellung:</b></li>
          {sicht.fehlend.map((k) => <li key={k}>{ABLAUF_LEERSTELLE[k] ?? k}</li>)}
          <li>Bestell trotzdem, was geht — und schreib das Fehlende als Frage in deinen Auftrag.</li>
        </ul>
      )}

      {/* ── Die Schritte: jedes Feld mit Wert und Kopieren-Knopf ─────────────── */}
      <ol className="gl-gr-schritte">
        {sicht.schritte.map((s) => {
          const vonHand = (GRUENDUNG_HAKEN as readonly string[]).includes(s.key);
          const ab = !!sicht.haken[s.key] || fertig;
          return (
            <li key={s.key} className={`gl-gr-schritt${ab ? " ab" : ""}`}>
              <div className="gl-gr-kopf">
                <span className="gl-gr-nr" aria-hidden="true">{ab ? <Check size={14} /> : s.nr}</span>
                <h3>{s.titel}</h3>
                {vonHand && !fertig && (
                  <label className="gl-gr-haken">
                    <input type="checkbox" checked={!!sicht.haken[s.key]} disabled={laeuft === s.key} onChange={(e) => void haken(s.key, e.target.checked)} />
                    <span>erledigt</span>
                  </label>
                )}
              </div>
              <p className="gl-gr-text">{s.text}</p>
              {s.felder.length > 0 && (
                <dl className="gl-gr-felder">
                  {s.felder.map((f, i) => {
                    const id = `${s.key}:${i}`;
                    return (
                      <div key={id} className={f.fehlt ? "fehlt" : ""}>
                        <dt>{f.feld}</dt>
                        <dd>
                          <span className="gl-gr-wert">{f.wert}</span>
                          {f.kopieren && (
                            <button type="button" className="gl-gr-kopie" onClick={() => void kopieren(id, f.wert)} aria-label={`${f.feld} kopieren`}>
                              {kopiert === id ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}<span>{kopiert === id ? "Kopiert" : "Kopieren"}</span>
                            </button>
                          )}
                          {f.hinweis && <em>{f.hinweis}</em>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              {s.hinweise.map((h, i) => (
                <p key={i} className={`gl-gr-hinweis ${h.ton}`}>{h.ton === "warnung" ? <AlertTriangle size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}<span>{h.text}</span></p>
              ))}
              {s.links.length > 0 && (
                <p className="gl-gr-links">
                  {s.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.titel}<ExternalLink size={12} aria-hidden="true" /></a>)}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* ── Der Beleg: ohne Bestellnummer ist der Auftrag nicht erledigt ─────── */}
      {!fertig && sicht.bezahltAm && (
        <div className="gl-gr-beleg">
          <h3>Fertig? Dann die Bestellnummer eintragen</h3>
          <p className="gl-leise">Sie steht in der Bestätigung des Registered Agent (Mail und im Konto unter „Orders“). Mit der Nummer ist dein Auftrag erledigt, und der Kunde sieht „Gründung eingereicht“ in seinem Portal.</p>
          <div className="gl-gr-zeile">
            <label className="gl-feld">Bestellnummer
              <input type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" maxLength={20} value={nummer}
                     onChange={(e) => setNummer(e.target.value)} placeholder="z. B. AB12C3D4" />
            </label>
            <button type="button" className="pi-knopf" disabled={!nummerGut || laeuft === "bestellt"} onClick={() => void bestellt()}>
              {laeuft === "bestellt" ? "Speichere …" : "Bestellt — Auftrag abschließen"}
            </button>
          </div>
          {nummer.trim() !== "" && !nummerGut && <p className="gl-leise warn">So sieht keine Bestellnummer aus: Buchstaben und Ziffern, 5 bis 14 Zeichen.</p>}
          <p className="gl-leise">Kommst du nicht weiter (Zugang, Name vergeben, ein Wert fehlt)? Schreib es als Frage in deinen Auftrag unter „Aufgaben“ — nicht liegen lassen. Am nächsten Werktag um 10 Uhr fragt das System sonst bei der Leitung nach.</p>
        </div>
      )}
    </div>
  );
}
