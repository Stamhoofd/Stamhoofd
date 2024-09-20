import { useTranslate } from "@stamhoofd/frontend-i18n";
import { SetupStepReview } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

export function useSetupStepReviewDescription(): { getDescription: (review: SetupStepReview | null, short?: boolean, textIfNotReviewed?: string) => string } {
    const $t = useTranslate();

    function getDescription(review: SetupStepReview | null, short = false, textIfNotReviewed = $t('Niet nagekeken')): string {
        if(review) {
            const reviewedAtString = Formatter.date(review.date, true);
            const userName = review.userName;

            if(short) {
                // todo: translate
                return `Nagekeken op ${reviewedAtString}`;
            }
            // todo: translate
            return `Gemarkeerd als nagekeken op ${reviewedAtString} door ${userName}`;
        }

        return textIfNotReviewed;
    }

    return {
        getDescription
    }
}