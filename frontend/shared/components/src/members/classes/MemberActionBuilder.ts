import { Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding'
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation'
import { SessionContext, useRequestOwner } from '@stamhoofd/networking'
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportRequest, ExcelExportResponse, ExcelExportType, ExcelSheetFilter, ExcelWorkbookFilter, Group, GroupCategoryTree, GroupType, MemberWithRegistrationsBlob, Organization, PermissionLevel, Platform, PlatformMember, RegistrationWithMember, mergeFilters } from '@stamhoofd/structures'
import { Formatter } from '@stamhoofd/utility'
import { markRaw } from 'vue'
import { EditMemberAllBox, MemberSegmentedView, MemberStepView, checkoutDefaultItem, chooseOrganizationMembersForGroup } from '..'
import { GlobalEventBus } from '../../EventBus'
import EmailView from '../../email/EmailView.vue'
import { useContext, useOrganization, usePlatform } from '../../hooks'
import { CenteredMessage } from '../../overlays/CenteredMessage'
import { Toast } from '../../overlays/Toast'
import { AsyncTableAction, InMemoryTableAction, MenuTableAction, TableAction, TableActionSelection } from '../../tables/classes'
import { NavigationActions } from '../../types/NavigationActions'
import { PlatformFamilyManager, usePlatformFamilyManager } from '../PlatformFamilyManager'
import EditMemberResponsibilitiesBox from '../components/edit/EditMemberResponsibilitiesBox.vue'
import { RegistrationActionBuilder } from './RegistrationActionBuilder'
import { ExcelExportView, SelectableColumn, SelectableSheet, SelectableWorkbook } from '@stamhoofd/frontend-excel-export'
import { getSelectableWorkbook } from './getSelectableWorkbook'

export function useDirectMemberActions(options?: {groups?: Group[], organizations?: Organization[]}) {
    return useMemberActions()(options)
}

