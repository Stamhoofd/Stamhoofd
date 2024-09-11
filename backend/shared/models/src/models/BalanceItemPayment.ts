import { column, ManyToOneRelation, Model } from '@simonbackx/simple-database';
import { BalanceItemStatus } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { BalanceItem, Organization, Payment } from './';

/**
 * Keeps track of all the created payments of a balance item, which contains the (tries) to pay a balance item.
 * It also keeps track of how much a given payment is split between multiple balance items, which makes it possible to pay a balance item partially.
 */
export class BalanceItemPayment extends Model {
    static table = "balance_item_payments"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string

    @column({ type: "string", foreignKey: BalanceItemPayment.payment })
    paymentId: string;

    @column({ type: "string", foreignKey: BalanceItemPayment.balanceItem })
    balanceItemId: string;

    /**
     * Part of price of the payment that is used to 'pay' the balance item
     */
    @column({ type: "integer" })
    price = 0

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static balanceItem = new ManyToOneRelation(BalanceItem, "balanceItem")
    static payment = new ManyToOneRelation(Payment, "payment")

    async markPaid(this: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        // Update cached amountPaid of the balance item (this will get overwritten later, but we need it to calculate the status)
        this.balanceItem.pricePaid += this.price

        // Update status
        const old = this.balanceItem.status;
        this.balanceItem.updateStatus();
        await this.balanceItem.save();

        // Do logic of balance item
        if (this.balanceItem.status === BalanceItemStatus.Paid && old !== BalanceItemStatus.Paid) {
            // Only call markPaid once (if it wasn't (partially) paid before)
            await this.balanceItem.markPaid(this.payment, organization)
        } else {
            await this.balanceItem.markUpdated(this.payment, organization)
        }
    }

    /**
     * Call this once a earlier succeeded payment is no longer succeeded
     */
    async undoPaid(this: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        await this.balanceItem.undoPaid(this.payment, organization)
    }

    async markFailed(this: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        // Do logic of balance item
        await this.balanceItem.markFailed(this.payment, organization)
    }

    async undoFailed(this: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        // Reactivate deleted items
        await this.balanceItem.undoFailed(this.payment, organization)
    }

}

type Loaded<T> = (T) extends ManyToOneRelation<infer Key, infer Model> ? Record<Key, Model> : never;

