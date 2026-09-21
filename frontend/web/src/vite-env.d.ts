/// <reference types="vite/client" />

import type { HTMLAttributes } from "react";

interface ImportMetaEnv {
  readonly VITE_UNLEASH_URL?: string;
  readonly VITE_UNLEASH_CLIENT_KEY?: string;
  readonly VITE_OPENPANEL_ENABLED?: string;
  readonly VITE_OPENPANEL_API_URL?: string;
  readonly VITE_OPENPANEL_CLIENT_ID?: string;
  readonly VITE_ALTCHA_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