function downloadURL(url: string, name: string) {
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function useMemberActions() {
    const present = usePresent()
    const context = useContext()
    const platformFamilyManager = usePlatformFamilyManager()
    const owner = useRequestOwner()
    const organization = useOrganization()
    const platform = usePlatform()

    return (options?: {groups?: Group[], organizations?: Organization[]}) => {
        return new MemberActionBuilder({
            present,
            platform: platform.value,
            context: context.value,
            groups: options?.groups ?? [],
            organizations: organization.value ? [organization.value] : (options?.organizations ?? []),
            platformFamilyManager,
            owner
        })
    }
}

export class MemberActionBuilder {
    /**
     * Determines which registrations will get moved or removed
     */
    groups: Group[]
    platform: Platform

    /**
     * Determines what to move or register the members to
     */
    organizations: Organization[]
    
    present: ReturnType<typeof usePresent>
    context: SessionContext
    platformFamilyManager: PlatformFamilyManager
    owner: any

    constructor(settings: {
        present: ReturnType<typeof usePresent>,
        context: SessionContext,
        groups: Group[],
        platform: Platform,
        organizations: Organization[],
        platformFamilyManager: PlatformFamilyManager
        owner: any
    }) {
        this.present = settings.present
        this.context = settings.context
        this.platform = settings.platform
        this.groups = settings.groups
        this.organizations = settings.organizations
        this.platformFamilyManager = settings.platformFamilyManager
        this.owner = settings.owner
    }

    get hasWrite() {
        for (const group of this.groups) {
            if (!this.context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                return false
            }
        }
        return true
    }

    getRegistrationActionBuilder(members: PlatformMember[]) {
        if (this.organizations.length !== 1) {
            return;
        }

        const groupOrganization = this.organizations[0]
        const registrations = members.flatMap(m => m.filterRegistrations({groups: this.groups, organizationId: groupOrganization.id}))

        return new RegistrationActionBuilder({
            context: this.context,
            owner: this.owner,
            present: this.present,
            organization: groupOrganization,
            registrations,
            members,
            platformFamilyManager: this.platformFamilyManager
        })
    }

    getRegisterActions(organization?: Organization): TableAction<PlatformMember>[] {
        if (!organization) {
            if (this.organizations.length === 1) {
                return this.getRegisterActions(this.organizations[0])
            }
            return this.organizations.map(org => {
                return new MenuTableAction({
                    name: "Inschrijven bij " + org.name,
                    groupIndex: 0,
                    childActions: () => this.getRegisterActions(org)
                })
            })
        }

        return [
            new MenuTableAction({
                name: "Wachtlijsten",
                groupIndex: 0,
                enabled: organization.period.waitingLists.length > 0,
                childActions: () => [
                    ...organization.period.waitingLists.map(g => {
                        return new InMemoryTableAction({
                            name: g.settings.name,
                            needsSelection: true,
                            allowAutoSelectAll: false,
                            handler: async (members: PlatformMember[]) => {
                                await this.register(members, g)
                            }
                        })
                    })
                ]
            }),
            ...this.getActionsForCategory(organization.period.adminCategoryTree, async (members, group) => await this.register(members, group))
        ]
    }

    getMoveAction(): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1) {
            return []
        }

        if (this.groups.filter(g => g.type !== GroupType.EventRegistration).length === 0) {
            return []
        }

        const organization = this.organizations[0]
        return [
            new MenuTableAction({
                name: "Verplaatsen naar",
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                childActions: () => [
                    new MenuTableAction({
                        name: "Wachtlijsten",
                        groupIndex: 0,
                        enabled: organization.period.waitingLists.length > 0,
                        childActions: () => [
                            ...organization.period.waitingLists.map(g => {
                                return new InMemoryTableAction({
                                    name: g.settings.name,
                                    needsSelection: true,
                                    allowAutoSelectAll: false,
                                    handler: async (members: PlatformMember[]) => {
                                        await this.moveRegistrations(members, g)
                                    }
                                })
                            })
                        ]
                    }),
                    ...this.getActionsForCategory(organization.adminCategoryTree, (members, group) => this.moveRegistrations(members, group))
                ]
            })
        ]
    }

    getEditAction(): TableAction<PlatformMember>[] {
        if (this.organizations.length !== 1 || this.groups.length === 0) {
            return []
        }

        return [
            new InMemoryTableAction({
                name: "Bewerk inschrijving",
                priority: 1,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite,
                handler: async (members: PlatformMember[]) => {
                    await this.editRegistrations(members)
                },
                icon: 'edit'
            })
        ]
    }

    getUnsubscribeAction(): TableAction<PlatformMember>[] {
        if (this.groups.length === 0) {
            return []
        }

        return [new InMemoryTableAction({
            name: "Uitschrijven",
            priority: 0,
            groupIndex: 7,
            needsSelection: true,
            allowAutoSelectAll: false,
            enabled: this.hasWrite,
            handler: async (members) => {
                await this.deleteRegistration(members)
            }
        })];
    }

    getActionsForCategory(category: GroupCategoryTree, action: (members: PlatformMember[], group: Group) => void|Promise<void>): TableAction<PlatformMember>[] {
        return [
            ...category.categories.map(c => {
                return new MenuTableAction({
                    name: c.settings.name,
                    groupIndex: 2,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    enabled: c.groups.length > 0 || c.categories.length > 0,
                    childActions: () => this.getActionsForCategory(c, action),
                })
            }),
            ...category.groups.map(g => {
                return new InMemoryTableAction({
                    name: g.settings.name,
                    needsSelection: true,
                    allowAutoSelectAll: false,
                    handler: async (members: PlatformMember[]) => {
                        await action(members, g)
                    }
                })
            })
        ];
    }

    getActions(): TableAction<PlatformMember>[] {
        return [
            new InMemoryTableAction({
                name: "Bewerk lid",
                icon: "edit",
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.hasWrite,
                handler: (members: PlatformMember[]) => {
                    this.editMember(members[0])
                }
            }),

            new InMemoryTableAction({
                name: "Functies bewerken",
                icon: "star",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                enabled: this.context.auth.hasFullAccess(),
                handler: (members: PlatformMember[]) => {
                    this.editResponsibilities(members[0])
                }
            }),
        
            new AsyncTableAction({
                name: "E-mailen",
                icon: "email",
                priority: 12,
                groupIndex: 3,
                handler: async (selection: TableActionSelection<PlatformMember>) => {
                    await this.openMail(selection)
                }
            }),
        
            new AsyncTableAction({
                name: "Exporteren naar Excel",
                icon: "download",
                priority: 11,
                groupIndex: 3,
                handler: async (selection) => {
                    console.log('selection', selection)
                    // TODO: vervangen door een context menu
                    await this.exportToExcel(selection)
                }
            }),
            new MenuTableAction({
                name: "Inschrijven voor",
                priority: 1,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                enabled: this.hasWrite && !!this.context.organization,
                childActions: () => this.getRegisterActions()
            }),

            ...this.getMoveAction(),
            ...this.getEditAction(),

            ...this.getUnsubscribeAction(),

            new InMemoryTableAction({
                name: "Definitief verwijderen",
                priority: 1,
                groupIndex: 100,
                needsSelection: true,
                allowAutoSelectAll: false,
                icon: "trash",
                enabled: !this.context.organization && this.context.auth.hasFullPlatformAccess(),
                handler: async (members: PlatformMember[]) => {
                    await this.deleteMembers(members);
                }
            })

        ]
    }

    // Action implementations
    async openMail(selection: TableActionSelection<PlatformMember>) {
        const filter = selection.filter.filter
        const search = selection.filter.search

        const options: {
            name: string,
            value: EmailRecipientSubfilter[]
        }[][] = [];

        options.push([
            {
                name: "Alle leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.Members,
                        filter,
                        search
                    })
                ]
            },
            {
                name: "Geen leden",
                value: []
            },
            {
                name: "Alle volwassen leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.Members,
                        filter: mergeFilters([
                            filter,
                            {
                                age: {
                                    $gt: 17
                                }
                            }
                        ]),
                        search
                    })
                ]
            }
        ])

        options.push([
            {
                name: "Ouders van minderjarige leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.MemberParents,
                        filter: mergeFilters([
                            filter,
                            {
                                age: {
                                    $lt: 18
                                }
                            }
                        ]),
                        search
                    })
                ]
            },
            {
                name: "Alle ouders",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.MemberParents,
                        filter,
                        search
                    })
                ]
            },
            {
                name: "Geen ouders",
                value: []
            }
        ])

        options.push([
            {
                name: "Geen niet-geverifieerde adressen",
                value: [],
            },
            {
                name: "Niet-geverifieerde adressen van minderjarige leden",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.MemberUnverified,
                        filter: mergeFilters([
                            filter,
                            {
                                age: {
                                    $lt: 18
                                }
                            }
                        ]),
                        search
                    })
                ]
            },
            {
                name: "Alle niet-geverifieerde adressen",
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.MemberUnverified,
                        filter,
                        search
                    })
                ]
            }
        ])

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailView, {
                emails: this.organizations.flatMap(o => o.privateMeta?.emails),
                recipientFilterOptions: options,
                manageEmails: () => {
                    // todo
                }
            })
        });
        await this.present({
            components: [
                displayedComponent
            ],
            modalDisplayStyle: "popup"
        });
    }

    async showMember(member: PlatformMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSegmentedView, {
                member
            }),
        });

        await this.present({
            components: [component],
            modalDisplayStyle: "popup"
        });
    }

    editMember(member: PlatformMember) {
        this.present({
            components: [
                new ComponentWithProperties(MemberStepView, {
                    member,
                    title: member.member.firstName + ' bewerken',
                    component: markRaw(EditMemberAllBox),
                    saveHandler: async ({dismiss}: NavigationActions) => {
                        await dismiss({force: true});
                    }
                })
            ],
            modalDisplayStyle: "popup"
        }).catch(console.error)
    }

    editResponsibilities(member: PlatformMember) {
        this.present({
            components: [
                new ComponentWithProperties(MemberStepView, {
                    member,
                    title: 'Functies van ' + member.member.firstName,
                    component: markRaw(EditMemberResponsibilitiesBox),
                    saveHandler: async ({dismiss}: NavigationActions) => {
                        await dismiss({force: true});
                    }
                })
            ],
            modalDisplayStyle: "popup"
        }).catch(console.error)
    }
    async deleteMembers(members: PlatformMember[]) {
        if (!await CenteredMessage.confirm('Ben je zeker dat je ' + Formatter.pluralText(members.length, 'lid', 'leden') + ' wilt verwijderen?', 'Ja, verwijderen', 'De volledige geschiedenis gaat verloren. Probeer dit absoluut te vermijden en enkel voor uitzonderingen te gebruiken.')) {
            return
        }

        if (!await CenteredMessage.confirm('Ben je 100% zeker?', 'Ja, verwijderen', 'De volledige geschiedenis gaat verloren. Probeer dit absoluut te vermijden en enkel voor uitzonderingen te gebruiken.')) {
            return
        }

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        for (const member of members) {
            patch.addDelete(member.id)
        }

        await this.platformFamilyManager.isolatedPatch(members, patch)
        GlobalEventBus.sendEvent('members-deleted', members).catch(console.error)

        Toast.success(Formatter.capitalizeFirstLetter(Formatter.pluralText(members.length, 'lid', 'leden')) + ' verwijderd').show()
    }

    async exportToExcel(selection: TableActionSelection<PlatformMember>) {
        await this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ExcelExportView, {
                        type: ExcelExportType.Members,
                        filter: selection.filter,
                        workbook: getSelectableWorkbook(this.platform, this.organizations.length === 1 ? this.organizations[0] : null),
                        configurationId: 'members'
                    })
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async deleteRegistration(members: PlatformMember[]) {
        const deleteRegistrations = members.flatMap(m => m.filterRegistrations({groups: this.groups}).map(r => RegistrationWithMember.from(r, m.patchedMember.tiny)))
        return await chooseOrganizationMembersForGroup({
            members, 
            group: this.groups[0],
            context: this.context,
            owner: this.owner,
            deleteRegistrations,
            items: [],
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve()
            }
        })
    }

    get groupIds() {
        return this.groups?.map(g => g.id) ?? []
    }

    async moveRegistrations(members: PlatformMember[], group: Group) {
        return this.getRegistrationActionBuilder(members)?.moveRegistrations(group)
    }

    async editRegistrations(members: PlatformMember[]) {
        return this.getRegistrationActionBuilder(members)?.editRegistrations()
    }

    async register(members: PlatformMember[], group: Group) {
        if (members.length === 1) {
            return await checkoutDefaultItem({
                member: members[0], 
                group,
                admin: true,
                groupOrganization: this.organizations.find(o => o.id === group.organizationId)!,
                context: this.context,
                navigate: {
                    present: this.present,
                    show: this.present,
                    pop: () => Promise.resolve(),
                    dismiss: () => Promise.resolve()
                },
                displayOptions: {
                    action: 'present',
                    modalDisplayStyle: 'popup'
                },

                // Immediately checkout instead of only adding it to the cart
                startCheckoutFlow: true
            })
        }

        return await chooseOrganizationMembersForGroup({
            members, 
            group,
            context: this.context,
            owner: this.owner,
            navigate: {
                present: this.present,
                show: this.present,
                pop: () => Promise.resolve(),
                dismiss: () => Promise.resolve()
            }
        })
    }
}
