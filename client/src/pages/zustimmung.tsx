import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { Bestelluebersicht } from "@/components/antrag/Bestelluebersicht";
import { KNOPF_ZAHLUNGSPFLICHTIG, paketKeyAusName, istUebersichtPaket, bestellUebersicht, euro, HAKEN_VERTRAG_TITEL, HAKEN_VERTRAG_TEXT } from "@/components/antrag/bestelluebersicht-daten";

// ═══════════════════════════════════════════════════════════════════════════
// /zustimmung/:token — der Kunde bestätigt SELBST
//
// ── WARUM ES DIESE SEITE GIBT (21.08.2026) ────────────────────────────────
// In der Kundenkarte stand bis heute „Fehlendes am Telefon ergänzen" — und
// unter „Fehlendes" liefen AGB-Zustimmung, SCHUFA-Einwilligung und
// Vertragsannahme mit. Das sind Willenserklärungen. Wer sie für einen anderen
// setzt, erzeugt keinen Nachweis, sondern eine Behauptung.
//
// Diese Seite ist der Ersatz: kein Login (der Kunde steht noch im Antrag und
// hat oft keinen Zugang), signiertes Token, 30 Tage gültig. Sie zeigt nur, was
// WIRKLICH fehlt — wer schon zugestimmt hat, sieht eine Bestätigung und kein
// Formular.
//
// ── MOBIL ZUERST ──────────────────────────────────────────────────────────
// Der Link kommt per Mail oder WhatsApp und wird auf dem Telefon geöffnet.
// Die Kästchen sind volle Zeilen mit 44 px Höhe, damit man sie mit dem Daumen
// trifft.
// ═══════════════════════════════════════════════════════════════════════════

interface Lage {
  ref: string;
  name: string;
  paket: string | null;
  /** Katalogschlüssel (pack_key) — liefert der Server, sobald E-244 dort nachgezogen ist; sonst aus `paket` gelesen. */
  packKey?: string | null;
  /**
   * Die AGB-Fassung, die der Server beim Setzen von consent_contract in `agb_stand` schreibt
   * (E-244: „2026-09-26"). FEHLT sie, ist der Server noch nicht nachgezogen — dann bietet die
   * Seite die Vertragsannahme NICHT an: Sonst sähe der Kunde zwölf Monate fest, während die
   * Zeile ohne agb_stand im System als alter Monatsvertrag weiterläuft (Kundenbereich, Mara).
   */
  vertragsFassung?: string | null;
  offen: string[];
  spalten: string[];
  fertig: boolean;
}

/**
 * Der Erklärtext je Erklärung — er steht HIER und nicht auf dem Server, weil er
 * zur Seite gehört. Die Namen kommen vom Server (`offen`), damit Seite und
 * Pflichtfeldliste nicht auseinanderlaufen.
 */
const ERLAEUTERUNG: Record<string, string> = {
  consent_agb: "Ich habe die AGB und die Datenschutzerklärung gelesen und die "
    + "vorvertraglichen Informationen erhalten.",
  consent_schufa: "Ich willige ein, dass meine Daten zur Prüfung meiner "
    + "Zahlungsfähigkeit übermittelt werden.",
  // E-244: Der Haken bestätigt das Prüfen — angenommen wird mit dem Knopf (AGB § 3 Abs. 3/4).
  consent_contract: HAKEN_VERTRAG_TEXT,
};

const TITEL: Record<string, string> = {
  consent_agb: "AGB und Datenschutz",
  consent_schufa: "Bonitätsprüfung",
  consent_contract: HAKEN_VERTRAG_TITEL,
};

