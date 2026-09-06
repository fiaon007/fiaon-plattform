// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/daten — MEINE DATEN (Bauvorlage 3.14, Scheibe 6, 06.09.2026)
//
// Fünf Felder, vorbelegt aus dem Bereich-JSON: E-Mail, Telefon, Straße und
// Hausnummer, PLZ, Ort. Name und Geburtsdatum stehen NICHT zur Änderung — sie
// müssen zum Ausweis passen und werden über die Ansprechperson geändert.
//
// Speichern → PATCH /kunde/:ref/stammdaten (fiaon-kunde-bereich.ts:396ff.) —
// die Route schreibt SOFORT (kein Schwebezustand, keine Prüfstufe); der Satz
// auf dem Bildschirm sagt genau das.
// Die Route schreibt NUR gesendete Felder — darum senden wir nur, was sich
// wirklich geändert hat (27.08.2026: der alte Bereich löschte über eine falsche
// Route KYC-Angaben). Antwort { ok:true, geaendert: string[] } → „Gespeichert.“
// oder „Es gab nichts zu ändern.“; 400/404/500 → Fehlersatz vom Server.
// Demo: nur Anzeige, kein Knopf.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link } from "wouter";
import type { Bereich } from "./typen";
import { api } from "./Bausteine";
import { ereignisMelden } from "./Bericht";
import "@/styles/app-antraege.css";
import "@/styles/app-bericht.css";

/** Der Kunde aus dem Bereich-JSON — plus die Rückfrage-Felder, die der Server mitliefert, typen.ts aber (noch) nicht kennt. */
export type KundeDaten = Bereich["kunde"] & { profilRueckfrage?: boolean; profilHinweis?: string | null };

type Felder = { email: string; phone: string; street: string; zip: string; city: string };
const ausKunde = (k: KundeDaten): Felder => ({ email: k.email ?? "", phone: k.telefon ?? "", street: k.strasse ?? "", zip: k.plz ?? "", city: k.ort ?? "" });

