import { describe, expect, it } from "vitest";
import { Button, Card, Checkbox, Chip, EmptyState, Input, Kbd, Switch, Tabs, TextArea, TextField } from "./index";

describe("Primitivas de HeroUI v3 OSS reexportadas por @hubly/ui (ADR 0006)", () => {
  it("reexporta las primitivas reales de @heroui/react para consumo en apps/web", () => {
    for (const primitive of [Button, Card, Tabs, Checkbox, TextField, Input, TextArea, Chip, Kbd, Switch, EmptyState]) {
      expect(typeof primitive).toBe("function");
    }
  });
});
