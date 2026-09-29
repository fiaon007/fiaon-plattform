// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP-BREMSE IM CHEFBÜRO (29.09.2026, E-261)
//
// Am 28.09. scheiterten 89 Vorlagen mit „(#131042) Business eligibility payment
// issue" — Meta konnte nicht abbuchen, und niemand hielt an. Seit E-261 pausiert
// WhatsApp von selbst (zwei gleiche Kontofehler in 60 Minuten, eine Kontosperre
// sofort), und die Meta-Qualität bremst: GELB halbiert, ROT stoppt Werbung.
//
// Zwei Stellen, keine neue Seite (Muster KI-Pause E-246, ChefKiPause.tsx):
//   · WaPauseBand — rotes Band oben auf JEDER /chef-Seite, nur solange WhatsApp
//     pausiert ist. Mit „WhatsApp wieder aktivieren" (nur Inhaber).
//   · WaPauseKarte — im Mara-Steuerpult (/chef/s/mara) als Chip „WhatsApp" im
//     Kopf, der Inhalt klappt darunter auf: Zustand, Meta-Qualität, Kontofehler
//     der letzten 24 Stunden, Verlauf, „WhatsApp wieder aktivieren" /
//     „WhatsApp jetzt pausieren" / „Meta-Stand jetzt prüfen".
// Aktivieren und Pausieren darf nur die Stufe Inhaber (der Server prüft es).
// Die Regeln stehen in server/lib/fiaon-wa-bremse.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { API } from "./chef-teile";

interface Ereignis { am: string; was: "pausiert" | "aktiviert" | "probe_gescheitert"; von: string; grund: string | null }
export interface WaPauseZustand {
  an: boolean; art: "zahlung" | "gesperrt" | "zugang" | "spam" | "hand" | null; code: number | null; grund: string | null; fehler: string | null;
  link: string | null; quelle: string | null; nurLokal?: boolean; seit: string | null; von: string | null;
  aufgehobenAm: string | null; aufgehobenVon: string | null; verlauf: Ereignis[];
}
interface MetaStand {
  qualitaet: string | null; stufe: string | null; name: string | null; am: string | null; quelle: string | null;
  gesundheit: { kann: string | null; text: string | null } | null;
  verlauf: { am: string; von: string | null; zu: string | null }[];
}
interface Bremse { qualitaet: string | null; faktor: number; satz: string | null; werbungGestoppt: boolean; allesGestoppt: boolean }
interface Kontofehler { code: number; art: string; satz: string; anzahl: number; zuletzt: string | null }

const WA_PAUSE_NEU = "fiaon-wa-pause-neu";
const zeit = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const WAS: Record<Ereignis["was"], string> = { pausiert: "pausiert", aktiviert: "wieder aktiviert", probe_gescheitert: "Aktivieren abgelehnt (Probe bei Meta)" };
const QUALITAET: Record<string, string> = { GREEN: "GRÜN", YELLOW: "GELB", RED: "ROT", UNKNOWN: "noch ohne Bewertung" };

/** Den Zustand lesen — beim Öffnen, jede Minute und wenn das Fenster wieder nach vorn kommt. */
export function useWaPause() {
  const [zustand, setZustand] = useState<WaPauseZustand | null>(null);
  const [stand, setStand] = useState<MetaStand | null>(null);
  const [bremse, setBremse] = useState<Bremse | null>(null);
  const [kontofehler, setKontofehler] = useState<Kontofehler[]>([]);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`${API}/chef/wa-pause`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setZustand(j.zustand); setStand(j.stand ?? null); setBremse(j.bremse ?? null);
        setKontofehler(Array.isArray(j.kontofehler) ? j.kontofehler : []);
      }
    } catch { /* ohne Netz bleibt der letzte Stand */ }
  }, []);
  useEffect(() => {
    void laden();
    const uhr = window.setInterval(() => void laden(), 60_000);
    const vorn = () => { if (document.visibilityState === "visible") void laden(); };
    const neu = () => void laden();
    document.addEventListener("visibilitychange", vorn);
    // Band, Chip und Karte lesen getrennt — ein Klick in der einen Stelle frischt die anderen sofort auf.
    window.addEventListener(WA_PAUSE_NEU, neu);
    return () => { window.clearInterval(uhr); document.removeEventListener("visibilitychange", vorn); window.removeEventListener(WA_PAUSE_NEU, neu); };
  }, [laden]);
  return { zustand, stand, bremse, kontofehler, laden };
}

