import { Email, EmailAddress, EmailBuilder } from "@stamhoofd/email";
import { EmailTemplateType, OrganizationEmail, Recipient, Replacement } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { SimpleError } from "@simonbackx/simple-errors";
import { EmailTemplate, Group, Organization, Platform, User, Webshop } from "../models";

export type EmailTemplateOptions = {
    type: EmailTemplateType,
    webshop?: Webshop | null,
    group?: Group | null,
    organizationId?: string | null
}

export async function getEmailTemplate(data: EmailTemplateOptions) {
    // Most specific template: for specific group
    const q = EmailTemplate.select()
        .where('type', data.type)

    if (data.group) {
        q.where('groupId', data.group.id)
    }

    if (data.organizationId) {
        q.where('organizationId', data.organizationId)
    }

    if (data.webshop) {
        q.where('webshopId', data.webshop.id)
    }

    let templates = await q.limit(1).fetch()
    
    // Specific for organization
    if (templates.length == 0 && (data.group?.id || data.webshop?.id) && data.organizationId) {
        templates = await EmailTemplate.select()
            .where('type', data.type)
            .where('organizationId', data.organizationId)
            .where('groupId', null)
            .where('webshopId', null)
            .limit(1)
            .fetch()
    }

    // Default for platform
    if (templates.length == 0 && (data.group?.id || data.webshop?.id || data.organizationId)) {
        templates = await EmailTemplate.select()
            .where('type', data.type)
            .where('organizationId', null)
            .where('groupId', null)
            .where('webshopId', null)
            .limit(1)
            .fetch()
    }

    if (templates.length == 0) {
        console.error("Could not find email template for type "+data.type)
        return
    }

    return templates[0]
}

export async function getDefaultEmailFrom(organization: Organization|null, options: Pick<EmailBuilderOptions, "type"> & { template: Omit<EmailTemplateOptions, "organizationId"> }) {
    // When choosing sending domain, prefer using the one with the highest reputation
    const preferStrong = options.type === 'transactional'

    let preferEmailId: string | null = null;

    if (options.template.group) {
        preferEmailId = options.template.group.privateSettings.defaultEmailId
    }

    if (options.template.webshop) {
        preferEmailId = options.template.webshop.privateMeta.defaultEmailId
    }
    
    if (organization) {
        // Send confirmation e-mail
        let from = preferStrong ? organization.getStrongEmail(organization.i18n, false) : organization.uri+"@stamhoofd.email";
        const sender: OrganizationEmail | undefined = (preferEmailId ? organization.privateMeta.emails.find(e => e.id === preferEmailId) : null) ?? organization.privateMeta.emails.find(e => e.default) ?? organization.privateMeta.emails[0];
        let replyTo: string | undefined = undefined

        if (sender) {
            replyTo = sender.email

            // Can we send from this e-mail or reply-to?
            if (replyTo && organization.privateMeta.mailDomain && organization.privateMeta.mailDomainActive && sender.email.endsWith("@"+organization.privateMeta.mailDomain)) {
                from = sender.email
                replyTo = undefined
            }

            // Include name in form field
            if (sender.name) {
                from = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
            }  else {
                from = '"'+organization.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
            }

            if (replyTo) {
                if (sender.name) {
                    replyTo = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
                }  else {
                    replyTo = '"'+organization.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
                }
            }
        } else {
            from = '"'+organization.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        }

        return {
            from, replyTo
        }
    }

    const platform = await Platform.getSharedPrivateStruct()

    // Platform
    // TODO: read from config
    let from = 'hallo@stamhoofd.be'
    const sender: OrganizationEmail | undefined = (preferEmailId ? platform.privateConfig.emails.find(e => e.id === preferEmailId) : null) ?? platform.privateConfig.emails.find(e => e.default) ?? platform.privateConfig.emails[0];
    let replyTo: string | undefined = undefined

    if (sender) {
        replyTo = sender.email

        // Include name in form field
        if (sender.name) {
            from = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        }  else {
            from = '"'+platform.config.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
        }

        if (replyTo) {
            if (sender.name) {
                replyTo = '"'+sender.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
            }  else {
                replyTo = '"'+platform.config.name.replaceAll("\"", "\\\"")+"\" <"+replyTo+">" 
            }
        }
    } else {
        from = '"'+platform.config.name.replaceAll("\"", "\\\"")+"\" <"+from+">" 
    }

    return {
        from, replyTo
    }
}


export async function sendEmailTemplate(organization: Organization|null, options: Omit<EmailBuilderOptions, "subject" | "html" | "from" | "replyTo"> & { template: Omit<EmailTemplateOptions, "organizationId"> }) {
    if (options.template.webshop) {
        options.defaultReplacements = [...(options.defaultReplacements ?? []), ...options.template.webshop.meta.getEmailReplacements()]
    }
    const builder = await getEmailBuilderForTemplate(organization, {
        ...options,
        ...(await getDefaultEmailFrom(organization, options))
    });
    if (builder) {
        Email.schedule(builder)
    }
}

