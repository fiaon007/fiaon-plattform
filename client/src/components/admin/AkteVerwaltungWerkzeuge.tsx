// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUGE DER VERWALTUNG IN DER EINEN AKTE  (E-315, 09.10.2026)
//
// Justin: „über die man ALLES steuern kann“. Diese Handlungen hatten Server-Wege, aber in KEINER Akte einen Knopf
// (nur im nie fertig gewordenen Dashboard-Entwurf): Rate verschieben / als bezahlt buchen / erinnern, Abo stoppen und
// fortsetzen, Erinnerungs-Ausnahme, Erstattung, sofort ins Forderungsmanagement, Vertriebssperre SETZEN, DSGVO-Löschung.
//
// Regeln (Hausregeln, siehe ~/Developer/it-rettung/akte/ANFORDERUNGEN.md):
//   · Vor jeder Handlung eine Rückfrage, die die Folgen nennt (was passiert, was NICHT passiert — z. B. „kein Geld wird
//     bewegt“). Gründe dort, wo der Server sie verlangt; sie stehen danach in der Akte.
//   · Geld nur über die vorhandenen Wege (Raten-Knopf mit Zahldatum, Erstattung über die Bestell-Route) — nie per SQL.
//   · Was der Geschäftsführung vorbehalten ist, prüft der Server (403); die Meldung sagt es ehrlich.
//   · DSGVO-Löschung nur für den Inhaber, mit Eintippen des Namens.
// Daten: GET /chef/kunde/:id (Person, Bestellungen, Raten). Nach jeder Handlung frisch laden.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { useFragen } from "@/pages/agent/shared";

type Rate = {
  id: number; ref: string; rate_nr: number; betrag_cents: number; faellig_am: string; status: string;
  bezahlt_am: string | null; storniert_am: string | null; zahlungsreferenz: string | null; mahnstufe: number | null;
};
type Bestellung = {
  ref: string; pack_name: string | null; payment_status: string; paid_at: string | null; payment_reference: string | null;
  refunded_at: string | null; abo_gestoppt_am: string | null; abo_stopp_grund: string | null; erinnern_trotz_bezahlt: boolean;
  archived_at: string | null; dismissed_at: string | null;
};
type Daten = { person: any; akten: Bestellung[]; raten: Rate[] };

