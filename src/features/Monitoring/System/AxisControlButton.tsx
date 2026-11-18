import { IconButton, IconButtonProps } from "~/components/ui/icon-button.tsx";
import { IconDots } from "@tabler/icons-solidjs";
import * as Popover from "~/components/ui/popover.tsx";
import { Input } from "~/components/ui/input.tsx";
import { Button } from "~/components/ui/button.tsx";
import { createSignal, For, Show } from "solid-js";
import { Text } from "~/components/ui/text.tsx";
import * as Select from "~/components/ui/select.tsx";
import { createListCollection } from "@ark-ui/solid";
import { Request_Direction } from "~/proto/mmc/command_pb";

export type AxisControlProps = {
  hasCarrier?: boolean;
  sendingCommand: boolean;
  disableCommandButton: boolean;
  onPull?: (axisDirection: Request_Direction, carrierId: string) => void;
  onPush?: (axisDirection: Request_Direction) => void;
  onStopPull?: () => void;
  onInitialize?: (
    direction: Request_Direction,
    carrierId: string,
    linkAxis?: Request_Direction,
  ) => void;
  onDeinitialize?: () => void;
  stopPullDisabled?: boolean;
};

enum AxisCommandType {
  Pull,
  StopPull,
  Push,
  PullCancel,
  PushCancel,
  Initialize,
  Deinitialize,
  None,
}

