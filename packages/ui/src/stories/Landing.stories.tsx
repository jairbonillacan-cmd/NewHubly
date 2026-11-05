import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { AudienceSection } from "../landing/AudienceSection";
import { AppPreview } from "../landing/AppPreview";
import { FeatureGrid } from "../landing/FeatureGrid";
import { LandingHero } from "../landing/LandingHero";
import { LandingNav } from "../landing/LandingNav";
import { DataSection, FaqSection, FinalCta, LandingFooter, PainSection } from "../landing/LandingSections";
import { LegalPage } from "../landing/LegalPage";

const meta: Meta<typeof LandingHero> = {
  title: "Landing/Marketing",
  component: LandingHero,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof LandingHero>;

export const PaginaCompleta: Story = {
  render: () => (
    <div className="bg-(--surface-canvas) text-(--text-primary)">
      <LandingNav />
      <LandingHero />
      <AudienceSection />
      <PainSection />
      <FeatureGrid />
      <DataSection />
      <FaqSection />
      <FinalCta />
      <LandingFooter />
    </div>
  ),
};

export const Hero: Story = { render: () => <LandingHero /> };
export const VistaDeHoy: Story = { render: () => <AppPreview /> };
export const AQuienVaDirigido: Story = { render: () => <AudienceSection /> };
export const ElProblema: Story = { render: () => <PainSection /> };

export const TarjetasDeProducto: Story = {
  render: () => (
    <div className="bg-(--surface-canvas) pb-16">
      <FeatureGrid />
    </div>
  ),
};

export const PreguntasFrecuentes: Story = {
  render: () => (
    <div className="bg-(--surface-canvas) pb-16">
      <FaqSection />
    </div>
  ),
};

export const PaginaLegal: Story = {
  render: () => (
    <LegalPage
      eyebrow="Privacidad y soberanía de datos"
      title="Política de Privacidad"
      intro="Cómo protegemos, aislamos y garantizamos la portabilidad de la información de tu agencia en Hubly."
      current="/privacidad"
      sections={[
        { id: "soberania", title: "1. Titularidad y soberanía de los datos", body: "Tus datos pertenecen íntegramente a tu agencia y a tus usuarios." },
        { id: "portabilidad", title: "2. Portabilidad y exportación abierta", body: "Descarga tus notas y pendientes en .json y .md cuando quieras." },
      ]}
    />
  ),
};
