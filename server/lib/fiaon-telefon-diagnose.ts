// ═══════════════════════════════════════════════════════════════════════════
// TELEFON-SELBSTDIAGNOSE — die Kette Schritt für Schritt messen
//
// Der Betreiber hat alle sechs Werte gesetzt, das Twilio-Konto ist aktiv, die
// Nummer vorhanden — und im Panel stand „Das Telefon konnte nicht starten:
// undefined". Zwischen „alles eingetragen" und „es klingelt" liegen sieben
// Stellen, an denen es klemmen kann. Raten hilft an keiner davon.
//
// Jeder Schritt fragt TWILIO SELBST, nicht die eigene Konfiguration. Ob eine
// Umgebungsvariable gesetzt ist, sagt nichts darüber, ob sie stimmt.
//
// ── DIE SIEBEN SCHRITTE ────────────────────────────────────────────────────
//   1 Werte vorhanden und wohlgeformt (SID beginnt mit AC, Key mit SK …)
//   2 Konto erreichbar mit diesen Zugangsdaten
//   3 API-Key gehört zum Konto und kann Voice-Tokens signieren
//   4 TwiML-App existiert und ihre Voice-URL zeigt hierher
//   5 Absendernummer gehört dem Konto und kann Sprache
//   6 Geo-Berechtigungen für DE, AT, CH
//   7 Browser: SDK im Bündel, Mikrofonrecht, Geräteregistrierung
// Schritt 7 kann der Server nicht messen — er läuft im Browser.
// ═══════════════════════════════════════════════════════════════════════════

export interface DiagnoseSchritt {
  nr: number;
  titel: string;
  /** "gut" | "fehler" | "warnung" | "offen" (Browser-Schritt) */
  stand: "gut" | "fehler" | "warnung" | "offen";
  /** Was gemessen wurde — immer konkret, nie „Fehler aufgetreten". */
  befund: string;
  /** Was zu tun ist, falls etwas fehlt. */
  rat?: string;
}

const BASIS = "https://api.twilio.com/2010-04-01";

