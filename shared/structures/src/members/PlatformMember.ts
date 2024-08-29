import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"

import { AccessRight } from "../AccessRight"
import { type Group } from "../Group"
import { GroupType } from "../GroupType"

import { Organization } from "../Organization"
import { PermissionLevel } from "../PermissionLevel"
import { PermissionsResourceType } from "../PermissionsResourceType"

import { Platform } from "../Platform"
import { UserPermissions } from "../UserPermissions"
import { UserWithMembers } from "../UserWithMembers"
import { Address } from "../addresses/Address"
import { StamhoofdFilter } from "../filters/StamhoofdFilter"
import { EmergencyContact } from "./EmergencyContact"
import { MemberDetails } from "./MemberDetails"
import { MemberWithRegistrationsBlob, MembersBlob } from "./MemberWithRegistrationsBlob"
import { ObjectWithRecords } from "./ObjectWithRecords"
import { OrganizationRecordsConfiguration } from "./OrganizationRecordsConfiguration"
import { Parent } from "./Parent"
import { RegisterCheckout } from "./checkout/RegisterCheckout"
import { RegisterItem } from "./checkout/RegisterItem"
import { RecordAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"

export class PlatformFamily {
    members: PlatformMember[] = []
    
    /**
     * Checkout is required for the member to know whether certain fields are required to get collected
     */
    checkout = new RegisterCheckout()

    /**
     * Items that have not been added to the cart/checkout, but will be - and for which data has to be collected
     */
    pendingRegisterItems: RegisterItem[] = []
    
    platform: Platform
    organizations: Organization[] = []

    constructor(context: {contextOrganization?: Organization|null, platform: Platform}) {
        this.platform = context.platform
        this.organizations =context.contextOrganization ? [context.contextOrganization] : []
    }

    insertOrganization(organization: Organization) {
        if (this.organizations.find(o => o.id === organization.id)) {
            return;
        }
        this.organizations.push(organization)
    }

    getOrganization(id: string) {
        return this.organizations.find(o => o.id === id)
    }

    static create(blob: MembersBlob, context: {contextOrganization?: Organization|null, platform: Platform}): PlatformFamily {
        const family = new PlatformFamily(context)
        family.insertFromBlob(blob)
        return family
    }

    insertFromBlob(blob: MembersBlob) {
        for (const organization of blob.organizations) {
            this.insertOrganization(organization)
        }

        for (const member of blob.members) {
            const existing = this.members.find(m => m.id === member.id);
            if (existing) {
                existing.member.deepSet(member)
                continue;
            }

            const platformMember = new PlatformMember({
                member,
                family: this
            })
            this.members.push(platformMember)
        }
    }

    /**
     * Same as insertFromBlob, but doesn't add new members, only updates existing members
     */
    updateFromBlob(blob: MembersBlob) {
        for (const member of blob.members) {
            const existing = this.members.find(m => m.id === member.id);
            if (existing) {
                existing.member.deepSet(member)
            }
        }
    }

    newMember(): PlatformMember {
        const member = new PlatformMember({
            member: MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({}),
                users: [],
                registrations: []
            }),
            family: this,
            isNew: true
        })
        this.members.push(member)
        return member;
    }

    static createSingles(blob: MembersBlob, context: {contextOrganization?: Organization|null, platform: Platform}): PlatformMember[] {
        const memberList: PlatformMember[] = []

        for (const member of blob.members) {
            const family = new PlatformFamily(context);

            for (const organization of blob.organizations) {
                // Check if this organization is relevant to this member
                if (member.registrations.find(r => r.organizationId === organization.id) || member.platformMemberships.find(m => m.organizationId === organization.id) || member.responsibilities.find(r => r.organizationId === organization.id)) {
                    family.insertOrganization(organization)
                }
            }

            const platformMember = new PlatformMember({
                member,
                family
            })

            family.members.push(platformMember)
            memberList.push(platformMember)
        }
        return memberList
    }

    insertSingle(member: MemberWithRegistrationsBlob): PlatformMember {
        const platformMember = new PlatformMember({
            member,
            family: this
        })

        this.members.push(platformMember)
        return platformMember
    }

    /**
     * These clones are for patches so they only become visible after saving
     */
    clone() {
        const family = new PlatformFamily({
            platform: this.platform
        })
        family.organizations = this.organizations;
        family.checkout = this.checkout;
        family.pendingRegisterItems = this.pendingRegisterItems;
        family.members = this.members.map(m => m._cloneWithFamily(family))
        return family
    }

    copyFromClone(clone: PlatformFamily) {
        for (const member of this.members) {
            const cloneMember = clone.members.find(m => m.id === member.id || (m._oldId && m._oldId === member.id && member.isNew))
            if (cloneMember) {
                member.member.deepSet(cloneMember.member)
                member.patch.deepSet(cloneMember.patch)
                member.patch.id = member.id
                member.isNew = cloneMember.isNew
                member._oldId = cloneMember._oldId

                if (cloneMember._savingPatch || cloneMember._isCreating) {
                    console.warn('Copying from member that is being saved')
                }
            } else {
                console.warn('copyFromClone could not find member with id', member.id, 'in clone.')
            }
        }

        for (const c of clone.members) {
            const member = this.members.find(m => m.id === c.id)
            if (!member) {
                this.members.push(c)
            }
        }

        // Delete members that are not in the clone
        this.members = this.members.filter(m => clone.members.find(c => c.id === m.id))

        for (const o of clone.organizations) {
            this.insertOrganization(o)
        }
    }

    getAddressOccurrences(address: Address, skip?: {memberId?: string, parentId?: string}): string[] {
        const occurrences = new Set<string>()

        const searchString = address.toString()

        for (const member of this.members) {
            if (member.patchedMember.details.address) {
                if (!skip?.memberId || member.id !== skip?.memberId) {
                    if (member.patchedMember.details.address.toString() === searchString) {
                        occurrences.add(member.patchedMember.details.name)
                    }
                }
            }

            for (const parent of member.patchedMember.details.parents) {
                if (parent.address) {
                    if (!skip?.parentId || parent.id !== skip?.parentId) {
                        if (parent.address.toString() === searchString) {
                            occurrences.add(parent.name)
                        }
                    }
                }
            }
        }

        return Array.from(occurrences.values())
    }

    get addresses() {
        const addresses = new Map<string, Address>()
        for (const member of this.members) {
            if (member.member.details.address) {
                addresses.set(member.member.details.address.toString(), member.member.details.address)
            }

            if (member.patchedMember.details.address) {
                addresses.set(member.patchedMember.details.address.toString(), member.patchedMember.details.address)
            }

            for (const parent of member.member.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address)
                }
            }
            
            for (const parent of member.patchedMember.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address)
                }
            }

            for(const unverifiedAddress of member.member.details.unverifiedAddresses) {
                addresses.set(unverifiedAddress.toString(), unverifiedAddress);
            }
        }

        return Array.from(addresses.values())
    }

    get parents() {
        if (!this.members) {
            return []
        }
        const parents = new Map<string, Parent>()
        for (const member of this.members) {
            for (const parent of member.patchedMember.details.parents) {
                parents.set(parent.id, parent)
            }
        }

        return Array.from(parents.values())
    }

    updateAddress(oldValue: Address, newValue: Address) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateAddressPatch(oldValue, newValue)
            if (patch !== null) {
                member.addDetailsPatch(patch)
            }
        }
    }

    /// Update all references to this parent (with same id)
    updateParent(parent: Parent) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateParentPatch(parent)
            if (patch !== null) {
                member.addDetailsPatch(patch)
            }
        }
    }

    updateEmergencyContact(emergencyContact: EmergencyContact) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateEmergencyContactPatch(emergencyContact)
            if (patch !== null) {
                member.addDetailsPatch(patch)
            }
        }
    }

    getRecommendedEventsFilter(): StamhoofdFilter {
        const filter: StamhoofdFilter = []

        const groups = new Set<string>()
        const defaultGroupIds = new Set<string>()
        const organizationIds = new Set<string>()
        const organizationTags = new Set<string>()

        for (const member of this.members) {
            for (const group of member.filterGroups({types: [GroupType.Membership], currentPeriod: true})) {
                groups.add(group.id)
                if (group.defaultAgeGroupId) {
                    defaultGroupIds.add(group.defaultAgeGroupId)
                }
                organizationIds.add(group.organizationId)

                const organization = this.organizations.find(o => o.id === group.organizationId)
                if (organization) {
                    for (const tag of organization.meta.tags) {
                        organizationTags.add(tag)
                    }
                }
            }
        }

        filter.push({
            groupIds: {
                $in: [null, ...groups.values()]
            },
            defaultAgeGroupIds: {
                $in: [null, ...defaultGroupIds.values()]
            },
            organizationId: {
                $in: [null, ...organizationIds.values()]
            },
            organizationTagIds: {
                $in: [null, ...organizationTags.values()]
            }
        })

        return filter
    }
}

