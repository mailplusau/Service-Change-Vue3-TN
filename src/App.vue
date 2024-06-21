<script setup>
import { onMounted } from "vue";
import GlobalDialog from "@/components/shared/GlobalDialog.vue";
import MainView from "@/views/Main.vue";
import { useMainStore } from "@/stores/main";

const mainStore = useMainStore();

onMounted(() => {
    mainStore.init();
})

function addShortcut() {
    if (top['addShortcut']) top['addShortcut']();
    else console.error('addShortcut function not found.')
}
</script>

<template>
    <v-app>
        <v-main>
            <v-container fluid>
                <v-row class="mx-1" justify="space-between" align="center">
                    <v-col cols="auto">
                        <h2 class="text-primary">
                            {{ mainStore.pageTitle }}
                        </h2>
                    </v-col>

                    <v-col cols="auto">
                        <a v-if="true" @click="addShortcut" :style="{cursor: 'pointer'}"
                           class="subtitle-1 text-primary">Add To Shortcuts <v-icon size="20" color="primary">mdi-open-in-new</v-icon></a>
                    </v-col>
                </v-row>
            </v-container>

            <v-divider class="mb-3"></v-divider>

            <MainView />

        </v-main>
    </v-app>

    <GlobalDialog />
</template>

<style>
.v-list-item {
    min-height: 40px !important;
}
.v-list-item-title {
    font-size: .85rem !important;
    font-weight: 500;
}
.cell-text-size {
    font-size: 11px !important;
}
.v-input.v-text-field-no-pl input {
    padding-left: 0 !important;
}
.v-input.v-text-field-primary-color-input input {
    color: #095c7b;
    font-weight: bold;
}
</style>