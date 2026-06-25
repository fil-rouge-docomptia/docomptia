import { useState } from 'react'
import { CheckCircle2, Copy, Info, Sparkles } from 'lucide-react'

import { Badge } from '@/components/design-system/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/design-system/Card'
import type { InvoiceUploadResponse } from '@/types/invoice'

type ResultPanelProps = {
  uploadResponse: InvoiceUploadResponse | null
}

export function ResultPanel({ uploadResponse }: ResultPanelProps) {
  const [copyLabel, setCopyLabel] = useState('Copier')

  const rawText = uploadResponse?.ocrAnalysis.rawText ?? ''
  const confidencePercent = formatConfidencePercent(uploadResponse?.ocrAnalysis.confidenceScore)

  const handleCopy = async () => {
    if (!rawText) {
      return
    }

    try {
      await navigator.clipboard.writeText(rawText)
      setCopyLabel('Copie')
      window.setTimeout(() => setCopyLabel('Copier'), 1500)
    } catch {
      setCopyLabel('Indisponible')
      window.setTimeout(() => setCopyLabel('Copier'), 1500)
    }
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="gap-6 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="font-['Hanken_Grotesk',_Inter,sans-serif] text-[24px] font-semibold leading-8 text-[#001d29]">
                Resultat OCR
              </CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[18px] font-normal text-[#41484c]">
                  {uploadResponse?.invoiceNumber
                    ? `Facture #${uploadResponse.invoiceNumber}`
                    : 'Aucune facture analysee'}
                </span>
                {uploadResponse ? (
                  <Badge className="gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    Traité
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="w-full max-w-56">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#41484c]">
                  Indice de confiance
                </span>
                <span className="text-[18px] font-semibold text-[#003632]">{confidencePercent}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e5eeff]">
                <div
                  className="h-full rounded-full bg-[#4ea59c] transition-all"
                  style={{ width: uploadResponse ? confidencePercent : '0%' }}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pt-0">
          <section className="space-y-4">
            <div className="border-b border-[#c1c7cc] pb-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#41484c]">
                Donnees extraites
              </h3>
            </div>

            {uploadResponse ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#c1c7cc] text-[#41484c]">
                      <th className="py-4 font-semibold uppercase tracking-[0.05em]">Description</th>
                      <th className="py-4 font-semibold uppercase tracking-[0.05em]">Valeur</th>
                      <th className="py-4 text-right font-semibold uppercase tracking-[0.05em]">
                        Confiance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResponse.ocrAnalysis.fields.map((field) => (
                      <tr
                        className="border-b border-[#c1c7cc] transition-colors hover:bg-[#f8f9ff]"
                        key={field.fieldName}
                      >
                        <td className="py-5 text-[18px] font-semibold text-[#001d29]">
                          {field.fieldName}
                        </td>
                        <td
                          className={
                            field.fieldName.toLowerCase().includes('total')
                              ? 'py-5 text-[22px] font-bold text-[#001d29]'
                              : 'py-5 text-[18px] text-[#001d29]'
                          }
                        >
                          {field.normalizedValue || field.rawValue || 'Vide'}
                        </td>
                        <td className="py-5 text-right text-[18px] font-medium text-[#4ea59c]">
                          <span className="inline-flex items-center gap-1">
                            {field.confidenceScore}
                            <Sparkles className="size-4" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Le tableau des champs extraits apparaitra ici apres un upload reussi." />
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#41484c]">
                Texte OCR brut
              </h3>
              <button
                className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#001d29] transition-colors hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={!rawText}
                type="button"
                onClick={handleCopy}
              >
                <Copy className="size-3.5" />
                {copyLabel}
              </button>
            </div>

            <div className="rounded-xl border border-[#001d29]/20 bg-[#001d29] p-6 shadow-inner">
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap text-[14px] leading-8 text-[#779cb0]">
                {rawText || 'Aucun texte retourne pour le moment.'}
              </pre>
            </div>
          </section>
        </CardContent>
      </Card>

      <div className="flex items-start gap-4 rounded-xl border border-[#c1c7cc] bg-[#eff4ff] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="rounded-full text-[#001d29]">
          <Info className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#001d29]">Vérification de Conformité</p>
          <p className="text-[16px] leading-8 text-[#41484c]">
            {uploadResponse
              ? 'Toutes les mentions obligatoires ont été détectées. La facture est prête pour l exportation vers votre ERP.'
              : 'Charge une facture pour vérifier la présence des mentions obligatoires et contrôler la qualité de l OCR.'}
          </p>
        </div>
      </div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#c1c7cc] bg-[#f8f9ff] px-5 py-8 text-sm leading-6 text-[#41484c]">
      {text}
    </div>
  )
}

function formatConfidencePercent(confidenceScore?: string) {
  if (!confidenceScore) {
    return '0%'
  }

  const value = Number.parseFloat(confidenceScore)
  if (Number.isNaN(value)) {
    return confidenceScore
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`
  }

  return `${Math.round(value)}%`
}
