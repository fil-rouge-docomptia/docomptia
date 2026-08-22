export function buildIssueDescription(issue) {
  const summary = issue?.summary || 'Ticket sans resume'
  const key = issue?.key || 'KAN-XX'

  return [
    'Objectif metier',
    `- Clarifier le besoin attendu pour ${key} : ${summary}.`,
    '',
    'Ce qu il faut faire',
    '- Implementer uniquement le comportement demande par le ticket.',
    '- Garder des changements simples, lisibles et limites au besoin.',
    '',
    'Regles techniques',
    '- Respecter AGENTS.md et les patterns existants du projet.',
    '- Preserver les contrats API et la base tant que le ticket ne demande pas explicitement un changement.',
    '- Garder des commits atomiques au format KAN-XX: Message.',
    '',
    'Criteres d acceptation',
    '- Le besoin metier du ticket est couvert.',
    '- Les tests pertinents passent.',
    '- Aucun changement annexe reseau, Docker ou certificat n est inclus.',
  ].join('\n')
}
