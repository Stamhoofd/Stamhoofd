import { Migration } from '@simonbackx/simple-database';
import { Organization } from '../models/Organization';
import SES from 'aws-sdk/clients/sesv2';

async function setAWSConfigurationSet(this: Organization) {
        if (this.privateMeta.mailDomain === null) {
            return;
        }

        // Protect specific domain names
        if (["stamhoofd.be", "stamhoofd.app", "stamhoofd.email"].includes(this.privateMeta.mailDomain)) {
            console.error("Tried to validate AWS mail identity with protected domains @"+this.id)
            return
        }

        if (process.env.NODE_ENV != "production") {
            // Temporary ignore this
            //return;
        }

        const sesv2 = new SES();

        // Check if mail identitiy already exists..
        try {
            const existing = await sesv2.getEmailIdentity({
                EmailIdentity: this.privateMeta.mailDomain
            }).promise()
           
            if (existing.ConfigurationSetName !== "stamhoofd-domains") {
                console.log("Updating configuration set name @"+this.id+" for "+this.privateMeta.mailDomain)


                await sesv2.putEmailIdentityConfigurationSetAttributes({
                    EmailIdentity: this.privateMeta.mailDomain,
                    ConfigurationSetName: "stamhoofd-domains"
                }).promise()
            }

            // Disable email forwarding of bounces and complaints
            // We handle this now with the configuration set
            await sesv2.putEmailIdentityFeedbackAttributes({
                EmailIdentity: this.privateMeta.mailDomain,
                EmailForwardingEnabled: false
            }).promise()
        } catch (e) {
            console.log("Missing identity @"+this.id+" for "+this.privateMeta.mailDomain)
            console.error(e)
            // todo
        }
    }
    
export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        // Undo default root groups
        await setAWSConfigurationSet.call(organization)
    }
});


