import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Privacy() {
  const sections = [
    {
      title: "1. Erhobene Daten bei KI-Telefonie",
      content: "ARAS AI erhebt ausschließlich geschäftsrelevante Daten für die KI-gestützte Outbound-Telefonie. Dazu gehören Kontaktdaten Ihrer Leads, Gesprächsprotokolle und CRM-Synchronisationsdaten. Alle Daten werden auf Schweizer Servern verarbeitet."
    },
    {
      title: "2. DSGVO-konforme Datenverarbeitung",
      content: "Als Schweizer Unternehmen erfüllen wir sowohl die EU-DSGVO als auch das Schweizer Datenschutzgesetz (nDSG). Die Verarbeitung erfolgt ausschließlich für die vertraglich vereinbarten KI-Telefonie-Services."
    },
    {
      title: "3. Eigenes LLM - Keine Datenweitergabe",
      content: "Mit unserem proprietären Sprachmodell 'ARAS Core' bleiben Ihre Daten zu 100% in unserem System. Keine Weitergabe an externe AI-Anbieter wie OpenAI oder Google. Ihre Gesprächsdaten verlassen niemals die EU."
    },
    {
      title: "4. Ende-zu-Ende Verschlüsselung",
      content: "Alle KI-Telefonate und Gesprächsdaten werden mit modernster AES-256 Verschlüsselung gesichert. Unsere ISO-27001 zertifizierte Infrastruktur garantiert höchste Sicherheitsstandards."
    },
    {
      title: "5. Ihre Rechte nach DSGVO",
      content: "Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung und Datenübertragbarkeit. Als B2B-Plattform für Vertriebsautomatisierung unterstützen wir Sie bei der Einhaltung aller Datenschutzvorschriften."
    },
    {
      title: "6. Cookies für Plattform-Optimierung",
      content: "Wir nutzen ausschließlich essenzielle Cookies für die Funktionalität der ARAS AI Plattform. Marketing-Cookies nur nach expliziter Zustimmung. Vollständige Kontrolle über Ihre Cookie-Einstellungen."
    },
    {
      title: "7. Aktualität dieser Datenschutzerklärung",
      content: "Diese Datenschutzerklärung wird regelmäßig an neue rechtliche Anforderungen angepasst. Als KI-Telefonie-Anbieter halten wir uns an höchste Datenschutzstandards im DACH-Raum."
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              {/* Header */}
              <div className="mb-8">
                <Link href="/signup">
                  <Button
                    variant="ghost"
                    className="p-0 h-auto text-muted-foreground hover:text-primary mb-6"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to signup
                  </Button>
                </Link>
                
                <h1 className="text-3xl font-orbitron font-bold mb-4">
                  <GradientText>Datenschutzerklärung ARAS AI</GradientText>
                </h1>
                <p className="text-muted-foreground">
                  100% DSGVO-konforme KI-Telefonie aus der Schweiz | Stand: Januar 2025
                </p>
              </div>

              {/* Privacy Content */}
              <div className="space-y-8">
                {sections.map((section, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="space-y-4"
                  >
                    <h2 className="text-xl font-orbitron font-semibold text-primary">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Contact Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-12 pt-8 border-t border-border/50"
              >
                <h2 className="text-xl font-orbitron font-semibold text-primary mb-4">
                  Datenschutzbeauftragter
                </h2>
                <p className="text-muted-foreground">
                  Für Fragen zur Datenverarbeitung in unserer KI-Outbound-Telefonie-Plattform:
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-muted-foreground">E-Mail: datenschutz@aras-plattform.ai</p>
                  <p className="text-muted-foreground">Telefon: +41 43 344 6087</p>
                  <p className="text-muted-foreground">Adresse: Schwarzott Capital Partners AG, Löwenstrasse 20, 8001 Zürich, Schweiz</p>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}