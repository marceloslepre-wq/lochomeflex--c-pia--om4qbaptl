import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Download, Eye, Play } from 'lucide-react'
import type { PreviewResult, CollectionMigrationResult } from '@/services/migration'

interface Props {
  label: string
  icon: ReactNode
  dependsOn: string[]
  preview?: PreviewResult
  result?: CollectionMigrationResult
  isMigrating: boolean
  progress: { current: number; total: number }
  loadingPreview: boolean
  onPreview: () => void
  onMigrate: () => void
  onDownloadErrors: () => void
}

export function MigrationCollectionCard({
  label,
  icon,
  dependsOn,
  preview,
  result,
  isMigrating,
  progress,
  loadingPreview,
  onPreview,
  onMigrate,
  onDownloadErrors,
}: Props) {
  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{label}</span>
                {dependsOn.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Requer: {dependsOn.join(', ')}
                  </span>
                )}
                {result && (
                  <Badge
                    variant={result.errors > 0 ? 'destructive' : 'default'}
                    className="text-xs"
                  >
                    {result.success} ok · {result.skipped} pulados · {result.errors} erros
                  </Badge>
                )}
              </div>
              {preview && !result && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {preview.totalRecords} registros · {preview.newRecords} novos ·{' '}
                  {preview.duplicates} duplicados
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {result && result.errors > 0 && (
              <Button size="sm" variant="outline" onClick={onDownloadErrors}>
                <Download className="w-4 h-4 mr-1" /> Erros
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={isMigrating || loadingPreview}
              onClick={onPreview}
            >
              {loadingPreview ? (
                '...'
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
                </>
              )}
            </Button>
            <Button size="sm" disabled={isMigrating || !preview} onClick={onMigrate}>
              <Play className="w-4 h-4 mr-1" /> Migrar
            </Button>
          </div>
        </div>
        {isMigrating && (
          <div className="mt-3">
            <Progress value={pct} />
            <p className="text-xs text-center mt-1 text-muted-foreground">
              {progress.current} / {progress.total}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
