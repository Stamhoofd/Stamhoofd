import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { Toast } from '@stamhoofd/components';
import { NetworkManager, SessionContext } from '@stamhoofd/networking';
import { Document } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export async function getDocumentPdfBuffer($context: SessionContext, document: Document, owner?: any): Promise<Buffer> {
    const cacheId = 'document-' + document.id;
    const timestamp = document.updatedAt.getTime();

    // Check if we have a cached version available
    try {
        const cachedResponse = await NetworkManager.rendererServer.request({
            method: 'GET',
            path: '/pdf-cache',
            query: {
                cacheId,
                timestamp,
            },
            shouldRetry: true,
            timeout: 60 * 1000,
            owner,
            responseType: 'blob',
        });
        return cachedResponse.data as Buffer;
    }
    catch (e) {
        if (Request.isAbortError(e)) {
            throw e;
        }
        let ignore = false;
        if (isSimpleError(e) || isSimpleErrors(e)) {
            if (e.hasCode('cache_not_found')) {
                ignore = true;
            }
        }
        if (!ignore) {
            console.error(e);
        }
    }

    const response = await $context.authenticatedServer.request({
        method: 'GET',
        path: '/documents/' + encodeURIComponent(document.id) + '/html',
        shouldRetry: true,
        timeout: 60 * 1000,
        owner,
        responseType: 'blob',
    });

    if (!response.headers['x-cache-id'] || !response.headers['x-cache-timestamp'] || !response.headers['x-cache-signature']) {
        throw new Error('Missing cache headers');
    }

    /* if (STAMHOOFD.environment === 'development') {
        // Return html
        return response.data as Buffer;
    } */

    const form = new FormData();
    // We need to send the html as a Blob, because FormData otherwise breaks the html signature by changing LF to CRLF
    form.append('html', response.data as Blob);
    form.append('cacheId', response.headers['x-cache-id'] as string);
    form.append('timestamp', response.headers['x-cache-timestamp'] as string);
    form.append('signature', response.headers['x-cache-signature'] as string);

    // Convert to PDF
    const pdfResponse = await NetworkManager.rendererServer.request({
        method: 'POST',
        path: '/html-to-pdf',
        body: form as FormData,
        shouldRetry: true,
        timeout: 60 * 1000,
        owner,
        responseType: 'blob',
    });

    return pdfResponse.data as Buffer;
}

export async function downloadDocument($context: SessionContext, document: Document, owner?: any) {
    try {
        const buffer = await getDocumentPdfBuffer($context, document, owner);

        /* if (STAMHOOFD.environment === 'development') {
            // Open html in new tab
            const blob = new Blob([buffer], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url);
            return;
        } */
        const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
        saveAs(buffer, Formatter.fileSlug(document.data.name + ' - ' + document.data.description) + '.pdf');
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            Toast.fromError(e).show();
        }
        else {
            new Toast('Downloaden geannuleerd', 'info').show();
        }
    }
}

export async function downloadDocuments($context: SessionContext, documents: Document[], owner?: any) {
    if (documents.length === 1) {
        await downloadDocument($context, documents[0], owner);
        return;
    }

    let pendingToast: Toast | null = null;
    try {
        pendingToast = new Toast('Documenten downloaden...', 'spinner').setProgress(0).setHide(null).show();
        const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
        const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
        const zip = new JSZip();

        const entries = documents.entries();
        const maxConcurrency = 4;

        const promises = new Array(maxConcurrency).fill(0).map(async () => {
            for (const [index, document] of entries) {
                const buffer = await getDocumentPdfBuffer($context, document, owner);
                zip.file(Formatter.fileSlug(document.id + ' - ' + document.data.name + ' - ' + document.data.description) + '.pdf', buffer);
                pendingToast?.setProgress((index + 1) / documents.length);
            }
        });

        await Promise.all(promises);

        pendingToast?.hide();
        pendingToast = new Toast('Documenten bundelen in een .zip...', 'spinner').setHide(null).show();
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        saveAs(blob, 'documenten.zip');
        pendingToast?.hide();
    }
    catch (e) {
        pendingToast?.hide();
        if (!Request.isAbortError(e)) {
            Toast.fromError(e).show();
        }
        else {
            new Toast('Downloaden geannuleerd', 'info').show();
        }
    }
}
