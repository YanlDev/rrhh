import sharp from "sharp";

/**
 * Mini librería de SVG para charts. Devolvemos PNG (Buffer) listo para embebir en xlsx.
 * Simple: bar / line+area / donut. Estilo coherente con shadcn (slate-800 + chart-1..5).
 */

const PALETTE = ["#1e293b", "#0ea5e9", "#10b981", "#f97316", "#a855f7", "#ef4444", "#facc15", "#6366f1", "#14b8a6"];
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function escapeXml(s: string): string {
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

async function svgToPng(svg: string, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(Math.round(width * 2), Math.round(height * 2)) // 2x para nitidez en Excel
    .png()
    .toBuffer();
}

/* =================== Bar chart =================== */
export async function barChartPng(
  data: { label: string; values: number[] }[],
  series: { name: string; color?: string }[],
  opts: { width?: number; height?: number; title?: string } = {},
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const W = opts.width ?? 720;
  const H = opts.height ?? 320;
  const padding = { top: 40, right: 20, bottom: 60, left: 50 };
  const cw = W - padding.left - padding.right;
  const ch = H - padding.top - padding.bottom;

  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const groupW = cw / Math.max(1, data.length);
  const barW = (groupW * 0.7) / series.length;
  const groupGap = groupW * 0.3;

  const yTicks = 5;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max * i) / yTicks));

  const bars: string[] = [];
  data.forEach((g, gi) => {
    const groupX = padding.left + gi * groupW + groupGap / 2;
    g.values.forEach((v, si) => {
      const x = groupX + si * barW;
      const h = (v / max) * ch;
      const y = padding.top + ch - h;
      const color = series[si]?.color ?? PALETTE[si % PALETTE.length];
      bars.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" />`);
    });
  });

  const xLabels: string[] = data.map((g, i) => {
    const x = padding.left + i * groupW + groupW / 2;
    const y = padding.top + ch + 18;
    return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#475569" transform="rotate(-15 ${x.toFixed(1)} ${y})">${escapeXml(g.label)}</text>`;
  });

  const yLabels: string[] = ticks.map((t, i) => {
    const y = padding.top + ch - (i / yTicks) * ch;
    return `
      <line x1="${padding.left}" x2="${W - padding.right}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3 3"/>
      <text x="${padding.left - 6}" y="${y + 3}" text-anchor="end" font-family="${FONT}" font-size="10" fill="#94a3b8">${t}</text>
    `;
  });

  const legend = series.map((s, i) => {
    const x = padding.left + i * 120;
    const color = s.color ?? PALETTE[i % PALETTE.length];
    return `
      <rect x="${x}" y="${H - 18}" width="10" height="10" rx="2" fill="${color}"/>
      <text x="${x + 14}" y="${H - 9}" font-family="${FONT}" font-size="10" fill="#475569">${escapeXml(s.name)}</text>
    `;
  }).join("");

  const title = opts.title
    ? `<text x="${padding.left}" y="22" font-family="${FONT}" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(opts.title)}</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${title}
    ${yLabels.join("")}
    ${bars.join("")}
    ${xLabels.join("")}
    ${legend}
  </svg>`;

  return { buffer: await svgToPng(svg, W, H), width: W, height: H };
}

