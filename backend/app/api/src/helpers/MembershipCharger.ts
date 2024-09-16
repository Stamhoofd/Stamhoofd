import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, Member, MemberPlatformMembership, Platform } from "@stamhoofd/models";
import { SQL, SQLOrderBy, SQLWhereSign } from "@stamhoofd/sql";
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

export const MembershipCharger = {
    async charge() {
        console.log('Charging memberships...')
        
        // Loop all
        let lastId = "";
        const platform = await Platform.getShared()
        const chargeVia = platform.membershipOrganizationId

        if (!chargeVia) {
            throw new SimpleError({
                code: 'missing_membership_organization',
                message: 'Missing membershipOrganizationId',
                human: 'Er is geen lokale groep verantwoordelijk voor de aanrekening van aansluitingen geconfigureerd'
            })
        }

        function getType(id: string) {
            return platform.config.membershipTypes.find(t => t.id === id)
        }

        let createdCount = 0;
        let createdPrice = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const memberships = await MemberPlatformMembership.select()
                .where('id', SQLWhereSign.Greater, lastId)
                .where('balanceItemId', null)
                .where('deletedAt', null)
                .whereNot('organizationId', chargeVia)
                .limit(100)
                .orderBy(
                    new SQLOrderBy({
                        column: SQL.column('id'),
                        direction: 'ASC'
                    })
                )
                .fetch();
        
            if (memberships.length === 0) {
                break;
            }

            const memberIds = Formatter.uniqueArray(memberships.map(m => m.memberId))
            const members = await Member.getByIDs(...memberIds)
            const createdBalanceItems: BalanceItem[] = []

            for (const membership of memberships) {
                // charge
                if (membership.balanceItemId) {
                    continue;
                }
                const type = getType(membership.membershipTypeId);
                if (!type) {
                    console.error('Unknown membership type id ', membership.membershipTypeId)
                    continue;
                }

                if (membership.organizationId === chargeVia) {
                    continue;
                }

                const member = members.find(m => m.id === membership.memberId)

                if (!member) {
                    console.error('Unexpected missing member id ', membership.memberId, 'for membership', membership.id)
                    continue;
                }

                const balanceItem = new BalanceItem();
                balanceItem.unitPrice = membership.price
                balanceItem.amount = 1
                balanceItem.description = Formatter.dateNumber(membership.startDate, true) + " tot " + Formatter.dateNumber(membership.expireDate ?? membership.endDate, true)
                balanceItem.relations = new Map([
                    [
                        BalanceItemRelationType.Member, 
                        BalanceItemRelation.create({
                            id: member.id,
                            name: member.details.name
                        })
                    ],
                    [
                        BalanceItemRelationType.MembershipType, 
                        BalanceItemRelation.create({
                            id: type.id,
                            name: type.name
                        })
                    ]
                ])

                balanceItem.type = BalanceItemType.PlatformMembership
                balanceItem.organizationId = chargeVia
                balanceItem.payingOrganizationId = membership.organizationId

                await balanceItem.save();
                membership.balanceItemId = balanceItem.id;
                await membership.save()

                createdBalanceItems.push(balanceItem)

                createdCount += 1;
                createdPrice += membership.price
            }

            await BalanceItem.updateOutstanding(createdBalanceItems)

            if (memberships.length < 100) {
                break;
            }
            
            const z = lastId;
            lastId = memberships[memberships.length - 1].id;

            if (lastId === z) {
                throw new Error('Unexpected infinite loop found in MembershipCharger')
            }
        }

        console.log('Charged ' + Formatter.integer(createdCount) +'  memberships, for a total value of ' + Formatter.price(createdPrice))
    }
};