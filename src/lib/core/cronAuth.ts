// A scheduled job is called with `Authorization: Bearer $CRON_SECRET`.
export function cronSecretOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

// For the steps that are safe to run any time (they only bring records in line with the calendar), automated tests on a dev machine can send
// `x-cron-dev: 1` instead of the secret. It is ignored in production.
export function cronDevOk(request: Request): boolean {
  return process.env.NODE_ENV !== 'production' && request.headers.get('x-cron-dev') === '1';
}
