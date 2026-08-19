// ═══════════════════════════════════════════════════════════════════════════
// VERGÜTUNG & STUNDEN — DIE STEUERUNG, NICHT MEHR EIN MINI-FORMULAR
//
// ── DER BEFUND (20.08.2026, Screenshot des Betreibers) ─────────────────────
// Der Reiter sei „völlig dumm". Gemessen (scripts/mess-verguetung.ts):
//
//   · Ein orangener Kasten „Vom Vorgesetzter zu bestätigen" (Grammatikfehler)
//     stand GANZ OBEN über allem — obwohl er nur die Stunden betrifft.
//   · Darunter zwei lose Felder ohne Überschrift: Stundensatz und Prämie je Rate.
//   · KEINE Bankverbindung. Sie lag im Reiter „Verwaltung", hinter einem Klick
//     auf „Vollständig anzeigen" — der Betreiber sucht sie hier.
//   · „Zeiterfassung nutzt bisher nur das Forderungsmanagement." als loser Satz.
//
// ── DER AUFBAU JETZT ──────────────────────────────────────────────────────
// Fünf Abschnitte, jeder mit Überschrift, in der Reihenfolge, in der man sie
// braucht:
//   1. Bankverbindung   — wohin überwiesen wird (zum Kopieren)
//   2. Vergütungsmodell — Bausteine an- und abschalten
//   3. Vorschau         — was das diesen Monat ergibt
//   4. Stunden & Prämien — inklusive des Bestätigungs-Kastens, der HIERHER gehört
//   5. Verlauf          — wer wann was geändert hat
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";

interface Baustein {
  id: number; typ: string; aktiv: boolean;
  betragCents: number | null; satzBp: number | null;
  modus: string | null; paket: string | null; anlass: string | null;
  rechtsgrund: string | null; buchen: boolean; auszahlungstag: number | null;
  gueltigAb: string; wirktAm: string | null; vermerk: string | null;
  erstelltAm: string; erstelltVon: string | null;
}

/**
 * Heute in Europe/Berlin als JJJJ-MM-TT.
 *
 * ── WARUM NICHT `toISOString().slice(0,10)` ─────────────────────────────────
 * Genau das stand hier im ersten Entwurf, und der Screenshot hat den Fehler
 * gezeigt: „Gültig ab 08/19/2026", während in Berlin schon der 20. war.
 * `toISOString` liefert UTC — zwischen 00:00 und 02:00 Berliner Zeit ist das der
 * VORTAG. Der Server lehnt einen Baustein mit rückwirkender Gültigkeit ab
 * (Einfrier-Prinzip), also hätte der Betreiber in diesen zwei Stunden jede Nacht
 * eine Fehlermeldung bekommen, die er nicht erklären kann.
 * AGENTS.md sagt es ausdrücklich: „Zeitzone ist Europe/Berlin — nie über
 * new Date().toISOString().slice(0,10)."
 */
