/* @refresh reload */
import "./index.css"; // Necessary for PandaCSS
import { lazy } from "solid-js";
import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";

import App from "./App";
const LogViewer = lazy(() => import("./pages/LogViewer.tsx"));
const Monitoring = lazy(() => import("./pages/Monitoring/Monitoring.tsx"));

render(
  () => (
    <Router root={App}>
      <Route path="/logviewer" component={LogViewer} />
      <Route path="/monitoring" component={Monitoring} />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
