import { useEffect, useState } from 'react';
import { purchases } from './billing/current';
import { checkoutCatalog } from './billing/checkout';
import { fullPlanPrice, PREVIEW } from './build';
/** The full plan's price for a label; '' until the store answers (never a guessed price in a store build). */
export function useFullPlanPrice(): string {
  const [price, setPrice] = useState(() => fullPlanPrice(undefined, PREVIEW));
  useEffect(() => {
    let active = true;
    checkoutCatalog(purchases, 'default').then(({ products }) => {
      if (active) setPrice(fullPlanPrice(products.find(p => p.id === 'dw_full_plan')?.price, PREVIEW));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return price;
}
