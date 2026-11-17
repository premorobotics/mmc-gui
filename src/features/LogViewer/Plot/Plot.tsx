import {
  createEffect,
  createSignal,
  For,
  JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js";
import { createStore, unwrap } from "solid-js/store";

import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { GlobalStateContext } from "~/store/GlobalState";
import { IconButton } from "~/components/ui/icon-button";
import {
  IconChevronLeftPipe,
  IconChevronRightPipe,
  IconEye,
  IconEyeOff,
  IconLocation,
  IconLocationOff,
  IconSearch,
  IconX,
  IconZoomReset,
} from "@tabler/icons-solidjs";
import { Stack } from "styled-system/jsx";
import { Legend, LegendStroke } from "./Legend";
import { Tooltip } from "~/components/ui/tooltip";
import { Portal } from "solid-js/web";
import * as Splitter from "~/components/ui/splitter";
import type { CursorPluginMessageBus } from "@dschz/solid-uplot/plugins";
import {
  SolidUplot,
  UplotPluginFactory,
  createPluginBus,
} from "@dschz/solid-uplot";
import { cursor, tooltip } from "@dschz/solid-uplot/plugins";
import { PlotToolTip } from "./PlotTooltip";
import { getComputedCSSVariableValue } from "~/utils/GetComputedCssVariableValue";
import { fuzzySearch } from "~/utils/FuzzySearch";
import { COLOR_PALETTE } from "./ColorPalette";
import { CursorModeToggleGroup } from "./CursorMode/CursorModeToggleGroup";
import { createCursorMode, CursorMode } from "./CursorMode/CreateCursorMode";
import { createDotFilter } from "./DotFilter/CreateDotFilter";
import { createZoomReset } from "./ZoomReset/CreateZoomReset";
import { createSelectionZoom } from "./SelectionZoom/CreateSelectionZoom";
import { wheelZoomPlugin } from "./WheelZoom/WheelZoom";

export type PlotProps = JSX.HTMLAttributes<HTMLDivElement> & {
  id: string;
  group?: string;
  name: string;
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

export type PlotContext = {
  visible: boolean[];
  color: string[];
  style: LegendStroke[];
  selected: boolean[];
};

export function Plot(props: PlotProps) {
  const [, rest] = splitProps(props, [
    "name",
    "header",
    "series",
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
  let theme = globalState.theme;

  const [render, setRender] = createSignal(false);
  const [cursorIdx, setCursorIdx] = createSignal<number | null>(null);
  let plot: uPlot;

  const group = () => props.group ?? props.id ?? "";

  const [ctx, setCtx] = createStore(
    props.context ? props.context : ({} as PlotContext),
  );
  const [getContext, setGetContext] = createSignal(ctx);
  const [setContext, setSetContext] = createSignal(setCtx);

  // Reset context when context prop changes.
  createEffect(() => {
    const [ctx, setCtx] = createStore(
      props.context != null ? props.context : ({} as PlotContext),
    );

    setGetContext(ctx);
    setSetContext(() => setCtx);

    if (
      !getContext().color ||
      getContext().color.length == 0 ||
      getContext().color.length !== props.header.length
    ) {
      setContext()(
        "color",
        props.header.map(
          (_, index) => COLOR_PALETTE[index % COLOR_PALETTE.length],
        ),
      );
    }

    if (
      !getContext().style ||
      getContext().style.length == 0 ||
      getContext().style.length !== props.header.length
    ) {
      setContext()(
        "style",
        props.header.map(() => LegendStroke.Line),
      );
    }

    if (
      !getContext().visible ||
      getContext().visible.length == 0 ||
      getContext().visible.length !== props.header.length
    ) {
      setContext()(
        "visible",
        props.header.map(() => true),
      );
    }

    setContext()(
      "selected",
      props.header.map(() => false),
    );
  });

  const [xScale, setXScale] = createSignal<{ xMin: number; xMax: number }>(
    props.xScale
      ? { xMin: props.xScale[0], xMax: props.xScale[1] }
      : { xMin: 0, xMax: props.series[0].length },
  );
  const { dotFilter, checkDotFilter } = createDotFilter({
    xScale,
    elementId: props.id,
    getContext,
    plot: () => plot,
  });

  const { zoomReset, checkZoomLevel, yScale } = createZoomReset({
    onXScaleChange: (xMin, xMax) => {
      props.onXScaleChange?.([xMin, xMax]);
      setXScale({ xMin: xMin, xMax: xMax });
    },
    onYScaleChange: (yMin, yMax) => {
      props.onYScaleChange?.({
        min: yMin,
        max: yMax,
      });
    },
  });

  const initializeZoomState =
    (): UplotPluginFactory<CursorPluginMessageBus> => {
      return () => {
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
            },
          },
        };
      };
    };

  onCleanup(() => {
    plot.destroy();
  });

  const [fgDefault, setFgDefault] = createSignal<string>(
    getComputedCSSVariableValue("--colors-fg-default"),
  );
  const [bgMuted, setBgMuted] = createSignal<string>(
    getComputedCSSVariableValue("--colors-gray-3"),
  );

  // This effect updates the CSS whenever the theme in global state changes.
  createEffect(() => {
    if (globalState.theme !== theme) {
      theme = globalState.theme;
      setFgDefault(getComputedCSSVariableValue("--colors-fg-default"));
      setBgMuted(getComputedCSSVariableValue("--colors-gray-3"));
    }
  });

  const selection_css = `
    .u-select {
      background: var(--colors-fg-subtle);
      opacity: 0.1;
    }
  `;

  const [showLegendCheckBox, setShowLegendCheckBox] =
    createSignal<boolean>(false);

  const [searchInput, setSearchInput] = createSignal<string>("");
  const [legendIndex, setLegendIndex] = createSignal<number[]>(
    props.header.map((_, i) => i),
  );

  createEffect(() => {
    const searchInputValue = searchInput();
    const parseSearchResults: string[] = fuzzySearch(
      searchInputValue,
      props.header,
    );
    if (searchInputValue.length === 0) {
      setLegendIndex(props.header.map((_, i) => i));
    } else {
      const headerIndex = parseSearchResults.map((str) =>
        props.header.indexOf(str),
      );
      setLegendIndex(headerIndex);
    }
  });

  const bus = createPluginBus<CursorPluginMessageBus>();

  onCleanup(() => {
    if (plot) {
      uPlot.sync(group()).unsub(plot);
    }
  });

  const [prevSelect, setPrevSelect] = createSignal<number | null>(null);
  const multiSelect = (
    index: number,
    prevIndex: number,
    legendIndexes: number[],
  ) => {
    const select = getContext().selected;
    const min = Math.min(index, prevIndex + 1);
    const max = Math.max(index + 1, prevIndex);
    const indexList = legendIndexes.slice(min, max);

    const shiftSelect = indexList.map((item) => select[item]);
    const shiftSelectState = [...new Set(shiftSelect)];
    const isAllSame = shiftSelectState.length !== 2;

    if (isAllSame) {
      const updateSelected = select.map((selected, i) => {
        if (indexList.includes(i)) {
          return !shiftSelectState[0];
        } else {
          return selected;
        }
      });
      setContext()("selected", updateSelected);
      return;
    }
  };

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
  } = createSelectionZoom(cursorMode.mode, group(), yScale);

  const [prevVisible, setPrevVisible] = createSignal<number | null>(null);
  const multiVisible = (
    index: number,
    prevIndex: number,
    legendIndexes: number[],
    plot: uPlot,
  ) => {
    const visible = getContext().visible;
    const min = Math.min(index, prevIndex + 1);
    const max = Math.max(index + 1, prevIndex);
    const indexList = legendIndexes.slice(min, max);

    const shiftVisible = indexList.map((item) => visible[item]);
    const shiftVisibleState = [...new Set(shiftVisible)];
    const isAllSame = shiftVisibleState.length !== 2;

    // Prevent selection context changes after plot series visibility changes
    // Plot visibility changes trigger a refresh of the plot API context,
    // which also refreshes the customize plot context.
    const prevSelect = getContext().selected;

    if (isAllSame) {
      plot.batch(() => {
        const updateVisible = visible.map((visible, i) => {
          if (indexList.includes(i)) {
            plot.setSeries(i + 1, {
              show: !shiftVisibleState[0],
            });
            return !shiftVisibleState[0];
          } else {
            return visible;
          }
        });
        setContext()("visible", updateVisible);
        setContext()("selected", prevSelect);
      });
      return;
    }
  };

  const [rootWidth, setRootWidth] = createSignal<number>(0);
  const rootObserver = new ResizeObserver((entry) => {
    const element = entry[0];
    const rect = element.contentRect;
    setRootWidth(rect.width);
  });

  onCleanup(() => {
    rootObserver.disconnect();
  });

  const convertPixelToPercent = (rootWidth: number, elementWidth: number) => {
    return (elementWidth / rootWidth) * 100;
  };

  const convertPercentToPixel = (percent: number, rootWidth: number) => {
    return rootWidth * percent * 0.01;
  };

  return (
    <>
      <Splitter.Root
        {...rest}
        ref={(el) => rootObserver.observe(el)}
        background="bg.default"
        id={`splitter-${props.id}`}
        panels={[{ id: `plot-${props.id}` }, { id: `legend-${props.id}` }]}
        size={[
          100 -
            convertPixelToPercent(
              rootWidth(),
              props.legendPanelWidthPx ?? props.legendPanelMinWidth ?? 0,
            ),
          convertPixelToPercent(
            rootWidth(),
            props.legendPanelWidthPx ?? props.legendPanelMinWidth ?? 0,
          ),
        ]}
        onResize={(details) => {
          const legendPanelSize = convertPercentToPixel(
            details.size[1],
            rootWidth(),
          );
          if (props.legendPanelMinWidth) {
            const legendPanelMinWidth = props.legendPanelMinWidth;
            if (legendPanelSize > legendPanelMinWidth) {
              props.onLegendPanelWidthPx?.(legendPanelSize);
              props.onLegendShrinkChange?.(false);
            } else {
              const legendMinWidhtSizeQuater = legendPanelMinWidth * 0.25;
              if (legendPanelSize > legendMinWidhtSizeQuater) {
                props.onLegendPanelWidthPx?.(legendPanelMinWidth);
                props.onLegendShrinkChange?.(false);
              } else {
                props.onLegendPanelWidthPx?.(0);
                props.onLegendShrinkChange?.(true);
              }
            }
          }
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
                  stroke: fgDefault(),
                  grid: {
                    stroke: bgMuted(),
                  },
                  ticks: {
                    stroke: bgMuted(),
                  },
                },
                {
                  stroke: fgDefault(),
                  grid: {
                    stroke: bgMuted(),
                  },
                  ticks: {
                    stroke: bgMuted(),
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
                      ...props.header.map((_, index) => ({
                        label: props.header[index],
                        stroke: () => unwrap(getContext()).color[index],
                        show: unwrap(getContext()).visible[index],
                        width: 1 / devicePixelRatio,
                        ...{
                          ...(unwrap(getContext()).style[index] ===
                            LegendStroke.Dash && {
                            dash: [10, 5],
                          }),
                          ...(unwrap(getContext()).style[index] ===
                            LegendStroke.Dot && {
                            dash: [0, 5],
                            points: {
                              show: true,
                              ...(dotFilter().length !== 0 && {
                                filter: checkDotFilter(),
                              }),
                            },
                          }),
                        },
                      })),
                    ]
              }
              plugins={[
                cursor(),
                wheelZoomPlugin({
                  factor: 0.75,
                  group: group(),
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
                      setContext()(
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
                <Stack direction="row" gap="0.2rem">
                  <IconButton
                    size="xs"
                    variant="plain"
                    onClick={() => {
                      const prevSelect = getContext().selected;
                      const newVisible = !getContext()
                        .visible.filter((_, i) => legendIndex().includes(i))
                        .includes(true);
                      setContext()(
                        "visible",
                        getContext().visible.map((visible, i) => {
                          if (legendIndex().includes(i)) return newVisible;
                          else return visible;
                        }),
                      );
                      getContext().visible.forEach((val, i) => {
                        plot.setSeries(i + 1, {
                          show: val,
                        });
                      });
                      setContext()("selected", prevSelect);
                      props.onContextChange?.(getContext());
                    }}
                  >
                    <Show
                      when={getContext()
                        .visible.filter((_, i) => legendIndex().includes(i))
                        .includes(true)}
                      fallback={<IconEye />}
                    >
                      <IconEyeOff />
                    </Show>
                  </IconButton>
                  <Legend
                    plot={plot!}
                    series="Cycle"
                    group={group()}
                    width="min-content"
                    cursorIdx={cursorIdx()}
                    readonly
                  />
                </Stack>
                <For each={legendIndex()}>
                  {(item, index) => {
                    const header = props.header[item];
                    return (
                      <div style={{ width: "100% " }}>
                        <Legend
                          plot={plot}
                          group={group()}
                          series={header}
                          cursorIdx={cursorIdx()}
                          enumValuesMapping={
                            props.enumMapping && props.enumMapping.has(header)
                              ? props.enumMapping.get(header)
                              : undefined
                          }
                          showSelectCheckBox={showLegendCheckBox()}
                          selected={getContext().selected[item]}
                          onSelectChange={(isChecked, shiftKey) => {
                            if (
                              shiftKey === true &&
                              typeof prevSelect() === "number"
                            ) {
                              multiSelect(
                                index(),
                                prevSelect()!,
                                legendIndex(),
                              );
                              setPrevSelect(null);
                              setPrevVisible(null);
                              return;
                            } else {
                              setContext()("selected", item, isChecked);
                              setPrevSelect(index());
                              props.onContextChange?.(getContext());
                            }
                          }}
                          visible={getContext().visible[item]}
                          onVisibleChange={(new_visible, shiftKey) => {
                            if (shiftKey) {
                              if (prevVisible() !== null) {
                                multiVisible(
                                  index(),
                                  prevVisible()!,
                                  legendIndex(),
                                  plot,
                                );
                              }
                              setPrevSelect(null);
                              setPrevVisible(null);
                              return;
                            } else {
                              setContext()("visible", item, new_visible);
                              // Index must add 1 to account for X-axis "Cycle" series
                              plot.batch(() => {
                                plot.setSeries(item + 1, {
                                  show: new_visible,
                                });
                                plot.setScale("y", {
                                  min: plot.scales.y.min!,
                                  max: plot.scales.y.max!,
                                });
                              });
                              props.onContextChange?.(getContext());
                              setPrevVisible(index());
                            }
                          }}
                          color={getContext().color[item]}
                          onColorChange={(new_color) => {
                            setContext()("color", item, new_color);
                            props.onContextChange?.(getContext());
                            plot.redraw();
                          }}
                          width="min-content"
                          stroke={getContext().style[item]}
                          onStrokeChange={(new_style) => {
                            setContext()("style", item, new_style);
                            plot.delSeries(item + 1);
                            const config = {
                              stroke: getContext().color[item],
                              label: header,
                              ...(getContext().style[item] ===
                                LegendStroke.Dash && {
                                dash: [10, 5],
                              }),
                              ...(getContext().style[item] ===
                                LegendStroke.Dot && {
                                dash: [0, 5],
                                points: {
                                  show: true,
                                  ...(dotFilter().length !== 0 && {
                                    filter: checkDotFilter,
                                  }),
                                },
                              }),
                            };
                            plot.addSeries(config, item + 1);
                            props.onContextChange?.(getContext());
                            setTimeout(() => {
                              plot.redraw();
                            }, 200);
                          }}
                        />
                      </div>
                    );
                  }}
                </For>
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
