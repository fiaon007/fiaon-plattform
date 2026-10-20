// ═══════════════════════════════════════════════════════════════════════════
// TWILIO-ATTRAPPE — spielt Twilio Media Streams gegen unsere Brücke (E-408, § 13)
//
// Twilio ist in Wirklichkeit der CLIENT: Es verbindet sich zu unserer
// Stream-Adresse, schickt `connected`, `start` (mit customParameters) und
// dann alle 20 ms einen `media`-Rahmen (µ-law), bestätigt unsere `mark`s und
// schickt am Ende `stop`. Genau das tut diese Klasse — und zählt, was die
// Brücke zurückschickt (media, mark, clear).
// ═══════════════════════════════════════════════════════════════════════════
import WebSocket from "ws";

export class TwilioAttrappe {
  private ws: WebSocket | null = null;
  private takt: NodeJS.Timeout | null = null;
  private zaehler = { media: 0, clear: 0, mark: 0, offen: 0, maxOffen: 0 };
  private zu = false;
  readonly streamSid: string;
  readonly callSid: string;
  constructor(private readonly e: { url: string; anrufId: number; t: string; callSid?: string; fortsetzung?: string; rahmen?: Buffer }) {
    this.streamSid = `MZ${String(e.anrufId).padStart(32, "0")}`;
    this.callSid = e.callSid ?? `ATTRAPPE-${e.anrufId}`;
  }

  /** Verbinden, start schicken, Ton senden — löst sich, sobald die Verbindung steht. */
  start(): Promise<void> {
    return new Promise((loesen, ablehnen) => {
      const ws = new WebSocket(this.e.url);
      this.ws = ws;
      ws.on("open", () => {
        ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
        const customParameters: Record<string, string> = { anruf: String(this.e.anrufId), t: this.e.t };
        if (this.e.fortsetzung) customParameters.fortsetzung = this.e.fortsetzung;
        ws.send(JSON.stringify({ event: "start", sequenceNumber: "1", start: { streamSid: this.streamSid, accountSid: "ACattrappe", callSid: this.callSid, tracks: ["inbound"], customParameters, mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 } }, streamSid: this.streamSid }));
        const rahmen = (this.e.rahmen ?? Buffer.alloc(160, 0xff)).toString("base64");
        const lauterRahmen = Buffer.from(Array.from({ length: 160 }, (_, i) => (i % 16 < 8 ? 0x20 : 0xa0))).toString("base64");
        let n = 0;
        this.takt = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          n += 1;
          ws.send(JSON.stringify({ event: "media", sequenceNumber: String(n + 1), media: { track: "inbound", chunk: String(n), timestamp: String(n * 20), payload: Date.now() < this.lautBis ? lauterRahmen : rahmen }, streamSid: this.streamSid }));
        }, 20);
        loesen();
      });
      ws.on("message", (roh) => {
        let m: any; try { m = JSON.parse(roh.toString()); } catch { return; }
        if (m?.event === "media") {
          this.zaehler.media += 1;
          // Rede (nicht µ-law-Stille 0xff/0x7f) — wann der Kunde Aras' Stimme hört (Geduld-Tor, E-408 20.10.2026).
          const b = Buffer.from(String(m?.media?.payload ?? ""), "base64");
          if (b.some((x) => x !== 0xff && x !== 0x7f)) this.lautEmpfangen.push(Date.now());
        }
        else if (m?.event === "clear") {
          this.zaehler.clear += 1;
          // Twilio: nach clear kommen alle offenen Marken sofort zurück (der Ton davor wurde verworfen)
          this.zaehler.offen = 0;
        } else if (m?.event === "mark") {
          this.zaehler.mark += 1;
          this.zaehler.offen += 1; this.zaehler.maxOffen = Math.max(this.zaehler.maxOffen, this.zaehler.offen);
          // Twilio bestätigt die Marke, sobald der Ton davor gespielt ist — hier nach 100 ms (Echtzeit eines 100-ms-Stücks)
          setTimeout(() => { this.zaehler.offen = Math.max(0, this.zaehler.offen - 1); if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: "mark", streamSid: this.streamSid, mark: { name: m.mark?.name } })); }, 100);
        }
      });
      ws.on("close", () => { this.zu = true; if (this.takt) clearInterval(this.takt); });
      ws.on("error", (err) => { if (!this.zu) ablehnen(err); });
    });
  }

  /** Der Kunde legt auf: stop, dann zu. */
  aufhaengen(): void {
    if (this.takt) clearInterval(this.takt);
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "stop", streamSid: this.streamSid, stop: { accountSid: "ACattrappe", callSid: this.callSid } }));
      setTimeout(() => { try { ws.close(1000); } catch { /* egal */ } }, 50);
    }
  }
  /** Warten, bis die Brücke die Verbindung schließt (oder Frist). */
  geschlossen(fristMs = 5000): Promise<boolean> {
    return new Promise((l) => {
      if (this.zu || !this.ws) return l(true);
      const t = setTimeout(() => l(false), fristMs);
      this.ws.once("close", () => { clearTimeout(t); l(true); });
    });
  }
  istZu(): boolean { return this.zu; }
  gesendet(): { media: number; clear: number; mark: number; offen: number; maxOffen: number } { return { ...this.zaehler }; }
  /** Der Kunde spricht: laute Rahmen (µ-law) für n Millisekunden statt Stille — für die Lautstärke-Erkennung der Brücke. */
  laut(ms: number): void { this.lautBis = Date.now() + ms; }
  /** Bis wann der Kunde zuletzt laut war (Uhrzeit). */
  lautEnde(): number { return this.lautBis; }
  /** Wann Rede-Rahmen von Aras bei „Twilio“ ankamen (Uhrzeiten) — ohne Atmo ist alles andere Stille. */
  lautAngekommen(): number[] { return [...this.lautEmpfangen]; }
  private lautBis = 0;
  private lautEmpfangen: number[] = [];
}
