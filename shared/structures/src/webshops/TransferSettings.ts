import { AutoEncoder, EnumDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';

import { Country } from '../addresses/CountryDecoder.js';

export enum TransferDescriptionType {
    Structured = 'Structured', // Random structured transfer
    Reference = 'Reference', // Reference to the order number or registration number
    Fixed = 'Fixed', // Use a fixed description
}

function replaceReplacements(str: string, replacements: { [key: string]: string }) {
    for (const key in replacements) {
        str = str.replace('{{' + key + '}}', replacements[key]);
    }
    return str;
}

export class TransferSettings extends AutoEncoder {
    @field({ decoder: new EnumDecoder(TransferDescriptionType) })
    type = TransferDescriptionType.Structured;

    @field({ decoder: StringDecoder, nullable: true })
    prefix: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    iban: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    creditor: string | null = null;

    @field({ decoder: StringDecoder, version: 340 })
    infoDescription = '';

    fillMissing(settings: TransferSettings) {
        const duplicate = this.clone();
        if (!this.iban) {
            duplicate.iban = settings.iban;
        }
        if (!this.creditor) {
            duplicate.creditor = settings.creditor;
        }
        return duplicate;
    }

    toString() {
        if (this.creditor && this.creditor.length > 0) {
            return this.creditor + ', ' + this.iban;
        }
        return this.iban;
    }

    generateDescription(reference: string, country: Country, replacements: { [key: string]: string } = {}) {
        if (this.type === TransferDescriptionType.Structured) {
            if (country === Country.Belgium) {
                return TransferSettings.generateOGM(replacements);
            }
            return TransferSettings.generateOGMNL(replacements);
        }

        if (this.type === TransferDescriptionType.Reference) {
            return replaceReplacements(this.prefix ? (this.prefix + ' ') : '', replacements) + reference;
        }

        return replaceReplacements(this.prefix ?? '', replacements);
    }

    static generateOGMNL(_: { [key: string]: string } = {}) {
        /**
         * Reference: https://www.betaalvereniging.nl/betalingsverkeer/giraal-betalingsverkeer/betalingskenmerken/
         * Check: https://rudhar.com/cgi-bin/chkdigit.cgi
         * Lengte: 16 cijfers
         * Eerste cijfer = controlegetal
         * Controlegetal wordt berekend door alle cijfers te vermenigvuldigen met een gewicht en vervolgens de modulus van 11 te nemen,
         * het controlegetal is 11 min die modulus
         */

        const length = 15; // allowed values: 15, 12, 11, 10, 9, 8, 7
        const needsLengthIdentification = length < 15;
        const L = needsLengthIdentification ? (length % 10) : '';
        // WARNING: lengths other than 15 are not yet supported because it is not clear whether L needs to be used in the calculation of C or not

        const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6, 1]; // repeat if needed (in reverse order!)

        // Warning: we'll reverse the order of the numbers afterwards!
        const numbers: number[] = [];
        for (let index = 0; index < length; index++) {
            numbers.push(Math.floor(Math.random() * 10));
        }
        const sum = numbers.reduce((sum, num, index) => {
            const weight = weights[index % (weights.length)];
            return sum + num * weight;
        }, 0);
        let C = 11 - (sum % 11);

        // Transform to 1 number following the specs
        if (C === 11) {
            C = 0;
        }

        if (C === 10) {
            C = 1;
        }

        return C + '' + L + (numbers.reverse().map(n => n + '')).join('');
    }

    static generateOGM(replacements: { [key: string]: string } = {}) {
        /**
         * De eerste tien cijfers zijn bijvoorbeeld een klantennummer of een factuurnummer.
         * De laatste twee cijfers vormen het controlegetal dat verkregen wordt door van de
         * voorgaande tien cijfers de rest bij Euclidische deling door 97 te berekenen (modulo 97).
         * Voor en achter de cijfers worden drie plussen (+++) of sterretjes (***) gezet.
         *
         * Uitzondering: Indien de rest 0 bedraagt, dan wordt als controlegetal 97 gebruikt.[1]
         */

        let firstChars = Math.round(Math.random() * 9999999999);
        console.log(' first chars to', firstChars);

        if (replacements.prefix && replacements.prefix.length > 0) {
            // Change first characters
            const number = parseInt(replacements.prefix);
            if (!isNaN(number) && number !== 0) {
                const paddedFirst = (firstChars + '').padStart(10, '0');
                if (replacements.prefix.length === 4) {
                    // Add in the middle, not at the start
                    firstChars = parseInt((paddedFirst.substring(0, 3) + number.toFixed(0).padStart(4, '0') + paddedFirst.substring(3)).padStart(10, '0').substring(0, 10));
                }
                else {
                    firstChars = parseInt((number + paddedFirst).padStart(10, '0').substring(0, 10));
                }
                console.log('Changed first chars to', firstChars);
            }
        }

        let modulo = firstChars % 97;
        if (modulo === 0) {
            modulo = 97;
        }

        const str = (firstChars + '').padStart(10, '0') + (modulo + '').padStart(2, '0');

        return '+++' + str.substr(0, 3) + '/' + str.substr(3, 4) + '/' + str.substr(3 + 4) + '+++';
    }

    static structureOGM(str: string) {
        if (str.length !== 12) {
            return str;
        }
        return '+++' + str.substr(0, 3) + '/' + str.substr(3, 4) + '/' + str.substr(3 + 4) + '+++';
    }
}
