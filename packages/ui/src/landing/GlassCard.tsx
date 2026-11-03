import type { CSSProperties, ReactNode } from "react";
import { tokens } from "../tokens";

export interface GlassCardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  as?: "div" | "article" | "section" | "aside";
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function GlassCard({
  children,
  style,
  className = "",
  as: Component = "div",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: GlassCardProps) {
  const baseStyle: CSSProperties = {
    padding: tokens.space[6],
    display: "flex",
    flexDirection: "column",
    gap: tokens.space[4],
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    width: "100%",
    ...style,
  };

  return (
    <Component className={`glass-panel ${className}`.trim()} style={baseStyle} aria-label={ariaLabel} aria-labelledby={ariaLabelledby}>
      {children}
    </Component>
  );
}
