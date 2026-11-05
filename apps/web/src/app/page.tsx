import { AppPreview, DataSection, FaqSection, FeatureGrid, FinalCta, LandingFooter, LandingHero, LandingNav, PainSection } from "@hubly/ui";
import type { Metadata } from "next";
import { frauncesLatin, frauncesLatinExt } from "../fonts/fraunces";

export const metadata: Metadata = {
  title: "Hubly · Sabe qué sigue y quién lo tiene",
  description: "Hubly junta las ideas, los pendientes y las aprobaciones de cada cliente de tu agencia. Abres y ya sabes qué sigue y quién lo tiene.",
};

const LEGAL_LINKS = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
] as const;

export default function HomePage() {
  return (
    <div className={`landing-page ${frauncesLatin.variable} ${frauncesLatinExt.variable} min-h-dvh bg-(--surface-canvas) text-(--text-primary)`}>
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
      <LandingFooter links={LEGAL_LINKS} />
    </div>
  );
}