/** Ein REST-Aufruf an Twilio mit Konto-SID und Auth-Token. */
async function twilio(pfad: string): Promise<{ status: number; body: any }> {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const tok = process.env.TWILIO_AUTH_TOKEN || "";
  const kopf = "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64");
  const r = await fetch(`${BASIS}${pfad}`, {
    headers: { Authorization: kopf },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await r.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  return { status: r.status, body };
}

/** Die Adresse, auf die die TwiML-App zeigen MUSS. */
export function twimlSollUrl(): string {
  const basis = process.env.PUBLIC_BASE_URL || "https://www.fiaon.com";
  return `${basis.replace(/\/+$/, "")}/api/fiaon/telefon/twiml`;
}

export async function telefonDiagnose(): Promise<{
  schritte: DiagnoseSchritt[];
  bereit: boolean;
  zusammenfassung: string;
}> {
  const s: DiagnoseSchritt[] = [];
  const env = (n: string) => (process.env[n] || "").trim();

  // ── 1. Werte vorhanden und wohlgeformt ──────────────────────────────────
  const felder: [string, RegExp, string][] = [
    ["TWILIO_ACCOUNT_SID", /^AC[0-9a-f]{32}$/i, "beginnt mit AC, dann 32 Zeichen"],
    ["TWILIO_AUTH_TOKEN", /^.{32,}$/, "mindestens 32 Zeichen"],
    ["TWILIO_API_KEY_SID", /^SK[0-9a-f]{32}$/i, "beginnt mit SK, dann 32 Zeichen"],
    ["TWILIO_API_KEY_SECRET", /^.{20,}$/, "mindestens 20 Zeichen"],
    ["TWILIO_TWIML_APP_SID", /^AP[0-9a-f]{32}$/i, "beginnt mit AP, dann 32 Zeichen"],
    ["TWILIO_CALLER_ID", /^\+[1-9]\d{6,15}$/, "internationale Schreibweise, z. B. +4930…"],
  ];
  const fehlend = felder.filter(([n]) => !env(n));
  const schief = felder.filter(([n, muster]) => env(n) && !muster.test(env(n)));

  if (fehlend.length) {
    s.push({
      nr: 1, titel: "Zugangsdaten vorhanden", stand: "fehler",
      befund: `${fehlend.length} von 6 Werten fehlen: ${fehlend.map(([n]) => n).join(", ")}`,
      rat: "In den Umgebungsvariablen eintragen und den Dienst neu starten.",
    });
    return {
      schritte: s, bereit: false,
      zusammenfassung: "Ohne die Zugangsdaten lässt sich nichts weiter prüfen.",
    };
  }
  if (schief.length) {
    s.push({
      nr: 1, titel: "Zugangsdaten wohlgeformt", stand: "fehler",
      befund: schief.map(([n, , f]) => `${n} passt nicht (${f})`).join("; "),
      rat: "Vermutlich wurde ein Wert in das falsche Feld kopiert — das passiert leicht, "
        + "weil SID und Key ähnlich aussehen.",
    });
  } else {
    s.push({
      nr: 1, titel: "Zugangsdaten vorhanden und wohlgeformt", stand: "gut",
      befund: `Alle 6 Werte gesetzt, Konto ${env("TWILIO_ACCOUNT_SID").slice(0, 10)}…`,
    });
  }

  // ── 2. Konto erreichbar ─────────────────────────────────────────────────
  try {
    const r = await twilio(`/Accounts/${env("TWILIO_ACCOUNT_SID")}.json`);
    if (r.status === 200) {
      s.push({
        nr: 2, titel: "Twilio-Konto erreichbar", stand: r.body?.status === "active" ? "gut" : "warnung",
        befund: `„${r.body?.friendly_name}“ · Status ${r.body?.status} · Typ ${r.body?.type}`,
        rat: r.body?.status !== "active"
          ? "Das Konto ist nicht aktiv. Bei einem Testkonto sind nur verifizierte Nummern erreichbar."
          : undefined,
      });
    } else {
      s.push({
        nr: 2, titel: "Twilio-Konto erreichbar", stand: "fehler",
        befund: `HTTP ${r.status} — ${r.body?.message || "keine Angabe"}`,
        rat: "ACCOUNT_SID und AUTH_TOKEN passen nicht zusammen. Beide stehen in der "
          + "Twilio-Console oben rechts unter „Account Info“.",
      });
    }
  } catch (e) {
    s.push({
      nr: 2, titel: "Twilio-Konto erreichbar", stand: "fehler",
      befund: `Keine Verbindung: ${e instanceof Error ? e.message : String(e)}`,
      rat: "Der Server kommt nicht zu api.twilio.com. Netz oder Firewall prüfen.",
    });
  }

  // ── 3. API-Key gehört zum Konto ─────────────────────────────────────────
  try {
    const r = await twilio(`/Accounts/${env("TWILIO_ACCOUNT_SID")}/Keys/${env("TWILIO_API_KEY_SID")}.json`);
    if (r.status === 200) {
      s.push({
        nr: 3, titel: "API-Key gehört zu diesem Konto", stand: "gut",
        befund: `Key „${r.body?.friendly_name || env("TWILIO_API_KEY_SID").slice(0, 10)}…“ gefunden`,
      });
    } else if (r.status === 404) {
      s.push({
        nr: 3, titel: "API-Key gehört zu diesem Konto", stand: "fehler",
        befund: "Dieser API-Key existiert in diesem Konto nicht.",
        rat: "Der Key gehört zu einem anderen Twilio-Konto (oder zu einem Subaccount). "
          + "Neuen Key im selben Konto anlegen: Account → API keys & tokens → Create API key.",
      });
    } else {
      s.push({
        nr: 3, titel: "API-Key gehört zu diesem Konto", stand: "warnung",
        befund: `HTTP ${r.status} — ${r.body?.message || "keine Angabe"}`,
      });
    }
  } catch (e) {
    s.push({
      nr: 3, titel: "API-Key gehört zu diesem Konto", stand: "fehler",
      befund: e instanceof Error ? e.message : String(e),
    });
  }

  // ── 4. TwiML-App und ihre Voice-URL ─────────────────────────────────────
  // DER HAUPTVERDÄCHTIGE. Eine TwiML-App ohne Voice-URL nimmt den Ruf an und
  // legt sofort auf — der Browser bekommt einen Fehler ohne Text.
  const soll = twimlSollUrl();
  try {
    const r = await twilio(
      `/Accounts/${env("TWILIO_ACCOUNT_SID")}/Applications/${env("TWILIO_TWIML_APP_SID")}.json`);
    if (r.status === 200) {
      const ist = String(r.body?.voice_url || "").trim();
      const methode = String(r.body?.voice_method || "").toUpperCase();
      if (!ist) {
        s.push({
          nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "fehler",
          befund: `Die App „${r.body?.friendly_name}“ hat KEINE Voice-URL.`,
          rat: `Twilio → Voice → TwiML → TwiML Apps → diese App öffnen → Voice Request URL `
            + `auf ${soll} setzen, Methode POST.`,
        });
      } else if (ist.replace(/\/+$/, "") !== soll.replace(/\/+$/, "")) {
        s.push({
          nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "fehler",
          befund: `Die Voice-URL zeigt auf ${ist} — erwartet wird ${soll}`,
          rat: "Adresse in der TwiML-App korrigieren. Ein Tippfehler oder eine alte "
            + "Testadresse reicht, damit jeder Anruf ins Leere geht.",
        });
      } else if (methode && methode !== "POST") {
        s.push({
          nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "warnung",
          befund: `Adresse stimmt, aber die Methode ist ${methode} statt POST.`,
          rat: "In der TwiML-App auf HTTP POST umstellen.",
        });
      } else {
        s.push({
          nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "gut",
          befund: `„${r.body?.friendly_name}“ → ${ist} (POST)`,
        });
      }
    } else if (r.status === 404) {
      s.push({
        nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "fehler",
        befund: "Diese TwiML-App gibt es in diesem Konto nicht.",
        rat: `Neue TwiML-App anlegen (Voice → TwiML → TwiML Apps → Create), Voice-URL ${soll}, `
          + "und deren SID als TWILIO_TWIML_APP_SID eintragen.",
      });
    } else {
      s.push({
        nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "warnung",
        befund: `HTTP ${r.status} — ${r.body?.message || "keine Angabe"}`,
      });
    }
  } catch (e) {
    s.push({
      nr: 4, titel: "TwiML-App zeigt auf FIAON", stand: "fehler",
      befund: e instanceof Error ? e.message : String(e),
    });
  }

  // ── 5. Absendernummer ───────────────────────────────────────────────────
  try {
    const nr = env("TWILIO_CALLER_ID");
    const r = await twilio(
      `/Accounts/${env("TWILIO_ACCOUNT_SID")}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(nr)}`);
    const treffer = r.body?.incoming_phone_numbers?.[0];
    if (treffer) {
      const sprache = treffer.capabilities?.voice !== false;
      s.push({
        nr: 5, titel: "Absendernummer gehört dem Konto", stand: sprache ? "gut" : "fehler",
        befund: sprache
          ? `${nr} („${treffer.friendly_name}“) ist sprachfähig`
          : `${nr} gehört dem Konto, kann aber KEINE Sprache — nur SMS.`,
        rat: sprache ? undefined : "Eine sprachfähige Nummer kaufen und als TWILIO_CALLER_ID eintragen.",
      });
    } else {
      // Vielleicht eine verifizierte Fremdnummer?
      const v = await twilio(
        `/Accounts/${env("TWILIO_ACCOUNT_SID")}/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(nr)}`);
      if (v.body?.outgoing_caller_ids?.length) {
        s.push({
          nr: 5, titel: "Absendernummer gehört dem Konto", stand: "gut",
          befund: `${nr} ist als verifizierte Caller ID hinterlegt`,
        });
      } else {
        s.push({
          nr: 5, titel: "Absendernummer gehört dem Konto", stand: "fehler",
          befund: `${nr} ist weder gekauft noch als Caller ID verifiziert.`,
          rat: "Twilio → Phone Numbers: eine Nummer kaufen, oder unter „Verified Caller IDs“ "
            + "die eigene Nummer bestätigen lassen.",
        });
      }
    }
  } catch (e) {
    s.push({
      nr: 5, titel: "Absendernummer gehört dem Konto", stand: "fehler",
      befund: e instanceof Error ? e.message : String(e),
    });
  }

  // ── 6. Geo-Berechtigungen DACH ──────────────────────────────────────────
  try {
    const r = await twilio(
      `/Accounts/${env("TWILIO_ACCOUNT_SID")}/Voice/DialingPermissions/Countries.json?IsoCode=DE`);
    // Diese Schnittstelle antwortet je nach Kontotyp unterschiedlich; wir
    // werten nur aus, was wir sicher lesen können, und melden sonst „offen“.
    const land = r.body?.content?.[0] ?? r.body?.countries?.[0];
    if (r.status === 200 && land) {
      const erlaubt = land.low_risk_numbers_enabled !== false;
      s.push({
        nr: 6, titel: "Anrufe nach DE, AT, CH erlaubt", stand: erlaubt ? "gut" : "fehler",
        befund: erlaubt
          ? "Deutschland ist freigeschaltet (AT und CH bitte in der Console gegenprüfen)."
          : "Deutschland ist im Konto GESPERRT — jeder Ruf schlägt mit 21215 fehl.",
        rat: erlaubt ? undefined
          : "Twilio → Voice → Settings → Geographic Permissions: DE, AT und CH aktivieren.",
      });
    } else {
      s.push({
        nr: 6, titel: "Anrufe nach DE, AT, CH erlaubt", stand: "warnung",
        befund: `Twilio gibt dazu keine auswertbare Auskunft (HTTP ${r.status}).`,
        rat: "Bitte einmal von Hand prüfen: Voice → Settings → Geographic Permissions.",
      });
    }
  } catch (e) {
    s.push({
      nr: 6, titel: "Anrufe nach DE, AT, CH erlaubt", stand: "warnung",
      befund: e instanceof Error ? e.message : String(e),
      rat: "Von Hand prüfen: Voice → Settings → Geographic Permissions.",
    });
  }

  // ── 7. Browser ──────────────────────────────────────────────────────────
  s.push({
    nr: 7, titel: "Browser: SDK, Mikrofon, Geräteregistrierung", stand: "offen",
    befund: "Dieser Schritt läuft im Browser und wird beim Öffnen des Telefons gemessen.",
  });

  const fehlerhaft = s.filter((x) => x.stand === "fehler");
  return {
    schritte: s,
    bereit: fehlerhaft.length === 0,
    zusammenfassung: fehlerhaft.length === 0
      ? "Serverseitig ist alles in Ordnung. Öffne das Telefon — Schritt 7 misst den Rest."
      : `${fehlerhaft.length} ${fehlerhaft.length === 1 ? "Schritt schlägt" : "Schritte schlagen"} fehl. `
        + `Zuerst: ${fehlerhaft[0].titel}.`,
  };
}
