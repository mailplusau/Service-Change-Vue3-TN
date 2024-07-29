<script setup>
import {useServiceStore} from '@/stores/services';
import { rules, allowOnlyNumericalInput, formatPrice } from "@/utils/utils.mjs";
import DatePicker from '@/components/shared/DatePicker.vue';
import {computed, ref} from 'vue';
import {useDataStore} from '@/stores/data';
import {useUserStore} from '@/stores/user';

const serviceStore = useServiceStore();
const dataStore = useDataStore();
const userStore = useUserStore();
const { validate } = rules;
const formValid = ref(true);
const serviceChangeForm = ref(null);

const dialogTitle = computed(() => {
    if (!serviceStore.changeDialog.form.custrecord_servicechg_service) return 'Add New Service'

    let index = serviceStore.data.all.findIndex(item => parseInt(item.internalid) === parseInt(serviceStore.changeDialog.form.custrecord_servicechg_service));

    return `Changing Service ${index >= 0 ? serviceStore.data.all[index]['custrecord_service_text'] : '[unknown]'}`;
});

const serviceTypes = computed(() => dataStore.serviceTypes.filter(item => serviceStore.serviceTypesInUse.indexOf(item.value) < 0))
const serviceChangeTypes = computed(() => dataStore.serviceChangeTypes
    .filter(item => userStore.isAdmin || ['extra service', 'change of frequency', 'change of price', 'change of service', 're-sign', 'save'].includes(item.title.trim().toLowerCase()))
    .map(item => ({value: item.title, title: item.title})));

function getFreqByTerm(term) {
    let terms = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'];
    let freqArray = serviceStore.changeDialog.form.custrecord_servicechg_new_freq ?
        serviceStore.changeDialog.form.custrecord_servicechg_new_freq.split(',').map(item => isNaN(item) ? '' : parseInt(item)).sort() : [];

    if ((term + '').toLowerCase() === 'daily') return freqArray.toString() === [1, 2, 3, 4, 5].toString();

    return freqArray.includes(terms.indexOf((term + '').toLowerCase()) + 1);
}

function setFreqByTerm(term, isChecked) {
    let terms = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'];
    let freqArray = serviceStore.changeDialog.form.custrecord_servicechg_new_freq ?
        serviceStore.changeDialog.form.custrecord_servicechg_new_freq.split(',').map(item => isNaN(item) ? '' : parseInt(item)).sort() : [];

    if ((term + '').toLowerCase() === 'daily')
        serviceStore.changeDialog.form.custrecord_servicechg_new_freq = isChecked ? [1, 2, 3, 4, 5].join(',') : '';
    else if ((term + '').toLowerCase() === 'adhoc')
        serviceStore.changeDialog.form.custrecord_servicechg_new_freq = isChecked ? '6' : '';
    else if (isChecked) {
        serviceStore.changeDialog.form.custrecord_servicechg_new_freq = [...(new Set([...freqArray, terms.indexOf((term + '').toLowerCase()) + 1]))].join(',')
    } else {
        let termIndex = terms.indexOf((term + '').toLowerCase()) + 1;
        if (termIndex > 0) {
            freqArray.splice(freqArray.indexOf(termIndex), 1);
            serviceStore.changeDialog.form.custrecord_servicechg_new_freq = freqArray.join(',');
        }
    }
}

async function saveServiceChange() {
    const { valid } = await serviceChangeForm.value.validate();
    if (!valid) return false;
    await serviceStore.saveServiceChange();
    return true;
}

</script>