async function senden(pfad: string, body: unknown = {}): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  try { window.dispatchEvent(new Event(WA_PAUSE_NEU)); } catch { /* nur Anzeige */ }
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

function wasTun(z: WaPauseZustand): string {
  if (z.art === "hand") return "Von Hand angehalten.";
  if (z.art === "gesperrt") return "Im Business-Manager → WhatsApp-Manager den Kontostatus klären, dann hier aktivieren.";
  // Gegenprüfung 29.09.: #190 ist keine Kontosperre — der Token ist abgelaufen.
  if (z.art === "zugang") return "Im Business-Manager → Systemnutzer einen neuen Token erzeugen und in Render als META_SYSTEM_TOKEN eintragen; nach dem Neustart hier aktivieren (vorher prüft das System, ob Meta den Token annimmt).";
  if (z.art === "spam") return "Im Business-Manager → WhatsApp-Manager → Kontoqualität nachsehen, dann hier aktivieren.";
  return "Business-Manager → Abrechnung und Zahlungen → Zahlungsmethode des WhatsApp-Kontos, dann hier aktivieren.";
}

/** Der Knopf „WhatsApp wieder aktivieren" mit Rückfrage — für Band und Karte derselbe. */
function AktivierenKnopf({ onFertig, klasse = "kip-knopf" }: { onFertig: (meldung: string, fehler?: boolean) => void; klasse?: string }) {
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const los = async () => {
    setLaeuft(true);
    try {
      const j = await senden("/chef/wa-pause/aktivieren");
      onFertig(j.hinweis || "WhatsApp wieder aktiv. Wer heute eine Vorlage bekommen hätte, kommt von selbst wieder dran.");
    } catch (e: any) {
      onFertig(e.message, true);
    } finally { setLaeuft(false); setFrage(false); }
  };
  if (!frage) return <button type="button" className={klasse} onClick={() => setFrage(true)}>WhatsApp wieder aktivieren</button>;
  return (
    <span className="kip-frage wap-frage" role="group" aria-label="Rückfrage">
      <span>Bei Meta geklärt? Vorher fragt das System Metas Kontostand ab (keine Nachricht).</span>
      <button type="button" className={klasse} disabled={laeuft} onClick={() => void los()}>{laeuft ? "Prüfe …" : "Ja, aktivieren"}</button>
      <button type="button" className={`${klasse} still`} disabled={laeuft} onClick={() => setFrage(false)}>Abbrechen</button>
    </span>
  );
}

/** Das Band im Kopf jeder Chefbüro-Seite — nur solange WhatsApp pausiert ist. */
export function WaPauseBand({ inhaber }: { inhaber: boolean }) {
  const { zustand, laden } = useWaPause();
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  if (!zustand?.an && !meldung) return null;
  if (!zustand?.an && meldung) {
    return (
      <div className="kip-band ok" role="status">
        <p>{meldung.text}</p>
        <button type="button" className="kip-knopf still" onClick={() => setMeldung(null)}>Schließen</button>
      </div>
    );
  }
  const z = zustand!;
  return (
    <div className="kip-band wap-band" role="alert">
      <div className="kip-band-text">
        <b>WhatsApp pausiert seit {zeit(z.seit)}{z.code ? ` (#${z.code})` : ""}</b>
        <p>
          {z.grund || "Meta meldet einen Kontofehler."} {wasTun(z)}
          {z.nurLokal ? " Nur auf diesem Server pausiert (kein Produktionsdienst) — nichts gespeichert." : ""}
          {" "}Nichts geht als Ersatz an Kunden.
        </p>
        {z.link && <p className="kip-leise">Metas Link: <a href={z.link} target="_blank" rel="noreferrer noopener">{z.link}</a></p>}
        {meldung && <p className={meldung.fehler ? "kip-fehler" : "kip-leise"}>{meldung.text}</p>}
      </div>
      {inhaber
        ? <AktivierenKnopf onFertig={(t, f) => { setMeldung({ text: t, fehler: !!f }); void laden(); }} />
        : <span className="kip-leise">Aktivieren kann nur der Inhaber.</span>}
    </div>
  );
}

