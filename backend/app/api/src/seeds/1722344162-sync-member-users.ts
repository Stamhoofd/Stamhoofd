import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';
import { MemberUserSyncer } from '../helpers/MemberUserSyncer';
import { logger } from '@simonbackx/simple-logging';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped seed update-membership because usermode not platform');
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        while (true) {
            const rawMembers = await Member.where({
                id: {
                    value: id,
                    sign: '>',
                },
            }, { limit: 500, sort: ['id'] });

            if (rawMembers.length === 0) {
                break;
            }

            const membersWithRegistrations = await Member.getBlobByIds(...rawMembers.map(m => m.id));

            const promises: Promise<any>[] = [];

            for (const memberWithRegistrations of membersWithRegistrations) {
                promises.push((async () => {
                    await MemberUserSyncer.onChangeMember(memberWithRegistrations);
                    c++;

                    if (c % 1000 === 0) {
                        process.stdout.write('.');
                    }
                    if (c % 10000 === 0) {
                        process.stdout.write('\n');
                    }
                })());
            }

            await Promise.all(promises);
            id = rawMembers[rawMembers.length - 1].id;
        }
    });

    // Do something here
    return Promise.resolve();
});
