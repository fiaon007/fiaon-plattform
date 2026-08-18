// ═══════════════════════════════════════════════════════════════════════════
// PRODUKT AN EINE BESTEHENDE AKTE — ANLEGEN UND TAUSCHEN
//
// ══════════════════════════════════════════════════════════════════════════
// WARUM DIESE DATEI ENTSTEHT (29.08.2026) — EIN FEHLER, DER MIR GEHÖRT
//
// Meldung des Betreibers: „Agenten klicken auf ‚Produkt anlegen' — es erscheint
// NICHTS." Damit stand die Kernarbeit.
//
// Die Ursache: Am 25.08. wurde die Route gebaut
// (`POST /agent/customers/:ref/produkt`, mit Katalog, Paket-Hygiene und
// SCHUFA-Kategoriegrenze), und der Prüfstand prüfte sie über HTTP — 50
// Prüfungen, alle grün.
//
// Es gab nur **keine Oberfläche dafür.** Am 27.08. kam ein Knopf dazu, aber als
//
//     <a href="/agent/kunden#anlegen">Produkt anlegen →</a>
//
// Drei Fehler in einer Zeile: Der Anker `#anlegen` existiert nicht, der
// Mitarbeiter steht SCHON auf `/agent/kunden` (ein Link auf dieselbe Seite mit
// unbekanntem Anker tut nichts), und selbst wenn er ankäme, legt
// „+ Kunde anlegen" einen NEUEN Kunden an — kein Produkt an der bestehenden Akte.
//
// Das ist wörtlich der Fehler vom 11.08.2026, der in AGENTS.md steht: „Die Route
// existiert" war grün, während der Knopf fehlte. Vier Prüfungen sahen damals nur
// in den Serverquelltext. Diesmal waren es 50.
//
// ── DESHALB PRÜFT DER BROWSERTEST DIE ÖFFNUNG DES DIALOGS ─────────────────
// `scripts/schau-produkt.ts` klickt den Knopf und misst am DOM, dass der Dialog
// erscheint. Die Rot-Probe macht die Öffnung kaputt — dann wird er rot. Ein
// stiller Klick darf nicht zweimal passieren.
// ══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

interface Paket {
  key: string; label: string; preisEuro: number;
  art: "privat" | "business"; abo: boolean;
}

export interface Buchung {
  ref: string; art: "paket" | "bonitaet" | "sonstiges"; bezeichnung: string;
  betragCents: number | null; zahlungText: string; bezahlt: boolean; offen: boolean;
  verwendungszweck: string | null; erledigt: boolean;
}

const euro = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/**
 * Produkt anlegen oder tauschen.
 *
 * `buchungen` kommt aus der Kundenkarte — daraus leitet der Dialog ab, ob es ein
 * ANLEGEN oder ein TAUSCH ist. Ein Tausch ist der häufigere Fall am Telefon
 * („Pro reicht mir nicht"), und er soll ein Klick sein, nicht zwei Vorgänge.
 */
