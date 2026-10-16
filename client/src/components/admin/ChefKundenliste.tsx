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
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import {
  Search, Users, ChevronLeft, ChevronRight, ArrowUpDown, ExternalLink,
  ShieldAlert, KeyRound, Clock, Landmark, X,
} from "lucide-react";
import { API, Karte, Hochzaehler, eur, zahl, datum, seit, Geruest, Fehlermeldung } from "./chef-teile";
// E-IT-E (08.10.2026): Akte-Links über den einen Helfer — ohne Kennung kein Link ins Leere.
import { akteLink } from "@/lib/akte-link";
// 14.10.2026 (Florentine): „Nächster Kunde“ in der Akte — die Liste legt ihre Reihe ab und findet beim Zurückkommen die Stelle wieder.
import { reiheAusZeilen, reiheLesen, reiheSpeichern, reiheZuletzt } from "@/lib/akte-reihe";
// E-388 (16.10.2026, Florentine): die Filter der Betreuung auch hier — dieselben Schlüssel, Titel und Regeln.
import { FiaonFilter, FiaonFilterChips } from "@/components/FiaonFilter";
import {
  KUNDEN_SPEZIAL_GRUPPEN, KUNDEN_SPEZIAL_SCHLUESSEL, KUNDEN_SPEZIAL_TITEL, KUNDEN_STUFEN,
  kundenZusatzAlsSuche, kundenZusatzAus, type KundenSpezialSchluessel, type KundenZusatzFilter,
} from "@shared/fiaon-kundenfilter";

