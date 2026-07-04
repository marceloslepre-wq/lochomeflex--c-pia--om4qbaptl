import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const [searchParams] = useSearchParams()

  useEffect(() => {
    // No Supabase subscription needed — PocketBase password reset
    // is handled via token from the email link query params.
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      return toast({
        title: 'Erro de Validação',
        description: 'As senhas não coincidem.',
        variant: 'destructive',
      })
    }

    if (password.length < 8) {
      return toast({
        title: 'Erro de Validação',
        description: 'A senha deve ter no mínimo 8 caracteres.',
        variant: 'destructive',
      })
    }

    setIsSubmitting(true)

    try {
      const token = searchParams.get('token')
      if (!token) {
        toast({
          title: 'Erro',
          description: 'Link inválido. Solicite um novo link de recuperação.',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      await pb.collection('users').confirmPasswordReset(token, password, confirmPassword)
      toast({
        title: 'Senha atualizada',
        description: 'Senha atualizada com sucesso. Faça login com sua nova senha.',
      })
      navigate('/')
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Link expirado ou inválido. Solicite um novo link de recuperação.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-2 text-center pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Nova Senha</CardTitle>
          <CardDescription>Crie uma nova senha para o seu acesso</CardDescription>
        </CardHeader>
        <form onSubmit={handleReset}>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="confirmPassword">Confirme a Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4 pt-2">
            <Button type="submit" className="w-full text-base h-11" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              Atualizar Senha
            </Button>
            <Link to="/" className="text-sm text-primary hover:underline flex items-center mt-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para o login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
