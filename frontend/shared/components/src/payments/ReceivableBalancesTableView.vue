<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :Route="Route"
    >
        <p class="style-description">
            De openstaande bedragen kunnen soms herhaald worden als er meerdere ouders of e-mailadressen zijn ingesteld bij een lid.
        </p>

        <template #empty>
            {{ $t('0637e394-fbd7-42ea-9a1b-5acdcc86419a') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, cachedOutstandingBalanceUIFilterBuilders, Column, ComponentExposed, EmailView, GlobalEventBus, ModernTableView, RecipientChooseOneOption, RecipientMultipleChoiceOption, TableAction, TableActionSelection, usePlatform, useReceivableBalancesObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { EmailRecipientFilterType, EmailRecipientSubfilter, mergeFilters, ReceivableBalance, ReceivableBalanceType, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import ReceivableBalanceView from './ReceivableBalanceView.vue';

type ObjectType = ReceivableBalance;
const $t = useTranslate();
const present = usePresent();
const owner = useRequestOwner();
const platform = usePlatform();
const props = withDefaults(
    defineProps<{
        objectType?: ReceivableBalanceType | null;
    }>(),
    {
        objectType: null,
    },
);

const title = computed(() => {
    return $t('e09c97db-85d7-40b0-8043-65fa24a09a01');
});

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'receivable-balances';
});
const filterBuilders = cachedOutstandingBalanceUIFilterBuilders;

function getRequiredFilter(): StamhoofdFilter | null {
    if (!props.objectType) {
        return {
            objectType: {
                $in: [ReceivableBalanceType.user, ReceivableBalanceType.organization],
            },
            $or: {
                amountOpen: { $neq: 0 },
                amountPending: { $neq: 0 },
                nextDueAt: { $neq: null },
            },
        };
    }

    return {
        objectType: props.objectType,
        $or: {
            amountOpen: { $neq: 0 },
            amountPending: { $neq: 0 },
            nextDueAt: { $neq: null },
        },
    };
}

const objectFetcher = useReceivableBalancesObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'name',
        name: 'Naam',
        getValue: object => object.object.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'amountOpen',
        name: 'Openstaand bedrag',
        getValue: object => object.amountOpen,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

    new Column<ObjectType, number>({
        id: 'amountPending',
        name: 'In verwerking',
        getValue: object => object.amountPending,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

];

const actions: TableAction<ObjectType>[] = [];

const Route = {
    Component: ReceivableBalanceView,
    objectKey: 'item',
};

async function openMail(selection: TableActionSelection<ObjectType>) {
    const filter = selection.filter.filter;
    const search = selection.filter.search;

    const memberOptions: RecipientChooseOneOption = {
        type: 'ChooseOne',
        name: 'Schuden van leden',
        options: [
            {
                id: 'members',
                name: 'Alle leden',
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.ReceivableBalances,
                        filter: mergeFilters([filter, {
                            objectType: ReceivableBalanceType.member,
                        }]),
                        search,
                    }),
                ],
            },
            {
                id: 'no-members',
                name: 'Geen leden',
                value: [],
            },
        ],
    };

    const organizationOption: RecipientMultipleChoiceOption = {
        type: 'MultipleChoice',
        name: 'Schulden van groepen',
        options: [],
        build: (selectedIds: string[]) => {
            if (selectedIds.length === 0) {
                return [];
            }

            const q = EmailRecipientSubfilter.create({
                type: EmailRecipientFilterType.ReceivableBalances,
                filter: mergeFilters([filter, {
                    objectType: ReceivableBalanceType.organization,
                }]),
                search,
                subfilter: {
                    meta: {
                        responsibilityIds: {
                            $in: selectedIds,
                        },
                    },
                },
            });

            return [
                q,
            ];
        },
    };

    for (const responsibility of platform.value.config.responsibilities) {
        if (!responsibility.organizationBased) {
            continue;
        }
        organizationOption.options.push(
            {
                id: responsibility.id,
                name: responsibility.name,
            },
        );
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EmailView, {
            recipientFilterOptions: [memberOptions, organizationOption],
        }),
    });
    await present({
        components: [
            displayedComponent,
        ],
        modalDisplayStyle: 'popup',
    });
}

actions.push(new AsyncTableAction({
    name: 'E-mailen',
    icon: 'email',
    priority: 12,
    groupIndex: 3,
    handler: async (selection: TableActionSelection<ObjectType>) => {
        await openMail(selection);
    },
}));

// Listen for patches in payments
GlobalEventBus.addListener(owner, 'paymentPatch', () => {
    tableObjectFetcher.reset(false, false);
    return Promise.resolve();
});

GlobalEventBus.addListener(owner, 'balanceItemPatch', () => {
    tableObjectFetcher.reset(false, false);
    return Promise.resolve();
});

</script>
