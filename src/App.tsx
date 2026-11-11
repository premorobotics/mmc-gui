import "./App.css";

import { invoke } from "@tauri-apps/api/core";
import {
  createEffect,
  createSignal,
  Index,
  on,
  onMount,
  Show,
  ValidComponent,
} from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";
import { useNavigate } from "@solidjs/router";

import {
  IconDeviceAnalytics,
  IconDeviceDesktopSearch,
  IconInfoCircle,
  IconMoonFilled,
  IconSunFilled,
} from "@tabler/icons-solidjs";

import {
  globalState,
  GlobalStateContext,
  page,
  Pages,
  setGlobalState,
  setPage,
  Theme,
  setApiVersion,
  apiVersion,
  setIpHistory,
} from "./store/GlobalState.ts";

import { Text } from "~/components/ui/text.tsx";

//@ts-ignore This file is generate after run compiler.
import api from "src-tauri/generated/api.json";
import { load } from "@tauri-apps/plugin-store";
import { IpAddress } from "./features/Monitoring/MonitoringSidebar/IpHistory.tsx";
import { Toaster } from "./components/ui/toast.tsx";
import { css } from "styled-system/css/css";
import * as Popover from "./components/ui/popover.tsx";
import { IconButton } from "./components/ui/icon-button.tsx";
import { Portal } from "solid-js/web";
import { Button } from "./components/ui/button.tsx";

type PageMeta = {
  icon: ValidComponent;
  label: string;
  disabled: boolean;
};

