'use client';

import { useState } from 'react';
import { resolveProfileImage } from '@/lib/api';

type Props = {
  profileImage?: string;
  gender?: string;
  alt?: string;
  className?: string;
};

/**
 * 셰프 아바타 — 이미지 로드 실패 시 성별 기반 fallback 으로 자동 교체.
 * Firebase Storage URL 이 만료되거나 깨진 케이스 처리.
 */
export default function ChefAvatar({ profileImage, gender, alt, className }: Props) {
  const initial = resolveProfileImage(profileImage, gender);
  const fallback = resolveProfileImage(undefined, gender); // http URL 없으면 강제로 기본 이미지
  const [src, setSrc] = useState(initial);

  return (
    <img
      className={className}
      src={src}
      alt={alt ?? ''}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}
