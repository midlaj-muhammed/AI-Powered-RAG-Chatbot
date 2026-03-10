import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { authApi } from '@/api/auth'
import { SignInPage, type Testimonial } from '@/components/ui/sign-in'
import { useState } from 'react'

const testimonials: Testimonial[] = [
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg',
    name: 'Sarah Chen',
    handle: '@sarahdigital',
    text: 'NexusAI transformed how our team handles knowledge retrieval. The RAG pipeline is incredibly fast and accurate.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg',
    name: 'Marcus Johnson',
    handle: '@marcustech',
    text: 'We deployed it over 10,000 internal documents in an afternoon. The semantic search quality is outstanding.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/32.jpg',
    name: 'David Martinez',
    handle: '@davidcreates',
    text: 'Finally, an AI assistant that only answers from our actual data — no hallucinations, just reliable answers.',
  },
]

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (email: string, password: string) => {
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.user, data.access, data.refresh)
      navigate('/chat')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SignInPage
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      testimonials={testimonials}
      errorMessage={error}
      loading={loading}
      onSignIn={handleSignIn}
      onCreateAccount={() => navigate('/register')}
    />
  )
}
