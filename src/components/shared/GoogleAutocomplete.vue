<script setup>
import { computed, ref, watch, defineProps, defineEmits } from 'vue';

const emit = defineEmits(['placeChanged']);
const props = defineProps({
    label: {
        type: String,
        default: 'Location'
    },
    density: {
        type: String,
        default: 'comfortable'
    },
    variant: {
        type: String,
        default: 'underlined'
    },
    clearable: {
        type: Boolean,
        default: false
    },
    rules: {
        type: Array,
        default: null
    },
    color: {
        type: String,
        default: 'primary'
    }
});

let autocompleteLocationModel = ref(null);
let locationSearchText = ref('');
let locationEntries = ref([]);

const locationFoundItems = computed(() => locationEntries.value);

watch(autocompleteLocationModel, (newVal, oldVal) => {
    if (!newVal?.id) return emit('placeChanged', null);

    let placeResult = new google.maps.places.PlacesService(document.getElementById('decoy'));

    placeResult.getDetails({ placeId: newVal.id }, (x) => {
        emit('placeChanged', x);
    });
});

watch(locationSearchText, (newVal, oldVal) => {
    _getSuggestions(newVal)
        .then(function (res) {
            locationEntries.value = res;
        })
        .catch(function (err) {
            // error handling goes here
            console.log(err);
        });
});

async function _getSuggestions(searchText) {
    let result;

    try {
        const rawResult = await _searchLocation(searchText);
        result = rawResult.map((res) => {
            return {
                id: res.place_id,
                value: res.description
            };
        });
    } catch (err) {
        console.log('An error occurred', err);
        result = null;
    }
    return result;
}

async function _searchLocation(val) {
    return await new Promise((resolve, reject) => {
        let displaySuggestions = (predictions, status) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK) {
                reject(status);
            }
            resolve(predictions);
        };

        let service = new google.maps.places.AutocompleteService();
        service.getPlacePredictions(
            {
                input: val,
                types: [],
                componentRestrictions: {
                    country: 'au'
                }
            },
            displaySuggestions
        );
    }).catch(function (err) {
        throw err;
    });
}

async function setInput(searchString) {
    let res = await _getSuggestions(searchString);
    if (res?.length) {
        locationEntries.value = res;
        autocompleteLocationModel.value = locationEntries.value[0];
    }
}

function clearInput() {
    console.log('clearing input')
    autocompleteLocationModel.value = null;
}

defineExpose({ setInput, clearInput });
</script>

<template>
    <v-autocomplete
        :label="label"
        id="decoy"
        v-model="autocompleteLocationModel"
        :items="locationFoundItems"
        :search="locationSearchText"
        @update:search="(v) => (locationSearchText = v)"
        item-title="value"
        item-value="id"
        hide-no-data
        return-object
        :density="density"
        :color="color"
        :variant="variant"
        :clearable="clearable"
        :rules="rules"
    >
    </v-autocomplete>
</template>

<style scoped></style>