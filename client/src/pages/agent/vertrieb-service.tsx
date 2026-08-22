import { useCallback, useEffect, useState } from "react";
import { Skelett, eur, useToast } from "@/lib/fiaon-ui";
import { zahlungsstatusText } from "@shared/fiaon-kundenstatus";

// ═══════════════════════════════════════════════════════════════════════════
// SERVICESICHT DER VERTRIEBSLEITUNG — Zahlungen, Dokumente, Zugang
//
// Gemeldet am 06.08.2026: „Damit ich Vertrieblern bei Fragen und kleineren
// Kundenproblemen direkt helfen kann, ohne dass alles bei dir landet."
//
// Drei Listen, die vorher nur der Vorgesetzte sehen konnte. Sie sind bewusst
// getrennt, obwohl sie denselben Bestand betreffen: Es sind drei verschiedene
// Arbeiten. Wer Zahlungen prüft, ist in einem anderen Kopf als wer Unterlagen
// nachfordert — eine gemischte Liste wäre schneller gebaut und langsamer
// abzuarbeiten.
//
// Die Buchung einer Zahlung ist die schwerste Handlung im ganzen Portal. Sie
// braucht deshalb einen Vorgang, keinen Knopf: Nachweis benennen, Eingangsdatum
// eintragen, in einem Satz festhalten, was geprüft wurde. Das ist zwei Klicks
// mehr — und der Unterschied zwischen einer Buchung, die man später erklären
// kann, und einer, die man nur beteuern kann.
// ═══════════════════════════════════════════════════════════════════════════

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const dtag = (v: string | null) => v
  ? new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
  : "—";
const heuteIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ZAHLUNG_FILTER = [
  { key: "gemeldet", label: zahlungsstatusText("claimed_paid") },
  { key: "bankeingang", label: "Geld belegt" },
  { key: "frist_abgelaufen", label: "Frist abgelaufen" },
  { key: "zusage_heute", label: "Zusage heute" },
  { key: "alle", label: "Alle offenen" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Zahlungen
// ═══════════════════════════════════════════════════════════════════════════
export function VertriebZahlungen({ onGebucht }: { onGebucht: () => void }) {
  // Standard ist „Kunde sagt bezahlt" — das ist die eigentliche Arbeit. Zuerst
  // stand hier „Geld belegt": Der Filter ist der wertvollste, aber meistens leer
  // (der Bankbestand endet beim letzten Import), und eine leere Seite beim
  // Öffnen sieht aus wie ein Fehler.
  const [filter, setFilter] = useState("gemeldet");
  const [suche, setSuche] = useState("");
  const [zeilen, setZeilen] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [buchen, setBuchen] = useState<any>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const p = new URLSearchParams({ filter });
    if (suche.trim()) p.set("q", suche.trim());
    const r = await api(`/agent/vertrieb/zahlungen?${p.toString()}`);
    if (r.ok) setZeilen(r.json.zahlungen);
    setLaedt(false);
  }, [filter, suche]);

  useEffect(() => {
    const t = setTimeout(() => void laden(), suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [laden, suche]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {ZAHLUNG_FILTER.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150"
                  style={filter === f.key
                    ? { background: "var(--fi-primaer)", color: "#fff", boxShadow: "0 4px 12px -6px rgba(29,78,216,.6)" }
                    : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
            {f.label}
          </button>
        ))}
        <input value={suche} onChange={(e) => setSuche(e.target.value)}
               placeholder="Name, E-Mail, Verwendungszweck"
               className="ml-auto h-[34px] px-3 rounded-xl border bg-white text-[13px] outline-none w-[220px]"
               style={{ borderColor: "var(--fi-linie)" }} />
      </div>

      <div className="fi-karte overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ background: "var(--fi-seite)" }}>
                {["Kunde", "Verwendungszweck", "Betrag", "Stand", "Frist", "Zuständig", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.07em] whitespace-nowrap"
                      style={{ color: "var(--fi-text-still)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laedt && [0, 1, 2, 3].map((i) => (
                <tr key={i}><td colSpan={7} className="px-3 py-3"><Skelett h={16} /></td></tr>
              ))}
              {!laedt && zeilen.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>
                  {filter === "bankeingang"
                    ? "Kein offener Bankeingang, dessen Verwendungszweck auf eine offene Bestellung zeigt."
                    : "Hier ist gerade nichts offen."}
                </td></tr>
              )}
              {!laedt && zeilen.map((z) => (
                <tr key={z.ref} style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                  <td className="px-3 py-2.5">
                    <span className="block text-[13px] font-semibold">{z.name}</span>
                    <span className="block text-[11px]" style={{ color: "var(--fi-text-still)" }}>{z.email || z.ref}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono whitespace-nowrap">{z.verwendungszweck || "—"}</td>
                  <td className="px-3 py-2.5 text-[12.5px] font-semibold fi-zahl whitespace-nowrap">
                    {z.betragCent != null ? eur(z.betragCent) : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[12px] font-semibold"
                          style={{ color: z.status === "claimed_paid" ? "var(--fi-tier1)" : "var(--fi-tier2)" }}>
                      {/* Ein Text je Zustand — aus shared/fiaon-kundenstatus.ts.
                          „Kunde sagt bezahlt" hieß hier anders als in jeder
                          anderen Ansicht; jetzt steht überall dasselbe. */}
                      {zahlungsstatusText(z.status)}
                    </span>
                    {z.bankTreffer > 0 && (
                      <span className="ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(5,150,105,.10)", color: "var(--fi-erfolg)" }}>
                        Geld belegt
                      </span>
                    )}
                    {/* Hinterlegter Überweisungsbeleg — ein Klick, statt in der
                        WhatsApp-Gruppe zu suchen. */}
                    {z.beleg?.vorhanden && (
                      <a href={z.beleg.url} target="_blank" rel="noopener noreferrer"
                         className="ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md underline decoration-dotted"
                         style={{ background: "rgba(29,78,216,.08)", color: "var(--fi-primaer)" }}
                         title={`Beleg vom ${z.beleg.datum || "—"}, hinterlegt von ${z.beleg.von || "—"}`}>
                        Beleg {z.beleg.datum || ""}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] whitespace-nowrap"
                      style={{ color: z.frist && new Date(z.frist) < new Date() ? "var(--fi-tier1)" : "var(--fi-text-still)" }}>
                    {dtag(z.frist)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] whitespace-nowrap">{z.agentName || "niemand"}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => setBuchen(z)}
                            className="fi-zweitknopf px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap">
                      Prüfen &amp; buchen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!laedt && zeilen.length > 0 && (
          <p className="px-3 py-2 text-[11.5px]" style={{ background: "var(--fi-seite)", color: "var(--fi-text-still)" }}>
            {zeilen.length} offene Zahlung{zeilen.length === 1 ? "" : "en"} · Buchen schaltet das Konto frei und schickt die Bestätigung an den Kunden
          </p>
        )}
      </div>

      {buchen && (
        <BuchenDialog zahlung={buchen} onSchliessen={() => setBuchen(null)}
                      onFertig={() => { setBuchen(null); void laden(); onGebucht(); }} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Buchen — mit Beleg, oder gar nicht
// ═══════════════════════════════════════════════════════════════════════════
export function BuchenDialog({ zahlung, onSchliessen, onFertig }: { zahlung: any; onSchliessen: () => void; onFertig: () => void }) {
  const { zeige } = useToast();
  const [lage, setLage] = useState<any>(null);
  const [art, setArt] = useState<"bankeingang" | "beleg" | null>(null);
  const [bankId, setBankId] = useState<number | null>(null);
  const [datum, setDatum] = useState(heuteIso());
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!zahlung.personId) { setLage({ zahlung: [], dokumente: null, zugang: null }); return; }
    api(`/agent/vertrieb/person/${zahlung.personId}/lage`).then((r) => {
      if (r.ok) setLage(r.json);
      else setLage({ zahlung: [], dokumente: null, zugang: null });
    });
  }, [zahlung.personId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onSchliessen(); };
    document.addEventListener("keydown", esc);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = vorher; };
  }, [onSchliessen]);

  // Aus der Akte kommt nur { personId, ref } — der Verwendungszweck steht
  // dann in der Lage. Aus dem Reiter „Zahlungen" kommt er mit.
  const eintrag = (lage?.zahlung || []).find((z: any) => z.ref === zahlung.ref)
    ?? (lage?.zahlung || []).find((z: any) => z.status !== "paid")
    ?? (lage?.zahlung || [])[0];
  const zweck: string | null = zahlung.verwendungszweck ?? eintrag?.zahlungsreferenz ?? null;
  const alle: any[] = eintrag?.bankeingaenge || [];
  // BEWEIS UND RAUSCHEN GETRENNT. Ein Treffer über die Referenz ist ein Beweis;
  // „gleicher Betrag" ist bei einem Standardpaket für 59,99 € die halbe
  // Kundenkartei. Nur der Beweis ist auswählbar — der Rest wird gezählt und
  // beim Namen genannt, damit niemand ihn für einen Treffer hält.
  const eingaenge = alle.filter((t) => t.treffer === "referenz");
  const rauschen = alle.filter((t) => t.treffer !== "referenz");

  const buchen = async () => {
    setBusy(true);
    if (!zweck) { setBusy(false); zeige("fehler", "Kein Verwendungszweck", "Diese Bestellung hat keine Zahlungsreferenz — bitte den Vorgesetzten informieren."); return; }
    const r = await api(`/agent/vertrieb/zahlung/${encodeURIComponent(zweck)}/bezahlt`, {
      method: "POST",
      body: JSON.stringify({ belegArt: art, bankeingangId: bankId, zahlungsdatum: datum, notiz }),
    });
    setBusy(false);
    if (r.ok) { zeige("erfolg", "Gebucht", r.json.meldung); onFertig(); }
    else zeige("fehler", "Nicht gebucht", r.json?.error || "Bitte erneut versuchen.");
  };

  const bereit = !!art && !!zweck && /^\d{4}-\d{2}-\d{2}$/.test(datum) && notiz.trim().length >= 10
    && (art !== "bankeingang" || !!bankId) && !busy;

  return (
    <>
      <div className="fixed inset-0 z-[150]" style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(6px)" }}
           onClick={onSchliessen} />
      <div className="fixed inset-0 z-[151] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Zahlung prüfen und buchen"
             className="pointer-events-auto w-full flex flex-col overflow-hidden"
             style={{ maxWidth: 620, maxHeight: "92vh", background: "#fff", borderRadius: 22,
                      boxShadow: "0 40px 110px -26px rgba(13,26,63,.5)" }}>
          <div className="fi-glas px-6 py-4 shrink-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[.18em]" style={{ color: "var(--fi-text-still)" }}>
              Zahlung prüfen und buchen
            </p>
            <p className="mt-1.5 text-[17px] font-bold">{zahlung.name}</p>
            <p className="text-[12.5px]" style={{ color: "var(--fi-text-leise)" }}>
              {zahlung.paket || "—"} · {zahlung.betragCent != null ? eur(zahlung.betragCent) : "—"} ·{" "}
              <span className="font-mono">{zahlung.verwendungszweck}</span>
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Was die Bank sagt — der Beweis, wenn es einen gibt. */}
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2"
               style={{ color: "var(--fi-text-still)" }}>Bankeingänge zu diesem Kunden</p>
            {!lage ? <Skelett h={44} /> : eingaenge.length === 0 ? (
              <p className="text-[12.5px] p-3 rounded-xl" style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
                Kein Eingang nennt {zahlung.verwendungszweck}. Das heißt nicht, dass kein Geld kam — der
                Bankbestand endet beim letzten Import.
                {rauschen.length > 0 && (
                  <> Es gibt {rauschen.length} Eingang/Eingänge mit gleichem Betrag oder ähnlichem Namen;
                  die gehören aber zu anderen Kunden und sind kein Nachweis.</>
                )}{" "}
                Wenn dir der Kunde einen Überweisungsbeleg gezeigt hat, buche darüber und beschreibe unten,
                was zu sehen war.
              </p>
            ) : (
              <div className="space-y-2">
                {eingaenge.map((t) => {
                  const gewaehlt = bankId === t.id;
                  return (
                    <button key={t.id} type="button"
                            onClick={() => { setBankId(t.id); setArt("bankeingang"); }}
                            className="w-full text-left p-3 rounded-xl transition-all duration-150"
                            style={{
                              border: `1px solid ${gewaehlt ? "var(--fi-primaer)" : "var(--fi-linie)"}`,
                              background: gewaehlt ? "rgba(29,78,216,.04)" : "#fff",
                            }}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold fi-zahl">{eur(t.betragCent)}</span>
                        <span className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{dtag(t.gebuchtAm)}</span>
                      </span>
                      <span className="block mt-1 text-[11.5px] font-mono break-all" style={{ color: "var(--fi-text-leise)" }}>
                        {t.verwendungszweck || "(kein Verwendungszweck)"}
                      </span>
                      <span className="block mt-1 text-[11px]" style={{ color: "var(--fi-text-still)" }}>
                        {t.einzahler || "unbekannter Einzahler"} · Verwendungszweck nennt {zahlung.verwendungszweck}
                        {t.betragPasst === false ? " · Betrag weicht ab" : ""}
                        {t.verbucht ? " · bereits verbucht" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={() => { setArt("beleg"); setBankId(null); }}
                    className="mt-3 w-full text-left p-3 rounded-xl transition-all duration-150"
                    style={{
                      border: `1px solid ${art === "beleg" ? "var(--fi-primaer)" : "var(--fi-linie)"}`,
                      background: art === "beleg" ? "rgba(29,78,216,.04)" : "#fff",
                    }}>
              <span className="block text-[13px] font-semibold">Überweisungsbeleg des Kunden</span>
              <span className="block mt-0.5 text-[11.5px]" style={{ color: "var(--fi-text-leise)" }}>
                Der Kunde hat einen Beleg gezeigt (Screenshot, Foto, Kontoauszug). Beschreibe unten, was
                darauf zu sehen war — Datum, Betrag, Empfänger.
              </span>
            </button>

            <div className="mt-5 grid sm:grid-cols-[160px_1fr] gap-3">
              <label>
                <span className="block text-[10.5px] font-semibold uppercase tracking-[.1em] mb-1.5"
                      style={{ color: "var(--fi-text-still)" }}>Geld eingegangen am</span>
                <input type="date" value={datum} max={heuteIso()} onChange={(e) => setDatum(e.target.value)}
                       className="w-full h-[38px] px-2.5 rounded-lg border bg-white text-[13px] outline-none"
                       style={{ borderColor: "var(--fi-linie)" }} />
              </label>
              <label>
                <span className="block text-[10.5px] font-semibold uppercase tracking-[.1em] mb-1.5"
                      style={{ color: "var(--fi-text-still)" }}>Was hast du geprüft? (Nachweis)</span>
                <input value={notiz} onChange={(e) => setNotiz(e.target.value)}
                       placeholder="z. B. Beleg vom 04.08., 99,99 € an FIAON, Verwendungszweck stimmt"
                       className="w-full h-[38px] px-2.5 rounded-lg border bg-white text-[13px] outline-none"
                       style={{ borderColor: "var(--fi-linie)" }} />
              </label>
            </div>
            <p className="mt-2 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
              Das Eingangsdatum ist der Anker der Monatsraten — nicht das Datum deines Klicks. Dein Satz
              landet im Kundenverlauf und im Protokoll.
            </p>

            <div className="mt-4 p-3.5 rounded-xl" style={{ background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
              <p className="text-[12px] font-bold">Was dieser Klick auslöst</p>
              <ul className="mt-1.5 space-y-1 text-[12px]" style={{ color: "var(--fi-text-leise)" }}>
                <li>Der Kundenstatus wird „bezahlt" und das Konto sofort freigeschaltet.</li>
                <li>Der Kunde bekommt die Bestätigungsmail mit seinem Zugang.</li>
                <li>Offene Doppelbestellungen derselben E-Mail werden stillgelegt.</li>
                <li>Die Provision wird für den dokumentierten Betreuer gebucht — nicht für dich.</li>
                <li>Zurücknehmen kann die Buchung nur der Vorgesetzte.</li>
              </ul>
            </div>
          </div>

          <div className="fi-glas px-6 py-4 shrink-0 flex flex-wrap items-center gap-2"
               style={{ boxShadow: "inset 0 1px 0 var(--fi-glas-linie)" }}>
            <button type="button" disabled={!bereit} onClick={() => void buchen()}
                    className="fi-primaerknopf px-4 py-2.5 text-[13px] font-semibold text-white"
                    style={!bereit ? { opacity: .45, cursor: "not-allowed" } : undefined}>
              {busy ? "Wird gebucht …" : "Als bezahlt buchen"}
            </button>
            <button type="button" onClick={onSchliessen} className="fi-zweitknopf px-3.5 py-2.5 text-[13px] font-semibold">
              Abbrechen
            </button>
            {!art && <span className="text-[12px]" style={{ color: "var(--fi-text-still)" }}>Bitte oben den Nachweis wählen.</span>}
            {art && notiz.trim().length < 10 && (
              <span className="text-[12px]" style={{ color: "var(--fi-text-still)" }}>Bitte den Nachweis in einem Satz beschreiben.</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dokumente
// ═══════════════════════════════════════════════════════════════════════════
export function VertriebDokumente() {
  const [suche, setSuche] = useState("");
  const [zeilen, setZeilen] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLaedt(true);
      const p = new URLSearchParams();
      if (suche.trim()) p.set("q", suche.trim());
      const r = await api(`/agent/vertrieb/dokumente?${p.toString()}`);
      if (r.ok) setZeilen(r.json.kunden);
      setLaedt(false);
    }, suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [suche]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[12.5px]" style={{ color: "var(--fi-text-leise)" }}>
          Bezahlte Kunden, bei denen Unterlagen fehlen. Du siehst, WAS fehlt — die Dokumente selbst
          bleiben beim Vorgesetzter.
        </p>
        <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Referenz"
               className="h-[34px] px-3 rounded-xl border bg-white text-[13px] outline-none w-[220px] shrink-0"
               style={{ borderColor: "var(--fi-linie)" }} />
      </div>
      <div className="fi-karte overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 780 }}>
            <thead>
              <tr style={{ background: "var(--fi-seite)" }}>
                {["Kunde", "Fehlt", "Paket", "Bezahlt am", "Prüfstand", "Zuständig"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.07em] whitespace-nowrap"
                      style={{ color: "var(--fi-text-still)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laedt && [0, 1, 2, 3].map((i) => (
                <tr key={i}><td colSpan={6} className="px-3 py-3"><Skelett h={16} /></td></tr>
              ))}
              {!laedt && zeilen.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>
                  Bei keinem bezahlten Kunden fehlen Unterlagen.
                </td></tr>
              )}
              {!laedt && zeilen.map((k) => (
                <tr key={k.ref} style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                  <td className="px-3 py-2.5">
                    <span className="block text-[13px] font-semibold">{k.name}</span>
                    <span className="block text-[11px]" style={{ color: "var(--fi-text-still)" }}>{k.email}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {k.fehlt.map((f: string) => (
                      <span key={f} className="inline-block mr-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: "rgba(217,119,6,.10)", color: "var(--fi-tier2)" }}>{f}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] whitespace-nowrap">{k.paket || "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: "var(--fi-text-still)" }}>{dtag(k.bezahltAm)}</td>
                  <td className="px-3 py-2.5 text-[12px] whitespace-nowrap" style={{ color: "var(--fi-text-still)" }}>{k.kycStatus || "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] whitespace-nowrap">{k.agentName || "niemand"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Zugang
// ═══════════════════════════════════════════════════════════════════════════
export function VertriebZugang() {
  const [suche, setSuche] = useState("");
  const [zeilen, setZeilen] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLaedt(true);
      const p = new URLSearchParams();
      if (suche.trim()) p.set("q", suche.trim());
      const r = await api(`/agent/vertrieb/zugang?${p.toString()}`);
      if (r.ok) setZeilen(r.json.kunden);
      setLaedt(false);
    }, suche ? 280 : 0);
    return () => clearTimeout(t);
  }, [suche]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[12.5px]" style={{ color: "var(--fi-text-leise)" }}>
          Bezahlte Kunden, die nicht in ihr Konto kommen. Die Auskunft stammt aus derselben Prüfung wie
          der echte Login — sie sagt, was der Kunde erlebt, nicht was wir vermuten.
        </p>
        <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Referenz"
               className="h-[34px] px-3 rounded-xl border bg-white text-[13px] outline-none w-[220px] shrink-0"
               style={{ borderColor: "var(--fi-linie)" }} />
      </div>
      {laedt ? (
        <div className="fi-karte p-4 space-y-3">{[0, 1, 2].map((i) => <Skelett key={i} h={20} />)}</div>
      ) : zeilen.length === 0 ? (
        <div className="fi-karte p-6 text-center">
          <p className="text-[13.5px] font-semibold">Kein bezahlter Kunde ist ausgesperrt.</p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>
            Meldet sich trotzdem jemand, tippt er meist ein falsches Passwort — dann hilft
            „Passwort vergessen" auf der Login-Seite.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {zeilen.map((k) => (
            <div key={k.ref} className="fi-karte p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="text-[14px] font-bold">{k.name}</span>
                  <span className="ml-2 text-[12px]" style={{ color: "var(--fi-text-still)" }}>{k.email}</span>
                </span>
                <span className="text-[11.5px] font-mono" style={{ color: "var(--fi-text-still)" }}>
                  {k.zugang.code} · bezahlt {dtag(k.bezahltAm)}
                </span>
              </div>
              <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--fi-tier1)" }}>{k.zugang.grund}</p>
              {k.zugang.tun && (
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                  <span className="font-semibold">Das hilft: </span>{k.zugang.tun}
                </p>
              )}
              <p className="mt-2 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                Konto {k.zugang.kontoRef} · Status {k.zugang.status || "—"} · Konto-Status {k.zugang.kontoStatus || "—"} ·
                Passwort {k.zugang.passwortGesetzt ? "gesetzt" : "fehlt"} · {k.zugang.familie} Bestellung(en) ·
                zuständig {k.agentName || "niemand"}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Die Lage eines Kunden — eingebettet in die Akte. */
export function LageTafel({ personId, basis = "/agent/vertrieb/person", karteSetzbar = false }: {
  personId: number;
  /** Darf der Betrachter den Kartenstatus pflegen? Nur die Vertriebsleitung. */
  karteSetzbar?: boolean;
  /**
   * Woher die Lage kommt. Die Vertriebsleitung liest sie über ihren Endpunkt,
   * das Onboarding über einen eigenen, der ausschließlich die eigenen
   * Gesprächspartner freigibt. Dieselbe DARSTELLUNG, andere Tür — deshalb ein
   * Parameter und keine zweite Komponente.
   */
  basis?: string;
}) {
  const [lage, setLage] = useState<any>(null);
  const { zeige } = useToast();
  const [karteBusy, setKarteBusy] = useState(false);
  const [karteNotiz, setKarteNotiz] = useState("");

  const ladeLage = useCallback(() => {
    api(`${basis}/${personId}/lage`).then((r) => setLage(r.ok ? r.json : { fehler: true }));
  }, [basis, personId]);
  useEffect(() => { setLage(null); ladeLage(); }, [ladeLage]);

  const karteSetzen = async (status: string) => {
    if (!status) return;
    setKarteBusy(true);
    const r = await api(`/agent/vertrieb/person/${personId}/karte`, {
      method: "PATCH", body: JSON.stringify({ status, notiz: karteNotiz.trim() || null }),
    });
    setKarteBusy(false);
    if (r.ok) { zeige("erfolg", "Kartenstatus", r.json.meldung); setKarteNotiz(""); ladeLage(); }
    else zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen.");
  };

  if (!lage) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skelett key={i} h={18} />)}</div>;
  if (lage.fehler) return <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Lage nicht ladbar.</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2" style={{ color: "var(--fi-text-still)" }}>
          Zahlung
        </p>
        {(lage.zahlung || []).length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>Keine Bestellung.</p>
        ) : (lage.zahlung || []).map((z: any) => (
          <div key={z.ref} className="py-2 text-[12.5px]" style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
            <span className="font-semibold">{z.paket || z.ref}</span>
            <span style={{ color: "var(--fi-text-still)" }}>
              {" · "}{z.betragCent != null ? eur(z.betragCent) : "—"}
              {" · "}{zahlungsstatusText(z.status)}
              {z.status === "paid" && z.bezahltAm ? ` am ${dtag(z.bezahltAm)}` : ""}
              {z.status !== "paid" && z.frist ? ` (Frist ${dtag(z.frist)})` : ""}
            </span>
            <span className="block text-[11.5px] font-mono" style={{ color: "var(--fi-text-still)" }}>
              {z.zahlungsreferenz || "kein Verwendungszweck"}
            </span>
            {/* Die Rechnung als PDF — die Route gab es seit jeher, nur keinen
                Knopf (C7, viermal gemeldet). Ein Link, dieselbe Berechtigung. */}
            {z.ref && (
              <a href={`/api/fiaon/agent/customers/${encodeURIComponent(z.ref)}/invoice.pdf`} target="_blank" rel="noreferrer"
                 className="inline-block mt-1 text-[11.5px] font-semibold no-underline" style={{ color: "var(--fi-primaer)" }}>
                Rechnung (PDF) öffnen
              </a>
            )}
            {z.bankeingaenge?.length > 0 && (
              <span className="block mt-1 text-[11.5px]" style={{ color: "var(--fi-erfolg)" }}>
                {z.bankeingaenge.length} passende(r) Bankeingang — über „Zahlungen" prüfen und buchen
              </span>
            )}
          </div>
        ))}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2" style={{ color: "var(--fi-text-still)" }}>
          Unterlagen
        </p>
        {lage.dokumente?.fehlend?.length > 0 ? (
          <p className="text-[12.5px]">
            <span className="font-semibold" style={{ color: "var(--fi-tier2)" }}>Fehlt: </span>
            {lage.dokumente.fehlend.map((d: any) => d.label).join(", ")}
          </p>
        ) : (
          <p className="text-[12.5px]" style={{ color: "var(--fi-erfolg)" }}>Alle benötigten Unterlagen liegen vor.</p>
        )}
        {lage.dokumente?.vorhanden?.length > 0 && (
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
            Vorhanden: {lage.dokumente.vorhanden.map((d: any) => `${d.label} (${d.groesseKb} KB)`).join(", ")}
          </p>
        )}
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
          Prüfstand: {lage.dokumente?.kycStatus || "—"} · Inhalte sieht nur der Vorgesetzte.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DIE KARTE — „Wo ist meine Karte?" (22.08.2026, K11)
          Die häufigste Kundenfrage hatte bis heute kein Feld. Jetzt steht
          der Stand hier, mit Datum, und die Leitung pflegt ihn an Ort und
          Stelle — bis eine Kartenschnittstelle ihn automatisch setzt.
          ══════════════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2" style={{ color: "var(--fi-text-still)" }}>
          Karte
        </p>
        <p className="text-[12.5px] font-semibold"
           style={{ color: lage.karte?.status === "zugestellt" ? "var(--fi-erfolg)"
             : ["zurueck", "abgelehnt"].includes(lage.karte?.status) ? "var(--fi-tier1)"
             : lage.karte?.status ? "var(--fi-text)" : "var(--fi-text-still)" }}>
          {lage.karte?.text || "Stand unbekannt"}
          {lage.karte?.am ? ` · seit ${dtag(lage.karte.am)}` : ""}
        </p>
        {lage.karte?.notiz && (
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{lage.karte.notiz}</p>
        )}
        {karteSetzbar && lage.karte?.ref && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select aria-label="Kartenstatus setzen" disabled={karteBusy}
                    value={lage.karte?.status ?? ""}
                    onChange={(e) => void karteSetzen(e.target.value)}
                    className="h-[34px] px-2.5 rounded-xl border bg-white text-[12.5px] outline-none"
                    style={{ borderColor: "var(--fi-linie)" }}>
              <option value="">Stand setzen …</option>
              {(lage.kartenStatusListe || []).map((k: any) => (
                <option key={k.key} value={k.key}>{k.text}</option>
              ))}
            </select>
            <input value={karteNotiz} onChange={(e) => setKarteNotiz(e.target.value)}
                   placeholder="Notiz, z. B. Sendungsnummer"
                   className="h-[34px] px-3 rounded-xl border bg-white text-[12.5px] outline-none w-[200px]"
                   style={{ borderColor: "var(--fi-linie)" }} />
          </div>
        )}
        {karteSetzbar && !lage.karte?.ref && (
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>Ohne Paketbestellung gibt es keine Karte.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2" style={{ color: "var(--fi-text-still)" }}>
          Zugang zum Konto
        </p>
        <p className="text-[12.5px] font-semibold" style={{ color: lage.zugang?.kannRein ? "var(--fi-erfolg)" : "var(--fi-tier1)" }}>
          {lage.zugang?.grund}
        </p>
        {lage.zugang?.tun && (
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
            <span className="font-semibold">Das hilft: </span>{lage.zugang.tun}
          </p>
        )}
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
          Status {lage.zugang?.status || "—"} · Konto {lage.zugang?.kontoStatus || "—"} ·
          Passwort {lage.zugang?.passwortGesetzt ? "gesetzt" : "fehlt"}
        </p>
      </div>
    </div>
  );
}

/** Kopfzahlen der Servicesicht — jede Zahl ist ein Sprung in ihre Liste. */
export function ServiceZahlen({ zahlen, aktiv, aufReiter }: {
  zahlen: any; aktiv: string; aufReiter: (r: string) => void;
}) {
  const felder = [
    { t: zahlungsstatusText("claimed_paid"), w: zahlen?.gemeldet, r: "zahlungen", c: "var(--fi-tier1)" },
    { t: "Frist abgelaufen", w: zahlen?.fristAbgelaufen, r: "zahlungen", c: "var(--fi-tier2)" },
    { t: "Unterlagen fehlen", w: zahlen?.dokumenteFehlen, r: "dokumente", c: "var(--fi-tier2)" },
    { t: "Konto nicht offen", w: zahlen?.zugangOffen, r: "zugang", c: "var(--fi-primaer)" },
    { t: "Bankeingänge offen", w: zahlen?.bankOffen, r: "zahlungen", c: "var(--fi-text)" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
      {felder.map((f) => (
        <button key={f.t} type="button" onClick={() => aufReiter(f.r)}
                className="fi-karte fi-karte--hebt p-4 text-left"
                style={aktiv === f.r ? { borderColor: "rgba(29,78,216,.35)" } : undefined}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color: "var(--fi-text-still)" }}>
            {f.t}
          </p>
          {zahlen ? (
            <p className="text-[24px] font-bold leading-none mt-1.5 fi-zahl" style={{ color: f.c }}>{f.w ?? 0}</p>
          ) : <Skelett h={26} w={48} className="mt-1.5" />}
        </button>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE — Ruhe-Pool und Wiedereinstieg
//
// Der Ruhe-Pool muss hier stehen, sonst ist er das versteckte Loch, das er
// ausdrücklich nicht sein soll: Der einzelne Agent sieht seine Ruhenden im
// Filter, aber nur die Leitung sieht, wie viele Menschen im ganzen Haus gerade
// bewusst NICHT angerufen werden. Wächst diese Zahl, stimmt etwas mit den
// Nummern oder mit den Anrufzeiten nicht.
// ═══════════════════════════════════════════════════════════════════════════
export function PipelineZahlen({ pipeline }: { pipeline: any }) {
  const w = pipeline?.wiedereinstieg;
  const felder = [
    { t: "Ruhend", w: pipeline?.ruhend,
      h: "4× nicht erreicht — ruhen 14 Tage und kommen dann von selbst zurück." },
    { t: "Termine gebucht", w: pipeline?.termineOffen,
      h: "Kunden, die sich selbst eine Uhrzeit ausgesucht haben." },
    { t: "Terminlink versandt", w: pipeline?.terminlinkVersandt,
      h: "Automatisch nach dem 2. erfolglosen Versuch, höchstens einmal je 30 Tage." },
    { t: "Wiedereinstieg", w: w ? `${w.gebucht}/${w.versandt}` : 0,
      h: w ? `${w.quote}% haben nach der Wiedereinstiegs-Mail einen Termin gebucht. ${w.offen} noch offen.` : "Noch nichts versandt." },
  ];
  return (
    <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {felder.map((f) => (
        <div key={f.t} className="fi-karte p-4" title={f.h}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color: "var(--fi-text-still)" }}>
            {f.t}
          </p>
          {pipeline ? (
            <p className="text-[24px] font-bold leading-none mt-1.5 fi-zahl">{f.w ?? 0}</p>
          ) : <Skelett h={26} w={48} className="mt-1.5" />}
          <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--fi-text-still)" }}>{f.h}</p>
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// BESTANDSWACHE — die Listen hinter den schweren Befunden (22.08.2026, K10)
//
// „Bezahlt ohne Startgespräch" ist der teuerste Bestand des Hauses. Die Wache
// misst ihn seit dem 21.08., zeigte ihn aber nur auf /admin/hub — einem Ort,
// den Florentine und Daniel nicht betreten können. Hier ist die Liste.
// ═══════════════════════════════════════════════════════════════════════════
export function Bestandswache({ zahlen, onAkte }: { zahlen: any; onAkte: (personId: number) => void }) {
  const [art, setArt] = useState<"ohne_onboarding" | "ohne_betreuer">("ohne_onboarding");
  const [daten, setDaten] = useState<any>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    setDaten(null); setFehler(null);
    api(`/agent/vertrieb/bestandswache?art=${art}`).then((r) => {
      if (r.ok) setDaten(r.json);
      else setFehler(r.json?.error || `Die Liste kam nicht (HTTP ${r.status}).`);
    });
  }, [art]);

  const zeilen: any[] = daten?.zeilen ?? [];
  const geduld = Number(daten?.geduldTage ?? 14);

  return (
    <div className="mt-5 space-y-3" data-fiaon="bestandswache">
      <div className="grid grid-cols-2 gap-2.5">
        {([
          ["ohne_onboarding", "Bezahlt ohne Startgespräch", zahlen?.bezahltOhneOnboarding,
            `Zahlende Kunden, deren Konto bis zum Startgespräch eingeschränkt bleibt — länger als ${geduld} Tage.`],
          ["ohne_betreuer", "Zahlend ohne Betreuer", zahlen?.bezahltOhneBetreuer,
            "Zahlende Kunden, für die niemand zuständig ist. Niemand ruft sie an, niemand bekommt Provision."],
        ] as const).map(([k, t, w, h]) => (
          <button key={k} type="button" onClick={() => setArt(k)} title={h}
                  className="fi-karte fi-karte--hebt p-4 text-left"
                  style={art === k ? { borderColor: "rgba(29,78,216,.35)" } : undefined}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color: "var(--fi-text-still)" }}>{t}</p>
            <p className="text-[24px] font-bold leading-none mt-1.5 fi-zahl" style={{ color: "var(--fi-tier1)" }}>{w ?? 0}</p>
          </button>
        ))}
      </div>

      {fehler && (
        <div className="fi-karte p-4" role="alert" style={{ borderColor: "rgba(185,28,28,.3)" }}>
          <p className="text-[13px] font-bold" style={{ color: "#b91c1c" }}>{fehler}</p>
        </div>
      )}
      <div className="fi-karte overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 760 }}>
            <thead>
              <tr style={{ background: "var(--fi-seite)" }}>
                {["Kunde", "Bezahlt", art === "ohne_onboarding" ? "Stand" : "Referenz", "Zuständig", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.07em] whitespace-nowrap"
                      style={{ color: "var(--fi-text-still)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!daten && !fehler && [0, 1, 2, 3].map((i) => (
                <tr key={i}><td colSpan={5} className="px-3 py-3"><Skelett h={16} /></td></tr>
              ))}
              {daten && zeilen.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px]" style={{ color: "var(--fi-text-still)" }}>
                  Hier ist gerade niemand. Das ist die beste Nachricht des Tages.
                </td></tr>
              )}
              {zeilen.map((z) => (
                <tr key={z.personId} style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                  <td className="px-3 py-2.5">
                    <p className="text-[13px] font-semibold" style={{ color: "var(--fi-text)" }}>{z.name}</p>
                    <p className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{z.telefon || z.email || "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">
                    {z.bezahltAm ? dtag(z.bezahltAm) : "—"}
                    {z.tage != null && (
                      <span className="block text-[11px] font-semibold" style={{ color: z.tage > geduld ? "var(--fi-tier1)" : "var(--fi-text-still)" }}>
                        vor {z.tage} {z.tage === 1 ? "Tag" : "Tagen"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px]">
                    {art === "ohne_onboarding"
                      ? (z.terminAm ? <span style={{ color: "var(--fi-erfolg)" }}>Termin {dtag(z.terminAm)}</span>
                        : z.eingeladenAm ? <span style={{ color: "var(--fi-tier2)" }}>eingeladen {dtag(z.eingeladenAm)}, keine Buchung</span>
                        : <span style={{ color: "var(--fi-tier1)" }}>nie eingeladen</span>)
                      : <span className="font-mono text-[11.5px]">{z.ref || "—"}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px]">{z.zustaendig || <span style={{ color: "var(--fi-tier1)" }}>niemand</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button type="button" onClick={() => onAkte(Number(z.personId))}
                            className="fi-zweitknopf px-3 py-1.5 text-[12px] font-semibold">
                      Akte öffnen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {daten && zeilen.length >= 300 && (
          <p className="px-3 py-2 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
            Die ersten 300 — nach Wartezeit sortiert, die ältesten zuerst.
          </p>
        )}
      </div>
    </div>
  );
}
