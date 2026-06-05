import { redirect } from "next/navigation";

export default async function Division2026({ params }: { params: Promise<{ division: string }> }) {
  const { division } = await params;
  redirect(`/divisions/${division}`);
}
