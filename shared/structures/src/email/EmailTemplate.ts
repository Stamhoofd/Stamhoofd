import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { EmailRecipientFilterType } from "./Email";

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    SavedMembersEmail = "SavedMembersEmail",

    /**
     * Defaults
     */
    DefaultMembersEmail = "DefaultMembersEmail",

    // 
    MembersExpirationReminder = "MembersExpirationReminder",
    WebshopsExpirationReminder = "WebshopsExpirationReminder",
    SingleWebshopExpirationReminder = "SingleWebshopExpirationReminder",
    TrialWebshopsExpirationReminder = "TrialWebshopsExpirationReminder",
    TrialMembersExpirationReminder = "TrialMembersExpirationReminder",

    OrderNotification = "OrderNotification",

    RegistrationConfirmation = "RegistrationConfirmation",
    RegistrationTransferDetails = "RegistrationTransferDetails",

    OrderConfirmationOnline = "OrderConfirmationOnline",
    OrderConfirmationTransfer = "OrderConfirmationTransfer",
    OrderConfirmationPOS = "OrderConfirmationPOS",
    OrderReceivedTransfer = "OrderReceivedTransfer",
    OrderOnlinePaymentFailed = "OrderOnlinePaymentFailed",

    /**
     * Tickets sent immediately after ordering
     */
    TicketsConfirmation = "TicketsConfirmation",

    /**
     * Order received, tickets will follow when we receive your payment
     */
    TicketsConfirmationTransfer = "TicketsConfirmationTransfer",

    /**
     * Order received, tickets sent, but need to get paid at entrance
     */
    TicketsConfirmationPOS = "TicketsConfirmationPOS",

    /**
     * Tickets sent after payment is received
     */
    TicketsReceivedTransfer = "TicketsReceivedTransfer",

    /**
     * Organization emails:
     */
    OrganizationUnstableDNS = "OrganizationUnstableDNS",
    OrganizationInvalidDNS = "OrganizationInvalidDNS",
    OrganizationValidDNS = "OrganizationValidDNS",
    OrganizationStableDNS = "OrganizationStableDNS",
    OrganizationDNSSetupComplete = "OrganizationDNSSetupComplete",

    // Drip emails
    OrganizationDripWelcome = "OrganizationDripWelcome",
    OrganizationDripWebshopTrialCheckin = "OrganizationDripWebshopTrialCheckin",
    OrganizationDripMembersTrialCheckin = "OrganizationDripMembersTrialCheckin",
    OrganizationDripWebshopTrialExpired = "OrganizationDripWebshopTrialExpired",
    OrganizationDripMembersTrialExpired = "OrganizationDripMembersTrialExpired",
    OrganizationDripTrialExpiredReminder = "OrganizationDripTrialExpiredReminder",
    OrganizationDripWebshopNotRenewed = "OrganizationDripWebshopNotRenewed",
    OrganizationDripMembersNotRenewed = "OrganizationDripMembersNotRenewed",

    /**
     * Exports
     */
    ExcelExportSucceeded = "ExcelExportSucceeded",
    ExcelExportFailed = "ExcelExportFailed",

    /**
     * User emails
     */
    ForgotPasswordButNoAccount = "ForgotPasswordButNoAccount",
    ForgotPassword = "ForgotPassword",

    SignupAlreadyHasAccount = "SignupAlreadyHasAccount",

    VerifyEmail = "VerifyEmail",
    VerifyEmailWithoutCode = "VerifyEmailWithoutCode",
    AdminInvitation = 'AdminInvitation',
    AdminInvitationNewUser = 'AdminInvitationNewUser',

    DeleteAccountConfirmation = "DeleteAccountConfirmation",
}

