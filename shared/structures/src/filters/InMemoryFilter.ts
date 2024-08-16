import { StringCompare } from "@stamhoofd/utility";

import { StamhoofdCompareValue, StamhoofdFilter } from "./StamhoofdFilter";

export type InMemoryFilterRunner = (object: any) => boolean;

export type InMemoryFilterCompiler = (filter: StamhoofdFilter, filters: InMemoryFilterDefinitions) => InMemoryFilterRunner;
export type InMemoryFilterDefinitions = Record<string, InMemoryFilterCompiler>


function $andInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const runners = compileInMemoryFilter(filter, filters);
    return (object) => {
        for (const runner of runners) {
            if (!runner(object)) {
                return false;
            }
        }
        return true;
    };
}

function $orInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const runners = compileInMemoryFilter(filter, filters)
    return (object) => {
        for (const runner of runners) {
            if (runner(object)) {
                return true;
            }
        }
        return false;
    };
}

function $notInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const andRunner = $andInMemoryFilterCompiler(filter, filters);
    return (object) => {
        return !andRunner(object);
    };
}

function $lessThanInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(guardFilterCompareValue(val));
        const b = normalizeValue(guardFilterCompareValue(filter));
        if (a === null || b === null) {
            return a !== null && b === null;
        }
        return a < b
    };
}

function $equalsInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const b = normalizeValue(guardFilterCompareValue(filter));

        if (Array.isArray(val)) {
            // To match backend logic where these things are required for optimizations
            // + also match MongoDB behavior

            for (const v of val) {
                const a = normalizeValue(guardFilterCompareValue(v));

                if (a === b) {
                    return true;
                }
            }
            return false;
        }

        const a = normalizeValue(guardFilterCompareValue(val));
        return a === b
    };
}

function invertFilterCompiler(compiler: InMemoryFilterCompiler): InMemoryFilterCompiler {
    return (filter: StamhoofdFilter, filters: InMemoryFilterDefinitions) => {
        const runner = compiler(filter, filters);
        return (val) => {
            return !runner(val);
        };
    }
}

function $containsInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(guardFilterCompareValue(val));
        const needle = normalizeValue(guardFilterCompareValue(filter));

        if (typeof a !== 'string' || typeof needle !== 'string') {
            return false;
        }
        return StringCompare.contains(a, needle)
    };
}

function $inInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        if (!Array.isArray(filter)) {
            throw new Error('Invalid filter: expected array as value for $in filter')
        }

        if (Array.isArray(val)) {
            // To match backend logic (JSON_OVERLAPS in MySQL) where these things are required for optimizations
            // + also match MongoDB behavior 

            for (const v of val) {
                const a = normalizeValue(guardFilterCompareValue(v));

                for (const element of filter) {
                    const b = normalizeValue(guardFilterCompareValue(element));
                    if (a === b) {
                        return true;
                    }
                }
            }
            return false;
        }

        const a = normalizeValue(guardFilterCompareValue(val));

        for (const element of filter) {
            const b = normalizeValue(guardFilterCompareValue(element));
            if (a === b) {
                return true;
            }
        }

        return false;
    };
}

function $lengthInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const runner = $andInMemoryFilterCompiler(filter, filters);

    return (val) => {
        if (typeof val === 'string' || Array.isArray(val)) {
            return runner(val.length)
        }

        throw new Error('Invalid filter: expected string or array as value for $length filter')
    };
}


function objectPathValue(object: any, path: string[]) {
    if (path.length === 0)  {
        return object;
    }

    const nextSearched = path[0];
    if (nextSearched in object) {
        return objectPathValue(object[nextSearched], path.slice(1))
    }
}

function guardFilterCompareValue(val: any): StamhoofdCompareValue {
    if (val instanceof Date) {
        return val
    }

    if (typeof val === 'string') {
        return val
    }

    if (typeof val === 'number') {
        return val
    }

    if (typeof val === 'boolean') {
        return val;
    }

    if (val === null) {
        return null;
    }

    throw new Error('Invalid compare value. Expected a string, number, boolean, date or null.')
}

function normalizeValue(val: StamhoofdCompareValue): string|number|null {
    if (val instanceof Date) {
        return val.getTime()
    }

    if (typeof val === 'string') {
        return val.toLocaleLowerCase()
    }

    if (typeof val === 'boolean') {
        return val === true ? 1 : 0;
    }

    if (val === null) {
        return null;
    }

    return val;
}

function wrapPlainFilter(filter: StamhoofdFilter): Exclude<StamhoofdFilter, StamhoofdCompareValue> {
    if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined || filter instanceof Date) {
        return {
            $eq: filter
        }
    }
    return filter;
}

export function createInMemoryFilterCompiler(path: string): InMemoryFilterCompiler {
    const splitted = path.split('.');

    return (filter: StamhoofdFilter, filters: InMemoryFilterDefinitions) => {
        const runner = $andInMemoryFilterCompiler(filter, filters)

        return (object) => {
            const value = objectPathValue(object, splitted);
            return runner(value);
        };
    }
}

export const baseInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    '$and': $andInMemoryFilterCompiler,
    '$or': $orInMemoryFilterCompiler,
    '$not': $notInMemoryFilterCompiler,
    '$eq': $equalsInMemoryFilterCompiler,
    '$neq': invertFilterCompiler($equalsInMemoryFilterCompiler),
    '$lt': $lessThanInMemoryFilterCompiler,
    '$gt': invertFilterCompiler($lessThanInMemoryFilterCompiler),
    '$in': $inInMemoryFilterCompiler,
    '$contains': $containsInMemoryFilterCompiler,
    '$length': $lengthInMemoryFilterCompiler,
}

function compileInMemoryFilter(filter: StamhoofdFilter, definitions: InMemoryFilterDefinitions): InMemoryFilterRunner[] {
    if (filter === undefined) {
        return [];
    }

    const runners: InMemoryFilterRunner[] = []

    for (const f2 of (Array.isArray(filter) ? filter : [filter])) {
        if (!f2) {
            continue;
        }
        const f = wrapPlainFilter(f2);
        for (const key of Object.keys(f)) {
            if (!(key in definitions)) {
                throw new Error('Unsupported filter ' + key)
            }
            const filterCompiler = definitions[key];
            const subFilter = f[key] as StamhoofdFilter

            const s = filterCompiler(subFilter, definitions)
            if (s === undefined || s === null) {
                throw new Error('Unsupported filter value for ' + key)
            }
            runners.push(s);
        }
    }

    return runners
}

export const compileToInMemoryFilter = $andInMemoryFilterCompiler
