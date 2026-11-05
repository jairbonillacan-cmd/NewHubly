import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { FeatureGrid } from "../landing/FeatureGrid";
import { GlassCard } from "../landing/GlassCard";
import { AppPreview } from "../landing/AppPreview";
import { LandingHero } from "../landing/LandingHero";
import { LandingNav } from "../landing/LandingNav";
import { DataSection, FaqSection, FinalCta, LandingFooter, PainSection } from "../landing/LandingSections";
import { PillNav } from "../landing/PillNav";
import { ThemeToggle } from "../landing/ThemeToggle";
import { tokens } from "../tokens";

const meta: Meta<typeof LandingHero> = {
  title: "Landing/Marketing",
  component: LandingHero,
};

export default meta;
type Story = StoryObj<typeof LandingHero>;

export const PaginaCompleta: Story = {
  render: () => (
    <div className="bg-(--surface-canvas) text-(--text-primary)">
      <LandingNav />
      <LandingHero />
      <AppPreview />
      <PainSection />
      <FeatureGrid />
      <DataSection />
      <FaqSection />
      <FinalCta />
      <LandingFooter />
    </div>
  ),
};

export const TarjetasDeProducto: Story = {
  render: () => <FeatureGrid />,
};

export const NavegacionPildoraLegal: Story = {
  render: () => (
    <div style={{ position: "relative", minHeight: tokens.space[12], paddingBlock: tokens.space[10], backgroundColor: tokens.color.surfaceBrand, borderRadius: tokens.radius.xl }}>
      <PillNav activeSection="inicio" />
    </div>
  ),
};

export const TarjetaLiquidGlassYSelectorTema: Story = {
  render: () => (
    <div style={{ padding: tokens.space[8], backgroundColor: tokens.color.surfaceBrand, borderRadius: tokens.radius.xl, display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ThemeToggle />
      </div>
      <GlassCard aria-label="Tarjeta de cristal de demostración">
        <strong style={{ fontSize: tokens.font.size.base, color: tokens.glass.textPrimary }}>Panel de cristal neutro frío</strong>
        <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, color: tokens.glass.textSecondary }}>
          Superficie translúcida gobernada por tokens semánticos con contraste verificado WCAG 2.2 AA en modo claro y oscuro.
        </p>
      </GlassCard>
    </div>
  ),
};