export class EmailTemplate extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null

    @field({ decoder: StringDecoder })
    subject = ""

    @field({ decoder: new EnumDecoder(EmailTemplateType) })
    type: EmailTemplateType = EmailTemplateType.SavedMembersEmail

    @field({ decoder: StringDecoder })
    html = ""

    @field({ decoder: StringDecoder })
    text = ""

    @field({ decoder: AnyDecoder })
    json = {}

    @field({ decoder: StringDecoder, nullable: true })
    groupId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    webshopId: string | null = null;

    @field({ decoder: DateDecoder, optional: true })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, optional: true })
    updatedAt: Date = new Date();

    static getDefaultForRecipient(type: EmailRecipientFilterType): EmailTemplateType|null {
        if (type === EmailRecipientFilterType.Members || type === EmailRecipientFilterType.MemberParents) {
            return EmailTemplateType.DefaultMembersEmail
        }

        return null;
    }

    static isSavedEmail(type: EmailTemplateType): boolean {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return true
        }

        return false;
    }

    static getRecipientType(type: EmailTemplateType): EmailRecipientFilterType|null {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return EmailRecipientFilterType.Members
        }

        if (type === EmailTemplateType.DefaultMembersEmail) {
            return EmailRecipientFilterType.Members
        }

        // Use custom getSupportedReplacementsForType for this type
        return null;
    }

    static getTypeTitle(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail: return 'Opgeslagen e-mail naar leden'
            case EmailTemplateType.DefaultMembersEmail: return 'Placeholder: Standaard e-mail naar leden'

            case EmailTemplateType.MembersExpirationReminder: return 'Billing: Herinnering verlopen pakket ledenadministratie'
            case EmailTemplateType.WebshopsExpirationReminder: return 'Billing: Herinnering verlopen pakket webshops'
            case EmailTemplateType.SingleWebshopExpirationReminder: return 'Billing: Herinnering verlopen pakket enkele webshop'
            case EmailTemplateType.TrialWebshopsExpirationReminder: return 'Billing: Herinnering verlopen proefperiode pakket webshops'
            case EmailTemplateType.TrialMembersExpirationReminder: return 'Billing: Herinnering verlopen proefperiode pakket ledenadministratie'
            case EmailTemplateType.OrderNotification: return 'Webshop: Bestelling notificatie voor beheerders'

            case EmailTemplateType.RegistrationConfirmation: return 'Inschrijvingen: Bevestiging'
            case EmailTemplateType.RegistrationTransferDetails: return 'Inschrijvingen: Betaalinstructies met overschrijving'

            case EmailTemplateType.OrderConfirmationOnline: return 'Webshop: Bestelling bevestiging online betaling'
            case EmailTemplateType.OrderConfirmationTransfer: return 'Webshop: Bestelling bevestiging overschrijving'
            case EmailTemplateType.OrderConfirmationPOS: return 'Webshop: Bestelling bevestiging betaling aan de kassa'
            case EmailTemplateType.OrderReceivedTransfer: return 'Webshop: Bestelling ontvangen overschrijving'
            case EmailTemplateType.OrderOnlinePaymentFailed: return 'Webshop: Online betaling mislukt'
            case EmailTemplateType.TicketsConfirmation: return 'Webshop: Tickets bevestiging'
            case EmailTemplateType.TicketsConfirmationTransfer: return 'Webshop: Tickets bevestiging overschrijving'
            case EmailTemplateType.TicketsConfirmationPOS: return 'Webshop: Tickets bevestiging betaling aan de kassa'
            case EmailTemplateType.TicketsReceivedTransfer: return 'Webshop: Tickets ontvangen overschrijving'

            case EmailTemplateType.OrganizationUnstableDNS: return 'DNS: instabiele DNS'
            case EmailTemplateType.OrganizationInvalidDNS: return 'DNS: ongeldige DNS'
            case EmailTemplateType.OrganizationValidDNS: return 'DNS: geldige DNS'
            case EmailTemplateType.OrganizationStableDNS: return 'DNS: stabiele DNS'
            case EmailTemplateType.OrganizationDNSSetupComplete: return 'DNS: DNS setup compleet'

            case EmailTemplateType.OrganizationDripWelcome: return 'Organisatie: drip welkom'
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin: return 'Organisatie: drip webshop proefperiode checkin'
            case EmailTemplateType.OrganizationDripMembersTrialCheckin: return 'Organisatie: drip ledenadministratie proefperiode checkin'
            case EmailTemplateType.OrganizationDripWebshopTrialExpired: return 'Organisatie: drip webshop proefperiode verlopen'
            case EmailTemplateType.OrganizationDripMembersTrialExpired: return 'Organisatie: drip ledenadministratie proefperiode verlopen'
            case EmailTemplateType.OrganizationDripTrialExpiredReminder: return 'Organisatie: drip proefperiode verlopen reminder'
            case EmailTemplateType.OrganizationDripWebshopNotRenewed: return 'Organisatie: drip webshop niet verlengd'
            case EmailTemplateType.OrganizationDripMembersNotRenewed: return 'Organisatie: drip ledenadministratie niet verlengd'

            case EmailTemplateType.ExcelExportSucceeded: return 'Export: Excel export geslaagd'
            case EmailTemplateType.ExcelExportFailed: return 'Export: Excel export mislukt'

            case EmailTemplateType.SignupAlreadyHasAccount: return 'Registratie: account bestaat al'
            case EmailTemplateType.ForgotPasswordButNoAccount: return 'Wachtwoord vergeten: geen account'
            case EmailTemplateType.ForgotPassword: return 'Wachtwoord vergeten'
            case EmailTemplateType.DeleteAccountConfirmation: return 'Bevestiging account verwijderen'
            case EmailTemplateType.VerifyEmail: return 'Verifieer e-mailadres'
            case EmailTemplateType.VerifyEmailWithoutCode: return "Verifieer e-mailadres zonder code"
            case EmailTemplateType.AdminInvitation: return 'Uitnodiging beheerder: bestaande gebruiker'
            case EmailTemplateType.AdminInvitationNewUser: return 'Uitnodiging beheerder: nieuwe gebruiker'
        }
    }

    static allowPlatformLevel(type: EmailTemplateType): boolean {
        if (STAMHOOFD.userMode === 'platform') {
            if (type.includes('Drip') || type.includes('Expiration')) {
                return false;
            }
        }

        return true
    }

    static allowOrganizationLevel(type: EmailTemplateType): boolean {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return true
            case EmailTemplateType.SavedMembersEmail: return true

            case EmailTemplateType.RegistrationConfirmation: return true
            case EmailTemplateType.RegistrationTransferDetails: return true

            // case EmailTemplateType.OrderConfirmationOnline: return true
            // case EmailTemplateType.OrderConfirmationTransfer: return true
            // case EmailTemplateType.OrderConfirmationPOS: return true
            // case EmailTemplateType.OrderReceivedTransfer: return true
            // case EmailTemplateType.TicketsConfirmation: return true
            // case EmailTemplateType.TicketsConfirmationTransfer: return true
            // case EmailTemplateType.TicketsConfirmationPOS: return true
            // case EmailTemplateType.TicketsReceivedTransfer: return true
        }

        return false
    }

    static getPlatformTypeDescription(type: EmailTemplateType): string|null {
        switch (type) {

            case EmailTemplateType.OrganizationUnstableDNS: return 'Organisatie: instabiele DNS'
            case EmailTemplateType.OrganizationInvalidDNS: return 'Organisatie: ongeldige DNS'
            case EmailTemplateType.OrganizationValidDNS: return 'Organisatie: geldige DNS'
            case EmailTemplateType.OrganizationStableDNS: return 'Organisatie: stabiele DNS'
            case EmailTemplateType.OrganizationDNSSetupComplete: return 'Organisatie: DNS setup compleet'

            case EmailTemplateType.OrderOnlinePaymentFailed: return 'Wanneer een online betaling bij een webshop mislukt na een lange tijd wachten - zou zelden mogen voorkomen'

            case EmailTemplateType.ExcelExportSucceeded: return 'Bij lange Excel exports ontvang je een e-mail om jouw bestand te downloaden'
            case EmailTemplateType.ExcelExportFailed: return 'Als een lange Excel export toch mislukt, ontvang je een e-mail dat het mis ging'

            case EmailTemplateType.ForgotPasswordButNoAccount: return 'Als iemand een wachtwoord probeert te resetten, maar er geen account is met dat e-mailadres'
            case EmailTemplateType.ForgotPassword: return 'De e-mail met een link om je wachtwoord opnieuw in te stellen als je die bent vergeten'
            case EmailTemplateType.DeleteAccountConfirmation: return 'De e-mail als bevestiging als iemand aanvraagt om hun account te verwijderen.'
            case EmailTemplateType.VerifyEmail: return 'De e-mail die wordt verzonden om het e-mailadres te bevestigen als iemand een account aanmaakt.'
            case EmailTemplateType.VerifyEmailWithoutCode: return 'De e-mail die wordt verzonden naar de gebruiker om het e-mailadres te bevestigen als een beheerder dit wijzigt. Deze e-mail bevat geen bevestigingscode.'
            case EmailTemplateType.AdminInvitation: return 'De e-mail die een bestaande gebruiker ontvangt als hij toegevoegd wordt als beheerder.'
            case EmailTemplateType.AdminInvitationNewUser: return 'De e-mail die iemand zonder account ontvangt als hij toegevoegd wordt als beheerder.'

            case EmailTemplateType.SignupAlreadyHasAccount: return 'Als iemand probeert een account aan te maken, maar er al een account bestaat met dat e-mailadres'
        }

        return null
    }


    static getTypeDescription(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return 'Als iemand een nieuwe e-mail opstelt, gericht aan leden, zal deze template standaard al klaar staan. Deze kan dan nog aangepast worden.'

            case EmailTemplateType.OrderNotification: return 'E-mail die webshop eigenaren ontvangen wanneer er een bestelling is geplaatst (indien ze die functie hebben ingeschakeld)'
            case EmailTemplateType.RegistrationConfirmation: return 'Leden en ouders (die toegang hebben of moeten krijgen) ontvangen deze e-mail nadat ze worden ingeschreven of zelf inschrijven.'

            case EmailTemplateType.OrderConfirmationOnline: return 'Wanneer een besteller online betaald (of totaalbedrag is 0 euro)'
            case EmailTemplateType.OrderConfirmationTransfer: return 'Wanneer een besteller kiest voor overschrijving - bevat nog eens de betaalinstructies als de betaling nog niet zou zijn gebeurd'
            case EmailTemplateType.OrderConfirmationPOS: return 'Wanneer een besteller kiest voor betaling ter plaatse/bij levering'
            case EmailTemplateType.OrderReceivedTransfer: return 'De e-mail die een besteller nog ontvangt als je de betaling hebt gemarkeerd als ontvangen (enkel bij betaalmethode overschrijving)'
            
            case EmailTemplateType.TicketsConfirmation: return 'Wanneer een besteller online betaald (of totaalbedrag is 0 euro)'
            case EmailTemplateType.TicketsConfirmationTransfer: return 'Wanneer een besteller kiest voor overschrijving - bevat nog eens de betaalinstructies als de betaling nog niet zou zijn gebeurd'
            case EmailTemplateType.TicketsConfirmationPOS: return 'Wanneer een besteller kiest voor betaling ter plaatse/bij levering'
            case EmailTemplateType.TicketsReceivedTransfer: return 'De e-mail die een besteller nog ontvangt als je de betaling hebt gemarkeerd als ontvangen (enkel bij betaalmethode overschrijving)'

        }

        return ''
    }

    static getSupportedReplacementsForType(type: EmailTemplateType): string[] {
        if (type === EmailTemplateType.SignupAlreadyHasAccount) {
            return [
                "greeting",
                "email",
                "resetUrl"
            ];
        }

        if (type === EmailTemplateType.ForgotPasswordButNoAccount) {
            return [
                "email"
            ];
        }

        if (type === EmailTemplateType.DeleteAccountConfirmation) {
            return [
                "email"
            ];
        }

        if (type === EmailTemplateType.ForgotPassword) {
            return [
                "greeting",
                "firstName",
                "lastName",
                "email",
                "resetUrl"
            ];
        }

        if(type === EmailTemplateType.VerifyEmail) {
            return [
                "greeting",
                "email",
                "confirmEmailUrl",
                "confirmEmailCode",
                "organizationName"
            ]
        }

        if(type === EmailTemplateType.VerifyEmailWithoutCode) {
            return [
                "greeting",
                "email",
                "confirmEmailUrl",
                "organizationName"
            ]
        }

        if(type === EmailTemplateType.AdminInvitation) {
            return [
                "greeting",
                "email",
                "platformOrOrganizationName",
                "inviterName",
                "validUntil",
                "signInUrl",
                "resetUrl"
            ]
        }

        if(type === EmailTemplateType.AdminInvitationNewUser) {
            return [
                "greeting",
                "email",
                "platformOrOrganizationName",
                "inviterName",
                "validUntil",
                "resetUrl"
            ]
        }

        if (type === EmailTemplateType.ExcelExportSucceeded) {
            return [
                "greeting",
                "firstName",
                "lastName",
                "downloadUrl"
            ];
        }

        if (type === EmailTemplateType.ExcelExportFailed) {
            return [
                "greeting",
                "firstName",
                "lastName"
            ];
        }

        if (type === EmailTemplateType.RegistrationConfirmation) {
            return [
                "greeting",
                "firstName",
                "lastName",
                "firstNameMember",
                "lastNameMember",
                "email",
                "registerUrl",
                "organizationName",
                "groupName",
                "signInUrl",
                "unsubscribeUrl",
                'loginDetails'
            ];
        }

        if ([
            EmailTemplateType.OrganizationDNSSetupComplete, 
            EmailTemplateType.OrganizationInvalidDNS,
            EmailTemplateType.OrganizationStableDNS,
            EmailTemplateType.OrganizationUnstableDNS,
            EmailTemplateType.OrganizationValidDNS
        ].includes(type)) {
            return [
                "greeting",
                "firstName",
                "lastName",
                "email",
                "organizationName",
                "mailDomain"
            ];
        }

        if (type === EmailTemplateType.RegistrationTransferDetails) {
            return [
                "priceToPay",
                "paymentMethod",
                "transferDescription",
                "transferBankAccount",
                "transferBankCreditor",
                "overviewContext",
                "memberNames",
                "overviewTable",
                "paymentTable",
                "registerUrl",
                "organizationName",
                "signInUrl",
                "unsubscribeUrl",
                'loginDetails'
            ];
        }

        if ([
            EmailTemplateType.MembersExpirationReminder, 
            EmailTemplateType.WebshopsExpirationReminder, 
            EmailTemplateType.TrialMembersExpirationReminder, 
            EmailTemplateType.TrialWebshopsExpirationReminder, 
            EmailTemplateType.SingleWebshopExpirationReminder
        ].includes(type)) {
            return [
                "greeting",
                "firstName",
                "organizationName",
                "packageName",
                "validUntil",
                "validUntilDate",
                "renewUrl",
                "unsubscribeUrl"
            ]
        }
        const sharedReplacements = [
            "orderPrice",
            "orderStatus",
            "orderDetailsTable",
            "orderTable",
            "paymentTable",
            "orderUrl",
            "paymentMethod",
            "organizationName",
            "webshopName",
            "unsubscribeUrl"
        ]

        if (type !== EmailTemplateType.OrderOnlinePaymentFailed) {
            sharedReplacements.push(
                "nr"
            )
        }

        if (type !== EmailTemplateType.OrderNotification) {
            sharedReplacements.push(
                "greeting",
                "firstName",
                "lastName"
            )
        }

        if (type === EmailTemplateType.OrderConfirmationTransfer || type === EmailTemplateType.TicketsConfirmationTransfer) {
            return [
                ...sharedReplacements,
                "transferDescription",
                "transferBankAccount",
                "transferBankCreditor"
            ];
        }

        return sharedReplacements
    }
}
