// ═══════════════════════════════════════════════════════════════════════════
// DUBLETTEN-ARBEITSPLATZ — eine Entscheidung, ein Mensch, kein Datenverlust
//
// Diese Ansicht wird an ZWEI Stellen benutzt: in /admin/dubletten und als
// fünfter Bereich der Vertriebsleitung. Beide bedienen dieselbe Maschine; nur
// die Adressen der Datenwege unterscheiden sich (Prop `pfade`). Zwei Oberflächen
// für denselben Vorgang würden über kurz oder lang zwei Verhaltensweisen —
// genau das hat uns die doppelte Definition von „Frist abgelaufen" eingebracht.
//
// DREI ENTSCHEIDUNGEN IM AUFBAU
//   1. Die Liste ist nach SICHERHEIT sortiert, nicht nach Datum. Wer oben
//      anfängt, arbeitet an den belastbarsten Fällen.
//   2. Die unterste Stufe heißt ausdrücklich „Vermutung". Ein Vorschlag, der
//      wie eine Feststellung aussieht, wird irgendwann wie eine behandelt.
//   3. Vor dem Zusammenführen steht eine Rückfrage in Klartext: was passiert,
//      was mit abweichenden Angaben geschieht, und was NICHT passiert.
//
// KEIN EMOJI, KEINE ICON-BIBLIOTHEK. Ordnung entsteht durch Ziffern, Haarlinien
// und Weißraum. Die eine Marke unten ist selbst gezeichnet (1,5 px Strich) und
// zeigt, was der Knopf tut: zwei Linien, die eine werden.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";

export type Stufe = "telefon" | "email" | "name_geburtsdatum" | "name";

export interface DublettenPfade {
  /** Kandidatenliste (GET) */
  liste: string;
  /** Gegenüberstellung, `:a`/`:b` werden ersetzt (GET) */
  paar: string;
  /** Zusammenführen (POST) */
  zusammenfuehren: string;
  /** Keine Dublette (POST) */
  keineDublette: string;
}

type Person = {
  id: number; personRef: string; name: string;
  email: string | null; telefon: string | null; geburtsdatum: string | null;
  betreuerId: number | null; betreuerName: string | null; betreuungSeit: string | null;
  bestellungen: number; bezahlteBestellungen: number;
  letzterKontakt: string | null; angelegt: string | null;
};
type Kandidat = {
  schluessel: string; stufe: Stufe; stufeText: string; vermutung: boolean;
  merkmal: string; vorschlagGewinnerId: number;
  links: Person; rechts: Person; betreuerStreit: boolean;
};
type Seite = {
  id: number; personRef: string; name: string;
  felder: Record<string, string | null>;
  kontoStatus: string | null; gesperrt: boolean;
  betreuerId: number | null; betreuerName: string | null; betreuungSeit: string | null;
  zusage: string | null; wiedervorlage: string | null; angelegt: string | null;
  bestellungen: { ref: string; paket: string | null; status: string | null; betrag: string | null;
                  frist: string | null; angelegt: string | null; archiviertAm: string | null;
                  archivGrund: string | null; rechnung: string | null }[];
  verlauf: { am: string; art: string | null; ergebnis: string | null; notiz: string | null;
             agent: string | null; ref: string }[];
  aliase: { art: string; wert: string; quelle: number | null }[];
  letzterKontakt: string | null;
};
type Vergleich = {
  links: Seite; rechts: Seite;
  abweichungen: { feld: string; vorgabe: "links" | "rechts"; linksLeer: boolean; rechtsLeer: boolean }[];
  vorgabeSeite: "links" | "rechts";
  betreuerStreit: boolean;
};

const FELD_NAME: Record<string, string> = {
  first_name: "Vorname", last_name: "Nachname", company_name: "Firma",
  contact_name: "Ansprechpartner", primary_email: "E-Mail", primary_phone: "Telefon",
  birthdate: "Geburtsdatum", street: "Straße", zip: "PLZ", city: "Ort",
  country: "Land", nationality: "Staatsangehörigkeit",
};
const FELD_ORDNUNG = Object.keys(FELD_NAME);

