package com.devl.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * 식품의약품안전처 식품영양성분 DB 검색 서비스.
 * HAACP와 달리 생식재료(채소·육류·생선 등)까지 포함해 커버리지가 넓음.
 * 공공데이터포털 OpenAPI 키 필요 — 프론트 노출 금지, 백엔드 프록시로만 호출.
 *
 * 결과는 HACCP 응답과 유사한 평탄화된 형태로 반환 — 프론트에서 merge 시 shape 일치.
 */
@Slf4j
@Service
public class NutriFoodService {

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${nutri.service-key:}")
    private String serviceKey;

    @Value("${nutri.base-url:https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02}")
    private String baseUrl;

    public JsonNode search(String keyword, int page, int size) {
        if (keyword == null || keyword.isBlank()) return empty();
        if (serviceKey == null || serviceKey.isBlank()) {
            log.warn("nutri.service-key 미설정 — 식품영양성분 API 스킵");
            return empty();
        }
        try {
            int pageNo = Math.max(1, page);
            int numOfRows = Math.min(Math.max(size, 1), 100);
            String url = baseUrl
                    + "/getFoodNtrCpntDbInq02"
                    + "?serviceKey=" + URLEncoder.encode(serviceKey, StandardCharsets.UTF_8)
                    + "&type=json"
                    + "&pageNo=" + pageNo
                    + "&numOfRows=" + numOfRows
                    + "&FOOD_NM_KR=" + URLEncoder.encode(keyword.trim(), StandardCharsets.UTF_8);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.debug("식품영양성분 검색: q={}, status={}", keyword, resp.statusCode());
            if (resp.statusCode() != 200) {
                log.warn("식품영양성분 API 응답 오류: {}", resp.statusCode());
                return empty();
            }
            return normalize(objectMapper.readTree(resp.body()));
        } catch (Exception e) {
            log.error("식품영양성분 API 실패: {}", e.getMessage());
            return empty();
        }
    }

    /** 원본 응답을 HACCP와 같은 형태로 평탄화 (prdlstNm/prdkind 등). */
    private JsonNode normalize(JsonNode raw) {
        ObjectNode result = objectMapper.createObjectNode();
        ArrayNode items = objectMapper.createArrayNode();

        // 응답 구조: { response: { body: { items: [ { FOOD_NM_KR, ... } ] } } }
        JsonNode body = raw.path("response").path("body");
        JsonNode itemsNode = body.path("items");

        JsonNode list = null;
        if (itemsNode.isArray()) {
            list = itemsNode;
        } else if (itemsNode.has("item")) {
            list = itemsNode.get("item");
        }

        if (list != null) {
            if (list.isArray()) {
                for (JsonNode it : list) items.add(toFlat(it));
            } else if (list.isObject()) {
                items.add(toFlat(list));
            }
        }

        result.set("items", items);
        result.put("totalCount", body.path("totalCount").asInt(items.size()));
        result.put("pageNo", body.path("pageNo").asInt(1));
        result.put("numOfRows", body.path("numOfRows").asInt(items.size()));
        return result;
    }

    private ObjectNode toFlat(JsonNode it) {
        ObjectNode o = objectMapper.createObjectNode();
        String name = firstText(it, "FOOD_NM_KR", "식품명");
        String group = firstText(it, "FOOD_CAT1_NM", "식품대분류명");
        String code = firstText(it, "ITEM_REPORT_NO", "품목제조보고번호");
        String maker = firstText(it, "MAKER_NM", "업체명");
        // HACCP와 동일 shape
        o.put("prdlstReportNo", code.isEmpty() ? "" : "nutri:" + code);
        o.put("prdlstNm", name);
        o.put("manufacture", maker);
        o.put("seller", "");
        o.put("prdkind", group);
        o.put("prdkindState", "");
        o.put("capacity", "");
        o.put("rawmtrl", "");
        o.put("allergy", "");
        o.put("nutrient", "");
        o.put("barcode", "");
        o.put("imgurl1", "");
        o.put("imgurl2", "");
        return o;
    }

    private String firstText(JsonNode node, String... keys) {
        for (String k : keys) {
            if (node.has(k) && !node.get(k).isNull()) {
                String s = node.get(k).asText("").trim();
                if (!s.isEmpty()) return s;
            }
        }
        return "";
    }

    private JsonNode empty() {
        ObjectNode o = objectMapper.createObjectNode();
        o.set("items", objectMapper.createArrayNode());
        o.put("totalCount", 0);
        o.put("pageNo", 1);
        o.put("numOfRows", 0);
        return o;
    }
}
