package com.devl.api.controller;

import com.devl.api.service.CommonIngredientService;
import com.devl.api.service.HaccpService;
import com.devl.api.service.HaccpService.HaccpQuery;
import com.devl.api.service.NutriFoodService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/**
 * 통합 재료 검색 — HACCP(가공식품 + 이미지) + 식약처 영양 DB(생식재료) + 공통 재료 curated 리스트.
 * 세 소스를 병합 후 이름 기준 중복 제거. 생고기/채소처럼 API가 못 잡는 일반 이름도 커버.
 */
@RestController
@RequestMapping("/api/food")
@RequiredArgsConstructor
public class FoodSearchController {

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private final HaccpService haccpService;
    private final NutriFoodService nutriFoodService;
    private final CommonIngredientService commonIngredientService;

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam("q") String keyword,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "30") int size
    ) {
        if (keyword == null || keyword.isBlank()) {
            return ResponseEntity.ok(emptyResult());
        }
        try {
            HaccpQuery hq = new HaccpQuery();
            hq.prdlstNm = keyword;
            hq.pageNo = page;
            hq.numOfRows = size;

            CompletableFuture<JsonNode> fHaccp = CompletableFuture.supplyAsync(() -> haccpService.search(hq));
            CompletableFuture<JsonNode> fNutri = CompletableFuture.supplyAsync(() -> nutriFoodService.search(keyword, page, size));
            CompletableFuture.allOf(fHaccp, fNutri).join();

            JsonNode haccpJson = fHaccp.get();
            JsonNode nutriJson = fNutri.get();

            ArrayNode merged = objectMapper.createArrayNode();
            Set<String> seen = new HashSet<>();

            // 1순위: 공통 재료 curated 리스트 (생고기/채소 등 깔끔한 이름)
            JsonNode common = commonIngredientService.search(keyword, 10);
            if (common.isArray()) {
                for (JsonNode it : common) {
                    String key = normalizeName(it.path("prdlstNm").asText(""));
                    if (key.isEmpty() || seen.contains(key)) continue;
                    seen.add(key);
                    merged.add(it);
                }
            }

            // 2순위: HACCP (이미지 보유 가공식품)
            JsonNode hItems = haccpJson.path("items");
            if (hItems.isArray()) {
                for (JsonNode it : hItems) {
                    String key = normalizeName(it.path("prdlstNm").asText(""));
                    if (key.isEmpty() || seen.contains(key)) continue;
                    seen.add(key);
                    merged.add(it);
                }
            }

            // 3순위: 식약처 (상세 영양 정보)
            JsonNode nItems = nutriJson.path("items");
            if (nItems.isArray()) {
                for (JsonNode it : nItems) {
                    String key = normalizeName(it.path("prdlstNm").asText(""));
                    if (key.isEmpty() || seen.contains(key)) continue;
                    seen.add(key);
                    merged.add(it);
                }
            }

            ObjectNode result = objectMapper.createObjectNode();
            result.set("items", merged);
            result.put("totalCount", merged.size());
            result.put("pageNo", page);
            result.put("numOfRows", merged.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    private String normalizeName(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("\\s+", "").trim();
    }

    private JsonNode emptyResult() {
        ObjectNode o = objectMapper.createObjectNode();
        o.set("items", objectMapper.createArrayNode());
        o.put("totalCount", 0);
        o.put("pageNo", 1);
        o.put("numOfRows", 0);
        return o;
    }
}
