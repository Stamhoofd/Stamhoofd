import { AutoEncoder, EnumDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter,MergeHelper,OnlyWritabelKeys,StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Address } from "../addresses/Address";
import { ParentType } from "./ParentType";

export class Parent extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(ParentType) })
    type: ParentType = ParentType.Mother;

    @field({ decoder: StringDecoder })
    firstName = "";

    @field({ decoder: StringDecoder })
    lastName = "";

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, field: "mail" })
    @field({ decoder: StringDecoder, nullable: true, version: 5 })
    email: string | null = null;

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    get name() {
        if (!this.firstName) {
            return this.lastName;
        }
        if (!this.lastName) {
            return this.firstName;
        }
        return this.firstName + " " + this.lastName;
    }

    matchQuery(query: string): boolean {
        if (
            StringCompare.typoCount(this.firstName, query) < 2 ||
            StringCompare.typoCount(this.lastName, query) < 2 ||
            StringCompare.typoCount(this.name, query) < 2
        ) {
            return true;
        }
        return false;
    }

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.firstName)) {
            this.firstName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.firstName.toLowerCase()))
        }
        if (StringCompare.isFullCaps(this.lastName)) {
            this.lastName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.lastName.toLowerCase()))
        }

        if (this.email) {
            this.email = this.email.toLowerCase().trim()
        }

        if (this.phone) {
            this.phone = Formatter.removeDuplicateSpaces(this.phone.trim())
        }

        this.firstName = Formatter.capitalizeFirstLetter(Formatter.removeDuplicateSpaces(this.firstName.trim()))
        this.lastName = Formatter.removeDuplicateSpaces(this.lastName.trim())

        if (this.lastName === this.lastName.toLocaleLowerCase()) {
            // Add auto capitals
            this.lastName = Formatter.capitalizeWords(this.lastName)
        }

        this.address?.cleanData()
    }

    isEqual(other: Parent) {
        this.cleanData();
        other.cleanData();
        return this.firstName === other.firstName && this.lastName === other.lastName && this.email === other.email && this.phone === other.phone && this.address?.toString() === other.address?.toString()
    }

    mergeChanges(other: Parent) {
        const changes: Partial<OnlyWritabelKeys<Parent>> = {};
        const merge = (key: keyof OnlyWritabelKeys<Parent>, checkEmpty = false) => MergeHelper.mergeChange(this, other, changes, key, checkEmpty);
        const forceMerge = (key: keyof OnlyWritabelKeys<Parent>) => MergeHelper.forceChange(this, other, changes, key);

        const requiredDetails: (keyof OnlyWritabelKeys<Parent>)[] = ['firstName', 'lastName'];

        requiredDetails.forEach(detail => merge(detail, true));

        const compulsoryDetails: (keyof OnlyWritabelKeys<Parent>)[] = ['email', 'address', 'phone'];

        compulsoryDetails.forEach((detail) => merge(detail));

        if (other.type) {
            if (other.type === ParentType.Parent1 || other.type === ParentType.Parent2) {
                // Ignore if current type is also not one of those
                if (this.type === ParentType.Parent1 || this.type === ParentType.Parent2) {
                    forceMerge('type');
                }
            } else {
                forceMerge('type');
            }
        }

        return changes as Partial<Parent>;
    }

    merge(other: Parent) {
        if (other.firstName.length > 0) {
            this.firstName = other.firstName
        }
        if (other.lastName.length > 0) {
            this.lastName = other.lastName
        }

        if (other.email) {
            this.email = other.email
        }

        if (other.address) {
            this.address = other.address
        }

        if (other.phone) {
            this.phone = other.phone
        }

        if (other.type) {
            if (other.type === ParentType.Parent1 || other.type === ParentType.Parent2) {
                // Ignore if current type is also not one of those
                if (this.type === ParentType.Parent1 || this.type === ParentType.Parent2) {
                    this.type = other.type
                }
            } else {
                this.type = other.type
            }
        }
    }
}
