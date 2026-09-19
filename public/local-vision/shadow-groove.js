// Pixel geometry only; scores are uncalibrated and never clinical authority.
export function measureMedianGroove(gray, mask, width, height, box) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width * height > 192 * 192 || gray?.length !== width * height || mask?.length !== gray.length) {
    throw new Error('SHADOW_GROOVE_INVALID_GRID');
  }
  if (!box || !['minX','minY','maxX','maxY'].every(k => Number.isInteger(box[k])) ||
      box.minX < 0 || box.minY < 0 || box.maxX >= width || box.maxY >= height ||
      box.maxX < box.minX || box.maxY < box.minY) throw new Error('SHADOW_GROOVE_INVALID_BOX');
  const bw = box.maxX - box.minX + 1, bh = box.maxY - box.minY + 1;
  const center = (box.minX + box.maxX) / 2;
  const radius = Math.max(1, Math.min(3, Math.floor(bw * .04)));
  const band = Math.max(1, bw * .09);
  let eligibleRows = 0, supportedRows = 0, longestRun = 0, previous = new Map();
  for (let y = box.minY + 1; y < box.maxY; y++) {
    let eligible = false, supported = false;
    const current = new Map();
    for (let x = Math.max(box.minX + radius, Math.ceil(center - band));
         x <= Math.min(box.maxX - radius, Math.floor(center + band)); x++) {
      const p = y * width + x;
      if (!mask[p] || !mask[p-width] || !mask[p+width] || !Number.isFinite(gray[p])) continue;
      let bestContrast = 0;
      for (let r = 1; r <= radius; r++) {
        // Both shoulders and every intervening pixel must belong to the same ROI.
        let inside = true;
        for (let dx = -r; dx <= r; dx++) if (!mask[p+dx] || !Number.isFinite(gray[p+dx])) inside = false;
        if (!inside) continue;
        eligible = true;
        bestContrast = Math.max(bestContrast, Math.min(gray[p-r], gray[p+r]) - gray[p]);
      }
      if (bestContrast < 17 || gray[p] >= 165) continue;
      supported = true;
      // Require a connected vertical path; unrelated dark pixels cannot extend a run.
      let run = 1;
      for (let dx = -1; dx <= 1; dx++) run = Math.max(run, (previous.get(x+dx) || 0) + 1);
      current.set(x, run);
      longestRun = Math.max(longestRun, run);
    }
    if (eligible) eligibleRows++;
    if (supported) supportedRows++;
    previous = current;
  }
  const continuity = bh > 2 ? longestRun / (bh - 2) : 0;
  return Object.freeze({
    version:'median-groove-multiscale-v1', eligibleRows, supportedRows, longestRun,
    radiusPixels:radius, continuity:Number(continuity.toFixed(4)),
    score:Number((continuity * (eligibleRows ? supportedRows / eligibleRows : 0)).toFixed(4)),
    calibrated:false, authority:false, productionEligible:false
  });
}
