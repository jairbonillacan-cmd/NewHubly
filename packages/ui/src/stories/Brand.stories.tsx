import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Hubi } from "../components/brand/Hubi";
import { HublySymbol, HublyWordmark } from "../components/brand/HublyLogo";
import { tokens } from "../tokens";

const meta: Meta<typeof HublyWordmark> = {
  title: "Identidad/Secuencia y Hubi",
  component: HublyWordmark,
};

export default meta;
type Story = StoryObj<typeof HublyWordmark>;

export const SimboloSecuencia: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: tokens.space[6], padding: tokens.space[6], backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.xl }}>
      <HublySymbol size={20} ariaLabel="Hubly compacto" />
      <HublySymbol size={32} ariaLabel="Hubly estándar" />
      <HublySymbol size={48} ariaLabel="Hubly destacado" />
    </div>
  ),
};

export const FirmaCompletaWordmark: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[5], padding: tokens.space[6], backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.xl }}>
      <HublyWordmark height={24} ariaLabel="Hubly" />
      <HublyWordmark height={36} ariaLabel="Hubly" />
    </div>
  ),
};

export const MascotaHubiVariantes: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gap: tokens.space[4] }}>
      {(
        [
          { acabado: "origen", pose: "sentado", label: "Origen · Sentado (pantallas vacías)" },
          { acabado: "origen", pose: "laptop", label: "Origen · Laptop" },
          { acabado: "volumen", pose: "sentado", label: "Volumen · Sentado" },
          { acabado: "volumen", pose: "laptop", label: "Volumen · Laptop (Hero y /login)" },
        ] as const
      ).map((item) => (
        <div
          key={`${item.acabado}-${item.pose}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: tokens.space[3],
            padding: tokens.space[5],
            backgroundColor: tokens.bento.cardBg,
            border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
            borderRadius: tokens.radius.xl,
            boxShadow: tokens.bento.cardShadow,
          }}
        >
          <Hubi acabado={item.acabado} pose={item.pose} tamano={112} alt={item.label} />
          <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, color: tokens.color.textSecondary, textAlign: "center" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  ),
};
