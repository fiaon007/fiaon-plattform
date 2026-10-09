// ═══════════════════════════════════════════════════════════════════════════
// „ALLE DATEN“ — JEDER DATENSATZ EINES KUNDEN IN DER EINEN AKTE (09.10.2026, E-328)
//
// Justin: „1 Zentrale Akte für ALLE Kunden ALLE DATENSÄTZE!!!“ — Reiter der EINEN Akte im Chefbüro
// (ZentraleAkte.tsx). Der Server (GET /chef/kunde/:kennung/datensaetze, lib/fiaon-akte-datensaetze.ts)
// liefert jede Kundentabelle, gruppiert, ohne Geheimnisse; hier wird sie lesbar: Suche über alles,
// Gruppen als Sprungleiste, je Tabelle eine matte Karte zum Aufklappen, Werte in klaren Formen
// (Datum, Euro aus Cent, Ja/Nein), leere Spalten ausgeblendet. Nur lesen — gehandelt wird in den
// anderen Reitern der Akte.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";

interface Tabelle {
  tabelle: string; titel: string; gruppe: string; anzahl: number; gekuerzt: boolean;
  spalten: string[]; zeilen: Record<string, unknown>[]; ueber: string[];
}
interface Antwort {
  ok: boolean; error?: string; personId: number; personen: number[]; antraege: string[]; leads: number[];
  gruppen: { titel: string; tabellen: Tabelle[] }[]; ausgeschlossen: { tabelle: string; grund: string }[]; dauerMs: number;
}

/** Klare Wörter für die häufigsten Spalten — der Rest wird lesbar gemacht (Unterstrich → Leerzeichen). */
const WORT: Record<string, string> = {
  id: "Nr.", created_at: "Angelegt", updated_at: "Geändert", person_id: "Person", ref: "Antrag", lead_id: "Lead",
  status: "Status", note: "Notiz", notiz: "Notiz", email: "E-Mail", phone: "Telefon", telefon: "Telefon",
  first_name: "Vorname", last_name: "Nachname", amount_cents: "Betrag", betrag_cents: "Betrag", amount_due: "Betrag",
  agent_id: "Mitarbeiter", agent_name: "Mitarbeiter", type: "Art", art: "Art", outcome: "Ergebnis",
  payment_reference: "Zahlungsreferenz", zahlungsreferenz: "Zahlungsreferenz", payment_status: "Zahlungsstatus",
  pack_key: "Paket", pack_name: "Paketname", subject: "Betreff", betreff: "Betreff", body: "Inhalt", text: "Text",
  direction: "Richtung", richtung: "Richtung", faellig_am: "Fällig am", bezahlt_am: "Bezahlt am", rate_nr: "Rate",
  booked_at: "Gebucht am", payer_name: "Absender", reference_raw: "Verwendungszweck", scheduled_at: "Geplant für",
  done_at: "Erledigt am", voided_at: "Verworfen am", beginn: "Beginn", ende: "Ende", quelle: "Quelle",
  priority_tier: "Stufe", tier_reason: "Stufe — Grund", assigned_agent_id: "Betreuer", city: "Ort", zip: "PLZ",
  street: "Straße", birth_date: "Geburtsdatum", submitted_at: "Abgeschickt am", paid_at: "Bezahlt am",
  person_ref: "Personen-Referenz", kind: "Art", birthdate: "Geburtsdatum", primary_email: "E-Mail", primary_phone: "Telefon",
  phone_key9: "Telefon (Abgleich)", company_name: "Firma", contact_name: "Ansprechpartner", country: "Land",
  nationality: "Staatsangehörigkeit", account_status: "Zugang (Status)", agent_conflict: "Betreuer-Konflikt",
  quality_flags: "Qualitätsmarken", first_source: "Erste Quelle", first_campaign: "Erste Kampagne", first_seen_at: "Zuerst gesehen",
  merged_into_person_id: "Aufgegangen in Person", promised_payment_date: "Zusage: zahlt am", follow_up_date: "Wiedervorlage",
  unreachable_count: "Nicht erreicht (Zähler)", is_blocked: "Vertriebssperre", invoice_sent_count: "Rechnungen versandt",
  assigned_at: "Betreuer seit", betreuung_seit: "Betreut seit", mandat_seit: "Mandat seit", werbung_gesperrt_am: "Werbesperre seit",
  gesperrt_seit: "Gesperrt seit", ist_test_am: "Testeintrag seit", anrede: "Anrede", sprache: "Sprache", wartet_auf: "Wartet auf",
  inkasso_ab: "Forderung ab", ruhe_seit: "Ruht seit", geraet: "Gerät", schritt: "Schritt", ereignis: "Ereignis", sitzung: "Sitzung",
  weg: "Weg", am: "Am", detail: "Detail", wert: "Wert", kanal: "Kanal", gesendet_am: "Gesendet am", sent_at: "Gesendet am",
  template: "Vorlage", vorlage: "Vorlage", event: "Ereignis", recipient: "Empfänger", to_email: "An", from_email: "Von",
  error: "Fehler", fehler: "Fehler", duration: "Dauer", dauer_sek: "Dauer (s)", recording_url: "Aufnahme", transcript: "Mitschrift",
};
const spaltenName = (s: string) => WORT[s] ?? (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, " ");

