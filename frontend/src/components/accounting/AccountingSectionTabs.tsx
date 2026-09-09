import { useNavigate } from 'react-router-dom'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AccountingSectionTabs({ value }: { value: 'entries' | 'rules' | 'accounts' }) {
  const navigate = useNavigate()

  return (
    <Tabs onValueChange={(section) => navigate(section === 'entries' ? '/accounting' : `/accounting/${section}`)} value={value}>
      <TabsList aria-label="Accounting sections" className="h-11 max-w-full sm:h-10">
        <TabsTrigger value="entries">Entries</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
        <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
