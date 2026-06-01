package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class AiRecommendDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private String uid;
        private String query;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Response {
        private List<RecommendItem> recommendations;
        // 무료 사용자에게 남은 횟수 표시용 (premium=null)
        private Integer remainingFreeQuota;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RecommendItem {
        private String recipeId;
        private String title;
        private String reason;
        private String image;
        private String category;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class QuotaResponse {
        private Integer remainingFreeQuota; // null = 프리미엄
        private boolean isPremium;
        private int dailyLimit;
    }
}
