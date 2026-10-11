export const SERVICE_AREA_CENTER = {
    latitude: -33.9847222,
    longitude: 18.4625,
};

export function getServiceAreaResult(location, radiusKm = Number(process.env.SERVICE_RADIUS_KM || 10)) {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return { valid: false, withinRadius: false, distanceKm: null, radiusKm };
    }

    const radians = (degrees) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(latitude - SERVICE_AREA_CENTER.latitude);
    const longitudeDelta = radians(longitude - SERVICE_AREA_CENTER.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(SERVICE_AREA_CENTER.latitude))
        * Math.cos(radians(latitude))
        * Math.sin(longitudeDelta / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return { valid: true, withinRadius: distanceKm <= radiusKm, distanceKm, radiusKm };
}

export function getServiceAreaError(location, address) {
    if (typeof address !== 'string' || !address.trim()) {
        return 'Enter your service address and pin its location on the map before continuing.';
    }

    const result = getServiceAreaResult(location);
    if (!result.valid) {
        return 'Set your service location on the map before continuing.';
    }
    if (!result.withinRadius) {
        return 'This location is outside our service coverage. Please contact us before booking.';
    }
    return null;
}