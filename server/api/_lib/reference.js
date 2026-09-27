/** Human-friendly, unique order reference, e.g. A10-20260927-K7QX9. */
export function generateReferenceNumber() {
    const today = new Date();
    const datePart = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
    ].join('');

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 5; i += 1) {
        randomPart += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return `A10-${datePart}-${randomPart}`;
}
