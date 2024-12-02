import { Member, MemberPlatformMembership, Organization } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, uuidToName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.MemberPlatformMembershipAdded,
    updated: AuditLogType.MemberPlatformMembershipEdited,
    deleted: AuditLogType.MemberPlatformMembershipDeleted,
});

export const MemberPlatformMembershipLogger = new ModelLogger(MemberPlatformMembership, {
    skipKeys: ['balanceItemId'],
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        const member = await Member.getByID(event.model.memberId);
        const organization = event.model.organizationId ? (await Organization.getByID(event.model.organizationId)) : null;

        if (!member) {
            console.log('No member found for MemberPlatformMembership', event.model.id);
            return;
        }

        return {
            ...result,
            data: {
                member,
                organization,
            },
            objectId: event.model.memberId,
        };
    },

    generateDescription(event, options) {
        return Formatter.capitalizeFirstLetter(Formatter.dateRange(event.model.startDate, event.model.endDate));
    },

    createReplacements(model, options) {
        const map = new Map([
            ['pm', AuditLogReplacement.create({
                id: model.membershipTypeId,
                value: uuidToName(model.membershipTypeId) || undefined,
                type: AuditLogReplacementType.PlatformMembershipType,
            })],
            ['m', AuditLogReplacement.create({
                id: options.data.member.id,
                value: options.data.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        if (options.data.organization) {
            map.set('o', AuditLogReplacement.create({
                id: options.data.organization.id,
                value: options.data.organization.name,
                type: AuditLogReplacementType.Organization,
            }));
        }

        return map;
    },

    postProcess(event, options, log) {
        log.organizationId = options.data.organization?.id ?? null;
    },
});
