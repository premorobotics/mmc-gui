import {
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  Show,
  splitProps,
  useContext,
} from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";

import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { GlobalStateContext } from "~/store/GlobalState";
import { IconButton } from "~/components/ui/icon-button";
import {
  IconChevronLeftPipe,
  IconChevronRightPipe,
  IconLocation,
  IconLocationOff,
  IconSearch,
  IconX,
  IconZoomReset,
} from "@tabler/icons-solidjs";
import { Stack } from "styled-system/jsx";
import { LegendStroke, PlotContext } from "./PlotTypes";
import { Tooltip } from "~/components/ui/tooltip";
import { Portal } from "solid-js/web";
import * as Splitter from "~/components/ui/splitter";
import type { CursorPluginMessageBus } from "@dschz/solid-uplot/plugins";
import { SolidUplot, createPluginBus } from "@dschz/solid-uplot";
import { cursor, tooltip } from "@dschz/solid-uplot/plugins";
import { PlotToolTip } from "./PlotTooltip";
import { COLOR_PALETTE } from "./ColorPalette";
import { CursorModeToggleGroup } from "./CursorMode/CursorModeToggleGroup";
import { createCursorMode, CursorMode } from "./CursorMode/CreateCursorMode";
import { createDotFilter } from "./DotFilter/CreateDotFilter";
import { createZoomReset } from "./ZoomReset/CreateZoomReset";
import { createSelectionZoom } from "./SelectionZoom/CreateSelectionZoom";
import { wheelZoomPlugin } from "./WheelZoom/WheelZoom";
import { LegendList } from "./LegendList";
import { toSeriesOptions } from "./SeriesOption/SeriesOption";
import { createInitializeZoomState } from "./InitializeZoomState/CreateInitializeZoomState";
import { getComputedCSSVariableValue } from "~/utils/GetComputedCssVariableValue";
import { createSearchSeries } from "./SearchSeries/CreateSearchSeries";
import { createLegendPanelSize } from "./LegendPanelSize/CreateLegendPanelSize";

export type PlotProps = JSX.HTMLAttributes<HTMLDivElement> & {
  id: string;
  group?: string;
  header: string[];
  series: number[][];
  legendPanelMinWidth?: number;
  enumMapping?: Map<string, Map<number, string>>;
  context?: PlotContext;
  onContextChange?: (context: PlotContext) => void;
  xScale?: [number, number];
  onXScaleChange?: (xRange: [number, number]) => void;
  yScale?: { min: number; max: number };
  onYScaleChange?: (yScale: { min: number; max: number }) => void;
  legendPanelWidthPx?: number;
  onLegendPanelWidthPx?: (widthPx: number) => void;
  legendShrink?: boolean;
  onLegendShrinkChange?: (isShrink: boolean) => void;
};

