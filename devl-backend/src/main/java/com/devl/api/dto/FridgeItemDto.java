package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FridgeItemDto {
    private String id;
    private String uid;
    private String name;
    private String icon;
    private String imageUrl;
    private String addedAt;
    private String expiresAt;
    private String quantity;
    private String storage;
    private List<String> notificationIds;
    /** 사용자가 직접 입력한 커스텀 재료 여부 (HACCP/식약처 API 선택이 아닌 경우 true) */
    private Boolean isCustom;
    /** 원본 출처 키 — HACCP 이면 prdlstReportNo, 공식 큐레이션이면 "common:..." 등. 커스텀은 null. */
    private String sourceKey;
}
