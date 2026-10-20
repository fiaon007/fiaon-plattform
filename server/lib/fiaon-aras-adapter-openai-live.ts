// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Adapter „openai_live“: GPT-Live über WebSocket (E-408, Vertrag § 7)
//
// Gegen die OpenAI-Doku vom 20.10.2026 geprüft (Referenz „Primary WebSocket“,
// Guides „Managing GPT-Live sessions“, „Delegation and tools“, „Prompting
// GPT-Live“, „WebSockets“):
//
//   · wss://api.openai.com/v1/live/sessions, Bearer = Hausschlüssel (kiSchluessel),
//     KEINE Query-Parameter. Erste Nachricht `session.start`, dann auf
//     `session.started` warten, erst DANN Ton schicken (davor puffern wir).
//   · Ton beidseitig `audio/pcmu` 8000 Hz (= Twilio µ-law, keine Umwandlung):
//     rein `session.input_audio.append {audio}`, raus `session.output_audio.delta {delta}`.
//     Es gibt KEIN „Ausgabe fertig“-Ereignis — „spricht“ messen wir am Tonfluss.
//   · Begrüßung: eine `developer`-Nachricht in `session.input` (so empfiehlt es
//     die Doku für „Greet before the caller speaks“) — und Ton durchgehend
//     weiterschicken, auch Stille.
//   · Transkript: `session.input_transcript.delta` / `session.output_transcript.delta`
//     mit `delta`, `start_ms`, `end_ms` (kein „done“ — die Brücke gruppiert).
//   · Kosten: `session.usage.updated {usage.seconds}` (laufende Summe, nicht addieren),
//     Ende: `session.close` → `session.closed {reason, usage}`.
//   · Werkzeuge über die Responses-Delegation: `session.delegation.created`
//     (target responses), dann `response.event {delegation_id, event}`; ein fertiger
//     Aufruf ist das innere `response.output_item.done` mit item.type function_call
//     (call_id, name, arguments). Wir führen aus, schicken `response.item.create`
//     {function_call_output} und DANACH `response.create` (ohne das läuft der
//     Hintergrund nicht weiter). Die Antwort des Hintergrund-Modells spricht
//     GPT-Live selbst — wir schieben KEINEN zweiten Vorlese-Text hinterher.
//   · Hinweise an die Stimme: `session.instructions.append` (darf laufende Rede
//     unterbrechen — Notaus, Übergabe), `session.commentary.append` (soll gesagt
//     werden, frei formuliert), `session.thinking.append` (still) — Feld `content`
//     (≤ 500 Token), `delegation_id: null`.
//   · `store: false` (sonst speichert OpenAI die Sitzung bis 30 Tage).
//
// Weil die Schnittstelle jung ist, liest der Adapter jede Nachricht tolerant
// und protokolliert unbekannte Arten einmal je Sitzung („[ARAS-LIVE] unbekannt“) —
// so sieht man beim ersten echten Probeanruf sofort, wo ein Name abweicht.
// Pflichten (§ 7): Ton nie puffern > 200 ms (wir reichen sofort durch);
// unterbrechen() wirkt sofort; Kosten alle ≤ 30 s; 401/402/429 → KI-Pause und
// fehler{fatal}; Schlüssel nur über kiSchluessel(); am Ende nutzungMerken.
// ═══════════════════════════════════════════════════════════════════════════
import WebSocket from "ws";
import type { StimmAdapter, Sitzung, SitzungStart, SitzungEreignis, HoerprobeEin, HoerprobeAus } from "./fiaon-aras-adapter";
import { dialektAnweisung, LACHEN_NACH_KI, fuerStimme } from "../../shared/fiaon-aras-prompt";
import { mulawAlsWav, stille, mulawZuPcm16, pcm16ZuMulaw } from "./fiaon-aras-adapter";
import { tonQuelle, Abwaerts24zu8, Aufwaerts8zu24, pcmAusPuffer, pcmAlsPuffer, Lieferstatistik, Pegelwerk, Begrenzer, RAHMEN, type TonQuelle } from "./fiaon-aras-ton";
import { alsWav } from "./fiaon-aras-atmo";
import { kiSchluessel, kiBereit, pausieren, abrechnungsFehler, istKiPause, istProduktionsdienst } from "./fiaon-ki-pause";
import { nutzungMerken } from "./fiaon-postmeister-schema";
import { ARAS_DIENSTE, stimmKostenCents } from "../../shared/fiaon-aras";

