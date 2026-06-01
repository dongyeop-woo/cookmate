'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';

/**
 * 앱 다운로드 모달 트리거 — QR 코드 + 스토어 버튼.
 * Portal 로 body 최상위에 렌더 — sticky topbar 등 stacking context 영향 안 받게.
 */
export default function AppDownloadModal({
  className,
  children,
}: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const modal = open ? (
    <div className="app-modal-overlay" onClick={() => setOpen(false)}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="app-modal-close"
          aria-label="닫기"
          onClick={() => setOpen(false)}
        >×</button>

        <img className="app-modal-logo" src="/img/appIcon-padded.png" alt="요잘알" />
        <h2 className="app-modal-title">요잘알 앱 다운로드</h2>
        <p className="app-modal-sub">휴대폰 카메라로 QR을 스캔하세요</p>

        <div className="app-modal-qr">
          <QRCode
            value="https://yojalal.com/download"
            size={180}
            bgColor="#FFFFFF"
            fgColor="#0B9A61"
            level="M"
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
