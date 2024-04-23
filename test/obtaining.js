const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const fs = require("fs");

// (1)
const tree = StandardMerkleTree.load(JSON.parse(fs.readFileSync("tree.json", "utf8")));

// (2)
for (const [i, v] of tree.entries()) {
  if (v[0] === '0xb3311717c37cb02f084a203a81e2b32c290c48d3') {
    // (3)
    const proof = tree.getProof(i);
    // console.log('Value:', v);
    // console.log('Proof:', proof);
  }
}