<template>
    <v-dialog v-model="serviceStore.changeDialog.open" width="600">
        <v-card class="bg-background">
            <v-container>
                <v-row>
                    <v-col cols="12" class="text-center font-weight-bold text-primary">{{dialogTitle}}</v-col>
                </v-row>
                <v-form class="v-row justify-center align-center" ref="serviceChangeForm" v-model="formValid">
                    <v-col cols="6">
                        <DatePicker v-model="serviceStore.changeDialog.form.custrecord_servicechg_date_effective" readonly>
                            <template v-slot:activator="{ activatorProps, displayDate, readonly }">
                                <v-text-field v-bind="readonly ? null : activatorProps" :model-value="displayDate" readonly
                                              label="Effective Date" variant="outlined" density="compact" color="primary" ></v-text-field>
                            </template>
                        </DatePicker>
                    </v-col>
                    <v-col cols="6">
                        <v-autocomplete label="Sales Type" variant="outlined" density="compact" color="primary"
                                        :items="serviceChangeTypes"
                                        v-model="serviceStore.changeDialog.form.custrecord_servicechg_type"
                                        :rules="[v => validate(v, 'required', 'Sales Type')]"></v-autocomplete>
                    </v-col>
                    <v-col cols="4" v-if="!serviceStore.changeDialog.form.custrecord_servicechg_service">
                        <v-autocomplete label="Service Type" variant="outlined" density="compact" color="primary"
                                        :items="serviceTypes"
                                        v-model="serviceStore.changeDialog.form.serviceType"
                                        :rules="[v => validate(v, 'required', 'Service Type')]"></v-autocomplete>
                    </v-col>
                    <v-col :cols="!serviceStore.changeDialog.form.custrecord_servicechg_service ? 8 : 12">
                        <v-text-field label="Price" class="v-text-field-primary-color-input"
                                      placeholder="0.00" step="0.01" color="primary"
                                      :rules="[v => validate(v, 'required|minValue:0', 'Price')]"
                                      persistent-placeholder
                                      type="number" variant="outlined" density="compact"
                                      v-model="serviceStore.changeDialog.form.custrecord_servicechg_new_price">
                            <template v-slot:default>
                                <b class="text-red">{{ formatPrice(serviceStore.changeDialog.form.custrecord_servicechg_old_price) }}</b>
                                <v-icon size="large">mdi-arrow-right-thin</v-icon>
                                <b class="text-primary">A$</b>
                            </template>
                        </v-text-field>
                    </v-col>
                    <v-col cols="12">
                        <v-text-field label="Description" v-model="serviceStore.changeDialog.form.serviceDescription"
                                      color="primary" variant="outlined" density="compact" hide-details></v-text-field>
                    </v-col>
                    <v-col cols="auto">
                        <v-checkbox label="Daily" color="primary" hide-details density="compact"
                                    :model-value="getFreqByTerm('daily')"
                                    @update:model-value="v => setFreqByTerm('daily', v)"></v-checkbox>
                    </v-col>
                    <v-col cols="auto">
                        <v-checkbox label="Adhoc" color="primary" hide-details density="compact"
                                    :model-value="getFreqByTerm('adhoc')"
                                    @update:model-value="v => setFreqByTerm('adhoc', v)"></v-checkbox>
                    </v-col>
                    <v-row justify="space-evenly">
                        <v-col cols="auto">
                            <v-checkbox label="Monday" color="primary" hide-details density="compact"
                                        :model-value="getFreqByTerm('mon')"
                                        @update:model-value="v => setFreqByTerm('mon', v)"></v-checkbox>
                        </v-col>
                        <v-col cols="auto">
                            <v-checkbox label="Tuesday" color="primary" hide-details density="compact"
                                        :model-value="getFreqByTerm('tue')"
                                        @update:model-value="v => setFreqByTerm('tue', v)"></v-checkbox>
                        </v-col>
                        <v-col cols="auto">
                            <v-checkbox label="Wednesday" color="primary" hide-details density="compact"
                                        :model-value="getFreqByTerm('wed')"
                                        @update:model-value="v => setFreqByTerm('wed', v)"></v-checkbox>
                        </v-col>
                        <v-col cols="auto">
                            <v-checkbox label="Thursday" color="primary" hide-details density="compact"
                                        :model-value="getFreqByTerm('thu')"
                                        @update:model-value="v => setFreqByTerm('thu', v)"></v-checkbox>
                        </v-col>
                        <v-col cols="auto">
                            <v-checkbox label="Friday" color="primary" hide-details density="compact"
                                        :model-value="getFreqByTerm('fri')"
                                        @update:model-value="v => setFreqByTerm('fri', v)"></v-checkbox>
                        </v-col>
                    </v-row>
                </v-form>
                <v-row justify="center" align="center">
                    <v-col cols="auto">
                        <v-btn @click="serviceStore.changeDialog.open = false">Cancel</v-btn>
                    </v-col>
                    <v-col cols="auto">
                        <v-btn v-if="serviceStore.changeDialog.form.custrecord_servicechg_new_freq"
                               color="green" @click="saveServiceChange">Save</v-btn>
                        <v-btn v-else variant="outlined" color="red" readonly>Please specify frequency</v-btn>
                    </v-col>
                </v-row>
            </v-container>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>