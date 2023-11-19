import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group, Token } from '@stamhoofd/models';
import { Group as GroupStruct } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = GroupStruct[]

export class GetOrganizationAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/deleted-groups", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot dit onderdeel"
            })
        }

        // Get all admins
        const groups = await Group.where({ organizationId: user.organization.id, deletedAt: { sign: '!=', value: null } })
        return new Response(groups.map(g => g.getPrivateStructure(user.permissions ?? undefined)));
    }
}
