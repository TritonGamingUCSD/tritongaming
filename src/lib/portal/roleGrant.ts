export interface RoleRow { role: string; division_id: string | null }

/** Adding one role to someone's existing roles. An officer, lead or other plain role replaces the same role (one each); a division role is added next to any
 *  divisions they already lead. Returns null when they already have it, so nothing changes. Shared by the bulk role tool and role request approval. */
export function withRole(existing: RoleRow[], role: string, divisionId: string | null): RoleRow[] | null {
  const has = role === 'division' ? existing.some((r) => r.role === 'division' && r.division_id === divisionId) : existing.some((r) => r.role === role);
  if (has) return null;
  return role === 'division' ? [...existing, { role, division_id: divisionId }] : [...existing.filter((r) => r.role !== role), { role, division_id: null }];
}
