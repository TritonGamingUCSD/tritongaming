import NotFoundPoster from '@/components/NotFoundPoster/NotFoundPoster';

// Anything that matches no page at all (the public layout with its nav and footer only wraps pages that exist).
export default function GlobalNotFound() {
  return <main><NotFoundPoster /></main>;
}