/* =================== Line/Area chart =================== */
export async function areaChartPng(
  points: { x: string; y: number }[],
  opts: { width?: number; height?: number; title?: string; color?: string; yMax?: number; yUnit?: string } = {},
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const W = opts.width ?? 720;
  const H = opts.height ?? 280;
  const padding = { top: 40, right: 20, bottom: 40, left: 50 };
  const cw = W - padding.left - padding.right;
  const ch = H - padding.top - padding.bottom;
  const color = opts.color ?? "#10b981";

  const max = opts.yMax ?? Math.max(1, ...points.map((p) => p.y));
  if (points.length === 0) {
    const empty = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><text x="${W/2}" y="${H/2}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#94a3b8">Sin datos</text></svg>`;
    return { buffer: await svgToPng(empty, W, H), width: W, height: H };
  }

  const dx = points.length > 1 ? cw / (points.length - 1) : 0;
  const xy = points.map((p, i) => {
    const x = padding.left + i * dx;
    const y = padding.top + ch - (p.y / max) * ch;
    return { x, y, raw: p };
  });

  const linePath = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xy[xy.length - 1].x.toFixed(1)} ${(padding.top + ch).toFixed(1)} L${xy[0].x.toFixed(1)} ${(padding.top + ch).toFixed(1)} Z`;

  const yTicks = 5;
  const yLabels: string[] = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = Math.round((max * i) / yTicks);
    const y = padding.top + ch - (i / yTicks) * ch;
    return `
      <line x1="${padding.left}" x2="${W - padding.right}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3 3"/>
      <text x="${padding.left - 6}" y="${y + 3}" text-anchor="end" font-family="${FONT}" font-size="10" fill="#94a3b8">${v}${opts.yUnit ?? ""}</text>
    `;
  });

  // x labels: cada N
  const step = Math.ceil(points.length / 12);
  const xLabels = xy
    .filter((_, i) => i % step === 0)
    .map((p) => `<text x="${p.x.toFixed(1)}" y="${(padding.top + ch + 14).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#475569">${escapeXml(p.raw.x.slice(5))}</text>`);

  const title = opts.title
    ? `<text x="${padding.left}" y="22" font-family="${FONT}" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(opts.title)}</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.05"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${title}
    ${yLabels.join("")}
    <path d="${areaPath}" fill="url(#areaFill)"/>
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${xLabels.join("")}
  </svg>`;

  return { buffer: await svgToPng(svg, W, H), width: W, height: H };
}

/* =================== Donut chart =================== */
export async function donutChartPng(
  data: { label: string; value: number; color: string }[],
  opts: { width?: number; height?: number; title?: string } = {},
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const W = opts.width ?? 480;
  const H = opts.height ?? 300;
  const cx = 130;
  const cy = H / 2 + 5;
  const rOuter = 95;
  const rInner = 55;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let acc = 0;
  const slices = data.map((d) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(start) * rOuter;
    const y1 = cy + Math.sin(start) * rOuter;
    const x2 = cx + Math.cos(end) * rOuter;
    const y2 = cy + Math.sin(end) * rOuter;
    const xi1 = cx + Math.cos(end) * rInner;
    const yi1 = cy + Math.sin(end) * rInner;
    const xi2 = cx + Math.cos(start) * rInner;
    const yi2 = cy + Math.sin(start) * rInner;
    const path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi1.toFixed(1)} ${yi1.toFixed(1)} A ${rInner} ${rInner} 0 ${large} 0 ${xi2.toFixed(1)} ${yi2.toFixed(1)} Z`;
    return `<path d="${path}" fill="${d.color}" stroke="#ffffff" stroke-width="2"/>`;
  });

  const legendX = 260;
  const legend = data.map((d, i) => {
    const y = 60 + i * 22;
    const pct = Math.round((d.value / total) * 100);
    return `
      <rect x="${legendX}" y="${y - 10}" width="12" height="12" rx="2" fill="${d.color}"/>
      <text x="${legendX + 18}" y="${y}" font-family="${FONT}" font-size="11" fill="#0f172a">${escapeXml(d.label)}</text>
      <text x="${W - 20}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="11" fill="#475569" font-weight="600">${d.value} (${pct}%)</text>
    `;
  }).join("");

  const title = opts.title
    ? `<text x="20" y="22" font-family="${FONT}" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(opts.title)}</text>`
    : "";

  const centerLabel = `
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="#0f172a">${total}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#94a3b8">total</text>
  `;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${title}
    ${slices.join("")}
    ${centerLabel}
    ${legend}
  </svg>`;

  return { buffer: await svgToPng(svg, W, H), width: W, height: H };
}
