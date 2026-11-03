import { useSyncExternalStore } from "react";
import { useChainRush } from "./useChainRush";
import { useMockRush } from "./useMockRush";
import type { RushSource } from "~~/types/rush";

const noopSubscribe = () => () => undefined;

/** True when the page URL has `?mock=1`. False during SSR and hydration. */
export const useIsMock = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("mock") === "1",
    () => false,
  );

/** The only data entry point for game components: the mock crowd with `?mock=1`, else the chain. */
export const useRush = (): RushSource => {
  const isMock = useIsMock();
  // Both hooks always run so hook order stays stable; the mock one is inert unless enabled.
  const mock = useMockRush(isMock);
  const chain = useChainRush();
  return isMock ? mock : chain;
};
