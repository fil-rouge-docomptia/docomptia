export const inboxViews = [
  {
    label: 'All',
    statuses: ['DEPOSEE', 'OCR_EN_COURS', 'EXTRAITE', 'ERREUR_OCR', 'ERREUR_TRAITEMENT'],
    value: 'all',
  },
  { label: 'New', statuses: ['DEPOSEE'], value: 'new' },
  { label: 'Processing', statuses: ['OCR_EN_COURS'], value: 'processing' },
  { label: 'Needs review', statuses: ['EXTRAITE'], value: 'needs-review' },
  {
    label: 'Processing failed',
    statuses: ['ERREUR_OCR', 'ERREUR_TRAITEMENT'],
    value: 'processing-failed',
  },
] as const

export type InboxView = typeof inboxViews[number]['value']

export function parseInboxView(value: string | null): InboxView {
  return inboxViews.some((view) => view.value === value) ? value as InboxView : 'all'
}

export function getInboxStatuses(view: InboxView) {
  return [...(inboxViews.find((option) => option.value === view)?.statuses ?? inboxViews[0].statuses)]
}
