// ═══════════════════════════════════════════════════════════════════════════
// ZUBUCHEN — EIN EINGANG, ALLE KUNDEN (09.10.2026)
//
// Justin: „Buche all die Zahlungen den Kunden zu, suche nach Namen, Referenz, irgendwas womit du sie zuordnen
// kannst — auf der Seite muss ebenso ein Knopf sein, dass wir auf ‚zubuchen' klicken und dann aus ALLEN Kunden
// denjenigen auswählen können." (/chef/s/konto)
//
// Die Lade zu EINEM Bankeingang, in dieser Reihenfolge:
//   1. Vorschlag — die Trockenprobe mit Vorschlag (Referenz auch mit Tippfehler, Name, Betrag, Datum).
//   2. Kunde suchen — über ALLE Kunden (Name, E-Mail, Telefon, Referenz); je Person ihre Bestellungen und Raten.
//   3. Prüfen — wieder nur trocken: Ziel, Regel, Mails, Provision, Hinweise. Erst dann „Jetzt buchen“.
//   4. „Kein Kundengeld“ — für Eingänge, die keinem Kunden gehören (z. B. 0,18 € Prüfbetrag von Google).
// Gebucht wird NUR über POST /admin/zahlungen/bankeingang-nachholen — derselbe Weg wie FIAON Banking › Bankbuch
// (bankeingangBuchen / bankeingangZuordnen, server/lib/fiaon-bank-nachholen.ts): Bestätigungsmail, Ratenkette,
// Provisionsschalter, Rückwärtssperre, Erwartungs-Stempel. Kein zweiter Buchungsweg.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NachholVorschlag, NachholZeile } from "@/pages/banking/api";

const API = "/api/fiaon";

export interface ZubuchenEingang {
  id: number; am: string | null; betrag: string; zahler: string | null; zweck: string; unterwegs?: boolean;
}
interface Person { personId: number; name: string; email: string | null; telefon: string | null; referenzen: string[]; letzte: string | null; gesperrt: boolean }
interface Ziel {
  art: "bestellung" | "rate"; ziel: string; bestellung: string; titel: string; sollCents: number | null; status: string;
  aktion: "buchen" | "zuordnen" | "storno" | null; faellig: string | null; bezahlt: string | null;
}
type Modus = "buchen" | "zuordnen" | "aufgabe";
interface Pruefung { modus: Modus; ziel: string | null; dazu: number[]; storno: boolean; zeile: NachholZeile | null; fehler: string | null }

const euro = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const tag = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(2, 4)}` : "—");
const SICHERHEIT: Record<string, string> = { sicher: "sicher", wahrscheinlich: "wahrscheinlich", unklar: "unklar" };
const ART: Record<string, string> = {
  erstzahlung: "Erstzahlung", rate: "Monatsrate", nur_zuordnen: "Nur zuordnen — schon gebucht", teilzahlung: "Teilzahlung",
  ueberzahlung: "Überzahlung", rueckzahlung_noetig: "Rückzahlung nötig", unbekannt: "Kein Treffer",
};

async function nachholen(body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${API}/admin/zahlungen/bankeingang-nachholen`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    const e = new Error(j?.error || `Fehler ${r.status}`) as Error & { zeile?: NachholZeile };
    e.zeile = j?.zeile ?? undefined;
    throw e;
  }
  return j;
}

