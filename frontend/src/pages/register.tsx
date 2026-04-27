import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { authApi } from '@/api/auth'
import { SignUpPage, type Testimonial } from '@/components/ui/sign-in'
import { useState } from 'react'

const testimonials: Testimonial[] = [
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/44.jpg',
    name: 'Priya Nair',
    handle: '@priyanair',
    text: 'Set up our company knowledge base in minutes. The onboarding is smooth and the results are immediately impressive.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/75.jpg',
    name: 'Alex Torres',
    handle: '@alextorres',
    text: 'The hybrid search combines keyword and semantic results beautifully. Our support team productivity is up 40%.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/68.jpg',
    name: 'Emma Wilson',
    handle: '@emmawilson',
    text: "We've replaced three separate tools with this single platform. The enterprise-grade security gives us peace of mind.",
  },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (payload: {
    first_name: string
    last_name: string
    email: string
    password: string
    password_confirm: string
  }) => {
    setErrorMessage('')
    setFieldErrors({})

    if (payload.password !== payload.password_confirm) {
      setFieldErrors({ password_confirm: 'Passwords do not match' })
      return
    }

    setLoading(true)
    try {
      const data = await authApi.register(payload)
      setAuth(data.user, data.access, data.refresh)
      navigate('/chat')
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } }
      const responseData = e.response?.data
      if (responseData) {
        const fe: Record<string, string> = {}
        for (const [key, value] of Object.entries(responseData)) {
          fe[key] = Array.isArray(value) ? value[0] : String(value)
        }
        if (Object.keys(fe).length > 0) {
          setFieldErrors(fe)
          return
        }
      }
      setErrorMessage('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (token: string) => {
    setErrorMessage('')
    setLoading(true)
    try {
      const data = await authApi.googleLogin(token)
      setAuth(data.user, data.access, data.refresh)
      navigate('/chat')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setErrorMessage(e.response?.data?.error || 'Google Sign-In failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SignUpPage
      heroImageSrc="https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=2160&q=80"
      testimonials={testimonials}
      errorMessage={errorMessage}
      fieldErrors={fieldErrors}
      loading={loading}
      onSignUp={handleSignUp}
      onSignIn={() => navigate('/login')}
      onGoogleSuccess={handleGoogleSuccess}
    />
  )
}
