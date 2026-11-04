/* eslint-disable boundaries/no-unknown-files */
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../../../apps/web/public"],
};

export default config;
