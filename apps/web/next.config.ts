import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@hubly/application", "@hubly/contracts", "@hubly/db", "@hubly/ui"],
};

export default config;