export function ProduktDialog({
  offen, personId, buchungen, aufKlappen, fertig,
}: {
  offen: boolean;
  personId: number;
  buchungen: Buchung[];
  aufKlappen: (v: boolean) => void;
  /** Nach Erfolg: die Karte neu laden. */
  fertig: (meldung: string) => void;
}) {
  const [pakete, setPakete] = useState<Paket[]>([]);
  const [gewaehlt, setGewaehlt] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<any>(null);

  // ── DER KATALOG ─────────────────────────────────────────────────────────
  // Er kommt vom Server (`/agent/katalog`, also aus `shared/fiaon-pakete.ts`).
  // Eine Preisliste in dieser Datei wäre die zweite Wahrheit — genau daran ist
  // es einmal gescheitert: Ultra-Kunden kauften für 79,99 und bekamen
  // Rechnungen über 99,99.
  useEffect(() => {
    if (!offen || pakete.length > 0) return;
    void fetch("/api/fiaon/agent/katalog", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setPakete(j.pakete ?? []); })
      .catch(() => setFehler("Der Paketkatalog ließ sich nicht laden. Bitte neu laden."));
  }, [offen, pakete.length]);

  if (!offen) return null;

  // ── ANLEGEN ODER TAUSCHEN? ──────────────────────────────────────────────
  // Ein OFFENES Stufenpaket heißt: Tausch. Die Bonitätsauskunft zählt nicht
  // dazu — sie ist ein Einmalkauf neben dem Konto, und diese Kategoriegrenze
  // hat einmal 583,98 € gekostet, als sie fehlte.
  const offenesPaket = buchungen.find((b) => b.offen && b.art === "paket");
  const istTausch = !!offenesPaket;
  const auskunftOffen = buchungen.some((b) => b.offen && b.art === "bonitaet");
  const auskunftBezahlt = buchungen.some((b) => b.bezahlt && b.art === "bonitaet");

  const paket = pakete.find((p) => p.key === gewaehlt);
  const anlegen = async () => {
    if (!paket) return;
    setLaeuft(true);
    setFehler(null);
    // Die Route arbeitet auf einer REFERENZ. Beim Tausch die offene, sonst eine
    // beliebige lebende — sie dient nur als Zugang zur Person.
    const ref = offenesPaket?.ref ?? buchungen.find((b) => !b.erledigt)?.ref ?? buchungen[0]?.ref;
    if (!ref) {
      setLaeuft(false);
      setFehler("Diese Akte hat keine Bestellung, an die ein Produkt gehängt werden kann.");
      return;
    }
    const r = await fetch(`/api/fiaon/agent/customers/${encodeURIComponent(ref)}/produkt`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packKey: paket.key }),
    }).then((x) => x.json()).catch(() => null);
    setLaeuft(false);
    if (!r?.ok) {
      setFehler(String(r?.error ?? "Der Server hat abgelehnt. Bitte erneut versuchen."));
      return;
    }
    setErfolg(r);
    fertig(r.hinweis
      ? `${paket.label} angelegt. ${r.hinweis}`
      : `${paket.label} angelegt — Verwendungszweck ${r.zahlungsreferenz}.`);
  };

  const feld = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]";

  return (
    <div data-fiaon="produkt-dialog"
         className="mt-3 p-4 rounded-2xl bg-white border border-slate-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[14px] font-bold text-slate-900">
            {istTausch ? "Produkt tauschen" : "Produkt hinzufügen"}
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
            {istTausch
              ? `Aktuell offen: ${offenesPaket!.bezeichnung}. Ein neues Paket ersetzt es — `
                + "der Kunde bekommt nur EINE Zahlungsaufforderung."
              : "Der Preis kommt aus dem Katalog. Es gibt kein Feld dafür."}
          </p>
        </div>
        <button type="button" onClick={() => { aufKlappen(false); setErfolg(null); setFehler(null); }}
                className="text-[12px] font-semibold text-slate-400 shrink-0"
                style={{ minHeight: 44, minWidth: 44 }}>
          Schließen
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          NACH DEM ANLEGEN
          ══════════════════════════════════════════════════════════════════ */}
      {erfolg ? (
        <div>
          <div className="px-3.5 py-3 rounded-xl"
               style={{ background: "rgba(5,150,105,.08)", boxShadow: "inset 0 0 0 1px rgba(5,150,105,.22)" }}>
            <p className="text-[13px] font-bold" style={{ color: "#047857" }}>
              {erfolg.paket?.label} angelegt
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#065f46" }}>
              {euro(Number(erfolg.paket?.preisEuro ?? 0))} · Verwendungszweck{" "}
              <b>{erfolg.zahlungsreferenz}</b>
            </p>
            {/* ── DIE ABGELÖSTE BESTELLUNG WIRD GENANNT ──────────────────
                Wer tauscht, muss sehen, DASS die alte weg ist — sonst ruft er
                an und fragt, ob der Kunde jetzt zweimal zahlen muss. */}
            {Array.isArray(erfolg.ersetzt) && erfolg.ersetzt.length > 0 && (
              <p className="text-[12px] mt-1.5" style={{ color: "#065f46" }}>
                Abgelöst: {erfolg.ersetzt.join(", ")} — stillgelegt, nicht gelöscht.
              </p>
            )}
          </div>
          <p className="text-[12px] text-slate-500 mt-2.5 leading-relaxed">
            Jetzt die Zahlungsdaten schicken — die Mail trägt den <b>neuen</b> Betrag
            und den neuen Verwendungszweck.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button"
                    onClick={() => { setErfolg(null); setGewaehlt(""); aufKlappen(false); }}
                    className="px-4 py-2.5 rounded-xl text-white text-[12.5px] font-semibold"
                    style={{ background: "#1d4ed8", minHeight: 44 }}>
              Fertig — zurück zur Karte
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── DIE AUSWAHL ─────────────────────────────────────────────── */}
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-[.1em] text-slate-500 mb-1.5">
              {istTausch ? "Neues Paket" : "Paket"}
            </span>
            <select value={gewaehlt} onChange={(e) => setGewaehlt(e.target.value)}
                    className={feld} style={{ minHeight: 44 }}>
              <option value="">— bitte wählen —</option>
              {pakete.filter((p) => p.key !== "schufa").map((p) => (
                <option key={p.key} value={p.key}
                        disabled={offenesPaket?.bezeichnung?.includes(p.label)}>
                  {p.label} — {euro(p.preisEuro)} / Monat
                  {offenesPaket?.bezeichnung?.includes(p.label) ? " (schon offen)" : ""}
                </option>
              ))}
              {/* Die Auskunft steht getrennt: Einmalkauf, kein Konto. Und sie
                  ist gesperrt, wenn sie schon offen oder bezahlt ist — der
                  Server lehnt das ohnehin ab, aber ein gesperrter Eintrag
                  erklärt es vorher. */}
              {pakete.filter((p) => p.key === "schufa").map((p) => (
                <option key={p.key} value={p.key} disabled={auskunftOffen || auskunftBezahlt}>
                  {p.label} — {euro(p.preisEuro)} einmalig
                  {auskunftBezahlt ? " (schon bezahlt)"
                    : auskunftOffen ? " (schon offen)" : ""}
                </option>
              ))}
            </select>
          </label>

          {paket && (
            <p className="text-[12px] text-slate-600 leading-relaxed px-3 py-2.5 rounded-xl"
               style={{ background: "rgba(15,23,42,.035)" }}>
              <b>{paket.label}</b> · {euro(paket.preisEuro)}
              {paket.abo ? " monatlich" : " einmalig"}
              {istTausch && paket.key !== "schufa" && (
                <> · ersetzt <b>{offenesPaket!.bezeichnung}</b></>
              )}
              {paket.key === "schufa" && (
                <> · <b>zusätzlich</b> zum Konto, kein Ersatz</>
              )}
            </p>
          )}

          {fehler && (
            <p className="px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
               style={{ background: "rgba(220,38,38,.07)", color: "#b91c1c" }}>
              {fehler}
            </p>
          )}

          <button type="button" onClick={() => void anlegen()} disabled={!paket || laeuft}
                  data-fiaon="produkt-speichern"
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-white text-[13.5px] font-semibold disabled:opacity-40"
                  style={{ background: "#1d4ed8", minHeight: 48 }}>
            {laeuft ? "Legt an …" : istTausch ? "Tauschen" : "Hinzufügen"}
          </button>
        </div>
      )}
    </div>
  );
}
