import { PageHeader } from '@/components/layout/PageHeader'

type ModulePlaceholderPageProps = {
  description: string
  title: string
}

export default function ModulePlaceholderPage({
  description,
  title,
}: ModulePlaceholderPageProps) {
  return <PageHeader description={description} title={title} />
}
