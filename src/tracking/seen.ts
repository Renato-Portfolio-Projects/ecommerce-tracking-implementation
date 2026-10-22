/**
 * Whether a block of the page, such as a collection of products or the hero banner, has been seen enough to
 * count: half of it is visible, or it fills half the screen, whichever is smaller. The plain rule, "at least
 * half of it is visible", cannot be met by a block that is more than twice as tall as the screen, because
 * even a screen full of it shows less than half. That is the home page's Tees list on a phone, where its three
 * cards stack in one column (1,410 px tall on a 375 x 667 screen, at most 47% of it visible), so on most phones
 * the plain rule would never fire. Heights are in the same unit, normally pixels.
 */
export function isSeen(visibleHeight: number, blockHeight: number, screenHeight: number): boolean {
  if (![visibleHeight, blockHeight, screenHeight].every(Number.isFinite)) return false;
  if (visibleHeight <= 0 || blockHeight <= 0 || screenHeight <= 0) return false;
  return visibleHeight >= Math.min(blockHeight, screenHeight) / 2;
}
