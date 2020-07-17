import { ArrayDecoder,AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { MemberDetails } from './MemberDetails';
import { Registration } from './Registration';

export class DecryptedMember extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: MemberDetails, nullable: true })
    details: MemberDetails | null

    @field({ decoder: StringDecoder })
    publicKey: string

    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]
}