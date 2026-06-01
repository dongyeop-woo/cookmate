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
public class RecipeDto {
    private String id;
    private String title;
    private String author;
    private double time;
    private String difficulty;
    private int calories;
    // 레거시 데이터는 int, 신규 데이터는 "3~4" 같은 String도 허용 (Object로 받음)
    private Object servings;
    private double rating;
    private int likes;
    private String image;
    private String category;
    private String description;
    private List<IngredientDto> ingredients;
    private List<StepDto> steps;
    private String createdAt;
    private String updatedAt;
    private List<CommentDto> comments;
    private Integer reviewCount;
    private Double reviewAvgRating;
    private List<String> tags;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IngredientDto {
        private String name;
        private String amount;
        private String icon;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepDto {
        private int step;
        private String description;
        private double time;
        private String imageUrl; // 선택적 단계별 사진 URL (Firebase Storage)
        private Boolean isAiImage; // true면 사진 위에 'AI 참고 이미지' 라벨 표시
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentDto {
        private String id;
        private String uid;
        private String nickname;
        private String text;
        private String createdAt;
        private String profileImage;
        private String reply;
        private String replyAuthorNickname;
        private String replyAuthorRole; // "author" or "admin"
        private String replyCreatedAt;
    }
}
