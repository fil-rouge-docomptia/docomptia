import type { ClassificationType } from '@/types/classification'

export const classificationTypes: { value: ClassificationType, label: string }[] = [
  { value: 'DOSSIER', label: 'Folder' },
  { value: 'CLASSEUR', label: 'Binder' },
  { value: 'CHANTIER', label: 'Project / site' },
]

export function classificationTypeLabel(type: string) {
  return classificationTypes.find(({ value }) => value === type)?.label ?? type
}

export function parseClassificationType(type: string | null) {
  return classificationTypes.find(({ value }) => value === type)?.value
}
