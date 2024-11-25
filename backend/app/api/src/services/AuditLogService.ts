import { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { AuditLog, Group, Member, Organization, Registration, Event } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, GroupType, MemberDetails, OrganizationMetaData, OrganizationPrivateMetaData, PlatformConfig, PlatformPrivateConfig } from '@stamhoofd/structures';
import { Context } from '../helpers/Context';
import { explainPatch } from './explainPatch';

export type MemberAddedAuditOptions = {
    type: AuditLogType.MemberAdded;
    member: Member;
};

export type MemberEditedAuditOptions = {
    type: AuditLogType.MemberEdited;
    member: Member;
    oldMemberDetails: MemberDetails;
    memberDetailsPatch: AutoEncoderPatchType<MemberDetails>;
};

export type MemberRegisteredAuditOptions = {
    type: AuditLogType.MemberRegistered | AuditLogType.MemberUnregistered;
    member: Member;
    group: Group;
    registration: Registration;
};

export type PlatformConfigChangeAuditOptions = {
    type: AuditLogType.PlatformSettingsChanged;
} & ({
    oldConfig: PlatformPrivateConfig;
    patch: PlatformPrivateConfig | AutoEncoderPatchType<PlatformPrivateConfig>;
} | {
    oldConfig: PlatformConfig;
    patch: PlatformConfig | AutoEncoderPatchType<PlatformConfig>;
});

export type OrganizationConfigChangeAuditOptions = {
    type: AuditLogType.OrganizationSettingsChanged;
    organization: Organization;
} & ({
    oldMeta: OrganizationMetaData;
    patch: OrganizationMetaData | AutoEncoderPatchType<OrganizationMetaData>;
} | {
    oldMeta: OrganizationPrivateMetaData;
    patch: OrganizationPrivateMetaData | AutoEncoderPatchType<OrganizationPrivateMetaData>;
});

export type EventAuditOptions = {
    type: AuditLogType.EventAdded | AuditLogType.EventEdited | AuditLogType.EventDeleted;
    event: Event;
    oldData?: AutoEncoder;
    patch?: AutoEncoder | AutoEncoderPatchType<AutoEncoder>;
};

export type GroupAuditOptions = {
    type: AuditLogType.GroupAdded | AuditLogType.GroupEdited | AuditLogType.GroupDeleted;
    group: Group;
    oldData?: AutoEncoder;
    patch?: AutoEncoder | AutoEncoderPatchType<AutoEncoder>;
};

export type AuditLogOptions = GroupAuditOptions | EventAuditOptions | MemberAddedAuditOptions | MemberEditedAuditOptions | MemberRegisteredAuditOptions | PlatformConfigChangeAuditOptions | OrganizationConfigChangeAuditOptions;

export const AuditLogService = {
    async log(options: AuditLogOptions) {
        try {
            const userId = Context.optionalAuth?.user?.id ?? null;
            const organizationId = Context.organization?.id ?? null;

            const model = new AuditLog();

            model.type = options.type;
            model.userId = userId;
            model.organizationId = organizationId;

            if (options.type === AuditLogType.MemberRegistered) {
                this.fillForMemberRegistered(model, options);
            }
            else if (options.type === AuditLogType.MemberUnregistered) {
                this.fillForMemberRegistered(model, options);
            }
            else if (options.type === AuditLogType.MemberEdited) {
                this.fillForMemberEdited(model, options);
            }
            else if (options.type === AuditLogType.MemberAdded) {
                this.fillForMemberAdded(model, options);
            }
            else if (options.type === AuditLogType.PlatformSettingsChanged) {
                this.fillForPlatformConfig(model, options);
            }
            else if (options.type === AuditLogType.OrganizationSettingsChanged) {
                this.fillForOrganizationConfig(model, options);
            }
            else if (options.type === AuditLogType.EventAdded || options.type === AuditLogType.EventEdited || options.type === AuditLogType.EventDeleted) {
                this.fillForEvent(model, options);
            }
            else if (options.type === AuditLogType.GroupAdded || options.type === AuditLogType.GroupEdited || options.type === AuditLogType.GroupDeleted) {
                this.fillForGroup(model, options);
            }

            // In the future we might group these saves together in one query to improve performance
            await model.save();

            console.log('Audit log', model.id, options);
        }
        catch (e) {
            console.error('Failed to save log', options, e);
        }
    },

    fillForMemberRegistered(model: AuditLog, options: MemberRegisteredAuditOptions) {
        model.objectId = options.member.id;
        model.replacements = new Map([
            ['m', AuditLogReplacement.create({
                id: options.member.id,
                value: options.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
            ['g', AuditLogReplacement.create({
                id: options.group.id,
                value: options.group.settings.name,
                type: AuditLogReplacementType.Group,
            })],
        ]);

        const registrationStructure = options.registration.setRelation(Registration.group, options.group).getStructure();
        if (registrationStructure.description) {
            model.description = registrationStructure.description;
        }
    },

    fillForMemberEdited(model: AuditLog, options: MemberEditedAuditOptions) {
        model.objectId = options.member.id;

        model.replacements = new Map([
            ['m', AuditLogReplacement.create({
                id: options.member.id,
                value: options.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        // Generate changes list
        model.patchList = explainPatch(options.oldMemberDetails, options.memberDetailsPatch);
    },

    fillForMemberAdded(model: AuditLog, options: MemberAddedAuditOptions) {
        model.objectId = options.member.id;

        model.replacements = new Map([
            ['m', AuditLogReplacement.create({
                id: options.member.id,
                value: options.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        // Generate changes list
        model.patchList = explainPatch(null, options.member.details);
    },

    fillForPlatformConfig(model: AuditLog, options: PlatformConfigChangeAuditOptions) {
        model.objectId = null;

        // Generate changes list
        model.patchList = explainPatch(options.oldConfig, options.patch);
    },

    fillForOrganizationConfig(model: AuditLog, options: OrganizationConfigChangeAuditOptions) {
        model.objectId = options.organization.id;
        model.organizationId = options.organization.id;

        model.replacements = new Map([
            ['o', AuditLogReplacement.create({
                id: options.organization.id,
                value: options.organization.name,
                type: AuditLogReplacementType.Organization,
            })],
        ]);

        // Generate changes list
        model.patchList = explainPatch(options.oldMeta, options.patch);
    },

    fillForEvent(model: AuditLog, options: EventAuditOptions) {
        model.objectId = options.event.id;

        if (options.patch) {
            // Generate changes list
            model.patchList = explainPatch(options.oldData ?? null, options.patch);
        }

        model.replacements = new Map([
            ['e', AuditLogReplacement.create({
                id: options.event.id,
                value: options.event.name,
                type: AuditLogReplacementType.Event,
            })],
        ]);
    },

    fillForGroup(model: AuditLog, options: GroupAuditOptions) {
        model.objectId = options.group.id;

        if (options.patch) {
            // Generate changes list
            model.patchList = explainPatch(options.oldData ?? null, options.patch);
        }

        if (options.group.type === GroupType.WaitingList) {
            // Change event type
            switch (options.type) {
                case AuditLogType.GroupAdded:
                    model.type = AuditLogType.WaitingListAdded;
                    break;
                case AuditLogType.GroupEdited:
                    model.type = AuditLogType.WaitingListEdited;
                    break;
                case AuditLogType.GroupDeleted:
                    model.type = AuditLogType.WaitingListDeleted;
                    break;
            }
        }

        model.replacements = new Map([
            ['g', AuditLogReplacement.create({
                id: options.group.id,
                value: options.group.settings.name,
                type: AuditLogReplacementType.Group,
            })],
        ]);
    },
};
