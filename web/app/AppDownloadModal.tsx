'use client';

import { useEffect, useState, ReactNode } from 'react';
import QRCode from 'react-qr-code';
import { STORE_URL } from '@/lib/api';

/**
 * 앱 다운로드 모달 트리거 — QR 코드 + 스토어 버튼.
 * 데스크톱: QR 권장 (휴대폰으로 스캔)
 * 모바일: 바로 스토어로 가는 버튼
 *
 * QR 은 yojalal.com 을 가리킴 — 폰으로 스캔 시 yojalal.com 접속, 거기서 OS 감지하여 스토어 안내.
 */
export default function AppDownloadModal({
  className,
  children,
}: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && (
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

            <div className="app-modal-divider">또는</div>

            <div className="app-modal-stores">
              <a
                className="app-modal-store-btn"
                href={STORE_URL.ios}
                target="_blank"
                rel="noopener"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                App Store
              </a>
              <a
                className="app-modal-store-btn app-modal-store-btn-android"
                href={STORE_URL.android}
                target="_blank"
                rel="noopener"
              >
                <svg width="20" height="20" viewBox="0 0 16.05 17.86" fill="none">
                  <path d="M.16 0a.69.69 0 0 0-.16.46v16.94c0 .19.06.36.16.51l.05.05L9.51 8.93v-.11L.21.05.16 0z" fill="#00C3FF" />
                  <path d="M12.62 12.16l-3.11-3.23V8.81l3.11-3.21.07.04 3.69 2.1c1.05.6 1.05 1.58 0 2.18l-3.69 2.1z" fill="#FFD500" />
                  <path d="M12.69 12.13L9.5 8.87.16 18.32a.83.83 0 0 0 1.06.03l11.47-6.22z" fill="#FF4757" />
                  <path d="M12.69 5.61L1.22.05A.83.83 0 0 0 .16 0l9.34 8.87 3.19-3.26z" fill="#34A853" />
                </svg>
                Google Play
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