async function api(pfad: string, methode = "GET", body?: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const r = await fetch(`/api/fiaon${pfad}`, {
      method: methode, credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && j?.ok !== false, status: r.status, json: j };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

const eur = (cents: number | null | undefined) =>
  ((Number(cents) || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const tag = (d: string | null | undefined) => {
  if (!d) return "–";
  const x = new Date(String(d).length === 10 ? `${d}T12:00:00` : d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const meldeText = (r: { status: number; json: any }, sonst: string) =>
  r.status === 403 ? (r.json?.error || "Das ist der Geschäftsführung vorbehalten.")
  : r.status === 0 ? "Keine Verbindung — nichts wurde ausgelöst. Bitte noch einmal versuchen."
  : (r.json?.error || sonst);

export default function AkteVerwaltungWerkzeuge({ personId }: { personId: number }) {
  const fragen = useFragen();
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState("");
  const [stufe, setStufe] = useState<string>("");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const [form, setForm] = useState<{ key: string; datum: string; grund: string } | null>(null);
  const [alleRaten, setAlleRaten] = useState(false);
  const [dsgvoName, setDsgvoName] = useState("");

  const laden = useCallback(async () => {
    const r = await api(`/chef/kunde/${personId}`);
    if (r.ok) { setD(r.json as Daten); setFehler(""); }
    else setFehler(meldeText(r, "Die Werkzeuge ließen sich nicht laden."));
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { void api("/chef/status").then((r) => setStufe(String(r.json?.stufe ?? ""))); }, []);

  const tun = async (key: string, pfad: string, body: unknown, gut: string, methode = "POST") => {
    setLaeuft(key); setMeldung(null);
    const r = await api(pfad, methode, body);
    setLaeuft(null);
    if (r.ok) { setMeldung({ gut: true, text: gut }); setForm(null); await laden(); }
    else setMeldung({ gut: false, text: meldeText(r, "Das hat nicht geklappt — nichts wurde geändert.") });
  };

  if (fehler) return <section className="zw zw-fehler" role="alert"><b>Werkzeuge</b><p>{fehler}</p></section>;
  if (!d) return <section className="zw zw-laedt" role="status"><span /><span /></section>;

  const person = d.person || {};
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || person.name || "";
  const raten = (d.raten || []).filter((r) => !r.storniert_am);
  const offen = raten.filter((r) => r.status === "offen");
  const bezahlt = raten.filter((r) => r.status === "bezahlt").slice().reverse();
  const bestellungen = (d.akten || []).filter((a) => !a.archived_at);
  const bezahlte = bestellungen.filter((a) => a.payment_status === "paid");
  const formOffen = (key: string) => form?.key === key;
  const formAuf = (key: string, datum = "") => setForm({ key, datum, grund: "" });

  // ── Raten ────────────────────────────────────────────────────────────────
  const verschieben = async (r: Rate) => {
    if (!form || form.grund.trim().length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(form.datum)) return;
    const ja = await fragen({ titel: `Rate ${r.rate_nr} verschieben?`, text: `Fälligkeit ${tag(r.faellig_am)} → ${tag(form.datum)}.`,
      folge: "Der Mahnstand wird zurückgesetzt, der Grund steht in der Akte. Es geht keine Nachricht an den Kunden.", ja: "Verschieben" });
    if (ja) await tun(`v${r.id}`, `/admin/abo/raten/${r.id}/verschieben`, { faelligAm: form.datum, grund: form.grund.trim() }, `Rate ${r.rate_nr} auf ${tag(form.datum)} verschoben.`);
  };
  const bezahltBuchen = async (r: Rate) => {
    if (!form || !/^\d{4}-\d{2}-\d{2}$/.test(form.datum)) return;
    const ja = await fragen({ titel: `Rate ${r.rate_nr} als bezahlt buchen?`, text: `${eur(r.betrag_cents)}, Zahldatum ${tag(form.datum)}.`,
      folge: "Nur buchen, wenn das Geld auf dem Geschäftskonto steht. Die Rate gilt als bezahlt, die nächste Fälligkeit rückt nach. Es wird kein Geld bewegt.",
      ja: "Als bezahlt buchen" });
    if (ja) await tun(`b${r.id}`, `/admin/abo/raten/${r.id}/bezahlt`, { zahlungsdatum: form.datum }, `Rate ${r.rate_nr} als bezahlt gebucht.`);
  };
  const erinnern = async (r: Rate) => {
    const ja = await fragen({ titel: `Erinnerung zu Rate ${r.rate_nr} senden?`, text: `${eur(r.betrag_cents)}, fällig ${tag(r.faellig_am)}.`,
      folge: "Die Zahlungserinnerung geht JETZT per E-Mail an den Kunden (nur 08–20 Uhr).", ja: "Erinnerung senden" });
    if (ja) await tun(`e${r.id}`, `/admin/abo/raten/${r.id}/erinnern`, {}, `Erinnerung zu Rate ${r.rate_nr} gesendet.`);
  };

  // ── Bestellungen & Abo ───────────────────────────────────────────────────
  const aboStoppen = async (b: Bestellung) => {
    if (!form || form.grund.trim().length < 5) return;
    const ja = await fragen({ titel: "Abo stoppen?", text: `${b.pack_name || "Paket"} · ${b.ref}`,
      folge: "Es werden keine neuen Raten mehr angelegt und keine Rechnungen verschickt, bis das Abo fortgesetzt wird. Offene Raten bleiben offen.",
      ja: "Abo stoppen" });
    if (ja) await tun(`s${b.ref}`, `/admin/abo/${encodeURIComponent(b.ref)}/stoppen`, { grund: form.grund.trim() }, "Abo gestoppt.");
  };
  const aboFortsetzen = async (b: Bestellung) => {
    const ja = await fragen({ titel: "Abo fortsetzen?", text: `${b.pack_name || "Paket"} · ${b.ref}`,
      folge: "Raten und Rechnungen laufen wieder im gewohnten Rhythmus.", ja: "Fortsetzen" });
    if (ja) await tun(`f${b.ref}`, `/admin/abo/${encodeURIComponent(b.ref)}/fortsetzen`, {}, "Abo läuft wieder.");
  };
  const ausnahme = async (b: Bestellung) => {
    if (!b.payment_reference) return;
    const neu = !b.erinnern_trotz_bezahlt;
    const ja = await fragen({ titel: neu ? "Trotz Zahlung erinnern?" : "Erinnerungs-Ausnahme aufheben?", text: `${b.pack_name || "Paket"} · ${b.ref}`,
      folge: neu ? "Diese Bestellung bekommt Zahlungserinnerungen, obwohl sie als bezahlt gilt (z. B. Teilzahlung, Rückbuchung)." : "Für diese bezahlte Bestellung gehen wieder keine Erinnerungen raus.",
      ja: neu ? "Erinnerungen erlauben" : "Aufheben" });
    if (ja) await tun(`a${b.ref}`, `/admin/payments/${encodeURIComponent(b.payment_reference)}/allow-reminders`, { allow: neu }, neu ? "Erinnerungen trotz Zahlung erlaubt." : "Ausnahme aufgehoben.");
  };
  const erstatten = async (b: Bestellung) => {
    if (!b.payment_reference || !form || form.grund.trim().length < 5) return;
    const ja = await fragen({ titel: "Als erstattet buchen?", text: `${b.pack_name || "Paket"} · ${b.ref}`,
      folge: "Die Bestellung gilt als erstattet, offene Raten fallen weg, die Provision wird storniert bzw. verrechnet. Es wird KEIN Geld überwiesen — die Rückzahlung macht ihr selbst über das Geschäftskonto.",
      ja: "Als erstattet buchen", gefaehrlich: true });
    if (ja) await tun(`r${b.ref}`, `/admin/payments/${encodeURIComponent(b.payment_reference)}/refund`, { reason: form.grund.trim() }, "Als erstattet gebucht.");
  };

  // ── Forderung, Sperre, DSGVO ─────────────────────────────────────────────
  const forderung = async () => {
    if (!form || form.grund.trim().length < 5) return;
    const ja = await fragen({ titel: "Sofort ins Forderungsmanagement?", text: name,
      folge: "Die offenen Raten gehen sofort an das Forderungsmanagement, ohne die übliche Wartezeit. Der Grund steht in der Akte.", ja: "Übergeben" });
    if (ja) await tun("inkasso", `/admin/person/${personId}/inkasso`, { grund: form.grund.trim(), von: "Chefbüro" }, "An das Forderungsmanagement übergeben.");
  };
  const sperren = async () => {
    if (!form || form.grund.trim().length < 5) return;
    const ja = await fragen({ titel: "Vertriebssperre setzen?", text: name,
      folge: "Kein Anruf, keine WhatsApp, keine Werbung mehr an diesen Menschen. Laufende Raten und Rechnungen bleiben. Aufheben geht jederzeit.",
      ja: "Sperre setzen", gefaehrlich: true });
    if (ja) await tun("sperre", `/admin/kunden/${personId}/vertriebssperre`, { gesperrt: true, grund: form.grund.trim() }, "Vertriebssperre gesetzt.");
  };
  const dsgvo = async () => {
    if (dsgvoName.trim() !== name || !bestellungen.length) return;
    const ja = await fragen({ titel: "DSGVO-Löschung ausführen?", text: `${name} · ${bestellungen.length} Bestellung(en)`,
      folge: "Persönliche Daten und Unterlagen-Inhalte werden endgültig gelöscht. Das lässt sich NICHT rückgängig machen. Buchungen bleiben anonym erhalten.",
      ja: "Endgültig löschen", gefaehrlich: true });
    if (!ja) return;
    setLaeuft("dsgvo"); setMeldung(null);
    for (const b of bestellungen) {
      const r = await api(`/admin/applications/${encodeURIComponent(b.ref)}/gdpr-delete`, "POST", { confirmed: true });
      if (!r.ok) { setLaeuft(null); setMeldung({ gut: false, text: `${b.ref}: ${meldeText(r, "Löschung abgebrochen.")}` }); await laden(); return; }
    }
    setLaeuft(null); setDsgvoName(""); setMeldung({ gut: true, text: "DSGVO-Löschung ausgeführt." }); await laden();
  };

  // Eine Render-Funktion, KEINE Unterkomponente: Eine im Render erzeugte Komponente baut das Feld bei jedem Tastendruck neu
  // auf — der Fokus wäre weg (Florentine P9: „Eingabefelder verlieren nie den Fokus“).
  const grundFeld = (min: number, platz: string) => (
    <input className="zw-feld" value={form?.grund ?? ""} placeholder={`${platz} (mind. ${min} Zeichen)`} autoFocus
      onChange={(e) => setForm((f) => (f ? { ...f, grund: e.target.value } : f))} />
  );

  return (
    <section className="zw" aria-label="Werkzeuge der Verwaltung">
      {meldung && <p className={`zw-meldung${meldung.gut ? " gut" : " schlecht"}`} role="status">{meldung.text}</p>}

      <div className="zw-raster">
        {/* ── Raten ── */}
        <div className="zw-karte">
          <div className="zw-kopf"><b>Raten</b><span>{offen.length} offen · {bezahlt.length} bezahlt</span></div>
          {offen.length === 0 && <p className="zw-leer">Keine offene Rate.</p>}
          {offen.map((r) => (
            <div key={r.id} className="zw-zeile">
              <div className="zw-zeile-text">
                <b>Rate {r.rate_nr} · {eur(r.betrag_cents)}</b>
                <span>fällig {tag(r.faellig_am)}{r.mahnstufe ? ` · Mahnstufe ${r.mahnstufe}` : ""}{r.zahlungsreferenz ? ` · ${r.zahlungsreferenz}` : ""}</span>
              </div>
              <div className="zw-knoepfe">
                <button type="button" className="zw-knopf" onClick={() => formAuf(`v${r.id}`, String(r.faellig_am).slice(0, 10))}>Verschieben</button>
                <button type="button" className="zw-knopf" onClick={() => formAuf(`b${r.id}`, heute())}>Als bezahlt</button>
                <button type="button" className="zw-knopf still" disabled={laeuft === `e${r.id}`} onClick={() => void erinnern(r)}>{laeuft === `e${r.id}` ? "…" : "Erinnern"}</button>
              </div>
              {formOffen(`v${r.id}`) && (
                <div className="zw-form">
                  <input type="date" className="zw-feld" value={form!.datum} onChange={(e) => setForm((f) => (f ? { ...f, datum: e.target.value } : f))} aria-label="Neue Fälligkeit" />
                  {grundFeld(10, "Grund")}
                  <button type="button" className="zw-knopf haupt" disabled={laeuft === `v${r.id}` || (form?.grund.trim().length ?? 0) < 10} onClick={() => void verschieben(r)}>Verschieben</button>
                  <button type="button" className="zw-link" onClick={() => setForm(null)}>Abbrechen</button>
                </div>
              )}
              {formOffen(`b${r.id}`) && (
                <div className="zw-form">
                  <label className="zw-label">Zahldatum <input type="date" className="zw-feld" value={form!.datum} max={heute()} onChange={(e) => setForm((f) => (f ? { ...f, datum: e.target.value } : f))} /></label>
                  <button type="button" className="zw-knopf haupt" disabled={laeuft === `b${r.id}`} onClick={() => void bezahltBuchen(r)}>Buchen</button>
                  <button type="button" className="zw-link" onClick={() => setForm(null)}>Abbrechen</button>
                </div>
              )}
            </div>
          ))}
          {bezahlt.length > 0 && (
            <>
              <button type="button" className="zw-link" onClick={() => setAlleRaten((v) => !v)}>{alleRaten ? "Bezahlte ausblenden" : `Bezahlte zeigen (${bezahlt.length})`}</button>
              {alleRaten && bezahlt.map((r) => (
                <div key={r.id} className="zw-zeile still">
                  <div className="zw-zeile-text"><b>Rate {r.rate_nr} · {eur(r.betrag_cents)}</b><span>bezahlt {tag(r.bezahlt_am)}</span></div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Bestellungen & Abo ── */}
        <div className="zw-karte">
          <div className="zw-kopf"><b>Bestellungen &amp; Abo</b><span>{bezahlte.length} bezahlt</span></div>
          {bezahlte.length === 0 && <p className="zw-leer">Keine bezahlte Bestellung — Abo und Erstattung gibt es erst nach der Zahlung.</p>}
          {bezahlte.map((b) => (
            <div key={b.ref} className="zw-zeile">
              <div className="zw-zeile-text">
                <b>{b.pack_name || "Paket"}</b>
                <span>{b.ref} · bezahlt {tag(b.paid_at)}{b.abo_gestoppt_am ? ` · Abo gestoppt ${tag(b.abo_gestoppt_am)}` : ""}{b.erinnern_trotz_bezahlt ? " · erinnert trotz Zahlung" : ""}</span>
              </div>
              <div className="zw-knoepfe">
                {b.abo_gestoppt_am
                  ? <button type="button" className="zw-knopf" disabled={laeuft === `f${b.ref}`} onClick={() => void aboFortsetzen(b)}>Abo fortsetzen</button>
                  : <button type="button" className="zw-knopf" onClick={() => formAuf(`s${b.ref}`)}>Abo stoppen</button>}
                {b.payment_reference && <button type="button" className="zw-knopf still" disabled={laeuft === `a${b.ref}`} onClick={() => void ausnahme(b)}>{b.erinnern_trotz_bezahlt ? "Ausnahme aufheben" : "Trotz Zahlung erinnern"}</button>}
                {b.payment_reference && <button type="button" className="zw-knopf warn" onClick={() => formAuf(`r${b.ref}`)}>Erstattung</button>}
              </div>
              {formOffen(`s${b.ref}`) && (
                <div className="zw-form">{grundFeld(5, "Grund")}
                  <button type="button" className="zw-knopf haupt" disabled={(form?.grund.trim().length ?? 0) < 5 || laeuft === `s${b.ref}`} onClick={() => void aboStoppen(b)}>Stoppen</button>
                  <button type="button" className="zw-link" onClick={() => setForm(null)}>Abbrechen</button></div>
              )}
              {formOffen(`r${b.ref}`) && (
                <div className="zw-form">{grundFeld(5, "Grund der Erstattung")}
                  <button type="button" className="zw-knopf warn" disabled={(form?.grund.trim().length ?? 0) < 5 || laeuft === `r${b.ref}`} onClick={() => void erstatten(b)}>Als erstattet buchen</button>
                  <button type="button" className="zw-link" onClick={() => setForm(null)}>Abbrechen</button></div>
              )}
            </div>
          ))}
        </div>

        {/* ── Forderung & Sperre ── */}
        <div className="zw-karte">
          <div className="zw-kopf"><b>Forderung &amp; Sperre</b></div>
          <div className="zw-zeile">
            <div className="zw-zeile-text">
              <b>Forderungsmanagement</b>
              <span>{person.inkasso_ab ? `übergeben am ${tag(person.inkasso_ab)}${person.inkasso_grund ? ` · ${person.inkasso_grund}` : ""}` : "nicht übergeben — die Raten laufen in der normalen Erinnerungskette"}</span>
            </div>
            {!person.inkasso_ab && offen.length > 0 && <div className="zw-knoepfe"><button type="button" className="zw-knopf" onClick={() => formAuf("inkasso")}>Sofort übergeben</button></div>}
            {formOffen("inkasso") && (
              <div className="zw-form">{grundFeld(5, "Grund")}
                <button type="button" className="zw-knopf haupt" disabled={(form?.grund.trim().length ?? 0) < 5 || laeuft === "inkasso"} onClick={() => void forderung()}>Übergeben</button>
                <button type="button" className="zw-link" onClick={() => setForm(null)}>Abbrechen</button></div>
            )}
          </div>
          <div className="zw-zeile">
            <div className="zw-zeile-text">
              <b>Vertriebssperre</b>
              <span>{person.is_blocked ? "gesetzt — aufheben im Kopf der Verwaltung („Sperre aufheben“)" : "keine — Anrufe, WhatsApp und Werbung sind erlaubt"}</span>
            </div>
            {!person.is_blocked && <div className="zw-knoepfe"><button type="button" className="zw-knopf warn" onClick={() => formAuf("sperre")}>Sperre setzen</button></div>}
            {formOffen("sperre") && (
              <div className="zw-form">{grundFeld(5, "Grund")}
                <button type="button" className="zw-knopf warn" disabled={(form?.grund.trim().length ?? 0) < 5 || laeuft === "sperre"} onClick={() => void sperren()}>Sperre setzen</button>
                <button type="button" className="zw-link" onClick={() => setForm(null)}>Abbrechen</button></div>
            )}
          </div>
        </div>

        {/* ── DSGVO (nur Inhaber) ── */}
        {stufe === "inhaber" && bestellungen.length > 0 && (
          <div className="zw-karte zw-gefahr">
            <div className="zw-kopf"><b>DSGVO-Löschung</b><span>nur Inhaber · nicht umkehrbar</span></div>
            <p className="zw-leer">Löscht persönliche Daten und Unterlagen-Inhalte aller {bestellungen.length} Bestellung(en). Zur Bestätigung den Namen genau so eintippen: <b>{name}</b></p>
            <div className="zw-form">
              <input className="zw-feld" value={dsgvoName} onChange={(e) => setDsgvoName(e.target.value)} placeholder="Name eintippen" aria-label="Name zur Bestätigung" />
              <button type="button" className="zw-knopf warn" disabled={dsgvoName.trim() !== name || laeuft === "dsgvo"} onClick={() => void dsgvo()}>{laeuft === "dsgvo" ? "…" : "Endgültig löschen"}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
