import { StripeAccount } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.StripeAccountAdded,
    updated: AuditLogType.StripeAccountEdited,
    deleted: AuditLogType.StripeAccountDeleted,
});

export const StripeAccountLogger = new ModelLogger(StripeAccount, {
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        if (event.type === 'updated' && 'status' in event.changedFields && event.changedFields.status === 'deleted') {
            result.type = AuditLogType.StripeAccountDeleted;
            result.generatePatchList = false;
        }

        return result;
    },

    createReplacements(model) {
        return new Map([
            ['a', AuditLogReplacement.create({
                id: model.id,
                value: model.accountId,
                type: AuditLogReplacementType.StripeAccount,
            })],
        ]);
    },

    postProcess: (event, _options, log) => {
        if (log.type === AuditLogType.StripeAccountEdited) {
            // Never caused by a user
            log.userId = null;
        }
    },
});