/**
 * Chip und Aufklapper im Mara-Steuerpult (Muster KiPauseKarte, E-252):
 *   · `alsChip`      — nur der Chip „WhatsApp aktiv" / „WhatsApp pausiert" / „Meta ROT" / „Meta GELB";
 *   · `imAufklapper` — der Inhalt: Zustand, Meta-Stand, Kontofehler, Knöpfe, Verlauf.
 */
export function WaPauseKarte({ alsChip = false, offen = false, onUmschalten }: {
  alsChip?: boolean; imAufklapper?: boolean; offen?: boolean; onUmschalten?: () => void;
} = {}) {
  const { zustand, stand, bremse, kontofehler, laden } = useWaPause();
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const q = String(bremse?.qualitaet ?? stand?.qualitaet ?? "").toUpperCase();
  if (alsChip) {
    const an = !!zustand?.an;
    const text = !zustand ? "WhatsApp" : an ? "WhatsApp pausiert" : q === "RED" ? "WhatsApp: Meta ROT" : q === "YELLOW" ? "WhatsApp: Meta GELB" : "WhatsApp aktiv";
    const art = !zustand ? "" : an || q === "RED" ? " krit" : q === "YELLOW" ? " warn" : " gut";
    return (
      <button type="button" className={`mara-chip${an || q === "RED" ? " krit" : q === "YELLOW" ? " warn" : ""}`} aria-expanded={offen} aria-controls="mara-p-wa"
        onClick={onUmschalten} title={zustand ? undefined : "Der WhatsApp-Zustand lädt …"}>
        <span className={`mara-punkt${art}`} aria-hidden="true" />
        {text}
      </button>
    );
  }
  if (!zustand) return <section id="mara-p-wa" className="mara-aufklapper" aria-label="WhatsApp-Zustand"><p className="mara-still">Der WhatsApp-Zustand lädt …</p></section>;
  const pausieren = async () => {
    if (!window.confirm("Alle WhatsApp-Vorlagen jetzt anhalten? Zentrale, Automatik, Begrüßung, Lead-Kette, Verkaufstakt, Telefonkartei, Akte und Raum schicken dann keine Vorlage, bis du wieder aktivierst. Maras Antworten im offenen Fenster laufen weiter.")) return;
    setLaeuft(true);
    try {
      await senden("/chef/wa-pause/pausieren", { grund: "Von Hand im Chefbüro angehalten." });
      setMeldung({ text: "WhatsApp pausiert. Keine Vorlage geht raus; Antworten im offenen Fenster schon.", fehler: false });
    } catch (e: any) { setMeldung({ text: e.message, fehler: true }); } finally { setLaeuft(false); void laden(); }
  };
  const pruefen = async () => {
    setLaeuft(true);
    try {
      const j = await senden("/chef/wa-meta-stand/pruefen");
      const qText = QUALITAET[String(j.stand?.qualitaet ?? "")] ?? j.stand?.qualitaet ?? "unbekannt";
      // Gegenprüfung 29.09.: Nur „frisch gelesen" sagen, wenn Meta wirklich geantwortet hat — sonst den alten Stand beim Namen nennen.
      setMeldung(j.frisch
        ? { text: `Meta-Stand frisch gelesen: Qualität ${qText}.`, fehler: false }
        : { text: `Meta nicht erreichbar — gezeigt wird der Stand von ${zeit(j.stand?.am ?? null)} (Qualität ${qText}).`, fehler: true });
    } catch (e: any) { setMeldung({ text: e.message, fehler: true }); } finally { setLaeuft(false); void laden(); }
  };
  const kopf = zustand.an
    ? `WhatsApp pausiert seit ${zeit(zustand.seit)}${zustand.code ? ` (#${zustand.code})` : ""}`
    : q === "RED" ? "WhatsApp aktiv — Meta ROT: Werbe-Vorlagen gestoppt"
      : q === "YELLOW" ? "WhatsApp aktiv — Meta GELB: Automatik halbiert" : "WhatsApp aktiv";
  const satz = zustand.an
    ? `${zustand.grund ?? ""} ${wasTun(zustand)}`
    : bremse?.satz ?? "Kann Meta nicht abbuchen oder sperrt das Konto, pausiert WhatsApp von selbst — und du bekommst genau eine Aufgabe.";
  return (
    <section id="mara-p-wa" className={`mara-aufklapper mara-wa${zustand.an || q === "RED" ? " aus" : q === "YELLOW" ? " warn" : ""}`} aria-label="WhatsApp-Zustand">
      <div className="mara-kopfzeile">
        <div>
          <h2>{kopf}</h2>
          <p className="mara-leise mara-satz">{satz}</p>
        </div>
        <div className="mara-wa-knoepfe">
          {zustand.an
            ? <AktivierenKnopf klasse="mara-knopf" onFertig={(t, f) => { setMeldung({ text: t, fehler: !!f }); void laden(); }} />
            : <button type="button" className="mara-knopf" disabled={laeuft} onClick={() => void pausieren()}>{laeuft ? "…" : "WhatsApp jetzt pausieren"}</button>}
          <button type="button" className="mara-knopf text" disabled={laeuft} onClick={() => void pruefen()}>Meta-Stand jetzt prüfen</button>
        </div>
      </div>
      {meldung && (
        <p className={`mara-meldung${meldung.fehler ? " fehler" : ""}`} role={meldung.fehler ? "alert" : "status"}>
          <span>{meldung.text}</span>
          <button type="button" className="mara-knopf text" onClick={() => setMeldung(null)}>Schließen</button>
        </p>
      )}
      <dl className="mara-wa-zahlen">
        <div><dt>Meta-Qualität</dt><dd>{QUALITAET[q] ?? (q || "unbekannt")}</dd></div>
        <div><dt>Stufe</dt><dd>{stand?.stufe ?? "—"}</dd></div>
        <div><dt>Kontostand bei Meta</dt><dd>{stand?.gesundheit?.kann ?? "nicht gelesen"}</dd></div>
        <div><dt>Gelesen</dt><dd>{zeit(stand?.am ?? null)}</dd></div>
      </dl>
      <p className="mara-still mara-klein">
        Regel: GELB halbiert Automatik, Lead-Kette, Verkaufstakt und Hand-Lauf · ROT stoppt Werbe-Vorlagen an bestehende Kontakte auf allen
        Wegen; die Zentrale schickt dann nur die Monatsrate — die Begrüßung frischer Leads (≤ 24 h), einzelne Termin-Nachrichten (Akte, Raum) und Antworten laufen weiter ·
        Kontofehler: zwei gleiche (#131042 Zahlung, #131048 Spam) in 60 Minuten, eine Kontosperre oder ein abgelaufener Zugang (#190) → Pause.
      </p>
      {kontofehler.length > 0 && (
        <details className="mara-klappe">
          <summary>Fehler von Meta in 24 Stunden ({kontofehler.reduce((s, k) => s + k.anzahl, 0)})</summary>
          <ol className="mara-liste mara-klein">
            {kontofehler.map((k) => (
              <li key={k.code}>#{k.code} · {k.satz} · {k.anzahl}× {k.zuletzt ? <span className="mara-still">(zuletzt {zeit(k.zuletzt)})</span> : null}</li>
            ))}
          </ol>
        </details>
      )}
      {zustand.verlauf.length > 0 && (
        <details className="mara-klappe" open={zustand.an}>
          <summary>Verlauf ({zustand.verlauf.length})</summary>
          <ol className="mara-liste mara-klein">
            {zustand.verlauf.slice(0, 10).map((v, i) => (
              <li key={`${v.am}-${i}`}><time className="mara-still">{zeit(v.am)}</time> · {WAS[v.was] ?? v.was} · {v.von}{v.grund ? ` — ${v.grund}` : ""}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
