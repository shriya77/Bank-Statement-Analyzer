import { useState } from 'react'
import { supabase } from './supabase'

type LoginScreenProps = {
  email: string
}

export function LoginScreen({ email }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || submitting) return
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError) {
      setSubmitting(false)
      return
    }

    // First unlock: create the shared account with this password.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    setSubmitting(false)

    if (!signUpError && signUpData.session) {
      return
    }

    if (signUpError?.message.toLowerCase().includes('already') || signInError) {
      setError('Wrong password')
      return
    }

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    setError(
      'Account created, but email confirmation may be required. In Supabase go to Authentication → Providers → Email and turn off “Confirm email”, then try again.'
    )
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Bank Statement Analyzer</h1>
        <p className="login-hint">Enter the shared password to continue</p>

        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Shared password"
          />
        </label>

        {error && <div className="error-banner">{error}</div>}

        <button type="submit" className="btn-primary login-submit" disabled={!password || submitting}>
          {submitting ? 'Signing in…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