export enum MembershipStatus {
    Active = "Active",
    Expiring = "Expiring",
    Inactive = "Inactive",
    Temporary = "Temporary"
}

export class PlatformMember implements ObjectWithRecords {
    member: MemberWithRegistrationsBlob
    patch: AutoEncoderPatchType<MemberWithRegistrationsBlob>

    // Save status data:
    _savingPatch: AutoEncoderPatchType<MemberWithRegistrationsBlob>|null = null
    _isCreating: boolean|null = null

    /**
     * In case this was a duplicate member, we need to keep track of the old id to merge changes
     */
    _oldId: string|null = null

    family: PlatformFamily
    isNew = false

    get id() {
        return this.member.id
    }

    constructor(data: {
        member: MemberWithRegistrationsBlob, 
        family: PlatformFamily,
        isNew?: boolean,
        patch?: AutoEncoderPatchType<MemberWithRegistrationsBlob>
    }) {
        this.member = data.member
        this.patch = data.patch ?? MemberWithRegistrationsBlob.patch({id: this.member.id})
        this.family = data.family
        this.isNew = data.isNew ?? false
    }

    clone() {
        const family = this.family.clone()
        return family.members.find(m => m.id === this.id)!
    }

    _cloneWithFamily(family: PlatformFamily) {
        return new PlatformMember({
            member: this.member.clone(),
            family,
            isNew: this.isNew,
            patch: this.patch.clone()
        })
    }

