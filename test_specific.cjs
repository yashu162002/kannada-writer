const {generateCandidates} = require('./src/services/transliteration/engine.js');
const tests = ['raayanahalli','lla','LLa','halli','kalla','kaLLu','la'];
tests.forEach(i => {
  const c = generateCandidates(i);
  console.log(i + ':', c.map(x => x.text).join(', '));
});