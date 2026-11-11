import { Accessor, createContext, createSignal, Setter } from "solid-js";
import { createStore, SetStoreFunction, Store } from "solid-js/store";
import { PanelSizeContext } from "~/components/Panel/PanelLayout.tsx";
import { TabListContext } from "~/components/Tab/TabList.tsx";
import { IpAddress } from "~/features/Monitoring/MonitoringSidebar/IpHistory";

const [globalState, setGlobalState] = createStore({
  theme: "light",
} as GlobalState);
export { globalState, setGlobalState };

export type Theme = "light" | "dark";

export type GlobalState = {
  theme: Theme;
};

export type Port = {
  id: string;
  version: string;
};

export const GlobalStateContext = createContext<{
  globalState: GlobalState;
  setGlobalState: SetStoreFunction<GlobalState>;
}>();

export const [apiVersion, setApiVersion] = createSignal<string>("");

type PageKeys = Map<string, string>;
export const pageKeys: PageKeys = new Map();

type PanelStore = Map<
  string,
  [Accessor<PanelSizeContext[]>, Setter<PanelSizeContext[]>]
>;
export const panelStore: PanelStore = new Map();

type TabStore = Map<
  string,
  [Store<TabListContext>, SetStoreFunction<TabListContext>]
>;
export const tabStore: TabStore = new Map();

export enum Pages {
  LogViewer = "logViewer",
  Monitoring = "monitoring",
  None = "none",
}

export const [page, setPage] = createSignal<Pages>(Pages.None);

export type MonitoringInputs = Map<string, [Accessor<string>, Setter<string>]>;
export const monitoringInputs: MonitoringInputs = new Map();

export const [detectedServer, setDetectedServer] = createSignal<IpAddress[]>(
  [],
);

export const [ipHistory, setIpHistory] = createSignal<IpAddress[]>([]);
