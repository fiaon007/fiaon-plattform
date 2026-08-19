import { useCallback, useEffect, useRef, useState } from "react";
import { useReduzierteBewegung } from "@/lib/fiaon-ui";

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERGABE DER VERTRIEBSLEITUNG — Glückwunsch, Einführung, Annahme
//
// Diese Tafel erscheint EINMAL: beim ersten Öffnen des Bereichs „Vertrieb" (und
// erneut, wenn sich die Erklärung ändert). Sie hat drei Aufgaben in genau dieser
// Reihenfolge, und die Reihenfolge ist die Botschaft:
//
//   1. GRATULIEREN. Eine Beförderung, die als Fehlermeldung daherkommt, fühlt
//      sich nicht wie eine an.
//   2. EINFÜHREN. Was kann ich hier, was ausdrücklich nicht — bevor jemand
//      herumprobiert und dabei fremde Kundendaten anfasst.
//   3. VERPFLICHTEN. Mehr Rechte heißt mehr Verantwortung, und die muss
//      ausdrücklich angenommen werden.
//
// GESTALTUNG
// Kein einziges Icon, kein Emoji. Die Ordnung entsteht durch Typografie:
// Ziffernmarken in Versalien-Weite, Haarlinien, Weißraum. Ein Piktogramm neben
// einer Verpflichtungserklärung nimmt ihr den Ernst — dieselbe Tafel mit
// Sternchen und Häkchen wirkt wie ein Gewinnspiel.
//
// Das Glas gilt für die schwebende Ebene (Kopf und Fuß der Tafel), der Körper
// ist massiv — genau die Regel des Systems. Der Eintritt kommt aus der Tiefe
// (perspective + rotateX), nicht aus einem Zoom: Die Tafel legt sich auf die
// Seite, sie springt nicht heraus.
//
// EIN BEWUSSTER WIDERSTAND
// Die Knöpfe sind gesperrt, bis der Text bis zum Ende gelesen wurde (gemessen am
// Scrollstand). Das ist unbequem und genau deshalb richtig: Eine Erklärung, die
// man wegklicken kann, ohne sie gesehen zu haben, ist als Nachweis nichts wert —
// und im Streitfall wäre sie das Papier nicht wert, auf dem sie nicht steht.
// ═══════════════════════════════════════════════════════════════════════════

interface ZusageDaten {
  offen: boolean;
  neufassung: boolean;
  name: string;
  vorname: string;
  pruefwert: string;
  text: {
    version: string;
    ueberschrift: string;
    gratulation: string;
    einleitung: string;
    kann: { titel: string; text: string }[];
    kannNicht: string[];
    pflichten: { nr: number; titel: string; text: string }[];
    schlusssatz: string;
    hinweisProtokoll: string;
  };
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

export function VertriebZusage({ daten, onAngenommen, basis = "/agent/vertrieb/zusage" }: {
  daten: ZusageDaten; onAngenommen: () => void;
  /**
   * Welcher Bereich seine Erklärung vorlegt. Vertriebsleitung und Onboarding
   * benutzen dieselbe Tafel — Aufbau, Lesesperre, Unterschrift und
   * Nachweisqualität sind identisch, nur der Text kommt von woanders.
   */
  basis?: string;
}) {
  const reduziert = useReduzierteBewegung();
  const [gelesen, setGelesen] = useState(false);
  const [bisEnde, setBisEnde] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const koerper = useRef<HTMLDivElement>(null);

  // Gelesen heißt: unten angekommen. Ein Fenster, das gar nicht scrollen muss
  // (großer Bildschirm), gilt sofort als gelesen — sonst wäre die Sperre eine
  // Falle ohne Ausweg.
  const pruefeStand = useCallback(() => {
    const el = koerper.current;
    if (!el) return;
    const rest = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (rest <= 24) setBisEnde(true);
  }, []);

  useEffect(() => {
    pruefeStand();
    const el = koerper.current;
    if (!el) return;
    el.addEventListener("scroll", pruefeStand, { passive: true });
    return () => el.removeEventListener("scroll", pruefeStand);
  }, [pruefeStand]);

  // Die Tafel ist nicht wegklickbar: kein Klick auf den Hintergrund, kein Escape.
  // Wer den Bereich betritt, entscheidet sich — annehmen oder verlassen.
  useEffect(() => {
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = vorher; };
  }, []);

