export function getMonthlyContractMonths(contractOption, packageId) {
    const months = Number(String(contractOption || '').match(/^(\d+)-months$/)?.[1]);
    const allowedMonths = packageId === 'business-standard' ? [1, 3, 6, 12] : [1, 3];
    return allowedMonths.includes(months) ? months : 0;
}

export function getAvailableMonthlyContractMonths(contractOption, packageId) {
    const months = getMonthlyContractMonths(contractOption, packageId);
    return months === 1 || months === 3 ? months : 0;
}

export const getOnlineMonthlyContractMonths = getAvailableMonthlyContractMonths;
