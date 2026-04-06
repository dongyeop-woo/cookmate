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
    private int time;
    private String difficulty;
    private int calories;
    private double rating;
    private int likes;
    private int bookmarks;
    private String image;
    private String category;
    private String description;
    private List<IngredientDto> ingredients;
    private List<StepDto> steps;
    private String createdAt;
    private String updatedAt;
    private List<CommentDto> comments;

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
        private int time;
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
    }
}
