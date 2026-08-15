export function shouldPlaceTooltipAbove(
  average: number,
  rangeMidpoint: number | null,
): boolean {
  return rangeMidpoint !== null && average < rangeMidpoint;
}
