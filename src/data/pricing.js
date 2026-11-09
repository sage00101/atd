import { Building2, CarFront } from 'lucide-react';
import privateTwoWashesImage from '../assets/images/private-2-washes.png';
import privateFourWashesImage from '../assets/images/private-4-washes.png';
import businessTwoWashesImage from '../assets/images/business-2-washes.png';

export const singleWashPrices = [
    ['Sedan / Hatchback', 'R250,00'],
    ['SUV / Bakkie', 'R350,00'],
    ['Minibus / Van', 'R450,00'],
];

export const threeMonthPrepayPrices = [
    ['Sedan / Hatchback', 'R1 160,00', 'R2 420,00'],
    ['SUV / Bakkie', 'R1 760,00', 'R3 620,00'],
    ['Minibus / Van', 'R2 360,00', 'R4 820,00'],
];

export const packageGroups = {
    private: {
        label: 'Private Client',
        shortLabel: 'Private',
        icon: CarFront,
        packages: [
            {
                id: 'private-standard',
                title: 'Standard Package',
                washes: '2 Washes Per Billing Period',
                badge: 'Discounted Rates',
                image: privateTwoWashesImage,
                imageAlt: 'Private client two-wash monthly package',
                monthlyPrices: [
                    ['Sedan / Hatchback', 'R420,00'],
                    ['SUV / Bakkie', 'R620,00'],
                    ['Minibus / Van', 'R820,00'],
                ],
                threeMonthPrices: ['R1 160,00', 'R1 760,00', 'R2 360,00'],
                threeMonthNote: 'Save R340 on a 3-month contract',
                monthlyNote: 'Save R80 per month',
                details: [
                    'Up to 2 bookings per billing period',
                    'Save R80 per month',
                    'Includes the standard wash services',
                ],
            },
            {
                id: 'private-premium',
                title: 'Premium Package',
                washes: '4 Washes Per Billing Period',
                badge: 'Best Value',
                image: privateFourWashesImage,
                imageAlt: 'Private client four-wash monthly package',
                monthlyPrices: [
                    ['Sedan / Hatchback', 'R840,00'],
                    ['SUV / Bakkie', 'R1 240,00'],
                    ['Minibus / Van', 'R1 640,00'],
                ],
                threeMonthPrices: ['R2 420,00', 'R3 620,00', 'R4 820,00'],
                threeMonthNote: 'Save R580 on a 3-month contract',
                monthlyNote: 'Save R160 per month',
                details: [
                    'Up to 4 bookings per billing period',
                    'Save R160 per month',
                    'Includes the standard wash services',
                ],
            },
        ],
    },

    business: {
        label: 'Business / Fleet / Family',
        shortLabel: 'Business / Fleet',
        icon: Building2,
        packages: [
            {
                id: 'business-standard',
                title: 'Standard Package',
                washes: '1 Wash Per Month',
                badge: 'Discounted Rates',
                image: businessTwoWashesImage,
                imageAlt: 'Business, fleet or family two-wash monthly package',
                monthlyPrices: [
                    ['Sedan / Hatchback', 'R3 300,00'],
                    ['SUV / Bakkie', 'R4 500,00'],
                    ['Minibus / Van', 'R5 700,00'],
                ],
                threeMonthPrices: ['R9 900,00', 'R13 500,00', 'R17 100,00'],
                monthlyNote: 'Minimum 3 vehicles at the same premises',
                packageNote:
                    'Business, fleet and family vehicles must have a minimum of three vehicles at the same premises.',
                details: [
                    'Up to 1 booking per month',
                    'Discounted fleet rates',
                    'Suitable for business, fleet and family vehicles',
                    'Includes the standard wash services',
                ],
            },
        ],
    },
};