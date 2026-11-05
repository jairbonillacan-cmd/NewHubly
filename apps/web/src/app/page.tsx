import { AppPreview, DataSection, FaqSection, FeatureGrid, FinalCta, LandingFooter, LandingHero, LandingNav, PainSection } from "@hubly/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hubly · Sabe qué sigue y quién lo tiene",
  description: "Hubly junta las ideas, los pendientes y las aprobaciones de cada cliente de tu agencia. Abres y ya sabes qué sigue y quién lo tiene.",
};

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-(--surface-canvas) text-(--text-primary)">
      <LandingNav />
      <main>
        <LandingHero />
        <AppPreview />
        <PainSection />
        <FeatureGrid />
        <DataSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
