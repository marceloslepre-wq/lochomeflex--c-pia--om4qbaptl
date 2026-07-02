import { useState, ReactNode } from 'react'
import { usePbAuth } from '@/hooks/use-pb-auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Lock } from 'lucide-react'

export function PbAuthGate({ children }: { children: ReactNode }) {
  const { isPbAuthenticated, pbSignIn, pbLoading } = usePbAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (pbLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isPbAuthenticated) return <>{children}</>

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await pbSignIn(email, password)
    if (error) setError('Credenciais inválidas. Verifique email e senha.')
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Login Skip Cloud</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Autentique-se para acessar os dados da nuvem
          </p>
        </div>
        <form onSubmit={handleLogin} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
