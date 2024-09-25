import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Member, Order, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemStatus, BalanceItemType, BalanceItemWithPayments, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<BalanceItemWithPayments>;
type ResponseBody = BalanceItemWithPayments[];

export class PatchBalanceItemsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>, BalanceItemWithPayments.patchType() as Decoder<AutoEncoderPatchType<BalanceItemWithPayments>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/balance', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        if (request.body.changes.length == 0) {
            return new Response([]);
        }

        const returnedModels: BalanceItem[] = [];
        const updateOutstandingBalance: BalanceItem[] = [];

        // Keep track of updates
        const memberIds: string[] = [];
        const registrationIds: string[] = [];

        await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
            for (const { put } of request.body.getPuts()) {
                // Create a new balance item
                const model = new BalanceItem();
                model.description = put.description;
                model.amount = put.amount;
                model.type = BalanceItemType.Other;
                model.unitPrice = put.unitPrice;
                model.amount = put.amount;
                model.organizationId = organization.id;
                model.createdAt = put.createdAt;
                model.status = put.status === BalanceItemStatus.Hidden ? BalanceItemStatus.Hidden : BalanceItemStatus.Pending;

                if (put.userId) {
                    model.userId = (await this.validateUserId(model, put.userId)).id;
                }

                if (put.memberId) {
                    model.memberId = (await this.validateMemberId(put.memberId)).id;
                    memberIds.push(model.memberId);
                }

                if (!model.userId && !model.memberId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'No user or member provided',
                        field: 'userId',
                    });
                }

                await model.save();
                returnedModels.push(model);

                updateOutstandingBalance.push(model);
            }

            for (const patch of request.body.getPatches()) {
                // Create a new balance item
                const model = await BalanceItem.getByID(patch.id);
                if (!model || !(await Context.auth.canAccessBalanceItems([model], PermissionLevel.Write))) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'BalanceItem not found',
                    });
                }

                if (patch.unitPrice !== undefined) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'You cannot change the unit price of a balance item',
                        human: 'Het is niet mogelijk om de eenheidsprijs van een openstaande schuld te wijzigen. Je kan de openstaande schuld verwijderen en opnieuw aanmaken indien noodzakelijk.',
                    });
                }

                // Check permissions
                if (model.memberId) {
                    // Update old
                    memberIds.push(model.memberId);
                }

                if (patch.memberId) {
                    model.memberId = (await this.validateMemberId(patch.memberId)).id;

                    // Update new
                    memberIds.push(model.memberId);
                }

                if (model.registrationId) {
                    // Update old
                    registrationIds.push(model.registrationId);
                }

                if (patch.createdAt) {
                    model.createdAt = patch.createdAt;
                }

                model.description = patch.description ?? model.description;
                model.unitPrice = patch.unitPrice ?? model.unitPrice;
                model.amount = patch.amount ?? model.amount;

                if (model.orderId) {
                    // Not allowed to change this
                    const order = await Order.getByID(model.orderId);
                    if (order) {
                        model.unitPrice = order.totalToPay;
                        model.amount = 1;
                    }
                }

                if (patch.status && patch.status === BalanceItemStatus.Hidden) {
                    if (model.pricePaid === 0) {
                        model.status = BalanceItemStatus.Hidden;
                    }
                }
                else if (patch.status) {
                    model.status = model.pricePaid >= model.price ? BalanceItemStatus.Paid : BalanceItemStatus.Pending;
                }

                await model.save();
                returnedModels.push(model);

                if (patch.unitPrice || patch.amount || patch.status) {
                    updateOutstandingBalance.push(model);
                }
            }
        });

        await BalanceItem.updateOutstanding(updateOutstandingBalance);

        return new Response(
            await BalanceItem.getStructureWithPayments(returnedModels),
        );
    }

    async validateMemberId(memberId: string) {
        const member = (await Member.getWithRegistrations(memberId));

        if (!member || !(await Context.auth.canLinkBalanceItemToMember(member))) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'No permission to link balanace items to this member',
                human: 'Je hebt geen toegang om aanrekeningen te maken verbonden met dit lid',
                field: 'memberId',
            });
        }

        return member;
    }

    async validateUserId(balanceItem: BalanceItem, userId: string) {
        const user = await User.getByID(userId);
        if (!user || !await Context.auth.canLinkBalanceItemToUser(balanceItem, user)) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'No permission to link balanace items to this user',
                human: 'Je hebt geen toegang om aanrekeningen te maken verbonden met deze gebruiker',
                field: 'userId',
            });
        }

        return user;
    }
}