function App(props: RouteSectionProps) {
  // Necessary for light/dark mode detection
  onMount(async () => {
    const prefers_dark = globalThis.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    let theme_str: Theme = prefers_dark ? "dark" : "light";

    if (typeof localStorage !== "undefined" && localStorage.getItem("theme")) {
      theme_str = localStorage.getItem("theme")! as Theme;
    }

    document.documentElement.dataset.theme = theme_str;
    setGlobalState("theme", theme_str);

    detectApiVersion();

    const prebuildFunctions = [getStoreValues()];
    await Promise.allSettled(prebuildFunctions);
    setPage(Pages.Monitoring);
  });

  function detectApiVersion() {
    const findApi = /protobuf-api-/;
    const findApiIndex = api.findIndex(
      (version: object) =>
        "name" in version &&
        typeof version.name === "string" &&
        findApi.test(version.name),
    );

    const apiRegex = /[0-9]+\.[0-9]+\.[0-9]+$/;
    const apiVersionNum = api[findApiIndex].name.match(apiRegex);
    if (apiVersionNum) {
      setApiVersion(apiVersionNum[0]);
    }
  }

  // Get local storage values using the Tauri store API.
  async function getStoreValues() {
    const store = await load("store.json", {
      defaults: {
        ipHistory: undefined,
      },
      autoSave: false,
    });
    const hasIpHistory = await store.has("ipHistory");
    if (hasIpHistory) {
      const getIpHistory = (await store.get("ipHistory")) as IpAddress[];
      setIpHistory(getIpHistory);
    }
  }

  const [version, setVersion] = createSignal("0.0.0");
  invoke("version").then((ver) => setVersion(ver as string));

  const navigate = useNavigate();

  const pages: { [url: string]: PageMeta } = {
    monitoring: {
      icon: IconDeviceDesktopSearch,
      label: "Monitoring",
      disabled: false,
    },
    logViewer: {
      icon: IconDeviceAnalytics,
      label: "Log Viewer",
      disabled: false,
    },
  };

  const navbarHeight = "2rem";

  const applyTheme = (theme: "light" | "dark") => {
    document.documentElement.dataset.theme = theme;
    setGlobalState("theme", theme);
    localStorage.setItem("theme", theme);
  };

  const toggleTheme = () => {
    applyTheme(globalState.theme === "light" ? "dark" : "light");
  };

  createEffect(
    on(
      () => page(),
      () => {
        if (page() !== Pages.None) {
          navigate("/" + page().toLowerCase(), {
            replace: true,
          });
        }
      },
      { defer: true },
    ),
  );

  return (
    <GlobalStateContext.Provider value={{ globalState, setGlobalState }}>
      <div
        style={{
          width: navbarHeight,
          height: "100vh",
          position: "fixed",
        }}
        onDrop={(e) => e.stopPropagation()}
      >
        <div
          class={css({ background: "gray.2" })}
          style={{
            width: "100vw",
            height: navbarHeight,
            display: "grid",
            "grid-template-columns": `calc(100% - 4rem) 2rem 2rem`,
            "border-bottom-width": "1px",
          }}
        >
          <div
            id="collapsed_side_bar"
            style={{
              width: `100%`,
              height: `calc(${navbarHeight} - 1px)`,
              "border-width": "0",
              "grid-row": 1,
              "grid-column": 1,
              "align-items": "center",
              "padding-left": "0.1rem",
            }}
          >
            <Index each={Object.keys(pages)}>
              {(val) => (
                <Show when={!pages[val()].disabled}>
                  <Button
                    class={css({
                      width: "min-content",
                      height: navbarHeight,
                      alignItems: "center",
                      whiteSpace: "nowrap",
                      transition: "background ease-in-out 0.2s",
                      _hover: {
                        background:
                          page() === val()
                            ? "transparent"
                            : "gray.plain.bg.hover",
                      },
                    })}
                    variant="plain"
                    disabled={pages[val()].disabled}
                    onClick={() => setPage(val() as Pages)}
                  >
                    <Text
                      textStyle="sm"
                      opacity={page().toString() === val() ? "1" : "0.6"}
                    >
                      {pages[val()].label}
                    </Text>
                  </Button>
                </Show>
              )}
            </Index>
          </div>
          <IconButton
            variant="plain"
            onclick={toggleTheme}
            size="xs"
            gridRow={1}
            gridColumn={2}
          >
            <Show
              when={globalState.theme === "dark"}
              fallback={<IconSunFilled />}
            >
              <IconMoonFilled />
            </Show>
          </IconButton>
          <Popover.Root>
            <Popover.Trigger gridRow={1} gridColumn={3}>
              <IconButton size="xs" variant="plain">
                <IconInfoCircle />
              </IconButton>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content background={"gray.1"} padding="0.5rem">
                  <Popover.Arrow>
                    <Popover.ArrowTip />
                  </Popover.Arrow>
                  <div
                    id="versions-footer"
                    style={{
                      display: "grid",
                      "grid-template-columns": "6rem auto",
                    }}
                  >
                    <Text
                      textStyle="sm"
                      fontWeight="light"
                      style={{
                        "grid-row": 1,
                        "grid-column": 1,
                      }}
                    >
                      <i>GUI Version:</i>
                    </Text>
                    <Text
                      textStyle="sm"
                      fontWeight="light"
                      style={{
                        "grid-row": 1,
                        "grid-column": 2,
                      }}
                    >
                      {version()}
                    </Text>
                    <Text
                      textStyle="sm"
                      fontWeight="light"
                      style={{
                        "grid-row": 2,
                        "grid-column": 1,
                      }}
                    >
                      <i>API Version:</i>
                    </Text>
                    <Text
                      textStyle="sm"
                      fontWeight="light"
                      style={{
                        "grid-row": 2,
                        "grid-column": 2,
                      }}
                    >
                      {apiVersion()}
                    </Text>
                  </div>
                  <Text
                    as="div"
                    textStyle="sm"
                    fontWeight="light"
                    textAlign="center"
                    marginTop="0.5rem"
                  >
                    <i>{`Copyright © 2024-${new Date().getFullYear()} PMF, Inc.`}</i>
                  </Text>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        </div>
      </div>
      <div
        style={{
          width: "100vw",
          height: `calc(100vh - ${navbarHeight})`,
          "margin-top": navbarHeight,
          position: "fixed",
        }}
      >
        {props.children}
      </div>
      <Toaster />
    </GlobalStateContext.Provider>
  );
}

export default App;
