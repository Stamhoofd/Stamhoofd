import { AutoEncoder, DateDecoder,EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { downgradePaymentMethodV150, PaymentMethod, PaymentMethodV150 } from '../PaymentMethod';
import { PaymentProvider } from '../PaymentProvider';
import { PaymentStatus } from '../PaymentStatus';

export class Payment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /// Last selected payment method. Nullable if none has been selected
    @field({ decoder: new EnumDecoder(PaymentMethodV150), nullable: true })
    @field({ 
        decoder: new EnumDecoder(PaymentMethod), 
        version: 151, 
        downgrade: downgradePaymentMethodV150
    })
    method: PaymentMethod | null = null

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus = PaymentStatus.Created

    @field({ decoder: new EnumDecoder(PaymentProvider), version: 152 })
    provider: PaymentProvider | null = null

    @field({ decoder: IntegerDecoder })
    price: number

    @field({ decoder: IntegerDecoder, nullable: true, version: 92 })
    freeContribution: number | null = null

    // Transfer description if paid via transfer
    @field({ decoder: StringDecoder, nullable: true })
    transferDescription: string | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder })
    updatedAt: Date

    matchQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        if (
            this.transferDescription && this.transferDescription.toLowerCase().includes(lowerQuery)
        ) {
            return true;
        }
        return false;
    }
}

export class Settlement extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    reference: string

    @field({ decoder: DateDecoder })
    settledAt: Date

    @field({ decoder: IntegerDecoder })
    amount: number
}

export class PrivatePayment extends Payment {
    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 153 })
    iban: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 153 })
    ibanName: string | null = null
}

