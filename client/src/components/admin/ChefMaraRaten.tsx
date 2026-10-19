// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara?reiter=mail — RATEN: FRISCH FÄLLIG (19.10.2026, E-406 B1)
//
// Justin (Vorschlag 3 „Mara führt den Betrieb“): „Mara erinnert freundlich und bietet einen Termin an.“ An Tag 1–3
// nach der Fälligkeit schickt Mara EINE persönliche Mail je Rate — zahlen, kurz antworten oder Rückruf wählen.
// Hier: ein Schalter (Standard an) und die Wirkung als Zahl — angeschrieben, danach bezahlt (heute, 7 Tage, je Tag).
// Keine neue Seite (Hausregel „Keine neuen Chef-Seiten“), wenig Text (Justin 12.10.): Details im (i).
// Server: GET/POST /chef/mara/raten-erinnerung (server/routes/fiaon-mara-steuerpult.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { API, eur, zahl, useDaten } from "./chef-teile";
import { useMeldung, Meldung, InfoKnopf } from "./mara-lage";

type Stand = {
  ok: true; an: boolean; eingerichtet: boolean;
  heute: { angeschrieben: number; bezahlt: number };
  woche: { angeschrieben: number; bezahlt: number; bezahltCents: number; termine: number; ausgelassen: number; erledigt: number; fehlgeschlagen: number };
  tage: { tag: string; angeschrieben: number; bezahlt: number }[];
  wartet: number; naechste: string | null;
  gruende: { grund: string; n: number }[];
  hoechstensKontakte: number;
};

async function post(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt — bitte noch einmal.");
  return j;
}

/** „19.10.“ aus JJJJ-MM-TT. */
const tagKurz = (iso: string) => { const [, m, t] = iso.split("-"); return `${t}.${m}.`; };

export default function MaraRatenErinnerung() {
  const d = useDaten<Stand>("/chef/mara/raten-erinnerung");
  const [stand, setStand] = useState<Stand | null>(null);
  const [busy, setBusy] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);
  const { meldung, melden, zu } = useMeldung();
  const s = stand ?? d.daten;

  const umschalten = async () => {
    if (!s) return;
    setBusy(true);
    try {
      const j = (await post("/chef/mara/raten-erinnerung", { an: !s.an })) as Stand;
      setStand(j);
      melden(j.an ? "An — Mara schreibt frisch fälligen Raten an Tag 1–3 persönlich."
        : "Aus — Mara schreibt nicht. Rechnung und Mahnungen laufen wie immer.", "raten");
    } catch (e: any) { melden(e.message, "raten", true); } finally { setBusy(false); }
  };

  return (
    <section className="mr-raten" aria-label="Raten: frisch fällig">
      <div className="mara-status mr-status">
        <div className="st voll">
          <button type="button" className={`mara-schalter mr-schalter${s?.an ? " an" : ""}`} data-mara-schalter="raten"
            aria-pressed={!!s?.an} disabled={busy || !s} onClick={() => void umschalten()}>
            <span className="bahn" aria-hidden="true" />
            <span>{!s ? "Raten: frisch fällig …" : s.an ? "Frisch fällige Raten: Mara schreibt persönlich" : "Frisch fällige Raten: Mara schreibt nicht"}</span>
          </button>
          <InfoKnopf offen={infoOffen} onClick={() => setInfoOffen((x) => !x)} label="Was Mara bei frisch fälligen Raten tut" />
        </div>
        {s ? (
          <div className="st mr-st-text">
            <div className="st-text">
              <div>Heute {zahl(s.heute.angeschrieben)} angeschrieben · {zahl(s.heute.bezahlt)} danach bezahlt</div>
              <small>{s.wartet ? `${zahl(s.wartet)} warten${s.naechste ? ` · nächste ${s.naechste}` : ""}` : "niemand wartet"}</small>
            </div>
          </div>
        ) : d.fehler ? (
          <div className="st mr-st-text"><div className="st-text"><small>{d.fehler}</small></div></div>
        ) : null}
      </div>

      {s && (
        <div className="mara-kette mr-kette" aria-label="Wirkung 7 Tage"
          title="Bezahlt: genau diese Rate ist gebucht, Eingangstag nach dem Tag von Maras Mail (höchstens 14 Tage) — zeitliche Folge, kein Beweis.">
          <span className="mara-etikett">7 Tage</span>
          {s.woche.angeschrieben ? <span><b>{zahl(s.woche.angeschrieben)}</b>angeschrieben</span> : <span>noch niemand angeschrieben</span>}
          <span className="pfeil" aria-hidden="true">→</span>
          {s.woche.bezahlt
            ? <span><b className="akz">{zahl(s.woche.bezahlt)}</b>bezahlt · {eur(s.woche.bezahltCents)}</span>
            : <span>noch nichts bezahlt</span>}
          {s.woche.termine > 0 && <span className="mara-still mara-klein">{zahl(s.woche.termine)} Rückruf{s.woche.termine === 1 ? "" : "e"} gewählt</span>}
        </div>
      )}
      {s && s.tage.length > 0 && (
        <p className="mara-still mara-klein mr-tage">
          Je Tag: {s.tage.map((t) => `${tagKurz(t.tag)} ${zahl(t.angeschrieben)} → ${zahl(t.bezahlt)}`).join(" · ")}
        </p>
      )}

      {infoOffen && (
        <div className="mara-info">
          <p>
            <b>Tag 1–3 nach der Fälligkeit</b> schreibt Mara EINMAL je Rate, freundlich und ohne Druck: jetzt zahlen, kurz antworten
            (Mail-Mara übernimmt) oder Rückruf-Zeit wählen. Nur 10–18 Uhr, höchstens {s?.hoechstensKontakte ?? 3} Kontakte je Rate
            über alle Wege ab der Fälligkeit (die Vorabinfo zählt nicht), nie am Tag einer Rechnung oder Mahnung. Rechnung,
            Mahnungen und WhatsApp-Zentrale laufen unverändert.
          </p>
          <p>
            Nie bei Vertragsende, Kündigung, Widerruf, Mahnstopp, Ratenpause, Zusage, Termin, Testkonto, FIAON Global oder
            Vertriebssperre. Bei Werbesperre schreibt sie trotzdem — ohne Verkauf.
            {" "}Vorher zahlten von den an Tag 0 noch Offenen bis Tag 7 rund 9 von 100 (gemessen 19.10.).
          </p>
          {s?.gruende.length ? <p>Nicht geschrieben (7 Tage): {s.gruende.map((g) => `${g.grund} (${zahl(g.n)})`).join(" · ")}.</p> : null}
        </div>
      )}
      <Meldung m={meldung} ort="raten" onZu={zu} />
    </section>
  );
}
