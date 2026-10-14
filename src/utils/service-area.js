export const SERVICE_AREA_CENTER = {
    latitude: -33.95,
    longitude: 18.44,
};

export const SERVICE_AREA_NAME = 'Milnerton, Cape Town';

export const BUSINESS_LOCATION = {
    latitude: -34.0700025,
    longitude: 18.5591036,
};

export function getDistanceFromServiceCenter(location) {
    if (!location) return null;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const radians = (degrees) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(latitude - SERVICE_AREA_CENTER.latitude);
    const longitudeDelta = radians(longitude - SERVICE_AREA_CENTER.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(SERVICE_AREA_CENTER.latitude))
        * Math.cos(radians(latitude))
        * Math.sin(longitudeDelta / 2) ** 2;

    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}