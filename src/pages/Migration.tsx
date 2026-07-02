import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Users, Package, FileText, FileSignature, Receipt, Database, ShieldAlert } from 'lucide-react'
import {
  MIGRATION_COLLECTIONS,
  previewCollection,
  type MigrationConfig,
  type PreviewResult,
  type CollectionMigrationResult,
} from '@/services/migration'
import { executeMigration } from '@/services/migration-executors'
import { MigrationCollectionCard } from '@/components/migration/MigrationCollectionCard'
import { downloadCSV } from '@/lib/export'
import { useToast } from '@/hooks/use-toast'

const ICONS: Record<string, any> = { Users, Package, FileText, FileSignature, Receipt }

export default function Migration() {
  const { can } = usePermissions()
  const { toast } = useToast()
  const [config, setConfig] = useState<MigrationConfig>({
    url: import.meta.env.VITE_SUPABASE_URL || '',
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  })
  const [previews, setPreviews] = useState<Record<string, PreviewResult>>({})
  const [results, setResults] = useState<Record<string, CollectionMigrationResult>>({})
  const [migrating, setMigrating] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [confirmCol, setConfirmCol] = useState<string | null>(null)
  const [loadingPrev, setLoadingPrev] = useState<string | null>(null)

  if (!can('users:manage')) return <Navigate to="/dashboard" replace />

  const handlePreview = async (col: string) => {
    setLoadingPrev(col)
    try {
      const preview = await previewCollection(config, col as any)
      setPreviews((p) => ({ ...p, [col]: preview }))
      toast({ title: 'Pré-visualização', description: `${preview.newRecords} novos, ${preview.duplicates} duplicados.` })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally { setLoadingPrev(null) }
  }

  const handleMigrate = async (col: string) => {
    setConfirmCol(null)
    setMigrating(col)
    setProgress({ current: 0, total: 0 })
    try {
      const result = await executeMigration(config, col, (c, t) => setProgress({ current: c, total: t }))
      setResults((r) => ({ ...r, [col]: result }))
      toast({ title: 'Migração concluída', description: `${result.success} ok, ${result.skipped} pulados, ${result.errors} erros.` })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally { setMigrating(null) }
  }

  const downloadErrors = (col: string) => {
    const result = results[col]
    if (!result?.errorLog.length) return
    downloadCSV(`erros-${col}`, ['Índice', 'Erro', 'ID'], result.errorLog.map((e) => [e.index, e.error, e.record?.id || '']))
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Migração de Dados</h1>
        <p className="text-muted-foreground mt-1">Transfira dados do Supabase para o Skip Cloud com segurança.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Conexão com Banco Legado</CardTitle>
          <CardDescription>Configure as credenciais do Supabase para buscar os dados de origem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Supabase URL</Label>
              <Input value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} placeholder="https://xxx.supabase.co" />
            </div>
            <div className="space-y-2">
              <Label>Supabase Public Key</Label>
              <Input type="password" value={config.key} onChange={(e) => setConfig({ ...config, key: e.target.value })} placeholder="eyJ..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">Apenas operações de leitura são realizadas no banco de origem.</span>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {MIGRATION_COLLECTIONS.map((col) => (
          <MigrationCollectionCard
            key={col.id}
            label={col.label}
            icon={<ICONS[col.icon] className="w-5 h-5 text-primary" />}
            dependsOn={col.dependsOn}
            preview={previews[col.id]}
            result={results[col.id]}
            isMigrating={migrating === col.id}
            progress={migrating === col.id ? progress : { current: 0, total: 0 }}
            loadingPreview={loadingPrev === col.id}
            onPreview={() => handlePreview(col.id)}
            onMigrate={() => setConfirmCol(col.id)}
            onDownloadErrors={() => downloadErrors(col.id)}
          />
        ))}
      </div>
      <Dialog open={!!confirmCol} onOpenChange={(o) => !o && setConfirmCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Migração</DialogTitle></DialogHeader>
          {confirmCol && previews[confirmCol] && (
            <div className="space-y-2 py-2">
              <p>Pronto para importar <strong>{previews[confirmCol].newRecords}</strong> registros de <strong>{confirmCol}</strong>.</p>
              {previews[confirmCol].duplicates > 0 && <p className="text-amber-600">{previews[confirmCol].duplicates} duplicados serão pulados.</p>}
              {previews[confirmCol].invalid > 0 && <p className="text-red-600">{previews[confirmCol].invalid} registros com avisos de validação.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCol(null)}>Cancelar</Button>
            <Button onClick={() => confirmCol && handleMigrate(confirmCol)}>Confirmar Migração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
