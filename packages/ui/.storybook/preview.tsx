/* eslint-disable boundaries/no-unknown-files */
import type { Preview } from "@storybook/react-vite";
import React, { useEffect } from "react";
import { tokens } from "../src/tokens";
import "../src/tokens.css";

export const VIEWPORT_PRESETS = {
  desktop1440: {
    name: "Escritorio 1440×900",
    styles: { width: "1440px", height: "900px" },
    type: "desktop" as const,
  },
  mobile390: {
    name: "Móvil 390×844",
    styles: { width: "390px", height: "844px" },
    type: "mobile" as const,
  },
};

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Tema",
      description: "Tema visual de Hubly (Grafito y azul tinta, #52)",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Claro" },
          { value: "dark", title: "Oscuro" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: VIEWPORT_PRESETS,
      viewports: VIEWPORT_PRESETS,
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals["theme"] === "dark" ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", theme);
      }
      useEffect(() => {
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
      }, [theme]);

      return (
        <div
          data-theme={theme}
          style={{
            minHeight: tokens.layout.viewportHeight,
            backgroundColor: "var(--surface-primary, var(--surface-canvas))",
            color: tokens.color.textPrimary,
            fontFamily: tokens.font.sans,
            padding: tokens.space[6],
            boxSizing: "border-box",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
