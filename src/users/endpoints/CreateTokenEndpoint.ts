import { Request } from "@/routing/classes/Request";
import { DecodedRequest } from "@/routing/classes/DecodedRequest";
import { Response } from "@/routing/classes/Response";
import { Endpoint } from "@/routing/classes/Endpoint";
import { TokenStruct } from "../structs/TokenStruct";
import { PasswordGrantStruct } from "../structs/PasswordGrantStruct";
import { User } from "../models/User";
import { ClientError } from "@/routing/classes/ClientError";
import { Token } from "../models/Token";
import { ServerError } from "@/routing/classes/ServerError";
import { Organization } from "@/organizations/models/Organization";

type Params = {};
type Query = undefined;
type Body = PasswordGrantStruct;
type ResponseBody = TokenStruct;

export class CreateTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = PasswordGrantStruct;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/oauth/token", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Todo: add some extra brute force measurements here
        // - add random delay here, increased by the amount of failed attempts (used to slow down). Also on a successfull comparison!
        // - add required CAPTCHA after x failed attempts for a given username (no matter if the username exists or not)
        // - if, even after the CAPTCHAs, the account reaches a given count of failed attempts, the account should be locked out for an hour or even a day (only login endpoint)

        const organization = await Organization.fromHost(request.host);
        const user = await User.login(organization, request.body.username, request.body.password);
        if (!user) {
            // Todo: send security email containing the IP and device name

            throw new ClientError({
                code: "invalid_data",
                message: "Invalid username or password",
                human: "Het ingevoerde e-mailadres of wachtwoord is onjuist.",
            });
        }

        const token = await Token.createToken(user);
        if (!token) {
            throw new ServerError({
                code: "error",
                message: "Could not generate token",
                human: "Er ging iets mis tijdens het inloggen.",
            });
        }

        const st = new TokenStruct(token);
        return new Response(st);
    }
}
