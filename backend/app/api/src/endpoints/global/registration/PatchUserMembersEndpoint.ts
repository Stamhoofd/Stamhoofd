import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, Member } from '@stamhoofd/models';
import { MemberWithRegistrationsBlob, MembersBlob } from "@stamhoofd/structures";

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer';
import { PatchOrganizationMembersEndpoint } from '../../global/members/PatchOrganizationMembersEndpoint';
type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>
type ResponseBody = MembersBlob

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PatchUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(MemberWithRegistrationsBlob as Decoder<MemberWithRegistrationsBlob>, MemberWithRegistrationsBlob.patchType() as Decoder<AutoEncoderPatchType<MemberWithRegistrationsBlob>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const {user} = await Context.authenticate()

        // Process changes
        const addedMembers: Member[] = []
        for (const put of request.body.getPuts()) {
            const struct = put.put

            const member = new Member()
            member.id = struct.id
            member.organizationId = organization?.id ?? null

            struct.details.cleanData()
            member.details = struct.details

            // Check for duplicates and prevent creating a duplicate member by a user
            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member);
            if (duplicate) {
                if (await duplicate.isSafeToMergeDuplicateWithoutSecurityCode()) {
                    console.log("Merging duplicate without security code: allowed for " + duplicate.id)
                } else if (struct.details.securityCode) {
                    // Entered the security code, so we can link the user to the member
                    if (!duplicate.details.securityCode || struct.details.securityCode !== duplicate.details.securityCode) {
                        throw new SimpleError({
                            code: "invalid_field",
                            field: 'details.securityCode',
                            message: "Invalid security code",
                            human: Context.i18n.$t(`Deze beveiligingscode is ongeldig. Probeer het opnieuw of neem contact op met jouw vereniging om de juiste code te ontvangen.`),
                            statusCode: 400
                        })
                    }

                    console.log("Merging duplicate: security code is correct - for " + duplicate.id)
                } else {
                    throw new SimpleError({
                        code: "known_member_missing_rights",
                        message: "Creating known member without sufficient access rights",
                        human: `${member.details.firstName} is al gekend in ons systeem, maar jouw e-mailadres niet. Om toegang te krijgen heb je de beveiligingscode nodig.`,
                        statusCode: 400
                    })
                }

                // Allowed!
                struct.details.securityCode = null

                // Merge data
                duplicate.details.merge(member.details)
                await duplicate.save()
                addedMembers.push(duplicate)
                continue;
            }

            await member.save()
            addedMembers.push(member)
        }

        if (addedMembers.length > 0) {
            // Give access to created members
            await Member.users.reverse("members").link(user, addedMembers)

        }

        // Modify members
        const members = await Member.getMembersWithRegistrationForUser(user)

        for (const member of addedMembers) {
            const updatedMember = members.find(m => m.id === member.id);
            if (updatedMember) {
                // Make sure we also give access to other parents
                await MemberUserSyncer.onChangeMember(updatedMember)

                if (!updatedMember.users.find(u => u.id === user.id)) {
                    // Also link the user to the member if the email address is missing in the details
                    await MemberUserSyncer.linkUser(user.email, updatedMember, true)
                }

                await Document.updateForMember(updatedMember.id)
            }
        }

        for (let struct of request.body.getPatches()) {
            const member = members.find((m) => m.id == struct.id)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "This member does not exist or you don't have permissions to modify this member",
                    human: "Je probeert een lid aan te passen die niet (meer) bestaat. Er ging ergens iets mis."
                })
            }
            struct = await Context.auth.filterMemberPatch(member, struct)

            if (struct.details) {
                if (struct.details.isPut()) {
                    throw new SimpleError({
                        code: "not_allowed",
                        message: "Cannot override details",
                        human: "Er ging iets mis bij het aanpassen van de gegevens van dit lid. Probeer het later opnieuw en neem contact op als het probleem zich blijft voordoen.",
                        field: "details"
                    })
                }
                member.details.patchOrPut(struct.details)
                member.details.cleanData()
            }

            if (!member.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No details provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "details"
                })
            }
            await member.save();
            await MemberUserSyncer.onChangeMember(member)

            // Update documents
            await Document.updateForMember(member.id)
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(members)
        );
    }
}
