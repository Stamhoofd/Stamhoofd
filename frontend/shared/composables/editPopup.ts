import { AutoEncoder, AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { usePop } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, Toast, useErrors, usePatch } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { Ref, readonly, ref } from "vue";

export function useEditPopup<T extends AutoEncoder>({errors, saveHandler, deleteHandler, toPatch}: {errors: ReturnType<typeof useErrors>, saveHandler: (patch: AutoEncoderPatchType<T>) => Promise<void>, deleteHandler: (() => Promise<void>)|null, toPatch: T|Ref<T>}) {
    const pop = usePop();
    const saving = ref(false);
    const deleting = ref(false);
    const $t = useTranslate();
    const {patched, hasChanges, addPatch, patch} = usePatch(toPatch);

    const save = async () => {
        if (saving.value || deleting.value) {
            return;
        }
        saving.value = true;
        try {
            await saveHandler(patch.value)
            await pop({ force: true }) 
        } catch (e) {
            errors.errorBox = new ErrorBox(e)
        }
        saving.value = false;
    };

    const doDelete = async (text: string, confirmText?: string, description?: string) => {
        if (saving.value || deleting.value || !deleteHandler) {
            return;
        }

        if (!await CenteredMessage.confirm(text, confirmText ?? $t('shared.confirmDelete'), description)) {
            return
        }
            
        deleting.value = true;

        try {
            await deleteHandler()
            await pop({ force: true }) 
        } catch (e) {
            Toast.fromError(e).show();
        }
    
        deleting.value = false;
    };

    const shouldNavigateAway = async () => {
        if (!hasChanges.value) {
            return true;
        }
        
        return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
    }

    return {
        saving: readonly(saving),
        deleting: readonly(deleting),
        save: readonly(save),
        doDelete: readonly(doDelete),
        shouldNavigateAway: readonly(shouldNavigateAway),
        hasChanges: readonly(hasChanges),
        patched: patched,
        addPatch: readonly(addPatch),
        patch: readonly(patch)
    }
}
