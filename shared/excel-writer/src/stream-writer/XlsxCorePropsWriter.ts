import { escapeXml } from './escapeXml';
import { XlsxFileWriter } from './XlsxFileWriter';

export class XlsxCorePropsWriter extends XlsxFileWriter {
    creator = 'Stamhoofd';
    lastModifiedBy = 'Stamhoofd';

    async close() {
        await this.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
        await this.write(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>`);

        /*
<cp:coreProperties
    xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
    xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
    xmlns:dcmitype="http://purl.org/dc/dcmitype/"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <dc:creator>${escapeXml(this.creator)}</dc:creator>
    <cp:lastModifiedBy>${escapeXml(this.lastModifiedBy)}</cp:lastModifiedBy>
    <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(new Date().toISOString())}</dcterms:created>
    <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(new Date().toISOString())}</dcterms:modified>
</cp:coreProperties>`); */

        await super.close();
    }
}
