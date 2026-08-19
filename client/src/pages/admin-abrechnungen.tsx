// ═══════════════════════════════════════════════════════════════════════════
// /admin/abrechnungen — DIE ABRECHNUNGS-ZENTRALE
//
// ── WOZU (19.08.2026) ─────────────────────────────────────────────────────
// „Keine zentrale Einsicht." Zehn Provisionsabrechnungen lagen in der
// Datenbank, das PDF als base64 in der Zeile — und es gab keinen Ort, an dem
// der Betreiber sie sehen, prüfen oder verschicken konnte. Der einzige Weg
// führte über das Portal des Mitarbeiters.
//
// Drei Dinge kann man hier, und mehr nicht: EINSEHEN (PDF), BEREITHALTEN
// (herunterladen), SENDEN. Plus „Neu erzeugen" — aber nur, solange die
// Abrechnung kein Buchungsbeleg ist.
//
// ── WAS BEWUSST FEHLT ─────────────────────────────────────────────────────
// Kein Löschen, kein Bearbeiten von Beträgen, kein Anlegen von Hand. Eine
// Abrechnung entsteht aus einer Auszahlung — wer sie hier anlegen könnte,
// hätte zwei Wahrheiten über dasselbe Geld.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageIntro } from "../components/admin/PageHelp";

