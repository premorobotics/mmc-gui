import { Stack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Show, For, createSignal, createEffect, on } from "solid-js";
import uPlot from "uplot";
import { IconEyeOff, IconEye } from "@tabler/icons-solidjs";
import { Legend } from "./Legend";
import { PlotContext } from "./Plot";
import { createStore, reconcile } from "solid-js/store";
import { LegendStroke } from "./Legend";

type LegendListProps = {
  plot: uPlot;
  group: string;
  context: PlotContext;
  onContextChange?: (ctx: PlotContext) => void;
  legendIndex: number[];
  cursorIdx: number | null;
  header: string[];
  showLegendCheckbox: boolean;
  enumMapping?: Map<string, Map<number, string>>;
  dotFilter: number[];
  checkDotFilter: () => number[];
};

export function LegendList(props: LegendListProps) {
  const [ctx, setCtx] = createStore(props.context);
  createEffect(
    on(
      () => props.context,
      () => setCtx(reconcile(props.context)),
    ),
  );
  const group = () => props.group;
  const legendIndex = () => props.legendIndex;
  const cursorIdx = () => props.cursorIdx;
  const showLegendCheckBox = () => props.showLegendCheckbox;
  const dotFilter = () => props.dotFilter;

  const [prevVisible, setPrevVisible] = createSignal<number | null>(null);
  const multiVisible = (
    index: number,
    prevIndex: number,
    legendIndexes: number[],
    plot: uPlot,
  ) => {
    const visible = ctx.visible;
    const min = Math.min(index, prevIndex + 1);
    const max = Math.max(index + 1, prevIndex);
    const indexList = legendIndexes.slice(min, max);

    const shiftVisible = indexList.map((item) => visible[item]);
    const shiftVisibleState = [...new Set(shiftVisible)];
    const isAllSame = shiftVisibleState.length !== 2;

    // Prevent selection context changes after plot series visibility changes
    // Plot visibility changes trigger a refresh of the plot API context,
    // which also refreshes the customize plot context.
    const prevSelect = ctx.selected;

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
        setCtx("visible", updateVisible);
        setCtx("selected", prevSelect);
      });
      return;
    }
  };

  const [prevSelect, setPrevSelect] = createSignal<number | null>(null);
  const multiSelect = (
    index: number,
    prevIndex: number,
    legendIndexes: number[],
  ) => {
    const select = ctx.selected;
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
      setCtx("selected", updateSelected);
      return;
    }
  };

  return (
    <>
      <Stack direction="row" gap="0.2rem">
        <IconButton
          size="xs"
          variant="plain"
          onClick={() => {
            const prevSelect = ctx.selected;
            const newVisible = !ctx.visible
              .filter((_, i) => legendIndex().includes(i))
              .includes(true);
            setCtx(
              "visible",
              ctx.visible.map((visible, i) => {
                if (legendIndex().includes(i)) return newVisible;
                else return visible;
              }),
            );
            ctx.visible.forEach((val, i) => {
              props.plot.setSeries(i + 1, {
                show: val,
              });
            });
            setCtx("selected", prevSelect);
            props.onContextChange?.(ctx);
          }}
        >
          <Show
            when={ctx.visible
              .filter((_, i) => legendIndex().includes(i))
              .includes(true)}
            fallback={<IconEye />}
          >
            <IconEyeOff />
          </Show>
        </IconButton>
        <Legend
          plot={props.plot}
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
                plot={props.plot}
                group={group()}
                series={header}
                cursorIdx={cursorIdx()}
                enumValuesMapping={
                  props.enumMapping && props.enumMapping.has(header)
                    ? props.enumMapping.get(header)
                    : undefined
                }
                showSelectCheckBox={showLegendCheckBox()}
                selected={ctx.selected[item]}
                onSelectChange={(isChecked, shiftKey) => {
                  if (shiftKey === true && typeof prevSelect() === "number") {
                    multiSelect(index(), prevSelect()!, legendIndex());
                    setPrevSelect(null);
                    setPrevVisible(null);
                    return;
                  } else {
                    setCtx("selected", item, isChecked);
                    setPrevSelect(index());
                    props.onContextChange?.(ctx);
                  }
                }}
                visible={ctx.visible[item]}
                onVisibleChange={(new_visible, shiftKey) => {
                  if (shiftKey) {
                    if (prevVisible() !== null) {
                      multiVisible(
                        index(),
                        prevVisible()!,
                        legendIndex(),
                        props.plot,
                      );
                    }
                    setPrevSelect(null);
                    setPrevVisible(null);
                    return;
                  } else {
                    setCtx("visible", item, new_visible);
                    // Index must add 1 to account for X-axis "Cycle" series
                    props.plot.batch(() => {
                      props.plot.setSeries(item + 1, {
                        show: new_visible,
                      });
                      props.plot.setScale("y", {
                        min: props.plot.scales.y.min!,
                        max: props.plot.scales.y.max!,
                      });
                    });
                    props.onContextChange?.(ctx);
                    setPrevVisible(index());
                  }
                }}
                color={ctx.color[item]}
                onColorChange={(new_color) => {
                  setCtx("color", item, new_color);
                  props.onContextChange?.(ctx);
                  props.plot.redraw();
                }}
                width="min-content"
                stroke={ctx.style[item]}
                onStrokeChange={(new_style) => {
                  setCtx("style", item, new_style);
                  props.plot.delSeries(item + 1);
                  const config = {
                    stroke: ctx.color[item],
                    label: header,
                    ...(ctx.style[item] === LegendStroke.Dash && {
                      dash: [10, 5],
                    }),
                    ...(ctx.style[item] === LegendStroke.Dot && {
                      dash: [0, 5],
                      points: {
                        show: true,
                        ...(dotFilter().length !== 0 && {
                          filter: props.checkDotFilter,
                        }),
                      },
                    }),
                  };
                  props.plot.addSeries(config, item + 1);
                  props.onContextChange?.(ctx);
                  setTimeout(() => {
                    props.plot.redraw();
                  }, 200);
                }}
              />
            </div>
          );
        }}
      </For>
    </>
  );
}