const FILTER = [
  { key: "alle", label: "Alle" },
  { key: "zahlende", label: "Zahlende" },
  { key: "mandat", label: "Mit Mandat" },
  { key: "pool", label: "Im Pool" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "ohneZugang", label: "Ohne Zugang" },
  { key: "inkasso", label: "Forderung" },
  { key: "gesperrt", label: "Gesperrt" },
  // E-338: Firmenkunden für sich — sie gehören in Chefbüro › Global, nicht zwischen die Privatkunden.
  { key: "global", label: "FIAON Global" },
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
  /** E-IT-E: noch keine Bestellung — die Akte öffnet als Interessenten-Akte. */
  nur_interessent?: boolean;
  /** E-IT-E: Gibt es einen Interessenten-Eintrag? Ohne ihn und ohne Bestellung gibt es keine Akte. */
  hat_lead?: boolean;
  /** E-338: Firmenkunde (FIAON Global) — die Zeile führt in sein Mandat. */
  global?: boolean; global_ref?: string | null;
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
  // E-338: Die Sperre eines Firmenkunden ist Schutz vor Privat-Abläufen (E-272), keine Warnung.
  if (z.is_blocked && !z.global) alle.push({ key: "sperre", Icon: ShieldAlert, titel: "Gesperrt", ton: "rot" });
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
  // E-336: Die Suche im Kopf (⌘K) springt mit ?q=… hierher — „Alle Treffer in der Kundenliste".
  const adresse = useSearch();
  const ausAdresse = () => { try { return new URLSearchParams(adresse).get("q") ?? ""; } catch { return ""; } };
  // Zurück aus der Akte (gleicher Tab): dieselbe Auswahl, dieselbe Seite — außer die Suche im Kopf bringt einen Begriff mit.
  const [start] = useState(() => (ausAdresse() ? null : reiheLesen()));
  const [q, setQ] = useState(() => ausAdresse() || start?.suche || "");
  const [suche, setSuche] = useState(() => (ausAdresse() || start?.suche || "").trim());
  const [filter, setFilter] = useState<string>(start?.filter ?? "alle");
  const [sort, setSort] = useState<string>(start?.sort ?? "zuletzt");
  const [seite, setSeite] = useState(start?.seite ?? 1);
  const [zusatz, setZusatz] = useState<KundenZusatzFilter>(() => kundenZusatzAus(new URLSearchParams(start?.extra ?? "")));
  const zusatzSuche = kundenZusatzAlsSuche(zusatz);
  const zusatzSetzen = (neu: Partial<KundenZusatzFilter>) => { setZusatz((z) => ({ ...z, ...neu })); setSeite(1); };
  const spezialSetzen = (k: string, an: boolean) => zusatzSetzen({
    spezial: Object.fromEntries(Object.entries({ ...zusatz.spezial, [k]: an }).filter(([, v]) => v)) as KundenZusatzFilter["spezial"],
  });
  const angesprungen = useRef(false);
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Neue Adresse bei offener Liste (zweiter Sprung aus der Suche): Feld übernimmt den Begriff.
  useEffect(() => {
    const neu = ausAdresse();
    if (neu) setQ(neu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adresse]);

  // Erst tippen lassen, dann suchen — sonst eine Abfrage je Tastendruck.
  useEffect(() => {
    const t = setTimeout(() => { const neu = q.trim(); if (neu !== suche) { setSuche(neu); setSeite(1); } }, 280);
    return () => clearTimeout(t);
  }, [q, suche]);

  useEffect(() => {
    let weg = false;
    setLaedt(true); setFehler(null);
    const pfad = `/chef/kunden?filter=${filter}&sort=${sort}&seite=${seite}&proSeite=50`
      + (suche ? `&q=${encodeURIComponent(suche)}` : "") + (zusatzSuche ? `&${zusatzSuche}` : "");
    fetch(`${API}${pfad}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (j?.ok) setD(j); else setFehler(j?.error || "Die Liste ließ sich nicht laden.");
      })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [filter, sort, seite, suche, zusatzSuche]);

  const zeilen: Zeile[] = d?.zeilen ?? [];
  const kopf = d?.kopf ?? {};

  // Die Reihe für „Nächster Kunde“ ablegen — und nach der Rückkehr zum zuletzt geöffneten Kunden springen.
  useEffect(() => {
    if (!d || laedt) return;
    reiheSpeichern({
      eintraege: reiheAusZeilen(d.zeilen ?? []), filter, sort, suche, extra: zusatzSuche,
      seite: Number(d.seite ?? seite), seiten: Number(d.seiten ?? 1), gesamt: Number(d.gesamt ?? 0), proSeite: 50,
    });
    if (angesprungen.current) return;
    angesprungen.current = true;
    const zuletzt = start?.zuletzt;
    if (!zuletzt) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`.ck-zeile[data-person="${zuletzt}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.classList.add("zuletzt");
      setTimeout(() => el.classList.remove("zuletzt"), 2400);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, laedt]);

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
          sind nicht dabei. In der Akte blätterst du unten mit „Nächster Kunde“ weiter.
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
        {/* ── E-388: die Filter der Betreuung — Stufe, Zuständiger, Arbeitslage, Datenqualität ── */}
        <div className="ck-zusatz">
          <div className="ck-filter ck-stufen" role="group" aria-label="Stufe">
            {KUNDEN_STUFEN.map((st) => {
              const an = !!zusatz.stufe?.includes(st.wert);
              const zahlWert = d?.zahlen?.[st.zahl];
              return (
                <button key={st.wert} type="button" className={an ? "an" : ""} aria-pressed={an}
                        onClick={() => {
                          const alt = zusatz.stufe ?? [];
                          const neu = an ? alt.filter((x) => x !== st.wert) : [...alt, st.wert];
                          zusatzSetzen({ stufe: neu.length ? neu : undefined });
                        }}>
                  {st.titel}{zahlWert != null && <span className="ck-zahl">{zahl(Number(zahlWert))}</span>}
                </button>
              );
            })}
          </div>
          {(d?.agenten?.length ?? 0) > 0 && (
            <label className="ck-sort ck-zustaendig">
              <Users size={15} strokeWidth={1.7} aria-hidden="true" />
              <select value={zusatz.agent ? String(zusatz.agent) : ""} aria-label="Zuständiger"
                      onChange={(e) => zusatzSetzen({ agent: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Alle Zuständigen</option>
                {d.agenten.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <FiaonFilter
            gruppen={KUNDEN_SPEZIAL_GRUPPEN.map((g) => ({
              titel: g.titel, art: "schalter" as const,
              optionen: g.optionen.map((o) => ({
                schluessel: o.schluessel, titel: o.titel, erklaerung: o.erklaerung,
                anzahl: o.zahl && d?.zahlen?.[o.zahl] != null ? Number(d.zahlen[o.zahl]) : null,
              })),
            }))}
            aktiv={zusatz.spezial as Record<string, boolean>}
            onAendern={(k, w) => spezialSetzen(k, !!w)}
            onZuruecksetzen={() => zusatzSetzen({ spezial: {} })}
          />
          <FiaonFilterChips
            chips={KUNDEN_SPEZIAL_SCHLUESSEL.filter((k) => zusatz.spezial[k])
              .map((k) => ({ schluessel: k, titel: KUNDEN_SPEZIAL_TITEL[k as KundenSpezialSchluessel] }))}
            onEntfernen={(k) => spezialSetzen(k, false)}
            onAlle={() => zusatzSetzen({ spezial: {} })}
          />
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
              <a key={z.id} className={`ck-zeile${zs.length ? " auffaellig" : ""}`} data-person={z.id}
                 onClick={() => { if (!z.global) reiheZuletzt(Number(z.id)); }}
                 href={z.global ? `/chef/global${z.global_ref ? `?mandat=${encodeURIComponent(z.global_ref)}` : ""}` : (akteLink(z.id, "chef") ?? undefined)}>
                <span className="ck-marke" aria-hidden="true" data-ton={zs[0]?.ton ?? ""} />

                <span className="ck-wer">
                  <b>{name(z)}</b>
                  <em>
                    {z.primary_email || z.primary_phone || "keine Kontaktdaten"}
                    {z.city && <> · {z.zip ? `${z.zip} ` : ""}{z.city}</>}
                  </em>
                </span>

                <span className="ck-paket">
                  {/* E-IT-E (08.10.2026): Gut die Hälfte der Liste sind reine
                      Interessenten (nur Lead). Die Marke sagt es VOR dem Klick —
                      niemand soll eine Bezahl-Akte erwarten. */}
                  {z.global ? <b data-art="global">FIAON Global{z.global_ref ? ` · ${z.global_ref}` : ""}</b>
                    : z.pakete ? <b title={z.pakete}>{z.pakete}</b>
                    : z.nur_interessent && z.hat_lead ? <b className="leise" data-art="interessent">Interessent — noch keine Bestellung</b>
                    : z.nur_interessent ? <b className="leise" data-art="ohne-vorgang">angelegt, ohne Antrag und ohne Interessenten-Eintrag</b>
                    : <b className="leise">kein bezahltes Paket</b>}
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
