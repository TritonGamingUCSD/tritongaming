import { connectToDatabase } from './db';
import type { Event } from '@/types';
import eventsJson from '@/data/events.json';

const DEFAULT_LIMIT = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(doc: any): Event {
  return {
    _id: doc._id?.toString() ?? '',
    full_name: doc.full_name ?? '',
    name: doc.name ?? '',
    start_date: new Date(doc.start_date).toISOString(),
    end_date: new Date(doc.end_date).toISOString(),
    flyer_url: doc.flyer_url ?? '',
    location: doc.location ?? '',
    content: doc.content ?? '',
    url: doc.url ?? '',
  };
}

export async function getUpcomingEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    const db = await connectToDatabase();
    const now = new Date();
    const docs = await db
      .collection('events')
      .find({ start_date: { $gte: now } })
      .sort({ start_date: 1 })
      .limit(limit)
      .toArray();
    return docs.map(mapEvent);
  } catch {
    const all = eventsJson as Event[];
    return all
      .filter((e) => new Date(e.start_date) >= new Date())
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }
}

export async function getPreviousEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    const db = await connectToDatabase();
    const now = new Date();
    const docs = await db
      .collection('events')
      .find({ start_date: { $lt: now } })
      .sort({ start_date: -1 })
      .limit(limit)
      .toArray();
    return docs.map(mapEvent);
  } catch {
    const all = eventsJson as Event[];
    return all
      .filter((e) => new Date(e.start_date) < new Date())
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }
}

export async function getAllEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    const db = await connectToDatabase();
    const docs = await db
      .collection('events')
      .find({})
      .sort({ start_date: -1 })
      .limit(limit)
      .toArray();
    return docs.map(mapEvent);
  } catch {
    return eventsJson as Event[];
  }
}

export async function getEventById(id: string): Promise<Event | null> {
  try {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) return null;
    const db = await connectToDatabase();
    const doc = await db.collection('events').findOne({ _id: new ObjectId(id) });
    return doc ? mapEvent(doc) : null;
  } catch {
    return null;
  }
}
