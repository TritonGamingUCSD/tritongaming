'use client';

import type { BoardMember } from '@/app/(main)/team/getBoardMembers';
import { PanelBody } from './BoardSection';
import { useCopyFeedback } from '@/components/MemberCard/useCopyFeedback';
import styles from './BoardSection.module.css';

// Live preview of someone's own officer card for their profile page — the Team
// page's real detail panel (same component, same CSS) shown as it appears when
// a visitor clicks the card, fed from the unsaved form so what they see is
// exactly what will be published.
export default function BoardCardPreview({ member }: { member: BoardMember }) {
  const { copiedKey, copy } = useCopyFeedback();
  return (
    <div className={styles.panel}>
      <PanelBody member={member} copiedKey={copiedKey} onCopy={copy} />
    </div>
  );
}
