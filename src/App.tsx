// The dock screen arrives through its stories, built to the design bar in docs/charter.md: one thumb,
// zero decisions. Until then the app is the sign-in (#52).
import { useEffect, useState } from 'react'
import { NotOnRosterScreen, ProblemScreen, SignedInScreen, SignInScreen } from './auth/screens.tsx'
import { createSignIn, type View } from './auth/session.ts'
import { db, readMyFirstName } from './lib/db.ts'

const signIn = createSignIn(db.auth, readMyFirstName)

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' })

  useEffect(() => {
    let cancelled = false
    void signIn.boot().then((next) => {
      if (!cancelled) setView(next)
    })
    const stopWatching = signIn.watchSignedOut(setView)
    return () => {
      cancelled = true
      stopWatching()
    }
  }, [])

  const reload = () => {
    setView({ name: 'loading' })
    void signIn.boot().then(setView)
  }
  const signOut = () => {
    setView({ name: 'loading' })
    void signIn.signOut().then(setView)
  }

  return (
    <main className="shell" aria-busy={view.name === 'loading'}>
      <h1>Coaches&apos; Dockbox</h1>
      {view.name === 'sign-in' && (
        // The link returns to the origin it was asked from, which Auth's allow-list must name.
        <SignInScreen requestLink={(email) => signIn.requestLink(email, window.location.origin)} />
      )}
      {view.name === 'signed-in' && <SignedInScreen firstName={view.firstName} onSignOut={signOut} />}
      {view.name === 'not-on-roster' && <NotOnRosterScreen onSignOut={signOut} />}
      {view.name === 'problem' && (
        <ProblemScreen
          problem={view.problem}
          onTryAgain={view.problem === 'unreachable' ? reload : signOut}
          onSignOut={signOut}
        />
      )}
    </main>
  )
}
