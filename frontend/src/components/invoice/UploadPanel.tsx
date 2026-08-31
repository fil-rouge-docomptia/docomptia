import type { ChangeEvent, FormEvent } from 'react'
import { ArrowRight, CloudUpload, FileText, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/design-system/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/design-system/Card'
import { Input } from '@/components/design-system/Input'
import { Label } from '@/components/design-system/Label'

type UploadPanelProps = {
  errorMessage: string
  isSubmitting: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  selectedFile: File | null
  supplierId: string
  onSupplierIdChange: (value: string) => void
}

export function UploadPanel({
  errorMessage,
  isSubmitting,
  onFileChange,
  onSubmit,
  selectedFile,
  supplierId,
  onSupplierIdChange,
}: UploadPanelProps) {
  const showSupplierField = false

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="font-['Hanken_Grotesk',_Inter,sans-serif] text-[24px] font-semibold leading-8 text-[#001d29]">
            Importer une facture
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {showSupplierField ? (
              <div className="space-y-2">
                <Label
                  className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#41484c]"
                  htmlFor="supplierId"
                >
                  ID Fournisseur
                </Label>
                <Input
                  id="supplierId"
                  name="supplierId"
                  placeholder="ex: FR-908234"
                  type="text"
                  value={supplierId}
                  onChange={(event) => onSupplierIdChange(event.target.value)}
                />
              </div>
            ) : null}

            <label
              className="block cursor-pointer rounded-xl border-2 border-dashed border-[#c1c7cc] bg-[#f8f9ff] p-12 transition-colors hover:border-[#083344] hover:bg-[#eff4ff]"
              htmlFor="invoiceFile"
            >
              <div className="flex flex-col items-center text-center">
                <CloudUpload className="mb-4 size-10 text-[#001d29]" strokeWidth={1.8} />
                <p className="font-['Inter',sans-serif] text-[18px] font-semibold text-[#001d29]">
                  Choisir un fichier
                </p>
                <p className="mt-2 text-[14px] text-[#41484c]">Taille max : 10 Mo</p>
              </div>

              <input
                accept=".pdf,.png,.jpg,.jpeg"
                className="sr-only"
                id="invoiceFile"
                name="file"
                type="file"
                onChange={onFileChange}
              />
            </label>

            {selectedFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#c1c7cc] bg-white px-4 py-3 text-sm text-[#41484c]">
                <FileText className="size-4 text-[#3f6376]" />
                <span>{selectedFile.name}</span>
              </div>
            ) : null}

            <Button
              className="w-full gap-3 rounded-xl bg-[#083344] py-4 shadow-none hover:bg-[#001d29]"
              disabled={isSubmitting}
              size="lg"
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <span>Envoyer pour analyse</span>
                  <ArrowRight className="size-5" />
                </>
              )}
            </Button>

            {errorMessage ? (
              <div className="rounded-lg border border-[#ffdad6] bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">
                {errorMessage}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="relative h-64 overflow-hidden rounded-xl border border-[#c1c7cc] bg-[#06202c] shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(145deg,#082b3a_0px,#082b3a_10px,#6f94a7_22px,#0e3142_36px,#d6e7ef_48px,#0d2836_62px)] opacity-95" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,29,41,0.56)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-sm italic text-white">
            "L&apos;automatisation au service de la précision financière."
          </p>
        </div>
      </div>
    </section>
  )
}
