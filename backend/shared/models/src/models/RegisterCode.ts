import { column, Model } from '@simonbackx/simple-database';
import basex from 'base-x';
import crypto from 'crypto';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(ALPHABET);

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class RegisterCode extends Model {
    static table = 'register_codes';

    @column({ type: 'string', primary: true })
    code: string;

    @column({ type: 'string' })
    description: string;

    @column({ type: 'string', nullable: true })
    customMessage: string | null = null;

    @column({ type: 'string', nullable: true })
    organizationId: string | null;

    @column({ type: 'integer' })
    value: number;

    /**
     * Invoice usages to the owning organization
     */
    @column({ type: 'integer', nullable: true })
    invoiceValue: number | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    async generateCode() {
        this.code = bs58.encode(await randomBytes(8)).toUpperCase();
    }
}
