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
    private String image;
    private List<IngredientDto> ingredients;
    private List<StepDto> steps;
    private String createdAt;
    private List<RatingDto> ratings;
    private List<QuestionDto> questions;
    private int likes;

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
