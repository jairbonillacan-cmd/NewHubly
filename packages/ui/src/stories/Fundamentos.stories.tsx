import { Accordion, Alert, Avatar, Button, Card, Checkbox, Chip, Kbd, Switch, Tabs, Tooltip } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { type ReactNode } from "react";
import { HubiFace } from "../components/brand/HublyLogo";

// Sistema visual de Hubly sobre HeroUI v3 OSS (ADR 0006): tokens de la paleta Grafito y azul tinta (#52) y componentes reales.

const COLORS = [
  { token: "--surface-canvas", label: "Lienzo" },
  { token: "--surface-raised", label: "Superficie" },
  { token: "--surface-subtle", label: "Sutil" },
  { token: "--text-primary", label: "Texto" },
  { token: "--text-secondary", label: "Texto 2" },
  { token: "--text-muted", label: "Tenue" },
  { token: "--accent-primary", label: "Azul tinta" },
  { token: "--accent-primary-subtle", label: "Azul suave" },
  { token: "--status-success-text", label: "Éxito" },
  { token: "--status-warning-text", label: "Aviso" },
  { token: "--status-danger-text", label: "Peligro" },
  { token: "--tint-blue", label: "Tinte azul" },
  { token: "--tint-sand", label: "Tinte arena" },
  { token: "--tint-green", label: "Tinte verde" },
  { token: "--tint-lilac", label: "Tinte lila" },
] as const;

