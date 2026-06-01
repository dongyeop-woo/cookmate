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
 * 한국식품안전관리인증원 HACCP 제품이미지/포장지표기정보 서비스 연동.
 * 공공데이터포털 Open API — 앱 직접 호출 대신 백엔드 프록시로 키 은닉.
 */
@Slf4j
@Service
public class HaccpService {

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${haccp.service-key:}")
    private String serviceKey;

    @Value("${haccp.base-url:}")
    private String baseUrl;

    /**
     * 제품명만 사용하는 간편 검색 (하위 호환).
     */
    public JsonNode search(String keyword, int pageNo, int numOfRows) {
        HaccpQuery q = new HaccpQuery();
        q.prdlstNm = keyword;
        q.pageNo = pageNo;
        q.numOfRows = numOfRows;
        return search(q);
    }

    /**
     * 다중 필터 검색. HACCP API의 모든 request parameter 지원.
     * - prdlstReportNo: 품목보고번호 (정확 조회)
     * - prdlstNm: 제품명
     * - prdkind: 유형명
     * - manufacture: 제조원
     * - allergy: 알레르기 유발물질
     */
    public JsonNode search(HaccpQuery q) {
        boolean hasAny = (q.prdlstReportNo != null && !q.prdlstReportNo.isBlank())
                || (q.prdlstNm != null && !q.prdlstNm.isBlank())
                || (q.prdkind != null && !q.prdkind.isBlank())
                || (q.manufacture != null && !q.manufacture.isBlank())
                || (q.allergy != null && !q.allergy.isBlank());
        if (!hasAny) return emptyResult();

        try {
            int pageNo = Math.max(1, q.pageNo);
            int numOfRows = Math.min(Math.max(q.numOfRows, 1), 100);

            StringBuilder url = new StringBuilder(baseUrl)
                    .append("/getCertImgListServiceV3")
                    .append("?serviceKey=").append(URLEncoder.encode(serviceKey, StandardCharsets.UTF_8))
                    .append("&returnType=json")
                    .append("&numOfRows=").append(numOfRows)
                    .append("&pageNo=").append(pageNo);
            appendParam(url, "prdlstReportNo", q.prdlstReportNo);
            appendParam(url, "prdlstNm", q.prdlstNm);
            appendParam(url, "prdkind", q.prdkind);
            appendParam(url, "manufacture", q.manufacture);
            appendParam(url, "allergy", q.allergy);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url.toString()))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.debug("HACCP 검색: q={}, status={}", q, response.statusCode());

            if (response.statusCode() != 200) {
                return errorResult("HACCP API 응답 오류: " + response.statusCode());
            }

            return normalize(objectMapper.readTree(response.body()));
        } catch (Exception e) {
            log.error("HACCP 검색 실패: q={}, error={}", q, e.getMessage());
            return errorResult(e.getMessage());
        }
    }

    private void appendParam(StringBuilder url, String key, String value) {
        if (value == null || value.isBlank()) return;
        url.append('&').append(key).append('=')
           .append(URLEncoder.encode(value.trim(), StandardCharsets.UTF_8));
    }

    /** HACCP 검색 요청 객체. */
    public static class HaccpQuery {
        public String prdlstReportNo;
        public String prdlstNm;
        public String prdkind;
        public String manufacture;
        public String allergy;
        public int pageNo = 1;
        public int numOfRows = 20;

        @Override
        public String toString() {
            return "HaccpQuery(prdlstNm=" + prdlstNm + ", prdkind=" + prdkind
                    + ", manufacture=" + manufacture + ", allergy=" + allergy
                    + ", reportNo=" + prdlstReportNo + ", page=" + pageNo + ")";
        }
    }

    /**
     * 원본 응답을 앱에서 쓰기 쉬운 평탄화된 포맷으로 정규화.
     * 공공데이터 API 응답 구조가 들쭉날쭉해서 방어적으로 파싱.
     */
    private JsonNode normalize(JsonNode raw) {
        ObjectNode result = objectMapper.createObjectNode();
        ArrayNode items = objectMapper.createArrayNode();

        JsonNode body = findFirst(raw, "body");
        JsonNode itemsNode = findFirst(body, "items");

        // items가 배열일 수도 { item: [...] }일 수도 { item: {} }일 수도 있음
        JsonNode list = null;
        if (itemsNode != null) {
            if (itemsNode.isArray()) {
                list = itemsNode;
            } else if (itemsNode.has("item")) {
                list = itemsNode.get("item");
            }
        }

        if (list != null) {
            if (list.isArray()) {
                list.forEach(item -> items.add(toFlat(item)));
            } else if (list.isObject()) {
                items.add(toFlat(list));
            }
        }

        result.set("items", items);
        result.put("totalCount", body != null && body.has("totalCount") ? body.get("totalCount").asInt(0) : items.size());
        result.put("pageNo", body != null && body.has("pageNo") ? body.get("pageNo").asInt(1) : 1);
        result.put("numOfRows", body != null && body.has("numOfRows") ? body.get("numOfRows").asInt(items.size()) : items.size());
        return result;
    }

    private ObjectNode toFlat(JsonNode item) {
        // 때때로 { item: {...} }로 감싸져 오기도 함
        JsonNode src = item.has("item") && !item.has("prdlstNm") ? item.get("item") : item;
        ObjectNode o = objectMapper.createObjectNode();
        o.put("prdlstReportNo", src.path("prdlstReportNo").asText(""));
        o.put("prdlstNm", src.path("prdlstNm").asText(""));
        o.put("manufacture", src.path("manufacture").asText(""));
        o.put("seller", src.path("seller").asText(""));
        o.put("prdkind", src.path("prdkind").asText(""));
        o.put("prdkindState", src.path("prdkindState").asText(""));
        o.put("capacity", src.path("capacity").asText(""));
        o.put("rawmtrl", src.path("rawmtrl").asText(""));
        o.put("allergy", src.path("allergy").asText(""));
        o.put("nutrient", src.path("nutrient").asText(""));
        o.put("barcode", src.path("barcode").asText(""));
        o.put("imgurl1", toHttps(src.path("imgurl1").asText("")));
        o.put("imgurl2", toHttps(src.path("imgurl2").asText("")));
        return o;
    }

    /**
     * HACCP 원본 응답이 http:// 로 오는데 iOS ATS / Android cleartext 정책 때문에
     * 앱에서 이미지가 차단된다. haccp.or.kr이 https도 지원하므로 강제 업그레이드.
     */
    private String toHttps(String url) {
        if (url == null || url.isEmpty()) return url;
        if (url.startsWith("http://")) return "https://" + url.substring(7);
        return url;
    }

    private JsonNode findFirst(JsonNode node, String fieldName) {
        if (node == null || node.isMissingNode()) return null;
        if (node.has(fieldName)) return node.get(fieldName);
        // 때때로 루트가 { response: { body: ... } } 형태
        if (node.has("response")) return findFirst(node.get("response"), fieldName);
        return null;
    }

    private JsonNode emptyResult() {
        ObjectNode o = objectMapper.createObjectNode();
        o.set("items", objectMapper.createArrayNode());
        o.put("totalCount", 0);
        o.put("pageNo", 1);
        o.put("numOfRows", 0);
        return o;
    }

    private JsonNode errorResult(String message) {
        ObjectNode o = (ObjectNode) emptyResult();
        o.put("error", message);
        return o;
    }
}
