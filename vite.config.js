import {fileURLToPath, URL} from 'node:url';

import {defineConfig, loadEnv} from 'vite';
import vue from '@vitejs/plugin-vue';
import {viteSingleFile} from "vite-plugin-singlefile";
import vuetify, {transformAssetUrls} from 'vite-plugin-vuetify';

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, ""); // reuse vite's env parser to inject into our index.html

  const htmlPlugin = () => {
    return {
      name: "html-transform",
      transformIndexHtml(html) {
        return html.replace(/%(.*?)%/g, function (match, p1) {
          return env[p1.replace('import.meta.env.', '')];
        });
      },
    };
  };

  return {
    plugins: [
      htmlPlugin(),
      vue({
        template: {transformAssetUrls}
      }),
      viteSingleFile(),
      vuetify({
        autoImport: true,
        styles: {
          configFile: 'src/styles/settings.scss',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
});
