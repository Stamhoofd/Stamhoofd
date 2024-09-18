import { column, Database, ManyToManyRelation, ManyToOneRelation, Model, OneToManyRelation } from '@simonbackx/simple-database';
import { scalarToSQLExpression, SQL, SQLWhereLike } from "@stamhoofd/sql";
import { MemberDetails, MemberWithRegistrationsBlob, RegistrationWithMember as RegistrationWithMemberStruct, TinyMember } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { Group, MemberPlatformMembership, MemberResponsibilityRecord, Organization, Payment, Platform, Registration, User } from './';
export type MemberWithRegistrations = Member & { 
    users: User[], 
    registrations: (Registration & {group: Group})[] 
}

// Defined here to prevent cycles
export type RegistrationWithMember = Registration & { member: Member }

export class Member extends Model {
    static table = "members"

    //#region Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    organizationId: string|null = null;

    @column({
        type: "string", 
        beforeSave: function() {
            return this.details?.firstName ?? ''
        }
    })
    firstName: string

    @column({ type: "string", 
        beforeSave: function() {
            return this.details?.lastName ?? ''
        } })
    lastName: string

    @column({ 
        type: "string", 
        nullable: true, 
        beforeSave: function(this: Member) {
            return this.details?.birthDay ? Formatter.dateIso(this.details.birthDay) : null
        }
    })
    birthDay: string | null

    @column({
        type: "string", 
        nullable: true,
        beforeSave: function() {
            return this.details?.memberNumber ?? null
        }
    })
    memberNumber: string | null

    @column({ type: "json", decoder: MemberDetails })
    details: MemberDetails

    /**
     * Not yet paid balance
     */
    @column({ type: "integer" })
    outstandingBalance = 0

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
    //#endregion

    static registrations = new OneToManyRelation(Member, Registration, "registrations", "memberId")

    // Note: all relations should point to their parents, not the other way around to avoid reference cycles
    static users = new ManyToManyRelation(Member, User, "users");

    /**
     * Fetch all members with their corresponding (valid) registration
     */
    static async getWithRegistrations(id: string): Promise<MemberWithRegistrations | null> {
        return (await this.getBlobByIds(id))[0] ?? null
    }

    /**
     * Update the outstanding balance of multiple members in one go (or all members)
     */
    static async updateOutstandingBalance(memberIds: string[] | 'all') {
        if (memberIds !== 'all' && memberIds.length == 0) {
            return
        }

        const params: any[] = []
        let firstWhere = ''
        let secondWhere = ''

        if (memberIds !== 'all') {
            firstWhere = ` AND memberId IN (?)`
            params.push(memberIds)

            secondWhere = `WHERE members.id IN (?)`
            params.push(memberIds)
        }
        
        const query = `UPDATE
            members
            LEFT JOIN (
                SELECT
                    memberId,
                    sum(unitPrice * amount) - sum(pricePaid) AS outstandingBalance
                FROM
                    balance_items
                WHERE status != 'Hidden'${firstWhere}
                GROUP BY
                    memberId
            ) i ON i.memberId = members.id 
        SET members.outstandingBalance = COALESCE(i.outstandingBalance, 0)
        ${secondWhere}`
        
        await Database.update(query, params)
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersByIDs(ids: string[]): Promise<RegistrationWithMember[]> {
        if (ids.length === 0) {
            return []
        }
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;
        
        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`canRegister\` = 1)\n`

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Registration.table}\`.\`${Registration.primary.name}\` IN (?)`

        const [results] = await Database.select(query, [ids])
        const registrations: RegistrationWithMember[] = []

         // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table])
            if (!registration) {
                throw new Error("Expected registration in every row")
            }

            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            
            const _f = registration.setRelation(registrationMemberRelation, foundMember)           
            registrations.push(_f)
        }

        return registrations
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersForGroup(groupId: string): Promise<RegistrationWithMember[]> {
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;
        
        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`canRegister\` = 1)\n`

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Registration.table}\`.\`groupId\` = ?`

        const [results] = await Database.select(query, [groupId])
        const registrations: RegistrationWithMember[] = []

         // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table])
            if (!registration) {
                throw new Error("Expected registration in every row")
            }

            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            
            const _f = registration.setRelation(registrationMemberRelation, foundMember)           
            registrations.push(_f)
        }

        return registrations
    }

     /**
     * Fetch all registrations with members with their corresponding (valid) registrations and payment
     */
    static async getRegistrationWithMembersForPayment(paymentId: string): Promise<RegistrationWithMember[]> {
        const { BalanceItem, BalanceItemPayment} = await import('./');

        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;
        
        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`
        
        query += `LEFT JOIN \`${BalanceItem.table}\` ON \`${BalanceItem.table}\`.\`registrationId\` = \`${Registration.table}\`.\`${Registration.primary.name}\`\n`
        query += `LEFT JOIN \`${BalanceItemPayment.table}\` ON \`${BalanceItemPayment.table}\`.\`${BalanceItemPayment.balanceItem.foreignKey}\` = \`${BalanceItem.table}\`.\`${BalanceItem.primary.name}\`\n`
        query += `JOIN \`${Payment.table}\` ON \`${Payment.table}\`.\`${Payment.primary.name}\` = \`${BalanceItemPayment.table}\`.\`${BalanceItemPayment.payment.foreignKey}\`\n`

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `WHERE \`${Payment.table}\`.\`${Payment.primary.name}\` = ?\n`
        query += `GROUP BY \`${Registration.table}\`.\`${Registration.primary.name}\`, \`${Member.table}\`.\`${Member.primary.name}\``

        const [results] = await Database.select(query, [paymentId])
        const registrations: RegistrationWithMember[] = []

         // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table])
            if (!registration) {
                throw new Error("Expected registration in every row")
            }

            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            
            const _f = registration.setRelation(registrationMemberRelation, foundMember)           
            registrations.push(_f)
        }

        return registrations
    }

     /**
     * Fetch all members with their corresponding (valid) registrations, users
     */
    static async getBlobByIds(...ids: string[]): Promise<MemberWithRegistrations[]> {
        if (ids.length == 0) {
            return []
        }
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${User.getDefaultSelect()}  from \`${Member.table}\`\n`;
        query += `LEFT JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`canRegister\` = 1)\n`
        query += Member.users.joinQuery(Member.table, User.table)+"\n"

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Member.table}\`.\`${Member.primary.name}\` IN (?)`

        const [results] = await Database.select(query, [ids])
        const members: MemberWithRegistrations[] = []

        // Load groups
        const groupIds = results.map(r => r[Registration.table]?.groupId).filter(id => id) as string[]
        const groups = await Group.getByIDs(...Formatter.uniqueArray(groupIds))

        for (const row of results) {
            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            const _f = foundMember
                .setManyRelation(Member.registrations as unknown as OneToManyRelation<"registrations", Member, Registration & {group: Group}>, [])
                .setManyRelation(Member.users, [])
            
                // Seach if we already got this member?
            const existingMember = members.find(m => m.id == _f.id)

            const member: MemberWithRegistrations = (existingMember ?? _f)
            if (!existingMember) {
                members.push(member)
            }

             // Check if we have a registration with a payment
            const registration = Registration.fromRow(row[Registration.table])
            if (registration) {
                // Check if we already have this registration
                if (!member.registrations.find(r => r.id == registration.id)) {
                    const g = groups.find(g => g.id == registration.groupId)
                    if (!g) {
                        throw new Error("Group not found")
                    }
                    if (g.deletedAt === null) {
                        member.registrations.push(registration.setRelation(Registration.group, g))
                    }
                }
            }

            // Check if we have a user
            const user = User.fromRow(row[User.table])
            if (user) {
                // Check if we already have this registration
                if (!member.users.find(r => r.id == user.id)) {
                    member.users.push(user)
                }
            }
        }

        return members

    }

    /**
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    static async getFamilyWithRegistrations(id: string): Promise<MemberWithRegistrations[]> {
        let query = `SELECT l2.membersId as id from _members_users l1\n`;
        query += `JOIN _members_users l2 on l2.usersId = l1.usersId \n`
        query += `where l1.membersId = ? group by l2.membersId`

        const [results] = await Database.select(query, [id])
        const ids: string[] = []
        for (const row of results) {
            ids.push(row["l2"]["id"] as string)
        }

        if (!ids.includes(id)) {
            // Member has no users
            ids.push(id)
        }
        
        return await this.getBlobByIds(...ids)
    }

     /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
     static async getMemberIdsWithRegistrationForUser(user: User): Promise<string[]> {
        const query = SQL
            .select('id')
            .from(Member.table)
            .join(
                SQL
                    .leftJoin('_members_users')
                    .where(
                        SQL.column('_members_users', 'membersId'),
                        SQL.column(Member.table, 'id'),
                    )
            ).where(
                SQL.column('_members_users', 'usersId'),
                user.id,
            )

        const data = await query.fetch()
        return data.map((r) => r.members.id as string)
    }

     /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMembersWithRegistrationForUser(user: User): Promise<MemberWithRegistrations[]> {
        return this.getBlobByIds(...(await this.getMemberIdsWithRegistrationForUser(user)));
    }

    getStructureWithRegistrations(this: MemberWithRegistrations, forOrganization: null | boolean = null) {
        return MemberWithRegistrationsBlob.create({
            ...this,
            registrations: this.registrations.map(r => r.getStructure()),
            details: this.details,
            users: this.users.map(u => u.getStructure()),
        })
    }

    static getRegistrationWithMemberStructure(registration: RegistrationWithMember & {group: import('./Group').Group}): RegistrationWithMemberStruct {
        return RegistrationWithMemberStruct.create({
            ...registration.getStructure(),
            cycle: registration.cycle,
            member: TinyMember.create({
                id: registration.member.id,
                firstName: registration.member.firstName,
                lastName: registration.member.lastName,
            }),
        })
    }

    static updateMembershipsForGroupId(id: string) {
        QueueHandler.schedule('bulk-update-memberships', async () => {
            console.log('Bulk updating memberships for group id ', id)

            // Get all members that are registered in this group
            const memberIds = (await SQL.select(
                    SQL.column('members', 'id')
                )
                .from(SQL.table(Member.table))
                .join(
                    SQL.leftJoin(
                        SQL.table(Registration.table)
                    ).where(
                        SQL.column(Registration.table, 'memberId'),
                        SQL.column(Member.table, 'id')
                    )
                ).where(
                    SQL.column(Registration.table, 'groupId'),
                    id
                ).fetch()).flatMap(r => (r.members && (typeof r.members.id) === 'string') ? [r.members.id as string] : [])
            
            for (const id of memberIds) {
                await Member.updateMembershipsForId(id)
            }
        }).catch((e) => {
            console.error('Failed to update memberships for group id ', id), e
        });
    }

    static async updateMembershipsForId(id: string, silent = false) {
        return await QueueHandler.schedule('updateMemberships-' + id, async function (this: undefined) {
            if (!silent) {
                console.log('update memberships for id ', id);
            }
            
            const me = await Member.getWithRegistrations(id)
            if (!me) {
                if (!silent) {
                    console.log('Skipping automatic membership for: ' + id, ' - member not found')
                }
                return
            }
            const platform = await Platform.getShared()
            const registrations = me.registrations.filter(r => r.group.periodId == platform.periodId && r.registeredAt && !r.deactivatedAt)

            const defaultMemberships = registrations.flatMap(r => {
                if (!r.group.defaultAgeGroupId) {
                    return []
                }
                const defaultAgeGroup = platform.config.defaultAgeGroups.find(g => g.id == r.group.defaultAgeGroupId)
                if (!defaultAgeGroup || !defaultAgeGroup.defaultMembershipTypeId) {
                    return []
                }

                const defaultMembership  = platform.config.membershipTypes.find(m => m.id == defaultAgeGroup.defaultMembershipTypeId)
                if (!defaultMembership) {
                    return []
                }

                if (defaultMembership.periods.get(platform.periodId) === undefined) {
                    console.warn('Found default membership without period configuration', defaultMembership.id, platform.periodId)
                    return []
                }

                return [{
                    registration: r,
                    membership: defaultMembership,
                }]
            });

            // Get active memberships for this member that
            const memberships = await MemberPlatformMembership.where({memberId: me.id, periodId: platform.periodId })
            const now = new Date()
            const activeMemberships = memberships.filter(m => m.startDate <= now && m.endDate >= now && m.deletedAt === null)
            const activeMembershipsUndeletable = activeMemberships.filter(m => !m.canDelete() || !m.generated)

            if (defaultMemberships.length == 0) {
                // Stop all active memberships that were added automatically
                for (const membership of activeMemberships) {
                    if (membership.canDelete() && membership.generated) {
                        if (!silent) {
                            console.log('Removing membership because no longer registered member and not yet invoiced for: ' + me.id + ' - membership ' + membership.id)
                        }
                        membership.deletedAt = new Date()
                        await membership.save()
                    }
                }

                if (!silent) {
                    console.log('Skipping automatic membership for: ' + me.id, ' - no default memberships found')
                }
                return
            }


            if (activeMembershipsUndeletable.length) {
                // Skip automatic additions
                for (const m of activeMembershipsUndeletable) {                
                    await m.calculatePrice(me)
                    await m.save()
                }
                return
            }

            // Add the cheapest available membership
            const organizations = await Organization.getByIDs(...Formatter.uniqueArray(defaultMemberships.map(m => m.registration.organizationId)));

            const defaultMembershipsWithOrganization = defaultMemberships.map(({membership, registration}) => {
                const organizationId = registration.organizationId;
                const organization = organizations.find(o => o.id === organizationId);
                return {membership, registration, organization}
            });

            const shouldApplyReducedPrice = me.details.shouldApplyReducedPrice;

            const cheapestMembership = defaultMembershipsWithOrganization.sort(({membership: a, registration: ar, organization: ao}, {membership: b, registration: br, organization: bo}) => {
                const tagIdsA = ao?.meta.tags ?? [];
                const tagIdsB = bo?.meta.tags ?? [];
                const diff = a.getPrice(platform.periodId, now, tagIdsA, shouldApplyReducedPrice)! - b.getPrice(platform.periodId, now, tagIdsB, shouldApplyReducedPrice)!
                if (diff == 0) {
                    return Sorter.byDateValue(br.createdAt, ar.createdAt)
                }
                return diff
            })[0]
            if (!cheapestMembership) {
                throw new Error("No membership found")
            }

            // Check if already have the same membership
            for (const m of activeMemberships) {
                if (m.membershipTypeId === cheapestMembership.membership.id) {
                    // Update the price of this active membership (could have changed)            
                    await m.calculatePrice(me)
                    await m.save()
                    return
                }
            }

            const periodConfig = cheapestMembership.membership.periods.get(platform.periodId)
            if (!periodConfig) {
                console.error("Missing membership prices for membership type "+cheapestMembership.membership.id+" and period " + platform.periodId)
                return;
            }

            // Can we revive an earlier deleted membership?
            if (!silent) {
                console.log('Creating automatic membership for: ' + me.id + ' - membership type ' + cheapestMembership.membership.id)
            }
            const membership = new MemberPlatformMembership();
            membership.memberId = me.id
            membership.membershipTypeId = cheapestMembership.membership.id
            membership.organizationId = cheapestMembership.registration.organizationId
            membership.periodId = platform.periodId

            membership.startDate = periodConfig.startDate
            membership.endDate = periodConfig.endDate
            membership.expireDate = periodConfig.expireDate
            membership.generated = true;

            if(me.details.memberNumber === null) {
                try {
                    await me.assignMemberNumber(membership);
                } catch(error) {
                    console.error(`Failed to assign member number for id ${me.id}: ${error.message}`);
                    // If the assignment of the member number fails the membership is not created but the member is registered
                    return;
                }
            }

            await membership.calculatePrice(me)
            await membership.save()

            // This reasoning allows us to replace an existing membership with a cheaper one (not date based ones, but type based ones)
            for (const toDelete of activeMemberships) {
                if (toDelete.canDelete() && toDelete.generated) {
                    if (!silent) {
                        console.log('Removing membership because cheaper membership found for: ' + me.id + ' - membership ' + toDelete.id)
                    }
                    toDelete.deletedAt = new Date()
                    await toDelete.save()
                }
            }
        });
    }

    private async assignMemberNumber(membership: MemberPlatformMembership) {
        const member: Member = this;

        if (member.details?.memberNumber) {
            console.log('Member already has member number, should not happen');
            return
        }
        
        return await QueueHandler.schedule('assignMemberNumber', async function (this: undefined) {
            try {
                const memberNumber = await member.createMemberNumber(membership);
                member.details.memberNumber = memberNumber;
                await member.save();
            } catch(error) {
                if(isSimpleError(error) || isSimpleErrors(error)) {
                    throw error;
                } else {
                    console.error(error);
                    throw new SimpleError({
                        code: 'assign_member_number',
                        message: error.message,
                        human: "Er is iets misgegaan bij het aanmaken van het lidnummer.",
                    })
                }
            }
        });
    }

    async createMemberNumber(membership: MemberPlatformMembership): Promise<string> {
        // example: 5301-101012-1

        //#region get birth date part (ddmmjj)
        const birthDay = this.details?.birthDay;
        if(!birthDay) {
            throw new SimpleError({
                code: 'assign_member_number',
                message: "Missing birthDay",
                human: "Er kon geen lidnummer aangemaakt worden omdat er geen geboortedatum is ingesteld.",
            });
        }

        const dayPart = birthDay.getDate().toString().padStart(2, '0');
        const monthPart = (birthDay.getMonth() + 1).toString().padStart(2, '0');
        const yearPart = birthDay.getFullYear().toString().slice(2, 4);
        const birthDatePart = `${dayPart}${monthPart}${yearPart}`;
        //#endregion

        //#region get group number
        const organizationId = membership.organizationId;
        const organization = await Organization.getByID(organizationId);
        if(!organization) {
            throw new Error(`Organization with id ${organizationId} not found`);
        }
        const groupNumber = organization.uri;
        //#endregion

        //#region get follow up number
        const firstPart = `${groupNumber}-${birthDatePart}-`;

        const query = SQL.select()
        .from(SQL.table('members'))
        .where(
            new SQLWhereLike(
                SQL.column('members', 'memberNumber'),
                scalarToSQLExpression(`${SQLWhereLike.escape(firstPart)}%`)
            )
        );

        const count = await query.count();
        console.log(`Found ${count} members with a memberNumber starting with ${firstPart}`);

        let followUpNumber = count;
        //#endregion

        //#region check if memberNumber is unique
        let doesExist = true;
        let memberNumber: string = '';
        let tries = 0;

        while(doesExist) {
            followUpNumber++;
            memberNumber = firstPart + followUpNumber;

            const result = await SQL.select()
            .from(SQL.table('members'))
            .where(
                    SQL.column('members', 'memberNumber'),
                    scalarToSQLExpression(memberNumber)
            )
            .first(false);

            console.log(`Is ${memberNumber} unique? ${result === null}`);

            if(result !== null) {
                tries++;
                if(tries > 9) {
                    throw new SimpleError({
                        code: 'assign_member_number',
                        message: `Duplicate member numbers (last try: ${memberNumber}, tries: ${tries})`,
                        human: "Er kon geen uniek lidnummer aangemaakt worden. Mogelijks zijn er teveel leden met dezelfde geboortedatum. Neem contact op met de vereniging.",
                    });
                }
            } else {
                doesExist = false;
            }
        }
        //#endregion

        console.log(`Created member number: ${memberNumber}`);

        return memberNumber;
    }

    async updateMemberships() {
        return await Member.updateMembershipsForId(this.id)
    }

    async isSafeToMergeDuplicateWithoutSecurityCode() {
        // If responsibilities: not safe
        const responsibilities = await MemberResponsibilityRecord.where({ memberId: this.id }, {limit: 1});
        if (responsibilities.length > 0) {
            return false;
        }

        if (this.details.recordAnswers.size > 0) {
            return false;
        }

        if (this.details.reviewTimes.isReviewed('details')) {
            return false;
        }

        if (this.details.parents.length > 0) {
            return false;
        }

        if (this.details.emergencyContacts.length > 0) {
            return false;
        }

        if (this.details.uitpasNumber) {
            return false;
        }

        return true;
    }
}
