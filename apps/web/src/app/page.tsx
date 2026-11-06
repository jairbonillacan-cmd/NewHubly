import { AudienceSection, DataSection, DiaSection, FaqSection, FeatureGrid, FinalCta, GrowSection, HubiSection, LandingFooter, LandingHero, LandingNav, PainSection, RoadmapSection, WorkspaceSection } from "@hubly/ui";
import "./landing.css";
import type { Metadata } from "next";
import { frauncesLatin, frauncesLatinExt } from "../fonts/fraunces";

export const metadata: Metadata = {
  title: "Hubly · Un solo espacio para todo tu marketing",
  description: "Organiza tus ideas, tu contenido y tus marcas en el mismo lugar. Para quien lleva su propia marca y para agencias y equipos.",
};

const LEGAL_LINKS = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
] as const;

export default function HomePage() {
  return (
    <div className={`landing-page ${frauncesLatin.variable} ${frauncesLatinExt.variable} min-h-dvh bg-(--surface-canvas) text-(--text-primary)`}>
      <main>
        <div className="bg-(image:--landing-hero)">
          <LandingNav />
          <LandingHero />
        </div>
        <AudienceSection />
        <PainSection />
        <DiaSection />
        <FeatureGrid />
        <GrowSection />
        <WorkspaceSection />
        <HubiSection />
        <RoadmapSection />
        <DataSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter links={LEGAL_LINKS} />
    </div>
  );
}
