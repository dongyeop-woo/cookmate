package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GifticonDto {
    private String id;
    private String goodsCode;       // 기프티쇼 상품코드
    private String name;
    private String brand;
    private String brandCode;
    private String image;
    private String imageSmall;
    private String brandIcon;
    private int pointCost;          // 앱 내 교환 포인트
    private int realPrice;          // 공급사 할인 반영 가격
    private int salePrice;          // 권장 소비자 가격
    private String category;
    private String description;
    private String affiliate;       // 교환처명
    private int stock;
    private boolean active;
}