    get organizations() {
        return this.family.organizations
    }

    get platform() {
        return this.family.platform
    }

    get allGroups() {
        return this.organizations.flatMap(o => o.groups)
    }

    get isSaving() {
        return this._savingPatch !== null || this._isCreating !== null
    }

    get membershipStatus() {
        let status = MembershipStatus.Inactive
        const now = new Date()

        for (const t of this.patchedMember.platformMemberships) {
            const organization = this.organizations.find(o => o.id === t.organizationId)
            if (!organization) {
                continue
            }

            if (t.endDate && t.endDate < now) {
                continue
            }

            if (t.startDate > now) {
                continue
            }

            if (t.expireDate && t.expireDate < now) {
                if (status === MembershipStatus.Inactive) {
                    status = MembershipStatus.Expiring
                }
                continue
            }

            const isTemporary = t.endDate.getTime() - t.startDate.getTime() < 1000 * 60 * 60 * 24 * 31

            if (status === MembershipStatus.Inactive || ((status === MembershipStatus.Expiring || status === MembershipStatus.Temporary) && !isTemporary)) {
                if (isTemporary) {
                    status = MembershipStatus.Temporary
                } else {
                    status = MembershipStatus.Active
                }
            }
        }

        return status
    }

    addPatch(p: PartialWithoutMethods<AutoEncoderPatchType<MemberWithRegistrationsBlob>>) {
        this.patch = this.patch.patch(MemberWithRegistrationsBlob.patch(p))
    }

