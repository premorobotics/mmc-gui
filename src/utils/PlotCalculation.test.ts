import { expect, test } from "vitest";
import { movingAvg } from "../../src/utils/PlotCalculation";

test("Test moving average function", () => {
  expect(movingAvg([1, 2, 3, 1], 2)).toStrictEqual([1, 1.5, 2.5, 2]);
});
