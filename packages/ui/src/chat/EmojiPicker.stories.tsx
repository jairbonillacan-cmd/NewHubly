import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { EmojiPicker } from "./EmojiPicker";

function EmojiPickerDemo({ initialQuery = "" }: { initialQuery?: string }) {
  const [selected, setSelected] = useState("👍");
  return (
    <div className="flex flex-col items-start gap-3 p-6 text-(--text-primary)">
      <p className="m-0 text-sm">Emoji seleccionado: <span className="text-lg">{selected}</span></p>
      <EmojiPicker initialQuery={initialQuery} onSelect={setSelected} />
    </div>
  );
}

const meta: Meta<typeof EmojiPickerDemo> = { title: "Chat/EmojiPicker", component: EmojiPickerDemo };
export default meta;
type Story = StoryObj<typeof EmojiPickerDemo>;
export const PorDefecto: Story = {};
export const ConBusqueda: Story = { args: { initialQuery: "fuego" } };
