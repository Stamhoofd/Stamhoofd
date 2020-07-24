import { DecryptedMember } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class NoFilter implements Filter {
    getName(): string {
        return "Alle leden";
    }
    doesMatch(_member: DecryptedMember): boolean {
        return true;
    }
}
