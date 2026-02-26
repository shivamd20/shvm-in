/// <reference types="vitest" />
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'jsdom',
        globals: true,
        exclude: ['**/node_modules/**', '**/vani2/__tests__/integration/**'],
        server: {
            deps: {
                inline: ['xstate']
            }
        }
    }
})
