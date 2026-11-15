export function getMonthlyContractMonths(contractOption, packageId) {
    const months = Number(String(contractOption || '').match(/^(\d+)-months$/)?.[1]);
    const allowedMonths = packageId === 'business-standard' ? [1, 3, 6, 12] : [1, 3];
    return allowedMonths.includes(months) ? months : 0;
}
