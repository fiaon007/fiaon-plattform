// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO › Kopfzeile: „Automatisch posten" (15.10.2026, E-380)
//
// Eine Zeile: Läuft die Automatik, was geht als Nächstes raus, gab es Fehler —
// und der Not-Aus. Ohne Posting-Rechte bei Meta nur ein ruhiger Satz (keine
// Anleitung, kein Auftrag an Justin). Daten: GET/POST /chef/social/automatik.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { API, useDaten } from "../chef-teile";
import type { MetaAutomatikStand } from "@shared/fiaon-social-meta";

const zeit = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
};
const KURZ: Record<string, string> = { instagram: "IG", facebook: "FB" };

export default function SocialAutomatik({ onOeffnen }: { onOeffnen: (id: number) => void }) {
  const d = useDaten<MetaAutomatikStand>("/chef/social/automatik");
  const [stand, setStand] = useState<MetaAutomatikStand | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const s = stand ?? d.daten;
  if (!s) return null;

  const rechte = s.rechte.instagram || s.rechte.facebook;
  const schalten = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`${API}/chef/social/automatik`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ an: !s.postenAn }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setStand(j as MetaAutomatikStand);
      else setFehler(j?.error || "Das hat nicht geklappt — bitte noch einmal.");
    } catch { setFehler("Keine Verbindung zum Server — bitte noch einmal."); }
    finally { setLaeuft(false); }
  };

  if (!rechte) {
    return (
      <div className="so-auto" role="status">
        <span className="mara-punkt" aria-hidden="true" />
        <span>Automatisches Posten startet, sobald Meta das Posten erlaubt.</span>
      </div>
    );
  }

  const fehlerZeile = s.letzteFehler[0];
  return (
    <div className="so-auto" role="status">
      <span className={`mara-punkt ${s.postenAn ? "gut" : "warn"}`} aria-hidden="true" />
      <span className="so-auto-text">
        {s.postenAn ? "Automatisch posten" : "Automatisch posten angehalten"}
        {s.postenAn && (s.naechster
          ? <> · nächster: <button type="button" className="mara-knopf text so-auto-link" onClick={() => onOeffnen(s.naechster!.id)}>{s.naechster.titel || `Post ${s.naechster.id}`}</button>
              {" "}<span className="so-auto-zeit">{zeit(s.naechster.plan_zeitpunkt)}</span>
              {" "}{s.naechster.kanaele.map((k) => <span key={k} className="so-kanal" data-k={k}>{KURZ[k] ?? k}</span>)}</>
          : <> · nichts Freigegebenes eingeplant</>)}
        {s.postenAn && s.naechsterTon ? <> · <span className="so-auto-ton" data-ton={s.naechsterTon}>{s.naechsterTon}</span>{s.letzterTon ? <> nach {s.letzterTon}</> : null}</> : null}
        {s.heuteGepostet > 0 && <> · heute {s.heuteGepostet} online</>}
      </span>
      {fehlerZeile && (
        <button type="button" className="mara-pille warn so-auto-fehler" onClick={() => onOeffnen(fehlerZeile.post_id)} title={fehlerZeile.fehler}>
          {KURZ[fehlerZeile.kanal] ?? fehlerZeile.kanal}: {fehlerZeile.fehler.slice(0, 70)}{fehlerZeile.fehler.length > 70 ? "…" : ""}
        </button>
      )}
      <button type="button" className={`mara-knopf klein${s.postenAn ? "" : " an"}`} onClick={schalten} disabled={laeuft}
        title={s.postenAn ? "Hält das automatische Posten sofort an." : "Postet wieder automatisch — ab jetzt, ohne Nachholen."}>
        {laeuft ? "…" : s.postenAn ? "Anhalten" : "Wieder einschalten"}
      </button>
      {fehler && <span className="so-auto-meldung">{fehler}</span>}
    </div>
  );
}
