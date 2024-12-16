<script setup>
import DatePicker from '@/components/shared/DatePicker.vue';
import {rules} from '@/utils/utils.mjs';
import {useCommRegStore} from '@/stores/comm-reg';
import {useMiscStore} from '@/stores/misc';
import {computed, ref} from 'vue';
import {COMM_REG_STATUS} from '@/utils/defaults.mjs';
import {useGlobalDialog} from '@/stores/global-dialog';
import {useServiceStore} from '@/stores/services';

const { validate } = rules;
const commRegStore = useCommRegStore();
const miscStore = useMiscStore();
const globalDialog = useGlobalDialog();
const serviceStore = useServiceStore();

const fileInput = ref();
const mainForm = ref(null);
const formValid = ref(true);
const dialogOpen = ref(false);
const previewDialog = ref(false);
const commRegStatuses = computed(() => {
    return Object.keys(COMM_REG_STATUS).map(key => ({
        title: key.replace('_', ' '),
        value: `${COMM_REG_STATUS[key]}`
    }))
})

async function proceed() {
    let res = await mainForm.value['validate']();
    if (!res.valid) return console.log('Fix the errors');
    globalDialog.displayProgress('', 'Saving Commencement Register...');
    await commRegStore.saveCommReg();
    dialogOpen.value = false;
    await globalDialog.close(1500, 'Save Complete!');
}

async function previewFile() {
    await commRegStore.generatePreviewUrl();
    previewDialog.value = true;
}

function cancelUpload() {
    commRegStore.form.attachedFile = null;
}

function upload() {
    fileInput.value.click();
}
</script>

