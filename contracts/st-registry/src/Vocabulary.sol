// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PropertyRegistry} from "./PropertyRegistry.sol";

/// @notice 語彙(src/data/vocabulary.json v0.1)をレジストリに流し込む。
/// @dev bytes32 は ASCII のみ。括弧内は目論見書での表記。
library Vocabulary {
    // 項目
    bytes32 internal constant PROPERTY_NAME = "propertyName";       // 物件名称
    bytes32 internal constant ADDRESS = "address";                  // 所在
    bytes32 internal constant LAND_AREA = "landArea";               // 敷地面積
    bytes32 internal constant GROSS_FLOOR_AREA = "grossFloorArea";  // 延床面積
    bytes32 internal constant ZONING = "zoning";                    // 用途地域
    bytes32 internal constant STRUCTURE = "structure";              // 構造
    bytes32 internal constant BUILT_AT = "builtAt";                 // 建築時期
    bytes32 internal constant TENURE = "tenure";                    // 所有形態
    bytes32 internal constant APPRAISAL_VALUE = "appraisalValue";   // 鑑定評価額
    bytes32 internal constant OCCUPANCY = "occupancy";              // 稼働率
    bytes32 internal constant REVENUE_UNITS = "revenueUnits";       // 収益単位数
    bytes32 internal constant LEASABLE_AREA = "leasableArea";       // 賃貸可能面積

    // 根拠の語(典拠)
    bytes32 internal constant REGISTRY = "REGISTRY";     // 登記簿
    bytes32 internal constant INSPECTION = "INSPECTION"; // 検査済証
    bytes32 internal constant SURVEYED = "SURVEYED";     // 実測
    bytes32 internal constant APPRAISAL = "APPRAISAL";   // 鑑定
    bytes32 internal constant BY_AREA = "BY_AREA";       // 面積ベース
    bytes32 internal constant BY_UNITS = "BY_UNITS";     // 単位数ベース
    bytes32 internal constant RESIDENTIAL_ADDR = "JUKYO"; // 住居表示
    bytes32 internal constant LOT_NUMBER = "CHIBAN";      // 登記簿の地番

    // 収益単位数の下位区分
    bytes32 internal constant DWELLINGS = "DWELLINGS"; // 戸数
    bytes32 internal constant ROOMS = "ROOMS";         // 室数
    bytes32 internal constant TENANTS = "TENANTS";     // テナント数

    /// @notice 語彙を宣言する。tier は 0=中核 1=推奨 2=拡張。
    function install(PropertyRegistry r) internal {
        // 中核。7社中5社以上が持つ
        r.defineField(PROPERTY_NAME, false, false, false, false, 0);
        r.defineField(ZONING,        false, false, false, false, 0);
        r.defineField(TENURE,        false, false, false, false, 0);
        r.defineField(STRUCTURE,     false, false, false, false, 0);
        r.defineField(BUILT_AT,      false, true,  false, false, 0); // 粒度のかわりに基準時点
        r.defineField(ADDRESS,       true,  false, false, false, 0);
        r.defineField(LAND_AREA,     true,  false, false, false, 0);
        r.defineField(GROSS_FLOOR_AREA, true, false, false, false, 0);
        r.defineField(APPRAISAL_VALUE,  false, true, false, false, 0);

        // 推奨。3〜4社
        r.defineField(OCCUPANCY,     true,  true,  false, false, 1);
        r.defineField(LEASABLE_AREA, false, false, true,  false, 1);
        r.defineField(REVENUE_UNITS, false, false, false, true,  1);

        // 使ってよい根拠を項目ごとに限定する(典拠コントロール)
        r.allowBasis(ADDRESS, RESIDENTIAL_ADDR);
        r.allowBasis(ADDRESS, LOT_NUMBER);
        r.allowBasis(LAND_AREA, REGISTRY);
        r.allowBasis(LAND_AREA, SURVEYED);
        r.allowBasis(LAND_AREA, APPRAISAL);
        r.allowBasis(GROSS_FLOOR_AREA, REGISTRY);
        r.allowBasis(GROSS_FLOOR_AREA, INSPECTION);
        r.allowBasis(GROSS_FLOOR_AREA, SURVEYED);
        r.allowBasis(OCCUPANCY, BY_AREA);
        r.allowBasis(OCCUPANCY, BY_UNITS);
    }
}