const DATUM_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const NUR_DATUM = /^\d{4}-\d{2}-\d{2}$/;
function wert(spalte: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  if (/_cents$/.test(spalte) && (typeof v === "number" || /^-?\d+$/.test(String(v)))) {
    return (Number(v) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  }
  if (typeof v === "string" && DATUM_ZEIT.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (typeof v === "string" && NUR_DATUM.test(v)) { const [y, m, d] = v.split("-"); return `${d}.${m}.${y}`; }
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}

const ZEILEN_ERST = 25;

export default function AkteAlleDaten({ kennung }: { kennung: string }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [leere, setLeere] = useState(false);
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [ganz, setGanz] = useState<Set<string>>(new Set());

  useEffect(() => {
    let weg = false;
    setD(null); setFehler(null);
    fetch(`/api/fiaon/chef/kunde/${encodeURIComponent(kennung)}/datensaetze`, { credentials: "include" })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => { if (weg) return; if (!r.ok || !j?.ok) setFehler(j?.error || "Die Datensätze konnten nicht geladen werden."); else setD(j); })
      .catch(() => { if (!weg) setFehler("Die Datensätze konnten nicht geladen werden."); });
    return () => { weg = true; };
  }, [kennung]);

  const q = suche.trim().toLowerCase();
  const sicht = useMemo(() => {
    if (!d) return [];
    return d.gruppen.map((g) => ({
      titel: g.titel,
      tabellen: g.tabellen
        .map((t) => ({ ...t, treffer: q ? t.zeilen.filter((z) => Object.values(z).some((v) => v != null && String(typeof v === "object" ? JSON.stringify(v) : v).toLowerCase().includes(q))) : t.zeilen }))
        .filter((t) => (q ? t.treffer.length > 0 || t.titel.toLowerCase().includes(q) : leere || t.anzahl > 0)),
    })).filter((g) => g.tabellen.length > 0);
  }, [d, q, leere]);

  if (fehler) return <p className="zd-fehler">{fehler}</p>;
  if (!d) return <div className="za-laden" role="status"><span /><span /><span /><p>Alle Datensätze werden gesammelt …</p></div>;

  const alle = d.gruppen.flatMap((g) => g.tabellen);
  const summe = alle.reduce((s, t) => s + t.anzahl, 0);
  const mitDaten = alle.filter((t) => t.anzahl > 0).length;
  const umschalten = (setze: (f: (s: Set<string>) => Set<string>) => void, k: string) =>
    setze((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <section className="zd" aria-label="Alle Daten dieses Kunden">
      <header className="zd-kopf">
        <div>
          <h3>Alle Daten</h3>
          <p>
            {summe.toLocaleString("de-DE")} Datensätze in {mitDaten} von {alle.length} Tabellen
            {d.personen.length > 1 ? ` · mit ${d.personen.length - 1} zusammengeführten Personen` : ""}
            {` · ${d.antraege.length} ${d.antraege.length === 1 ? "Antrag" : "Anträge"}`}
            {d.leads.length ? ` · ${d.leads.length} ${d.leads.length === 1 ? "Lead" : "Leads"}` : ""}
          </p>
        </div>
        <div className="zd-steuer">
          <input type="search" className="zd-suche" placeholder="In allen Daten suchen …" value={suche}
            onChange={(e) => setSuche(e.target.value)} aria-label="In allen Daten suchen" />
          <label className="zd-leere"><input type="checkbox" checked={leere} onChange={(e) => setLeere(e.target.checked)} /> Leere Tabellen zeigen</label>
        </div>
      </header>

      <nav className="zd-sprung" aria-label="Gruppen">
        {sicht.map((g) => (
          <a key={g.titel} href={`#zd-${g.titel}`} onClick={(e) => { e.preventDefault(); document.getElementById(`zd-${g.titel}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            {g.titel}<b>{g.tabellen.reduce((s, t) => s + (q ? t.treffer.length : t.anzahl), 0).toLocaleString("de-DE")}</b>
          </a>
        ))}
      </nav>

      {sicht.length === 0 && <p className="zd-leer">{q ? `Nichts gefunden für „${suche}“.` : "Zu diesem Kunden gibt es noch keine Datensätze."}</p>}

      {sicht.map((g) => (
        <div key={g.titel} className="zd-gruppe" id={`zd-${g.titel}`}>
          <h4>{g.titel}</h4>
          {g.tabellen.map((t) => {
            const istOffen = offen.has(t.tabelle) || (!!q && t.treffer.length > 0);
            const zeilen = t.treffer;
            const gezeigt = ganz.has(t.tabelle) ? zeilen : zeilen.slice(0, ZEILEN_ERST);
            // Spalten, in denen in den gezeigten Zeilen nichts steht, fallen weg — weniger Rauschen.
            const spalten = t.spalten.filter((s) => gezeigt.some((z) => z[s] != null && z[s] !== ""));
            return (
              <div key={t.tabelle} className={`zd-karte${istOffen ? " offen" : ""}${t.anzahl === 0 ? " leer" : ""}`}>
                <button type="button" className="zd-karte-kopf" aria-expanded={istOffen} disabled={t.anzahl === 0}
                  onClick={() => umschalten(setOffen, t.tabelle)}>
                  <span className="zd-titel">{t.titel}</span>
                  <span className="zd-ueber">{t.ueber.length ? `über ${t.ueber.join(" · ")}` : ""}</span>
                  <span className="zd-zahl">{q ? `${zeilen.length} von ${t.anzahl}` : t.anzahl.toLocaleString("de-DE")}</span>
                  <svg className="zd-pfeil" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {istOffen && t.anzahl > 0 && (
                  <div className="zd-inhalt">
                    <div className="zd-tabelle-rahmen" role="region" aria-label={t.titel} tabIndex={0}>
                      <table className="zd-tabelle">
                        <thead><tr>{spalten.map((s) => <th key={s} title={s}>{spaltenName(s)}</th>)}</tr></thead>
                        <tbody>
                          {gezeigt.map((z, i) => (
                            <tr key={i}>{spalten.map((s) => { const w = wert(s, z[s]); return <td key={s} title={w.length > 60 ? w : undefined}>{w}</td>; })}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="zd-fuss">
                      {zeilen.length > ZEILEN_ERST && !ganz.has(t.tabelle) && (
                        <button type="button" className="zd-mehr" onClick={() => umschalten(setGanz, t.tabelle)}>Alle {zeilen.length} zeigen</button>
                      )}
                      {t.gekuerzt && <span>Gezeigt: die jüngsten {t.zeilen.length} von {t.anzahl.toLocaleString("de-DE")} Datensätzen.</span>}
                      <span className="zd-technik">Tabelle {t.tabelle}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <p className="zd-schutz">
        Nicht in der Akte, mit Absicht: Passwörter, PINs, Tokens und Sitzungen; Dateien nur als Größe (öffnen unter „Unterlagen“);
        IBAN nur mit den letzten vier Stellen. Ganze Tabellen ohne Akteninhalt: {d.ausgeschlossen.map((a) => `${a.tabelle} (${a.grund})`).join(" · ")}.
        Geladen in {d.dauerMs.toLocaleString("de-DE")} ms.
      </p>
    </section>
  );
}
