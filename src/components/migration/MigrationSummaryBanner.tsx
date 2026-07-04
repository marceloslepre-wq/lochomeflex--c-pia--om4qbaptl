import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle, SkipForward, Database } from 'lucide-react'
import type { CollectionMigrationResult } from '@/services/migration'

interface Props {
  results: Record<string, CollectionMigrationResult>
}

export function MigrationSummaryBanner({ results }: Props) {
  const allResults = Object.values(results)
  if (allResults.length === 0) return null

  const totalProcessed = allResults.reduce((sum, r) => sum + r.total, 0)
  const totalSuccess = allResults.reduce((sum, r) => sum + r.success, 0)
  const totalSkipped = allResults.reduce((sum, r) => sum + r.skipped, 0)
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors, 0)
  const totalWarnings = allResults.reduce((sum, r) => sum + (r.warnings || 0), 0)
  const failedCollections = allResults.filter((r) => r.errors > 0)

  return (
    <Card className="border-primary/20 animate-fade-in">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Resumo da Migração
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {totalProcessed}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">Processados</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <span className="text-sm">{totalSuccess} Sucessos</span>
          </div>
          <div className="flex items-center gap-2">
            <SkipForward className="w-5 h-5 text-blue-400 shrink-0" />
            <span className="text-sm">{totalSkipped} Pulados</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-sm">{totalWarnings} Avisos</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm">{totalErrors} Falhas</span>
          </div>
        </div>
        {failedCollections.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            <p className="text-sm font-medium">Falhas por coleção:</p>
            {failedCollections.map((r) => (
              <div key={r.collection} className="flex items-center gap-2 text-sm">
                <Badge variant="destructive" className="text-xs">
                  {r.collection}
                </Badge>
                <span className="text-muted-foreground">
                  {r.errors} falha{r.errors !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
