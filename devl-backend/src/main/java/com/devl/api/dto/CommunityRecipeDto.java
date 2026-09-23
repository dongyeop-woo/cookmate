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
public class CommunityRecipeDto {
    private String id;
    private String title;
    private String author;
    private String authorUid;
    private String description;
    private String category;
    private int time;
    private String difficulty;
    // 레거시 데이터는 int, 신규 데이터는 "3~4" 같은 String도 허용 (Object로 받음)
    private Object servings;
    private int calories;
    private String image;
    private List<IngredientDto> ingredients;
    private List<StepDto> steps;
    private String createdAt;
    private List<RatingDto> ratings;
    private List<QuestionDto> questions;
    private int likes;
    private String status;
    private String rejectionReason;
    private List<String> images;
    private Integer reviewCount;
    private String approvedAt;
    private Double reviewAvgRating;
    private List<String> tags;
    /**
     * 작성자가 고른 공개 범위. false 면 작성자 본인(과 관리자)에게만 보인다.
     * 이 필드가 생기기 전 문서에는 값이 없으므로 null = 전체공개로 취급한다.
     */
    private Boolean isPublic;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IngredientDto {
        private String name;
        private String amount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepDto {
        private String description;
        private int time;
        private String imageUrl; // 선택적 단계별 사진 URL (Firebase Storage)
        private Boolean isAiImage; // true면 사진 위에 'AI 참고 이미지' 라벨 표시
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RatingDto {
        private String userId;
        private double score;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionDto {
        private String id;
        private String userId;
        private String text;
        private String createdAt;
        private String answer;
        private String answerAt;
    }
}
