// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSZENTRALE (26.08.2026)
//
// Justin: „Unsere Zahlungszentrale (mit EXAKTEN DATEN! also hier wirklich
//          DOPPELT prüfen sodass ALLE Details eingetragen und ersichtlich
//          sind!)"
//
// ── WAS „ALLE DETAILS" HEISST ─────────────────────────────────────────────
// Jede Zeile trägt vierzehn Angaben. Sichtbar sind sechs — die, nach denen
// man sucht. Die übrigen acht erscheinen, wenn man die Zeile aufklappt:
// Zahlungsweg, Referenz, Rechnungsdatum, Lastschriftstand, Mahnstufe,
// Provisionssatz, Abrechnungsstand, Notiz.
//
// Alles auf einmal zu zeigen wäre eine Tapete. Nichts zu zeigen wäre eine
// Behauptung. Sechs plus acht auf Klick ist der Kompromiss, der beides löst.
//
// ── DIE DOPPELTE PRÜFUNG ──────────────────────────────────────────────────
// Die Monatssumme dieser Seite wird gegen die Summe des Lagezimmers geprüft —
// dieselbe Grundlage, zwei Wege. Stimmen sie nicht überein, steht es hier als
// Warnung, statt dass man es irgendwann bei einem Bankgespräch merkt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle2, ExternalLink, X, CalendarRange,
} from "lucide-react";
import { API, Karte, Hochzaehler, eur, eurKurz, zahl, datum, datumZeit, Geruest, Fehlermeldung } from "./chef-teile";

interface Zahlung {
  id: number; ref: string; rate_nr: number; raten_gesamt: number;
  betrag_cents: number; bezahlt_am: string; faellig_am: string;
  zahlungsreferenz: string | null; quelle: string | null; status: string;
  mahnstufe: number | null; lastschrift_status: string | null;
  rechnung_am: string | null; notiz: string | null;
  pack_name: string | null; pack_key: string | null; amount_due: number | null;
  payment_status: string | null;
  person_id: number | null; person_ref: string | null; kunde: string;
  primary_email: string | null; primary_phone: string | null; city: string | null;
  agent_id: number | null; mitarbeiter: string | null; commission_rate_bp: number | null;
  provision_cents: number | null; provision_bp: number | null;
  abgerechnet: boolean | null; provision_genau: boolean | null;
}

/** Der Zahlungsweg in Worten, die ein Mensch verwendet. */
const wegName = (q: string | null): string => {
  const m: Record<string, string> = {
    lastschrift: "SEPA-Lastschrift", sepa: "SEPA-Lastschrift",
    ueberweisung: "Überweisung", bank: "Überweisung",
    manuell: "von Hand verbucht", kontoabgleich: "über den Kontoabgleich",
    sumup: "SumUp", stripe: "Stripe", gocardless: "GoCardless",
  };
  return q ? (m[q.toLowerCase()] ?? q) : "nicht vermerkt";
};

function heuteIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}
function monatsErster(): string {
  return heuteIso().slice(0, 8) + "01";
}

