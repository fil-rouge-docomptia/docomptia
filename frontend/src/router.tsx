import { Navigate, createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/RouteGuard'
import { AppShell } from '@/components/layout/AppShell'
import AccountingPage from '@/pages/AccountingPage'
import AccountingOnboardingPage from '@/pages/AccountingOnboardingPage'
import ApprovalReviewPage from '@/pages/ApprovalReviewPage'
import ApprovalsPage from '@/pages/ApprovalsPage'
import ClientDetailsPage from '@/pages/ClientDetailsPage'
import ClientsPage from '@/pages/ClientsPage'
import DashboardPage from '@/pages/DashboardPage'
import DocumentsPage from '@/pages/DocumentsPage'
import InvoiceUploadPage from '@/pages/InvoiceUploadPage'
import InvoiceDetailsPage from '@/pages/InvoiceDetailsPage'
import InvoicesPage from '@/pages/InvoicesPage'
import EmailVerificationPage from '@/pages/EmailVerificationPage'
import LoginRoutePage from '@/pages/LoginRoutePage'
import ModulePlaceholderPage from '@/pages/ModulePlaceholderPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OrganizationOnboardingPage from '@/pages/OrganizationOnboardingPage'
import ProjectDetailsPage from '@/pages/ProjectDetailsPage'
import ProjectsPage from '@/pages/ProjectsPage'
import RegisterPage from '@/pages/RegisterPage'
import ReportsPage from '@/pages/ReportsPage'
import SupplierDetailsPage from '@/pages/SupplierDetailsPage'
import SuppliersPage from '@/pages/SuppliersPage'
import TeamOnboardingPage from '@/pages/TeamOnboardingPage'
import WorkflowOnboardingPage from '@/pages/WorkflowOnboardingPage'
import WorkspaceReadyOnboardingPage from '@/pages/WorkspaceReadyOnboardingPage'

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
    element: <InvoicesPage />,
  },
  {
    path: '/invoices/:invoiceId',
    element: <InvoiceDetailsPage />,
  },
  {
    path: '/invoices/upload',
    element: <Navigate replace to="/inbox?upload=1" />,
  },
  {
    path: '/approvals',
    element: <ApprovalsPage />,
  },
  {
    path: '/approvals/:invoiceId',
    element: <ApprovalReviewPage />,
  },
  {
    path: '/accounting',
    element: <AccountingPage />,
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
    element: <DocumentsPage />,
  },
  {
    path: '/suppliers',
    element: <SuppliersPage />,
  },
  {
    path: '/suppliers/:supplierId',
    element: <SupplierDetailsPage />,
  },
  {
    path: '/clients',
    element: <ClientsPage />,
  },
  {
    path: '/clients/:customerId',
    element: <ClientDetailsPage />,
  },
  {
    path: '/projects',
    element: <ProjectsPage />,
  },
  {
    path: '/projects/:projectId',
    element: <ProjectDetailsPage />,
  },
  {
    path: '/reports',
    element: <ReportsPage />,
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
        path: '/onboarding/team',
        element: <TeamOnboardingPage />,
      },
      {
        path: '/onboarding/ready',
        element: <WorkspaceReadyOnboardingPage />,
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
