package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private String uid;
    private String email;
    private String nickname;
    private String phone;
    private String profileImage;
    private String bio;
    private String gender;
    private List<String> followers;
    private List<String> following;
    private List<String> likedRecipes;
    private List<String> bookmarkedRecipes;
    private int recipeCount;
    private int totalLikes;
    private String role;
    private String pushToken;
    private String createdAt;
    private String updatedAt;

    public void initDefaults() {
        if (followers == null) followers = new ArrayList<>();
        if (following == null) following = new ArrayList<>();
        if (likedRecipes == null) likedRecipes = new ArrayList<>();
        if (bookmarkedRecipes == null) bookmarkedRecipes = new ArrayList<>();
    }
}
