import { useNavigate } from 'react-router-dom'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AccountingSectionTabs({ value }: { value: 'entries' | 'rules' }) {
  const navigate = useNavigate()

  return (
    <Tabs onValueChange={(section) => navigate(section === 'rules' ? '/accounting/rules' : '/accounting')} value={value}>
      <TabsList aria-label="Accounting sections" className="h-11 max-w-full sm:h-10">
        <TabsTrigger value="entries">Entries</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
        <TabsTrigger disabled value="accounts">Chart of accounts</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
