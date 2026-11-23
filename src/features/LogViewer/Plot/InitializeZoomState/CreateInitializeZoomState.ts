import { UplotPluginFactory } from "@dschz/solid-uplot";
import { CursorPluginMessageBus } from "@dschz/solid-uplot/plugins";
import { Setter } from "solid-js";

type CreateInitializeZoomStateProps = {
  xScale: () => [number, number] | undefined;
  yScale: () => { min: number; max: number } | undefined;
  onXScaleChange?: (xScale: [number, number]) => void;
  onYScaleChange?: (yScale: { min: number; max: number }) => void;
  setXScale: Setter<{ xMin: number; xMax: number }>;
};

export function createInitializeZoomState(
  props: CreateInitializeZoomStateProps,
) {
  const initializeZoomState =
    (): UplotPluginFactory<CursorPluginMessageBus> => {
      return () => {
        // Set scale event triggered before ready. So it must need to check the plot is ready before update the scale.
        let isReady = false;
        return {
          hooks: {
            ready: (plot) => {
              const xScale = props.xScale();
              if (xScale) {
                plot.setScale("x", {
                  min: xScale[0],
                  max: xScale[1],
                });
              }

              const yScale = props.yScale();
              if (yScale) {
                plot.setScale("y", yScale);
              }
              isReady = true;
            },
            setScale: (plot, scaleKey) => {
              if (!isReady) return;
              if (scaleKey === "x") {
                if (
                  typeof plot.scales.x.min === "number" &&
                  typeof plot.scales.x.max === "number"
                ) {
                  props.onXScaleChange?.([
                    plot.scales.x.min,
                    plot.scales.x.max,
                  ]);
                  props.setXScale({
                    xMin: plot.scales.x.min,
                    xMax: plot.scales.x.max,
                  });
                }
              }

              if (scaleKey === "y") {
                if (
                  typeof plot.scales.y.min === "number" &&
                  typeof plot.scales.y.max === "number"
                ) {
                  props.onYScaleChange?.({
                    min: plot.scales.y.min,
                    max: plot.scales.y.max,
                  });
                }
              }
            },
          },
        };
      };
    };
  return {
    initializeZoomState,
  };
}
