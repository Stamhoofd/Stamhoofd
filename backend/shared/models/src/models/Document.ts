
import { column, Model } from "@simonbackx/simple-database";
import { DocumentStatus, DocumentData, Document as DocumentStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import puppeteer from "puppeteer";
import Handlebars from "handlebars";
import { QueueHandler } from "@stamhoofd/queues";
import { Formatter } from "@stamhoofd/utility";
import { Interval } from "luxon";

export class Document extends Model {
    static table = "documents";

    @column({ primary: true, type: "string", beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: "string"})
    organizationId: string

    @column({ type: "string"})
    templateId: string

    /**
     * Used to give a member access to the document
     */
    @column({ type: "string", nullable: true })
    memberId: string | null = null

    /**
     * Used to identify document already created for a registration (= to update it)
     */
    @column({ type: "string", nullable: true })
    registrationId: string | null = null

    @column({ type: "string" })
    status = DocumentStatus.Draft

    /**
     * Settings of the document. This information is public
     */
    @column({ type: "json", decoder: DocumentData })
    data = DocumentData.create({})

    @column({ type: "datetime" })
    createdAt: Date = new Date()

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    getStructure() {
        return DocumentStruct.create(this)
    }

    buildContext() {
        // Convert the field answers in a simplified javascript object
        const data = {
            "id": this.id,
            "created_at": this.createdAt
        };

        for (const field of this.data.fieldAnswers) {
            const keys = field.settings.id.split('.')
            let current = data
            const lastKey = keys.pop()!
            if (!lastKey) {
                throw new Error("Invalid field id")
            }
            for (const key of keys) {
                if (!current[key]) {
                    current[key] = {}
                }
                current = current[key]

                if (typeof current !== "object") {
                    throw new Error("Invalid field type")
                }
            }
            current[lastKey] = field.objectValue
        }
        return data;
    }

    async updateData(): Promise<void> {
        if (!this.registrationId) {
            return
        }
        const DocumentTemplate = (await import("./DocumentTemplate")).DocumentTemplate
        const template = await DocumentTemplate.getByID(this.templateId)
        if (!template) {
            return
        }

        if (!template.updatesEnabled) {
            return
        }

        const Member = (await import("./Member")).Member
        const [registration] = await Member.getRegistrationWithMembersByIDs([this.registrationId])
        if (!registration) {
            return
        }

        await template.updateDocumentFor(this, registration)
    }

    // Rander handlebars template
    async getRenderedHtml(): Promise<string | null> {
        const DocumentTemplate = (await import("./DocumentTemplate")).DocumentTemplate
        const template = await DocumentTemplate.getByID(this.templateId)
        if (!template) {
            return null
        }

        return this.getRenderedHtmlForTemplate(template.html)
    }

    // Rander handlebars template
    private getRenderedHtmlForTemplate(htmlTemplate: string): string | null {
        try {
            const context = this.buildContext()
            Handlebars.registerHelper('eq', (a, b) => a == b);
            Handlebars.registerHelper('formatPrice', (a) => Formatter.price(a));
            Handlebars.registerHelper('formatDate', (a, options) => {
                if (!(a instanceof Date)) {
                    return ""
                }
                return Formatter.dateNumber(a, true)
            });
            Handlebars.registerHelper('year', (a, options) => {
                if (!(a instanceof Date)) {
                    return ""
                }
                return Formatter.year(a)
            });
            Handlebars.registerHelper('days', (a, b) => {
                if (!(a instanceof Date) || !(b instanceof Date)) {
                    return 0;
                }
                // Calculate absolute amount of days between a and b
                const start = Formatter.luxon(a).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                const end = Formatter.luxon(b).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                const diff = Interval.fromDateTimes(start, end);
                const days = diff.length('days');
                if (isNaN(days)) {
                    return 0;
                }
                return days + 1;
            });
            Handlebars.registerHelper('div', (a, b, options) => {
                if (typeof a !== "number" || typeof b !== "number") {
                    return 0;
                }
                if (b == 0) {
                    return 0;
                }
                if (options.hash.round) {
                    return Math.round(a / b);
                }
                return a / b;
            });

            const template = Handlebars.compile(htmlTemplate);
            const renderedHtml = template(context);
            return renderedHtml;
        } catch (e) {
            console.error('Failed to render document html', e)
            return null;
        }
    }

    /**
     * This will move to a different external service
     */
    static async htmlToPdf(html: string): Promise<Buffer | null> {
        return await QueueHandler.schedule("htmlToPdf", async () => {
            try {
                const browser = await puppeteer.launch();
            
                // Create a new page
                const page = await browser.newPage();
                await page.setJavaScriptEnabled(false);
                await page.setOfflineMode(true);
                await page.emulateMediaType('screen');
                await page.setContent(html, { waitUntil: 'load' })

                // const directory = os.tmpdir();

                // Downlaod the PDF
                const pdf = await page.pdf({
                    // path: directory + this.id + '.pdf',
                    margin: { top: '50px', right: '50px', bottom: '50px', left: '50px' },
                    printBackground: true,
                    format: 'A4',
                    preferCSSPageSize: true,
                    displayHeaderFooter: false
                });
                return pdf;
            } catch (e) {
                console.error('Failed to render document pdf', e)
                return null;
            }
        })
    }
}
