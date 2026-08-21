import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

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
  consent_contract: "Ich nehme den Vertrag verbindlich an.",
};

const TITEL: Record<string, string> = {
  consent_agb: "AGB und Datenschutz",
  consent_schufa: "Bonitätsprüfung",
  consent_contract: "Vertragsannahme",
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

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await fetch(`/api/fiaon/zustimmung/${encodeURIComponent(token)}`)
      .catch(() => null);
    const j = await res?.json().catch(() => null);
    setLaedt(false);
    if (!j?.ok) {
      setFehler(j?.error || "Wir konnten diesen Link nicht öffnen. Bitte melde dich kurz bei uns.");
      return;
    }
    setFehler(null);
    setLage(j.lage as Lage);
    if ((j.lage as Lage).fertig) setFertig(true);
  }, [token]);

  useEffect(() => { void laden(); }, [laden]);

  const alleGesetzt = !!lage && lage.spalten.length > 0
    && lage.spalten.every((s) => gesetzt[s]);

  const bestaetigen = async () => {
    if (!lage || !alleGesetzt) return;
    setSendet(true);
    setFehler(null);
    const res = await fetch(`/api/fiaon/zustimmung/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spalten: lage.spalten }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setSendet(false);
    // ── JEDER AUSGANG IST SICHTBAR ────────────────────────────────────────
    // Auch der stille: Ohne Antwort steht hier ein Satz und nicht nichts.
    if (!j?.ok) {
      setFehler(j?.error
        || "Deine Bestätigung ist nicht angekommen. Bitte prüfe deine Verbindung und versuch es noch einmal.");
      return;
    }
    setLage(j.lage as Lage);
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

  if (fertig) {
    return rahmen(
      <>
        <h1 className="text-[26px] font-bold text-slate-900 mb-3">Danke — alles bestätigt</h1>
        <p className="text-[15px] leading-relaxed text-slate-600">
          Deine Bestätigung ist gespeichert. Du musst nichts weiter tun; dein
          Ansprechpartner meldet sich, wenn noch etwas offen ist.
        </p>
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
        {lage?.name ? `Hallo ${lage.name.split(" ")[0]},` : "Hallo,"}
      </h1>
      <p className="text-[15px] leading-relaxed text-slate-600 mb-6">
        für deinen Vertrag fehlt noch deine Bestätigung. Das dauert zwei Klicks —
        und niemand außer dir darf sie geben.
      </p>

      {lage?.paket && (
        <p className="text-[13.5px] text-slate-500 mb-6">
          Vorgang {lage.ref} · {lage.paket}
        </p>
      )}

      <div className="space-y-3">
        {lage?.spalten.map((s) => (
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

      {/* Der Grund steht als TEXT am Knopf, nicht in einem Tooltip: Auf dem
          Telefon sieht einen Tooltip niemand. */}
      {fehler && (
        <p role="alert" className="mt-4 text-[13.5px] font-semibold text-red-600">{fehler}</p>
      )}

      <button type="button" disabled={!alleGesetzt || sendet}
              onClick={() => void bestaetigen()}
              className="mt-6 w-full px-5 py-3.5 rounded-2xl text-[15px] font-bold text-white transition-colors"
              style={{
                minHeight: 48,
                background: !alleGesetzt || sendet ? "#cbd5e1" : "#2563eb",
                cursor: !alleGesetzt || sendet ? "not-allowed" : "pointer",
              }}>
        {sendet ? "Wird gespeichert …" : "Verbindlich bestätigen"}
      </button>

      {!alleGesetzt && (
        <p className="mt-2.5 text-[13px] text-slate-500">
          Bitte allen Punkten zustimmen — sonst kommt der Vertrag nicht zustande.
        </p>
      )}

      <p className="mt-6 text-[12.5px] leading-relaxed text-slate-400">
        Wir halten Zeitpunkt und Gerät fest, mit dem du bestätigt hast. Das ist
        der Nachweis, dass die Erklärung von dir kommt — und nicht von uns.
      </p>
    </>,
  );
}
