// ═══════════════════════════════════════════════════════════════════════════
// DIE PAKETKARTEN WIE AUF /start — EINE QUELLE FÜR /privatkunden
// (05.10.2026, E-283)
//
// Justin: „Passe fiaon.com/privatkunden so an, dass die Produkte den gleichen
// Text haben wie bei /start.“
//
// Wortlaut wie /start, Justin 05.10.2026 — start.tsx bleibt unverändert,
// Änderungen an beiden Stellen nachziehen (client/src/pages/start.tsx,
// Konstante PACKS: name, sub, feats). scripts/pruef-pakete.ts vergleicht beide
// Stellen buchstabengetreu und wird rot, sobald eine allein geändert wird.
//
// Die Merkmale hängen wie auf /start vom Land ab (betrag, registerNeutral aus
// fiaon-land.ts): „Ihr 25.000 € Black-Card Setup“ heißt in Zürich „Ihr CHF
// 25'000 Black-Card Setup“. Die englische Fassung steht im Wörterbuch
// client/src/i18n/privatkunden.ts unter en.
// ═══════════════════════════════════════════════════════════════════════════
import { LAENDER, betrag, type Land } from "./fiaon-land";

export interface PaketMerkmale {
  key: "start" | "pro" | "ultra" | "highend";
  name: string;
  sub: string;
  feats: (l: Land) => string[];
}

export const PAKET_MERKMALE: PaketMerkmale[] = [
  { key: "start", name: "FIAON Starter", sub: "Das Fundament",
    feats: (l: Land) => [`Ihr ${betrag("500", l)} Einstiegs-Setup`, "Zugang: Basic Karten-Portfolio", `${LAENDER[l].registerNeutral}e Profil-Prüfung`, "Online-Dashboard & Verwaltung"] },
  { key: "pro", name: "FIAON Pro", sub: "Standard",
    feats: (l: Land) => [`Ihr ${betrag("5.000", l)} Limit-Protokoll`, "Zugang: Premium Karten-Netzwerk", "Dynamische Limit-Aufstockung", "Sofortige Score-Auswertung", "Priority-Bearbeitung im System"] },
  { key: "ultra", name: "FIAON Ultra", sub: "Elite Konto",
    feats: (l: Land) => [`Ihr ${betrag("15.000", l)} Elite-Portfolio`, "Zugang: Gold- & Platinum-Karten", "Cashback- & Meilen-Aktivierung", "Individuelle Freigabe-Roadmap", "VIP-Support & Konto-Optimierung"] },
  { key: "highend", name: "FIAON High End", sub: "Das Maximum",
    feats: (l: Land) => [`Ihr ${betrag("25.000", l)} Black-Card Setup`, "Exklusiver Zugang: Metal- & VIP-Karten", "Persönlicher Account Director", "Internationale Limit-Strukturen", "24/7 Dedicated Concierge-Support"] },
];
