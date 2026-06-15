export const Rating = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 });

export function createCard() {
  return { next: 0, last: 0, ivl: 0, success: 0, errors: 0, ease: 2.5 };
}

export function reviewCard(card = createCard(), rating, now = Date.now()) {
  const nextCard = { ...createCard(), ...card, last: now };
  nextCard.ease = Number.isFinite(nextCard.ease) ? nextCard.ease : 2.5;

  if (rating === Rating.Again) {
    nextCard.errors += 1;
    nextCard.success = 0;
    nextCard.ease = Math.max(1.3, nextCard.ease - 0.2);
    nextCard.ivl = 0;
  } else if (rating === Rating.Hard) {
    nextCard.errors += 1;
    nextCard.ease = Math.max(1.3, nextCard.ease - 0.15);
    nextCard.ivl = Math.max(1, Math.round((nextCard.ivl || 1) * 0.8));
  } else if (rating === Rating.Easy) {
    nextCard.success += 1;
    nextCard.ease = Math.min(3.2, nextCard.ease + 0.1);
    if (nextCard.ivl === 0) nextCard.ivl = 2;
    else if (nextCard.ivl === 1) nextCard.ivl = 4;
    else nextCard.ivl = Math.round(nextCard.ivl * nextCard.ease * 1.15);
  } else {
    nextCard.success += 1;
    if (nextCard.ivl === 0) nextCard.ivl = 1;
    else if (nextCard.ivl === 1) nextCard.ivl = 3;
    else nextCard.ivl = Math.round(nextCard.ivl * nextCard.ease);
  }

  nextCard.ivl = Math.max(0, Math.min(nextCard.ivl, 365));
  nextCard.next = now + nextCard.ivl * 86400000;
  return nextCard;
}
