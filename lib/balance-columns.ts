/**
 * Splits cards over two columns so the columns end at about the same height,
 * instead of one stopping early and leaving a hole (the dashboard's old fixed
 * left/right layout did exactly that whenever one side had less to show).
 *
 * `seeds` are the cards pinned to the top of each column (their estimated
 * heights start the tally). Every remaining card, in order, goes into whichever
 * column is currently shorter. Heights are rough estimates in px: they only
 * need to be good enough to pick a side. Pure, so it's testable.
 */
export interface BalanceCard<K extends string> {
  key: K;
  height: number;
}

export function balanceColumns<K extends string>(
  seeds: { left: BalanceCard<K>; right: BalanceCard<K> },
  rest: BalanceCard<K>[],
): { left: K[]; right: K[] } {
  const left: K[] = [seeds.left.key];
  const right: K[] = [seeds.right.key];
  let leftH = seeds.left.height;
  let rightH = seeds.right.height;
  for (const card of rest) {
    if (leftH <= rightH) {
      left.push(card.key);
      leftH += card.height;
    } else {
      right.push(card.key);
      rightH += card.height;
    }
  }
  return { left, right };
}
