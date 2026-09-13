// Presentation of the Figma options, not an API catalogue or connection state.
export const integrationGroups = [
  {
    title: 'Accounting software',
    description: 'Explore accounting exports and connections for your finance team.',
    options: [
      { id: 'sage', name: 'Sage', description: 'A direct connection to Sage is not available yet.' },
      { id: 'ebp', name: 'EBP', description: 'A direct connection to EBP is not available yet.' },
      { id: 'pennylane', name: 'Pennylane', description: 'A direct connection to Pennylane is not available yet.' },
      { id: 'accounting-exports', name: 'Generic FEC / CSV', description: 'Use the export center to review and download accounting exports. No external connection is required.' },
    ],
  },
  {
    title: 'Invoice channels',
    description: 'Explore how supplier documents can enter Docomptia.',
    options: [
      { id: 'dedicated-email', name: 'Dedicated email', description: 'Automatic invoice reception through a dedicated email address is not available yet.' },
      { id: 'platform-provider', name: 'Platform provider / PA', description: 'A connection to a platform provider is not available yet.' },
    ],
  },
  {
    title: 'Developer',
    description: 'Explore connections for internal tools and business workflows.',
    options: [
      { id: 'api', name: 'API', description: 'Creating and managing access for external applications is not available yet.' },
      { id: 'webhooks', name: 'Webhooks', description: 'Configuring event delivery to external applications is not available yet.' },
    ],
  },
]

export const integrationOptions = integrationGroups.flatMap(({ options }) => options)
