import { useState } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Download, Eye, Play, RefreshCw } from 'lucide-react'
import type { PreviewResult, CollectionMigrationResult } from '@/services/migration'

interface Props {
  label: string
  icon: ReactNode
  dependsOn: string[]
  preview?: PreviewResult
  previewError?: string
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
  previewError,
  result,
  isMigrating,
  progress,
  loadingPreview,
  onPreview,
  onMigrate,
  onDownloadErrors,
}: Props) {
  const [errorsOpen, setErrorsOpen] = useState(false)
  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0
  const hasErrors = !!(result && (result.errors > 0 || (result.warnings || 0) > 0))

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
                    {result.warnings ? ` · ${result.warnings} avisos` : ''}
                  </Badge>
                )}
              </div>
              {previewError && !result && (
                <div className="mt-0.5 space-y-1">
                  <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={loadingPreview || isMigrating}
                    onClick={onPreview}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
                  </Button>
                </div>
              )}
              {preview && !result && !previewError && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {preview.totalRecords} registros · {preview.newRecords} novos ·{' '}
                  {preview.duplicates} duplicados
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasErrors && (
              <Button size="sm" variant="outline" onClick={onDownloadErrors}>
                <Download className="w-4 h-4 mr-1" /> CSV
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
        {hasErrors && (
          <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                Ver detalhes ({result!.errors} erros
                {result!.warnings ? `, ${result!.warnings} avisos` : ''})
                <ChevronDown
                  className={`w-4 h-4 ml-1 transition-transform ${errorsOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto rounded-md border p-2">
                {result!.warningLog?.map((entry) => (
                  <div
                    key={`w-${entry.index}`}
                    className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                        Aviso #{entry.index + 1}
                      </Badge>
                      {entry.record?.name && (
                        <span className="text-muted-foreground truncate">{entry.record.name}</span>
                      )}
                    </div>
                    <p className="text-amber-700 dark:text-amber-400 text-xs">{entry.error}</p>
                  </div>
                ))}
                {result!.errorLog.map((entry) => (
                  <div key={entry.index} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="destructive" className="text-xs">
                        #{entry.index + 1}
                      </Badge>
                      {entry.record?.name && (
                        <span className="text-muted-foreground truncate">{entry.record.name}</span>
                      )}
                    </div>
                    {entry.fieldErrors ? (
                      <ul className="space-y-1">
                        {Object.entries(entry.fieldErrors).map(([field, msg]) => (
                          <li key={field} className="text-red-600 dark:text-red-400 text-xs">
                            <strong>{field}:</strong> {msg}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-red-600 dark:text-red-400 text-xs">{entry.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
