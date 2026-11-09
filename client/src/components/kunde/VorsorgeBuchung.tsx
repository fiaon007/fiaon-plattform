// ═══════════════════════════════════════════════════════════════════════════
// „IHR VORSORGE-ÜBERBLICK“ — Themen festhalten und auf Wunsch selbst einen Termin beim Partner buchen (E-487 (09.11.2026))
//
// Ein Baustein für zwei Orte: die Seite des persönlichen Links (/vorsorge/<signiert>, kontext „seite“) und die Karte im
// Kundenbereich (/app › Heute, kontext „karte“). Beide sprechen dieselben Wege an — nur die Grundadresse (`basis`) ist anders:
//   GET  <basis>                 → { lage }
//   POST <basis>/ueberblick      { themen }                                   → { ok, meldung, lage }
//   POST <basis>/buchen          { angebotId, thema, termin, art, einwilligung, bestaetigt } → { ok, meldung, lage }
//   POST <basis>/kein-interesse  → { ok, meldung, lage }     POST <basis>/absagen → { ok, meldung, lage }
//
// Schritte: 1 Thema (FIAON fragt nur das Thema, gespeichert als „Ihr Vorsorge-Überblick“) → 2 auf Wunsch das Gespräch: der
// Partner mit Name und Rolle, Terminart, freie Zeiten aus seinem Partnerbereich → das eigene, NIE vorangekreuzte Kästchen
// zum Wortlaut (shared/fiaon-vorsorge.ts — derselbe Text, den der Server speichert) → „Termin buchen“.
// Ob gebucht werden darf, entscheidet der Server (Sperren, freie Zeiten, Exklusivität); hier steht nur, was er sagt.
// React-Haken stehen alle über dem ersten return (AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { VORSORGE_BESTAETIGEN, VORSORGE_TEXTE, vorsorgeEinwilligungText, type VorsorgeLage } from "@shared/fiaon-vorsorge";
import { koopPartnerImSatz } from "@shared/fiaon-koop-lieferung";
import "@/styles/vorsorge.css";

async function senden(pfad: string, body: unknown): Promise<{ ok: boolean; json: any }> {
  const r = await fetch(`/api/fiaon${pfad}`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
  }).catch(() => null);
  const json = r ? await r.json().catch(() => null) : null;
  return { ok: !!r?.ok && json?.ok === true, json };
}

/** Knopf-Beschriftung mit großem Anfangsbuchstaben („vor Ort“ → „Vor Ort“); im Fließtext bleibt der Wortlaut klein. */
const grossAnfang = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const tagKurz = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", timeZone: "Europe/Berlin" });
const tagDatum = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const initialen = (name: string) => name.split(/\s+/).filter((w) => w && w !== "Herr" && w !== "Frau").map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join("");
const gleich = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function Haken() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="17.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 20.5l5 5 10-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Meldung = { text: string; gut: boolean; ort: "ueberblick" | "buchen" | "ende" };

