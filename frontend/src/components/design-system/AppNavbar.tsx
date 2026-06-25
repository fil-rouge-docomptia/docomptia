import type { ComponentType, SVGProps } from 'react'
import { Bell, CircleHelp } from 'lucide-react'

export function AppNavbar() {
  return (
    <header className="sticky top-0 z-10 h-16 border-b border-[#c1c7cc] bg-white">
      <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-8">
          <div>
            <p className="font-['Hanken_Grotesk',_Inter,sans-serif] text-[32px] font-bold leading-none tracking-[-0.01em] text-[#001d29]">
              L&apos;Excellence Financière
            </p>
          </div>

          <nav className="hidden h-full items-center gap-7 md:flex">
            <NavItem active label="Dashboard" />
            <NavItem label="Invoices" />
            <NavItem label="Payments" />
            <NavItem label="Vendors" />
            <NavItem label="Settings" />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <IconButton icon={Bell} label="Notifications" />
          <IconButton icon={CircleHelp} label="Aide" />
          <div className="flex size-10 items-center justify-center rounded-full border border-[#c1c7cc] bg-[linear-gradient(135deg,#dce9ff,#ffffff)] text-sm font-semibold text-[#001d29]">
            MN
          </div>
        </div>
      </div>
    </header>
  )
}

type NavItemProps = {
  active?: boolean
  label: string
}

function NavItem({ active = false, label }: NavItemProps) {
  return (
    <div
      className={
        active
          ? 'flex h-full items-center border-b-2 border-[#fd6b36] pt-1 text-[16px] font-semibold text-[#fd6b36]'
          : 'flex h-full items-center pt-1 text-[16px] font-normal text-[#41484c]'
      }
    >
      <span>{label}</span>
    </div>
  )
}

type IconButtonProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
}

function IconButton({ icon: Icon, label }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full text-[#41484c] transition-colors hover:bg-[#eff4ff] hover:text-[#001d29]"
      type="button"
    >
      <Icon className="size-4" />
    </button>
  )
}
