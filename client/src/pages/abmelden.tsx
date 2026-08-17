// ═══════════════════════════════════════════════════════════════════════════
// ABMELDUNG VON DER LEAD-STRECKE
//
// ── HALTUNG ────────────────────────────────────────────────────────────────
// Wer hier landet, will nichts mehr hören. Diese Seite hat genau eine Aufgabe:
// das zu erledigen und ihn gehen zu lassen.
//
// Kein „Sind Sie sicher?". Kein „Vielleicht interessiert Sie stattdessen …".
// Kein Anmeldefeld. Ein Klick, eine Bestätigung, fertig.
//
// Das Feld für den Grund ist FREIWILLIG und steht NACH der Bestätigung — nicht
// davor. Es ist eine Bitte, keine Bedingung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useParams } from "wouter";

export default function AbmeldenPage(): JSX.Element {
  const { schluessel } = useParams<{ schluessel: string }>();
  const [laedt, setLaedt] = useState(true);
  const [vorname, setVorname] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const [grund, setGrund] = useState("");
  const [grundGesendet, setGrundGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // ── DIE ABMELDUNG PASSIERT SOFORT ─────────────────────────────────────
  // Nicht erst auf Knopfdruck: Der Klick im Mailprogramm WAR der Knopfdruck.
  // Wer hier eine zweite Bestätigung fordert, verliert die Leute, die die
  // Seite schließen — und sie bekommen weiter Mails, obwohl sie abbestellt
  // haben. Das ist der Fall, den es zu vermeiden gilt.
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const auskunft = await fetch(`/api/fiaon/abmelden/${schluessel}`).then((r) => r.json());
        if (abgebrochen) return;
        setVorname(auskunft?.vorname ?? null);
        const antwort = await fetch(`/api/fiaon/abmelden/${schluessel}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).then((r) => r.json());
        if (abgebrochen) return;
        if (antwort?.ok) setFertig(true);
        else setFehler(antwort?.error ?? "Das hat nicht funktioniert.");
      } catch {
        if (!abgebrochen) setFehler("Verbindung fehlgeschlagen.");
      } finally {
        if (!abgebrochen) setLaedt(false);
      }
    })();
    return () => { abgebrochen = true; };
  }, [schluessel]);

  async function grundSenden(): Promise<void> {
    if (!grund.trim()) return;
    try {
      await fetch(`/api/fiaon/abmelden/${schluessel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund: grund.trim() }),
      });
      setGrundGesendet(true);
    } catch { setGrundGesendet(true); }
  }

  return (
    <div className="min-h-screen bg-white flex items-start justify-center px-5 py-16">
      <div className="w-full max-w-[440px]">
        <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase mb-8">FIAON</div>

        {laedt && (
          <p className="text-[14px] text-slate-500">Einen Moment.</p>
        )}

        {!laedt && fehler && (
          <>
            <h1 className="text-[19px] font-medium text-slate-900 mb-3">Das hat nicht funktioniert</h1>
            <p className="text-[14px] leading-relaxed text-slate-600 mb-5">{fehler}</p>
            <p className="text-[13px] leading-relaxed text-slate-500">
              Schreib uns einfach an{" "}
              <a href="mailto:support@fiaon.com" className="text-slate-900 underline">support@fiaon.com</a>
              {" "}— wir nehmen dich dann von Hand heraus.
            </p>
          </>
        )}

        {!laedt && fertig && (
          <>
            <div className="w-8 h-8 mb-6" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                   className="text-slate-900">
                <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-[19px] font-medium text-slate-900 mb-3">
              {vorname ? `Erledigt, ${vorname}.` : "Erledigt."}
            </h1>
            <p className="text-[14px] leading-relaxed text-slate-600 mb-2">
              Du bekommst keine weiteren E-Mails von uns.
            </p>
            <p className="text-[13px] leading-relaxed text-slate-500 mb-10">
              Das gilt ab sofort. Sollte in den nächsten Minuten noch eine Nachricht
              ankommen, war sie schon unterwegs.
            </p>

            <div className="border-t border-slate-100 pt-7">
              {grundGesendet ? (
                <p className="text-[13px] text-slate-500">Danke — das hilft uns.</p>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-slate-600 mb-3">
                    Wenn du magst: Woran hat es gelegen? Freiwillig, ein Satz genügt.
                  </p>
                  <textarea
                    value={grund}
                    onChange={(e) => setGrund(e.target.value)}
                    rows={3}
                    className="w-full text-[14px] border border-slate-200 rounded-md px-3 py-2.5
                               focus:outline-none focus:border-slate-400 resize-none"
                    placeholder="Zu viele Mails, kein Interesse mehr, …"
                  />
                  <button
                    type="button"
                    onClick={grundSenden}
                    disabled={!grund.trim()}
                    className="mt-3 text-[13px] px-4 py-2 rounded-md border border-slate-300
                               text-slate-700 hover:bg-slate-50 disabled:opacity-40
                               disabled:cursor-not-allowed transition-colors"
                  >
                    Absenden
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
