import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { CalendarioLista } from "../calendario/CalendarioLista";
import { CalendarioMes } from "../calendario/CalendarioMes";
import { CalendarioSemana } from "../calendario/CalendarioSemana";
import { PiezaChip } from "../calendario/PiezaChip";
import type { CalendarioPiezaItem } from "../calendario/types";

const TODAY = "2026-11-06";

const PIEZAS_DEMO: CalendarioPiezaItem[] = [
  { id: "p1", titulo: "Reel de proceso de tueste", marcaId: "m1", marcaNombre: "Café Aurora", marcaColor: "arena", canal: "instagram", estado: "publicada", fecha: "2026-11-03", hora: "09:30", campana: "Otoño", responsableNombre: "Ana" },
  { id: "p2", titulo: "Hilo sobre arquitectura limpia", marcaId: "m2", marcaNombre: "Lumen Studio", marcaColor: "azul", canal: "x", estado: "aprobada", fecha: "2026-11-04", hora: "11:00", responsableNombre: "Leo" },
  { id: "p3", titulo: "Carrusel de hábitos creativos", marcaId: "m3", marcaNombre: "Pulso Verde", marcaColor: "verde", canal: "linkedin", estado: "revision", fecha: TODAY, hora: "09:00", campana: "Comunidad", responsableNombre: "Ana" },
  { id: "p4", titulo: "Teaser detrás de cámaras", marcaId: "m4", marcaNombre: "Nube Lila", marcaColor: "lila", canal: "tiktok", estado: "aprobada", fecha: TODAY, hora: "12:00", responsableNombre: "Leo" },
  { id: "p5", titulo: "Boletín quincenal de novedades", marcaId: "m2", marcaNombre: "Lumen Studio", marcaColor: "azul", canal: "email", estado: "borrador", fecha: TODAY, hora: "15:00" },
  { id: "p6", titulo: "Guía de regalo de temporada", marcaId: "m1", marcaNombre: "Café Aurora", marcaColor: "arena", canal: "blog", estado: "idea", fecha: TODAY, hora: "17:30" },
  { id: "p7", titulo: "Video largo de preguntas frecuentes", marcaId: "m3", marcaNombre: "Pulso Verde", marcaColor: "verde", canal: "youtube", estado: "idea", fecha: TODAY, hora: "19:00" },
  { id: "p8", titulo: "Resumen dominical de comunidad", marcaId: "m4", marcaNombre: "Nube Lila", marcaColor: "lila", canal: "facebook", estado: "aprobada", fecha: "2026-11-08", hora: "10:00" },
];

function MesInteractivo() {
  const [piezas, setPiezas] = useState(PIEZAS_DEMO);
  const [selected, setSelected] = useState<string | null>("p3");
  return (
    <CalendarioMes
      anchorDate={TODAY} todayDate={TODAY} piezas={piezas} selectedPiezaId={selected} onSelectPieza={setSelected}
      onCreateOnDate={() => undefined} onDropPieceOnDate={(id, targetDate) => setPiezas((list) => list.map((p) => (p.id === id ? { ...p, fecha: targetDate } : p)))}
    />
  );
}

const meta: Meta<typeof MesInteractivo> = { title: "Calendario/Vistas", component: MesInteractivo };
export default meta;
type Story = StoryObj<typeof MesInteractivo>;

export const VistaMes: Story = {};
export const VistaSemana: Story = { render: () => <CalendarioSemana anchorDate={TODAY} todayDate={TODAY} piezas={PIEZAS_DEMO} onCreateOnDate={() => undefined} onDropPieceOnDate={() => undefined} /> };
export const VistaLista: Story = { render: () => <CalendarioLista todayDate={TODAY} piezas={PIEZAS_DEMO} onCreatePieza={() => undefined} /> };
export const ListaVacia: Story = { render: () => <CalendarioLista todayDate={TODAY} piezas={[]} onCreatePieza={() => undefined} /> };
export const FichasDePieza: Story = {
  render: () => <div className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">{PIEZAS_DEMO.slice(0, 4).map((pieza) => <PiezaChip key={pieza.id} pieza={pieza} />)}</div>,
};
