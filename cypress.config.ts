import { defineConfig } from 'cypress';
import { initPlugin } from 'cypress-plugin-snapshots/plugin';

export default defineConfig({
  e2e: {
    defaultCommandTimeout: 30_000,
    defaultBrowser: 'chrome',
    video: true,

    setupNodeEvents(on, config) {
      initPlugin(on, config);
    },
  },
});
