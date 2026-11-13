import { generateCandidates } from '../src/services/transliteration/engine.ts'
import { SEED_LEXICON } from '../src/services/transliteration/lexicon.ts'

const tests: Array<[string, string]> = [
  ['namaskara', 'ನಮಸ್ಕಾರ'],
  ['raamanu', 'ರಾಮನು'],
  ['kaadige', 'ಕಾಡಿಗೆ'],
  ['odidanu', 'ಓಡಿದanu'],
  ['nanna', 'ನನ್ನ'],
  ['hesaru', 'ಹೆಸರು'],
  ['yashavanth', 'ಯಶವಂತ್'],
  ['nimmannu', 'ನಿಮ್ಮನ್ನು'],
  ['swagatisuttene', 'ಸ್ವಾಗತಿಸುತ್ತೇನೆ'],
  ['bharata', 'ಭಾರತ'],
  ['desha', 'ದೇಶ'],
  ['shubhodaya', 'ಶುಭೋದಯ'],
  ['dhanyavadagalu', 'ಧನ್ಯವಾದಗಳು'],
  ['nimma', 'ನಿಮ್ಮ'],
  ['hesarenu', 'ಹೆಸರೇನು'],
  ['kannada', 'ಕನ್ನಡ'],
  ['bhashe', 'ಭಾಷೆ'],
  ['karnataka', 'ಕರ್ನಾಟಕ'],
  ['shivaprasad', 'ಶಿವಪ್ರಸಾದ್'],
  ['medehalli', 'ಮೆದೇಹಳ್ಳಿ'],
  ['samvidhana', 'ಸಂವಿಧಾನ'],
  ['hrutpurvakavagi', 'ಹೃ್ತ್ಪೂರ್ವಕವಾಗಿ'],
  // New test cases for word-level accuracy
  ['raayanahalli', ''],
  ['halli', ''],
  ['kalla', ''],
  ['kaLLu', ''],
  ['la', ''],
  ['lla', ''],
  ['LLa', ''],
]

let failures = 0
for (const [input, expected] of tests) {
  const got = generateCandidates(input, { lexicon: SEED_LEXICON as Map<string, string> })
  const first = got[0]?.text
  // Check if output contains Kannada retroflex
  const hasRetroflex = /[\u0C82\u0C87\u0C89\u0C8A\u0C8E\u0C90]/.test(first || '')
  console.log(`${input.padEnd(15)} => ${(first || '').padEnd(20)} retroflex=${hasRetroflex} candidates=${got.length}`)
  if (first !== expected && expected !== '') {
    failures++
    console.log(`  EXPECTED (partial): ${expected} - got: ${first}`)
  }
}

const sentence = 'raamanu kaadige odidanu'
console.log(
  '\nsentence:',
  sentence
    .split(' ')
    .map((w) => generateCandidates(w, { lexicon: SEED_LEXICON as Map<string, string> })[0]?.text)
    .join(' '),
)

for (const word of ['kotta', 'manushya', 'vidyarthi', 'chandra', 'amma', 'sundara']) {
  console.log(word, '=>', generateCandidates(word, { limit: 4 }).map((c) => c.text).join(' | '))
}

console.log(`\n${tests.length} test inputs checked`)

// Check specific expected behaviors
console.log('\n--- Specific checks ---')
const checks = [
  { input: 'la', expectedCount: 2, hasLinear: false, hasRetroflex: false },
  { input: 'lla', expectedCount: 2, hasLinear: false, hasRetroflex: false },
  { input: 'LLa', expectedCount: 1, hasLinear: false, hasRetroflex: false },
  { input: 'raayanahalli', hasRetroflex: false },
  { input: 'halli', hasRetroflex: false },
]

for (const c of checks) {
  const candidates = generateCandidates(c.input, { lexicon: SEED_LEXICON as Map<string, string> })
  const firstText = candidates[0]?.text || ''
  const hasLinear = /[\u0C80\u0C81\u0C82\u0C83\u0C84\u0C85\u0C86\u0C87\u0C88\u0C89\u0C8A\u0C8B\u0C8C\u0C8D\u0C8E\u0C8F]/.test(firstText) && !/[\u0C82\u0C87\u0C89\u0C8A\u0C8E\u0C90]/.test(firstText)
  const hasRetroflex = /[\u0C82\u0C87\u0C89\u0C8A\u0C8E\u0C90]/.test(firstText)
  console.log(`${c.input}: first=${firstText.substring(0,10)} linear=${hasLinear} retroflex=${hasRetroflex} total=${candidates.length}`)
}