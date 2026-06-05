import { Metadata } from "next";
import Link from "next/link";
import scheduleRaw from "@/data/tgex/schedule.json";
import type { Schedule, ScheduleDay, ScheduleEvent } from "@/types/tgex-schedule";

interface ScheduleEventPageProps {
  params: Promise<{ eventId: string }>;
}

const schedule = scheduleRaw as Schedule;

function findEventById(id: string): { event: ScheduleEvent; day: ScheduleDay } | null {
  for (const day of schedule.days) {
    const event = day.events.find((e) => e.id === id);
    if (event) return { event, day };
  }
  return null;
}

export async function generateMetadata({
  params,
}: ScheduleEventPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const result = findEventById(eventId);
  return {
    title: result?.event?.title ?? "Event",
    description: result?.event?.description ?? "Event details",
  };
}

export async function generateStaticParams() {
  const eventIds: { eventId: string }[] = [];
  for (const day of schedule.days) {
    for (const event of day.events) {
      eventIds.push({ eventId: event.id });
    }
  }
  return eventIds;
}

// Color and styling constants matching schedule grid
const C: Record<string, Record<string, string>> = {
  yellow: {
    eventBorder: "border-tgex-yellow/60",
    eventBg: "bg-gradient-to-b from-tgex-yellow/10 to-tgex-yellow/5",
    text: "text-tgex-yellow",
    badge: "bg-tgex-yellow/15",
  },
  orange: {
    eventBorder: "border-tgex-orange/60",
    eventBg: "bg-gradient-to-b from-tgex-orange/10 to-tgex-orange/5",
    text: "text-tgex-orange",
    badge: "bg-tgex-orange/15",
  },
  magenta: {
    eventBorder: "border-tgex-magenta/60",
    eventBg: "bg-gradient-to-b from-tgex-magenta/10 to-tgex-magenta/5",
    text: "text-tgex-magenta",
    badge: "bg-tgex-magenta/15",
  },
  purple: {
    eventBorder: "border-tgex-purple/60",
    eventBg: "bg-gradient-to-b from-tgex-purple/10 to-tgex-purple/5",
    text: "text-tgex-purple",
    badge: "bg-tgex-purple/15",
  },
  indigo: {
    eventBorder: "border-tgex-indigo/60",
    eventBg: "bg-gradient-to-b from-tgex-indigo/10 to-tgex-indigo/5",
    text: "text-tgex-indigo",
    badge: "bg-tgex-indigo/15",
  },
  pink: {
    eventBorder: "border-tgex-pink/60",
    eventBg: "bg-gradient-to-b from-tgex-pink/10 to-tgex-pink/5",
    text: "text-tgex-pink",
    badge: "bg-tgex-pink/15",
  },
};

export default async function ScheduleEventPage({
  params,
}: ScheduleEventPageProps) {
  const { eventId } = await params;
  const result = findEventById(eventId);

  if (!result) {
    return (
      <div className="flex h-screen items-center justify-center bg-tgex-dark">
        <div className="text-center font-lexend">
          <h1 className="mb-4 text-2xl font-bold text-white">Event not found</h1>
          <Link href="/tgex/schedule" className="text-tgex-magenta hover:underline">
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  const { event, day } = result;
  const typeColor =
    C[
      (event.type?.toLowerCase() as keyof typeof C) ||
        event.type?.toLowerCase() ||
        "indigo"
    ] || C.indigo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-tgex-dark to-tgex-dark/80 px-4 py-8 font-lexend sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/tgex/schedule"
          className="mb-6 inline-flex items-center gap-2 text-tgex-magenta hover:underline"
        >
          ← Back to Schedule
        </Link>

        <div className={`rounded-lg border-2 ${typeColor.eventBorder} ${typeColor.eventBg} p-6 sm:p-8`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className={`inline-block rounded-full border ${typeColor.eventBorder} ${typeColor.badge} px-3 py-1 text-xs font-semibold ${typeColor.text}`}>
                  {event.type}
                </span>
                <span className="inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                  {day.label}
                </span>
              </div>

              <h1 className="font-bungee text-3xl uppercase tracking-wide text-white sm:text-4xl">
                {event.title}
              </h1>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Time
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {event.startTime} – {event.endTime}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Location
                </p>
                <p className="mt-1 text-lg font-semibold text-white">{event.roomId}</p>
              </div>
            </div>

            {event.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Details
                </p>
                <p className="mt-2 leading-relaxed text-white/80">{event.description}</p>
              </div>
            )}

            {(event.link || event.streamUrl) && (
              <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
                {event.link && (
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 rounded-full border-2 ${typeColor.eventBorder} ${typeColor.badge} px-4 py-2 font-semibold ${typeColor.text} transition-all hover:brightness-125`}
                  >
                    Learn More →
                  </a>
                )}

                {event.streamUrl && (
                  <a
                    href={event.streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[#9146FF]/60 bg-[#9146FF]/15 px-4 py-2 font-semibold text-[#bf94ff] transition-all hover:brightness-125"
                  >
                    Watch Live on Twitch →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
