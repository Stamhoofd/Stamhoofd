import { column, Database, Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLSelect, SQLWhere } from '@stamhoofd/sql';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { EmailInterfaceRecipient } from '../classes/Email';

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

export class EmailAddress extends Model {
    static table = 'email_addresses';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    // Columns
    @column({ type: 'string' })
    email: string;

    @column({ type: 'boolean' })
    markedAsSpam = false;

    @column({ type: 'boolean' })
    hardBounce = false;

    @column({ type: 'boolean' })
    unsubscribedMarketing = false;

    @column({ type: 'boolean' })
    unsubscribedAll = false;

    @column({ type: 'string', nullable: true })
    token: string | null;

    /**
     * createdAt behaves more like createdAt for Challenge. Since every save is considered to have a new challenge
     */
    @column({
        type: 'datetime', beforeSave() {
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
    })
    updatedAt: Date;

    static async getOrCreate(email: string, organizationId: string | null): Promise<EmailAddress> {
        // Prevent race conditions when checking the same email address at the same time, and creating a new one
        return await QueueHandler.schedule('email-address/create-' + email + '-' + organizationId, async () => {
            const existing = await this.getByEmail(email, organizationId);
            if (existing) {
                return existing;
            }

            const n = new EmailAddress();
            n.organizationId = organizationId;
            n.email = email;
            n.token = (await randomBytes(64)).toString('base64').toUpperCase();

            await n.save();

            return n;
        });
    }

    // Methods
    static async getByEmails(emails: string[], organizationId: string | null): Promise<EmailAddress[]> {
        if (emails.length > 30) {
            // Normally an organization will never have so much bounces, so we'll request all emails and filter in them
            const all = await this.where({ organizationId }, { limit: 1000 });
            return all.filter(e => emails.includes(e.email));
        }

        if (emails.length == 0) {
            return [];
        }

        if (organizationId === null) {
            const [rows] = await Database.select(
                `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`email\` IN (?) AND \`organizationId\` is NULL`,
                [emails],
            );

            return this.fromRows(rows, this.table);
        }

        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`email\` IN (?) AND \`organizationId\` = ?`,
            [emails, organizationId],
        );

        return this.fromRows(rows, this.table);
    }

    // Methods
    static async getByEmail(email: string, organizationId: string | null): Promise<EmailAddress | undefined> {
        return (await this.where({ email, organizationId }, { limit: 1 }))[0];
    }

    /**
     * Search organization wide if this email has been marked as spam or hard bounced
     */
    static async getWhereHardBounceOrSpam(email: string): Promise<EmailAddress | null> {
        return await this.select().where(
            'email', email,
        ).where(
            SQL.where('hardBounce', 1)
                .or('markedAsSpam', 1),
        ).first(false);
    }

    // Methods
    static async filterSendTo(recipients: EmailInterfaceRecipient[]): Promise<EmailInterfaceRecipient[]> {
        if (recipients.length === 0) {
            return [];
        }

        const emails = recipients.map(r => r.email);
        const [results] = await Database.select(
            `SELECT email FROM ${this.table} WHERE \`email\` IN (?) AND (\`hardBounce\` = 1 OR \`markedAsSpam\` = 1)`,
            [emails],
        );

        const remove = results.map(r => r[this.table]['email']);
        if (remove.length === 0) {
            return recipients;
        }

        return recipients.filter(r => !remove.includes(r.email));
    }

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): EmailAddress => {
            const d = (this as typeof EmailAddress & typeof Model).fromRow(row[this.table] as any) as EmailAddress | undefined;

            if (!d) {
                throw new Error('EmailTemplate not found');
            }

            return d;
        };

        const select = new SQLSelect(transformer, SQL.wildcard());
        return select.from(SQL.table(this.table));
    }
}
