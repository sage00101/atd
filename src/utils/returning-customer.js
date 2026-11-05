const STORAGE_KEY = 'a10tion-returning-customer';
const FIELDS = ['firstName', 'surname', 'mobile', 'email', 'vehicle', 'registration'];

export function loadReturningCustomer() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (!saved || typeof saved !== 'object') return {};
        return Object.fromEntries(FIELDS.filter((field) => typeof saved[field] === 'string' && saved[field]).map((field) => [field, saved[field]]));
    } catch {
        return {};
    }
}

export function saveReturningCustomer(customer) {
    try {
        const current = loadReturningCustomer();
        const next = { ...current };
        FIELDS.forEach((field) => {
            const value = String(customer?.[field] ?? '').trim();
            if (value) next[field] = value;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Storage can be unavailable (private mode); autofill is a convenience only.
    }
}
