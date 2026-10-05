import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The commit this build was made from, which the footer shows (#38). After a deploy, CI loads the
// served page and compares it with the merged commit (scripts/check-deploy.ts), so a build that cannot
// say which commit it is stops here rather than shipping without a stamp. CI's checkout is that commit.
function buildCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch (error) {
    throw new Error(`The build stamps its commit, and \`git rev-parse HEAD\` failed: ${String(error)}`)
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  // http://localhost:5173 is the origin local Auth sends sign-in links back to (supabase/config.toml,
  // #52). strictPort stops the dev server moving to 5174 when the port is taken, where a link would
  // land on the other server.
  server: { port: 5173, strictPort: true },
})
