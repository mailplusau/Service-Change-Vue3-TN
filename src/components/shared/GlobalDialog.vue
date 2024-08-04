<script setup>
import { useGlobalDialog } from "@/stores/global-dialog";
import {computed} from 'vue';

const globalDialog = useGlobalDialog();

const niceProgress = computed(() => Math.floor(globalDialog.progress) + '%')
</script>

<template>
    <v-dialog
        v-model="globalDialog.open"
        :max-width="globalDialog.maxWith"
        :persistent="globalDialog.persistent"
    >
        <v-card class="bg-background">
            <v-card-title :class="'text-h5' + (globalDialog.isError ? ' red--text' : '')" v-if="globalDialog.title">
                <v-icon v-show="globalDialog.isError" class="mr-2" color="red">mdi-alert-outline</v-icon>
                {{ globalDialog.title }}
            </v-card-title>

            <v-card-text :class="globalDialog.busy ? 'text-center' : ''">
                <div v-html="globalDialog.body"></div>
                <v-progress-linear v-show="globalDialog.busy" color="primary" :model-value="globalDialog.progress" striped height="5"
                                   :indeterminate="globalDialog.progress < 0 || globalDialog.progress > 100 || globalDialog.progress === null">

                </v-progress-linear>
                {{ (globalDialog.progress >= 0 && 100 >= globalDialog.progress && globalDialog.showProgressPercent) ? niceProgress : '' }}

            </v-card-text>

            <v-card-actions v-if="!globalDialog.hideButtons">
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