export function VorsorgeBuchung({ basis, lage, setLage, kontext, onEnde }: {
  basis: string;
  lage: VorsorgeLage;
  setLage: (l: VorsorgeLage) => void;
  kontext: "seite" | "karte";
  /** Karte: „kein Interesse“ blendet sie aus — der Satz bleibt kurz stehen. */
  onEnde?: (text: string) => void;
}) {
  const [auswahl, setAuswahl] = useState<string[]>(lage.ueberblick.themen);
  const [offen, setOffen] = useState(lage.stand === "gewuenscht");
  const [angebotId, setAngebotId] = useState<number | null>(null);
  const [thema, setThema] = useState("");
  const [art, setArt] = useState("");
  const [tag, setTag] = useState("");
  const [slot, setSlot] = useState("");
  const [ja, setJa] = useState(false);
  const [bestaetigt, setBestaetigt] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);

  const partnerListe = useMemo(() => lage.partner.filter((x) => !x.voll && x.termine.length > 0), [lage.partner]);
  const p = useMemo(() => partnerListe.find((x) => x.angebotId === angebotId) ?? partnerListe[0] ?? null, [partnerListe, angebotId]);
  const tage = useMemo(() => Array.from(new Set((p?.termine ?? []).map((s) => s.tag))), [p]);
  const zeiten = useMemo(() => (p?.termine ?? []).filter((s) => s.tag === tag), [p, tag]);
  const gespeichertSchluessel = `${lage.ueberblick.am ?? ""}|${lage.ueberblick.themen.join("|")}`;

  // Nach dem Speichern (oder einer neuen Lage) zeigt die Auswahl, was der Server hält.
  useEffect(() => { setAuswahl(lage.ueberblick.themen); }, [gespeichertSchluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Neuer Partner: Terminart, Tag und Zeit neu wählen.
  useEffect(() => { setArt(p?.arten[0]?.key ?? ""); setTag(""); setSlot(""); }, [p?.angebotId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Das Thema aus dem Überblick vorschlagen — das Kästchen bleibt leer.
  useEffect(() => {
    if (!p || (thema && p.themen.includes(thema))) return;
    setThema(auswahl.find((t) => p.themen.includes(t) && !lage.belegt[t]) ?? "");
  }, [p?.angebotId, auswahl.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  // Die Einwilligung gilt für genau diesen Wortlaut (Partner + Thema): ändert sich einer, ist das Kästchen wieder leer.
  useEffect(() => { setJa(false); }, [thema, p?.angebotId]);

  const gespeichert = lage.ueberblick.am !== null && gleich(auswahl, lage.ueberblick.themen);
  const nurLesen = lage.vorschau;
  const fehlt: string[] = [];
  if (!thema) fehlt.push("Thema");
  else if (lage.belegt[thema]) fehlt.push("ein anderes Thema");
  if (!art) fehlt.push("Gesprächsart");
  if (!slot) fehlt.push("Termin");
  if (!ja) fehlt.push("Häkchen bei der Einwilligung");
  for (const b of lage.bestaetigen) if (!bestaetigt.includes(b)) fehlt.push(b === "wohnsitz_de" ? "Wohnsitz bestätigen" : "Volljährigkeit bestätigen");
  const bereit = !!p && fehlt.length === 0 && !nurLesen;

  async function speichern() {
    setLaeuft("ueberblick"); setMeldung(null);
    const r = await senden(`${basis}/ueberblick`, { themen: auswahl });
    setLaeuft(null);
    if (r.json?.lage) setLage(r.json.lage);
    setMeldung({ text: r.ok ? (r.json?.meldung ?? VORSORGE_TEXTE.gespeichert) : (r.json?.error ?? VORSORGE_TEXTE.fehler), gut: r.ok, ort: "ueberblick" });
  }
  async function buchen() {
    if (!p || !bereit) return;
    setLaeuft("buchen"); setMeldung(null);
    const r = await senden(`${basis}/buchen`, { angebotId: p.angebotId, thema, termin: slot, art, einwilligung: ja, bestaetigt });
    setLaeuft(null);
    if (r.json?.lage) setLage(r.json.lage);
    if (r.ok) { setOffen(false); setSlot(""); setTag(""); setJa(false); }
    else setSlot("");
    setMeldung({ text: r.ok ? (r.json?.meldung ?? VORSORGE_TEXTE.gebuchtText) : (r.json?.error ?? VORSORGE_TEXTE.fehler), gut: r.ok, ort: r.ok ? "ende" : "buchen" });
  }
  async function keinInteresse() {
    setLaeuft("kein"); setMeldung(null);
    const r = await senden(`${basis}/kein-interesse`, {});
    setLaeuft(null);
    const text = r.ok ? (r.json?.meldung ?? VORSORGE_TEXTE.keinInteresseDanke) : (r.json?.error ?? VORSORGE_TEXTE.fehler);
    if (r.ok && onEnde) { onEnde(text); return; }
    if (r.json?.lage) setLage(r.json.lage);
    setOffen(false);
    setMeldung({ text, gut: r.ok, ort: "ende" });
  }
  async function absagen() {
    setLaeuft("absagen"); setMeldung(null);
    const r = await senden(`${basis}/absagen`, {});
    setLaeuft(null);
    if (r.json?.lage) setLage(r.json.lage);
    setMeldung({ text: r.ok ? (r.json?.meldung ?? VORSORGE_TEXTE.abgesagt) : (r.json?.error ?? VORSORGE_TEXTE.fehler), gut: r.ok, ort: "ende" });
  }

  const hinweis = (ort: Meldung["ort"]) => (meldung?.ort === ort
    ? <p className={`vs-meldung ${meldung.gut ? "gut" : "schlecht"}`} role="status">{meldung.text}</p> : null);

  // ── Gebucht: der Termin und der Weg zurück ────────────────────────────────
  if (lage.stand === "termin" && lage.termin) {
    return (
      <div className={`vs-buchung vs-${kontext}-kontext`} data-vorsorge="gebucht">
        {hinweis("ende")}
        <div className="vs-gebucht">
          <Haken />
          <div>
            <b>{VORSORGE_TEXTE.gebuchtTitel}</b>
            <p>{lage.termin.text} · {lage.termin.art}<br />Thema: {lage.termin.thema}<br />Mit {lage.termin.partner}</p>
          </div>
        </div>
        <button type="button" className="vs-leise" disabled={!!laeuft || nurLesen} onClick={() => void absagen()}>
          {laeuft === "absagen" ? "…" : VORSORGE_TEXTE.absagen}
        </button>
        <p className="vs-fein vs-fiaon">{VORSORGE_TEXTE.fiaonSatz}</p>
      </div>
    );
  }

  return (
    <div className={`vs-buchung vs-${kontext}-kontext`} data-vorsorge="buchung">
      {nurLesen && <p className="vs-vorschau-band">{VORSORGE_TEXTE.vorschau}</p>}
      {hinweis("ende")}

      {/* 1 · Der Überblick — FIAON fragt nur das Thema */}
      <section className="vs-block" data-vorsorge="ueberblick">
        <p className="vs-schritt">1 · {kontext === "karte" ? VORSORGE_TEXTE.schritt1Marke : VORSORGE_TEXTE.titel}</p>
        <h2 className="vs-h2">{VORSORGE_TEXTE.schritt1}</h2>
        <p className="vs-fein">{VORSORGE_TEXTE.schritt1Hinweis}</p>
        <div className="vs-chips" role="group" aria-label={VORSORGE_TEXTE.schritt1}>
          {lage.themen.map((t) => (
            <button key={t} type="button" className={`vs-chip${auswahl.includes(t) ? " an" : ""}`} aria-pressed={auswahl.includes(t)}
              onClick={() => setAuswahl((a) => (a.includes(t) ? a.filter((x) => x !== t) : lage.themen.filter((x) => x === t || a.includes(x))))}>
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="vs-knopf still" disabled={gespeichert || !!laeuft || nurLesen} onClick={() => void speichern()}>
          {laeuft === "ueberblick" ? "Wird gespeichert …" : gespeichert ? "Gespeichert" : VORSORGE_TEXTE.speichern}
        </button>
        {hinweis("ueberblick")}
      </section>

      {/* 2 · Auf Wunsch das Gespräch beim Partner */}
      <section className="vs-block" data-vorsorge="gespraech">
        <p className="vs-schritt">2 · {VORSORGE_TEXTE.schritt2}</p>
        <p className="vs-text">{lage.stand === "gewuenscht" ? VORSORGE_TEXTE.gewuenscht : VORSORGE_TEXTE.schritt2Text}</p>
        {!lage.buchbar || !p ? (
          lage.hinweis ? <p className="vs-hinweis">{lage.hinweis}</p> : null
        ) : !offen ? (
          <button type="button" className="vs-knopf" onClick={() => setOffen(true)}>{VORSORGE_TEXTE.oeffnen}</button>
        ) : (
          <div className="vs-maske">
            {partnerListe.length > 1 && (
              <div className="vs-arten" role="group" aria-label="Partner">
                {partnerListe.map((x) => (
                  <button key={x.angebotId} type="button" className={`vs-pille${x.angebotId === p.angebotId ? " an" : ""}`} onClick={() => setAngebotId(x.angebotId)}>{x.name}</button>
                ))}
              </div>
            )}
            <div className={`vs-partner${kontext === "seite" ? " dunkel" : ""}`} data-vorsorge="partner">
              <span className="vs-partner-zeichen" aria-hidden="true">{initialen(p.name)}</span>
              <div>
                <b className="vs-partner-name">{p.name}</b>
                <span className="vs-partner-rolle">{p.rolle}</span>
                <span className="vs-partner-fein">Kostenlos · {p.dauerMin} Minuten · {p.arten.map((a) => a.text).join(", ")}</span>
              </div>
            </div>

            <div className="vs-feld">
              <p className="vs-frage">{VORSORGE_TEXTE.themaFrage}</p>
              <div className="vs-chips einzeln" role="radiogroup" aria-label={VORSORGE_TEXTE.themaFrage}>
                {p.themen.map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={thema === t} disabled={!!lage.belegt[t]}
                    className={`vs-chip${thema === t ? " an" : ""}`} onClick={() => setThema(t)}>
                    {t}{lage.belegt[t] ? <small>{lage.belegt[t]}</small> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="vs-feld">
              <p className="vs-frage">{VORSORGE_TEXTE.artFrage}</p>
              <div className="vs-arten" role="radiogroup" aria-label={VORSORGE_TEXTE.artFrage}>
                {p.arten.map((a) => (
                  <button key={a.key} type="button" role="radio" aria-checked={art === a.key} className={`vs-pille${art === a.key ? " an" : ""}`} onClick={() => setArt(a.key)}>{grossAnfang(a.text)}</button>
                ))}
              </div>
            </div>

            <div className="vs-feld">
              <p className="vs-frage">{VORSORGE_TEXTE.zeitFrage}</p>
              {tage.length === 0 ? <p className="vs-hinweis">{VORSORGE_TEXTE.keineZeiten}</p> : (
                <>
                  <div className="vs-tage" role="group" aria-label="Tag">
                    {tage.map((t) => (
                      <button key={t} type="button" className={`vs-tag${tag === t ? " an" : ""}`} aria-pressed={tag === t} onClick={() => { setTag(t); setSlot(""); }}>
                        <span>{tagKurz(t)}</span><b>{tagDatum(t)}</b>
                      </button>
                    ))}
                  </div>
                  {tag && (
                    <div className="vs-zeiten" role="group" aria-label="Uhrzeit">
                      {zeiten.map((s) => (
                        <button key={s.iso} type="button" className={`vs-zeit${slot === s.iso ? " an" : ""}`} aria-pressed={slot === s.iso} onClick={() => setSlot(s.iso)}>{s.zeit}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {thema && !lage.belegt[thema] && (
              <div className="vs-einwilligung" data-vorsorge="einwilligung">
                <p className="vs-frage">{VORSORGE_TEXTE.einwilligungTitel}</p>
                <p className="vs-wortlaut">{vorsorgeEinwilligungText(p.partnerFuerText, thema)}</p>
                <label className="vs-haken">
                  <input type="checkbox" checked={ja} onChange={(e) => setJa(e.target.checked)} />
                  <span>{VORSORGE_TEXTE.einwilligungKaestchen}</span>
                </label>
                {lage.bestaetigen.map((b) => (
                  <label key={b} className="vs-haken">
                    <input type="checkbox" checked={bestaetigt.includes(b)}
                      onChange={(e) => setBestaetigt((x) => (e.target.checked ? [...x, b] : x.filter((y) => y !== b)))} />
                    <span>{VORSORGE_BESTAETIGEN[b]}</span>
                  </label>
                ))}
                <p className="vs-fein">{VORSORGE_TEXTE.gehtAn} {koopPartnerImSatz(p.partnerFuerText)}: Ihr Vor- und Nachname, Ihre Telefonnummer, Ihre E-Mail-Adresse, Ihr Thema und der Termin.</p>
              </div>
            )}

            <button type="button" className="vs-knopf" disabled={!bereit || laeuft === "buchen"} onClick={() => void buchen()}>
              {laeuft === "buchen" ? VORSORGE_TEXTE.bucht : VORSORGE_TEXTE.knopf}
            </button>
            {!bereit && !nurLesen && <p className="vs-fein vs-fehlt">Noch offen: {fehlt.join(" · ")}</p>}
            {hinweis("buchen")}
          </div>
        )}
      </section>

      {lage.stand !== "abgelehnt" && (
        <button type="button" className="vs-leise" disabled={!!laeuft || nurLesen} onClick={() => void keinInteresse()}>{VORSORGE_TEXTE.keinInteresse}</button>
      )}
      <p className="vs-fein vs-fiaon">{VORSORGE_TEXTE.fiaonSatz}</p>
    </div>
  );
}
