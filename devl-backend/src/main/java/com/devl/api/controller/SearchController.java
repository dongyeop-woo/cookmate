package com.devl.api.controller;

import com.devl.api.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping("/trending")
    public ResponseEntity<?> trending() {
        try {
            return ResponseEntity.ok(searchService.trending());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/recommended")
    public ResponseEntity<?> recommended() {
        try {
            return ResponseEntity.ok(searchService.recommended());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/log")
    public ResponseEntity<?> log(@RequestBody Map<String, String> body) {
        searchService.log(body.get("keyword"), body.get("type"));
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
