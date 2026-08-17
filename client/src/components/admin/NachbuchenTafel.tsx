// ═══════════════════════════════════════════════════════════════════════════
// NACHBUCHEN — der Reiter, auf den die Umleitung schon zeigte
//
// ── DER BEFUND (17.08.2026) ────────────────────────────────────────────────
// Betreiber: „Ich kann keine Provisionen mehr nachbuchen."
//
// Die Funktion war NICHT weg. Sie war unerreichbar:
//
//   1. `/admin/nachbuchung` leitet um auf `/admin/team?tab=nachbuchung`
//      — diesen Reiter gab es NICHT. Die Zentrale kennt acht Reiter, und
//      „nachbuchung" war keiner davon. Ein unbekannter Wert fällt auf
//      „menschen" zurück: Der Betreiber landete auf der Mitarbeiterliste und
//      sah keinen Hinweis auf Nachbuchung.
//   2. `/admin/funktionen` verlinkt auf `/admin/nachbuchung` — also im Kreis.
//   3. Der Knopf saß VIER Ebenen tief: Zentrale → Karte klicken → Reiter
//      „Provisionen" → nach unten scrollen.
//
// Am 10.08. wurde die Altseite abgerissen, NACHDEM die Funktion umgezogen war
// — die Reihenfolge war richtig. Nur der WEG dorthin blieb kaputt, und ein
// Prüfstand, der „die alte Seite existiert nicht mehr" prüft, wird davon grün.
//
// Diese Tafel macht die Umleitung wahr: alle nachbuchbaren Fälle an einem Ort,
// wie auf der Altseite — einzeln oder gesammelt.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { PaketName } from "./PaketName";

interface Kandidat {
  ref: string;
  payment_reference: string | null;
  pack_name: string | null;
  customer_name: string | null;
  email: string | null;
  paid_at: string | null;
  assigned_agent_id: number | null;
  agent_name: string | null;
  suggested_agent_id: number | null;
  suggested_agent_name: string | null;
  agent_rate_bp: number | null;
  estimated_commission_cents: number | null;
  base_amount_cents: number | null;
  status: string;
  grund?: string | null;
}

interface Zusammenfassung {
  total: number; bookable: number; unclear: number; bookableCommissionCents: number;
}

