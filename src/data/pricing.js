import { Building2, CarFront } from 'lucide-react';
import privateTwoWashesImage from '../assets/images/private-2-washes.png';
import privateFourWashesImage from '../assets/images/private-4-washes.png';
import businessTwoWashesImage from '../assets/images/business-2-washes.png';
import businessFourWashesImage from '../assets/images/business-4-washes.png';

export const singleWashPrices = [
    ['Sedan / Hatchback', 'R650,00'],
    ['SUV / Bakkie', 'R850,00'],
    ['Minibus / Van', 'R1 100,00'],
];

export const threeMonthPrepayPrices = [
    ['Sedan / Hatchback', 'R3 300,00', 'R7 200,00'],
    ['SUV / Bakkie', 'R4 500,00', 'R9 600,00'],
    ['Minibus / Van', 'R6 000,00', 'R12 600,00'],
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
                washes: '2 Washes A Month',
                badge: 'Discounted Rates',
                image: privateTwoWashesImage,
                imageAlt: 'Private client two-wash monthly package',
                monthlyPrices: [
                    ['Sedan / Hatchback', 'R1 150,00'],
                    ['SUV / Bakkie', 'R1 550,00'],
                    ['Minibus / Van', 'R2 050,00'],
                ],
                threeMonthPrices: ['R3 300,00', 'R4 500,00', 'R6 000,00'],
                monthlyNote: 'Save R150 per month',
                details: [
                    '2 washes per month',
                    'Save R150 per month',
                    'Includes the standard wash services',
                ],
            },
            {
                id: 'private-premium',
                title: 'Premium Package',
                washes: '4 Washes A Month',
                badge: 'Best Value',
                image: privateFourWashesImage,
                imageAlt: 'Private client four-wash monthly package',
                monthlyPrices: [
                    ['Sedan / Hatchback', 'R2 300,00'],
                    ['SUV / Bakkie', 'R3 100,00'],
                    ['Minibus / Van', 'R4 100,00'],
                ],
                threeMonthPrices: ['R7 200,00', 'R9 600,00', 'R12 600,00'],
                monthlyNote: 'Save R300 per month',
                details: [
                    '4 washes per month',
                    'Save R300 per month',
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
                washes: '2 Washes A Month',
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
                    '2 washes per month',
                    'Discounted fleet rates',
                    'Suitable for business, fleet and family vehicles',
                    'Includes the standard wash services',
                ],
            },
            {
                id: 'business-premium',
                title: 'Premium Package',
                washes: '4 Washes A Month',
                badge: 'Best Value',
                image: businessFourWashesImage,
                imageAlt: 'Business, fleet or family four-wash monthly package',
                monthlyPrices: [
                    ['Sedan / Hatchback', 'R6 600,00'],
                    ['SUV / Bakkie', 'R9 000,00'],
                    ['Minibus / Van', 'R11 400,00'],
                ],
                threeMonthPrices: ['R19 800,00', 'R27 000,00', 'R34 200,00'],
                monthlyNote: 'Minimum 3 vehicles at the same premises',
                packageNote:
                    'Business, fleet and family vehicles must have a minimum of three vehicles at the same premises.',
                details: [
                    '4 washes per month',
                    'Discounted fleet rates',
                    'Suitable for business, fleet and family vehicles',
                    'Includes the standard wash services',
                ],
            },
        ],
    },
};