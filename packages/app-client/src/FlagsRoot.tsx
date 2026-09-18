import { FlagProvider, type IConfig } from "@unleash/proxy-client-react";
import type { ReactNode } from "react";

export function FlagsRoot({ config, children }: { config: IConfig; children: ReactNode }) {
  return <FlagProvider config={config}>{children}</FlagProvider>;
}
