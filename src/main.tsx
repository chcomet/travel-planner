import { render } from "preact";
import App from "./App";
import "./styles/global.css";
import "./styles/app.css";

render(<App />, document.getElementById("app")!);
