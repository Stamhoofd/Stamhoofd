import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { Colors } from "@stamhoofd/utility";
import { DefaultAgeGroup } from "./DefaultAgeGroup";
import { Replacement } from "./endpoints/EmailRequest";
import { Image } from "./files/Image";
import { MemberResponsibility } from "./MemberResponsibility";
import { DataPermissionsSettings, FinancialSupportSettings, OrganizationRecordsConfiguration } from "./members/OrganizationRecordsConfiguration";
import { OrganizationEmail } from "./OrganizationEmail";
import { PermissionRoleDetailed } from "./PermissionRole";
import { RegistrationPeriod } from "./RegistrationPeriod";
import { RichText } from "./RichText";
import { UserWithMembers } from "./UserWithMembers";

export class PlatformPrivateConfig extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PermissionRoleDetailed) })
    roles: PermissionRoleDetailed[] = []

    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 272 })
    emails: OrganizationEmail[] = []
}

export class OrganizationTag extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''
}

export class PlatformPremiseType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder, version: 319 })
    description = ''

    /**
     * Maximum number of premises allowed for this premise type
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 319 })
    max: null | number = null
        
    /**
    * Minimum number of premises allowed for this premise type
    */
    @field({ decoder: IntegerDecoder, nullable: true, version: 319 })
    min: null | number = null
}

export class PlatformMembershipTypeConfigPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date|null = null

    @field({ decoder: IntegerDecoder })
    price = 0
    
    /**
     * If you set this, it will be possible to choose a custom start and end date within the startDate - endDate period
     */
    @field({ decoder: IntegerDecoder })
    pricePerDay = 0
}

export class PlatformMembershipTypeConfig extends AutoEncoder {
    @field({ decoder: DateDecoder })
    startDate = new Date()

    @field({ decoder: DateDecoder })
    endDate = new Date()

    @field({ decoder: DateDecoder, nullable: true })
    expireDate: Date|null = null

    @field({ decoder: IntegerDecoder })
    amountFree = 0

    @field({ decoder: new ArrayDecoder(PlatformMembershipTypeConfigPrice) })
    prices: PlatformMembershipTypeConfigPrice[] = [PlatformMembershipTypeConfigPrice.create({})]

    getPriceForDate(date: Date) {
        if (date === undefined) {
            throw new Error("Date is required")
        }
        const sorted = this.prices.slice().sort((a, b) => (a.startDate ?? new Date(0)).getTime() - (b.startDate ?? new Date(0)).getTime())
        let price = sorted[0];

        for (const p of sorted) {
            if (p.startDate === null || date >= p.startDate) {
                price = p
            }
        }
        return price
    
    }
    
}

export enum PlatformMembershipTypeBehaviour {
    /**
     * A membership that is valid for a certain period
     */
    Period = "Period",

    /**
     * A membership that is valid for a certain number of days
     */
    Days = "Days"
}

