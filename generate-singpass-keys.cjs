const crypto = require("crypto");

function generateECKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { format: "jwk" },
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8"
    }
  });

  return { publicKey, privateKey };
}

function generateKid() {
  return crypto.randomBytes(16).toString("hex");
}

console.log("\n========== GENERATING SINGPASS KEYS ==========\n");

/* SIGNING KEY */

const signing = generateECKeyPair();
const signingKid = generateKid();

console.log("SIGNING_PRIVATE_KEY=");
console.log(signing.privateKey);

console.log("\nSIGNING_PUBLIC_X=");
console.log(signing.publicKey.x);

console.log("\nSIGNING_PUBLIC_Y=");
console.log(signing.publicKey.y);

console.log("\nSIGNING_KID=");
console.log(signingKid);

/* DPOP KEY */

const dpop = generateECKeyPair();

console.log("\n========== DPOP KEY ==========\n");

console.log("DPOP_PRIVATE_KEY=");
console.log(dpop.privateKey);

console.log("\nDPOP_PUBLIC_X=");
console.log(dpop.publicKey.x);

console.log("\nDPOP_PUBLIC_Y=");
console.log(dpop.publicKey.y);

console.log("\n==============================================\n");