const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const fs = require("fs");
// (1)
const values = [
  ["0xb3311717c37cb02f084a203a81e2b32c290c48d3", "15"],
  ["0x3756e5aeC78c0121c566d0C872c3ec0b6D2f8D89", "21"],
  ["0x3af9509C47eb3828d2A1210Bb94A9f1dE11aA7AE", "20"],
  ["0x5db67714C7ea5E16EF3B530E129668Cd1B58844C", "2"],
  ["0x9e2A5304aEE86cd316d1A355570431b2c67782DC", "1"]
];

// (2)
const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

// (3)
console.log('Merkle Root:', tree.root);

// (4)
fs.writeFileSync("tree.json", JSON.stringify(tree.dump()));