export class PlatformMembershipType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder })
    description = ''

    @field({ decoder: new EnumDecoder(PlatformMembershipTypeBehaviour) })
    behaviour = PlatformMembershipTypeBehaviour.Period

    /**
     * Settings per period
     */
    @field({ decoder: new MapDecoder(StringDecoder, PlatformMembershipTypeConfig) })
    periods: Map<string, PlatformMembershipTypeConfig> = new Map()

    /**
     * Only allow organizations with these tags to use this membership type
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    requiredTagIds: string[]|null = null;

    getPrice(periodId: string, date: Date) {
        const period = this.periods.get(periodId)
        if (!period) {
            return null
        }
        return period.getPriceForDate(date)
    }
}


export class PlatformEventType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder})
    description = ''

    /**
     * Maximum amount that each organization can have this type
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    maximum: null | number = null

    /**
     * Maximum number of days allowed for this event type
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 288 })
    maximumDays: null | number = null

    /**
     * Minimum number of days allowed for this event type
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 288 })
    minimumDays: null | number = null
}

export class PlatformPolicy extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ''

    @field({ decoder: StringDecoder })
    url = ''

    @field({ decoder: BooleanDecoder, version: 327 })
    enableAtSignup = true

    @field({ decoder: BooleanDecoder, version: 327 })
    checkbox = true

    @field({ decoder: RichText, version: 327})
    richText = RichText.create({})
}

export class PrivacySettings extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PlatformPolicy) })
    policies: PlatformPolicy[] = []
}

export class PlatformConfig extends AutoEncoder {
    @field({ decoder: StringDecoder, version: 326})
    name = "Stamhoofd"
    
    /**
     * Cotnains the text and settings for when financial support is enabled - not whether it is enabled
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 320 })
    financialSupport: FinancialSupportSettings | null = null

    /**
     * Contains the text and settings for when data permissions are enabled - not whether it is enabled
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 320 })
    dataPermission: DataPermissionsSettings | null = null
    
    @field({ decoder: OrganizationRecordsConfiguration, version: 253 })
    recordsConfiguration = OrganizationRecordsConfiguration.create({})

    @field({ decoder: new ArrayDecoder(OrganizationTag), version: 260 })
    tags: OrganizationTag[] = []

    @field({ decoder: new ArrayDecoder(PlatformPremiseType), version: 319 })
    premiseTypes: PlatformPremiseType[] = []

    @field({ decoder: new ArrayDecoder(DefaultAgeGroup), version: 261 })
    defaultAgeGroups: DefaultAgeGroup[] = []

    @field({ decoder: new ArrayDecoder(MemberResponsibility), version: 262 })
    responsibilities: MemberResponsibility[] = []

    @field({ decoder: new ArrayDecoder(PlatformMembershipType), version: 268 })
    membershipTypes: PlatformMembershipType[] = []

    @field({ decoder: new ArrayDecoder(PlatformEventType), version: 287 })
    eventTypes: PlatformEventType[] = []

    @field({ decoder: Image, nullable: true, version: 310 })
    coverPhoto: Image|null = null

    @field({ decoder: StringDecoder, nullable: true, version: 310 })
    color: string | null = null

    @field({ decoder: Image, nullable: true, version: 310 })
    horizontalLogoDark: Image | null = null

    @field({ decoder: Image, nullable: true, version: 310 })
    squareLogoDark: Image | null = null

    @field({ decoder: Image, nullable: true, version: 310 })
    horizontalLogo: Image | null = null

    @field({ decoder: Image, nullable: true, version: 310 })
    squareLogo: Image | null = null

    @field({ decoder: BooleanDecoder, optional: true, version: 310 })
    expandLogo = false

    @field({ decoder: PrivacySettings, version: 327 })
    privacy = PrivacySettings.create({})

    getEmailReplacements() {
        return [
            Replacement.create({
                token: "primaryColor",
                value: this.color ? this.color : "#0053ff"
            }),
            Replacement.create({
                token: "primaryColorContrast",
                value: this.color ? Colors.getContrastColor(this.color) : "#fff"
            }),
        ]
    }
}

export class Platform extends AutoEncoder {
    static instance: Platform|null = null

    @field({ decoder: PlatformConfig })
    config: PlatformConfig = PlatformConfig.create({})

    @field({ decoder: PlatformPrivateConfig, nullable: true })
    privateConfig: PlatformPrivateConfig|null = null;

    @field({ decoder: RegistrationPeriod })
    period: RegistrationPeriod = RegistrationPeriod.create({})

    /**
     * The organization that represents the platform for collection of platform memberships payments
     */
    @field({ decoder: StringDecoder, nullable: true, version: 324 })
    membershipOrganizationId: string|null = null

    /**
     * Keep admins accessible and in memory
     */
    admins?:  UserWithMembers[]|null

    /**
     * Keep admins accessible and in memory
     */
    periods?: RegistrationPeriod[]

    /**
     * If you don't have permissions, privateConfig will be null, so there won't be any roles either
     */
    getRoles() {
        return this.privateConfig?.roles ?? []
    }

    static get shared(): Platform {
        if (!Platform.instance) {
            Platform.instance = Platform.create({})
        }
        return Platform.instance
    }

    static get optionalShared(): Platform | null {
        return Platform.instance
    }

    static clearShared() {
        Platform.instance = null
    }

    setShared() {
        Platform.instance = this
    }
}
