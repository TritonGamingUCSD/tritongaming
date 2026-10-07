import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { MANAGED_BUCKETS, listAllObjects } from '@/lib/storage/storageBuckets';

interface TableStat {
  name: string;
  row_estimate: number;
  total_bytes: number;
  table_bytes: number;
}

interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
  target: string | null;
  createdAt: number;
}

// Deliberately only the stable, well-documented v9 projects / v6
// deployments endpoints — Vercel's usage/bandwidth analytics APIs are
// plan-gated and less consistent, and this can't be tested against a real
// account without a token in hand, so it sticks to surface area that's
// safe to assume works rather than guessing at an endpoint shape.
async function fetchVercelStats() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    return { connected: false as const };
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const teamQuery = teamId ? `?teamId=${teamId}` : '';
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const [projectRes, deploymentsRes] = await Promise.all([
      fetch(`https://api.vercel.com/v9/projects/${projectId}${teamQuery}`, { headers, cache: 'no-store' }),
      fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=5${teamId ? `&teamId=${teamId}` : ''}`, { headers, cache: 'no-store' }),
    ]);

    if (!projectRes.ok || !deploymentsRes.ok) {
      return { connected: true as const, error: 'Vercel API request failed — check VERCEL_API_TOKEN and VERCEL_PROJECT_ID.' };
    }

    const project = await projectRes.json();
    const deploymentsData = await deploymentsRes.json();
    const deployments: VercelDeployment[] = (deploymentsData.deployments ?? []).map((d: VercelDeployment) => ({
      uid: d.uid, url: d.url, state: d.state, target: d.target, createdAt: d.createdAt,
    }));

    return {
      connected: true as const,
      name: project.name as string,
      framework: project.framework as string | null,
      productionUrl: (project.targets?.production?.alias?.[0] ?? project.alias?.[0]?.domain) as string | undefined,
      deployments,
    };
  } catch {
    return { connected: true as const, error: 'Could not reach the Vercel API.' };
  }
}

export async function GET() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const [dbStatsRes, accountStatsRes, storageResults, vercel] = await Promise.all([
    supabase.rpc('admin_db_stats'),
    supabase.rpc('admin_account_stats'),
    Promise.all(MANAGED_BUCKETS.map(async ({ bucket }) => {
      const objects = await listAllObjects(supabase, bucket);
      return { bucket, objectCount: objects.length, totalBytes: objects.reduce((sum, o) => sum + o.size, 0) };
    })),
    fetchVercelStats(),
  ]);

  const dbStats = dbStatsRes.data as {
    database_bytes: number; tables: TableStat[]; postgres_version: string;
    active_connections: number; rls_enabled_tables: number; total_tables: number;
  } | null;
  const accountStats = accountStatsRes.data as {
    total_accounts: number; multi_identity_accounts: number; no_role_accounts: number; signups_last_30d: number;
  } | null;

  return NextResponse.json({
    database: dbStats ? {
      totalBytes: dbStats.database_bytes,
      postgresVersion: dbStats.postgres_version,
      activeConnections: dbStats.active_connections,
      rlsEnabledTables: dbStats.rls_enabled_tables,
      totalTables: dbStats.total_tables,
      // Top 8 by size — a leaderboard of "what's actually taking up room",
      // not every table (a schema-only table like doc_categories at 8KB
      // isn't worth a row here).
      tables: (dbStats.tables ?? []).slice(0, 8),
    } : null,
    accounts: accountStats,
    storage: storageResults,
    vercel,
    // Node's own runtime version and (on Vercel) the exact commit/branch
    // this response was served from — env vars Vercel sets automatically
    // on every deployment, no API call needed.
    environment: {
      nodeVersion: process.version,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
      vercelEnv: process.env.VERCEL_ENV,
    },
  });
}
