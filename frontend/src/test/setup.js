import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
// Node's fetch adapter lets MSW intercept requests without jsdom's XHR transport.
import { api } from "../services/courseApi";
api.defaults.adapter = "fetch";
