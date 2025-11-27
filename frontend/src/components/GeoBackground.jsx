function GeoBackground() {
  // 節點：可自行加/減，形狀會自動連線
  const leftPts = [
    [60, 250], [120, 140], [180, 220], [240, 90], [260, 260], [320, 180], [360, 300],
    [80, 380], [160, 450], [240, 360], [300, 480], [380, 420], [420, 520], [500, 460],
  ];
  const rightPts = [
    [1100, 180], [1180, 90], [1240, 200], [1320, 140], [1380, 240], [1460, 120],
    [1100, 340], [1180, 420], [1260, 360], [1340, 460], [1420, 380], [1500, 520], [1560, 440],
  ];

  // 產生有效邊（避免空配對）
  const mkEdges = (pts) => {
    const edges = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      edges.push([pts[i], pts[(i + 1) % n]]);      // 鄰點
      if (i + 2 < n) edges.push([pts[i], pts[i + 2]]); // 隔一點
    }
    return edges;
  };

  const leftEdges = mkEdges(leftPts);
  const rightEdges = mkEdges(rightPts);

  return (
    <>
      <style>{`
        @keyframes drift-left  { 0%{transform:translateX(-2%)} 50%{transform:translateX(1%)} 100%{transform:translateX(-2%)} }
        @keyframes drift-right { 0%{transform:translateX( 2%)} 50%{transform:translateX(-1%)} 100%{transform:translateX( 2%)} }
        .bg-neutral-grad{
          background-image: radial-gradient(1200px 700px at 50% 40%, #ffffff 0%, #f5f7fb 55%, #eef1f6 100%);
        }
        .center-scrim{
          background: radial-gradient(720px 460px at 50% 45%,
                     rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.80) 38%,
                     rgba(255,255,255,0.42) 70%, rgba(255,255,255,0.12) 100%);
        }
        .animate-left  { animation: drift-left  28s ease-in-out infinite; }
        .animate-right { animation: drift-right 28s ease-in-out infinite; }
      `}</style>

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* 柔和的中性底 */}
        <div className="absolute inset-0 bg-neutral-grad" />

        {/* —— 上層：中段主視覺 —— */}
        {/* 左主塊（往中間與下方移，縮短高度） */}
        <svg
          className="absolute left-[-8%] top-[18%] h-[55%] w-[58%] opacity-60 animate-left"
          viewBox="0 0 800 900" preserveAspectRatio="none"
        >
          <g stroke="rgba(0,0,0,0.55)" strokeWidth="1.4" fill="none">
            {leftEdges.map(([a, b], idx) => (
              <line key={idx} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g fill="rgba(0,0,0,0.7)">
            {leftPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" />)}
          </g>
        </svg>

        {/* 右主塊 */}
        <svg
          className="absolute right-[-10%] top-[22%] h-[55%] w-[58%] opacity-60 animate-right"
          viewBox="800 0 800 900" preserveAspectRatio="none"
        >
          <g stroke="rgba(0,0,0,0.55)" strokeWidth="1.4" fill="none">
            {rightEdges.map(([a, b], idx) => (
              <line key={idx} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g fill="rgba(0,0,0,0.7)">
            {rightPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" />)}
          </g>
        </svg>

        {/* —— 下層：底部淡裝飾（填補左右留白） —— */}
        <svg
          className="absolute left-[-12%] bottom-[-10%] h-[42%] w-[52%] opacity-30 animate-right"
          viewBox="0 0 800 900" preserveAspectRatio="none"
        >
          <g stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" fill="none">
            {leftEdges.map(([a, b], idx) => (
              <line key={`lb-${idx}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g fill="rgba(0,0,0,0.5)">
            {leftPts.map(([x, y], i) => <circle key={`lp-${i}`} cx={x} cy={y} r="2.8" />)}
          </g>
        </svg>

        <svg
          className="absolute right-[-12%] bottom-[-12%] h-[44%] w-[52%] opacity-30 animate-left"
          viewBox="800 0 800 900" preserveAspectRatio="none"
        >
          <g stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" fill="none">
            {rightEdges.map(([a, b], idx) => (
              <line key={`rb-${idx}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g fill="rgba(0,0,0,0.5)">
            {rightPts.map(([x, y], i) => <circle key={`rp-${i}`} cx={x} cy={y} r="2.8" />)}
          </g>
        </svg>

        {/* 中央白霧：確保卡片與文字清晰 */}
        <div className="absolute inset-0 center-scrim" />
      </div>
    </>
  );
}