    addEmergencyContact(emergencyContact: EmergencyContact) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>
        arr.addPut(emergencyContact);
        this.addDetailsPatch({
            emergencyContacts: arr
        })
    }

    addParent(parent: Parent) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>
        arr.addPut(parent);
        this.addDetailsPatch({
            parents: arr
        })
    }

    addDetailsPatch(p: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        this.addPatch({
            details: MemberDetails.patch(p)
        })
    }

    isPropertyEnabledForPlatform(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts'|'dataPermission'|'financialSupport' | 'uitpasNumber') {
        if ((property === 'financialSupport' || property === 'uitpasNumber')
            && !this.patchedMember.details.dataPermissions?.value) {
            return false;
        }
        
        if (property === 'dataPermission' || property === 'financialSupport') {
            if (this.platform.config.recordsConfiguration[property]) {
                return true;
            }
            return false;
        }

        const def = this.platform.config.recordsConfiguration[property];
        if (def === null) {
            return false;
        }
        return def.isEnabled(this)
    }

    isPropertyEnabled(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts'|'dataPermission'|'financialSupport'|'uitpasNumber', options?: {checkPermissions?: {user: UserWithMembers, level: PermissionLevel}}) {
        if (this.isPropertyEnabledForPlatform(property)) {
            return true;
        }

        if ((property === 'financialSupport' || property === 'uitpasNumber')
            && !this.patchedMember.details.dataPermissions?.value) {
            return false;
        }

        if (options?.checkPermissions && (property === 'financialSupport' || property === 'uitpasNumber')) {
            const isUserManager = options.checkPermissions.user.members.members.some(m => m.id === this.id)
            if (!isUserManager) {
                // Need permission to view financial support
                let foundPermissions = false;
                for (const organization of this.filterOrganizations({ currentPeriod: true })) {
                    if (options.checkPermissions.user.permissions?.forOrganization(organization, Platform.shared)?.hasAccessRight(options.checkPermissions.level === PermissionLevel.Read ? AccessRight.MemberReadFinancialData : AccessRight.MemberWriteFinancialData)) {
                        foundPermissions = true;
                        break;
                    }
                }
                if (!foundPermissions) {
                    return false;
                }
            }
        }

        const recordsConfigurations = this.filterRecordsConfigurations({currentPeriod: true})

        for (const recordsConfiguration of recordsConfigurations) {
            if (property === 'dataPermission' || property === 'financialSupport') {
                if (recordsConfiguration[property]) {
                    return true;
                }
                continue;
            }

            const def = recordsConfiguration[property];
            if (def === null) {
                continue;
            }
            if (def.enabledWhen === null) {
                return true;
            }
            if (this.doesMatchFilter(def.enabledWhen)) {
                return true;
            }
        }
        return false;
    }

    isPropertyRequiredForPlatform(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts' | 'uitpasNumber') {
        if (!this.isPropertyEnabledForPlatform(property)) {
            return false;
        }

        const def = this.platform.config.recordsConfiguration[property];
        if (def === null) {
            return false;
        }
        return def.isRequired(this)
    }

    isPropertyRequired(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts' | 'uitpasNumber') {
        if (!this.isPropertyEnabled(property)) {
            return false;
        }

        const recordsConfigurations = this.filterRecordsConfigurations({currentPeriod: true})

        for (const recordsConfiguration of recordsConfigurations) {
            const def = recordsConfiguration[property];
            if (def === null) {
                continue;
            }
            if (def.isRequired(this)) {
                return true;
            }
        }
        return false;
    }

    prepareSave() {
        this._savingPatch = this.patch
        this.patch = MemberWithRegistrationsBlob.patch({id: this.member.id})

        this._isCreating = this.isNew
        this.isNew = false
    }

    markSaved() {
        if (this._isCreating === true) {
            this.isNew = false;
        }
        this._savingPatch = null
        this._isCreating = null
    }

    markFailedSave() {
        if (this._savingPatch) {
            this.patch = this._savingPatch.patch(this.patch)
            this._savingPatch = null
        }
        if (this._isCreating !== null) {
            this.isNew = this._isCreating
            this._isCreating = null
        }
    }

    filterRegistrations(filters: {groups?: Group[] | null, canRegister?: boolean, periodId?: string, currentPeriod?: boolean, types?: GroupType[], organizationId?: string}) {
        return this.patchedMember.registrations.filter(r => {
            if (!r.registeredAt === null || r.deactivatedAt !== null) {
                return false;
            }

            if (filters.organizationId && r.organizationId !== filters.organizationId) {
                return false
            }
            
            if (filters.types !== undefined) {
                if (!filters.types.includes(r.group.type)) {
                    return false;
                }
            }

            if (filters.groups && !filters.groups.find(g => g.id === r.groupId)) {
                return false
            }

            if (filters.currentPeriod !== undefined) {
                const organization = this.organizations.find(o => o.id === r.organizationId)
                const isCurrentPeriod = !!organization && r.group.periodId === organization.period.period.id

                if (isCurrentPeriod !== filters.currentPeriod) {
                    return false
                }
            }

            if (filters.periodId && r.group.periodId !== filters.periodId) {
                return false
            }

            if (filters.canRegister !== undefined && r.canRegister !== filters.canRegister) {
                return false
            }

            return true;
        })
    }

    filterGroups(filters: {groups?: Group[] | null, canRegister?: boolean, periodId?: string, currentPeriod?: boolean, types?: GroupType[]}) {
        const registrations =  this.filterRegistrations(filters);
        const base: Group[] = [];

        for (const registration of registrations) {
            if (base.find(g => g.id === registration.groupId)) {
                continue;
            }

            base.push(registration.group)
        }

        // Loop checkout
        for (const item of [...this.family.checkout.cart.items, ...this.family.pendingRegisterItems]) {
            if (item.member.id === this.id) {
                if (filters.currentPeriod === false) {
                    continue
                }

                if (filters.periodId && item.group.periodId !== filters.periodId) {
                    continue
                }

                if (filters.canRegister !== undefined) {
                    continue
                }

                if (!base.find(g => g.id === item.group.id)) {
                    base.push(item.group)
                }
            }
        }

        return base;
    }

    filterRecordsConfigurations(filters: {groups?: Group[] | null, canRegister?: boolean, periodId?: string, currentPeriod?: boolean, types?: GroupType[]}) {
        const groups =  this.filterGroups(filters);
        const configurations: OrganizationRecordsConfiguration[] = [];

        for (const group of groups) {
            const organization = this.family.getOrganization(group.organizationId)
            if (!organization) {
                continue;
            }

            configurations.push(
                OrganizationRecordsConfiguration.build({
                    platform: this.platform,
                    organization,
                    group,
                    includeGroup: true
                })
            )
        }

        if (groups.length === 0) {
            configurations.push(
                OrganizationRecordsConfiguration.build({
                    platform: this.platform,
                })
            )
        }

        return configurations

    }

    filterOrganizations(filters: {groups?: Group[] | null, canRegister?: boolean, periodId?: string, currentPeriod?: boolean, types?: GroupType[]}) {
        const registrations =  this.filterRegistrations(filters);
        const base: Organization[] = [];

        for (const registration of registrations) {
            if (base.find(g => g.id === registration.organizationId)) {
                continue;
            }

            const organization = this.organizations.find(o => o.id === registration.organizationId);
            if (organization) {
                base.push(organization)
            }
        }

        // Loop checkout
        for (const item of [...this.family.checkout.cart.items, ...this.family.pendingRegisterItems]) {
            if (item.member.id === this.id) {
                if (filters.currentPeriod === false) {
                    continue
                }

                if (filters.periodId && item.group.periodId !== filters.periodId) {
                    continue
                }

                if (filters.canRegister !== undefined) {
                    continue
                }

                if (filters.types !== undefined) {
                    if (!filters.types.includes(item.group.type)) {
                        continue;
                    }
                }

                if (!base.find(g => g.id === item.organization.id)) {
                    base.push(item.organization)
                }
            }
        }

        // for (const responsibility of this.patchedMember.responsibilities) {
        //     if (!responsibility.isActive) {
        //         continue;
        //     }
        //     if (base.find(g => g.id === responsibility.organizationId)) {
        //         continue;
        //     }
        // 
        //     const organization = this.organizations.find(o => o.id === responsibility.organizationId);
        //     if (organization) {
        //         base.push(organization)
        //     }
        // }

        return base;
    }

    get groups() {
        return this.filterGroups({currentPeriod: true});
    }

    insertOrganization(organization: Organization) {
        this.family.insertOrganization(organization)
    }

    canRegister(group: Group, organization: Organization) {
        const item = RegisterItem.defaultFor(this, group, organization);
        
        const error = item.validationError;
        if (error === null) {
            return true;
        }
        
        return false;
    }

    canRegisterForWaitingList(group: Group, organization: Organization) {
        const item = RegisterItem.defaultFor(this, group, organization);
        
        const error = item.validationErrorForWaitingList;
        if (error === null) {
            return true;
        }
        
        return false;
    }

    get patchedMember() {
        if (this._savingPatch) {
            return this.member.patch(this._savingPatch).patch(this.patch)
        }
        return this.member.patch(this.patch)
    }

    doesMatchFilter(filter: StamhoofdFilter)  {
        return this.patchedMember.doesMatchFilter(filter);
    }

    getAllRecordCategories(): RecordCategory[] {
        // From organization
        const categories: RecordCategory[] = [];
        categories.push(...this.platform.config.recordsConfiguration.recordCategories)

        for (const organization of this.organizations) {
            categories.push(...organization.meta.recordsConfiguration.recordCategories)
        }

        return categories;
    }

    getEnabledRecordCategories(options: {checkPermissions?: {
        permissions: UserPermissions|null, 
        level: PermissionLevel}|null, 
        scopeOrganization?: Organization|null,
        scopeGroup?: Group|null,
    }): RecordCategory[] {
        const checkPermissions = options.checkPermissions
        if (checkPermissions && !checkPermissions.permissions) {
            return []
        }
        
        // From organization
        const categories: RecordCategory[] = [];
        const scopedOrganizations = options.scopeOrganization ? [options.scopeOrganization] : this.filterOrganizations({currentPeriod: true});

        const recordsConfigurations = this.filterRecordsConfigurations({currentPeriod: true, groups: options.scopeGroup ? [options.scopeGroup] : null})

        for (const recordsConfiguration of recordsConfigurations) {
            for (const recordCategory of recordsConfiguration.recordCategories) {
                if (categories.find(c => c.id === recordCategory.id)) {
                    // Already added
                    continue;
                }

                if (recordCategory.isEnabled(this)) {
                    if (checkPermissions && checkPermissions.permissions) {
                        // Check permissions
                        // we need at least permission in one organization
                        let hasPermission = false;
                        for (const organization of scopedOrganizations) {
                            const organizationPermissions = checkPermissions.permissions.forOrganization(organization, Platform.shared);

                            if (!organizationPermissions) {
                                continue;
                            }

                            if (organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, recordCategory.id, checkPermissions.level)) {
                                hasPermission = true;
                                break;
                            }
                        }

                        if (!hasPermission) {
                            continue;
                        }
                    }

                    categories.push(recordCategory)
                }
            }
        }
        
        return categories;
    }

    isExistingMember(organizationId: string): boolean {
        const member = this.member;
        if (member.registrations.length === 0) {
            return false
        }
    
        const organization = this.organizations.find(o => o.id === organizationId)
        if (!organization) {
            return false;
        }

        for (const registration of member.registrations) {
            if (registration.group.type === GroupType.Membership && registration.registeredAt !== null && registration.deactivatedAt === null) {
                return true
            }
        }
    
        return false
    }

    isRecordEnabled(record: RecordSettings): boolean {
        if (record.sensitive && !this.patchedMember.details.dataPermissions?.value) {
            return false;
        }
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.patchedMember.details.recordAnswers
    }

    getResponsibilities(organization?: Organization|null) {
        return this.patchedMember.responsibilities
            .filter(r => (r.endDate === null || r.endDate > new Date()) && (!organization || r.organizationId === organization.id))
    }
}
