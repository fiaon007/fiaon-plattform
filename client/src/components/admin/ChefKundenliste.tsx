// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENAUFLISTUNG (26.08.2026)
//
// Justin: „Außerdem brauchen wir ja eine Seite mit der gesamten
//          Kundenauflistung (und bitte denke an das WOW Design!)"
//
// ── WAS EINE KUNDENLISTE ZU LEISTEN HAT ───────────────────────────────────
// Sie beantwortet drei Fragen, und zwar in dieser Reihenfolge:
//   1. Wie viele sind es, und wovon sehe ich gerade einen Ausschnitt?
//   2. Wer ist auffällig — überfällig, ohne Zugang, gesperrt?
//   3. Wo klicke ich, um bei genau dieser Person etwas zu tun?
//
// ── WARUM EINE PERSON EINE ZEILE IST ──────────────────────────────────────
// Wer drei Verträge hat, steht einmal in der Liste. Die alte Zählweise über
// Bestellungen war der Grund, warum dieselbe Frage an zwei Orten zwei
// Antworten bekam — 1.164 „Kunden" bei 403 zahlenden Menschen.
//
// ── DIE GESTALTUNG ────────────────────────────────────────────────────────
// Keine Rahmen um jede Zelle. Getrennt wird durch Abstand und eine einzige
// feine Linie. Auffälligkeiten sind FARBIGE PUNKTE am linken Rand, nicht
// bunte Zeilen — eine Liste, in der jede zweite Zeile leuchtet, hat keine
// Warnung mehr, sondern ein Muster.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import {
  Search, Users, ChevronLeft, ChevronRight, ArrowUpDown, ExternalLink,
  ShieldAlert, KeyRound, Clock, Landmark, X,
} from "lucide-react";
import { API, Karte, Hochzaehler, eur, zahl, datum, seit, Geruest, Fehlermeldung } from "./chef-teile";

const FILTER = [
  { key: "alle", label: "Alle" },
  { key: "zahlende", label: "Zahlende" },
  { key: "mandat", label: "Mit Mandat" },
  { key: "pool", label: "Im Pool" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "ohneZugang", label: "Ohne Zugang" },
  { key: "inkasso", label: "Forderung" },
  { key: "gesperrt", label: "Gesperrt" },
] as const;

const SORT = [
  { key: "zuletzt", label: "Zuletzt gezahlt" },
  { key: "umsatz", label: "Umsatz" },
  { key: "offen", label: "Offener Betrag" },
  { key: "name", label: "Name" },
  { key: "neu", label: "Neu angelegt" },
] as const;

interface Zeile {
  id: number; person_ref: string | null; first_name: string | null; last_name: string | null;
  company_name: string | null; primary_email: string | null; primary_phone: string | null;
  city: string | null; zip: string | null; priority_tier: string | null;
  mandat_seit: string | null; assigned_agent_id: number | null; mitarbeiter: string | null;
  is_blocked: boolean; inkasso_ab: string | null; created_at: string;
  bezahlt_cents: string | number; offen_cents: string | number; ueberfaellig: number;
  letzte_zahlung: string | null; naechste_faellig: string | null; hoechste_mahnstufe: number | null;
  pakete: string | null; hat_zugang: boolean; ref: string | null;
}

/** Der Name, wie ein Mensch ihn schreiben würde — mit Firma, falls vorhanden. */
function name(z: Zeile): string {
  const n = [z.first_name, z.last_name].filter(Boolean).join(" ").trim();
  if (n && z.company_name) return `${n} · ${z.company_name}`;
  return n || z.company_name || "ohne Namen";
}

/**
 * Die Auffälligkeiten einer Zeile als kurze Zeichen.
 * Bewusst höchstens drei: Wer vier Warnungen an einer Person sieht, liest
 * keine davon mehr.
 */
