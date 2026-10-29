// Lets a page take the text of a scan before the portal's Scan button does what it normally does. A page that knows what to do with a scan (Logistics' event day marks a device) registers
// a handler while it is open; the Scan button (UniversalScanner) offers every scan to the handlers first, and only if none takes it looks for a TGcode or a portal link.
// A handler returns true when the text is its own and says what happened with `say` (shown over the camera). Both are plain functions, nothing is stored.
export type ScanHandler = (text: string, say: (message: string, ok: boolean) => void) => boolean;

const handlers = new Set<ScanHandler>();

export function registerScanHandler(h: ScanHandler): () => void {
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
}

export function offerToScanHandlers(text: string, say: (message: string, ok: boolean) => void): boolean {
  for (const h of handlers) if (h(text, say)) return true;
  return false;
}
