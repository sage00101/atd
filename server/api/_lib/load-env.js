import path from 'node:path';
import dotenv from 'dotenv';

const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
];

for (const envPath of candidatePaths) {
    dotenv.config({ path: envPath });
}
