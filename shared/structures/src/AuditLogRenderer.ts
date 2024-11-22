export type RenderContext = {
    type: 'text' | 'html';
    context: Record<string, any>;
    helpers: Record<string, Helper>;
};

type Helper = (context: RenderContext, ...args: unknown[]) => unknown[];

class RendersState {
    previousBackslash = false;
    previousIsOpenCurly = false;
    previousIsEndCurly = false;

    insideCurly = false;

    pendingString = '';
    output: any[] = [];

    currentHelper: Helper | null = null;
    currentHelperArgs: unknown[] = [];

    context: RenderContext;

    pos = 0;

    endCurlyWord() {
        // Check helper
        const helperName = this.pendingString.trim();

        if (helperName.length === 0) {
            return;
        }

        if (this.currentHelper === null && this.context.helpers[helperName]) {
            this.currentHelper = this.context.helpers[helperName];
        }
        else {
            if (!this.currentHelper) {
                // Default output helper
                this.currentHelper = (_c, ...v: unknown[]) => v;
            }

            if (helperName.startsWith('"')) {
                const parseString = JSON.parse(helperName);
                if (typeof parseString === 'string') {
                    this.currentHelperArgs.push(parseString);
                }
                else {
                    throw new Error(`Invalid string ${helperName} at ${this.pos - this.pendingString.length}`);
                }
            }
            else if (this.context.context[helperName]) {
                this.currentHelperArgs.push(this.context.context[helperName]);
            }
            else {
                throw new Error(`Unknown helper or variable: ${helperName} at ${this.pos - this.pendingString.length}`);
            }
        }
        this.pendingString = '';
    }

    addOutput(...vv: (string | any)[]) {
        for (const v of vv) {
            const last = this.output[this.output.length - 1];
            if (typeof last === 'string' && typeof v === 'string') {
                this.output[this.output.length - 1] = last + v;
                return;
            }
            this.output.push(v);
        }
    }

    process(char: string) {
        this.pos += 1;

        if (char === '\\') {
            this.previousBackslash = true;
            return;
        }

        if (this.insideCurly) {
            this.previousIsOpenCurly = false;

            if (this.previousBackslash) {
                this.pendingString += char;
                this.previousBackslash = false;
                this.previousIsEndCurly = false;
            }
            else if (char === ' ') {
                this.previousIsEndCurly = false;
                this.endCurlyWord();
            }
            else if (char === '}') {
                // Ending
                if (this.previousIsEndCurly) {
                    this.endCurlyWord();

                    if (!this.currentHelper) {
                        throw new Error('Unexpected } at position ' + this.pos);
                    }

                    // End
                    this.insideCurly = false;

                    this.addOutput(...this.currentHelper(this.context, ...this.currentHelperArgs));
                    this.currentHelperArgs = [];
                    this.currentHelper = null;
                    this.pendingString = '';
                    this.previousIsEndCurly = false;
                }
                else {
                    this.previousIsEndCurly = true;
                }
            }
            else {
                this.pendingString += char;
                this.previousIsEndCurly = false;
            }
            return;
        }
        this.previousIsEndCurly = false;

        if (this.previousBackslash) {
            this.addOutput(char);
            this.previousBackslash = false;
            this.previousIsOpenCurly = false;
            return;
        }

        if (char === '{') {
            if (this.previousIsOpenCurly) {
                this.insideCurly = true;
            }
            this.previousIsOpenCurly = true;
            return;
        }

        if (this.previousIsOpenCurly) {
            this.addOutput('{');
        }
        this.previousIsOpenCurly = false;

        this.addOutput(char);

        return;
    }
}

/**
 * Very basic lightweight rendering method - to avoid loading expensive dependencies for simple rendering
 */

export function renderTemplate(template: string, context: RenderContext) {
    const state = new RendersState();
    state.context = context;

    for (const char of template) {
        state.process(char);
    }

    return state.output;
}
