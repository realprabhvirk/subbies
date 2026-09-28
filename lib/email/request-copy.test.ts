import test from "node:test";
import assert from "node:assert/strict";

import { requestSubject, requestText, REFRESH_NOTE } from "./request-copy.ts";

const base = {
  companyName: "Acme Build",
  contactName: "Sam",
  onboardUrl: "https://app.example/onboard/abc",
};

test("outstanding-only reads exactly as before: documents needed", () => {
  const input = { ...base, documentNames: ["Public liability", "White card"] };
  assert.equal(requestSubject(input), "Acme Build: documents needed before you start work");
  const text = requestText(input);
  assert.match(text, /asked you to provide the following/);
  assert.match(text, /- Public liability/);
  assert.ok(!/updated copy/i.test(text));
});

test("a refresh-only request says 'updated copy' and that the current one stays valid", () => {
  const input = { ...base, documentNames: [], refreshDocumentNames: ["Public liability"] };
  assert.equal(requestSubject(input), "Acme Build: updated documents requested");
  const text = requestText(input);
  assert.match(text, /updated copy/i);
  assert.ok(text.includes(REFRESH_NOTE));
  assert.match(text, /still valid/);
});

test("a refresh-only email never calls a valid document expired, missing, needed or required", () => {
  const input = { ...base, documentNames: [], refreshDocumentNames: ["Public liability"] };
  const text = `${requestSubject(input)}\n${requestText(input)}`;
  for (const word of [/expired/i, /missing/i, /documents needed/i, /(is|are) needed/i, /required/i, /before you start work/i, /provide the following/i]) {
    assert.ok(!word.test(text), `must not contain ${word}`);
  }
});

test("a mixed request lists both, and only the refresh list carries the 'still valid' note", () => {
  const input = {
    ...base,
    documentNames: ["White card"],
    refreshDocumentNames: ["Public liability"],
  };
  assert.equal(requestSubject(input), "Acme Build: documents needed before you start work");
  const text = requestText(input);
  assert.match(text, /provide the following:\n\n {2}- White card/);
  assert.match(text, /also asked for an updated copy/);
  assert.match(text, /- Public liability/);
  assert.equal(text.split(REFRESH_NOTE).length - 1, 1);
});

test("the link and the sign-off are present in every variant", () => {
  for (const input of [
    { ...base, documentNames: ["A"] },
    { ...base, documentNames: [], refreshDocumentNames: ["A"] },
    { ...base, documentNames: ["A"], refreshDocumentNames: ["B"] },
  ]) {
    const text = requestText(input);
    assert.ok(text.includes(base.onboardUrl));
    assert.match(text, /Sent via Subbies on behalf of Acme Build/);
  }
});

test("greeting falls back cleanly with no contact name", () => {
  assert.match(requestText({ ...base, contactName: null, documentNames: ["A"] }), /^Hi,\n/);
});
