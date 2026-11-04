import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@hubly/application", "@hubly/contracts", "@hubly/db", "@hubly/ui"],
  async headers() {
    return [
      { source: "/invitacion", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/invitacion/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default config;
