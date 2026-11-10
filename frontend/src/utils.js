// src/utils.js — 共用小工具

// 站名去掉 "YouBike2.0_" 前綴，畫面上比較好讀
export const shortName = (n) => String(n || "").replace(/^YouBike2\.0_/, "");