export function MeineDaten({ kundeRef, demo, kunde, basis: basisProp }: { kundeRef: string; demo: boolean; kunde: KundeDaten; basis?: string }) {
  // Die Schale (Bereich.tsx) reicht keine Basis herein — in der Demo führt „Zurück“ trotzdem nach /app/demo.
  const basis = basisProp ?? (demo ? "/app/demo" : "/app");
  const [start, setStart] = useState<Felder>(() => ausKunde(kunde));
  const [f, setF] = useState<Felder>(() => ausKunde(kunde));
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);

  useEffect(() => { const k = ausKunde(kunde); setStart(k); setF(k); }, [kunde.email, kunde.telefon, kunde.strasse, kunde.plz, kunde.ort]);
  // „geoeffnet“ meldet die Schale (Bereich.tsx, /mehr/daten) — hier nur „knopf“ und „fertig“.

  /** Nur geänderte Felder — getrimmt; leer heißt für den Server „gelöscht“. */
  const geaenderte = (): Partial<Felder> => {
    const aus: Partial<Felder> = {};
    (Object.keys(f) as (keyof Felder)[]).forEach((k) => { if (f[k].trim() !== start[k].trim()) aus[k] = f[k].trim(); });
    return aus;
  };
  const anzahlGeaendert = Object.keys(geaenderte()).length;

  const speichern = async (e: FormEvent) => {
    e.preventDefault();
    if (demo) return;
    const body = geaenderte();
    if (Object.keys(body).length === 0) { setMeldung({ ton: "gut", text: "Es gab nichts zu ändern." }); return; }
    setLaeuft(true); setMeldung(null);
    ereignisMelden(kundeRef, demo, "daten", "knopf");
    try {
      const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/stammdaten`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok && r.json?.ok) {
        const ge: string[] = Array.isArray(r.json.geaendert) ? r.json.geaendert : [];
        setMeldung({ ton: "gut", text: ge.length ? "Gespeichert." : "Es gab nichts zu ändern." });
        setStart({ ...start, ...body });
        ereignisMelden(kundeRef, demo, "daten", "fertig");
      } else {
        setMeldung({ ton: "fehler", text: String(r.json?.error || "Ihre Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.") });
      }
    } catch {
      setMeldung({ ton: "fehler", text: "Ohne Verbindung lässt sich nichts speichern. Ihre Eingaben bleiben stehen – bitte tippen Sie gleich noch einmal auf Speichern." });
    }
    setLaeuft(false);
  };

  const feld = (k: keyof Felder, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="ap-feld">
      <span>{label}</span>
      {demo
        ? <input value={f[k]} readOnly aria-readonly="true" {...extra} />
        : <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={laeuft} {...extra} />}
    </label>
  );

  return (
    <>
      <Link href={`${basis}/mehr`} className="ap-textknopf ap-auf">← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>Meine Daten<small>{kunde.vorname} {kunde.nachname} · Kundennummer <span className="ap-mono">{kundeRef}</span></small></h1>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Ansicht</b><span>Nur Anzeige – hier wird nichts geändert.</span></div>}

      {kunde.profilRueckfrage && (
        <div className="ap-band ap-auf">
          <div><b>Bitte prüfen Sie Ihre Angaben.</b><span>{kunde.profilHinweis || "Ihre Ansprechperson hat eine Rückfrage zu Ihren Daten."}</span></div>
        </div>
      )}

      <form className="ap-karte ap-form ap-auf v1" onSubmit={speichern} noValidate>
        {feld("email", "E-Mail", { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false })}
        {feld("phone", "Telefon", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "+49 …" })}
        {feld("street", "Straße und Hausnummer", { autoComplete: "street-address" })}
        <div className="ap-form-reihe">
          {feld("zip", "PLZ", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 5 })}
          {feld("city", "Ort", { autoComplete: "address-level2" })}
        </div>
        {/* Ehrlich zur Route: PATCH /stammdaten schreibt sofort (fiaon-kunde-bereich.ts:396ff.), es gibt keine Prüfstufe.
            Der Spec-Satz „prüfen wir, bevor sie gelten“ darf erst stehen, wenn die Route eine hat (Entscheidung Justin). */}
        <p className="ap-fuss" style={{ margin: "2px 2px 0" }}>Ihre Änderungen gelten sofort in Ihrer Akte. Name und Geburtsdatum ändern wir nur nach Prüfung Ihres Ausweises.</p>
        {!demo && <button type="submit" className="ap-knopf" disabled={laeuft || anzahlGeaendert === 0}>{laeuft ? "Wird gespeichert …" : "Speichern"}</button>}
        {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
      </form>

      <div className="ap-karte ap-auf v2">
        <dl className="ap-liste" style={{ marginTop: 0 }}>
          <dt>Name</dt><dd>{kunde.vorname} {kunde.nachname}</dd>
          {kunde.geburtsdatum && <><dt>Geburtsdatum</dt><dd>{geburtstag(kunde.geburtsdatum)}</dd></>}
          {kunde.land && <><dt>Land</dt><dd>{kunde.land}</dd></>}
          {kunde.kundeSeit && <><dt>Dabei seit</dt><dd>{kunde.kundeSeit}</dd></>}
        </dl>
        <p className="ap-fuss" style={{ marginTop: 10 }}>Name und Geburtsdatum stehen in Ihrem Ausweis. Stimmt etwas nicht, <Link href={`${basis}/mehr/hilfe`} className="ap-link">schreiben Sie Ihrer Ansprechperson</Link> – sie ändert es in Ihrer Akte.</p>
      </div>
    </>
  );
}

/** 'YYYY-MM-DD' (oder ISO-Zeit) → „14.05.1988“; alles andere unverändert. */
function geburtstag(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v;
}
