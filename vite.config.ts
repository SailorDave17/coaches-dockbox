import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // http://localhost:5173 is the origin local Auth sends sign-in links back to (supabase/config.toml,
  // #52). strictPort stops the dev server moving to 5174 when the port is taken, where a link would
  // land on the other server.
  server: { port: 5173, strictPort: true },
})
