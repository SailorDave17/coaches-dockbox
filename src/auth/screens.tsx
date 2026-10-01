// The sign-in screens (#52). Each renders one View from session.ts and decides nothing about
// sessions itself. Every one is scanned by tests/screens/sign-in.spec.ts with the accessibility helper.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { LinkRequest, Problem } from './session.ts'

// A heading that takes focus when it appears, so a screen reader announces a screen that replaced
// the one the focused control was on, and the next Tab starts from it.
function FocusedHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <h2 ref={ref} tabIndex={-1}>
      {children}
    </h2>
  )
}

export function SignInScreen({ requestLink }: { requestLink: (email: string) => Promise<LinkRequest> }) {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent' | 'unreachable'>('form')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPhase('sending')
    setPhase(await requestLink(email))
  }

  if (phase === 'sent') {
    // The same words for every address: whether it has an account is never shown (#52).
    return (
      <section>
        <FocusedHeading>Check your email</FocusedHeading>
        <p>
          If {email} is on a Dockbox roster, a sign-in link is on its way to it. Open the link on this phone.
        </p>
        <button type="button" className="secondary" onClick={() => setPhase('form')}>
          Use a different email
        </button>
      </section>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <h2>Sign in</h2>
      <p>We&apos;ll email you a sign-in link. There is no password.</p>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      {phase === 'unreachable' && (
        <p role="alert">Dockbox can&apos;t be reached right now. Check your connection, then try again.</p>
      )}
      <button type="submit" disabled={phase === 'sending'}>
        Email me a sign-in link
      </button>
    </form>
  )
}

export function SignedInScreen({ firstName, onSignOut }: { firstName: string; onSignOut: () => void }) {
  return (
    <section>
      <FocusedHeading>{`Signed in as ${firstName}`}</FocusedHeading>
      <button type="button" className="secondary" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  )
}

export function NotOnRosterScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <section>
      <FocusedHeading>You&apos;re not on a Dockbox roster yet</FocusedHeading>
      <p>Dockbox opens once a director adds you to a program. Ask your program&apos;s director.</p>
      <button type="button" className="secondary" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  )
}

const PROBLEMS: Record<Problem, { title: string; text: string }> = {
  unreachable: {
    title: "Dockbox can't be reached right now",
    text: 'Check your connection, then try again.',
  },
  'sign-out-unfinished': {
    title: "Signing out didn't finish",
    text: 'Check your connection, then try again. Until it finishes, this phone may still be signed in.',
  },
}

export function ProblemScreen({
  problem,
  onTryAgain,
  onSignOut,
}: {
  problem: Problem
  onTryAgain: () => void
  onSignOut: () => void
}) {
  const { title, text } = PROBLEMS[problem]
  return (
    <section>
      <FocusedHeading>{title}</FocusedHeading>
      <p>{text}</p>
      <button type="button" onClick={onTryAgain}>
        Try again
      </button>
      {problem === 'unreachable' && (
        <button type="button" className="secondary" onClick={onSignOut}>
          Sign out
        </button>
      )}
    </section>
  )
}
