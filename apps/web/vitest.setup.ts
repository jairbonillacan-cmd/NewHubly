import { vi } from "vitest";

// next/font/local solo existe dentro del compilador de Next; en Vitest se simula.
vi.mock("next/font/local", () => ({
  default: () => ({
    className: "",
    variable: "--font-fraunces-latin",
    style: { fontFamily: "Fraunces" },
  }),
}));
