import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(relativeUrl) {
  return JSON.parse(readFileSync(new URL(relativeUrl, import.meta.url), "utf8"));
}

test("manifest bundles the Youdao Origin removal ruleset", () => {
  const manifest = readJson("../manifest.json");
  const rulesets = manifest.declarative_net_request?.rule_resources || [];
  assert.ok(
    rulesets.some(
      (ruleset) =>
        ruleset.enabled === true &&
        ruleset.path === "rules/youdao-request-headers.json",
    ),
  );
});

test("Youdao requests remove the extension Origin header", () => {
  const rules = readJson("../rules/youdao-request-headers.json");
  const rule = rules.find(
    (candidate) =>
      candidate.condition?.urlFilter === "||dict.youdao.com/" &&
      candidate.condition?.resourceTypes?.includes("xmlhttprequest"),
  );
  assert.ok(rule);
  assert.ok(
    rule.action?.requestHeaders?.some(
      (header) =>
        header.header === "Origin" && header.operation === "remove",
    ),
  );
});
