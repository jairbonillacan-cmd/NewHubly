import { LandingFooter, LandingNav, PricingSection, navLinksFor } from "@hubly/ui";
import type { Metadata } from "next";
import "../../landing.css";
import { frauncesLatin, frauncesLatinExt } from "../../../fonts/fraunces";

export const metadata: Metadata = {
  title: "Precios · Hubly",
  description: "Los planes de Hubly para ti, tu equipo y tu agencia. Hoy ya puedes usar tu espacio personal.",
};

export function PreciosPage() {
  return (
    <div className={`landing-page ${frauncesLatin.variable} ${frauncesLatinExt.variable} min-h-dvh bg-(--surface-canvas) text-(--text-primary)`}>
      <div className="bg-(image:--landing-hero) pb-6">
        <LandingNav links={navLinksFor("/precios")} />
      </div>
      <main className="pb-20 lg:pb-28">
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}

export default PreciosPage;
