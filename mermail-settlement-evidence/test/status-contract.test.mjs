import assert from "node:assert/strict";

const rank = { requested: 1, accepted: 2, pending: 3, settled: 4 };

function classify(e) {
  if (e.final === true && e.authoritative === true) return "settled";
  if (e.paymentId && e.queued === true) return "pending";
  if (e.accepted === true && e.payerSide === true) return "accepted";
  return "requested";
}

function highest(records) {
  return records.reduce((best, r) => rank[classify(r)] > rank[best] ? classify(r) : best, "requested");
}

assert.equal(classify({ submitted: true }), "requested");
assert.equal(classify({ accepted: true, payerSide: true }), "accepted");
assert.equal(classify({ paymentId: "p-123", queued: true }), "pending");
assert.equal(classify({ paymentId: "0xabc", final: false, authoritative: true }), "requested");
assert.equal(classify({ final: true, authoritative: true }), "settled");

assert.equal(highest([
  { submitted: true },
  { accepted: true, payerSide: true },
  { paymentId: "p-123", queued: true }
]), "pending");

assert.notEqual(classify({ text: "we will pay soon" }), "pending");
assert.notEqual(classify({ paymentId: "0xabc" }), "settled");

console.log("settlement status contract tests: PASS");