export const LIVE_URL = process.env.OPENAI_LIVE_URL || "wss://api.openai.com/v1/live/sessions";
const DIENST = ARAS_DIENSTE.stimme;
/** Hintergrund-Modell, wenn nichts eingestellt ist — von OpenAI für die Live-Delegation empfohlen; gemessen 20.10.2026: Werkzeug ~2 s nach dem Satz (gpt-5.5: ~10 s). */
export const GEHIRN_VORGABE = "gpt-6-luna";
/** So lange darf der Ton des Kunden vor `session.started` auflaufen (danach verwerfen wir den ältesten). */
const VORLAUF_HOECHSTENS_MS = 3000;
/**
 * GPT-Live schickt den Ausgabe-Ton DURCHGEHEND in Echtzeit — auch Stille (gemessen am 20.10.2026 gegen die echte
 * Schnittstelle: 15 s Rede, danach 8 s Stille-Rahmen). „Spricht“ heißt darum: Lautstärke über dieser Schwelle.
 */
export const SPRACH_SCHWELLE = 0.012;
/** Mittlere Lautstärke (0–1) von PCM16 — wie `pegel` für µ-law. */
function pegelPcm(x: Int16Array): number {
  if (!x.length) return 0;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += Math.abs(x[i]);
  return s / x.length / 32768;
}

type Ereignis = (e: SitzungEreignis) => void;

/** Fehlercodes, bei denen die Sitzung nicht weiterlaufen kann. */
const FATAL = /insufficient_quota|invalid_api_key|billing|session_expired|expired|unauthorized|forbidden|model_not_found|not_found_error|permission/i;

/** Responses-Nutzung → die Chat-Form, die kostenCentsAus/nutzungMerken kennen. */
function nutzungAlsChat(u: any): any {
  if (!u || typeof u !== "object") return null;
  return {
    prompt_tokens: Number(u.input_tokens ?? u.prompt_tokens ?? 0) || 0,
    completion_tokens: Number(u.output_tokens ?? u.completion_tokens ?? 0) || 0,
    completion_tokens_details: { reasoning_tokens: Number(u.output_tokens_details?.reasoning_tokens ?? 0) || 0 },
  };
}

/** Eine Live-Sitzung — Verbindung, Protokoll, Werkzeug-Schleife. Auch die Hörprobe läuft hierüber. */
export class LiveSitzung implements Sitzung {
  private ws: WebSocket | null = null;
  private readonly start = Date.now();
  private sitzungId = "";
  private gestartet = false;
  private beendet = false;
  private stummBis = 0;
  private spricht = false;
  private sprichtTimer: NodeJS.Timeout | null = null;
  private kostenTimer: NodeJS.Timeout | null = null;
  private unbekannt = new Set<string>();
  private sekunden = 0;
  private vorlauf: Buffer[] = [];
  private vorlaufBytes = 0;
  private geschlossen: Promise<void>;
  private geschlossenMelden: () => void = () => {};
  /** Hintergrund-Modell: Nutzung je Antwort (letzter Stand), für nutzungMerken am Ende. */
  private gehirnNutzung = new Map<string, any>();
  /** Werkzeug-Aufrufe je Hintergrund-Antwort, die noch ein Ergebnis brauchen. */
  private offeneAufrufe = new Map<string, Set<string>>();
  private erledigteAufrufe = new Set<string>();
  readonly modell: string;
  readonly modellGehirn: string;
  /**
   * Tonquelle (E-408, 20.10. nachmittags — „schlechte Qualität, zu leise“): PCM16 24 kHz mit eigener sauberer Wandlung auf
   * 8 kHz (Vorgabe) oder µ-law 8 kHz wie bisher (ARAS_TON_QUELLE=pcmu8k). Das Format gilt bei GPT-Live für beide Richtungen —
   * darum wird der Telefon-Eingang (µ-law 8 kHz) dann auf 24 kHz hochgerechnet.
   */
  readonly quelle: TonQuelle;
  private abwaerts: Abwaerts24zu8 | null = null;
  private aufwaerts: Aufwaerts8zu24 | null = null;
  private readonly liefer = new Lieferstatistik();
  /** Für Prüfstände und Protokoll: die gesendete session.start (ohne Schlüssel). */
  startNachricht: Record<string, unknown> | null = null;
  schlussGrund: string | null = null;

