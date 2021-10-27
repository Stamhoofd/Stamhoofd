import { EncodedResponse, Request, RequestMiddleware,ResponseMiddleware } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Version } from "@stamhoofd/structures";

export const AppVersionMiddleware: ResponseMiddleware & RequestMiddleware = {
    handleRequest(request: Request) {
        if (request.method == "OPTIONS") {
            return
        }
        const platform = request.headers["x-platform"];
        const version = request.getVersion()
        if (version < 128) {
            if (platform === "web" || platform === undefined) {
                throw new SimpleError({
                    code: "client_update_required",
                    statusCode: 400,
                    message: "Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.",
                    human: "Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser."
                })
            } else {
                throw new SimpleError({
                    code: "client_update_required",
                    statusCode: 400,
                    message: "Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!",
                    human: "Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!"
                })
            }
        }
    },

    handleResponse(request: Request, response: EncodedResponse) {
        const platform = request.headers["x-platform"];

        if (platform === "android" && STAMHOOFD.LATEST_ANDROID_VERSION) {
            response.headers["X-Platform-Latest-Version"] = STAMHOOFD.LATEST_ANDROID_VERSION
        }
        if (platform === "ios" && STAMHOOFD.LATEST_IOS_VERSION) {
            response.headers["X-Platform-Latest-Version"] = STAMHOOFD.LATEST_IOS_VERSION
        }
        if (platform === "web") {
            response.headers["X-Platform-Latest-Version"] = Version
        }
    }
}