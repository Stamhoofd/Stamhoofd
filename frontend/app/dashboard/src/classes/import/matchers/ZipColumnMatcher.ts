import { SimpleError } from "@simonbackx/simple-errors";
import { Address, Parent, ParentType } from "@stamhoofd/structures";
import { DataValidator, Formatter } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class ZipColumnMatcher extends SharedMatcher implements ColumnMatcher {
    private reg = /^\s*(([0-9]+?)(\s?[A-Z]{2})?)[\s,]+(([A-Za-z]|\s)+)\s*$/
    private regReverse = /^\s*(([0-9]+?)(\s?[A-Z]{2})?)[\s,]+(([A-Za-z]|\s)+)\s*$/

    getName(): string {
        return "Postcode"
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        for (const word of this.negativeMatch) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        
        const possibleMatch = ["postcode", "zip", "postal"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }


    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            return
        }

        // Check if string value
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const postalCode = ((cell.w ?? cell.v)+"")

        if (postalCode.length == 0) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Geen tekst in deze cel"
            })
        }
        
        if (this.category == MatcherCategory.Member) {
            if (!member.details.address) {
                member.details.address = Address.createDefault()
            }
            member.details.address.postalCode = postalCode
        } else if (this.category == MatcherCategory.Parent1) {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }

            if (!member.details.parents[0].address) {
                member.details.parents[0].address = Address.createDefault()
            }
            member.details.parents[0].address.postalCode = postalCode
        } else if (this.category == MatcherCategory.Parent2) {
            while (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            if (!member.details.parents[1].address) {
                member.details.parents[1].address = Address.createDefault()
            }
            member.details.parents[1].address.postalCode = postalCode
        }
    }
}