import { redirect } from "next/navigation";

export default async function IndieStudio2026({ params }: { params: Promise<{ studio: string }> }) {
  const { studio } = await params;
  redirect(`/indie-games/${studio}`);
}
