<script setup>
import { useGlobalDialog } from "@/stores/global-dialog";

const globalDialog = useGlobalDialog();
</script>

<template>
    <v-dialog
        v-model="globalDialog.open"
        :max-width="globalDialog.maxWith"
        :persistent="globalDialog.persistent"
    >
        <v-card class="bg-background">
            <v-card-title :class="'text-h5' + (globalDialog.isError ? ' red--text' : '')">
                <v-icon v-show="globalDialog.isError" class="mr-2" color="red">mdi-alert-outline</v-icon>
                {{ globalDialog.title }}
            </v-card-title>


            <v-card-text v-show="globalDialog.busy" class="text-center">
                <v-progress-circular
                    :indeterminate="globalDialog.progress < 0 || globalDialog.progress > 100 || globalDialog.progress === null"
                    :model-value="globalDialog.progress"
                    color="primary"
                    size="50"
                >{{ (globalDialog.progress >= 0 && 100 >= globalDialog.progress) ? globalDialog.progress + '%' : '' }}</v-progress-circular>
            </v-card-text>

            <v-card-text :class="globalDialog.busy ? 'text-center' : ''" v-html="globalDialog.body"></v-card-text>

            <v-card-actions>
                <template v-for="(button, index) in globalDialog.buttons">
                    <v-spacer v-if="typeof button === 'string' && button === 'spacer'" :key="'button' + index"></v-spacer>
                    <v-btn v-else-if="typeof button === 'object'" :key="'button' + index"
                           :color="button.color || 'green darken-1'"
                           :variant="button.variant || 'text'"
                           @click="() => { if (button.action) button.action(); else globalDialog.open = false;}"
                           :disabled="globalDialog.busy"
                    >
                        {{ button.text}}
                    </v-btn>
                </template>
                <template v-if="!globalDialog.buttons.length">
                    <v-spacer></v-spacer>
                    <v-btn color="green darken-1" variant="text" @click="globalDialog.open = false" :disabled="globalDialog.busy">
                        Okay
                    </v-btn>
                </template>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>