  const annehmen = async () => {
    setFehler(null);
    setBusy(true);
    const r = await api(basis, {
      method: "POST",
      body: JSON.stringify({ version: daten.text.version, name, gelesen }),
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Nicht gespeichert. Bitte erneut versuchen."); return; }
    setFertig(String(r.json.akzeptiertAm || ""));
    // Kurz stehen lassen: Die Bestätigung soll gelesen werden können, bevor die
    // Daten erscheinen. Zwei Sekunden sind lang genug für einen Satz und zu kurz
    // zum Warten.
    setTimeout(onAngenommen, reduziert ? 400 : 1900);
  };

  const bereit = gelesen && bisEnde && name.trim().length > 2 && !busy;

  return (
    <>
      <div className="fixed inset-0 z-[200]"
           style={{ background: "rgba(7,11,22,.62)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
           aria-hidden="true" />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-3 sm:p-6 fi-buehne">
        <div role="dialog" aria-modal="true" aria-labelledby="zusage-titel"
             className="w-full flex flex-col overflow-hidden"
             style={{
               maxWidth: 780,
               maxHeight: "92vh",
               background: "var(--fi-karte, #fff)",
               borderRadius: 24,
               boxShadow: "0 40px 120px -24px rgba(13,26,63,.55), inset 0 1px 0 rgba(255,255,255,.7)",
               animation: reduziert ? "none" : "zusageAuf 620ms cubic-bezier(.32,.72,0,1) both",
               transformStyle: "preserve-3d",
             }}>

          {/* ── Kopf: schwebende Ebene, also Glas ──────────────────────────── */}
          {/* Der Kopf bleibt bewusst schlank. Auf einem 380px-Gerät stand hier
              zuerst auch die Einleitung — dann blieben vom Leseraum 150 Pixel,
              und die Erklärung, die man lesen SOLL, lag in einem Guckloch. Der
              Fließtext gehört deshalb in den scrollenden Körper. */}
          <div className="fi-glas px-6 sm:px-9 pt-6 pb-5 shrink-0" style={{ transform: "translateZ(24px)" }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.22em]"
               style={{ color: "var(--fi-text-still)" }}>
              {daten.neufassung ? "Neue Fassung" : "Neue Verantwortung"}
            </p>
            <h1 id="zusage-titel" className="mt-2 text-[22px] sm:text-[32px] font-bold tracking-tight leading-[1.1]">
              <span className="fi-gradient-text">{daten.text.gratulation}</span>
            </h1>
            {/* Haarlinie statt Trennbalken: Die Ebene endet, sie wird nicht zerschnitten. */}
            <div className="mt-4 sm:mt-5" style={{ height: 1, background: "linear-gradient(90deg, rgba(29,78,216,.28), rgba(15,23,42,.06) 40%, transparent)" }} />
          </div>

          {/* ── Körper: massiv, scrollend ──────────────────────────────────── */}
          <div ref={koerper} className="flex-1 overflow-y-auto px-6 sm:px-9 py-7" style={{ background: "#fff" }}>

            <p className="mb-7 text-[13.5px] sm:text-[14.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              {daten.text.einleitung}
            </p>

            <Abschnitt nummer="01" titel="Was du jetzt kannst">
              <div className="grid sm:grid-cols-2 gap-3">
                {daten.text.kann.map((k, i) => (
                  <div key={k.titel} className="p-4 rounded-2xl"
                       style={{
                         border: "1px solid var(--fi-linie)",
                         background: "linear-gradient(180deg, rgba(29,78,216,.026), transparent 60%)",
                         animation: reduziert ? "none" : `fiKarteAuf 420ms cubic-bezier(.32,.72,0,1) both`,
                         animationDelay: reduziert ? undefined : `${120 + i * 70}ms`,
                       }}>
                    <p className="text-[13.5px] font-bold">{k.titel}</p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                      {k.text}
                    </p>
                  </div>
                ))}
              </div>
            </Abschnitt>

            <Abschnitt nummer="02" titel="Was ausdrücklich nicht geht">
              <ul className="space-y-2.5 pl-4" style={{ borderLeft: "2px solid var(--fi-linie)" }}>
                {daten.text.kannNicht.map((t) => (
                  <li key={t} className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>{t}</li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>
                Diese Grenzen sind im Server gezogen, nicht in der Ansicht. Sie sind kein Misstrauen,
                sondern dein Schutz: Was du nicht tun kannst, kann dir auch niemand anlasten.
              </p>
            </Abschnitt>

            <Abschnitt nummer="03" titel="Verpflichtungserklärung">
              <ol className="space-y-4">
                {daten.text.pflichten.map((p) => (
                  <li key={p.nr} className="flex gap-3.5">
                    <span className="shrink-0 text-[11px] font-bold tabular-nums pt-0.5"
                          style={{ color: "var(--fi-primaer)", minWidth: 22 }}>
                      {String(p.nr).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold">{p.titel}</span>
                      <span className="block mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                        {p.text}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Abschnitt>

            <div className="mt-7 p-4 rounded-2xl"
                 style={{ background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
              <p className="text-[13px] font-semibold leading-relaxed">{daten.text.schlusssatz}</p>
              <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
                {daten.text.hinweisProtokoll}
              </p>
              <p className="mt-2 text-[10.5px] tabular-nums" style={{ color: "var(--fi-text-still)" }}>
                Fassung {daten.text.version} · Prüfwert {daten.pruefwert}
              </p>
            </div>
          </div>

          {/* ── Fuß: schwebende Ebene, also Glas ───────────────────────────── */}
          <div className="fi-glas px-6 sm:px-9 py-5 shrink-0"
               style={{ transform: "translateZ(24px)", boxShadow: "inset 0 1px 0 var(--fi-glas-linie), inset 0 2px 0 rgba(255,255,255,.7)" }}>
            {fertig ? (
              <div className="fi-puls-erfolg rounded-xl px-1 py-1">
                <p className="text-[14.5px] font-bold">Angenommen.</p>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--fi-text-leise)" }}>
                  {new Date(fertig).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })} — der Bereich Vertrieb ist jetzt offen.
                </p>
              </div>
            ) : (
              <>
                {!bisEnde && (
                  <p className="mb-3 text-[12px] font-semibold" style={{ color: "var(--fi-tier2)" }}>
                    Bitte bis zum Ende lesen — danach lässt sich annehmen.
                  </p>
                )}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={gelesen} disabled={!bisEnde}
                         onChange={(e) => setGelesen(e.target.checked)}
                         className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                  <span className="text-[12.5px] leading-snug" style={{ color: bisEnde ? "var(--fi-text)" : "var(--fi-text-still)" }}>
                    Ich habe die Erklärung gelesen und verstanden und nehme die Verantwortung an.
                  </span>
                </label>

                <div className="mt-3.5 flex flex-col sm:flex-row sm:items-end gap-2.5">
                  <label className="flex-1 min-w-0">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-[.14em] mb-1.5"
                          style={{ color: "var(--fi-text-still)" }}>
                      Unterschrift — vollständiger Name
                    </span>
                    <input value={name} onChange={(e) => { setName(e.target.value); setFehler(null); }}
                           disabled={!bisEnde} placeholder={daten.name}
                           autoComplete="off" spellCheck={false}
                           className={`w-full h-[42px] px-3 rounded-xl bg-white text-[14px] outline-none ${fehler ? "fi-shake" : ""}`}
                           style={{ border: `1px solid ${fehler ? "var(--fi-tier1)" : "var(--fi-linie)"}` }} />
                  </label>
                  <button type="button" disabled={!bereit} onClick={() => void annehmen()}
                          className="fi-primaerknopf px-5 h-[42px] text-[13.5px] font-semibold text-white whitespace-nowrap"
                          style={!bereit ? { opacity: .45, cursor: "not-allowed" } : undefined}>
                    {busy ? "Wird gespeichert …" : "Verantwortung annehmen"}
                  </button>
                </div>

                {fehler && <p className="mt-2.5 text-[12.5px] font-semibold" style={{ color: "var(--fi-tier1)" }}>{fehler}</p>}
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                    Ohne Annahme bleibt der Bereich verschlossen. Deine eigene Kundenliste kannst du
                    unverändert weiter nutzen.
                  </p>
                  {/* DER AUSWEG. Eine Zusage, aus der es kein Zurück gibt, ist keine
                      freiwillige — und eine unfreiwillige ist als Nachweis wertlos.
                      Deshalb steht hier ein leiser, aber echter Weg hinaus. Wer nicht
                      annimmt, verliert nichts außer diesem Bereich. */}
                  <a href="/agent/kunden" className="text-[12px] font-semibold whitespace-nowrap"
                     style={{ color: "var(--fi-text-leise)", textDecoration: "underline", textUnderlineOffset: 3 }}>
                    Später entscheiden
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Der Eintritt: aus der Tiefe, nicht aus einem Zoom. */}
      <style>{`
        @keyframes zusageAuf {
          from { opacity: 0; transform: translateY(26px) rotateX(7deg) scale(.975); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes zusageAuf { from { opacity: 0 } to { opacity: 1 } }
        }
      `}</style>
    </>
  );
}

/** Abschnitt mit Ziffernmarke — die Ordnung kommt aus der Schrift, nicht aus Bildchen. */
function Abschnitt({ nummer, titel, children }: { nummer: string; titel: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <div className="flex items-baseline gap-3 mb-3.5">
        <span className="text-[11px] font-bold tabular-nums tracking-[.14em]" style={{ color: "var(--fi-primaer)" }}>
          {nummer}
        </span>
        <h2 className="text-[15px] font-bold tracking-tight">{titel}</h2>
        <span className="flex-1" style={{ height: 1, background: "var(--fi-linie)" }} />
      </div>
      {children}
    </section>
  );
}

/** Lädt den Stand der Erklärung. `null` = noch unbekannt, `false` = alles gut. */
export function useZusage(basis = "/agent/vertrieb/zusage") {
  const [daten, setDaten] = useState<ZusageDaten | null>(null);
  const [geprueft, setGeprueft] = useState(false);

  // ══════════════════════════════════════════════════════════════════════════
  // `geprueft` WIRD IMMER GESETZT (19.08.2026)
  //
  // Vorher stand `setGeprueft(true)` NACH dem `await` und ohne Absicherung.
  // Wirft `fetch` (Netz weg, Zwischenserver bricht ab), springt die Funktion
  // heraus und `geprueft` bleibt für immer `false`.
  //
  // Die Vertriebsseite lädt aber NUR, wenn `geprueft` wahr ist
  // (`if (geprueft && !zusage) void ladeKopf()`). Ein abgebrochener Aufruf hier
  // legt also die ganze Seite still: Titel, Reiter und Tabellenkopf stehen da,
  // darunter graue Balken — dauerhaft. Genau das hat die Vertriebsleitung als
  // „weißes Fenster, es werden keine Inhalte angezeigt" gemeldet.
  //
  // `finally` ist die ganze Reparatur: Nach dem Versuch ist geprüft — ob er
  // geklappt hat oder nicht. Der Fehlerfall zeigt dann die Meldung der Seite
  // statt eines Ladezustands ohne Ende.
  // ══════════════════════════════════════════════════════════════════════════
  const laden = useCallback(async () => {
    try {
      const r = await api(basis);
      if (r.ok) setDaten(r.json.offen ? (r.json as ZusageDaten) : null);
    } catch (e) {
      console.error(`[ZUSAGE] ${basis} konnte nicht geladen werden:`, e);
    } finally {
      setGeprueft(true);
    }
  }, [basis]);

  useEffect(() => { void laden(); }, [laden]);
  return { zusage: daten, geprueft, erneutPruefen: laden, schliessen: () => setDaten(null) };
}

/**
 * Die Tafel als eigenständiger Block: lädt selbst, zeigt selbst.
 *
 * Der Vertriebsbereich hat seine eigene Verdrahtung (er braucht den Stand
 * ohnehin für andere Zwecke). Für neue Bereiche genügt diese eine Zeile.
 */
export function ZusageTafel({ basis, onAngenommen }: { basis: string; onAngenommen: () => void }) {
  const { zusage, geprueft, erneutPruefen } = useZusage(basis);
  if (!geprueft) return null;
  if (!zusage) { onAngenommen(); return null; }
  return (
    <VertriebZusage
      daten={zusage}
      basis={basis}
      onAngenommen={() => { void erneutPruefen(); onAngenommen(); }}
    />
  );
}
