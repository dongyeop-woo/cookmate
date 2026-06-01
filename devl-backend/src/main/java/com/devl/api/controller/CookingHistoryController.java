package com.devl.api.controller;

import com.devl.api.service.CookingHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/cooking-history")
@RequiredArgsConstructor
public class CookingHistoryController {

    private final CookingHistoryService cookingHistoryService;

    @PostMapping("/complete")
    public ResponseEntity<?> complete(@RequestParam("uid") String uid,
                                       @RequestParam("recipeId") String recipeId) {
        try {
            return ResponseEntity.ok(cookingHistoryService.complete(uid, recipeId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/check")
    public ResponseEntity<?> check(@RequestParam("uid") String uid,
                                    @RequestParam("recipeId") String recipeId) {
        try {
            var record = cookingHistoryService.getRecord(uid, recipeId);
            if (record == null) {
                return ResponseEntity.ok(Map.of("cooked", false));
            }
            return ResponseEntity.ok(Map.of("cooked", true, "cookedAt", record.getCookedAt()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
