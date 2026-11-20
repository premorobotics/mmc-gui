import { UplotPluginFactory } from "@dschz/solid-uplot";
import { CursorPluginMessageBus } from "@dschz/solid-uplot/plugins";
import { Setter } from "solid-js";

type CreateInitializeZoomStateProps = {
  xScale?: [number, number];
  yScale?: { min: number; max: number };
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
              if (props.xScale) {
                plot.setScale("x", {
                  min: props.xScale[0],
                  max: props.xScale[1],
                });
              }
              if (props.yScale) {
                plot.setScale("y", props.yScale);
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
