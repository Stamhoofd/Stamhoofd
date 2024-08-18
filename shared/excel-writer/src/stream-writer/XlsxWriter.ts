import { CellValue, XlsxWriterAdapter } from "../interfaces";
import { ZipWriterAdapter } from "./interfaces";
import { XlsxAppPropsWriter } from "./XlsxAppPropsWriter";
import { XlsxContentTypesWriter } from "./XlsxContentTypesWriter";
import { XlsxCorePropsWriter } from "./XlsxCorePropsWriter";
import { XlsxRelationsWriter } from "./XlsxRelationsWriter";
import { XlsxSharedStringsWriter } from "./XlsxSharedStringsWriter";
import { XlsxSheetWriter } from "./XlsxSheetWriter";
import { XlsxStylesWriter } from "./XlsxStylesWriter";
import { XlsxThemeWriter } from "./XlsxThemeWriter";
import { XlsxWorkbookWriter } from "./XlsxWorkbookWriter";

export class XlsxWriter implements XlsxWriterAdapter {
    sheetWriters: Map<symbol, XlsxSheetWriter> = new Map();
    
    styles: XlsxStylesWriter;
    globalRelations: XlsxRelationsWriter;
    workbookRelations: XlsxRelationsWriter;
    workbook: XlsxWorkbookWriter;
    coreProps: XlsxCorePropsWriter
    appProps: XlsxAppPropsWriter
    contentTypes: XlsxContentTypesWriter;
    theme: XlsxThemeWriter
    sharedStrings: XlsxSharedStringsWriter;


    // Writes to the zip file
    zipWriter: ZipWriterAdapter


    constructor(zipWriter: ZipWriterAdapter) {
        this.zipWriter = zipWriter;
        
        this.styles = new XlsxStylesWriter()
        this.globalRelations = new XlsxRelationsWriter();
        this.workbook = new XlsxWorkbookWriter();
        this.workbookRelations = new XlsxRelationsWriter();
        this.coreProps = new XlsxCorePropsWriter();
        this.appProps = new XlsxAppPropsWriter();
        this.contentTypes = new XlsxContentTypesWriter();
        this.theme = new XlsxThemeWriter();
        this.sharedStrings = new XlsxSharedStringsWriter();
    }

    private async init() {
        await this.zipWriter.addDirectory('_rels');
        await this.zipWriter.addDirectory('xl');
        await this.zipWriter.addDirectory('xl/_rels');
        await this.zipWriter.addDirectory('xl/worksheets');
        await this.zipWriter.addDirectory('docProps');
        await this.zipWriter.addDirectory('xl/theme');
        
        this.styles.writeStream = await this.zipWriter.addFile('xl/styles.xml');
        this.sharedStrings.writeStream = await this.zipWriter.addFile('xl/sharedStrings.xml');
        this.globalRelations.writeStream = await this.zipWriter.addFile('_rels/.rels');
        this.workbook.writeStream = await this.zipWriter.addFile('xl/workbook.xml');
        this.workbookRelations.writeStream = await this.zipWriter.addFile('xl/_rels/workbook.xml.rels');
        this.theme.writeStream = await this.zipWriter.addFile('xl/theme/theme1.xml');

        this.coreProps.writeStream = await this.zipWriter.addFile('docProps/core.xml');
        this.appProps.writeStream = await this.zipWriter.addFile('docProps/app.xml');
        this.contentTypes.writeStream = await this.zipWriter.addFile('[Content_Types].xml');

        await this.globalRelations.addRelation({
            target: 'docProps/app.xml',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties'
        });

        await this.contentTypes.addOverride({
            partName: '/docProps/app.xml',
            contentType: 'application/vnd.openxmlformats-officedocument.extended-properties+xml'
        });

        await this.globalRelations.addRelation({
            target: 'docProps/core.xml',
            type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'
        });

        await this.contentTypes.addOverride({
            partName: '/docProps/core.xml',
            contentType: 'application/vnd.openxmlformats-package.core-properties+xml'
        });

        await this.globalRelations.addRelation({
            target: 'xl/workbook.xml',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
        });

        await this.contentTypes.addOverride({
            partName: '/xl/workbook.xml',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
        });

        // Wire up styles relation
        await this.workbookRelations.addRelation({
            target: 'styles.xml',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
        });

        // Add sheet to content types
        await this.contentTypes.addOverride({
            partName: `/xl/styles.xml`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'
        });

        // Theme relation: todo
        await this.workbookRelations.addRelation({
            target: 'theme/theme1.xml',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
        });

        // Add theme to content types: todo
        await this.contentTypes.addOverride({
            partName: `/xl/theme/theme1.xml`,
            contentType: 'application/vnd.openxmlformats-officedocument.theme+xml'
        });

        // Shared strings relation: todo
        await this.workbookRelations.addRelation({
            target: 'sharedStrings.xml',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings'
        });

        // Add shared strings to content types: todo
        await this.contentTypes.addOverride({
            partName: `/xl/sharedStrings.xml`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml'
        });

    }

    async addSheet(name: string): Promise<symbol> {
        const sheet = new XlsxSheetWriter();
        const nameSlug = 'sheet' + (this.sheetWriters.size + 1);
        const path = `worksheets/${nameSlug}.xml`;

        // Write relationship
        const relationId = await this.workbookRelations.addRelation({
            target: path,
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'
        });

        // Add sheet to workbook file
        await this.workbook.addSheet({name, relationId});

        // Add sheet to content types
        await this.contentTypes.addOverride({
            partName: `/xl/${path}`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'
        });

        sheet.writeStream = await this.zipWriter.addFile(`xl/${path}`);
        sheet.styles = this.styles;

        const symbol = Symbol(name);
        this.sheetWriters.set(symbol, sheet);
        return symbol;
    }

    /**
     * Called when all sheets have been added and all files are ready to be written
     */
    async ready() {
        await this.init();
        await this.zipWriter.ready?.();
    }

    addRow(sheet: symbol, values: CellValue[]): Promise<void> | void {
        const writer = this.sheetWriters.get(sheet);
        if (!writer) {
            throw new Error('Sheet not found');
        }

        return writer.writeRow(values);
    }

    async close(): Promise<void> {

        // Close all sheet writers
        console.log('Closing sheet writers')
        for (const writer of this.sheetWriters.values()) {
            await writer.close();
        }

        // Close styles
        console.log('Closing styles')
        await this.styles.close();

        // Close shared strings
        console.log('Closing shared strings')
        await this.sharedStrings.close();

        // Close workbook
        console.log('Closing workbook')
        await this.workbook.close();

        // Close workbook relations
        console.log('Closing workbook relations')
        await this.workbookRelations.close();

        // Close global relations
        console.log('Closing global relations')
        await this.globalRelations.close();

        // Close core props
        console.log('Closing core props')
        await this.coreProps.close();

        // Close app props
        console.log('Closing app props')
        await this.appProps.close();

        // Close theme
        console.log('Closing theme')
        await this.theme.close();

        // Close content types
        console.log('Closing content types')
        await this.contentTypes.close();

        // All writes streams should be closed now
        console.log('Closing zip writer')
        await this.zipWriter.close();
    }
    
}
