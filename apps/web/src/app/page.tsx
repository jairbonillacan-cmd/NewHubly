import { tokens } from "@hubly/ui";
import { BentoSection } from "../components/landing/BentoSection";
import { HeroSection } from "../components/landing/HeroSection";
import { PillNav } from "../components/landing/PillNav";
import { VariantBanner } from "../components/landing/VariantBanner";

export default function HomePage() {
  return (
    <div style={{ position: "relative", minHeight: tokens.layout.viewportHeight }}>
      <VariantBanner currentVariant="variante-1" />
      <PillNav currentVariant="variante-1" activeSection="inicio" />
      <main>
        <HeroSection
          variant="variante-1"
          imageSrc="/images/hero-studio.jpg"
          headlineLine1="El trabajo de tu agencia."
          headlineLine2="Bajo control, en una sola vista."
          subheadline="Hubly ordena el ciclo de publicación para agencias: desde la idea inicial hasta la métrica real, sin perder tiempo en chats dispersos ni adivinar quién tiene el turno."
        />
        <BentoSection layoutVariant="asymmetric" />
      </main>
    </div>
  );
}
