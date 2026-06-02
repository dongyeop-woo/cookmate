'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { STORE_URL } from '@/lib/api';

/**
 * 앱 다운로드 모달 트리거.
 * 데스크탑: QR 코드 (폰 카메라로 스캔)
 * 모바일: App Store / Google Play 직접 이동 버튼
 * Portal 로 body 최상위에 렌더 — sticky topbar 등 stacking context 영향 안 받게.
 */
export default function AppDownloadModal({
  className,
  children,
}: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== 'undefined') {
      setIsMobile(/Android|iPad|iPhone|iPod/i.test(navigator.userAgent || ''));
    }
  }, []);

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
        <p className="app-modal-sub">
          {isMobile ? '스토어에서 바로 받기' : '휴대폰 카메라로 QR을 스캔하세요'}
        </p>

        {isMobile ? (
          <div className="app-modal-stores">
            <a className="app-modal-store" href={STORE_URL.ios} target="_blank" rel="noopener" aria-label="App Store 에서 다운로드">
              <svg className="app-modal-store-logo" width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M17.05 12.04c-.02-2.59 2.12-3.83 2.21-3.89-1.21-1.76-3.08-2-3.75-2.03-1.59-.16-3.11.93-3.92.93-.81 0-2.07-.91-3.4-.89-1.75.03-3.36 1.01-4.26 2.57-1.82 3.15-.46 7.81 1.31 10.36.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84s2.02.84 3.4.81c1.4-.02 2.29-1.27 3.15-2.52 1-1.45 1.41-2.85 1.43-2.92-.03-.01-2.74-1.05-2.77-4.18zM14.55 4.39c.72-.87 1.2-2.09 1.07-3.3-1.04.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.08 3.19 1.16.09 2.34-.59 3.04-1.45z" />
              </svg>
              <div className="app-modal-store-text">
                <small>Download on the</small>
                <strong>App Store</strong>
              </div>
            </a>
            <a className="app-modal-store" href={STORE_URL.android} target="_blank" rel="noopener" aria-label="Google Play 에서 다운로드">
              <svg className="app-modal-store-logo" width="26" height="26" viewBox="0 0 512 512">
                <path fill="#00C3FF" d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1z" />
                <path fill="#FFD400" d="m104.6 499 220.7-221.3 60.1 60.1L104.6 499z" />
                <path fill="#FF3A44" d="M484.6 256.5 385.3 199 325.3 256.5l60.1 60.1 99.2-57.5c19.5-11.2 19.5-31.4 0-2.6z" />
                <path fill="#00E36F" d="M104.6 13c-9.1 4.6-14.6 14.5-14.6 26.6V472.4c0 12.1 5.5 22 14.6 26.6l220.7-220.7L104.6 13z" />
              </svg>
              <div className="app-modal-store-text">
                <small>GET IT ON</small>
                <strong>Google Play</strong>
              </div>
            </a>
          </div>
        ) : (
          <div className="app-modal-qr">
            <QRCode
              value="https://yojalal.com/download"
              size={180}
              bgColor="#FFFFFF"
              fgColor="#0B9A61"
              level="M"
            />
          </div>
        )}
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
