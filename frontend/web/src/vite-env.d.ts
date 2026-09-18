/// <reference types="vite/client" />

import type { HTMLAttributes } from "react";

type AltchaWidgetProps = HTMLAttributes<HTMLElement> & {
  challenge?: string;
  auto?: "off" | "onfocus" | "onload" | "onsubmit";
  display?: "standard" | "bar" | "floating" | "overlay" | "invisible";
  type?: "native" | "checkbox" | "switch";
  hidelogo?: string;
  hidefooter?: string;
  workers?: string;
  key?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "altcha-widget": AltchaWidgetProps;
    }
  }
}
