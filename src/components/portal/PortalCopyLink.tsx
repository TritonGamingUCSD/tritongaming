'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Download, QrCode } from 'lucide-react';
import Popover from '@/components/ui/Popover';
import Button from '@/components/ui/Button';
import StyledQRCode, { type StyledQRCodeHandle } from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import { QR_PRESETS } from '@/lib/qr/qrPresets';
import { showToast } from '@/lib/ui/toast';
import styles from './PortalThemeToggle.module.css';
import qr from './PortalShare.module.css';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    t.remove();
  }
}

// Share this exact view: the header's Copy link, and a QR button that opens the code for the same address with Download and Copy image.
// Section, tab, subtab, the open doc, filters and search all live in the address, so the link and the code both open what is on screen.
export default function PortalCopyLink() {
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const [copiedImg, setCopiedImg] = useState(false);
  const dark = QR_PRESETS.find((p) => p.id === 'triton-dark')?.style;
  // The code follows the theme the person is using right now: the Triton light look in light mode, the navy-and-yellow Triton Night in dark mode.
  const [look, setLook] = useState<'light' | 'dark'>('light');
  const btn = useRef<HTMLButtonElement>(null);
  const code = useRef<StyledQRCodeHandle>(null);

  const copy = async () => {
    await copyText(window.location.href);
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  };
  const toggleQr = () => {
    setHref(window.location.href);
    setLook(document.documentElement.getAttribute('data-pp-theme') === 'dark' ? 'dark' : 'light');
    setOpen((v) => !v);
  };
  const title = () => { try { return `tg-${new URL(href).pathname.replace(/^\/portal\/?/, '').replace(/[^a-z0-9]+/gi, '-') || 'portal'}-qr`; } catch { return 'tg-portal-qr'; } };

  return (
    <>
      <button type="button" className={`${styles.btn} ${styles.wide}`} onClick={copy} title="Copy a link to exactly this view">{done ? 'Copied' : 'Copy link'}</button>
      <button ref={btn} type="button" className={styles.btn} onClick={toggleQr} aria-expanded={open} aria-haspopup="dialog" aria-label="QR code for this page" title="QR code for this page"><QrCode size={17} aria-hidden="true" /></button>
      {open && (
        <Popover anchor={btn} onClose={() => setOpen(false)} width={340} label="QR code for this page">
          <div className={qr.box}>
            <div className={`${qr.tile} ${look === 'dark' ? qr.tileDark : ''}`}><StyledQRCode ref={code} className={qr.code} options={{ ...DEFAULT_QR_OPTIONS, ...(look === 'dark' && dark ? dark : {}), data: href, size: 640, downloadFormat: 'png' }} /></div>
            <p className={qr.url} title={href}>{href.replace(/^https?:\/\//, '')}</p>
            <div className={qr.actions}>
              <Button size="sm" onClick={() => void code.current?.download(title())}><Download size={14} aria-hidden="true" /> Download</Button>
              <Button size="sm" variant="secondary" onClick={async () => { const ok = await code.current?.copy(); if (ok) { setCopiedImg(true); window.setTimeout(() => setCopiedImg(false), 1600); } else showToast('Your browser would not copy the image. Use Download instead.'); }}>
                {copiedImg ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy image</>}
              </Button>
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}