export default function ChefZahlungen() {
  const [q, setQ] = useState("");
  const [suche, setSuche] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [seite, setSeite] = useState(1);
  const [offen, setOffen] = useState<number | null>(null);
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [lagesumme, setLagesumme] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSuche(q.trim()); setSeite(1); }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let weg = false;
    setLaedt(true); setFehler(null);
    const teile = [`seite=${seite}`, "proSeite=50"];
    if (suche) teile.push(`q=${encodeURIComponent(suche)}`);
    if (von && bis) { teile.push(`von=${von}`, `bis=${bis}`); }
    fetch(`${API}/chef/zahlungen?${teile.join("&")}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (j?.ok) setD(j); else setFehler(j?.error || "Die Zahlungen ließen sich nicht laden.");
      })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [seite, suche, von, bis]);

  // ── Die Gegenprobe: dieselbe Zahl, anderer Weg ─────────────────────────
  // Nur sinnvoll, solange der Standard-Zeitraum (dieser Monat) gilt.
  useEffect(() => {
    if (von || bis || suche) { setLagesumme(null); return; }
    fetch(`${API}/chef/lage`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setLagesumme(Number(j.geld.eingangMonat)); })
      .catch(() => {});
  }, [von, bis, suche]);

  const zeilen: Zahlung[] = d?.zeilen ?? [];
  const summe = d?.summe ?? { cents: 0, kunden: 0, zahlungen: 0 };
  const abweichung = lagesumme != null && Number(summe.cents) !== lagesumme;

  const verlauf = d?.verlauf ?? [];
  const maxVerlauf = useMemo(
    () => Math.max(1, ...verlauf.map((v: any) => Number(v.cents))),
    [verlauf],
  );

  const zeitraumText = von && bis
    ? `${datum(von)} bis ${datum(bis)}`
    : new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div className="cl cz">
      <header className="cl-kopf">
        <p className="cl-augenbraue">Zahlungszentrale</p>
        <h1>Jeder Eingang, vollständig</h1>
        <p className="cl-untertitel">
          Grundlage ist immer der Tag des Eingangs, nie die Fälligkeit. Was
          fällig war, ist keine Einnahme.
        </p>
      </header>

      {/* ── Die drei Zahlen des Zeitraums ────────────────────────────────── */}
      <div className="cz-kopfzahlen">
        <Karte klasse="cz-gross">
          <em>Eingegangen · {zeitraumText}</em>
          <b><Hochzaehler ziel={Number(summe.cents || 0)} formatieren={eur} /></b>
        </Karte>
        <Karte klasse="cz-kz">
          <b><Hochzaehler ziel={Number(summe.zahlungen || 0)} formatieren={zahl} /></b>
          <em>einzelne Zahlungen</em>
        </Karte>
        <Karte klasse="cz-kz">
          <b><Hochzaehler ziel={Number(summe.kunden || 0)} formatieren={zahl} /></b>
          <em>verschiedene Kunden</em>
        </Karte>
      </div>

      {/* ── Die Gegenprobe ───────────────────────────────────────────────── */}
      {lagesumme != null && (
        <p className={`cz-gegenprobe${abweichung ? " abweichung" : ""}`} role="status">
          {abweichung
            ? <><AlertTriangle size={15} strokeWidth={1.8} /> <b>Achtung:</b> Das Lagezimmer nennt für diesen Monat {eur(lagesumme)}, diese Seite {eur(Number(summe.cents))}. Eine der beiden Zahlen stimmt nicht.</>
            : <><CheckCircle2 size={15} strokeWidth={1.8} /> Gegengeprüft: Das Lagezimmer nennt für diesen Monat dieselbe Summe.</>}
        </p>
      )}

      {/* ── Der Verlauf ──────────────────────────────────────────────────── */}
      {verlauf.length > 1 && (
        <div className="cz-verlauf">
          {verlauf.map((v: any) => {
            const [j, m] = String(v.monat).split("-").map(Number);
            const hoch = Math.max(4, (Number(v.cents) / maxVerlauf) * 100);
            return (
              <button key={v.monat} type="button" className="cz-balken"
                      title={`${eur(Number(v.cents))} aus ${zahl(v.anzahl)} Zahlungen`}
                      onClick={() => {
                        const ersterTag = `${v.monat}-01`;
                        const letzterTag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" })
                          .format(new Date(j, m, 0));
                        setVon(ersterTag); setBis(letzterTag); setSeite(1);
                      }}>
                <span style={{ height: `${hoch}%` }} />
                <b>{new Date(j, m - 1, 1).toLocaleDateString("de-DE", { month: "short" })}</b>
                <em>{eurKurz(Number(v.cents))}</em>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Suche und Zeitraum ───────────────────────────────────────────── */}
      <div className="cz-steuerung">
        <div className="ck-suche">
          <Search size={18} strokeWidth={1.6} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Kunde, Aktenzeichen, Referenz oder Mitarbeiter"
                 autoComplete="off" spellCheck={false} />
          {q && <button type="button" className="ck-leeren" onClick={() => setQ("")} aria-label="Suche leeren"><X size={15} strokeWidth={2} /></button>}
        </div>
        <div className="cz-zeitraum">
          <CalendarRange size={16} strokeWidth={1.7} aria-hidden="true" />
          <input type="date" value={von} max={bis || heuteIso()}
                 onChange={(e) => { setVon(e.target.value); setSeite(1); }} aria-label="von" />
          <span>bis</span>
          <input type="date" value={bis} min={von} max={heuteIso()}
                 onChange={(e) => { setBis(e.target.value); setSeite(1); }} aria-label="bis" />
          {(von || bis) && (
            <button type="button" onClick={() => { setVon(""); setBis(""); setSeite(1); }}>
              dieser Monat
            </button>
          )}
          {!von && !bis && (
            <button type="button" onClick={() => { setVon(monatsErster()); setBis(heuteIso()); setSeite(1); }}>
              Zeitraum wählen
            </button>
          )}
        </div>
      </div>

      {fehler && <Fehlermeldung text={fehler} />}
      {laedt && <Geruest zeilen={10} />}

      {!laedt && zeilen.length === 0 && !fehler && (
        <p className="cw-hinweis">In diesem Zeitraum ist keine Zahlung eingegangen.</p>
      )}

      {/* ── Die Zeilen ───────────────────────────────────────────────────── */}
      {!laedt && zeilen.length > 0 && (
        <div className="cz-liste">
          {zeilen.map((z) => {
            const auf = offen === z.id;
            return (
              <div key={z.id} className={`cz-zeile${auf ? " auf" : ""}`}>
                <button type="button" className="cz-kopfzeile"
                        onClick={() => setOffen(auf ? null : z.id)} aria-expanded={auf}>
                  <span className="cz-datum">
                    <b>{datum(z.bezahlt_am)}</b>
                    <em>{new Date(z.bezahlt_am).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</em>
                  </span>
                  <span className="cz-kunde">
                    <b>{z.kunde || "unbekannt"}</b>
                    <em>{z.pack_name || "ohne Paket"}</em>
                  </span>
                  <span className="cz-rate">
                    <b>Rate {z.rate_nr}</b>
                    <em>von {z.raten_gesamt}</em>
                  </span>
                  <span className="cz-betrag">
                    <b>{eur(Number(z.betrag_cents))}</b>
                    <em>{wegName(z.quelle)}</em>
                  </span>
                  <span className="cz-agent">
                    <b>{z.mitarbeiter || "kein Mitarbeiter"}</b>
                    <em>
                      {z.provision_cents != null
                        ? <>{eur(Number(z.provision_cents))}{z.provision_bp ? ` · ${Number(z.provision_bp) / 100} %` : ""}</>
                        : <span className="cz-warnung">keine Provision gebucht</span>}
                    </em>
                  </span>
                  <ChevronDown className="cz-pfeil" size={18} strokeWidth={1.6} aria-hidden="true" />
                </button>

                {auf && (
                  <dl className="cz-details">
                    <div><dt>Aktenzeichen</dt><dd>{z.ref}</dd></div>
                    <div><dt>Zahlungsreferenz</dt><dd>{z.zahlungsreferenz || "keine hinterlegt"}</dd></div>
                    <div><dt>Fällig war</dt><dd>{datum(z.faellig_am)}</dd></div>
                    <div><dt>Eingegangen</dt><dd>{datumZeit(z.bezahlt_am)}</dd></div>
                    <div><dt>Zahlungsweg</dt><dd>{wegName(z.quelle)}</dd></div>
                    <div><dt>Lastschrift</dt><dd>{z.lastschrift_status || "nicht per Lastschrift"}</dd></div>
                    <div><dt>Rechnung erstellt</dt><dd>{z.rechnung_am ? datum(z.rechnung_am) : "keine Rechnung erzeugt"}</dd></div>
                    <div><dt>Mahnstufe</dt><dd>{z.mahnstufe ? String(z.mahnstufe) : "keine"}</dd></div>
                    <div><dt>Paket</dt><dd>{z.pack_name || "—"}{z.amount_due ? ` · Gesamtpreis ${eur(Number(z.amount_due))}` : ""}</dd></div>
                    <div><dt>Bestellung gilt als</dt><dd>{z.payment_status === "paid" ? "bezahlt" : (z.payment_status || "offen")}</dd></div>
                    <div><dt>Kunde</dt><dd>{z.primary_email || "keine E-Mail"}{z.primary_phone ? ` · ${z.primary_phone}` : ""}{z.city ? ` · ${z.city}` : ""}</dd></div>
                    <div><dt>Zuständig</dt><dd>{z.mitarbeiter || "niemand"}{z.commission_rate_bp ? ` · Satz ${Number(z.commission_rate_bp) / 100} %` : ""}</dd></div>
                    <div>
                      <dt>Provision</dt>
                      <dd>
                        {z.provision_cents != null
                          ? <>
                              {eur(Number(z.provision_cents))}
                              {z.provision_bp ? ` zu ${Number(z.provision_bp) / 100} %` : ""}
                              {z.provision_genau === false && <span className="cz-warnung"> · über die Akte zugeordnet, nicht betragsgenau</span>}
                            </>
                          : <span className="cz-warnung">für diese Zahlung ist keine Provision gebucht</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>Abgerechnet</dt>
                      <dd>{z.abgerechnet === true ? "ja, in einer Auszahlung enthalten"
                        : z.provision_cents != null ? "noch keiner Auszahlung zugeordnet" : "—"}</dd>
                    </div>
                    {z.notiz && <div className="breit"><dt>Notiz</dt><dd>{z.notiz}</dd></div>}
                    <div className="breit cz-wege">
                      {z.person_id && <a className="cw-knopf klein" href={`/chef/s/akte?id=${z.person_id}`}>Akte öffnen <ExternalLink size={13} strokeWidth={1.7} /></a>}
                      <a className="cw-knopf klein" href="/chef/s/zahlungen-verwalten">Zahlungsverwaltung</a>
                      <a className="cw-knopf klein" href="/chef/s/rechnungen">Rechnungen</a>
                    </div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}

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