<template>
    <v-dialog width="750" v-model="dialogOpen">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn color="secondary" variant="outlined" size="small" class="mr-2 text-none" v-bind="activatorProps" :disabled="serviceStore.data.loading">
                {{ commRegStore.id ? 'Edit Commencement Register' : 'Create Commencement Register' }}
            </v-btn>
        </template>

        <v-card color="background">
            <v-container fluid>
                <v-form class="v-row justify-center" ref="mainForm" v-model="formValid" :disabled="commRegStore.form.disabled">
                    <v-col cols="12" class="text-h5 text-center text-primary">Edit Commencement Register</v-col>

                    <v-col cols="4">
                        <v-autocomplete density="compact" label="Status:" :disabled="commRegStore.form.disabled"
                                        v-model="commRegStore.form.data.custrecord_trial_status"
                                        :items="commRegStatuses"
                                        :rules="[v => validate(v, 'required')]"
                                        variant="outlined" color="primary" persistent-placeholder
                        ></v-autocomplete>
                    </v-col>

                    <v-col cols="4">
                        <DatePicker v-model="commRegStore.form.data.custrecord_comm_date_signup" title="Date - Signup">
                            <template v-slot:activator="{ activatorProps, displayDate }">
                                <v-text-field v-bind="activatorProps" :model-value="displayDate" :disabled="commRegStore.form.disabled" persistent-placeholder
                                              :rules="[v => validate(v, 'required')]"
                                              label="Date - Signup:" variant="outlined" density="compact" color="primary"></v-text-field>
                            </template>
                        </DatePicker>
                    </v-col>

                    <v-col cols="4">
                        <DatePicker v-model="commRegStore.form.data.custrecord_date_entry" title="Date - Entry">
                            <template v-slot:activator="{ activatorProps, displayDate }">
                                <v-text-field v-bind="activatorProps" :model-value="displayDate" :disabled="commRegStore.form.disabled" persistent-placeholder
                                              :rules="[v => validate(v, 'required')]"
                                              label="Date - Entry:" variant="outlined" density="compact" color="primary"></v-text-field>
                            </template>
                        </DatePicker>
                    </v-col>

                    <v-col cols="7">
                        <v-autocomplete density="compact" label="Commencement Type:" :disabled="commRegStore.form.disabled"
                                        v-model="commRegStore.form.data.custrecord_sale_type"
                                        :items="miscStore.commencementTypeOptions"
                                        :rules="[v => validate(v, 'required')]"
                                        variant="outlined" color="primary" persistent-placeholder
                        ></v-autocomplete>
                    </v-col>

                    <v-col cols="5">
                        <v-autocomplete density="compact" label="Inbound / Outbound:" :disabled="commRegStore.form.disabled"
                                        v-model="commRegStore.form.data.custrecord_in_out"
                                        :items="miscStore.inOutOptions"
                                        :rules="[v => validate(v, 'required')]"
                                        variant="outlined" color="primary" persistent-placeholder
                        ></v-autocomplete>
                    </v-col>

                    <v-col cols="5">
                        <DatePicker v-model="commRegStore.form.data.custrecord_tnc_agreement_date" title="T&C Agreement Date">
                            <template v-slot:activator="{ activatorProps, displayDate, clearInput }">
                                <v-text-field v-bind="activatorProps" :model-value="displayDate" :disabled="commRegStore.form.disabled"
                                              label="T&C Agreement Date:" variant="outlined" density="compact" color="primary"
                                              :append-inner-icon="!!displayDate ? 'mdi-close' : ''"
                                              @click:append-inner.stop="clearInput()"></v-text-field>
                            </template>
                        </DatePicker>
                    </v-col>

                    <v-col cols="7">
                        <v-text-field v-if="commRegStore.form.data.custrecord_scand_form"
                                      density="compact" label="SCF:" color="primary" variant="outlined"
                                      :model-value="commRegStore.form.attachedFile ? commRegStore.form.attachedFile.name : `NetSuite Cabinet file ID ${commRegStore.form.data.custrecord_scand_form}`"
                                      readonly>
                            <template v-slot:append-inner>
                                <v-btn v-if="commRegStore.form.attachedFile"
                                       icon="mdi-close" variant="text" color="red" size="small" title="Cancel upload" @click="cancelUpload()"></v-btn>
                                <v-btn icon="mdi-cloud-upload-outline" variant="text" color="primary" size="small" @click="upload()"></v-btn>
                                <v-btn icon="mdi-eye-outline" variant="text" color="primary" size="small" @click="previewFile()"></v-btn>
                            </template>
                        </v-text-field>

                        <v-file-input v-show="!commRegStore.form.data.custrecord_scand_form" ref="fileInput"
                                      density="compact" label="SCF:" color="primary" variant="outlined"
                                      v-model="commRegStore.form.attachedFile" accept=".pdf" prepend-icon=""
                                      :disabled="commRegStore.form.disabled"></v-file-input>
                    </v-col>

                    <v-col cols="auto"><v-btn @click="dialogOpen = false">Cancel</v-btn></v-col>

                    <v-col cols="auto">
                        <v-btn color="green" variant="elevated" @click="proceed()">Save Commencement Register</v-btn>
                    </v-col>
                </v-form>
            </v-container>

            <v-dialog v-model="previewDialog"
                      fullscreen hide-overlay scrollable transition="dialog-bottom-transition">
                <v-card class="bg-primary">
                    <v-toolbar dark color="primary">
                        <v-toolbar-title>
                            Previewing File
                        </v-toolbar-title>
                        <v-spacer></v-spacer>
                        <v-toolbar-items>
                            <v-btn color="yellow" variant="text" @click="previewDialog = false">
                                close
                            </v-btn>
                        </v-toolbar-items>
                    </v-toolbar>

                    <v-divider></v-divider>

                    <object v-if="commRegStore.form.attachedFilePreview" class="webview-iframe"
                            type="application/pdf" :data="commRegStore.form.attachedFilePreview"></object>
                </v-card>
            </v-dialog>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.webview-iframe {
    height: 100%;
    width: 100%;
    border: none;
    overflow: scroll;
}
</style>