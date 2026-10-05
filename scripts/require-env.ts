// Refuse a missing secret or variable, naming it (#38). The deploy job runs this first, with every
// secret and Actions variable it reads in its env:
//
//   node scripts/require-env.ts NAME [NAME ...]
//
// GitHub expands a secret or variable that was never set to an empty string, so without this the job
// would run on and fail later, inside whichever tool first needed the value, with that tool's message.
// Each listed name that is unset or blank is named here, all of them in one message, and the job stops
// before anything reaches production. It prints names only, never a value.
//
// A failure sets process.exitCode and returns, like the bootstrap command (scripts/bootstrap-program.ts).

const names = process.argv.slice(2)

if (names.length === 0) {
  console.error('usage: node scripts/require-env.ts NAME [NAME ...]')
  process.exitCode = 1
} else {
  const missing = names.filter((name) => (process.env[name] ?? '').trim() === '')
  if (missing.length > 0) {
    console.error(
      `Not set: ${missing.join(', ')}. Add each one to the production environment's secrets or ` +
        'variables (Settings, Environments, production), then re-run this job.',
    )
    process.exitCode = 1
  } else {
    console.log(`Set: ${names.join(', ')}`)
  }
}
