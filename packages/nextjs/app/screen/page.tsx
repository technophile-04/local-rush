import type { NextPage } from "next";
import { RushScreen } from "~~/components/rush/screen/RushScreen";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Platform 8 · Mumbai Local Rush",
  description: "The projector screen for Mumbai Local Rush.",
});

const Screen: NextPage = () => <RushScreen />;

export default Screen;
