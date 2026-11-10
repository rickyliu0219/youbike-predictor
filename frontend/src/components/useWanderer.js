// src/components/useWanderer.js
// =============================================================
// 角色「隨意走動」的共用狀態機（倫敦衛兵、拉普蘭馴鹿都用這個）
//
//   walk ：以固定速度走向隨機目標點，actor 上會設 data-walking="1"（給 CSS 播走路動畫）
//   idle ：停下 1.5–4.5 秒；可能原地轉身，或觸發 onIdle 的特殊動作（例如低頭吃草）
//   定點巡邏：有 patrolChance 機率在附近 20–35 px 來回踱步 3–5 趟
//
// 用 requestAnimationFrame 直接改 DOM 的 transform，不經過 React re-render，效能較好。
// 系統開啟「減少動態效果」時角色只站著不動。
// =============================================================
import { useEffect } from "react";

export default function useWanderer(wrapRef, actorRef, {
  speed = 24,           // px／秒
  edge = 26,            // 左右保留邊界
  patrolChance = 0.3,   // 改成定點巡邏的機率
  turnChance = 0.35,    // 停下時原地轉身的機率
  idleAttr = null,      // 停下時可能設定的特殊狀態屬性名稱（例如 "grazing"）
  idleAttrChance = 0,   // 觸發特殊狀態的機率
  startAt = 0.4,        // 起始位置（容器寬度比例）
} = {}) {
  useEffect(() => {
    const wrap = wrapRef.current, actor = actorRef.current;
    if (!wrap || !actor) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rand = (a, b) => a + Math.random() * (b - a);
    const width = () => wrap.clientWidth;

    const st = { x: width() * startAt, dir: 1, mode: "idle", until: performance.now() + 1200, target: 0, patrol: null, special: false };
    const render = () => {
      actor.style.transform = `translateX(${st.x}px)`;
      actor.dataset.walking = st.mode === "walk" ? "1" : "0";
      if (idleAttr) actor.dataset[idleAttr] = st.special ? "1" : "0";
      actor.firstChild.style.transform = `scaleX(${st.dir})`;
    };
    render();
    if (reduce) return;

    let raf, last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const W = width();
      if (st.mode === "idle" && t > st.until) {
        st.special = false;
        if (st.patrol && st.patrol.left > 0) {
          st.target = st.patrol.flip ? st.patrol.a : st.patrol.b;
          st.patrol.flip = !st.patrol.flip; st.patrol.left -= 1;
        } else if (Math.random() < patrolChance) {
          const a = Math.max(edge, st.x - rand(20, 35)), b = Math.min(W - edge, st.x + rand(20, 35));
          st.patrol = { a, b, flip: false, left: 3 + Math.floor(rand(0, 3)) };
          st.target = b;
        } else {
          st.patrol = null;
          do { st.target = rand(edge, W - edge); } while (Math.abs(st.target - st.x) < 50 && W > 160);
        }
        st.dir = st.target > st.x ? 1 : -1;
        st.mode = "walk";
      } else if (st.mode === "walk") {
        st.x += st.dir * speed * dt;
        if ((st.dir > 0 && st.x >= st.target) || (st.dir < 0 && st.x <= st.target)) {
          st.x = st.target;
          st.mode = "idle";
          const special = !st.patrol && idleAttr && Math.random() < idleAttrChance;
          st.special = !!special;
          st.until = t + (st.patrol ? rand(600, 1400) : special ? rand(3000, 6000) : rand(1500, 4500));
          if (!st.patrol && !special && Math.random() < turnChance) st.dir *= -1;
        }
      }
      st.x = Math.max(edge, Math.min(W - edge, st.x));
      render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
