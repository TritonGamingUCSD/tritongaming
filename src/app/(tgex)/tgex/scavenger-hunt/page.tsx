import type { Metadata } from "next";
import ScavengerHuntClient from "./scavenger-hunt-client";

export const metadata: Metadata = {
  title: "Scavenger Hunt",
  description:
    "Join the TGEX 2026 Scavenger Hunt! Help TEX stop Overlord XET from destroying the multiverse. Complete quests across four universes and join the Rebellion!",
};

export default function ScavengerHuntPage() {
  return <ScavengerHuntClient />;
}