export function Plot(props: PlotProps) {
  const [, rest] = splitProps(props, [
    "header",
    "series",
    "group",
    "legendPanelMinWidth",
    "enumMapping",
    "id",
    "context",
    "onContextChange",
    "xScale",
    "onXScaleChange",
    "yScale",
    "onYScaleChange",
    "onLegendPanelWidthPx",
    "legendPanelWidthPx",
    "legendShrink",
    "onLegendShrinkChange",
  ]);
  const { globalState } = useContext(GlobalStateContext)!;

  const [render, setRender] = createSignal(false);
  const [cursorIdx, setCursorIdx] = createSignal<number | null>(null);
  let plot: uPlot;

  const group = () => props.group ?? props.id ?? "";

  const [ctx, setCtx] = createStore<PlotContext>({
    visible: [],
    color: [],
    style: [],
    selected: [],
  });
  createEffect(
    on(
      () => props.context,
      (context) => {
        const header = props.header;
        const n = header.length;
        const newCtx: PlotContext = {
          color:
            typeof context !== "undefined" &&
            context.color &&
            context.color.length === n
              ? [...context.color]
              : header.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]),
          style:
            context && context.style && context.style.length === n
              ? [...context.style]
              : header.map(() => LegendStroke.Line),
          visible:
            context && context.visible && context.visible.length === n
              ? [...context.visible]
              : header.map(() => true),
          selected: header.map(() => false),
        };
        setCtx(reconcile(newCtx));
        props.onContextChange?.(structuredClone(newCtx));
      },
    ),
  );

  const [xScale, setXScale] = createSignal<{ xMin: number; xMax: number }>(
    props.xScale
      ? { xMin: props.xScale[0], xMax: props.xScale[1] }
      : { xMin: 0, xMax: props.series[0].length },
  );
  const { checkDotFilter } = createDotFilter({
    xScale,
    ctx,
    plot: () => plot,
  });
  const { initializeZoomState } = createInitializeZoomState({
    xScale: () => props.xScale,
    yScale: () => props.yScale,
    onXScaleChange: props.onXScaleChange,
    onYScaleChange: props.onYScaleChange,
    setXScale,
  });

  const { zoomReset, checkZoomLevel, yScale } = createZoomReset();

  const color = createMemo(
    on(
      () => globalState.theme,
      () => {
        return {
          fg: getComputedCSSVariableValue("--colors-fg-default"),
          grid: getComputedCSSVariableValue("--colors-gray-3"),
        };
      },
    ),
  );

  const selection_css = `
    .u-select {
      background: var(--colors-fg-subtle);
      opacity: 0.1;
    }
  `;

  const { searchInput, setSearchInput, legendIndex } = createSearchSeries(
    props.header,
  );

  const [showLegendCheckBox, setShowLegendCheckBox] =
    createSignal<boolean>(false);

  const bus = createPluginBus<CursorPluginMessageBus>();

  const [isPointerOverLegend, setIsPointerOverLegend] =
    createSignal<boolean>(false);
  const cursorMode = createCursorMode({
    isShortcutBlocked: (key) => key === "Shift" && isPointerOverLegend(),
  });
  const {
    mouseDownHandler,
    mouseUpHandler,
    dblClickHandler,
    yMin,
    yMax,
    selectionLeft,
    selectionWidth,
  } = createSelectionZoom(cursorMode.mode, group, yScale);

  const { rootObserver, size, resize } = createLegendPanelSize({
    legendPanelMinWidth: () => props.legendPanelMinWidth,
    legendPanelWidthPx: () => props.legendPanelWidthPx,
    onLegendPanelWidthPx: (newWidth) => props.onLegendPanelWidthPx?.(newWidth),
    onLegendShrinkChange: (newStatus) =>
      props.onLegendShrinkChange?.(newStatus),
  });

  return (
    <>
      <Splitter.Root
        {...rest}
        ref={(el) => rootObserver.observe(el)}
        background="bg.default"
        id={`splitter-${props.id}`}
        panels={[{ id: `plot-${props.id}` }, { id: `legend-${props.id}` }]}
        size={size()}
        onResize={(details) => {
          resize(details.size[1]);
        }}
      >
        <Splitter.Panel
          id={`plot-${props.id}`}
          borderWidth="0"
          gap="0"
          padding="0"
        >
          <div
            id={props.id}
            style={{ width: `calc(100% - 2.5rem)`, height: "100%" }}
            onMouseLeave={() => {
              if (cursorMode.mode() !== CursorMode.Lock) {
                setCursorIdx(null);
              }
            }}
          >
            <SolidUplot
              onCreate={(newPlot) => {
                plot = newPlot;
                setRender(true);
              }}
              onCursorMove={(e) => {
                setCursorIdx(e.cursor.xValue);
              }}
              cursor={{
                sync: {
                  key: group(),
                },
                bind: {
                  mousedown: mouseDownHandler,
                  mouseup: mouseUpHandler,
                  dblclick: dblClickHandler,
                },
              }}
              autoResize={true}
              axes={[
                {
                  stroke: color().fg,
                  grid: {
                    stroke: color().grid,
                  },
                  ticks: {
                    stroke: color().grid,
                  },
                },
                {
                  stroke: color().fg,
                  grid: {
                    stroke: color().grid,
                  },
                  ticks: {
                    stroke: color().grid,
                  },
                  size: (self, values, axisIdx, cycleNum) => {
                    const axis = self.axes[axisIdx]!;

                    // bail out, force convergence
                    if (cycleNum > 1)
                      return axis["_size" as keyof typeof axis] as number;

                    const baseAxisSize = axis.ticks!.size! + axis.gap!;

                    // find longest value
                    const longestVal = (values ?? []).reduce(
                      (acc, val) => (val.length > acc.length ? val : acc),
                      "",
                    );

                    let axisSize = baseAxisSize;
                    if (longestVal != "") {
                      self.ctx.font = axis.font![0];
                      axisSize =
                        baseAxisSize +
                        self.ctx.measureText(longestVal).width /
                          devicePixelRatio;
                    }

                    const minAxisSize =
                      baseAxisSize +
                      self.ctx.measureText("999.999").width / devicePixelRatio;
                    return Math.max(Math.ceil(axisSize), minAxisSize);
                  },
                },
              ]}
              data={[
                Array.from({ length: props.series[0].length }, (_, i) => i), // x values
                ...props.series,
              ]}
              scales={{
                x: {
                  time: false,
                },
              }}
              series={
                plot! && plot.series
                  ? plot.series
                  : [
                      {
                        label: "Cycle",
                        stroke: "#ffffff",
                      },
                      ...props.header.map((_, index) => {
                        return toSeriesOptions({
                          label: props.header[index],
                          stroke: () => unwrap(ctx).color[index],
                          show: unwrap(ctx).visible[index],
                          style: unwrap(ctx).style[index],
                          dotFilter: checkDotFilter,
                        });
                      }),
                    ]
              }
              plugins={[
                cursor(),
                wheelZoomPlugin({
                  factor: 0.75,
                  group: group,
                  cursorMode: cursorMode.mode,
                }),
                checkZoomLevel(),
                tooltip((tooltipProps) =>
                  PlotToolTip({
                    ...tooltipProps,
                    enumMapping: props.enumMapping,
                  }),
                ),
                initializeZoomState(),
              ]}
              pluginBus={bus}
            />
          </div>

          <style>{selection_css}</style>
          <IconButton
            size="sm"
            padding="0"
            variant="plain"
            onClick={() => {
              props.onLegendShrinkChange?.(!props.legendShrink);
            }}
            marginRight={props.legendShrink ? "1em" : "0em"}
          >
            <Show when={props.legendShrink} fallback={<IconChevronRightPipe />}>
              <IconChevronLeftPipe />
            </Show>
          </IconButton>
        </Splitter.Panel>
        <Show when={!props.legendShrink}>
          <Splitter.ResizeTrigger
            id={`plot-${props.id}:legend-${props.id}`}
            opacity="0%"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "100%")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0%")}
          />
        </Show>

        <Show when={!props.legendShrink}>
          <Splitter.Panel
            id={`legend-${props.id}`}
            borderWidth="0"
            style={{
              width: "100%",
              height: "100%",
              padding: "0",
              "align-items": "normal",
              "border-radius": "0",
            }}
            flexDir={"column"}
          >
            <Stack
              direction="row-reverse"
              style={{
                height: "2.3rem",
                width: "100%",
                "padding-right": "1.8rem",
              }}
            >
              <Stack
                direction="row"
                id={`toolBox:${props.id}`}
                minWidth="13rem"
              >
                <Tooltip content="Zoom Reset">
                  <IconButton
                    marginRight="0.2rem"
                    variant="outline"
                    disabled={zoomReset()}
                    onclick={() => {
                      uPlot.sync(group()).plots.forEach((up: uPlot) => {
                        const xMax = Number(up.data[0].length - 1);
                        up.setScale("x", { min: 0, max: xMax });
                      });
                      plot.setScale("y", {
                        min: yScale().min,
                        max: yScale().max,
                      });
                    }}
                  >
                    <IconZoomReset />
                  </IconButton>
                </Tooltip>
                <CursorModeToggleGroup
                  lastCursorMode={cursorMode.baseMode()}
                  cursorMode={cursorMode.mode()}
                  onCursorModeChange={cursorMode.select}
                />
              </Stack>
            </Stack>

            <Stack
              width={`calc(100% - 1rem)`}
              height={"2.5em"}
              direction="row"
              marginTop={"0.5em"}
              paddingLeft="0.8rem"
              paddingRight="1rem"
            >
              <Stack
                width="100%"
                direction="row"
                borderWidth="1px"
                borderRadius="0.4rem"
                paddingLeft="0.5em"
                height="2em"
                marginTop="0.3em"
                gap="0"
              >
                <IconSearch
                  style={{
                    "margin-top": "0.2em",
                    "margin-right": "0.5em",
                  }}
                />
                <input
                  value={searchInput()}
                  onInput={(e) => {
                    setSearchInput(e.target.value);
                  }}
                  placeholder="Search series"
                  style={{
                    border: "none",
                    outline: "none",
                    "white-space": "nowrap",
                    overflow: "hidden",
                    display: "block",
                    "text-overflow": "ellipsis",
                    width: `calc(100% - 0.5em)`,
                  }}
                  height="1em"
                />
                <IconButton
                  variant="plain"
                  onClick={() => setSearchInput("")}
                  padding="0"
                  size="sm"
                  width="1em"
                  height="1.5em"
                  borderRadius="3em"
                  marginTop="0.2em"
                >
                  <IconX />
                </IconButton>
              </Stack>
              <Tooltip content="Select">
                <IconButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    if (showLegendCheckBox()) {
                      setCtx(
                        "selected",
                        props.header.map(() => false),
                      );
                    }
                    setShowLegendCheckBox(!showLegendCheckBox());
                  }}
                >
                  <Show
                    when={showLegendCheckBox()}
                    fallback={<IconLocationOff />}
                  >
                    <IconLocation />
                  </Show>
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack
              style={{
                "padding-bottom": "0.5em",
                width: "100%",
                "margin-right": "1em",
                position: "relative",
                height: `calc(100% - 5em)`,
                "overflow-x": "auto",
                "overflow-y": "auto",
                gap: 0,
                "padding-left": "0.5rem",
              }}
              onMouseEnter={() => {
                setIsPointerOverLegend(true);
                cursorMode.reset();
              }}
              onMouseLeave={(e) => {
                if (e.shiftKey) {
                  cursorMode.setMode(CursorMode.Horizontal);
                }
                setIsPointerOverLegend(false);
              }}
            >
              <Show when={render()}>
                <LegendList
                  ctx={ctx}
                  setCtx={setCtx}
                  plot={plot!}
                  onContextChange={(newCtx) => {
                    props.onContextChange?.(structuredClone(unwrap(newCtx)));
                  }}
                  showLegendCheckbox={showLegendCheckBox()}
                  enumMapping={props.enumMapping}
                  checkDotFilter={checkDotFilter}
                  cursorIdx={cursorIdx()}
                  header={props.header}
                  legendIndex={legendIndex()}
                  group={group()}
                />
              </Show>
            </Stack>
          </Splitter.Panel>
        </Show>
      </Splitter.Root>
      <Show when={yMin() && yMax()}>
        <Portal>
          <Stack
            position="absolute"
            pointerEvents="none"
            backgroundColor="fg.subtle"
            style={{
              top: `${Math.min(yMax()!, yMin()!)}px`,
              left: `${selectionLeft()}px`,
              width: `${selectionWidth()}px`,
              height: `${Math.max(yMax()!, yMin()!) - Math.min(yMax()!, yMin()!)}px`,
              opacity: "0.1",
            }}
          />
        </Portal>
      </Show>
    </>
  );
}
