import { Accessor, createEffect, createSignal, on } from "solid-js";
import type uPlot from "uplot";
import { LegendStroke, PlotContext } from "../PlotTypes";

export function createDotFilter(opts: {
  xScale: Accessor<{ xMin: number; xMax: number }>;
  elementId: string;
  ctx: PlotContext;
  plot: () => uPlot | undefined;
}) {
  const [dotFilter, setDotFilter] = createSignal<number[]>([]);
  const checkDotFilter = () => (dotFilter().length > 0 ? dotFilter() : null);

  // This effect update the dot filter whenever the plot's x range changes.
  // The dot filter prevents dot-styled storkes for being crammed together.
  // It uses an Nth-point decimation / stride sampling algorithm to compute the filter.
  createEffect(
    on(
      () => [opts.xScale().xMax, opts.xScale().xMin],
      () => {
        const plot = opts.plot();
        if (!plot) return;

        const domainWidth: number = document.getElementById(
          opts.elementId,
        )!.offsetWidth;
        const xRange = opts.xScale().xMax - opts.xScale().xMin;
        const scale: number = xRange / domainWidth;
        const array: number[] = [];

        let i: number = 0;
        while (scale > 0.1) {
          array.push(i);
          i +=
            (Math.floor(scale) > 0
              ? Math.floor(scale)
              : parseFloat(scale.toFixed(1))) * 10;
          if (i >= plot.data[0].length) {
            break;
          }
        }
        if (scale <= 0.1) array.splice(0, array.length);
        setDotFilter(array);
      },
      { defer: true },
    ),
  );

  // This effect redraws the plot whenever the dot filter updates.
  createEffect(
    on(
      dotFilter,
      (df) => {
        const plot = opts.plot();
        if (!plot) return;
        if (opts.ctx.style.every((v) => v != LegendStroke.Dot)) return;

        if (df.length > 0) {
          opts.ctx.style.forEach((style, index) => {
            if (style === LegendStroke.Dot) {
              plot.series[index + 1].points!.filter = checkDotFilter;
            }
          });
          plot.redraw();
        } else {
          let need_redraw: boolean = false;
          plot.series.forEach((series) => {
            if (series.points?.filter === checkDotFilter) {
              series.points!.filter = () => null;
              need_redraw = true;
            }
          });
          if (need_redraw) plot.redraw();
        }
      },
      { defer: true },
    ),
  );

  return { checkDotFilter };
}
