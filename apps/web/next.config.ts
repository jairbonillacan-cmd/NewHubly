import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@hubly/application", "@hubly/contracts", "@hubly/db", "@hubly/ui"],
  // El enlace de invitación lleva el token en el fragmento; sin Referer no hay forma de que se filtre la URL de la página.
  async headers() {
    return [{ source: "/invitacion", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default config;