const eur = (c: number | null | undefined) =>
  `${(Number(c ?? 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function datum(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin",
  });
}

export function NachbuchenTafel({
  onMeldung,
}: {
  onMeldung?: (art: "gut" | "schlecht", text: string) => void;
}) {
  const [liste, setListe] = useState<Kandidat[] | null>(null);
  const [summe, setSumme] = useState<Zusammenfassung | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [alleBusy, setAlleBusy] = useState(false);
  const [nurUnklar, setNurUnklar] = useState(false);

  const laden = useCallback(async () => {
    const r = await fetch("/api/fiaon/admin/commission-backfill/candidates",
      { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setListe(j?.ok ? (j.candidates ?? []) : []);
    setSumme(j?.summary ?? null);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const gezeigt = useMemo(() => {
    // ── DIE ARBEIT, DIE MAN TUN KANN, STEHT OBEN ──────────────────────────
    // Aufgefallen auf dem Screenshot: Bei 21 Fällen waren die 19 UNKLAREN
    // zuerst gelistet, die 2 buchbaren ganz unten. Der Betreiber öffnet die
    // Tafel, sieht neunzehn gesperrte Knöpfe und schließt sie wieder.
    //
    // Eindeutige zuerst, danach nach Zahldatum (der älteste Fall wartet am
    // längsten). Die unklaren bleiben sichtbar — sie sind auch Arbeit, nur
    // eine, die eine Entscheidung braucht.
    const l = (liste ?? []).filter((k) => (nurUnklar ? k.status !== "nachbuchbar" : true));
    return [...l].sort((a, b) => {
      const ka = a.status === "nachbuchbar" ? 0 : 1;
      const kb = b.status === "nachbuchbar" ? 0 : 1;
      if (ka !== kb) return ka - kb;
      return String(a.paid_at ?? "").localeCompare(String(b.paid_at ?? ""));
    });
  }, [liste, nurUnklar]);

  const buchen = async (k: Kandidat) => {
    setBusy(k.ref);
    const agentId = k.assigned_agent_id ?? k.suggested_agent_id;
    const r = await fetch(
      `/api/fiaon/admin/commission-backfill/${encodeURIComponent(k.ref)}/book`,
      {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      },
    ).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    if (j?.ok) {
      onMeldung?.("gut", `Gebucht: ${k.customer_name ?? k.ref} — ${eur(k.estimated_commission_cents)}`);
      // Die Zeile SOFORT aus der Liste nehmen, nicht erst nach dem Neuladen:
      // Wer zehn Fälle abarbeitet, will sehen, dass jeder Klick gewirkt hat.
      setListe((v) => (v ?? []).filter((x) => x.ref !== k.ref));
      void laden();
    } else {
      onMeldung?.("schlecht", j?.error || "Die Buchung hat nicht geklappt.");
    }
  };

  const alleBuchen = async () => {
    const klar = (liste ?? []).filter((k) => k.status === "nachbuchbar");
    if (klar.length === 0) return;
    if (!confirm(
      `${klar.length} ${klar.length === 1 ? "Fall" : "Fälle"} gesammelt buchen?\n\n`
      + `Provision insgesamt: ${eur(summe?.bookableCommissionCents ?? 0)}\n\n`
      + "Gebucht wird nur, was eindeutig ist. Unklare Beträge bleiben stehen "
      + "und müssen einzeln entschieden werden.",
    )) return;
    setAlleBusy(true);
    const r = await fetch("/api/fiaon/admin/commission-backfill/book-all", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: "{}",
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setAlleBusy(false);
    if (j?.ok) {
      onMeldung?.("gut", j.meldung
        || `${j.gebucht ?? klar.length} Fälle gebucht.${j.uebersprungen ? ` ${j.uebersprungen} übersprungen.` : ""}`);
      void laden();
    } else onMeldung?.("schlecht", j?.error || "Der Sammellauf hat nicht geklappt.");
  };

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5"
         style={{ borderColor: "#e2e8f0", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-slate-900">Provisionen nachbuchen</h2>
          <p className="text-[12.5px] text-slate-500 mt-0.5 max-w-[70ch] leading-relaxed">
            Bezahlte Bestellungen, zu denen keine Provision gebucht ist. Der Betreuer kommt
            aus der Zuteilung — fehlt sie, aus dem dokumentierten Kontaktverlauf. Buchen ist
            idempotent: Ein zweiter Klick erzeugt keine zweite Provision.
          </p>
        </div>
        {summe && summe.bookable > 0 && (
          <button type="button" onClick={() => void alleBuchen()} disabled={alleBusy}
                  className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
                  style={{ background: "#1d4ed8" }}>
            {alleBusy ? "Wird gebucht …" : `Alle ${summe.bookable} eindeutigen buchen`}
          </button>
        )}
      </div>

      {/* ── DIE ZAHLEN ─────────────────────────────────────────────────── */}
      {summe && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { t: "Offene Fälle", w: String(summe.total) },
            { t: "Eindeutig", w: String(summe.bookable) },
            { t: "Betrag unklar", w: String(summe.unclear) },
            { t: "Provision insgesamt", w: eur(summe.bookableCommissionCents) },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "#e2e8f0" }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-slate-400">{f.t}</p>
              <p className="text-[17px] font-bold tabular-nums text-slate-900 mt-0.5">{f.w}</p>
            </div>
          ))}
        </div>
      )}

      {summe && summe.unclear > 0 && (
        <button type="button" onClick={() => setNurUnklar((v) => !v)}
                className="mt-3 text-[12px] font-semibold underline decoration-slate-300"
                style={{ color: nurUnklar ? "#1d4ed8" : "#64748b" }}>
          {nurUnklar ? "Alle Fälle zeigen" : `Nur die ${summe.unclear} unklaren zeigen`}
        </button>
      )}

      {/* ── DIE FÄLLE ──────────────────────────────────────────────────── */}
      <div className="mt-4">
        {!liste && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
        {liste && gezeigt.length === 0 && (
          <p className="text-[13px] text-slate-500">
            {nurUnklar
              ? "Kein unklarer Fall."
              : "Keine offene Nachbuchung — jede bezahlte Bestellung hat ihre Provision."}
          </p>
        )}
        {gezeigt.length > 0 && (
          <ul className="space-y-1.5">
            {gezeigt.slice(0, 200).map((k) => {
              const klar = k.status === "nachbuchbar";
              const wer = k.agent_name ?? k.suggested_agent_name;
              return (
                <li key={k.ref}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5"
                    style={{ borderColor: klar ? "#e2e8f0" : "rgba(180,83,9,.28)",
                             background: klar ? "#fff" : "rgba(180,83,9,.035)" }}>
                  <span className="text-[13px] font-semibold text-slate-900 min-w-0">
                    {k.customer_name ?? "Ohne Namen"}
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-400">{k.ref}</span>
                  <PaketName name={k.pack_name} bezahlt />
                  <span className="text-[11.5px] text-slate-400">bezahlt {datum(k.paid_at)}</span>
                  <span className="text-[12px] text-slate-600">
                    {wer ? `→ ${wer}` : "kein Betreuer erkennbar"}
                    {!k.agent_name && k.suggested_agent_name && (
                      <span className="text-slate-400"> (aus dem Verlauf)</span>
                    )}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="text-[13px] font-bold tabular-nums text-slate-900">
                      {klar ? eur(k.estimated_commission_cents) : "Betrag unklar"}
                    </span>
                    <button type="button" disabled={!klar || busy === k.ref}
                            onClick={() => void buchen(k)}
                            title={klar
                              ? `Provision buchen${wer ? ` für ${wer}` : ""}`
                              : (k.grund
                                || "Der Betrag lässt sich nicht eindeutig ableiten. Bitte in der Bestellung klären.")}
                            className="px-3 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-30"
                            style={{ background: "#1d4ed8" }}>
                      {busy === k.ref ? "…" : "Buchen"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {gezeigt.length > 200 && (
          <p className="mt-2.5 text-[11.5px] text-slate-400">
            {gezeigt.length - 200} weitere. Der Sammelknopf oben nimmt alle eindeutigen.
          </p>
        )}
      </div>
    </div>
  );
}
