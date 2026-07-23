import { Movement, MovementType, Reglement, Location } from '../types';

export function calculateMonthlyRent(
  daysOrEntryDate: number | string | Date,
  nbCaisse: number,
  baseRentPerCratePerMonth: number,
  increaseRate: number,
  increaseStartMonth: number,
  currentDateOrExitDate?: string | Date
): number {
  if (nbCaisse <= 0 || baseRentPerCratePerMonth <= 0) {
    return 0;
  }
  
  let start: Date;
  if (typeof daysOrEntryDate === 'number') {
    // Reconstruct start date from days ago for backward compatibility
    start = new Date(Date.now() - daysOrEntryDate * 24 * 60 * 60 * 1000);
  } else if (typeof daysOrEntryDate === 'string') {
    start = new Date(daysOrEntryDate);
  } else if (daysOrEntryDate instanceof Date) {
    start = daysOrEntryDate;
  } else {
    start = new Date();
  }

  let end: Date;
  if (!currentDateOrExitDate) {
    end = new Date();
  } else if (typeof currentDateOrExitDate === 'string') {
    end = new Date(currentDateOrExitDate);
  } else if (currentDateOrExitDate instanceof Date) {
    end = currentDateOrExitDate;
  } else {
    end = new Date();
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  if (start > end) {
    return 0;
  }

  let totalRent = 0;
  let isInsideForfait = false;
  let forfaitYear = -1;

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth(); // 0-based
  const targetYear = end.getFullYear();
  const targetMonth = end.getMonth();

  while (true) {
    const m1 = currentMonth + 1; // 1-based month (1 = Jan, 12 = Dec)

    if (m1 >= 9 && m1 <= 12) {
      // September to December is the flat forfait period
      if (!isInsideForfait || forfaitYear !== currentYear) {
        totalRent += baseRentPerCratePerMonth * nbCaisse;
        isInsideForfait = true;
        forfaitYear = currentYear;
      }
    } else {
      isInsideForfait = false;
      // January to August: monthly rent with fixed increase value applied every month since January 1st
      // January (m1 = 1) has 1x increase, Feb (m1 = 2) has 2x increase, etc.
      const currentRentRate = baseRentPerCratePerMonth + m1 * (increaseRate || 0);
      totalRent += currentRentRate * nbCaisse;
    }

    if (currentYear === targetYear && currentMonth === targetMonth) {
      break;
    }

    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  return totalRent;
}

export function isMovementPaid(
  movement: Movement,
  reglements: Reglement[],
  locations: Location[]
): boolean {
  if (movement.type !== MovementType.Sale && movement.type !== MovementType.LocationOut && movement.type !== MovementType.EmptyCratesOut) {
    return false; // Non-billable movements are not "paid" in the invoice sense
  }
  
  const loc = locations.find(l => l.id === movement.id && l.status === 'En cours');
  if (loc && loc.entryDate) {
    return false; // Still ongoing rent, can't be marked as paid until terminated
  }

  const hasTotal = (movement as any).montantTotal !== undefined && (movement as any).montantTotal !== null;
  const totalAmount = hasTotal ? Number((movement as any).montantTotal) : Number((movement as any).loyer || (movement as any).caution || 0);
  const paidAmount = reglements
    .filter(r => r.invoiceId === movement.id)
    .reduce((sum, r) => sum + r.amount, 0);

  const remaining = Math.max(0, totalAmount - paidAmount);
  return (movement as any).paymentStatus === 'Payé' || remaining <= 0;
}
