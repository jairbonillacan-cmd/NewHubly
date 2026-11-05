import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import "../landing/landing.css";
import "./landing-fonts.css";
import { RoadmapSection } from "../landing/RoadmapSection";
import { ShortcutsSection } from "../landing/ShortcutsSection";
import { WorkspaceSection } from "../landing/WorkspaceSection";
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
  decorators: [(Story) => <div className="landing-page landing-story"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof LandingHero>;

export const PaginaCompleta: Story = {
  render: () => (
    <div className="bg-(--surface-canvas) text-(--text-primary)">
      <div className="bg-(image:--landing-hero)">
        <LandingNav />
        <LandingHero />
      </div>
      <AudienceSection />
      <PainSection />
      <FeatureGrid />
      <WorkspaceSection />
      <ShortcutsSection />
      <RoadmapSection />
      <DataSection />
      <FaqSection />
      <FinalCta />
      <LandingFooter />
    </div>
  ),
};

export const Navegacion: Story = { render: () => <LandingNav /> };
export const Hero: Story = { render: () => <div className="bg-(image:--landing-hero)"><LandingHero /></div> };
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

export const Fondos: Story = { render: () => <WorkspaceSection /> };
export const Atajos: Story = { render: () => <ShortcutsSection /> };
export const Etapas: Story = { render: () => <RoadmapSection /> };
export const Privacidad: Story = { render: () => <DataSection /> };
export const Cierre: Story = { render: () => <FinalCta /> };
export const Pie: Story = { render: () => <LandingFooter /> };

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
