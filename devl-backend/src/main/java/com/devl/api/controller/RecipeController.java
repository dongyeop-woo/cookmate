package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.CategoryDto;
import com.devl.api.dto.RecipeDto;
import com.devl.api.service.RecipeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;

    /**
     * limit/cursor 없이 호출하면 최신 최대 200개를 배열로 반환 (구버전 앱 호환).
     * limit 또는 cursor 파라미터가 들어오면 {items, nextCursor} 객체로 반환.
     */
    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) String tag
    ) throws ExecutionException, InterruptedException {
        if (tag != null && !tag.isBlank()) {
            return ResponseEntity.ok(recipeService.getRecipesByTag(tag));
        }
        if (limit == null && cursor == null) {
            return ResponseEntity.ok(recipeService.getAllRecipes());
        }
        int effectiveLimit = limit != null ? limit : 50;
        RecipeService.Page page = recipeService.getRecipesPage(effectiveLimit, cursor);
        return ResponseEntity.ok(Map.of(
                "items", page.items,
                "nextCursor", page.nextCursor == null ? "" : page.nextCursor
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecipeDto> getById(@PathVariable String id) throws ExecutionException, InterruptedException {
        RecipeDto dto = recipeService.getRecipeById(id);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    /**
     * 일괄 조회 — 여러 레시피 ID를 한 번에 가져옴.
     * 북마크/저장 목록 렌더링 시 N+1 방지 용도.
     * ?ids=id1,id2,id3 (최대 50개)
     */
    @GetMapping("/batch")
    public ResponseEntity<List<RecipeDto>> getBatch(@RequestParam String ids) throws ExecutionException, InterruptedException {
        if (ids == null || ids.isBlank()) return ResponseEntity.ok(List.of());
        List<String> idList = java.util.Arrays.stream(ids.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(50)
                .toList();
        return ResponseEntity.ok(recipeService.getRecipesByIds(idList));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<List<RecipeDto>> getByCategory(@PathVariable String category) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getRecipesByCategory(category));
    }

    @GetMapping("/top")
    public ResponseEntity<List<RecipeDto>> getTop(@RequestParam(defaultValue = "10") int limit) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getTopRecipes(limit));
    }

    @GetMapping("/quick")
    public ResponseEntity<List<RecipeDto>> getQuick(@RequestParam(defaultValue = "15") int maxMinutes) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getQuickRecipes(maxMinutes));
    }

    @PostMapping
    public ResponseEntity<RecipeDto> create(@RequestBody RecipeDto dto, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(recipeService.createRecipe(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecipeDto> update(@PathVariable String id, @RequestBody RecipeDto dto, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(recipeService.updateRecipe(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        recipeService.deleteRecipe(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryDto>> getCategories() throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getAllCategories());
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<RecipeDto> addComment(@PathVariable String id, @RequestBody Map<String, String> body, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        String uid = body.get("uid");
        AuthContext.requireSelf(req, uid);
        RecipeDto.CommentDto comment = RecipeDto.CommentDto.builder()
                .uid(uid)
                .nickname(body.get("nickname"))
                .text(body.get("text"))
                .profileImage(body.get("profileImage"))
                .build();
        RecipeDto dto = recipeService.addComment(id, comment);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<RecipeDto> deleteComment(@PathVariable String id, @PathVariable String commentId)
            throws ExecutionException, InterruptedException {
        RecipeDto dto = recipeService.deleteComment(id, commentId);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/comments/{commentId}/reply")
    public ResponseEntity<?> addCommentReply(
            @PathVariable String id,
            @PathVariable String commentId,
            @RequestParam("uid") String uid,
            @RequestBody java.util.Map<String, String> body) {
        try {
            RecipeDto dto = recipeService.addCommentReply(id, commentId, uid, body.get("reply"));
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/comments/{commentId}/reply")
    public ResponseEntity<?> deleteCommentReply(
            @PathVariable String id,
            @PathVariable String commentId,
            @RequestParam("uid") String uid) {
        try {
            RecipeDto dto = recipeService.deleteCommentReply(id, commentId, uid);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }
}
