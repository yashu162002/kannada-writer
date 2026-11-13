/**
 * Comprehensive Kannada transliteration engine tests.
 *
 * Run with: node test_engine.cjs
 * (Uses CommonJS require so it works without build step via tsx/ts-node)
 */

// We'll test the engine by importing the built output or using tsx
// For CJS compatibility, we use a simple inline test runner

const { execSync } = require('child_process');
const path = require('path');

// Build a quick test by directly evaluating the engine logic
// Since the engine is TypeScript with ES modules, we'll use a script approach

const testScript = `
import { tokenize, renderTokens, generateCandidates, transliterateWord } from './src/services/transliteration/engine.ts';
import { SEED_LEXICON } from './src/services/transliteration/lexicon.ts';

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, details) {
  if (condition) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    failures.push({ name, details });
    console.log('  ✗ ' + name + (details ? ' — ' + details : ''));
  }
}

function assertSuggestionsInclude(name, input, expected, lexicon) {
  const opts = { limit: 6, lexicon: lexicon || undefined };
  const candidates = generateCandidates(input, opts);
  const texts = candidates.map(c => c.text);
  const found = texts.includes(expected);
  assert(name, found, found ? '' : 'Expected "' + expected + '" in [' + texts.join(', ') + ']');
}

function assertFirstSuggestion(name, input, expected, lexicon) {
  const opts = { limit: 6, lexicon: lexicon || undefined };
  const candidates = generateCandidates(input, opts);
  const first = candidates[0]?.text;
  assert(name, first === expected, 'Expected "' + expected + '" but got "' + first + '"');
}

function assertSuggestionsOrder(name, input, expectedFirst, expectedSecond, lexicon) {
  const opts = { limit: 6, lexicon: lexicon || undefined };
  const candidates = generateCandidates(input, opts);
  const texts = candidates.map(c => c.text);
  const firstIdx = texts.indexOf(expectedFirst);
  const secondIdx = texts.indexOf(expectedSecond);
  const ok = firstIdx >= 0 && secondIdx >= 0 && firstIdx < secondIdx;
  assert(name, ok, 'Expected "' + expectedFirst + '" before "' + expectedSecond + '" in [' + texts.join(', ') + ']');
}

console.log('');
console.log('=== Kannada Transliteration Engine Tests ===');
console.log('');

// ── Section 1: Vowel matra fixes ──────────────────────────────────────────
console.log('── Vowel matras ──');
{
  const result = transliterateWord('kau');
  assert('au matra: kau → correct Kannada', result === 'ಕೌ', 'Got: ' + result);
}
{
  const result = transliterateWord('kou');
  assert('ou matra: kou → correct Kannada', result === 'ಕೌ', 'Got: ' + result);
}

// ── Section 2: Basic consonant tests ──────────────────────────────────────
console.log('');
console.log('── Basic consonants ──');
{
  assert('k → ಕ', transliterateWord('ka') === 'ಕ', 'Got: ' + transliterateWord('ka'));
  assert('kh → ಖ', transliterateWord('kha') === 'ಖ', 'Got: ' + transliterateWord('kha'));
  assert('g → ಗ', transliterateWord('ga') === 'ಗ', 'Got: ' + transliterateWord('ga'));
  assert('ch → ಚ', transliterateWord('cha') === 'ಚ', 'Got: ' + transliterateWord('cha'));
  assert('p → ಪ', transliterateWord('pa') === 'ಪ', 'Got: ' + transliterateWord('pa'));
  assert('b → ಬ', transliterateWord('ba') === 'ಬ', 'Got: ' + transliterateWord('ba'));
  assert('m → ಮ', transliterateWord('ma') === 'ಮ', 'Got: ' + transliterateWord('ma'));
  assert('y → ಯ', transliterateWord('ya') === 'ಯ', 'Got: ' + transliterateWord('ya'));
  assert('r → ರ', transliterateWord('ra') === 'ರ', 'Got: ' + transliterateWord('ra'));
  assert('v → ವ', transliterateWord('va') === 'ವ', 'Got: ' + transliterateWord('va'));
  assert('s → ಸ', transliterateWord('sa') === 'ಸ', 'Got: ' + transliterateWord('sa'));
  assert('h → ಹ', transliterateWord('ha') === 'ಹ', 'Got: ' + transliterateWord('ha'));
}

// ── Section 3: Ambiguous consonant suggestions ────────────────────────────
console.log('');
console.log('── Ambiguous consonant suggestions (CRITICAL) ──');

// la → ಲ, ಳ
{
  const cands = generateCandidates('la', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('la produces ಲ', texts.includes('ಲ'), 'Got: [' + texts.join(', ') + ']');
  assert('la produces ಳ', texts.includes('ಳ'), 'Got: [' + texts.join(', ') + ']');
  const laIdx = texts.indexOf('ಲ');
  const LaIdx = texts.indexOf('ಳ');
  assert('la: ಲ before ಳ', laIdx < LaIdx, 'ಲ at ' + laIdx + ', ಳ at ' + LaIdx);
}

// La → ಳ, ಲ
{
  const cands = generateCandidates('La', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('La produces ಳ', texts.includes('ಳ'), 'Got: [' + texts.join(', ') + ']');
  assert('La produces ಲ', texts.includes('ಲ'), 'Got: [' + texts.join(', ') + ']');
  const LaIdx = texts.indexOf('ಳ');
  const laIdx = texts.indexOf('ಲ');
  assert('La: ಳ before ಲ', LaIdx < laIdx, 'ಳ at ' + LaIdx + ', ಲ at ' + laIdx);
}

// sha → ಶ, ಷ
{
  const cands = generateCandidates('sha', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('sha produces ಶ', texts.includes('ಶ'), 'Got: [' + texts.join(', ') + ']');
  assert('sha produces ಷ', texts.includes('ಷ'), 'Got: [' + texts.join(', ') + ']');
}

// Sha → ಷ, ಶ
{
  const cands = generateCandidates('Sha', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('Sha produces ಷ', texts.includes('ಷ'), 'Got: [' + texts.join(', ') + ']');
  assert('Sha produces ಶ', texts.includes('ಶ'), 'Got: [' + texts.join(', ') + ']');
  const ShIdx = texts.indexOf('ಷ');
  const shIdx = texts.indexOf('ಶ');
  assert('Sha: ಷ before ಶ', ShIdx < shIdx, 'ಷ at ' + ShIdx + ', ಶ at ' + shIdx);
}

// na → ನ, ಣ
{
  const cands = generateCandidates('na', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('na produces ನ', texts.includes('ನ'), 'Got: [' + texts.join(', ') + ']');
  assert('na produces ಣ', texts.includes('ಣ'), 'Got: [' + texts.join(', ') + ']');
}

// Na → ಣ, ನ
{
  const cands = generateCandidates('Na', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('Na produces ಣ', texts.includes('ಣ'), 'Got: [' + texts.join(', ') + ']');
  assert('Na produces ನ', texts.includes('ನ'), 'Got: [' + texts.join(', ') + ']');
  const NIdx = texts.indexOf('ಣ');
  const nIdx = texts.indexOf('ನ');
  assert('Na: ಣ before ನ', NIdx < nIdx, 'ಣ at ' + NIdx + ', ನ at ' + nIdx);
}

// ta → ತ, ಟ
{
  const cands = generateCandidates('ta', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('ta produces ತ', texts.includes('ತ'), 'Got: [' + texts.join(', ') + ']');
  assert('ta produces ಟ', texts.includes('ಟ'), 'Got: [' + texts.join(', ') + ']');
}

// Ta → ಟ, ತ
{
  const cands = generateCandidates('Ta', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('Ta produces ಟ', texts.includes('ಟ'), 'Got: [' + texts.join(', ') + ']');
  assert('Ta produces ತ', texts.includes('ತ'), 'Got: [' + texts.join(', ') + ']');
  const TIdx = texts.indexOf('ಟ');
  const tIdx = texts.indexOf('ತ');
  assert('Ta: ಟ before ತ', TIdx < tIdx, 'ಟ at ' + TIdx + ', ತ at ' + tIdx);
}

// da → ದ, ಡ
{
  const cands = generateCandidates('da', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('da produces ದ', texts.includes('ದ'), 'Got: [' + texts.join(', ') + ']');
  assert('da produces ಡ', texts.includes('ಡ'), 'Got: [' + texts.join(', ') + ']');
}

// Da → ಡ, ದ
{
  const cands = generateCandidates('Da', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('Da produces ಡ', texts.includes('ಡ'), 'Got: [' + texts.join(', ') + ']');
  assert('Da produces ದ', texts.includes('ದ'), 'Got: [' + texts.join(', ') + ']');
  const DIdx = texts.indexOf('ಡ');
  const dIdx = texts.indexOf('ದ');
  assert('Da: ಡ before ದ', DIdx < dIdx, 'ಡ at ' + DIdx + ', ದ at ' + dIdx);
}

// lla → ಲ್ಲ, ಳ್ಳ
{
  const cands = generateCandidates('lla', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('lla produces ಲ್ಲ', texts.includes('ಲ್ಲ'), 'Got: [' + texts.join(', ') + ']');
  assert('lla produces ಳ್ಳ', texts.includes('ಳ್ಳ'), 'Got: [' + texts.join(', ') + ']');
}

// LLa → ಳ್ಳ, ಲ್ಲ
{
  const cands = generateCandidates('LLa', { limit: 6 });
  const texts = cands.map(c => c.text);
  assert('LLa produces ಳ್ಳ', texts.includes('ಳ್ಳ'), 'Got: [' + texts.join(', ') + ']');
  assert('LLa produces ಲ್ಲ', texts.includes('ಲ್ಲ'), 'Got: [' + texts.join(', ') + ']');
  const LLIdx = texts.indexOf('ಳ್ಳ');
  const llIdx = texts.indexOf('ಲ್ಲ');
  assert('LLa: ಳ್ಳ before ಲ್ಲ', LLIdx < llIdx, 'ಳ್ಳ at ' + LLIdx + ', ಲ್ಲ at ' + llIdx);
}

// ── Section 4: Word-level tests (CRITICAL) ────────────────────────────────
console.log('');
console.log('── Word-level tests ──');

const lex = SEED_LEXICON;

// CRITICAL TEST: raayanahalli → ರಾಯನಹಳ್ಳಿ
assertFirstSuggestion('raayanahalli → ರಾಯನಹಳ್ಳಿ (top suggestion)', 'raayanahalli', 'ರಾಯನಹಳ್ಳಿ', lex);

// halli → ಹಳ್ಳಿ
assertFirstSuggestion('halli → ಹಳ್ಳಿ', 'halli', 'ಹಳ್ಳಿ', lex);

// kalla → ಕಲ್ಲ
assertFirstSuggestion('kalla → ಕಲ್ಲ', 'kalla', 'ಕಲ್ಲ', lex);

// kallu → ಕಲ್ಲು
assertFirstSuggestion('kallu → ಕಲ್ಲು', 'kallu', 'ಕಲ್ಲು', lex);

// kannada → ಕನ್ನಡ
assertFirstSuggestion('kannada → ಕನ್ನಡ', 'kannada', 'ಕನ್ನಡ', lex);

// namaskara → ನಮಸ್ಕಾರ
assertFirstSuggestion('namaskara → ನಮಸ್ಕಾರ', 'namaskara', 'ನಮಸ್ಕಾರ', lex);

// shivaprasad → ಶಿವಪ್ರಸಾದ್
assertFirstSuggestion('shivaprasad → ಶಿವಪ್ರಸಾದ್', 'shivaprasad', 'ಶಿವಪ್ರಸಾದ್', lex);

// medehalli → ಮೆದೇಹಳ್ಳಿ
assertFirstSuggestion('medehalli → ಮೆದೇಹಳ್ಳಿ', 'medehalli', 'ಮೆದೇಹಳ್ಳಿ', lex);

// bharata → ಭಾರತ
assertFirstSuggestion('bharata → ಭಾರತ', 'bharata', 'ಭಾರತ', lex);

// shubhodaya → ಶುಭೋದಯ
assertFirstSuggestion('shubhodaya → ಶುಭೋದಯ', 'shubhodaya', 'ಶುಭೋದಯ', lex);

// dhanyavadagalu → ಧನ್ಯವಾದಗಳು
assertFirstSuggestion('dhanyavadagalu → ಧನ್ಯವಾದಗಳು', 'dhanyavadagalu', 'ಧನ್ಯವಾದಗಳು', lex);

// ── Section 5: No Devanagari output ───────────────────────────────────────
console.log('');
console.log('── Devanagari rejection ──');
{
  const cands = generateCandidates('namaskara', { limit: 6, lexicon: lex });
  const hasDevanagari = cands.some(c => /[\\u0900-\\u097F]/.test(c.text));
  assert('No Devanagari in candidates', !hasDevanagari, 'Found Devanagari in: ' + cands.map(c => c.text).join(', '));
}

// ── Section 6: Conjunct consonants ────────────────────────────────────────
console.log('');
console.log('── Conjunct consonants ──');
{
  assert('nna → ನ್ನ', transliterateWord('nna') === 'ನ್ನ', 'Got: ' + transliterateWord('nna'));
  assert('tta → ತ್ತ', transliterateWord('tta') === 'ತ್ತ', 'Got: ' + transliterateWord('tta'));
  assert('ppa → ಪ್ಪ', transliterateWord('ppa') === 'ಪ್ಪ', 'Got: ' + transliterateWord('ppa'));
  assert('kka → ಕ್ಕ', transliterateWord('kka') === 'ಕ್ಕ', 'Got: ' + transliterateWord('kka'));
}

// ── Section 7: Virama for word-final consonants ───────────────────────────
console.log('');
console.log('── Virama handling ──');
{
  assert('k (no vowel) → ಕ್', transliterateWord('k') === 'ಕ್', 'Got: ' + transliterateWord('k'));
  assert('kal → ಕಲ್', transliterateWord('kal') === 'ಕಲ್', 'Got: ' + transliterateWord('kal'));
}

// ── Section 8: Case preservation for ITRANS ───────────────────────────────
console.log('');
console.log('── ITRANS case handling ──');
{
  assert('Ta → ಟ', transliterateWord('Ta') === 'ಟ', 'Got: ' + transliterateWord('Ta'));
  assert('Da → ಡ', transliterateWord('Da') === 'ಡ', 'Got: ' + transliterateWord('Da'));
  assert('Na → ಣ', transliterateWord('Na') === 'ಣ', 'Got: ' + transliterateWord('Na'));
  assert('La → ಳ', transliterateWord('La') === 'ಳ', 'Got: ' + transliterateWord('La'));
  assert('Sha → ಷ', transliterateWord('Sha') === 'ಷ', 'Got: ' + transliterateWord('Sha'));
  assert('sha → ಶ', transliterateWord('sha') === 'ಶ', 'Got: ' + transliterateWord('sha'));
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════');
console.log('  PASSED: ' + passed + '  FAILED: ' + failed);
console.log('═══════════════════════════════════════════');

if (failures.length > 0) {
  console.log('');
  console.log('FAILURES:');
  for (const f of failures) {
    console.log('  ✗ ' + f.name + (f.details ? ': ' + f.details : ''));
  }
}

process.exit(failed > 0 ? 1 : 0);
`;

// Write the test as a temp .mts file and run it with tsx
const fs = require('fs');
const testPath = path.join(__dirname, '_test_runner.mts');
fs.writeFileSync(testPath, testScript, 'utf8');

try {
  const result = execSync('npx tsx ' + testPath, {
    cwd: __dirname,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 30000,
  });
  console.log(result);
} catch (err) {
  console.log(err.stdout || '');
  console.error(err.stderr || '');
  process.exit(1);
} finally {
  try { fs.unlinkSync(testPath); } catch {}
}
