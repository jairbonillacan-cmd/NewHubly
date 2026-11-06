import { describe, expect, it } from "vitest";
import { suggestOverdueTodos } from "./index";

describe("Sugerencia de vencidos de Hubi", () => {
  const today = "2026-11-05";
  const overdue = { id: "t-1", dueDate: "2026-11-04", isDone: false };

  it("propone pasar a hoy un pendiente vencido", () => {
    expect(suggestOverdueTodos([overdue], today)).toEqual({
      todoIds: ["t-1"], message: "Tienes 1 vencido", actionLabel: "Pasarlo a hoy",
    });
  });

  it("se oculta si los pendientes están hechos, sin fecha o todavía a tiempo", () => {
    expect(suggestOverdueTodos([
      { ...overdue, isDone: true },
      { ...overdue, dueDate: null },
      { ...overdue, dueDate: today },
      { ...overdue, dueDate: "2026-11-06" },
    ], today)).toBeNull();
  });

  it("agrupa los vencidos en una sola sugerencia", () => {
    expect(suggestOverdueTodos([overdue, { ...overdue, id: "t-2", dueDate: "2026-11-01" }], today)).toEqual({
      todoIds: ["t-1", "t-2"], message: "Tienes 2 vencidos", actionLabel: "Pasarlos a hoy",
    });
  });
});