export async function getEmailBuilderForTemplate(organization: Organization|null, options: Omit<EmailBuilderOptions, "subject" | "html"> & { template: Omit<EmailTemplateOptions, "organizationId"> }) {
    const template = await getEmailTemplate({
        ...options.template,
        organizationId: organization?.id ?? null
    })

    if (!template) {
        return undefined
    }

    return await getEmailBuilder(organization, {
        ...options,
        subject: template.subject,
        html: template.html
    })
}

export type EmailBuilderOptions = {
    defaultReplacements?: Replacement[],
    recipients: Recipient[], 
    from: string, 
    replyTo?: string|null, 
    subject: string, 
    html: string,
    attachments?: {
        filename: string;
        content: string;
        contentType: string | undefined;
        encoding: string;
    }[],
    type?: "transactional" | "broadcast",
    unsubscribeType?: 'all'|'marketing',
    fromStamhoofd?: boolean,
    singleBcc?: string,
    replaceAll?: {from: string, to: string}[], // replace in all e-mails, not recipient dependent
    callback?: (error: Error|null) => void; // for each email
}

/**
 * @param organization defines replacements and unsubsribe behaviour
 */
export async function getEmailBuilder(organization: Organization|null, email: EmailBuilderOptions) {
    const platform = await Platform.getSharedStruct()
    // Update recipients
    const cleaned: Recipient[] = []
    for (const recipient of email.recipients) {
        try {
            const unsubscribe = await EmailAddress.getOrCreate(recipient.email, email.fromStamhoofd || !organization ? null : organization.id)

            if (unsubscribe.unsubscribedAll || unsubscribe.hardBounce || unsubscribe.markedAsSpam || !unsubscribe.token || (unsubscribe.unsubscribedMarketing && email.unsubscribeType === 'marketing')) {
                // Ignore
                if (email.callback) {
                    email.callback(
                        new SimpleError({
                            code: 'email_unsubscribed',
                            message: unsubscribe.unsubscribedAll ? "Recipient has unsubscribed" : (unsubscribe.hardBounce ? 'Recipient has hard bounced' : (unsubscribe.markedAsSpam ? 'Recipient has marked as spam' : 'Recipient has unsubscribed from marketing'))
                        })
                    )
                }
                continue
            }
            recipient.replacements.push(Replacement.create({
                token: "unsubscribeUrl",
                value: "https://"+STAMHOOFD.domains.dashboard+"/"+(organization ? (organization.i18n.locale + '/') : '')+"unsubscribe?id="+encodeURIComponent(unsubscribe.id)+"&token="+encodeURIComponent(unsubscribe.token)+"&type="+encodeURIComponent(email.unsubscribeType ?? 'all')
            }))

            // Override headers
            recipient.headers = {
                'List-Unsubscribe': "<mailto:unsubscribe+"+unsubscribe.id+"@stamhoofd.email>",
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
            cleaned.push(recipient)
        } catch (e) {
            console.error(e)
        }
    }
    email.recipients = cleaned

    // Update recipients
    for (const recipient of email.recipients) {
        recipient.replacements = recipient.replacements.slice()

        // Default signInUrl
        let signInUrl = "https://"+(organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard)+"/login?email="+encodeURIComponent(recipient.email)

        const recipientUser = await User.getForAuthentication(organization?.id ?? null, recipient.email)
        if (!recipientUser) {
            // We can create a special token
            signInUrl = "https://"+(organization && STAMHOOFD.userMode === 'organization' ? organization.getHost() : STAMHOOFD.domains.dashboard)+"/account-aanmaken?email="+encodeURIComponent(recipient.email)
        }

        recipient.replacements.push(Replacement.create({
            token: "signInUrl",
            value: signInUrl
        }))

        if (email.defaultReplacements) {
            recipient.replacements.push(...email.defaultReplacements)
        }

        recipient.replacements.push(...recipient.getDefaultReplacements())

        if (organization) {
            const extra = organization.meta.getEmailReplacements()
            recipient.replacements.push(...extra)
        } 

        // Defaults
        const extra = platform.config.getEmailReplacements()
        recipient.replacements.push(...extra)
    }

    const queue = email.recipients.slice()

    let emailIndex = 0;

    for (const s of email.replaceAll ?? []) {
        email.html = email.html.replaceAll(s.from, s.to)
    }

    // Create e-mail builder
    const builder: EmailBuilder = () => {
        const recipient = queue.shift()
        if (!recipient) {
            return undefined
        }

        let replacedHtml = email.html
        let replacedSubject = email.subject

        for (const replacement of recipient.replacements) {
            replacedHtml = replacedHtml.replaceAll("{{"+replacement.token+"}}", replacement.html ?? Formatter.escapeHtml(replacement.value))
            replacedSubject = replacedSubject.replaceAll("{{"+replacement.token+"}}", replacement.value)
        }

        emailIndex += 1;

        return {
            from: email.from,
            replyTo: email.replyTo ?? undefined,
            bcc: emailIndex === 1 ? email.singleBcc : undefined,
            to: [
                {
                    // Name will get cleaned by email service
                    name: (recipient.firstName??'')+" "+(recipient.lastName??''),
                    email: recipient.email
                }
            ],
            subject: replacedSubject,
            html: replacedHtml ?? undefined,
            attachments: email.attachments,
            headers: recipient.headers,
            type: email.type,
            callback: email.callback
        }
    }
    return builder;
}
