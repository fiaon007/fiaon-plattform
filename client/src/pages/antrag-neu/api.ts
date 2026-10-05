// Die Aufrufe des neuen Antrags (server/routes/fiaon-antrag-neu.ts und bestehende Wege).
// Jeder Aufruf gibt { ok, status, json } zurück und wirft nie — die Seite zeigt
// Fehler selbst an (sichtbar, mit Weg zum Weitermachen).
//
// E-283 (05.10.2026): Der Messsatz (messungsDaten: fbp, fbc, Einwilligung, Kampagne) reist bei
// JEDEM Speichern und bei der Prüfung mit — wie im alten Antrag. Vorher nur beim Anlegen und
// bei der Annahme: Wer erst nach dem Kontakt-Bildschirm einwilligte, kam nie als
// InitiateCheckout bei Meta an. Ein Widerruf erreicht den Messsatz so beim nächsten Bildschirm.
import type { AntragNeuDaten } from "@shared/fiaon-antrag-neu";
import { messungsDaten } from "@/lib/werbung";

export type Antwort<T = any> = { ok: boolean; status: number; json: T | null };

async function rufen<T = any>(pfad: string, init: RequestInit = {}, zeitMs = 30_000): Promise<Antwort<T>> {
  const ab = new AbortController();
  const t = setTimeout(() => ab.abort(), zeitMs);
  try {
    const r = await fetch(pfad, {
      credentials: "include",
      ...init,
      signal: ab.signal,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    });
    const json = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok && (json as any)?.ok !== false, status: r.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(t);
  }
}
const post = <T = any>(pfad: string, body: unknown, zeitMs?: number) => rufen<T>(pfad, { method: "POST", body: JSON.stringify(body) }, zeitMs);
const R = (ref: string) => `/api/fiaon/antrag-neu/${encodeURIComponent(ref)}`;

export const api = {
  anlegen: (daten: AntragNeuDaten, extra: { leadLink: string | null; messung: unknown; sitzung: string }) =>
    post<{ ok: boolean; ref?: string; error?: string; schritt?: string; feld?: string }>("/api/fiaon/antrag-neu/anlegen", { daten, ...extra }),
  speichern: (ref: string, daten: AntragNeuDaten, schritt: string) => post(`${R(ref)}/speichern`, { daten, schritt, messung: messungsDaten() }),
  stand: (ref: string) => rufen(`${R(ref)}/stand`),
  ausCookie: () => rufen<{ ok: boolean; ref: string | null }>("/api/fiaon/antrag-neu/aus-cookie"),
  vergessen: () => post("/api/fiaon/antrag-neu/vergessen", {}),
  pruefen: (ref: string, daten: AntragNeuDaten, sitzung: string) => post(`${R(ref)}/pruefen`, { daten, sitzung, messung: messungsDaten() }, 40_000),
  pin: (ref: string, pin: string, sitzung: string) => post(`${R(ref)}/pin`, { pin, sitzung }),
  vertrag: (ref: string, sofort: boolean) => rufen<{ ok: boolean; html: string; angenommen: boolean }>(`${R(ref)}/vertrag${sofort ? "?sofort=1" : ""}`),
  annehmen: (ref: string, body: unknown) => post(`${R(ref)}/annehmen`, body, 45_000),
  auskunft: (ref: string, body: unknown) => post(`${R(ref)}/auskunft`, body),
  vertragPdf: (ref: string) => `${R(ref)}/vertrag.pdf`,
  rechnung: (ref: string) => `${R(ref)}/rechnung`,
  zahlungsauftrag: (paymentRef: string) => rufen(`/api/fiaon/payment-order/${encodeURIComponent(paymentRef)}`),
  zahlungGemeldet: (paymentRef: string) => post(`/api/fiaon/payment-order/${encodeURIComponent(paymentRef)}/claim-paid`, {}),
  emailBekannt: (email: string, ohne: string | null) =>
    rufen<{ bekannt: boolean; hatPasswort: boolean; unfertig: boolean }>(`/api/fiaon/antrag/email-bekannt?email=${encodeURIComponent(email)}${ohne ? `&ohne=${encodeURIComponent(ohne)}` : ""}`),
  vorbelegung: (code: string) => rufen(`/api/fiaon/antrag/vorbelegung/${encodeURIComponent(code)}`),
  adresse: (q: string, land: string, signal: AbortSignal) =>
    fetch(`/api/fiaon/adresse?q=${encodeURIComponent(q)}&land=${encodeURIComponent(land)}`, { signal }).then((r) => r.json()).catch(() => null),
  terminLink: (ref: string) => rufen<{ ok: boolean; url?: string; error?: string }>(`/api/fiaon/antrag/${encodeURIComponent(ref)}/termin-link`),
  terminSlots: (token: string) => rufen(`/api/fiaon/termin/${encodeURIComponent(token)}?von=antrag_neu&anrede=sie`),
  terminBuchen: (token: string, beginn: string, agentId: number) =>
    post(`/api/fiaon/termin/${encodeURIComponent(token)}/buchen`, { beginn, agentId, herkunft: "antrag_neu", anrede: "sie" }),
  einloggen: (ref: string) => post(`/api/fiaon/antrag/${encodeURIComponent(ref)}/einloggen`, {}),
  passwortSetzen: (ref: string, neu: string) => post(`/api/fiaon/kunde/${encodeURIComponent(ref)}/passwort-setzen`, { neu }),
  /**
   * Klick-Ereignis für die Akte (fiaon_click_events über /api/fiaon/track, E-283) — dieselben
   * Namen wie im alten Antrag, damit die Zeitleiste der Mitarbeiter sie in Klartext zeigt
   * (pack_select „Paket gewählt", checkout_bank_transfer „Zahlungsseite geöffnet",
   * contract_download „Vertrag heruntergeladen"). Ohne Inhalte; ein Fehler hält nichts auf.
   */
  klick: (event: string, ref: string | null, sitzung: string, data: Record<string, unknown> = {}) => {
    if (!ref) return;
    void post("/api/fiaon/track", { event, data, ref, sessionId: sitzung, page: "/antrag-neu" }).then((r) => {
      if (!r.ok) console.warn(`[ANTRAG-NEU] Klick „${event}" nicht gespeichert: HTTP ${r.status}`);
    });
  },
};
