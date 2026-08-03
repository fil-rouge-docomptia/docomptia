import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

async function question(message) {
  const terminal = createInterface({ input, output })
  try {
    return (await terminal.question(message)).trim()
  } finally {
    terminal.close()
  }
}

export async function selectItem(message, items, label) {
  if (items.length === 0) {
    throw new Error(`No item available for: ${message}`)
  }

  console.log(`\n${message}\n`)
  items.forEach((item, index) => {
    console.log(`${index + 1}. ${label(item)}`)
  })

  while (true) {
    const answer = await question('\nChoice: ')
    const index = Number.parseInt(answer, 10) - 1
    if (Number.isInteger(index) && index >= 0 && index < items.length) {
      return items[index]
    }
    console.log(`Enter a number between 1 and ${items.length}.`)
  }
}

export async function confirm(message, defaultValue = false) {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]'
  const answer = (await question(`${message} ${suffix} `)).toLowerCase()

  if (!answer) {
    return defaultValue
  }
  return answer === 'y' || answer === 'yes' || answer === 'o' || answer === 'oui'
}

export function printSection(title, content) {
  console.log(`\n=== ${title} ===`)
  if (content) {
    console.log(content)
  }
}
