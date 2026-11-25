import type { DowntimeCapital, PF1Character } from '../types/character';

export interface CurrencyBreakdown {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
}

export interface CurrencyReconciliation {
  coinsCopper: number;
  coinsGp: number;
  targetCopper: number;
  targetGp: number;
  currentGp: number;
  bankGp: number;
  isBalanced: boolean;
  differenceGp: number;
}

/**
 * Converts a GP amount into platinum (10 gp), gold (1 gp), silver (0.1 gp),
 * and copper (0.01 gp) using exact integer copper arithmetic.
 * Example: 111.11 gp -> { pp: 11, gp: 1, sp: 1, cp: 1 }.
 */
export function calculateAutoChange(targetGp: number): CurrencyBreakdown {
  const safeGp = Number.isFinite(targetGp) ? Math.max(0, targetGp) : 0;
  let remainingCopper = Math.round(safeGp * 100);

  const pp = Math.floor(remainingCopper / 1000);
  remainingCopper %= 1000;

  const gp = Math.floor(remainingCopper / 100);
  remainingCopper %= 100;

  const sp = Math.floor(remainingCopper / 10);
  const cp = remainingCopper % 10;

  return { pp, gp, sp, cp };
}

/**
 * Computes total coin value in integer copper pieces (1 pp = 1000 cp, 1 gp = 100 cp, 1 sp = 10 cp).
 */
export function getCoinsTotalCopper(
  currency?: Partial<PF1Character['currency']> | null
): number {
  if (!currency) return 0;
  const pp = Math.max(0, Math.round(currency.pp || 0));
  const gp = Math.max(0, Math.round(currency.gp || 0));
  const sp = Math.max(0, Math.round(currency.sp || 0));
  const cp = Math.max(0, Math.round(currency.cp || 0));
  return pp * 1000 + gp * 100 + sp * 10 + cp;
}

export function getCoinsTotalGp(
  currency?: Partial<PF1Character['currency']> | null
): number {
  return getCoinsTotalCopper(currency) / 100;
}

/**
 * Compares carried/listed coins against Current GP (+ Bank Savings when includeBank is true).
 */
export function reconcileCurrency(
  currency?: Partial<PF1Character['currency']> | null,
  downtimeCapital?: Partial<DowntimeCapital> | null,
  includeBank = false
): CurrencyReconciliation {
  const currentGp = Number.isFinite(downtimeCapital?.currentGp)
    ? downtimeCapital!.currentGp!
    : 0;
  const bankGp = Number.isFinite(downtimeCapital?.bankGp)
    ? downtimeCapital!.bankGp!
    : 0;

  const targetGp = includeBank ? currentGp + bankGp : currentGp;
  const targetCopper = Math.round(Math.max(0, targetGp) * 100);
  const coinsCopper = getCoinsTotalCopper(currency);

  return {
    coinsCopper,
    coinsGp: coinsCopper / 100,
    targetCopper,
    targetGp: targetCopper / 100,
    currentGp,
    bankGp,
    isBalanced: coinsCopper === targetCopper,
    differenceGp: (coinsCopper - targetCopper) / 100,
  };
}
