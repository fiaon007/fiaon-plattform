// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: FIAON GLOBAL — PERSÖNLICHER ZUGANG ZUM GRÜNDUNGSBOGEN (E-526, 17.11.2026)
//
//   global_gruendungsbogen_zugang   Das Mitglied hat auf der gemeinsamen Seite „Ich bin … —
//                                   persönlichen Zugang anfordern“ gedrückt (oder die Leitung
//                                   hat den Zugang erneut gesendet). Der Link geht NUR an die
//                                   hinterlegte Adresse dieses Mitglieds — so unterschreibt jeder
//                                   selbst. 14 Tage gültig.
//
// Transaktional (vom Mitglied selbst angefordert): ohne Frequenzbremse (PFLICHTMAILS), nie über
// Make, zwei Wege wie die Zugangs-Mails E-441 (iCloud zuerst über Google Workspace). Kein Dokument
// im Anhang, keine persönlichen Daten außer dem Namen. Der Link steht NICHT im Klartext im
// Protokoll (fiaon_mail_log) — nur „[verborgen]“. Versand: server/lib/fiaon-global-gruendungsbogen.ts.
//
// Nutzlast: email, anrede_zeile, wunschname, kennung, zugang_url, gueltig_text
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";

export const GLOBAL_GRUENDUNGSBOGEN_VORLAGEN: Record<string, MailBaustein> = {
  global_gruendungsbogen_zugang: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
    betreff: "Ihr persönlicher Zugang zur Gründung von {{params.wunschname}}",
    preheader: "Über den Knopf öffnen Sie Ihre eigene Seite: Angaben, Reisepass, Unterschrift.",
    titel: "Ihr persönlicher Zugang",
    absaetze: [
      "{{params.anrede_zeile}}, Sie haben Ihren persönlichen Zugang zur Gründung von <b>{{params.wunschname}}</b> angefordert.",
      "Über den Knopf öffnen Sie Ihre eigene Seite. Dort prüfen Sie die gemeinsamen Angaben, tragen Ihre persönlichen Angaben ein, laden die Bildseite Ihres Reisepasses hoch und unterschreiben — getrennt von den übrigen Gesellschaftern.",
      "Der Link ist nur für Sie bestimmt. Bitte leiten Sie ihn nicht weiter: Wer ihn hat, kann auf Ihrer Seite Angaben machen. Sie haben nichts angefordert? Dann ist nichts zu tun.",
    ],
    daten: [
      { label: "Gründungsbogen", wert: "{{params.kennung}}" },
      { label: "Link gültig bis", wert: "{{params.gueltig_text}}" },
    ],
    knopf: { text: "Meine Seite öffnen", url: "{{params.zugang_url}}" },
  },
};
