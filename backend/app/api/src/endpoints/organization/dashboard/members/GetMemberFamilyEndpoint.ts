import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group } from "@stamhoofd/models";
import { Member } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { EncryptedMemberWithRegistrations } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";
type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = EncryptedMemberWithRegistrations[];

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetMemberFamilyEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/members/@id/family", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasSomeAccess()) {
            throw Context.auth.error()
        }  

        const groups = await Group.getAll(organization.id)
        const members = (await Member.getFamilyWithRegistrations(request.params.id))

        let foundMember = false

        for (const member of members) {
            if (member.id === request.params.id) {
                foundMember = true;

                // Check access to this member (this will automatically give access to the family)
                if (!Context.auth.canAccessMember(member, groups)) {
                    throw Context.auth.error("Je hebt geen toegang tot dit lid")
                }
                break;
            }
        }

        if (!foundMember) {
            throw Context.auth.error("Je hebt geen toegang tot dit lid")
        }

        return new Response(members.filter(member => Context.auth.canAccessMember(member, groups)).map(m => m.getStructureWithRegistrations(true)));
    }
}