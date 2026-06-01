package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PointHistoryDto {
    private String id;
    private String uid;
    private String type;
    private int amount;
    private String title;
    private String description;
    private String gifticonId;
    private String recipeId;
    private String createdAt;
    // 감사 로그용 — 적립/차감 시점의 요청 IP, User-Agent, 소스 엔드포인트
    private String sourceIp;
    private String sourceUa;
    private String sourceEndpoint;
}