function zeichen(z: Zeile) {
  const alle: { key: string; Icon: any; titel: string; ton: string }[] = [];
  if (z.is_blocked) alle.push({ key: "sperre", Icon: ShieldAlert, titel: "Gesperrt", ton: "rot" });
  if (z.inkasso_ab) alle.push({ key: "inkasso", Icon: Landmark, titel: "In der Forderungsbearbeitung", ton: "rot" });
  if (Number(z.ueberfaellig) > 0) alle.push({
    key: "faellig", Icon: Clock, ton: "gelb",
    titel: `${z.ueberfaellig} überfällige ${Number(z.ueberfaellig) === 1 ? "Rate" : "Raten"}${z.hoechste_mahnstufe ? `, Mahnstufe ${z.hoechste_mahnstufe}` : ""}`,
  });
  if (!z.hat_zugang && Number(z.bezahlt_cents) > 0) alle.push({
    key: "zugang", Icon: KeyRound, titel: "Hat bezahlt, kann sich aber nicht anmelden", ton: "gelb",
  });
  return alle.slice(0, 3);
}

export default function ChefKundenliste() {
  const [q, setQ] = useState("");
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<string>("alle");
  const [sort, setSort] = useState<string>("zuletzt");
  const [seite, setSeite] = useState(1);
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Erst tippen lassen, dann suchen — sonst eine Abfrage je Tastendruck.
  useEffect(() => {
    const t = setTimeout(() => { setSuche(q.trim()); setSeite(1); }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let weg = false;
    setLaedt(true); setFehler(null);
    const pfad = `/chef/kunden?filter=${filter}&sort=${sort}&seite=${seite}&proSeite=50`
      + (suche ? `&q=${encodeURIComponent(suche)}` : "");
    fetch(`${API}${pfad}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (j?.ok) setD(j); else setFehler(j?.error || "Die Liste ließ sich nicht laden.");
      })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [filter, sort, seite, suche]);

  const zeilen: Zeile[] = d?.zeilen ?? [];
  const kopf = d?.kopf ?? {};

  // Die Summe der SICHTBAREN Zeilen — ausdrücklich als solche benannt, damit
  // sie niemand für den Gesamtumsatz hält.
  const summeSeite = useMemo(
    () => zeilen.reduce((s, z) => s + Number(z.bezahlt_cents || 0), 0),
    [zeilen],
  );

  return (
    <div className="cl ck">
      <header className="cl-kopf">
        <p className="cl-augenbraue">Bestand</p>
        <h1>Alle Menschen bei FIAON</h1>
        <p className="cl-untertitel">
          Eine Person, eine Zeile. Zusammengeführte Dubletten und Testeinträge
          sind nicht dabei.
        </p>
      </header>

      {/* ── Die Kopfzahlen: gelten immer für den GESAMTEN Bestand ────────── */}
      <div className="ck-kopfzahlen">
        <Karte klasse="ck-kz">
          <b><Hochzaehler ziel={Number(kopf.menschen || 0)} formatieren={zahl} /></b>
          <em>Menschen insgesamt</em>
        </Karte>
        <Karte klasse="ck-kz" onClick={() => { setFilter("zahlende"); setSeite(1); }}>
          <b><Hochzaehler ziel={Number(kopf.zahlende || 0)} formatieren={zahl} /></b>
          <em>zahlende Kunden</em>
        </Karte>
        <Karte klasse="ck-kz" onClick={() => { setFilter("mandat"); setSeite(1); }}>
          <b><Hochzaehler ziel={Number(kopf.mandate || 0)} formatieren={zahl} /></b>
          <em>angenommene Mandate</em>
        </Karte>
        <Karte klasse="ck-kz" onClick={() => { setFilter("pool"); setSeite(1); }}>
          <b><Hochzaehler ziel={Number(kopf.pool || 0)} formatieren={zahl} /></b>
          <em>im Pool, niemandem zugeteilt</em>
        </Karte>
      </div>

      {/* ── Suche, Filter, Sortierung ────────────────────────────────────── */}
      <div className="ck-steuerung">
        <div className="ck-suche">
          <Search size={18} strokeWidth={1.6} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Name, E-Mail, Telefon, Firma oder Aktenzeichen"
                 autoComplete="off" spellCheck={false} />
          {q && (
            <button type="button" className="ck-leeren" onClick={() => setQ("")} aria-label="Suche leeren">
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="ck-filter" role="group" aria-label="Filter">
          {FILTER.map((f) => (
            <button key={f.key} type="button"
                    className={filter === f.key ? "an" : ""}
                    onClick={() => { setFilter(f.key); setSeite(1); }}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="ck-sort">
          <ArrowUpDown size={15} strokeWidth={1.7} aria-hidden="true" />
          <select value={sort} onChange={(e) => { setSort(e.target.value); setSeite(1); }}>
            {SORT.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {/* ── Was man gerade sieht ─────────────────────────────────────────── */}
      {d && !laedt && (
        <p className="ck-lage" role="status">
          {d.gesamt === 0 ? "Keine Person passt zu dieser Auswahl."
            : <>
                <b>{zahl(d.gesamt)}</b> {d.gesamt === 1 ? "Person" : "Personen"} in dieser Auswahl
                {d.seiten > 1 && <> · Seite {d.seite} von {zahl(d.seiten)}</>}
                {zeilen.length > 0 && <> · auf dieser Seite {eur(summeSeite)} eingegangen</>}
              </>}
        </p>
      )}

      {fehler && <Fehlermeldung text={fehler} />}
      {laedt && <Geruest zeilen={10} />}

      {!laedt && zeilen.length > 0 && (
        <div className="ck-liste">
          {zeilen.map((z) => {
            const zs = zeichen(z);
            return (
              <a key={z.id} className={`ck-zeile${zs.length ? " auffaellig" : ""}`} href={`/admin/kunde/${z.id}`}>
                <span className="ck-marke" aria-hidden="true" data-ton={zs[0]?.ton ?? ""} />

                <span className="ck-wer">
                  <b>{name(z)}</b>
                  <em>
                    {z.primary_email || z.primary_phone || "keine Kontaktdaten"}
                    {z.city && <> · {z.zip ? `${z.zip} ` : ""}{z.city}</>}
                  </em>
                </span>

                <span className="ck-paket">
                  {z.pakete ? <b title={z.pakete}>{z.pakete}</b> : <b className="leise">kein bezahltes Paket</b>}
                  <em>{z.mitarbeiter ? z.mitarbeiter : "im Pool"}{z.mandat_seit ? " · Mandat" : ""}</em>
                </span>

                <span className="ck-geld">
                  <b>{eur(Number(z.bezahlt_cents || 0))}</b>
                  <em>
                    {Number(z.offen_cents) > 0
                      ? <>{eur(Number(z.offen_cents))} offen</>
                      : "nichts offen"}
                  </em>
                </span>

                <span className="ck-zeit">
                  <b>{z.letzte_zahlung ? seit(z.letzte_zahlung) : "nie gezahlt"}</b>
                  <em>{z.naechste_faellig ? `nächste ${datum(z.naechste_faellig)}` : "keine offene Rate"}</em>
                </span>

                <span className="ck-zeichen">
                  {zs.map((s) => (
                    <i key={s.key} data-ton={s.ton} title={s.titel} aria-label={s.titel}>
                      <s.Icon size={15} strokeWidth={1.8} />
                    </i>
                  ))}
                </span>

                <ExternalLink className="ck-pfeil" size={15} strokeWidth={1.6} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      )}

      {/* ── Blättern ─────────────────────────────────────────────────────── */}
      {d && d.seiten > 1 && (
        <nav className="ck-blaettern" aria-label="Seiten">
          <button type="button" onClick={() => setSeite((s) => Math.max(1, s - 1))} disabled={seite <= 1}>
            <ChevronLeft size={16} strokeWidth={1.8} /> Zurück
          </button>
          <span>Seite {zahl(seite)} von {zahl(d.seiten)}</span>
          <button type="button" onClick={() => setSeite((s) => Math.min(d.seiten, s + 1))} disabled={seite >= d.seiten}>
            Weiter <ChevronRight size={16} strokeWidth={1.8} />
          </button>
        </nav>
      )}
    </div>
  );
}
