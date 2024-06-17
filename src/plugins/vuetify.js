/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import 'vuetify/styles';

// Composables
import {createVuetify} from 'vuetify';

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
    theme: {
        themes: {
            light: {
                colors: {
                    primary: '#095c7b',
                    secondary: '#eaf044',
                    accent: '#103d39',
                    error: '#b71c1c',
                    background: '#cfe0ce',
                }
            },
        },
    },
});
