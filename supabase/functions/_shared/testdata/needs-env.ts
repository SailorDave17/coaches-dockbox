// A function's module scope, as every function here starts (#35): the env is loaded at import,
// before anything is served. env.test.ts imports this to see what a function's boot does.
import { loadEnv } from '../env.ts'

export const env = loadEnv(['DOCKBOX_TEST_URL', 'DOCKBOX_TEST_KEY', 'DOCKBOX_TEST_TOKEN'])
