import { useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'

function SecurityRow({ title, description, children }: { title: string, description: string, children: ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 space-y-1"><h4 className="text-sm font-medium">{title}</h4><p className="text-xs text-muted-foreground">{description}</p></div>
    <div className="flex shrink-0 items-center gap-2 [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:flex-none">{children}</div>
  </div>
}

export default function SecuritySettingsPage() {
  const { user, signOut } = useAuth()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  return <SettingsLayout description="Manage authentication, sessions, and protection for your account." section="security">
    <section aria-labelledby="security-authentication" className="space-y-3">
      <h3 className="text-lg font-semibold" id="security-authentication">Authentication</h3>
      <p className="text-xs text-muted-foreground">Manage how you sign in and verify your identity.</p>
      <SecurityRow description="Password changes are not available yet." title="Password"><Button aria-describedby="security-unavailable" disabled variant="outline">Change password</Button></SecurityRow>
      <SecurityRow description="Two-factor authentication cannot be configured yet." title="Two-factor authentication"><Badge variant="secondary">Unavailable</Badge><Button aria-describedby="security-unavailable" disabled variant="outline">Set up 2FA</Button></SecurityRow>
      <Alert className="border-0 bg-info-muted" role="note"><Info aria-hidden="true" /><AlertTitle className="text-xs">Security settings unavailable</AlertTitle><AlertDescription className="text-xs" id="security-unavailable">Password changes, two-factor setup and remote session management are not available yet. No password-change date or two-factor status is available to display.</AlertDescription></Alert>
    </section>
    <section aria-labelledby="security-sessions" className="space-y-3">
      <h3 className="text-lg font-semibold" id="security-sessions">Sessions</h3>
      <p className="text-xs text-muted-foreground">Manage your access from this browser.</p>
      <SecurityRow description="You are signed in here. Signing out clears your connection in this browser." title="This browser">
        <Badge variant="secondary">Current</Badge>
        <Dialog onOpenChange={setConfirmSignOut} open={confirmSignOut}>
          <DialogTrigger asChild><Button variant="outline">Sign out here</Button></DialogTrigger>
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-[480px] [&>button]:right-2 [&>button]:top-2 [&>button]:size-11" onInteractOutside={(event) => event.preventDefault()} onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }} role="alertdialog">
            <DialogHeader className="text-left"><DialogTitle className="pr-8 text-xl">Sign out of this browser?</DialogTitle><DialogDescription>This clears your local connection to Docomptia. It does not sign out other devices or revoke access on the server. You will need to sign in again here.</DialogDescription></DialogHeader>
            <DialogFooter className="gap-2 sm:space-x-0"><DialogClose asChild><Button className="h-11" ref={cancel} variant="outline">Cancel</Button></DialogClose><Button className="h-11" onClick={signOut} variant="destructive">Sign out of this browser</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </SecurityRow>
      <SecurityRow description="The list of other devices and their activity is not available." title="Other sessions"><Badge variant="secondary">Unavailable</Badge></SecurityRow>
    </section>
    <section aria-labelledby="security-session-protection" className="space-y-3">
      <h3 className="text-lg font-semibold" id="security-session-protection">Session security</h3>
      <p className="text-xs text-muted-foreground">Control access from devices you no longer use.</p>
      <SecurityRow description="Signing out other devices is not available yet." title="Sign out other sessions"><Button aria-describedby="security-unavailable" disabled variant="destructive">Sign out others</Button></SecurityRow>
    </section>
    <section aria-labelledby="security-data" className="space-y-3">
      <h3 className="text-lg font-semibold" id="security-data">Data protection</h3>
      <Alert className="border-0 bg-info-muted" role="note"><AlertTitle className="text-xs">Document and data protection</AlertTitle><AlertDescription className="text-xs">Access to organization data is checked by Docomptia. The audit view excludes passwords, tokens and invoice contents.</AlertDescription></Alert>
      {user?.role.code === 'ADMIN' && <Button asChild variant="outline"><Link to="/settings/audit-logs">View audit logs</Link></Button>}
    </section>
  </SettingsLayout>
}
