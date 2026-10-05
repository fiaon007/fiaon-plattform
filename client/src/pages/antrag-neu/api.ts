// Die Aufrufe des neuen Antrags (server/routes/fiaon-antrag-neu.ts und bestehende Wege).
// Jeder Aufruf gibt { ok, status, json } zurück und wirft nie — die Seite zeigt
// Fehler selbst an (sichtbar, mit Weg zum Weitermachen).
import type { AntragNeuDaten } from "@shared/fiaon-antrag-neu";

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
  speichern: (ref: string, daten: AntragNeuDaten, schritt: string) => post(`${R(ref)}/speichern`, { daten, schritt }),
  stand: (ref: string) => rufen(`${R(ref)}/stand`),
  ausCookie: () => rufen<{ ok: boolean; ref: string | null }>("/api/fiaon/antrag-neu/aus-cookie"),
  vergessen: () => post("/api/fiaon/antrag-neu/vergessen", {}),
  pruefen: (ref: string, daten: AntragNeuDaten, sitzung: string) => post(`${R(ref)}/pruefen`, { daten, sitzung }, 40_000),
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
};