export default function ZustimmungPage() {
  const [, params] = useRoute("/zustimmung/:token");
  const token = params?.token || "";

  const [lage, setLage] = useState<Lage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [gesetzt, setGesetzt] = useState<Record<string, boolean>>({});
  const [sendet, setSendet] = useState(false);
  const [fertig, setFertig] = useState(false);
  /** Nach dem Absenden: Wurde mit diesem Klick der Vertrag geschlossen? (Erfolgstext, E-244) */
  const [vertragGeschlossen, setVertragGeschlossen] = useState<string | null>(null);
  /** Nach dem Absenden: Blieb die Vertragsannahme offen, weil sie hier nicht möglich war? */
  const [vertragBleibtOffen, setVertragBleibtOffen] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await fetch(`/api/fiaon/zustimmung/${encodeURIComponent(token)}`)
      .catch(() => null);
    const j = await res?.json().catch(() => null);
    setLaedt(false);
    if (!j?.ok) {
      setFehler(j?.error || "Wir konnten diesen Link nicht öffnen. Bitte melden Sie sich kurz bei uns.");
      return;
    }
    setFehler(null);
    setLage(j.lage as Lage);
    if ((j.lage as Lage).fertig) setFertig(true);
  }, [token]);

  useEffect(() => { void laden(); }, [laden]);

  // ── E-244 (26.09.2026): HOLT DIESE SEITE DEN VERTRAG EIN, IST DER KLICK ZAHLUNGSPFLICHTIG ──
  // § 312j Abs. 3 BGB: Der Knopf heißt dann „Zahlungspflichtig annehmen", und darüber steht die
  // Bestellübersicht (Abs. 2) — dieselbe wie im Antrag. Fehlt nur AGB oder Bonitätsprüfung, bleibt
  // „Verbindlich bestätigen": Diese Erklärungen allein lösen keine Zahlung aus.
  //
  // NACHBESSERUNG: Die Vertragsannahme gibt es hier NUR, wenn (a) ein Privatpaket mit Rate erkannt
  // ist (sonst gäbe es keine wahre Übersicht) und (b) der Server die Fassung meldet, die er beim
  // Annehmen in agb_stand schreibt. Fehlt eins davon, fällt consent_contract aus dem Formular —
  // die übrigen Erklärungen (AGB, Bonitätsprüfung) lassen sich trotzdem geben, und der Kunde liest,
  // an wen er sich wenden kann (kein „wir melden uns": dafür entsteht hier keine Aufgabe — Wortwand). Nie „Zahlungspflichtig annehmen" ohne Übersicht.
  const vertragOffen = !!lage?.spalten.includes("consent_contract");
  const vertragsPaket = (() => {
    const k = lage?.packKey ?? paketKeyAusName(lage?.paket);
    return k && istUebersichtPaket(k) ? k : null;
  })();
  const vertragMoeglich = vertragOffen && !!vertragsPaket && !!lage?.vertragsFassung;
  const holtVertrag = vertragMoeglich;
  /** Die Spalten, die dieses Formular wirklich einholt. */
  const formSpalten = (lage?.spalten ?? []).filter((s) => s !== "consent_contract" || vertragMoeglich);
  const alleGesetzt = formSpalten.length > 0 && formSpalten.every((s) => gesetzt[s]);

  const bestaetigen = async () => {
    if (!lage || !alleGesetzt) return;
    const warVertrag = holtVertrag ? vertragsPaket : null;
    const bleibtOffen = vertragOffen && !vertragMoeglich;
    setSendet(true);
    setFehler(null);
    const res = await fetch(`/api/fiaon/zustimmung/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spalten: formSpalten }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setSendet(false);
    // ── JEDER AUSGANG IST SICHTBAR ────────────────────────────────────────
    // Auch der stille: Ohne Antwort steht hier ein Satz und nicht nichts.
    if (!j?.ok) {
      setFehler(j?.error
        || "Ihre Bestätigung ist nicht angekommen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es noch einmal.");
      return;
    }
    setLage(j.lage as Lage);
    setVertragGeschlossen(warVertrag);
    setVertragBleibtOffen(bleibtOffen);
    setFertig(true);
  };

  const rahmen = (inhalt: React.ReactNode) => (
    <div className="min-h-screen bg-white">
      <GlassNav />
      <main className="max-w-[640px] mx-auto px-5 pt-28 pb-20">{inhalt}</main>
      <PremiumFooter />
    </div>
  );

  if (laedt) {
    return rahmen(<p className="text-[15px] text-slate-500">Einen Moment …</p>);
  }

  if (fehler && !lage) {
    return rahmen(
      <>
        <h1 className="text-[26px] font-bold text-slate-900 mb-3">Das hat nicht geklappt</h1>
        <p className="text-[15px] leading-relaxed text-slate-600">{fehler}</p>
      </>,
    );
  }

  // E-244 NACHBESSERUNG: Nach „Zahlungspflichtig annehmen" nicht „Sie müssen nichts weiter tun" —
  // die erste Rate ist mit Vertragsschluss fällig (AGB § 5 Abs. 3). Die Zahlungsdaten gehen von hier
  // automatisch raus, wenn noch keine Rechnung lief und ein aktiver Betreuer da ist; ohne Betreuer
  // entsteht ein dringender Auftrag „Zahlungsdaten senden"; lief die Rechnung schon, hat der Kunde
  // sie bereits (server/routes/fiaon-zustimmung.ts, nachDerZustimmung). Genau das sagt der Text.
  if (fertig && vertragGeschlossen) {
    const u = bestellUebersicht(vertragGeschlossen);
    return rahmen(
      <>
        <h1 className="text-[26px] font-bold text-slate-900 mb-3">Danke — Ihr Vertrag ist geschlossen</h1>
        <p className="text-[15px] leading-relaxed text-slate-600">
          Ihre Annahme ist gespeichert. Die erste Monatsrate{u ? ` (${euro(u.rateCents)})` : ""} ist mit
          dem Vertragsschluss fällig. Die Zahlungsdaten erhalten Sie per E-Mail von uns; liegen sie
          Ihnen schon vor, gelten diese.
        </p>
        {lage?.paket && (
          <p className="mt-4 text-[13.5px] text-slate-500">
            Vorgang {lage.ref} · {lage.paket}
          </p>
        )}
        <p className="mt-4 text-[13px]">
          <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">AGB</a>
          {" · "}
          <a href="/widerrufsbelehrung" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Widerrufsbelehrung</a>
        </p>
      </>,
    );
  }

  if (fertig) {
    return rahmen(
      <>
        <h1 className="text-[26px] font-bold text-slate-900 mb-3">{vertragBleibtOffen ? "Danke — gespeichert" : "Danke — alles bestätigt"}</h1>
        {vertragBleibtOffen ? (
          <p className="text-[15px] leading-relaxed text-slate-600">
            Ihre Bestätigung ist gespeichert. Für die Annahme Ihres Vertrages wenden Sie sich bitte an
            Ihren Ansprechpartner oder an{" "}
            <a href="mailto:support@fiaon.com" className="text-blue-700 underline underline-offset-2">support@fiaon.com</a>.
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed text-slate-600">
            Ihre Bestätigung ist gespeichert. Sie müssen nichts weiter tun; Ihr
            Ansprechpartner meldet sich, wenn noch etwas offen ist.
          </p>
        )}
        {lage?.paket && (
          <p className="mt-4 text-[13.5px] text-slate-500">
            Vorgang {lage.ref} · {lage.paket}
          </p>
        )}
      </>,
    );
  }

  return rahmen(
    <>
      <h1 className="text-[26px] font-bold text-slate-900 mb-2">
        {lage?.name ? `Guten Tag ${lage.name},` : "Guten Tag,"}
      </h1>
      <p className="text-[15px] leading-relaxed text-slate-600 mb-6">
        für Ihren Vertrag fehlt noch Ihre Bestätigung. Das dauert zwei Klicks —
        und niemand außer Ihnen darf sie geben.
      </p>

      {lage?.paket && (
        <p className="text-[13.5px] text-slate-500 mb-6">
          Vorgang {lage.ref} · {lage.paket}
        </p>
      )}

      <div className="space-y-3">
        {formSpalten.map((s) => (
          <label key={s}
                 className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
                 style={{ minHeight: 44 }}>
            <input type="checkbox" checked={!!gesetzt[s]}
                   onChange={(e) => setGesetzt((v) => ({ ...v, [s]: e.target.checked }))}
                   className="mt-1 w-5 h-5 shrink-0 accent-[#2563eb]" />
            <span>
              <span className="block text-[14.5px] font-semibold text-slate-900">
                {TITEL[s] ?? s}
              </span>
              <span className="block text-[13.5px] leading-relaxed text-slate-600 mt-0.5">
                {ERLAEUTERUNG[s] ?? "Ich stimme zu."}
              </span>
            </span>
          </label>
        ))}
      </div>

      {holtVertrag && vertragsPaket && <Bestelluebersicht packKey={vertragsPaket} className="mt-6" />}

      {/* E-244: Vertrag offen, aber hier nicht annehmbar (kein erkanntes Paket / Server ohne Fassung). */}
      {vertragOffen && !vertragMoeglich && (
        <p data-vertrag-spaeter className="mt-6 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-[13.5px] leading-relaxed text-slate-600">
          Die Annahme Ihres Vertrages ist über diesen Link gerade nicht möglich, weil Paket und Preis
          hier noch nicht feststehen. Bitte wenden Sie sich an Ihren Ansprechpartner oder an{" "}
          <a href="mailto:support@fiaon.com" className="text-blue-700 underline underline-offset-2">support@fiaon.com</a>.
        </p>
      )}

      {/* Der Grund steht als TEXT am Knopf, nicht in einem Tooltip: Auf dem
          Telefon sieht einen Tooltip niemand. */}
      {fehler && (
        <p role="alert" className="mt-4 text-[13.5px] font-semibold text-red-600">{fehler}</p>
      )}

      {formSpalten.length > 0 && <>
      <button type="button" disabled={!alleGesetzt || sendet}
              onClick={() => void bestaetigen()}
              className="mt-6 w-full px-5 py-3.5 rounded-2xl text-[15px] font-bold text-white transition-colors"
              style={{
                minHeight: 48,
                background: !alleGesetzt || sendet ? "#cbd5e1" : "#2563eb",
                cursor: !alleGesetzt || sendet ? "not-allowed" : "pointer",
              }}>
        {sendet ? "Wird gespeichert …" : holtVertrag ? KNOPF_ZAHLUNGSPFLICHTIG : "Verbindlich bestätigen"}
      </button>

      {!alleGesetzt && (
        <p className="mt-2.5 text-[13px] text-slate-500">
          {holtVertrag ? "Bitte allen Punkten zustimmen — sonst kommt der Vertrag nicht zustande." : "Bitte allen Punkten zustimmen."}
        </p>
      )}
      </>}

      <p className="mt-6 text-[12.5px] leading-relaxed text-slate-400">
        Wir halten Zeitpunkt und Gerät fest, mit dem Sie bestätigt haben. Das ist
        der Nachweis, dass die Erklärung von Ihnen kommt — und nicht von uns.
      </p>
    </>,
  );
}
