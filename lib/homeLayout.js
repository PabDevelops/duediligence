// Pinterest-style masonry: greedily assigns each item to whichever column is
// currently shortest (by estimated height), so columns stay balanced and the
// full container width is always used regardless of how many items there are.
export function distributeMasonryColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);
  items.forEach((item, index) => {
    const shortest = heights.indexOf(Math.min(...heights));
    const estHeight = (index === 0 ? 260 : 140) + Math.ceil((item.title || '').length / 28) * 18 + 70;
    columns[shortest].push({ item, index });
    heights[shortest] += estHeight;
  });
  return columns;
}