function heuteBerlin(): string {
  // en-CA liefert JJJJ-MM-TT — genau die Form, die ein date-Feld erwartet.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

/** Der laufende Monat in Berlin als JJJJ-MM. */
function monatBerlin(): string {
  return heuteBerlin().slice(0, 7);
}

const eur = (c: number | null | undefined) =>
  ((Number(c ?? 0)) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const tag = (v: string | null) => (v
  ? new Date(v).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" })
  : "—");

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

/** Eine Überschrift, wie sie in diesem Reiter fünfmal vorkommt. */
function Abschnitt({ titel, unter, children, marke }: {
  titel: string; unter?: string; children: React.ReactNode; marke?: string;
}) {
  return (
    <section className="mb-6" data-fiaon={marke}>
      <h3 className="text-[13.5px] font-bold text-slate-900">{titel}</h3>
      {unter && <p className="text-[12px] text-slate-500 mt-0.5 mb-2.5 leading-relaxed">{unter}</p>}
      {!unter && <div className="mb-2.5" />}
      {children}
    </section>
  );
}

const TYP_TEXT: Record<string, { titel: string; erklaerung: string }> = {
  fixum: {
    titel: "Monatliches Fixum",
    erklaerung: "Ein Festbetrag je Monat, unabhängig von Abschlüssen.",
  },
  provision: {
    titel: "Provision je Abschluss",
    erklaerung: "Prozent vom Abschlusswert oder ein Festbetrag — auf Wunsch je Paket verschieden.",
  },
  pauschale: {
    titel: "Pauschale je Tätigkeit",
    erklaerung: "Ein Betrag für eine erledigte Aufgabe, etwa ein geführtes Startgespräch.",
  },
  stundensatz: {
    titel: "Stundensatz",
    erklaerung: "Für erfasste und bestätigte Arbeitszeit.",
  },
  einmalig: {
    titel: "Einmalige Gutschrift oder Abzug",
    erklaerung: "Bonus, Prämie, Korrektur oder Vorschuss — wirkt auf die nächste Abrechnung.",
  },
};

export default function VerguetungTafel({ agentId, rolle }: { agentId: number; rolle: string }) {
  const [d, setD] = useState<any>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [monat, setMonat] = useState(monatBerlin());
  const [offenerTyp, setOffenerTyp] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  // Stunden-Teil (unverändert in der Sache, nur an seinen Platz gerückt)
  const [stunden, setStunden] = useState<any>(null);
  const [satz, setSatz] = useState("");
  const [art, setArt] = useState("euro");
  const [wert, setWert] = useState("");

  const laden = useCallback(async () => {
    const r = await api(`/admin/verguetung/${agentId}?monat=${monat}`);
    if (r.ok) { setD(r.json); setFehler(null); }
    else setFehler(r.json?.error || `Die Vergütungsdaten kamen nicht (HTTP ${r.status}).`);
    const s = await api(`/admin/inkasso/stunden/${agentId}`);
    if (s.ok) {
      setStunden(s.json);
      const v = s.json.verdienst ?? {};
      setSatz(String((Number(v.stundensatzCents ?? 0) / 100).toFixed(2)).replace(".", ","));
      setArt(String(v.praemieArt || "euro"));
      setWert(String((Number(v.praemieWert ?? 0) / 100).toFixed(2)).replace(".", ","));
    }
  }, [agentId, monat]);
  useEffect(() => { void laden(); }, [laden]);

  if (fehler) {
    return (
      <div className="rounded-xl p-4" role="alert" data-fiaon="verguetung-fehler"
           style={{ border: "1px solid rgba(185,28,28,.3)", background: "rgba(185,28,28,.05)" }}>
        <p className="text-[13.5px] font-bold" style={{ color: "#b91c1c" }}>
          Die Vergütungsdaten sind nicht geladen.
        </p>
        <p className="text-[12.5px] text-slate-600 mt-1">{fehler}</p>
        <button type="button" onClick={() => void laden()}
                className="mt-2 px-3 py-2 rounded-lg border bg-white text-[12.5px] font-semibold"
                style={{ borderColor: "#e2e8f0" }}>Erneut versuchen</button>
      </div>
    );
  }
  if (!d) return <p className="text-[13px] text-slate-400">Wird geladen …</p>;

  const v = stunden?.verdienst ?? {};
  const offeneStunden = (stunden?.stunden ?? []).filter((s: any) => !s.bestaetigt_am);
  const bank = d.bank ?? {};
  const vs = d.vorschau ?? {};

  const speichernBaustein = async (typ: string, koerper: Record<string, unknown>) => {
    setBusy(typ); setHinweis(null);
    const r = await api(`/admin/verguetung/${agentId}/baustein`, {
      method: "POST", body: JSON.stringify({ typ, ...koerper }),
    });
    setBusy(null);
    if (r.ok) {
      setHinweis({ art: "gut", text: [r.json.meldung, r.json.hinweis].filter(Boolean).join(" ") });
      setOffenerTyp(null);
      void laden();
    } else {
      setHinweis({ art: "schlecht", text: r.json?.error || `Fehlgeschlagen (HTTP ${r.status}).` });
    }
  };

  const schalten = async (b: Baustein, an: boolean) => {
    setBusy(`s${b.id}`);
    const r = await api(`/admin/verguetung/baustein/${b.id}/schalter`, {
      method: "POST", body: JSON.stringify({ aktiv: an }),
    });
    setBusy(null);
    setHinweis(r.ok
      ? { art: "gut", text: r.json.meldung }
      : { art: "schlecht", text: r.json?.error || "Fehlgeschlagen." });
    void laden();
  };

  const aktive = (d.bausteine as Baustein[]).filter((b) => b.aktiv);
  const inaktive = (d.bausteine as Baustein[]).filter((b) => !b.aktiv);

  return (
    <>
      {hinweis && (
        <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold leading-relaxed"
           data-fiaon="verguetung-meldung" role="alert"
           style={hinweis.art === "gut"
             ? { background: "rgba(4,120,87,.08)", color: "#047857" }
             : { background: "rgba(185,28,28,.07)", color: "#b91c1c" }}>
          {hinweis.text}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          1 — BANKVERBINDUNG

          Zuerst, weil es die Frage ist, die beim Überweisen zuerst kommt.
          Vollständig und zum Kopieren: Der Betreiber überweist manuell über
          Wise. Eine maskierte IBAN ist dafür wertlos.
          ═══════════════════════════════════════════════════════════════════ */}
      <Abschnitt titel="Bankverbindung" marke="abschnitt-bank"
                 unter="Wohin die Auszahlung geht. Jede Einsicht in die vollständige IBAN wird protokolliert — sie ist ein Zahlungsziel.">
        {/* ── VORHANDEN, ABER NICHT LESBAR ─────────────────────────────────
            Ein eigener Zustand: Die Daten liegen da, der Schlüssel passt nicht.
            Ohne diesen Zweig stünde hier ein leerer Kasten, und der Betreiber
            würde denken, die Bankdaten seien verschwunden. */}
        {bank.vorhanden && bank.lesbar === false && (
          <div className="rounded-xl p-3.5 mb-2" data-fiaon="bank-nicht-lesbar" role="alert"
               style={{ background: "rgba(180,83,9,.07)", border: "1px solid rgba(180,83,9,.28)" }}>
            <p className="text-[13px] font-bold" style={{ color: "#b45309" }}>
              Bankdaten vorhanden, hier aber nicht entschlüsselbar.
            </p>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
              {bank.nichtLesbarGrund}
            </p>
            <p className="text-[13px] mt-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Maskiert:
              </span>{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>{bank.ibanMaskiert || "—"}</code>
            </p>
          </div>
        )}
        {bank.vorhanden && bank.lesbar !== false ? (
          <div className="rounded-xl p-3.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Kontoinhaber</p>
                <p className="text-[13px] text-slate-900 mt-0.5" data-fiaon="bank-inhaber">
                  {bank.kontoinhaber || "—"}
                </p>
              </div>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">BIC / Bank</p>
                <p className="text-[13px] text-slate-900 mt-0.5">{bank.bic || "nicht erfasst"}</p>
              </div>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Zuletzt geändert</p>
                <p className="text-[13px] text-slate-900 mt-0.5">{tag(bank.geaendertAm)}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">IBAN</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <code className="text-[14.5px] font-bold tracking-wide text-slate-900"
                      data-fiaon="bank-iban" style={{ fontFamily: "ui-monospace, monospace" }}>
                  {bank.iban}
                </code>
                <button type="button" data-fiaon="iban-kopieren"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(String(bank.iban ?? ""));
                            setKopiert(true);
                            setTimeout(() => setKopiert(false), 2500);
                          } catch {
                            // Ohne Zwischenablage-Recht kein stiller Fehlschlag:
                            // Der Mensch muss wissen, dass er selbst markieren muss.
                            setHinweis({
                              art: "schlecht",
                              text: "Kopieren hat der Browser abgelehnt — bitte die IBAN markieren "
                                + "und mit Strg+C kopieren.",
                            });
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg border bg-white text-[12px] font-semibold text-slate-700"
                        style={{ borderColor: "#e2e8f0" }}>
                  {kopiert ? "Kopiert" : "IBAN kopieren"}
                </button>
              </div>
            </div>
            {bank.aenderungBestaetigt === false && (
              <p className="text-[11.5px] mt-2.5 font-semibold" style={{ color: "#b45309" }}>
                Die letzte Bankänderung ist noch nicht gegengeprüft. Vor der Überweisung
                bitte kurz mit dem Menschen sprechen — eine geänderte IBAN ist der
                häufigste Betrugsweg.
              </p>
            )}
          </div>
        ) : !bank.vorhanden ? (
          <div className="rounded-xl p-3.5" data-fiaon="bank-fehlt"
               style={{ background: "rgba(180,83,9,.07)", border: "1px solid rgba(180,83,9,.28)" }}>
            <p className="text-[13px] font-bold" style={{ color: "#b45309" }}>
              Keine Bankverbindung hinterlegt — eine Auszahlung ist nicht überweisbar.
            </p>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
              Der Mensch trägt sie selbst im Portal ein (Profil → Bankdaten). Bis dahin kann
              eine Provision entstehen und gebucht werden, aber nicht ausgezahlt.
            </p>
            <button type="button" disabled={busy === "erinnerung"} data-fiaon="bank-erinnerung"
                    onClick={async () => {
                      setBusy("erinnerung"); setHinweis(null);
                      const r = await api(`/admin/verguetung/${agentId}/bank-erinnerung`, { method: "POST" });
                      setBusy(null);
                      setHinweis(r.ok
                        ? { art: "gut", text: r.json.meldung }
                        : { art: "schlecht", text: r.json?.error || "Die Erinnerung ging nicht raus." });
                    }}
                    className="mt-2.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-white disabled:opacity-40"
                    style={{ background: "#b45309" }}>
              {busy === "erinnerung" ? "…" : "Erinnerung senden"}
            </button>
          </div>
        ) : null}
      </Abschnitt>

      {/* ═══════════════════════════════════════════════════════════════════
          2 — VERGÜTUNGSMODELL
          ═══════════════════════════════════════════════════════════════════ */}
      <Abschnitt titel="Vergütungsmodell" marke="abschnitt-modell"
                 unter="Bausteine, die einzeln gelten. Mehrere gleichzeitig sind möglich. Jede Änderung wirkt auf KÜNFTIGE Positionen — bereits gebuchte bleiben, wie sie sind.">
        {/* Was heute gilt, mit Herkunft. */}
        <div className="rounded-xl p-3 mb-3" style={{ background: "#f8fafc", border: "1px solid #eef2f7" }}>
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Was heute gilt
          </p>
          {[
            ["Provision", d.gilt?.provision?.erklaerung, d.gilt?.provision?.herkunft],
            ["Stundensatz", d.gilt?.stundensatz?.erklaerung, d.gilt?.stundensatz?.herkunft],
            ...(d.gilt?.pauschalen ?? []).map((p: any) => [p.text, p.erklaerung, p.herkunft]),
          ].map(([t, e, h]: any) => (
            <p key={String(t)} className="text-[12px] text-slate-700 leading-relaxed">
              <span className="font-semibold">{t}:</span> {e}
              {h === "person" && <span className="text-slate-400"> (Altfeld)</span>}
              {h === "vorgabe" && <span className="text-slate-400"> (Systemvorgabe)</span>}
              {h === "keine" && <span style={{ color: "#b45309" }}> — nicht gesetzt</span>}
            </p>
          ))}
        </div>

        {/* Aktive Bausteine */}
        {aktive.map((b) => (
          <div key={b.id} className="rounded-xl p-3 mb-2" data-fiaon="baustein-aktiv"
               style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900">
                  {TYP_TEXT[b.typ]?.titel ?? b.typ}
                  {b.paket && <span className="text-slate-400"> · {b.paket}</span>}
                  {b.anlass && <span className="text-slate-400"> · {b.anlass}</span>}
                </p>
                <p className="text-[12.5px] text-slate-700 mt-0.5">
                  {b.modus === "prozent" && b.satzBp != null
                    ? `${(b.satzBp / 100).toLocaleString("de-DE")} % vom Abschlusswert`
                    : eur(b.betragCents)}
                  {b.typ === "fixum" && " je Monat"}
                  {b.typ === "stundensatz" && " je Stunde"}
                  <span className="text-slate-400"> · gültig ab {tag(b.gueltigAb)}</span>
                </p>
                {b.rechtsgrund && (
                  <p className="text-[11.5px] mt-0.5"
                     style={{ color: b.buchen ? "#64748b" : "#b45309" }}>
                    Rechtsgrund: {b.rechtsgrund}
                    {!b.buchen && " — läuft über die Lohnabrechnung, wird NICHT als "
                      + "Provisionsgutschrift gebucht"}
                  </p>
                )}
                {b.vermerk && <p className="text-[11.5px] text-slate-500 mt-0.5">{b.vermerk}</p>}
              </div>
              <button type="button" disabled={busy === `s${b.id}`}
                      onClick={() => void schalten(b, false)}
                      data-fiaon="baustein-aus"
                      className="px-2.5 py-1.5 rounded-lg border bg-white text-[11.5px] font-semibold text-slate-600 shrink-0"
                      style={{ borderColor: "#e2e8f0" }}>
                {busy === `s${b.id}` ? "…" : "Abschalten"}
              </button>
            </div>
          </div>
        ))}

        {/* Inaktive — zusammengeklappt, wie der Auftrag es verlangt. */}
        {inaktive.length > 0 && (
          <div className="mb-2">
            {inaktive.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2 py-1.5"
                   data-fiaon="baustein-inaktiv">
                <span className="text-[12px] text-slate-400">
                  {TYP_TEXT[b.typ]?.titel ?? b.typ}
                  {b.anlass ? ` · ${b.anlass}` : ""} · {eur(b.betragCents)} · aus
                </span>
                <button type="button" disabled={busy === `s${b.id}`}
                        onClick={() => void schalten(b, true)}
                        className="text-[11.5px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
                  Einschalten
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Neu anlegen — je Typ ein Knopf, das Formular klappt auf. */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.keys(TYP_TEXT).map((t) => (
            <button key={t} type="button" data-fiaon={`neu-${t}`}
                    onClick={() => setOffenerTyp(offenerTyp === t ? null : t)}
                    className="px-3 py-1.5 rounded-lg border bg-white text-[12px] font-semibold text-slate-700"
                    style={{ borderColor: offenerTyp === t ? "var(--fi-primaer)" : "#e2e8f0" }}>
                {TYP_TEXT[t].titel}
            </button>
          ))}
        </div>

        {offenerTyp && (
          <BausteinFormular typ={offenerTyp} auswahl={d.auswahl}
                            busy={busy === offenerTyp}
                            onAbbrechen={() => setOffenerTyp(null)}
                            onSpeichern={(k) => void speichernBaustein(offenerTyp, k)} />
        )}
      </Abschnitt>

      {/* ═══════════════════════════════════════════════════════════════════
          3 — VORSCHAU

          Sie liest die GEBUCHTEN Positionen dieses Monats, nicht eine eigene
          Rechnung — dieselbe Quelle wie die Abrechnung (fiaon-verguetung.ts).
          ═══════════════════════════════════════════════════════════════════ */}
      <Abschnitt titel="Vorschau" marke="abschnitt-vorschau"
                 unter="Was aktuell für diesen Monat zusammenkommt. Provisionen und Pauschalen sind die tatsächlich gebuchten Positionen — dieselbe Quelle, aus der auch die Abrechnung entsteht.">
        <div className="flex items-center gap-2 mb-2.5">
          <input type="month" value={monat} onChange={(e) => setMonat(e.target.value)}
                 data-fiaon="vorschau-monat"
                 className="px-3 py-2 rounded-xl border border-slate-200 text-[13px]" />
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          {([
            ["Fixum", vs.fixumCents, vs.fixumGebucht === false ? "wird nicht gebucht" : null],
            ["Provisionen", vs.provisionCents, `${vs.provisionAnzahl ?? 0} Abschlüsse`],
            ["Pauschalen", vs.pauschalCents, `${vs.pauschalAnzahl ?? 0} Positionen`],
            ["Stunden", vs.stundenCents,
              `${Math.floor(Number(vs.stundenMinuten ?? 0) / 60)} Std ${Number(vs.stundenMinuten ?? 0) % 60} Min`],
            ["Gutschriften / Abzüge", vs.einmaligCents, `${vs.einmaligAnzahl ?? 0} Positionen`],
          ] as const).map(([t, c, zusatz]) => (
            <div key={t} className="flex items-baseline gap-3 px-3.5 py-2"
                 style={{ borderBottom: "1px solid #f8fafc" }}>
              <span className="text-[12.5px] text-slate-600">{t}</span>
              {zusatz && <span className="text-[11.5px] text-slate-400">{zusatz}</span>}
              <span className="ml-auto text-[13px] font-semibold tabular-nums text-slate-900">
                {eur(c as number)}
              </span>
            </div>
          ))}
          <div className="flex items-baseline gap-3 px-3.5 py-2.5"
               style={{ background: "#f8fafc", borderTop: "2px solid #0f172a" }}>
            <span className="text-[13px] font-bold text-slate-900">Summe</span>
            <span className="ml-auto text-[16px] font-bold tabular-nums"
                  data-fiaon="vorschau-summe" style={{ color: "var(--fi-primaer)" }}>
              {eur(vs.summeCents)}
            </span>
          </div>
        </div>
        {(vs.hinweise ?? []).map((h: string) => (
          <p key={h} className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: "#b45309" }}>
            {h}
          </p>
        ))}
      </Abschnitt>

      {/* ═══════════════════════════════════════════════════════════════════
          4 — STUNDEN & PRÄMIEN

          Der orangene Bestätigungs-Kasten steht JETZT HIER — er betrifft nur
          diesen Abschnitt. Vorher stand er über allem und las sich wie eine
          Warnung über die ganze Seite. Und die Grammatik ist korrigiert:
          „Vom Vorgesetzter" → „Vom Vorgesetzten".
          ═══════════════════════════════════════════════════════════════════ */}
      <Abschnitt titel="Stunden & Prämien" marke="abschnitt-stunden"
                 unter="Erfasste Arbeitszeit und die Prämie je eingezogener Rate.">
        {!v.verguetungBestaetigt && (
          <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] leading-relaxed"
             data-fiaon="stunden-bestaetigen-hinweis"
             style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            <b>Von dir noch zu bestätigen.</b> Die beiden Werte unten sind Platzhalter.
            Solange sie nicht bestätigt sind, wird keine Prämie gebucht und lassen sich keine
            Stunden abrechnen — die Arbeit wird aber vollständig festgehalten und ist
            nachträglich abrechenbar.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Stundensatz (€)
            </label>
            <input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal"
                   className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Prämie je eingezogener Rate
            </label>
            <div className="flex gap-1.5">
              <input value={wert} onChange={(e) => setWert(e.target.value)} inputMode="decimal"
                     className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
              <select value={art} onChange={(e) => setArt(e.target.value)}
                      className="px-2.5 py-2.5 rounded-xl border border-slate-200 text-[13px]">
                <option value="euro">€</option>
                <option value="prozent">% der Rate</option>
              </select>
            </div>
          </div>
        </div>
        <button type="button" disabled={busy === "satz"}
                onClick={async () => {
                  setBusy("satz");
                  const r = await api(`/admin/inkasso/verguetung/${agentId}`, {
                    method: "POST",
                    body: JSON.stringify({
                      stundensatzEuro: Number(satz.replace(",", ".")),
                      praemieArt: art,
                      praemieWert: Number(wert.replace(",", ".")),
                    }),
                  });
                  setBusy(null);
                  setHinweis(r.ok
                    ? { art: "gut", text: r.json.meldung ?? "Gespeichert." }
                    : { art: "schlecht", text: r.json?.error ?? "Fehler." });
                  void laden();
                }}
                className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-40">
          {busy === "satz" ? "…" : v.verguetungBestaetigt ? "Vergütung ändern" : "Vergütung bestätigen"}
        </button>
        <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
          Eine Prämie entsteht nur, wenn eine Rate <b>bankbestätigt gebucht</b> wird und vorher
          dokumentiert bearbeitet wurde — Selbstzahler erzeugen keine.
        </p>

        <div className="grid grid-cols-3 gap-2.5 mt-4 mb-3">
          {[
            { t: "Offen", w: `${Math.floor(Number(v.offeneMinuten ?? 0) / 60)} Std ${Number(v.offeneMinuten ?? 0) % 60} Min` },
            { t: "Bestätigt (Monat)", w: `${Math.floor(Number(v.bestaetigtMinuten ?? 0) / 60)} Std` },
            { t: "Prämien (Monat)", w: eur(v.praemienCents) },
          ].map((k) => (
            <div key={k.t} className="p-3 rounded-xl bg-slate-50">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{k.t}</p>
              <p className="text-[15px] font-bold tabular-nums text-slate-900 mt-0.5">{k.w}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={monat} onChange={(e) => setMonat(e.target.value)}
                 className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
          <button type="button" disabled={busy === "best" || offeneStunden.length === 0}
                  onClick={async () => {
                    setBusy("best");
                    const r = await api(`/admin/inkasso/stunden/${agentId}/bestaetigen`, {
                      method: "POST", body: JSON.stringify({ monat }),
                    });
                    setBusy(null);
                    setHinweis(r.ok
                      ? { art: "gut", text: r.json.meldung ?? "Bestätigt." }
                      : { art: "schlecht", text: r.json?.error ?? "Fehler." });
                    void laden();
                  }}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#047857] disabled:opacity-30">
            {busy === "best" ? "…" : "Monat bestätigen"}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
          Bestätigen macht die Zeilen <b>unveränderlich</b> und legt sie als Position in den
          Auszahlungsweg. Auch du kannst sie danach nicht mehr ändern — das schützt beide Seiten.
        </p>

        <div className="mt-3">
          {(stunden?.stunden ?? []).slice(0, 30).map((s: any) => (
            <div key={s.id} className="py-2 flex flex-wrap items-center gap-x-3 text-[12.5px]"
                 style={{ borderBottom: "1px solid #f8fafc" }}>
              <span className="font-semibold tabular-nums text-slate-800">
                {new Date(s.tag).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
              </span>
              <span className="tabular-nums text-slate-500">
                {String(s.von).slice(0, 5)}–{String(s.bis).slice(0, 5)}
              </span>
              <span className="font-bold tabular-nums text-slate-800">
                {Math.floor(s.minuten / 60)}:{String(s.minuten % 60).padStart(2, "0")}
              </span>
              {s.notiz && <span className="text-[11.5px] text-slate-400 truncate">{s.notiz}</span>}
              <span className="ml-auto text-[11.5px] font-semibold"
                    style={{ color: s.bestaetigt_am ? "#047857" : "#b45309" }}>
                {s.bestaetigt_am ? "bestätigt" : "wartet"}
              </span>
            </div>
          ))}
          {(stunden?.stunden ?? []).length === 0 && (
            <p className="text-[13px] text-slate-400">Noch keine Zeiten erfasst.</p>
          )}
        </div>
        {/* Der Systemhinweis — klein und grau ans Ende, wie der Auftrag sagt.
            Vorher stand er als eigener Satz mitten in der Maske und las sich
            wie eine Fehlermeldung. */}
        {rolle !== "inkasso" && (
          <p className="text-[11px] text-slate-400 mt-2.5" data-fiaon="stunden-systemhinweis">
            Zeiterfassung nutzt bisher nur das Forderungsmanagement.
          </p>
        )}
      </Abschnitt>

      {/* ═══════════════════════════════════════════════════════════════════
          5 — VERLAUF DER ÄNDERUNGEN
          ═══════════════════════════════════════════════════════════════════ */}
      <Abschnitt titel="Verlauf der Änderungen" marke="abschnitt-verlauf"
                 unter="Wer wann was geändert hat. Ein Baustein wird nie überschrieben, sondern abgelöst — damit lesbar bleibt, was im Vormonat galt.">
        {(d.bausteine as Baustein[]).length === 0 ? (
          <p className="text-[12.5px] text-slate-400">
            Noch kein Baustein angelegt. Es gelten die Werte am Mitarbeiter und die
            Systemvorgaben (siehe „Was heute gilt“).
          </p>
        ) : (
          (d.bausteine as Baustein[]).map((b) => (
            <p key={b.id} className="text-[12px] text-slate-500 py-1"
               style={{ borderBottom: "1px solid #f8fafc" }}>
              <span className="tabular-nums">{tag(b.erstelltAm)}</span>
              {" · "}{b.erstelltVon || "Verwaltung"}
              {" · "}{TYP_TEXT[b.typ]?.titel ?? b.typ}
              {b.anlass ? ` (${b.anlass})` : ""}
              {" · "}{b.modus === "prozent" && b.satzBp != null
                ? `${(b.satzBp / 100).toLocaleString("de-DE")} %` : eur(b.betragCents)}
              {" · gültig ab "}{tag(b.gueltigAb)}
              {!b.aktiv && <span className="text-slate-400"> · abgeschaltet</span>}
            </p>
          ))
        )}
      </Abschnitt>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS FORMULAR JE BAUSTEIN — nur die Felder, die der Typ braucht
//
// Ein gemeinsames Formular mit allen Feldern wäre schneller gebaut und im
// Alltag falsch: Bei einer Pauschale gibt es keinen Prozentsatz, bei einem
// Stundensatz keinen Anlass. Leere Felder sehen aus wie fehlende Daten — genau
// der Fehler, der im Abrechnungs-PDF vier Wochen lang „Rate —" gedruckt hat.
// ═══════════════════════════════════════════════════════════════════════════
function BausteinFormular({ typ, auswahl, busy, onSpeichern, onAbbrechen }: {
  typ: string; auswahl: any; busy: boolean;
  onSpeichern: (k: Record<string, unknown>) => void;
  onAbbrechen: () => void;
}) {
  const [betrag, setBetrag] = useState("");
  const [prozent, setProzent] = useState("");
  const [modus, setModus] = useState("prozent");
  const [paket, setPaket] = useState("");
  const [anlass, setAnlass] = useState(auswahl?.anlaesse?.[0]?.schluessel ?? "");
  const [rechtsgrund, setRechtsgrund] = useState("dienstvertrag");
  const [gueltigAb, setGueltigAb] = useState(heuteBerlin());
  const [vermerk, setVermerk] = useState("");
  const [auszahlungstag, setAuszahlungstag] = useState("1");

  const rg = (auswahl?.rechtsgruende ?? []).find((r: any) => r.schluessel === rechtsgrund);

  return (
    <div className="rounded-xl p-3.5 mt-2.5" data-fiaon="baustein-formular"
         style={{ background: "#f8fafc", border: "1px solid var(--fi-primaer)" }}>
      <p className="text-[12.5px] font-bold text-slate-900">{TYP_TEXT[typ]?.titel}</p>
      <p className="text-[11.5px] text-slate-500 mb-2.5">{TYP_TEXT[typ]?.erklaerung}</p>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {typ === "provision" && (
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Modus</span>
            <select value={modus} onChange={(e) => setModus(e.target.value)}
                    data-fiaon="feld-modus"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]">
              <option value="prozent">Prozent vom Abschlusswert</option>
              <option value="festbetrag">Festbetrag je Abschluss</option>
            </select>
          </label>
        )}
        {typ === "provision" && modus === "prozent" ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Satz (%)</span>
            <input value={prozent} onChange={(e) => setProzent(e.target.value)} inputMode="decimal"
                   placeholder="20" data-fiaon="feld-prozent"
                   className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Betrag (€){typ === "einmalig" ? " — negativ für Abzug" : ""}
            </span>
            <input value={betrag} onChange={(e) => setBetrag(e.target.value)} inputMode="decimal"
                   placeholder={typ === "einmalig" ? "-50,00" : "15,00"} data-fiaon="feld-betrag"
                   className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
          </label>
        )}
        {typ === "provision" && (
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Nur für Paket
            </span>
            <select value={paket} onChange={(e) => setPaket(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]">
              <option value="">Alle Pakete</option>
              {(auswahl?.pakete ?? []).map((p: string) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
        {typ === "pauschale" && (
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Anlass</span>
            <select value={anlass} onChange={(e) => setAnlass(e.target.value)}
                    data-fiaon="feld-anlass"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]">
              {(auswahl?.anlaesse ?? []).map((a: any) => (
                <option key={a.schluessel} value={a.schluessel}>{a.text}</option>
              ))}
            </select>
          </label>
        )}
        {typ === "fixum" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Rechtsgrund
              </span>
              <select value={rechtsgrund} onChange={(e) => setRechtsgrund(e.target.value)}
                      data-fiaon="feld-rechtsgrund"
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]">
                {(auswahl?.rechtsgruende ?? []).map((r: any) => (
                  <option key={r.schluessel} value={r.schluessel}>{r.text}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Auszahlungstag
              </span>
              <input value={auszahlungstag} onChange={(e) => setAuszahlungstag(e.target.value)}
                     inputMode="numeric"
                     className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            Gültig ab
          </span>
          <input type="date" value={gueltigAb} onChange={(e) => setGueltigAb(e.target.value)}
                 data-fiaon="feld-gueltig-ab"
                 className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
        </label>
      </div>

      {/* Der Hinweis zur Anstellung erscheint SOFORT bei der Wahl — nicht erst
          nach dem Speichern. Eine Warnung, die man erst hinterher liest, ist
          keine Warnung. */}
      {typ === "fixum" && rg && rg.buchen === false && (
        <p className="text-[12px] mt-2.5 px-3 py-2 rounded-lg leading-relaxed"
           data-fiaon="hinweis-anstellung"
           style={{ background: "rgba(180,83,9,.08)", color: "#b45309" }}>
          {rg.hinweis}
        </p>
      )}

      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
          Vermerk{typ === "einmalig" ? " (Pflicht — erscheint auf der Abrechnung)" : ""}
        </span>
        <textarea value={vermerk} onChange={(e) => setVermerk(e.target.value)} rows={2}
                  data-fiaon="feld-vermerk"
                  placeholder={typ === "einmalig"
                    ? "Warum? Der Mitarbeiter liest diesen Satz auf seiner Abrechnung."
                    : "Optional: warum diese Vereinbarung so ist."}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-[13px] resize-y" />
      </label>

      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" disabled={busy} data-fiaon="baustein-speichern"
                onClick={() => onSpeichern({
                  betragEuro: betrag || null,
                  satzProzent: prozent || null,
                  modus, paket: paket || null, anlass: anlass || null,
                  rechtsgrund, gueltigAb, vermerk, auszahlungstag,
                })}
                className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-40">
          {busy ? "…" : "Baustein speichern"}
        </button>
        <button type="button" onClick={onAbbrechen}
                className="px-3 py-2.5 rounded-xl border bg-white text-[12.5px] font-semibold text-slate-600"
                style={{ borderColor: "#e2e8f0" }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