  constructor(private readonly e: SitzungStart & { begruessung?: string | null }, private readonly ereignis: Ereignis) {
    this.modell = e.modell || "gpt-live-1";
    this.modellGehirn = e.modellGehirn || GEHIRN_VORGABE;
    this.quelle = e.quelle ?? tonQuelle();
    if (this.quelle === "pcm24k") { this.abwaerts = new Abwaerts24zu8(); this.aufwaerts = new Aufwaerts8zu24(); }
    this.geschlossen = new Promise<void>((l) => { this.geschlossenMelden = l; });
  }

  /** Verbinden und session.start senden — löst sich, sobald die Sitzung steht (session.started). */
  async verbinden(fristMs = 8000): Promise<void> {
    const schluessel = kiSchluessel();
    if (!schluessel) throw new Error("OPENAI_API_KEY fehlt — ARAS kann keine Stimme aufbauen.");
    await kiBereit(DIENST, "openai");
    await new Promise<void>((loesen, ablehnen) => {
      let fertig = false;
      const ende = (err?: Error) => { if (fertig) return; fertig = true; clearTimeout(frist); err ? ablehnen(err) : loesen(); };
      const frist = setTimeout(() => {
        ende(new Error(`GPT-Live: keine Bestätigung (session.started) binnen ${Math.round(fristMs / 1000)} s.`));
        try { this.ws?.close(1000, "frist"); } catch { /* egal */ }
      }, fristMs);
      const ws = new WebSocket(LIVE_URL, { headers: { Authorization: `Bearer ${schluessel}` }, perMessageDeflate: false });
      this.ws = ws;
      ws.on("unexpected-response", (_req, res) => {
        const status = Number(res.statusCode ?? 0);
        let body = "";
        res.on("data", (d: Buffer) => { if (body.length < 2000) body += d.toString("utf8"); });
        res.on("end", async () => {
          const art = abrechnungsFehler(status, body);
          if (art && istProduktionsdienst()) await pausieren({ art, fehler: `HTTP ${status}: ${body.slice(0, 200)}`, dienst: DIENST, von: "aras" }).catch(() => {});
          ende(new Error(`GPT-Live abgelehnt (HTTP ${status}${art ? `, KI-Pause: ${art}` : ""}): ${body.replace(/\s+/g, " ").slice(0, 200)}`));
        });
      });
      ws.on("open", () => {
        const session: Record<string, unknown> = {
          model: this.modell,
          // Den Namen liest die Stimme als „Fiaaon“ (Spracherkennung 20.10.: „FIAON“ wurde zu „Fion“) — siehe fuerStimme.
          instructions: fuerStimme(this.e.anweisung),
          audio: { format: this.quelle === "pcm24k" ? { type: "audio/pcm", rate: 24000 } : { type: "audio/pcmu", rate: 8000 }, output: { voice: this.stimmeFeld() } },
          store: false,
        };
        if (this.e.begruessung) {
          session.input = [{ type: "message", role: "developer", content: [{ type: "input_text", text: fuerStimme(this.e.begruessung) }] }];
        }
        if (this.e.werkzeuge.length) {
          session.delegation = {
            type: "responses",
            responses: {
              model: this.modellGehirn,
              instructions: fuerStimme(this.e.hintergrundAnweisung),
              tools: this.e.werkzeuge.map((w) => ({ type: "function", name: w.name, description: w.beschreibung, parameters: w.schema })),
              tool_choice: "auto",
              parallel_tool_calls: false,
              // Denkleistung nur bei Modellen, die sie kennen (sonst lehnt die Prüfung die Einstellung ab: responses_validation_failed).
              ...(/^(gpt-5|gpt-6|o\d)/.test(this.modellGehirn) ? { reasoning: { effort: process.env.ARAS_GEHIRN_DENKEN || "low" } } : {}),
            },
          };
        }
        this.startNachricht = { type: "session.start", event_id: `start_${this.e.callId}`, session };
        this.senden(this.startNachricht);
      });
      ws.on("message", (roh) => {
        const typ = this.nachricht(roh.toString());
        if (typ === "session.started") ende();
        else if (typ === "error" && !this.gestartet) ende(new Error(`GPT-Live: Start abgelehnt (${this.schlussGrund ?? "error"}).`));
      });
      ws.on("error", (err) => {
        if (!fertig) ende(err instanceof Error ? err : new Error(String(err)));
        else this.ereignis({ art: "fehler", code: "ws", text: String((err as Error)?.message ?? err).slice(0, 200), fatal: false });
      });
      ws.on("close", (code, grund) => {
        this.geschlossenMelden();
        if (!fertig) ende(new Error(`GPT-Live: Verbindung zu (${code} ${String(grund ?? "").slice(0, 80)}).`));
        if (!this.beendet) {
          this.beendet = true; this.aufraeumen();
          this.ereignis({ art: "ende", grund: this.schlussGrund ?? (code === 1000 ? "anbieter_ende" : `anbieter_close_${code}`) });
        }
      });
    });
    this.kostenTimer = setInterval(() => this.kostenMelden(), 15_000);
  }