function VorschlagKarte({ v, onPruefen, gesperrt }: { v: NachholVorschlag; onPruefen: (p: { modus: Modus; ziel: string | null; dazu: number[] }) => void; gesperrt: boolean }) {
  return (
    <div className={`kz-vorschlag ${v.sicherheit}`}>
      <div className="kz-vorschlag-kopf">
        <b>{v.kunde || "Kein Kunde erkannt"}</b>
        <span className={`kz-marke ${v.sicherheit}`}>{ART[v.art] || v.art} · {SICHERHEIT[v.sicherheit] || v.sicherheit}</span>
      </div>
      <p>{v.text}</p>
      {v.gruende.length > 0 && <p className="kz-leise">Woran erkannt: {v.gruende.join(" · ")}</p>}
      {v.hinweise.length > 0 && <ul className="kz-hinweise">{v.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
      {v.aktion && (v.ziel || v.aktion === "aufgabe") && (
        <button type="button" className="kz-knopf haupt" disabled={gesperrt}
          onClick={() => onPruefen({ modus: v.aktion as Modus, ziel: v.ziel, dazu: v.dazu || [] })}>
          {v.aktion === "buchen" ? `Vorschlag prüfen: auf ${v.ziel} buchen` : v.aktion === "zuordnen" ? `Vorschlag prüfen: ${v.ziel} nur zuordnen` : "Aufgabe anlegen (nicht buchen)"}
        </button>
      )}
    </div>
  );
}

export default function ChefKontoZubuchen({ eingang, onZu, onFertig }: {
  eingang: ZubuchenEingang;
  onZu: () => void;
  onFertig: (meldung: string) => void;
}) {
  const [start, setStart] = useState<{ zeile: NachholZeile | null; fehler: string | null } | null>(null);
  const [suche, setSuche] = useState("");
  const [personen, setPersonen] = useState<Person[] | null>(null);
  const [sucht, setSucht] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [ziele, setZiele] = useState<Ziel[] | null>(null);
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [keinKundeFrage, setKeinKundeFrage] = useState(false);
  const [grund, setGrund] = useState("");
  const suchFeld = useRef<HTMLInputElement>(null);
  const ergebnisRef = useRef<HTMLDivElement>(null);

  // 1. Der Vorschlag: Trockenprobe ohne Ziel (der Server ermittelt den Vorschlag).
  useEffect(() => {
    let aus = false;
    nachholen({ id: eingang.id, trocken: true })
      .then((j) => { if (!aus) setStart({ zeile: j.zeile ?? null, fehler: null }); })
      .catch((e) => { if (!aus) setStart({ zeile: e.zeile ?? null, fehler: e.message }); });
    return () => { aus = true; };
  }, [eingang.id]);

  // Esc schließt, der Fokus geht ins Suchfeld.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape" && !laeuft) onZu(); };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [onZu, laeuft]);
  useEffect(() => { suchFeld.current?.focus(); }, []);

  // 2. Suche über alle Kunden (ab 2 Zeichen, 250 ms Ruhe).
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2) { setPersonen(null); return; }
    let aus = false;
    const t = window.setTimeout(() => {
      setSucht(true);
      fetch(`${API}/admin/zahlungen/zubuchen-suche?q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => { if (!aus) setPersonen(j?.ok ? j.personen : []); })
        .catch(() => { if (!aus) setPersonen([]); })
        .finally(() => { if (!aus) setSucht(false); });
    }, 250);
    return () => { aus = true; window.clearTimeout(t); };
  }, [suche]);

  const personWaehlen = (p: Person) => {
    setPerson(p); setZiele(null); setPruefung(null); setFehler(null);
    fetch(`${API}/admin/zahlungen/zubuchen-ziele?person=${p.personId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setZiele(j?.ok ? j.ziele : []))
      .catch(() => setZiele([]));
  };

  // 3. Prüfen — immer trocken. Erst danach gibt es den Knopf, der bucht.
  const pruefen = useCallback(async (p: { modus: Modus; ziel: string | null; dazu?: number[]; storno?: boolean }) => {
    setFehler(null);
    const basis: Pruefung = { modus: p.modus, ziel: p.ziel, dazu: p.dazu || [], storno: !!p.storno, zeile: null, fehler: null };
    if (p.modus === "aufgabe") { setPruefung(basis); return; }
    setLaeuft(true);
    try {
      const j = await nachholen(p.modus === "zuordnen"
        ? { id: eingang.id, trocken: true, modus: "zuordnen", ziel: p.ziel }
        : { id: eingang.id, trocken: true, ziel: p.ziel, dazu: p.dazu || [], stornoZuruecknehmen: !!p.storno });
      setPruefung({ ...basis, zeile: j.zeile ?? null });
    } catch (e: any) {
      setPruefung({ ...basis, zeile: e.zeile ?? null, fehler: e.message });
    } finally {
      setLaeuft(false);
      window.setTimeout(() => ergebnisRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
    }
  }, [eingang.id]);

  const bereit = !!pruefung && !pruefung.fehler && (
    pruefung.modus === "aufgabe" || (pruefung.zeile && (pruefung.modus === "zuordnen" ? !!pruefung.zeile.zuordenbar : !!pruefung.zeile.buchen))
  );

  const ausfuehren = async () => {
    if (!pruefung || !bereit) return;
    const z = pruefung.zeile;
    setLaeuft(true); setFehler(null);
    try {
      if (pruefung.modus === "aufgabe") {
        const j = await nachholen({ id: eingang.id, trocken: false, modus: "aufgabe" });
        onFertig(`Aufgabe angelegt${j.aufgabe ? ` — ${j.aufgabe}` : ""}. Der Eingang bleibt unverbucht stehen.`);
      } else if (pruefung.modus === "zuordnen" && z) {
        await nachholen({ id: eingang.id, trocken: false, modus: "zuordnen", ziel: pruefung.ziel, erwartet: { ziel: z.ziel, rateId: z.rateId } });
        onFertig(`Zugeordnet: ${eingang.betrag} € → ${z.ziel} (${z.kunde ?? "—"}) — keine zweite Buchung.`);
      } else if (z) {
        const j = await nachholen({
          id: eingang.id, trocken: false, ziel: pruefung.ziel, dazu: z.dazu ?? pruefung.dazu,
          erwartet: { regel: z.regel, ziel: z.ziel, rateId: z.rateId }, stornoZuruecknehmen: pruefung.storno,
        });
        if (!j.ergebnis?.gebucht) throw new Error(j.ergebnis?.grund || "Nicht gebucht.");
        onFertig(`Gebucht: ${euro(z.summeCents ?? Math.round(Number(eingang.betrag) * 100))} → ${z.ziel} (${z.kunde ?? "—"}) — ${j.ergebnis.grund}.`);
      }
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const keinKunde = async () => {
    setLaeuft(true); setFehler(null);
    try {
      await nachholen({ id: eingang.id, trocken: false, modus: "kein_kunde", grund: grund.trim() || null });
      onFertig(`${eingang.betrag} € von ${eingang.zahler || "—"} als „kein Kundengeld“ gekennzeichnet — wird keinem Kunden zugebucht.`);
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const v = start?.zeile?.vorschlag ?? null;
  const direkt = start?.zeile?.buchen ? start.zeile : null;

  // Per Portal an <body>: Die Inhaltsfläche des Chefbüros ist ein eigener Bezugsrahmen (Glas) — darin bliebe die
  // Lade auf die Fläche beschränkt statt über dem ganzen Bildschirm zu liegen.
  return createPortal(
    <div className="kz-huelle" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !laeuft) onZu(); }}>
      <aside className="kz-lade" role="dialog" aria-modal="true" aria-labelledby="kz-titel">
        <header className="kz-kopf">
          <div>
            <span className="kz-auge">Zubuchen</span>
            <h2 id="kz-titel">{eingang.betrag} € <small>von {eingang.zahler || "unbekannt"}</small></h2>
            <p className="kz-leise">{tag(eingang.am)} · Zweck „{eingang.zweck || "—"}“</p>
          </div>
          <button type="button" className="kz-zu" aria-label="Schließen" onClick={onZu} disabled={laeuft}>×</button>
        </header>

        {eingang.unterwegs && (
          <p className="kz-warn">Airwallex meldete diesen Eingang zuletzt als <b>unterwegs</b>. Gebucht wird er erst, wenn er gutgeschrieben ist —
            „Jetzt abrufen“ auf der Kontoseite prüft das sofort nach.</p>
        )}

        {/* 1 · Vorschlag */}
        <section className="kz-teil">
          <h3>Vorschlag</h3>
          {!start && <p className="kz-leise">Wird ermittelt …</p>}
          {start?.fehler && !v && <p className="kz-leise">{start.fehler}</p>}
          {direkt && !v && (
            <div className="kz-vorschlag sicher">
              <div className="kz-vorschlag-kopf"><b>{direkt.kunde || "—"}</b><span className="kz-marke sicher">Referenz trägt · sicher</span></div>
              <p>{direkt.ergebnis}</p>
              <button type="button" className="kz-knopf haupt" disabled={laeuft} onClick={() => void pruefen({ modus: "buchen", ziel: null })}>So buchen — prüfen</button>
            </div>
          )}
          {v && v.art !== "unbekannt" && <VorschlagKarte v={v} gesperrt={laeuft} onPruefen={(p) => void pruefen(p)} />}
          {start && !start.fehler && !direkt && (!v || v.art === "unbekannt") && (
            <p className="kz-leise">{v?.text || "Kein eindeutiger Kunde erkannt — bitte unten suchen."}</p>
          )}
        </section>

        {/* 2 · Aus allen Kunden wählen */}
        <section className="kz-teil">
          <h3>Kunde suchen</h3>
          <input ref={suchFeld} className="kz-feld" type="search" value={suche} placeholder="Name, E-Mail, Telefon oder Referenz (z. B. MUWHF0)"
            onChange={(e) => setSuche(e.target.value)} aria-label="Kunde suchen" />
          {sucht && <p className="kz-leise">Suche …</p>}
          {personen && !sucht && personen.length === 0 && <p className="kz-leise">Niemand gefunden.</p>}
          {personen && personen.length > 0 && !person && (
            <ul className="kz-personen">
              {personen.map((p) => (
                <li key={p.personId}>
                  <button type="button" onClick={() => personWaehlen(p)}>
                    <b>{p.name}</b>
                    <span>{[p.email, p.telefon].filter(Boolean).join(" · ") || "—"}</span>
                    <em>{p.referenzen.join(" · ")}{p.gesperrt ? " · gesperrt" : ""}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {person && (
            <div className="kz-person">
              <div className="kz-person-kopf">
                <div><b>{person.name}</b><span>{person.email || "—"}</span></div>
                <button type="button" className="kz-knopf still" onClick={() => { setPerson(null); setZiele(null); setPruefung(null); }}>Andere Person</button>
              </div>
              {!ziele && <p className="kz-leise">Lade Bestellungen und Raten …</p>}
              {ziele && ziele.length === 0 && <p className="kz-leise">Keine Bestellung mit Zahlungsreferenz.</p>}
              {ziele && ziele.length > 0 && (
                <table className="kz-ziele">
                  <thead><tr><th>Was</th><th>Referenz</th><th>Soll</th><th>Stand</th><th /></tr></thead>
                  <tbody>
                    {ziele.map((z) => (
                      <tr key={`${z.art}-${z.ziel}`} className={pruefung?.ziel === z.ziel ? "an" : ""}>
                        <td>{z.titel}</td>
                        <td className="kz-ref">{z.ziel}</td>
                        <td className="kz-zahl">{euro(z.sollCents)}</td>
                        <td>{z.status}{z.faellig ? ` · fällig ${tag(z.faellig)}` : ""}{z.bezahlt ? ` · bezahlt ${tag(z.bezahlt)}` : ""}</td>
                        <td>
                          {z.aktion === "buchen" && <button type="button" className="kz-knopf" disabled={laeuft} onClick={() => void pruefen({ modus: "buchen", ziel: z.ziel })}>Prüfen</button>}
                          {z.aktion === "zuordnen" && <button type="button" className="kz-knopf still" disabled={laeuft} onClick={() => void pruefen({ modus: "zuordnen", ziel: z.ziel })}>Nur zuordnen</button>}
                          {z.aktion === "storno" && <button type="button" className="kz-knopf still" disabled={laeuft} title="Die Rate ist storniert: Prüfen nimmt den Storno zurück und bucht dann."
                            onClick={() => void pruefen({ modus: "buchen", ziel: z.ziel, storno: true })}>Storno zurück</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* 3 · Prüfergebnis und der eine Knopf */}
        {pruefung && (
          <section className="kz-teil kz-ergebnis" ref={ergebnisRef}>
            <h3>{pruefung.modus === "zuordnen" ? "Nur zuordnen?" : pruefung.modus === "aufgabe" ? "Aufgabe anlegen?" : "So buchen?"}</h3>
            {laeuft && !pruefung.zeile && <p className="kz-leise">Prüfe …</p>}
            {pruefung.fehler && <p className="kz-fehler">{pruefung.fehler}</p>}
            {pruefung.modus === "aufgabe" && (
              <p className="kz-leise">Gebucht wird nichts. Teilzahlungen gehen als Aufgabe an den Betreuer (er klärt den Rest mit dem Kunden),
                Über- und Rückzahlungen an die Zahlungsstelle.</p>
            )}
            {pruefung.zeile && !pruefung.fehler && (
              <dl className="kz-probe">
                <div><dt>Ergebnis</dt><dd>{pruefung.zeile.ergebnis}</dd></div>
                {pruefung.zeile.kunde && <div><dt>Kunde</dt><dd>{pruefung.zeile.kunde}</dd></div>}
                {pruefung.zeile.ziel && <div><dt>Ziel</dt><dd>{pruefung.zeile.ziel}{pruefung.zeile.rateNr ? ` (Rate ${pruefung.zeile.rateNr})` : ""}</dd></div>}
                {pruefung.zeile.mails.length > 0 && <div><dt>Mail an Kunden</dt><dd>{pruefung.zeile.mails.join(" · ")}</dd></div>}
                {pruefung.zeile.provision.length > 0 && <div><dt>Provision</dt><dd>{pruefung.zeile.provision.join(" · ")}</dd></div>}
                {pruefung.zeile.stornoZurueck && <div><dt>Storno</dt><dd>{pruefung.zeile.stornoZurueck}</dd></div>}
                {pruefung.zeile.hinweise.length > 0 && <div><dt>Hinweise</dt><dd>{pruefung.zeile.hinweise.join(" ")}</dd></div>}
              </dl>
            )}
            {pruefung.modus === "zuordnen" && !pruefung.fehler && (
              <p className="kz-leise">„Nur zuordnen“ bucht nichts: Das Geld gehört zu etwas, das schon als bezahlt gebucht ist. Der Eingang bekommt
                seinen Haken, die Rate den Beleg — keine Mail, keine Provision, keine neue Rate.</p>
            )}
            <button type="button" className="kz-knopf haupt gross" disabled={!bereit || laeuft} onClick={() => void ausfuehren()}>
              {laeuft ? "Läuft …" : pruefung.modus === "zuordnen" ? "Jetzt zuordnen" : pruefung.modus === "aufgabe" ? "Aufgabe anlegen" : "Jetzt buchen"}
            </button>
          </section>
        )}

        {fehler && <p className="kz-fehler">{fehler}</p>}

        {/* 4 · Kein Kundengeld */}
        <footer className="kz-fuss">
          {!keinKundeFrage ? (
            <button type="button" className="kz-link" disabled={laeuft} onClick={() => setKeinKundeFrage(true)}>Gehört keinem Kunden (z. B. Prüfbetrag, Gutschrift) …</button>
          ) : (
            <div className="kz-keinkunde">
              <p>Als <b>kein Kundengeld</b> kennzeichnen? Gebucht wird nichts; der Eingang verlässt die offene Liste und steht in FIAON Banking als
                „Sonstiger Eingang“. Zurücknehmen geht jederzeit.</p>
              <input className="kz-feld" value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="Grund (optional), z. B. „Prüfbetrag Google Ads“" maxLength={160} />
              <div className="kz-reihe">
                <button type="button" className="kz-knopf haupt" disabled={laeuft} onClick={() => void keinKunde()}>Als kein Kundengeld kennzeichnen</button>
                <button type="button" className="kz-knopf still" disabled={laeuft} onClick={() => setKeinKundeFrage(false)}>Abbrechen</button>
              </div>
            </div>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
