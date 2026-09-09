import { Info } from 'lucide-react'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const sections = [
  {
    title: 'Invoice processing', description: 'Notifications about OCR, review and duplicate detection.',
    events: [
      ['OCR processing failed', 'When OCR cannot extract invoice data.'],
      ['Invoice needs review', 'When an invoice requires manual verification.'],
      ['Duplicate detected', 'When a possible duplicate invoice is found.'],
    ],
  },
  {
    title: 'Approvals', description: 'Notifications for approval requests, deadlines and decisions.',
    events: [
      ['Approval requested', 'When an invoice is assigned to you for approval.'],
      ['Approval overdue', 'When an approval passes its due date.'],
      ['Invoice approved/rejected', 'When an approval decision is recorded.'],
    ],
  },
  {
    title: 'Accounting & exports', description: 'Notifications about accounting validation and export processing.',
    events: [
      ['Accounting issue', 'When an entry is unbalanced or incomplete.'],
      ['Export completed', 'When an accounting export is ready to download.'],
      ['Export failed', 'When an export cannot be generated.'],
    ],
  },
] as const

export default function NotificationSettingsPage() {
  return (
    <SettingsLayout description="Choose how and where Docomptia sends operational alerts." section="notifications">
      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Notification preferences unavailable</AlertTitle>
        <AlertDescription id="notification-preferences-unavailable">Delivery preferences cannot be configured yet. The options below do not indicate your current delivery settings. You can still read your alerts using Notifications in the navigation.</AlertDescription>
      </Alert>
      {sections.map(({ title, description, events }, index) => (
        <section aria-labelledby={`notification-section-${index}`} className="space-y-4" key={title}>
          <div className="space-y-1"><h3 className="text-xl font-semibold tracking-[-0.25px]" id={`notification-section-${index}`}>{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>
          <ul className="divide-y">
            {events.map(([name, description]) => (
              <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6" key={name}>
                <div className="min-w-0 space-y-1"><h4 className="text-sm font-medium">{name}</h4><p className="text-xs text-muted-foreground">{description}</p></div>
                <div className="flex shrink-0 justify-between gap-4">
                  {['In-app', 'Email'].map((channel) => <div className="space-y-1" key={channel}>
                    <p className="text-xs">{channel}</p>
                    <Button aria-describedby="notification-preferences-unavailable" aria-label={`${name}: ${channel} preference unavailable`} className="h-11 text-xs disabled:opacity-70" disabled type="button" variant="outline">Unavailable</Button>
                  </div>)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </SettingsLayout>
  )
}
