import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type ESTree, parseSync, Visitor } from "vite";
import { expect, test } from "vitest";

const repository = fileURLToPath(new URL("../", import.meta.url));
const forbiddenMath = new Set(["random", "pow", "sin", "cos", "exp", "tanh", "atan2"]);
const forbiddenGlobals = new Set(["Date", "performance"]);

function propertyName(property: ESTree.Node, computed: boolean): string | undefined {
  if (!computed && property.type === "Identifier") return property.name;
  if (computed && property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }
}

function isMath(node: ESTree.Node): boolean {
  if (node.type === "Identifier") return node.name === "Math";
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    ["globalThis", "self", "window", "global"].includes(node.object.name) &&
    propertyName(node.property, node.computed) === "Math"
  );
}

function scanSource(file: string, source: string): string[] {
  const parsed = parseSync(file, source);
  const violations: string[] = [];
  const report = (name: string, start: number) => {
    const line = source.slice(0, start).split("\n").length;
    violations.push(`${file}:${line} ${name}`);
  };
  const visitor = new Visitor({
    Identifier(node) {
      if (forbiddenGlobals.has(node.name)) report(node.name, node.start);
    },
    MemberExpression(node) {
      const name = propertyName(node.property, node.computed);
      if (name && forbiddenMath.has(name) && isMath(node.object)) {
        report(`Math.${name}`, node.start);
      }
      if (name && node.computed && forbiddenGlobals.has(name)) report(name, node.start);
    },
    VariableDeclarator(node) {
      if (node.id.type !== "ObjectPattern" || !node.init || !isMath(node.init)) return;
      for (const property of node.id.properties) {
        if (property.type !== "Property") continue;
        const name = propertyName(property.key, property.computed);
        if (name && forbiddenMath.has(name)) report(`Math.${name}`, property.start);
      }
    },
  });
  if (parsed.errors.length > 0)
    throw new Error(`Could not parse ${file}`, { cause: parsed.errors });
  visitor.visit(parsed.program);
  return violations;
}

test("deterministic source avoids clocks, ambient random and nonportable math", () => {
  const roots = ["packages/sim/src", "packages/controllers/src/policy"];
  const violations: string[] = [];
  for (const root of roots) {
    const directory = join(repository, root);
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.[cm]?[jt]sx?$/.test(entry.name)) continue;
      const path = join(entry.parentPath, entry.name);
      violations.push(...scanSource(relative(repository, path), readFileSync(path, "utf8")));
    }
  }
  expect(violations).toEqual([]);
});

test("the source scan recognises direct, computed and destructured access", () => {
  const source = `
    // Math.random() and Date.now() in documentation
    const label = "Math.exp";
    const speed = Math.sqrt(4);
    const sampled = Math.random();
    const elapsed = performance.now() - globalThis["Date"].now();
    const angle = globalThis.Math?.["sin"](1);
    const { tanh: activation } = Math;
  `;
  expect(scanSource("fixture.ts", source)).toEqual([
    "fixture.ts:5 Math.random",
    "fixture.ts:6 performance",
    "fixture.ts:6 Date",
    "fixture.ts:7 Math.sin",
    "fixture.ts:8 Math.tanh",
  ]);
});
