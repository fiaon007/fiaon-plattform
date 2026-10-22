// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE LEISTE ÜBER „MEIN AUFTRAG“ (E-423, 22.10.2026)
//
// Zwei Zustände, eine schmale Zeile ÜBER dem Portal (das Portal selbst bleibt
// unberührt — client/src/pages/global-portal.tsx hat seinen eigenen Rahmen):
//   · angemeldet (Sitzung des persönlichen Zugangs): „Angemeldet als … · Ihre
//     Aufträge · Abmelden“
//   · mit Link geöffnet, noch ohne Zugang: das ruhige Banner „Richten Sie Ihren
//     persönlichen Zugang ein“ mit Knopf. Der Knopf holt den Einrichtungs-Link
//     beim Server (nur mit gültigem Link zur Akte) und führt dorthin.
// Ohne beides (Vorschau der Leitung, alter Stand): nichts.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { GLOBAL_KONTO_WOERTER } from "@/i18n/global-konto";
import { KONTO_PFADE } from "@shared/fiaon-global-konto";
import "@/styles/global-konto.css";

/** Wer vom Portal zur Anmeldung geschickt wird, bringt die Adresse zum Vorbelegen mit — im sessionStorage, nie in der Adresse. */
export const VORBELEGUNG_SCHLUESSEL = "fiaon_global_login_email";

/** Zur Anmeldung, mit Rückweg zu genau diesem Auftrag (nur Pfade der Business-Welt, der Server prüft es noch einmal). */
export function zurGlobalAnmeldung(s: "de" | "en", ref: string, email?: string | null): void {
  try { if (email) sessionStorage.setItem(VORBELEGUNG_SCHLUESSEL, email); } catch { /* ohne Speicher: leeres Feld */ }
  const weiter = `${KONTO_PFADE[s].auftrag}/${encodeURIComponent(ref)}`;
  window.location.replace(`${KONTO_PFADE[s].login}?weiter=${encodeURIComponent(weiter)}`);
}

export default function GlobalKontoLeiste({ s, konto, einrichten }: {
  s: "de" | "en";
  konto?: { email: string; name?: string | null } | null;
  einrichten?: { ref: string; token: string } | null;
}) {
  const t = GLOBAL_KONTO_WOERTER[s];
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  if (konto) {
    const abmelden = async () => {
      try { await fetch("/api/fiaon/global/konto/abmelden", { method: "POST", credentials: "same-origin" }); } catch { /* Cookie läuft trotzdem ab */ }
      window.location.assign(KONTO_PFADE[s].login);
    };
    return (
      <div className="gko-leiste" data-fiaon="global-konto-leiste">
        <span>{t.angemeldetAls(konto.email)}</span>
        <span className="trenner" aria-hidden="true" />
        <a href={KONTO_PFADE[s].konto}>{t.ihreAuftraege}</a>
        <span className="trenner" aria-hidden="true" />
        <button type="button" onClick={() => void abmelden()}>{t.abmelden}</button>
      </div>
    );
  }
  if (!einrichten) return null;
  const los = async () => {
    setLaeuft(true); setFehler("");
    try {
      const r = await fetch("/api/fiaon/global/konto/einrichten", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: einrichten.ref, t: einrichten.token, sprache: s }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok && typeof j.pfad === "string") { window.location.assign(j.pfad); return; }
      setFehler(j?.error || t.bannerFehler);
    } catch { setFehler(t.bannerFehler); }
    setLaeuft(false);
  };
  return (
    <div className="gko-banner" role="note" data-fiaon="global-konto-banner">
      <span>{t.bannerText}</span>
      <button type="button" onClick={() => void los()} disabled={laeuft}>{laeuft ? t.einenMoment : t.bannerKnopf}</button>
      {fehler && <small role="alert">{fehler}</small>}
    </div>
  );
}
