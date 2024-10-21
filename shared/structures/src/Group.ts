import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { StamhoofdFilter } from './filters/StamhoofdFilter';
import { GroupCategory } from './GroupCategory';
import { GroupGenderType } from './GroupGenderType';
import { GroupPrivateSettings } from './GroupPrivateSettings';
import { GroupSettings, WaitingListType } from './GroupSettings';
import { GroupType } from './GroupType';
import { Gender } from './members/Gender';
import { PermissionLevel } from './PermissionLevel';
import { PermissionsResourceType } from './PermissionsResourceType';
import { StockReservation } from './StockReservation';

export enum GroupStatus {
    Open = 'Open',
    Closed = 'Closed',

    /**
     * @deprecated
     */
    Archived = 'Archived',
}

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(GroupType), version: 286 })
    type: GroupType = GroupType.Membership;

    @field({ decoder: StringDecoder, version: 250 })
    organizationId: string = '';

    @field({ decoder: StringDecoder, version: 265 })
    periodId: string = '';

    @field({ decoder: StringDecoder, nullable: true, version: 267 })
    defaultAgeGroupId: string | null = null;

    @field({ decoder: Group, nullable: true, version: 292 })
    waitingList: Group | null = null;

    @field({ decoder: new ArrayDecoder(StockReservation), nullable: true, version: 298 })
    stockReservations: StockReservation[] = [];

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder })
    cycle = 0;

    @field({ decoder: GroupSettings })
    settings: GroupSettings = GroupSettings.create({});

    @field({ decoder: DateDecoder, version: 187 })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true, version: 187 })
    deletedAt: Date | null = null;

    /**
     * Only set when you have access to this information
     */
    @field({ decoder: GroupPrivateSettings, nullable: true, version: 10 })
    privateSettings: GroupPrivateSettings | null = null;

    /**
     * Manually close a group
     */
    @field({ decoder: new EnumDecoder(GroupStatus), version: 192 })
    status = GroupStatus.Open;

    static defaultSort(this: unknown, a: Group, b: Group) {
        if (a.settings.maxAge && !b.settings.maxAge) {
            return -1;
        }
        if (b.settings.maxAge && !a.settings.maxAge) {
            return 1;
        }
        if (!b.settings.maxAge && !a.settings.maxAge) {
            // name
            return Group.nameSort(a, b);
        }
        if (a.settings.maxAge! > b.settings.maxAge!) {
            return 1;
        }
        if (a.settings.maxAge! < b.settings.maxAge!) {
            return -1;
        }
        return Group.nameSort(a, b);
    }

    static nameSort(this: unknown, a: Group, b: Group) {
        if (a.settings.name.toLowerCase() < b.settings.name.toLowerCase()) {
            return -1;
        }
        if (a.settings.name.toLowerCase() > b.settings.name.toLowerCase()) {
            return 1;
        }
        return 0;
    }

    getMemberCount({ waitingList }: { waitingList?: boolean } = {}) {
        return this.settings.getMemberCount({ waitingList });
    }

    /**
     * Return the pre registration date only if is is active right now
     */
    get activePreRegistrationDate() {
        if (!this.settings.registrationStartDate) {
            // Registration start date is a requirement for pre registrations
            return null;
        }
        if (this.settings.registrationStartDate < new Date() || this.settings.waitingListType !== WaitingListType.PreRegistrations) {
            // Start date is in the past: registrations are open
            return null;
        }
        return this.settings.preRegistrationsDate;
    }

    /**
     * Closed now, but will open in the future
     */
    get notYetOpen() {
        if (!this.settings.registrationStartDate) {
            return false;
        }

        const now = new Date();
        const preRegistrationDate = this.activePreRegistrationDate;

        if (this.settings.registrationStartDate > now && (!preRegistrationDate || preRegistrationDate > now)) {
            // Start date or pre registration date are in the future

            return true;
        }

        return false;
    }

    /**
     * No registrations and waiting list registrations are possible if closed
     */
    get closed() {
        if (this.status !== GroupStatus.Open) {
            return true;
        }

        if (this.notYetOpen) {
            // Start date or pre registration date are in the future
            return true;
        }

        const now = new Date();
        if (this.settings.registrationEndDate && this.settings.registrationEndDate < now) {
            return true;
        }

        return false;
    }

    hasWaitingList(): boolean {
        return this.settings.canHaveWaitingList || this.waitingList !== null;
    }

    /**
     * Returns all parent and grandparents of this group
     */
    getParentCategories(all: GroupCategory[], recursive = true): GroupCategory[] {
        const map = new Map<string, GroupCategory>();

        const parents = all.filter(g => g.groupIds.includes(this.id));
        for (const parent of parents) {
            map.set(parent.id, parent);

            if (recursive) {
                const hisParents = parent.getParentCategories(all);
                for (const pp of hisParents) {
                    map.set(pp.id, pp);
                }
            }
        }

        return [...map.values()];
    }

    hasAccess(permissions: import('./LoadedPermissions').LoadedPermissions | null, allCategories: GroupCategory[], permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!permissions) {
            return false;
        }

        if (permissions.hasResourceAccess(PermissionsResourceType.Groups, this.id, permissionLevel)) {
            return true;
        }

        // Check parent categories
        const parentCategories = this.getParentCategories(allCategories);
        for (const category of parentCategories) {
            if (permissions.hasResourceAccess(PermissionsResourceType.GroupCategories, category.id, permissionLevel)) {
                return true;
            }
        }

        return false;
    }

    isPublic(allCategories: GroupCategory[]): boolean {
        for (const parent of this.getParentCategories(allCategories)) {
            if (!parent.settings.public) {
                return false;
            }
        }
        return true;
    }

    hasReadAccess(permissions: import('./LoadedPermissions').LoadedPermissions | null, allCategories: GroupCategory[]): boolean {
        return this.hasAccess(permissions, allCategories, PermissionLevel.Read);
    }

    hasWriteAccess(permissions: import('./LoadedPermissions').LoadedPermissions | null, allCategories: GroupCategory[]): boolean {
        return this.hasAccess(permissions, allCategories, PermissionLevel.Write);
    }

    hasFullAccess(permissions: import('./LoadedPermissions').LoadedPermissions | null, allCategories: GroupCategory[]): boolean {
        return this.hasAccess(permissions, allCategories, PermissionLevel.Full);
    }

    get squareImage() {
        return this.settings.squarePhoto ?? this.settings.coverPhoto;
    }

    getRecommendedFilter(): StamhoofdFilter {
        const filter: StamhoofdFilter = [];

        if (this.settings.minAge !== null) {
            filter.push({
                age: {
                    $gt: this.settings.minAge - 1,
                },
            });
        }

        if (this.settings.maxAge !== null) {
            filter.push({
                age: {
                    $lt: this.settings.maxAge + 1,
                },
            });
        }

        if (this.settings.genderType === GroupGenderType.OnlyMale) {
            filter.push({
                gender: Gender.Male,
            });
        }

        if (this.settings.genderType === GroupGenderType.OnlyFemale) {
            filter.push({
                gender: Gender.Male,
            });
        }

        if (this.settings.requireGroupIds.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        groupId: {
                            $in: this.settings.requireGroupIds,
                        },
                    },
                },
            });
        }

        if (this.settings.requireDefaultAgeGroupIds.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        periodId: this.periodId,
                        group: {
                            defaultAgeGroupId: {
                                $in: this.settings.requireDefaultAgeGroupIds,
                            },
                        },
                    },
                },
            });
        }
        else {
            if (this.settings.requirePlatformMembershipOn !== null) {
                const requirePlatformMembershipOn = this.settings.requirePlatformMembershipOn;

                filter.push({
                    platformMemberships: {
                        $elemMatch: {
                            endDate: {
                                $gt: requirePlatformMembershipOn,
                            },
                        },
                    },
                });
            }
        }

        if (this.settings.requireOrganizationIds.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        periodId: this.periodId,
                        organizationId: {
                            $in: this.settings.requireOrganizationIds,
                        },
                    },
                },
            });
        }

        if (this.settings.requireOrganizationTags.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        periodId: this.periodId,
                        organization: {
                            tags: {
                                $in: this.settings.requireOrganizationTags,
                            },
                        },
                    },
                },
            });
        }

        return filter;
    }
}

export const GroupPatch = Group.patchType();
