// ═══════════════════════════════════════════════════════════════════════════
// EINE REGEL, UND ZWAR ALS FEHLER: react-hooks/rules-of-hooks
//
// ── WARUM ES DIESE DATEI GIBT (20.08.2026) ────────────────────────────────
// Am 20.08. ging die Kundenakte bei KEINEM Kunden mehr auf: React #310,
// „Rendered more hooks than during the previous render". Ursache war ein
// `useState` 200 Zeilen unter zwei frühen Ausstiegen in
// `client/src/pages/agent/vertrieb.tsx`.
//
// Es war die DRITTE Wiederholung derselben Klasse. AGENTS.md hält sie seit dem
// 16.08. fest („React-Haken stehen ÜBER dem ersten return") — zweimal in
// Softphone.tsx, jetzt in der Akte. Eine Regel, die man dreimal vergisst,
// braucht keine vierte Erinnerung, sondern eine Wand.
//
// ── WARUM NUR EINE REGEL ──────────────────────────────────────────────────
// Ein vollständiges Regelwerk über 700 gewachsene Dateien liefert Hunderte
// Meldungen, und ein Prüfstand mit Hunderten Meldungen wird beim dritten Mal
// abgeschaltet (dieselbe Lehre steht in `pruef-backticks.ts` über die
// Anführungszeichen-Prüfung: 365 Fehlalarme, Regel verworfen).
//
// Diese eine Regel hat KEINE Fehlalarme: Sie kennt die Haken-Reihenfolge, weil
// sie den Syntaxbaum liest, nicht Text. Und sie beschreibt einen Fehler, der die
// Anwendung für alle Benutzer zerstört — nicht eine Stilfrage.
//
// `exhaustive-deps` bleibt AUS: Die Regel ist nützlich, aber sie meldet im
// Bestand hundertfach und ist oft fachlich falsch (absichtlich weggelassene
// Abhängigkeiten). Sie gehört in eine eigene Aufräumarbeit, nicht in eine Wand.
// ═══════════════════════════════════════════════════════════════════════════
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    // Nur der Client — Haken gibt es nur dort.
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    // Ungenutzte `eslint-disable`-Kommentare NICHT melden: Im Bestand stehen
    // neun davon für `exhaustive-deps`, das hier absichtlich aus ist. Neun
    // Meldungen ohne Handlungsbedarf sind der Anfang vom Ende einer Wand.
    linterOptions: { reportUnusedDisableDirectives: false },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // FEHLER, nicht Warnung. Eine Warnung hätte den 20.08. nicht verhindert:
      // Der Build wäre grün geblieben und der Fehler in Produktion erschienen.
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    // Erzeugtes und Fremdes bleibt draußen.
    ignores: [
      "**/node_modules/**", "**/dist/**", "**/.next/**", "**/build/**",
      "schwarzott-group/**", "**/*.d.ts",
      // Dropbox-Konfliktkopien (AGENTS.md: „bekannter Bestand").
      "**/* in Konflikt stehende Kopie *", "**/*Konflikt*",
    ],
  },
];
