'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';
import { ROLE_LABELS, ROLE_COLORS, ROLE_HIERARCHY } from '@/types/database';
import styles from './members.module.css';

interface Member {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  gamer_tag: string | null;
  created_at: string;
}

interface Request {
  id: string;
  requested_role: UserRole;
  message: string | null;
  status: string;
  created_at: string;
  user: { id: string; display_name: string | null; avatar_url: string | null } | null;
}

export default function MembersClient({
  members: initialMembers,
  requests: initialRequests,
  isAdmin,
}: {
  members: Member[];
  requests: Request[];
  isAdmin: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  async function updateRole(userId: string, newRole: UserRole) {
    setProcessing(userId);
    const supabase = createClient();
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setMembers((m) => m.map((member) => member.id === userId ? { ...member, role: newRole } : member));
    setProcessing(null);
  }

  async function handleRequest(requestId: string, userId: string, role: UserRole, approve: boolean) {
    setProcessing(requestId);
    const supabase = createClient();

    if (approve) {
      await supabase.from('profiles').update({ role }).eq('id', userId);
    }

    await supabase
      .from('member_requests')
      .update({ status: approve ? 'approved' : 'rejected' })
      .eq('id', requestId);

    setRequests((r) => r.filter((req) => req.id !== requestId));

    if (approve) {
      setMembers((m) =>
        m.map((member) => member.id === userId ? { ...member, role } : member)
      );
    }

    setProcessing(null);
  }

  const filtered = members.filter((m) =>
    !filter ||
    m.display_name?.toLowerCase().includes(filter.toLowerCase()) ||
    m.gamer_tag?.toLowerCase().includes(filter.toLowerCase())
  );

  const ASSIGNABLE_ROLES: UserRole[] = ['member', 'officer', 'division', 'lead', 'exec'];
  if (isAdmin) ASSIGNABLE_ROLES.push('admin');

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Members</h1>

      {requests.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Pending Requests ({requests.length})</h2>
          <div className={styles.requestList}>
            {requests.map((req) => {
              const user = Array.isArray(req.user) ? req.user[0] : req.user;
              return (
                <div key={req.id} className={styles.requestRow}>
                  <div className={styles.userInfo}>
                    {user?.avatar_url ? (
                      <Image src={user.avatar_url} alt="" width={36} height={36} className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarFallback}>{(user?.display_name || '?')[0]}</div>
                    )}
                    <div>
                      <div className={styles.userName}>{user?.display_name}</div>
                      <div className={styles.requestMeta}>
                        Requesting: <span style={{ color: ROLE_COLORS[req.requested_role] }}>
                          {ROLE_LABELS[req.requested_role]}
                        </span>
                      </div>
                      {req.message && <div className={styles.requestMessage}>"{req.message}"</div>}
                    </div>
                  </div>
                  <div className={styles.requestActions}>
                    <button
                      className={styles.approveBtn}
                      disabled={processing === req.id}
                      onClick={() => handleRequest(req.id, user!.id, req.requested_role, true)}
                    >
                      Approve
                    </button>
                    <button
                      className={styles.rejectBtn}
                      disabled={processing === req.id}
                      onClick={() => handleRequest(req.id, user!.id, req.requested_role, false)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.memberHeader}>
          <h2 className={styles.sectionLabel}>All Members ({filtered.length})</h2>
          <input
            className={styles.search}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name or tag…"
          />
        </div>

        <div className={styles.memberList}>
          {filtered.map((member) => (
            <div key={member.id} className={styles.memberRow}>
              <div className={styles.userInfo}>
                {member.avatar_url ? (
                  <Image src={member.avatar_url} alt="" width={36} height={36} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>{(member.display_name || '?')[0]}</div>
                )}
                <div>
                  <div className={styles.userName}>{member.display_name}</div>
                  {member.gamer_tag && <div className={styles.gamerTag}>{member.gamer_tag}</div>}
                </div>
              </div>
              <span
                className={styles.roleTag}
                style={{ background: ROLE_COLORS[member.role] + '22', color: ROLE_COLORS[member.role] }}
              >
                {ROLE_LABELS[member.role]}
              </span>
              {isAdmin && (
                <select
                  className={styles.roleSelect}
                  value={member.role}
                  disabled={processing === member.id}
                  onChange={(e) => updateRole(member.id, e.target.value as UserRole)}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