const STUFE_RANG: Record<Stufe, string> = {
  telefon: "1", email: "2", name_geburtsdatum: "3", name: "4",
};
const STUFE_FARBE: Record<Stufe, string> = {
  telefon: "bg-slate-900 text-white",
  email: "bg-slate-700 text-white",
  name_geburtsdatum: "bg-slate-200 text-slate-700",
  name: "bg-white text-slate-500 border border-slate-300",
};
const ZAHLUNG: Record<string, string> = {
  paid: "bezahlt", claimed_paid: "angekündigt", pending_payment: "offen",
  pending: "Antrag", expired: "Frist abgelaufen", cancelled: "storniert",
  superseded: "ersetzt", refunded: "erstattet",
};

const datum = (v: string | null | undefined, mitZeit = false): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
    ...(mitZeit ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
};

/** Selbst gezeichnet, 1,5 px: zwei Linien, die eine werden. */
function MarkeZusammenfuehren({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 5h3.5c2.2 0 3.4 1.7 4 2.8.6 1.1 1.8 2.7 4 2.7h1.5" />
      <path d="M3.5 15h3.5c2.2 0 3.4-1.7 4-2.8" />
      <path d="M14 8l2.5 2.5L14 13" />
    </svg>
  );
}

async function hole(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

export default function DublettenArbeitsplatz({ pfade }: { pfade: DublettenPfade }) {
  const [kandidaten, setKandidaten] = useState<Kandidat[]>([]);
  const [zahlen, setZahlen] = useState<{ gesamt: number; jeStufe: Record<Stufe, number> } | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [nurStufe, setNurStufe] = useState<Stufe | "alle">("alle");
  const [offen, setOffen] = useState<Kandidat | null>(null);
  const [vergleich, setVergleich] = useState<Vergleich | null>(null);
  const [vergleichLaedt, setVergleichLaedt] = useState(false);
  const [gewinner, setGewinner] = useState<number | null>(null);
  const [feldWahl, setFeldWahl] = useState<Record<string, "links" | "rechts">>({});
  const [betreuerWahl, setBetreuerWahl] = useState<"gewinner" | "verlierer" | null>(null);
  const [rueckfrage, setRueckfrage] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; art: "ok" | "fehler" } | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const { ok, json } = await hole(pfade.liste);
    if (ok) { setKandidaten(json.kandidaten || []); setZahlen(json.zahlen || null); }
    else setMeldung({ text: json?.error || "Die Kandidatenliste ließ sich nicht laden.", art: "fehler" });
    setLaedt(false);
  }, [pfade.liste]);

  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldung(null), 8000);
    return () => clearTimeout(t);
  }, [meldung]);

  const oeffnen = async (k: Kandidat) => {
    setOffen(k); setVergleich(null); setVergleichLaedt(true); setRueckfrage(false);
    setGewinner(k.vorschlagGewinnerId); setBetreuerWahl(null);
    const pfad = pfade.paar.replace(":a", String(k.links.id)).replace(":b", String(k.rechts.id));
    const { ok, json } = await hole(pfad);
    if (ok) {
      setVergleich(json as Vergleich);
      // Vorgabe je abweichendem Feld: die Seite mit dem jüngeren dokumentierten
      // Kontakt. Wer zuletzt mit dem Kunden gesprochen hat, hat mit höherer
      // Wahrscheinlichkeit den aktuellen Stand.
      const wahl: Record<string, "links" | "rechts"> = {};
      for (const a of (json.abweichungen || [])) {
        wahl[a.feld] = a.linksLeer ? "rechts" : a.rechtsLeer ? "links" : a.vorgabe;
      }
      setFeldWahl(wahl);
    } else setMeldung({ text: json?.error || "Die Gegenüberstellung ließ sich nicht laden.", art: "fehler" });
    setVergleichLaedt(false);
  };

  const schliessen = () => { setOffen(null); setVergleich(null); setRueckfrage(false); };

  /** Aus „links/rechts" wird „gewinner/verlierer" — der Server kennt nur das. */
  const felderFuerServer = (): Record<string, "gewinner" | "verlierer"> => {
    if (!vergleich || gewinner == null) return {};
    const gewinnerIstLinks = vergleich.links.id === gewinner;
    const raus: Record<string, "gewinner" | "verlierer"> = {};
    for (const [feld, seite] of Object.entries(feldWahl)) {
      const nimmLinks = seite === "links";
      raus[feld] = nimmLinks === gewinnerIstLinks ? "gewinner" : "verlierer";
    }
    return raus;
  };

  const zusammenfuehren = async () => {
    if (!vergleich || gewinner == null) return;
    const verlierer = vergleich.links.id === gewinner ? vergleich.rechts.id : vergleich.links.id;
    setBeschaeftigt(true);
    const { ok, json } = await hole(pfade.zusammenfuehren, {
      method: "POST",
      body: JSON.stringify({
        gewinnerId: gewinner, verliererId: verlierer,
        felder: felderFuerServer(),
        ...(betreuerWahl ? { betreuer: betreuerWahl } : {}),
      }),
    });
    setBeschaeftigt(false);
    if (ok) {
      const e = json.ergebnis;
      setMeldung({
        text: `Zusammengeführt. ${e.bestellungenUebernommen.length} Bestellung(en) übernommen, `
          + `${e.zaehlprobe.verlauf.nachher} Verlaufseinträge stehen jetzt an einer Person`
          + (e.gesicherteWerte.length ? `, ${e.gesicherteWerte.length} abweichende Angabe(n) gesichert` : "")
          + ".",
        art: "ok",
      });
      schliessen();
      await laden();
    } else {
      setRueckfrage(false);
      setMeldung({ text: json?.error || "Zusammenführen fehlgeschlagen — es wurde nichts geändert.", art: "fehler" });
    }
  };

  const keineDublette = async (k: Kandidat) => {
    setBeschaeftigt(true);
    const { ok, json } = await hole(pfade.keineDublette, {
      method: "POST",
      body: JSON.stringify({ personA: k.links.id, personB: k.rechts.id }),
    });
    setBeschaeftigt(false);
    if (ok) {
      setMeldung({ text: "Als „keine Dublette“ abgehakt — dieses Paar wird nicht mehr vorgeschlagen.", art: "ok" });
      schliessen();
      await laden();
    } else setMeldung({ text: json?.error || "Konnte nicht gespeichert werden.", art: "fehler" });
  };

  const gefiltert = nurStufe === "alle" ? kandidaten : kandidaten.filter((k) => k.stufe === nurStufe);

  // ── Kopf und Stufenfilter ───────────────────────────────────────────────
  return (
    <div>
      {meldung && (
        <div className={`mb-4 px-3.5 py-2.5 rounded-lg text-[13px] border ${meldung.art === "ok"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-rose-50 text-rose-800 border-rose-200"}`}>
          {meldung.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([["alle", "Alle"], ["telefon", "Gleiche Rufnummer"], ["email", "Gleiche E-Mail"],
          ["name_geburtsdatum", "Name + Geburtsdatum"], ["name", "Nur Name"]] as const).map(([k, text]) => {
          const anzahl = k === "alle" ? (zahlen?.gesamt ?? kandidaten.length) : (zahlen?.jeStufe?.[k as Stufe] ?? 0);
          const an = nurStufe === k;
          return (
            <button key={k} type="button" onClick={() => setNurStufe(k as Stufe | "alle")}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors ${an
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              {text}
              <span className={`ml-1.5 tabular-nums ${an ? "text-white/70" : "text-slate-400"}`}>{anzahl}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => void laden()} disabled={laedt}
          className="ml-auto px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50">
          {laedt ? "Lädt …" : "Aktualisieren"}
        </button>
      </div>

      {laedt ? (
        <p className="text-[13px] text-slate-400">Lädt …</p>
      ) : gefiltert.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-[14px] font-semibold text-slate-800">Keine offenen Kandidaten</p>
          <p className="text-[12.5px] text-slate-500 mt-1">
            In dieser Stufe wartet gerade keine Entscheidung.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {gefiltert.map((k) => (
            <li key={k.schluessel}>
              <button type="button" onClick={() => void oeffnen(k)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(15,23,42,.05),0_10px_24px_rgba(29,78,216,.09)] transition-all">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 w-6 h-6 rounded-md text-[11px] font-bold inline-flex items-center justify-center ${STUFE_FARBE[k.stufe]}`}
                        title={k.stufeText}>
                    {STUFE_RANG[k.stufe]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13.5px] font-bold text-slate-900">{k.links.name}</span>
                      <span className="text-[12px] text-slate-400">und</span>
                      <span className="text-[13.5px] font-bold text-slate-900">{k.rechts.name}</span>
                      {k.vermutung && (
                        <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                          Vermutung
                        </span>
                      )}
                      {k.betreuerStreit && (
                        <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-200">
                          Zwei Betreuer
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-slate-500 mt-1">
                      {k.stufeText} · {k.merkmal}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      #{k.links.id}: {k.links.bestellungen} Bestellung(en)
                      {k.links.bezahlteBestellungen > 0 ? `, ${k.links.bezahlteBestellungen} bezahlt` : ""}
                      {k.links.betreuerName ? ` · ${k.links.betreuerName}` : " · ohne Betreuer"}
                      {"   |   "}
                      #{k.rechts.id}: {k.rechts.bestellungen} Bestellung(en)
                      {k.rechts.bezahlteBestellungen > 0 ? `, ${k.rechts.bezahlteBestellungen} bezahlt` : ""}
                      {k.rechts.betreuerName ? ` · ${k.rechts.betreuerName}` : " · ohne Betreuer"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold text-slate-500 self-center">Prüfen</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Gegenüberstellung: schwebende Ebene, deshalb Glas ────────────── */}
      {offen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
             style={{ background: "rgba(7,11,22,.55)" }} onClick={schliessen}>
          <div className="bg-white w-full sm:max-w-5xl sm:rounded-2xl border border-slate-200 max-h-full overflow-y-auto"
               style={{ boxShadow: "0 4px 8px rgba(15,23,42,.07), 0 22px 50px rgba(29,78,216,.15)" }}
               onClick={(e) => e.stopPropagation()}>
            <header className="sticky top-0 z-10 px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center gap-3"
                    style={{ background: "rgba(255,255,255,.86)", backdropFilter: "blur(20px) saturate(180%)" }}>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold text-slate-900">Gegenüberstellung</h3>
                <p className="text-[11.5px] text-slate-500">{offen.stufeText} · {offen.merkmal}</p>
              </div>
              <button type="button" onClick={schliessen}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-600 hover:border-slate-300">
                Schließen
              </button>
            </header>

            {vergleichLaedt || !vergleich ? (
              <p className="p-6 text-[13px] text-slate-400">Lädt …</p>
            ) : (
              <div className="p-4 sm:p-5 space-y-5">
                {/* Wer bleibt? */}
                <section>
                  <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Welcher Datensatz bleibt bestehen?
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[vergleich.links, vergleich.rechts].map((s) => {
                      const an = gewinner === s.id;
                      return (
                        <button key={s.id} type="button" onClick={() => setGewinner(s.id)}
                          className={`text-left p-3 rounded-xl border transition-colors ${an
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${an ? "border-slate-900 bg-slate-900" : "border-slate-300"}`} />
                            <span className="text-[13.5px] font-bold text-slate-900">{s.name}</span>
                            <span className="text-[11.5px] text-slate-400">#{s.id}</span>
                          </div>
                          <p className="text-[11.5px] text-slate-500 mt-1">
                            {s.bestellungen.length} Bestellung(en) · angelegt {datum(s.angelegt)}
                            {s.letzterKontakt ? ` · letzter Kontakt ${datum(s.letzterKontakt)}` : " · kein Kontakt dokumentiert"}
                          </p>
                          <p className="text-[11.5px] text-slate-500">
                            {s.betreuerName ? `Betreuer: ${s.betreuerName}${s.betreuungSeit ? " (dokumentiert)" : ""}` : "ohne Betreuer"}
                          </p>
                          {an && <p className="text-[11px] font-semibold text-slate-700 mt-1.5">bleibt bestehen</p>}
                          {!an && <p className="text-[11px] text-slate-500 mt-1.5">geht in den anderen auf — bleibt als Wegweiser erhalten</p>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Betreuerstreit */}
                {vergleich.betreuerStreit && (
                  <section className="p-3.5 rounded-xl border border-rose-200 bg-rose-50">
                    <h4 className="text-[13px] font-bold text-rose-900">Zwei dokumentierte Betreuer — bitte entscheiden</h4>
                    <p className="text-[12px] text-rose-800 mt-1 leading-snug">
                      Beide Seiten haben einen belegten Betreuer. Wer künftig zuständig ist, ist eine Geldfrage
                      (der Provisionsanspruch folgt dem dokumentierten Kontakt) — deshalb entscheidet das kein
                      Automat. Die Wahl wird mit Namen protokolliert.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {([["gewinner", vergleich.links.id === gewinner ? vergleich.links : vergleich.rechts],
                         ["verlierer", vergleich.links.id === gewinner ? vergleich.rechts : vergleich.links]] as const)
                        .map(([wahl, seite]) => (
                        <button key={wahl} type="button" onClick={() => setBetreuerWahl(wahl as any)}
                          className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border ${betreuerWahl === wahl
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-300"}`}>
                          {seite.betreuerName || `Agent ${seite.betreuerId}`} übernimmt
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Felder nebeneinander */}
                <section>
                  <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Angaben im Vergleich
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {FELD_ORDNUNG.map((feld, i) => {
                      const l = vergleich.links.felder[feld];
                      const r = vergleich.rechts.felder[feld];
                      if ((l == null || String(l).trim() === "") && (r == null || String(r).trim() === "")) return null;
                      const abweichung = vergleich.abweichungen.find((a) => a.feld === feld);
                      const wahl = feldWahl[feld];
                      return (
                        <div key={feld} className={`px-3 py-2.5 ${i % 2 ? "bg-slate-50/60" : "bg-white"} ${abweichung ? "border-l-2 border-l-amber-400" : ""}`}>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            {FELD_NAME[feld] ?? feld}
                            {abweichung && <span className="ml-2 text-amber-700 normal-case tracking-normal">weicht ab</span>}
                          </p>
                          <div className="grid gap-1.5 sm:grid-cols-2 mt-1">
                            {(["links", "rechts"] as const).map((seite) => {
                              const wert = seite === "links" ? l : r;
                              const gewaehlt = abweichung ? wahl === seite : true;
                              return (
                                <button key={seite} type="button" disabled={!abweichung}
                                  onClick={() => abweichung && setFeldWahl((v) => ({ ...v, [feld]: seite }))}
                                  className={`text-left px-2.5 py-1.5 rounded-lg text-[13px] border ${!abweichung
                                    ? "border-transparent text-slate-700"
                                    : gewaehlt
                                      ? "border-slate-900 bg-white font-semibold text-slate-900"
                                      : "border-slate-200 bg-white text-slate-500 line-through decoration-slate-300"}`}>
                                  {/* Auf schmalen Schirmen stehen die beiden Werte
                                      untereinander — ohne diese Kennung wäre
                                      nicht zu sehen, zu welchem Datensatz ein
                                      Wert gehört (aufgefallen im 380px-Bild). */}
                                  <span className="sm:hidden text-[10.5px] font-bold tracking-wide text-slate-400 mr-1.5">
                                    #{seite === "links" ? vergleich.links.id : vergleich.rechts.id}
                                  </span>
                                  {wert == null || String(wert).trim() === ""
                                    ? <span className="text-slate-400">(leer)</span>
                                    : String(wert)}
                                  {abweichung && gewaehlt && <span className="ml-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">behalten</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">
                    Der nicht gewählte Wert wird nicht verworfen: Er wird als frühere Angabe gesichert und
                    bleibt über die Suche auffindbar.
                  </p>
                </section>

                {/* Bestellungen und Verlauf je Seite */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {[vergleich.links, vergleich.rechts].map((s) => (
                    <section key={s.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <header className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <p className="text-[12.5px] font-bold text-slate-800">
                          {s.name} <span className="text-slate-400 font-normal">#{s.id}</span>
                        </p>
                      </header>
                      <div className="p-3">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Bestellungen ({s.bestellungen.length})
                        </p>
                        {s.bestellungen.length === 0 ? (
                          <p className="text-[12px] text-slate-400">keine</p>
                        ) : (
                          <ul className="space-y-1">
                            {s.bestellungen.map((b) => (
                              <li key={b.ref} className="text-[12px] text-slate-700 flex flex-wrap gap-x-2">
                                <span className="font-mono text-[11px] text-slate-500">{b.ref}</span>
                                <span>{b.paket ? String(b.paket).split("\n")[0] : "—"}</span>
                                <span className="text-slate-500">{ZAHLUNG[String(b.status)] ?? b.status}</span>
                                {b.archiviertAm && <span className="text-slate-400">archiviert</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
                          Letzte Verlaufseinträge
                        </p>
                        {s.verlauf.length === 0 ? (
                          <p className="text-[12px] text-slate-400">kein Kontakt dokumentiert</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {s.verlauf.map((v, i) => (
                              <li key={i} className="text-[12px] text-slate-700">
                                <span className="text-slate-500">{datum(v.am, true)}</span>
                                {v.ergebnis ? ` · ${v.ergebnis}` : ""}
                                {v.agent ? ` · ${v.agent}` : ""}
                                {v.notiz ? <span className="block text-slate-500">{String(v.notiz).slice(0, 140)}</span> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                        {s.aliase.length > 0 && (
                          <>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
                              Frühere Angaben
                            </p>
                            <p className="text-[12px] text-slate-600">
                              {s.aliase.map((a) => a.wert).join(" · ")}
                            </p>
                          </>
                        )}
                      </div>
                    </section>
                  ))}
                </div>

                {/* Entscheidung */}
                <section className="border-t border-slate-100 pt-4 flex flex-wrap gap-2.5">
                  <button type="button" onClick={() => setRueckfrage(true)}
                    disabled={beschaeftigt || (vergleich.betreuerStreit && !betreuerWahl)}
                    className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                    style={{ background: "#2563eb" }}>
                    <MarkeZusammenfuehren /> Zusammenführen
                  </button>
                  <button type="button" onClick={() => offen && void keineDublette(offen)} disabled={beschaeftigt}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50">
                    Keine Dublette
                  </button>
                  {vergleich.betreuerStreit && !betreuerWahl && (
                    <p className="text-[12px] text-rose-700 self-center">
                      Bitte oben festlegen, wer den Kunden künftig betreut.
                    </p>
                  )}
                </section>

                {/* Rückfrage in Klartext */}
                {rueckfrage && (
                  <div className="p-4 rounded-xl border border-slate-300 bg-slate-50">
                    <h4 className="text-[13.5px] font-bold text-slate-900">Zusammenführen — was jetzt passiert</h4>
                    <ul className="mt-2 space-y-1.5 text-[12.5px] text-slate-700">
                      <li>
                        <b>{(vergleich.links.id === gewinner ? vergleich.links : vergleich.rechts).name}</b> (#{gewinner}) bleibt bestehen.
                      </li>
                      <li>
                        Alle{" "}
                        {(vergleich.links.id === gewinner ? vergleich.rechts : vergleich.links).bestellungen.length}{" "}
                        Bestellung(en) und der gesamte Gesprächsverlauf der anderen Person wandern mit —
                        nichts wird gelöscht und nichts stillgelegt.
                      </li>
                      <li>
                        Abweichende Angaben werden als frühere Angaben gesichert. Wer später die alte
                        E-Mail oder Adresse in die Suche eingibt, findet den Kunden weiterhin.
                      </li>
                      <li>
                        Die aufgehende Person bleibt als Wegweiser erhalten und erscheint in keiner
                        Anrufliste, Verteilung oder Erinnerung mehr.
                      </li>
                      <li>
                        Die Zählung der Einträge wird vor und nach dem Vorgang verglichen. Stimmt sie nicht,
                        wird abgebrochen und <b>nichts</b> geändert.
                      </li>
                    </ul>
                    <div className="flex flex-wrap gap-2.5 mt-3.5">
                      <button type="button" onClick={() => void zusammenfuehren()} disabled={beschaeftigt}
                        className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50"
                        style={{ background: "#2563eb" }}>
                        {beschaeftigt ? "Führe zusammen …" : "Ja, zusammenführen"}
                      </button>
                      <button type="button" onClick={() => setRueckfrage(false)} disabled={beschaeftigt}
                        className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
