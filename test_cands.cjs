const {generateCandidates} = require("./src/services/transliteration/engine.js");
const inputs = ["la","La","sha","Sha","na","Na","ta","Ta","da","Da"];
inputs.forEach(i => {
  const c = generateCandidates(i);
  console.log(i + ":", c.map(x => x.text).join(", "));
});