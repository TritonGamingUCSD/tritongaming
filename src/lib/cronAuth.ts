// A scheduled job is called with `Authorization: Bearer $CRON_SECRET`. For the jobs that are safe to run any time (they only bring things in line with the
// calendar), automated tests on a dev machine can send `x-cron-dev: 1` instead. It is ignored in production.
export function cronAllowed(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;
  return process.env.NODE_ENV !== 'production' && request.headers.get('x-cron-dev') === '1';
}
