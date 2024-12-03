import { Organization } from '@stamhoofd/models';
import { AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';

export const OrganizationLogger = new ModelLogger(Organization, {
    skipKeys: ['searchIndex'],
    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.OrganizationAdded,
        updated: AuditLogType.OrganizationEdited,
        deleted: AuditLogType.OrganizationDeleted,
    }),

    postProcess(event, options, log) {
        log.organizationId = event.model.id;
    },
});