  /** Stimme: Name aus der Liste oder eigene Stimme (`eigene:<id>` → { id }). */
  private stimmeFeld(): unknown {
    const s = String(this.e.stimme || "flitz");
    const m = /^eigene:(.+)$/.exec(s);
    return m ? { id: m[1] } : s;
  }

  private senden(obj: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify(obj)); return true; }
    return false;
  }

  /** Eine Nachricht vom Anbieter. Gibt die Art zurück (für den Start). */
  private nachricht(text: string): string {
    let ev: any;
    try { ev = JSON.parse(text); } catch { return ""; }
    const typ = String(ev?.type ?? "");
    const jetzt = Date.now() - this.start;
    switch (typ) {
      case "session.started": {
        this.gestartet = true;
        this.sitzungId = String(ev?.session?.id ?? ev?.session_id ?? "live");
        this.ereignis({ art: "bereit", sitzungId: this.sitzungId });
        // Der Ton, der vor dem Start kam (sein „Hallo?“), geht jetzt in einem Stück hinterher.
        if (this.vorlaufBytes) { const b = Buffer.concat(this.vorlauf); this.vorlauf = []; this.vorlaufBytes = 0; this.senden({ type: "session.input_audio.append", audio: b.toString("base64") }); }
        return typ;
      }
      case "session.output_audio.delta": {
        const roh = ev?.delta ?? ev?.audio;
        if (typeof roh !== "string" || !roh) return typ;
        const b = Buffer.from(roh, "base64");
        // Erst wandeln (das Filter-Gedächtnis läuft weiter), dann ggf. verwerfen (kurz nach einem Unterbrechen).
        const pcm = this.abwaerts ? this.abwaerts.push(pcmAusPuffer(b)) : mulawZuPcm16(b);
        this.liefer.stueck(Math.round((pcm.length / 8000) * 1000));
        if (Date.now() < this.stummBis) return typ;
        const chunk = this.abwaerts ? pcm16ZuMulaw(pcm) : b;
        const sprache = pegelPcm(pcm) > SPRACH_SCHWELLE;
        if (sprache) this.sprichtAn();
        this.ereignis({ art: "audio", chunk, pcm, sprache });
        return typ;
      }
      case "session.input_transcript.delta": {
        const t = String(ev?.delta ?? "");
        if (t) {
          this.ereignis({ art: "transkript", wer: "kunde", text: t, final: false, t: Number.isFinite(Number(ev?.start_ms)) ? Number(ev.start_ms) : jetzt });
          if (t.trim()) this.ereignis({ art: "kunde_spricht" });
        }
        return typ;
      }
      case "session.output_transcript.delta": {
        const t = String(ev?.delta ?? "");
        if (t) this.ereignis({ art: "transkript", wer: "aras", text: t, final: false, t: Number.isFinite(Number(ev?.start_ms)) ? Number(ev.start_ms) : jetzt });
        return typ;
      }
      case "session.usage.updated": {
        const s = Number(ev?.usage?.seconds);
        if (Number.isFinite(s) && s >= 0) { this.sekunden = Math.max(this.sekunden, s); this.kostenMelden(); }
        const quote = Number(ev?.context_window?.usage_ratio);
        if (Number.isFinite(quote) && quote > 0.9) console.log(`[ARAS-LIVE] Kontext ${Math.round(quote * 100)} % (call ${this.e.callId}) — GPT-Live fasst selbst zusammen.`);
        return typ;
      }
      case "session.delegation.created":
      case "session.updated": case "session.instructions.appended": case "session.thinking.appended": case "session.commentary.appended":
      case "session.input_audio.muted": case "session.input_audio.unmuted":
        return typ;
      case "response.event": {
        const innen = ev?.event ?? null;
        if (innen) this.hintergrund(innen);
        return typ;
      }
      case "error": {
        const f = ev?.error ?? ev;
        const code = String(f?.code ?? f?.type ?? "fehler");
        const meldung = String(f?.message ?? text).slice(0, 300);
        const fatal = !this.gestartet || FATAL.test(`${code} ${f?.type ?? ""}`);
        this.schlussGrund = code;
        if (/insufficient_quota|billing|credit/i.test(`${code} ${meldung}`) && istProduktionsdienst()) {
          void pausieren({ art: "abrechnung", fehler: `${code}: ${meldung}`, dienst: DIENST, von: "aras" }).catch(() => {});
        } else if (/invalid_api_key|account_deactivated/i.test(code) && istProduktionsdienst()) {
          void pausieren({ art: "zugang", fehler: `${code}: ${meldung}`, dienst: DIENST, von: "aras" }).catch(() => {});
        }
        if (code === "responses_validation_failed") console.error(`[ARAS-LIVE] Hintergrund-Modell abgelehnt (${this.modellGehirn}): ${meldung} — aras_modell_gehirn prüfen.`);
        this.ereignis({ art: "fehler", code, text: meldung, fatal });
        return typ;
      }
      case "session.closed": {
        const s = Number(ev?.usage?.seconds);
        if (Number.isFinite(s) && s >= 0) this.sekunden = Math.max(this.sekunden, s);
        const grund = String(ev?.reason ?? "close_requested");
        if (!this.beendet) {
          this.beendet = true; this.aufraeumen();
          this.ereignis({ art: "ende", grund: grund === "expired" ? "zeitlimit" : grund === "content" ? "anbieter_filter" : grund === "remote_hangup" ? "anbieter_ende" : grund });
        }
        this.geschlossenMelden();
        try { this.ws?.close(1000, "closed"); } catch { /* egal */ }
        return typ;
      }
      default:
        if (typ && !this.unbekannt.has(typ)) { this.unbekannt.add(typ); console.log(`[ARAS-LIVE] unbekannt: ${typ}`); }
        return typ;
    }
  }

  /** Innere Responses-Ereignisse — hier stecken die Werkzeug-Aufrufe und die Nutzung des Hintergrund-Modells. */
  private hintergrund(ev: any): void {
    const typ = String(ev?.type ?? "");
    if (typ === "response.completed" || typ === "response.done" || typ === "response.incomplete") {
      const r = ev?.response ?? {};
      if (r?.id && r?.usage) this.gehirnNutzung.set(String(r.id), r.usage);
      return;
    }
    if (typ === "response.failed") {
      this.ereignis({ art: "fehler", code: "gehirn", text: String(ev?.response?.error?.message ?? "Hintergrund-Antwort gescheitert").slice(0, 200), fatal: false });
      return;
    }
    if (typ !== "response.output_item.done") return;
    const item = ev?.item ?? {};
    if (String(item?.type ?? "") !== "function_call") return;
    const name = String(item?.name ?? "");
    const callId = String(item?.call_id ?? "");
    if (!name || !callId || this.erledigteAufrufe.has(callId)) return;
    this.erledigteAufrufe.add(callId);
    const antwortId = String(ev?.response_id ?? ev?.item?.response_id ?? "aktuell");
    const offen = this.offeneAufrufe.get(antwortId) ?? new Set<string>();
    offen.add(callId); this.offeneAufrufe.set(antwortId, offen);
    let eingabe: unknown = {};
    try { eingabe = JSON.parse(String(item?.arguments ?? "{}") || "{}"); } catch { eingabe = {}; }
    this.ereignis({ art: "werkzeug", name: name as any, eingabe, aufrufId: callId });
    const antworten = (output: Record<string, unknown>) => {
      this.senden({ type: "response.item.create", event_id: `ergebnis_${callId}`.slice(0, 60), item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) } });
      offen.delete(callId);
      // Erst wenn für ALLE offenen Aufrufe dieser Antwort ein Ergebnis da ist, weiter (sonst: tool_outputs_required).
      if (offen.size === 0) { this.offeneAufrufe.delete(antwortId); this.senden({ type: "response.create", event_id: `weiter_${callId}`.slice(0, 60) }); }
    };
    void this.e.werkzeugAusfuehren(name as any, eingabe, callId)
      .then((erg) => antworten({ ok: erg.ok, ergebnis: erg.vorlesen ? fuerStimme(erg.vorlesen) : null, hinweis: erg.still ? fuerStimme(erg.still) : null, fehler: erg.fehler ?? null }))
      .catch((err) => antworten({ ok: false, fehler: String((err as Error)?.message ?? err).slice(0, 200) }));
  }

  private sprichtAn(): void {
    if (!this.spricht) { this.spricht = true; this.ereignis({ art: "spricht_an" }); }
    if (this.sprichtTimer) clearTimeout(this.sprichtTimer);
    // GPT-Live meldet kein „fertig gesprochen“ (und schickt Stille weiter): 450 ms ohne Rede heißt „fertig“.
    this.sprichtTimer = setTimeout(() => this.sprichtAus(), 450);
  }
  private sprichtAus(): void {
    if (this.sprichtTimer) { clearTimeout(this.sprichtTimer); this.sprichtTimer = null; }
    if (this.spricht) { this.spricht = false; this.ereignis({ art: "spricht_aus" }); }
  }

  private kostenMelden(): void {
    const sekunden = Math.max(this.sekunden, 0);
    this.ereignis({ art: "kosten", sekunden: Math.round(sekunden), kostenCents: stimmKostenCents(this.modell, sekunden) });
  }

  audioRein(chunk: Buffer): void {
    if (this.beendet || !chunk.length) return;
    // Telefon-Ton (µ-law 8 kHz) im Format der Sitzung: bei „pcm24k“ hochgerechnet auf PCM16 24 kHz.
    const ton = this.aufwaerts ? pcmAlsPuffer(this.aufwaerts.push(mulawZuPcm16(chunk))) : chunk;
    if (!this.gestartet) {
      // Vor session.started kein Ton an den Anbieter (Doku) — wir sammeln höchstens VORLAUF_HOECHSTENS_MS.
      const jeMs = this.aufwaerts ? 48 : 8;
      this.vorlauf.push(ton); this.vorlaufBytes += ton.length;
      while (this.vorlaufBytes > VORLAUF_HOECHSTENS_MS * jeMs && this.vorlauf.length) this.vorlaufBytes -= this.vorlauf.shift()!.length;
      return;
    }
    this.senden({ type: "session.input_audio.append", audio: ton.toString("base64") });
  }

  /** Wie GPT-Live liefert (Quelle, Stückgrößen, Abstände, Echtzeit-Anteil) — für die Ton-Messung je Anruf. */
  lieferung(): Record<string, unknown> { return { quelle: this.quelle, ...this.liefer.werte() }; }

  unterbrechen(): void {
    // GPT-Live hört selbst auf, wenn der Kunde dazwischen spricht. Was von der alten Rede noch unterwegs ist,
    // verwerfen wir 250 ms lang — die Brücke leert derweil Twilios Puffer (clear).
    this.stummBis = Date.now() + 250;
    this.sprichtAus();
  }

  textEinschieben(text: string, art: "vorlesen" | "still" | "anweisung"): void {
    const t = fuerStimme(String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 1800));
    if (!t) return;
    const typ = art === "anweisung" ? "session.instructions.append" : art === "vorlesen" ? "session.commentary.append" : "session.thinking.append";
    this.senden({ type: typ, delegation_id: null, content: t });
  }

  private aufraeumen(): void {
    if (this.kostenTimer) { clearInterval(this.kostenTimer); this.kostenTimer = null; }
    if (this.sprichtTimer) { clearTimeout(this.sprichtTimer); this.sprichtTimer = null; }
  }

  /** Sauber schließen: session.close, auf session.closed warten (höchstens 3 s), Nutzung merken. */
  async beenden(grund: string): Promise<{ sekunden: number; kostenCents: number }> {
    if (!this.beendet) {
      this.beendet = true;
      this.aufraeumen();
      const gesendet = this.senden({ type: "session.close" });
      if (gesendet) await Promise.race([this.geschlossen, new Promise<void>((l) => setTimeout(l, 3000))]);
      try { this.ws?.close(1000, grund.slice(0, 100)); } catch { /* egal */ }
    }
    // Ohne gemeldete Sekunden (Verbindung brach ab): die Wanduhr als Obergrenze.
    if (!this.sekunden) this.sekunden = this.gestartet ? Math.round((Date.now() - this.start) / 1000) : 0;
    const kostenCents = stimmKostenCents(this.modell, this.sekunden);
    await nutzungMerken({ dienst: DIENST, modell: this.modell, dauerMs: Math.round(this.sekunden * 1000), ok: !/fehler/.test(grund), sekunden: this.sekunden, kostenCents }).catch(() => {});
    for (const u of Array.from(this.gehirnNutzung.values())) {
      await nutzungMerken({ dienst: ARAS_DIENSTE.gehirn, modell: this.modellGehirn, usage: nutzungAlsChat(u), dauerMs: 0, ok: true }).catch(() => {});
    }
    this.gehirnNutzung.clear();
    return { sekunden: Math.round(this.sekunden), kostenCents };
  }

  /** Für die Hörprobe: Stille schicken, damit die Sitzungsuhr läuft (die Doku: Ton durchgehend weiterschicken). */
  stilleSchicken(ms: number): void { this.audioRein(stille(ms)); }
  istBeendet(): boolean { return this.beendet; }
}

