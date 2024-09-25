import { Factory } from "@simonbackx/simple-database";
import StreetNames from "@simonbackx/simple-database/dist/src/classes/data/streets";
import { Address, Country } from "@stamhoofd/structures";

type Options = Record<string, never>;

export class AddressFactory extends Factory<Options, Address> {
    randomStreet(): string {
        return this.randomArray(StreetNames);
    }

    create(): Promise<Address> {
        const address = new Address();
        address.street = this.randomStreet();
        address.number = Math.floor(Math.random() * 300) + 1 + "";
        address.city = this.randomArray(["Wetteren", "Schellebelle", "Wichelen", "Massemen", "Laarne"]);
        switch (address.city) {
            case "Wetteren":
                address.postalCode = "9230";
                break;
            case "Schellebelle":
                address.postalCode = "9230";
                break;
            case "Wichelen":
                address.postalCode = "9230";
                break;
            case "Massemen":
                address.postalCode = "9230";
                break;
            case "Laarne":
                address.postalCode = "9230";
                break;

            default:
                address.postalCode = "9000";
                break;
        }
        address.country = Country.Belgium;

        return Promise.resolve(address);
    }
}
