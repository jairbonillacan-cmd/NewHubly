import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { BentoSection } from "../landing/BentoSection";
import { GlassCard } from "../landing/GlassCard";
import { HeroSection } from "../landing/HeroSection";
import { PillNav } from "../landing/PillNav";
import { ThemeToggle } from "../landing/ThemeToggle";
import { tokens } from "../tokens";

const meta: Meta<typeof HeroSection> = {
  title: "Landing/Bloques Editoriales",
  component: HeroSection,
};

export default meta;
type Story = StoryObj<typeof HeroSection>;

export const NavegacionPildora: Story = {
  render: () => (
    <div style={{ position: "relative", minHeight: tokens.space[12], paddingBlock: tokens.space[10], backgroundColor: tokens.color.surfaceBrand, borderRadius: tokens.radius.xl }}>
      <PillNav activeSection="inicio" />
    </div>
  ),
};

export const SeccionHeroCompleta: Story = {
  render: () => (
    <div style={{ position: "relative" }}>
      <PillNav activeSection="inicio" />
      <HeroSection />
    </div>
  ),
};

export const CuadriculaBentoEditorial: Story = {
  render: () => <BentoSection />,
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