export function AxisControlButton(props: AxisControlProps & IconButtonProps) {
  const { onPull, onPush, onStopPull, ...IconButtonProps } = props;

  const [pushDirection, setPushDirection] = createSignal<Request_Direction>(
    Request_Direction.FORWARD,
  );
  const [pullCarrierId, setPullCarrierId] = createSignal<string>("");
  const [pullDirection, setPullDirection] = createSignal<Request_Direction>(
    Request_Direction.BACKWARD,
  );

  const [initializeCarrierId, setInitializeCarrierId] =
    createSignal<string>("");
  const [initializeDirection, setInitializeDirection] =
    createSignal<Request_Direction>(Request_Direction.FORWARD);
  const [initializeLink, setInitializeLink] = createSignal<Request_Direction>(
    Request_Direction.UNSPECIFIED,
  );
  const axisLinkCollection = createListCollection({
    items: [
      {
        label: "None",
        value: "none",
        enumValue: Request_Direction.UNSPECIFIED,
      },
      { label: "Left", value: "forward", enumValue: Request_Direction.FORWARD },
      {
        label: "Right",
        value: "backward",
        enumValue: Request_Direction.BACKWARD,
      },
    ],
  });

  const [lastCommand, setLastCommand] = createSignal<AxisCommandType>(
    AxisCommandType.None,
  );

  const showDirectionLabel = (dir: Request_Direction) => {
    return dir === Request_Direction.FORWARD ? "Forward" : "Backward";
  };

  return (
    <Show when={!props.disableMmcCliButton}>
      <Popover.Root>
        <Popover.Trigger
          width="min-content"
          height={"min-content"}
          disabled={props.disableMmcCliButton}
        >
          <IconButton {...IconButtonProps} disabled={props.disableMmcCliButton}>
            <IconDots />
          </IconButton>
        </Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content width="fit-content" padding="0.5rem">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            {/* Push */}
            <div
              style={{
                width: "100%",
                display: "grid",
                "grid-template-rows": `repeat(2, 1.5rem)`,
                "grid-template-columns": `repeat(2, 4.5rem)`,
                "column-gap": "1rem",
              }}
            >
              <Text
                fontWeight={"bold"}
                textStyle="sm"
                width={`100%`}
                style={{ "grid-row": 1, "grid-column": 1 }}
              >
                {"Push"}
              </Text>
              <Button
                width="2.5rem"
                marginLeft={`calc(100% - 2.5rem)`}
                height={"1.5rem"}
                size="xs"
                fontWeight={"medium"}
                style={{ "grid-row": 1, "grid-column": 2 }}
                variant={props.stopPushDisabled === true ? "solid" : "outline"}
                disabled={
                  props.disableCommandButton
                    ? props.sendingCommand
                      ? lastCommand() !== AxisCommandType.Push &&
                        lastCommand() !== AxisCommandType.None
                      : true
                    : false
                }
                loading={
                  props.sendingCommand &&
                  lastCommand() === AxisCommandType.PushCancel
                }
                onClick={() => {
                  if (
                    props.sendingCommand &&
                    lastCommand() === AxisCommandType.Push
                  ) {
                    props.onStopCommand?.();
                    setLastCommand(AxisCommandType.PushCancel);
                    return;
                  }
                  if (onPush) {
                    onPush(pushDirection());
                    setLastCommand(AxisCommandType.Push);
                    return;
                  }
                }}
              >
                {"Push"}
              </Button>

              <Text
                textStyle="sm"
                style={{
                  "grid-row": 2,
                  "grid-column": 1,
                }}
              >
                {"Direction"}
              </Text>
              <Button
                height="2rem"
                variant="outline"
                onClick={() => {
                  setPushDirection(
                    pushDirection() === Request_Direction.FORWARD
                      ? Request_Direction.BACKWARD
                      : Request_Direction.FORWARD,
                  );
                }}
                style={{
                  "grid-row": 3,
                  "grid-column": 1,
                }}
              >
                {showDirectionLabel(pushDirection())}
              </Button>
            </div>

            {/* Pull */}
            <div
              style={{
                width: "100%",
                "margin-top": "1rem",
                "border-top-width": "1px",
                "padding-top": "0.5rem",
                display: "grid",
                "grid-template-rows": `repeat(5, 1.5rem, 2rem)`,
                "grid-template-columns": `repeat(2, 4.5rem)`,
                "column-gap": "1rem",
              }}
            >
              <Text
                fontWeight={"bold"}
                textStyle="sm"
                width={"100%"}
                style={{ "grid-row": 1, "grid-column": 1 }}
              >
                {"Pull"}
              </Text>
              <Button
                width="2.5rem"
                height={"1.5rem"}
                variant={props.stopPullDisabled === true ? "solid" : "outline"}
                fontWeight={"medium"}
                size="xs"
                marginLeft={`calc(100% - 2.5rem)`}
                style={{ "grid-row": 1, "grid-column": 2 }}
                loading={
                  props.sendingCommand &&
                  lastCommand() === AxisCommandType.PullCancel
                }
                disabled={
                  props.disableCommandButton
                    ? props.sendingCommand
                      ? lastCommand() !== AxisCommandType.Pull &&
                        lastCommand() !== AxisCommandType.StopPull &&
                        lastCommand() !== AxisCommandType.None
                      : true
                    : false
                }
                onClick={() => {
                  if (
                    props.sendingCommand &&
                    (lastCommand() === AxisCommandType.Pull ||
                      lastCommand() === AxisCommandType.StopPull)
                  ) {
                    props.onStopCommand?.();
                    setLastCommand(AxisCommandType.PullCancel);
                    return;
                  }
                  if (props.stopPullDisabled === true && onPull) {
                    onPull(pullDirection(), pullCarrierId());
                    setLastCommand(AxisCommandType.Pull);
                    return;
                  }

                  if (props.stopPullDisabled === false && onStopPull) {
                    onStopPull();
                    setLastCommand(AxisCommandType.StopPull);
                    return;
                  }
                }}
              >
                {props.sendingCommand &&
                (lastCommand() === AxisCommandType.Pull ||
                  lastCommand() === AxisCommandType.StopPull)
                  ? "Cancel"
                  : props.stopPullDisabled === true
                    ? "Pull"
                    : "Stop"}
              </Button>
              <Text textStyle="sm" style={{ "grid-row": 2, "grid-column": 1 }}>
                {"Carrier"}
              </Text>
              <Input
                style={{ "grid-row": 3, "grid-column": 1 }}
                value={pullCarrierId()}
                onInput={(e) => setPullCarrierId(e.target.value)}
                onChange={(e) =>
                  setPullCarrierId(Number(e.target.value).toString())
                }
                height={"2rem"}
                padding="0.2rem"
              />

              <Text textStyle="sm" style={{ "grid-row": 2, "grid-column": 2 }}>
                {"Direction"}
              </Text>
              <Button
                width="4.5rem"
                height="2rem"
                variant="outline"
                style={{ "grid-row": 3, "grid-column": 2 }}
                onClick={() => {
                  setPullDirection(
                    pullDirection() === Request_Direction.FORWARD
                      ? Request_Direction.BACKWARD
                      : Request_Direction.FORWARD,
                  );
                }}
              >
                {showDirectionLabel(pullDirection())}
              </Button>
            </div>

            <div
              style={{
                display: "grid",
                "grid-template-rows": `repeat(5, 1.5rem, 2rem)`,
                "grid-template-columns": `repeat(2, 4.5rem)`,
                "column-gap": "1rem",
                "margin-top": "0.5rem",
                "padding-top": "0.5rem",
                "border-top-width": "1px",
              }}
            >
              <Text
                textStyle="sm"
                fontWeight="bold"
                style={{ "grid-row": 1, "grid-column": 1 }}
              >
                {"Initialize"}
              </Text>
              <Button
                style={{
                  "grid-row": 1,
                  "grid-column": 2,
                  width: "4rem",
                }}
                size="xs"
                fontWeight={"medium"}
                height="1.5rem"
                marginLeft="0.5rem"
                variant={props.hasCarrier ? "outline" : "solid"}
                onClick={() => {
                  if (props.hasCarrier) {
                    setLastCommand(AxisCommandType.Deinitialize);
                    props.onDeinitialize?.();
                  } else {
                    setLastCommand(AxisCommandType.Initialize);
                    props.onInitialize?.(
                      initializeDirection(),
                      initializeCarrierId(),
                      initializeLink() === Request_Direction.UNSPECIFIED
                        ? undefined
                        : initializeLink(),
                    );
                  }
                }}
              >
                {props.hasCarrier ? "Deinitialize" : "Initialize"}
              </Button>
              <Text
                textStyle="sm"
                style={{
                  "grid-row": 2,
                  "grid-column": 1,
                }}
              >
                {"Direction"}
              </Text>
              <Button
                height="2rem"
                variant="outline"
                onClick={() => {
                  setInitializeDirection(
                    initializeDirection() === Request_Direction.FORWARD
                      ? Request_Direction.BACKWARD
                      : Request_Direction.FORWARD,
                  );
                }}
                style={{
                  "grid-row": 3,
                  "grid-column": 1,
                }}
              >
                {showDirectionLabel(initializeDirection())}
              </Button>
              <Text
                textStyle="sm"
                fontWeight="medium"
                style={{ "grid-row": 2, "grid-column": 2 }}
              >
                {"Carrier"}
              </Text>
              <Input
                value={initializeCarrierId()}
                onChange={(e) =>
                  setInitializeCarrierId(Number(e.target.value).toString())
                }
                style={{ "grid-row": 3, "grid-column": 2 }}
                height={"2rem"}
                padding="0.2rem"
              />
              <Text
                textStyle="sm"
                fontWeight="medium"
                style={{
                  "grid-row": 4,
                  "grid-column": 1,
                  opacity:
                    initializeLink() === Request_Direction.UNSPECIFIED
                      ? "0.5"
                      : "1",
                }}
              >
                {"Link Axis"}
              </Text>
              <Select.Root
                style={{
                  "grid-row": 5,
                  "grid-column": 1,
                }}
                positioning={{ sameWidth: true }}
                width="2xs"
                collection={axisLinkCollection}
                defaultValue={[
                  ...axisLinkCollection.items
                    .filter((link) => link.enumValue === initializeLink())
                    .map((item) => item.value),
                ]}
                onValueChange={(v) => {
                  setInitializeLink(v.items[0].enumValue);
                }}
              >
                <Select.Control>
                  <Select.Trigger
                    opacity={
                      initializeLink() === Request_Direction.UNSPECIFIED
                        ? "0.5"
                        : "1"
                    }
                  >
                    <Select.ValueText placeholder={`Link Axis`} />
                  </Select.Trigger>
                </Select.Control>
                <Select.Positioner>
                  <Select.Content>
                    <For each={axisLinkCollection.items}>
                      {(item) => (
                        <Select.Item item={item}>
                          <Select.ItemText>{item.label}</Select.ItemText>
                          <Select.ItemIndicator></Select.ItemIndicator>
                        </Select.Item>
                      )}
                    </For>
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>
            </div>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>
    </Show>
  );
}
