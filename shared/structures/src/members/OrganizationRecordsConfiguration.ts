import { ArrayDecoder, AutoEncoder, Decoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"

import { PropertyFilter } from "../filters/PropertyFilter"
import { LegacyRecordType } from "./records/LegacyRecordType"
import { RecordCategory } from "./records/RecordCategory"

export enum AskRequirement {
    NotAsked = "NotAsked",
    Optional = "Optional",
    Required = "Required"
}

export class FreeContributionSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: new ArrayDecoder(IntegerDecoder) })
    amounts: number[] = [500, 1500, 3000]
}

export class FinancialSupportSettings extends AutoEncoder {
    /**
     * E.g. 'financial support'
     */
    @field({ decoder: StringDecoder })
    title = FinancialSupportSettings.defaultTitle

    /**
     * E.g. 'We provide financial support for families in financial difficulties. You can ask for this by checking this checkbox'
     */
    @field({ decoder: StringDecoder })
    description = FinancialSupportSettings.defaultDescription

    /**
     * E.g. 'My family is in need of financial support'
     */
    @field({ decoder: StringDecoder })
    checkboxLabel = FinancialSupportSettings.defaultCheckboxLabel

    /**
     * E.g. 'Uses financial support'
     */
    @field({ decoder: StringDecoder, optional: true })
    warningText = FinancialSupportSettings.defaultWarningText

    static get defaultDescription() {
        return "We doen ons best om de kostprijs van onze activiteiten zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om."
    }

    static get defaultTitle() {
        return "Financiële ondersteuning"
    }

    static get defaultCheckboxLabel() {
        return "Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken"
    }

    static get defaultWarningText() {
        return "Gebruikt financiële ondersteuning"
    }
}

export class DataPermissionsSettings extends AutoEncoder {
    /**
     * E.g. 'financial support'
     */
    @field({ decoder: StringDecoder })
    title = DataPermissionsSettings.defaultTitle

    /**
     * E.g. 'We provide financial support for families in financial difficulties. You can ask for this by checking this checkbox'
     */
    @field({ decoder: StringDecoder })
    description = DataPermissionsSettings.defaultDescription

    /**
     * E.g. 'My family is in need of financial support'
     */
    @field({ decoder: StringDecoder })
    checkboxLabel = DataPermissionsSettings.defaultCheckboxLabel

    /**
     * E.g. 'Uses financial support'
     */
    @field({ decoder: StringDecoder, optional: true })
    warningText = DataPermissionsSettings.defaultWarningText

    static get defaultDescription() {
        return ""
    }

    static get defaultTitle() {
        return "Toestemming verzamelen gevoelige gegevens"
    }

    static get defaultCheckboxLabel() {
        return "Ik geef toestemming om gevoelige gegevens te verzamelen en te verwerken. Hoe we met deze gegevens omgaan staat vermeld in ons privacybeleid."
    }

    static get defaultWarningText() {
        return "Geen toestemming om gevoelige gegevens te verzamelen"
    }
}

export class OrganizationRecordsConfiguration extends AutoEncoder {
    // New record configurations

    /**
     * If the organizations provides support for families in financial difficulties
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 117 })
    financialSupport: FinancialSupportSettings | null = null

    /**
     * Ask permissions to collect data
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 117 })
    dataPermission: DataPermissionsSettings | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 124 })
    emailAddress: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    phone: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    gender: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    birthDay: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    address: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    parents: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    emergencyContacts: PropertyFilter | null = null

    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), version: 117 })
    recordCategories: RecordCategory[] = []

    // General configurations
    @field({ decoder: FreeContributionSettings, nullable: true, version: 92 })
    freeContribution: FreeContributionSettings | null = null

    /**
     * @deprecated
     * Moved to recordCategories
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), field: "enabledRecords" })
    @field({ decoder: new ArrayDecoder(new EnumDecoder(LegacyRecordType)), upgrade: () => [], version: 55, field: "enabledRecords" })
    @field({ decoder: new ArrayDecoder(new EnumDecoder(LegacyRecordType)), version: 117, field: "enabledLegacyRecords", optional: true })
    enabledLegacyRecords: LegacyRecordType[] = []

    /**
     * @deprecated
     * true: required
     * false: don't ask
     * null: optional
     */
    @field({ decoder: new EnumDecoder(AskRequirement), optional: true })
    doctor = AskRequirement.NotAsked

    /**
     * @deprecated
     * true: required
     * false: don't ask
     * null: optional
     */
    @field({ decoder: new EnumDecoder(AskRequirement), optional: true })
    emergencyContact = AskRequirement.Optional
}
