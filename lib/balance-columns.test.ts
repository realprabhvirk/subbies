import test from "node:test";
import assert from "node:assert/strict";

import { balanceColumns } from "./balance-columns.ts";

const c = (key: string, height: number) => ({ key, height });

test("cards go to the shorter column, in order", () => {
  const r = balanceColumns({ left: c("needs", 360), right: c("overview", 560) }, [c("expiring", 170), c("recent", 490), c("quick", 250)]);
  assert.deepEqual(r, { left: ["needs", "expiring", "recent"], right: ["overview", "quick"] });
});

test("a long left column sends everything right", () => {
  const r = balanceColumns({ left: c("needs", 1000), right: c("overview", 560) }, [c("expiring", 170), c("recent", 200), c("quick", 250)]);
  assert.deepEqual(r, { left: ["needs"], right: ["overview", "expiring", "recent", "quick"] });
});

test("with nothing else to place, each column keeps its seed", () => {
  assert.deepEqual(balanceColumns({ left: c("a", 1), right: c("b", 1) }, []), { left: ["a"], right: ["b"] });
});

test("every card is placed exactly once", () => {
  const rest = [c("x", 100), c("y", 300), c("z", 50), c("w", 220)];
  const r = balanceColumns({ left: c("a", 400), right: c("b", 400) }, rest);
  assert.deepEqual([...r.left, ...r.right].sort(), ["a", "b", "w", "x", "y", "z"]);
});
