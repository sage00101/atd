export const businessVehicleTypes = [
    'Sedan / Hatchback',
    'SUV / Bakkie',
    'Minibus / Van',
];

export const businessFleetRates = [
    {
        tier: '3-5',
        label: '3 - 5',
        prices: {
            'Sedan / Hatchback': 25000,
            'SUV / Bakkie': 35000,
            'Minibus / Van': 45000,
        },
    },
    {
        tier: '6-8',
        label: '6 - 8',
        prices: {
            'Sedan / Hatchback': 22000,
            'SUV / Bakkie': 32000,
            'Minibus / Van': 42000,
        },
    },
    {
        tier: '9+',
        label: '9+',
        prices: {
            'Sedan / Hatchback': 19000,
            'SUV / Bakkie': 21000,
            'Minibus / Van': 39000,
        },
    },
];

export function isValidFleetVehicleCount(count) {
    return Number.isSafeInteger(count) && count >= 3;
}

export function getBusinessFleetTierForCount(count) {
    if (!isValidFleetVehicleCount(count)) return '';
    if (count <= 5) return '3-5';
    if (count <= 8) return '6-8';
    return '9+';
}

export function getBusinessFleetRateCents(tier, vehicleType) {
    return businessFleetRates.find((rate) => rate.tier === tier)?.prices[vehicleType];
}