/** µ-law-Rohton → 16-bit-PCM-WAV (8 kHz, mono) — spielt in jedem Browser (µ-law-WAV kann nicht jeder). */
export function mulawZuPcmWav(roh: Buffer): Buffer {
  const pcm = Buffer.alloc(roh.length * 2);
  for (let i = 0; i < roh.length; i++) {
    const u = ~roh[i] & 0xff;
    const sign = u & 0x80, exp = (u >> 4) & 0x07, mant = u & 0x0f;
    let s = ((mant << 3) + 0x84) << exp;
    s -= 0x84;
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, sign ? -s : s)), i * 2);
  }
  const kopf = Buffer.alloc(44);
  kopf.write("RIFF", 0); kopf.writeUInt32LE(36 + pcm.length, 4); kopf.write("WAVE", 8);
  kopf.write("fmt ", 12); kopf.writeUInt32LE(16, 16); kopf.writeUInt16LE(1, 20); kopf.writeUInt16LE(1, 22);
  kopf.writeUInt32LE(8000, 24); kopf.writeUInt32LE(16000, 28); kopf.writeUInt16LE(2, 32); kopf.writeUInt16LE(16, 34);
  kopf.write("data", 36); kopf.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([kopf, pcm]);
}

/** Ton so, wie ihn der Kunde hört: sanft geregelt (−16 dBFS), begrenzt (−1 dBFS), einmal durch µ-law (Telefon). */
export function wieAmTelefon(pcm8: Int16Array): Int16Array {
  const pw = new Pegelwerk(), bg = new Begrenzer(), aus = new Int16Array(pcm8.length);
  for (let i = 0; i < pcm8.length; i += RAHMEN) {
    const r = pw.rahmen(pcm8.subarray(i, Math.min(pcm8.length, i + RAHMEN)));
    aus.set(mulawZuPcm16(pcm16ZuMulaw(bg.anwenden(r.pcm))), i);
  }
  return aus;
}

