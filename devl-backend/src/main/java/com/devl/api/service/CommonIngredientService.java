package com.devl.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 한국 가정에서 자주 쓰는 생재료 curated 리스트.
 * HAACP/식약처 API가 커버 못 하는 일반적인 재료명을 보강.
 */
@Service
public class CommonIngredientService {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /** 자주 쓰는 재료 (이름, 분류). */
    private static final List<String[]> COMMON = List.of(
            // 육류
            new String[]{"돼지고기", "육류"},
            new String[]{"삼겹살", "육류"},
            new String[]{"목살", "육류"},
            new String[]{"앞다리살", "육류"},
            new String[]{"뒷다리살", "육류"},
            new String[]{"돼지갈비", "육류"},
            new String[]{"소고기", "육류"},
            new String[]{"등심", "육류"},
            new String[]{"안심", "육류"},
            new String[]{"채끝", "육류"},
            new String[]{"갈비살", "육류"},
            new String[]{"양지", "육류"},
            new String[]{"차돌박이", "육류"},
            new String[]{"우삼겹", "육류"},
            new String[]{"닭고기", "육류"},
            new String[]{"닭가슴살", "육류"},
            new String[]{"닭다리", "육류"},
            new String[]{"닭날개", "육류"},
            new String[]{"오리고기", "육류"},
            new String[]{"양고기", "육류"},
            // 해산물
            new String[]{"고등어", "수산물"},
            new String[]{"갈치", "수산물"},
            new String[]{"조기", "수산물"},
            new String[]{"삼치", "수산물"},
            new String[]{"연어", "수산물"},
            new String[]{"참치", "수산물"},
            new String[]{"오징어", "수산물"},
            new String[]{"낙지", "수산물"},
            new String[]{"문어", "수산물"},
            new String[]{"새우", "수산물"},
            new String[]{"꽃게", "수산물"},
            new String[]{"대게", "수산물"},
            new String[]{"조개", "수산물"},
            new String[]{"바지락", "수산물"},
            new String[]{"홍합", "수산물"},
            new String[]{"굴", "수산물"},
            new String[]{"전복", "수산물"},
            // 채소
            new String[]{"양파", "채소"},
            new String[]{"대파", "채소"},
            new String[]{"쪽파", "채소"},
            new String[]{"마늘", "채소"},
            new String[]{"생강", "채소"},
            new String[]{"감자", "채소"},
            new String[]{"고구마", "채소"},
            new String[]{"당근", "채소"},
            new String[]{"무", "채소"},
            new String[]{"배추", "채소"},
            new String[]{"양배추", "채소"},
            new String[]{"상추", "채소"},
            new String[]{"깻잎", "채소"},
            new String[]{"시금치", "채소"},
            new String[]{"부추", "채소"},
            new String[]{"미나리", "채소"},
            new String[]{"콩나물", "채소"},
            new String[]{"숙주", "채소"},
            new String[]{"버섯", "채소"},
            new String[]{"표고버섯", "채소"},
            new String[]{"느타리버섯", "채소"},
            new String[]{"팽이버섯", "채소"},
            new String[]{"새송이버섯", "채소"},
            new String[]{"애호박", "채소"},
            new String[]{"단호박", "채소"},
            new String[]{"오이", "채소"},
            new String[]{"토마토", "채소"},
            new String[]{"방울토마토", "채소"},
            new String[]{"가지", "채소"},
            new String[]{"피망", "채소"},
            new String[]{"파프리카", "채소"},
            new String[]{"청양고추", "채소"},
            new String[]{"풋고추", "채소"},
            new String[]{"브로콜리", "채소"},
            new String[]{"콜리플라워", "채소"},
            new String[]{"아스파라거스", "채소"},
            new String[]{"셀러리", "채소"},
            // 과일
            new String[]{"사과", "과일"},
            new String[]{"배", "과일"},
            new String[]{"바나나", "과일"},
            new String[]{"귤", "과일"},
            new String[]{"오렌지", "과일"},
            new String[]{"레몬", "과일"},
            new String[]{"라임", "과일"},
            new String[]{"딸기", "과일"},
            new String[]{"블루베리", "과일"},
            new String[]{"포도", "과일"},
            new String[]{"키위", "과일"},
            new String[]{"수박", "과일"},
            new String[]{"참외", "과일"},
            new String[]{"멜론", "과일"},
            new String[]{"복숭아", "과일"},
            new String[]{"자두", "과일"},
            new String[]{"감", "과일"},
            new String[]{"파인애플", "과일"},
            new String[]{"망고", "과일"},
            new String[]{"아보카도", "과일"},
            // 기타
            new String[]{"계란", "기타"},
            new String[]{"달걀", "기타"},
            new String[]{"메추리알", "기타"},
            new String[]{"두부", "기타"},
            new String[]{"순두부", "기타"},
            new String[]{"콩", "기타"},
            new String[]{"쌀", "곡물"},
            new String[]{"현미", "곡물"},
            new String[]{"찹쌀", "곡물"},
            new String[]{"밀가루", "곡물"},
            new String[]{"부침가루", "곡물"},
            new String[]{"튀김가루", "곡물"},
            new String[]{"빵가루", "곡물"},
            new String[]{"식빵", "곡물"},
            new String[]{"떡", "곡물"},
            new String[]{"가래떡", "곡물"},
            new String[]{"떡국떡", "곡물"}
    );

    /**
     * 키워드로 curated 리스트를 검색. 이름에 키워드가 포함되면 매치.
     * HACCP 결과 shape와 동일하게 반환.
     * 매치가 하나도 없으면 검색어 자체를 synthetic entry로 반환 (사용자가 항상 "그 이름 그대로 추가" 가능).
     */
    public JsonNode search(String keyword, int limit) {
        ArrayNode items = objectMapper.createArrayNode();
        if (keyword == null || keyword.isBlank()) return items;

        String trimmed = keyword.trim();
        String q = trimmed.toLowerCase().replaceAll("\\s+", "");
        boolean exactMatched = false;
        int count = 0;
        for (String[] pair : COMMON) {
            String name = pair[0];
            String normalized = name.toLowerCase().replaceAll("\\s+", "");
            if (normalized.contains(q) || q.contains(normalized)) {
                if (normalized.equals(q)) exactMatched = true;
                items.add(buildEntry(name));
                if (++count >= limit) break;
            }
        }
        // 정확히 일치하는 curated 재료가 없으면 → 검색어 자체를 상단에 추가
        if (!exactMatched) {
            ArrayNode prepended = objectMapper.createArrayNode();
            prepended.add(buildEntry(trimmed));
            for (JsonNode it : items) prepended.add(it);
            return prepended;
        }
        return items;
    }

    private ObjectNode buildEntry(String name) {
        ObjectNode o = objectMapper.createObjectNode();
        o.put("prdlstReportNo", "common:" + name);
        o.put("prdlstNm", name);
        o.put("manufacture", "");
        o.put("seller", "");
        o.put("prdkind", "");
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
}
