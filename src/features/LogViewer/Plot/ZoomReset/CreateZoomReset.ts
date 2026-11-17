import { UplotPluginFactory } from "@dschz/solid-uplot";
import { CursorPluginMessageBus } from "@dschz/solid-uplot/plugins";
import { Accessor, createSignal } from "solid-js";

export function createZoomReset(
  opts: {
    onXScaleChange?: (xMin: number, xMax: number) => void;
    onYScaleChange?: (yMin: number, yMax: number) => void;
  } = {},
): {
  zoomReset: Accessor<boolean>;
  checkZoomLevel: () => UplotPluginFactory<CursorPluginMessageBus>;
  yScale: Accessor<{ min: number; max: number }>;
} {
  // Store whether zoom reset button should be disabled.
  const [zoomReset, setZoomReset] = createSignal<boolean>(true);

  // Store the y scale min and max for reset the zoom
  const [yScale, setYScale] = createSignal<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const checkZoomLevel = (): UplotPluginFactory<CursorPluginMessageBus> => {
    return () => {
      return {
        hooks: {
          ready: (plot) => {
            setYScale({
              min: plot.scales.y.min!,
              max: plot.scales.y.max!,
            });
          },
          setScale: (plot, scaleKey) => {
            if (
              (plot.scales.x.min && plot.scales.x.min > 0) ||
              (plot.scales.x.max && plot.scales.x.max < plot.data[0].length - 1)
            ) {
              setZoomReset(false);
            } else {
              if (
                (plot.scales.y.min && plot.scales.y.min > yScale().min) ||
                (plot.scales.y.max && plot.scales.y.max < yScale().max)
              ) {
                setZoomReset(false);
              } else {
                setZoomReset(true);
              }
            }

            if (scaleKey === "x") {
              if (
                typeof plot.scales.x.min === "number" &&
                typeof plot.scales.x.max === "number"
              ) {
                opts.onXScaleChange?.(plot.scales.x.min, plot.scales.x.max);
              }
            }

            if (scaleKey === "y") {
              if (
                typeof plot.scales.y.min === "number" &&
                typeof plot.scales.y.max === "number"
              ) {
                opts.onYScaleChange?.(plot.scales.y.min, plot.scales.y.max);
              }
            }
          },
        },
      };
    };
  };
  return {
    zoomReset,
    checkZoomLevel,
    yScale,
  };
}
