import { Navigate, createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/RouteGuard'
import { AppShell } from '@/components/layout/AppShell'
import AccountingOnboardingPage from '@/pages/AccountingOnboardingPage'
import DashboardPage from '@/pages/DashboardPage'
import InvoiceUploadPage from '@/pages/InvoiceUploadPage'
import EmailVerificationPage from '@/pages/EmailVerificationPage'
import LoginRoutePage from '@/pages/LoginRoutePage'
import ModulePlaceholderPage from '@/pages/ModulePlaceholderPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OrganizationOnboardingPage from '@/pages/OrganizationOnboardingPage'
import RegisterPage from '@/pages/RegisterPage'
import WorkflowOnboardingPage from '@/pages/WorkflowOnboardingPage'

export const publicRoutes = [
  {
    path: '/login',
    element: <LoginRoutePage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/verify-email',
    element: <EmailVerificationPage />,
  },
]

export const privateRoutes = [
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    path: '/inbox',
    element: <InvoiceUploadPage />,
  },
  {
    path: '/invoices',
    element: (
      <ModulePlaceholderPage
        description="Review, validate and prepare supplier invoices for accounting."
        title="Invoices"
      />
    ),
  },
  {
    path: '/invoices/upload',
    element: <InvoiceUploadPage />,
  },
  {
    path: '/approvals',
    element: (
      <ModulePlaceholderPage
        description="Review invoices waiting for an accounting decision."
        title="Approvals"
      />
    ),
  },
  {
    path: '/accounting',
    element: (
      <ModulePlaceholderPage
        description="Manage entries and accounting configuration."
        title="Accounting"
      />
    ),
  },
  {
    path: '/exports',
    element: (
      <ModulePlaceholderPage
        description="Prepare and retrieve accounting exports."
        title="Exports"
      />
    ),
  },
  {
    path: '/documents',
    element: (
      <ModulePlaceholderPage
        description="Find the documents attached to your organization."
        title="Documents"
      />
    ),
  },
  {
    path: '/suppliers',
    element: (
      <ModulePlaceholderPage
        description="Manage the suppliers available to invoice workflows."
        title="Suppliers"
      />
    ),
  },
  {
    path: '/clients',
    element: (
      <ModulePlaceholderPage
        description="Manage client records for the current organization."
        title="Clients"
      />
    ),
  },
  {
    path: '/projects',
    element: (
      <ModulePlaceholderPage
        description="Organize invoices across projects and operating sites."
        title="Projects / Sites"
      />
    ),
  },
  {
    path: '/reports',
    element: (
      <ModulePlaceholderPage
        description="Analyze invoice processing and accounting activity."
        title="Reports"
      />
    ),
  },
  {
    path: '/integrations',
    element: (
      <ModulePlaceholderPage
        description="Connect Docomptia to the tools used by your organization."
        title="Integrations"
      />
    ),
  },
  {
    path: '/settings',
    element: (
      <ModulePlaceholderPage
        description="Configure your organization and workspace."
        title="Settings"
      />
    ),
  },
]

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: publicRoutes,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/onboarding/company',
        element: <OrganizationOnboardingPage />,
      },
      {
        path: '/onboarding/accounting',
        element: <AccountingOnboardingPage />,
      },
      {
        path: '/onboarding/workflow',
        element: <WorkflowOnboardingPage />,
      },
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate replace to="/dashboard" />,
          },
          ...privateRoutes,
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