export function openaiLiveAdapter(): StimmAdapter {
  return {
    name: "openai_live",
    async bereit() {
      if (!kiSchluessel()) return { ok: false, grund: "OPENAI_API_KEY fehlt (Render-Umgebung)." };
      try { await kiBereit(DIENST, "openai"); } catch (e) { return { ok: false, grund: istKiPause(e) ? "KI-Pause (OpenAI) — Aras wählt nicht." : String((e as Error)?.message ?? e) }; }
      return { ok: true };
    },
    async sitzungStarten(e: SitzungStart): Promise<Sitzung> {
      const s = new LiveSitzung(e, e.ereignis);
      await s.verbinden();
      return s;
    },
    /**
     * Hörprobe über dieselbe Strecke wie ein Anruf (Telefonqualität, µ-law 8 kHz): Sitzung ohne Kunde,
     * der Satz als Begrüßungs-Anweisung, Stille als Eingang, Ton einsammeln, als PCM-WAV zurück.
     * Höchstens 25 s; fertig, sobald nach dem ersten Ton 1,6 s Ruhe ist.
     */
    async hoerprobe(e: HoerprobeEin): Promise<HoerprobeAus> {
      // Dieselbe Strecke wie am Telefon (E-408, 20.10. nachmittags): Quelle → 8 kHz → sanfte Regelung auf −16 dBFS →
      // Begrenzer → µ-law → zurück zu PCM — so klingt die Probe im Stimmen-Studio genau wie beim Kunden.
      const teile: Int16Array[] = [];
      const laut: boolean[] = [];
      let fehler: Error | null = null;
      let zuletztTon = 0, gesagt = "";
      let fertigMelden: () => void = () => {};
      const fertig = new Promise<void>((l) => { fertigMelden = l; });
      const ereignis = (ev: SitzungEreignis) => {
        if (ev.art === "audio") {
          teile.push(ev.pcm ?? mulawZuPcm16(ev.chunk)); laut.push(!!ev.sprache);
          if (ev.sprache) zuletztTon = Date.now();
        }
        else if (ev.art === "transkript" && ev.wer === "aras") gesagt += ev.text;
        else if (ev.art === "fehler" && ev.fatal) { fehler = new Error(ev.text); fertigMelden(); }
        else if (ev.art === "ende") fertigMelden();
      };
      const satz = String(e.text ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
      const sitzung = new LiveSitzung({
        callId: 0, arasAnrufId: 0, spielart: "probe", land: "DE",
        anweisung: [
          "Du bist Aras von FIAON. Das hier ist eine Sprechprobe für die Stimmauswahl — es hört niemand live zu.",
          "Sprich Deutsch, natürlich und warm wie ein Mensch am Telefon, mit kleinen echten Pausen.",
          e.beschreibung ? `Stimme und Art: ${e.beschreibung.slice(0, 300)}` : "",
          dialektAnweisung(e.dialekt ?? null),
          "Du sagst den vorgegebenen Satz genau einmal, wörtlich und vollständig. Danach schweigst du.",
          // Justin 20.10.2026 (abends): nach „… aber eine sehr nette.“ ein kurzes, warmes Lachen — auch in der Hörprobe.
          /nette\./.test(satz) ? LACHEN_NACH_KI : "",
        ].filter(Boolean).join("\n"),
        begruessung: `Sag jetzt sofort, genau einmal und wörtlich: „${satz}“ Danach sagst du nichts mehr.`,
        hintergrundAnweisung: "", stimme: e.stimme, modell: e.modell || "gpt-live-1", modellGehirn: "",
        werkzeuge: [], audio: { rein: "pcmu_8k", raus: "pcmu_8k" }, quelle: e.quelle,
        regie: { fuellwoerter: "normal", lachen: false, tempo: "normal", zuhoerlaute: "sparsam", energie: "lebendig", abschluss: "klar", dialekt: e.dialekt ?? "hochdeutsch" },
        ereignis, werkzeugAusfuehren: async () => ({ ok: false, vorlesen: "" }),
      }, ereignis);
      await sitzung.verbinden();
      const t0 = Date.now();
      // Ungestört gestartet? GPT-Live spricht nicht immer zuerst (Doku) — nach 3,5 s Stille den Satz nachschieben.
      let nachgeschoben = false;
      await Promise.race([fertig, new Promise<void>((l) => {
        const takt = setInterval(() => {
          sitzung.stilleSchicken(100);
          if (!zuletztTon && !nachgeschoben && Date.now() - t0 > 3500) { nachgeschoben = true; sitzung.textEinschieben(`Sag jetzt genau einmal und wörtlich: „${satz}“`, "vorlesen"); }
          const ruhig = zuletztTon > 0 && Date.now() - zuletztTon > 1400;
          if (ruhig || Date.now() - t0 > 25_000) { clearInterval(takt); l(); }
        }, 100);
      })]);
      const { sekunden, kostenCents } = await sitzung.beenden("hoerprobe");
      if (fehler) throw fehler;
      const ersteRede = laut.indexOf(true), letzteRede = laut.lastIndexOf(true);
      if (ersteRede < 0) throw new Error("Die Hörprobe blieb stumm — kein gesprochener Ton vom Anbieter.");
      // Zuschneiden: 150 ms vor der ersten Rede bis 350 ms nach der letzten (der Rest ist Leitungsstille).
      const alles = (von: number, bis: number) => { const t = teile.slice(von, bis); const n = t.reduce((s, x) => s + x.length, 0), a = new Int16Array(n); let o = 0; for (const x of t) { a.set(x, o); o += x.length; } return a; };
      const davor = alles(0, ersteRede), rede = alles(ersteRede, letzteRede + 1), danach = alles(letzteRede + 1, teile.length);
      const roh = new Int16Array(Math.min(1200, davor.length) + rede.length + Math.min(2800, danach.length));
      roh.set(davor.subarray(Math.max(0, davor.length - 1200)), 0);
      roh.set(rede, Math.min(1200, davor.length));
      roh.set(danach.subarray(0, 2800), Math.min(1200, davor.length) + rede.length);
      const telefon = wieAmTelefon(roh);
      if (gesagt.trim()) console.log(`[ARAS-LIVE] Hörprobe ${e.stimme}: „${gesagt.replace(/\s+/g, " ").trim().slice(0, 200)}“`);
      return { mime: "audio/wav", bytes: alsWav(telefon), dauerMs: Math.round(telefon.length / 8), kostenCents: Math.max(kostenCents, stimmKostenCents(e.modell || "gpt-live-1", sekunden)) };
    },
  };
}

export { mulawAlsWav };