interface Abrechnung {
  id: number;
  nummer: string;
  agentId: number;
  mitarbeiter: string;
  rolle: string | null;
  email: string | null;
  auszahlungId: number | null;
  zeitraumVon: string | null;
  zeitraumBis: string | null;
  erzeugtAm: string;
  bruttoCents: number;
  betragCents: number;
  positionen: number;
  hatPdf: boolean;
  zustand: "erzeugt" | "gesendet" | "ausgezahlt";
  auszahlungStatus: string | null;
  auszahlungAm: string | null;
  gesendetAm: string | null;
  gesendetAn: string | null;
  sendeAnzahl: number;
  neuErzeugtAm: string | null;
  neuErzeugtAnzahl: number;
  pruefsumme: string | null;
  darfNeuErzeugen: boolean;
  neuErzeugenGrund: string | null;
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const eur = (c: number) =>
  (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const tag = (v: string | null) => (v
  ? new Date(v).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" })
  : "—");

const zeit = (v: string | null) => (v
  ? new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "—");

const ZUSTAND: Record<string, { text: string; farbe: string; hinter: string }> = {
  erzeugt: { text: "erzeugt", farbe: "#b45309", hinter: "rgba(180,83,9,.10)" },
  gesendet: { text: "gesendet", farbe: "#1d4ed8", hinter: "rgba(29,78,216,.10)" },
  ausgezahlt: { text: "ausgezahlt", farbe: "#047857", hinter: "rgba(4,120,87,.10)" },
};

export default function AdminAbrechnungenSeite() {
  const [liste, setListe] = useState<Abrechnung[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<{ id: number; name: string; anzahl: number }[]>([]);
  const [zahlen, setZahlen] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [offen, setOffen] = useState<number | null>(null);

  const [agent, setAgent] = useState("");
  const [zustand, setZustand] = useState("alle");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [suche, setSuche] = useState("");

  const laden = useCallback(async () => {
    setLaedt(true);
    const p = new URLSearchParams();
    if (agent) p.set("agent", agent);
    if (zustand !== "alle") p.set("zustand", zustand);
    if (von) p.set("von", von);
    if (bis) p.set("bis", bis);
    if (suche.trim()) p.set("q", suche.trim());
    const r = await api(`/admin/abrechnungen?${p.toString()}`);
    if (r.ok) {
      setListe(r.json.abrechnungen);
      setMitarbeiter(r.json.mitarbeiter);
      setZahlen(r.json.zahlen);
      setFehler(null);
    } else {
      // Kein stiller Ausstieg: Eine Liste, die leer bleibt, ohne zu sagen warum,
      // ist der Fehler, den die Vertriebsleitung als „weißes Fenster" gemeldet hat.
      setFehler(r.json?.error || `Die Liste kam nicht (HTTP ${r.status}).`);
    }
    setLaedt(false);
  }, [agent, zustand, von, bis, suche]);

  useEffect(() => {
    const t = setTimeout(() => void laden(), suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [laden, suche]);

  const senden = async (a: Abrechnung) => {
    const wiederholung = a.sendeAnzahl > 0;
    if (!confirm(wiederholung
      ? `${a.nummer} ERNEUT an ${a.email} senden?\n\n`
        + `Sie ging schon ${a.sendeAnzahl}× raus, zuletzt am ${zeit(a.gesendetAm)}. `
        + "Der Vermerk „erneut gesendet“ steht danach an der Abrechnung."
      : `${a.nummer} an ${a.email} senden?\n\n`
        + `${a.mitarbeiter} bekommt die Abrechnung als PDF-Link per Mail.`)) return;
    setBusy(a.id); setMeldung(null);
    const r = await api(`/admin/abrechnungen/${a.id}/senden`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      setMeldung({ art: "gut", text: r.json.meldung });
      void laden();
    } else {
      // Der Grund BLEIBT STEHEN. Ein Kurzhinweis, der nach vier Sekunden geht,
      // ist bei einem fehlgeschlagenen Versand keine Auskunft.
      setMeldung({ art: "schlecht", text: r.json?.error || `Senden fehlgeschlagen (HTTP ${r.status}).` });
    }
  };

  const neuErzeugen = async (a: Abrechnung) => {
    if (!confirm(`${a.nummer} mit dem aktuellen Layout neu erzeugen?\n\n`
      + "Die Nummer und die Positionen bleiben unverändert — nur das PDF wird neu "
      + "gedruckt.")) return;
    setBusy(a.id); setMeldung(null);
    const r = await api(`/admin/abrechnungen/${a.id}/neu-erzeugen`, { method: "POST" });
    setBusy(null);
    if (r.ok) { setMeldung({ art: "gut", text: r.json.meldung }); void laden(); }
    else setMeldung({ art: "schlecht", text: r.json?.error || `Fehlgeschlagen (HTTP ${r.status}).` });
  };

  const gefiltert = useMemo(() => liste, [liste]);

  // Die Hülle (AdminShell) setzt App.tsx über den `admin()`-Wrapper — eine
  // zweite Hülle in der Seite hätte Menü und Kopf doppelt gezeichnet.
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <PageIntro
        id="abrechnungen"
        title="Abrechnungen"
        subtitle="Alle Provisionsabrechnungen an einem Ort — ansehen, herunterladen, an den Mitarbeiter senden."
        steps={[
          "Eine Abrechnung entsteht automatisch, wenn du eine Auszahlung freigibst. Anlegen oder Beträge ändern geht hier nicht — es gäbe zwei Wahrheiten über dasselbe Geld.",
          "„PDF ansehen“ öffnet den Beleg in einem neuen Tab, „Herunterladen“ speichert ihn. „An Mitarbeiter senden“ schickt den Link per Mail; jede Sendung steht mit Datum an der Zeile.",
          "„Neu erzeugen“ druckt das PDF mit dem aktuellen Layout — nur solange die Auszahlung noch nicht erfolgt ist. Danach ist die Abrechnung ein Buchungsbeleg.",
        ]}
      />
      <div>
        {/* ── ERKLÄRUNG: WAS EIN BELEG IST ─────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <p className="text-[13px] font-bold text-slate-800">Was hier steht und was nicht geht</p>
          <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">
            Jede Provisionsabrechnung entsteht aus einer freigegebenen Auszahlung — deshalb kann man
            sie hier nicht anlegen und nicht ändern. <b>Sobald die Auszahlung erfolgt ist, ist die
            Abrechnung ein Buchungsbeleg</b> und wird nicht mehr neu erzeugt; senden bleibt möglich,
            weil Menschen Mails verlieren. Jede Sendung steht mit Datum und Adresse an der Zeile.
          </p>
        </div>

        {/* ── KENNZAHLEN ───────────────────────────────────────────────── */}
        {zahlen && (
          <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
            {([
              ["Abrechnungen", String(zahlen.alle)],
              ["Nur erzeugt", String(zahlen.erzeugt)],
              ["Gesendet", String(zahlen.gesendet)],
              ["Ausgezahlt", String(zahlen.ausgezahlt)],
              ["Summe", eur(zahlen.summeCents)],
              ["Ohne PDF", String(zahlen.ohnePdf)],
            ] as const).map(([t, w]) => (
              <div key={t} className="px-3 py-2.5 rounded-xl bg-white" style={{ border: "1px solid #e2e8f0" }}>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{t}</p>
                <p className="text-[16px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── FILTER ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mitarbeiter</span>
            <select value={agent} onChange={(e) => setAgent(e.target.value)}
                    data-fiaon="filter-mitarbeiter"
                    className="h-[36px] px-2.5 rounded-xl border bg-white text-[13px]"
                    style={{ borderColor: "#e2e8f0", minWidth: 190 }}>
              <option value="">Alle</option>
              {mitarbeiter.filter((m) => m.anzahl > 0).map((m) => (
                <option key={m.id} value={String(m.id)}>{m.name} ({m.anzahl})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
            <select value={zustand} onChange={(e) => setZustand(e.target.value)}
                    data-fiaon="filter-zustand"
                    className="h-[36px] px-2.5 rounded-xl border bg-white text-[13px]"
                    style={{ borderColor: "#e2e8f0" }}>
              <option value="alle">Alle</option>
              <option value="erzeugt">Nur erzeugt</option>
              <option value="gesendet">Gesendet</option>
              <option value="ausgezahlt">Ausgezahlt</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zeitraum von</span>
            <input type="date" value={von} onChange={(e) => setVon(e.target.value)}
                   className="h-[36px] px-2.5 rounded-xl border bg-white text-[13px]" style={{ borderColor: "#e2e8f0" }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">bis</span>
            <input type="date" value={bis} onChange={(e) => setBis(e.target.value)}
                   className="h-[36px] px-2.5 rounded-xl border bg-white text-[13px]" style={{ borderColor: "#e2e8f0" }} />
          </label>
          <label className="flex flex-col gap-1 flex-1" style={{ minWidth: 200 }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suche</span>
            <input value={suche} onChange={(e) => setSuche(e.target.value)}
                   placeholder="Abrechnungs-Nr. oder Name"
                   data-fiaon="suche"
                   className="h-[36px] px-3 rounded-xl border bg-white text-[13px]" style={{ borderColor: "#e2e8f0" }} />
          </label>
          {(agent || zustand !== "alle" || von || bis || suche) && (
            <button type="button"
                    onClick={() => { setAgent(""); setZustand("alle"); setVon(""); setBis(""); setSuche(""); }}
                    className="h-[36px] px-3 rounded-xl border bg-white text-[12.5px] font-semibold text-slate-600"
                    style={{ borderColor: "#e2e8f0" }}>
              Filter zurücksetzen
            </button>
          )}
        </div>

        {meldung && (
          <div className="rounded-xl p-3.5 mb-3" data-fiaon="meldung" role="alert"
               style={{
                 background: meldung.art === "gut" ? "rgba(4,120,87,.07)" : "rgba(185,28,28,.07)",
                 border: `1px solid ${meldung.art === "gut" ? "rgba(4,120,87,.25)" : "rgba(185,28,28,.25)"}`,
               }}>
            <p className="text-[13px] font-semibold"
               style={{ color: meldung.art === "gut" ? "#047857" : "#b91c1c" }}>
              {meldung.text}
            </p>
            <button type="button" onClick={() => setMeldung(null)}
                    className="text-[11.5px] font-semibold text-slate-500 mt-1">Ausblenden</button>
          </div>
        )}

        {fehler && (
          <div className="rounded-xl p-4 mb-3" data-fiaon="fehler" role="alert"
               style={{ background: "rgba(185,28,28,.06)", border: "1px solid rgba(185,28,28,.3)" }}>
            <p className="text-[13.5px] font-bold" style={{ color: "#b91c1c" }}>
              Die Liste ist nicht geladen.
            </p>
            <p className="text-[12.5px] text-slate-600 mt-1">{fehler}</p>
            <button type="button" onClick={() => void laden()}
                    className="mt-2 px-3 py-2 rounded-lg border bg-white text-[12.5px] font-semibold"
                    style={{ borderColor: "#e2e8f0" }}>Erneut versuchen</button>
          </div>
        )}

        {/* ── DIE LISTE ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          <div className="hidden md:grid px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400"
               style={{ gridTemplateColumns: "176px minmax(150px,1fr) 156px 110px 118px minmax(160px,1fr)", gap: 12, borderBottom: "1px solid #eef2f7" }}>
            <span>Nummer</span><span>Mitarbeiter</span><span>Zeitraum</span>
            <span className="text-right">Betrag</span><span>Status</span><span>Erzeugt / gesendet</span>
          </div>

          {laedt && (
            <div className="px-4 py-6 text-[13px] text-slate-400">Wird geladen …</div>
          )}
          {!laedt && gefiltert.length === 0 && !fehler && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13.5px] font-semibold text-slate-700">Keine Abrechnung zu diesen Filtern.</p>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Abrechnungen entstehen, wenn eine Auszahlung freigegeben wird.
              </p>
            </div>
          )}

          {gefiltert.map((a) => {
            const z = ZUSTAND[a.zustand];
            const auf = offen === a.id;
            return (
              <div key={a.id} data-fiaon="abrechnung-zeile" style={{ borderBottom: "1px solid #f8fafc" }}>
                <div className="px-4 py-3 md:grid flex flex-col gap-1.5"
                     style={{ gridTemplateColumns: "176px minmax(150px,1fr) 156px 110px 118px minmax(160px,1fr)", gap: 12, alignItems: "center" }}>
                  <button type="button" onClick={() => setOffen(auf ? null : a.id)}
                          className="text-left text-[12.5px] font-bold text-slate-800 tabular-nums">
                    {a.nummer}
                  </button>
                  <span className="text-[12.5px] text-slate-700">
                    {a.mitarbeiter}
                    {a.rolle && <span className="text-slate-400"> · {a.rolle}</span>}
                  </span>
                  <span className="text-[12px] text-slate-500 tabular-nums">
                    {tag(a.zeitraumVon)}
                    {a.zeitraumBis && tag(a.zeitraumBis) !== tag(a.zeitraumVon) ? ` – ${tag(a.zeitraumBis)}` : ""}
                  </span>
                  <span className="text-[13px] font-bold text-slate-900 tabular-nums md:text-right">
                    {eur(a.betragCents)}
                  </span>
                  <span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                          data-fiaon={`zustand-${a.zustand}`}
                          style={{ background: z.hinter, color: z.farbe }}>{z.text}</span>
                  </span>
                  <span className="text-[11.5px] text-slate-500">
                    {zeit(a.erzeugtAm)}
                    {a.gesendetAm && (
                      <span data-fiaon="sende-vermerk">
                        {" · "}
                        {a.sendeAnzahl > 1
                          ? `erneut gesendet am ${zeit(a.gesendetAm)} (${a.sendeAnzahl}×)`
                          : `gesendet am ${zeit(a.gesendetAm)}`}
                      </span>
                    )}
                  </span>
                </div>

                {/* ── DIE DREI HANDLUNGEN ────────────────────────────── */}
                <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                  <a href={`/api/fiaon/admin/abrechnungen/${a.id}.pdf`} target="_blank" rel="noreferrer"
                     data-fiaon="pdf-ansehen"
                     className="px-3 py-1.5 rounded-lg border bg-white text-[12px] font-semibold text-slate-700"
                     style={{ borderColor: "#e2e8f0", opacity: a.hatPdf ? 1 : .4, pointerEvents: a.hatPdf ? "auto" : "none" }}>
                    PDF ansehen
                  </a>
                  <a href={`/api/fiaon/admin/abrechnungen/${a.id}.pdf?download=1`}
                     data-fiaon="pdf-laden"
                     className="px-3 py-1.5 rounded-lg border bg-white text-[12px] font-semibold text-slate-700"
                     style={{ borderColor: "#e2e8f0", opacity: a.hatPdf ? 1 : .4, pointerEvents: a.hatPdf ? "auto" : "none" }}>
                    Herunterladen
                  </a>
                  <button type="button" disabled={busy === a.id || !a.hatPdf}
                          onClick={() => void senden(a)}
                          data-fiaon="senden"
                          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-40"
                          style={{ background: "#1d4ed8" }}>
                    {busy === a.id ? "…" : a.sendeAnzahl > 0 ? "Erneut senden" : "An Mitarbeiter senden"}
                  </button>
                  <button type="button"
                          disabled={busy === a.id || !a.darfNeuErzeugen}
                          onClick={() => void neuErzeugen(a)}
                          data-fiaon="neu-erzeugen"
                          title={a.neuErzeugenGrund ?? undefined}
                          className="px-3 py-1.5 rounded-lg border bg-white text-[12px] font-semibold text-slate-700 disabled:opacity-40"
                          style={{ borderColor: "#e2e8f0" }}>
                    Neu erzeugen
                  </button>
                  {a.auszahlungId != null && (
                    <a href="/admin/auszahlungen" data-fiaon="zur-auszahlung"
                       className="text-[11.5px] font-semibold" style={{ color: "#1d4ed8" }}>
                      Zur Auszahlung #{a.auszahlungId}
                    </a>
                  )}
                  {/* Der Sperrgrund steht als TEXT, nicht nur im Tooltip: Ein
                      grauer Knopf ohne ein Wort daneben ist der Fehler, den das
                      Team beim Zahlungsdaten-Senden gemeldet hat. */}
                  {!a.darfNeuErzeugen && (
                    <span className="text-[11.5px] text-slate-500" data-fiaon="neu-erzeugen-grund">
                      {a.neuErzeugenGrund}
                    </span>
                  )}
                  {!a.hatPdf && (
                    <span className="text-[11.5px] font-semibold" style={{ color: "#b45309" }}>
                      Kein PDF vorhanden — bitte neu erzeugen.
                    </span>
                  )}
                </div>

                {auf && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl p-3.5" style={{ background: "#f8fafc", border: "1px solid #eef2f7" }}>
                      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
                        {([
                          ["Positionen", String(a.positionen)],
                          ["Brutto-Provisionen", eur(a.bruttoCents)],
                          ["Auszahlungsbetrag", eur(a.betragCents)],
                          ["Auszahlung", a.auszahlungStatus ?? "—"],
                          ["Ausgezahlt am", tag(a.auszahlungAm)],
                          ["Gesendet an", a.gesendetAn ?? "—"],
                          ["Sendungen", String(a.sendeAnzahl)],
                          ["Neu erzeugt", a.neuErzeugtAnzahl > 0 ? `${a.neuErzeugtAnzahl}× · ${zeit(a.neuErzeugtAm)}` : "nie"],
                          ["Prüfsumme", a.pruefsumme ?? "—"],
                        ] as const).map(([t, w]) => (
                          <div key={t}>
                            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{t}</p>
                            <p className="text-[12.5px] text-slate-800 mt-0.5">{w}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
