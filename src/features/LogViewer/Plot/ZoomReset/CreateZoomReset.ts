import { UplotPluginFactory } from "@dschz/solid-uplot";
import { CursorPluginMessageBus } from "@dschz/solid-uplot/plugins";
import { Accessor, createSignal } from "solid-js";

export function createZoomReset(): {
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
          setScale: (plot) => {
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