// Clases de fondo listadas de forma literal para que Tailwind las genere.
const SWATCH_BG: Record<(typeof COLORS)[number]["token"], string> = {
  "--surface-canvas": "bg-(--surface-canvas)",
  "--surface-raised": "bg-(--surface-raised)",
  "--surface-subtle": "bg-(--surface-subtle)",
  "--text-primary": "bg-(--text-primary)",
  "--text-secondary": "bg-(--text-secondary)",
  "--text-muted": "bg-(--text-muted)",
  "--accent-primary": "bg-(--accent-primary)",
  "--accent-primary-subtle": "bg-(--accent-primary-subtle)",
  "--status-success-text": "bg-(--status-success-text)",
  "--status-warning-text": "bg-(--status-warning-text)",
  "--status-danger-text": "bg-(--status-danger-text)",
  "--tint-blue": "bg-(--tint-blue)",
  "--tint-sand": "bg-(--tint-sand)",
  "--tint-green": "bg-(--tint-green)",
  "--tint-lilac": "bg-(--tint-lilac)",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 text-xs font-bold tracking-(--tracking-widest) text-(--accent-primary) uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Fundamentos() {
  return (
    <div className="min-h-dvh bg-(--surface-canvas) px-6 py-10 text-(--text-primary) lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="flex items-center gap-4">
          <HubiFace className="size-14" />
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-(--tracking-tighter)">Fundamentos de Hubly</h1>
            <p className="m-0 text-(--text-secondary)">HeroUI v3 con la paleta Grafito y azul tinta. Cambia el tema en la barra de Storybook.</p>
          </div>
        </header>

        <Section title="Color">
          <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-5">
            {COLORS.map((color) => (
              <li key={color.token} className="flex flex-col gap-1.5">
                <span className={`h-14 rounded-xl border border-(--border-default) ${SWATCH_BG[color.token]}`} />
                <span className="text-sm font-medium">{color.label}</span>
                <code className="text-xs text-(--text-muted)">{color.token}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tipografía">
          <div className="flex flex-col gap-2">
            <p className="m-0 text-(length:--text-display-hero) leading-none font-bold tracking-(--tracking-tightest)">Deja de preguntar</p>
            <p className="m-0 text-3xl font-bold tracking-(--tracking-tighter)">Lo que Hubly hace por tu agencia.</p>
            <p className="m-0 text-lg text-(--text-secondary)">Hubly junta las ideas, los pendientes y las aprobaciones de cada cliente.</p>
            <p className="m-0 text-sm text-(--text-muted)">Texto de apoyo y etiquetas.</p>
          </div>
        </Section>

        <Section title="Botones">
          {(["lg", "md", "sm"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <Button size={size} variant="primary">Crear cuenta</Button>
              <Button size={size} variant="secondary">Ver cómo funciona</Button>
              <Button size={size} variant="tertiary">Terciario</Button>
              <Button size={size} variant="outline">Contorno</Button>
              <Button size={size} variant="ghost">Fantasma</Button>
              <Button size={size} variant="danger-soft">Peligro suave</Button>
              <Button size={size} variant="primary" isDisabled>Desactivado</Button>
            </div>
          ))}
        </Section>

        <Section title="Etiquetas">
          <div className="flex flex-wrap gap-2">
            <Chip color="success" variant="soft">Ya disponible</Chip>
            <Chip color="accent" variant="soft">Muy pronto</Chip>
            <Chip variant="secondary">Próximamente</Chip>
            <Chip color="danger" variant="soft">1 vencido</Chip>
            <Chip color="accent" variant="soft">3 para hoy</Chip>
            <Chip color="warning" variant="soft">Alta</Chip>
            <Chip variant="soft">Media</Chip>
          </div>
        </Section>

        <div className="grid gap-12 md:grid-cols-2">
          <Section title="Controles">
            <div className="flex flex-col gap-4">
              <Checkbox defaultSelected>
                <Checkbox.Content className="flex flex-row items-center gap-2">
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  Revisar copys de noviembre
                </Checkbox.Content>
              </Checkbox>
              <Switch defaultSelected>
                <Switch.Content className="flex flex-row items-center gap-2">
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                  Avisos de vencidos
                </Switch.Content>
              </Switch>
              <p className="m-0 flex items-center gap-2 text-sm text-(--text-secondary)">
                Atajos: <Kbd><Kbd.Content>Ctrl</Kbd.Content></Kbd> + <Kbd><Kbd.Content>K</Kbd.Content></Kbd> buscar · <Kbd><Kbd.Content>C</Kbd.Content></Kbd> capturar
              </p>
              <div className="flex items-center gap-3">
                <Avatar color="accent"><Avatar.Fallback>AL</Avatar.Fallback></Avatar>
                <Avatar color="success" variant="soft"><Avatar.Fallback>MR</Avatar.Fallback></Avatar>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button variant="outline" size="sm">Pasa el cursor</Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Ayuda breve</Tooltip.Content>
                </Tooltip>
              </div>
            </div>
          </Section>

          <Section title="Pestañas">
            <Tabs defaultSelectedKey="hoy">
              <Tabs.ListContainer>
                <Tabs.List aria-label="Vistas">
                  <Tabs.Tab id="hoy">Hoy<Tabs.Indicator /></Tabs.Tab>
                  <Tabs.Tab id="proximos">Próximos<Tabs.Indicator /></Tabs.Tab>
                  <Tabs.Tab id="sin-fecha">Sin fecha<Tabs.Indicator /></Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="hoy" className="pt-3 text-sm text-(--text-secondary)">Lo vencido primero, luego lo de hoy.</Tabs.Panel>
              <Tabs.Panel id="proximos" className="pt-3 text-sm text-(--text-secondary)">Lo que viene en los próximos días.</Tabs.Panel>
              <Tabs.Panel id="sin-fecha" className="pt-3 text-sm text-(--text-secondary)">Pendientes sin fecha.</Tabs.Panel>
            </Tabs>
          </Section>
        </div>

        <div className="grid gap-12 md:grid-cols-2">
          <Section title="Tarjeta">
            <Card>
              <Card.Header>
                <Card.Title>Junta con Café Aurora</Card.Title>
                <Card.Description>Nota fijada · 3 nov</Card.Description>
              </Card.Header>
              <Card.Content>
                <p className="m-0 text-sm leading-relaxed text-(--text-secondary)">Quedamos en 12 piezas para noviembre, tono cercano.</p>
              </Card.Content>
              <Card.Footer className="gap-2">
                <Button size="sm" variant="secondary">Crear pendiente</Button>
                <Button size="sm" variant="ghost">Fijar</Button>
              </Card.Footer>
            </Card>
          </Section>

          <Section title="Avisos">
            <div className="flex flex-col gap-3">
              <Alert status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Todo guardado</Alert.Title>
                  <Alert.Description>Tus cambios están a salvo.</Alert.Description>
                </Alert.Content>
              </Alert>
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>No se pudo guardar la nota</Alert.Title>
                  <Alert.Description>Revisa tu conexión y vuelve a intentarlo.</Alert.Description>
                </Alert.Content>
              </Alert>
            </div>
          </Section>
        </div>

        <Section title="Acordeón">
          <Accordion defaultExpandedKeys={["para-quien"]}>
            <Accordion.Item id="para-quien">
              <Accordion.Heading>
                <Accordion.Trigger>¿Para quién es Hubly?<Accordion.Indicator /></Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel><Accordion.Body>Para agencias y equipos de redes sociales.</Accordion.Body></Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item id="datos">
              <Accordion.Heading>
                <Accordion.Trigger>¿Me puedo llevar mis datos?<Accordion.Indicator /></Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel><Accordion.Body>Sí, en JSON o Markdown.</Accordion.Body></Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Section>
      </div>
    </div>
  );
}

const meta: Meta<typeof Fundamentos> = {
  title: "Sistema/Fundamentos",
  component: Fundamentos,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof Fundamentos>;

export const Todo: Story = {};
