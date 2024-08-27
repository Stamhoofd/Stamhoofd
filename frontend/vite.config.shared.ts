import viteSvgToWebfont from 'vite-svg-2-webfont';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path, { resolve } from 'path';

import iconConfig from './shared/assets/images/icons/icons.font';
import { UserConfig } from 'vite';

const use_env: Record<string, string> = {}

// This is a debug config as a replacement for process.env.NODE_ENV which seems to break webpack 5
// process.env.BUILD_FOR_PRODUCTION

if (process.env.NODE_ENV === "production") {
    console.log("Building for production...")
}

if (process.env.LOAD_ENV) {
    // Load this in the environment
    const decode = JSON.parse(process.env.LOAD_ENV);

    if (!decode.userMode || !decode.translationNamespace) {
        throw new Error('Invalid env file: missing some variables')
    }

    // We restringify to make sure encoding is minified
    use_env["STAMHOOFD"] = JSON.stringify(decode);
    use_env["process.env.NODE_ENV"] = JSON.stringify(decode.environment === "production" ? "production" : "development")
} else if (process.env.ENV_FILE) {
    // Reading environment from a JSON env file (JSON is needed)
    const file = path.resolve(process.env.ENV_FILE)

    // Load this in the environment
    const contents = fs.readFileSync(file)
    const decode = JSON.parse(contents);
    const node_env = JSON.stringify(decode.environment === "production" ? "production" : "development")

    if (!decode.userMode || !decode.translationNamespace) {
        throw new Error('Invalid env file: missing some variables')
    }

    console.log("Using environment file: "+file)

    const stamhoofdEnv = JSON.stringify(decode)

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env["STAMHOOFD"] = stamhoofdEnv
    
    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env["process.env.NODE_ENV"] = node_env

} else {
    throw new Error("ENV_FILE or LOAD_ENV environment variables are missing")
}

// https://vitejs.dev/config/
export function buildConfig(options: {port: number, clientFiles?: string[]}): UserConfig {
    return {
        mode: process.env.NODE_ENV !== 'production' ? 'development' : 'production',
        resolve: {
            alias: {
                '@stamhoofd/components': resolve(__dirname, './shared/components')
            }
        },
        plugins: [
            vue({
                template: {
                    compilerOptions: {
                        comments: false
                    }
                }
            }),
            viteSvgToWebfont({
                ...iconConfig,
                context: resolve(__dirname, './shared/assets/images/icons/'),
                cssTemplate: resolve(__dirname, './shared/assets/images/icons/iconCss.hbs'),
            }),
        ],
        define: use_env,
        server: process.env.NODE_ENV !== 'production' ? {
            host: '127.0.0.1',
            port: options.port,
            strictPort: true,
            warmup: {
                clientFiles: [
                    ...(options?.clientFiles ?? []),
                    resolve(__dirname, './shared') + '/**/*.vue',
                    resolve(__dirname, './shared') + '/**/*.ts'
                ]
            }
        } : undefined,
        build: process.env.NODE_ENV !== 'production' ? {
            sourcemap: 'inline',
            rollupOptions: {
                treeshake: false, // Increases performance
            },
            watch: {
                buildDelay: 1000
            }
        } : {
            sourcemap: true
        },
        publicDir: resolve(__dirname, './public')
    }
}
