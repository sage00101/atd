export function getServiceAddressError(address) {
    return typeof address === 'string' && address.trim() ? null : 'Enter your service address before continuing.';
}
